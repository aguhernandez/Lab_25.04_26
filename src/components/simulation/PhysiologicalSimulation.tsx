import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { analyzeLactate, parseSpeedKmh, type FuelStageResult, type LactateAnalysisResult } from '../../lib/lactateAnalysis';
import {
  buildMetabolicDemandCurve,
  createLactateDynamicsModel,
  evaluateConstantLoadTrials,
  lactateFluxAt,
  simulateLactateProtocol,
  type ConstantLoadLactateTrial,
  type LactateDynamicsInput,
  type LactateLoadUnit,
  type MetabolicDemandPoint,
} from '../../lib/lactateDynamics';
import { buildPhysiologicalScenario, findLactateBalanceLoad, type PhysiologicalScenarioResult } from '../../lib/physiologicalSimulation';
import { supabase } from '../../lib/supabase';
import type { Athlete, TestDataPoint } from '../../types';

type View = 'scenarios' | 'zones';
interface SavedVLamax {
  input?: { bodyMassKg?: number; distributionVolumeLPerKg?: number };
  result?: { netRateMmolLSecond?: number; preLactateMmol?: number; confidence?: string; label?: string };
}
interface SavedDynamics { confirmationTrials?: ConstantLoadLactateTrial[] }
interface TestRow { id: string; test_date: string; sport: Athlete['sport']; anthropometry_snapshot?: { weight_kg?: number } | null }
interface ResultsRow {
  test_id: string;
  vo2max?: number | null;
  lt1_power?: number | null;
  lt2_power?: number | null;
  lt1_hr?: number | null;
  lt2_hr?: number | null;
  fatmax_power?: number | null;
  vlamax_assessment?: SavedVLamax | null;
  lactate_dynamics_assessment?: SavedDynamics | null;
}
interface ProfileRow { last_test_id?: string | null; vo2max_absolute_l_min?: number | null; vo2max_relative_ml_kg_min?: number | null }
interface LoadedAthleteData {
  test: TestRow | null;
  points: TestDataPoint[];
  result: ResultsRow | null;
  profile: ProfileRow | null;
  vlamax: SavedVLamax | null;
  vlamaxTestDate: string | null;
  trials: ConstantLoadLactateTrial[];
  bodyMassKg: number;
}
interface Stage { load: number; stage: number; hr: number | null; vo2: number | null; lactate: number | null; point: TestDataPoint }
type ObjectiveId = 'fatmax' | 'lactate' | 'vo2' | 'mlss' | 'carbs' | 'aerobic' | 'accumulation';
interface ObjectiveRow { id: ObjectiveId; label: string; target: string; load: number | null; source: string }

const inputClass = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#5A4E6B] focus:outline-none focus:ring-2 focus:ring-[#5A4E6B]/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const tooltipStyle = { backgroundColor: 'rgba(255,255,255,0.98)', border: '1px solid #e5e7eb', borderRadius: '0.5rem', color: '#1f2937', fontSize: '12px' };

