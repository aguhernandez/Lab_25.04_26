export type FlagStatus = 'green' | 'yellow' | 'red';
export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface MarkerReference {
  key: string;
  labelKey: string;
  unit: string;
  min: number;
  max: number;
  optimalMin: number;
  optimalMax: number;
}

export interface DomainConfig {
  key: string;
  labelKey: string;
  weight: number;
  markers: MarkerReference[];
}

export interface MarkerResult {
  key: string;
  value: number;
  score: number;
  status: FlagStatus;
  interpretationKey: string;
}

export interface DomainResult {
  key: string;
  score: number;
  status: FlagStatus;
  markers: MarkerResult[];
}

export interface HealthFlag {
  id: string;
  domain: string;
  domainLabelKey: string;
  marker: string;
  markerLabelKey: string;
  status: FlagStatus;
  messageKey: string;
  value: number;
  unit: string;
}

export interface BiochemicalResult {
  domains: DomainResult[];
  globalScore: number;
  globalStatus: FlagStatus;
  healthFlags: HealthFlag[];
}

export interface TrendPoint {
  date: string;
  score: number;
  status: FlagStatus;
}

export interface DomainTrend {
  domain: string;
  direction: TrendDirection;
  points: TrendPoint[];
}

// Domain configurations with reference ranges
export const DOMAINS: DomainConfig[] = [
  {
    key: 'oxygen_transport',
    labelKey: 'bio.domain.oxygenTransport',
    weight: 0.18,
    markers: [
      { key: 'hemoglobin', labelKey: 'bio.marker.hemoglobin', unit: 'g/dL', min: 12.0, max: 18.0, optimalMin: 14.0, optimalMax: 17.0 },
      { key: 'hematocrit', labelKey: 'bio.marker.hematocrit', unit: '%', min: 36, max: 54, optimalMin: 40, optimalMax: 50 },
      { key: 'ferritin', labelKey: 'bio.marker.ferritin', unit: 'ng/mL', min: 20, max: 300, optimalMin: 50, optimalMax: 200 },
      { key: 'iron', labelKey: 'bio.marker.iron', unit: 'ug/dL', min: 60, max: 170, optimalMin: 80, optimalMax: 150 },
      { key: 'transferrin_sat', labelKey: 'bio.marker.transferrinSat', unit: '%', min: 20, max: 50, optimalMin: 25, optimalMax: 45 },
    ],
  },
  {
    key: 'recovery',
    labelKey: 'bio.domain.recovery',
    weight: 0.14,
    markers: [
      { key: 'ck', labelKey: 'bio.marker.ck', unit: 'U/L', min: 30, max: 200, optimalMin: 50, optimalMax: 170 },
      { key: 'ldh', labelKey: 'bio.marker.ldh', unit: 'U/L', min: 120, max: 246, optimalMin: 135, optimalMax: 225 },
      { key: 'urea', labelKey: 'bio.marker.urea', unit: 'mg/dL', min: 15, max: 45, optimalMin: 18, optimalMax: 38 },
      { key: 'cortisol', labelKey: 'bio.marker.cortisol', unit: 'ug/dL', min: 5, max: 25, optimalMin: 8, optimalMax: 20 },
    ],
  },
  {
    key: 'inflammation',
    labelKey: 'bio.domain.inflammation',
    weight: 0.12,
    markers: [
      { key: 'crp', labelKey: 'bio.marker.crp', unit: 'mg/L', min: 0, max: 3.0, optimalMin: 0, optimalMax: 1.0 },
      { key: 'esr', labelKey: 'bio.marker.esr', unit: 'mm/h', min: 0, max: 20, optimalMin: 0, optimalMax: 10 },
      { key: 'wbc', labelKey: 'bio.marker.wbc', unit: 'x10^3/uL', min: 4.0, max: 11.0, optimalMin: 4.5, optimalMax: 9.0 },
      { key: 'neutrophil_lymphocyte_ratio', labelKey: 'bio.marker.nlr', unit: '', min: 0.5, max: 3.5, optimalMin: 1.0, optimalMax: 2.5 },
    ],
  },
  {
    key: 'hormonal',
    labelKey: 'bio.domain.hormonal',
    weight: 0.14,
    markers: [
      { key: 'testosterone', labelKey: 'bio.marker.testosterone', unit: 'ng/dL', min: 270, max: 1070, optimalMin: 400, optimalMax: 900 },
      { key: 'cortisol_am', labelKey: 'bio.marker.cortisolAm', unit: 'ug/dL', min: 6, max: 23, optimalMin: 10, optimalMax: 20 },
      { key: 'tsh', labelKey: 'bio.marker.tsh', unit: 'mIU/L', min: 0.4, max: 4.5, optimalMin: 1.0, optimalMax: 3.5 },
      { key: 'free_t4', labelKey: 'bio.marker.freeT4', unit: 'ng/dL', min: 0.8, max: 1.8, optimalMin: 1.0, optimalMax: 1.6 },
      { key: 'igf1', labelKey: 'bio.marker.igf1', unit: 'ng/mL', min: 100, max: 400, optimalMin: 150, optimalMax: 350 },
    ],
  },
  {
    key: 'energy_availability',
    labelKey: 'bio.domain.energyAvailability',
    weight: 0.12,
    markers: [
      { key: 'glucose_fasting', labelKey: 'bio.marker.glucoseFasting', unit: 'mg/dL', min: 70, max: 100, optimalMin: 75, optimalMax: 95 },
      { key: 'insulin_fasting', labelKey: 'bio.marker.insulinFasting', unit: 'uIU/mL', min: 2, max: 20, optimalMin: 3, optimalMax: 12 },
      { key: 'triglycerides', labelKey: 'bio.marker.triglycerides', unit: 'mg/dL', min: 30, max: 150, optimalMin: 40, optimalMax: 100 },
      { key: 'free_fatty_acids', labelKey: 'bio.marker.freeFA', unit: 'mmol/L', min: 0.1, max: 0.9, optimalMin: 0.2, optimalMax: 0.6 },
    ],
  },
  {
    key: 'nutrition',
    labelKey: 'bio.domain.nutrition',
    weight: 0.10,
    markers: [
      { key: 'vitamin_d', labelKey: 'bio.marker.vitaminD', unit: 'ng/mL', min: 20, max: 80, optimalMin: 40, optimalMax: 70 },
      { key: 'vitamin_b12', labelKey: 'bio.marker.vitaminB12', unit: 'pg/mL', min: 200, max: 900, optimalMin: 400, optimalMax: 800 },
      { key: 'folate', labelKey: 'bio.marker.folate', unit: 'ng/mL', min: 3, max: 20, optimalMin: 5, optimalMax: 15 },
      { key: 'magnesium', labelKey: 'bio.marker.magnesium', unit: 'mg/dL', min: 1.7, max: 2.5, optimalMin: 2.0, optimalMax: 2.4 },
      { key: 'zinc', labelKey: 'bio.marker.zinc', unit: 'ug/dL', min: 60, max: 120, optimalMin: 70, optimalMax: 110 },
    ],
  },
  {
    key: 'metabolic_health',
    labelKey: 'bio.domain.metabolicHealth',
    weight: 0.10,
    markers: [
      { key: 'hba1c', labelKey: 'bio.marker.hba1c', unit: '%', min: 4.0, max: 5.7, optimalMin: 4.2, optimalMax: 5.3 },
      { key: 'hdl', labelKey: 'bio.marker.hdl', unit: 'mg/dL', min: 40, max: 100, optimalMin: 50, optimalMax: 90 },
      { key: 'ldl', labelKey: 'bio.marker.ldl', unit: 'mg/dL', min: 50, max: 130, optimalMin: 60, optimalMax: 100 },
      { key: 'total_cholesterol', labelKey: 'bio.marker.totalCholesterol', unit: 'mg/dL', min: 120, max: 200, optimalMin: 140, optimalMax: 190 },
    ],
  },
  {
    key: 'hydration_renal',
    labelKey: 'bio.domain.hydrationRenal',
    weight: 0.10,
    markers: [
      { key: 'creatinine', labelKey: 'bio.marker.creatinine', unit: 'mg/dL', min: 0.6, max: 1.3, optimalMin: 0.7, optimalMax: 1.2 },
      { key: 'bun', labelKey: 'bio.marker.bun', unit: 'mg/dL', min: 7, max: 20, optimalMin: 8, optimalMax: 18 },
      { key: 'sodium', labelKey: 'bio.marker.sodium', unit: 'mEq/L', min: 136, max: 145, optimalMin: 137, optimalMax: 144 },
      { key: 'potassium', labelKey: 'bio.marker.potassium', unit: 'mEq/L', min: 3.5, max: 5.1, optimalMin: 3.8, optimalMax: 4.8 },
    ],
  },
];

