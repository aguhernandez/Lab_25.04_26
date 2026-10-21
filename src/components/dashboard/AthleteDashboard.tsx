import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import KerrPresentationDashboard from '../anthropometry/KerrPresentationDashboard';
import type { AnthropometryMeasurement, KerrResults } from '../../types/anthropometry.types';
import type { Athlete } from '../../types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface AthleteData {
  id: string;
  name: string;
  sport: Athlete['sport'];
  created_at: string;
  updated_at: string;
}

interface PhysiologyProfile {
  vo2max_relative_ml_kg_min: number | null;
  lt1_hr: number | null;
  lt2_hr: number | null;
  pam_watts: number | null;
  vam_kmh: number | null;
  hrmax: number | null;
  physiology_zones: TrainingZoneLocal[] | null;
  last_test_date: string | null;
  history: Array<{
    date: string;
    vo2max_relative_ml_kg_min: number | null;
    lt1_hr?: number | null;
    lt1_power?: number | null;
    lt2_hr?: number | null;
    lt2_power?: number | null;
  }> | null;
}

interface TrainingZoneLocal {
  zone: number;
  name: string;
  hr_min?: number;
  hr_max?: number;
  power_min?: number;
  power_max?: number;
}

interface HydrationSummary {
  session_date: string;
  sweat_rate_l_h?: number | null;
}

interface ReadinessSnapshot {
  global_readiness: number | null;
  limiting_factor: string | null;
  aerobic_score: number | null;
  neuromuscular_score: number | null;
  biological_health_score: number | null;
  hydration_stress_score: number | null;
}

