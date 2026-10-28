import * as XLSX from 'xlsx';
import type { DeviceProfile } from '../types/breathData.types';
import type { CanonicalTimelineField, DataImportMetadata, ImportFormat, SampleDataProvenance } from '../types/importData.types';
import type { TimelineSample } from '../types/timeline.types';

export type ColumnMapping = Record<string, CanonicalTimelineField>;

export interface ImportOptions {
  deviceName?: string;
  deviceProfileId?: string | null;
  calibrationDate?: string | null;
  calibrationNotes?: string | null;
  sampleFrequencyHz?: number | null;
}

export const CANONICAL_FIELDS: Array<{ key: CanonicalTimelineField; label: string }> = [
  { key: 'time_s', label: 'Time (s)' },
  { key: 'speed_kmh', label: 'Speed (km/h)' },
  { key: 'hr_bpm', label: 'Heart Rate (bpm)' },
  { key: 'power_watts', label: 'Power (W)' },
  { key: 'distance_m', label: 'Distance (m)' },
  { key: 'latitude_deg', label: 'Latitude (°)' },
  { key: 'longitude_deg', label: 'Longitude (°)' },
  { key: 'cadence_rpm', label: 'Cadence (rpm)' },
  { key: 'lactate_mmol', label: 'Lactate (mmol/L)' },
  { key: 'rpe', label: 'RPE (1–10)' },
  { key: 'vo2_rel_mlkgmin', label: 'VO₂ relative (ml/kg/min)' },
  { key: 'vo2_abs_mlmin', label: 'VO₂ absolute (ml/min)' },
  { key: 'vco2_mlmin', label: 'VCO₂ (ml/min)' },
  { key: 'rer', label: 'RER' },
  { key: 'rf_bpm', label: 'Respiratory rate (breaths/min)' },
  { key: 'tv_l', label: 'Tidal volume (L)' },
  { key: 've_lmin', label: 'Ventilation (L/min)' },
  { key: 'eqo2', label: 'EqO₂' },
  { key: 'feo2_pct', label: 'FeO₂ (%)' },
  { key: 'hrv_ms', label: 'HRV (ms)' },
  { key: 'rr_ms', label: 'RR interval (ms)' },
];

const FIELD_UNITS: Partial<Record<CanonicalTimelineField, string>> = {
  time_s: 's', speed_kmh: 'km/h', hr_bpm: 'bpm', power_watts: 'W', distance_m: 'm',
  latitude_deg: 'degrees', longitude_deg: 'degrees', cadence_rpm: 'rpm', lactate_mmol: 'mmol/L',
  rpe: '1–10', vo2_rel_mlkgmin: 'ml/kg/min', vo2_abs_mlmin: 'ml/min', vco2_mlmin: 'ml/min',
  rer: 'ratio', rf_bpm: 'breaths/min', tv_l: 'L', ve_lmin: 'L/min', eqo2: 'ratio',
  feo2_pct: '%', hrv_ms: 'ms', rr_ms: 'ms',
};

export async function parseTimelineFile(
  file: File,
  mapping: ColumnMapping,
  offsetSeconds = 0,
  options: ImportOptions = {},
): Promise<TimelineSample[]> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const format = getFormat(extension);
  if (format === 'fit') return parseFitFile(await file.arrayBuffer(), file.name, offsetSeconds, options);
  if (format === 'tcx') return parseTcxFile(await file.text(), file.name, offsetSeconds, options);

  const buffer = await file.arrayBuffer();
  const rows = format === 'csv' || format === 'tsv' || format === 'txt'
    ? parseDelimitedText(new TextDecoder().decode(buffer), format)
    : parseWorkbook(buffer);
  if (rows.length === 0) throw new Error('No data rows found in file');

  const rawSamples = rows.map((row, index) => mapToTimeline(row, mapping, offsetSeconds, index));
  return addProvenance(rawSamples, {
    format,
    fileName: file.name,
    options,
    mapping,
    recordCount: rows.length,
    sourceTimestamps: rawSamples.map((sample) => sample.timestamp_s),
    transformations: ['column_mapping', ...(offsetSeconds ? [`time_offset_${offsetSeconds}s`] : [])],
  });
}

