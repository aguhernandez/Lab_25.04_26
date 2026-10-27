import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TestDataPoint } from '../types';
import type { PhysiologyResults } from '../lib/physiology';
import { parseSpeedKmh } from '../lib/lactateAnalysis';
import {
  buildLactateFluxCurve,
  createLactateDynamicsModel,
  estimateRecoveryMinutes,
  lactateFluxAt,
  simulateLactateProtocol,
  type LactateLoadUnit,
  type LactateProtocolSegment,
} from '../lib/lactateDynamics';
import { supabase } from '../lib/supabase';
import MLSSMetabolicPanel from './MLSSMetabolicPanel';

interface Props {
  testId?: string;
  bodyMassKg?: number | null;
  dataPoints: TestDataPoint[];
  results: PhysiologyResults;
}

interface SavedVLamax {
  input?: { distributionVolumeLPerKg?: number; preLactateSamples?: number[] };
  result?: { netRateMmolLSecond?: number; preLactateMmol?: number };
}

const fieldClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#5A4E6B] focus:outline-none focus:ring-2 focus:ring-[#5A4E6B]/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const tooltipStyle = { backgroundColor: 'rgba(255,255,255,0.98)', border: '1px solid #e5e7eb', borderRadius: '0.5rem', color: '#1f2937', fontSize: '12px' };

