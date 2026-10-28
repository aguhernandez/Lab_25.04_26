import { Sport } from '../types';
import { parseSpeedKmh } from './lactateAnalysis';

export type ZoneConfidence = 'measured' | 'estimated' | 'inferred';

export type Language = 'en' | 'es';

export interface ZoneDefinition {
  zone: number;
  name: string;
  hr_min: number | null;
  hr_max: number | null;
  hr_label?: string | null;
  power_min?: number | null;
  power_max?: number | null;
  pace_min?: string | null;
  pace_max?: string | null;
  rpe_min?: number | null;
  rpe_max?: number | null;
  description: string;
  confidence?: ZoneConfidence;
  speed_min_kmh?: number | null;
  speed_max_kmh?: number | null;
  calculation?: { method: string; version: string; metric: string; reference: number | null; restingHR?: number; maximumHR?: number; referenceSource?: string; referenceIsProxy?: boolean; formula: string; source?: string; custom?: boolean };
  zone_label?: string;
  power_label?: string;
  pace_label?: string;
}

export interface ZoneCalculationOptions {
  lt1_power?: number | null;
  lt2_power?: number | null;
  lt1_speed_kmh?: number | null;
  lt2_speed_kmh?: number | null;
  vam_kmh?: number | null;
  pam_watts?: number | null;
  threshold_source?: 'ventilatory' | 'lactate';
  threshold_confidence?: ZoneConfidence;
  language?: Language;
}

export interface TrainingZonesData {
  baseMethod: 'LT1_LT2_physiological';
  zones7: ZoneDefinition[];
  zones5: ZoneDefinition[];
  defaultDisplay: '5' | '7';
}

export type ZoneDisplayMode = '5' | '7';

// ---- Localized zone names ----

const ZONE7_NAMES: Record<Language, Record<number, string>> = {
  en: {
    1: 'Recovery',
    2: 'Aerobic / Base',
    3: 'Tempo (sub-VT1)',
    4: 'Threshold (VT1→VT2)',
    5: 'VO2max / supra-threshold',
    6: 'Anaerobic Capacity',
    7: 'Neuromuscular / Sprint',
  },
  es: {
    1: 'Recuperación',
    2: 'Aeróbico / Base',
    3: 'Tempo (sub-VT1)',
    4: 'Umbral (VT1→VT2)',
    5: 'VO2max / supra-umbral',
    6: 'Capacidad anaeróbica',
    7: 'Neuromuscular / Sprint',
  },
};

const ZONE7_DESCRIPTIONS: Record<Language, Record<number, string>> = {
  en: {
    1: 'Active recovery, very light effort below threshold 1',
    2: 'Base aerobic development, fat oxidation predominates',
    3: 'Aerobic endurance, sustainable long efforts',
    4: 'Threshold, sustained efforts between threshold 1 and 2',
    5: 'VO2max stimulus, high cardiac demand above threshold 2',
    6: 'Anaerobic capacity, efforts above VAM/PAM',
    7: 'Neuromuscular power, maximal sprint efforts',
  },
  es: {
    1: 'Recuperación activa, esfuerzo muy ligero por debajo del umbral 1',
    2: 'Desarrollo aeróbico base, predomina la oxidación de grasas',
    3: 'Resistencia aeróbica, esfuerzos largos sostenibles',
    4: 'Umbral, esfuerzos sostenidos entre umbral 1 y 2',
    5: 'Estímulo VO2max, alta demanda cardíaca por encima del umbral 2',
    6: 'Capacidad anaeróbica, esfuerzos por encima de VAM/PAM',
    7: 'Potencia neuromuscular, esfuerzos máximos de sprint',
  },
};

const ZONE5_NAMES: Record<Language, Record<number, string>> = {
  en: {
    1: 'Recovery',
    2: 'Aerobic',
    3: 'Threshold',
    4: 'VO2max',
    5: 'Anaerobic / Speed',
  },
  es: {
    1: 'Recuperación',
    2: 'Aeróbico',
    3: 'Umbral',
    4: 'VO2max',
    5: 'Anaeróbico / Velocidad',
  },
};

