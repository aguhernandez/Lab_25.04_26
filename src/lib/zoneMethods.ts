import type { Sport } from '../types';
import { kmhToPace, type Language, type ZoneDefinition } from './trainingZones';

export const ZONE_METHODS_VERSION = '1.0.0';
export type ZoneMethodId = 'physiological' | 'friel_run_hr' | 'friel_bike_hr' | 'coggan_hr' | 'coggan_power' | 'hrmax' | 'karvonen' | 'threshold_speed' | 'running_power';
export interface ZoneMethod {
  id: ZoneMethodId;
  name: string;
  count: 5 | 7 | 'both';
  metric: 'combined' | 'hr' | 'power' | 'speed';
  referenceLabel: string;
  formula: string;
  source?: string;
  sports?: Sport[];
}
const FRIEL = 'https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/';
const COGGAN = 'https://www.trainingpeaks.com/blog/power-training-levels/';
export const ZONE_METHODS: ZoneMethod[] = [
  { id: 'physiological', name: 'Asciende · LT1/LT2', count: 'both', metric: 'combined', referenceLabel: 'LT1 / LT2', formula: 'LT1/LT2 + PAM/VAM. Subdivisiones prácticas Asciende; estimación, no umbrales medidos adicionales.' },
  { id: 'friel_run_hr', name: 'Joe Friel · FC carrera', count: 7, metric: 'hr', referenceLabel: 'LTHR (bpm)', formula: '%LTHR: <85; 85–<90; 90–<95; 95–<100; 100–<103; 103–106; >106.', source: FRIEL, sports: ['running', 'triathlon'] },
  { id: 'friel_bike_hr', name: 'Joe Friel · FC ciclismo', count: 7, metric: 'hr', referenceLabel: 'LTHR (bpm)', formula: '%LTHR: <81; 81–<90; 90–<94; 94–<100; 100–<103; 103–106; >106.', source: FRIEL, sports: ['cycling', 'triathlon'] },
  { id: 'coggan_hr', name: 'Andy Coggan · FC', count: 5, metric: 'hr', referenceLabel: 'LTHR (bpm)', formula: 'Límites superiores: 68%, 83%, 94%, 105% LTHR; última zona abierta hasta FCmáx. Límites enteros contiguos.', source: COGGAN, sports: ['cycling', 'triathlon'] },
  { id: 'coggan_power', name: 'Andy Coggan · potencia ciclismo', count: 7, metric: 'power', referenceLabel: 'FTP (W)', formula: 'Límites superiores: 55%, 75%, 90%, 105%, 120% FTP; Z6 >120%. Z7 sprint sin porcentaje FTP ni límite artificial.', source: COGGAN, sports: ['cycling', 'triathlon'] },
  { id: 'hrmax', name: '% FC máxima · 5 bandas', count: 5, metric: 'hr', referenceLabel: 'FCmáx (bpm)', formula: '50–60–70–80–90–100% FCmáx. Convención general; no equivale a umbrales individuales.' },
  { id: 'karvonen', name: 'Karvonen · 5 bandas Asciende', count: 5, metric: 'hr', referenceLabel: 'FCmáx (bpm)', formula: 'FCreposo + f × (FCmáx − FCreposo), f = 50–60–70–80–90–100%. Las 5 bandas son una convención Asciende.' },
  { id: 'threshold_speed', name: 'Asciende · % velocidad de umbral', count: 5, metric: 'speed', referenceLabel: 'Velocidad de umbral (km/h)', formula: 'Límites de velocidad: 80%, 90%, 100%, 105%; Z5 >105%. Ritmo = distancia / velocidad, no % directo del tiempo.', sports: ['running', 'swimming'] },
  { id: 'running_power', name: 'MyProCoach · potencia carrera', count: 5, metric: 'power', referenceLabel: 'Potencia de umbral (W)', formula: '65–80–90–100–115–130% de potencia de umbral. Fuera de 65–130% no se asigna una zona de este método.', source: 'https://help.trainingpeaks.com/hc/en-us/articles/360017420092-Zones-Calculator-Overview', sports: ['running'] },
];
export interface ZoneMethodInput {
  reference: number;
  hrmax?: number | null;
  restingHR?: number | null;
  sport: Sport;
  language?: Language;
}
export interface ZoneMethodResult { zones: ZoneDefinition[]; error: string | null }
const finitePositive = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0;

