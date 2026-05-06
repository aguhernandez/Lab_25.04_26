import { tGlobal } from '../contexts/LanguageContext';

export interface AthletePhysioProfile {
  vo2max: number;
  lt1_hr?: number | null;
  lt2_hr?: number | null;
  lt1_pace?: string | null;
  lt2_pace?: string | null;
  lt1_power?: number | null;
  lt2_power?: number | null;
  weight_kg?: number;
  hr_max?: number;
  running_economy?: number;
  lt1_vo2?: number | null;
  lt2_vo2?: number | null;
  fatmax_hr?: number | null;
}

export interface RaceScenario {
  distance_km: number;
  name: string;
  targetPace_min_km: number;
  terrain: 'flat' | 'rolling' | 'hilly';
  temperature_c: number;
  humidity_percent: number;
  altitude_m: number;
  strategy: 'even' | 'positive' | 'negative';
}

export interface RaceSimResult {
  predictedTime_min: number;
  avgHR: number;
  avgVO2: number;
  percentVO2max: number;
  energyCost_kcal: number;
  carbsUsed_g: number;
  fatsUsed_g: number;
  dehydration_percent: number;
  glycogenDepletionKm: number | null;
  bonkRisk: boolean;
  runningEconomy: number;
  zones: ZoneSplit[];
  paceVsFatigue: PaceFatiguePoint[];
  lactateAccumulation: LactatePoint[];
  riskFlags: RiskFlag[];
  feasibility: 'optimal' | 'challenging' | 'limit' | 'impossible';
  recommendations: string[];
  strategyProfile: StrategyPoint[];
}

export interface ZoneSplit {
  zone: string;
  percent_time: number;
  color: string;
}

export interface PaceFatiguePoint {
  km: number;
  pace_min_km: number;
  hr: number;
  fatigue: number;
  glycogen_g?: number;
}

export interface LactatePoint {
  km: number;
  lactate_mmol: number;
}

export interface StrategyPoint {
  km: number;
  pace_min_km: number;
  percentVO2max: number;
  label?: string;
}

export interface RiskFlag {
  severity: 'info' | 'warning' | 'danger';
  message: string;
}

export interface AltitudeScenario {
  altitude_m: number;
  exposure_days: number;
  training_load: 'rest' | 'light' | 'moderate' | 'hard';
}

export interface AltitudeSimResult {
  vo2max_reduction_percent: number;
  adjusted_vo2max: number;
  po2_alveolar_mmhg: number;
  spo2_percent: number;
  hr_increase_bpm: number;
  ventilation_increase_percent: number;
  performance_reduction_percent: number;
  acclimatization_timeline: AcclimatizationPoint[];
  altitudeZones: AltitudeZone[];
  riskFlags: RiskFlag[];
  training_recommendations: TrainingRec[];
}

export interface AcclimatizationPoint {
  day: number;
  vo2max_recovery_percent: number;
  rbc_increase_percent: number;
  performance_recovery_percent: number;
}

export interface AltitudeZone {
  range: string;
  label: string;
  vo2max_loss: string;
  effects: string;
  color: string;
}

export interface TrainingRec {
  category: string;
  text: string;
}

export interface InverseSimResult {
  required_vo2max: number;
  current_gap: number;
  trainingWeeks: TrainingWeekProjection[];
  paceAtCurrentVO2max: string;
  feasibilityComment: string;
}

export interface TrainingWeekProjection {
  weeks: number;
  vo2max: number;
  predictedTime_min: number;
}

function estimateRunningEconomy(profile: AthletePhysioProfile): number {
  if (profile.running_economy) return profile.running_economy;
  const vo2 = profile.vo2max;
  if (vo2 > 70) return 195;
  if (vo2 > 60) return 200;
  if (vo2 > 50) return 210;
  if (vo2 > 40) return 220;
  return 230;
}