function scoreMarker(value: number, ref: MarkerReference): { score: number; status: FlagStatus } {
  // Within optimal range: 80-100
  if (value >= ref.optimalMin && value <= ref.optimalMax) {
    const mid = (ref.optimalMin + ref.optimalMax) / 2;
    const range = (ref.optimalMax - ref.optimalMin) / 2;
    const dist = Math.abs(value - mid) / range;
    const score = 100 - dist * 20;
    return { score, status: 'green' };
  }
  // Within normal range but outside optimal: 50-79
  if (value >= ref.min && value <= ref.max) {
    let distFromOptimal: number;
    if (value < ref.optimalMin) {
      distFromOptimal = (ref.optimalMin - value) / (ref.optimalMin - ref.min);
    } else {
      distFromOptimal = (value - ref.optimalMax) / (ref.max - ref.optimalMax);
    }
    const score = 79 - distFromOptimal * 29;
    return { score: Math.max(50, score), status: 'yellow' };
  }
  // Outside normal range: 0-49
  let distOutside: number;
  if (value < ref.min) {
    distOutside = Math.min((ref.min - value) / (ref.min * 0.3 || 1), 1);
  } else {
    distOutside = Math.min((value - ref.max) / (ref.max * 0.3 || 1), 1);
  }
  const score = 49 - distOutside * 49;
  return { score: Math.max(0, score), status: 'red' };
}