export async function parseFitFile(
  buffer: ArrayBuffer,
  fileName: string,
  offsetSeconds = 0,
  options: ImportOptions = {},
): Promise<TimelineSample[]> {
  const { Decoder, Stream } = await import('@garmin/fitsdk');
  const stream = Stream.fromArrayBuffer(buffer);
  const decoder = new Decoder(stream);
  if (!decoder.isFIT()) throw new Error('The selected file is not a valid Garmin FIT activity.');
  if (!decoder.checkIntegrity()) throw new Error('The FIT file failed its integrity check. Re-export the activity and try again.');
  const { messages, errors } = decoder.read({ applyScaleAndOffset: true, expandComponents: true, convertDateTimesToDates: true });
  if (errors.length > 0) throw new Error(`FIT decoding failed: ${errors[0]}`);
  const records = (messages as Record<string, unknown>).record;
  if (!Array.isArray(records) || records.length === 0) throw new Error('The FIT activity contains no record samples.');
  return mapFitRecordsToTimeline(records as Array<Record<string, unknown>>, fileName, offsetSeconds, options);
}

export function mapFitRecordsToTimeline(
  records: Array<Record<string, unknown>>,
  fileName: string,
  offsetSeconds = 0,
  options: ImportOptions = {},
): TimelineSample[] {
  const recordTimes = records.map((record) => timestampSeconds(record.timestamp));
  const firstTime = recordTimes.find((value): value is number => value != null) ?? 0;
  const rawSamples = records.map((record, index) => {
    const absoluteTime = recordTimes[index];
    const elapsed = absoluteTime == null ? index : absoluteTime - firstTime;
    const speedMps = asNumber(record.enhancedSpeed) ?? asNumber(record.speed);
    const measurements: Partial<Record<CanonicalTimelineField, number>> = {
      time_s: elapsed,
      ...(asNumber(record.heartRate) != null ? { hr_bpm: asNumber(record.heartRate)! } : {}),
      ...(asNumber(record.power) != null ? { power_watts: asNumber(record.power)! } : {}),
      ...(speedMps != null ? { speed_kmh: speedMps * 3.6 } : {}),
      ...(asNumber(record.distance) != null ? { distance_m: asNumber(record.distance)! } : {}),
      ...(asNumber(record.positionLat) != null ? { latitude_deg: asNumber(record.positionLat)! } : {}),
      ...(asNumber(record.positionLong) != null ? { longitude_deg: asNumber(record.positionLong)! } : {}),
      ...(asNumber(record.cadence) != null ? { cadence_rpm: asNumber(record.cadence)! } : {}),
    };
    return makeTimelineSample({
      timestamp: Math.max(0, elapsed + offsetSeconds),
      measurements,
      sourceRow: index + 1,
      sourceTimestamp: toSerializableTimestamp(record.timestamp),
      raw: normalizeRawRecord(record),
    });
  });
  return addProvenance(rawSamples, {
    format: 'fit',
    fileName,
    options,
    mapping: {},
    recordCount: records.length,
    sourceTimestamps: recordTimes,
    transformations: ['garmin_fit_sdk_decode', 'fit_speed_m_s_to_km_h', ...(offsetSeconds ? [`time_offset_${offsetSeconds}s`] : [])],
  });
}

