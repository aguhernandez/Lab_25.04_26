import { Sport } from '../types';

export type ZoneConfidence = 'measured' | 'estimated' | 'inferred';

export interface ZoneDefinition {
  zone: number;
  name: string;
  hr_min: number | null;
  hr_max: number | null;
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
}

export interface TrainingZonesData {
  baseMethod: 'LT1_LT2_physiological';
  zones7: ZoneDefinition[];
  zones5: ZoneDefinition[];
  defaultDisplay: '5' | '7';
}

export type ZoneDisplayMode = '5' | '7';

const ZONE7_NAMES: Record<number, Record<Sport, string>> = {
  1: { cycling: 'Active Recovery', running: 'Easy', triathlon: 'Recovery', swimming: 'Easy', other: 'Recovery' },
  2: { cycling: 'Endurance Base', running: 'Aerobic Base', triathlon: 'Endurance', swimming: 'Aerobic', other: 'Endurance' },
  3: { cycling: 'Aerobic', running: 'Aerobic', triathlon: 'Aerobic', swimming: 'Aerobic', other: 'Aerobic' },
  4: { cycling: 'Tempo', running: 'Tempo', triathlon: 'Tempo', swimming: 'Tempo', other: 'Tempo' },
  5: { cycling: 'Threshold', running: 'Threshold', triathlon: 'Threshold', swimming: 'Threshold', other: 'Threshold' },
  6: { cycling: 'VO2max', running: 'VO2max', triathlon: 'VO2max', swimming: 'VO2max', other: 'VO2max' },
  7: { cycling: 'Neuromuscular', running: 'Speed', triathlon: 'Anaerobic', swimming: 'Sprint', other: 'Anaerobic' },
};

const ZONE7_DESCRIPTIONS: Record<number, string> = {
  1: 'Active recovery, very light effort below aerobic threshold',
  2: 'Base aerobic development, fat oxidation predominates',
  3: 'Aerobic endurance, sustainable long efforts',
  4: 'Tempo, moderate-high intensity between LT1 and LT2',
  5: 'Lactate threshold, sustained high-intensity work',
  6: 'VO2max stimulus, high cardiac demand',
  7: 'Neuromuscular power, anaerobic and sprint efforts',
};

const ZONE5_NAMES: Record<number, Record<Sport, string>> = {
  1: { cycling: 'Active Recovery', running: 'Easy', triathlon: 'Recovery', swimming: 'Easy', other: 'Recovery' },
  2: { cycling: 'Endurance', running: 'Aerobic', triathlon: 'Endurance', swimming: 'Aerobic', other: 'Endurance' },
  3: { cycling: 'Tempo', running: 'Tempo', triathlon: 'Tempo', swimming: 'Threshold', other: 'Tempo' },
  4: { cycling: 'Threshold', running: 'Threshold', triathlon: 'Threshold', swimming: 'VO2max', other: 'Threshold' },
  5: { cycling: 'VO2max / Anaerobic', running: 'VO2max / Speed', triathlon: 'VO2max', swimming: 'Sprint', other: 'VO2max' },
};

