import { useEffect, useMemo, useState } from 'react';
import { evaluateConstantLoadTrials, type ConstantLoadLactateTrial } from '../lib/lactateDynamics';
import type { PhysiologyResults } from '../lib/physiology';
import { supabase } from '../lib/supabase';
import type { AdvancedMetrics, Sport } from '../types';

interface Props {
  testId: string;
  sport: Sport;
  results: PhysiologyResults;
  advanced: AdvancedMetrics | null;
  language: string;
}

interface SavedVLamax {
  label?: 'vLamax_blood' | 'vLapeak_blood';
  netRateMmolLSecond?: number;
  confidence?: 'high' | 'medium' | 'low' | 'invalid';
}

interface SavedLactateDynamics {
  confirmationTrials?: ConstantLoadLactateTrial[];
}

function paceToKmh(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+):(\d{2})(?:\.(\d+))?/);
  if (match) {
    const secondsPerKm = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? '0'}`);
    return secondsPerKm > 0 ? 3600 / secondsPerKm : null;
  }
  const numeric = Number(value.replace(',', '.').match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatLoad(results: PhysiologyResults, sport: Sport, metric: 'lt1' | 'lt2' | 'fatmax'): string | null {
  const cycling = results.has_power || sport === 'cycling';
  if (cycling) {
    const watts = metric === 'lt1' ? results.lt1_power : metric === 'lt2' ? results.lt2_power : results.fatmax_power;
    return watts == null ? null : `${Math.round(watts)} W`;
  }
  const pace = metric === 'lt1' ? results.lt1_pace : metric === 'lt2' ? results.lt2_pace : results.fatmax_pace;
  const speed = paceToKmh(pace);
  return speed == null ? null : `${speed.toFixed(1)} km/h`;
}

export default function MetabolicFingerprint({ testId, sport, results, advanced, language }: Props) {
  const en = language === 'en';
  const [vlamax, setVLamax] = useState<SavedVLamax | null>(null);
  const [dynamics, setDynamics] = useState<SavedLactateDynamics | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.from('test_results').select('vlamax_assessment, lactate_dynamics_assessment')
      .eq('test_id', testId).maybeSingle().then(({ data }) => {
        if (cancelled) return;
        const row = data as { vlamax_assessment?: SavedVLamax; lactate_dynamics_assessment?: SavedLactateDynamics } | null;
        setVLamax(row?.vlamax_assessment ?? null);
        setDynamics(row?.lactate_dynamics_assessment ?? null);
      });
    return () => { cancelled = true; };
  }, [testId]);

  const measuredMLSS = useMemo(
    () => evaluateConstantLoadTrials(dynamics?.confirmationTrials ?? []),
    [dynamics],
  );

  const mlssLoadUnit = measuredMLSS.trials.find(trial => trial.load === measuredMLSS.load)?.loadUnit
    ?? (sport === 'cycling' ? 'W' : 'km/h');
  const mlssValue = measuredMLSS.status === 'confirmed' && measuredMLSS.load != null
    ? `${measuredMLSS.load.toFixed(1)} ${mlssLoadUnit}`
    : null;
  const economyValue = sport === 'cycling'
    ? advanced?.movementEconomy.cycling.efficiency_percent != null
      ? `${advanced.movementEconomy.cycling.efficiency_percent.toFixed(1)}% gross efficiency`
      : advanced?.movementEconomy.cycling.vo2_ml_kg_min_per_100w != null
        ? `${advanced.movementEconomy.cycling.vo2_ml_kg_min_per_100w.toFixed(1)} ml/kg/min per 100 W`
        : null
    : sport === 'running'
      ? advanced?.movementEconomy.running.cost_per_km_ml_o2_kg != null
        ? `${advanced.movementEconomy.running.cost_per_km_ml_o2_kg.toFixed(1)} ml O₂/kg/km`
        : null
      : sport === 'swimming' && advanced?.movementEconomy.swimming?.cost_per_100m_ml_o2_kg != null
        ? `${advanced.movementEconomy.swimming.cost_per_100m_ml_o2_kg.toFixed(1)} ml O₂/kg/100 m`
        : null;

  const metrics = [
    {
      label: 'VO₂max',
      value: results.vo2max_ml_kg_min == null ? null : `${results.vo2max_ml_kg_min.toFixed(1)} ml/kg/min`,
      status: results.vo2max_ml_kg_min == null ? 'unavailable' : results.vo2max_confidence === 'measured' ? 'measured' : 'estimated',
      source: results.vo2max_confidence === 'measured' ? (en ? 'Measured in test' : 'Medido en el test') : (en ? 'Estimated by model' : 'Estimado por modelo'),
      benchmark: en ? 'Group references by sex and sport exist; age and specialty are often missing.' : 'Hay referencias por sexo y deporte; a menudo faltan edad y especialidad.',
    },
    {
      label: vlamax?.label === 'vLapeak_blood' ? 'vLapeak' : 'VLamax',
      value: vlamax?.netRateMmolLSecond == null ? null : `${vlamax.netRateMmolLSecond.toFixed(3)} mmol/L/s`,
      status: vlamax?.netRateMmolLSecond == null ? 'unavailable' : 'estimated',
      source: vlamax ? `${en ? 'Sprint assessment' : 'Test de sprint'} · ${vlamax.confidence ?? '—'}` : (en ? 'No sprint assessment saved' : 'Sin test de sprint guardado'),
      benchmark: en ? 'No matched population cohort yet.' : 'Aún sin cohorte poblacional comparable.',
    },
    {
      label: 'MLSS',
      value: mlssValue,
      status: mlssValue ? 'measured' : 'unavailable',
      source: mlssValue ? (en ? 'Confirmed by constant-load trials' : 'Confirmado con tests constantes') : (en ? 'No measured confirmation' : 'Sin confirmación medida'),
      benchmark: en ? 'No matched population cohort yet.' : 'Aún sin cohorte poblacional comparable.',
    },
    {
      label: 'LT1',
      value: formatLoad(results, sport, 'lt1'),
      status: formatLoad(results, sport, 'lt1') ? 'estimated' : 'unavailable',
      source: `${en ? 'Threshold method' : 'Método de umbral'} · ${results.lt1_confidence}`,
      benchmark: en ? 'Available thresholds in literature use different definitions and protocols.' : 'Las referencias publicadas usan definiciones y protocolos distintos.',
    },
    {
      label: 'FatMax',
      value: formatLoad(results, sport, 'fatmax'),
      status: formatLoad(results, sport, 'fatmax') ? 'estimated' : 'unavailable',
      source: `${results.fatmax_method} · ${results.fatmax_confidence}`,
      benchmark: en ? 'No protocol-matched population reference.' : 'Sin referencia poblacional con protocolo equivalente.',
    },
    {
      label: 'CarbMax',
      value: null,
      status: 'unavailable',
      source: en ? 'Carbohydrate share by stage is not an oxidation rate (g/min).' : 'El porcentaje de carbohidratos por estadio no es una tasa de oxidación (g/min).',
      benchmark: en ? 'Not available for comparison.' : 'No disponible para comparar.',
    },
    {
      label: en ? 'Economy' : 'Economía',
      value: economyValue,
      status: economyValue ? 'estimated' : 'unavailable',
      source: economyValue ? (en ? 'Sport-specific estimate from this test' : 'Estimación específica del deporte en este test') : (en ? 'Insufficient measurements' : 'Mediciones insuficientes'),
      benchmark: en ? 'No method-matched population reference.' : 'Sin referencia poblacional con el mismo método.',
    },
    {
      label: en ? 'Glycogen' : 'Glucógeno',
      value: null,
      status: 'unavailable',
      source: en ? 'Not measured in this test' : 'No medido en este test',
      benchmark: en ? 'No matched population cohort yet.' : 'Aún sin cohorte poblacional comparable.',
    },
    {
      label: en ? 'Durability' : 'Durabilidad',
      value: results.hr_drift_percent == null ? null : `${results.hr_drift_percent.toFixed(1)}% HR drift`,
      status: results.hr_drift_percent == null ? 'unavailable' : 'estimated',
      source: results.hr_drift_percent == null ? (en ? 'No long-duration drift measurement' : 'Sin medición de deriva en esfuerzo prolongado') : (en ? 'Heart-rate drift proxy; not a direct durability test' : 'Proxy de deriva cardíaca; no es un test directo de durabilidad'),
      benchmark: en ? 'No protocol-matched population reference.' : 'Sin referencia poblacional con el mismo protocolo.',
    },
  ];

  return (
    <section className="border-y border-gray-200 py-5 dark:border-gray-700" aria-label={en ? 'Metabolic fingerprint' : 'Huella metabólica'}>
      <div className="mb-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{en ? 'Metabolic fingerprint' : 'Fingerprint metabólico'}</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {en
            ? 'One view of nine metrics. A population comparison is shown only where the metric and protocol are sufficiently comparable; missing benchmarks are left blank.'
            : 'Vista conjunta de nueve métricas. Solo se indica comparación poblacional cuando la métrica y el protocolo son suficientemente comparables; donde falta referencia, queda indicado.'}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(metric => (
          <div key={metric.label} className="min-w-0 border-b border-gray-200 py-4 dark:border-gray-700">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-sm text-gray-800 dark:text-gray-100">{metric.label}</strong>
              <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${metric.status === 'measured' ? 'text-green-700 dark:text-green-300' : metric.status === 'estimated' ? 'text-[#5A4E6B] dark:text-violet-300' : 'text-gray-400 dark:text-gray-500'}`}>
                {metric.status === 'measured' ? (en ? 'Measured' : 'Medido') : metric.status === 'estimated' ? (en ? 'Estimated' : 'Estimado') : (en ? 'Unavailable' : 'No disponible')}
              </span>
            </div>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${metric.value ? 'text-[#5A4E6B] dark:text-violet-300' : 'text-gray-400 dark:text-gray-500'}`}>{metric.value ?? '—'}</p>
            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">{metric.source}</p>
            <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gray-400">{metric.benchmark}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        {en
          ? 'Fingerprint values are model estimates or test observations, not a validated percentile score. References can be explored in the comparison section below.'
          : 'Los valores del fingerprint son estimaciones del modelo u observaciones del test; no constituyen un percentil validado. Las referencias disponibles se pueden explorar en la comparativa inferior.'}
      </p>
    </section>
  );
}
