import { expect, it } from 'vitest';
import { createLactateDynamicsModel } from './lactateDynamics';
import { simulateSession } from './sessionSimulation';
const model = createLactateDynamicsModel({ vlamaxMmolLSecond: 0.4, vo2maxMlKgMin: 60, bodyMassKg: 70, distributionVolumeLPerKg: 0.5, baselineLactateMmol: 1, maxLoad: 400, lt1Load: 180, lt2Load: 260, loadUnit: 'W' });
const stages = [{ load: 100, vo2MlKgMin: 20, vco2MlKgMin: 16 }, { load: 300, vo2MlKgMin: 50, vco2MlKgMin: 45 }];
const blocks = [{ label: 'work', load: 300, durationSeconds: 180 }, { label: 'recovery', load: 100, durationSeconds: 180 }];
it('retains VO2 and lactate at the transition into recovery', () => {
  const x = simulateSession(model, stages, blocks); if ('error' in x) throw Error(x.error);
  const end = x.points.find(p => p.timeSeconds === 180)!, next = x.points.find(p => p.timeSeconds === 185)!;
  expect(next.vo2).toBeGreaterThan(20); expect(next.vo2).toBeLessThan(end.vo2); expect(next.lactate).toBeGreaterThan(model.input.baselineLactateMmol);
});
it('integrates positive fuel continuously across repetitions', () => {
  const x = simulateSession(model, stages, [...blocks, ...blocks]); if ('error' in x) throw Error(x.error);
  expect(x.points.at(-1)!.carbs).toBeGreaterThan(x.points.find(p => p.timeSeconds === 360)!.carbs);
  expect(x.points.every((p, i) => i === 0 || p.aerobicKcal >= x.points[i - 1].aerobicKcal)).toBe(true);
});
it('handles partial final steps without adding extra time', () => {
  const x = simulateSession(model, stages, [{ label: 'short', load: 200, durationSeconds: 13 }]); if ('error' in x) throw Error(x.error);
  expect(x.points.at(-1)!.timeSeconds).toBe(13);
});
it('rejects invalid and out-of-range segments', () => {
  expect(simulateSession(model, stages, [{ label: '', load: 401, durationSeconds: 10 }])).toEqual({ error: 'invalid_session' });
  expect(simulateSession(model, stages, [{ label: '', load: 100, durationSeconds: NaN }])).toEqual({ error: 'invalid_session' });
});
it('marks extrapolated RER as estimated', () => {
  const x = simulateSession(model, stages, [{ label: 'low', load: 50, durationSeconds: 10 }]); if ('error' in x) throw Error(x.error);
  expect(x.points[0].rerSource).toBe('estimated');
});

it('matches the analytic VO2 response and time-integrated fuel at a constant observed load', () => {
  const x = simulateSession(model, stages, [{ label: 'work', load: 300, durationSeconds: 180 }]);
  if ('error' in x) throw Error(x.error);
  const end = x.points.at(-1)!;
  const integralMlKg = 50 * 180 + (3.5 - 50) * 30 * (1 - Math.exp(-180 / 30));
  const oxygenLitres = integralMlKg * 70 / 1000 / 60;
  expect(end.vo2).toBeCloseTo(50 + (3.5 - 50) * Math.exp(-6), 8);
  expect(end.carbs).toBeCloseTo((4.585 * 0.9 - 3.226) * oxygenLitres, 8);
  expect(end.fat).toBeCloseTo((1.695 - 1.701 * 0.9) * oxygenLitres, 8);
  expect(x.points[0]).toMatchObject({ timeSeconds: 0, carbs: 0, fat: 0, aerobicKcal: 0 });
});
it('returns to resting oxygen uptake during passive recovery, not the first exercise stage', () => {
  const x = simulateSession(model, stages, [{ label: 'work', load: 300, durationSeconds: 180 }, { label: 'rest', load: 0, durationSeconds: 600 }]);
  if ('error' in x) throw Error(x.error);
  expect(x.points.at(-1)!.vo2).toBeCloseTo(3.5, 4);
});
it('does not invent valid fuels across invalid observed gases', () => {
  const x = simulateSession(model, [{ load: 100, vo2MlKgMin: 20, vco2MlKgMin: 16 }, { load: 300, vo2MlKgMin: 50, vco2MlKgMin: 60 }], [{ label: 'hard', load: 300, durationSeconds: 60 }]);
  if ('error' in x) throw Error(x.error);
  expect(x.points.at(-1)!).toMatchObject({ carbs: null, fat: null, aerobicKcal: null, rerSource: 'unavailable' });
});
it('does not reset state when the same load is split into blocks', () => {
  const a = simulateSession(model, stages, [{ label: 'a', load: 300, durationSeconds: 120 }]);
  const b = simulateSession(model, stages, [{ label: 'a', load: 300, durationSeconds: 60 }, { label: 'b', load: 300, durationSeconds: 60 }]);
  if ('error' in a || 'error' in b) throw Error('invalid');
  expect(a.points.at(-1)!.vo2).toBeCloseTo(b.points.at(-1)!.vo2, 10);
  expect(a.points.at(-1)!.carbs).toBeCloseTo(b.points.at(-1)!.carbs!, 10);
  expect(a.points.at(-1)!.lactate).toBe(b.points.at(-1)!.lactate);
});
