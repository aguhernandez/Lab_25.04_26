import { expect, it } from 'vitest';
import { automaticZoneReference, calculateMethodZones } from './zoneMethods';
import { buildTrainingZonesData } from './trainingZones';
const test = { sport: 'cycling' as const, hrmax: 195, lt2_hr: 170, lt2_power: 260 };
it('produces both default zone sets from lactate thresholds without any VO2 input', () => {
  const data = buildTrainingZonesData(140, 170, 195, 'cycling', '5', undefined, { lt1_power: 180, lt2_power: 260 });
  expect(data.zones5).toHaveLength(5); expect(data.zones7).toHaveLength(7);
  expect(data.zones5[2].power_max).toBe(260);
});
it('prefills HR alternatives from LT2 while preserving their proxy status', () => {
  const ref = automaticZoneReference('friel_bike_hr', test);
  expect(ref).toEqual({ value: 170, source: 'test_lt2_hr', proxy: true });
  expect(calculateMethodZones('friel_bike_hr', { reference: ref.value!, sport: test.sport, hrmax: test.hrmax }).zones).toHaveLength(7);
});
it('prefills power alternatives from LT2 without claiming measured FTP', () => {
  expect(automaticZoneReference('coggan_power', test)).toEqual({ value: 260, source: 'test_lt2_power', proxy: true });
  expect(automaticZoneReference('hrmax', test)).toEqual({ value: 195, source: 'test_hrmax', proxy: false });
});
it('derives running and swimming threshold speeds from measured test paces', () => {
  expect(automaticZoneReference('threshold_speed', { sport: 'running', lt2_pace: '4:00/km' }).value).toBe(15);
  expect(automaticZoneReference('threshold_speed', { sport: 'swimming', lt2_pace: '1:30' }).value).toBe(4);
});
it('leaves missing or incompatible references unavailable instead of inventing values', () => {
  expect(automaticZoneReference('coggan_power', { sport: 'cycling' }).value).toBeNull();
  expect(automaticZoneReference('friel_run_hr', test).value).toBeNull();
  expect(automaticZoneReference('coggan_power', { ...test, lt2_power: Infinity }).value).toBeNull();
});
