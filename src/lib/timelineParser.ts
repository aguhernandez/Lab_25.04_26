import * as XLSX from 'xlsx';
import type { BreathSample, DeviceProfile } from '../types/breathData.types';
import { VO2_MASTER_PROFILE } from '../types/breathData.types';
import type { TimelineSample } from '../types/timeline.types';

export function parseTimelineFile(
  file: File,
  profile: DeviceProfile,
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

        const samples = rows.map((row, idx) => mapToTimeline(row, profile.column_mapping, offset_s, idx));
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
  mapping: Record<string, keyof BreathSample>,
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

export function autoDetectProfile(
  headers: string[],
  profiles: DeviceProfile[]
): DeviceProfile | null {
  let bestMatch: DeviceProfile | null = null;
  let bestScore = 0;
  for (const profile of profiles) {
    const score = scoreProfileMatch(headers, profile.column_mapping);
    if (score > bestScore) { bestScore = score; bestMatch = profile; }
  }
  return bestScore >= 3 ? bestMatch : null;
}

function scoreProfileMatch(
  headers: string[],
  mapping: Record<string, keyof BreathSample>
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

export function hasCO2Data(profile: DeviceProfile): boolean {
  return Object.values(profile.column_mapping).includes('vco2_mlmin') ||
    Object.values(profile.column_mapping).includes('rer');
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
