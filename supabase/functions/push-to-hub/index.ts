import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const body = await req.json();
    const { athlete_id } = body;

    if (!athlete_id) {
      return new Response(
        JSON.stringify({ error: "athlete_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from("lab_settings")
      .select("id, planner_token")
      .maybeSingle();

    if (settingsError || !settings?.planner_token) {
      return new Response(
        JSON.stringify({ error: "Planner token not configured. Add it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: athlete, error: athleteError } = await supabase
      .from("athletes")
      .select("id, name, sport, email, hub_user_id, weight_kg, height_cm, body_fat_percent, lean_body_mass_kg")
      .eq("id", athlete_id)
      .maybeSingle();

    if (athleteError || !athlete) {
      return new Response(
        JSON.stringify({ error: "Athlete not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!athlete.hub_user_id && !athlete.email) {
      return new Response(
        JSON.stringify({ error: "Athlete has no email and is not linked to a Hub user. Add an email to the athlete first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [
      physResult,
      anthroResult,
      trainingZonesResult,
      hydrationProfileResult,
      hydrationSessionResult,
      heatProfileResult,
      heatSessionResult,
      fvSessionResult,
    ] = await Promise.all([
      supabase
        .from("athlete_physiology_profiles")
        .select(`
          id, last_test_date, last_test_id,
          vo2max_relative_ml_kg_min,
          lt1_hr, lt1_power, lt1_pace,
          lt2_hr, lt2_power, lt2_pace,
          fatmax_hr, fatmax_power,
          vam_kmh, pam_watts, hrmax,
          physiology_zones
        `)
        .eq("athlete_id", athlete_id)
        .maybeSingle(),

      supabase
        .from("athlete_anthropometry_profiles")
        .select("weight_kg, height_cm, body_fat_percent, muscle_mass_kg, bone_mass_kg, adipose_mass_kg, measurement_id")
        .eq("athlete_id", athlete_id)
        .maybeSingle(),

      supabase
        .from("athlete_training_zones")
        .select("heart_rate_zones, power_zones, pace_zones, physiology_reference")
        .eq("athlete_id", athlete_id)
        .maybeSingle(),

      supabase
        .from("athlete_hydration_profiles")
        .select(`
          last_session_date, last_percent_dehydration, last_sweat_rate_l_h,
          last_hydration_stress_score, last_classification,
          last_temperature_c, last_humidity_percent,
          average_sweat_rate_l_h, max_observed_dehydration_percent,
          total_sessions, baseline_usg
        `)
        .eq("athlete_id", athlete_id)
        .maybeSingle(),

      supabase
        .from("athlete_hydration_sessions")
        .select(`
          session_date, pre_weight_kg, post_weight_kg, fluid_intake_ml, urine_output_ml,
          duration_min, temperature_c, humidity_percent, avg_hr, rpe,
          usg_pre, usg_post, adjusted_sweat_loss_kg, percent_dehydration,
          sweat_rate_l_h, heat_stress_factor, hydration_stress_score,
          stress_classification, usg_classification, usg_post_classification, notes
        `)
        .eq("athlete_id", athlete_id)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("athlete_heat_profiles")
        .select(`
          total_sessions, baseline_cardiac_load, latest_cardiac_load, cardiac_load_trend,
          baseline_hr_drift, latest_hr_drift, hr_drift_trend,
          baseline_rpe, latest_rpe, rpe_trend,
          avg_sweat_rate_l_h, latest_sweat_rate_l_h,
          adaptation_score, adaptation_classification, last_session_date
        `)
        .eq("athlete_id", athlete_id)
        .maybeSingle(),

      supabase
        .from("athlete_heat_sessions")
        .select(`
          session_date, temperature_c, humidity_percent, sport, duration_min,
          avg_hr, hr_first_half, hr_second_half, external_load, load_unit,
          pre_weight_kg, post_weight_kg, fluid_intake_ml,
          percent_dehydration, sweat_rate_l_h, rpe,
          heat_cardiac_load, hr_drift_percent, heat_adaptation_score, notes
        `)
        .eq("athlete_id", athlete_id)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("fv_sessions")
        .select(`
          id, session_date, exercise, sport, notes,
          f0, v0, pmax, fv_slope, r_squared, body_mass_kg
        `)
        .eq("athlete_id", athlete_id)
        .order("session_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const physProfile = physResult.data;
    const anthroProfile = anthroResult.data;
    const trainingZones = trainingZonesResult.data;
    const hydrationProfile = hydrationProfileResult.data;
    const hydrationSession = hydrationSessionResult.data;
    const heatProfile = heatProfileResult.data;
    const heatSession = heatSessionResult.data;
    const fvSession = fvSessionResult.data;

    let fvReps: Array<Record<string, unknown>> = [];
    if (fvSession?.id) {
      const { data: reps } = await supabase
        .from("fv_repetitions")
        .select("set_number, rep_number, load_kg, mean_velocity_ms, peak_velocity_ms, mean_force_n, peak_force_n, mean_power_w, peak_power_w, is_valid")
        .eq("session_id", fvSession.id)
        .eq("is_valid", true)
        .order("load_kg", { ascending: true });
      fvReps = (reps ?? []) as Array<Record<string, unknown>>;
    }

    let testResults: Record<string, unknown> | null = null;
    let testProtocol = "Lab Test";

    if (physProfile?.last_test_id) {
      const { data: test } = await supabase
        .from("tests")
        .select("test_type")
        .eq("id", physProfile.last_test_id)
        .maybeSingle();

      if (test) {
        const protocolMap: Record<string, string> = {
          ramp: "Ramp Protocol",
          step: "Step Protocol",
          steady_state: "Steady State",
          manual: "Manual Entry",
        };
        testProtocol = protocolMap[test.test_type as string] ?? test.test_type as string;
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
          adipose_mass_kg, muscle_mass_kg, bone_mass_kg, residual_mass_kg, skin_mass_kg,
          adipose_mass_z_score, muscle_mass_z_score, bone_mass_z_score,
          sum_6_skinfolds, index_muscle_bone
        `)
        .eq("measurement_id", anthroProfile.measurement_id)
        .maybeSingle();
      kerrData = kerr;
    }

    const advancedMetrics = (testResults?.advanced_metrics as Record<string, unknown>) ?? {};

    const lt1Hr = (physProfile?.lt1_hr ?? null) as number | null;
    const lt2Hr = (physProfile?.lt2_hr ?? null) as number | null;

    const computedHRmax = (() => {
      const fromProfile = physProfile?.hrmax as number | null;
      if (fromProfile) return fromProfile;
      const dob = athlete.date_of_birth as string | null;
      const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 30;
      return 220 - age;
    })();

    const buildZone7Set = (
      lt1: number | null,
      lt2: number | null,
      hrmax: number,
      hasPwr: boolean,
      lt1Pwr: number | null,
      lt2Pwr: number | null,
    ) => {
      const effectiveLt1 = lt1 ?? Math.round(hrmax * 0.72);
      const effectiveLt2 = lt2 ?? Math.round(hrmax * 0.87);
      const midLT = Math.round((effectiveLt1 + effectiveLt2) / 2);
      const hr90 = Math.round(hrmax * 0.90);

      const rpe7 = [
        { rpe_min: 6, rpe_max: 9, description: "Very light effort, active recovery" },
        { rpe_min: 9, rpe_max: 11, description: "Light effort, easy aerobic base" },
        { rpe_min: 11, rpe_max: 13, description: "Moderate effort, aerobic endurance" },
        { rpe_min: 13, rpe_max: 15, description: "Moderate-hard, tempo" },
        { rpe_min: 15, rpe_max: 17, description: "Hard effort, lactate threshold" },
        { rpe_min: 17, rpe_max: 19, description: "Very hard, VO2max stimulus" },
        { rpe_min: 19, rpe_max: 20, description: "Maximal, neuromuscular/anaerobic" },
      ];

      const hrZones7 = [
        { zone: 1, name: "Recovery", min_bpm: Math.round(hrmax * 0.50), max_bpm: Math.round(effectiveLt1 * 0.90) },
        { zone: 2, name: "Aerobic Base", min_bpm: Math.round(effectiveLt1 * 0.90) + 1, max_bpm: effectiveLt1 },
        { zone: 3, name: "Aerobic", min_bpm: effectiveLt1 + 1, max_bpm: midLT },
        { zone: 4, name: "Tempo", min_bpm: midLT + 1, max_bpm: effectiveLt2 },
        { zone: 5, name: "Threshold", min_bpm: effectiveLt2 + 1, max_bpm: hr90 },
        { zone: 6, name: "VO2max", min_bpm: hr90 + 1, max_bpm: hrmax },
        { zone: 7, name: "Anaerobic", min_bpm: hrmax + 1, max_bpm: hrmax + 15 },
      ];

      const rpeZones7 = hrZones7.map((z, i) => ({
        zone: z.zone,
        name: z.name,
        description: rpe7[i].description,
        rpe_min: rpe7[i].rpe_min,
        rpe_max: rpe7[i].rpe_max,
      }));

      let pwrZones7 = null;
      if (hasPwr && lt1Pwr != null && lt2Pwr != null) {
        pwrZones7 = [
          { zone: 1, name: "Recovery", min_watts: Math.round(lt1Pwr * 0.55), max_watts: Math.round(lt1Pwr * 0.85) },
          { zone: 2, name: "Aerobic Base", min_watts: Math.round(lt1Pwr * 0.85) + 1, max_watts: Math.round(lt1Pwr * 0.97) },
          { zone: 3, name: "Aerobic", min_watts: Math.round(lt1Pwr * 0.97) + 1, max_watts: Math.round((lt1Pwr + lt2Pwr) / 2 * 0.99) },
          { zone: 4, name: "Tempo", min_watts: Math.round((lt1Pwr + lt2Pwr) / 2 * 0.99) + 1, max_watts: Math.round(lt2Pwr) },
          { zone: 5, name: "Threshold", min_watts: Math.round(lt2Pwr) + 1, max_watts: Math.round(lt2Pwr * 1.08) },
          { zone: 6, name: "VO2max", min_watts: Math.round(lt2Pwr * 1.08) + 1, max_watts: Math.round(lt2Pwr * 1.20) },
          { zone: 7, name: "Anaerobic", min_watts: Math.round(lt2Pwr * 1.20) + 1, max_watts: Math.round(lt2Pwr * 1.50) },
        ];
      }

      return { hrZones7, rpeZones7, pwrZones7 };
    };

    const buildZone5FromZone7 = (z7: typeof _dummyZ7Hr) => [
      { zone: 1, name: "Recovery", min_bpm: z7[0].min_bpm, max_bpm: z7[0].max_bpm },
      { zone: 2, name: "Endurance", min_bpm: z7[1].min_bpm, max_bpm: z7[2].max_bpm },
      { zone: 3, name: "Tempo", min_bpm: z7[3].min_bpm, max_bpm: z7[3].max_bpm },
      { zone: 4, name: "Threshold", min_bpm: z7[4].min_bpm, max_bpm: z7[4].max_bpm },
      { zone: 5, name: "VO2max / Anaerobic", min_bpm: z7[5].min_bpm, max_bpm: z7[6].max_bpm },
    ];

    const hasPwr = !!(physProfile?.lt1_power && physProfile?.lt2_power);
    const lt1Pwr = (physProfile?.lt1_power ?? null) as number | null;
    const lt2Pwr = (physProfile?.lt2_power ?? null) as number | null;

    const { hrZones7, rpeZones7, pwrZones7 } = buildZone7Set(lt1Hr, lt2Hr, computedHRmax, hasPwr, lt1Pwr, lt2Pwr);
    const _dummyZ7Hr = hrZones7;
    const hrZones5 = buildZone5FromZone7(hrZones7);

    const rpe5 = [
      { rpe_min: 6, rpe_max: 9, description: "Very light effort, easy breathing" },
      { rpe_min: 10, rpe_max: 12, description: "Light effort, comfortable pace" },
      { rpe_min: 13, rpe_max: 14, description: "Moderate effort, slightly labored breathing" },
      { rpe_min: 15, rpe_max: 16, description: "Hard effort, difficult to hold conversation" },
      { rpe_min: 17, rpe_max: 20, description: "Very hard to maximal, near full effort" },
    ];
    const rpeZones5 = hrZones5.map((z, i) => ({
      zone: z.zone,
      name: z.name,
      description: rpe5[i].description,
      rpe_min: rpe5[i].rpe_min,
      rpe_max: rpe5[i].rpe_max,
    }));

    let pwrZones5 = null;
    if (pwrZones7) {
      pwrZones5 = [
        { zone: 1, name: "Recovery", min_watts: pwrZones7[0].min_watts, max_watts: pwrZones7[0].max_watts },
        { zone: 2, name: "Endurance", min_watts: pwrZones7[1].min_watts, max_watts: pwrZones7[2].max_watts },
        { zone: 3, name: "Tempo", min_watts: pwrZones7[3].min_watts, max_watts: pwrZones7[3].max_watts },
        { zone: 4, name: "Threshold", min_watts: pwrZones7[4].min_watts, max_watts: pwrZones7[4].max_watts },
        { zone: 5, name: "VO2max / Anaerobic", min_watts: pwrZones7[5].min_watts, max_watts: pwrZones7[6].max_watts },
      ];
    }

    const weightKg = (anthroProfile?.weight_kg ?? athlete.weight_kg) as number | null;
    const heightCm = (anthroProfile?.height_cm ?? athlete.height_cm) as number | null;
    const bodyFatPct = (anthroProfile?.body_fat_percent ?? athlete.body_fat_percent) as number | null;
    const muscleMassKg = (kerrData?.muscle_mass_kg ?? anthroProfile?.muscle_mass_kg ?? null) as number | null;
    const adiposeMassKg = (kerrData?.adipose_mass_kg ?? anthroProfile?.adipose_mass_kg ?? null) as number | null;
    const boneMassKg = (kerrData?.bone_mass_kg ?? anthroProfile?.bone_mass_kg ?? null) as number | null;

    let leanMassKg: number | null = null;
    if (weightKg !== null && adiposeMassKg !== null) {
      leanMassKg = parseFloat((weightKg - adiposeMassKg).toFixed(2));
    } else if (weightKg !== null && bodyFatPct !== null) {
      leanMassKg = parseFloat((weightKg * (1 - bodyFatPct / 100)).toFixed(2));
    } else {
      leanMassKg = (athlete.lean_body_mass_kg as number | null) ?? null;
    }

    const vam = physProfile?.vam_kmh != null
      ? Math.round((physProfile.vam_kmh as number) * 1000 / 60)
      : null;

    const pamWattsPerKg = physProfile?.pam_watts != null && weightKg != null && weightKg > 0
      ? parseFloat(((physProfile.pam_watts as number) / weightKg).toFixed(2))
      : null;

    const fvBodyMass = (fvSession?.body_mass_kg ?? weightKg) as number | null;
    const fvF0 = fvSession?.f0 as number | null;
    const fvV0 = fvSession?.v0 as number | null;
    const fvPmax = fvSession?.pmax as number | null;

    const passport = {
      record_id: physProfile?.id ?? null,
      measurement_date: physProfile?.last_test_date ?? new Date().toISOString().split("T")[0],
      test_protocol: testProtocol,
      notes: (testResults?.coach_notes as string | null) ?? null,

      physiological: {
        vo2max: physProfile?.vo2max_relative_ml_kg_min ?? null,
        lt1_power: physProfile?.lt1_power ?? null,
        lt2_power: physProfile?.lt2_power ?? null,
        lt1_hr: physProfile?.lt1_hr ?? null,
        lt2_hr: physProfile?.lt2_hr ?? null,
        ftp_watts: extractFTP(physProfile?.lt2_power as number | null, physProfile?.pam_watts as number | null, advancedMetrics),
        critical_power: (advancedMetrics.critical_power ?? null) as number | null,
        anaerobic_capacity_kj: (advancedMetrics.anaerobic_capacity_kj ?? advancedMetrics.w_prime_kj ?? null) as number | null,
        running_threshold_pace: (physProfile?.lt2_pace ?? physProfile?.lt1_pace ?? null) as string | null,
        vam: vam,
        pam: pamWattsPerKg,
        training_zones: {
          base_method: "LT1_LT2_physiological",
          zones7: {
            hr: hrZones7,
            power: pwrZones7,
            rpe: rpeZones7,
          },
          zones5: {
            hr: hrZones5,
            power: pwrZones5,
            rpe: rpeZones5,
          },
          default_display: "5",
        },
        power_zones_json: pwrZones5 ?? pwrZones7,
        hr_zones_json: hrZones5,
        rpe_zones_json: rpeZones5,
      },

      anthropometry: {
        height_cm: heightCm,
        weight_kg: weightKg,
        body_fat_percent: bodyFatPct,
        muscle_mass_kg: muscleMassKg,
        lean_mass_kg: leanMassKg,
        bone_mass_kg: boneMassKg,
        skinfold_sum_6: (kerrData?.sum_6_skinfolds ?? null) as number | null,
        muscle_bone_index: (kerrData?.index_muscle_bone ?? null) as number | null,
        z_adipose: (kerrData?.adipose_mass_z_score ?? null) as number | null,
        z_muscle: (kerrData?.muscle_mass_z_score ?? null) as number | null,
        z_bone: (kerrData?.bone_mass_z_score ?? null) as number | null,
      },

      athletic_profile: {
        training_age_years: (advancedMetrics.training_age_years ?? null) as number | null,
        athlete_level: deriveAthleteLevel(physProfile?.vo2max_relative_ml_kg_min as number | null, athlete.sport as string),
      },

      hydration: hydrationSession ? {
        evaluation_date: hydrationSession.session_date,
        sweat_rate_l_h: hydrationSession.sweat_rate_l_h,
        percent_dehydration: hydrationSession.percent_dehydration,
        average_sweat_rate_l_h: hydrationProfile?.average_sweat_rate_l_h ?? null,
        temperature_c: hydrationSession.temperature_c,
        humidity_percent: hydrationSession.humidity_percent,
      } : null,

      heat_adaptation: heatSession ? {
        evaluation_date: heatSession.session_date,
        heat_adaptation_score: heatSession.heat_adaptation_score,
        adaptation_classification: heatProfile?.adaptation_classification ?? null,
        total_sessions: heatProfile?.total_sessions ?? null,
      } : null,

      force_velocity: fvSession ? {
        evaluation_date: fvSession.session_date,
        exercise: fvSession.exercise,
        f0_n: fvF0,
        f0_relative_bw: fvF0 != null && fvBodyMass != null && fvBodyMass > 0
          ? parseFloat((fvF0 / (fvBodyMass * 9.81)).toFixed(3))
          : null,
        pmax_w: fvPmax,
        pmax_w_kg: fvPmax != null && fvBodyMass != null && fvBodyMass > 0
          ? parseFloat((fvPmax / fvBodyMass).toFixed(2))
          : null,
        optimal_velocity_ms: fvV0 != null ? parseFloat((fvV0 / 2).toFixed(2)) : null,
        fv_imbalance_percent: computeFVImbalance(fvF0, fvV0, fvBodyMass),
        fv_imbalance_direction: computeFVDirection(fvF0, fvV0, fvBodyMass),
      } : null,
    };

    const hubParams = new URLSearchParams();
    if (athlete.hub_user_id) hubParams.set("athlete_id", athlete.hub_user_id);
    if (athlete.email) hubParams.set("athlete_email", athlete.email);
    const hubPushUrl = `${hubUrl}/functions/v1/planner-hub-api/push-lab-passport?${hubParams.toString()}`;

    const hubResponse = await fetch(hubPushUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Planner-Token": settings.planner_token,
      },
      body: JSON.stringify(passport),
    });

    const hubResponseText = await hubResponse.text().catch(() => "");
    let hubResponseBody: unknown = {};
    try { hubResponseBody = JSON.parse(hubResponseText); } catch { hubResponseBody = { raw: hubResponseText }; }

    if (!hubResponse.ok) {
      return new Response(
        JSON.stringify({
          error: "Hub rejected the push",
          status: hubResponse.status,
          hub_url_used: hubPushUrl,
          athlete_email_used: athlete.email ?? null,
          hub_response: hubResponseBody,
          passport_sent: passport,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("lab_settings")
      .update({ last_push_at: new Date().toISOString(), last_push_athlete_id: athlete_id })
      .eq("id", settings.id ?? 1);

    return new Response(
      JSON.stringify({
        success: true,
        athlete_id,
        hub_athlete_id: athlete.hub_user_id,
        passport_date: passport.measurement_date,
        modules_sent: {
          physiological: passport.physiological.vo2max !== null || passport.physiological.lt1_hr !== null,
          anthropometry: passport.anthropometry.weight_kg !== null,
          hydration: passport.hydration !== null,
          heat_adaptation: passport.heat_adaptation !== null,
          force_velocity: passport.force_velocity !== null,
        },
        hub_response: hubResponseBody,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractFTP(
  lt2Power: number | null,
  pamWatts: number | null,
  advancedMetrics: Record<string, unknown>
): number | null {
  if (advancedMetrics.ftp_watts != null) return advancedMetrics.ftp_watts as number;
  if (advancedMetrics.ftp != null) return advancedMetrics.ftp as number;
  if (lt2Power != null) return Math.round(lt2Power * 0.95);
  if (pamWatts != null) return Math.round(pamWatts * 0.75);
  return null;
}

function computeFVImbalance(f0: number | null, v0: number | null, bodyMass: number | null): number | null {
  if (f0 == null || v0 == null || bodyMass == null || bodyMass === 0) return null;
  const theoreticalSlope = -(f0 / (bodyMass * 9.81)) / (v0);
  const optimalSlope = -1.0;
  return parseFloat((Math.abs((theoreticalSlope - optimalSlope) / optimalSlope) * 100).toFixed(1));
}

function computeFVDirection(f0: number | null, v0: number | null, bodyMass: number | null): string | null {
  if (f0 == null || v0 == null || bodyMass == null || bodyMass === 0) return null;
  const sfv = f0 / (bodyMass * 9.81 * v0);
  if (sfv > 1.1) return "force_deficit";
  if (sfv < 0.9) return "velocity_deficit";
  return "balanced";
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
