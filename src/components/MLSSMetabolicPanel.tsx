import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TestDataPoint } from '../types';
import type { PhysiologyResults } from '../lib/physiology';
import { analyzeLactate, parseSpeedKmh } from '../lib/lactateAnalysis';
import {
  buildMetabolicDemandCurve,
  estimateMLSS,
  evaluateConstantLoadTrials,
  type ConstantLoadLactateTrial,
  type LactateDynamicsModel,
  type LactateLoadUnit,
} from '../lib/lactateDynamics';
import { supabase } from '../lib/supabase';

interface Props {
  testId?: string;
  bodyMassKg?: number | null;
  dataPoints: TestDataPoint[];
  results: PhysiologyResults;
  model: LactateDynamicsModel;
  loadUnit: LactateLoadUnit;
}

interface SavedDynamicsAssessment {
  version?: number;
  confirmationTrials?: ConstantLoadLactateTrial[];
}

const fieldClass = 'w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:border-[#5A4E6B] focus:outline-none focus:ring-2 focus:ring-[#5A4E6B]/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const tooltipStyle = { backgroundColor: 'rgba(255,255,255,0.98)', border: '1px solid #e5e7eb', borderRadius: '0.5rem', color: '#1f2937', fontSize: '12px' };
const newId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function MLSSMetabolicPanel({ testId, bodyMassKg, dataPoints, results, model, loadUnit }: Props) {
  const [trials, setTrials] = useState<ConstantLoadLactateTrial[]>([]);
  const [durationSeconds, setDurationSeconds] = useState('180');
  const [selectedLoad, setSelectedLoad] = useState(String(Math.round(model.parameters.lt2Load)));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!testId) return;
    void supabase.from('test_results').select('lactate_dynamics_assessment').eq('test_id', testId).maybeSingle().then(({ data }) => {
      const saved = (data as { lactate_dynamics_assessment?: SavedDynamicsAssessment } | null)?.lactate_dynamics_assessment;
      if (Array.isArray(saved?.confirmationTrials)) setTrials(saved.confirmationTrials);
    });
  }, [testId]);

  const thresholds = useMemo(() => {
    const iatDeltaMmol = results.lactate_analysis?.config.iatDeltaMmol ?? 1.5;
    const baseConfig = { lt1Method: results.lactate_analysis?.config.lt1Method ?? 'baseline_plus_0_5' as const, iatDeltaMmol };
    return {
      dmax: analyzeLactate(dataPoints, bodyMassKg, { ...baseConfig, lt2Method: 'dmax' }).lt2,
      obla: analyzeLactate(dataPoints, bodyMassKg, { ...baseConfig, lt2Method: 'obla_4mmol' }).lt2,
      iat: analyzeLactate(dataPoints, bodyMassKg, { ...baseConfig, lt2Method: 'iat' }).lt2,
      active: results.lactate_analysis?.config.lt2Method ?? 'dmax',
      iatDeltaMmol,
    };
  }, [dataPoints, bodyMassKg, results.lactate_analysis]);

  const estimatedMLSS = useMemo(() => estimateMLSS(model), [model]);
  const measuredMLSS = useMemo(() => evaluateConstantLoadTrials(trials), [trials]);
  const metabolicSamples = useMemo(() => dataPoints.flatMap(point => {
    const load = loadUnit === 'W' ? Number(point.power_watts) : parseSpeedKmh(point.speed_pace);
    if (!(load != null && Number.isFinite(load) && load >= 0)) return [];
    return [{ load, vo2MlKgMin: point.vo2_ml_kg_min, vco2MlKgMin: point.vco2_ml_kg_min }];
  }), [dataPoints, loadUnit]);
  const demand = useMemo(() => buildMetabolicDemandCurve(model, metabolicSamples, Math.max(10, Number(durationSeconds) || 180)), [model, metabolicSamples, durationSeconds]);
  const selectedDemand = useMemo(() => demand.points.reduce((best, point) => Math.abs(point.load - Number(selectedLoad)) < Math.abs(best.load - Number(selectedLoad)) ? point : best, demand.points[0]), [demand, selectedLoad]);

  const thresholdLoad = (threshold: typeof thresholds.dmax) => {
    if (!threshold) return null;
    return loadUnit === 'W' ? threshold.power ?? threshold.load : threshold.speedKmh ?? threshold.load;
  };

  const updateTrial = (id: string, key: keyof ConstantLoadLactateTrial, value: string) => {
    setTrials(current => current.map(trial => trial.id === id ? { ...trial, [key]: key === 'date' ? value : Number(value) } : trial));
    setSaveState('idle');
  };

  const addTrial = () => {
    const suggestedLoad = trials.length ? Math.max(...trials.map(trial => trial.load)) + (loadUnit === 'W' ? 5 : 0.2) : estimatedMLSS.load;
    setTrials(current => [...current, { id: newId(), load: Number(suggestedLoad.toFixed(1)), lactate10Mmol: 0, lactate20Mmol: 0, lactate30Mmol: 0 }]);
    setSaveState('idle');
  };

  const saveTrials = async () => {
    if (!testId) return;
    setSaveState('saving');
    const assessment = { version: 1, confirmationTrials: trials, updatedAt: new Date().toISOString() };
    const { error } = await supabase.from('test_results').upsert({ test_id: testId, lactate_dynamics_assessment: assessment }, { onConflict: 'test_id' });
    setSaveState(error ? 'error' : 'saved');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
        <h5 className="text-sm font-semibold text-violet-950 dark:text-violet-100">MLSS: estimación y confirmación</h5>
        <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">LT2, OBLA e IAT proceden del test incremental. MLSS estimado simula 30 minutos; solo los tests constantes registrados abajo pueden marcar MLSS como medido.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ThresholdCard label="LT2 matemático" method="Dmax" value={thresholdLoad(thresholds.dmax)} unit={loadUnit} active={thresholds.active === 'dmax'} />
        <ThresholdCard label="OBLA" method="4.0 mmol/L" value={thresholdLoad(thresholds.obla)} unit={loadUnit} active={thresholds.active === 'obla_4mmol'} />
        <ThresholdCard label="IAT" method={`basal + ${thresholds.iatDeltaMmol}`} value={thresholdLoad(thresholds.iat)} unit={loadUnit} active={thresholds.active === 'iat'} />
        <ThresholdCard label="MLSS estimado" method={`Δ10–30: ${estimatedMLSS.drift10To30Mmol} mmol/L`} value={estimatedMLSS.load} unit={loadUnit} />
        <ThresholdCard label="MLSS medido" method={measuredMLSS.status === 'confirmed' ? 'Confirmado' : measuredMLSS.status === 'lower_bound' ? 'Límite inferior' : 'Sin confirmar'} value={measuredMLSS.load} unit={loadUnit} />
      </div>

      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Tests constantes de confirmación</h5><p className="text-xs text-gray-500 dark:text-gray-400">Estable: aumento de lactato ≤1.0 mmol/L entre minuto 10 y 30. Para confirmar el límite se necesita además un test superior inestable.</p></div>
          <button type="button" onClick={addTrial} className="rounded-lg bg-[#5A4E6B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#493e58]">Añadir test</button>
        </div>
        {trials.length === 0 ? <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">Aún no hay tests constantes. El valor mostrado arriba sigue siendo una estimación.</p> : (
          <div className="mt-4 space-y-2">
            <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-2 px-1 text-xs font-semibold text-gray-500 sm:grid"><span>Carga ({loadUnit})</span><span>Lactato 10'</span><span>Lactato 20'</span><span>Lactato 30'</span><span>Resultado</span><span /></div>
            {trials.map(trial => {
              const evaluated = evaluateConstantLoadTrials([trial]).trials[0];
              return <div key={trial.id} className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] dark:bg-gray-800/60">
                <input aria-label={`Carga ${loadUnit}`} className={fieldClass} type="number" min="0" step={loadUnit === 'W' ? 1 : 0.1} value={trial.load || ''} onChange={event => updateTrial(trial.id, 'load', event.target.value)} />
                <input aria-label="Lactato minuto 10" className={fieldClass} type="number" min="0" max="25" step="0.1" value={trial.lactate10Mmol || ''} onChange={event => updateTrial(trial.id, 'lactate10Mmol', event.target.value)} />
                <input aria-label="Lactato minuto 20" className={fieldClass} type="number" min="0" max="25" step="0.1" value={trial.lactate20Mmol || ''} onChange={event => updateTrial(trial.id, 'lactate20Mmol', event.target.value)} />
                <input aria-label="Lactato minuto 30" className={fieldClass} type="number" min="0" max="25" step="0.1" value={trial.lactate30Mmol || ''} onChange={event => updateTrial(trial.id, 'lactate30Mmol', event.target.value)} />
                <span className={`self-center rounded-full px-2 py-1 text-center text-xs font-semibold ${evaluated?.stable ? 'bg-emerald-100 text-emerald-700' : evaluated ? 'bg-rose-100 text-rose-700' : 'bg-gray-200 text-gray-500'}`}>{evaluated ? `${evaluated.stable ? 'Estable' : 'Inestable'} · Δ${evaluated.drift10To30Mmol}` : 'Incompleto'}</span>
                <button type="button" aria-label="Eliminar test" onClick={() => { setTrials(current => current.filter(item => item.id !== trial.id)); setSaveState('idle'); }} className="px-2 text-lg text-gray-400 hover:text-rose-600">×</button>
              </div>;
            })}
            <div className="flex items-center gap-3 pt-2"><button type="button" disabled={!testId || saveState === 'saving'} onClick={() => void saveTrials()} className="rounded-lg border border-[#5A4E6B] px-3 py-2 text-xs font-semibold text-[#5A4E6B] disabled:opacity-50 dark:text-violet-300">{saveState === 'saving' ? 'Guardando…' : 'Guardar confirmaciones'}</button><span className={`text-xs ${saveState === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>{saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'No se pudo guardar' : !testId ? 'Guarda primero el test principal' : ''}</span></div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Demanda metabólica continua</h5><p className="text-xs text-gray-500 dark:text-gray-400">Demanda, VO₂ alcanzado y déficit en equivalentes de O₂. La glucólisis se limita con VLamax.</p></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs text-gray-500">Carga ({loadUnit})<input className={fieldClass} type="number" min="0" max={model.input.maxLoad} value={selectedLoad} onChange={event => setSelectedLoad(event.target.value)} /></label><label className="text-xs text-gray-500">Duración (s)<input className={fieldClass} type="number" min="10" value={durationSeconds} onChange={event => setDurationSeconds(event.target.value)} /></label></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <DemandMetric label="Demanda O₂" value={selectedDemand.oxygenDemandMlKgMin} unit="ml/kg/min" />
          <DemandMetric label="VO₂ alcanzado" value={selectedDemand.actualVo2MlKgMin} unit="ml/kg/min" />
          <DemandMetric label="Déficit O₂" value={selectedDemand.oxygenDeficitMlKgMin} unit="ml/kg/min" />
          <DemandMetric label="Aeróbico" value={selectedDemand.aerobicPercent} unit="%" color="text-blue-600" />
          <DemandMetric label="Anaeróbico" value={selectedDemand.anaerobicPercent} unit="%" color="text-rose-600" />
          <DemandMetric label="No cubierto" value={selectedDemand.unmetPercent} unit="%" color={selectedDemand.unmetPercent > 0 ? 'text-amber-600' : 'text-emerald-600'} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ResponsiveContainer width="100%" height={290}><LineChart data={demand.points}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="load" stroke="#9ca3af" unit={` ${loadUnit}`} /><YAxis stroke="#9ca3af" unit=" ml/kg/min" /><Tooltip contentStyle={tooltipStyle} /><Legend /><ReferenceLine x={estimatedMLSS.load} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: 'MLSS est.', fill: '#7c3aed', fontSize: 11 }} /><Line type="monotone" dataKey="oxygenDemandMlKgMin" name="Demanda O₂" stroke="#111827" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="actualVo2MlKgMin" name="VO₂ alcanzado" stroke="#2563eb" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="oxygenDeficitMlKgMin" name="Déficit O₂" stroke="#e11d48" strokeDasharray="5 3" dot={false} /></LineChart></ResponsiveContainer>
          <ResponsiveContainer width="100%" height={290}><LineChart data={demand.points}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="load" stroke="#9ca3af" unit={` ${loadUnit}`} /><YAxis domain={[0, 100]} stroke="#9ca3af" unit="%" /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" dataKey="aerobicPercent" name="Aeróbico" stroke="#2563eb" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="anaerobicPercent" name="Anaeróbico" stroke="#e11d48" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="fatPercent" name="Grasas" stroke="#10b981" strokeDasharray="5 3" dot={false} /><Line type="monotone" dataKey="carbohydratePercent" name="Carbohidratos" stroke="#f59e0b" strokeDasharray="5 3" dot={false} /></LineChart></ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Demanda: {demand.demandSource === 'measured_regression' ? 'regresión de VO₂ medido frente a carga' : 'inferida por VO₂max y carga máxima'} · RER en la carga seleccionada: {selectedDemand.rer.toFixed(2)} ({selectedDemand.rerSource === 'measured' ? 'VO₂/VCO₂ medidos' : 'estimado'}) · constante temporal VO₂: {demand.vo2TimeConstantSeconds}s. Los porcentajes son equivalentes energéticos del modelo, no calorimetría directa durante el esfuerzo.</p>
      </div>
    </div>
  );
}

function ThresholdCard({ label, method, value, unit, active = false }: { label: string; method: string; value: number | null; unit: string; active?: boolean }) {
  return <div className={`rounded-xl border p-3 ${active ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'}`}><div className="flex items-center justify-between gap-1"><p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>{active && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">ACTIVO</span>}</div><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value == null ? '—' : value.toFixed(1)} <span className="text-xs font-normal text-gray-500">{value == null ? '' : unit}</span></p><p className="text-[11px] text-gray-500">{method}</p></div>;
}

function DemandMetric({ label, value, unit, color = 'text-gray-900 dark:text-white' }: { label: string; value: number; unit: string; color?: string }) {
  return <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60"><p className="text-xs text-gray-500">{label}</p><p className={`mt-1 text-lg font-bold ${color}`}>{value.toFixed(1)} <span className="text-[10px] font-normal text-gray-500">{unit}</span></p></div>;
}
