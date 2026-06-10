export type TrendDirection = 'improving' | 'stable' | 'declining';
export type DomainStatus = 'green' | 'yellow' | 'red';

export interface DomainState {
  score: number;
  status: DomainStatus;
  trend: TrendDirection;
  interpretationKey: string;
}

export interface LimitingFactor {
  key: string;
  labelKey: string;
  severity: DomainStatus;
}

export interface EngineHealthFlag {
  id: string;
  labelKey: string;
  status: DomainStatus;
  domain: string;
}

export interface ReadinessResult {
  aerobic: DomainState;
  neuromuscular: DomainState;
  biologicalHealth: DomainState;
  hydrationStress: DomainState;
  globalReadiness: number;
  globalStatus: DomainStatus;
  limitingFactor: LimitingFactor;
  healthFlags: EngineHealthFlag[];
}

// --- Input types from existing labs ---

export interface AerobicInputs {
  vo2max?: number | null;
  lt1_hr?: number | null;
  lt2_hr?: number | null;
  hrmax?: number | null;
  fatmax_hr?: number | null;
}

export interface NeuromuscularInputs {
  f0?: number | null;
  v0?: number | null;
  pmax?: number | null;
  cmj_height_cm?: number | null;
  sprint_5m?: number | null;
  sprint_10m?: number | null;
}

export interface BiologicalInputs {
  ferritin?: number | null;
  hemoglobin?: number | null;
  ck?: number | null;
  cortisol?: number | null;
  vitamin_d?: number | null;
  crp?: number | null;
}

export interface HydrationInputs {
  usg?: number | null;
  body_mass_change_pct?: number | null;
  sweat_rate_l_h?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  hr_drift_pct?: number | null;
}

export interface AnthropometricInputs {
  ffm_kg?: number | null;
  fat_mass_kg?: number | null;
  total_mass_kg?: number | null;
  body_fat_pct?: number | null;
}

export interface EngineInputs {
  aerobic: AerobicInputs;
  neuromuscular: NeuromuscularInputs;
  biological: BiologicalInputs;
  hydration: HydrationInputs;
  anthropometric: AnthropometricInputs;
}

// --- Domain weights ---
const WEIGHTS = {
  aerobic: 0.30,
  neuromuscular: 0.30,
  biologicalHealth: 0.25,
  hydrationStress: 0.15,
};

// --- Utility ---
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function toStatus(score: number): DomainStatus {
  if (score >= 75) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

function computeTrendFromHistory(scores: number[]): TrendDirection {
  if (scores.length < 2) return 'stable';
  const recent = scores.slice(-3);
  let inc = 0;
  let dec = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 3) inc++;
    else if (diff < -3) dec++;
  }
  if (inc > dec) return 'improving';
  if (dec > inc) return 'declining';
  return 'stable';
}

// --- Domain Scorers ---