export function simulateRace(profile: AthletePhysioProfile, scenario: RaceScenario): RaceSimResult {
  const { vo2max, weight_kg = 70 } = profile;

  const altitudeFactor = scenario.altitude_m > 1500
    ? 1 - ((scenario.altitude_m - 1500) / 1000) * 0.032
    : 1;
  const effectiveVO2max = vo2max * altitudeFactor;

  const tempPenalty = scenario.temperature_c > 20
    ? (scenario.temperature_c - 20) * 0.002
    : 0;
  const humidityPenalty = scenario.humidity_percent > 60
    ? (scenario.humidity_percent - 60) / 100 * 0.01
    : 0;
  const terrainFactor = scenario.terrain === 'flat' ? 1.0 : scenario.terrain === 'rolling' ? 1.06 : 1.13;

  const pace_min_km = scenario.targetPace_min_km * terrainFactor * (1 + tempPenalty + humidityPenalty);
  const speed_m_s = 1000 / (pace_min_km * 60);

  const runningEconomy = estimateRunningEconomy(profile);
  const vo2_ml_kg_min = (speed_m_s * runningEconomy) / 1000 * 60;
  const percentVO2max = (vo2_ml_kg_min / effectiveVO2max) * 100;

  const predictedTime_min = pace_min_km * scenario.distance_km;

  const estimatedHRmax = profile.hr_max ?? (profile.lt2_hr
    ? Math.round(profile.lt2_hr / 0.92)
    : 185);
  const avgHR = Math.round(
    (percentVO2max / 100) * 0.85 * estimatedHRmax + estimatedHRmax * 0.15
  );

  const energyCost_kcal = weight_kg * scenario.distance_km * 1.05;
  const fatPercent = percentVO2max < 65 ? 0.5 : percentVO2max < 80 ? 0.35 : 0.15;
  const carbsUsed_g = (energyCost_kcal * (1 - fatPercent)) / 4;
  const fatsUsed_g = (energyCost_kcal * fatPercent) / 9;

  const glycogenStores_g = weight_kg * 0.5 * 0.015 * 1000 + 100;
  const carbsPerKm = carbsUsed_g / scenario.distance_km;
  const glycogenDepletionKm = carbsUsed_g > glycogenStores_g
    ? parseFloat((glycogenStores_g / carbsPerKm).toFixed(1))
    : null;
  const bonkRisk = glycogenDepletionKm !== null && glycogenDepletionKm < scenario.distance_km;

  const sweatRate_L_h = 0.8 + (scenario.temperature_c - 20) * 0.03 + (scenario.humidity_percent - 50) * 0.005;
  const totalFluidLoss_L = Math.max(0, sweatRate_L_h * (predictedTime_min / 60));
  const dehydration_percent = (totalFluidLoss_L / (weight_kg * 0.6)) * 100;

  const zones = buildZoneSplits(percentVO2max);
  const strategyProfile = buildStrategyProfile(scenario, pace_min_km, percentVO2max, effectiveVO2max, runningEconomy);
  const paceVsFatigue = buildPaceFatigue(scenario, pace_min_km, avgHR, percentVO2max, dehydration_percent, bonkRisk, glycogenDepletionKm, glycogenStores_g, carbsPerKm);
  const lactateAccumulation = buildLactateAccumulation(scenario.distance_km, percentVO2max, profile);

  const riskFlags: RiskFlag[] = [];
  if (percentVO2max > 95) riskFlags.push({ severity: 'danger', message: tGlobal('sim.risk.vo2maxCritical') });
  else if (percentVO2max > 88) riskFlags.push({ severity: 'warning', message: tGlobal('sim.risk.vo2maxHigh') });
  if (dehydration_percent > 3) riskFlags.push({ severity: 'warning', message: tGlobal('sim.risk.dehydrationWarning').replace('__PERCENT__', dehydration_percent.toFixed(1)) });
  if (dehydration_percent > 5) riskFlags.push({ severity: 'danger', message: tGlobal('sim.risk.dehydrationDanger') });
  if (carbsUsed_g > 300 && scenario.distance_km >= 21) riskFlags.push({ severity: 'info', message: tGlobal('sim.risk.carbsHigh').replace('__CARBS__', carbsUsed_g.toFixed(0)) });
  if (scenario.altitude_m > 2500) riskFlags.push({ severity: 'warning', message: tGlobal('sim.risk.altitudeVO2').replace('__ALT__', String(scenario.altitude_m)).replace('__PCT__', ((1 - altitudeFactor) * 100).toFixed(0)) });
  if (scenario.temperature_c > 30) riskFlags.push({ severity: 'danger', message: tGlobal('sim.risk.extremeTemp') });
  if (bonkRisk && glycogenDepletionKm !== null) riskFlags.push({ severity: 'danger', message: tGlobal('sim.risk.bonk').replace('__KM__', glycogenDepletionKm.toFixed(1)) });
  if (scenario.strategy === 'positive') riskFlags.push({ severity: 'warning', message: tGlobal('sim.risk.positiveStrategy') });

  let feasibility: RaceSimResult['feasibility'] = 'optimal';
  if (percentVO2max > 100) feasibility = 'impossible';
  else if (percentVO2max > 92) feasibility = 'limit';
  else if (percentVO2max > 82) feasibility = 'challenging';

  const recommendations: string[] = [];
  if (percentVO2max > 85) recommendations.push(tGlobal('sim.rec.reducePace'));
  if (dehydration_percent > 2) recommendations.push(tGlobal('sim.rec.drink').replace('__ML__', String(Math.round(sweatRate_L_h * 250))));
  if (carbsUsed_g > 240) recommendations.push(tGlobal('sim.rec.carbIntake').replace('__RATE__', String(Math.round(carbsUsed_g / predictedTime_min * 60))));
  if (scenario.altitude_m > 1500) recommendations.push(tGlobal('sim.rec.acclimatize'));
  if (scenario.temperature_c > 25) recommendations.push(tGlobal('sim.rec.precooling'));
  if (bonkRisk && glycogenDepletionKm !== null) recommendations.push(tGlobal('sim.rec.gels').replace('__KM__', glycogenDepletionKm.toFixed(1)));
  if (runningEconomy > 215) recommendations.push(tGlobal('sim.rec.runningEconomy').replace('__RE__', String(runningEconomy)));
  if (scenario.strategy === 'negative') recommendations.push(tGlobal('sim.rec.negativeStrategy'));
  if (recommendations.length === 0) recommendations.push(tGlobal('sim.rec.allGood'));

  return {
    predictedTime_min,
    avgHR,
    avgVO2: vo2_ml_kg_min,
    percentVO2max,
    energyCost_kcal,
    carbsUsed_g,
    fatsUsed_g,
    dehydration_percent,
    glycogenDepletionKm,
    bonkRisk,
    runningEconomy,
    zones,
    paceVsFatigue,
    lactateAccumulation,
    riskFlags,
    feasibility,
    recommendations,
    strategyProfile,
  };
}

