import * as XLSX from 'xlsx';
import type { BreathSample, DeviceProfile } from '../types/breathData.types';
import { VO2_MASTER_PROFILE } from '../types/breathData.types';

export function parseBreathFile(
  file: File,
  profile: DeviceProfile
): Promise<BreathSample[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Empty file');
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: true,
          defval: null,
        });
        if (rows.length === 0) {
          reject(new Error('No data rows found in file'));
          return;
        }
        const samples = rows.map((row) => mapRow(row, profile.column_mapping));
        resolve(samples);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function mapRow(
  row: Record<string, unknown>,
  mapping: Record<string, keyof BreathSample>
): BreathSample {
  const sample: BreathSample = {
    time_s: 0,
    speed_kmh: null,
    hr_bpm: null,
    vo2_rel_mlkgmin: null,
    vo2_abs_mlmin: null,
    rf_bpm: null,
    tv_l: null,
    ve_lmin: null,
    eqo2: null,
    feo2_pct: null,
    vco2_mlmin: null,
    rer: null,
    hrv_ms: null,
    rr_ms: null,
  };
  for (const [fileCol, canonKey] of Object.entries(mapping)) {
    const value = findColumnValue(row, fileCol);
    if (value != null && !isNaN(Number(value))) {
      (sample as any)[canonKey] = Number(value);
    }
  }
  return sample;
}

function findColumnValue(row: Record<string, unknown>, colName: string): unknown {
  if (row[colName] != null) return row[colName];
  const normalized = colName.toLowerCase().replace(/[\s_]/g, '');
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().replace(/[\s_]/g, '') === normalized) {
      return row[key];
    }
  }
  return null;
}

export function autoDetectProfile(
  headers: string[],
  profiles: DeviceProfile[]
): DeviceProfile | null {
  let bestMatch: DeviceProfile | null = null;
  let bestScore = 0;
  for (const profile of profiles) {
    const score = scoreProfileMatch(headers, profile.column_mapping);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = profile;
    }
  }
  return bestScore >= 3 ? bestMatch : null;
}

function scoreProfileMatch(
  headers: string[],
  mapping: Record<string, keyof BreathSample>
): number {
  let score = 0;
  const normalizedHeaders = headers.map((h) => h.toLowerCase().replace(/[\s_]/g, ''));
  for (const fileCol of Object.keys(mapping)) {
    const normalized = fileCol.toLowerCase().replace(/[\s_]/g, '');
    if (normalizedHeaders.includes(normalized)) score++;
  }
  return score;
}

export function extractHeaders(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Empty file');
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          raw: true,
          defval: null,
          header: 1,
        }) as unknown[][];
        if (rows.length === 0) {
          reject(new Error('No rows in file'));
          return;
        }
        const headerRow = rows[0];
        resolve(headerRow.map((h) => String(h ?? '')));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function hasCO2Data(profile: DeviceProfile): boolean {
  return (
    'vco2_mlmin' in profile.column_mapping ||
    Object.values(profile.column_mapping).includes('vco2_mlmin') ||
    Object.values(profile.column_mapping).includes('rer')
  );
}

export function getDefaultProfiles(): DeviceProfile[] {
  return [
    {
      id: 'vo2-master-default',
      name: VO2_MASTER_PROFILE.name,
      column_mapping: VO2_MASTER_PROFILE.column_mapping,
      created_at: new Date().toISOString(),
    },
  ];
}