function getInterpretationKey(marker: MarkerReference, value: number, status: FlagStatus): string {
  if (status === 'green') return `bio.interp.${marker.key}.normal`;
  if (value < marker.min) return `bio.interp.${marker.key}.low`;
  if (value > marker.max) return `bio.interp.${marker.key}.high`;
  if (value < marker.optimalMin) return `bio.interp.${marker.key}.suboptimalLow`;
  return `bio.interp.${marker.key}.suboptimalHigh`;
}

export function scoreDomain(domainKey: string, markers: Record<string, number>): DomainResult {
  const domain = DOMAINS.find(d => d.key === domainKey);
  if (!domain) return { key: domainKey, score: 0, status: 'red', markers: [] };

  const results: MarkerResult[] = [];
  let totalScore = 0;
  let count = 0;

  for (const ref of domain.markers) {
    const value = markers[ref.key];
    if (value == null) continue;
    const { score, status } = scoreMarker(value, ref);
    results.push({
      key: ref.key,
      value,
      score: Math.round(score),
      status,
      interpretationKey: getInterpretationKey(ref, value, status),
    });
    totalScore += score;
    count++;
  }

  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
  const status: FlagStatus = avgScore >= 80 ? 'green' : avgScore >= 50 ? 'yellow' : 'red';

  return { key: domainKey, score: avgScore, status, markers: results };
}

export function computeGlobalScore(domainResults: DomainResult[]): { score: number; status: FlagStatus } {
  let weightedSum = 0;
  let weightTotal = 0;

  for (const dr of domainResults) {
    const domain = DOMAINS.find(d => d.key === dr.key);
    if (!domain || dr.markers.length === 0) continue;
    weightedSum += dr.score * domain.weight;
    weightTotal += domain.weight;
  }

  const score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;
  const status: FlagStatus = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
  return { score, status };
}

export function generateHealthFlags(domainResults: DomainResult[]): HealthFlag[] {
  const flags: HealthFlag[] = [];

  for (const dr of domainResults) {
    const domain = DOMAINS.find(d => d.key === dr.key);
    if (!domain) continue;

    for (const mr of dr.markers) {
      if (mr.status === 'green') continue;
      const ref = domain.markers.find(m => m.key === mr.key);
      if (!ref) continue;

      flags.push({
        id: `${dr.key}-${mr.key}`,
        domain: dr.key,
        domainLabelKey: domain.labelKey,
        marker: mr.key,
        markerLabelKey: ref.labelKey,
        status: mr.status,
        messageKey: mr.interpretationKey,
        value: mr.value,
        unit: ref.unit,
      });
    }
  }

  return flags.sort((a, b) => {
    const order: Record<FlagStatus, number> = { red: 0, yellow: 1, green: 2 };
    return order[a.status] - order[b.status];
  });
}

export function analyzeFullPanel(allMarkers: Record<string, Record<string, number>>): BiochemicalResult {
  const domains: DomainResult[] = [];

  for (const domain of DOMAINS) {
    const markers = allMarkers[domain.key] || {};
    const hasValues = Object.values(markers).some(v => v != null);
    if (hasValues) {
      domains.push(scoreDomain(domain.key, markers));
    }
  }

  const { score: globalScore, status: globalStatus } = computeGlobalScore(domains);
  const healthFlags = generateHealthFlags(domains);

  return { domains, globalScore, globalStatus, healthFlags };
}

export function computeTrend(points: TrendPoint[]): TrendDirection {
  if (points.length < 2) return 'stable';
  const recent = points.slice(-3);
  if (recent.length < 2) return 'stable';

  let increasing = 0;
  let decreasing = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i].score - recent[i - 1].score;
    if (diff > 3) increasing++;
    else if (diff < -3) decreasing++;
  }

  if (increasing > decreasing) return 'improving';
  if (decreasing > increasing) return 'declining';
  return 'stable';
}

export function getDomainTrends(
  tests: Array<{ test_date: string; [key: string]: unknown }>
): DomainTrend[] {
  const trends: DomainTrend[] = [];

  for (const domain of DOMAINS) {
    const points: TrendPoint[] = [];
    for (const test of tests) {
      const scoreKey = `${domain.key}_score` as keyof typeof test;
      const score = test[scoreKey] as number | null;
      if (score != null) {
        const status: FlagStatus = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
        points.push({ date: test.test_date as string, score, status });
      }
    }
    if (points.length > 0) {
      trends.push({ domain: domain.key, direction: computeTrend(points), points });
    }
  }

  return trends;
}