function buildStrategyProfile(
  scenario: RaceScenario,
  basePace: number,
  _percentVO2max: number,
  effectiveVO2max: number,
  re: number
): StrategyPoint[] {
  const points: StrategyPoint[] = [];
  const steps = Math.min(Math.ceil(scenario.distance_km), 20);
  const stepKm = scenario.distance_km / steps;

  for (let i = 0; i <= steps; i++) {
    const km = i * stepKm;
    const frac = km / scenario.distance_km;
    let pace = basePace;

    if (scenario.strategy === 'even') {
      pace = basePace;
    } else if (scenario.strategy === 'positive') {
      pace = basePace * (1 - 0.06 * (1 - frac));
    } else {
      pace = basePace * (1 + 0.04 * (1 - frac));
    }

    const spd = 1000 / (pace * 60);
    const vo2 = (spd * re) / 1000 * 60;
    const pct = (vo2 / effectiveVO2max) * 100;

    points.push({
      km: parseFloat(km.toFixed(2)),
      pace_min_km: parseFloat(pace.toFixed(2)),
      percentVO2max: parseFloat(pct.toFixed(1)),
      label: i === 0 ? tGlobal('sim.start') : i === steps ? tGlobal('sim.finish') : undefined,
    });
  }
  return points;
}

function buildZoneSplits(percentVO2max: number): ZoneSplit[] {
  if (percentVO2max < 65) {
    return [
      { zone: tGlobal('sim.zone.z1z2'), percent_time: 80, color: '#22c55e' },
      { zone: tGlobal('sim.zone.z3'), percent_time: 15, color: '#84cc16' },
      { zone: tGlobal('sim.zone.z4plus'), percent_time: 5, color: '#f59e0b' },
    ];
  } else if (percentVO2max < 78) {
    return [
      { zone: tGlobal('sim.zone.z2'), percent_time: 30, color: '#22c55e' },
      { zone: tGlobal('sim.zone.z3'), percent_time: 45, color: '#84cc16' },
      { zone: tGlobal('sim.zone.z4'), percent_time: 20, color: '#f59e0b' },
      { zone: tGlobal('sim.zone.z5'), percent_time: 5, color: '#ef4444' },
    ];
  } else if (percentVO2max < 90) {
    return [
      { zone: tGlobal('sim.zone.z2'), percent_time: 10, color: '#22c55e' },
      { zone: tGlobal('sim.zone.z3z4'), percent_time: 35, color: '#f59e0b' },
      { zone: tGlobal('sim.zone.z5'), percent_time: 40, color: '#ef4444' },
      { zone: tGlobal('sim.zone.z6'), percent_time: 15, color: '#dc2626' },
    ];
  }
  return [
    { zone: tGlobal('sim.zone.z5'), percent_time: 40, color: '#ef4444' },
    { zone: tGlobal('sim.zone.z6'), percent_time: 40, color: '#dc2626' },
    { zone: tGlobal('sim.zone.z7'), percent_time: 20, color: '#991b1b' },
  ];
}

