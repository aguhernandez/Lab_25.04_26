import { useEffect, useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import type { Sport } from '../types';
import { type ZoneDefinition, type ZoneDisplayMode, type TrainingZonesData, getZoneColor, getZoneTextColor, calculateZones7, convertTo5Zones, paceToKmh } from '../lib/trainingZones';
import { automaticZoneReference, calculateMethodZones, formatZonePace, ZONE_METHODS, type ZoneMethodId } from '../lib/zoneMethods';
import { updateTrainingZonesManual } from '../lib/physiologyProfile';
import { useLanguage } from '../contexts/LanguageContext';

interface TrainingZonesTableProps {
  zones?: ZoneDefinition[] | null;
  zonesData?: TrainingZonesData | null;
  sport: Sport;
  defaultMode?: ZoneDisplayMode;
  lt1_hr?: number | null; lt2_hr?: number | null; hrmax?: number | null;
  lt1_power?: number | null; lt2_power?: number | null;
  lt1_pace?: string | null; lt2_pace?: string | null;
  vam_kmh?: number | null; pam_watts?: number | null;
  thresholdSource?: 'ventilatory' | 'lactate';
  isLocked?: boolean; athleteId?: string; modifiedBy?: 'coach' | 'athlete';
  onSaved?: (zones: ZoneDefinition[]) => void;
}
type EditField = 'hr_min' | 'hr_max' | 'power_min' | 'power_max' | 'pace_min' | 'pace_max' | 'rpe_min' | 'rpe_max';
const FIELDS: EditField[] = ['hr_min', 'hr_max', 'power_min', 'power_max', 'pace_min', 'pace_max', 'rpe_min', 'rpe_max'];
const fieldClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const range = (low: number | null | undefined, high: number | null | undefined, unit: string) => low != null && high != null ? `${low} – ${high} ${unit}` : low != null ? `≥ ${low} ${unit}` : high != null ? `≤ ${high} ${unit}` : '—';

export default function TrainingZonesTable(props: TrainingZonesTableProps) {
  const { zones, zonesData, sport, lt1_hr, lt2_hr, hrmax, lt1_power, lt2_power, lt1_pace, lt2_pace, vam_kmh, pam_watts, thresholdSource = 'lactate', isLocked = false, athleteId, modifiedBy = 'coach', onSaved } = props;
  const { language } = useLanguage();
  const en = language === 'en';
  const savedMethod = zones?.[0]?.calculation?.method;
  const initialMethod: ZoneMethodId = ZONE_METHODS.some(m => m.id === savedMethod) ? savedMethod as ZoneMethodId : 'physiological';
  const [methodId, setMethodId] = useState<ZoneMethodId>(initialMethod);
  const [mode, setMode] = useState<ZoneDisplayMode>(zones?.[0]?.calculation && (zones[0].calculation.custom || savedMethod !== 'LT1_LT2_physiological') ? (zones.length === 7 ? '7' : '5') : props.defaultMode ?? zonesData?.defaultDisplay ?? '5');
  const testReferences = { sport, hrmax, lt2_hr, lt2_power, lt2_pace };
  const [referenceOverride, setReferenceOverride] = useState<string | null>(initialMethod !== 'physiological' && zones?.[0]?.calculation?.reference != null ? String(zones[0].calculation.reference) : null);
  const [referenceSource, setReferenceSource] = useState(zones?.[0]?.calculation?.referenceSource ?? 'manual');
  const autoReference = automaticZoneReference(methodId, testReferences);
  const reference = referenceOverride ?? (autoReference.value == null ? '' : String(autoReference.value));
  const automatic = referenceOverride === null;
  const proxy = automatic ? autoReference.proxy : zones?.[0]?.calculation?.referenceIsProxy === true && referenceSource !== 'manual';
  const [resting, setResting] = useState(String(zones?.[0]?.calculation?.restingHR ?? ''));
  const [localZones, setLocalZones] = useState<ZoneDefinition[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Record<number, Record<EditField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  // Parent keys isolate athletes/tests. Saved props may arrive after the initial render.
  useEffect(() => {
    if (preview || localZones) return;
    if (savedMethod && ZONE_METHODS.some(m => m.id === savedMethod)) {
      setMethodId(savedMethod as ZoneMethodId);
      setReferenceOverride(String(zones?.[0]?.calculation?.reference ?? ''));
      setReferenceSource(zones?.[0]?.calculation?.referenceSource ?? 'manual');
      setResting(String(zones?.[0]?.calculation?.restingHR ?? ''));
      setMode(zones?.length === 7 ? '7' : '5');
    }
  }, [zones, savedMethod, preview, localZones]);
  const method = ZONE_METHODS.find(m => m.id === methodId)!;
  const methods = ZONE_METHODS.filter(m => !m.sports || m.sports.includes(sport));
  const count = method.count === 'both' ? Number(mode) : method.count;
  const fresh7 = calculateZones7(lt1_hr ?? null, lt2_hr ?? null, hrmax ?? 0, sport, undefined, {
    lt1_power, lt2_power,
    lt1_speed_kmh: lt1_pace ? paceToKmh(lt1_pace, sport) : null,
    lt2_speed_kmh: lt2_pace ? paceToKmh(lt2_pace, sport) : null,
    vam_kmh, pam_watts, threshold_source: thresholdSource, language,
  });
  const physiology = mode === '7' ? fresh7 : convertTo5Zones(fresh7, sport, language);
  const calculated = methodId === 'physiological' ? { zones: physiology, error: physiology.length ? null : (en ? 'Valid LT1 < LT2 < maximum HR is required.' : 'Se necesita LT1 < LT2 < FC máxima válidos.') }
    : calculateMethodZones(methodId, { reference: Number(reference), restingHR: Number(resting), hrmax, sport, language });
  // Saved sets retain their exact native count. Never expand 5 edited zones by index into 7.
  const savedSet = !preview && zones?.length === count && (zones[0]?.calculation || !zonesData) ? zones : null;
  const dataSet = methodId === 'physiological' && !preview && !savedMethod && !physiology.length ? (mode === '7' ? zonesData?.zones7 : zonesData?.zones5) : null;
  const displayZones = localZones ?? savedSet ?? dataSet ?? calculated.zones;
  const error = displayZones.length ? null : calculated.error;
  const hasHR = method.metric === 'combined' || method.metric === 'hr';
  const hasPower = method.metric === 'power' || displayZones.some(z => z.power_min != null || z.power_max != null);
  const hasPace = method.metric === 'speed' || displayZones.some(z => z.pace_min || z.pace_max);
  const hasRPE = displayZones.some(z => z.rpe_min != null || z.rpe_max != null);
  const change = (id: ZoneMethodId) => {
    setMethodId(id); setLocalZones(null); setEditing(false); setSaveError(null); setSaved(false); setPreview(true);
    setReferenceOverride(null); setReferenceSource('automatic');
  };
  const startEditing = () => {
    setEdited(Object.fromEntries(displayZones.map(z => [z.zone, Object.fromEntries(FIELDS.map(f => [f, z[f] == null ? '' : String(z[f])]))])) as Record<number, Record<EditField, string>>);
    setEditing(true); setSaveError(null); setSaved(false);
  };
  const persist = async () => {
    let updated = displayZones.map(z => ({ ...z, calculation: z.calculation ? {
      ...z.calculation,
      ...(methodId !== 'physiological' ? { referenceSource: automatic ? autoReference.source ?? 'unavailable' : referenceSource, referenceIsProxy: proxy } : {}),
    } : undefined }));
    if (editing) {
      updated = updated.map(z => {
        const row = edited[z.zone];
        const item = { ...z };
        FIELDS.forEach(f => { (item as unknown as Record<string, unknown>)[f] = f.startsWith('pace') ? row[f] || null : row[f] === '' ? null : Number(row[f]); });
        // Manually edited pace supersedes cached speed endpoints.
        item.speed_min_kmh = undefined; item.speed_max_kmh = undefined;
        if (item.hr_min != null || item.hr_max != null) item.hr_label = null;
        item.calculation = { ...(z.calculation ?? { method: methodId, version: '1.0.0', metric: method.metric, reference: Number(reference) || null, formula: method.formula }), custom: true };
        return item;
      });
      for (const z of updated) {
        for (const [low, high] of [['hr_min', 'hr_max'], ['power_min', 'power_max'], ['rpe_min', 'rpe_max']] as const) {
          const a = z[low], b = z[high];
          if ([a, b].some(v => v != null && (!Number.isFinite(v) || v < 0 || !Number.isInteger(v))) || (a != null && b != null && a > b)
            || (low === 'hr_min' && hrmax != null && hrmax > 0 && [a, b].some(v => v != null && v > hrmax))
            || (low === 'rpe_min' && [a, b].some(v => v != null && (v < 1 || v > 10)))) {
            setSaveError(en ? 'Check integer limits, HR maximum and RPE 1–10.' : 'Revisa límites enteros, FC máxima y RPE entre 1 y 10.'); return;
          }
        }
        if ((z.pace_min && !paceToKmh(z.pace_min, sport)) || (z.pace_max && !paceToKmh(z.pace_max, sport))
          || (z.pace_min && z.pace_max && paceToKmh(z.pace_min, sport)! < paceToKmh(z.pace_max, sport)!)) {
          setSaveError(en ? 'Enter valid pace limits: faster first, slower second.' : 'Introduce ritmos válidos: primero el más rápido, después el más lento.'); return;
        }
      }
      const paceZones = updated.filter(z => z.pace_min || z.pace_max);
      if (paceZones.some((z, i) => i > 0 && (!paceZones[i - 1].pace_min || !z.pace_max || paceToKmh(z.pace_max, sport)! < paceToKmh(paceZones[i - 1].pace_min!, sport)!))) {
        setSaveError(en ? 'Pace zones must increase in speed without overlap.' : 'Las zonas de ritmo deben aumentar en velocidad sin solaparse.'); return;
      }
      for (const [low, high] of [['hr_min', 'hr_max'], ['power_min', 'power_max']] as const) {
        const applicable = updated.filter(z => z[low] != null || z[high] != null);
        if (applicable.some((z, i) => i > 0 && (applicable[i - 1][high] == null || z[low] == null || z[low]! <= applicable[i - 1][high]!))) {
          setSaveError(en ? 'Adjacent zones must not overlap.' : 'Las zonas consecutivas no deben solaparse.'); return;
        }
      }
    }
    setSaving(true); setSaveError(null);
    try {
      if (athleteId && !await updateTrainingZonesManual(athleteId, updated, modifiedBy)) throw new Error('save');
      setLocalZones(updated); onSaved?.(updated); setEditing(false); setSaved(true);
    } catch { setSaveError(en ? 'Could not save the zones. Please retry.' : 'No se pudieron guardar las zonas. Inténtalo de nuevo.'); }
    finally { setSaving(false); }
  };
  const inputPair = (z: ZoneDefinition, low: EditField, high: EditField) => <div className="flex gap-1">
    {[low, high].map(f => <input key={f} aria-label={`${z.name} ${f}`} className={`${fieldClass} w-24`} type={f.startsWith('pace') ? 'text' : 'number'} value={edited[z.zone]?.[f] ?? ''} onChange={e => setEdited(prev => ({ ...prev, [z.zone]: { ...prev[z.zone], [f]: e.target.value } }))} />)}
  </div>;
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <div><h3 className="text-lg font-semibold text-gray-900 dark:text-white">{en ? 'Training zones' : 'Zonas de entrenamiento'}</h3><p className="text-xs text-gray-500">{en ? 'Zones calculated from the test. Changing method or limits is optional.' : 'Zonas calculadas desde el test. Cambiar método o límites es opcional.'}</p></div>
      {method.count === 'both' ? <div className="flex gap-1">{(['5', '7'] as const).map(n => <button key={n} disabled={saving} onClick={() => { setMode(n); setLocalZones(null); setEditing(false); setPreview(true); setSaved(false); }} className={`rounded-lg px-4 py-2 text-sm ${mode === n ? 'bg-[#5A4E6B] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-white'}`}>{n} {en ? 'zones' : 'zonas'}</button>)}</div> : <span className="rounded-lg bg-[#5A4E6B]/10 px-3 py-2 text-sm font-semibold text-[#5A4E6B] dark:text-purple-200">{count} {en ? 'zones · native method' : 'zonas · método original'}</span>}
    </div>
    <div className="space-y-4 p-6">
      <p className="text-sm text-gray-700 dark:text-gray-200">{en ? 'The default 5/7-zone prescription comes directly from LT1/LT2, with or without measured VO₂. No manual setup is required when the test has sufficient data.' : 'La propuesta inicial de 5/7 zonas sale directamente de LT1/LT2, con o sin VO₂ medido. No requiere configuración manual si el test aporta datos suficientes.'}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{en ? 'Calculation method' : 'Método de cálculo'}<select aria-label={en ? 'Calculation method' : 'Método de cálculo'} disabled={saving} className={`${fieldClass} mt-1`} value={methodId} onChange={e => change(e.target.value as ZoneMethodId)}>{methods.map(m => <option key={m.id} value={m.id}>{m.name} · {m.count === 'both' ? '5/7' : m.count}{m.id === 'physiological' || automaticZoneReference(m.id, testReferences).value != null ? (en ? ' · from test' : ' · desde test') : (en ? ' · needs reference' : ' · requiere referencia')}</option>)}</select></label>
        {methodId !== 'physiological' && <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{proxy ? (method.metric === 'power' ? (en ? 'Test LT2 power (W; FTP proxy)' : 'Potencia LT2 del test (W; proxy FTP)') : (en ? 'Test LT2 HR (bpm; LTHR proxy)' : 'FC LT2 del test (bpm; proxy LTHR)')) : method.referenceLabel}<input className={`${fieldClass} mt-1`} type="number" min="1" step="any" disabled={saving} value={reference} onChange={e => { setReferenceOverride(e.target.value); setReferenceSource('manual'); setLocalZones(null); setPreview(true); setSaved(false); setEditing(false); }} /></label>}
        {methodId === 'karvonen' && <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{en ? 'Resting HR (bpm)' : 'FC reposo (bpm)'}<input className={`${fieldClass} mt-1`} type="number" min="1" disabled={saving} value={resting} onChange={e => { setResting(e.target.value); setLocalZones(null); setPreview(true); setSaved(false); setEditing(false); }} /></label>}
      </div>
      {methodId !== 'physiological' && <button disabled={saving} className="text-sm font-semibold text-[#5A4E6B] dark:text-purple-200" onClick={() => change('physiological')}>{en ? 'Return to automatic test zones' : 'Volver a las zonas automáticas del test'}</button>}
      {methodId !== 'physiological' && !automatic && autoReference.value != null && <button disabled={saving} className="ml-3 text-sm underline dark:text-white" onClick={() => { setReferenceOverride(null); setReferenceSource('automatic'); setLocalZones(null); setPreview(true); setEditing(false); }}>{en ? 'Use test reference' : 'Usar referencia del test'}</button>}
      {methodId === 'karvonen' && !resting && <p className="text-xs text-gray-500">{en ? 'This alternative additionally needs measured resting HR; the default test zones are already available.' : 'Esta alternativa necesita además FC de reposo medida; las zonas predeterminadas del test ya están disponibles.'}</p>}
      <div className="border-l-4 border-[#5A4E6B] bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300"><p>{method.formula}</p>
        <p className="mt-1 text-xs">{en ? 'Calculated estimates. Metric-specific methods do not infer equivalent HR, power or pace zones.' : 'Estimaciones calculadas. Los métodos por métrica no inventan equivalencias de FC, potencia o ritmo.'} {method.source && <a className="underline" href={method.source} target="_blank" rel="noreferrer">{en ? 'Method reference' : 'Referencia del método'}</a>}</p>
        {methodId !== 'physiological' && <p className="mt-1 text-xs">{automatic ? (en ? 'Reference loaded automatically from this test.' : 'Referencia cargada automáticamente desde este test.') : (en ? 'Saved or manually adjusted reference.' : 'Referencia guardada o ajustada manualmente.')} {proxy && (en ? 'Indicative alternative using laboratory LT2; FTP/LTHR has not been independently confirmed.' : 'Alternativa orientativa usando LT2 de laboratorio; FTP/LTHR no confirmado de forma independiente.')}</p>}
        {displayZones.some(z => z.calculation?.custom) && <p className="mt-1 font-semibold">{en ? 'Custom limits edited from this method.' : 'Límites personalizados a partir de este método.'}</p>}
      </div>
      {(error || saveError) && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{saveError ?? error}</p>}
      {!!displayZones.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
        <th className="p-3">{en ? 'Zone' : 'Zona'}</th><th className="p-3">{en ? 'Name' : 'Nombre'}</th>{hasHR && <th className="p-3">FC · bpm</th>}{hasPower && <th className="p-3">{en ? 'Power · W' : 'Potencia · W'}</th>}{hasPace && <th className="p-3">{en ? 'Pace (fast → slow)' : 'Ritmo (rápido → lento)'}</th>}{hasRPE && <th className="p-3">RPE · 1–10</th>}
      </tr></thead><tbody>{displayZones.map(z => <tr key={z.zone} className="border-b border-gray-100 dark:border-gray-700">
        <td className="p-3"><span className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border-2 font-bold ${getZoneColor(z.zone, count as 5 | 7)} ${getZoneTextColor(z.zone, count as 5 | 7)}`}>{z.zone_label ?? z.zone}</span></td><td className="p-3 font-semibold text-gray-900 dark:text-white">{z.name}</td>
        {hasHR && <td className="whitespace-nowrap p-3 font-mono text-gray-700 dark:text-gray-200">{editing ? inputPair(z, 'hr_min', 'hr_max') : z.hr_label || range(z.hr_min, z.hr_max, 'bpm')}</td>}
        {hasPower && <td className="whitespace-nowrap p-3 font-mono text-gray-700 dark:text-gray-200">{editing && !z.power_label ? inputPair(z, 'power_min', 'power_max') : z.power_label || range(z.power_min, z.power_max, 'W')}</td>}
        {hasPace && <td className="whitespace-nowrap p-3 font-mono text-gray-700 dark:text-gray-200">{editing ? inputPair(z, 'pace_min', 'pace_max') : formatZonePace(z, sport)}</td>}
        {hasRPE && <td className="p-3 text-gray-700 dark:text-gray-200">{editing ? inputPair(z, 'rpe_min', 'rpe_max') : range(z.rpe_min, z.rpe_max, '')}</td>}
      </tr>)}</tbody></table></div>}
      {!isLocked && !!displayZones.length && <div className="flex flex-wrap items-center gap-2">
        {!editing && <button disabled={saving} onClick={startEditing} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:text-white"><Pencil size={15} />{en ? 'Edit limits' : 'Editar límites'}</button>}
        <button disabled={saving} onClick={persist} className="flex items-center gap-1 rounded-lg bg-[#5A4E6B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} />{saving ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save athlete prescription (optional)' : 'Guardar prescripción del atleta (opcional)')}</button>
        {editing && <button disabled={saving} onClick={() => { setEditing(false); setSaveError(null); }} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-300"><X size={15} />{en ? 'Cancel' : 'Cancelar'}</button>}
        {saved && <span role="status" className="text-sm text-green-700 dark:text-green-300">{en ? 'Zones saved' : 'Zonas guardadas'}</span>}
      </div>}
      <p className="text-xs text-gray-500">{en ? 'Open-ended ranges have no artificial ceiling. Rounded pace is for display; exact speed boundaries determine continuous zones. HR does not distinguish short anaerobic and sprint efforts.' : 'Los rangos abiertos no tienen techo artificial. El ritmo se redondea para mostrarlo; los límites exactos se conservan en velocidad. La FC no discrimina esfuerzos anaeróbicos cortos ni sprints.'}</p>
    </div>
  </section>;
}
