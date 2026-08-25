import * as XLSX from 'xlsx';
import type { BreathSample, DeviceProfile } from '../types/breathData.types';
import { VO2_MASTER_PROFILE } from '../types/breathData.types';
import type { TimelineSample } from '../types/timeline.types';

export type ColumnMapping = Record<string, keyof BreathSample>;

export function parseTimelineFile(
  file: File,
  mapping: ColumnMapping,
  offset_s: number = 0
): Promise<TimelineSample[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Empty file');
        let rows: Record<string, unknown>[] = [];
        const ext = file.name.split('.').pop()?.toLowerCase();

        if (ext === 'csv' || ext === 'txt') {
          const text = new TextDecoder().decode(data as ArrayBuffer);
          rows = parseDelimited(text);
        } else if (ext === 'fit') {
          throw new Error('FIT files require conversion to CSV first. Export from Garmin Connect or similar.');
        } else {
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
        }

        if (rows.length === 0) {
          reject(new Error('No data rows found in file'));
          return;
        }

        const samples = rows.map((row, idx) => mapToTimeline(row, mapping, offset_s, idx));
        resolve(samples);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseDelimited(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? null; });
    rows.push(row);
  }
  return rows;
}

function mapToTimeline(
  row: Record<string, unknown>,
  mapping: ColumnMapping,
  offset_s: number,
  idx: number
): TimelineSample {
  const raw: Record<string, number | string | null> = {};
  const breath: Partial<BreathSample> = {};

  for (const [fileCol, canonKey] of Object.entries(mapping)) {
    const val = findColumnValue(row, fileCol);
    if (val != null) {
      raw[fileCol] = typeof val === 'number' ? val : String(val);
      const num = Number(val);
      if (!isNaN(num)) (breath as any)[canonKey] = num;
    }
  }

  const time_s = breath.time_s ?? idx;
  const adjustedTime = Math.max(0, time_s + offset_s);

  return {
    id: crypto.randomUUID(),
    timestamp_s: adjustedTime,
    speed_pace: breath.speed_kmh != null ? `${breath.speed_kmh.toFixed(1)} km/h` : null,
    heart_rate: breath.hr_bpm ?? null,
    lactate: null,
    rpe: null,
    vo2_ml_kg_min: breath.vo2_rel_mlkgmin ?? null,
    raw_data: raw,
    source: 'imported',
    edited_fields: [],
  };
}

function findColumnValue(row: Record<string, unknown>, colName: string): unknown {
  if (row[colName] != null) return row[colName];
  const normalized = colName.toLowerCase().replace(/[\s_]/g, '');
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().replace(/[\s_]/g, '') === normalized) return row[key];
  }
  return null;
}

export function autoDetectMapping(
  headers: string[],
  profiles: DeviceProfile[]
): { profile: DeviceProfile | null; mapping: ColumnMapping } {
  let bestMatch: DeviceProfile | null = null;
  let bestScore = 0;
  for (const profile of profiles) {
    const score = scoreMappingMatch(headers, profile.column_mapping);
    if (score > bestScore) { bestScore = score; bestMatch = profile; }
  }
  if (bestMatch && bestScore >= 3) {
    return { profile: bestMatch, mapping: bestMatch.column_mapping };
  }
  return { profile: null, mapping: guessMapping(headers) };
}

function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const nh = headers.map((h) => h.toLowerCase().replace(/[\s_]/g, ''));
  headers.forEach((h, i) => {
    const n = nh[i];
    if (n.includes('time') || n === 't' || n.includes('tempo')) mapping[h] = 'time_s';
    else if (n.includes('hr') || n.includes('heart')) mapping[h] = 'hr_bpm';
    else if (n.includes('vo2') && n.includes('kg')) mapping[h] = 'vo2_rel_mlkgmin';
    else if (n.includes('vo2')) mapping[h] = 'vo2_abs_mlmin';
    else if (n.includes('speed') || n.includes('vel') || n.includes('pace') || n.includes('targetsp')) mapping[h] = 'speed_kmh';
    else if (n.includes('rf') || n.includes('resp')) mapping[h] = 'rf_bpm';
    else if (n.includes('tv') || n.includes('tidal')) mapping[h] = 'tv_l';
    else if (n.includes('ve') || n.includes('vent')) mapping[h] = 've_lmin';
    else if (n.includes('vco2')) mapping[h] = 'vco2_mlmin';
    else if (n.includes('rer')) mapping[h] = 'rer';
    else if (n.includes('eqo2') || n.includes('eqo')) mapping[h] = 'eqo2';
    else if (n.includes('feo2') || n.includes('feo')) mapping[h] = 'feo2_pct';
    else if (n.includes('hrv')) mapping[h] = 'hrv_ms';
    else if (n.includes('rr') && n.includes('ms')) mapping[h] = 'rr_ms';
  });
  return mapping;
}

function scoreMappingMatch(
  headers: string[],
  mapping: ColumnMapping
): number {
  let score = 0;
  const nh = headers.map((h) => h.toLowerCase().replace(/[\s_]/g, ''));
  for (const fileCol of Object.keys(mapping)) {
    if (nh.includes(fileCol.toLowerCase().replace(/[\s_]/g, ''))) score++;
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
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'csv' || ext === 'txt') {
          const text = new TextDecoder().decode(data as ArrayBuffer);
          const lines = text.split(/\r?\n/).filter((l) => l.trim());
          if (lines.length === 0) { reject(new Error('No rows')); return; }
          const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
          resolve(lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, '')));
          return;
        }
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        if (rows.length === 0) { reject(new Error('No rows')); return; }
        resolve((rows[0] as unknown[]).map((h) => String(h ?? '')));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function getDefaultProfiles(): DeviceProfile[] {
  return [{
    id: 'vo2-master-default',
    name: VO2_MASTER_PROFILE.name,
    column_mapping: VO2_MASTER_PROFILE.column_mapping,
    created_at: new Date().toISOString(),
  }];
}

export function getRawColumnKeys(samples: TimelineSample[]): string[] {
  const keys = new Set<string>();
  for (const s of samples) {
    for (const k of Object.keys(s.raw_data)) keys.add(k);
  }
  return Array.from(keys);
}

export const CANONICAL_FIELDS: Array<{ key: keyof BreathSample; label: string }> = [
  { key: 'time_s', label: 'Time (s)' },
  { key: 'speed_kmh', label: 'Speed (km/h)' },
  { key: 'hr_bpm', label: 'Heart Rate (bpm)' },
  { key: 'vo2_rel_mlkgmin', label: 'VO₂ relative (ml/kg/min)' },
  { key: 'vo2_abs_mlmin', label: 'VO₂ absolute (ml/min)' },
  { key: 'rf_bpm', label: 'Respiratory Frequency (bpm)' },
  { key: 'tv_l', label: 'Tidal Volume (L)' },
  { key: 've_lmin', label: 'Ventilation (L/min)' },
  { key: 'eqo2', label: 'EqO₂ (VE/VO₂)' },
  { key: 'feo2_pct', label: 'FeO₂ (%)' },
  { key: 'vco2_mlmin', label: 'VCO₂ (ml/min)' },
  { key: 'rer', label: 'RER' },
  { key: 'hrv_ms', label: 'HRV (ms)' },
  { key: 'rr_ms', label: 'RR (ms)' },
];
