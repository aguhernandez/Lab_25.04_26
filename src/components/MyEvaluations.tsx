import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

interface EvalSummary {
  testId: string;
  testDate: string;
  sport: string;
  testType: string;
  vo2max: number | null;
  lt1_hr: number | null;
  lt1_power: number | null;
  lt2_hr: number | null;
  lt2_power: number | null;
  fatmax_hr: number | null;
  pam_watts: number | null;
  vam_kmh: number | null;
  hrmax: number | null;
  training_zones: TrainingZoneLocal[] | null;
  coach_notes: string | null;
  data_quality: string | null;
}

interface TrainingZoneLocal {
  zone: number;
  name: string;
  hr_min?: number;
  hr_max?: number;
  power_min?: number;
  power_max?: number;
  description?: string;
}

interface AnthroProfile {
  body_fat_percent: number | null;
  muscle_mass_kg: number | null;
  bone_mass_kg: number | null;
  adipose_mass_kg: number | null;
  skin_mass_kg: number | null;
  somatotype_endomorphy: number | null;
  somatotype_mesomorphy: number | null;
  somatotype_ectomorphy: number | null;
  bmi: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  applied_at: string | null;
}

const ZONE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];

export default function MyEvaluations() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [evals, setEvals] = useState<EvalSummary[]>([]);
  const [anthro, setAnthro] = useState<AnthroProfile | null>(null);
  const [selected, setSelected] = useState<EvalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'lab' | 'anthropometry' | 'force-velocity' | 'hydration'>('lab');

  const tr: Record<string, Record<string, string>> = {
    title: { en: 'My Evaluations', es: 'Mis Evaluaciones' },
    labSession: { en: 'Lab Session', es: 'Sesión de Lab' },
    anthropometry: { en: 'Anthropometry', es: 'Antropometría' },
    fvCurve: { en: 'Force-Power Curve', es: 'Curva Fuerza-Potencia' },
    hydration: { en: 'Hydration', es: 'Hidratación' },
    noEvals: { en: 'No evaluations yet. Your coach will add them after your lab session.', es: 'Aún no hay evaluaciones. Tu entrenador las agregará luego de la sesión en el laboratorio.' },
    vo2max: { en: 'VO₂max', es: 'VO₂max' },
    lt1: { en: 'Aerobic Threshold', es: 'Umbral Aeróbico' },
    lt2: { en: 'Anaerobic Threshold', es: 'Umbral Anaeróbico' },
    hrmax: { en: 'HRmax', es: 'FCmáx' },
    pam: { en: 'Peak Aerobic Power', es: 'Potencia Aeróbica Máx.' },
    vam: { en: 'Max. Aerobic Speed', es: 'VAM' },
    coachNotes: { en: "Coach's Notes", es: 'Notas del Entrenador' },
    zones: { en: 'Training Zones', es: 'Zonas de Entrenamiento' },
    close: { en: 'Close', es: 'Cerrar' },
    bpm: { en: 'bpm', es: 'lpm' },
    watts: { en: 'W', es: 'W' },
    mlkgmin: { en: 'ml/kg/min', es: 'ml/kg/min' },
    kmh: { en: 'km/h', es: 'km/h' },
    bodyFat: { en: 'Body Fat', es: 'Grasa Corporal' },
    muscle: { en: 'Muscle Mass', es: 'Masa Muscular' },
    bone: { en: 'Bone Mass', es: 'Masa Ósea' },
    bmi: { en: 'BMI', es: 'IMC' },
    somatotype: { en: 'Somatotype', es: 'Somatotipo' },
    noAnthro: { en: 'No anthropometry applied yet.', es: 'Sin antropometría aplicada aún.' },
    noFV: { en: 'No force-velocity data yet.', es: 'Sin datos de fuerza-velocidad aún.' },
    noHydration: { en: 'No hydration data yet.', es: 'Sin datos de hidratación aún.' },
    sport: { en: 'Sport', es: 'Deporte' },
    date: { en: 'Date', es: 'Fecha' },
    cycling: { en: 'Cycling', es: 'Ciclismo' },
    running: { en: 'Running', es: 'Carrera' },
    triathlon: { en: 'Triathlon', es: 'Triatlón' },
    swimming: { en: 'Swimming', es: 'Natación' },
    quality: { en: 'Quality', es: 'Calidad' },
    detailTitle: { en: 'Evaluation Detail', es: 'Detalle de Evaluación' },
    appliedOn: { en: 'Applied on', es: 'Aplicado el' },
    kg: { en: 'kg', es: 'kg' },
    cm: { en: 'cm', es: 'cm' },
    weight: { en: 'Weight', es: 'Peso' },
    height: { en: 'Height', es: 'Talla' },
  };

  const t = (key: string) => tr[key]?.[language] ?? tr[key]?.en ?? key;

  const sportLabel = (s: string) => {
    const map: Record<string, string> = { cycling: t('cycling'), running: t('running'), triathlon: t('triathlon'), swimming: t('swimming') };
    return map[s] ?? s;
  };

  useEffect(() => {
    if (!profile) return;
    loadAthleteData();
  }, [profile]);

  async function loadAthleteData() {
    setLoading(true);
    try {
      let athleteData: { id: string } | null = null;

      if (profile!.hub_user_id) {
        const { data } = await supabase
          .from('athletes')
          .select('id')
          .eq('hub_user_id', profile!.hub_user_id)
          .maybeSingle();
        athleteData = data;
      }

      if (!athleteData && profile!.email) {
        const { data } = await supabase
          .from('athletes')
          .select('id')
          .eq('email', profile!.email)
          .maybeSingle();
        athleteData = data;
      }

      if (!athleteData) { setLoading(false); return; }
      setAthleteId(athleteData.id);

      const [testsRes, anthroRes] = await Promise.all([
        supabase
          .from('tests')
          .select('id, test_date, sport, test_type')
          .eq('athlete_id', athleteData.id)
          .eq('status', 'completed')
          .order('test_date', { ascending: false }),
        supabase
          .from('athlete_anthropometry_profiles')
          .select('*')
          .eq('athlete_id', athleteData.id)
          .maybeSingle(),
      ]);

      setAnthro(anthroRes.data || null);

      if (testsRes.data && testsRes.data.length > 0) {
        const testIds = testsRes.data.map(t => t.id);
        const { data: resultsData } = await supabase
          .from('test_results')
          .select('test_id, vo2max, lt1_hr, lt1_power, lt2_hr, lt2_power, fatmax_hr, pam_watts, vam_kmh, hrmax, training_zones, coach_notes, data_quality')
          .in('test_id', testIds);

        const mapped: EvalSummary[] = testsRes.data.map(test => {
          const r = resultsData?.find(r => r.test_id === test.id);
          return {
            testId: test.id,
            testDate: test.test_date,
            sport: test.sport,
            testType: test.test_type,
            vo2max: r?.vo2max ?? null,
            lt1_hr: r?.lt1_hr ?? null,
            lt1_power: r?.lt1_power ?? null,
            lt2_hr: r?.lt2_hr ?? null,
            lt2_power: r?.lt2_power ?? null,
            fatmax_hr: r?.fatmax_hr ?? null,
            pam_watts: r?.pam_watts ?? null,
            vam_kmh: r?.vam_kmh ?? null,
            hrmax: r?.hrmax ?? null,
            training_zones: r?.training_zones ?? null,
            coach_notes: r?.coach_notes ?? null,
            data_quality: r?.data_quality ?? null,
          };
        });
        setEvals(mapped);
      }
    } catch { }
    finally { setLoading(false); }
  }

  const vo2Trend = evals.slice().reverse().filter(e => e.vo2max).map(e => ({
    date: new Date(e.testDate).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { month: 'short', year: '2-digit' }),
    vo2max: e.vo2max,
  }));

  const somatoData = anthro ? [
    { label: 'Endo', value: anthro.somatotype_endomorphy || 0 },
    { label: 'Meso', value: anthro.somatotype_mesomorphy || 0 },
    { label: 'Ecto', value: anthro.somatotype_ectomorphy || 0 },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
          {profile?.full_name || profile?.email}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('title')}</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['lab', 'anthropometry', 'force-velocity', 'hydration'] as const).map(sec => {
          const labels: Record<string, string> = { lab: t('labSession'), anthropometry: t('anthropometry'), 'force-velocity': t('fvCurve'), hydration: t('hydration') };
          return (
            <button
              key={sec}
              onClick={() => setActiveSection(sec)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeSection === sec
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
            >
              {labels[sec]}
            </button>
          );
        })}
      </div>

      {activeSection === 'lab' && (
        <div className="space-y-5">
          {vo2Trend.length >= 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                VO₂max Trend
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={vo2Trend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} cursor={{ stroke: '#fdda36', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="vo2max" stroke="#fdda36" strokeWidth={2.5} dot={{ fill: '#fdda36', r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} name="VO₂max" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {evals.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">{t('noEvals')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {evals.map(ev => (
                <button
                  key={ev.testId}
                  onClick={() => setSelected(ev)}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 text-left hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
                        {new Date(ev.testDate).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{sportLabel(ev.sport)}</p>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:bg-gray-100 dark:group-hover:bg-gray-600 transition-colors">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">VO₂max</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                        {ev.vo2max ? ev.vo2max.toFixed(1) : '—'}
                      </p>
                      {ev.vo2max && <p className="text-xs text-gray-400 mt-0.5">ml/kg/min</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">LT2</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                        {ev.lt2_hr ? ev.lt2_hr : '—'}
                      </p>
                      {ev.lt2_hr && <p className="text-xs text-gray-400 mt-0.5">{t('bpm')}</p>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                        {ev.pam_watts ? 'PAM' : ev.vam_kmh ? 'VAM' : 'HRmax'}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                        {ev.pam_watts ? ev.pam_watts : ev.vam_kmh ? ev.vam_kmh.toFixed(1) : ev.hrmax ? ev.hrmax : '—'}
                      </p>
                      {(ev.pam_watts || ev.vam_kmh || ev.hrmax) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {ev.pam_watts ? 'W' : ev.vam_kmh ? 'km/h' : 'bpm'}
                        </p>
                      )}
                    </div>
                  </div>
                  {ev.training_zones && ev.training_zones.length > 0 && (
                    <div className="mt-3 flex gap-1">
                      {ev.training_zones.slice(0, 5).map((_z, i) => (
                        <div key={i} className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: ZONE_COLORS[i] || '#6b7280' }} />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === 'anthropometry' && (
        <div>
          {anthro ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                  {t('anthropometry')}
                </h2>
                <div className="space-y-3">
                  {[
                    { label: t('weight'), value: anthro.weight_kg ? `${anthro.weight_kg} ${t('kg')}` : null },
                    { label: t('height'), value: anthro.height_cm ? `${anthro.height_cm} ${t('cm')}` : null },
                    { label: t('bodyFat'), value: anthro.body_fat_percent ? `${anthro.body_fat_percent.toFixed(1)}%` : null },
                    { label: t('muscle'), value: anthro.muscle_mass_kg ? `${anthro.muscle_mass_kg.toFixed(1)} ${t('kg')}` : null },
                    { label: t('bone'), value: anthro.bone_mass_kg ? `${anthro.bone_mass_kg.toFixed(2)} ${t('kg')}` : null },
                    { label: t('bmi'), value: anthro.bmi ? `${anthro.bmi.toFixed(1)}` : null },
                  ].filter(r => r.value).map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
                {anthro.applied_at && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                    {t('appliedOn')}: {new Date(anthro.applied_at).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>

              {(anthro.somatotype_endomorphy || anthro.somatotype_mesomorphy || anthro.somatotype_ectomorphy) && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
                    {t('somatotype')}
                  </h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={somatoData} cx="50%" cy="50%">
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <Radar dataKey="value" stroke="#fdda36" fill="#fdda36" fillOpacity={0.25} strokeWidth={2} dot={{ fill: '#fdda36', r: 4 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[
                      { label: 'Endo', value: anthro.somatotype_endomorphy },
                      { label: 'Meso', value: anthro.somatotype_mesomorphy },
                      { label: 'Ecto', value: anthro.somatotype_ectomorphy },
                    ].map((s, i) => (
                      <div key={i} className="text-center p-2 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{s.label}</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{s.value?.toFixed(1) ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">{t('noAnthro')}</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'force-velocity' && (
        <FVSection athleteId={athleteId} language={language} noData={t('noFV')} />
      )}

      {activeSection === 'hydration' && (
        <HydrationSection athleteId={athleteId} language={language} noData={t('noHydration')} />
      )}

      {selected && (
        <EvalDetailModal eval={selected} onClose={() => setSelected(null)} t={t} sportLabel={sportLabel} language={language} />
      )}
    </div>
  );
}

function FVSection({ athleteId, language, noData }: { athleteId: string | null; language: string; noData: string }) {
  const [sessions, setSessions] = useState<{ session_date: string; f0_n: number | null; v0_ms: number | null; pmax_w: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) { setLoading(false); return; }
    supabase.from('fv_sessions').select('session_date, f0_n, v0_ms, pmax_w').eq('athlete_id', athleteId).eq('status', 'completed').order('session_date', { ascending: false }).limit(6).then(({ data }) => {
      setSessions(data || []);
      setLoading(false);
    });
  }, [athleteId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" /></div>;

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">{noData}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sessions.map((s, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
            {new Date(s.session_date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'F₀', value: s.f0_n ? s.f0_n.toFixed(0) : null, unit: 'N' },
              { label: 'V₀', value: s.v0_ms ? s.v0_ms.toFixed(2) : null, unit: 'm/s' },
              { label: 'Pmax', value: s.pmax_w ? s.pmax_w.toFixed(0) : null, unit: 'W' },
            ].map((m, j) => (
              <div key={j}>
                <p className="text-xs text-gray-400 mb-0.5">{m.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{m.value ?? '—'}</p>
                {m.value && <p className="text-xs text-gray-400">{m.unit}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function HydrationSection({ athleteId, language, noData }: { athleteId: string | null; language: string; noData: string }) {
  const [sessions, setSessions] = useState<{ session_date: string; sweat_rate_l_h: number | null; pre_weight_kg: number | null; post_weight_kg: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) { setLoading(false); return; }
    supabase.from('athlete_hydration_sessions').select('session_date, sweat_rate_l_h, pre_weight_kg, post_weight_kg').eq('athlete_id', athleteId).order('session_date', { ascending: false }).limit(6).then(({ data }) => {
      setSessions(data || []);
      setLoading(false);
    });
  }, [athleteId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" /></div>;

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-12 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">{noData}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sessions.map((s, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
            {new Date(s.session_date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: language === 'es' ? 'Tasa sudor' : 'Sweat Rate', value: s.sweat_rate_l_h ? s.sweat_rate_l_h.toFixed(2) : null, unit: 'L/h' },
              { label: language === 'es' ? 'Peso pre' : 'Pre-weight', value: s.pre_weight_kg ? s.pre_weight_kg.toFixed(1) : null, unit: 'kg' },
              { label: language === 'es' ? 'Peso post' : 'Post-weight', value: s.post_weight_kg ? s.post_weight_kg.toFixed(1) : null, unit: 'kg' },
            ].map((m, j) => (
              <div key={j}>
                <p className="text-xs text-gray-400 mb-0.5">{m.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{m.value ?? '—'}</p>
                {m.value && <p className="text-xs text-gray-400">{m.unit}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvalDetailModal({ eval: ev, onClose, t, sportLabel, language }: {
  eval: EvalSummary;
  onClose: () => void;
  t: (k: string) => string;
  sportLabel: (s: string) => string;
  language: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
              {t('detailTitle')}
            </p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {new Date(ev.testDate).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{sportLabel(ev.sport)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'VO₂max', value: ev.vo2max ? ev.vo2max.toFixed(1) : null, unit: 'ml/kg/min' },
              { label: 'LT1', value: ev.lt1_hr ? `${ev.lt1_hr}` : null, unit: t('bpm'), sub: ev.lt1_power ? `${ev.lt1_power} W` : null },
              { label: 'LT2', value: ev.lt2_hr ? `${ev.lt2_hr}` : null, unit: t('bpm'), sub: ev.lt2_power ? `${ev.lt2_power} W` : null },
              { label: 'HRmax', value: ev.hrmax ? `${ev.hrmax}` : null, unit: t('bpm') },
              { label: 'PAM', value: ev.pam_watts ? `${ev.pam_watts}` : null, unit: 'W' },
              { label: 'VAM', value: ev.vam_kmh ? ev.vam_kmh.toFixed(1) : null, unit: 'km/h' },
            ].filter(m => m.value).map((m, i) => (
              <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{m.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{m.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.unit}</p>
                {m.sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.sub}</p>}
              </div>
            ))}
          </div>

          {ev.training_zones && ev.training_zones.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">{t('zones')}</h3>
              <div className="space-y-2">
                {ev.training_zones.map((z, i) => {
                  const color = ZONE_COLORS[z.zone - 1] || '#6b7280';
                  const hrRange = z.hr_min && z.hr_max ? `${z.hr_min}–${z.hr_max} bpm` : null;
                  const pwrRange = z.power_min && z.power_max ? `${z.power_min}–${z.power_max} W` : null;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{z.name}</p>
                        {z.description && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{z.description}</p>}
                      </div>
                      <div className="text-right text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {[hrRange, pwrRange].filter(Boolean).map((r, j) => (
                          <p key={j} className="font-mono">{r}</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ev.coach_notes && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">{t('coachNotes')}</h3>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ev.coach_notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
