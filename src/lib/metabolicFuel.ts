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
  if (percent < 50) return 0.75;
  if (percent < 70) return 0.80 + (percent - 50) * 0.003;
  if (percent < 85) return 0.85 + (percent - 70) * 0.004;
  return Math.min(1, 0.95 + (percent - 85) * 0.003);
}
