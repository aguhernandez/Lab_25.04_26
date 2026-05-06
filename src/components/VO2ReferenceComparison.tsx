import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  VO2Reference,
  VO2_REFERENCES,
  SPORT_LABELS,
  LEVEL_LABELS,
  LEVEL_ORDER,
  Sport,
  Sex,
  CompetitiveLevel,
  PopulationCategory,
  POPULATION_CATEGORY_LABELS,
  getVO2References,
  getVO2ReferencesByCategory,
} from '../lib/referencePopulations';
import { useLanguage } from '../contexts/LanguageContext';

type CompareTab = 'vo2' | 'lactate';

interface VO2ReferenceComparisonProps {
  vo2max: number;
  lactateAtLT1?: number | null;
  lactateAtLT2?: number | null;
  sex: Sex;
  defaultSport?: Sport;
  inline?: boolean;
}

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

export default function VO2ReferenceComparison({
  vo2max,
  lactateAtLT1,
  lactateAtLT2,
  sex,
  defaultSport,
  inline = false,
}: VO2ReferenceComparisonProps) {
  const { t } = useLanguage();
  const [selectedSport, setSelectedSport] = useState<Sport>(defaultSport ?? 'cycling_road');
  const [selectedCategory, setSelectedCategory] = useState<PopulationCategory | 'all'>('all');
  const [compareTab, setCompareTab] = useState<CompareTab>('vo2');
  const [refs, setRefs] = useState<VO2Reference[]>([]);
  const [showCitations, setShowCitations] = useState(false);

  useEffect(() => {
    loadRefs();
  }, [selectedSport, sex, selectedCategory]);

  const loadRefs = async () => {
    const builtIn = selectedCategory === 'all'
      ? getVO2References(selectedSport, sex)
      : getVO2ReferencesByCategory(selectedSport, sex, selectedCategory);

    const { data } = await supabase
      .from('custom_vo2_references')
      .select('*')
      .eq('sport', selectedSport)
      .eq('sex', sex);

    let custom: VO2Reference[] = (data || []).map(r => ({
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

  const sports = [...new Set(VO2_REFERENCES.map(r => r.sport))] as Sport[];

  const refsWithLactate = refs.filter(r => r.lactate_lt1_vo2_percent != null || r.lactate_lt2_vo2_percent != null);

  if (refs.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('vo2ref.noData')} {SPORT_LABELS[selectedSport]} ({sex}).</p>
      </div>
    );
  }

  const vo2values = refs.map(r => r.vo2max_min).concat(refs.map(r => r.vo2max_max));
  const scaleMin = Math.min(...vo2values, vo2max) - 3;
  const scaleMax = Math.max(...vo2values, vo2max) + 3;
  const scaleRange = scaleMax - scaleMin;

  const toX = (v: number) => Math.max(0, Math.min(100, ((v - scaleMin) / scaleRange) * 100));
  const athleteX = toX(vo2max);

  const closestRef = refs.reduce((best, r) => {
    return Math.abs(vo2max - r.vo2max_mean) < Math.abs(vo2max - best.vo2max_mean) ? r : best;
  }, refs[0]);

  const diff = Math.round((vo2max - closestRef.vo2max_mean) * 10) / 10;
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;

  const lt1VO2 = lactateAtLT1 != null ? lactateAtLT1 : null;
  const lt2VO2 = lactateAtLT2 != null ? lactateAtLT2 : null;

  return (
    <div className={inline ? '' : 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden'}>
      {!inline && (
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{t('vo2ref.title')}</h3>
              <p className="text-xs text-blue-100">{t('vo2ref.subtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <div className={inline ? '' : 'p-6'}>
        <div className="space-y-5">

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('vo2ref.sportDiscipline')}</label>
              <select
                value={selectedSport}
                onChange={e => setSelectedSport(e.target.value as Sport)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sports.map(s => (
                  <option key={s} value={s}>{SPORT_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-2 flex-shrink-0">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('vo2ref.athleteVO2')}</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{vo2max.toFixed(1)} <span className="text-sm font-normal">mL/kg/min</span></p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('vo2ref.populationType')}</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${selectedCategory === 'all' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}
              >
                {t('vo2ref.all')}
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

          {refsWithLactate.length > 0 && (
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden self-start">
              <button
                onClick={() => setCompareTab('vo2')}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${compareTab === 'vo2' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
              >
                VO2max
              </button>
              <button
                onClick={() => setCompareTab('lactate')}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${compareTab === 'lactate' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'}`}
              >
                {t('vo2ref.lactateThresholds')}
              </button>
            </div>
          )}

          {compareTab === 'vo2' && (
            <>
              <div className={`rounded-xl px-4 py-3 ${LEVEL_BG[closestRef.level]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-0.5">{t('vo2ref.closestLevel')}</p>
                    <p className="text-base font-bold">{closestRef.level_label}</p>
                    <p className="text-xs mt-0.5 opacity-80">{closestRef.sport_label} · {closestRef.population}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium opacity-60">{t('vo2ref.vsMean')} ({closestRef.vo2max_mean})</p>
                    <p className="text-lg font-bold">{diffLabel} mL/kg/min</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('vo2ref.competitiveSpectrum')}</p>
                <div className="relative h-16 mb-8">
                  <div className="absolute inset-x-0 top-4 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />

                  {refs.map((ref) => {
                    const xMin = toX(ref.vo2max_min);
                    const xMax = toX(ref.vo2max_max);
                    const xMid = toX(ref.vo2max_mean);
                    return (
                      <div key={ref.id}>
                        <div
                          className="absolute top-4 h-2 rounded-full opacity-40"
                          style={{ left: `${xMin}%`, width: `${Math.max(1, xMax - xMin)}%`, backgroundColor: LEVEL_COLORS[ref.level] }}
                        />
                        <div
                          className="absolute w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 top-3.5"
                          style={{ left: `calc(${xMid}% - 6px)`, backgroundColor: LEVEL_COLORS[ref.level] }}
                        />
                        <div className="absolute top-8 text-center" style={{ left: `${xMid}%`, transform: 'translateX(-50%)', width: '60px' }}>
                          <p className="text-[9px] font-semibold leading-tight" style={{ color: LEVEL_COLORS[ref.level] }}>
                            {ref.vo2max_mean}
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

                <div className="flex flex-wrap gap-2">
                  {LEVEL_ORDER.map(level => {
                    if (!refs.some(r => r.level === level)) return null;
                    return (
                      <span key={level} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: LEVEL_COLORS[level] }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                        {LEVEL_LABELS[level]}
                      </span>
                    );
                  })}
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-[#fdda36]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#fdda36]" />
                    {t('vo2ref.athlete')} ({sex === 'male' ? 'M' : 'F'})
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('vo2ref.valuesPerLevel')}</p>
                {refs.map((ref) => {
                  const inRange = vo2max >= ref.vo2max_min && vo2max <= ref.vo2max_max;
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
                          {ref.is_custom && <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded font-medium">{t('vo2ref.custom')}</span>}
                          {inRange && <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: LEVEL_COLORS[ref.level] + '20', color: LEVEL_COLORS[ref.level] }}>{t('vo2ref.yourRange')}</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ref.population} · {ref.citation_short} ({ref.year})</p>
                        {(ref.lactate_lt1_vo2_percent || ref.lactate_lt2_vo2_percent) && (
                          <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
                            {ref.lactate_lt1_vo2_percent && `LT1: ${ref.lactate_lt1_vo2_percent}% VO2max`}
                            {ref.lactate_lt1_vo2_percent && ref.lactate_lt2_vo2_percent && ' · '}
                            {ref.lactate_lt2_vo2_percent && `LT2: ${ref.lactate_lt2_vo2_percent}% VO2max`}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {ref.vo2max_mean}
                          {ref.vo2max_sd && <span className="text-xs font-normal text-gray-500 ml-0.5">±{ref.vo2max_sd}</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{ref.vo2max_min}–{ref.vo2max_max}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {compareTab === 'lactate' && (
            <div className="space-y-4">
              {(lt1VO2 != null || lt2VO2 != null) && (
                <div className="flex gap-3 flex-wrap">
                  {lt1VO2 != null && (
                    <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl px-4 py-2">
                      <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">{t('vo2ref.lt1Athlete')}</p>
                      <p className="text-xl font-bold text-sky-700 dark:text-sky-300">{lt1VO2.toFixed(1)} <span className="text-sm font-normal">mL/kg/min</span></p>
                      <p className="text-xs text-sky-500">{((lt1VO2 / vo2max) * 100).toFixed(1)}% VO2max</p>
                    </div>
                  )}
                  {lt2VO2 != null && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-2">
                      <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">{t('vo2ref.lt2Athlete')}</p>
                      <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{lt2VO2.toFixed(1)} <span className="text-sm font-normal">mL/kg/min</span></p>
                      <p className="text-xs text-orange-500">{((lt2VO2 / vo2max) * 100).toFixed(1)}% VO2max</p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('vo2ref.lactateRefs')}</p>
                {refsWithLactate.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{t('vo2ref.noLactateData')}</p>
                ) : (
                  refsWithLactate.map(ref => {
                    const lt1RefVo2 = ref.lactate_lt1_vo2_percent != null ? (ref.vo2max_mean * ref.lactate_lt1_vo2_percent / 100) : null;
                    const lt2RefVo2 = ref.lactate_lt2_vo2_percent != null ? (ref.vo2max_mean * ref.lactate_lt2_vo2_percent / 100) : null;
                    const lt1AthletePercent = lt1VO2 != null ? ((lt1VO2 / vo2max) * 100) : null;
                    const lt2AthletePercent = lt2VO2 != null ? ((lt2VO2 / vo2max) * 100) : null;
                    return (
                      <div key={ref.id} className="p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: LEVEL_COLORS[ref.level] }} />
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{ref.level_label}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium border ${CATEGORY_COLORS[ref.population_category]}`}>
                            {POPULATION_CATEGORY_LABELS[ref.population_category]}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{ref.citation_short} ({ref.year})</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {ref.lactate_lt1_vo2_percent != null && (
                            <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 mb-1">{t('vo2ref.lt1Aerobic')}</p>
                              <p className="text-sm font-bold text-sky-700 dark:text-sky-300">{ref.lactate_lt1_vo2_percent}% VO2max</p>
                              {lt1RefVo2 && <p className="text-xs text-sky-500">≈ {lt1RefVo2.toFixed(1)} mL/kg/min</p>}
                              {lt1AthletePercent != null && (
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                  {t('vo2ref.athleteLabel')}: {lt1AthletePercent.toFixed(1)}%
                                  <span className={`ml-1 font-semibold ${lt1AthletePercent >= ref.lactate_lt1_vo2_percent ? 'text-green-600' : 'text-red-500'}`}>
                                    ({lt1AthletePercent >= ref.lactate_lt1_vo2_percent ? '+' : ''}{(lt1AthletePercent - ref.lactate_lt1_vo2_percent).toFixed(1)}%)
                                  </span>
                                </p>
                              )}
                            </div>
                          )}
                          {ref.lactate_lt2_vo2_percent != null && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 mb-1">{t('vo2ref.lt2Anaerobic')}</p>
                              <p className="text-sm font-bold text-orange-700 dark:text-orange-300">{ref.lactate_lt2_vo2_percent}% VO2max</p>
                              {lt2RefVo2 && <p className="text-xs text-orange-500">≈ {lt2RefVo2.toFixed(1)} mL/kg/min</p>}
                              {lt2AthletePercent != null && (
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                                  {t('vo2ref.athleteLabel')}: {lt2AthletePercent.toFixed(1)}%
                                  <span className={`ml-1 font-semibold ${lt2AthletePercent >= ref.lactate_lt2_vo2_percent ? 'text-green-600' : 'text-red-500'}`}>
                                    ({lt2AthletePercent >= ref.lactate_lt2_vo2_percent ? '+' : ''}{(lt2AthletePercent - ref.lactate_lt2_vo2_percent).toFixed(1)}%)
                                  </span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowCitations(!showCitations)}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showCitations ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showCitations ? t('vo2ref.hideRefs') : t('vo2ref.showRefs')} ({refs.length})
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
