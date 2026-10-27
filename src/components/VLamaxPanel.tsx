import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calculateVLamax, type AlacticMethod, type PowerSample, type TimedLactateSample, type VLamaxInput, type VLamaxResult } from '../lib/vlamax';

interface Props { testId: string; bodyMassKg?: number | null }
interface SavedAssessment { version: 1; input: VLamaxInput; result: VLamaxResult; savedAt: string }

const parseNumbers = (value: string) => value.split(/[;,\s]+/).map(entry => entry.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
function parsePairs(value: string): Array<[number, number]> {
  return value.split(/[;\n]+/).flatMap(entry => {
    const pair = entry.trim().split(/[:,]/).map(Number);
    return pair.length === 2 && pair.every(Number.isFinite) ? [[pair[0], pair[1]] as [number, number]] : [];
  });
}

export default function VLamaxPanel({ testId, bodyMassKg }: Props) {
  const [duration, setDuration] = useState('12');
  const [pre, setPre] = useState('1.0, 1.1');
  const [post, setPost] = useState('60:5; 180:8; 300:10; 420:9; 540:7.5');
  const [method, setMethod] = useState<AlacticMethod>('measured');
  const [alactic, setAlactic] = useState('3');
  const [power, setPower] = useState('0:900; 1:1000; 2:980; 3:960');
  const [distribution, setDistribution] = useState('0.50');
  const [clearance, setClearance] = useState(false);
  const [result, setResult] = useState<VLamaxResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from('test_results').select('vlamax_assessment').eq('test_id', testId).maybeSingle().then(({ data }) => {
      const saved = (data as { vlamax_assessment?: SavedAssessment } | null)?.vlamax_assessment;
      if (!saved?.input || !saved.result) return;
      setDuration(String(saved.input.sprintDurationSeconds));
      setPre(saved.input.preLactateSamples.join(', '));
      setPost(saved.input.postLactateSamples.map(sample => `${sample.timeSeconds}:${sample.lactateMmol}`).join('; '));
      setMethod(saved.input.alacticMethod);
      setAlactic(String(saved.input.alacticSeconds ?? 0));
      setPower((saved.input.powerSamples ?? []).map(sample => `${sample.timeSeconds}:${sample.powerWatts}`).join('; '));
      setDistribution(String(saved.input.distributionVolumeLPerKg ?? 0.5));
      setClearance(Boolean(saved.input.applyClearanceCorrection));
      setResult(saved.result);
    });
  }, [testId]);

  const input = useMemo<VLamaxInput>(() => ({
    sprintDurationSeconds: Number(duration),
    preLactateSamples: parseNumbers(pre),
    postLactateSamples: parsePairs(post).map(([timeSeconds, lactateMmol]): TimedLactateSample => ({ timeSeconds, lactateMmol })),
    alacticMethod: method,
    alacticSeconds: method === 'measured' ? Number(alactic) : null,
    powerSamples: method === 'power_drop_proxy' ? parsePairs(power).map(([timeSeconds, powerWatts]): PowerSample => ({ timeSeconds, powerWatts })) : [],
    bodyMassKg: Number(bodyMassKg ?? 0),
    distributionVolumeLPerKg: Number(distribution),
    applyClearanceCorrection: clearance,
  }), [duration, pre, post, method, alactic, power, bodyMassKg, distribution, clearance]);

  const calculate = () => { setResult(calculateVLamax(input)); setMessage(null); };
  const save = async () => {
    const calculated = calculateVLamax(input);
    setResult(calculated);
    if (calculated.confidence === 'invalid') { setMessage('Correct the protocol errors before saving.'); return; }
    setSaving(true);
    const assessment: SavedAssessment = { version: 1, input, result: calculated, savedAt: new Date().toISOString() };
    const { error } = await supabase.from('test_results').upsert({ test_id: testId, vlamax_assessment: assessment }, { onConflict: 'test_id' });
    setMessage(error ? error.message : 'VLamax assessment saved.');
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Estimación sanguínea indirecta</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">Usa un sprint máximo de 10–12 s y muestras posteriores hasta confirmar el pico. No equivale a una medición directa del flujo glucolítico.</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-gray-900/30 dark:text-amber-200">{result ? result.confidence.toUpperCase() : 'SIN CALCULAR'}</span>
      </div>

      <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
        <div className="mb-3 flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5A4E6B] text-xs font-bold text-white">1</span><div><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Prepara el protocolo</h5><p className="text-xs text-gray-500 dark:text-gray-400">Define el sprint y cómo se estimará el tiempo aláctico.</p></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Duración del sprint (s)<input className="input mt-1" type="number" min="8" max="30" value={duration} onChange={event => setDuration(event.target.value)} /><span className="mt-1 block font-normal text-gray-400">Recomendado: 10–12 s</span></label>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Masa corporal (kg)<input className="input mt-1 bg-gray-100 dark:bg-gray-800" value={bodyMassKg ?? ''} disabled /><span className="mt-1 block font-normal text-gray-400">Se toma del test</span></label>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Volumen de distribución (L/kg)<input className="input mt-1" type="number" min="0.35" max="0.65" step="0.01" value={distribution} onChange={event => setDistribution(event.target.value)} /><span className="mt-1 block font-normal text-gray-400">Valor inicial: 0.50</span></label>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Corrección aláctica<select className="input mt-1" value={method} onChange={event => setMethod(event.target.value as AlacticMethod)}><option value="measured">Tiempo introducido</option><option value="power_drop_proxy">Caída de potencia</option><option value="uncorrected">Sin corrección (vLapeak)</option></select></label>
          {method === 'measured' && <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Tiempo aláctico (s)<input className="input mt-1" type="number" step="0.1" value={alactic} onChange={event => setAlactic(event.target.value)} /></label>}
          {method === 'power_drop_proxy' && <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 sm:col-span-2 lg:col-span-3">Potencia — segundos:vatios<input className="input mt-1" value={power} onChange={event => setPower(event.target.value)} placeholder="0:900; 1:1000; 2:980; 3:960" /></label>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/30">
        <div className="mb-3 flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5A4E6B] text-xs font-bold text-white">2</span><div><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Carga las muestras</h5><p className="text-xs text-gray-500 dark:text-gray-400">Usa mmol/L. Los tiempos son segundos después de terminar el sprint.</p></div></div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Lactato basal (mmol/L)<input className="input mt-1" value={pre} onChange={event => setPre(event.target.value)} placeholder="1.0, 1.1" /><span className="mt-1 block font-normal text-gray-400">Recomendado: 2–3 muestras cercanas</span></label>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Muestras posteriores — tiempo:lactato<input className="input mt-1" value={post} onChange={event => setPost(event.target.value)} placeholder="60:5; 180:8; 300:10; 420:9" /><span className="mt-1 block font-normal text-gray-400">Continúa hasta observar dos descensos seguidos</span></label>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={clearance} onChange={event => setClearance(event.target.checked)} />Aplicar sensibilidad experimental de producción y eliminación</label>
      </section>

      <div className="flex flex-wrap items-center gap-3"><button className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600" onClick={calculate}>Calcular VLamax</button><button className="rounded-lg bg-[#5A4E6B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#493e58] disabled:opacity-50" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar evaluación'}</button>{message && <span className="text-xs text-gray-600 dark:text-gray-300">{message}</span>}</div>

      {result && <section className="rounded-xl border border-[#d8d0e3] bg-[#faf8fc] p-4 dark:border-[#5A4E6B] dark:bg-[#2a2432]">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#5A4E6B] dark:text-purple-200">3 · Resultado</p><h5 className="text-lg font-bold text-gray-900 dark:text-white">{result.label}</h5></div><p className="text-xs text-gray-500 dark:text-gray-400">Intervalo modelado 95%: {result.confidence95.lower}–{result.confidence95.upper} mmol/L/s</p></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="rounded-lg bg-white p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Tasa neta</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{result.netRateMmolLSecond}<span className="ml-1 text-xs font-normal">mmol/L/s</span></p></div><div className="rounded-lg bg-white p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Tasa absoluta</p><p className="text-lg font-bold text-gray-900 dark:text-white">{result.absoluteNetRateMmolSecond}<span className="ml-1 text-xs font-normal">mmol/s</span></p></div><div className="rounded-lg bg-white p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Pico observado</p><p className="text-lg font-bold text-gray-900 dark:text-white">{result.timeToPeakSeconds}<span className="ml-1 text-xs font-normal">s</span></p><p className="text-xs text-gray-400">ventana {result.timeToPeakRangeSeconds.lower}–{result.timeToPeakRangeSeconds.upper}s</p></div><div className="rounded-lg bg-white p-3 dark:bg-gray-800"><p className="text-xs text-gray-500">Confianza</p><p className="text-lg font-bold uppercase text-gray-900 dark:text-white">{result.confidence}</p></div></div>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">Basal {result.preLactateMmol} · pico {result.peakLactateMmol} · Δ {result.deltaLactateMmol} mmol/L · tiempo glucolítico {result.glycolyticTimeSeconds}s · espacio de distribución {result.distributionVolumeLitres}L</p>
        {result.clearanceCorrectedRateMmolLSecond != null && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Sensibilidad producción/eliminación: {result.clearanceCorrectedRateMmolLSecond} mmol/L/s. Remoción estimada antes del pico: {result.estimatedRemovedLactateMmol} mmol/L. Conserva la tasa neta como resultado principal.</p>}
        {result.issues.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-300">Ver validaciones y advertencias ({result.issues.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">{result.issues.map(issue => <li key={issue.code} className={issue.severity === 'info' ? 'text-gray-500 dark:text-gray-400' : undefined}>{issue.message}</li>)}</ul></details>}
      </section>}
    </div>
  );
}
