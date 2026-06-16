import { Sport } from '../types';

export interface ZoneDefinition {
  zone: number;
  name: string;
  hr_min: number;
  hr_max: number;
  power_min?: number | null;
  power_max?: number | null;
  pace_min?: string | null;
  pace_max?: string | null;
  rpe_min?: number | null;
  rpe_max?: number | null;
  description: string;
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

export function calculateZones7(
  lt1_hr: number | null,
  lt2_hr: number | null,
  hrmax: number,
  sport: Sport,
  dataPoints?: Array<{ heart_rate: number; power_watts?: number | null; speed_pace?: string | null }>,
): ZoneDefinition[] {
  const lt1 = lt1_hr ?? Math.round(hrmax * 0.72);
  const lt2 = lt2_hr ?? Math.round(hrmax * 0.87);
  const midLT = Math.round((lt1 + lt2) / 2);
  const hr90max = Math.round(hrmax * 0.90);

  const hasPower = !!dataPoints?.some(p => p.power_watts != null && p.power_watts > 0);
  const hasPace = !!dataPoints?.some(p => p.speed_pace && p.speed_pace.trim() !== '');

  const zones: ZoneDefinition[] = [
    {
      zone: 1,
      name: ZONE7_NAMES[1][sport],
      hr_min: Math.round(hrmax * 0.50),
      hr_max: Math.round(lt1 * 0.90),
      rpe_min: 1,
      rpe_max: 3,
      description: ZONE7_DESCRIPTIONS[1],
    },
    {
      zone: 2,
      name: ZONE7_NAMES[2][sport],
      hr_min: Math.round(lt1 * 0.90) + 1,
      hr_max: lt1,
      rpe_min: 3,
      rpe_max: 4,
      description: ZONE7_DESCRIPTIONS[2],
    },
    {
      zone: 3,
      name: ZONE7_NAMES[3][sport],
      hr_min: lt1 + 1,
      hr_max: midLT,
      rpe_min: 4,
      rpe_max: 5,
      description: ZONE7_DESCRIPTIONS[3],
    },
    {
      zone: 4,
      name: ZONE7_NAMES[4][sport],
      hr_min: midLT + 1,
      hr_max: lt2,
      rpe_min: 5,
      rpe_max: 6,
      description: ZONE7_DESCRIPTIONS[4],
    },
    {
      zone: 5,
      name: ZONE7_NAMES[5][sport],
      hr_min: lt2 + 1,
      hr_max: hr90max,
      rpe_min: 7,
      rpe_max: 8,
      description: ZONE7_DESCRIPTIONS[5],
    },
    {
      zone: 6,
      name: ZONE7_NAMES[6][sport],
      hr_min: hr90max + 1,
      hr_max: hrmax,
      rpe_min: 8,
      rpe_max: 9,
      description: ZONE7_DESCRIPTIONS[6],
    },
    {
      zone: 7,
      name: ZONE7_NAMES[7][sport],
      hr_min: hrmax + 1,
      hr_max: hrmax + 15,
      rpe_min: 9,
      rpe_max: 10,
      description: ZONE7_DESCRIPTIONS[7],
    },
  ];

  if (hasPower && dataPoints) {
    const maxPower = Math.max(...dataPoints.map(p => p.power_watts ?? 0));
    const lt1Power = dataPoints.find(p => p.heart_rate >= lt1)?.power_watts ?? maxPower * 0.55;
    const lt2Power = dataPoints.find(p => p.heart_rate >= lt2)?.power_watts ?? maxPower * 0.75;

    zones[0].power_min = Math.round(maxPower * 0.35);
    zones[0].power_max = Math.round(lt1Power * 0.85);
    zones[1].power_min = Math.round(lt1Power * 0.85) + 1;
    zones[1].power_max = Math.round(lt1Power * 0.97);
    zones[2].power_min = Math.round(lt1Power * 0.97) + 1;
    zones[2].power_max = Math.round((lt1Power + lt2Power) / 2 * 0.99);
    zones[3].power_min = Math.round((lt1Power + lt2Power) / 2 * 0.99) + 1;
    zones[3].power_max = Math.round(lt2Power * 1.00);
    zones[4].power_min = Math.round(lt2Power) + 1;
    zones[4].power_max = Math.round(lt2Power * 1.08);
    zones[5].power_min = Math.round(lt2Power * 1.08) + 1;
    zones[5].power_max = Math.round(maxPower * 1.05);
    zones[6].power_min = Math.round(maxPower * 1.05) + 1;
    zones[6].power_max = Math.round(maxPower * 1.30);
  }

  if (hasPace && dataPoints) {
    const points = dataPoints.filter(p => p.speed_pace && p.speed_pace.trim() !== '');
    if (points.length >= 2) {
      const lt1PacePoint = points.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - lt1) < Math.abs(prev.heart_rate - lt1) ? curr : prev
      );
      const lt2PacePoint = points.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - lt2) < Math.abs(prev.heart_rate - lt2) ? curr : prev
      );
      const lt1Pace = lt1PacePoint.speed_pace ?? null;
      const lt2Pace = lt2PacePoint.speed_pace ?? null;

      zones[0].pace_max = lt1Pace;
      zones[1].pace_min = lt1Pace;
      zones[1].pace_max = lt1Pace;
      zones[2].pace_min = lt1Pace;
      zones[2].pace_max = lt2Pace;
      zones[3].pace_min = lt2Pace;
      zones[3].pace_max = lt2Pace;
      zones[4].pace_min = lt2Pace;
    }
  }

  return zones;
}