function loadOf(point: TestDataPoint, unit: LactateLoadUnit): number | null {
  if (unit === 'W') {
    const value = point.power_watts == null ? NaN : Number(point.power_watts);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return parseSpeedKmh(point.speed_pace);
}

function toStage(points: TestDataPoint[], unit: LactateLoadUnit): Stage[] {
  return points.flatMap(point => {
    const load = loadOf(point, unit);
    if (load == null) return [];
    return [{
      load,
      stage: Number(point.stage_number),
      hr: Number.isFinite(Number(point.heart_rate)) && Number(point.heart_rate) > 0 ? Number(point.heart_rate) : null,
      vo2: point.vo2_ml_kg_min == null ? null : Number(point.vo2_ml_kg_min),
      lactate: point.lactate == null ? null : Number(point.lactate),
      point,
    }];
  }).sort((a, b) => a.load - b.load);
}

function interpolateAtLoad(stages: Stage[], load: number, metric: 'hr' | 'vo2' | 'lactate'): number | null {
  const usable = stages.filter(stage => stage[metric] != null && Number.isFinite(stage[metric]));
  if (usable.length < 2 || load < usable[0].load || load > usable[usable.length - 1].load) return null;
  const upperIndex = usable.findIndex(stage => stage.load >= load);
  if (upperIndex <= 0) return usable[0][metric];
  const lower = usable[upperIndex - 1];
  const upper = usable[upperIndex];
  const fraction = (load - lower.load) / Math.max(0.0001, upper.load - lower.load);
  return (lower[metric] as number) + ((upper[metric] as number) - (lower[metric] as number)) * fraction;
}

function loadAtMeasuredTarget(stages: Stage[], values: Array<{ load: number; value: number }>, target: number): number | null {
  const usable = values.filter(item => Number.isFinite(item.load) && Number.isFinite(item.value)).sort((a, b) => a.value - b.value);
  if (usable.length < 2 || target < usable[0].value || target > usable[usable.length - 1].value) return null;
  const upperIndex = usable.findIndex(item => item.value >= target);
  if (upperIndex <= 0) return usable[0].load;
  const lower = usable[upperIndex - 1];
  const upper = usable[upperIndex];
  const fraction = (target - lower.value) / Math.max(0.0001, upper.value - lower.value);
  const load = lower.load + (upper.load - lower.load) * fraction;
  return stages.length ? load : null;
}

function nearestLoadForMetric<T>(items: T[], target: number, getMetric: (item: T) => number | null, getLoad: (item: T) => number | null): number | null {
  const usable = items.flatMap(item => {
    const metric = getMetric(item);
    const load = getLoad(item);
    return metric == null || load == null || !Number.isFinite(metric) ? [] : [{ metric, load }];
  });
  if (!usable.length) return null;
  const values = usable.map(item => item.metric);
  if (target < Math.min(...values) || target > Math.max(...values)) return null;
  return usable.reduce((best, item) => Math.abs(item.metric - target) < Math.abs(best.metric - target) ? item : best).load;
}

function formatLoad(value: number | null, unit: LactateLoadUnit | null): string {
  if (value == null || !unit) return '—';
  return `${value.toFixed(1)} ${unit}`;
}

export default function PhysiologicalSimulation() {
  const { language } = useLanguage();
  const { profile } = useAuth();
  const en = language !== 'es';
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState('');
  const [loaded, setLoaded] = useState<LoadedAthleteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>('scenarios');
  const [targetMass, setTargetMass] = useState('');
  const [targetAbsoluteVo2, setTargetAbsoluteVo2] = useState('');
  const [baselineVlamax, setBaselineVlamax] = useState('');
  const [targetVlamax, setTargetVlamax] = useState('');
  const [distributionPerKg, setDistributionPerKg] = useState('0.50');
  const [economyImprovement, setEconomyImprovement] = useState('0');
  const [referenceLactate, setReferenceLactate] = useState('4');
  const [selectedLoad, setSelectedLoad] = useState('');
  const [effortDuration, setEffortDuration] = useState('180');
  const [zoneDuration, setZoneDuration] = useState('180');
  const [zoneTargets, setZoneTargets] = useState({ lactate: '2', vo2: '70', mlss: '100', carbs: '30', aerobic: '80', accumulation: '0.5' });

  useEffect(() => {
    const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
    let query = supabase.from('athletes').select('*').order('name');
    if (effectiveRole === 'athlete' && profile?.hub_user_id) query = query.eq('hub_user_id', profile.hub_user_id);
    else if (effectiveRole === 'coach' && profile?.id) query = query.eq('coach_id', profile.id);
    void query.then(({ data }) => { if (data) setAthletes(data as Athlete[]); });
  }, [profile]);

  useEffect(() => {
    if (!athleteId) { setLoaded(null); return; }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setLoaded(null);
    void (async () => {
      const { data: tests, error: testError } = await supabase
        .from('tests').select('id, test_date, sport, anthropometry_snapshot')
        .eq('athlete_id', athleteId).eq('status', 'completed')
        .order('test_date', { ascending: false }).limit(5);
      if (testError) throw testError;
      const testRows = (tests ?? []) as unknown as TestRow[];
      const testIds = testRows.map(test => test.id);
      const [pointsResponse, resultsResponse, profileResponse] = await Promise.all([
        testIds.length
          ? supabase.from('test_data_points').select('*').in('test_id', testIds).order('stage_number', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        testIds.length
          ? supabase.from('test_results').select('test_id, vo2max, lt1_power, lt2_power, lt1_hr, lt2_hr, fatmax_power, vlamax_assessment, lactate_dynamics_assessment').in('test_id', testIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('athlete_physiology_profiles').select('last_test_id, vo2max_absolute_l_min, vo2max_relative_ml_kg_min').eq('athlete_id', athleteId).maybeSingle(),
      ]);
      if (pointsResponse.error) throw pointsResponse.error;
      if (resultsResponse.error) throw resultsResponse.error;
      const points = (pointsResponse.data ?? []) as TestDataPoint[];
      const resultsRows = (resultsResponse.data ?? []) as unknown as ResultsRow[];
      const profileData = (profileResponse.data ?? null) as ProfileRow | null;
      const pointsByTest = new Map<string, TestDataPoint[]>();
      points.forEach(point => pointsByTest.set(point.test_id, [...(pointsByTest.get(point.test_id) ?? []), point]));
      const orderedResults = testRows.flatMap(test => {
        const result = resultsRows.find(row => row.test_id === test.id);
        return result ? [result] : [];
      });
      const test = testRows.find(row => (pointsByTest.get(row.id)?.length ?? 0) >= 2) ?? testRows[0] ?? null;
      const selectedResult = test ? resultsRows.find(row => row.test_id === test.id) ?? null : null;
      const currentPoints = test ? pointsByTest.get(test.id) ?? [] : [];
      const relevantTestIds = new Set(testRows.filter(row => !test || row.sport === test.sport).map(row => row.id));
      const vlamaxRow = orderedResults.find(row => relevantTestIds.has(row.test_id) && (row.vlamax_assessment?.result?.netRateMmolLSecond ?? 0) > 0);
      const vlamaxTestDate = testRows.find(row => row.id === vlamaxRow?.test_id)?.test_date ?? null;
      const trials = orderedResults
        .filter(row => relevantTestIds.has(row.test_id))
        .flatMap(row => row.lactate_dynamics_assessment?.confirmationTrials ?? []);
      const snapshot = test?.anthropometry_snapshot;
      const athlete = athletes.find(item => item.id === athleteId);
      const mass = Number(snapshot?.weight_kg ?? vlamaxRow?.vlamax_assessment?.input?.bodyMassKg ?? athlete?.weight_kg ?? 0);
      if (cancelled) return;
      setLoaded({
        test,
        points: currentPoints,
        result: selectedResult,
        profile: profileData,
        vlamax: vlamaxRow?.vlamax_assessment ?? null,
        vlamaxTestDate,
        trials,
        bodyMassKg: mass,
      });
      const rate = vlamaxRow?.vlamax_assessment?.result?.netRateMmolLSecond;
      const baselineMass = mass;
      const relativeVo2 = Number(selectedResult?.vo2max ?? profileData?.vo2max_relative_ml_kg_min ?? 0);
      const absoluteVo2 = Number(profileData?.last_test_id === test?.id && profileData.vo2max_absolute_l_min
        ? profileData.vo2max_absolute_l_min
        : (relativeVo2 > 0 && baselineMass > 0 ? relativeVo2 * baselineMass / 1000 : 0));
      setTargetMass(baselineMass > 0 ? String(baselineMass) : '');
      setTargetAbsoluteVo2(absoluteVo2 > 0 ? String(Number(absoluteVo2.toFixed(2))) : '');
      setBaselineVlamax(rate && rate > 0 ? String(rate) : '');
      setTargetVlamax(rate && rate > 0 ? String(rate) : '');
      setDistributionPerKg(String(vlamaxRow?.vlamax_assessment?.input?.distributionVolumeLPerKg ?? 0.5));
      const lt2 = selectedResult?.lt2_power ?? null;
      setSelectedLoad(lt2 && lt2 > 0 ? String(lt2) : '');
    })().catch(error => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [athleteId, athletes]);

  const loadUnit: LactateLoadUnit | null = useMemo(() => {
    if (!loaded) return null;
    const powerCount = loaded.points.filter(point => loadOf(point, 'W') != null).length;
    const speedCount = loaded.points.filter(point => loadOf(point, 'km/h') != null).length;
    if (loaded.test?.sport === 'running' || loaded.test?.sport === 'swimming') return speedCount >= 2 ? 'km/h' : powerCount >= 2 ? 'W' : null;
    if (loaded.test?.sport === 'cycling') return powerCount >= 2 ? 'W' : speedCount >= 2 ? 'km/h' : null;
    return powerCount >= 2 ? 'W' : speedCount >= 2 ? 'km/h' : null;
  }, [loaded]);

  const stages = useMemo(() => loaded && loadUnit ? toStage(loaded.points, loadUnit) : [], [loaded, loadUnit]);
  const massKg = loaded?.bodyMassKg ?? 0;
  const profileRelativeVo2 = Number(loaded?.result?.vo2max ?? loaded?.profile?.vo2max_relative_ml_kg_min ?? 0);
  const baselineAbsoluteVo2LMin = Number(loaded?.profile?.last_test_id === loaded?.test?.id && loaded?.profile?.vo2max_absolute_l_min
    ? loaded.profile?.vo2max_absolute_l_min
    : (profileRelativeVo2 > 0 && massKg > 0 ? profileRelativeVo2 * massKg / 1000 : 0));
  const lactateAnalysis: LactateAnalysisResult | null = useMemo(() => loaded ? analyzeLactate(loaded.points, massKg) : null, [loaded, massKg]);
  const baselineLactate = useMemo(() => {
    const values = loaded?.points.flatMap(point => point.lactate == null ? [] : [Number(point.lactate)]).filter(value => value > 0 && Number.isFinite(value)) ?? [];
    return values.length ? Math.min(...values) : 1;
  }, [loaded]);
  const lt1Load = useMemo(() => {
    if (!loaded || !loadUnit || !lactateAnalysis?.lt1) return null;
    return loadUnit === 'W' ? loaded.result?.lt1_power ?? lactateAnalysis.lt1.power ?? lactateAnalysis.lt1.load : lactateAnalysis.lt1.speedKmh ?? lactateAnalysis.lt1.load;
  }, [loaded, loadUnit, lactateAnalysis]);
  const lt2Load = useMemo(() => {
    if (!loaded || !loadUnit || !lactateAnalysis?.lt2) return null;
    return loadUnit === 'W' ? loaded.result?.lt2_power ?? lactateAnalysis.lt2.power ?? lactateAnalysis.lt2.load : lactateAnalysis.lt2.speedKmh ?? lactateAnalysis.lt2.load;
  }, [loaded, loadUnit, lactateAnalysis]);
  const maxLoad = stages.length ? stages[stages.length - 1].load : 0;

  const modelInput: LactateDynamicsInput | null = useMemo(() => {
    if (!loaded || !loadUnit || !(maxLoad > 0) || !(massKg > 0) || !(profileRelativeVo2 > 0)) return null;
    const rate = Number(baselineVlamax);
    if (!(rate > 0)) return null;
    return {
      vlamaxMmolLSecond: rate,
      vo2maxMlKgMin: profileRelativeVo2,
      bodyMassKg: massKg,
      distributionVolumeLPerKg: Number(distributionPerKg) || 0.5,
      baselineLactateMmol: baselineLactate,
      maxLoad,
      lt1Load,
      lt2Load,
      lt2LactateMmol: lactateAnalysis?.lt2?.lactate ?? 4,
      loadUnit,
    };
  }, [loaded, loadUnit, maxLoad, massKg, profileRelativeVo2, baselineVlamax, distributionPerKg, baselineLactate, lt1Load, lt2Load, lactateAnalysis]);

  const scenario: PhysiologicalScenarioResult | null = useMemo(() => {
    if (!modelInput) return null;
    return buildPhysiologicalScenario(modelInput, {
      bodyMassKg: Number(targetMass),
      absoluteVo2maxLMin: Number(targetAbsoluteVo2),
      vlamaxMmolLSecond: Number(targetVlamax),
      economyImprovementPercent: Number(economyImprovement) || 0,
    });
  }, [modelInput, targetMass, targetAbsoluteVo2, targetVlamax, economyImprovement]);

  const fuelByStage = useMemo(() => new Map((lactateAnalysis?.fuelProfile ?? []).map(item => [item.stage, item])), [lactateAnalysis]);
  const mlssTrials = useMemo(() => {
    if (!loaded || !loadUnit) return [];
    return loaded.trials.map(trial => ({
      ...trial,
      loadUnit: trial.loadUnit ?? loadUnit,
      durationMinutes: trial.durationMinutes ?? 30,
      stabilityDeltaLimitMmol: trial.stabilityDeltaLimitMmol ?? 1,
      samples: trial.samples ?? [
        ...(trial.lactate10Mmol == null ? [] : [{ timeMinutes: 10, lactateMmol: trial.lactate10Mmol }]),
        ...(trial.lactate20Mmol == null ? [] : [{ timeMinutes: 20, lactateMmol: trial.lactate20Mmol }]),
        ...(trial.lactate30Mmol == null ? [] : [{ timeMinutes: 30, lactateMmol: trial.lactate30Mmol }]),
      ],
    })).filter(trial => trial.loadUnit === loadUnit);
  }, [loaded, loadUnit]);
  const measuredMLSS = useMemo(() => evaluateConstantLoadTrials(mlssTrials), [mlssTrials]);

  const baselineMetabolicSamples = useMemo(() => {
    if (!loaded || !loadUnit) return [];
    return loaded.points.flatMap(point => {
      const load = loadOf(point, loadUnit);
      if (load == null) return [];
      return [{ load, vo2MlKgMin: point.vo2_ml_kg_min, vco2MlKgMin: point.vco2_ml_kg_min }];
    });
  }, [loaded, loadUnit]);
  const scenarioMetabolicSamples = useMemo(() => {
    if (!loaded || !loadUnit) return baselineMetabolicSamples;
    const targetMassKg = Number(targetMass) || massKg;
    const cyclingMassFactor = loaded.test?.sport === 'cycling' && targetMassKg > 0 ? massKg / targetMassKg : 1;
    const costFactor = 1 - (Number(economyImprovement) || 0) / 100;
    return baselineMetabolicSamples.map(sample => ({
      ...sample,
      vo2MlKgMin: sample.vo2MlKgMin == null ? null : Number(sample.vo2MlKgMin) * cyclingMassFactor * costFactor,
      vco2MlKgMin: sample.vco2MlKgMin == null ? null : Number(sample.vco2MlKgMin) * cyclingMassFactor * costFactor,
    }));
  }, [loaded, loadUnit, baselineMetabolicSamples, targetMass, massKg, economyImprovement]);

  const baselineModel = useMemo(() => modelInput ? createLactateDynamicsModel(modelInput) : null, [modelInput]);
  const baselineDemand = useMemo(() => baselineModel ? buildMetabolicDemandCurve(baselineModel, baselineMetabolicSamples, Math.max(10, Number(effortDuration) || 180)) : null, [baselineModel, baselineMetabolicSamples, effortDuration]);
  const scenarioDemand = useMemo(() => scenario ? buildMetabolicDemandCurve(scenario.scenarioModel, scenarioMetabolicSamples, Math.max(10, Number(effortDuration) || 180)) : null, [scenario, scenarioMetabolicSamples, effortDuration]);

  const athleteName = athletes.find(athlete => athlete.id === athleteId)?.name;
  const vlamaxDetail = loaded?.vlamax
    ? [loaded.vlamax.result?.confidence && `${en ? 'confidence' : 'confianza'}: ${loaded.vlamax.result.confidence}`, loaded.vlamaxTestDate && `${en ? 'assessment' : 'evaluación'}: ${loaded.vlamaxTestDate}`].filter(Boolean).join(' · ')
    : baselineVlamax ? (en ? 'manual baseline input' : 'base introducida manualmente') : undefined;
  const baseBalance = baselineModel ? findLactateBalanceLoad(baselineModel, Number(referenceLactate) || 4) : null;
  const scenarioBalance = scenario ? findLactateBalanceLoad(scenario.scenarioModel, Number(referenceLactate) || 4) : null;

  const fluxChartData = useMemo(() => {
    if (!scenario || !loadUnit) return [];
    return Array.from({ length: 51 }, (_, index) => {
      const percent = index * 2;
      const baselineLoad = scenario.baselineModel.input.maxLoad * percent / 100;
      const scenarioLoad = scenario.scenarioModel.input.maxLoad * percent / 100;
      return {
        percent,
        baselineLoad,
        scenarioLoad,
        baselineNet: lactateFluxAt(scenario.baselineModel, baselineLoad, Number(referenceLactate) || 4).netMmolLMin,
        scenarioNet: lactateFluxAt(scenario.scenarioModel, scenarioLoad, Number(referenceLactate) || 4).netMmolLMin,
      };
    });
  }, [scenario, loadUnit, referenceLactate]);

  const selectedBaselineDemand: MetabolicDemandPoint | null = useMemo(() => {
    if (!baselineDemand?.points.length) return null;
    const load = Number(selectedLoad) || (lt2Load ?? maxLoad * 0.75);
    return baselineDemand.points.reduce((best, point) => Math.abs(point.load - load) < Math.abs(best.load - load) ? point : best, baselineDemand.points[0]);
  }, [baselineDemand, selectedLoad, lt2Load, maxLoad]);
  const selectedScenarioDemand: MetabolicDemandPoint | null = useMemo(() => {
    if (!scenarioDemand?.points.length) return null;
    const load = Number(selectedLoad) || (lt2Load ?? maxLoad * 0.75);
    return scenarioDemand.points.reduce((best, point) => Math.abs(point.load - load) < Math.abs(best.load - load) ? point : best, scenarioDemand.points[0]);
  }, [scenarioDemand, selectedLoad, lt2Load, maxLoad]);

  const zoneRows: ObjectiveRow[] = useMemo(() => {
    if (!loaded || !loadUnit || !stages.length) return [];
    const lactateCurve = lactateAnalysis?.quality.validForThresholds ? lactateAnalysis.curve : [];
    const lactateLoad = loadAtMeasuredTarget(stages, lactateCurve.flatMap(point => point.smoothed == null ? [] : [{ load: point.load, value: point.smoothed }]), Number(zoneTargets.lactate));
    const vo2Target = profileRelativeVo2 * Number(zoneTargets.vo2) / 100;
    const vo2Load = loadAtMeasuredTarget(stages, stages.flatMap(stage => stage.vo2 == null ? [] : [{ load: stage.load, value: stage.vo2 }]), vo2Target);
    const validMeasuredMLSS = measuredMLSS.status === 'review' ? null : measuredMLSS.load;
    const mlssLoad = validMeasuredMLSS ?? lt2Load;
    const mlssSource = validMeasuredMLSS != null
      ? measuredMLSS.status === 'confirmed' ? (en ? 'MLSS measured · confirmed' : 'MLSS medido · confirmado') : (en ? 'MLSS measured · lower bound' : 'MLSS medido · límite inferior')
      : (en ? 'LT2 proxy · no MLSS confirmation' : 'Proxy LT2 · sin confirmación MLSS');
    const selectedMlssLoad = mlssLoad == null ? null : mlssLoad * Number(zoneTargets.mlss) / 100;
    const carbLoad = nearestLoadForMetric(lactateAnalysis?.fuelProfile ?? [], Number(zoneTargets.carbs), item => item.carbohydrateGramsPerMin, item => stages.find(stage => stage.stage === item.stage)?.load ?? null);
    const demandForZones = baselineModel ? buildMetabolicDemandCurve(baselineModel, baselineMetabolicSamples, Math.max(10, Number(zoneDuration) || 180)) : null;
    const aerobicLoad = demandForZones ? nearestLoadForMetric(demandForZones.points, Number(zoneTargets.aerobic), item => item.aerobicPercent, item => item.load) : null;
    const accumulationLoad = baselineModel ? nearestLoadForMetric(
      Array.from({ length: 81 }, (_, index) => {
        const load = baselineModel.input.maxLoad * index / 80;
        return { load, net: lactateFluxAt(baselineModel, load, Number(referenceLactate) || 4).netMmolLMin };
      }), Number(zoneTargets.accumulation), item => item.net, item => item.load,
    ) : null;
    const fatMax = lactateAnalysis?.maxFatOxidation;
    const carbMax = lactateAnalysis?.fuelProfile.reduce<FuelStageResult | null>((best, item) => !best || item.carbohydrateGramsPerMin > best.carbohydrateGramsPerMin ? item : best, null) ?? null;
    const stageLoad = (stage: number | undefined) => stage == null ? null : stages.find(item => item.stage === stage)?.load ?? null;
    return [
      { id: 'fatmax', label: 'FatMax', target: fatMax ? `${fatMax.fatGramsPerMin.toFixed(1)} g/min · RER ${fatMax.rer.toFixed(2)}` : (en ? 'measured gases required' : 'requiere gases medidos'), load: stageLoad(fatMax?.stage), source: en ? 'Measured VO₂/VCO₂' : 'VO₂/VCO₂ medidos' },
      { id: 'lactate', label: en ? 'Lactate concentration' : 'Concentración de lactato', target: `${zoneTargets.lactate} mmol/L`, load: lactateLoad, source: en ? 'Interpolated from measured curve' : 'Interpolado en curva medida' },
      { id: 'vo2', label: '% VO₂max', target: `${zoneTargets.vo2}% · ${vo2Target.toFixed(1)} ml/kg/min`, load: vo2Load, source: en ? 'Measured VO₂ stages' : 'Etapas VO₂ medidas' },
      { id: 'mlss', label: '% MLSS', target: `${zoneTargets.mlss}%`, load: selectedMlssLoad, source: mlssSource },
      { id: 'carbs', label: en ? 'Carbohydrate use' : 'Consumo de carbohidratos', target: `${zoneTargets.carbs} g/min${carbMax ? ` · max ${carbMax.carbohydrateGramsPerMin.toFixed(1)}` : ''}`, load: carbLoad, source: en ? 'Measured VO₂/VCO₂' : 'VO₂/VCO₂ medidos' },
      { id: 'aerobic', label: en ? 'Aerobic contribution' : 'Contribución aeróbica', target: `${zoneTargets.aerobic}% · ${Math.max(10, Number(zoneDuration) || 180)} s`, load: aerobicLoad, source: en ? 'Model · test-calibrated when gases exist' : 'Modelo · calibrado con test si hay gases' },
      { id: 'accumulation', label: en ? 'Lactate accumulation rate' : 'Tasa de acumulación de lactato', target: `${zoneTargets.accumulation} mmol/L/min @ ${referenceLactate} mmol/L`, load: accumulationLoad, source: en ? 'Model estimate' : 'Estimación del modelo' },
    ];
  }, [loaded, loadUnit, stages, lactateAnalysis, zoneTargets, profileRelativeVo2, measuredMLSS, lt2Load, baselineModel, baselineMetabolicSamples, zoneDuration, referenceLactate, en]);

  const zoneTableRows = useMemo(() => zoneRows.map(row => {
    const hr = row.load == null ? null : interpolateAtLoad(stages, row.load, 'hr');
    const vo2 = row.load == null ? null : interpolateAtLoad(stages, row.load, 'vo2');
    const lactate = row.load == null ? null : interpolateAtLoad(stages, row.load, 'lactate');
    const targetLoad = row.load ?? 0;
    const closestStage = row.load == null ? null : stages.reduce<Stage | null>((best, stage) => !best || Math.abs(stage.load - targetLoad) < Math.abs(best.load - targetLoad) ? stage : best, null);
    const fuel = closestStage ? fuelByStage.get(closestStage.stage) : undefined;
    let sustainable = en ? 'Not estimable' : 'No estimable';
    if (row.load != null && baselineModel && row.load <= baselineModel.input.maxLoad) {
      const horizonSeconds = 30 * 60;
      const trace = simulateLactateProtocol(baselineModel, [{ label: row.label, load: row.load, durationSeconds: horizonSeconds }]);
      const crossing = trace.find(point => point.bloodLactateMmol >= (Number(referenceLactate) || 4));
      sustainable = crossing
        ? `${(crossing.timeSeconds / 60).toFixed(0)} min to ${referenceLactate} · model`
        : (en ? 'No crossing in 30 min · model' : 'Sin cruce en 30 min · modelo');
    } else if (row.load != null && baselineModel) {
      sustainable = en ? 'Outside test load range' : 'Fuera del rango de carga del test';
    }
    return { ...row, hr, vo2, lactate, fuel, sustainable };
  }), [zoneRows, stages, fuelByStage, baselineModel, referenceLactate, en]);

  const updateZoneTarget = (key: keyof typeof zoneTargets, value: string) => setZoneTargets(current => ({ ...current, [key]: value }));
  const showZones = view === 'zones';

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-700 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{en ? 'Physiological simulator' : 'Simulador fisiológico'}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{en ? 'Explore changes in body mass and metabolic capacity against the latest completed test.' : 'Explora cambios de masa corporal y capacidad metabólica frente al último test completado.'}</p>
        </div>
        <label className="w-full text-xs font-semibold text-gray-600 dark:text-gray-300 sm:max-w-xs">{en ? 'Athlete' : 'Atleta'}
          <select value={athleteId} onChange={event => setAthleteId(event.target.value)} className={inputClass}>
            <option value="">{en ? 'Select an athlete' : 'Selecciona un atleta'}</option>
            {athletes.map(athlete => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}
          </select>
        </label>
      </section>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        <button type="button" onClick={() => setView('scenarios')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!showZones ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{en ? 'Physiological scenarios' : 'Escenarios fisiológicos'}</button>
        <button type="button" onClick={() => setView('zones')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${showZones ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{en ? 'Metabolic zones' : 'Zonas metabólicas'}</button>
      </div>

      {loading && <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-800">{en ? 'Loading the latest test…' : 'Cargando el último test…'}</p>}
      {loadError && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">{loadError}</p>}
      {!athleteId && !loading && <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-800">{en ? 'Choose an athlete to load the physiological profile.' : 'Elige un atleta para cargar su perfil fisiológico.'}</p>}
      {loaded && !loading && <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{athleteName} · {loaded.test ? `${loaded.test.sport} · ${loaded.test.test_date}` : (en ? 'No completed test' : 'Sin test completado')}</span>
          <span>{en ? 'Based on the latest completed test with stage data' : 'Basado en el último test completado con datos por etapa'}</span>
        </div>
        {showZones ? (
          <section className="space-y-4">
            <div className="border-l-4 border-[#5A4E6B] bg-[#f4f1f7] px-4 py-3 text-sm text-[#473c57] dark:bg-[#5A4E6B]/20 dark:text-purple-100">
              {en ? 'Prescriptions are derived from measured stages when possible. Modeled rows are labeled, and the sustainable-duration column is a 30-minute model horizon, not a measured MLSS result.' : 'Las prescripciones salen de etapas medidas cuando es posible. Las filas modeladas están identificadas; la duración es un horizonte de 30 minutos del modelo, no un MLSS medido.'}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField label={en ? 'Lactate target (mmol/L)' : 'Lactato objetivo (mmol/L)'} value={zoneTargets.lactate} onChange={value => updateZoneTarget('lactate', value)} min="0.5" max="20" step="0.1" />
              <NumberField label="% VO₂max" value={zoneTargets.vo2} onChange={value => updateZoneTarget('vo2', value)} min="1" max="120" step="1" />
              <NumberField label="% MLSS" value={zoneTargets.mlss} onChange={value => updateZoneTarget('mlss', value)} min="1" max="150" step="1" />
              <NumberField label={en ? 'Carbohydrate (g/min)' : 'Carbohidratos (g/min)'} value={zoneTargets.carbs} onChange={value => updateZoneTarget('carbs', value)} min="0" max="200" step="0.5" />
              <NumberField label={en ? 'Aerobic contribution (%)' : 'Contribución aeróbica (%)'} value={zoneTargets.aerobic} onChange={value => updateZoneTarget('aerobic', value)} min="0" max="100" step="1" />
              <NumberField label={en ? 'Net lactate rate (mmol/L/min)' : 'Tasa neta de lactato (mmol/L/min)'} value={zoneTargets.accumulation} onChange={value => updateZoneTarget('accumulation', value)} min="-5" max="10" step="0.05" />
              <NumberField label={en ? 'Effort duration for energy split (s)' : 'Duración para reparto energético (s)'} value={zoneDuration} onChange={setZoneDuration} min="10" max="3600" step="10" />
              <NumberField label={en ? 'Lactate reference for model (mmol/L)' : 'Lactato de referencia del modelo (mmol/L)'} value={referenceLactate} onChange={setReferenceLactate} min="0.5" max="20" step="0.1" />
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-[1120px] w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-300"><tr>
                  <th className="px-3 py-3">{en ? 'Objective' : 'Objetivo'}</th><th className="px-3 py-3">{en ? 'Target' : 'Objetivo'}</th><th className="px-3 py-3">{en ? 'Power / speed' : 'Potencia / velocidad'}</th><th className="px-3 py-3">FC</th><th className="px-3 py-3">VO₂</th><th className="px-3 py-3">{en ? 'Lactate' : 'Lactato'}</th><th className="px-3 py-3">{en ? 'Fat / CHO' : 'Grasa / CHO'}</th><th className="px-3 py-3">{en ? 'Aerobic / anaerobic' : 'Aeróbico / anaeróbico'}</th><th className="px-3 py-3">{en ? 'Duration' : 'Duración'}</th><th className="px-3 py-3">{en ? 'Basis' : 'Base'}</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{zoneTableRows.map(row => {
                  const targetLoad = row.load ?? 0;
                  const demand = row.load == null || !baselineModel ? null : buildMetabolicDemandCurve(baselineModel, baselineMetabolicSamples, Math.max(10, Number(zoneDuration) || 180)).points.reduce((best, point) => Math.abs(point.load - targetLoad) < Math.abs(best.load - targetLoad) ? point : best);
                  return <tr key={row.id} className="text-gray-700 dark:text-gray-200">
                    <td className="px-3 py-3 font-semibold">{row.label}</td><td className="px-3 py-3">{row.target}</td><td className="px-3 py-3 font-semibold">{formatLoad(row.load, loadUnit)}</td><td className="px-3 py-3">{row.hr == null ? '—' : `${Math.round(row.hr)} bpm`}</td><td className="px-3 py-3">{row.vo2 == null ? '—' : `${row.vo2.toFixed(1)} ml/kg/min`}</td><td className="px-3 py-3">{row.lactate == null ? '—' : `${row.lactate.toFixed(2)} mmol/L`}</td><td className="px-3 py-3">{row.fuel ? `${row.fuel.fatGramsPerMin.toFixed(1)} / ${row.fuel.carbohydrateGramsPerMin.toFixed(1)} g/min` : '—'}</td><td className="px-3 py-3">{demand ? `${demand.aerobicPercent.toFixed(0)} / ${demand.anaerobicPercent.toFixed(0)}%` : '—'}</td><td className="px-3 py-3">{row.sustainable}</td><td className="px-3 py-3 text-gray-500">{row.source}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
            {!lactateAnalysis?.fuelProfile.length && <p className="text-xs text-amber-700 dark:text-amber-300">{en ? 'FatMax and carbohydrate use need measured VO₂ and VCO₂. Those values remain unavailable for this test.' : 'FatMax y el consumo de carbohidratos requieren VO₂ y VCO₂ medidos. Esos valores quedan no disponibles para este test.'}</p>}
            {measuredMLSS.load == null && <p className="text-xs text-amber-700 dark:text-amber-300">{en ? 'No constant-load MLSS confirmation was found; the %MLSS row uses the test LT2 as a clearly labeled proxy.' : 'No se encontró una prueba constante de confirmación MLSS; la fila %MLSS usa LT2 como proxy claramente identificado.'}</p>}
          </section>
        ) : (
          <section className="space-y-5">
            <div className="border-l-4 border-blue-500 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
              {en ? 'A scenario changes the model inputs only. It does not predict the result of a training plan or replace a repeat test. If you change only body mass, absolute VO₂max and VLamax stay fixed; relative VO₂max and the assumed distribution volume change.' : 'El escenario cambia solo las entradas del modelo. No predice el resultado de un plan ni reemplaza repetir el test. Si solo cambias el peso, VO₂max absoluto y VLamax permanecen fijos; cambian el VO₂ relativo y el volumen de distribución supuesto.'}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ReadOnlyMetric label={en ? 'Current mass' : 'Peso actual'} value={massKg > 0 ? `${massKg.toFixed(1)} kg` : '—'} />
              <ReadOnlyMetric label="VO₂max" value={profileRelativeVo2 > 0 ? `${profileRelativeVo2.toFixed(1)} ml/kg/min` : '—'} detail={baselineAbsoluteVo2LMin > 0 ? `${baselineAbsoluteVo2LMin.toFixed(2)} L/min` : undefined} />
              <ReadOnlyMetric label={en ? 'Blood-lactate VLamax estimate' : 'Estimación VLamax sanguínea'} value={loaded.vlamax?.result?.netRateMmolLSecond ? `${loaded.vlamax.result.netRateMmolLSecond.toFixed(3)} mmol/L/s` : (baselineVlamax ? `${Number(baselineVlamax).toFixed(3)} mmol/L/s` : (en ? 'No assessment' : 'Sin evaluación'))} detail={vlamaxDetail} />
              <ReadOnlyMetric label={en ? 'Load data' : 'Datos de carga'} value={loadUnit ? `${stages.length} ${en ? 'stages' : 'etapas'} · ${loadUnit}` : (en ? 'Unavailable' : 'No disponible')} detail={loaded.test ? `${loaded.test.sport} · ${loaded.test.test_date}` : undefined} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField label={en ? 'Scenario body mass (kg)' : 'Peso del escenario (kg)'} value={targetMass} onChange={setTargetMass} min="30" max="250" step="0.1" />
              <NumberField label={en ? 'Scenario absolute VO₂max (L/min)' : 'VO₂max absoluto del escenario (L/min)'} value={targetAbsoluteVo2} onChange={setTargetAbsoluteVo2} min="0.5" max="12" step="0.01" />
              <NumberField label={en ? 'Baseline VLamax (mmol/L/s)' : 'VLamax de partida (mmol/L/s)'} value={baselineVlamax} onChange={value => { setBaselineVlamax(value); if (!targetVlamax) setTargetVlamax(value); }} min="0.01" max="2" step="0.01" />
              <NumberField label={en ? 'Scenario VLamax (mmol/L/s)' : 'VLamax del escenario (mmol/L/s)'} value={targetVlamax} onChange={setTargetVlamax} min="0.01" max="2" step="0.01" />
              <NumberField label={en ? 'Distribution volume (L/kg)' : 'Volumen de distribución (L/kg)'} value={distributionPerKg} onChange={setDistributionPerKg} min="0.35" max="0.65" step="0.01" />
              <NumberField label={en ? 'Locomotion cost improvement (%)' : 'Mejora del coste locomotor (%)'} value={economyImprovement} onChange={setEconomyImprovement} min="-20" max="20" step="1" />
              <NumberField label={en ? 'Reference lactate (mmol/L)' : 'Lactato de referencia (mmol/L)'} value={referenceLactate} onChange={setReferenceLactate} min="0.5" max="20" step="0.1" />
              <NumberField label={en ? 'Selected external load' : 'Carga externa seleccionada'} value={selectedLoad} onChange={setSelectedLoad} min="0" max={String(Math.ceil(maxLoad * 1.5))} step="1" unit={loadUnit ?? undefined} />
              <NumberField label={en ? 'Effort duration for energy split (s)' : 'Duración para reparto energético (s)'} value={effortDuration} onChange={setEffortDuration} min="10" max="3600" step="10" />
            </div>

            {!modelInput && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{en ? 'The lactate scenario needs at least two measured load stages, body mass, VO₂max and a saved or manually entered baseline VLamax. VO₂-only comparisons can still be reviewed from the profile above.' : 'El escenario de lactato necesita al menos dos etapas con carga, peso, VO₂max y una VLamax guardada o introducida manualmente como base.'}</div>}
            {modelInput && !scenario && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{en ? 'Check the scenario inputs. Weight and absolute VO₂max must be positive; economy must stay within ±20%.' : 'Revisa las entradas. El peso y VO₂max absoluto deben ser positivos; la economía debe quedar entre −20% y +20%.'}</div>}

            {scenario && <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <ComparisonMetric label="VO₂max relativo" before={`${scenario.baselineRelativeVo2maxMlKgMin.toFixed(1)} ml/kg/min`} after={`${scenario.scenarioRelativeVo2maxMlKgMin.toFixed(1)} ml/kg/min`} />
                <ComparisonMetric label="VO₂max absoluto" before={`${scenario.baselineAbsoluteVo2maxLMin.toFixed(2)} L/min`} after={`${scenario.scenarioAbsoluteVo2maxLMin.toFixed(2)} L/min`} />
                <ComparisonMetric label="VLamax" before={`${Number(baselineVlamax).toFixed(3)}`} after={`${Number(targetVlamax).toFixed(3)} mmol/L/s`} />
                <ComparisonMetric label={en ? 'Distribution volume' : 'Volumen de distribución'} before={`${scenario.baselineDistributionVolumeLitres.toFixed(1)} L`} after={`${scenario.scenarioDistributionVolumeLitres.toFixed(1)} L`} />
                <ComparisonMetric label={en ? 'Model balance load' : 'Carga de equilibrio modelada'} before={formatLoad(baseBalance, loadUnit)} after={formatLoad(scenarioBalance, loadUnit)} detail={`${referenceLactate} mmol/L`} />
              </div>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{en ? 'Net lactate flux at matched relative load' : 'Flujo neto de lactato a igual carga relativa'}</h3>
                  <p className="mt-1 text-xs text-gray-500">{en ? `Clearance below zero; accumulation above zero. Reference: ${referenceLactate} mmol/L.` : `Aclaramiento bajo cero; acumulación sobre cero. Referencia: ${referenceLactate} mmol/L.`}</p>
                  <ResponsiveContainer width="100%" height={290}>
                    <LineChart data={fluxChartData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="percent" stroke="#9ca3af" unit="%" /><YAxis stroke="#9ca3af" unit=" mmol/L/min" /><Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value.toFixed(3)} mmol/L/min`, name]} labelFormatter={(label: number, payload: Array<{ payload?: { baselineLoad: number; scenarioLoad: number } }>) => {
                      const row = payload?.[0]?.payload;
                      return `${label}% · ${en ? 'baseline' : 'base'} ${formatLoad(row?.baselineLoad ?? null, loadUnit)} · ${en ? 'scenario' : 'escenario'} ${formatLoad(row?.scenarioLoad ?? null, loadUnit)}`;
                    }} /><Legend /><ReferenceLine y={0} stroke="#6b7280" /><Line type="monotone" dataKey="baselineNet" name={en ? 'Baseline model' : 'Modelo base'} stroke="#2563eb" strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="scenarioNet" name={en ? 'Scenario model' : 'Modelo escenario'} stroke="#e11d48" strokeWidth={2.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </section>
                <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{en ? 'Energy demand at selected load' : 'Demanda energética a la carga seleccionada'}</h3>
                  <p className="mt-1 text-xs text-gray-500">{en ? `${formatLoad(Number(selectedLoad) || (lt2Load ?? maxLoad * 0.75), loadUnit)} · ${Math.max(10, Number(effortDuration) || 180)} s. Demand source: ${scenarioDemand?.demandSource === 'measured_regression' ? 'measured VO₂ regression' : 'inferred'}.` : `${formatLoad(Number(selectedLoad) || (lt2Load ?? maxLoad * 0.75), loadUnit)} · ${Math.max(10, Number(effortDuration) || 180)} s. Fuente de demanda: ${scenarioDemand?.demandSource === 'measured_regression' ? 'regresión de VO₂ medido' : 'inferida'}.`}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <DemandSummary title={en ? 'Baseline' : 'Base'} point={selectedBaselineDemand} en={en} />
                    <DemandSummary title={en ? 'Scenario' : 'Escenario'} point={selectedScenarioDemand} en={en} scenario />
                  </div>
                  <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700">
                    <p>{en ? 'Fuel values are only treated as measured when VO₂ and VCO₂/RER were collected. The scenario scales gas cost only under the visible body-mass/economy assumptions.' : 'El combustible se considera medido solo si se registró VO₂ y VCO₂/RER. El escenario escala el coste gaseoso solo según los supuestos visibles de peso/economía.'}</p>
                  </div>
                </section>
              </div>
              <details className="rounded-lg border border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <summary className="cursor-pointer font-semibold text-gray-700 dark:text-gray-200">{en ? 'Model assumptions and limits' : 'Supuestos y límites del modelo'}</summary>
                <div className="mt-2 space-y-1">
                  <p>{en ? 'Body mass changes assumed distribution volume linearly using the selected L/kg coefficient. This cannot separate fat mass from active tissue.' : 'El cambio de peso modifica linealmente el volumen de distribución con el coeficiente L/kg seleccionado. No separa masa grasa de tejido activo.'}</p>
                  <p>{en ? 'Economy change shifts external load capacity one-to-one as a sensitivity proxy. It is not a measured response and is not used to assert a new MLSS.' : 'La economía desplaza la capacidad de carga externa en proporción 1:1 como análisis de sensibilidad. No es una respuesta medida y no confirma un nuevo MLSS.'}</p>
                  <p>{en ? 'VLamax is the saved blood-lactate estimate. Its production term is scaled while the baseline model exponent is held fixed; this is an exploratory scenario.' : 'VLamax es la estimación sanguínea guardada. Se escala su término de producción y se conserva el exponente del modelo base; es un escenario exploratorio.'}</p>
                  {scenario.scenarioModel.issues.map(issue => <p key={issue} className="text-amber-700 dark:text-amber-300">{issue}</p>)}
                </div>
              </details>
            </>}
          </section>
        )}
      </>}
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step, unit }: { label: string; value: string; onChange: (value: string) => void; min?: string; max?: string; step?: string; unit?: string }) {
  return <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}<div className="relative"><input className={`${inputClass} ${unit ? 'pr-14' : ''}`} type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(event.target.value)} />{unit && <span className="pointer-events-none absolute right-3 top-3 text-xs text-gray-400">{unit}</span>}</div></label>;
}

function ReadOnlyMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="border-l-2 border-gray-200 px-3 dark:border-gray-700"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">{value}</p>{detail && <p className="mt-0.5 text-[11px] text-gray-400">{detail}</p>}</div>;
}

function ComparisonMetric({ label, before, after, detail }: { label: string; before: string; after: string; detail?: string }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"><p className="text-xs text-gray-500">{label}</p><div className="mt-2 flex items-baseline justify-between gap-2"><span className="text-xs text-gray-400">{before}</span><span className="text-sm font-bold text-[#5A4E6B] dark:text-purple-200">{after}</span></div>{detail && <p className="mt-1 text-[10px] text-gray-400">{detail}</p>}</div>;
}

function DemandSummary({ title, point, en, scenario = false }: { title: string; point: MetabolicDemandPoint | null; en: boolean; scenario?: boolean }) {
  const rerSource = scenario && point?.rerSource === 'measured'
    ? (en ? 'measured at baseline; held constant' : 'medido en test base; se asume constante')
    : point?.rerSource === 'measured' ? (en ? 'measured' : 'medido') : (en ? 'estimated' : 'estimado');
  return <div className="space-y-2"><p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{title}</p>{point ? <>
    <div className="text-xs text-gray-500">VO₂ demand <strong className="text-gray-800 dark:text-gray-200">{point.oxygenDemandMlKgMin.toFixed(1)} ml/kg/min</strong></div>
    <div className="text-xs text-gray-500">Aerobic / anaerobic <strong className="text-gray-800 dark:text-gray-200">{point.aerobicPercent.toFixed(0)} / {point.anaerobicPercent.toFixed(0)}%</strong></div>
    <div className="text-xs text-gray-500">Deficit / unmet <strong className="text-gray-800 dark:text-gray-200">{point.oxygenDeficitMlKgMin.toFixed(1)} / {point.unmetPercent.toFixed(0)}%</strong></div>
    <div className="text-xs text-gray-500">RER <strong className="text-gray-800 dark:text-gray-200">{point.rer.toFixed(2)} · {rerSource}</strong></div>
  </> : <p className="text-xs text-gray-400">—</p>}</div>;
}
