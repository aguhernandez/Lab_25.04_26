import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hubUrl = Deno.env.get("VITE_HUB_SUPABASE_URL");

    if (!hubUrl) {
      return new Response(
        JSON.stringify({ error: "HUB_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get planner token from lab_settings
    const { data: settings, error: settingsError } = await supabase
      .from("lab_settings")
      .select("planner_token")
      .maybeSingle();

    if (settingsError || !settings?.planner_token) {
      return new Response(
        JSON.stringify({ error: "Planner token not configured. Add it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    // The endpoint comes after /hub-data-proxy/ in the path
    // e.g. /functions/v1/hub-data-proxy/coach-athletes
    const endpoint = pathParts[pathParts.length - 1] || "";

    const allowedEndpoints = ["coach-athletes"];
    if (!allowedEndpoints.includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Unknown endpoint: ${endpoint}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward request to Hub's planner-hub-api
    const hubApiUrl = `${hubUrl}/functions/v1/planner-hub-api/${endpoint}${url.search}`;

    const headers: Record<string, string> = {
      "X-Planner-Token": settings.planner_token,
      "Content-Type": "application/json",
    };

    // Forward the Authorization header (Hub JWT token) if present
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    let hubResponse: Response;
    if (req.method === "GET") {
      hubResponse = await fetch(hubApiUrl, { method: "GET", headers });
    } else {
      const body = await req.text();
      hubResponse = await fetch(hubApiUrl, { method: req.method, headers, body });
    }

    const responseText = await hubResponse.text();

    return new Response(responseText, {
      status: hubResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("hub-data-proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
