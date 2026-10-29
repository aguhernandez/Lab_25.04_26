/** Shared non-protein gas-exchange calculation. Values outside the physiological
 * oxidation range are unavailable rather than silently clamped. */
export function fuelFromGasExchange(vo2LMin: number, vco2LMin: number) {
  if (![vo2LMin, vco2LMin].every(v => Number.isFinite(v) && v > 0)) return null;
  const rer = vco2LMin / vo2LMin;
  if (rer < 0.7 || rer > 1) return null;
  const fatGramsPerMin = Math.max(0, 1.695 * vo2LMin - 1.701 * vco2LMin);
  const carbohydrateGramsPerMin = Math.max(0, 4.585 * vco2LMin - 3.226 * vo2LMin);
  const fatKcal = fatGramsPerMin * 9;
  const carbohydrateKcal = carbohydrateGramsPerMin * 4;
  const total = fatKcal + carbohydrateKcal;
  return {
    rer, fatGramsPerMin, carbohydrateGramsPerMin,
    fatPercent: total > 0 ? fatKcal / total * 100 : 0,
    carbohydratePercent: total > 0 ? carbohydrateKcal / total * 100 : 0,
  };
}

/** Scenario estimate only; never relabel this as a measured RER. */
export function estimatedRerFromVo2Percent(percent: number): number | null {
  if (!Number.isFinite(percent) || percent < 0) return null;
  if (percent < 50) return 0.75 + Math.min(percent, 50) * 0.001;
  if (percent < 70) return 0.80 + (percent - 50) * 0.003;
  if (percent < 85) return 0.86 + (percent - 70) * 0.006;
  return Math.min(1, 0.95 + (percent - 85) * 0.003);
}

/** Interpolate paired gas ratios only inside their observed load range.
 * Invalid paired gases remain unavailable; they are never replaced by a scenario.
 * An interpolated RER is a scenario input, not a dynamic gas measurement. */
export function rerAtLoad(samples: Array<{ load: number; vo2MlKgMin?: number | null; vco2MlKgMin?: number | null }>, load: number, vo2Percent: number): { rer: number | null; source: 'measured' | 'estimated' | 'unavailable' } {
  const paired = samples.filter(s => Number.isFinite(s.load) && s.vo2MlKgMin != null && s.vco2MlKgMin != null).sort((a, b) => a.load - b.load);
  if (paired.length && load >= paired[0].load && load <= paired[paired.length - 1].load) {
    const index = paired.findIndex(s => s.load >= load);
    const upper = paired[index], lower = load === upper.load ? upper : paired[index - 1];
    if (paired.some((s, i) => i > 0 && s.load === paired[i - 1].load)) return { rer: null, source: 'unavailable' };
    const a = fuelFromGasExchange(lower.vo2MlKgMin!, lower.vco2MlKgMin!);
    const b = fuelFromGasExchange(upper.vo2MlKgMin!, upper.vco2MlKgMin!);
    if (!a || !b) return { rer: null, source: 'unavailable' };
    return { rer: a.rer + (b.rer - a.rer) * (upper.load === lower.load ? 0 : (load - lower.load) / (upper.load - lower.load)), source: 'measured' };
  }
  return { rer: estimatedRerFromVo2Percent(vo2Percent), source: 'estimated' };
}
