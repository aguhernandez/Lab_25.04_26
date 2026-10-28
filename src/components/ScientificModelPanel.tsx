import { useState } from 'react';
import type { PhysiologyResults } from '../lib/physiology';
import { PHYSIOLOGY_ALGORITHM_VERSION, summarizeInputSensitivity } from '../lib/scientificValidation';
import type { Sport, TestDataPoint } from '../types';
import { paceToKmh } from '../lib/trainingZones';
import ReferenceComparison from './ValidationReferenceComparison';

interface Props {
  results: PhysiologyResults;
  points: TestDataPoint[];
  language: string;
  savedAlgorithmVersion: string | null;
  saved: boolean;
  calculate: (points: TestDataPoint[]) => PhysiologyResults;
  sport?: Sport;
}

type InputKind = 'power' | 'speed' | 'lactate' | 'vo2' | 'vco2';
type SensitivityRow = { input: string; label: string; baseline: number; summary: ReturnType<typeof summarizeInputSensitivity>; unit: string };

function adjustSpeed(value: string | null | undefined, deltaKmh: number, sport?: Sport): string | null | undefined {
  const speed = value ? paceToKmh(value, sport ?? 'running') : null;
  if (speed == null) return value;
  const adjusted = Math.max(0.1, speed + deltaKmh);
  return `${adjusted} km/h`;
}

function perturb(points: TestDataPoint[], kind: InputKind, delta: number, sport?: Sport): TestDataPoint[] {
  return points.map(point => {
    if (kind === 'power' && point.power_watts != null) return { ...point, power_watts: Math.max(0, point.power_watts + delta) };
    if (kind === 'speed' && point.speed_pace) return { ...point, speed_pace: adjustSpeed(point.speed_pace, delta, sport) };
    if (kind === 'lactate' && point.lactate != null) return { ...point, lactate: Math.max(0, point.lactate + delta) };
    if (kind === 'vo2' && point.vo2_ml_kg_min != null) return { ...point, vo2_ml_kg_min: Math.max(0, point.vo2_ml_kg_min + delta) };
    if (kind === 'vco2' && point.vco2_ml_kg_min != null) return { ...point, vco2_ml_kg_min: Math.max(0, point.vco2_ml_kg_min + delta) };
    return { ...point };
  });
}

function outputMetrics(results: PhysiologyResults, sport?: Sport): Record<string, { value: number | null; unit: string }> {
  const cycling = results.has_power || sport === 'cycling' || sport?.startsWith('cycling_');
  const load = (power: number | null, pace: string | null): number | null => cycling ? power : pace ? paceToKmh(pace, sport ?? 'running') : null;
  return {
    LT1: { value: load(results.lt1_power, results.lt1_pace), unit: cycling ? 'W' : 'km/h' },
    LT2: { value: load(results.lt2_power, results.lt2_pace), unit: cycling ? 'W' : 'km/h' },
    FatMax: { value: load(results.fatmax_power, results.fatmax_pace), unit: cycling ? 'W' : 'km/h' },
    'VO₂máx': { value: results.vo2max, unit: 'ml/kg/min' },
    'FatMax oxidación': { value: results.lactate_analysis?.maxFatOxidation?.fatGramsPerMin ?? null, unit: 'g/min' },
  };
}

const inputClass = 'w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-[#5A4E6B] focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white';

