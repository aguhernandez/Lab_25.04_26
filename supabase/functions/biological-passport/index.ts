import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Api-Key",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    const pathname = url.pathname;

    const athleteMatch = pathname.match(/\/biological-passport\/athlete\/([^/]+)(\/history)?/);

    if (!athleteMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid route. Use /biological-passport/athlete/:athlete_id or /biological-passport/athlete/:athlete_id/history" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const athlete_id = athleteMatch[1];
    const isHistory = !!athleteMatch[2];

    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("id, name, sport, date_of_birth, sex, weight_kg, height_cm, body_fat_percent, lean_body_mass_kg")
      .eq("id", athlete_id)
      .maybeSingle();

    if (athleteError || !athlete) {
      return new Response(
        JSON.stringify({ data: null, error: "Athlete not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isHistory) {
      return await handleHistory(supabase, athlete, corsHeaders);
    }

    return await handleLatestPassport(supabase, athlete, corsHeaders);

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleLatestPassport(
  supabase: ReturnType<typeof createClient>,
  athlete: Record<string, unknown>,
  corsHeaders: Record<string, string>
) {
  const athlete_id = athlete.id as string;

  const [physResult, anthroResult] = await Promise.all([
    supabase
      .from("athlete_physiology_profiles")
      .select(`
        id, source, last_test_date, last_test_id,
        vo2max_absolute_l_min, vo2max_relative_ml_kg_min, vo2max_relative_ml_ffm_min,
        lt1_hr, lt1_power, lt1_pace, lt1_percent_vo2max, lt1_percent_hrmax,
        lt2_hr, lt2_power, lt2_pace, lt2_percent_vo2max, lt2_percent_hrmax,
        fatmax_hr, fatmax_power, fatmax_pace,
        vam_kmh, pam_watts, hrmax,
        physiology_zones
      `)
      .eq("athlete_id", athlete_id)
      .maybeSingle(),

    supabase
      .from("athlete_anthropometry_profiles")
      .select(`
        id, weight_kg, height_cm, body_fat_percent,
        muscle_mass_kg, bone_mass_kg, adipose_mass_kg,
        skin_mass_kg, residual_mass_kg, bmi, measurement_id,
        applied_at
      `)
      .eq("athlete_id", athlete_id)
      .maybeSingle(),
  ]);

  const physProfile = physResult.data;
  const anthroProfile = anthroResult.data;

  let testProtocol: string | null = null;
  let testResults: Record<string, unknown> | null = null;

  if (physProfile?.last_test_id) {
    const { data: test } = await supabase
      .from("tests")
      .select("id, test_type, sport, test_date")
      .eq("id", physProfile.last_test_id)
      .maybeSingle();

    if (test) {
      const protocolMap: Record<string, string> = {
        ramp: "Ramp Protocol",
        step: "Step Protocol",
        steady_state: "Steady State",
        manual: "Manual Entry",
      };
      testProtocol = protocolMap[test.test_type as string] ?? (test.test_type as string);
    }

    const { data: result } = await supabase
      .from("test_results")
      .select("advanced_metrics, training_zones, coach_notes")
      .eq("test_id", physProfile.last_test_id)
      .maybeSingle();

    testResults = result;
  }

  let kerrData: Record<string, unknown> | null = null;
  if (anthroProfile?.measurement_id) {
    const { data: kerr } = await supabase
      .from("anthropometry_kerr_results")
      .select(`
        id, sum_6_skinfolds, muscle_bone_ratio,
        adipose_mass_kg, muscle_mass_kg, bone_mass_kg,
        adipose_mass_z_score, muscle_mass_z_score, bone_mass_z_score
      `)
      .eq("measurement_id", anthroProfile.measurement_id)
      .maybeSingle();
    kerrData = kerr;
  }

  const advancedMetrics = (testResults?.advanced_metrics as Record<string, unknown>) ?? {};
  const trainingZones = (physProfile?.physiology_zones as Record<string, unknown>) ?? {};
  const testTrainingZones = (testResults?.training_zones as Record<string, unknown>) ?? {};
  const mergedZones = { ...testTrainingZones, ...trainingZones };

  const powerZones = (mergedZones.power_zones ?? mergedZones.powerZones ?? null) as Record<string, unknown> | null;
  const hrZones = (mergedZones.hr_zones ?? mergedZones.hrZones ?? mergedZones.heart_rate_zones ?? null) as Record<string, unknown> | null;
  const rpeZones = (mergedZones.rpe_zones ?? mergedZones.rpeZones ?? null) as Record<string, unknown> | null;

  const weightKg = (anthroProfile?.weight_kg ?? athlete.weight_kg) as number | null;
  const heightCm = (anthroProfile?.height_cm ?? athlete.height_cm) as number | null;
  const muscleMassKg = (kerrData?.muscle_mass_kg ?? anthroProfile?.muscle_mass_kg ?? null) as number | null;
  const adiposeMassKg = (kerrData?.adipose_mass_kg ?? anthroProfile?.adipose_mass_kg ?? null) as number | null;
  const boneMassKg = (kerrData?.bone_mass_kg ?? anthroProfile?.bone_mass_kg ?? null) as number | null;
  const bodyFatPct = (anthroProfile?.body_fat_percent ?? athlete.body_fat_percent) as number | null;

  let leanMassKg: number | null = null;
  if (weightKg !== null && adiposeMassKg !== null) {
    leanMassKg = parseFloat((weightKg - adiposeMassKg).toFixed(2));
  } else if (weightKg !== null && bodyFatPct !== null) {
    leanMassKg = parseFloat((weightKg * (1 - bodyFatPct / 100)).toFixed(2));
  } else {
    leanMassKg = (athlete.lean_body_mass_kg as number | null) ?? null;
  }

  const athleteLevel = deriveAthleteLevel(physProfile?.vo2max_relative_ml_kg_min as number | null, athlete.sport as string);
  const trainingAge = (advancedMetrics.training_age_years ?? null) as number | null;

  const passport = {
    record_id: (physProfile?.id as string) ?? null,
    measurement_date: (physProfile?.last_test_date as string) ?? null,
    test_protocol: testProtocol ?? "Lab Test",
    notes: (testResults?.coach_notes as string) ?? null,

    physiological: {
      vo2max: (physProfile?.vo2max_relative_ml_kg_min as number) ?? null,
      lt1_power: (physProfile?.lt1_power as number) ?? null,
      lt2_power: (physProfile?.lt2_power as number) ?? null,
      lt1_hr: (physProfile?.lt1_hr as number) ?? null,
      lt2_hr: (physProfile?.lt2_hr as number) ?? null,
      ftp_watts: (advancedMetrics.ftp_watts ?? advancedMetrics.ftp ?? null) as number | null,
      critical_power: (advancedMetrics.critical_power ?? null) as number | null,
      anaerobic_capacity_kj: (advancedMetrics.anaerobic_capacity_kj ?? advancedMetrics.w_prime_kj ?? null) as number | null,
      running_threshold_pace: (physProfile?.lt2_pace ?? physProfile?.lt1_pace ?? null) as string | null,
      power_zones_json: powerZones ?? {},
      hr_zones_json: hrZones ?? {},
      rpe_zones_json: rpeZones ?? {},
    },

    anthropometry: {
      height_cm: heightCm,
      weight_kg: weightKg,
      body_fat_percent: bodyFatPct,
      muscle_mass_kg: muscleMassKg,
      lean_mass_kg: leanMassKg,
      bone_mass_kg: boneMassKg,
    },

    athletic_profile: {
      training_age_years: trainingAge,
      athlete_level: athleteLevel,
    },
  };

  return new Response(
    JSON.stringify(passport),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function deriveAthleteLevel(vo2max: number | null, sport: string): string {
  if (vo2max === null) return "intermediate";

  const isCycling = sport?.toLowerCase().includes("cycl") || sport?.toLowerCase().includes("bici");
  const isRunning = sport?.toLowerCase().includes("run") || sport?.toLowerCase().includes("corre");

  if (isCycling) {
    if (vo2max >= 70) return "elite";
    if (vo2max >= 60) return "advanced";
    if (vo2max >= 48) return "intermediate";
    return "beginner";
  }

  if (isRunning) {
    if (vo2max >= 65) return "elite";
    if (vo2max >= 55) return "advanced";
    if (vo2max >= 45) return "intermediate";
    return "beginner";
  }

  if (vo2max >= 65) return "elite";
  if (vo2max >= 55) return "advanced";
  if (vo2max >= 45) return "intermediate";
  return "beginner";
}

async function handleHistory(
  supabase: ReturnType<typeof createClient>,
  athlete: Record<string, unknown>,
  corsHeaders: Record<string, string>
) {
  const athlete_id = athlete.id as string;

  const { data: tests, error } = await supabase
    .from("tests")
    .select(`
      id, test_date, test_type, sport, status,
      test_results (
        id, vo2max, lt1_hr, lt1_power, lt2_hr, lt2_power,
        fatmax_hr, training_zones, advanced_metrics, coach_notes
      )
    `)
    .eq("athlete_id", athlete_id)
    .eq("status", "completed")
    .order("test_date", { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch history", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const protocolMap: Record<string, string> = {
    ramp: "Ramp Protocol",
    step: "Step Protocol",
    steady_state: "Steady State",
    manual: "Manual Entry",
  };

  const history = (tests ?? []).map((test) => {
    const result = Array.isArray(test.test_results) ? test.test_results[0] : test.test_results;
    const zones = (result?.training_zones as Record<string, unknown>) ?? {};
    const advanced = (result?.advanced_metrics as Record<string, unknown>) ?? {};

    return {
      record_id: result?.id ?? test.id,
      measurement_date: test.test_date,
      test_protocol: protocolMap[test.test_type as string] ?? test.test_type,
      sport: test.sport,
      source: "lab",
      notes: result?.coach_notes ?? null,
      physiological: result ? {
        vo2max: result.vo2max ?? null,
        lt1_power: result.lt1_power ?? null,
        lt2_power: result.lt2_power ?? null,
        lt1_hr: result.lt1_hr ?? null,
        lt2_hr: result.lt2_hr ?? null,
        ftp_watts: (advanced.ftp_watts ?? advanced.ftp ?? null) as number | null,
        critical_power: (advanced.critical_power ?? null) as number | null,
        anaerobic_capacity_kj: (advanced.anaerobic_capacity_kj ?? advanced.w_prime_kj ?? null) as number | null,
        power_zones_json: (zones.power_zones ?? zones.powerZones ?? {}) as Record<string, unknown>,
        hr_zones_json: (zones.hr_zones ?? zones.hrZones ?? zones.heart_rate_zones ?? {}) as Record<string, unknown>,
        rpe_zones_json: (zones.rpe_zones ?? zones.rpeZones ?? {}) as Record<string, unknown>,
      } : null,
    };
  });

  return new Response(
    JSON.stringify({
      athlete_id,
      athlete_name: athlete.name,
      total_records: history.length,
      history,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