const ZONE5_DESCRIPTIONS: Record<Language, Record<number, string>> = {
  en: {
    1: 'Recovery, very light effort below threshold 1',
    2: 'Aerobic base and endurance, below threshold 1',
    3: 'Threshold, sustained efforts between threshold 1 and 2',
    4: 'VO2max, high-intensity efforts between threshold 2 and VAM/PAM',
    5: 'Anaerobic / speed, maximal efforts above VAM/PAM',
  },
  es: {
    1: 'Recuperación, esfuerzo muy ligero por debajo del umbral 1',
    2: 'Base aeróbica y resistencia, por debajo del umbral 1',
    3: 'Umbral, esfuerzos sostenidos entre umbral 1 y 2',
    4: 'VO2max, esfuerzos de alta intensidad entre umbral 2 y VAM/PAM',
    5: 'Anaeróbico / velocidad, esfuerzos máximos por encima de VAM/PAM',
  },
};

function getZone7Name(zone: number, lang: Language, thresholdSource: 'ventilatory' | 'lactate'): string {
  const names = ZONE7_NAMES[lang];
  let name = names[zone] ?? names[zone];
  if (zone === 3) {
    const t1Label = thresholdSource === 'lactate' ? 'LT1' : 'VT1';
    name = name.replace('VT1', t1Label);
  }
  if (zone === 4) {
    const t1Label = thresholdSource === 'lactate' ? 'LT1' : 'VT1';
    const t2Label = thresholdSource === 'lactate' ? 'LT2' : 'VT2';
    name = name.replace(/VT1→VT2/, `${t1Label}→${t2Label}`);
  }
  if (zone === 5) {
    const t2Label = thresholdSource === 'lactate' ? 'umbral' : 'threshold';
    if (lang === 'es') {
      name = name.replace('umbral', t2Label);
    }
  }
  return name;
}

function getZone7Description(zone: number, lang: Language): string {
  return ZONE7_DESCRIPTIONS[lang][zone] ?? ZONE7_DESCRIPTIONS[lang][zone];
}

function getZone5Name(zone: number, lang: Language): string {
  return ZONE5_NAMES[lang][zone] ?? ZONE5_NAMES[lang][zone];
}

function getZone5Description(zone: number, lang: Language): string {
  return ZONE5_DESCRIPTIONS[lang][zone] ?? ZONE5_DESCRIPTIONS[lang][zone];
}

// ---- HR label helpers for Z6/Z7 ----

function getHRLabel(zone: number, lang: Language): string | null {
  if (zone === 6) {
    return lang === 'es' ? 'Cerca del máximo, no discrimina' : 'Near maximum, not discriminative';
  }
  if (zone === 7) {
    return lang === 'es' ? 'No aplica' : 'N/A';
  }
  return null;
}

// ---- Internal pace/speed helpers ----

export function paceToKmh(pace: string, sport: Sport): number | null {
  const text = pace.trim();
  return parseSpeedKmh(sport === 'swimming' && text.includes(':') && !text.includes('/') ? `${text}/100m` : text);
}