export function parseTcxFile(
  xml: string,
  fileName: string,
  offsetSeconds = 0,
  options: ImportOptions = {},
): TimelineSample[] {
  const blocks = [...xml.matchAll(/<(?:[\w.-]+:)?Trackpoint\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?Trackpoint\s*>/gi)];
  if (blocks.length === 0) throw new Error('The TCX activity contains no trackpoints.');
  const parsed = blocks.map(([, block], index) => {
    const time = tagText(block, 'Time');
    const timestampMs = time ? Date.parse(time) : Number.NaN;
    const distance = numberTag(block, 'DistanceMeters');
    const previous = index > 0 ? parsedDistanceAndTime(blocks[index - 1][1]) : null;
    const elapsed = Number.isFinite(timestampMs)
      ? (timestampMs - (Number.isFinite(Date.parse(tagText(blocks[0][1], 'Time') ?? '')) ? Date.parse(tagText(blocks[0][1], 'Time')!) : timestampMs)) / 1000
      : index;
    const secondsSincePrevious = time && previous?.timeMs != null ? (timestampMs - previous.timeMs) / 1000 : null;
    const speedKmh = distance != null && previous?.distanceM != null && secondsSincePrevious && secondsSincePrevious > 0
      ? ((distance - previous.distanceM) / secondsSincePrevious) * 3.6
      : null;
    const latitude = numberTag(block, 'LatitudeDegrees');
    const longitude = numberTag(block, 'LongitudeDegrees');
    const heartRate = numberTag(block, 'Value');
    const power = numberTag(block, 'Watts');
    const cadence = numberTag(block, 'Cadence');
    const measurements: Partial<Record<CanonicalTimelineField, number>> = {
      time_s: elapsed,
      ...(distance != null ? { distance_m: distance } : {}),
      ...(speedKmh != null && speedKmh >= 0 ? { speed_kmh: speedKmh } : {}),
      ...(latitude != null ? { latitude_deg: latitude } : {}),
      ...(longitude != null ? { longitude_deg: longitude } : {}),
      ...(heartRate != null ? { hr_bpm: heartRate } : {}),
      ...(power != null ? { power_watts: power } : {}),
      ...(cadence != null ? { cadence_rpm: cadence } : {}),
    };
    return makeTimelineSample({
      timestamp: Math.max(0, elapsed + offsetSeconds),
      measurements,
      sourceRow: index + 1,
      sourceTimestamp: time,
      raw: { time, distance_m: distance, latitude_deg: latitude, longitude_deg: longitude, heart_rate_bpm: heartRate, power_watts: power, cadence_rpm: cadence },
    });
  });
  const sourceTimes = blocks.map(([, block]) => {
    const value = tagText(block, 'Time');
    return value ? Date.parse(value) / 1000 : null;
  });
  return addProvenance(parsed, {
    format: 'tcx',
    fileName,
    options,
    mapping: {},
    recordCount: blocks.length,
    sourceTimestamps: sourceTimes,
    transformations: ['tcx_trackpoint_parse', 'distance_and_time_to_speed', ...(offsetSeconds ? [`time_offset_${offsetSeconds}s`] : [])],
  });
}

export function extractHeaders(file: File): Promise<string[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'fit' || extension === 'tcx') return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data) throw new Error('Empty file');
        const headers = extension === 'csv' || extension === 'tsv' || extension === 'txt'
          ? parseDelimitedHeaders(new TextDecoder().decode(data as ArrayBuffer), extension)
          : (() => {
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            return (sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as unknown[] | undefined : undefined)
              ?.map((value) => String(value ?? ''));
          })();
        if (!headers?.length) throw new Error('No headers found in file');
        resolve(headers);
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function autoDetectMapping(
  headers: string[],
  profiles: DeviceProfile[],
): { profile: DeviceProfile | null; mapping: ColumnMapping } {
  let bestMatch: DeviceProfile | null = null;
  let bestScore = 0;
  for (const profile of profiles) {
    const score = scoreMappingMatch(headers, profile.column_mapping);
    if (score > bestScore) { bestScore = score; bestMatch = profile; }
  }
  const mapping = guessMapping(headers);
  if (bestMatch && bestScore >= 3) {
    headers.forEach((header) => {
      const matchedColumn = Object.keys(bestMatch!.column_mapping)
        .find((column) => normalizeHeader(column) === normalizeHeader(header));
      if (matchedColumn) mapping[header] = bestMatch!.column_mapping[matchedColumn] as CanonicalTimelineField;
    });
    return { profile: bestMatch, mapping };
  }
  return { profile: null, mapping };
}