function buildPaceFatigue(
  scenario: RaceScenario,
  pace_min_km: number,
  avgHR: number,
  percentVO2max: number,
  dehydration: number,
  bonkRisk: boolean,
  glycogenDepletionKm: number | null,
  glycogenStores_g: number,
  carbsPerKm: number
): PaceFatiguePoint[] {
  const points: PaceFatiguePoint[] = [];
  const steps = Math.min(Math.ceil(scenario.distance_km), 20);
  const stepKm = scenario.distance_km / steps;

  for (let i = 0; i <= steps; i++) {
    const km = i * stepKm;
    const fractionDone = km / scenario.distance_km;
    const fatigueRate = percentVO2max > 88 ? 0.18 : percentVO2max > 78 ? 0.10 : 0.05;
    const fatigue = Math.min(100, fractionDone * fatigueRate * 100 + dehydration * fractionDone * 3);

    let bonkPenalty = 0;
    if (bonkRisk && glycogenDepletionKm !== null && km > glycogenDepletionKm) {
      const postBonkFrac = (km - glycogenDepletionKm) / (scenario.distance_km - glycogenDepletionKm);
      bonkPenalty = postBonkFrac * 0.15;
    }

    let strategyOffset = 0;
    if (scenario.strategy === 'positive') {
      strategyOffset = -0.04 * (1 - fractionDone);
    } else if (scenario.strategy === 'negative') {
      strategyOffset = 0.03 * (1 - fractionDone);
    }

    const paceDrift = pace_min_km * (1 + fatigue / 400 + bonkPenalty + strategyOffset);
    const hrDrift = Math.round(avgHR * (1 + fatigue / 300));
    const glycogen_g = Math.max(0, glycogenStores_g - carbsPerKm * km);

    points.push({
      km: parseFloat(km.toFixed(2)),
      pace_min_km: parseFloat(paceDrift.toFixed(2)),
      hr: hrDrift,
      fatigue: parseFloat(fatigue.toFixed(1)),
      glycogen_g: parseFloat(glycogen_g.toFixed(0)),
    });
  }
  return points;
}

function buildLactateAccumulation(
  distance_km: number,
  percentVO2max: number,
  _profile: AthletePhysioProfile
): LactatePoint[] {
  const points: LactatePoint[] = [];
  const steps = Math.min(Math.ceil(distance_km), 20);
  const stepKm = distance_km / steps;

  const baseLactate = 1.0;
  const threshold = percentVO2max > 88 ? 0.65 : percentVO2max > 78 ? 0.80 : 1.0;

  for (let i = 0; i <= steps; i++) {
    const km = i * stepKm;
    const fractionDone = km / distance_km;
    let lactate: number;

    if (percentVO2max < 75) {
      lactate = baseLactate + fractionDone * 0.5;
    } else if (percentVO2max < 85) {
      lactate = baseLactate + fractionDone * 2.0 * (1 / threshold);
    } else {
      const accumRate = percentVO2max > 95 ? 6 : 4;
      lactate = baseLactate + Math.pow(fractionDone, 1.5) * accumRate;
    }

    points.push({
      km: parseFloat(km.toFixed(2)),
      lactate_mmol: parseFloat(Math.min(lactate, 18).toFixed(2)),
    });
  }
  return points;
}