export function convertTo5Zones(zones7: ZoneDefinition[], sport: Sport): ZoneDefinition[] {
  const z = (n: number) => zones7.find(z => z.zone === n)!;

  const hasPower = zones7.some(zone => zone.power_min != null);
  const hasPace = zones7.some(zone => zone.pace_min != null || zone.pace_max != null);

  const zones5: ZoneDefinition[] = [
    {
      zone: 1,
      name: ZONE5_NAMES[1][sport],
      hr_min: z(1).hr_min,
      hr_max: z(1).hr_max,
      rpe_min: 1,
      rpe_max: 3,
      description: ZONE5_DESCRIPTIONS[1],
      ...(hasPower ? { power_min: z(1).power_min, power_max: z(1).power_max } : {}),
      ...(hasPace ? { pace_max: z(1).pace_max } : {}),
    },
    {
      zone: 2,
      name: ZONE5_NAMES[2][sport],
      hr_min: z(2).hr_min,
      hr_max: z(3).hr_max,
      rpe_min: 3,
      rpe_max: 5,
      description: ZONE5_DESCRIPTIONS[2],
      ...(hasPower ? { power_min: z(2).power_min, power_max: z(3).power_max } : {}),
      ...(hasPace ? { pace_min: z(2).pace_min, pace_max: z(3).pace_max } : {}),
    },
    {
      zone: 3,
      name: ZONE5_NAMES[3][sport],
      hr_min: z(4).hr_min,
      hr_max: z(4).hr_max,
      rpe_min: 5,
      rpe_max: 6,
      description: ZONE5_DESCRIPTIONS[3],
      ...(hasPower ? { power_min: z(4).power_min, power_max: z(4).power_max } : {}),
      ...(hasPace ? { pace_min: z(4).pace_min, pace_max: z(4).pace_max } : {}),
    },
    {
      zone: 4,
      name: ZONE5_NAMES[4][sport],
      hr_min: z(5).hr_min,
      hr_max: z(5).hr_max,
      rpe_min: 7,
      rpe_max: 8,
      description: ZONE5_DESCRIPTIONS[4],
      ...(hasPower ? { power_min: z(5).power_min, power_max: z(5).power_max } : {}),
      ...(hasPace ? { pace_min: z(5).pace_min, pace_max: z(5).pace_max } : {}),
    },
    {
      zone: 5,
      name: ZONE5_NAMES[5][sport],
      hr_min: z(6).hr_min,
      hr_max: z(7).hr_max,
      rpe_min: 9,
      rpe_max: 10,
      description: ZONE5_DESCRIPTIONS[5],
      ...(hasPower ? { power_min: z(6).power_min, power_max: z(7).power_max } : {}),
      ...(hasPace ? { pace_min: z(6).pace_min } : {}),
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
): TrainingZonesData {
  const zones7 = calculateZones7(lt1_hr, lt2_hr, hrmax, sport, dataPoints);
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
