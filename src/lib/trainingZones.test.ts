import { expect, it } from 'vitest';
import { calculateZones7, convertTo5Zones, kmhToPace, paceToKmh } from './trainingZones';
const options = { lt1_power: 180, lt2_power: 260, pam_watts: 340, lt1_speed_kmh: 12, lt2_speed_kmh: 15, vam_kmh: 18 };
it('uses exact threshold loads and contiguous integer power/HR ranges without HR above maximum', () => {
  const zones = calculateZones7(140, 170, 190, 'cycling', [{ heart_rate: 140, power_watts: 200 }, { heart_rate: 170, power_watts: 300 }], options);
  expect(zones[2].power_max).toBe(180); expect(zones[3].power_max).toBe(260);
  expect(zones[4].hr_max).toBe(190); expect(zones[5].hr_min).toBeNull(); expect(zones[6].hr_min).toBeNull();
  zones.slice(1).forEach((z, i) => expect(z.power_min).toBe(zones[i].power_max! + 1));
  expect(zones[6].power_max).toBeNull();
});
it('interpolates external loads instead of jumping to the next stage', () => {
  const zones = calculateZones7(140, 170, 190, 'cycling', [{ heart_rate: 130, power_watts: 100 }, { heart_rate: 150, power_watts: 200 }, { heart_rate: 180, power_watts: 320 }]);
  expect(zones[2].power_max).toBe(150); expect(zones[3].power_max).toBe(280);
});
it('keeps Z6/Z7 speed ranges disjoint and preserves their union when collapsing to five', () => {
  const seven = calculateZones7(140, 170, 190, 'running', undefined, options);
  expect(seven[5].speed_max_kmh).toBe(seven[6].speed_min_kmh);
  const five = convertTo5Zones(seven, 'running');
  expect(five).toHaveLength(5); expect(five[1].pace_min).toBe(seven[2].pace_min); expect(five[1].pace_max).toBe(seven[1].pace_max);
  expect(five[4].speed_min_kmh).toBe(18); expect(five[4].speed_max_kmh).toBeNull(); expect(five[4].pace_max).toBe('3:20');
});
it('rejects invalid references and nonphysiological collapses instead of swapping ranges', () => {
  for (const [a, b, max] of [[170, 140, 190], [140, 190, 190], [140, 170, NaN]]) expect(calculateZones7(a, b, max, 'cycling')).toEqual([]);
  expect(convertTo5Zones([], 'running')).toEqual([]);
  const other = calculateZones7(140, 170, 190, 'cycling');
  other[0].calculation!.method = 'friel_run_hr'; expect(convertTo5Zones(other, 'running')).toEqual([]);
});
it('parses swim paces without absorbing suffix digits and carries rounded seconds correctly', () => {
  expect(paceToKmh('1:30/100m', 'swimming')).toBe(4); expect(paceToKmh('1:30', 'swimming')).toBe(4);
  expect(paceToKmh('5:99/km', 'running')).toBeNull(); expect(kmhToPace(3600 / 299.9, 'running')).toBe('5:00');
});