export function kmhToPace(kmh: number, sport: Sport): string | null {
  if (!Number.isFinite(kmh) || kmh <= 0) return null;
  if (sport !== 'running' && sport !== 'swimming') return (Math.round(kmh * 10) / 10).toString();
  const seconds = Math.round((sport === 'swimming' ? 360 : 3600) / kmh);
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

const positive = (value: number | null | undefined): value is number => value != null && Number.isFinite(value) && value > 0;

/** Interpolate only inside the observed HR range; never select the next stage or extrapolate. */
function atHR(points: Array<{ hr: number; value: number }>, hr: number): number | null {
  const sorted = points.filter(p => positive(p.hr) && positive(p.value)).sort((a, b) => a.hr - b.hr);
  const exact = sorted.filter(p => p.hr === hr);
  if (exact.length) return exact.reduce((sum, p) => sum + p.value, 0) / exact.length;
  const upper = sorted.findIndex(p => p.hr > hr);
  if (upper <= 0) return null;
  const a = sorted[upper - 1], b = sorted[upper];
  return a.value + (b.value - a.value) * (hr - a.hr) / (b.hr - a.hr);
}

/** Asciende's practical subdivisions around LT1/LT2; not a published 7-zone protocol. */
export function calculateZones7(
  lt1_hr: number | null,
  lt2_hr: number | null,
  hrmax: number,
  sport: Sport,
  dataPoints?: Array<{ heart_rate: number; power_watts?: number | null; speed_pace?: string | null }>,
  options?: ZoneCalculationOptions,
): ZoneDefinition[] {
  const lang = options?.language ?? 'en';
  const source = options?.threshold_source ?? 'lactate';
  if (!positive(hrmax)) return [];
  const lt1 = Math.round(positive(lt1_hr) ? lt1_hr : hrmax * 0.72);
  const lt2 = Math.round(positive(lt2_hr) ? lt2_hr : hrmax * 0.87);
  if (!(lt1 > 0 && lt1 < lt2 && lt2 < hrmax)) return [];
  const hrEdges = [Math.round(lt1 * 0.85), Math.round(lt1 * 0.925), lt1, lt2, Math.floor(hrmax)];
  if (hrEdges.some((v, i) => i > 0 && v <= hrEdges[i - 1])) return [];
  const zones: ZoneDefinition[] = Array.from({ length: 7 }, (_, i) => ({
    zone: i + 1,
    name: getZone7Name(i + 1, lang, source),
    hr_min: i === 0 || i >= 5 ? null : hrEdges[i - 1] + 1,
    hr_max: i < 5 ? hrEdges[i] : null,
    hr_label: i >= 5 ? getHRLabel(i + 1, lang) : null,
    rpe_min: [1, 3, 4, 5, 7, 8, 9][i],
    rpe_max: [3, 4, 5, 6, 8, 9, 10][i],
    description: getZone7Description(i + 1, lang),
    confidence: positive(lt1_hr) && positive(lt2_hr) ? 'estimated' : 'inferred',
    calculation: { method: 'LT1_LT2_physiological', version: '2.0.0', metric: 'combined', reference: lt2,
      formula: `LT1=${lt1}; LT2=${lt2}; HRmax=${hrmax}; sub-LT1: 85%, 92.5%, 100%; supra-LT2 HR not discriminative for sprints` },
  }));
  const points = dataPoints ?? [];
  const powerAt = (hr: number) => atHR(points.map(p => ({ hr: p.heart_rate, value: p.power_watts ?? NaN })), hr);
  const p1 = options?.lt1_power ?? powerAt(lt1);
  const p2 = options?.lt2_power ?? powerAt(lt2);
  if (positive(p1) && positive(p2) && p1 < p2) {
    const pam = positive(options?.pam_watts) && options.pam_watts > p2 ? options.pam_watts : p2 * 1.3;
    const edges = [p1 * 0.85, p1 * 0.925, p1, p2, pam, pam * 1.15].map(Math.round);
    if (edges.every((v, i) => i === 0 || v > edges[i - 1])) zones.forEach((z, i) => {
      z.power_min = i === 0 ? 0 : edges[i - 1] + 1;
      z.power_max = i < edges.length ? edges[i] : null;
      z.calculation!.formula += `; power LT1=${p1}, LT2=${p2}, PAM=${pam}${positive(options?.pam_watts) && options.pam_watts > p2 ? '' : ' (estimated 1.3×LT2)'}; Z6 ceiling=1.15×PAM; Z7 open`;
    });
  }
  if (sport === 'running' || sport === 'swimming') {
    const speedAt = (hr: number) => atHR(points.map(p => ({ hr: p.heart_rate, value: p.speed_pace ? paceToKmh(p.speed_pace, sport) ?? NaN : NaN })), hr);
    const v1 = options?.lt1_speed_kmh ?? speedAt(lt1);
    const v2 = options?.lt2_speed_kmh ?? speedAt(lt2);
    if (positive(v1) && positive(v2) && v1 < v2) {
      const vam = positive(options?.vam_kmh) && options.vam_kmh > v2 ? options.vam_kmh : v2 * 1.2;
      const edges = [v1 * 0.85, v1 * 0.925, v1, v2, vam, vam * 1.15];
      zones.forEach((z, i) => {
        z.speed_min_kmh = i === 0 ? 0 : edges[i - 1];
        z.speed_max_kmh = i < edges.length ? edges[i] : null;
        z.pace_min = z.speed_max_kmh == null ? null : kmhToPace(z.speed_max_kmh, sport);
        z.pace_max = z.speed_min_kmh > 0 ? kmhToPace(z.speed_min_kmh, sport) : null;
        z.calculation!.formula += `; speed LT1=${v1}, LT2=${v2}, VAM=${vam}${positive(options?.vam_kmh) && options.vam_kmh > v2 ? '' : ' (estimated 1.2×LT2)'}; Z6 ceiling=1.15×VAM; Z7 open`;
      });
    }
  }
  return zones;
}

// ---- 5-zone collapse: group 7 zones into 5 ----
// Grouping: [1], [2,3], [4], [5], [6,7]. Only for the Asciende physiological method.

// Z1/Z2 split is a practical training convention, not a measured physiological threshold.
// The 85% of threshold 1 boundary is reused from the 7-zone model to separate recovery from aerobic.
export function convertTo5Zones(zones7: ZoneDefinition[], _sport: Sport, language?: Language): ZoneDefinition[] {
  const lang: Language = language ?? 'en';
  if (zones7.length !== 7 || Array.from({ length: 7 }, (_, i) => i + 1).some(n => !zones7.some(z => z.zone === n))) return [];
  if (zones7.some(z => z.calculation && z.calculation.method !== 'LT1_LT2_physiological')) return [];
  const z = (n: number) => zones7.find(zd => zd.zone === n)!;

  const hasPower = zones7.some(zone => zone.power_min != null);
  const hasPace = zones7.some(zone => zone.pace_min != null || zone.pace_max != null);

  const naLabel = lang === 'es' ? 'No aplica' : 'N/A';

  // 5Z1 = 7Z1 (Recovery: below 85% of threshold 1)
  // 5Z2 = 7Z2 + 7Z3 (Aerobic: 85% of threshold 1 up to threshold 1)
  // 5Z3 = 7Z4 (Threshold: threshold 1 to threshold 2)
  // 5Z4 = 7Z5 (VO2max: threshold 2 to VAM/PAM)
  // 5Z5 = 7Z6 + 7Z7 (Anaerobic/Speed: above VAM/PAM, HR not applicable)
  const zones5: ZoneDefinition[] = [
    {
      zone: 1,
      name: getZone5Name(1, lang),
      hr_min: z(1).hr_min,
      hr_max: z(1).hr_max,
      rpe_min: 1,
      rpe_max: 3,
      description: getZone5Description(1, lang),
      confidence: z(1).confidence,
      ...(hasPower ? { power_min: z(1).power_min, power_max: z(1).power_max } : {}),
      ...(hasPace ? { pace_min: z(1).pace_min, pace_max: z(1).pace_max } : {}),
    },
    {
      zone: 2,
      name: getZone5Name(2, lang),
      hr_min: z(2).hr_min,
      hr_max: z(3).hr_max,
      rpe_min: 3,
      rpe_max: 5,
      description: getZone5Description(2, lang),
      confidence: z(2).confidence,
      ...(hasPower ? { power_min: z(2).power_min, power_max: z(3).power_max } : {}),
      ...(hasPace ? { pace_min: z(3).pace_min, pace_max: z(2).pace_max } : {}),
    },
    {
      zone: 3,
      name: getZone5Name(3, lang),
      hr_min: z(4).hr_min,
      hr_max: z(4).hr_max,
      rpe_min: 5,
      rpe_max: 6,
      description: getZone5Description(3, lang),
      confidence: z(4).confidence,
      ...(hasPower ? { power_min: z(4).power_min, power_max: z(4).power_max } : {}),
      ...(hasPace ? { pace_min: z(4).pace_min, pace_max: z(4).pace_max } : {}),
    },
    {
      zone: 4,
      name: getZone5Name(4, lang),
      hr_min: z(5).hr_min,
      hr_max: z(5).hr_max,
      rpe_min: 7,
      rpe_max: 8,
      description: getZone5Description(4, lang),
      confidence: z(5).confidence,
      ...(hasPower ? { power_min: z(5).power_min, power_max: z(5).power_max } : {}),
      ...(hasPace ? { pace_min: z(5).pace_min, pace_max: z(5).pace_max } : {}),
    },
    {
      zone: 5,
      name: getZone5Name(5, lang),
      hr_min: null,
      hr_max: null,
      hr_label: naLabel,
      rpe_min: 9,
      rpe_max: 10,
      description: getZone5Description(5, lang),
      confidence: z(6).confidence,
      ...(hasPower ? { power_min: z(6).power_min, power_max: z(7).power_max } : {}),
      ...(hasPace ? { pace_min: z(7).pace_min, pace_max: z(6).pace_max } : {}),
    },
  ];

  const groups = [[1], [2, 3], [4], [5], [6, 7]];
  return zones5.map((zone, i) => ({ ...zone,
    speed_min_kmh: z(groups[i][0]).speed_min_kmh,
    speed_max_kmh: z(groups[i][groups[i].length - 1]).speed_max_kmh,
    calculation: z(groups[i][0]).calculation,
  }));
}

export function buildTrainingZonesData(
  lt1_hr: number | null,
  lt2_hr: number | null,
  hrmax: number,
  sport: Sport,
  defaultDisplay: '5' | '7' = '5',
  dataPoints?: Array<{ heart_rate: number; power_watts?: number | null; speed_pace?: string | null }>,
  options?: ZoneCalculationOptions,
): TrainingZonesData {
  const zones7 = calculateZones7(lt1_hr, lt2_hr, hrmax, sport, dataPoints, options);
  const zones5 = convertTo5Zones(zones7, sport, options?.language);

  return {
    baseMethod: 'LT1_LT2_physiological',
    zones7,
    zones5,
    defaultDisplay,
  };
}

export function getZoneColor(zoneNumber: number, totalZones: 5 | 7): string {
  if (totalZones === 5) {
    const colors = [
      'bg-sky-100 dark:bg-sky-900/30 border-sky-500',
      'bg-green-100 dark:bg-green-900/30 border-green-500',
      'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500',
      'bg-orange-100 dark:bg-orange-900/30 border-orange-500',
      'bg-red-100 dark:bg-red-900/30 border-red-500',
    ];
    return colors[(zoneNumber - 1) % colors.length];
  }
  const colors = [
    'bg-sky-100 dark:bg-sky-900/30 border-sky-500',
    'bg-teal-100 dark:bg-teal-900/30 border-teal-500',
    'bg-green-100 dark:bg-green-900/30 border-green-500',
    'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500',
    'bg-orange-100 dark:bg-orange-900/30 border-orange-500',
    'bg-red-100 dark:bg-red-900/30 border-red-500',
    'bg-rose-100 dark:bg-rose-900/30 border-rose-700',
  ];
  return colors[(zoneNumber - 1) % colors.length];
}

export function getZoneTextColor(zoneNumber: number, totalZones: 5 | 7): string {
  if (totalZones === 5) {
    const colors = [
      'text-sky-700 dark:text-sky-300',
      'text-green-700 dark:text-green-300',
      'text-yellow-700 dark:text-yellow-300',
      'text-orange-700 dark:text-orange-300',
      'text-red-700 dark:text-red-300',
    ];
    return colors[(zoneNumber - 1) % colors.length];
  }
  const colors = [
    'text-sky-700 dark:text-sky-300',
    'text-teal-700 dark:text-teal-300',
    'text-green-700 dark:text-green-300',
    'text-yellow-700 dark:text-yellow-300',
    'text-orange-700 dark:text-orange-300',
    'text-red-700 dark:text-red-300',
    'text-rose-800 dark:text-rose-300',
  ];
  return colors[(zoneNumber - 1) % colors.length];
}
