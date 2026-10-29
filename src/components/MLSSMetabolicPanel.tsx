import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Sport, TestDataPoint } from '../types';
import type { PhysiologyResults } from '../lib/physiology';
import { analyzeLactate, parseSpeedKmh } from '../lib/lactateAnalysis';
import {
  buildMetabolicDemandCurve,
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

interface TestContext { athleteId?: string; modality?: string; date?: string }
const confirmationTimes = [5, 10, 15, 20, 25, 30];

const fieldClass = 'w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 focus:border-[#5A4E6B] focus:outline-none focus:ring-2 focus:ring-[#5A4E6B]/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const tooltipStyle = { backgroundColor: 'rgba(255,255,255,0.98)', border: '1px solid #e5e7eb', borderRadius: '0.5rem', color: '#1f2937', fontSize: '12px' };
const newId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function MLSSMetabolicPanel({ testId, bodyMassKg, dataPoints, results, model, loadUnit }: Props) {
  const [trials, setTrials] = useState<ConstantLoadLactateTrial[]>([]);
  const [assessmentOwners, setAssessmentOwners] = useState<string[]>([]);
  const [testContext, setTestContext] = useState<TestContext>({});
  const [proxyMethod, setProxyMethod] = useState<'dmax' | 'iat'>('iat');
  const [durationSeconds, setDurationSeconds] = useState('180');
  const [selectedLoad, setSelectedLoad] = useState(String(Math.round(model.parameters.lt2Load)));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    void (async () => {
      const { data: currentTest } = await supabase.from('tests').select('athlete_id, sport, test_date').eq('id', testId).maybeSingle();
      const context: TestContext = { athleteId: currentTest?.athlete_id, modality: currentTest?.sport, date: currentTest?.test_date };
      if (cancelled) return;
      setTestContext(context);
      let testIds = [testId];
      if (context.athleteId && context.modality) {
        const { data: relatedTests } = await supabase.from('tests').select('id, test_date').eq('athlete_id', context.athleteId).eq('sport', context.modality);
        if (relatedTests?.length) testIds = relatedTests.map(test => test.id);
        const assessmentDates = new Map((relatedTests ?? []).map(test => [test.id, test.test_date]));
        const { data: rows } = await supabase.from('test_results').select('test_id, lactate_dynamics_assessment').in('test_id', testIds);
        if (cancelled) return;
        setAssessmentOwners([...new Set([testId, ...(rows ?? []).filter(row => {
          const assessment = (row as { lactate_dynamics_assessment?: SavedDynamicsAssessment }).lactate_dynamics_assessment;
          return Boolean(assessment?.confirmationTrials?.length);
        }).map(row => row.test_id)])]);
        setTrials((rows ?? []).flatMap(row => {
          const saved = (row as { test_id: string; lactate_dynamics_assessment?: SavedDynamicsAssessment }).lactate_dynamics_assessment;
          return (saved?.confirmationTrials ?? []).map(trial => normalizeSavedTrial(trial, {
            athleteId: context.athleteId, assessmentId: row.test_id, modality: context.modality,
            loadUnit, date: assessmentDates.get(row.test_id) ?? context.date,
          }));
        }));
        return;
      }
      const { data: rows } = await supabase.from('test_results').select('test_id, lactate_dynamics_assessment').in('test_id', testIds);
      if (cancelled) return;
      setAssessmentOwners([testId, ...(rows ?? []).filter(row => {
        const assessment = (row as { lactate_dynamics_assessment?: SavedDynamicsAssessment }).lactate_dynamics_assessment;
        return Boolean(assessment?.confirmationTrials?.length);
      }).map(row => row.test_id)]);
      setTrials((rows ?? []).flatMap(row => {
        const saved = (row as { test_id: string; lactate_dynamics_assessment?: SavedDynamicsAssessment }).lactate_dynamics_assessment;
        return (saved?.confirmationTrials ?? []).map(trial => normalizeSavedTrial(trial, {
          athleteId: context.athleteId, assessmentId: row.test_id, modality: context.modality, loadUnit, date: context.date,
        }));
      }));
    })();
    return () => { cancelled = true; };
  }, [testId, loadUnit]);

  const thresholds = useMemo(() => {
    const iatDeltaMmol = results.lactate_analysis?.config.iatDeltaMmol ?? 1.5;
    const baseConfig = { lt1Method: results.lactate_analysis?.config.lt1Method ?? 'baseline_plus_0_5' as const, iatDeltaMmol };
    return {
      dmax: analyzeLactate(dataPoints, bodyMassKg, { ...baseConfig, lt2Method: 'dmax' }, testContext.modality as Sport | undefined).lt2,
      obla: analyzeLactate(dataPoints, bodyMassKg, { ...baseConfig, lt2Method: 'obla_4mmol' }, testContext.modality as Sport | undefined).lt2,
      iat: analyzeLactate(dataPoints, bodyMassKg, { ...baseConfig, lt2Method: 'iat' }, testContext.modality as Sport | undefined).lt2,
      active: results.lactate_analysis?.config.lt2Method ?? 'dmax',
      iatDeltaMmol,
    };
  }, [dataPoints, bodyMassKg, results.lactate_analysis, testContext.modality]);

  const measuredMLSS = useMemo(() => evaluateConstantLoadTrials(trials.filter(trial =>
    (!trial.modality || !testContext.modality || trial.modality === testContext.modality) && (!trial.loadUnit || trial.loadUnit === loadUnit))), [trials, testContext.modality, loadUnit]);
  const metabolicSamples = useMemo(() => dataPoints.flatMap(point => {
    const load = loadUnit === 'W' ? Number(point.power_watts) : parseSpeedKmh(point.speed_pace, testContext.modality as Sport | undefined);
    if (!(load != null && Number.isFinite(load) && load >= 0)) return [];
    return [{ load, vo2MlKgMin: point.vo2_ml_kg_min, vco2MlKgMin: point.vco2_ml_kg_min }];
  }), [dataPoints, loadUnit, testContext.modality]);
  const demand = useMemo(() => buildMetabolicDemandCurve(model, metabolicSamples, Math.max(10, Number(durationSeconds) || 180)), [model, metabolicSamples, durationSeconds]);
  const selectedDemand = useMemo(() => demand.points.reduce((best, point) => Math.abs(point.load - Number(selectedLoad)) < Math.abs(best.load - Number(selectedLoad)) ? point : best, demand.points[0]), [demand, selectedLoad]);

  const thresholdLoad = (threshold: typeof thresholds.dmax) => {
    if (!threshold) return null;
    return loadUnit === 'W' ? threshold.power ?? threshold.load : threshold.speedKmh ?? threshold.load;
  };
  const proxyLoad = thresholdLoad(proxyMethod === 'dmax' ? thresholds.dmax : thresholds.iat);

  const updateTrial = (id: string, key: keyof ConstantLoadLactateTrial, value: string) => {
    setTrials(current => current.map(trial => trial.id === id ? { ...trial, [key]: key === 'date' ? value : Number(value) } : trial));
    setSaveState('idle');
  };

  const addTrial = () => {
    const comparable = trials.filter(trial => trial.modality === testContext.modality && trial.loadUnit === loadUnit);
    const suggestedLoad = comparable.length ? Math.max(...comparable.map(trial => trial.load)) + (loadUnit === 'W' ? 5 : 0.2) : proxyLoad ?? 0;
    setTrials(current => [...current, {
      id: newId(), athleteId: testContext.athleteId, assessmentId: testId, modality: testContext.modality,
      protocolVersion: 'MLSS-30m-v1', durationMinutes: 30, stabilityDeltaLimitMmol: 1, maxLoadDeviationPercent: 3,
      loadConstantVerified: false, loadUnit, date: testContext.date ?? new Date().toISOString().slice(0, 10), load: Number(suggestedLoad.toFixed(1)), samples: [],
    }]);
    setSaveState('idle');
  };

  const updateSample = (id: string, timeMinutes: number, value: string) => {
    setTrials(current => current.map(trial => trial.id === id ? {
      ...trial,
      samples: value === ''
        ? (trial.samples ?? []).filter(sample => sample.timeMinutes !== timeMinutes)
        : [...(trial.samples ?? []).filter(sample => sample.timeMinutes !== timeMinutes), { timeMinutes, lactateMmol: Number(value) }].sort((a, b) => a.timeMinutes - b.timeMinutes),
    } : trial));
    setSaveState('idle');
  };

  const updateLoadVerification = (id: string, verified: boolean) => {
    setTrials(current => current.map(trial => trial.id === id ? { ...trial, loadConstantVerified: verified } : trial));
    setSaveState('idle');
  };

  const saveTrials = async () => {
    if (!testId) return;
    setSaveState('saving');
    const groups = new Map<string, ConstantLoadLactateTrial[]>(assessmentOwners.map(owner => [owner, []]));
    trials.forEach(trial => {
      const owner = trial.assessmentId || testId;
      groups.set(owner, [...(groups.get(owner) ?? []), trial]);
    });
    const saved = await Promise.all([...groups].map(([assessmentId, confirmationTrials]) => supabase.from('test_results').upsert({
      test_id: assessmentId,
      lactate_dynamics_assessment: { version: 2, protocolVersion: 'MLSS-30m-v1', confirmationTrials, updatedAt: new Date().toISOString() },
    }, { onConflict: 'test_id' })));
    setSaveState(saved.some(result => result.error) ? 'error' : 'saved');
    setAssessmentOwners([...groups.keys()]);
  };

  const lactateTimeSeries = confirmationTimes.map(timeMinutes => Object.fromEntries([
    ['timeMinutes', timeMinutes],
    ...measuredMLSS.trials.map(trial => [trial.id, trial.samples?.find(sample => sample.timeMinutes === timeMinutes)?.lactateMmol ?? null]),
  ]));

  return (
    <div className="space-y-5">
      <div className="border-l-4 border-[#5A4E6B] bg-violet-50 px-4 py-3 dark:bg-violet-900/20">
        <h5 className="text-sm font-semibold text-violet-950 dark:text-violet-100">MLSS: estimación y confirmación</h5>
        <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">Dmax, OBLA e IAT proceden del test incremental. El proxy de Dmax o IAT solo propone una carga para confirmar; MLSS medido requiere pruebas constantes válidas.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ThresholdCard label="LT2 matemático" method="Dmax" value={thresholdLoad(thresholds.dmax)} unit={loadUnit} active={thresholds.active === 'dmax'} />
        <ThresholdCard label="OBLA" method="4.0 mmol/L" value={thresholdLoad(thresholds.obla)} unit={loadUnit} active={thresholds.active === 'obla_4mmol'} />
        <ThresholdCard label="IAT" method={`basal + ${thresholds.iatDeltaMmol}`} value={thresholdLoad(thresholds.iat)} unit={loadUnit} active={thresholds.active === 'iat'} />
        <div className="border-l border-gray-200 px-3 dark:border-gray-700"><label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Proxy incremental para confirmar<select className={`${fieldClass} mt-1`} value={proxyMethod} onChange={event => setProxyMethod(event.target.value as 'dmax' | 'iat')}><option value="iat">IAT</option><option value="dmax">Dmax</option></select></label><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{proxyLoad == null ? 'No disponible' : `${proxyLoad.toFixed(1)} ${loadUnit}`}</p><p className="text-[11px] text-gray-500">Provisional · sin validación individual</p></div>
        <ThresholdCard label="MLSS medido" method={measuredMLSS.status === 'confirmed' ? `Delimitado [${measuredMLSS.load}, ${measuredMLSS.upperLoad})` : measuredMLSS.status === 'lower_bound' ? 'Límite inferior · falta prueba superior' : measuredMLSS.status === 'review' ? 'Datos contradictorios · revisar' : 'Sin confirmar'} value={measuredMLSS.load} unit={loadUnit} />
      </div>

      <section className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Tests constantes de confirmación</h5><p className="text-xs text-gray-500 dark:text-gray-400">Protocolo MLSS-30m-v1: estable si el aumento es &lt;1.0 mmol/L entre los minutos 10 y 30. Se requiere duración ≥30 min y carga constante; una prueba superior inestable delimita el resultado.</p></div>
          <button type="button" onClick={addTrial} className="rounded-lg bg-[#5A4E6B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#493e58]">Añadir test</button>
        </div>
        {trials.length === 0 ? <p className="mt-4 border-l-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">Aún no hay tests constantes. El valor de referencia mostrado arriba es solo un proxy incremental.</p> : (
          <div className="mt-4 space-y-2">
            <div className="hidden grid-cols-[repeat(9,minmax(0,1fr))_auto_auto] gap-2 px-1 text-xs font-semibold text-gray-500 xl:grid"><span>Carga ({loadUnit})</span><span>Duración</span>{confirmationTimes.map(time => <span key={time}>La {time}'</span>)}<span>Carga constante</span><span>Resultado</span><span /></div>
            {trials.map(trial => {
              const evaluated = evaluateConstantLoadTrials([trial]).trials[0];
              return <div key={trial.id} className="grid grid-cols-2 gap-2 border-t border-gray-200 py-2 xl:grid-cols-[repeat(9,minmax(0,1fr))_auto_auto] dark:border-gray-700">
                <input aria-label={`Carga ${loadUnit}`} className={fieldClass} type="number" min="0" step={loadUnit === 'W' ? 1 : 0.1} value={trial.load || ''} onChange={event => updateTrial(trial.id, 'load', event.target.value)} />
                <input aria-label="Duración efectiva (min)" className={fieldClass} type="number" min="1" step="1" value={trial.durationMinutes ?? ''} onChange={event => updateTrial(trial.id, 'durationMinutes', event.target.value)} />
                {confirmationTimes.map(time => <input key={time} aria-label={`Lactato minuto ${time}`} className={fieldClass} type="number" min="0.1" max="25" step="0.1" value={trial.samples?.find(sample => sample.timeMinutes === time)?.lactateMmol || ''} onChange={event => updateSample(trial.id, time, event.target.value)} />)}
                <label className="flex items-center gap-1 text-xs text-gray-600"><input type="checkbox" checked={trial.loadConstantVerified ?? false} onChange={event => updateLoadVerification(trial.id, event.target.checked)} /> Verificada</label>
                <span className={`self-center rounded-full px-2 py-1 text-center text-xs font-semibold ${evaluated?.stability === 'stable' ? 'bg-emerald-100 text-emerald-700' : evaluated?.stability === 'unstable' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{evaluated ? `${stabilityLabel(evaluated.stability)} · Δ${evaluated.drift10To30Mmol ?? '—'}` : 'Incompleto'}</span>
                <button type="button" aria-label="Eliminar test" onClick={() => { setTrials(current => current.filter(item => item.id !== trial.id)); setSaveState('idle'); }} className="px-2 text-lg text-gray-400 hover:text-rose-600">×</button>
              </div>;
            })}
            <div className="flex items-center gap-3 pt-2"><button type="button" disabled={!testId || saveState === 'saving'} onClick={() => void saveTrials()} className="rounded-lg border border-[#5A4E6B] px-3 py-2 text-xs font-semibold text-[#5A4E6B] disabled:opacity-50 dark:text-violet-300">{saveState === 'saving' ? 'Guardando…' : 'Guardar confirmaciones'}</button><span className={`text-xs ${saveState === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>{saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'No se pudo guardar' : !testId ? 'Guarda primero el test principal' : ''}</span></div>
            <div className="mt-4"><ResponsiveContainer width="100%" height={260}><LineChart data={lactateTimeSeries}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="timeMinutes" unit=" min" /><YAxis unit=" mmol/L" /><Tooltip contentStyle={tooltipStyle} /><Legend />{measuredMLSS.trials.map((trial, index) => <Line key={trial.id} type="monotone" dataKey={trial.id} name={`${trial.load} ${trial.loadUnit ?? loadUnit} · ${stabilityLabel(trial.stability)}`} stroke={['#7c3aed', '#2563eb', '#e11d48', '#059669'][index % 4]} connectNulls={false} dot />)}</LineChart></ResponsiveContainer></div>
            {measuredMLSS.trials.some(trial => trial.qualityFlags.length > 0) && <p className="mt-2 text-xs text-amber-700">Revisar calidad: {measuredMLSS.trials.flatMap(trial => trial.qualityFlags.map(flag => `${trial.load}: ${qualityFlagLabel(flag)}`)).join(' · ')}</p>}
          </div>
        )}
      </section>

      <section className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h5 className="text-sm font-semibold text-gray-900 dark:text-white">Demanda metabólica continua</h5><p className="text-xs text-gray-500 dark:text-gray-400">Demanda, VO₂ alcanzado y déficit en equivalentes de O₂. La glucólisis se limita con VLamax.</p></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs text-gray-500">Carga ({loadUnit})<input className={fieldClass} type="number" min="0" max={model.input.maxLoad} value={selectedLoad} onChange={event => setSelectedLoad(event.target.value)} /></label><label className="text-xs text-gray-500">Duración (s)<input className={fieldClass} type="number" min="10" value={durationSeconds} onChange={event => setDurationSeconds(event.target.value)} /></label></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <DemandMetric label="Demanda O₂" value={selectedDemand.oxygenDemandMlKgMin} unit="ml/kg/min" />
          <DemandMetric label="VO₂ alcanzado" value={selectedDemand.actualVo2MlKgMin} unit="ml/kg/min" />
          <DemandMetric label="Déficit O₂" value={selectedDemand.oxygenDeficitMlKgMin} unit="ml/kg/min" />
          <DemandMetric label="Aeróbico" value={selectedDemand.aerobicPercent} unit="%" color="text-blue-600" />
          <DemandMetric label="Glucolítico estimado" value={selectedDemand.anaerobicPercent} unit="%" color="text-rose-600" />
          <DemandMetric label="No cubierto" value={selectedDemand.unmetPercent} unit="%" color={selectedDemand.unmetPercent > 0 ? 'text-amber-600' : 'text-emerald-600'} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ResponsiveContainer width="100%" height={290}><LineChart data={demand.points}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="load" stroke="#9ca3af" unit={` ${loadUnit}`} /><YAxis stroke="#9ca3af" unit=" ml/kg/min" /><Tooltip contentStyle={tooltipStyle} /><Legend />{proxyLoad != null && <ReferenceLine x={proxyLoad} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: `Proxy ${proxyMethod.toUpperCase()}`, fill: '#7c3aed', fontSize: 11 }} />}{measuredMLSS.load != null && <ReferenceLine x={measuredMLSS.load} stroke="#059669" strokeDasharray="2 2" label={{ value: 'MLSS medido', fill: '#059669', fontSize: 11 }} />}<ReferenceLine x={selectedDemand.load} stroke="#5A4E6B" strokeDasharray="2 3" /><Line type="monotone" dataKey="oxygenDemandMlKgMin" name="Demanda O₂" stroke="#111827" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="actualVo2MlKgMin" name="VO₂ alcanzado" stroke="#2563eb" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="oxygenDeficitMlKgMin" name="Déficit O₂" stroke="#e11d48" strokeDasharray="5 3" dot={false} /></LineChart></ResponsiveContainer>
          <ResponsiveContainer width="100%" height={290}><LineChart data={demand.points}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="load" stroke="#9ca3af" unit={` ${loadUnit}`} /><YAxis domain={[0, 100]} stroke="#9ca3af" unit="%" /><Tooltip contentStyle={tooltipStyle} /><Legend /><ReferenceLine x={selectedDemand.load} stroke="#5A4E6B" strokeDasharray="2 3" /><Line type="monotone" dataKey="aerobicPercent" name="Aeróbico" stroke="#2563eb" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="anaerobicPercent" name="Glucolítico estimado" stroke="#e11d48" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="fatPercent" name="Grasas" stroke="#10b981" strokeDasharray="5 3" dot={false} /><Line type="monotone" dataKey="carbohydratePercent" name="Carbohidratos" stroke="#f59e0b" strokeDasharray="5 3" dot={false} /></LineChart></ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Demanda: {demand.demandSource === 'measured_regression' ? 'regresión de VO₂ medido frente a carga' : 'inferida por VO₂max y carga máxima'} · RER en la carga seleccionada: {selectedDemand.rer?.toFixed(2) ?? '—'} ({selectedDemand.rerSource === 'unavailable' ? 'no disponible' : selectedDemand.rerSource === 'measured' ? 'interpolado de gases por etapa' : 'estimado'}) · constante temporal VO₂: {demand.vo2TimeConstantSeconds}s. Reparto energético de escenario: la glucólisis usa 1,5 ATP/lactato y 5 ATP/O₂ como supuestos; no incluye fosfocreatina ni equivale a calorimetría durante el esfuerzo. Grasa/CHO corresponden solo a oxidación aeróbica.</p>
      </section>
    </div>
  );
}

function ThresholdCard({ label, method, value, unit, active = false }: { label: string; method: string; value: number | null; unit: string; active?: boolean }) {
  return <div className={`border-l px-3 ${active ? 'border-violet-500' : 'border-gray-200 dark:border-gray-700'}`}><div className="flex items-center justify-between gap-1"><p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>{active && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">ACTIVO</span>}</div><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value == null ? '—' : value.toFixed(1)} <span className="text-xs font-normal text-gray-500">{value == null ? '' : unit}</span></p><p className="text-[11px] text-gray-500">{method}</p></div>;
}

function DemandMetric({ label, value, unit, color = 'text-gray-900 dark:text-white' }: { label: string; value: number; unit: string; color?: string }) {
  return <div className="border-l border-gray-200 px-3 first:border-l-0 dark:border-gray-700"><p className="text-xs text-gray-500">{label}</p><p className={`mt-1 text-lg font-bold ${color}`}>{value.toFixed(1)} <span className="text-[10px] font-normal text-gray-500">{unit}</span></p></div>;
}

function normalizeSavedTrial(trial: ConstantLoadLactateTrial, context: TestContext & { assessmentId: string; loadUnit: LactateLoadUnit }): ConstantLoadLactateTrial {
  const legacySamples = [
    ...(trial.lactate10Mmol == null ? [] : [{ timeMinutes: 10, lactateMmol: trial.lactate10Mmol }]),
    ...(trial.lactate20Mmol == null ? [] : [{ timeMinutes: 20, lactateMmol: trial.lactate20Mmol }]),
    ...(trial.lactate30Mmol == null ? [] : [{ timeMinutes: 30, lactateMmol: trial.lactate30Mmol }]),
  ];
  return {
    ...trial,
    athleteId: trial.athleteId ?? context.athleteId,
    assessmentId: trial.assessmentId ?? context.assessmentId,
    modality: trial.modality ?? context.modality,
    date: trial.date ?? context.date,
    protocolVersion: trial.protocolVersion ?? 'MLSS-30m-v1-legacy',
    durationMinutes: trial.durationMinutes ?? 30,
    stabilityDeltaLimitMmol: trial.stabilityDeltaLimitMmol ?? 1,
    loadUnit: trial.loadUnit ?? context.loadUnit,
    samples: trial.samples ?? legacySamples,
  };
}

function stabilityLabel(value: 'stable' | 'unstable' | 'inconclusive' | 'invalid'): string {
  return ({ stable: 'Estable', unstable: 'Inestable', inconclusive: 'Inconclusa', invalid: 'No válida' })[value];
}

function qualityFlagLabel(value: string): string {
  return ({
    invalid_protocol_or_measurement: 'protocolo o lactato inválido',
    load_not_constant: 'la carga varió más del límite del protocolo',
    load_constancy_unverified: 'carga constante sin verificar',
    missing_required_10_or_30_min_sample: 'falta lactato en minuto 10 o 30',
    unexpected_lactate_decline: 'descenso de lactato inusual; revisar medición',
  } as Record<string, string>)[value] ?? value;
}