export function simulateAltitude(profile: AthletePhysioProfile, scenario: AltitudeScenario): AltitudeSimResult {
  const { vo2max } = profile;
  const alt = scenario.altitude_m;

  const po2_sea = 159;
  const baroFactor = Math.exp(-alt / 7400);
  const po2_alv = Math.round((po2_sea * baroFactor - 6) * 0.7);
  const spo2 = alt < 1500 ? 98 : alt < 2500 ? 95 : alt < 3500 ? 91 : alt < 5000 ? 85 : 78;

  const vo2max_reduction = alt < 1500 ? 0 : ((alt - 1500) / 100) * 0.32;
  const adjusted_vo2max = parseFloat((vo2max * (1 - vo2max_reduction / 100)).toFixed(1));
  const hr_increase = Math.round(alt / 1000 * 3.5);
  const vent_increase = Math.round(alt / 1000 * 12);
  const perf_reduction = parseFloat((vo2max_reduction * 0.9).toFixed(1));

  const acclimatization_timeline = buildAcclimatizationTimeline(scenario, vo2max_reduction);

  const altitudeZones: AltitudeZone[] = [
    { range: '0 – 1500m', label: tGlobal('sim.altitude.seaLevel'), vo2max_loss: '0%', effects: tGlobal('sim.altitude.seaLevelEffects'), color: '#22c55e' },
    { range: '1500 – 2500m', label: tGlobal('sim.altitude.low'), vo2max_loss: '1-7%', effects: tGlobal('sim.altitude.lowEffects'), color: '#84cc16' },
    { range: '2500 – 3500m', label: tGlobal('sim.altitude.medium'), vo2max_loss: '7-14%', effects: tGlobal('sim.altitude.mediumEffects'), color: '#f59e0b' },
    { range: '3500 – 5000m', label: tGlobal('sim.altitude.high'), vo2max_loss: '14-30%', effects: tGlobal('sim.altitude.highEffects'), color: '#f97316' },
    { range: '5000m+', label: tGlobal('sim.altitude.deathZone'), vo2max_loss: '>30%', effects: tGlobal('sim.altitude.deathZoneEffects'), color: '#ef4444' },
  ];

  const riskFlags: RiskFlag[] = [];
  if (alt > 2500) riskFlags.push({ severity: 'warning', message: tGlobal('sim.altitude.risk.moderate') });
  if (alt > 3500) riskFlags.push({ severity: 'danger', message: tGlobal('sim.altitude.risk.ams') });
  if (alt > 4000 && scenario.training_load === 'hard') riskFlags.push({ severity: 'danger', message: tGlobal('sim.altitude.risk.hardTraining') });
  if (spo2 < 90) riskFlags.push({ severity: 'danger', message: tGlobal('sim.altitude.risk.spo2').replace('__SPO2__', String(spo2)) });
  if (scenario.exposure_days < 3 && alt > 2500) riskFlags.push({ severity: 'info', message: tGlobal('sim.altitude.risk.shortExposure') });
  if (scenario.exposure_days >= 21 && alt >= 2200 && alt <= 3000) riskFlags.push({ severity: 'info', message: tGlobal('sim.altitude.risk.lhtl') });

  const training_recommendations = buildAltitudeRecommendations(alt, scenario, spo2);

  return {
    vo2max_reduction_percent: parseFloat(vo2max_reduction.toFixed(1)),
    adjusted_vo2max,
    po2_alveolar_mmhg: po2_alv,
    spo2_percent: spo2,
    hr_increase_bpm: hr_increase,
    ventilation_increase_percent: vent_increase,
    performance_reduction_percent: perf_reduction,
    acclimatization_timeline,
    altitudeZones,
    riskFlags,
    training_recommendations,
  };
}

function buildAcclimatizationTimeline(scenario: AltitudeScenario, _vo2max_reduction: number): AcclimatizationPoint[] {
  const days = Math.min(scenario.exposure_days, 28);
  const points: AcclimatizationPoint[] = [];

  for (let day = 0; day <= days; day++) {
    const adaptFraction = 1 - Math.exp(-day / 8);
    const vo2_recovery = Math.min(adaptFraction * 70, 70);
    const rbc_increase = Math.min(day / 21 * 8, 8);
    const perf_recovery = Math.min(adaptFraction * 65, 65);

    points.push({
      day,
      vo2max_recovery_percent: parseFloat(vo2_recovery.toFixed(1)),
      rbc_increase_percent: parseFloat(rbc_increase.toFixed(1)),
      performance_recovery_percent: parseFloat(perf_recovery.toFixed(1)),
    });
  }
  return points;
}

