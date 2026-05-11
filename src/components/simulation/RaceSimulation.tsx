import { useState, useEffect, useRef } from 'react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, BarChart, Bar, Cell, Legend, ComposedChart,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import type { Athlete } from '../../types';
import {
  simulateRace,
  formatPace,
  formatTime,
  type AthletePhysioProfile,
  type RaceScenario,
  type RaceSimResult,
} from '../../lib/simulationEngine';
import { loadSimulationProfile, buildProfileSummary } from '../../lib/simulationProfile';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

const DISTANCES = [
  { labelKey: 'sim.dist.track1k', km: 1 },
  { labelKey: null, km: 5, label: '5K' },
  { labelKey: null, km: 10, label: '10K' },
  { labelKey: 'sim.dist.halfMarathon', km: 21.0975 },
  { labelKey: 'sim.dist.marathon', km: 42.195 },
  { labelKey: 'sim.dist.trail50', km: 50 },
  { labelKey: 'sim.dist.ultra100', km: 100 },
  { labelKey: 'sim.dist.custom', km: 0 },
];

const TERRAINS: { value: RaceScenario['terrain']; labelKey: string }[] = [
  { value: 'flat', labelKey: 'sim.terrain.flat' },
  { value: 'rolling', labelKey: 'sim.terrain.rolling' },
  { value: 'hilly', labelKey: 'sim.terrain.hilly' },
];

