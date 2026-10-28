import { describe, expect, it } from 'vitest';
import {
  createProtocolRunSettings,
  defaultProtocolForTestType,
  PROTOCOL_IDS,
  validateProtocolRun,
} from './protocolEngine';
import { mapFitRecordsToTimeline, parseDelimitedText, parseTcxFile } from './deviceImporters';
import type { TimelineSample } from '../types/timeline.types';

function sample(overrides: Partial<TimelineSample> = {}): TimelineSample {
  return {
    id: `sample-${overrides.timestamp_s ?? 0}`,
    timestamp_s: 0,
    speed_pace: null,
    heart_rate: null,
    lactate: null,
    rpe: null,
    vo2_ml_kg_min: null,
    raw_data: {},
    source: 'manual',
    edited_fields: [],
    ...overrides,
  };
}

describe('protocol engine and device importers', () => {
  it('catalogues supported protocol families and selects sensible defaults', () => {
    expect(PROTOCOL_IDS).toEqual([
      'incremental_lactate', 'vo2_incremental', 'mlss_constant', 'vlamax_sprint',
      'critical_power', 'time_trial_3min', 'time_trial_6min', 'time_trial_12min',
      'time_trial_20min', 'gps_running', 'combined',
    ]);
    expect(defaultProtocolForTestType('ramp')).toBe('vo2_incremental');
    expect(defaultProtocolForTestType('step')).toBe('incremental_lactate');
    expect(defaultProtocolForTestType('steady_state')).toBe('mlss_constant');
    expect(defaultProtocolForTestType('manual')).toBe('combined');
  });

  it('does not count null raw lactate as a measured incremental sample', () => {
    const timeline = [150, 160, 170].map((power, index) => sample({
      timestamp_s: index * 180,
      power_watts: power,
      raw_data: { lactate_mmol: null },
    }));
    const validation = validateProtocolRun({
      protocolId: 'incremental_lactate',
      settings: createProtocolRunSettings('incremental_lactate'),
      timelineSamples: timeline,
    });
    expect(validation.status).toBe('incomplete');
    expect(validation.errors).toContain('incremental_lactate_requires_three_load_and_lactate_samples');
  });

  it('requires MLSS duration, measured stable load, lactate samples, and verification', () => {
    const settings = {
      ...createProtocolRunSettings('mlss_constant'),
      targetDurationSeconds: 1800,
      constantLoadVerified: true,
      deviceName: 'Cycle ergometer',
      deviceCalibrationDate: '2026-01-01',
      samplingFrequencyHz: 1,
      environment: { temperatureC: 20, altitudeM: 0 },
    };
    const timeline = [
      sample({ timestamp_s: 0, power_watts: 220, lactate: 1.5 }),
      sample({ timestamp_s: 1800, power_watts: 220, lactate: 2.0 }),
    ];
    const valid = validateProtocolRun({ protocolId: 'mlss_constant', settings, timelineSamples: timeline });
    expect(valid.status).toBe('ready');

    const invalid = validateProtocolRun({
      protocolId: 'mlss_constant',
      settings: { ...settings, targetDurationSeconds: 1200, constantLoadVerified: false },
      timelineSamples: timeline.map((row) => ({ ...row, power_watts: null })),
    });
    expect(invalid.errors).toContain('mlss_trial_requires_at_least_30_minutes');
    expect(invalid.errors).toContain('mlss_constant_load_must_be_verified');
    expect(invalid.errors).toContain('mlss_requires_measured_constant_load');
  });

  it('parses quoted CSV fields, embedded newlines, and semicolon-delimited exports', () => {
    const rows = parseDelimitedText('Time[s];Power[W];Note\r\n0;200;"warm; up"\r\n1;210;"line one\nline two"', 'csv');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ 'Time[s]': '0', 'Power[W]': '200', Note: 'warm; up' });
    expect(rows[1].Note).toBe('line one\nline two');
  });

  it('normalizes FIT and TCX records while retaining device provenance', () => {
    const fit = mapFitRecordsToTimeline([
      { timestamp: new Date('2026-05-01T10:00:00Z'), enhancedSpeed: 10, distance: 0, heartRate: 120, power: 200 },
      { timestamp: new Date('2026-05-01T10:00:01Z'), enhancedSpeed: 10, distance: 10, heartRate: 125, power: 220 },
    ], 'ride.fit', 0, { deviceName: 'Garmin', sampleFrequencyHz: 1, calibrationDate: '2026-01-01' });
    expect(fit[1].speed_kmh).toBe(36);
    expect(fit[1].provenance?.units.power_watts).toBe('W');
    expect(fit[1].provenance?.deviceName).toBe('Garmin');
    expect(fit[1].provenance?.sampleFrequencyHz).toBe(1);

    const tcx = parseTcxFile(`<TrainingCenterDatabase><Activities><Activity><Lap><Track>
      <Trackpoint><Time>2026-05-01T10:00:00Z</Time><Position><LatitudeDegrees>-1.2</LatitudeDegrees><LongitudeDegrees>36.8</LongitudeDegrees></Position><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><Time>2026-05-01T10:00:10Z</Time><Position><LatitudeDegrees>-1.2</LatitudeDegrees><LongitudeDegrees>36.801</LongitudeDegrees></Position><DistanceMeters>100</DistanceMeters><HeartRateBpm><Value>140</Value></HeartRateBpm></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`, 'run.tcx', 0, { deviceName: 'Watch' });
    expect(tcx).toHaveLength(2);
    expect(tcx[1].speed_kmh).toBe(36);
    expect(tcx[1].provenance?.format).toBe('tcx');
    expect(tcx[1].latitude_deg).toBe(-1.2);
  });
});
