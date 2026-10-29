import type { Sport, TestDataPoint } from '../types';
import { paceToKmh } from './trainingZones';

export type ObjectiveKind = 'vo2_percent' | 'lactate';
export interface ObjectiveTemplate { name: string; kind: ObjectiveKind; minimum: number; maximum: number; durationSeconds: number; responseMode?: 'stage' | 'end_vo2'; tauSeconds?: number; initialVo2Percent?: number }
export type ObjectiveResult = { minLoad: number; maxLoad: number; unit: 'W' | 'km/h'; source: string } | { error: string };

/** Invert observed stages only. Ambiguous crossings and extrapolation are rejected. */
export function calculateObjectiveZone(points: TestDataPoint[], sport: Sport, vo2max: number | null, measuredVo2max: boolean, template: ObjectiveTemplate): ObjectiveResult {
  const { kind, minimum, maximum, durationSeconds } = template;
  if (!['vo2_percent', 'lactate'].includes(kind) || (template.responseMode != null && !['stage', 'end_vo2'].includes(template.responseMode))) return { error: 'invalid_target' };
  if (![minimum, maximum, durationSeconds].every(Number.isFinite) || minimum <= 0 || maximum < minimum || durationSeconds <= 0) return { error: 'invalid_target' };
  if (kind === 'vo2_percent' && (!(vo2max && Number.isFinite(vo2max) && vo2max > 0) || !measuredVo2max)) return { error: 'measured_vo2_required' };
  const cycling = sport === 'cycling' || sport.startsWith('cycling_');
  const observations = points.flatMap(p => {
    const load = cycling ? Number(p.power_watts) : paceToKmh(p.speed_pace ?? '', sport);
    const metric = kind === 'lactate' ? Number(p.lactate) : Number(p.vo2_ml_kg_min);
    const raw = kind === 'lactate' ? p.lactate : p.vo2_ml_kg_min;
    return raw != null && load != null && Number.isFinite(load) && load > 0 && Number.isFinite(metric) && metric > 0 ? [{ load, metric }] : [];
  }).sort((a, b) => a.load - b.load);
  if (observations.length < 2) return { error: 'insufficient_stages' };
  // Reject multiple crossings and flat target plateaus; unrelated noise elsewhere
  // does not invalidate a unique target crossing.
  const factor = kind === 'vo2_percent' ? vo2max! / 100 : 1;
  let lowTarget = minimum * factor, highTarget = maximum * factor;
  if (template.responseMode === 'end_vo2') {
    const tau = template.tauSeconds ?? 30, initialPercent = template.initialVo2Percent ?? 10;
    if (kind !== 'vo2_percent' || !Number.isFinite(tau) || tau <= 0 || !Number.isFinite(initialPercent) || initialPercent < 0 || initialPercent > 100) return { error: 'invalid_target' };
    const response = -Math.expm1(-durationSeconds / tau);
    const initial = initialPercent * vo2max! / 100;
    lowTarget = initial + (lowTarget - initial) / response;
    highTarget = initial + (highTarget - initial) / response;
    if (lowTarget > vo2max! || highTarget > vo2max!) return { error: 'unreachable_target' };
  }
  const low = invertObservedTarget(observations, lowTarget), high = invertObservedTarget(observations, highTarget);
  if (low == null || high == null) {
    const metrics = observations.map(p => p.metric);
    return { error: lowTarget < Math.min(...metrics) || highTarget > Math.max(...metrics) ? 'outside_observed_range' : 'ambiguous_curve' };
  }
  if (observations.some((b, i) => i > 0 && b.metric <= observations[i - 1].metric && Math.max(b.metric, lowTarget) <= Math.min(observations[i - 1].metric, highTarget))) return { error: 'ambiguous_curve' };
  if (low > high) return { error: 'ambiguous_curve' };
  return { minLoad: low, maxLoad: high, unit: cycling ? 'W' : 'km/h', source: template.responseMode === 'end_vo2' ? 'modeled_vo2_endpoint' : kind === 'vo2_percent' ? 'measured_vo2' : 'measured_lactate' };
}

/** Unique piecewise-linear inverse, with no extrapolation or sorting by response. */
export function invertObservedTarget(observations: Array<{ load: number; metric: number }>, target: number): number | null {
  if (!Number.isFinite(target)) return null;
  const rows = observations.filter(p => Number.isFinite(p.load) && Number.isFinite(p.metric)).sort((a, b) => a.load - b.load);
  if (rows.length < 2 || rows.some((p, i) => i > 0 && p.load === rows[i - 1].load)) return null;
  const roots: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (a.metric === b.metric) { if (target === a.metric) return null; continue; }
    if (target < Math.min(a.metric, b.metric) || target > Math.max(a.metric, b.metric)) continue;
    const root = a.load + (target - a.metric) / (b.metric - a.metric) * (b.load - a.load);
    if (!roots.some(x => Math.abs(x - root) < 1e-9)) roots.push(root);
  }
  return roots.length === 1 ? roots[0] : null;
}
