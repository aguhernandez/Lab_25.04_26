import { PhysiologyResults, ConfidenceLevel } from '../lib/physiology';
import { ThresholdConfidence } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface MetabolicProfileProps {
  results: PhysiologyResults;
  onEdit?: () => void;
}

function getConfidenceBadge(confidence: ConfidenceLevel | ThresholdConfidence, es = false) {
  const colors: Record<string, string> = {
    measured: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    estimated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    inferred: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    manual: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
  };

  const labels: Record<string, string> = es ? {
    measured: 'MEDIDO',
    estimated: 'ESTIMADO',
    inferred: 'INFERIDO',
    manual: 'MANUAL',
  } : {
    measured: 'MEASURED',
    estimated: 'ESTIMATED',
    inferred: 'INFERRED',
    manual: 'MANUAL',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[confidence] || colors.inferred}`}>
      {labels[confidence] || confidence.toUpperCase()}
    </span>
  );
}

export default function MetabolicProfile({ results, onEdit }: MetabolicProfileProps) {
  const { language } = useLanguage();
  const es = language === 'es';
  const fatmaxPercentVO2max = results.fatmax_vo2 && results.vo2max
    ? ((results.fatmax_vo2 / results.vo2max) * 100).toFixed(1)
    : null;

  const rows = [
    { label: 'HRmax', value: results.hrmax == null ? '—' : `${results.hrmax} bpm`, detail: null, confidence: results.hrmax_confidence },
    { label: 'VO₂max', value: results.vo2max == null ? '—' : `${results.vo2max.toFixed(1)} ml/kg/min`, detail: results.vo2max_ml_min == null ? null : `${Math.round(results.vo2max_ml_min)} ml/min`, confidence: results.vo2max_confidence },
    { label: 'LT1', value: results.lt1_hr == null ? '—' : `${results.lt1_hr} bpm`, detail: [results.lt1_power == null ? null : `${Math.round(results.lt1_power)} W`, results.lt1_pace, results.lt1_percent_vo2max == null ? null : `${results.lt1_percent_vo2max.toFixed(0)}% VO₂max`].filter(Boolean).join(' · ') || null, confidence: results.lt1_confidence },
    { label: 'LT2', value: results.lt2_hr == null ? '—' : `${results.lt2_hr} bpm`, detail: [results.lt2_power == null ? null : `${Math.round(results.lt2_power)} W`, results.lt2_pace, results.lt2_percent_vo2max == null ? null : `${results.lt2_percent_vo2max.toFixed(0)}% VO₂max`].filter(Boolean).join(' · ') || null, confidence: results.lt2_confidence },
    { label: 'FatMax', value: results.fatmax_hr == null ? '—' : `${results.fatmax_hr} bpm`, detail: [results.fatmax_power == null ? null : `${Math.round(results.fatmax_power)} W`, results.fatmax_pace, fatmaxPercentVO2max ? `${fatmaxPercentVO2max}% VO₂max` : null].filter(Boolean).join(' · ') || null, confidence: results.fatmax_confidence },
    ...(results.hr_drift_percent == null ? [] : [{ label: 'HR drift', value: `${results.hr_drift_percent > 0 ? '+' : ''}${results.hr_drift_percent}%`, detail: null, confidence: 'measured' as ConfidenceLevel }]),
  ];
  const sourceNote = results.has_lactate
    ? (es ? 'Los umbrales usan lactato medido; el método de selección sigue determinando cada valor.' : 'Thresholds use measured lactate; the selected method still determines each value.')
    : results.has_vo2
      ? (es ? 'Los umbrales se estiman a partir de VO₂ y frecuencia cardíaca.' : 'Thresholds are estimated from VO₂ and heart rate.')
      : (es ? 'Los umbrales se infieren de la progresión cardíaca y el modelo fisiológico.' : 'Thresholds are inferred from heart-rate progression and the physiology model.');

  return (
    <section className="border-y border-gray-200 py-5 dark:border-gray-700" aria-label={es ? 'Perfil metabólico' : 'Metabolic profile'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{es ? 'Perfil metabólico' : 'Metabolic profile'}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{es ? 'Valor principal, carga de trabajo y procedencia del dato.' : 'Primary value, external workload and evidence source.'}</p>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-[#5A4E6B] hover:text-[#5A4E6B] dark:border-gray-600 dark:text-gray-200 dark:hover:text-violet-200">
            {es ? 'Editar datos' : 'Edit data'}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="py-2 pr-4 font-semibold">{es ? 'Métrica' : 'Metric'}</th>
              <th className="py-2 pr-4 font-semibold">{es ? 'Resultado' : 'Result'}</th>
              <th className="py-2 pr-4 font-semibold">{es ? 'Carga / contexto' : 'Workload / context'}</th>
              <th className="py-2 font-semibold">{es ? 'Evidencia' : 'Evidence'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <th scope="row" className="py-3 pr-4 text-left font-semibold text-gray-800 dark:text-gray-100">{row.label}</th>
                <td className="py-3 pr-4 font-semibold tabular-nums text-[#514163] dark:text-violet-200">{row.value}</td>
                <td className="py-3 pr-4 text-xs text-gray-600 dark:text-gray-300">{row.detail ?? '—'}</td>
                <td className="py-3">{getConfidenceBadge(row.confidence, es)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results.thresholds && (
        <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
          <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{es ? 'Umbrales de lactato y ventilatorios' : 'Lactate and ventilatory thresholds'}</h4>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{es ? 'Se muestran por separado: una VT estimada desde LT no es una segunda medición independiente.' : 'Shown separately: a VT estimated from LT is not a second independent measurement.'}</p>
          <div className="divide-y divide-gray-100 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-700">
            <ThresholdRow ltLabel="LT1" vtLabel="VT1" ltHr={results.thresholds.LT1.hr} vtHr={results.thresholds.VT1.hr} ltConfidence={results.thresholds.LT1.confidence} vtConfidence={results.thresholds.VT1.confidence} delta={results.thresholds.delta_lt1_vt1_hr} es={es} />
            <ThresholdRow ltLabel="LT2" vtLabel="VT2" ltHr={results.thresholds.LT2.hr} vtHr={results.thresholds.VT2.hr} ltConfidence={results.thresholds.LT2.confidence} vtConfidence={results.thresholds.VT2.confidence} delta={results.thresholds.delta_lt2_vt2_hr} es={es} />
          </div>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
            {results.thresholds.vt_source === 'estimated_from_lt'
              ? (es ? 'VT estimados a partir de los umbrales de lactato.' : 'VT values estimated from lactate thresholds.')
              : results.thresholds.vt_source === 'manual'
                ? (es ? 'VT introducidos manualmente desde análisis de gases.' : 'VT values entered manually from gas-exchange analysis.')
                : (es ? 'VT derivados de medición directa.' : 'VT values derived from direct measurement.')}
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-700">
        <h4 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{es ? 'Lectura cualitativa del modelo' : 'Model interpretation'}</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          {[
            [es ? 'Capacidad aeróbica' : 'Aerobic capacity', results.metabolic_profile.aerobic_capacity],
            [es ? 'Uso de grasas' : 'Fat utilization', results.metabolic_profile.fat_utilization],
            [es ? 'Contribución anaeróbica' : 'Anaerobic contribution', results.metabolic_profile.anaerobic_contribution],
            [es ? 'Durabilidad' : 'Durability', results.metabolic_profile.durability],
          ].map(([label, value]) => <div key={String(label)}><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">{value}</p></div>)}
        </div>
      </div>
      <p className="mt-4 border-l-2 border-amber-400 pl-3 text-xs text-gray-600 dark:text-gray-300">{sourceNote}</p>
    </section>
  );
}

function ThresholdRow({ ltLabel, vtLabel, ltHr, vtHr, ltConfidence, vtConfidence, delta, es = false }: {
  ltLabel: string;
  vtLabel: string;
  ltHr: number | null;
  vtHr: number | null;
  ltConfidence: ThresholdConfidence;
  vtConfidence: ThresholdConfidence;
  delta: number | null;
  es?: boolean;
}) {
  const getDeltaStatus = (d: number | null) => {
    if (d === null || d === 0) return { label: es ? 'Coinciden' : 'Matching', color: 'text-green-600 dark:text-green-400' };
    if (Math.abs(d) <= 5) return { label: es ? 'Diferencia leve' : 'Slight difference', color: 'text-blue-600 dark:text-blue-400' };
    return { label: es ? 'Diferencia amplia' : 'Large difference', color: 'text-amber-600 dark:text-amber-400' };
  };

  const status = getDeltaStatus(delta);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{ltLabel}</span>
          <span className="ml-2 font-bold text-gray-900 dark:text-white">{ltHr ?? '—'} bpm</span>
          <span className="ml-2">{getConfidenceBadge(ltConfidence, es)}</span>
        </div>
        <div className="text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{vtLabel}</span>
          <span className="ml-2 font-bold text-gray-900 dark:text-white">{vtHr ?? '—'} bpm</span>
          <span className="ml-2">{getConfidenceBadge(vtConfidence, es)}</span>
        </div>
      </div>
      <div className="text-right">
          <div className={`text-sm font-semibold ${status.color}`}>
            {delta !== null && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta} bpm` : '0 bpm'}
          </div>
          <div className={`text-xs ${status.color}`}>{status.label}</div>
      </div>
    </div>
  );
}
