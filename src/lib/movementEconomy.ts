import type { MovementEconomy, Sport, TestDataPoint } from '../types';

const MIN_STEADY_STAGE_SECONDS = 120;
const MAX_SUBMAX_VO2_FRACTION = 0.85;

function positive(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseTimeMinutes(value: string, sport: 'running' | 'swimming'): number | null {
  const trimmed = value.trim().toLowerCase();
  const time = trimmed.match(/^(\d+):([0-5]\d)(?:\.([0-9]+))?/);
  if (!time) {
    if (sport !== 'running' || !/\d/.test(trimmed)) return null;
    const speed = Number(trimmed.replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(speed) && speed > 0 ? 60 / speed : null;
  }
  const minutes = Number(time[1]) + Number(`${time[2]}.${time[3] ?? '0'}`) / 60;
  return minutes > 0 ? minutes : null;
}

function speedKmh(value: string | null | undefined, sport: 'running' | 'swimming'): number | null {
  if (!value) return null;
  const time = parseTimeMinutes(value, sport);
  if (!time) return null;
  return sport === 'running' ? 60 / time : 6 / time; // swim pace is per 100 m
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function slope(points: Array<{ x: number; y: number }>): number | null {
  if (points.length < 2) return null;
  const xMean = mean(points.map(point => point.x))!;
  const yMean = mean(points.map(point => point.y))!;
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  if (denominator === 0) return null;
  return points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator;
}

function round(value: number | null, digits = 1): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function steadySubmaxPoints(points: TestDataPoint[], measuredVO2max: number | null): TestDataPoint[] {
  const vo2Values = points.map(point => positive(point.vo2_ml_kg_min)).filter((value): value is number => value != null);
  const referenceVO2 = positive(measuredVO2max) ?? (vo2Values.length ? Math.max(...vo2Values) : null);
  if (!referenceVO2) return [];
  return points.filter(point => {
    const vo2 = positive(point.vo2_ml_kg_min);
    return vo2 != null
      && point.duration_seconds >= MIN_STEADY_STAGE_SECONDS
      && vo2 / referenceVO2 <= MAX_SUBMAX_VO2_FRACTION;
  });
}

export function calculateMovementEconomy(
  points: TestDataPoint[],
  sport: Sport,
  bodyMassKg: number | null | undefined,
  leanMassKg: number | null | undefined,
  measuredVO2max: number | null | undefined,
): MovementEconomy {
  const sorted = [...points].sort((a, b) => a.stage_number - b.stage_number);
  const powerStages = steadySubmaxPoints(sorted, positive(measuredVO2max) ?? null)
    .filter(point => positive(point.power_watts) != null);
  const isCycling = sport === 'cycling' || (sport === 'triathlon' && sorted.some(point => positive(point.power_watts) != null));

  let wattsPerKgLbm: number | null = null;
  let cyclingVO2Per100W: number | null = null;
  let cyclingEfficiency: number | null = null;
  let efficiencyBasis: 'measured_rer' | 'oxygen_only_estimate' | null = null;
  let cyclingStageCount = 0;
  if (isCycling) {
    const peakPower = Math.max(...sorted.map(point => positive(point.power_watts) ?? 0));
    const leanMass = positive(leanMassKg);
    if (peakPower > 0 && leanMass) wattsPerKgLbm = round(peakPower / leanMass, 2);

    if (powerStages.length >= 2) {
      cyclingStageCount = powerStages.length;
      cyclingVO2Per100W = round(mean(powerStages.map(point => (point.vo2_ml_kg_min! / point.power_watts!) * 100)), 2);
      const mass = positive(bodyMassKg);
      if (mass) {
        const measuredRERStages = powerStages.filter(point => {
          const vo2 = positive(point.vo2_ml_kg_min);
          const vco2 = positive(point.vco2_ml_kg_min);
          if (!vo2 || !vco2) return false;
          const rer = vco2 / vo2;
          return rer >= 0.7 && rer <= 1.0;
        });
        const useMeasuredRER = measuredRERStages.length >= 2;
        const energyStages = useMeasuredRER ? measuredRERStages : powerStages;
        const efficiencies = energyStages.map(point => {
          const vo2LMin = (point.vo2_ml_kg_min! * mass) / 1000;
          let metabolicWatts: number;
          if (useMeasuredRER) {
            const vco2LMin = (point.vco2_ml_kg_min! * mass) / 1000;
            const kcalMin = (3.941 * vo2LMin) + (1.106 * vco2LMin);
            metabolicWatts = (kcalMin * 4184) / 60;
          } else {
            // Oxygen-only estimate using 20.9 kJ per litre O2; not a measured caloric equivalent.
            metabolicWatts = (vo2LMin * 20_900) / 60;
          }
          return metabolicWatts > 0 ? (point.power_watts! / metabolicWatts) * 100 : null;
        }).filter((value): value is number => value != null && Number.isFinite(value));
        cyclingEfficiency = round(mean(efficiencies));
        efficiencyBasis = useMeasuredRER ? 'measured_rer' : 'oxygen_only_estimate';
      }
    }
  }

  const hasSwimPace = sorted.some(point => /\/\s*100\s*m\b/i.test(point.speed_pace ?? ''));
  const isSwimming = sport === 'swimming' || (sport === 'triathlon' && !isCycling && hasSwimPace);
  const isRunning = sport === 'running' || (sport === 'triathlon' && !isSwimming && !isCycling);
  const locomotionSport = isSwimming ? 'swimming' : 'running';
  const locomotionStages = isSwimming || isRunning
    ? steadySubmaxPoints(sorted, positive(measuredVO2max) ?? null)
      .map(point => ({ point, speed: speedKmh(point.speed_pace, locomotionSport) }))
      .filter((entry): entry is { point: TestDataPoint; speed: number } => entry.speed != null && entry.speed > 0)
    : [];
  const validLocomotionStages = locomotionStages.length >= 2 ? locomotionStages : [];
  const demandSlope = round(slope(validLocomotionStages.map(({ point, speed }) => ({ x: speed, y: point.vo2_ml_kg_min! }))), 2);

  const runningCost = isRunning
    ? round(mean(validLocomotionStages.map(({ point, speed }) => (point.vo2_ml_kg_min! * 60) / speed)), 1)
    : null;
  const swimmingCost = isSwimming
    ? round(mean(validLocomotionStages.map(({ point, speed }) => (point.vo2_ml_kg_min! * 6) / speed)), 1)
    : null;

  return {
    cycling: {
      watts_per_kg_lbm: wattsPerKgLbm,
      efficiency_percent: cyclingEfficiency,
      vo2_ml_kg_min_per_100w: cyclingVO2Per100W,
      efficiency_basis: efficiencyBasis,
      valid_stage_count: cyclingStageCount,
    },
    running: {
      cost_per_km_ml_o2_kg: runningCost,
      vo2_slope_ml_kg_min_per_kmh: isRunning ? demandSlope : null,
      valid_stage_count: isRunning ? validLocomotionStages.length : 0,
    },
    swimming: {
      cost_per_100m_ml_o2_kg: swimmingCost,
      vo2_slope_ml_kg_min_per_kmh: isSwimming ? demandSlope : null,
      valid_stage_count: isSwimming ? validLocomotionStages.length : 0,
    },
  };
}
