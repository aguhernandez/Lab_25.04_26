import type { Sport, TestDataPoint } from '../types';
import { paceToKmh } from './trainingZones';

export type ObjectiveKind = 'vo2_percent' | 'lactate';
export interface ObjectiveTemplate { name: string; kind: ObjectiveKind; minimum: number; maximum: number; durationSeconds: number }
export type ObjectiveResult = { minLoad: number; maxLoad: number; unit: 'W' | 'km/h'; source: string } | { error: string };

/** Invert observed stages only. Ambiguous crossings and extrapolation are rejected. */
export function calculateObjectiveZone(points: TestDataPoint[], sport: Sport, vo2max: number | null, measuredVo2max: boolean, template: ObjectiveTemplate): ObjectiveResult {
  const { kind, minimum, maximum, durationSeconds } = template;
  if (![minimum, maximum, durationSeconds].every(Number.isFinite) || minimum <= 0 || maximum < minimum || durationSeconds <= 0) return { error: 'invalid_target' };
  if (kind === 'vo2_percent' && (!(vo2max && vo2max > 0) || !measuredVo2max)) return { error: 'measured_vo2_required' };
  const cycling = sport === 'cycling' || sport.startsWith('cycling_');
  const observations = points.flatMap(p => {
    const load = cycling ? Number(p.power_watts) : paceToKmh(p.speed_pace ?? '', sport);
    const metric = kind === 'lactate' ? Number(p.lactate) : Number(p.vo2_ml_kg_min);
    const raw = kind === 'lactate' ? p.lactate : p.vo2_ml_kg_min;
    return raw != null && load != null && Number.isFinite(load) && load > 0 && Number.isFinite(metric) && metric > 0 ? [{ load, metric }] : [];
  }).sort((a, b) => a.load - b.load);
  if (observations.length < 2) return { error: 'insufficient_stages' };
  if (observations.some((p, i) => i > 0 && (p.load <= observations[i - 1].load || p.metric <= observations[i - 1].metric))) return { error: 'ambiguous_curve' };
  const invert = (target: number): number | null => {
    if (target < observations[0].metric || target > observations[observations.length - 1].metric) return null;
    const i = observations.findIndex(p => p.metric >= target);
    if (i === 0) return observations[0].load;
    const a = observations[i - 1], b = observations[i];
    return a.load + (target - a.metric) / (b.metric - a.metric) * (b.load - a.load);
  };
  const factor = kind === 'vo2_percent' ? vo2max! / 100 : 1;
  const low = invert(minimum * factor), high = invert(maximum * factor);
  if (low == null || high == null) return { error: 'outside_observed_range' };
  return { minLoad: low, maxLoad: high, unit: cycling ? 'W' : 'km/h', source: kind === 'vo2_percent' ? 'measured_vo2' : 'measured_lactate' };
}
