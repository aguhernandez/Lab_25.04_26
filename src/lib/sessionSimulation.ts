import { buildMetabolicDemandCurve, simulateLactateProtocol, type LactateDynamicsModel, type LactateProtocolSegment, type MetabolicDemandSample } from './lactateDynamics';
import { rerAtLoad, fuelFromGasExchange } from './metabolicFuel';

export interface SessionPoint { timeSeconds: number; label: string; load: number; vo2: number; lactate: number; carbs: number | null; fat: number | null; aerobicKcal: number | null; rerSource: 'measured' | 'estimated' | 'unavailable' }
export type SessionSimulation = { points: SessionPoint[]; demandSource: string } | { error: string };

/** Stateful scenario, using a single lactate trace and a first-order VO2 response. */
export function simulateSession(model: LactateDynamicsModel, samples: MetabolicDemandSample[], segments: LactateProtocolSegment[], tauSeconds = 30): SessionSimulation {
  if (!segments.length || segments.length > 48 || !Number.isFinite(tauSeconds) || tauSeconds <= 0 || segments.some(s => !Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0 || !Number.isFinite(s.load) || s.load < 0 || s.load > model.input.maxLoad) || segments.reduce((sum, s) => sum + s.durationSeconds, 0) > 6 * 3600 || ![model.input.bodyMassKg, model.input.vo2maxMlKgMin, model.input.maxLoad, model.input.distributionVolumeLPerKg, model.input.vlamaxMmolLSecond, model.parameters.bloodLagSeconds].every(v => Number.isFinite(v) && v > 0)) return { error: 'invalid_session' };
  if (!Number.isFinite(model.input.baselineLactateMmol) || model.input.baselineLactateMmol < 0) return { error: 'invalid_session' };
  const validSamples = samples.filter(s => Number.isFinite(s.load) && s.load >= 0 && s.load <= model.input.maxLoad);
  const loads = [...new Set(segments.map(s => s.load))];
  const demand = buildMetabolicDemandCurve(model, validSamples, 36000, 101, tauSeconds, loads);
  const lactateTrace = simulateLactateProtocol(model, segments, model.input.baselineLactateMmol, 5);
  let vo2 = Math.min(model.input.vo2maxMlKgMin, 3.5), carbs = 0, fat = 0, kcal = 0, lastTime = 0;
  let completeFuel = true;
  const points: SessionPoint[] = [{ timeSeconds: 0, label: segments[0].label, load: segments[0].load, vo2, lactate: model.input.baselineLactateMmol, carbs: 0, fat: 0, aerobicKcal: 0, rerSource: 'estimated' }];
  for (const point of lactateTrace) {
    const elapsed = point.timeSeconds - lastTime;
    const nearest = demand.points.reduce((best, p) => Math.abs(p.load - point.load) < Math.abs(best.load - point.load) ? p : best);
    const target = nearest.actualVo2MlKgMin;
    const response = Math.exp(-elapsed / tauSeconds);
    const meanVo2 = target + (vo2 - target) * (tauSeconds / elapsed) * (1 - response);
    vo2 = target + (vo2 - target) * response;
    const gas = rerAtLoad(validSamples, point.load, meanVo2 / model.input.vo2maxMlKgMin * 100);
    const vo2L = meanVo2 * model.input.bodyMassKg / 1000;
    const fuel = gas.rer == null ? null : fuelFromGasExchange(vo2L, vo2L * gas.rer);
    if (fuel) { carbs += fuel.carbohydrateGramsPerMin * elapsed / 60; fat += fuel.fatGramsPerMin * elapsed / 60; kcal = carbs * 4 + fat * 9; }
    else completeFuel = false;
    points.push({ timeSeconds: point.timeSeconds, label: point.label, load: point.load, vo2, lactate: point.bloodLactateMmol, carbs: completeFuel ? carbs : null, fat: completeFuel ? fat : null, aerobicKcal: completeFuel ? kcal : null, rerSource: gas.source });
    lastTime = point.timeSeconds;
  }
  return { points, demandSource: demand.demandSource };
}
