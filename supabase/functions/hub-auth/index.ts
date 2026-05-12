import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizeRole(role: string | undefined | null): string {
  if (!role) return "athlete";
  if (role === "trainer") return "coach";
  return role;
}

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

    // Role resolution: Hub profiles table → user_metadata → app_metadata → default
    // Try multiple possible role column names and locations
    const { data: hubProfile, error: profileError } = await hubClient
      .from("profiles")
      .select("role, full_name, membership_slug, membership_name")
      .eq("id", hubUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("Hub profile query error:", profileError);
    }

    // Build role from most reliable source first
    const rawRole =
      hubProfile?.role ||                           // Hub profiles table
      hubUser.user_metadata?.role ||                // user_metadata in JWT
      hubUser.app_metadata?.role ||                 // app_metadata in JWT
      null;

    const role = normalizeRole(rawRole);

    const fullName =
      hubProfile?.full_name ||
      hubUser.user_metadata?.full_name ||
      hubUser.user_metadata?.name ||
      hubUser.email;

    const membershipSlug =
      hubProfile?.membership_slug ||
      hubUser.user_metadata?.membership_slug ||
      "inicia";

    const membershipName =
      hubProfile?.membership_name ||
      hubUser.user_metadata?.membership_name ||
      "Asciende Inicia";

    console.log(`[hub-auth] User ${email}: raw_role="${rawRole}" → normalized="${role}"`);

    // Look up or create local profile by hub_user_id
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, hub_user_id, role, full_name, email")
      .eq("hub_user_id", hubUser.id)
      .maybeSingle();

    if (!existingProfile) {
      // Try to find by email (unlinked profile)
      const { data: profileByEmail } = await supabaseAdmin
        .from("profiles")
        .select("id, hub_user_id")
        .eq("email", email)
        .is("hub_user_id", null)
        .maybeSingle();

      if (profileByEmail) {
        await supabaseAdmin
          .from("profiles")
          .update({ hub_user_id: hubUser.id, role, full_name: fullName, membership_slug: membershipSlug, membership_name: membershipName })
          .eq("id", profileByEmail.id);
      } else {
        await supabaseAdmin
          .from("profiles")
          .insert({ hub_user_id: hubUser.id, email: hubUser.email, role, full_name: fullName, membership_slug: membershipSlug, membership_name: membershipName });
      }
    } else {
      await supabaseAdmin
        .from("profiles")
        .update({ email: hubUser.email, role, full_name: fullName, membership_slug: membershipSlug, membership_name: membershipName })
        .eq("id", existingProfile.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: hubToken,
        user: {
          id: hubUser.id,
          email: hubUser.email,
          name: fullName,
          role,
          membership_slug: membershipSlug,
          membership_name: membershipName,
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