/** Whole bpm/W limits are contiguous. Speed limits remain continuous: (lower, upper]. */
export function calculateMethodZones(id: ZoneMethodId, input: ZoneMethodInput): ZoneMethodResult {
  const method = ZONE_METHODS.find(m => m.id === id);
  const fail = (error: string): ZoneMethodResult => ({ zones: [], error });
  if (!method || method.id === 'physiological') return fail('Selecciona el cálculo LT1/LT2 para el modelo fisiológico.');
  if (method.sports && !method.sports.includes(input.sport)) return fail('Este método no corresponde al deporte seleccionado.');
  if (!finitePositive(input.reference)) return fail('Introduce una referencia positiva y finita.');
  const ref = input.reference;
  const isHR = method.metric === 'hr';
  if (isHR && finitePositive(input.hrmax) && !['hrmax', 'karvonen'].includes(id) && ref >= input.hrmax) return fail('LTHR debe ser menor que FCmáx.');
  if (id === 'karvonen' && (!finitePositive(input.restingHR) || input.restingHR >= ref)) return fail('FCreposo debe ser positiva y menor que FCmáx.');
  const en = input.language === 'en';
  const names = en ? ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO₂max', 'Anaerobic', 'Sprint'] : ['Recuperación', 'Resistencia', 'Tempo', 'Umbral', 'VO₂max', 'Anaeróbico', 'Sprint'];
  let edges: Array<number | null>;
  let first: number | null = null;
  if (id === 'friel_run_hr' || id === 'friel_bike_hr') {
    const factors = id === 'friel_run_hr' ? [0.85, 0.90, 0.95, 1, 1.03] : [0.81, 0.90, 0.94, 1, 1.03];
    edges = [...factors.map(f => Math.ceil(ref * f - 1e-9) - 1), Math.floor(ref * 1.06 + 1e-9), finitePositive(input.hrmax) ? Math.floor(input.hrmax) : null];
  } else if (id === 'coggan_hr') {
    edges = [0.68, 0.83, 0.94, 1.05].map(f => Math.floor(ref * f + 1e-9));
    edges.push(finitePositive(input.hrmax) ? Math.floor(input.hrmax) : null);
  } else if (id === 'hrmax' || id === 'karvonen') {
    const rest = id === 'karvonen' ? input.restingHR! : 0;
    const reserve = ref - rest;
    first = Math.ceil(rest + reserve * 0.5 - 1e-9);
    edges = [0.6, 0.7, 0.8, 0.9, 1].map(f => Math.floor(rest + reserve * f + 1e-9));
  } else if (id === 'coggan_power') {
    edges = [...[0.55, 0.75, 0.9, 1.05, 1.2].map(f => Math.floor(ref * f + 1e-9)), null];
    first = 0;
  } else if (id === 'running_power') {
    first = Math.ceil(ref * 0.65 - 1e-9);
    edges = [0.8, 0.9, 1, 1.15, 1.3].map(f => Math.floor(ref * f + 1e-9));
  } else {
    first = 0;
    edges = [...[0.8, 0.9, 1, 1.05].map(f => ref * f), null];
  }
  if (edges.some((edge, i) => edge != null && ((i > 0 && edges[i - 1] != null && edge <= edges[i - 1]!) || (i === 0 && first != null && edge < first)))) return fail('Las referencias producen rangos vacíos o superiores a FCmáx; revisa los datos.');
  const zones = edges.map((upper, i): ZoneDefinition => {
    const lower = i === 0 ? first : edges[i - 1] == null ? null : edges[i - 1]! + (method.metric === 'speed' ? 0 : 1);
    const zone: ZoneDefinition = {
      zone: i + 1, name: names[i], hr_min: null, hr_max: null,
      zone_label: id.startsWith('friel') && i >= 4 ? ['5a', '5b', '5c'][i - 4] : String(i + 1),
      description: en ? 'Estimated training prescription from the selected reference.' : 'Prescripción estimada desde la referencia seleccionada.',
      confidence: 'estimated',
      calculation: { method: id, version: ZONE_METHODS_VERSION, metric: method.metric, reference: ref,
        ...(finitePositive(input.hrmax) ? { maximumHR: input.hrmax } : {}),
        ...(id === 'karvonen' ? { restingHR: input.restingHR! } : {}), formula: method.formula, source: method.source },
    };
    if (method.metric === 'hr') { zone.hr_min = lower; zone.hr_max = upper; }
    if (method.metric === 'power') { zone.power_min = lower; zone.power_max = upper; }
    if (method.metric === 'speed') {
      zone.speed_min_kmh = lower; zone.speed_max_kmh = upper;
      zone.pace_min = upper == null ? null : kmhToPace(upper, input.sport);
      zone.pace_max = lower && lower > 0 ? kmhToPace(lower, input.sport) : null;
    }
    return zone;
  });
  if (id === 'coggan_power') zones.push({ zone: 7, zone_label: '7', name: names[6], hr_min: null, hr_max: null,
    power_label: en ? 'Maximal sprint; no %FTP boundary' : 'Sprint máximo; sin límite %FTP',
    description: en ? 'Prescribe by sprint duration and individual performance.' : 'Prescribir por duración del sprint y rendimiento individual.',
    confidence: 'estimated', calculation: zones[0].calculation });
  if (id === 'hrmax' || id === 'karvonen' || id === 'threshold_speed') zones.forEach((z, i) => { z.name = `${en ? 'Intensity' : 'Intensidad'} ${i + 1}`; });
  return { zones, error: null };
}

export function formatZonePace(zone: ZoneDefinition, sport: Sport): string {
  const unit = sport === 'swimming' ? '/100 m' : sport === 'running' ? '/km' : 'km/h';
  if (zone.pace_label) return zone.pace_label;
  if (zone.pace_min && zone.pace_max) return `${zone.pace_min} – ${zone.pace_max} ${unit}`;
  if (zone.pace_min) return `≥ ${zone.pace_min} ${unit}`;
  if (zone.pace_max) return `< ${zone.pace_max} ${unit}`;
  return '—';
}
