import { Sport } from '../types';

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
}

export interface ZoneCalculationOptions {
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
    1: 'Recovery / Base',
    2: 'Aerobic',
    3: 'Threshold',
    4: 'VO2max',
    5: 'Anaerobic / Sprint',
  },
  es: {
    1: 'Recuperación / Base',
    2: 'Aeróbico',
    3: 'Umbral',
    4: 'VO2max',
    5: 'Anaeróbico / Sprint',
  },
};

const ZONE5_DESCRIPTIONS: Record<Language, Record<number, string>> = {
  en: {
    1: 'Recovery and very easy aerobic work',
    2: 'Aerobic base and endurance development',
    3: 'Threshold and sustainable pace work',
    4: 'VO2max and high-intensity intervals',
    5: 'Anaerobic capacity and sprint efforts',
  },
  es: {
    1: 'Recuperación y trabajo aeróbico muy suave',
    2: 'Desarrollo de base aeróbica y resistencia',
    3: 'Trabajo de umbral y ritmo sostenible',
    4: 'VO2max e intervalos de alta intensidad',
    5: 'Capacidad anaeróbica y esfuerzos de sprint',
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

function paceToKmh(pace: string, sport: Sport): number | null {
  if (!pace || pace.trim() === '') return null;
  const trimmed = pace.trim();

  if (sport === 'cycling' || sport === 'triathlon') {
    const num = parseFloat(trimmed.replace(',', '.'));
    return !isNaN(num) && num > 0 ? num : null;
  }

  if (sport === 'running') {
    if (trimmed.includes(':')) {
      const parts = trimmed.replace(/[^0-9:]/g, '').split(':');
      if (parts.length >= 2) {
        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);
        if (!isNaN(mins) && !isNaN(secs) && (mins + secs / 60) > 0) {
          return 60 / (mins + secs / 60);
        }
      }
    }
    const num = parseFloat(trimmed.replace(',', '.'));
    return !isNaN(num) && num > 0 ? num : null;
  }

  if (sport === 'swimming') {
    if (trimmed.includes(':')) {
      const parts = trimmed.replace(/[^0-9:]/g, '').split(':');
      if (parts.length >= 2) {
        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);
        const totalMins = mins + secs / 60;
        if (!isNaN(totalMins) && totalMins > 0) {
          return (0.1 / totalMins) * 60;
        }
      }
    }
    return null;
  }

  return null;
}

