import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(), upsert: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { from: mocks.from }, hubClient: null }));
import { updateTrainingZonesManual } from './physiologyProfile';
import { calculateMethodZones } from './zoneMethods';
const zones = calculateMethodZones('coggan_power', { reference: 250, sport: 'cycling' }).zones;
beforeEach(() => {
  vi.clearAllMocks();
  const chain = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle, update: mocks.update, upsert: mocks.upsert };
  for (const fn of [mocks.from, mocks.select, mocks.eq, mocks.update, mocks.upsert]) fn.mockReturnValue(chain);
});
it('creates the first saved prescription with method provenance and history', async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { athlete_id: 'a' }, error: null });
  expect(await updateTrainingZonesManual('a', zones, 'coach')).toBe(true);
  const payload = mocks.upsert.mock.calls[0][0];
  expect(payload.power_zones).toEqual(zones); expect(payload.heart_rate_zones).toEqual([]);
  expect(payload.zone_history[0].zones_snapshot[0].calculation.reference).toBe(250);
});
it('preserves the independently prescribed HR/pace when power is changed', async () => {
  const hr = [{ zone: 1, hr_min: 100, hr_max: 120 }], pace = [{ zone: 1, pace_min: '5:00' }];
  mocks.maybeSingle.mockResolvedValueOnce({ data: { heart_rate_zones: hr, pace_zones: pace, zone_history: [{ date: 'old' }], locked_to_lab: false }, error: null }).mockResolvedValueOnce({ data: { athlete_id: 'a' }, error: null });
  expect(await updateTrainingZonesManual('a', zones, 'coach')).toBe(true);
  const payload = mocks.update.mock.calls[0][0];
  expect(payload.heart_rate_zones).toEqual(hr); expect(payload.pace_zones).toEqual(pace); expect(payload.zone_history).toHaveLength(2);
  expect(mocks.eq).toHaveBeenCalledWith('athlete_id', 'a');
});
it('refuses a locked prescription', async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: { locked_to_lab: true }, error: null });
  expect(await updateTrainingZonesManual('a', zones, 'athlete')).toBe(false); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.upsert).not.toHaveBeenCalled();
});
it('does not report a successful write when RLS returns no row', async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: { locked_to_lab: false }, error: null }).mockResolvedValueOnce({ data: null, error: null });
  expect(await updateTrainingZonesManual('a', zones, 'coach')).toBe(false);
});
it('does not report a successful write on database error', async () => {
  mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
  expect(await updateTrainingZonesManual('a', zones, 'coach')).toBe(false);
});
