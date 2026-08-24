export interface BreathSample {
  time_s: number;
  speed_kmh: number | null;
  hr_bpm: number | null;
  vo2_rel_mlkgmin: number | null;
  vo2_abs_mlmin: number | null;
  rf_bpm: number | null;
  tv_l: number | null;
  ve_lmin: number | null;
  eqo2: number | null;
  feo2_pct: number | null;
  vco2_mlmin: number | null;
  rer: number | null;
  hrv_ms: number | null;
  rr_ms: number | null;
}

export interface DeviceProfile {
  id: string;
  name: string;
  column_mapping: Record<string, keyof BreathSample>;
  created_at: string;
}

export interface DeviceProfileInput {
  name: string;
  column_mapping: Record<string, keyof BreathSample>;
}

export const CANONICAL_FIELDS: Array<{ key: keyof BreathSample; label: string; optional: boolean }> = [
  { key: 'time_s', label: 'Time (s)', optional: false },
  { key: 'speed_kmh', label: 'Speed (km/h)', optional: true },
  { key: 'hr_bpm', label: 'Heart Rate (bpm)', optional: false },
  { key: 'vo2_rel_mlkgmin', label: 'VO₂ relative (ml/kg/min)', optional: true },
  { key: 'vo2_abs_mlmin', label: 'VO₂ absolute (ml/min)', optional: true },
  { key: 'rf_bpm', label: 'Respiratory Frequency (bpm)', optional: true },
  { key: 'tv_l', label: 'Tidal Volume (L)', optional: true },
  { key: 've_lmin', label: 'Ventilation (L/min)', optional: true },
  { key: 'eqo2', label: 'EqO₂ (VE/VO₂)', optional: true },
  { key: 'feo2_pct', label: 'FeO₂ (%)', optional: true },
  { key: 'vco2_mlmin', label: 'VCO₂ (ml/min)', optional: true },
  { key: 'rer', label: 'RER', optional: true },
  { key: 'hrv_ms', label: 'HRV (ms)', optional: true },
  { key: 'rr_ms', label: 'RR (ms)', optional: true },
];

export const VO2_MASTER_PROFILE: DeviceProfileInput = {
  name: 'VO2 Master',
  column_mapping: {
    'Time[s]': 'time_s',
    'HR[bpm]': 'hr_bpm',
    'Rf[bpm]': 'rf_bpm',
    'Tv[L]': 'tv_l',
    'Ve[L/min]': 've_lmin',
    'EqO2': 'eqo2',
    'FeO2[%]': 'feo2_pct',
    'VO2[mL/kg/min]': 'vo2_rel_mlkgmin',
    'VO2[mL/min]': 'vo2_abs_mlmin',
    'HRV': 'hrv_ms',
    'RR[ms]': 'rr_ms',
    'Target Sp': 'speed_kmh',
  },
};