export function getRawColumnKeys(samples: TimelineSample[]): string[] {
  const keys = new Set<string>();
  for (const sample of samples) for (const key of Object.keys(sample.raw_data)) if (!key.startsWith('__')) keys.add(key);
  return [...keys];
}

function mapToTimeline(row: Record<string, unknown>, mapping: ColumnMapping, offsetSeconds: number, index: number): TimelineSample {
  const measurements: Partial<Record<CanonicalTimelineField, number>> = {};
  const raw: Record<string, unknown> = {};
  for (const [fileColumn, canonicalField] of Object.entries(mapping)) {
    const value = findColumnValue(row, fileColumn);
    raw[fileColumn] = serializableValue(value);
    const parsed = convertValue(value, canonicalField, fileColumn);
    if (parsed != null && Number.isFinite(parsed)) measurements[canonicalField] = parsed;
  }
  const timestamp = measurements.time_s ?? index;
  const sample = makeTimelineSample({
    timestamp: Math.max(0, timestamp + offsetSeconds),
    measurements,
    sourceRow: index + 1,
    sourceTimestamp: measurements.time_s ?? null,
    raw,
  });
  return sample;
}

function makeTimelineSample(input: {
  timestamp: number;
  measurements: Partial<Record<CanonicalTimelineField, number>>;
  sourceRow: number;
  sourceTimestamp: string | number | null;
  raw: Record<string, unknown>;
}): TimelineSample {
  const m = input.measurements;
  return {
    id: newId(),
    timestamp_s: input.timestamp,
    speed_pace: m.speed_kmh != null ? `${m.speed_kmh.toFixed(2)} km/h` : null,
    speed_kmh: m.speed_kmh ?? null,
    heart_rate: m.hr_bpm ?? null,
    power_watts: m.power_watts ?? null,
    distance_m: m.distance_m ?? null,
    latitude_deg: m.latitude_deg ?? null,
    longitude_deg: m.longitude_deg ?? null,
    cadence_rpm: m.cadence_rpm ?? null,
    lactate: m.lactate_mmol ?? null,
    rpe: m.rpe ?? null,
    vo2_ml_kg_min: m.vo2_rel_mlkgmin ?? null,
    measurements: m,
    raw_data: { ...input.raw, __sourceRow: input.sourceRow, __sourceTimestamp: input.sourceTimestamp, __canonicalMeasurements: m },
    source: 'imported',
    edited_fields: [],
  };
}

function addProvenance(
  samples: TimelineSample[],
  input: { format: ImportFormat; fileName: string; options: ImportOptions; mapping: ColumnMapping; recordCount: number; sourceTimestamps: Array<number | string | null>; transformations: string[] },
): TimelineSample[] {
  const intervals = input.sourceTimestamps.slice(1).flatMap((time, index) => {
    const previous = input.sourceTimestamps[index];
    const currentSeconds = typeof time === 'string' ? Date.parse(time) / 1000 : time;
    const previousSeconds = typeof previous === 'string' ? Date.parse(previous) / 1000 : previous;
    const delta = currentSeconds != null && previousSeconds != null ? currentSeconds - previousSeconds : null;
    return delta != null && Number.isFinite(delta) && delta > 0 ? [delta] : [];
  }).sort((a, b) => a - b);
  const estimatedHz = intervals.length ? round(1 / intervals[Math.floor(intervals.length / 2)], 3) : null;
  const sampleFrequencyHz = positiveNumber(input.options.sampleFrequencyHz) ?? estimatedHz;
  const units = mappedUnits(input.mapping);
  samples.forEach((sample) => {
    Object.keys(sample.measurements ?? {}).forEach((field) => {
      const canonicalField = field as CanonicalTimelineField;
      if (!units[canonicalField] && FIELD_UNITS[canonicalField]) units[canonicalField] = FIELD_UNITS[canonicalField];
    });
  });
  const importId = newId();
  const transformations = [...new Set(input.transformations)];
  const shared: Omit<SampleDataProvenance, 'sourceRow' | 'sourceTimestamp'> = {
    importId,
    format: input.format,
    fileName: input.fileName,
    importedAt: new Date().toISOString(),
    source: 'file',
    deviceName: input.options.deviceName?.trim() || defaultDeviceName(input.format),
    deviceProfileId: input.options.deviceProfileId ?? null,
    sampleFrequencyHz,
    units,
    calibrationDate: input.options.calibrationDate || null,
    calibrationNotes: input.options.calibrationNotes?.trim() || null,
    columnMapping: input.mapping,
    transformations,
  };
  return samples.map((sample, index) => {
    const provenance: SampleDataProvenance = {
      ...shared,
      sourceRow: index + 1,
      sourceTimestamp: input.sourceTimestamps[index] ?? sample.timestamp_s,
    };
    return {
      ...sample,
      provenance,
      raw_data: { ...sample.raw_data, __provenance: provenance },
    };
  });
}