const STRATEGIES: { value: RaceScenario['strategy']; labelKey: string; descKey: string; color: string }[] = [
  { value: 'even', labelKey: 'sim.strategy.even', descKey: 'sim.strategy.evenDesc', color: 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' },
  { value: 'negative', labelKey: 'sim.strategy.negative', descKey: 'sim.strategy.negativeDesc', color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' },
  { value: 'positive', labelKey: 'sim.strategy.positive', descKey: 'sim.strategy.positiveDesc', color: 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' },
];

const FEASIBILITY_STYLE = {
  optimal: { labelKey: 'sim.feasibility.optimal', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
  challenging: { labelKey: 'sim.feasibility.challenging', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  limit: { labelKey: 'sim.feasibility.limit', bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
  impossible: { labelKey: 'sim.feasibility.impossible', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' },
};

export default function RaceSimulation() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [physioProfile, setPhysioProfile] = useState<AthletePhysioProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [distanceIdx, setDistanceIdx] = useState(2);
  const [customKm, setCustomKm] = useState(15);
  const [targetPaceStr, setTargetPaceStr] = useState('5:00');
  const [terrain, setTerrain] = useState<RaceScenario['terrain']>('flat');
  const [temperature, setTemperature] = useState(18);
  const [humidity, setHumidity] = useState(55);
  const [altitude, setAltitude] = useState(0);
  const [strategy, setStrategy] = useState<RaceScenario['strategy']>('even');

  const [result, setResult] = useState<RaceSimResult | null>(null);
  const [activeChart, setActiveChart] = useState<'pace' | 'lactate' | 'zones' | 'strategy' | 'glycogen'>('pace');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const [animFrame, setAnimFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

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

  function runSimulation() {
    if (!physioProfile) return;
    const distanceKm = DISTANCES[distanceIdx].km === 0 ? customKm : DISTANCES[distanceIdx].km;
    const scenario: RaceScenario = {
      distance_km: distanceKm,
      name: DISTANCES[distanceIdx].labelKey ? t(DISTANCES[distanceIdx].labelKey!) : (DISTANCES[distanceIdx].label ?? ''),
      targetPace_min_km: parsePace(targetPaceStr),
      terrain,
      temperature_c: temperature,
      humidity_percent: humidity,
      altitude_m: altitude,
      strategy,
    };
    const r = simulateRace(physioProfile, scenario);
    setResult(r);
    setAnimFrame(0);
    setIsPlaying(false);
    if (animRef.current) clearInterval(animRef.current);
  }

  function toggleAnimation() {
    if (!result) return;
    if (isPlaying) {
      if (animRef.current) clearInterval(animRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      if (animFrame >= result.paceVsFatigue.length - 1) setAnimFrame(0);
      animRef.current = setInterval(() => {
        setAnimFrame(prev => {
          if (prev >= (result?.paceVsFatigue.length ?? 1) - 1) {
            clearInterval(animRef.current!);
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 300);
    }
  }

  async function saveSimulation() {
    if (!result) return;
    setSaving(true);
    const distanceKm = DISTANCES[distanceIdx].km === 0 ? customKm : DISTANCES[distanceIdx].km;
    const label = `${DISTANCES[distanceIdx].label} · ${targetPaceStr}/km · ${strategy}`;
    await supabase.from('simulation_history').insert({
      athlete_id: selectedAthleteId || null,
      simulation_type: 'race',
      label,
      input_params: { distanceKm, targetPaceStr, terrain, temperature, humidity, altitude, strategy, vo2max: physioProfile?.vo2max },
      result_summary: {
        predictedTime_min: result.predictedTime_min,
        percentVO2max: result.percentVO2max,
        feasibility: result.feasibility,
        carbsUsed_g: result.carbsUsed_g,
        bonkRisk: result.bonkRisk,
        glycogenDepletionKm: result.glycogenDepletionKm,
        runningEconomy: result.runningEconomy,
      },
    });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  }

  const distanceKm = DISTANCES[distanceIdx].km === 0 ? customKm : DISTANCES[distanceIdx].km;
  const severityColors = {
    info: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300',
    warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300',
    danger: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300',
  };

  const currentPoint = result?.paceVsFatigue[animFrame];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{t('sim.athlete')}</h3>
          <select
            value={selectedAthleteId}
            onChange={e => setSelectedAthleteId(e.target.value)}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t('sim.selectAthlete')}</option>
            {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          {loadingProfile && <p className="text-xs text-gray-400">{t('sim.loadingProfile')}</p>}

          {physioProfile && !loadingProfile && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2.5 text-center border border-blue-100 dark:border-blue-800">
                  <div className="text-xs text-gray-400">VO2max</div>
                  <div className="font-bold text-blue-700 dark:text-blue-300">{physioProfile.vo2max}</div>
                  <div className="text-xs text-gray-400">ml/kg/min</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 text-center">
                  <div className="text-xs text-gray-400">{t('sim.weight')}</div>
                  <div className="font-bold text-gray-900 dark:text-white">{physioProfile.weight_kg}</div>
                  <div className="text-xs text-gray-400">kg</div>
                </div>
              </div>
              {buildProfileSummary(physioProfile, language).length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-2.5 space-y-0.5">
                  {buildProfileSummary(physioProfile, language).map((item, i) => (
                    <div key={i} className="text-xs text-gray-500 flex justify-between">
                      <span>{item.split(':')[0]}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{item.split(':').slice(1).join(':').trim()}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <label className="text-xs text-gray-500 block mb-1">{t('sim.vo2maxEdit')}</label>
                <input
                  type="number"
                  value={physioProfile.vo2max}
                  onChange={e => setPhysioProfile(p => p ? { ...p, vo2max: parseFloat(e.target.value) || 50 } : p)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {!selectedAthleteId && (
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-3">
              <p className="text-xs text-gray-400">{t('sim.orEnterVO2max')}</p>
              <input
                type="number" placeholder="e.g.: 55"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                onChange={e => setPhysioProfile({ vo2max: parseFloat(e.target.value) || 50, weight_kg: 70 })}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{t('sim.raceParams')}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1.5">{t('sim.distance')}</label>
              <div className="flex flex-wrap gap-2">
                {DISTANCES.map((d, i) => (
                  <button key={i} onClick={() => setDistanceIdx(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${distanceIdx === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'}`}>
                    {d.labelKey ? t(d.labelKey) : d.label}
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

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">{t('sim.targetPace')}</label>
              <input type="text" value={targetPaceStr} onChange={e => setTargetPaceStr(e.target.value)}
                placeholder="5:00"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">{t('sim.terrain')}</label>
              <div className="flex gap-2">
                {TERRAINS.map(tr => (
                  <button key={tr.value} onClick={() => setTerrain(tr.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${terrain === tr.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
                    {t(tr.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1.5">{t('sim.raceStrategy')}</label>
              <div className="grid grid-cols-3 gap-2">
                {STRATEGIES.map(s => (
                  <button key={s.value} onClick={() => setStrategy(s.value)}
                    className={`p-3 rounded-xl text-left border-2 transition-all ${strategy === s.value ? s.color : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}>
                    <div className={`text-xs font-bold ${strategy === s.value ? '' : 'text-gray-700 dark:text-gray-300'}`}>{t(s.labelKey)}</div>
                    <div className={`text-xs mt-0.5 ${strategy === s.value ? 'text-gray-600 dark:text-gray-400' : 'text-gray-400'}`}>{t(s.descKey)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('sim.temperature')}: {temperature}°C</label>
              <input type="range" min={-5} max={42} value={temperature} onChange={e => setTemperature(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>-5°C</span><span>42°C</span></div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{t('sim.humidity')}: {humidity}%</label>
              <input type="range" min={10} max={100} value={humidity} onChange={e => setHumidity(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>10%</span><span>100%</span></div>
            </div>

            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">{t('sim.altitude')}: {altitude}m</label>
              <input type="range" min={0} max={5000} step={100} value={altitude} onChange={e => setAltitude(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>0m</span><span>5000m</span></div>
            </div>
          </div>

          <button onClick={runSimulation} disabled={!physioProfile}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {t('sim.simulate')}
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-5">
          <div className={`rounded-2xl border p-5 ${FEASIBILITY_STYLE[result.feasibility].bg} ${FEASIBILITY_STYLE[result.feasibility].border}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${FEASIBILITY_STYLE[result.feasibility].text}`}>
                  {t(FEASIBILITY_STYLE[result.feasibility].labelKey)}
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {DISTANCES[distanceIdx].km === 0 ? `${customKm}K` : (DISTANCES[distanceIdx].labelKey ? t(DISTANCES[distanceIdx].labelKey!) : DISTANCES[distanceIdx].label)} — {targetPaceStr}/km · {STRATEGIES.find(s => s.value === strategy) ? t(STRATEGIES.find(s => s.value === strategy)!.labelKey) : ''}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatTime(result.predictedTime_min)}</div>
                  <div className="text-xs text-gray-500">{t('sim.projectedTime')}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveSimulation} disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-white transition-all disabled:opacity-50">
                    {saving ? t('sim.saving') : savedOk ? t('sim.saved') : t('sim.save')}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: '% VO2max', value: `${result.percentVO2max.toFixed(0)}%`, sub: `${result.avgVO2.toFixed(1)} ml/kg/min` },
                { label: t('sim.avgHR'), value: `${result.avgHR} bpm`, sub: physioProfile?.lt2_hr ? `LT2: ${physioProfile.lt2_hr} bpm` : undefined },
                { label: t('sim.kcalCost'), value: `${result.energyCost_kcal.toFixed(0)}`, sub: 'kcal' },
                { label: 'CHO', value: `${result.carbsUsed_g.toFixed(0)} g`, sub: t('sim.carbs') },
                { label: t('sim.fats'), value: `${result.fatsUsed_g.toFixed(0)} g`, sub: 'g' },
                { label: t('sim.dehydration'), value: `${result.dehydration_percent.toFixed(1)}%`, sub: `${temperature}°C/${humidity}%HR` },
                { label: t('sim.runningEconomy'), value: `${result.runningEconomy}`, sub: 'mlO2/kg/km' },
                { label: t('sim.bonkRisk'), value: result.bonkRisk ? (result.glycogenDepletionKm ? `km ${result.glycogenDepletionKm}` : 'Yes') : 'No', sub: t('sim.glycogen'), highlight: result.bonkRisk },
              ].map((m, i) => (
                <div key={i} className={`bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 text-center ${(m as { highlight?: boolean }).highlight ? 'ring-2 ring-red-400' : ''}`}>
                  <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                  <div className={`font-bold ${(m as { highlight?: boolean }).highlight ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{m.value}</div>
                  {m.sub && <div className="text-xs text-gray-400">{m.sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {result.riskFlags.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.riskFlags.map((flag, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${severityColors[flag.severity]}`}>
                  <span className="text-base mt-0.5">{flag.severity === 'danger' ? '⚠' : flag.severity === 'warning' ? '●' : 'ℹ'}</span>
                  <span>{flag.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Animated race progress */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{t('sim.animatedProgress')}</h4>
              <button onClick={toggleAnimation}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${isPlaying ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                {isPlaying ? t('sim.pause') : animFrame === result.paceVsFatigue.length - 1 ? t('sim.repeat') : t('sim.play')}
              </button>
            </div>

            <div className="relative">
              <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                  style={{ width: `${Math.max(4, (animFrame / Math.max(result.paceVsFatigue.length - 1, 1)) * 100)}%` }}
                >
                  <span className="text-white text-xs font-bold">
                    {currentPoint ? `${currentPoint.km.toFixed(1)}km` : ''}
                  </span>
                </div>
              </div>

              {currentPoint && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-800">
                    <div className="text-xs text-gray-500">{t('sim.currentKm')}</div>
                    <div className="text-xl font-bold text-blue-600">{currentPoint.km.toFixed(1)}</div>
                    <div className="text-xs text-gray-400">/ {distanceKm.toFixed(1)} km</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-500">{t('sim.pace')}</div>
                    <div className="text-xl font-bold text-gray-900 dark:text-white">{formatPace(currentPoint.pace_min_km)}</div>
                    <div className="text-xs text-gray-400">min/km</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center border border-red-100 dark:border-red-800">
                    <div className="text-xs text-gray-500">{t('sim.hr')}</div>
                    <div className="text-xl font-bold text-red-600">{currentPoint.hr}</div>
                    <div className="text-xs text-gray-400">bpm</div>
                  </div>
                  <div className={`rounded-xl p-3 text-center border ${currentPoint.fatigue > 60 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'}`}>
                    <div className="text-xs text-gray-500">{t('sim.fatigue')}</div>
                    <div className={`text-xl font-bold ${currentPoint.fatigue > 60 ? 'text-orange-600' : 'text-emerald-600'}`}>{currentPoint.fatigue.toFixed(0)}%</div>
                    <div className="text-xs text-gray-400">{t('sim.accumulated')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex gap-1 p-3 border-b border-gray-100 dark:border-gray-700 flex-wrap">
              {[
                { key: 'pace', label: t('sim.paceHR') },
                { key: 'lactate', label: t('sim.lactate') },
                { key: 'zones', label: t('sim.zones') },
                { key: 'strategy', label: t('sim.strategy') },
                { key: 'glycogen', label: t('sim.glycogenTab') },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveChart(tab.key as typeof activeChart)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeChart === tab.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeChart === 'pace' && (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={result.paceVsFatigue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="km" tickFormatter={v => `${parseFloat(v).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="pace" orientation="left" tickFormatter={v => formatPace(v)} tick={{ fontSize: 11 }} reversed />
                      <YAxis yAxisId="hr" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number, name: string) => {
                        if (name === t('sim.pace')) return [formatPace(val), t('sim.pace')];
                        if (name === t('sim.hr')) return [`${val} bpm`, t('sim.hr')];
                        return [val, name];
                      }} labelFormatter={l => `Km ${parseFloat(l as string).toFixed(1)}`} />
                      <Legend />
                      <Area yAxisId="pace" type="monotone" dataKey="pace_min_km" stroke="#3b82f6" fill="#bfdbfe" strokeWidth={2} name={t('sim.pace')} />
                      <Line yAxisId="hr" type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} dot={false} name={t('sim.hr')} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {result.bonkRisk && result.glycogenDepletionKm && (
                    <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
                      {t('sim.bonkWarning').replace('__KM__', String(result.glycogenDepletionKm))}
                    </div>
                  )}
                </div>
              )}

              {activeChart === 'lactate' && (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={result.lactateAccumulation}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="km" tickFormatter={v => `${parseFloat(v).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'mmol/L', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(2)} mmol/L`, t('sim.lactate')]} labelFormatter={l => `Km ${parseFloat(l as string).toFixed(1)}`} />
                      <ReferenceLine y={2} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'LT1 ~2mmol', fontSize: 10, fill: '#22c55e' }} />
                      <ReferenceLine y={4} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'LT2 ~4mmol', fontSize: 10, fill: '#f59e0b' }} />
                      <Area type="monotone" dataKey="lactate_mmol" stroke="#8b5cf6" fill="#ede9fe" strokeWidth={2} name={t('sim.lactate')} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-400 text-center">{t('sim.lactateEstimate')}</p>
                </div>
              )}

              {activeChart === 'zones' && (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={result.zones} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="zone" type="category" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`${v}%`, t('sim.timeInZone')]} />
                      <Bar dataKey="percent_time" radius={[0, 4, 4, 0]}>
                        {result.zones.map((z, i) => <Cell key={i} fill={z.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-400 text-center">{t('sim.zoneDistribution')}</p>
                </div>
              )}

              {activeChart === 'strategy' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">{t('sim.strategy')}: <strong>{STRATEGIES.find(s => s.value === strategy) ? t(STRATEGIES.find(s => s.value === strategy)!.labelKey) : ''}</strong></p>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={result.strategyProfile}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="km" tickFormatter={v => `${parseFloat(v).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="pace" orientation="left" tickFormatter={v => formatPace(v)} tick={{ fontSize: 11 }} reversed />
                      <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number, name: string) => {
                        if (name === t('sim.pace')) return [formatPace(val), t('sim.pace')];
                        if (name === '% VO2max') return [`${val.toFixed(1)}%`, '% VO2max'];
                        return [val, name];
                      }} labelFormatter={l => `Km ${parseFloat(l as string).toFixed(1)}`} />
                      <Legend />
                      <Area yAxisId="pace" type="monotone" dataKey="pace_min_km" stroke="#3b82f6" fill="#bfdbfe" strokeWidth={2} name={t('sim.pace')} />
                      <Line yAxisId="pct" type="monotone" dataKey="percentVO2max" stroke="#f59e0b" strokeWidth={2} dot={false} name="% VO2max" strokeDasharray="5 3" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-3">
                    {STRATEGIES.map(s => {
                      const isActive = s.value === strategy;
                      return (
                        <div key={s.value} className={`p-3 rounded-xl border text-xs ${isActive ? s.color + ' border-current font-semibold' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-500'}`}>
                          <div className="font-bold mb-1">{t(s.labelKey)}</div>
                          <div>{t(s.descKey)}</div>
                          {isActive && <div className="mt-1 text-blue-600 dark:text-blue-400">{t('sim.selected')}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeChart === 'glycogen' && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">{t('sim.glycogenEstimate')}</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={result.paceVsFatigue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="km" tickFormatter={v => `${parseFloat(v).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: 'g CHO', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(0)} g`, t('sim.glycogenRemaining')]} labelFormatter={l => `Km ${parseFloat(l as string).toFixed(1)}`} />
                      {result.glycogenDepletionKm && (
                        <ReferenceLine x={result.glycogenDepletionKm} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `Bonk km ${result.glycogenDepletionKm}`, fontSize: 10, fill: '#ef4444' }} />
                      )}
                      <Area type="monotone" dataKey="glycogen_g" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} name={t('sim.glycogenTab')} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className={`text-xs p-3 rounded-lg text-center border ${result.bonkRisk ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400'}`}>
                    {result.bonkRisk && result.glycogenDepletionKm
                      ? t('sim.glycogenDepletes').replace('__KM__', String(result.glycogenDepletionKm)).replace('__RATE__', String(Math.round(result.carbsUsed_g / result.predictedTime_min * 60)))
                      : t('sim.rec.bonkGlycogenOk')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">{t('sim.execRecommendations')}</h4>
            <ul className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
