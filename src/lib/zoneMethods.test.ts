import { expect, it } from 'vitest';
import { calculateMethodZones, formatZonePace } from './zoneMethods';
const run = { reference: 170, hrmax: 195, sport: 'running' as const };
it('implements sport-specific Friel LTHR with exact integer boundaries and native 5a/b/c labels', () => {
  const running = calculateMethodZones('friel_run_hr', run).zones;
  const cycling = calculateMethodZones('friel_bike_hr', { ...run, sport: 'cycling' }).zones;
  expect(running.map(z => z.hr_max)).toEqual([144, 152, 161, 169, 175, 180, 195]);
  expect(cycling[0].hr_max).toBe(137); expect(cycling[2].hr_max).toBe(159);
  expect(running.map(z => z.zone_label)).toEqual(['1', '2', '3', '4', '5a', '5b', '5c']);
  running.slice(1).forEach((z, i) => expect(z.hr_min).toBe(running[i].hr_max! + 1));
});
it('calculates Coggan power without inventing a sprint percentage and Coggan HR independently', () => {
  const power = calculateMethodZones('coggan_power', { reference: 250, sport: 'cycling' }).zones;
  expect(power.map(z => z.power_max ?? null)).toEqual([137, 187, 225, 262, 300, null, null]);
  expect(power[0].power_min).toBe(0); expect(power[5].power_min).toBe(301); expect(power[6].power_min).toBeUndefined(); expect(power[6].power_label).toBeTruthy();
  expect(power.every(z => z.hr_min === null && z.hr_max === null)).toBe(true);
  expect(calculateMethodZones('coggan_hr', { ...run, sport: 'cycling' }).zones.map(z => z.hr_max)).toEqual([115, 141, 159, 178, 195]);
});
it('distinguishes HRmax percentages from Karvonen using resting HR', () => {
  const input = { reference: 190, restingHR: 50, sport: 'running' as const };
  const max = calculateMethodZones('hrmax', input).zones, reserve = calculateMethodZones('karvonen', input).zones;
  expect(max[0].hr_min).toBe(95); expect(max[0].hr_max).toBe(114);
  expect(reserve[0].hr_min).toBe(120); expect(reserve[0].hr_max).toBe(134); expect(reserve[4].hr_max).toBe(190);
});
it('uses inverse speed for pace and the separate running-power bands', () => {
  const zones = calculateMethodZones('threshold_speed', { reference: 15, sport: 'running' }).zones;
  expect(zones[0].pace_min).toBe('5:00'); expect(zones[2].pace_min).toBe('4:00');
  expect(formatZonePace(zones[0], 'running')).toBe('≥ 5:00 /km'); expect(formatZonePace(zones[4], 'running')).toMatch(/^< /);
  expect(calculateMethodZones('running_power', { reference: 300, sport: 'running' }).zones.map(z => z.power_max)).toEqual([240, 270, 300, 345, 390]);
});
it('rejects missing, impossible and sport-incompatible references', () => {
  for (const reference of [0, -1, NaN, Infinity]) expect(calculateMethodZones('friel_run_hr', { ...run, reference }).error).toBeTruthy();
  expect(calculateMethodZones('karvonen', { ...run, restingHR: 170 }).error).toBeTruthy();
  expect(calculateMethodZones('friel_run_hr', { ...run, hrmax: 175 }).error).toBeTruthy();
  expect(calculateMethodZones('coggan_power', run).error).toBeTruthy();
});
