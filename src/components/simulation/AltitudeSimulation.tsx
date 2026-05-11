import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import type { Athlete } from '../../types';
import { loadSimulationProfile } from '../../lib/simulationProfile';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  simulateAltitude,
  type AthletePhysioProfile,
  type AltitudeScenario,
  type AltitudeSimResult,
} from '../../lib/simulationEngine';

const TRAINING_LOAD_KEYS: { value: AltitudeScenario['training_load']; labelKey: string; descKey: string }[] = [
  { value: 'rest', labelKey: 'sim.altBlock.rest', descKey: 'sim.altBlock.restDesc' },
  { value: 'light', labelKey: 'sim.altBlock.light', descKey: 'sim.altBlock.lightDesc' },
  { value: 'moderate', labelKey: 'sim.altBlock.moderate', descKey: 'sim.altBlock.moderateDesc' },
  { value: 'hard', labelKey: 'sim.altBlock.hard', descKey: 'sim.altBlock.hardDesc' },
];

const ALTITUDE_PRESETS = [
  { label: 'Ciudad de Mexico', alt: 2240 },
  { label: 'Bogota', alt: 2625 },
  { label: 'Quito', alt: 2850 },
  { label: 'La Paz', alt: 3640 },
  { label: 'Cusco', alt: 3399 },
  { label: 'Machu Picchu', alt: 2430 },
  { label: 'Mont Blanc', alt: 4808 },
  { label: 'Everest CB', alt: 5364 },
];

