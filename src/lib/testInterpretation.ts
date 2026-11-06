import type { Sport, Test, TestDataPoint } from '../types';
import { paceToKmh } from './trainingZones';
import type { PhysiologyResults } from './physiology';
export type TestCalculationContext = { testType?: Test['test_type']; protocolId?: string | null; sport?: Sport; constantLoadVerified?: boolean; measuredVo2Peak?: number | null };
export const isIncremental = (c?: TestCalculationContext) => c?.testType === 'ramp' || c?.testType === 'step' || ['incremental_lactate','vo2_incremental'].includes(c?.protocolId ?? '');
export function loadForStage(p: TestDataPoint, sport: Sport): number | null {
  const v = sport === 'cycling' || sport.startsWith('cycling_') ? p.power_watts : p.speed_pace ? paceToKmh(p.speed_pace, sport) : null;
  return v != null && Number.isFinite(v) && v > 0 ? v : null;
}
/** Recovery remains in the chronological record; it never joins an incremental workload curve. */
export function incrementalWorkStages(points: TestDataPoint[], sport: Sport): TestDataPoint[] {
  const sorted = [...points].sort((a,b) => a.stage_number-b.stage_number);
  const result: TestDataPoint[] = []; let peak = 0;
  for (const p of sorted) {
    const load = loadForStage(p,sport); if (load == null) continue;
    if (peak > 0 && load < peak - Math.max(sport === 'cycling' ? 5 : 0.2, peak * 0.02)) break;
    result.push(p); peak = Math.max(peak,load);
  }
  return result;
}
export function sanitizeTestResults<T extends PhysiologyResults>(r: T, test: Pick<Test,'test_type'|'sport'|'protocol_id'>, points: TestDataPoint[]): T {
  const constant = test.test_type === 'steady_state' && points.length >= 2 && points.every(p => { const x=loadForStage(p,test.sport),ref=loadForStage(points[0],test.sport); return x != null && ref != null && Math.abs(x-ref)/ref<=0.03; });
  const copy = { ...r, hr_drift_percent: constant ? r.hr_drift_percent : null };
  if (copy.hr_drift_percent == null && r.metabolic_profile) copy.metabolic_profile = { ...r.metabolic_profile, durability: 'Not assessed' };
  for (const k of ['lt1_hr','lt2_hr','fatmax_hr','lt1_power','lt2_power','fatmax_power','vo2max'] as const) if (!(copy[k] != null && Number.isFinite(copy[k]) && copy[k]! > 0)) copy[k] = null;
  for (const k of ['lt1_pace','lt2_pace','fatmax_pace'] as const) if (copy[k] != null && !(paceToKmh(String(copy[k]),test.sport)! > 0)) copy[k] = null;
  return copy;
}
