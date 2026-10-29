import { useEffect, useState } from 'react';
import type { Test, TestDataPoint } from '../types';
import { supabase } from '../lib/supabase';
import { paceToKmh } from '../lib/trainingZones';
import { classifyDifference, measuredAtLoad, type Measurement } from '../lib/longitudinalComparison';

export default function LongitudinalComparison({ tests }: { tests: Array<Test & { result?: { lt2_power?: number | null; lt2_pace?: string | null } | null }> }) {
  const available = tests.filter(t => t.status === 'completed');
  const [firstId, setFirstId] = useState(available[1]?.id ?? '');
  const [secondId, setSecondId] = useState(available[0]?.id ?? '');
  const [loadedPair, setLoadedPair] = useState('');
  const [points, setPoints] = useState<TestDataPoint[]>([]); const [error, setError] = useState('');
  const [unit, setUnit] = useState<'W' | 'km/h'>(available[0]?.sport === 'running' || available[0]?.sport === 'swimming' ? 'km/h' : 'W'); const [load, setLoad] = useState('');
  const [metric, setMetric] = useState<Measurement>('lactate'); const [noise, setNoise] = useState('');
  const [lt2Noise, setLt2Noise] = useState('');
  const first = available.find(t => t.id === firstId), second = available.find(t => t.id === secondId);
  useEffect(() => {
    if (!available.some(t => t.id === firstId)) setFirstId(available[1]?.id ?? '');
    if (!available.some(t => t.id === secondId)) setSecondId(available[0]?.id ?? '');
  }, [tests, firstId, secondId]);
  useEffect(() => { setNoise(''); setLt2Noise(''); }, [firstId, secondId, unit]);
  useEffect(() => {
    let cancelled = false;
    setPoints([]); setLoadedPair(''); setError('');
    if (!firstId || !secondId || firstId === secondId) return;
    void (async () => {
      const { data, error: queryError } = await supabase.from('test_data_points').select('*').in('test_id', [firstId, secondId]).order('stage_number');
      if (cancelled) return;
      if (queryError) setError('No se pudieron cargar las etapas. Reintenta o revisa el acceso a los tests.');
      else { setPoints((data ?? []) as TestDataPoint[]); setLoadedPair(`${firstId}|${secondId}`); }
    })().catch(() => { if (!cancelled) setError('No se pudieron cargar las etapas. Reintenta o revisa la conexión.'); });
    return () => { cancelled = true; };
  }, [firstId, secondId]);
  if (available.length < 2) return null;
  const warnings: string[] = [];
  if (first && second) {
    if (first.test_date > second.test_date) warnings.push('El test inicial es posterior al seleccionado como posterior; la diferencia sigue el orden elegido.');
    if (first.sport !== second.sport) warnings.push('Las modalidades son diferentes: selecciona tests del mismo deporte.');
    if (first.test_type !== second.test_type) warnings.push('El tipo de test difiere entre sesiones.');
    if (!first.protocol_id || !second.protocol_id) warnings.push('Falta identificar el protocolo en al menos un test.');
    else if (first.protocol_id !== second.protocol_id || first.protocol_version !== second.protocol_version) warnings.push('El protocolo o su versión cambió entre tests.');
    const methodA = first.anthropometry_snapshot?.threshold_overrides?.lactate_lt2_method, methodB = second.anthropometry_snapshot?.threshold_overrides?.lactate_lt2_method;
    if (methodA && methodB && methodA !== methodB) warnings.push('El método de LT2 registrado cambió entre tests.');
    else if (!methodA || !methodB) warnings.push('Comprueba que ambos LT2 usan el mismo método; no está registrado explícitamente en ambos tests.');
    const a = first.protocol_metadata ?? {}, b = second.protocol_metadata ?? {};
    const durationA = a.stageDurationSeconds ?? a.stageDurationsSeconds, durationB = b.stageDurationSeconds ?? b.stageDurationsSeconds;
    if (durationA == null || durationB == null || (Array.isArray(durationA) && !durationA.length) || (Array.isArray(durationB) && !durationB.length)) warnings.push('La duración de etapas no está registrada en ambos tests.');
    else if (JSON.stringify(durationA) !== JSON.stringify(durationB)) warnings.push('La duración de etapas difiere entre tests.');
    const envA = a.environment as Record<string, unknown> | undefined, envB = b.environment as Record<string, unknown> | undefined;
    const tempA = envA?.temperatureC, tempB = envB?.temperatureC;
    if (tempA == null || tempB == null) warnings.push('No hay temperatura registrada en ambos tests.');
    else if (typeof tempA === 'number' && typeof tempB === 'number' && Math.abs(tempA - tempB) >= 3) warnings.push(`La temperatura difiere ${Math.abs(tempA - tempB).toFixed(1)} °C.`);
    for (const [key, label, tolerance] of [['humidityPercent', 'La humedad', 10], ['altitudeM', 'La altitud', 200]] as const) {
      const x = envA?.[key], y = envB?.[key];
      if (x == null || y == null) warnings.push(`${label} no está registrada en ambos tests.`);
      else if (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) >= tolerance) warnings.push(`${label} difiere entre tests (${x} → ${y}).`);
    }
  }
  const comparable = first && second && firstId !== secondId && first.sport === second.sport && loadedPair === `${firstId}|${secondId}`;
  const a = comparable ? measuredAtLoad(points.filter(p => p.test_id === firstId), first.sport, unit, Number(load), metric) : null;
  const b = comparable ? measuredAtLoad(points.filter(p => p.test_id === secondId), second.sport, unit, Number(load), metric) : null;
  const delta = a != null && b != null ? b - a : null;
  const threshold = noise.trim() ? Number(noise) : null;
  const cls = delta == null ? 'unknown' : classifyDifference(delta, threshold);
  const metricUnit = metric === 'heart_rate' ? 'bpm' : metric === 'lactate' ? 'mmol/L' : 'ml/kg/min';
  const field = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
  const thresholdLoad = (test: typeof first) => unit === 'W' ? test?.result?.lt2_power : test?.result?.lt2_pace && test ? paceToKmh(test.result.lt2_pace, test.sport) : null;
  const lt2Before = thresholdLoad(first), lt2After = thresholdLoad(second);
  const lt2Delta = firstId !== secondId && first?.sport === second?.sport && lt2Before != null && lt2After != null && Number.isFinite(lt2Before) && Number.isFinite(lt2After) ? lt2After - lt2Before : null;
  const lt2Class = lt2Delta == null ? 'unknown' : classifyDifference(lt2Delta, lt2Noise.trim() ? Number(lt2Noise) : null);
  return <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h4 className="font-semibold dark:text-white">Comparación a igual carga</h4><p className="mt-1 text-xs text-gray-500">Elige dos tests y compara las etapas medidas; solo interpolamos dentro del rango de ambos.</p>
    <div className="mt-3 flex flex-wrap gap-2">{([['Inicial', firstId, setFirstId], ['Posterior', secondId, setSecondId]] as const).map(([label, value, set]) => <label key={label} className="text-xs dark:text-gray-200">{label}<select className={`${field} mt-1 block`} value={value} onChange={e => set(e.target.value)}>{available.map(t => <option key={t.id} value={t.id}>{t.test_date} · {t.sport}</option>)}</select></label>)}<label className="text-xs dark:text-gray-200">Carga<select className={`${field} mt-1 block`} value={unit} onChange={e => setUnit(e.target.value as 'W' | 'km/h')}><option>W</option><option>km/h</option></select></label><label className="text-xs dark:text-gray-200">Valor<input className={`${field} mt-1 block w-24`} type="number" min="0" step="any" value={load} onChange={e => setLoad(e.target.value)} /></label><label className="text-xs dark:text-gray-200">Medición<select className={`${field} mt-1 block`} value={metric} onChange={e => { setMetric(e.target.value as Measurement); setNoise(''); }}><option value="lactate">Lactato</option><option value="heart_rate">FC</option><option value="vo2_ml_kg_min">VO₂</option></select></label><label className="text-xs dark:text-gray-200">Cambio mínimo detectable ({metricUnit})<input className={`${field} mt-1 block w-28`} type="number" min="0" step="any" value={noise} onChange={e => setNoise(e.target.value)} /></label></div>
    <p className="mt-2 text-xs text-gray-500">Introduce un cambio mínimo detectable de pruebas repetidas comparables; sin ese dato no se puede separar el cambio del ruido.</p>
    {error ? <p role="alert" className="mt-2 text-sm text-red-600">{error}</p> : delta != null ? <p className="mt-3 text-sm dark:text-white">Inicial {a!.toFixed(2)} → posterior {b!.toFixed(2)} {metricUnit}; diferencia <strong>{delta >= 0 ? '+' : ''}{delta.toFixed(2)} {metricUnit}</strong>. {cls === 'unknown' ? 'Sin umbral de error conocido.' : cls === 'within' ? 'Dentro del umbral de error indicado.' : 'Supera el umbral de error indicado; interpreta junto al protocolo y condiciones.'}</p> : <p className="mt-3 text-xs text-gray-500">{firstId === secondId ? 'Selecciona dos tests distintos.' : 'Ingresa una carga presente o interpolable en ambos tests y verifica que exista la medición.'}</p>}
    {firstId !== secondId && lt2Delta != null && <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900/30 dark:text-white"><p>Carga en LT2: {lt2Before?.toFixed(2)} → {lt2After?.toFixed(2)} {unit} · cambio {lt2Delta >= 0 ? '+' : ''}{lt2Delta.toFixed(2)} {unit}.</p><label className="mt-2 block text-xs">Cambio mínimo detectable de LT2 ({unit}), obtenido de pruebas comparables<input className={`${field} mt-1 block w-28`} type="number" min="0" step="any" value={lt2Noise} onChange={e => setLt2Noise(e.target.value)} /></label><p className="mt-2 text-xs">{lt2Class === 'unknown' ? 'Sin un umbral de repetibilidad no se puede distinguir del ruido.' : lt2Class === 'within' ? 'El cambio está dentro del umbral de error indicado.' : lt2Delta > 0 ? 'El aumento supera el umbral indicado: es compatible con una mejora si el método, el protocolo y las condiciones son comparables.' : 'La reducción supera el umbral indicado; revisa método, protocolo y condiciones antes de interpretarla.'}</p></div>}
    {warnings.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{warnings.map(w => <li key={w}>{w}</li>)}</ul>}
  </section>;
}