function kmhToPace(kmh: number, sport: Sport): string | null {
  if (!kmh || kmh <= 0) return null;

  if (sport === 'cycling' || sport === 'triathlon') {
    return (Math.round(kmh * 10) / 10).toString();
  }

  if (sport === 'running') {
    const minsPerKm = 60 / kmh;
    const m = Math.floor(minsPerKm);
    const s = Math.round((minsPerKm - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (sport === 'swimming') {
    const minsPer100m = 6 / kmh;
    const m = Math.floor(minsPer100m);
    const s = Math.round((minsPer100m - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return null;
}

function interpolateHR(
  currentVal: number,
  lowVal: number,
  highVal: number,
  lowHR: number,
  highHR: number,
): number {
  if (highVal === lowVal) return lowHR;
  const ratio = Math.max(0, Math.min(1, (currentVal - lowVal) / (highVal - lowVal)));
  return Math.round(lowHR + ratio * (highHR - lowHR));
}

function ensureValidRange(min: number | null, max: number | null): { min: number | null; max: number | null } {
  if (min == null || max == null) return { min, max };
  if (min === max) return { min: min - 1, max: max + 1 };
  if (min > max) return { min: max, max: min };
  return { min, max };
}

// ---- Main unified zone calculation ----

export function calculateZones7(
  lt1_hr: number | null,
  lt2_hr: number | null,
  hrmax: number,
  sport: Sport,
  dataPoints?: Array<{ heart_rate: number; power_watts?: number | null; speed_pace?: string | null }>,
  options?: ZoneCalculationOptions,
): ZoneDefinition[] {
  const lang: Language = options?.language ?? 'en';
  const thresholdSource: 'ventilatory' | 'lactate' = options?.threshold_source ?? 'lactate';

  const lt1 = lt1_hr ?? Math.round(hrmax * 0.72);
  const lt2 = lt2_hr ?? Math.round(hrmax * 0.87);
  const thresholdConfidence = options?.threshold_confidence ?? 'estimated';

  const hasPower = !!dataPoints?.some(p => p.power_watts != null && p.power_watts > 0);
  const hasPace = !!dataPoints?.some(p => p.speed_pace && p.speed_pace.trim() !== '');

  // Resolve VAM/PAM
  let vamKmh: number | null = options?.vam_kmh ?? null;
  let pamWatts: number | null = options?.pam_watts ?? null;
  let vamPamConfidence: ZoneConfidence = 'measured';

  if (!vamKmh && dataPoints && hasPace) {
    let maxSpeed = 0;
    for (const p of dataPoints) {
      if (p.speed_pace && p.speed_pace.trim() !== '') {
        const speed = paceToKmh(p.speed_pace, sport);
        if (speed !== null && speed > maxSpeed) maxSpeed = speed;
      }
    }
    if (maxSpeed > 0) vamKmh = Math.round(maxSpeed * 10) / 10;
  }

  if (!pamWatts && dataPoints && hasPower) {
    const maxPwr = Math.max(...dataPoints.map(p => p.power_watts ?? 0));
    if (maxPwr > 0) pamWatts = maxPwr;
  }

  // Fallback if still no VAM/PAM
  if (!vamKmh && !pamWatts) {
    vamPamConfidence = 'estimated';
    if (hasPower && dataPoints) {
      const lt2Power = dataPoints.find(p => p.heart_rate >= lt2)?.power_watts ?? null;
      if (lt2Power && lt2Power > 0) pamWatts = Math.round(lt2Power * 1.30);
    }
    if (hasPace && dataPoints) {
      const lt2PacePoint = dataPoints
        .filter(p => p.speed_pace && p.speed_pace.trim() !== '')
        .reduce((prev, curr) =>
          Math.abs(curr.heart_rate - lt2) < Math.abs(prev.heart_rate - lt2) ? curr : prev,
        );
      const lt2Speed = lt2PacePoint?.speed_pace ? paceToKmh(lt2PacePoint.speed_pace, sport) : null;
      if (lt2Speed && lt2Speed > 0) vamKmh = Math.round(lt2Speed * 1.20 * 10) / 10;
    }
  }

  const zoneConfidence: ZoneConfidence =
    thresholdConfidence === 'measured' && vamPamConfidence === 'measured' ? 'measured' : 'estimated';

  // ---- HR band boundaries ----
  // Z1: everything below 85% of threshold 1 HR
  // Z2 & Z3: split the range [85% of threshold 1, threshold 1] into two equal bands
  // Z4: exact range [threshold 1, threshold 2]
  // Z5: from threshold 2 to VAM/PAM (HR interpolated)
  // Z6 & Z7: above VAM/PAM — HR is null (not discriminative at these intensities)

  const t1LowerBound = Math.round(lt1 * 0.85);
  const z2z3Range = lt1 - t1LowerBound;
  const z2Upper = t1LowerBound + Math.round(z2z3Range / 2);
  const z3Upper = lt1;

  const zones: ZoneDefinition[] = [
    {
      zone: 1,
      name: getZone7Name(1, lang, thresholdSource),
      hr_min: Math.round(hrmax * 0.50),
      hr_max: t1LowerBound,
      rpe_min: 1,
      rpe_max: 3,
      description: getZone7Description(1, lang),
      confidence: zoneConfidence,
    },
    {
      zone: 2,
      name: getZone7Name(2, lang, thresholdSource),
      hr_min: t1LowerBound + 1,
      hr_max: z2Upper,
      rpe_min: 3,
      rpe_max: 4,
      description: getZone7Description(2, lang),
      confidence: zoneConfidence,
    },
    {
      zone: 3,
      name: getZone7Name(3, lang, thresholdSource),
      hr_min: z2Upper + 1,
      hr_max: z3Upper,
      rpe_min: 4,
      rpe_max: 5,
      description: getZone7Description(3, lang),
      confidence: zoneConfidence,
    },
    {
      zone: 4,
      name: getZone7Name(4, lang, thresholdSource),
      hr_min: lt1 + 1,
      hr_max: lt2,
      rpe_min: 5,
      rpe_max: 6,
      description: getZone7Description(4, lang),
      confidence: zoneConfidence,
    },
    {
      zone: 5,
      name: getZone7Name(5, lang, thresholdSource),
      hr_min: lt2 + 1,
      hr_max: null, // derived below
      rpe_min: 7,
      rpe_max: 8,
      description: getZone7Description(5, lang),
      confidence: zoneConfidence,
    },
    {
      zone: 6,
      name: getZone7Name(6, lang, thresholdSource),
      hr_min: null,
      hr_max: null,
      hr_label: getHRLabel(6, lang),
      rpe_min: 8,
      rpe_max: 9,
      description: getZone7Description(6, lang),
      confidence: vamPamConfidence,
    },
    {
      zone: 7,
      name: getZone7Name(7, lang, thresholdSource),
      hr_min: null,
      hr_max: null,
      hr_label: getHRLabel(7, lang),
      rpe_min: 9,
      rpe_max: 10,
      description: getZone7Description(7, lang),
      confidence: vamPamConfidence,
    },
  ];

  // ---- Power zones (cycling) ----
  if (hasPower && dataPoints) {
    const maxPower = Math.max(...dataPoints.map(p => p.power_watts ?? 0));
    const lt1Power = dataPoints.find(p => p.heart_rate >= lt1)?.power_watts ?? maxPower * 0.55;
    const lt2Power = dataPoints.find(p => p.heart_rate >= lt2)?.power_watts ?? maxPower * 0.75;

    // Z1: below 85% of LT1 power
    const t1PowerLower = Math.round(lt1Power * 0.85);
    const z2z3PowerRange = lt1Power - t1PowerLower;
    const z2PowerUpper = t1PowerLower + Math.round(z2z3PowerRange / 2);

    // Z5: LT2 to PAM
    const z5MaxPower = pamWatts ?? Math.round(lt2Power * 1.30);
    // Z6 & Z7: above PAM, split into two equal bands
    const z67PowerRange = Math.round(maxPower * 1.30) - z5MaxPower;
    const z6MaxPower = z5MaxPower + Math.round(z67PowerRange / 2);
    const z7MaxPower = z5MaxPower + z67PowerRange;

    zones[0].power_min = Math.round(maxPower * 0.35);
    zones[0].power_max = t1PowerLower;
    zones[1].power_min = t1PowerLower + 1;
    zones[1].power_max = z2PowerUpper;
    zones[2].power_min = z2PowerUpper + 1;
    zones[2].power_max = Math.round(lt1Power);
    zones[3].power_min = Math.round(lt1Power) + 1;
    zones[3].power_max = Math.round(lt2Power);
    zones[4].power_min = Math.round(lt2Power) + 1;
    zones[4].power_max = z5MaxPower;
    zones[5].power_min = z5MaxPower + 1;
    zones[5].power_max = z6MaxPower;
    zones[6].power_min = z6MaxPower + 1;
    zones[6].power_max = z7MaxPower;

    // Interpolate HR for Z5 using power as the driver
    const z5HR = interpolateHR(z5MaxPower, lt2Power, z5MaxPower, lt2, hrmax);
    zones[4].hr_max = z5HR;
    zones[5].hr_min = z5HR + 1;
  }

  // ---- Pace zones (running/swimming) ----
  if (hasPace && dataPoints) {
    const points = dataPoints.filter(p => p.speed_pace && p.speed_pace.trim() !== '');
    if (points.length >= 2) {
      const lt1PacePoint = points.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - lt1) < Math.abs(prev.heart_rate - lt1) ? curr : prev,
      );
      const lt2PacePoint = points.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - lt2) < Math.abs(prev.heart_rate - lt2) ? curr : prev,
      );

      const lt1Speed = lt1PacePoint.speed_pace ? paceToKmh(lt1PacePoint.speed_pace, sport) : null;
      const lt2Speed = lt2PacePoint.speed_pace ? paceToKmh(lt2PacePoint.speed_pace, sport) : null;

      if (lt1Speed && lt2Speed) {
        // Z1: below 85% of LT1 speed (slower = lower speed)
        const t1SpeedLower = lt1Speed * 0.85;
        const z2z3SpeedRange = lt1Speed - t1SpeedLower;
        const z2SpeedUpper = t1SpeedLower + z2z3SpeedRange / 2;

        // Z5: LT2 to VAM
        const vamSpeed = vamKmh ?? lt2Speed * 1.20;
        // Z6 & Z7: above VAM, split into two equal bands
        const z67SpeedRange = vamSpeed * 1.30 - vamSpeed;
        const z6SpeedUpper = vamSpeed + z67SpeedRange / 2;
        const z7SpeedUpper = vamSpeed + z67SpeedRange;

        // For running/swimming: pace_min = faster (higher speed = lower time), pace_max = slower
        zones[0].pace_min = null;
        zones[0].pace_max = kmhToPace(t1SpeedLower, sport);
        zones[1].pace_min = kmhToPace(z2SpeedUpper, sport);
        zones[1].pace_max = kmhToPace(t1SpeedLower, sport);
        zones[2].pace_min = kmhToPace(lt1Speed, sport);
        zones[2].pace_max = kmhToPace(z2SpeedUpper, sport);
        zones[3].pace_min = kmhToPace(lt2Speed, sport);
        zones[3].pace_max = kmhToPace(lt1Speed, sport);
        zones[4].pace_min = kmhToPace(vamSpeed, sport);
        zones[4].pace_max = kmhToPace(lt2Speed, sport);
        zones[5].pace_min = kmhToPace(z7SpeedUpper, sport);
        zones[5].pace_max = kmhToPace(vamSpeed, sport);
        zones[6].pace_min = kmhToPace(z7SpeedUpper * 1.0, sport);
        zones[6].pace_max = kmhToPace(z6SpeedUpper, sport);

        // Interpolate HR for Z5 using speed as the driver
        const z5HR = interpolateHR(vamSpeed, lt2Speed, vamSpeed, lt2, hrmax);
        zones[4].hr_max = z5HR;
        zones[5].hr_min = z5HR + 1;
      }
    }
  }

  // ---- HR-only fallback for Z5 (no power or pace) ----
  if (!hasPower && !hasPace) {
    const z5HR = Math.round(lt2 + (hrmax - lt2) * 0.25);
    zones[4].hr_max = z5HR;
    zones[5].hr_min = z5HR + 1;
  }

  // ---- Validate ranges (skip Z6/Z7 HR since they're intentionally null) ----
  for (const zone of zones) {
    if (zone.zone <= 5) {
      const hr = ensureValidRange(zone.hr_min, zone.hr_max);
      zone.hr_min = hr.min;
      zone.hr_max = hr.max;
    }

    if (zone.power_min != null && zone.power_max != null) {
      const pwr = ensureValidRange(zone.power_min, zone.power_max);
      zone.power_min = pwr.min;
      zone.power_max = pwr.max;
    }
  }

  return zones;
}

// ---- 5-zone collapse: group 7 zones into 5 ----
// Grouping: 5Z1 = 7Z1+7Z2, 5Z2 = 7Z3, 5Z3 = 7Z4, 5Z4 = 7Z5+7Z6, 5Z5 = 7Z7

export function convertTo5Zones(zones7: ZoneDefinition[], _sport: Sport, language?: Language): ZoneDefinition[] {
  const lang: Language = language ?? 'en';
  const z = (n: number) => zones7.find(zd => zd.zone === n)!;

  const hasPower = zones7.some(zone => zone.power_min != null);
  const hasPace = zones7.some(zone => zone.pace_min != null || zone.pace_max != null);

  const zones5: ZoneDefinition[] = [
    {
      zone: 1,
      name: getZone5Name(1, lang),
      hr_min: z(1).hr_min,
      hr_max: z(2).hr_max,
      rpe_min: 1,
      rpe_max: 4,
      description: getZone5Description(1, lang),
      confidence: z(1).confidence,
      ...(hasPower ? { power_min: z(1).power_min, power_max: z(2).power_max } : {}),
      ...(hasPace ? { pace_min: z(1).pace_min ?? z(2).pace_min, pace_max: z(2).pace_max } : {}),
    },
    {
      zone: 2,
      name: getZone5Name(2, lang),
      hr_min: z(3).hr_min,
      hr_max: z(3).hr_max,
      rpe_min: 4,
      rpe_max: 5,
      description: getZone5Description(2, lang),
      confidence: z(3).confidence,
      ...(hasPower ? { power_min: z(3).power_min, power_max: z(3).power_max } : {}),
      ...(hasPace ? { pace_min: z(3).pace_min, pace_max: z(3).pace_max } : {}),
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
      hr_max: z(6).hr_max,
      hr_label: z(6).hr_label,
      rpe_min: 7,
      rpe_max: 9,
      description: getZone5Description(4, lang),
      confidence: z(5).confidence,
      ...(hasPower ? { power_min: z(5).power_min, power_max: z(6).power_max } : {}),
      ...(hasPace ? { pace_min: z(5).pace_min, pace_max: z(6).pace_max } : {}),
    },
    {
      zone: 5,
      name: getZone5Name(5, lang),
      hr_min: z(7).hr_min,
      hr_max: z(7).hr_max,
      hr_label: z(7).hr_label,
      rpe_min: 9,
      rpe_max: 10,
      description: getZone5Description(5, lang),
      confidence: z(7).confidence,
      ...(hasPower ? { power_min: z(7).power_min, power_max: z(7).power_max } : {}),
      ...(hasPace ? { pace_min: z(7).pace_min, pace_max: z(7).pace_max } : {}),
    },
  ];

  return zones5;
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