export function parseDelimitedText(text: string, format: ImportFormat): Record<string, unknown>[] {
  const records = parseDelimitedRecords(text, format);
  if (records.length < 2) return [];
  const headers = records[0].map((header) => header.trim());
  return records.slice(1)
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? null])));
}

function parseDelimitedHeaders(text: string, extension: string): string[] {
  return parseDelimitedRecords(text, getFormat(extension))[0]?.map((header) => header.trim()) ?? [];
}

function parseDelimitedRecords(text: string, format: ImportFormat): string[][] {
  const content = text.replace(/^\uFEFF/, '');
  if (!content.trim()) return [];
  const firstRecordEnd = content.search(/[\r\n]/);
  const firstRecord = firstRecordEnd < 0 ? content : content.slice(0, firstRecordEnd);
  const delimiter = format === 'tsv' ? '\t' : firstRecord.includes(';') ? ';' : firstRecord.includes('\t') ? '\t' : ',';
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (char === '"' && content[index + 1] === '"' && quoted) { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.trim())) records.push(row);
      row = [];
      cell = '';
    }
    else cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value.trim())) records.push(row);
  return records;
}

function parseWorkbook(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null }) : [];
}

function guessMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((header) => {
    const name = normalizeHeader(header);
    if (name.includes('power') || name.includes('watts') || name === 'w') mapping[header] = 'power_watts';
    else if (name.includes('latitude') || name === 'lat') mapping[header] = 'latitude_deg';
    else if (name.includes('longitude') || name === 'lon' || name === 'lng') mapping[header] = 'longitude_deg';
    else if (name.includes('distance') || name.includes('distancem')) mapping[header] = 'distance_m';
    else if (name.includes('cadence') || name.includes('rpm')) mapping[header] = 'cadence_rpm';
    else if (name.includes('lactate') || name.includes('mmol')) mapping[header] = 'lactate_mmol';
    else if (name === 'rpe') mapping[header] = 'rpe';
    else if (name.includes('time') || name === 't' || name.includes('tempo') || name === 'elapsed') mapping[header] = 'time_s';
    else if (name.includes('hr') || name.includes('heartrate') || name.includes('pulse')) mapping[header] = 'hr_bpm';
    else if (name.includes('vo2') && name.includes('kg')) mapping[header] = 'vo2_rel_mlkgmin';
    else if (name.includes('vo2')) mapping[header] = 'vo2_abs_mlmin';
    else if (name.includes('speed') || name.includes('velocity') || name.includes('pace')) mapping[header] = 'speed_kmh';
    else if (name.includes('respiratoryfrequency') || name === 'rf' || name.includes('respiratoryrate')) mapping[header] = 'rf_bpm';
    else if (name.includes('tidalvolume') || name === 'tv') mapping[header] = 'tv_l';
    else if (name.includes('ventilation') || name === 've') mapping[header] = 've_lmin';
    else if (name.includes('vco2')) mapping[header] = 'vco2_mlmin';
    else if (name.includes('rer')) mapping[header] = 'rer';
    else if (name.includes('eqo2') || name.includes('oxygen')) mapping[header] = 'eqo2';
    else if (name.includes('feo2')) mapping[header] = 'feo2_pct';
    else if (name.includes('hrv')) mapping[header] = 'hrv_ms';
    else if (name.includes('rr') && name.includes('ms')) mapping[header] = 'rr_ms';
  });
  return mapping;
}

