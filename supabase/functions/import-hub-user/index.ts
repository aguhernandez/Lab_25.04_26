import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, full_name, external_hub_user_id, role } = await req.json();

    if (!email || !external_hub_user_id) {
      return new Response(
        JSON.stringify({ error: "email and external_hub_user_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("external_hub_user_id", external_hub_user_id)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User already imported", profile: existingUser }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const password = crypto.randomUUID();

    const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || "",
      },
    });

    if (createUserError) {
      console.error("Error creating user:", createUserError);
      return new Response(
        JSON.stringify({ error: createUserError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError) {
      console.error("Error sending password reset email:", resetError);
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userData.user.id,
        external_hub_user_id: external_hub_user_id,
        full_name: full_name || "",
        role: role || "athlete",
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating profile:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);

      return new Response(
        JSON.stringify({ error: profileError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let athleteData = null;

    if (role === "athlete" || !role) {
      const { data: existingAthlete } = await supabaseAdmin
        .from("athletes")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (existingAthlete) {
        const { data: updatedAthlete, error: updateError } = await supabaseAdmin
          .from("athletes")
          .update({
            external_hub_user_id: external_hub_user_id,
            name: full_name || existingAthlete.name,
          })
          .eq("id", existingAthlete.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating athlete record:", updateError);
          await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
          await supabaseAdmin.auth.admin.deleteUser(userData.user.id);

          return new Response(
            JSON.stringify({ error: updateError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        athleteData = updatedAthlete;
      } else {
        const { data: newAthlete, error: athleteError } = await supabaseAdmin
          .from("athletes")
          .insert({
            name: full_name || email.split('@')[0],
            email: email,
            external_hub_user_id: external_hub_user_id,
            sport: "running",
          })
          .select()
          .single();

        if (athleteError) {
          console.error("Error creating athlete record:", athleteError);
          await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
          await supabaseAdmin.auth.admin.deleteUser(userData.user.id);

          return new Response(
            JSON.stringify({ error: athleteError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        athleteData = newAthlete;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: userData.user,
        profile: profileData,
        athlete: athleteData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in import-hub-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});