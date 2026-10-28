import type { Sport, TestDataPoint } from '../types';
import { paceToKmh } from './trainingZones';

export type Measurement = 'heart_rate' | 'lactate' | 'vo2_ml_kg_min';
export function measuredAtLoad(points: TestDataPoint[], sport: Sport, unit: 'W' | 'km/h', target: number, metric: Measurement): number | null {
  if (!Number.isFinite(target) || target <= 0) return null;
  const rows = points.flatMap(p => {
    const load = unit === 'W' ? p.power_watts : p.speed_pace ? paceToKmh(p.speed_pace, sport) : null;
    const value = p[metric];
    return load != null && value != null && Number.isFinite(Number(load)) && Number(load) > 0 && Number.isFinite(Number(value)) && Number(value) > 0 ? [{ load: Number(load), value: Number(value) }] : [];
  }).sort((a, b) => a.load - b.load);
  if (!rows.length || rows.some((r, i) => i > 0 && r.load === rows[i - 1].load) || target < rows[0].load || target > rows[rows.length - 1].load) return null;
  const i = rows.findIndex(r => r.load >= target);
  if (i === 0) return rows[0].value;
  const a = rows[i - 1], b = rows[i];
  return a.value + (b.value - a.value) * (target - a.load) / (b.load - a.load);
}

/** Threshold is supplied by the operator from a comparable test–retest study. */
export function classifyDifference(delta: number, errorThreshold: number | null): 'unknown' | 'within' | 'exceeds' {
  if (!Number.isFinite(delta) || errorThreshold == null || !Number.isFinite(errorThreshold) || errorThreshold <= 0) return 'unknown';
  return Math.abs(delta) > errorThreshold ? 'exceeds' : 'within';
}