function scoreMappingMatch(headers: string[], mapping: Record<string, string>): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  return Object.keys(mapping).filter((column) => normalizedHeaders.includes(normalizeHeader(column))).length;
}

function convertValue(value: unknown, field: CanonicalTimelineField, header: string): number | null {
  if (typeof value === 'string' && field === 'speed_kmh') {
    const paceSpeed = parsePaceSpeed(value);
    if (paceSpeed != null) return paceSpeed;
  }
  let numeric = parseNumeric(value);
  if (numeric == null) return null;
  const normalizedHeader = normalizeHeader(header);
  if (field === 'time_s' && normalizedHeader.includes('ms')) numeric /= 1000;
  if (field === 'speed_kmh') {
    if (normalizedHeader.includes('mph')) numeric *= 1.609344;
    else if (normalizedHeader.includes('mps') || /\bm\/s\b/i.test(header)) numeric *= 3.6;
    else if (normalizedHeader.includes('pace')) {
      const paceSpeed = parsePaceSpeed(String(value));
      if (paceSpeed != null) numeric = paceSpeed;
    }
  }
  if ((field === 'distance_m') && normalizedHeader.includes('km')) numeric *= 1000;
  if ((field === 'vo2_rel_mlkgmin' || field === 'vo2_abs_mlmin' || field === 'vco2_mlmin') && normalizedHeader.includes('lmin')) numeric *= 1000;
  return numeric;
}

function parsePaceSpeed(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})(?:\.\d+)?\s*(?:\/\s*km|per\s*km|\/km)?$/i);
  if (!match) return null;
  const minutesPerKm = Number(match[1]) + Number(match[2]) / 60;
  return minutesPerKm > 0 ? 60 / minutesPerKm : null;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  const time = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (time) return time[3] != null ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : Number(time[1]) * 60 + Number(time[2]);
  const parsed = Number(normalized.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function mappedUnits(mapping: ColumnMapping): DataImportMetadata['units'] {
  const units: DataImportMetadata['units'] = {};
  Object.values(mapping).forEach((field) => { if (FIELD_UNITS[field]) units[field] = FIELD_UNITS[field]; });
  return units;
}

function defaultDeviceName(format: ImportFormat): string {
  if (format === 'fit') return 'FIT compatible device';
  if (format === 'tcx') return 'TCX activity export';
  return 'Unspecified device';
}

function getFormat(extension: string): ImportFormat {
  if (['csv', 'tsv', 'txt', 'xls', 'xlsx', 'fit', 'tcx'].includes(extension)) return extension as ImportFormat;
  throw new Error(`Unsupported file format: .${extension || 'unknown'}`);
}

function findColumnValue(row: Record<string, unknown>, column: string): unknown {
  if (row[column] != null) return row[column];
  const normalized = normalizeHeader(column);
  return Object.keys(row).find((key) => normalizeHeader(key) === normalized) != null
    ? row[Object.keys(row).find((key) => normalizeHeader(key) === normalized)!]
    : null;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tagText(xml: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`, 'i'));
  return match?.[1]?.replace(/<[^>]+>/g, '').trim() || null;
}

function numberTag(xml: string, name: string): number | null {
  const value = tagText(xml, name);
  return value == null ? null : parseNumeric(value);
}

function parsedDistanceAndTime(xml: string): { distanceM: number | null; timeMs: number | null } | null {
  const time = tagText(xml, 'Time');
  return {
    distanceM: numberTag(xml, 'DistanceMeters'),
    timeMs: time ? Date.parse(time) : null,
  };
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function timestampSeconds(value: unknown): number | null {
  if (value instanceof Date) return value.getTime() / 1000;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed / 1000 : null;
  }
  return asNumber(value);
}

function toSerializableTimestamp(value: unknown): string | number | null {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' || typeof value === 'number' ? value : null;
}

function normalizeRawRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]));
}

function serializableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

function positiveNumber(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