export default function AltitudeSimulation() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('');
  const [physioProfile, setPhysioProfile] = useState<AthletePhysioProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [altitude, setAltitude] = useState(2500);
  const [exposureDays, setExposureDays] = useState(14);
  const [trainingLoad, setTrainingLoad] = useState<AltitudeScenario['training_load']>('moderate');

  const [result, setResult] = useState<AltitudeSimResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'zones' | 'recs'>('overview');

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
    setPhysioProfile(profile);
    setLoadingProfile(false);
  }

  function runSimulation() {
    if (!physioProfile) return;
    const scenario: AltitudeScenario = {
      altitude_m: altitude,
      exposure_days: exposureDays,
      training_load: trainingLoad,
    };
    setResult(simulateAltitude(physioProfile, scenario));
  }

  const altitudeCategory =
    altitude < 1500 ? { label: t('sim.altitude.seaLevel'), color: 'text-emerald-600' } :
    altitude < 2500 ? { label: t('sim.altitude.low'), color: 'text-lime-600' } :
    altitude < 3500 ? { label: t('sim.altitude.medium'), color: 'text-amber-600' } :
    altitude < 5000 ? { label: t('sim.altitude.high'), color: 'text-orange-600' } :
    { label: t('sim.altitude.deathZone'), color: 'text-red-600' };

  const severityColors = {
    info: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400',
    warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
    danger: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400',
  };

  const radarData = result ? [
    { subject: 'VO2max', A: 100 - result.vo2max_reduction_percent, fullMark: 100 },
    { subject: 'SpO2', A: result.spo2_percent, fullMark: 100 },
    { subject: language === 'es' ? 'Rendimiento' : 'Performance', A: 100 - result.performance_reduction_percent, fullMark: 100 },
    { subject: language === 'es' ? 'FC control' : 'HR control', A: Math.max(0, 100 - result.hr_increase_bpm * 2), fullMark: 100 },
    { subject: language === 'es' ? 'PO2 alv.' : 'Alv. PO2', A: Math.round((result.po2_alveolar_mmhg / 110) * 100), fullMark: 100 },
    { subject: language === 'es' ? 'Ventilacion' : 'Ventilation', A: Math.max(0, 100 - result.ventilation_increase_percent), fullMark: 100 },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Inputs */}
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
            {athletes.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
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
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
              <label className="text-xs text-gray-500 block mb-1">{t('sim.orEnterVO2max')}</label>
              <input
                type="number"
                placeholder="ej: 55"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                onChange={e => setPhysioProfile({ vo2max: parseFloat(e.target.value) || 50, weight_kg: 70 })}
              />
            </div>
          )}
        </div>

        {/* Altitude parameters */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{language === 'es' ? 'Configuración de Altitud' : 'Altitude Configuration'}</h3>
            <span className={`text-xs font-semibold ${altitudeCategory.color}`}>{altitudeCategory.label}</span>
          </div>

          {/* Presets */}
          <div>
            <label className="text-xs text-gray-500 block mb-2">{language === 'es' ? 'Destinos conocidos:' : 'Known destinations:'}</label>
            <div className="flex flex-wrap gap-2">
              {ALTITUDE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setAltitude(p.alt)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    altitude === p.alt
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  {p.label} ({p.alt}m)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'Altitud' : 'Altitude'}: <span className="font-bold text-gray-700 dark:text-gray-200">{altitude}m</span></label>
              <input type="range" min={0} max={6000} step={50} value={altitude}
                onChange={e => setAltitude(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>0m</span><span>6000m</span></div>
              <input
                type="number"
                value={altitude}
                onChange={e => setAltitude(Math.max(0, Math.min(6000, +e.target.value)))}
                className="mt-2 w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">{language === 'es' ? 'Días de exposición' : 'Exposure days'}: <span className="font-bold text-gray-700 dark:text-gray-200">{exposureDays} {language === 'es' ? 'días' : 'days'}</span></label>
              <input type="range" min={1} max={28} value={exposureDays}
                onChange={e => setExposureDays(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>1d</span><span>28d</span></div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">{language === 'es' ? 'Carga de entrenamiento en altitud:' : 'Training load at altitude:'}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRAINING_LOAD_KEYS.map(tl => (
                <button
                  key={tl.value}
                  onClick={() => setTrainingLoad(tl.value)}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    trainingLoad === tl.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  <div className="text-xs font-semibold">{t(tl.labelKey)}</div>
                  <div className={`text-xs mt-0.5 ${trainingLoad === tl.value ? 'text-blue-100' : 'text-gray-400'}`}>{t(tl.descKey)}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runSimulation}
            disabled={!physioProfile}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {language === 'es' ? 'Simular Altitud' : 'Simulate Altitude'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Summary metrics strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: language === 'es' ? 'Reducción VO2max' : 'VO2max reduction', value: `-${result.vo2max_reduction_percent.toFixed(1)}%`, color: result.vo2max_reduction_percent > 15 ? 'text-red-600' : result.vo2max_reduction_percent > 7 ? 'text-amber-600' : 'text-emerald-600' },
              { label: language === 'es' ? 'VO2max ajustado' : 'Adjusted VO2max', value: `${result.adjusted_vo2max}`, unit: 'ml/kg/min', color: 'text-blue-600' },
              { label: language === 'es' ? 'SpO2 estimada' : 'Estimated SpO2', value: `${result.spo2_percent}%`, color: result.spo2_percent < 90 ? 'text-red-600' : result.spo2_percent < 94 ? 'text-amber-600' : 'text-emerald-600' },
              { label: language === 'es' ? 'Aumento FC' : 'HR increase', value: `+${result.hr_increase_bpm} bpm`, color: 'text-orange-600' },
              { label: language === 'es' ? 'Ventilación' : 'Ventilation', value: `+${result.ventilation_increase_percent}%`, color: 'text-sky-600' },
              { label: language === 'es' ? 'Pérdida rendimiento' : 'Performance loss', value: `-${result.performance_reduction_percent.toFixed(1)}%`, color: result.performance_reduction_percent > 15 ? 'text-red-600' : 'text-amber-600' },
            ].map((m, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 text-center">
                <div className="text-xs text-gray-400 mb-1">{m.label}</div>
                <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                {m.unit && <div className="text-xs text-gray-400">{m.unit}</div>}
              </div>
            ))}
          </div>

          {/* Risk flags */}
          {result.riskFlags.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.riskFlags.map((flag, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${severityColors[flag.severity]}`}>
                  <span className="text-base mt-0.5">
                    {flag.severity === 'danger' ? '⚠' : flag.severity === 'warning' ? '●' : 'ℹ'}
                  </span>
                  <span>{flag.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex gap-1 p-3 border-b border-gray-100 dark:border-gray-700">
              {[
                { key: 'overview', label: language === 'es' ? 'Perfil Fisiológico' : 'Physiological Profile' },
                { key: 'timeline', label: language === 'es' ? 'Aclimatación' : 'Acclimatization' },
                { key: 'zones', label: language === 'es' ? 'Zonas de Altitud' : 'Altitude Zones' },
                { key: 'recs', label: language === 'es' ? 'Recomendaciones' : 'Recommendations' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-3">{language === 'es' ? `Impacto Fisiológico (${altitude}m)` : `Physiological Impact (${altitude}m)`}</h4>
                    <ResponsiveContainer width="100%" height={260}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar name={language === 'es' ? 'Atleta' : 'Athlete'} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-400 text-center mt-1">{language === 'es' ? '100% = valor al nivel del mar / óptimo' : '100% = sea level / optimal value'}</p>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 mb-3">{language === 'es' ? 'Presión Parcial O2' : 'Partial O2 Pressure'}</h4>
                    <div className="space-y-3">
                      {[
                        { label: language === 'es' ? 'PO2 atmosférica' : 'Atmospheric PO2', val: Math.round(159 * Math.exp(-altitude / 7400)), unit: 'mmHg', max: 159 },
                        { label: language === 'es' ? 'PO2 alveolar estimada' : 'Estimated alveolar PO2', val: result.po2_alveolar_mmhg, unit: 'mmHg', max: 110 },
                        { label: language === 'es' ? 'SpO2 estimada' : 'Estimated SpO2', val: result.spo2_percent, unit: '%', max: 100 },
                        { label: language === 'es' ? 'VO2max ajustado' : 'Adjusted VO2max', val: result.adjusted_vo2max, unit: 'ml/kg/min', max: physioProfile?.vo2max ?? 60 },
                      ].map((item, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{item.val} {item.unit}</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, (item.val / item.max) * 100)}%`,
                                background: item.val / item.max > 0.9 ? '#22c55e' : item.val / item.max > 0.75 ? '#f59e0b' : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                      <div className="text-xs text-gray-500 mb-2">{language === 'es' ? `Respuestas compensatorias a los ${Math.min(exposureDays, 3)}-${Math.min(exposureDays, 7)} días:` : `Compensatory responses at days ${Math.min(exposureDays, 3)}-${Math.min(exposureDays, 7)}:`}</div>
                      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        <li>{language === 'es' ? 'Aumento de ventilación (respuesta inmediata)' : 'Increased ventilation (immediate response)'}</li>
                        <li>{language === 'es' ? 'Aumento de EPO endógena (24-48h)' : 'Increased endogenous EPO (24-48h)'}</li>
                        <li>{language === 'es' ? 'Aumento del 2,3-DPG eritrocitario (2-3 días)' : 'Increased erythrocyte 2,3-DPG (2-3 days)'}</li>
                        <li>{language === 'es' ? 'Eritropoyesis acelerada (7-14 días)' : 'Accelerated erythropoiesis (7-14 days)'}</li>
                        {exposureDays >= 14 && <li>{language === 'es' ? 'Aumento del volumen globular total (14-21 días)' : 'Increased total red cell volume (14-21 days)'}</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">{language === 'es' ? `Proyección de aclimatación en ${exposureDays} días a ${altitude}m` : `Acclimatization projection over ${exposureDays} days at ${altitude}m`}</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={result.acclimatization_timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="day" tickFormatter={v => `D${v}`} tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} labelFormatter={l => language === 'es' ? `Día ${l}` : `Day ${l}`} />
                      <Line type="monotone" dataKey="vo2max_recovery_percent" stroke="#3b82f6" strokeWidth={2} dot={false} name={language === 'es' ? 'Recuperación VO2max' : 'VO2max recovery'} />
                      <Line type="monotone" dataKey="performance_recovery_percent" stroke="#22c55e" strokeWidth={2} dot={false} name={language === 'es' ? 'Recuperación rendimiento' : 'Performance recovery'} />
                      <Line type="monotone" dataKey="rbc_increase_percent" stroke="#f59e0b" strokeWidth={2} dot={false} name={language === 'es' ? 'Aumento GR (%)' : 'RBC increase (%)'} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { day: 3, label: language === 'es' ? 'Día 3' : 'Day 3', desc: language === 'es' ? 'Respuestas agudas (ventilación, diuresis)' : 'Acute responses (ventilation, diuresis)', color: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' },
                      { day: 7, label: language === 'es' ? 'Día 7' : 'Day 7', desc: language === 'es' ? 'Inicio eritropoyesis, mejora tolerancia' : 'Erythropoiesis begins, improved tolerance', color: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' },
                      { day: 21, label: language === 'es' ? 'Día 21' : 'Day 21', desc: language === 'es' ? 'Aclimatación plena, máxima eritropoyesis' : 'Full acclimatization, peak erythropoiesis', color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' },
                    ].map(m => {
                      const pt = result.acclimatization_timeline.find(p => p.day === m.day) ?? result.acclimatization_timeline[result.acclimatization_timeline.length - 1];
                      return (
                        <div key={m.day} className={`rounded-xl border p-3 ${m.color}`}>
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{m.label}</div>
                          <div className="text-xs text-gray-500 mb-2">{m.desc}</div>
                          <div className="text-xs space-y-0.5">
                            <div>{language === 'es' ? 'Recuperación VO2max' : 'VO2max recovery'}: <strong>{pt.vo2max_recovery_percent.toFixed(0)}%</strong></div>
                            <div>{language === 'es' ? 'Rendimiento' : 'Performance'}: <strong>{pt.performance_recovery_percent.toFixed(0)}%</strong></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'zones' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-gray-500">{language === 'es' ? 'Clasificación de Altitudes y Efectos' : 'Altitude Classifications and Effects'}</h4>
                  <div className="space-y-3">
                    {result.altitudeZones.map((zone, i) => {
                      const isActive = (() => {
                        const ranges: [number, number][] = [[0, 1500], [1500, 2500], [2500, 3500], [3500, 5000], [5000, 9000]];
                        return altitude >= ranges[i][0] && altitude < ranges[i][1];
                      })();
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                            isActive
                              ? 'border-2 shadow-sm'
                              : 'border-gray-100 dark:border-gray-700 opacity-70'
                          }`}
                          style={isActive ? { borderColor: zone.color } : undefined}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ background: zone.color }} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{zone.label}</span>
                              <span className="text-xs text-gray-400">{zone.range}</span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{zone.vo2max_loss} VO2max</span>
                              {isActive && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: zone.color }}>{language === 'es' ? 'ACTUAL' : 'CURRENT'}</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{zone.effects}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-500 mb-3">{language === 'es' ? 'Reducción de VO2max según altitud' : 'VO2max reduction by altitude'}</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={[
                          { alt: '1500m', loss: 0 },
                          { alt: '2000m', loss: 1.6 },
                          { alt: '2500m', loss: 3.2 },
                          { alt: '3000m', loss: 4.8 },
                          { alt: '3500m', loss: 6.4 },
                          { alt: '4000m', loss: 8.0 },
                          { alt: '4500m', loss: 9.6 },
                          { alt: '5000m', loss: 11.2 },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="alt" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`${v}%`, language === 'es' ? 'Reducción VO2max' : 'VO2max reduction']} />
                        <Bar dataKey="loss" radius={[4, 4, 0, 0]}>
                          {[0, 1.6, 3.2, 4.8, 6.4, 8.0, 9.6, 11.2].map((val, i) => (
                            <Cell key={i} fill={val < 3 ? '#22c55e' : val < 6 ? '#f59e0b' : val < 9 ? '#f97316' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {activeTab === 'recs' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-gray-500">{language === 'es' ? `Recomendaciones para ${altitude}m · ${exposureDays} días · Carga ${trainingLoad}` : `Recommendations for ${altitude}m · ${exposureDays} days · Load ${trainingLoad}`}</h4>
                  {result.training_recommendations.length === 0 ? (
                    <p className="text-sm text-gray-400">{language === 'es' ? 'Sin altitud significativa — entrenamiento sin modificaciones necesarias.' : 'No significant altitude — training without modifications needed.'}</p>
                  ) : (
                    <div className="space-y-3">
                      {result.training_recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</div>
                          <div>
                            <div className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 uppercase tracking-wide">{rec.category}</div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{rec.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* LHTL protocol info */}
                  {altitude >= 2000 && altitude <= 3200 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                      <h5 className="text-xs font-bold text-blue-700 dark:text-blue-400 mb-2">{language === 'es' ? 'Protocolo LHTL — Condiciones óptimas detectadas' : 'LHTL Protocol — Optimal conditions detected'}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-700 dark:text-blue-300">
                        <div>
                          <div className="font-semibold">{language === 'es' ? 'Vivir en:' : 'Live at:'}</div>
                          <div>2200 – 2800m</div>
                          <div className="text-blue-400">{language === 'es' ? '(Estimulación EPO)' : '(EPO stimulation)'}</div>
                        </div>
                        <div>
                          <div className="font-semibold">{language === 'es' ? 'Entrenar en:' : 'Train at:'}</div>
                          <div>1000 – 1500m</div>
                          <div className="text-blue-400">{language === 'es' ? '(Máxima calidad)' : '(Maximum quality)'}</div>
                        </div>
                        <div>
                          <div className="font-semibold">{language === 'es' ? 'Duración:' : 'Duration:'}</div>
                          <div>21 – 28 {language === 'es' ? 'días' : 'days'}</div>
                          <div className="text-blue-400">{language === 'es' ? '(Mínimo 18 días)' : '(Minimum 18 days)'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
