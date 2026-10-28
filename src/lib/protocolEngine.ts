import type { TestType } from '../types';
import type { BreathSample } from '../types/breathData.types';
import type { DataImportMetadata } from '../types/importData.types';
import type { TimelineSample } from '../types/timeline.types';

export const PROTOCOL_VERSION = '1.0';

export const PROTOCOL_IDS = [
  'incremental_lactate',
  'vo2_incremental',
  'mlss_constant',
  'vlamax_sprint',
  'critical_power',
  'time_trial_3min',
  'time_trial_6min',
  'time_trial_12min',
  'time_trial_20min',
  'gps_running',
  'combined',
] as const;

export type ProtocolId = typeof PROTOCOL_IDS[number];

export interface ProtocolDefinition {
  id: ProtocolId;
  label: string;
  description: string;
  testType: TestType;
  requiredChannels: string[];
  targetDurationSeconds?: number;
}

export const PROTOCOL_CATALOG: ProtocolDefinition[] = [
  { id: 'incremental_lactate', label: 'Incremental lactate', description: 'Progressive stages with lactate measured at a recorded point in each stage.', testType: 'step', requiredChannels: ['load', 'lactate'] },
  { id: 'vo2_incremental', label: 'Incremental VO₂', description: 'Progressive exercise with breath-by-breath or staged VO₂ data.', testType: 'ramp', requiredChannels: ['vo2'] },
  { id: 'mlss_constant', label: 'MLSS constant-load confirmation', description: 'Constant-load trial with lactate samples over at least 30 minutes.', testType: 'steady_state', requiredChannels: ['load', 'lactate'], targetDurationSeconds: 1800 },
  { id: 'vlamax_sprint', label: 'Sprint / VLamax', description: 'Maximum sprint with its duration and lactate sampling documented.', testType: 'manual', requiredChannels: ['power', 'lactate'] },
  { id: 'critical_power', label: 'Critical Power', description: 'Two or more maximal efforts with distinct durations and power.', testType: 'manual', requiredChannels: ['power'] },
  { id: 'time_trial_3min', label: '3-minute test', description: 'Maximal field effort over a fixed three-minute duration.', testType: 'manual', requiredChannels: ['load'], targetDurationSeconds: 180 },
  { id: 'time_trial_6min', label: '6-minute test', description: 'Maximal field effort over a fixed six-minute duration.', testType: 'manual', requiredChannels: ['load'], targetDurationSeconds: 360 },
  { id: 'time_trial_12min', label: '12-minute test', description: 'Maximal field effort over a fixed twelve-minute duration.', testType: 'manual', requiredChannels: ['load'], targetDurationSeconds: 720 },
  { id: 'time_trial_20min', label: '20-minute test', description: 'Maximal field effort over a fixed twenty-minute duration.', testType: 'manual', requiredChannels: ['load'], targetDurationSeconds: 1200 },
  { id: 'gps_running', label: 'GPS running test', description: 'Outdoor running test with timestamped GPS coordinates and pace.', testType: 'manual', requiredChannels: ['gps', 'speed'] },
  { id: 'combined', label: 'Combined protocol', description: 'Protocol combining multiple measurement systems or test blocks.', testType: 'manual', requiredChannels: ['two_channels'] },
];

export interface ProtocolRunSettings {
  protocolId: ProtocolId;
  version: string;
  stageDurationSeconds?: number | null;
  stageDurationsSeconds?: number[];
  restBetweenStagesSeconds?: number | null;
  lactateSamplingOffsetSeconds?: number | null;
  targetDurationSeconds?: number | null;
  effortDurationsSeconds?: number[];
  constantLoadVerified?: boolean;
  deviceName?: string | null;
  deviceCalibrationDate?: string | null;
  samplingFrequencyHz?: number | null;
  environment?: {
    temperatureC?: number | null;
    humidityPercent?: number | null;
    altitudeM?: number | null;
  };
  imports?: DataImportMetadata[];
  validation?: ProtocolValidationSummary;
}

export interface ProtocolValidationSummary {
  status: 'ready' | 'review' | 'incomplete';
  errors: string[];
  warnings: string[];
  measuredChannels: string[];
  sampleCount: number;
  validatedAt: string;
}

export interface ProtocolValidationInput {
  protocolId: ProtocolId;
  settings: ProtocolRunSettings;
  timelineSamples?: TimelineSample[];
  breathSamples?: BreathSample[];
}

export function protocolForId(id: ProtocolId | null | undefined): ProtocolDefinition | null {
  return PROTOCOL_CATALOG.find((protocol) => protocol.id === id) ?? null;
}

export function defaultProtocolForTestType(testType: TestType): ProtocolId {
  if (testType === 'manual') return 'combined';
  return PROTOCOL_CATALOG.find((protocol) => protocol.testType === testType)?.id ?? 'combined';
}

