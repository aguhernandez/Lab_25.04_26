export type TimelineSource = 'manual' | 'imported';

export interface TimelineSample {
  id: string;
  timestamp_s: number;
  speed_pace: string | null;
  heart_rate: number | null;
  lactate: number | null;
  rpe: number | null;
  vo2_ml_kg_min: number | null;
  raw_data: Record<string, number | string | null>;
  source: TimelineSource;
  edited_fields: string[];
}

export interface ProtocolStep {
  step: number;
  label: string;
  speed_pace: string;
  target_duration_s: number;
  lactate_at_s: number | null;
}

export const DEFAULT_PROTOCOL: ProtocolStep[] = [
  { step: 1, label: 'Warm-up', speed_pace: '8:00/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 2, label: 'Stage 1', speed_pace: '6:00/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 3, label: 'Stage 2', speed_pace: '5:30/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 4, label: 'Stage 3', speed_pace: '5:00/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 5, label: 'Stage 4', speed_pace: '4:40/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 6, label: 'Stage 5', speed_pace: '4:20/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 7, label: 'Stage 6', speed_pace: '4:00/km', target_duration_s: 180, lactate_at_s: 170 },
  { step: 8, label: 'Stage 7', speed_pace: '3:40/km', target_duration_s: 180, lactate_at_s: 170 },
];

export const PRIMARY_COLUMNS = [
  { key: 'timestamp_s', label: 'Time', width: 64 },
  { key: 'speed_pace', label: 'Speed / Pace', width: 100 },
  { key: 'heart_rate', label: 'HR', width: 64 },
  { key: 'lactate', label: 'Lactate', width: 72 },
  { key: 'rpe', label: 'RPE', width: 56 },
  { key: 'vo2_ml_kg_min', label: 'VO₂ (ml/kg/min)', width: 100 },
] as const;

export const LACTATE_OFFSET_S = 15;