export default function LactateDynamicsPanel({ testId, bodyMassKg, dataPoints, results }: Props) {
  const [vlamax, setVlamax] = useState('');
  const [distribution, setDistribution] = useState('0.50');
  const [baseline, setBaseline] = useState('1.0');
  const [referenceLactate, setReferenceLactate] = useState('4.0');
  const [selectedLoad, setSelectedLoad] = useState('');
  const [workLoad, setWorkLoad] = useState('');
  const [workSeconds, setWorkSeconds] = useState('180');
  const [recoveryLoad, setRecoveryLoad] = useState('');
  const [recoverySeconds, setRecoverySeconds] = useState('180');
  const [repeats, setRepeats] = useState('4');
  const [source, setSource] = useState<'saved' | 'manual' | 'missing'>('missing');

  const powerLoads = useMemo(() => dataPoints.map(point => Number(point.power_watts)).filter(load => Number.isFinite(load) && load > 0), [dataPoints]);
  const speedLoads = useMemo(() => dataPoints.map(point => parseSpeedKmh(point.speed_pace)).filter((load): load is number => load != null), [dataPoints]);
  const loadUnit: LactateLoadUnit | null = powerLoads.length >= 2 ? 'W' : speedLoads.length >= 2 ? 'km/h' : null;
  const loads = loadUnit === 'W' ? powerLoads : speedLoads;
  const maxLoad = loads.length ? Math.max(...loads) : 0;
  const lt1Load = loadUnit === 'W' ? results.lt1_power : results.lactate_analysis?.lt1?.speedKmh ?? results.lactate_analysis?.lt1?.load;
  const lt2Load = loadUnit === 'W' ? results.lt2_power : results.lactate_analysis?.lt2?.speedKmh ?? results.lactate_analysis?.lt2?.load;
  const lt2Lactate = results.lactate_analysis?.lt2?.lactate ?? 4;

  useEffect(() => {
    if (!testId) return;
    void supabase.from('test_results').select('vlamax_assessment').eq('test_id', testId).maybeSingle().then(({ data }) => {
      const saved = (data as { vlamax_assessment?: SavedVLamax } | null)?.vlamax_assessment;
      const savedRate = saved?.result?.netRateMmolLSecond;
      if (savedRate && savedRate > 0) {
        setVlamax(String(savedRate));
        setDistribution(String(saved.input?.distributionVolumeLPerKg ?? 0.5));
        setBaseline(String(saved.result?.preLactateMmol ?? saved.input?.preLactateSamples?.[0] ?? 1));
        setSource('saved');
      }
    });
  }, [testId]);

  useEffect(() => {
    if (!maxLoad) return;
    setSelectedLoad(current => current || String(Math.round((lt2Load ?? maxLoad * 0.75) * 10) / 10));
    setWorkLoad(current => current || String(Math.round(maxLoad * 0.9 * 10) / 10));
    setRecoveryLoad(current => current || String(Math.round(maxLoad * 0.4 * 10) / 10));
    setReferenceLactate(current => current === '4.0' ? String(Math.round(lt2Lactate * 10) / 10) : current);
  }, [maxLoad, lt2Load, lt2Lactate]);

  const model = useMemo(() => {
    const rate = Number(vlamax);
    const mass = Number(bodyMassKg);
    const vo2max = Number(results.vo2max);
    if (!loadUnit || !maxLoad || !(rate > 0) || !(mass > 0) || !(vo2max > 0)) return null;
    return createLactateDynamicsModel({
      vlamaxMmolLSecond: rate,
      vo2maxMlKgMin: vo2max,
      bodyMassKg: mass,
      distributionVolumeLPerKg: Number(distribution) || 0.5,
      baselineLactateMmol: Number(baseline) || 1,
      maxLoad,
      lt1Load,
      lt2Load,
      lt2LactateMmol: lt2Lactate,
      loadUnit,
    });
  }, [vlamax, bodyMassKg, results.vo2max, distribution, baseline, maxLoad, lt1Load, lt2Load, lt2Lactate, loadUnit]);

  const curve = useMemo(() => model ? buildLactateFluxCurve(model, Number(referenceLactate) || 4) : [], [model, referenceLactate]);
  const selectedFlux = useMemo(() => model ? lactateFluxAt(model, Number(selectedLoad) || 0, Number(referenceLactate) || 4) : null, [model, selectedLoad, referenceLactate]);
  const protocol = useMemo<LactateProtocolSegment[]>(() => {
    const count = Math.max(1, Math.min(20, Math.round(Number(repeats) || 1)));
    return Array.from({ length: count }).flatMap((_, index) => [
      { label: `Trabajo ${index + 1}`, load: Number(workLoad) || 0, durationSeconds: Math.max(5, Number(workSeconds) || 5) },
      { label: `Recuperación ${index + 1}`, load: Number(recoveryLoad) || 0, durationSeconds: Math.max(5, Number(recoverySeconds) || 5) },
    ]);
  }, [repeats, workLoad, workSeconds, recoveryLoad, recoverySeconds]);
  const timeline = useMemo(() => model ? simulateLactateProtocol(model, protocol) : [], [model, protocol]);
  const peakBloodLactate = timeline.length ? Math.max(...timeline.map(point => point.bloodLactateMmol)) : Number(baseline) || 1;
  const recoveryMinutes = model ? estimateRecoveryMinutes(model, peakBloodLactate, Number(recoveryLoad) || 0) : null;
  const timelineChart = timeline.map(point => ({ ...point, minutes: Number((point.timeSeconds / 60).toFixed(2)) }));

  const missing: string[] = [];
  if (!loadUnit) missing.push('potencia o velocidad');
  if (!(Number(bodyMassKg) > 0)) missing.push('masa corporal');
  if (!(Number(results.vo2max) > 0)) missing.push('VO₂max');
  if (!(Number(vlamax) > 0)) missing.push('VLamax');

  return (
    <div className="space-y-5">
      <div className="border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
        Modelo dinámico de un compartimento con retardo sanguíneo. Se calibra con VLamax, VO₂max y los umbrales del atleta; sirve para comparar escenarios, no sustituye una medición directa con trazadores.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">VLamax (mmol/L/s)<input className={fieldClass} type="number" min="0.05" max="2" step="0.01" value={vlamax} onChange={event => { setVlamax(event.target.value); setSource('manual'); }} placeholder="0.45" /><span className="mt-1 block font-normal text-gray-400">{source === 'saved' ? 'Cargada de la evaluación guardada' : 'Introduce o calcula VLamax'}</span></label>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Lactato de referencia (mmol/L)<input className={fieldClass} type="number" min="0.5" max="20" step="0.1" value={referenceLactate} onChange={event => setReferenceLactate(event.target.value)} /><span className="mt-1 block font-normal text-gray-400">La oxidación efectiva depende de este valor</span></label>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Carga seleccionada ({loadUnit ?? '—'})<input className={fieldClass} type="number" min="0" max={maxLoad || undefined} step="1" value={selectedLoad} onChange={event => setSelectedLoad(event.target.value)} /></label>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Volumen de distribución (L/kg)<input className={fieldClass} type="number" min="0.35" max="0.65" step="0.01" value={distribution} onChange={event => setDistribution(event.target.value)} /></label>
      </div>

      {missing.length > 0 && <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">Faltan datos para calcular el modelo: {missing.join(', ')}.</div>}

      {model && selectedFlux && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Producción" value={selectedFlux.productionMmolLMin} unit="mmol/L/min" color="text-rose-600" />
          <Metric label="Oxidación efectiva" value={selectedFlux.oxidationMmolLMin} unit="mmol/L/min" color="text-blue-600" />
          <Metric label="Máxima oxidación" value={selectedFlux.oxidationCapacityMmolLMin} unit="mmol/L/min" color="text-emerald-600" />
          <Metric label="Acumulación neta" value={selectedFlux.netMmolLMin} unit="mmol/L/min" color={selectedFlux.netMmolLMin > 0 ? 'text-rose-600' : 'text-emerald-600'} />
          <Metric label="Equilibrio estimado" value={selectedFlux.equilibriumLactateMmol ?? 'No estable'} unit={selectedFlux.equilibriumLactateMmol == null ? '' : 'mmol/L'} color={selectedFlux.stable ? 'text-emerald-600' : 'text-rose-600'} />
        </div>

        <section className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <div className="mb-3"><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Producción, oxidación y acumulación por carga</h5><p className="text-xs text-gray-500 dark:text-gray-400">Oxidación y neto calculados a {referenceLactate} mmol/L. La línea neta bajo cero indica capacidad de aclaramiento.</p></div>
          <ResponsiveContainer width="100%" height={320}><LineChart data={curve}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="load" stroke="#9ca3af" unit={` ${loadUnit}`} /><YAxis stroke="#9ca3af" unit=" /min" /><Tooltip contentStyle={tooltipStyle} /><Legend /><ReferenceLine y={0} stroke="#6b7280" /><ReferenceLine x={model.parameters.lt2Load} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: 'LT2', fill: '#7c3aed', fontSize: 11 }} /><Line type="monotone" dataKey="productionMmolLMin" name="Producción" stroke="#e11d48" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="oxidationMmolLMin" name="Oxidación efectiva" stroke="#2563eb" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="oxidationCapacityMmolLMin" name="Oxidación máxima" stroke="#059669" strokeDasharray="5 3" dot={false} /><Line type="monotone" dataKey="netMmolLMin" name="Acumulación neta" stroke="#f59e0b" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer>
        </section>

        <MLSSMetabolicPanel testId={testId} bodyMassKg={bodyMassKg} dataPoints={dataPoints} results={results} model={model} loadUnit={model.input.loadUnit} />

        <section className="border-t border-gray-200 pt-5 dark:border-gray-700">
          <div className="mb-4"><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Simulador de intervalos</h5><p className="text-xs text-gray-500 dark:text-gray-400">Simula el lactato metabólico y el lactato sanguíneo observable con retardo.</p></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5"><NumberField label={`Trabajo (${loadUnit})`} value={workLoad} onChange={setWorkLoad} /><NumberField label="Duración trabajo (s)" value={workSeconds} onChange={setWorkSeconds} /><NumberField label={`Recuperación (${loadUnit})`} value={recoveryLoad} onChange={setRecoveryLoad} /><NumberField label="Duración recup. (s)" value={recoverySeconds} onChange={setRecoverySeconds} /><NumberField label="Repeticiones" value={repeats} onChange={setRepeats} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Pico sanguíneo" value={peakBloodLactate.toFixed(2)} unit="mmol/L" /><Metric label="Recuperación a basal +0.5" value={recoveryMinutes ?? '>60'} unit="min" /><Metric label="Duración total" value={(timeline.length ? timeline[timeline.length - 1].timeSeconds / 60 : 0).toFixed(1)} unit="min" /></div>
          <div className="mt-4"><ResponsiveContainer width="100%" height={300}><LineChart data={timelineChart}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="minutes" stroke="#9ca3af" unit=" min" /><YAxis stroke="#9ca3af" unit=" mmol/L" /><Tooltip contentStyle={tooltipStyle} /><Legend /><ReferenceLine y={Number(baseline) + 0.5} stroke="#10b981" strokeDasharray="4 4" /><Line type="monotone" dataKey="bloodLactateMmol" name="Lactato sanguíneo" stroke="#7c3aed" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="metabolicLactateMmol" name="Pool metabólico" stroke="#f97316" strokeDasharray="5 3" dot={false} /></LineChart></ResponsiveContainer></div>
        </section>

        <details className="border-y border-gray-200 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"><summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200">Supuestos y calidad del modelo</summary><div className="mt-2 space-y-1"><p>Producción máxima: {model.parameters.maxProductionMmolLMin} mmol/L/min · oxidación máxima estimada: {model.parameters.maxOxidationMmolLMin} mmol/L/min · pico de oxidación: {model.parameters.oxidationPeakLoad} {loadUnit}.</p><p>El modelo calibra el cruce producción–oxidación alrededor de LT2 y usa un retardo sanguíneo de {model.parameters.bloodLagSeconds}s.</p>{model.issues.map(issue => <p key={issue} className="text-amber-700 dark:text-amber-300">{issue}</p>)}</div></details>
      </>}
    </div>
  );
}

function Metric({ label, value, unit, color = 'text-gray-900 dark:text-white' }: { label: string; value: string | number; unit: string; color?: string }) {
  return <div className="border-l border-gray-200 px-3 first:border-l-0 dark:border-gray-700"><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-1 text-lg font-bold ${color}`}>{value}<span className="ml-1 text-xs font-normal text-gray-500">{unit}</span></p></div>;
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}<input className={fieldClass} type="number" min="0" value={value} onChange={event => onChange(event.target.value)} /></label>;
}
