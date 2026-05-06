import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  AnthropometryReference,
  ANTHRO_REFERENCES,
  SPORT_LABELS,
  LEVEL_ORDER,
  Sport,
  Sex,
  CompetitiveLevel,
  PopulationCategory,
  POPULATION_CATEGORY_LABELS,
  getAnthroReferences,
  getAnthroReferencesByCategory,
} from '../lib/referencePopulations';

type AnthroMetric = 'body_fat' | 'sum_6_skinfolds' | 'muscle_mass' | 'muscle_bone_ratio';

interface AnthropometryComparisonProps {
  bodyFatPercent?: number | null;
  sum6Skinfolds?: number | null;
  muscleMassPercent?: number | null;
  muscleBoneRatio?: number | null;
  sex: Sex;
  defaultSport?: Sport;
  inline?: boolean;
}

const METRIC_LABELS: Record<AnthroMetric, string> = {
  body_fat: '% Graso',
  sum_6_skinfolds: 'Σ6 Pliegues (mm)',
  muscle_mass: '% Muscular',
  muscle_bone_ratio: 'Índice Músculo-Óseo',
};

const METRIC_UNITS: Record<AnthroMetric, string> = {
  body_fat: '%',
  sum_6_skinfolds: 'mm',
  muscle_mass: '%',
  muscle_bone_ratio: '',
};

const LEVEL_COLORS: Record<CompetitiveLevel, string> = {
  recreational: '#6b7280',
  national: '#3b82f6',
  international: '#10b981',
  professional: '#f59e0b',
  world_class: '#ef4444',
};

