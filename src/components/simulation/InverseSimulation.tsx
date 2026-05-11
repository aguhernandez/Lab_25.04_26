import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import type { Athlete } from '../../types';
import { loadSimulationProfile } from '../../lib/simulationProfile';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  simulateInverse,
  formatTime,
  formatPace,
  type RaceScenario,
} from '../../lib/simulationEngine';

export default function InverseSimulation() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();

  const DISTANCES = [
    { label: '5K', km: 5 },
    { label: '10K', km: 10 },
    { label: language === 'es' ? 'Media Maratón' : 'Half Marathon', km: 21.0975 },
    { label: language === 'es' ? 'Maratón' : 'Marathon', km: 42.195 },
    { label: '50K', km: 50 },
    { label: language === 'es' ? 'Personalizada' : 'Custom', km: 0 },
  ];

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [currentVO2max, setCurrentVO2max] = useState(50);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [distanceIdx, setDistanceIdx] = useState(1);
  const [customKm, setCustomKm] = useState(15);
  const [targetHours, setTargetHours] = useState(0);
  const [targetMinutes, setTargetMinutes] = useState(45);
  const [targetSeconds, setTargetSeconds] = useState(0);

  const [terrain, setTerrain] = useState<RaceScenario['terrain']>('flat');
  const [altitude, setAltitude] = useState(0);

  const [result, setResult] = useState<ReturnType<typeof simulateInverse> | null>(null);

  useEffect(() => {
    const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
    let query = supabase.from('athletes').select('*').order('name');
    if (effectiveRole === 'athlete' && profile?.hub_user_id) {
      query = query.eq('hub_user_id', profile.hub_user_id);
    } else if (effectiveRole === 'coach' && profile?.id) {
      query = query.eq('coach_id', profile.id);
    }
    query.then(({ data }) => { if (data) setAthletes(data); });
  }, [profile]);

  useEffect(() => {
    if (!selectedAthleteId) return;
    setLoadingProfile(true);
    loadProfile(selectedAthleteId);
  }, [selectedAthleteId]);

  async function loadProfile(athleteId: string) {
    const athlete = athletes.find(a => a.id === athleteId);
    if (!athlete) return;
    const profile = await loadSimulationProfile(athlete);
    setCurrentVO2max(profile.vo2max);
    setLoadingProfile(false);
  }

  function runInverse() {
    const distanceKm = DISTANCES[distanceIdx].km === 0 ? customKm : DISTANCES[distanceIdx].km;
    const targetTime_min = targetHours * 60 + targetMinutes + targetSeconds / 60;
    if (targetTime_min <= 0) return;

    const scenario: Omit<RaceScenario, 'targetPace_min_km'> = {
      distance_km: distanceKm,
      name: DISTANCES[distanceIdx].label,
      terrain,
      temperature_c: 18,
      humidity_percent: 55,
      altitude_m: altitude,
      strategy: 'even',
    };
    setResult(simulateInverse(targetTime_min, scenario, currentVO2max, 70));
  }

  const distanceKm = DISTANCES[distanceIdx].km === 0 ? customKm : DISTANCES[distanceIdx].km;
  const targetTime_min = targetHours * 60 + targetMinutes + targetSeconds / 60;

  const gapColor = !result ? '' :
    result.current_gap <= 0 ? 'text-emerald-600' :
    result.current_gap < 3 ? 'text-amber-600' :
    result.current_gap < 8 ? 'text-orange-600' :
    'text-red-600';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Current physiology */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{language === 'es' ? 'Perfil Actual' : 'Current Profile'}</h3>

          <select
            value={selectedAthleteId}
            onChange={e => setSelectedAthleteId(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">-- {t('sim.selectAthlete')} --</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          {loadingProfile && <p className="text-xs text-gray-400">{t('sim.loadingProfile')}</p>}

          <div>
            <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'VO2max actual (ml/kg/min)' : 'Current VO2max (ml/kg/min)'}</label>
            <input
              type="number" value={currentVO2max}
              onChange={e => setCurrentVO2max(parseFloat(e.target.value) || 40)}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-800">
            <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Ritmo máximo sostenible actual' : 'Current max sustainable pace'}</div>
            {result ? (
              <>
                <div className="text-xl font-bold text-blue-600">{result.paceAtCurrentVO2max}</div>
                <div className="text-xs text-gray-400">{language === 'es' ? 'min/km al 85% VO2max' : 'min/km at 85% VO2max'}</div>
              </>
            ) : (
              <div className="text-sm text-gray-400">{language === 'es' ? 'Calcula primero' : 'Calculate first'}</div>
            )}
          </div>
        </div>

        {/* Target */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{t('sim.inverse.targetTime')}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1.5">{language === 'es' ? 'Distancia' : 'Distance'}</label>
              <div className="flex flex-wrap gap-2">
                {DISTANCES.map((d, i) => (
                  <button key={i} onClick={() => setDistanceIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${distanceIdx === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              {DISTANCES[distanceIdx].km === 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" value={customKm} onChange={e => setCustomKm(parseFloat(e.target.value) || 1)}
                    className="w-24 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                  <span className="text-sm text-gray-500">km</span>
                </div>
              )}
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1.5">{language === 'es' ? 'Tiempo objetivo' : 'Target time'}</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <input type="number" min={0} max={23} value={targetHours}
                    onChange={e => setTargetHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono text-lg" />
                  <div className="text-xs text-gray-400 text-center mt-0.5">{t('sim.inverse.hours')}</div>
                </div>
                <span className="text-2xl font-bold text-gray-400 pb-4">:</span>
                <div className="flex-1">
                  <input type="number" min={0} max={59} value={targetMinutes}
                    onChange={e => setTargetMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono text-lg" />
                  <div className="text-xs text-gray-400 text-center mt-0.5">{t('sim.inverse.minutes')}</div>
                </div>
                <span className="text-2xl font-bold text-gray-400 pb-4">:</span>
                <div className="flex-1">
                  <input type="number" min={0} max={59} value={targetSeconds}
                    onChange={e => setTargetSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono text-lg" />
                  <div className="text-xs text-gray-400 text-center mt-0.5">{t('sim.inverse.seconds')}</div>
                </div>
              </div>
              {targetTime_min > 0 && (
                <div className="text-xs text-gray-400 text-center mt-1">
                  = {formatTime(targetTime_min)} · {language === 'es' ? 'ritmo objetivo' : 'target pace'}: {formatPace(targetTime_min / distanceKm)}/km
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'Terreno' : 'Terrain'}</label>
              <div className="flex gap-2">
                {(['flat', 'rolling', 'hilly'] as const).map(ter => (
                  <button key={ter} onClick={() => setTerrain(ter)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${terrain === ter ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
                    {ter === 'flat' ? t('sim.terrain.flat') : ter === 'rolling' ? t('sim.terrain.rolling') : t('sim.terrain.hilly')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'Altitud' : 'Altitude'}: {altitude}m</label>
              <input type="range" min={0} max={4000} step={100} value={altitude}
                onChange={e => setAltitude(+e.target.value)} className="w-full" />
            </div>
          </div>

          <button onClick={runInverse} disabled={targetTime_min <= 0}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {language === 'es' ? 'Calcular VO2max Necesario' : 'Calculate Required VO2max'}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-5">
          {/* Main answer */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{t('sim.inverse.requiredVO2max')}</div>
                <div className="text-4xl font-bold text-blue-600">{result.required_vo2max}</div>
                <div className="text-sm text-gray-400">ml/kg/min</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{language === 'es' ? 'Tu VO2max actual' : 'Your current VO2max'}</div>
                <div className="text-4xl font-bold text-gray-700 dark:text-gray-300">{currentVO2max}</div>
                <div className="text-sm text-gray-400">ml/kg/min</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{t('sim.inverse.currentGap')}</div>
                <div className={`text-4xl font-bold ${gapColor}`}>
                  {result.current_gap <= 0 ? '0' : `+${result.current_gap}`}
                </div>
                <div className="text-sm text-gray-400">{language === 'es' ? 'ml/kg/min a ganar' : 'ml/kg/min to gain'}</div>
              </div>
            </div>

            <div className={`mt-5 p-4 rounded-xl text-sm text-center font-medium border ${
              result.current_gap <= 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'
                : result.current_gap < 8
                ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400'
                : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
            }`}>
              {result.feasibilityComment}
            </div>
          </div>

          {/* Training progression chart */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
              {language === 'es' ? 'Proyección: Tiempo estimado según semanas de entrenamiento' : 'Projection: Estimated time by training weeks'}
            </h4>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={result.trainingWeeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="weeks" tickFormatter={v => language === 'es' ? `${v}sem` : `${v}wk`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="time" orientation="left" tickFormatter={v => formatTime(v)} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="vo2" orientation="right" tickFormatter={v => `${v}`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => {
                    const projLabel = language === 'es' ? 'Tiempo proyectado' : 'Projected time';
                    if (name === projLabel) return [formatTime(val), name];
                    if (name === 'VO2max') return [`${val} ml/kg/min`, name];
                    return [val, name];
                  }}
                  labelFormatter={l => language === 'es' ? `Semana ${l}` : `Week ${l}`}
                />
                <ReferenceLine
                  yAxisId="time"
                  y={targetTime_min}
                  stroke="#22c55e"
                  strokeDasharray="5 3"
                  label={{ value: language === 'es' ? 'Objetivo' : 'Target', fontSize: 10, fill: '#22c55e' }}
                />
                <Line yAxisId="time" type="monotone" dataKey="predictedTime_min" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} name={language === 'es' ? 'Tiempo proyectado' : 'Projected time'} />
                <Line yAxisId="vo2" type="monotone" dataKey="vo2max" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 3" name="VO2max" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 text-center mt-2">
              {language === 'es' ? 'Asumiendo ganancia de ~0.25 ml/kg/min por semana con entrenamiento aeróbico consistente' : 'Assuming ~0.25 ml/kg/min gain per week with consistent aerobic training'}
            </p>
          </div>

          {/* Week by week table */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">{language === 'es' ? 'Tabla de Progresión' : 'Progression Table'}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left text-xs text-gray-500 pb-2 font-medium">{t('sim.inverse.weeks')}</th>
                    <th className="text-center text-xs text-gray-500 pb-2 font-medium">VO2max</th>
                    <th className="text-center text-xs text-gray-500 pb-2 font-medium">{language === 'es' ? 'Tiempo estimado' : 'Est. time'}</th>
                    <th className="text-center text-xs text-gray-500 pb-2 font-medium">{language === 'es' ? 'Ritmo/km' : 'Pace/km'}</th>
                    <th className="text-center text-xs text-gray-500 pb-2 font-medium">{language === 'es' ? 'Diferencia' : 'Difference'}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trainingWeeks.map((row) => {
                    const diff = row.predictedTime_min - targetTime_min;
                    const isAchieved = diff <= 0;
                    return (
                      <tr key={row.weeks} className={`border-b border-gray-50 dark:border-gray-700/50 transition-colors ${isAchieved ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
                        <td className="py-2.5 text-gray-700 dark:text-gray-300 font-medium">{language === 'es' ? `Sem ${row.weeks}` : `Wk ${row.weeks}`}</td>
                        <td className="py-2.5 text-center text-gray-700 dark:text-gray-300">{row.vo2max}</td>
                        <td className="py-2.5 text-center font-mono font-semibold text-gray-900 dark:text-white">{formatTime(row.predictedTime_min)}</td>
                        <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">{formatPace(row.predictedTime_min / distanceKm)}</td>
                        <td className={`py-2.5 text-center text-xs font-semibold ${isAchieved ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {isAchieved ? (language === 'es' ? 'Objetivo alcanzado' : 'Goal achieved') : `+${formatTime(Math.abs(diff))}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
