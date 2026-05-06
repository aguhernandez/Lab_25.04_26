import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface AthleteData {
  id: string;
  name: string;
  sport: string;
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
  }> | null;
}

interface AnthroProfile {
  body_fat_percent: number | null;
  muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  weight_kg: number | null;
  bmi: number | null;
  applied_at: string | null;
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

export default function AthleteDashboard() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [athlete, setAthlete] = useState<AthleteData | null>(null);
  const [physiology, setPhysiology] = useState<PhysiologyProfile | null>(null);
  const [anthro, setAnthro] = useState<AnthroProfile | null>(null);
  const [hydration, setHydration] = useState<HydrationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const tr: Record<string, Record<string, string>> = {
    welcome: { en: 'Welcome back', es: 'Bienvenido/a' },
    vo2max: { en: 'VO₂max', es: 'VO₂max' },
    lt1: { en: 'Aerobic Threshold', es: 'Umbral Aeróbico' },
    lt2: { en: 'Anaerobic Threshold', es: 'Umbral Anaeróbico' },
    aerobicTrends: { en: 'VO₂max Trends', es: 'Tendencias VO₂max' },
    sweatRate: { en: 'Avg. Sweat Rate', es: 'Tasa de Sudoración' },
    trainingZones: { en: 'Training Zones', es: 'Zonas de Entrenamiento' },
    noData: { en: 'No data available', es: 'Sin datos disponibles' },
    noZones: { en: 'Complete an evaluation to see your zones', es: 'Completá una evaluación para ver tus zonas' },
    bpm: { en: 'bpm', es: 'lpm' },
    mlkgmin: { en: 'ml/kg/min', es: 'ml/kg/min' },
    lh: { en: 'L/h', es: 'L/h' },
    zone: { en: 'Zone', es: 'Zona' },
    cycling: { en: 'Cycling', es: 'Ciclismo' },
    running: { en: 'Running', es: 'Carrera' },
    triathlon: { en: 'Triathlon', es: 'Triatlón' },
    swimming: { en: 'Swimming', es: 'Natación' },
    bodyComposition: { en: 'Body Composition', es: 'Composición Corporal' },
    bodyFat: { en: 'Body Fat', es: 'Grasa Corporal' },
    muscle: { en: 'Muscle', es: 'Músculo' },
    bmi: { en: 'BMI', es: 'IMC' },
    weight: { en: 'Weight', es: 'Peso' },
    noAnthro: { en: 'No body composition data. Ask your coach to apply an anthropometry.', es: 'Sin datos de composición corporal. Pedile a tu entrenador que aplique una antropometría.' },
    lastUpdate: { en: 'Last update', es: 'Última actualización' },
    noProfile: { en: 'No physiological profile yet. Complete a lab session to see your data here.', es: 'Sin perfil fisiológico aún. Completá una sesión de laboratorio para ver tus datos aquí.' },
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
        .select('id, name, sport')
        .eq('hub_user_id', profile!.hub_user_id)
        .maybeSingle();

      if (!athleteData) { setLoading(false); return; }
      setAthlete(athleteData);

      const [physRes, anthroRes, hydrationRes] = await Promise.all([
        supabase
          .from('athlete_physiology_profiles')
          .select('vo2max_relative_ml_kg_min, lt1_hr, lt2_hr, pam_watts, vam_kmh, hrmax, physiology_zones, last_test_date, history')
          .eq('athlete_id', athleteData.id)
          .maybeSingle(),
        supabase
          .from('athlete_anthropometry_profiles')
          .select('body_fat_percent, muscle_mass_kg, bone_mass_kg, weight_kg, bmi, applied_at')
          .eq('athlete_id', athleteData.id)
          .maybeSingle(),
        supabase
          .from('hydration_sessions')
          .select('session_date, sweat_rate_l_h')
          .eq('athlete_id', athleteData.id)
          .order('session_date', { ascending: false })
          .limit(6),
      ]);

      setPhysiology(physRes.data || null);
      setAnthro(anthroRes.data || null);
      setHydration(hydrationRes.data || []);
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
      <div className="flex items-start justify-between">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'VO₂max', value: physiology.vo2max_relative_ml_kg_min ? physiology.vo2max_relative_ml_kg_min.toFixed(1) : '—', unit: t('mlkgmin') },
              { label: 'LT2', value: physiology.lt2_hr ? `${physiology.lt2_hr}` : '—', unit: t('bpm') },
              {
                label: physiology.pam_watts ? 'PAM' : physiology.vam_kmh ? 'VAM' : 'HRmax',
                value: physiology.pam_watts ? `${physiology.pam_watts}` : physiology.vam_kmh ? physiology.vam_kmh.toFixed(1) : physiology.hrmax ? `${physiology.hrmax}` : '—',
                unit: physiology.pam_watts ? 'W' : physiology.vam_kmh ? 'km/h' : t('bpm'),
              },
              { label: t('sweatRate'), value: avgSweatRate ? avgSweatRate.toFixed(2) : '—', unit: t('lh') },
            ].map((card, i) => (
              <div key={i} className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">{card.label}</p>
                <p className="text-3xl font-bold leading-none">{card.value}</p>
                {card.value !== '—' && <p className="text-xs text-white/50 mt-1">{card.unit}</p>}
              </div>
            ))}
          </div>

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
                <div className="h-44 flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">
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
                  {zones.slice(0, 5).map((zone) => {
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
                <div className="h-44 flex items-center justify-center text-sm text-gray-300 dark:text-gray-600 text-center px-4">
                  {t('noZones')}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
          {t('bodyComposition')}
        </h2>
        {anthro ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('weight'), value: anthro.weight_kg ? String(anthro.weight_kg) : null, unit: 'kg' },
              { label: t('bodyFat'), value: anthro.body_fat_percent ? anthro.body_fat_percent.toFixed(1) : null, unit: '%' },
              { label: t('muscle'), value: anthro.muscle_mass_kg ? anthro.muscle_mass_kg.toFixed(1) : null, unit: 'kg' },
              { label: t('bmi'), value: anthro.bmi ? anthro.bmi.toFixed(1) : null, unit: '' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{item.value ?? '—'}</p>
                {item.unit && item.value && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.unit}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noAnthro')}</p>
        )}
      </div>
    </div>
  );
}