const LEVEL_BG: Record<CompetitiveLevel, string> = {
  recreational: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  national: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  international: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  professional: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  world_class: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const CATEGORY_COLORS: Record<PopulationCategory, string> = {
  active: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700',
  amateur: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  professional: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
};

const CATEGORY_ACTIVE_COLORS: Record<PopulationCategory, string> = {
  active: 'bg-sky-600 text-white border-sky-600',
  amateur: 'bg-amber-500 text-white border-amber-500',
  professional: 'bg-emerald-600 text-white border-emerald-600',
};

export default function AnthropometryComparison({
  bodyFatPercent,
  sum6Skinfolds,
  muscleMassPercent,
  muscleBoneRatio,
  sex,
  defaultSport,
  inline = false,
}: AnthropometryComparisonProps) {
  const [selectedSport, setSelectedSport] = useState<Sport>(defaultSport ?? 'cycling_road');
  const [selectedCategory, setSelectedCategory] = useState<PopulationCategory | 'all'>('all');
  const [refs, setRefs] = useState<AnthropometryReference[]>([]);
  const [showCitations, setShowCitations] = useState(false);
  const [activeMetric, setActiveMetric] = useState<AnthroMetric>(() => {
    if (sum6Skinfolds != null) return 'sum_6_skinfolds';
    if (bodyFatPercent != null) return 'body_fat';
    if (muscleMassPercent != null) return 'muscle_mass';
    if (muscleBoneRatio != null) return 'muscle_bone_ratio';
    return 'body_fat';
  });

  useEffect(() => {
    loadRefs();
  }, [selectedSport, sex, selectedCategory]);

  const loadRefs = async () => {
    const builtIn = selectedCategory === 'all'
      ? getAnthroReferences(selectedSport, sex)
      : getAnthroReferencesByCategory(selectedSport, sex, selectedCategory);

    const query = supabase
      .from('custom_anthro_references')
      .select('*')
      .eq('sport', selectedSport)
      .eq('sex', sex);

    const { data } = await query;

    let custom: AnthropometryReference[] = (data || []).map(r => ({
      ...r,
      is_custom: true,
    }));

    if (selectedCategory !== 'all') {
      custom = custom.filter(r => r.population_category === selectedCategory);
    }

    const all = [...builtIn, ...custom].sort(
      (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level)
    );
    setRefs(all);
  };

  const sports = [...new Set(ANTHRO_REFERENCES.map(r => r.sport))] as Sport[];

  const getMetricValue = (metric: AnthroMetric): number | null | undefined => {
    if (metric === 'body_fat') return bodyFatPercent;
    if (metric === 'sum_6_skinfolds') return sum6Skinfolds;
    if (metric === 'muscle_mass') return muscleMassPercent;
    if (metric === 'muscle_bone_ratio') return muscleBoneRatio;
    return null;
  };

  const getRefMean = (r: AnthropometryReference, metric: AnthroMetric): number => {
    if (metric === 'body_fat') return r.body_fat_mean ?? 0;
    if (metric === 'sum_6_skinfolds') return r.sum_6_skinfolds_mean ?? 0;
    if (metric === 'muscle_mass') return r.muscle_mass_percent_mean ?? 0;
    if (metric === 'muscle_bone_ratio') return r.muscle_bone_ratio_mean ?? 0;
    return 0;
  };

  const getRefMin = (r: AnthropometryReference, metric: AnthroMetric): number => {
    if (metric === 'body_fat') return r.body_fat_min ?? (r.body_fat_mean ?? 0) - (r.body_fat_sd ?? 2) * 1.5;
    if (metric === 'sum_6_skinfolds') return r.sum_6_skinfolds_min ?? (r.sum_6_skinfolds_mean ?? 0) - (r.sum_6_skinfolds_sd ?? 10) * 1.5;
    if (metric === 'muscle_mass') return (r.muscle_mass_percent_mean ?? 0) - (r.muscle_mass_percent_sd ?? 2) * 1.5;
    if (metric === 'muscle_bone_ratio') return (r.muscle_bone_ratio_mean ?? 0) - (r.muscle_bone_ratio_sd ?? 0.3) * 1.5;
    return 0;
  };

  const getRefMax = (r: AnthropometryReference, metric: AnthroMetric): number => {
    if (metric === 'body_fat') return r.body_fat_max ?? (r.body_fat_mean ?? 0) + (r.body_fat_sd ?? 2) * 1.5;
    if (metric === 'sum_6_skinfolds') return r.sum_6_skinfolds_max ?? (r.sum_6_skinfolds_mean ?? 0) + (r.sum_6_skinfolds_sd ?? 10) * 1.5;
    if (metric === 'muscle_mass') return (r.muscle_mass_percent_mean ?? 0) + (r.muscle_mass_percent_sd ?? 2) * 1.5;
    if (metric === 'muscle_bone_ratio') return (r.muscle_bone_ratio_mean ?? 0) + (r.muscle_bone_ratio_sd ?? 0.3) * 1.5;
    return 0;
  };

  const refsWithMetric = (metric: AnthroMetric) => refs.filter(r => {
    if (metric === 'body_fat') return r.body_fat_mean != null;
    if (metric === 'sum_6_skinfolds') return r.sum_6_skinfolds_mean != null;
    if (metric === 'muscle_mass') return r.muscle_mass_percent_mean != null;
    if (metric === 'muscle_bone_ratio') return r.muscle_bone_ratio_mean != null;
    return false;
  });

  const availableMetrics: AnthroMetric[] = (['body_fat', 'sum_6_skinfolds', 'muscle_mass', 'muscle_bone_ratio'] as AnthroMetric[]).filter(m => {
    const val = getMetricValue(m);
    return val != null && refsWithMetric(m).length > 0;
  });

  const currentRefs = refsWithMetric(activeMetric);
  const currentValue = getMetricValue(activeMetric);
  const unit = METRIC_UNITS[activeMetric];

  if (availableMetrics.length === 0 || currentValue == null || currentRefs.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos antropométricos o referencias disponibles para esta selección.</p>
      </div>
    );
  }

  const vals = currentRefs.flatMap(r => [getRefMin(r, activeMetric), getRefMax(r, activeMetric)]).filter(v => v != null);
  const scaleMin = Math.min(...vals, currentValue) - (activeMetric === 'sum_6_skinfolds' ? 5 : 1);
  const scaleMax = Math.max(...vals, currentValue) + (activeMetric === 'sum_6_skinfolds' ? 5 : 1);
  const scaleRange = scaleMax - scaleMin || 1;
  const toX = (v: number) => Math.max(0, Math.min(100, ((v - scaleMin) / scaleRange) * 100));
  const athleteX = toX(currentValue);

  const closestRef = currentRefs.reduce((best, r) => {
    return Math.abs(currentValue - getRefMean(r, activeMetric)) < Math.abs(currentValue - getRefMean(best, activeMetric)) ? r : best;
  }, currentRefs[0]);

  const diff = Math.round((currentValue - getRefMean(closestRef, activeMetric)) * 10) / 10;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;

  return (
    <div className={inline ? '' : 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden'}>
      {!inline && (
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Comparativa Antropométrica</h3>
              <p className="text-xs text-emerald-100">Composición corporal vs. poblaciones deportivas publicadas</p>
            </div>
          </div>
        </div>
      )}

      <div className={inline ? '' : 'p-6'}>
        <div className="space-y-5">

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Deporte / Disciplina</label>
              <select
                value={selectedSport}
                onChange={e => setSelectedSport(e.target.value as Sport)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {sports.map(s => (
                  <option key={s} value={s}>{SPORT_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tipo de Población</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${selectedCategory === 'all' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}
              >
                Todos
              </button>
              {(['active', 'amateur', 'professional'] as PopulationCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${selectedCategory === cat ? CATEGORY_ACTIVE_COLORS[cat] : CATEGORY_COLORS[cat]}`}
                >
                  {POPULATION_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {availableMetrics.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Variable de Comparación</label>
              <div className="flex flex-wrap gap-2">
                {availableMetrics.map(m => (
                  <button
                    key={m}
                    onClick={() => setActiveMetric(m)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${activeMetric === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-emerald-400'}`}
                  >
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{METRIC_LABELS[activeMetric]}</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {currentValue.toFixed(activeMetric === 'muscle_bone_ratio' ? 2 : 1)}
                {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
              </p>
            </div>

            <div className={`flex-1 rounded-xl px-4 py-2 ${LEVEL_BG[closestRef.level]}`}>
              <p className="text-xs font-semibold opacity-60 uppercase tracking-wider mb-0.5">Referencia más cercana</p>
              <p className="text-sm font-bold">{closestRef.level_label}</p>
              <p className="text-xs opacity-80">
                {diffLabel} {unit} vs. media ({getRefMean(closestRef, activeMetric).toFixed(activeMetric === 'muscle_bone_ratio' ? 2 : 1)})
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Espectro de referencia</p>
            <div className="relative h-14 mb-6">
              <div className="absolute inset-x-0 top-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />

              {currentRefs.map((ref) => {
                const xMin = toX(getRefMin(ref, activeMetric));
                const xMax = toX(getRefMax(ref, activeMetric));
                const xMid = toX(getRefMean(ref, activeMetric));
                return (
                  <div key={ref.id}>
                    <div
                      className="absolute top-4 h-2 rounded-full opacity-40"
                      style={{
                        left: `${xMin}%`,
                        width: `${Math.max(1, xMax - xMin)}%`,
                        backgroundColor: LEVEL_COLORS[ref.level],
                      }}
                    />
                    <div
                      className="absolute w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 top-3.5"
                      style={{ left: `calc(${xMid}% - 6px)`, backgroundColor: LEVEL_COLORS[ref.level] }}
                    />
                    <div
                      className="absolute top-8 text-center"
                      style={{ left: `${xMid}%`, transform: 'translateX(-50%)', width: 44 }}
                    >
                      <p className="text-[9px] font-semibold" style={{ color: LEVEL_COLORS[ref.level] }}>
                        {getRefMean(ref, activeMetric).toFixed(activeMetric === 'muscle_bone_ratio' ? 2 : 1)}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div className="absolute top-1 z-10" style={{ left: `calc(${athleteX}% - 10px)` }}>
                <div className="w-5 h-5 rounded-full bg-[#fdda36] border-2 border-slate-800 shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-800" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {currentRefs.map((ref) => {
              const mean = getRefMean(ref, activeMetric);
              const min = getRefMin(ref, activeMetric);
              const max = getRefMax(ref, activeMetric);
              const inRange = currentValue >= min && currentValue <= max;
              const decimals = activeMetric === 'muscle_bone_ratio' ? 2 : 1;
              return (
                <div
                  key={ref.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${inRange ? 'border-current' : 'border-gray-200 dark:border-gray-700 opacity-75'}`}
                  style={inRange ? { borderColor: LEVEL_COLORS[ref.level] + '60', backgroundColor: LEVEL_COLORS[ref.level] + '10' } : {}}
                >
                  <div className="w-1.5 flex-shrink-0 h-full rounded-full self-stretch" style={{ backgroundColor: LEVEL_COLORS[ref.level], minHeight: 40 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{ref.level_label}</span>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium border ${CATEGORY_COLORS[ref.population_category]}`}>
                        {POPULATION_CATEGORY_LABELS[ref.population_category]}
                      </span>
                      {ref.is_custom && <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded font-medium">Personalizado</span>}
                      {inRange && <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: LEVEL_COLORS[ref.level] + '20', color: LEVEL_COLORS[ref.level] }}>Tu rango</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ref.population} · {ref.citation_short} ({ref.year})</p>
                    {ref.measurement_protocol && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Protocolo: {ref.measurement_protocol}</p>}
                    {ref.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{ref.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{mean.toFixed(decimals)} {unit}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{min.toFixed(decimals)}–{max.toFixed(decimals)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowCitations(!showCitations)}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showCitations ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showCitations ? 'Ocultar' : 'Ver'} referencias científicas
          </button>

          {showCitations && (
            <div className="space-y-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
              {refs.map((ref) => (
                <div key={ref.id} className="text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 last:border-0 pb-2 last:pb-0">
                  <span className="inline-block w-2 h-2 rounded-full mr-2 mb-0.5 align-middle" style={{ backgroundColor: LEVEL_COLORS[ref.level] }} />
                  <strong>{ref.level_label}</strong> · {ref.citation}
                  {ref.notes && <p className="ml-4 mt-0.5 italic text-gray-500 dark:text-gray-500">{ref.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