function buildAltitudeRecommendations(alt: number, scenario: AltitudeScenario, spo2: number): TrainingRec[] {
  const recs: TrainingRec[] = [];

  if (alt >= 2000 && alt <= 3000) {
    recs.push({ category: tGlobal('sim.altitude.rec.optimalProtocol'), text: tGlobal('sim.altitude.rec.lhtl') });
  }
  if (alt > 1500) {
    recs.push({ category: tGlobal('sim.altitude.rec.hydrationCat'), text: tGlobal('sim.altitude.rec.hydration') });
    recs.push({ category: tGlobal('sim.altitude.rec.trainingLoad'), text: tGlobal('sim.altitude.rec.load').replace('__PCT__', alt > 3000 ? '40-50' : '15-25').replace('__SECS__', String(Math.round(alt / 100 * 2))) });
    recs.push({ category: tGlobal('sim.altitude.rec.ironCat'), text: tGlobal('sim.altitude.rec.iron') });
  }
  if (scenario.exposure_days >= 14) {
    recs.push({ category: tGlobal('sim.altitude.rec.recoveryCat'), text: tGlobal('sim.altitude.rec.recovery') });
  }
  if (spo2 < 90) {
    recs.push({ category: tGlobal('sim.altitude.rec.medicalCat'), text: tGlobal('sim.altitude.rec.medicalMonitoring') });
  }
  recs.push({ category: tGlobal('sim.altitude.rec.nutritionCat'), text: tGlobal('sim.altitude.rec.nutrition') });

  return recs;
}

export function simulateInverse(
  targetTime_min: number,
  scenario: Omit<RaceScenario, 'targetPace_min_km'>,
  currentVO2max: number,
  _weight_kg = 70
): InverseSimResult {
  const targetPace = targetTime_min / scenario.distance_km;

  const altitudeFactor = scenario.altitude_m > 1500
    ? 1 - ((scenario.altitude_m - 1500) / 1000) * 0.032
    : 1;
  const terrainFactor = scenario.terrain === 'flat' ? 1.0 : scenario.terrain === 'rolling' ? 1.06 : 1.13;
  const tempPenalty = scenario.temperature_c > 20 ? (scenario.temperature_c - 20) * 0.002 : 0;
  const humidityPenalty = scenario.humidity_percent > 60 ? (scenario.humidity_percent - 60) / 100 * 0.01 : 0;
  const effectivePace = targetPace * terrainFactor * (1 + tempPenalty + humidityPenalty);
  const speed_m_s = 1000 / (effectivePace * 60);

  const re = currentVO2max > 60 ? 200 : currentVO2max > 50 ? 210 : 220;
  const vo2_needed = (speed_m_s * re) / 1000 * 60;
  const required_vo2max = parseFloat((vo2_needed / altitudeFactor).toFixed(1));
  const current_gap = parseFloat((required_vo2max - currentVO2max).toFixed(1));

  const paceAtCurrentVO2max_raw = (currentVO2max * altitudeFactor * 0.85) / (re / 1000) / 60;
  const paceAtCurrentVO2max_min_km = 1 / paceAtCurrentVO2max_raw;

  const trainingWeeks: TrainingWeekProjection[] = [4, 8, 12, 16, 20, 24].map(weeks => {
    const vo2Gain = weeks * 0.25;
    const projected_vo2max = currentVO2max + vo2Gain;
    const proj_speed = (projected_vo2max * altitudeFactor * 0.85) / (re / 1000) / 60;
    const proj_pace = 1 / proj_speed;
    const proj_time = proj_pace * scenario.distance_km;
    return { weeks, vo2max: parseFloat(projected_vo2max.toFixed(1)), predictedTime_min: parseFloat(proj_time.toFixed(1)) };
  });

  let feasibilityComment = '';
  if (current_gap <= 0) {
    feasibilityComment = tGlobal('sim.inverse.gap0');
  } else if (current_gap < 3) {
    feasibilityComment = tGlobal('sim.inverse.gapSmall');
  } else if (current_gap < 8) {
    feasibilityComment = tGlobal('sim.inverse.gapModerate');
  } else {
    feasibilityComment = tGlobal('sim.inverse.gapLarge');
  }

  return {
    required_vo2max,
    current_gap,
    trainingWeeks,
    paceAtCurrentVO2max: formatPace(paceAtCurrentVO2max_min_km),
    feasibilityComment,
  };
}

export function formatPace(pace_min_km: number): string {
  const mins = Math.floor(pace_min_km);
  const secs = Math.round((pace_min_km - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
