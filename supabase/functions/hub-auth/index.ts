import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hubUrl = Deno.env.get("VITE_HUB_SUPABASE_URL")!;
    const hubAnonKey = Deno.env.get("VITE_HUB_SUPABASE_ANON_KEY")!;

    if (!hubUrl || !hubAnonKey) {
      return new Response(
        JSON.stringify({ error: "HUB configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const hubClient = createClient(hubUrl, hubAnonKey);

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate against Hub
    const { data: hubAuth, error: hubError } = await hubClient.auth.signInWithPassword({ email, password });

    if (hubError || !hubAuth.user || !hubAuth.session) {
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hubUser = hubAuth.user;
    const hubToken = hubAuth.session.access_token;

    // Fetch the Hub profile to get role and membership info
    const { data: hubProfile } = await hubClient
      .from("profiles")
      .select("role, full_name, membership_slug, membership_name")
      .eq("id", hubUser.id)
      .maybeSingle();

    const role = hubProfile?.role ?? hubUser.user_metadata?.role ?? "athlete";
    const fullName = hubProfile?.full_name ?? hubUser.user_metadata?.full_name ?? hubUser.email;

    // Look up or create local profile by hub_user_id
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, hub_user_id, role, full_name, email")
      .eq("hub_user_id", hubUser.id)
      .maybeSingle();

    if (!existingProfile) {
      // Also try by email in case profile exists unlinked
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id, hub_user_id, role, full_name, email")
        .eq("email", email)
        .is("hub_user_id", null)
        .maybeSingle();

      if (profileByEmail) {
        // Link the existing profile
        await supabaseAdmin
          .from("profiles")
          .update({
            hub_user_id: hubUser.id,
            role: role === "trainer" ? "coach" : role,
            full_name: fullName,
            membership_slug: hubProfile?.membership_slug ?? "inicia",
            membership_name: hubProfile?.membership_name ?? "Asciende Inicia",
          })
          .eq("id", profileByEmail.id);
      } else {
        // Create new profile
        await supabaseAdmin
          .from("profiles")
          .insert({
            hub_user_id: hubUser.id,
            email: hubUser.email,
            role: role === "trainer" ? "coach" : role,
            full_name: fullName,
            membership_slug: hubProfile?.membership_slug ?? "inicia",
            membership_name: hubProfile?.membership_name ?? "Asciende Inicia",
          });
      }
    } else {
      // Update existing profile with latest Hub data
      await supabaseAdmin
        .from("profiles")
        .update({
          email: hubUser.email,
          role: role === "trainer" ? "coach" : role,
          full_name: fullName,
          membership_slug: hubProfile?.membership_slug ?? existingProfile.role,
          membership_name: hubProfile?.membership_name ?? "Asciende",
        })
        .eq("id", existingProfile.id);
    }

    // Return the Hub JWT so the client can store it directly
    return new Response(
      JSON.stringify({
        success: true,
        token: hubToken,
        user: {
          id: hubUser.id,
          email: hubUser.email,
          name: fullName,
          role: role === "trainer" ? "coach" : role,
          membership_slug: hubProfile?.membership_slug ?? "inicia",
          membership_name: hubProfile?.membership_name ?? "Asciende Inicia",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in hub-auth function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
