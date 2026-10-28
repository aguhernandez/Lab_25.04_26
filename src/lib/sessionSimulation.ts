import { buildMetabolicDemandCurve, simulateLactateProtocol, type LactateDynamicsModel, type LactateProtocolSegment, type MetabolicDemandSample } from './lactateDynamics';
import { estimatedRerFromVo2Percent, fuelFromGasExchange } from './metabolicFuel';

export interface SessionPoint { timeSeconds: number; label: string; load: number; vo2: number; lactate: number; carbs: number; fat: number; aerobicKcal: number; rerSource: 'measured' | 'estimated' }
export type SessionSimulation = { points: SessionPoint[]; demandSource: string } | { error: string };

/** Stateful scenario, using a single lactate trace and a first-order VO2 response. */
export function simulateSession(model: LactateDynamicsModel, samples: MetabolicDemandSample[], segments: LactateProtocolSegment[], tauSeconds = 30): SessionSimulation {
  if (!segments.length || segments.length > 48 || !Number.isFinite(tauSeconds) || tauSeconds <= 0 || segments.some(s => !Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0 || !Number.isFinite(s.load) || s.load < 0 || s.load > model.input.maxLoad) || segments.reduce((sum, s) => sum + s.durationSeconds, 0) > 6 * 3600 || ![model.input.bodyMassKg, model.input.vo2maxMlKgMin, model.input.maxLoad].every(v => Number.isFinite(v) && v > 0)) return { error: 'invalid_session' };
  const validSamples = samples.filter(s => Number.isFinite(s.load) && s.load >= 0 && s.load <= model.input.maxLoad && (s.vo2MlKgMin == null || Number.isFinite(s.vo2MlKgMin)) && (s.vco2MlKgMin == null || Number.isFinite(s.vco2MlKgMin)));
  const demand = buildMetabolicDemandCurve(model, validSamples, 36000, 101, tauSeconds);
  const gas = validSamples.flatMap(s => {
    if (s.vo2MlKgMin == null || s.vco2MlKgMin == null || !Number.isFinite(s.load)) return [];
    const fuel = fuelFromGasExchange(s.vo2MlKgMin, s.vco2MlKgMin);
    return fuel ? [{ load: s.load, rer: fuel.rer }] : [];
  }).sort((a, b) => a.load - b.load);
  const lactateTrace = simulateLactateProtocol(model, segments, model.input.baselineLactateMmol, 5);
  let vo2 = Math.min(model.input.vo2maxMlKgMin, 3.5), carbs = 0, fat = 0, kcal = 0, lastTime = 0;
  const points: SessionPoint[] = [];
  for (const point of lactateTrace) {
    const elapsed = point.timeSeconds - lastTime;
    const nearest = demand.points.reduce((best, p) => Math.abs(p.load - point.load) < Math.abs(best.load - point.load) ? p : best);
    const target = nearest.actualVo2MlKgMin;
    const response = Math.exp(-elapsed / tauSeconds);
    const meanVo2 = target + (vo2 - target) * (tauSeconds / elapsed) * (1 - response);
    vo2 = target + (vo2 - target) * response;
    let rer: number | null = null;
    if (gas.length >= 2 && point.load >= gas[0].load && point.load <= gas[gas.length - 1].load) {
      const index = gas.findIndex(s => s.load >= point.load);
      if (index === 0) rer = gas[0].rer;
      else { const a = gas[index - 1], b = gas[index]; rer = b.load > a.load ? a.rer + (b.rer - a.rer) * (point.load - a.load) / (b.load - a.load) : null; }
    }
    const source = rer == null ? 'estimated' : 'measured';
    rer ??= estimatedRerFromVo2Percent(meanVo2 / model.input.vo2maxMlKgMin * 100);
    const vo2L = meanVo2 * model.input.bodyMassKg / 1000;
    const fuel = rer == null ? null : fuelFromGasExchange(vo2L, vo2L * rer);
    if (fuel) { carbs += fuel.carbohydrateGramsPerMin * elapsed / 60; fat += fuel.fatGramsPerMin * elapsed / 60; kcal = carbs * 4 + fat * 9; }
    points.push({ timeSeconds: point.timeSeconds, label: point.label, load: point.load, vo2, lactate: point.bloodLactateMmol, carbs, fat, aerobicKcal: kcal, rerSource: source });
    lastTime = point.timeSeconds;
  }
  return { points, demandSource: demand.demandSource };
}