export function scoreAerobic(inputs: AerobicInputs): number {
  const scores: number[] = [];

  if (inputs.vo2max != null) {
    // VO2max: elite male ~70+, recreational 35-45, female adjust
    // Score: 30=poor, 50=average, 70=good, 90=elite
    const v = inputs.vo2max;
    if (v >= 70) scores.push(95);
    else if (v >= 60) scores.push(85);
    else if (v >= 50) scores.push(75);
    else if (v >= 40) scores.push(60);
    else if (v >= 30) scores.push(45);
    else scores.push(30);
  }

  if (inputs.lt1_hr != null && inputs.hrmax != null && inputs.hrmax > 0) {
    // LT1 as % of HRmax: higher = better aerobic base
    const pct = (inputs.lt1_hr / inputs.hrmax) * 100;
    if (pct >= 80) scores.push(90);
    else if (pct >= 75) scores.push(80);
    else if (pct >= 70) scores.push(70);
    else if (pct >= 65) scores.push(55);
    else scores.push(40);
  }

  if (inputs.lt2_hr != null && inputs.hrmax != null && inputs.hrmax > 0) {
    // LT2 as % of HRmax: higher = better lactate clearance
    const pct = (inputs.lt2_hr / inputs.hrmax) * 100;
    if (pct >= 92) scores.push(95);
    else if (pct >= 88) scores.push(85);
    else if (pct >= 85) scores.push(75);
    else if (pct >= 80) scores.push(60);
    else scores.push(45);
  }

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreNeuromuscular(inputs: NeuromuscularInputs): number {
  const scores: number[] = [];

  if (inputs.pmax != null) {
    // Pmax relative assessment: higher is better
    const p = inputs.pmax;
    if (p >= 25) scores.push(95); // W/kg level
    else if (p >= 20) scores.push(85);
    else if (p >= 15) scores.push(70);
    else if (p >= 10) scores.push(55);
    else scores.push(40);
  }

  if (inputs.f0 != null && inputs.v0 != null) {
    // F-V profile balance (optimal ratio around 1:1 normalized)
    const ratio = inputs.f0 / (inputs.v0 || 1);
    if (ratio >= 0.8 && ratio <= 1.2) scores.push(90);
    else if (ratio >= 0.6 && ratio <= 1.4) scores.push(75);
    else scores.push(55);
  }

  if (inputs.cmj_height_cm != null) {
    const h = inputs.cmj_height_cm;
    if (h >= 45) scores.push(95);
    else if (h >= 38) scores.push(85);
    else if (h >= 32) scores.push(70);
    else if (h >= 25) scores.push(55);
    else scores.push(40);
  }

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreBiologicalHealth(inputs: BiologicalInputs): number {
  const scores: number[] = [];

  if (inputs.ferritin != null) {
    const v = inputs.ferritin;
    if (v >= 50 && v <= 200) scores.push(90);
    else if (v >= 30 && v <= 300) scores.push(70);
    else if (v >= 20) scores.push(50);
    else scores.push(25);
  }

  if (inputs.hemoglobin != null) {
    const v = inputs.hemoglobin;
    if (v >= 14.0 && v <= 17.0) scores.push(90);
    else if (v >= 12.5 && v <= 18.0) scores.push(70);
    else if (v >= 11.0) scores.push(45);
    else scores.push(20);
  }

  if (inputs.ck != null) {
    const v = inputs.ck;
    if (v <= 200) scores.push(90);
    else if (v <= 400) scores.push(70);
    else if (v <= 800) scores.push(50);
    else scores.push(25);
  }

  if (inputs.cortisol != null) {
    const v = inputs.cortisol;
    if (v >= 8 && v <= 20) scores.push(90);
    else if (v >= 5 && v <= 25) scores.push(70);
    else scores.push(40);
  }

  if (inputs.vitamin_d != null) {
    const v = inputs.vitamin_d;
    if (v >= 40 && v <= 70) scores.push(90);
    else if (v >= 30 && v <= 80) scores.push(70);
    else if (v >= 20) scores.push(50);
    else scores.push(25);
  }

  if (inputs.crp != null) {
    const v = inputs.crp;
    if (v <= 1.0) scores.push(90);
    else if (v <= 3.0) scores.push(65);
    else if (v <= 5.0) scores.push(40);
    else scores.push(20);
  }

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function scoreHydrationStress(inputs: HydrationInputs): number {
  const scores: number[] = [];

  if (inputs.usg != null) {
    const v = inputs.usg;
    if (v <= 1.010) scores.push(95);
    else if (v <= 1.020) scores.push(80);
    else if (v <= 1.025) scores.push(60);
    else if (v <= 1.030) scores.push(40);
    else scores.push(20);
  }

  if (inputs.body_mass_change_pct != null) {
    const loss = Math.abs(inputs.body_mass_change_pct);
    if (loss <= 1.0) scores.push(90);
    else if (loss <= 2.0) scores.push(70);
    else if (loss <= 3.0) scores.push(50);
    else scores.push(25);
  }

  if (inputs.sweat_rate_l_h != null && inputs.temperature != null) {
    // Higher sweat rate in heat is expected; penalize only if dehydration context
    const sr = inputs.sweat_rate_l_h;
    const temp = inputs.temperature;
    if (temp > 30 && sr > 2.0) scores.push(55);
    else if (temp > 30 && sr > 1.5) scores.push(65);
    else if (sr <= 1.5) scores.push(85);
    else scores.push(75);
  }

  if (inputs.hr_drift_pct != null) {
    const d = inputs.hr_drift_pct;
    if (d <= 3) scores.push(90);
    else if (d <= 5) scores.push(75);
    else if (d <= 8) scores.push(55);
    else scores.push(35);
  }

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// --- Limiting Factor Detection ---

const LIMITING_FACTORS: { condition: (r: ReadinessResult) => boolean; key: string; labelKey: string }[] = [
  {
    condition: r => r.biologicalHealth.score < 50 && r.aerobic.score < 60,
    key: 'iron_transport',
    labelKey: 'engine.limit.ironTransport',
  },
  {
    condition: r => r.biologicalHealth.score < 50 && r.biologicalHealth.trend === 'declining',
    key: 'hormonal_stress',
    labelKey: 'engine.limit.hormonalStress',
  },
  {
    condition: r => r.neuromuscular.score < 50 && r.neuromuscular.trend === 'declining',
    key: 'neuromuscular_fatigue',
    labelKey: 'engine.limit.neuromuscularFatigue',
  },
  {
    condition: r => r.hydrationStress.score < 50,
    key: 'hydration_heat',
    labelKey: 'engine.limit.hydrationHeat',
  },
  {
    condition: r => r.aerobic.score < 50 && r.aerobic.trend === 'declining',
    key: 'aerobic_limitation',
    labelKey: 'engine.limit.aerobicLimitation',
  },
];

function detectLimitingFactor(result: ReadinessResult): LimitingFactor {
  for (const lf of LIMITING_FACTORS) {
    if (lf.condition(result)) {
      return { key: lf.key, labelKey: lf.labelKey, severity: 'red' };
    }
  }

  // Fallback: lowest scoring domain
  const domains = [
    { key: 'aerobic', score: result.aerobic.score, labelKey: 'engine.limit.aerobicLimitation' },
    { key: 'neuromuscular', score: result.neuromuscular.score, labelKey: 'engine.limit.neuromuscularFatigue' },
    { key: 'biological', score: result.biologicalHealth.score, labelKey: 'engine.limit.hormonalStress' },
    { key: 'hydration', score: result.hydrationStress.score, labelKey: 'engine.limit.hydrationHeat' },
  ];

  const lowest = domains.sort((a, b) => a.score - b.score)[0];
  if (lowest.score < 75) {
    return { key: lowest.key, labelKey: lowest.labelKey, severity: toStatus(lowest.score) };
  }

  return { key: 'none', labelKey: 'engine.limit.none', severity: 'green' };
}

// --- Health Flag Generation ---

function generateEngineFlags(result: ReadinessResult): EngineHealthFlag[] {
  const flags: EngineHealthFlag[] = [];

  const addFlag = (domain: string, score: number, trend: TrendDirection, labelKey: string) => {
    if (score < 50) {
      flags.push({ id: `${domain}-critical`, labelKey, status: 'red', domain });
    } else if (score < 75 || trend === 'declining') {
      flags.push({ id: `${domain}-warning`, labelKey, status: 'yellow', domain });
    }
  };

  addFlag('aerobic', result.aerobic.score, result.aerobic.trend, 'engine.flag.aerobicDecline');
  addFlag('neuromuscular', result.neuromuscular.score, result.neuromuscular.trend, 'engine.flag.neuromuscularFatigue');
  addFlag('biological', result.biologicalHealth.score, result.biologicalHealth.trend, 'engine.flag.biologicalStress');
  addFlag('hydration', result.hydrationStress.score, result.hydrationStress.trend, 'engine.flag.hydrationImbalance');

  // Cross-domain: multiple declining
  const decliningCount = [result.aerobic, result.neuromuscular, result.biologicalHealth, result.hydrationStress]
    .filter(d => d.trend === 'declining').length;
  if (decliningCount >= 2) {
    flags.push({ id: 'systemic-fatigue', labelKey: 'engine.flag.systemicFatigue', status: 'red', domain: 'global' });
  }

  return flags.sort((a, b) => {
    const order: Record<DomainStatus, number> = { red: 0, yellow: 1, green: 2 };
    return order[a.status] - order[b.status];
  });
}

// --- Main Engine ---

export function computeReadiness(
  inputs: EngineInputs,
  history?: { aerobic: number[]; neuromuscular: number[]; biological: number[]; hydration: number[] }
): ReadinessResult {
  const aerobicScore = scoreAerobic(inputs.aerobic);
  const neuromuscularScore = scoreNeuromuscular(inputs.neuromuscular);
  const biologicalScore = scoreBiologicalHealth(inputs.biological);
  const hydrationScore = scoreHydrationStress(inputs.hydration);

  const aerobicTrend = computeTrendFromHistory(history?.aerobic || []);
  const neuroTrend = computeTrendFromHistory(history?.neuromuscular || []);
  const bioTrend = computeTrendFromHistory(history?.biological || []);
  const hydTrend = computeTrendFromHistory(history?.hydration || []);

  const aerobic: DomainState = {
    score: aerobicScore,
    status: toStatus(aerobicScore),
    trend: aerobicTrend,
    interpretationKey: aerobicScore >= 75 ? 'engine.interp.aerobic.good' : aerobicScore >= 50 ? 'engine.interp.aerobic.moderate' : 'engine.interp.aerobic.low',
  };
  const neuromuscular: DomainState = {
    score: neuromuscularScore,
    status: toStatus(neuromuscularScore),
    trend: neuroTrend,
    interpretationKey: neuromuscularScore >= 75 ? 'engine.interp.neuro.good' : neuromuscularScore >= 50 ? 'engine.interp.neuro.moderate' : 'engine.interp.neuro.low',
  };
  const biologicalHealth: DomainState = {
    score: biologicalScore,
    status: toStatus(biologicalScore),
    trend: bioTrend,
    interpretationKey: biologicalScore >= 75 ? 'engine.interp.bio.good' : biologicalScore >= 50 ? 'engine.interp.bio.moderate' : 'engine.interp.bio.low',
  };
  const hydrationStress: DomainState = {
    score: hydrationScore,
    status: toStatus(hydrationScore),
    trend: hydTrend,
    interpretationKey: hydrationScore >= 75 ? 'engine.interp.hydration.good' : hydrationScore >= 50 ? 'engine.interp.hydration.moderate' : 'engine.interp.hydration.low',
  };

  // Global weighted score (only include domains with data)
  const activeDomains: { score: number; weight: number }[] = [];
  if (aerobicScore > 0) activeDomains.push({ score: aerobicScore, weight: WEIGHTS.aerobic });
  if (neuromuscularScore > 0) activeDomains.push({ score: neuromuscularScore, weight: WEIGHTS.neuromuscular });
  if (biologicalScore > 0) activeDomains.push({ score: biologicalScore, weight: WEIGHTS.biologicalHealth });
  if (hydrationScore > 0) activeDomains.push({ score: hydrationScore, weight: WEIGHTS.hydrationStress });

  let globalReadiness = 0;
  if (activeDomains.length > 0) {
    const totalWeight = activeDomains.reduce((s, d) => s + d.weight, 0);
    globalReadiness = Math.round(
      activeDomains.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
    );
  }
  globalReadiness = clamp(globalReadiness, 0, 100);

  const result: ReadinessResult = {
    aerobic,
    neuromuscular,
    biologicalHealth,
    hydrationStress,
    globalReadiness,
    globalStatus: toStatus(globalReadiness),
    limitingFactor: { key: 'none', labelKey: 'engine.limit.none', severity: 'green' },
    healthFlags: [],
  };

  result.limitingFactor = detectLimitingFactor(result);
  result.healthFlags = generateEngineFlags(result);

  return result;
}