export default function AthleteDashboard({ onViewHistory, onViewAnthropometry }: { onViewHistory?: () => void; onViewAnthropometry?: (athlete: Athlete) => void }) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [athlete, setAthlete] = useState<AthleteData | null>(null);
  const [physiology, setPhysiology] = useState<PhysiologyProfile | null>(null);
  const [latestAnthropometry, setLatestAnthropometry] = useState<{ measurement: AnthropometryMeasurement; results: KerrResults | null } | null>(null);
  const [hydration, setHydration] = useState<HydrationSummary[]>([]);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const tr: Record<string, Record<string, string>> = {
    welcome: { en: 'My passport', es: 'Mi pasaporte' },
    vo2max: { en: 'VO₂max', es: 'VO₂max' },
    lt1: { en: 'Aerobic Threshold', es: 'Umbral Aeróbico' },
    lt2: { en: 'Anaerobic Threshold', es: 'Umbral Anaeróbico' },
    aerobicTrends: { en: 'VO₂max history', es: 'Historial de VO₂max' },
    sweatRate: { en: 'Avg. Sweat Rate', es: 'Tasa de Sudoración' },
    trainingZones: { en: 'Training Zones', es: 'Zonas de Entrenamiento' },
    noData: { en: 'Not evaluated. Ask your professional about this module.', es: 'No evaluado. Consulta con tu profesional sobre este módulo.' },
    noZones: { en: 'Your zones will appear here after an evaluation.', es: 'Tus zonas aparecerán aquí cuando se complete una evaluación.' },
    bpm: { en: 'bpm', es: 'lpm' },
    mlkgmin: { en: 'ml/kg/min', es: 'ml/kg/min' },
    lh: { en: 'L/h', es: 'L/h' },
    zone: { en: 'Zone', es: 'Zona' },
    cycling: { en: 'Cycling', es: 'Ciclismo' },
    running: { en: 'Running', es: 'Carrera' },
    triathlon: { en: 'Triathlon', es: 'Triatlón' },
    swimming: { en: 'Swimming', es: 'Natación' },
    bodyComposition: { en: 'Latest anthropometry', es: 'Última antropometría' },
    noAnthro: { en: 'Not evaluated. Ask your professional about this module.', es: 'No evaluado. Consulta con tu profesional sobre este módulo.' },
    viewAnthropometry: { en: 'Open full evaluation', es: 'Ver evaluación completa' },
    anthropometryResultUnavailable: { en: 'The latest measurement has no saved Kerr result.', es: 'La última medición no tiene un resultado Kerr guardado.' },
    lastUpdate: { en: 'Last test', es: 'Último test' },
    noProfile: { en: 'No evaluated passport yet. Ask your professional about your next test.', es: 'Aún no hay un pasaporte evaluado. Consulta con tu profesional sobre tu próximo test.' },
    changes: { en: 'What changed since your last test', es: 'Qué cambió desde tu último test' },
    comparison: { en: 'vs previous snapshot', es: 'vs snapshot anterior' },
    history: { en: 'Passport history', es: 'Historial del pasaporte' },
    noPrevious: { en: 'This is your first available snapshot.', es: 'Este es el primer snapshot disponible.' },
    noChange: { en: 'No comparable changes are available.', es: 'No hay cambios comparables disponibles.' },
    vo2Meaning: { en: 'VO₂max describes the maximum amount of oxygen your body can use during exercise.', es: 'VO₂máx describe la cantidad máxima de oxígeno que tu cuerpo puede utilizar durante el ejercicio.' },
    lt1Meaning: { en: 'LT1 is an intensity you can usually sustain comfortably for a long time.', es: 'LT1 es una intensidad que normalmente puedes sostener con comodidad durante bastante tiempo.' },
    lt2Meaning: { en: 'LT2 marks a harder effort that is more demanding to sustain.', es: 'LT2 marca un esfuerzo más exigente y difícil de sostener durante mucho tiempo.' },
    zonesMeaning: { en: 'Use these ranges to guide training intensity. Follow your professional’s plan.', es: 'Usa estos rangos para orientar la intensidad. Sigue el plan de tu profesional.' },
    readiness: { en: 'Athlete Readiness', es: 'Disposición del Atleta' },
    aerobic: { en: 'Aerobic', es: 'Aeróbico' },
    neuromuscular: { en: 'Neuromuscular', es: 'Neuromuscular' },
    biological: { en: 'Biological', es: 'Biológico' },
    hydrationDomain: { en: 'Hydration', es: 'Hidratación' },
    limitingFactor: { en: 'Limiting factor', es: 'Factor limitante' },
    limit_aerobic_limitation: { en: 'Aerobic capacity decline', es: 'Descenso de capacidad aeróbica' },
    limit_neuromuscular_fatigue: { en: 'Neuromuscular fatigue', es: 'Fatiga neuromuscular' },
    limit_iron_transport: { en: 'Iron/oxygen transport limitation', es: 'Limitación de transporte de hierro/oxígeno' },
    limit_hormonal_stress: { en: 'Hormonal stress response', es: 'Respuesta de estrés hormonal' },
    limit_hydration_heat: { en: 'Hydration/heat stress', es: 'Estrés hídrico/calórico' },
  };

  const t = (key: string) => tr[key]?.[language] ?? tr[key]?.en ?? key;

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: athleteData } = await supabase
        .from('athletes')
        .select('id, name, sport, created_at, updated_at')
        .eq('hub_user_id', profile!.hub_user_id)
        .maybeSingle();

      if (!athleteData) { setLoading(false); return; }
      setAthlete(athleteData);

      const [physRes, hydrationRes, readinessRes, measurementRes] = await Promise.all([
        supabase
          .from('athlete_physiology_profiles')
          .select('vo2max_relative_ml_kg_min, lt1_hr, lt2_hr, pam_watts, vam_kmh, hrmax, physiology_zones, last_test_date, history')
          .eq('athlete_id', athleteData.id)
          .maybeSingle(),
        supabase
          .from('hydration_sessions')
          .select('session_date, sweat_rate_l_h')
          .eq('athlete_id', athleteData.id)
          .order('session_date', { ascending: false })
          .limit(6),
        supabase
          .from('athlete_readiness_snapshots')
          .select('global_readiness, limiting_factor, aerobic_score, neuromuscular_score, biological_health_score, hydration_stress_score')
          .eq('athlete_id', athleteData.id)
          .order('computed_at', { ascending: false })
          .limit(1),
        supabase
          .from('anthropometry_measurements')
          .select('*')
          .eq('athlete_id', athleteData.id)
          .order('measurement_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setPhysiology(physRes.data || null);
      setHydration(hydrationRes.data || []);
      setReadiness(readinessRes.data?.[0] || null);
      const measurement = measurementRes.data as AnthropometryMeasurement | null;
      if (measurement) {
        const { data: kerrResult } = await supabase
          .from('anthropometry_kerr_results')
          .select('*')
          .eq('measurement_id', measurement.id)
          .maybeSingle();
        setLatestAnthropometry({ measurement, results: kerrResult as KerrResults | null });
      }
    } catch { }
    finally { setLoading(false); }
  }

  const vo2Trend = (physiology?.history || [])
    .filter(h => h.vo2max_relative_ml_kg_min)
    .slice(0, 8)
    .reverse()
    .map(h => ({
      date: new Date(h.date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { month: 'short', year: '2-digit' }),
      vo2max: h.vo2max_relative_ml_kg_min,
    }));

  const validHydration = hydration.filter(h => h.sweat_rate_l_h);
  const avgSweatRate = validHydration.length > 0
    ? validHydration.reduce((s, h) => s + (h.sweat_rate_l_h || 0), 0) / validHydration.length
    : null;

  const zones = physiology?.physiology_zones || [];
  const previousSnapshot = physiology?.history?.find((snapshot, index) => index > 0) ?? null;
  const vo2Delta = physiology?.vo2max_relative_ml_kg_min != null && previousSnapshot?.vo2max_relative_ml_kg_min != null
    ? physiology.vo2max_relative_ml_kg_min - previousSnapshot.vo2max_relative_ml_kg_min
    : null;
  const latestSum6Skinfolds = (() => {
    const measurement = latestAnthropometry?.measurement;
    if (!measurement) return undefined;
    const sum6 = [
      measurement.triceps_sf_mm_median ?? measurement.triceps_sf_mm,
      measurement.subscapular_sf_mm_median ?? measurement.subscapular_sf_mm,
      measurement.supraspinale_sf_mm_median ?? measurement.supraspinale_sf_mm,
      measurement.abdominal_sf_mm_median ?? measurement.abdominal_sf_mm,
      measurement.front_thigh_sf_mm_median ?? measurement.front_thigh_sf_mm,
      measurement.medial_calf_sf_mm_median ?? measurement.medial_calf_sf_mm,
    ];
    return sum6.every(value => value != null) ? sum6.reduce<number>((total, value) => total + (value ?? 0), 0) : undefined;
  })();

  const sportLabel = (s: string) => {
    const map: Record<string, string> = { cycling: t('cycling'), running: t('running'), triathlon: t('triathlon'), swimming: t('swimming') };
    return map[s] ?? s;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            {t('welcome')}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {athlete?.name || profile?.full_name || profile?.email}
          </h1>
          {athlete && (
            <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full font-medium">
              {sportLabel(athlete.sport)}
            </span>
          )}
          {onViewHistory && <button type="button" onClick={onViewHistory} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#514163]">{t('history')}</button>}
        </div>
        {physiology?.last_test_date && (
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-gray-500">{t('lastUpdate')}</p>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {new Date(physiology.last_test_date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      {!physiology ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">{t('noProfile')}</p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t('changes')}</h2>
            {vo2Delta != null ? (
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-200 tabular-nums">
                <span className="text-lg font-bold">{vo2Delta > 0 ? '+' : ''}{vo2Delta.toFixed(1)} ml/kg/min</span>
                <span className="ml-2 text-gray-500 dark:text-gray-400">VO₂max {t('comparison')}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{previousSnapshot ? t('noChange') : t('noPrevious')}</p>
            )}
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('vo2Meaning')}</p>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'VO₂max', value: physiology.vo2max_relative_ml_kg_min != null ? physiology.vo2max_relative_ml_kg_min.toFixed(1) : null, unit: t('mlkgmin'), meaning: t('vo2Meaning') },
              { label: 'LT1', value: physiology.lt1_hr != null ? `${physiology.lt1_hr}` : null, unit: t('bpm'), meaning: t('lt1Meaning') },
              { label: 'LT2', value: physiology.lt2_hr != null ? `${physiology.lt2_hr}` : null, unit: t('bpm'), meaning: t('lt2Meaning') },
              {
                label: physiology.pam_watts ? 'PAM' : physiology.vam_kmh ? 'VAM' : 'HRmax',
                value: physiology.pam_watts != null ? `${physiology.pam_watts}` : physiology.vam_kmh != null ? physiology.vam_kmh.toFixed(1) : physiology.hrmax != null ? `${physiology.hrmax}` : null,
                unit: physiology.pam_watts ? 'W' : physiology.vam_kmh ? 'km/h' : t('bpm'),
                meaning: t('zonesMeaning'),
              },
              ...(avgSweatRate != null ? [{ label: t('sweatRate'), value: avgSweatRate.toFixed(2), unit: t('lh'), meaning: t('zonesMeaning') }] : []),
            ].filter(card => card.value != null).map((card, i) => (
              <div key={i} className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/80 mb-2">{card.label}</p>
                <p className="text-3xl font-bold leading-none tabular-nums">{card.value} <span className="text-sm font-medium">{card.unit}</span></p>
                {'power' in card && card.power != null && <p className="mt-1 text-sm tabular-nums">{card.power} W</p>}
                <p className="mt-3 text-xs text-white/85">{card.meaning}</p>
              </div>
            ))}
          </div>

          {readiness && readiness.global_readiness != null && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                {t('readiness')}
              </h2>
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20">
                  <svg className="transform -rotate-90" width={80} height={80}>
                    <circle cx={40} cy={40} r={35} fill="none" stroke="currentColor" strokeWidth={5} className="text-gray-200 dark:text-gray-700" />
                    <circle cx={40} cy={40} r={35} fill="none"
                      stroke={readiness.global_readiness >= 75 ? '#22c55e' : readiness.global_readiness >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth={5} strokeDasharray={220} strokeDashoffset={220 - (readiness.global_readiness / 100) * 220} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-900 dark:text-white">
                    {readiness.global_readiness}
                  </span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  {[
                    { label: t('aerobic'), score: readiness.aerobic_score },
                    { label: t('neuromuscular'), score: readiness.neuromuscular_score },
                    { label: t('biological'), score: readiness.biological_health_score },
                    { label: t('hydrationDomain'), score: readiness.hydration_stress_score },
                  ].map(d => (
                    <div key={d.label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        (d.score ?? 0) >= 75 ? 'bg-green-500' : (d.score ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-gray-600 dark:text-gray-400">{d.label}</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white ml-auto">{d.score ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              {readiness.limiting_factor && readiness.limiting_factor !== 'none' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 font-medium">
                  {t('limitingFactor')}: {t(`limit_${readiness.limiting_factor}`)}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                {t('aerobicTrends')}
              </h2>
              {vo2Trend.length >= 2 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={vo2Trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} cursor={{ stroke: '#fdda36', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="vo2max" stroke="#fdda36" strokeWidth={2.5} dot={{ fill: '#fdda36', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#fdda36' }} name="VO₂max" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-4 text-sm text-gray-600 dark:text-gray-300">
                  {t('noData')}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                {t('trainingZones')}
              </h2>
              {zones.length > 0 ? (
                <div className="space-y-2">
              {zones.map((zone) => {
                    const zoneColors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
                    const color = zoneColors[zone.zone - 1] || '#6b7280';
                    const hrRange = zone.hr_min && zone.hr_max ? `${zone.hr_min}–${zone.hr_max} ${t('bpm')}` : null;
                    const pwrRange = zone.power_min && zone.power_max ? `${zone.power_min}–${zone.power_max} W` : null;
                    return (
                      <div key={zone.zone} className="flex items-center gap-3">
                        <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{t('zone')} {zone.zone}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{zone.name}</span>
                          </div>
                          {(hrRange || pwrRange) && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {[hrRange, pwrRange].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3 text-sm text-gray-600 dark:text-gray-300">
                  {t('noZones')}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
          {t('bodyComposition')}
        </h2>
        {latestAnthropometry ? (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {new Date(latestAnthropometry.measurement.measurement_date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {onViewAnthropometry && athlete && <button type="button" onClick={() => onViewAnthropometry(athlete)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[#514163]">{t('viewAnthropometry')}</button>}
            </div>
            {latestAnthropometry.results ? (
              <KerrPresentationDashboard
                results={latestAnthropometry.results}
                athleteName={athlete?.name}
                sum6Skinfolds={latestSum6Skinfolds}
                stature={latestAnthropometry.measurement.stature_cm ?? undefined}
                showObjectives={false}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('anthropometryResultUnavailable')}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noAnthro')}</p>
        )}
      </section>
    </div>
  );
}
