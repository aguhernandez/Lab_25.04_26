import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import type { Athlete } from '../../types';
import { loadSimulationProfile } from '../../lib/simulationProfile';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  simulateAltitude,
  simulateRace,
  formatTime,
  formatPace,
  type AthletePhysioProfile,
  type AltitudeScenario,
} from '../../lib/simulationEngine';

const PRESETS = [
  { label: 'Sierra Nevada (ESP)', alt: 2320 },
  { label: 'Font Romeu', alt: 1850 },
  { label: 'Flagstaff', alt: 2106 },
  { label: 'St. Moritz', alt: 1856 },
  { label: 'Iten (Kenya)', alt: 2400 },
  { label: 'Bogota', alt: 2625 },
];

const RACE_DISTANCES = [
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
  { label: '21K', km: 21.0975 },
  { label: '42K', km: 42.195 },
];

export default function AltitudeBlockComparison() {
  const { t, language } = useLanguage();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [physioProfile, setPhysioProfile] = useState<AthletePhysioProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [altitude, setAltitude] = useState(2400);
  const [blockDays, setBlockDays] = useState(21);
  const [raceDistanceIdx, setRaceDistanceIdx] = useState(2);
  const [racePaceStr, setRacePaceStr] = useState('4:45');

  const [result, setResult] = useState<ReturnType<typeof computeComparison> | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    supabase.from('athletes').select('*').order('name').then(({ data }) => {
      if (data) setAthletes(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedAthleteId) return;
    setLoadingProfile(true);
    loadProfile(selectedAthleteId);
  }, [selectedAthleteId]);

  async function loadProfile(athleteId: string) {
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete) return;
    const profile = await loadSimulationProfile(athlete);
    setPhysioProfile(profile);
    setLoadingProfile(false);
  }

  function parsePace(paceStr: string): number {
    const parts = paceStr.split(':');
    if (parts.length !== 2) return 5;
    return parseInt(parts[0]) + parseInt(parts[1]) / 60;
  }

  function computeComparison(profile: AthletePhysioProfile) {
    const altScenario: AltitudeScenario = {
      altitude_m: altitude,
      exposure_days: blockDays,
      training_load: 'moderate',
    };
    const altResult = simulateAltitude(profile, altScenario);

    const lastDay = altResult.acclimatization_timeline[altResult.acclimatization_timeline.length - 1];
    const vo2maxBoost = (lastDay.rbc_increase_percent / 100) * profile.vo2max * 0.5;
    const postBlockVO2max = parseFloat((profile.vo2max + vo2maxBoost).toFixed(1));

    const raceKm = RACE_DISTANCES[raceDistanceIdx].km;
    const pace = parsePace(racePaceStr);

    const baseRace = simulateRace(profile, {
      distance_km: raceKm,
      name: RACE_DISTANCES[raceDistanceIdx].label,
      targetPace_min_km: pace,
      terrain: 'flat',
      temperature_c: 18,
      humidity_percent: 55,
      altitude_m: 0,
      strategy: 'even',
    });

    const postBlockProfile: AthletePhysioProfile = {
      ...profile,
      vo2max: postBlockVO2max,
    };

    const postRace = simulateRace(postBlockProfile, {
      distance_km: raceKm,
      name: RACE_DISTANCES[raceDistanceIdx].label,
      targetPace_min_km: pace,
      terrain: 'flat',
      temperature_c: 18,
      humidity_percent: 55,
      altitude_m: 0,
      strategy: 'even',
    });

    const timeSaving_min = baseRace.predictedTime_min - postRace.predictedTime_min;
    const optimalReturnPace = postRace.avgVO2 / postBlockVO2max < 0.82
      ? formatPace(pace * 0.96)
      : formatPace(pace);

    return {
      altResult,
      baseRace,
      postRace,
      baseVO2max: profile.vo2max,
      postBlockVO2max,
      vo2maxBoost,
      timeSaving_min,
      optimalReturnPace,
      raceKm,
      racePace: pace,
    };
  }

  function runComparison() {
    if (!physioProfile) return;
    setResult(computeComparison(physioProfile));
  }

  async function saveComparison() {
    if (!result) return;
    setSaving(true);
    await supabase.from('simulation_history').insert({
      athlete_id: selectedAthleteId || null,
      simulation_type: 'altitude',
      label: `Bloque ${blockDays}d a ${altitude}m → ${RACE_DISTANCES[raceDistanceIdx].label}`,
      input_params: { altitude, blockDays, raceKm: result.raceKm, racePaceStr, baseVO2max: result.baseVO2max },
      result_summary: {
        postBlockVO2max: result.postBlockVO2max,
        vo2maxBoost: result.vo2maxBoost,
        timeSaving_min: result.timeSaving_min,
        optimalReturnPace: result.optimalReturnPace,
      },
    });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  }

  const barData = result ? [
    {
      metric: 'VO2max',
      [language === 'es' ? 'Antes' : 'Before']: result.baseVO2max,
      [language === 'es' ? 'Después' : 'After']: result.postBlockVO2max,
      unit: 'ml/kg/min',
    },
    {
      metric: language === 'es' ? '% VO2max carrera' : '% VO2max race',
      [language === 'es' ? 'Antes' : 'Before']: parseFloat(result.baseRace.percentVO2max.toFixed(1)),
      [language === 'es' ? 'Después' : 'After']: parseFloat(result.postRace.percentVO2max.toFixed(1)),
      unit: '%',
    },
    {
      metric: language === 'es' ? 'FC promedio' : 'Avg HR',
      [language === 'es' ? 'Antes' : 'Before']: result.baseRace.avgHR,
      [language === 'es' ? 'Después' : 'After']: result.postRace.avgHR,
      unit: 'bpm',
    },
  ] : [];

  const beforeKey = language === 'es' ? 'Antes' : 'Before';
  const afterKey = language === 'es' ? 'Después' : 'After';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Athlete */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{t('sim.athlete')}</h3>
          <select
            value={selectedAthleteId}
            onChange={e => setSelectedAthleteId(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">-- {t('sim.selectAthlete')} --</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          {loadingProfile && <p className="text-xs text-gray-400">{t('sim.loadingProfile')}</p>}

          {physioProfile && !loadingProfile && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-gray-400">VO2max</div>
                  <div className="font-bold text-gray-900 dark:text-white">{physioProfile.vo2max}</div>
                  <div className="text-xs text-gray-400">ml/kg/min</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-gray-400">{t('sim.weight')}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{physioProfile.weight_kg}</div>
                  <div className="text-xs text-gray-400">kg</div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <label className="text-xs text-gray-500 block mb-1">{t('sim.vo2maxEdit')}</label>
                <input type="number" value={physioProfile.vo2max}
                  onChange={e => setPhysioProfile(p => p ? { ...p, vo2max: parseFloat(e.target.value) || 50 } : p)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
            </div>
          )}

          {!selectedAthleteId && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              <label className="text-xs text-gray-500 block mb-1">{t('sim.orEnterVO2max')}</label>
              <input type="number" placeholder="ej: 55"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                onChange={e => setPhysioProfile({ vo2max: parseFloat(e.target.value) || 50, weight_kg: 70 })} />
            </div>
          )}
        </div>

        {/* Block config */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{language === 'es' ? 'Configuración del Bloque de Altitud' : 'Altitude Block Configuration'}</h3>

          <div>
            <label className="text-xs text-gray-500 block mb-2">{language === 'es' ? 'Centros de altitud conocidos:' : 'Known altitude camps:'}</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => setAltitude(p.alt)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${altitude === p.alt ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'}`}>
                  {p.label} ({p.alt}m)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'Altitud del campo base' : 'Base camp altitude'}: {altitude}m</label>
              <input type="range" min={1500} max={4000} step={50} value={altitude}
                onChange={e => setAltitude(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1500m</span><span>4000m</span></div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'Duración del bloque' : 'Block duration'}: {blockDays} {language === 'es' ? 'días' : 'days'}</label>
              <input type="range" min={7} max={28} step={1} value={blockDays}
                onChange={e => setBlockDays(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>7d</span><span>28d</span></div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">{language === 'es' ? 'Carrera de referencia' : 'Reference race'}</label>
              <div className="flex gap-2">
                {RACE_DISTANCES.map((d, i) => (
                  <button key={i} onClick={() => setRaceDistanceIdx(i)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${raceDistanceIdx === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">{language === 'es' ? 'Ritmo objetivo (min:seg/km)' : 'Target pace (min:sec/km)'}</label>
              <input type="text" value={racePaceStr} onChange={e => setRacePaceStr(e.target.value)}
                placeholder="4:45"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>

          <button onClick={runComparison} disabled={!physioProfile}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {language === 'es' ? 'Comparar Antes / Después del Bloque' : 'Compare Before / After Block'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{t('sim.altBlock.vo2maxGain')}</div>
              <div className="text-2xl font-bold text-emerald-600">+{result.vo2maxBoost.toFixed(1)}</div>
              <div className="text-xs text-gray-400">ml/kg/min</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{language === 'es' ? 'VO2max post-bloque' : 'Post-block VO2max'}</div>
              <div className="text-2xl font-bold text-blue-600">{result.postBlockVO2max}</div>
              <div className="text-xs text-gray-400">ml/kg/min</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{t('sim.altBlock.timeImprovement')}</div>
              <div className={`text-2xl font-bold ${result.timeSaving_min > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {result.timeSaving_min > 0 ? `-${formatTime(result.timeSaving_min)}` : (language === 'es' ? 'Sin mejora' : 'No improvement')}
              </div>
              <div className="text-xs text-gray-400">{RACE_DISTANCES[raceDistanceIdx].label}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{language === 'es' ? 'Ritmo óptimo post-bloque' : 'Optimal post-block pace'}</div>
              <div className="text-2xl font-bold text-blue-600">{result.optimalReturnPace}</div>
              <div className="text-xs text-gray-400">{language === 'es' ? 'min/km recomendado' : 'min/km recommended'}</div>
            </div>
          </div>

          {/* Before / After comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">{language === 'es' ? 'Métricas Antes vs. Después' : 'Metrics Before vs. After'}</h4>
              <div className="space-y-4">
                {[
                  { label: 'VO2max', before: result.baseVO2max, after: result.postBlockVO2max, unit: 'ml/kg/min', higherBetter: true },
                  { label: language === 'es' ? '% VO2max en carrera' : '% VO2max in race', before: result.baseRace.percentVO2max, after: result.postRace.percentVO2max, unit: '%', higherBetter: false },
                  { label: language === 'es' ? 'FC promedio carrera' : 'Avg HR in race', before: result.baseRace.avgHR, after: result.postRace.avgHR, unit: 'bpm', higherBetter: false },
                  { label: language === 'es' ? 'Tiempo proyectado' : 'Projected time', before: result.baseRace.predictedTime_min, after: result.postRace.predictedTime_min, unit: 'min', higherBetter: false, formatter: formatTime },
                ].map((row, i) => {
                  const improved = row.higherBetter ? row.after > row.before : row.after < row.before;
                  const diff = row.after - row.before;
                  const pct = Math.abs(diff / row.before * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{row.label}</span>
                        <span className={`font-semibold ${improved ? 'text-emerald-600' : 'text-red-500'}`}>
                          {diff > 0 ? '+' : ''}{row.formatter ? '' : row.before.toFixed(1)} → {row.formatter ? row.formatter(row.after) : row.after.toFixed(1)} {!row.formatter ? row.unit : ''}
                          {' '}({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">{language === 'es' ? 'Antes' : 'Before'}</div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div className="h-2 rounded-full bg-gray-400" style={{ width: '100%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">{language === 'es' ? 'Después' : 'After'}</div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (row.after / row.before) * 100)}%`,
                                background: improved ? '#22c55e' : '#ef4444',
                              }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">{language === 'es' ? 'Comparativa Visual' : 'Visual Comparison'}</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={beforeKey} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={afterKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Acclimatization timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                {language === 'es' ? `Curva de Aclimatación — ${blockDays} días a ${altitude}m` : `Acclimatization Curve — ${blockDays} days at ${altitude}m`}
              </h4>
              <button onClick={saveComparison} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-all disabled:opacity-50">
                {saving ? t('sim.saving') : savedOk ? t('sim.saved') : t('sim.save')}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={result.altResult.acclimatization_timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tickFormatter={v => `D${v}`} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} labelFormatter={l => language === 'es' ? `Día ${l}` : `Day ${l}`} />
                <Line type="monotone" dataKey="vo2max_recovery_percent" stroke="#3b82f6" strokeWidth={2} dot={false} name={language === 'es' ? 'Recuperación VO2max' : 'VO2max recovery'} />
                <Line type="monotone" dataKey="performance_recovery_percent" stroke="#22c55e" strokeWidth={2} dot={false} name={language === 'es' ? 'Recuperación rendimiento' : 'Performance recovery'} />
                <Line type="monotone" dataKey="rbc_increase_percent" stroke="#f59e0b" strokeWidth={2} dot={false} name={language === 'es' ? 'Aumento GR (%)' : 'RBC increase (%)'} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
              <strong>{t('sim.altBlock.bestWindow')}:</strong> {t('sim.altBlock.bestWindowText')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
