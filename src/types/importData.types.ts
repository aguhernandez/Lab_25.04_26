export type ImportFormat = 'csv' | 'tsv' | 'txt' | 'xlsx' | 'xls' | 'fit' | 'tcx' | 'manual';

export type CanonicalTimelineField =
  | 'time_s'
  | 'speed_kmh'
  | 'hr_bpm'
  | 'vo2_rel_mlkgmin'
  | 'vo2_abs_mlmin'
  | 'rf_bpm'
  | 'tv_l'
  | 've_lmin'
  | 'eqo2'
  | 'feo2_pct'
  | 'vco2_mlmin'
  | 'rer'
  | 'hrv_ms'
  | 'rr_ms'
  | 'power_watts'
  | 'distance_m'
  | 'latitude_deg'
  | 'longitude_deg'
  | 'cadence_rpm'
  | 'lactate_mmol'
  | 'rpe';

export interface DataImportMetadata {
  importId: string;
  format: ImportFormat;
  fileName: string;
  importedAt: string;
  source: 'file' | 'manual';
  deviceName: string | null;
  deviceProfileId: string | null;
  sampleFrequencyHz: number | null;
  units: Partial<Record<CanonicalTimelineField, string>>;
  calibrationDate: string | null;
  calibrationNotes: string | null;
  columnMapping: Record<string, CanonicalTimelineField>;
  transformations: string[];
  recordCount: number;
}

export interface SampleDataProvenance {
  importId: string;
  format: ImportFormat;
  fileName: string;
  sourceRow: number;
  sourceTimestamp: string | number | null;
  importedAt: string;
  source: 'file' | 'manual';
  deviceName: string | null;
  deviceProfileId: string | null;
  sampleFrequencyHz: number | null;
  units: Partial<Record<CanonicalTimelineField, string>>;
  calibrationDate: string | null;
  calibrationNotes: string | null;
  columnMapping: Record<string, CanonicalTimelineField>;
  transformations: string[];
}