export default function ScientificModelPanel({ results, points, language, savedAlgorithmVersion, saved, calculate, sport }: Props) {
  const en = language === 'en';
  const [errorValues, setErrorValues] = useState<Record<InputKind, string>>({ power: '', speed: '', lactate: '', vo2: '', vco2: '' });
  const [rows, setRows] = useState<SensitivityRow[]>([]);
  const [calculated, setCalculated] = useState(false);
  const [unavailable, setUnavailable] = useState(0);
  const [usedErrors, setUsedErrors] = useState(0);
  const baseMetrics = outputMetrics(results, sport);

  const runSensitivity = () => {
    const nextRows: SensitivityRow[] = [];
    let missing = 0;
    let assumptions = 0;
    const scenarioBaseline = outputMetrics(calculate(points), sport);
    (['power', 'speed', 'lactate', 'vo2', 'vco2'] as InputKind[]).forEach(kind => {
      const error = Number(errorValues[kind]);
      if (!(error > 0) || !Number.isFinite(error)) return;
      assumptions += 1;
      const lowMetrics = outputMetrics(calculate(perturb(points, kind, -error, sport)), sport);
      const highMetrics = outputMetrics(calculate(perturb(points, kind, error, sport)), sport);
      Object.entries(scenarioBaseline).forEach(([label, baseline]) => {
        if (baseline.value == null) return;
        const lower = lowMetrics[label]?.value;
        const upper = highMetrics[label]?.value;
        if (lower == null || upper == null) { missing += 1; return; }
        const summary = summarizeInputSensitivity(baseline.value, lower, upper);
        nextRows.push({
          input: kind,
          label,
          baseline: baseline.value,
          summary,
          unit: baseline.unit,
        });
      });
    });
    setRows(nextRows);
    setUnavailable(missing);
    setUsedErrors(assumptions);
    setCalculated(true);
  };

  const versionLabel = saved
    ? savedAlgorithmVersion
      ? `${savedAlgorithmVersion}${savedAlgorithmVersion !== PHYSIOLOGY_ALGORITHM_VERSION ? (en ? ' (historical version)' : ' (versión histórica)') : ''}`
      : (en ? 'Legacy result — algorithm version not recorded' : 'Resultado antiguo — versión del algoritmo no registrada')
    : `${PHYSIOLOGY_ALGORITHM_VERSION} · ${en ? 'pending save' : 'pendiente de guardar'}${savedAlgorithmVersion ? ` · ${en ? 'last saved' : 'último guardado'} ${savedAlgorithmVersion}` : ''}`;

  return (
    <section className="border-l-4 border-amber-500 bg-amber-50 px-4 py-4 dark:bg-amber-900/15" aria-label={en ? 'Scientific status and sensitivity' : 'Estado científico y sensibilidad'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{en ? 'Estimated by our model' : 'Estimado por nuestro modelo'}</p>
          <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
            {en
              ? 'Model interpretations are not externally validated against a metabolic cart or measured MLSS. Metric-specific confidence intervals and repeatability are unavailable until anonymized paired cohorts are available. Direct measurements are labelled as measured; other values should not be treated as scientifically equivalent to another platform.'
              : 'Las interpretaciones del modelo aún no están validadas externamente contra un carro metabólico o MLSS medido. Todavía no calculamos intervalos de confianza por métrica ni repetibilidad porque faltan cohortes pareadas anonimizadas. Las mediciones directas se etiquetan como medidas; los demás valores no deben tomarse como equivalentes científicos a otra plataforma.'}
          </p>
        </div>
        <span className="rounded-full border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-700 dark:text-amber-200">
          {en ? 'Validation pending' : 'Validación pendiente'}
        </span>
      </div>
      <p className="mt-3 text-[11px] text-amber-900 dark:text-amber-200">
        {en ? 'Algorithm version:' : 'Versión del algoritmo:'} <strong>{versionLabel}</strong>
      </p>

      <details className="mt-4 border-t border-amber-200 pt-3 dark:border-amber-800">
        <summary className="cursor-pointer text-xs font-bold text-gray-800 dark:text-gray-100">{en ? 'Explore measurement-error sensitivity' : 'Explorar sensibilidad al error de medición'}</summary>
        <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
          {en
            ? 'Enter the accuracy from the device specification or calibration. The resulting range is a scenario sensitivity band, not a confidence interval.'
            : 'Introduce la precisión indicada por el dispositivo o la calibración. Se recalcula la base con el algoritmo actual y cada error se aplica de forma sistemática a todas las etapas, uno por vez. El rango es sensibilidad por escenarios, no un intervalo de confianza.'}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {results.has_power && <label className="text-[11px] text-gray-600 dark:text-gray-300">{en ? 'Power error ± W' : 'Error de potencia ± W'}<input aria-label={en ? 'Power error in watts' : 'Error de potencia en vatios'} className={`${inputClass} mt-1 block`} min="0" step="0.1" type="number" value={errorValues.power} onChange={event => setErrorValues(current => ({ ...current, power: event.target.value }))} /></label>}
          {results.has_pace && <label className="text-[11px] text-gray-600 dark:text-gray-300">{en ? 'Speed error ± km/h' : 'Error de velocidad ± km/h'}<input aria-label={en ? 'Speed error in kilometers per hour' : 'Error de velocidad en kilómetros por hora'} className={`${inputClass} mt-1 block`} min="0" step="0.01" type="number" value={errorValues.speed} onChange={event => setErrorValues(current => ({ ...current, speed: event.target.value }))} /></label>}
          {results.has_lactate && <label className="text-[11px] text-gray-600 dark:text-gray-300">{en ? 'Lactate error ± mmol/L' : 'Error de lactato ± mmol/L'}<input aria-label={en ? 'Lactate error in millimoles per liter' : 'Error de lactato en milimoles por litro'} className={`${inputClass} mt-1 block`} min="0" step="0.01" type="number" value={errorValues.lactate} onChange={event => setErrorValues(current => ({ ...current, lactate: event.target.value }))} /></label>}
          {results.has_vo2 && <label className="text-[11px] text-gray-600 dark:text-gray-300">VO₂ ± ml/kg/min<input aria-label="VO2 error" className={`${inputClass} mt-1 block`} min="0" step="0.1" type="number" value={errorValues.vo2} onChange={event => setErrorValues(current => ({ ...current, vo2: event.target.value }))} /></label>}
          {results.has_rer && <label className="text-[11px] text-gray-600 dark:text-gray-300">VCO₂ ± ml/kg/min<input aria-label="VCO2 error" className={`${inputClass} mt-1 block`} min="0" step="0.1" type="number" value={errorValues.vco2} onChange={event => setErrorValues(current => ({ ...current, vco2: event.target.value }))} /></label>}
          <button type="button" onClick={runSensitivity} className="rounded-lg bg-[#5A4E6B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#493e58]">
            {en ? 'Calculate sensitivity' : 'Calcular sensibilidad'}
          </button>
        </div>
        {calculated && (
          rows.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row, index) => (
                <div key={`${row.input}-${row.label}-${index}`} className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 dark:border-amber-800 dark:bg-gray-900/30">
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{row.label} · {row.input === 'power' ? (en ? 'power' : 'potencia') : row.input === 'speed' ? (en ? 'speed' : 'velocidad') : row.input === 'lactate' ? (en ? 'lactate' : 'lactato') : row.input.toUpperCase()}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{row.summary.minimum.toFixed(1)}–{row.summary.maximum.toFixed(1)} {row.unit}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{en ? 'Baseline' : 'Base'}: {row.baseline.toFixed(1)} {row.unit}</p>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{!usedErrors ? (en ? 'Enter at least one positive measurement error.' : 'Introduce al menos un error de medición positivo.') : (en ? 'No comparable results are available for these scenarios.' : 'No hay resultados comparables disponibles para estos escenarios.')}</p>
        )}
        {calculated && unavailable > 0 && <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">{en ? `${unavailable} result/scenario combinations could not be calculated; missing values are not treated as zero.` : `${unavailable} combinaciones de resultado y escenario no pudieron calcularse; los valores ausentes no se consideran cero.`}</p>}
      </details>
      <ReferenceComparison metrics={baseMetrics} language={language} />
    </section>
  );
}