const ZONE5_DESCRIPTIONS: Record<number, string> = {
  1: 'Recovery and very easy aerobic work',
  2: 'Aerobic base and endurance development',
  3: 'Tempo and sustainable pace work',
  4: 'Lactate threshold training',
  5: 'VO2max, anaerobic capacity and sprint efforts',
};

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
  const lt1 = lt1_hr ?? Math.round(hrmax * 0.72);
  const lt2 = lt2_hr ?? Math.round(hrmax * 0.87);
  const midLT = Math.round((lt1 + lt2) / 2);
  const thresholdConfidence = options?.threshold_confidence ?? 'estimated';

  const hasPower = !!dataPoints?.some(p => p.power_watts != null && p.power_watts > 0);
  const hasPace = !!dataPoints?.some(p => p.speed_pace && p.speed_pace.trim() !== '');

  // Resolve VAM/PAM
  let vamKmh: number | null = options?.vam_kmh ?? null;
  let pamWatts: number | null = options?.pam_watts ?? null;
  let vamPamConfidence: ZoneConfidence = 'measured';

  // If not provided, try to derive from data points
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

  // Build base HR zones (Z1-Z4 unchanged, Z5-Z7 derived)
  const zones: ZoneDefinition[] = [
    {
      zone: 1,
      name: ZONE7_NAMES[1][sport],
      hr_min: Math.round(hrmax * 0.50),
      hr_max: Math.round(lt1 * 0.90),
      rpe_min: 1,
      rpe_max: 3,
      description: ZONE7_DESCRIPTIONS[1],
      confidence: zoneConfidence,
    },
    {
      zone: 2,
      name: ZONE7_NAMES[2][sport],
      hr_min: Math.round(lt1 * 0.90) + 1,
      hr_max: lt1,
      rpe_min: 3,
      rpe_max: 4,
      description: ZONE7_DESCRIPTIONS[2],
      confidence: zoneConfidence,
    },
    {
      zone: 3,
      name: ZONE7_NAMES[3][sport],
      hr_min: lt1 + 1,
      hr_max: midLT,
      rpe_min: 4,
      rpe_max: 5,
      description: ZONE7_DESCRIPTIONS[3],
      confidence: zoneConfidence,
    },
    {
      zone: 4,
      name: ZONE7_NAMES[4][sport],
      hr_min: midLT + 1,
      hr_max: lt2,
      rpe_min: 5,
      rpe_max: 6,
      description: ZONE7_DESCRIPTIONS[4],
      confidence: zoneConfidence,
    },
    {
      zone: 5,
      name: ZONE7_NAMES[5][sport],
      hr_min: lt2 + 1,
      hr_max: null, // derived below
      rpe_min: 7,
      rpe_max: 8,
      description: ZONE7_DESCRIPTIONS[5],
      confidence: zoneConfidence,
    },
    {
      zone: 6,
      name: ZONE7_NAMES[6][sport],
      hr_min: null, // derived below
      hr_max: hrmax,
      rpe_min: 8,
      rpe_max: 9,
      description: ZONE7_DESCRIPTIONS[6],
      confidence: vamPamConfidence,
    },
    {
      zone: 7,
      name: ZONE7_NAMES[7][sport],
      hr_min: null,
      hr_max: null,
      rpe_min: 9,
      rpe_max: 10,
      description: ZONE7_DESCRIPTIONS[7],
      confidence: vamPamConfidence,
    },
  ];

  // ---- Power zones (cycling) ----
  if (hasPower && dataPoints) {
    const maxPower = Math.max(...dataPoints.map(p => p.power_watts ?? 0));
    const lt1Power = dataPoints.find(p => p.heart_rate >= lt1)?.power_watts ?? maxPower * 0.55;
    const lt2Power = dataPoints.find(p => p.heart_rate >= lt2)?.power_watts ?? maxPower * 0.75;
    const midPower = (lt1Power + lt2Power) / 2;

    const z5MaxPower = Math.round(lt2Power * 1.05);
    const z6MaxPower = pamWatts ?? Math.round(lt2Power * 1.30);
    const z7MinPower = Math.round(z6MaxPower * 1.05);
    const z7MaxPower = Math.round(z6MaxPower * 1.30);

    zones[0].power_min = Math.round(maxPower * 0.35);
    zones[0].power_max = Math.round(lt1Power * 0.90);
    zones[1].power_min = Math.round(lt1Power * 0.90) + 1;
    zones[1].power_max = Math.round(lt1Power);
    zones[2].power_min = Math.round(lt1Power) + 1;
    zones[2].power_max = Math.round(midPower);
    zones[3].power_min = Math.round(midPower) + 1;
    zones[3].power_max = Math.round(lt2Power);
    zones[4].power_min = Math.round(lt2Power) + 1;
    zones[4].power_max = z5MaxPower;
    zones[5].power_min = z5MaxPower + 1;
    zones[5].power_max = z6MaxPower;
    zones[6].power_min = z7MinPower;
    zones[6].power_max = z7MaxPower;

    // Interpolate HR for Z5 and Z6 using power as the driver
    const z5HR = interpolateHR(z5MaxPower, lt2Power, z6MaxPower, lt2, hrmax);
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
        const midSpeed = (lt1Speed + lt2Speed) / 2;
        const z1MaxSpeed = lt1Speed * 0.90;

        // For running/swimming, pace_min = faster (lower time), pace_max = slower (higher time)
        zones[0].pace_min = null;
        zones[0].pace_max = kmhToPace(z1MaxSpeed, sport); // slowest in zone (90% LT1 speed)
        zones[1].pace_min = kmhToPace(lt1Speed, sport); // fastest in zone (LT1 speed)
        zones[1].pace_max = kmhToPace(z1MaxSpeed, sport); // slowest in zone
        zones[2].pace_min = kmhToPace(midSpeed, sport); // fastest (closer to LT1)
        zones[2].pace_max = kmhToPace(lt1Speed, sport); // slowest (at LT1)
        zones[3].pace_min = kmhToPace(lt2Speed, sport); // fastest (at LT2)
        zones[3].pace_max = kmhToPace(midSpeed, sport); // slowest (closer to LT1)

        // Z5-Z7 pace
        const z5MaxSpeed = lt2Speed * 1.05;
        const vamSpeed = vamKmh ?? lt2Speed * 1.20;
        const z7MinSpeed = vamSpeed * 1.05;
        const z7MaxSpeed = vamSpeed * 1.30;

        zones[4].pace_min = kmhToPace(z5MaxSpeed, sport); // fastest (105% LT2)
        zones[4].pace_max = kmhToPace(lt2Speed, sport); // slowest (at LT2)
        zones[5].pace_min = kmhToPace(vamSpeed, sport); // fastest (VAM)
        zones[5].pace_max = kmhToPace(z5MaxSpeed, sport); // slowest (105% LT2)
        zones[6].pace_min = kmhToPace(z7MaxSpeed, sport); // fastest (130% VAM)
        zones[6].pace_max = kmhToPace(z7MinSpeed, sport); // slowest (105% VAM)

        // Interpolate HR for Z5 and Z6 using speed as the driver
        const z5HR = interpolateHR(z5MaxSpeed, lt2Speed, vamSpeed, lt2, hrmax);
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

  // ---- Validate all ranges ----
  for (const zone of zones) {
    const hr = ensureValidRange(zone.hr_min, zone.hr_max);
    zone.hr_min = hr.min;
    zone.hr_max = hr.max;

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

export function convertTo5Zones(zones7: ZoneDefinition[], sport: Sport): ZoneDefinition[] {
  const z = (n: number) => zones7.find(zd => zd.zone === n)!;

  const hasPower = zones7.some(zone => zone.power_min != null);
  const hasPace = zones7.some(zone => zone.pace_min != null || zone.pace_max != null);

  const zones5: ZoneDefinition[] = [
    {
      zone: 1,
      name: ZONE5_NAMES[1][sport],
      hr_min: z(1).hr_min,
      hr_max: z(2).hr_max,
      rpe_min: 1,
      rpe_max: 4,
      description: ZONE5_DESCRIPTIONS[1],
      confidence: z(1).confidence,
      ...(hasPower ? { power_min: z(1).power_min, power_max: z(2).power_max } : {}),
      ...(hasPace ? { pace_min: z(1).pace_min ?? z(2).pace_min, pace_max: z(2).pace_max } : {}),
    },
    {
      zone: 2,
      name: ZONE5_NAMES[2][sport],
      hr_min: z(3).hr_min,
      hr_max: z(3).hr_max,
      rpe_min: 4,
      rpe_max: 5,
      description: ZONE5_DESCRIPTIONS[2],
      confidence: z(3).confidence,
      ...(hasPower ? { power_min: z(3).power_min, power_max: z(3).power_max } : {}),
      ...(hasPace ? { pace_min: z(3).pace_min, pace_max: z(3).pace_max } : {}),
    },
    {
      zone: 3,
      name: ZONE5_NAMES[3][sport],
      hr_min: z(4).hr_min,
      hr_max: z(4).hr_max,
      rpe_min: 5,
      rpe_max: 6,
      description: ZONE5_DESCRIPTIONS[3],
      confidence: z(4).confidence,
      ...(hasPower ? { power_min: z(4).power_min, power_max: z(4).power_max } : {}),
      ...(hasPace ? { pace_min: z(4).pace_min, pace_max: z(4).pace_max } : {}),
    },
    {
      zone: 4,
      name: ZONE5_NAMES[4][sport],
      hr_min: z(5).hr_min,
      hr_max: z(6).hr_max,
      rpe_min: 7,
      rpe_max: 9,
      description: ZONE5_DESCRIPTIONS[4],
      confidence: z(5).confidence,
      ...(hasPower ? { power_min: z(5).power_min, power_max: z(6).power_max } : {}),
      ...(hasPace ? { pace_min: z(5).pace_min, pace_max: z(6).pace_max } : {}),
    },
    {
      zone: 5,
      name: ZONE5_NAMES[5][sport],
      hr_min: z(7).hr_min,
      hr_max: z(7).hr_max,
      rpe_min: 9,
      rpe_max: 10,
      description: ZONE5_DESCRIPTIONS[5],
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
  const zones5 = convertTo5Zones(zones7, sport);

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