export function createProtocolRunSettings(
  protocolId: ProtocolId,
  overrides: Partial<ProtocolRunSettings> = {},
): ProtocolRunSettings {
  const definition = protocolForId(protocolId)!;
  return {
    protocolId,
    version: PROTOCOL_VERSION,
    targetDurationSeconds: definition.targetDurationSeconds ?? null,
    lactateSamplingOffsetSeconds: 15,
    constantLoadVerified: false,
    ...overrides,
  };
}

export function validateProtocolRun(input: ProtocolValidationInput): ProtocolValidationSummary {
  const definition = protocolForId(input.protocolId);
  const timeline = input.timelineSamples ?? [];
  const breath = input.breathSamples ?? [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const measuredChannels = new Set<string>();

  const hasTimeline = (read: (sample: TimelineSample) => boolean) => timeline.some(read);
  const hasBreath = (read: (sample: BreathSample) => boolean) => breath.some(read);
  const hasPower = hasTimeline((sample) => sample.power_watts != null || numericRawValue(sample.raw_data.power_watts));
  const hasSpeed = hasTimeline((sample) => sample.speed_pace != null || sample.speed_kmh != null);
  const hasLactate = hasTimeline((sample) => sample.lactate != null || numericRawValue(sample.raw_data.lactate_mmol));
  const hasVo2 = hasTimeline((sample) => sample.vo2_ml_kg_min != null) || hasBreath((sample) => sample.vo2_rel_mlkgmin != null || sample.vo2_abs_mlmin != null);
  const hasGps = hasTimeline((sample) => sample.latitude_deg != null && sample.longitude_deg != null);

  if (hasPower) measuredChannels.add('power');
  if (hasSpeed) measuredChannels.add('speed');
  if (hasLactate) measuredChannels.add('lactate');
  if (hasVo2) measuredChannels.add('vo2');
  if (hasGps) measuredChannels.add('gps');
  if (hasTimeline((sample) => sample.heart_rate != null) || hasBreath((sample) => sample.hr_bpm != null)) measuredChannels.add('heart_rate');
  if (hasBreath((sample) => sample.vco2_mlmin != null || sample.rer != null)) measuredChannels.add('gas_exchange');

  if (!definition) {
    errors.push('protocol_unknown');
  } else {
    switch (input.protocolId) {
      case 'incremental_lactate': {
        const loads = timeline.filter((sample) => sample.power_watts != null || sample.speed_pace != null || sample.speed_kmh != null);
        const lactateCount = timeline.filter((sample) => sample.lactate != null || numericRawValue(sample.raw_data.lactate_mmol)).length;
        const pairedSamples = timeline.filter((sample) =>
          (sample.power_watts != null || sample.speed_kmh != null || sample.speed_pace != null)
          && (sample.lactate != null || numericRawValue(sample.raw_data.lactate_mmol))
        );
        if (loads.length < 3 || lactateCount < 3 || pairedSamples.length < 3) errors.push('incremental_lactate_requires_three_load_and_lactate_samples');
        const numericLoads = [...loads]
          .sort((a, b) => a.timestamp_s - b.timestamp_s)
          .map((sample) => sample.power_watts ?? sample.speed_kmh ?? speedFromPace(sample.speed_pace))
          .filter((value): value is number => value != null && Number.isFinite(value));
        if (numericLoads.some((value, index) => index > 0 && value <= numericLoads[index - 1])) warnings.push('loads_are_not_strictly_increasing');
        if (!input.settings.stageDurationSeconds && !input.settings.stageDurationsSeconds?.length) warnings.push('stage_duration_not_recorded');
        if (input.settings.lactateSamplingOffsetSeconds == null) warnings.push('lactate_sampling_timing_not_recorded');
        break;
      }
      case 'vo2_incremental':
        if (timeline.filter((sample) => sample.vo2_ml_kg_min != null).length + breath.filter((sample) => sample.vo2_rel_mlkgmin != null || sample.vo2_abs_mlmin != null).length < 3) {
          errors.push('incremental_vo2_requires_at_least_three_vo2_samples');
        }
        break;
      case 'mlss_constant':
        if ((input.settings.targetDurationSeconds ?? 0) < 1800) errors.push('mlss_trial_requires_at_least_30_minutes');
        if (!input.settings.constantLoadVerified) errors.push('mlss_constant_load_must_be_verified');
        if (timeline.filter((sample) => sample.lactate != null).length < 2) errors.push('mlss_requires_multiple_lactate_samples');
        const mlssLoads = timeline
          .filter((sample) => sample.power_watts != null || sample.speed_kmh != null)
          .map((sample) => sample.power_watts ?? sample.speed_kmh!)
          .filter((value) => Number.isFinite(value) && value > 0);
        if (mlssLoads.length < 2) errors.push('mlss_requires_measured_constant_load');
        else {
          const averageLoad = mlssLoads.reduce((sum, value) => sum + value, 0) / mlssLoads.length;
          if ((Math.max(...mlssLoads) - Math.min(...mlssLoads)) / averageLoad > 0.05) warnings.push('mlss_load_varied_over_five_percent');
        }
        break;
      case 'vlamax_sprint':
        if (!(input.settings.targetDurationSeconds && input.settings.targetDurationSeconds > 0)) errors.push('sprint_duration_required');
        if (!hasPower) errors.push('sprint_power_required');
        if (timeline.filter((sample) => sample.lactate != null).length < 2) errors.push('sprint_requires_baseline_and_recovery_lactate');
        break;
      case 'critical_power': {
        const durations = [...new Set((input.settings.effortDurationsSeconds ?? []).filter((value) => Number.isFinite(value) && value > 0))];
        if (durations.length < 2) errors.push('critical_power_requires_two_distinct_effort_durations');
        const powerSamples = timeline.filter((sample) => sample.power_watts != null && sample.power_watts > 0);
        if (powerSamples.length < 2 || new Set(powerSamples.map((sample) => sample.timestamp_s)).size < 2) errors.push('critical_power_requires_measured_power');
        break;
      }
      case 'time_trial_3min':
      case 'time_trial_6min':
      case 'time_trial_12min':
      case 'time_trial_20min':
        if (input.settings.targetDurationSeconds !== definition.targetDurationSeconds) errors.push('fixed_time_trial_duration_mismatch');
        if (timeline.filter((sample) => sample.power_watts != null || sample.speed_kmh != null || sample.speed_pace != null).length < 2) {
          errors.push('time_trial_requires_multiple_power_or_speed_samples');
        }
        break;
      case 'gps_running':
        if (timeline.filter((sample) => sample.latitude_deg != null && sample.longitude_deg != null).length < 2) errors.push('gps_running_requires_multiple_gps_positions');
        if (!hasSpeed) warnings.push('gps_speed_not_available');
        break;
      case 'combined':
        if (measuredChannels.size < 2) errors.push('combined_protocol_requires_two_measurement_channels');
        break;
    }
  }

  if (!input.settings.deviceName) warnings.push('device_not_recorded');
  if (!input.settings.deviceCalibrationDate) warnings.push('device_calibration_not_recorded');
  if (!input.settings.samplingFrequencyHz && !input.settings.imports?.some((item) => item.sampleFrequencyHz != null)) warnings.push('sampling_frequency_not_recorded');
  if (input.settings.environment?.temperatureC == null && input.settings.environment?.altitudeM == null) warnings.push('environmental_conditions_incomplete');
  if (timeline.some((sample) => sample.source === 'imported' && !sample.provenance)) warnings.push('imported_samples_missing_provenance');
  if (timeline.some((sample) => sample.lactate != null && (sample.lactate < 0 || sample.lactate > 25))) warnings.push('lactate_value_outside_expected_range');
  if (timeline.some((sample) => sample.heart_rate != null && (sample.heart_rate <= 0 || sample.heart_rate > 240))) warnings.push('heart_rate_value_outside_expected_range');
  if (timeline.some((sample) => sample.power_watts != null && sample.power_watts < 0)) warnings.push('negative_power_value');
  if (timeline.some((sample) => sample.rpe != null && (sample.rpe < 1 || sample.rpe > 10))) warnings.push('rpe_outside_one_to_ten');
  const sortedTimestamps = timeline.map((sample) => sample.timestamp_s).sort((a, b) => a - b);
  if (sortedTimestamps.some((timestamp, index) => index > 0 && timestamp === sortedTimestamps[index - 1])) warnings.push('duplicate_sample_timestamps');
  if (input.settings.imports?.some((item) => Object.keys(item.units).length === 0)) warnings.push('import_units_not_recorded');

  const status: ProtocolValidationSummary['status'] = errors.length ? 'incomplete' : warnings.length ? 'review' : 'ready';
  return {
    status,
    errors,
    warnings,
    measuredChannels: [...measuredChannels],
    sampleCount: Math.max(timeline.length, breath.length),
    validatedAt: new Date().toISOString(),
  };
}

function numericRawValue(value: unknown): boolean {
  return value != null && value !== '' && Number.isFinite(Number(value));
}

function speedFromPace(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?:\.\d+)?\s*(?:\/\s*km|per\s*km|\/km)?$/i);
  if (!match) {
    const numeric = Number(value.replace(/[^\d.+-]/g, ''));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
  const minutesPerKm = Number(match[1]) + Number(match[2]) / 60;
  return minutesPerKm > 0 ? 60 / minutesPerKm : null;
}
