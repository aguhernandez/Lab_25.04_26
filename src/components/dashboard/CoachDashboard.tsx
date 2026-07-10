import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Athlete } from '../../types';

interface AthleteSummary {
  id: string;
  name: string;
  sport: string;
  vo2max?: number | null;
  lt2_hr?: number | null;
  testCount: number;
  daysWithoutTest?: number;
  lastTestDate?: string;
  bodyFat?: number | null;
  muscleMass?: number | null;
  bmi?: number | null;
  hasAnthro: boolean;
  readiness?: number | null;
  limitingFactor?: string | null;
}

interface MonthlyActivity {
  month: string;
  tests: number;
}

interface CoachDashboardProps {
  onViewAthlete?: (athlete: Athlete) => void;
}

export default function CoachDashboard({ onViewAthlete }: CoachDashboardProps) {
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyActivity[]>([]);
  const [totalTests, setTotalTests] = useState(0);
  const [labCounts, setLabCounts] = useState({ anthropometry: 0, hydration: 0, neuromuscular: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'physiology' | 'anthropometry'>('physiology');

  const tr: Record<string, Record<string, string>> = {
    coachLabel: { en: 'Coach View', es: 'Vista Entrenador' },
    athleteOverview: { en: 'Athlete Overview', es: 'Estado del Plantel' },
    labActivity: { en: 'Lab Activity', es: 'Actividad del Lab' },
    totalAthletes: { en: 'Athletes', es: 'Atletas' },
    totalTests: { en: 'Evaluations', es: 'Evaluaciones' },
    recentTests: { en: 'Last 30 days', es: 'Últimos 30 días' },
    noAthletes: { en: 'No athletes assigned to you yet.', es: 'Aún no tenés atletas asignados.' },
    vo2max: { en: 'VO₂max', es: 'VO₂max' },
    lt2: { en: 'LT2', es: 'LT2' },
    bpm: { en: 'bpm', es: 'lpm' },
    noEval: { en: 'Never', es: 'Sin eval.' },
    name: { en: 'Athlete', es: 'Atleta' },
    lastEval: { en: 'Last Eval.', es: 'Últ. Eval.' },
    evals: { en: 'evals', es: 'evals' },
    tests: { en: 'Tests', es: 'Tests' },
    sport: { en: 'Sport', es: 'Deporte' },
    cycling: { en: 'Cycling', es: 'Ciclismo' },
    running: { en: 'Running', es: 'Carrera' },
    triathlon: { en: 'Triathlon', es: 'Triatlón' },
    swimming: { en: 'Swimming', es: 'Natación' },
    overdueTitle: { en: 'Overdue Evaluations', es: 'Evaluaciones Vencidas' },
    noAlerts: { en: 'All athletes evaluated recently', es: 'Todos los atletas evaluados recientemente' },
    physiology: { en: 'Physiology', es: 'Fisiología' },
    anthropometry: { en: 'Anthropometry', es: 'Antropometría' },
    bodyFat: { en: 'Body Fat', es: 'Grasa Corp.' },
    muscle: { en: 'Muscle', es: 'Músculo' },
    bmi: { en: 'BMI', es: 'IMC' },
    noAnthro: { en: '—', es: '—' },
    kg: { en: 'kg', es: 'kg' },
  };

  const t = (key: string) => tr[key]?.[language] ?? tr[key]?.en ?? key;

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile]);

  async function loadData() {
    setLoading(true);
    try {
      const coachHubId = user?.id || profile?.hub_user_id;
      let athleteList: { id: string; name: string; sport: string }[] | null = null;

      if (coachHubId) {
        const { data } = await supabase
          .rpc('get_athletes_by_coach_hub_id', { coach_hub_id: coachHubId });
        athleteList = data || [];
      } else {
        const { data } = await supabase
          .from('athletes')
          .select('id, name, sport')
          .eq('coach_id', profile!.id)
          .order('name');
        athleteList = data || [];
      }

      if (!athleteList || athleteList.length === 0) {
        setLoading(false);
        return;
      }

      const athleteIds = athleteList.map(a => a.id);

      const [testsRes, resultsRes, anthroRes, hydrationCountRes, fvCountRes, readinessRes] = await Promise.all([
        supabase
          .from('tests')
          .select('id, athlete_id, test_date, status')
          .in('athlete_id', athleteIds)
          .eq('status', 'completed')
          .order('test_date', { ascending: false }),
        supabase
          .from('test_results')
          .select('test_id, vo2max, lt2_hr'),
        supabase
          .from('athlete_anthropometry_profiles')
          .select('athlete_id, body_fat_percent, muscle_mass_kg, bmi')
          .in('athlete_id', athleteIds),
        supabase
          .from('hydration_sessions')
          .select('id', { count: 'exact', head: true })
          .in('athlete_id', athleteIds),
        supabase
          .from('fv_sessions')
          .select('id', { count: 'exact', head: true })
          .in('athlete_id', athleteIds),
        supabase
          .from('athlete_readiness_snapshots')
          .select('athlete_id, global_readiness, limiting_factor')
          .in('athlete_id', athleteIds)
          .order('computed_at', { ascending: false }),
      ]);

      const allTests = testsRes.data || [];
      const allResults = resultsRes.data || [];
      const allAnthro = anthroRes.data || [];
      const allReadiness = readinessRes.data || [];
      setTotalTests(allTests.length);
      setLabCounts({
        anthropometry: allAnthro.length,
        hydration: hydrationCountRes.count || 0,
        neuromuscular: fvCountRes.count || 0,
      });

      const now = Date.now();
      const summaries: AthleteSummary[] = athleteList.map(athlete => {
        const athleteTests = allTests.filter(test => test.athlete_id === athlete.id);
        const lastTest = athleteTests[0];
        const lastResult = lastTest ? allResults.find(r => r.test_id === lastTest.id) : null;
        const daysWithoutTest = lastTest
          ? Math.floor((now - new Date(lastTest.test_date).getTime()) / 86400000)
          : undefined;
        const anthro = allAnthro.find(a => a.athlete_id === athlete.id);
        const latestReadiness = allReadiness.find(r => r.athlete_id === athlete.id);

        return {
          id: athlete.id,
          name: athlete.name,
          sport: athlete.sport,
          testCount: athleteTests.length,
          vo2max: lastResult?.vo2max ?? null,
          lt2_hr: lastResult?.lt2_hr ?? null,
          daysWithoutTest,
          lastTestDate: lastTest?.test_date ?? undefined,
          bodyFat: anthro?.body_fat_percent ?? null,
          muscleMass: anthro?.muscle_mass_kg ?? null,
          bmi: anthro?.bmi ?? null,
          hasAnthro: !!anthro,
          readiness: latestReadiness?.global_readiness ?? null,
          limitingFactor: latestReadiness?.limiting_factor ?? null,
        };
      });

      setAthletes(summaries);

      const monthCounts: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { month: 'short' });
        monthCounts[key] = 0;
      }
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      for (const test of allTests) {
        const d = new Date(test.test_date);
        if (d >= sixMonthsAgo) {
          const key = d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { month: 'short' });
          if (key in monthCounts) monthCounts[key]++;
        }
      }
      setMonthlyData(Object.entries(monthCounts).map(([month, tests]) => ({ month, tests })));
    } catch { }
    finally { setLoading(false); }
  }

  const recentTests = athletes.filter(a => a.daysWithoutTest !== undefined && a.daysWithoutTest <= 30).length;
  const overdueAthletes = athletes.filter(a => a.daysWithoutTest !== undefined && a.daysWithoutTest > 60);

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
            {t('coachLabel')}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {profile?.full_name || profile?.email}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('totalAthletes'), value: athletes.length, sub: language === 'es' ? 'atletas asignados' : 'assigned athletes' },
          { label: t('totalTests'), value: totalTests, sub: language === 'es' ? 'evaluaciones totales' : 'total evaluations' },
          { label: t('recentTests'), value: recentTests, sub: language === 'es' ? 'evaluados recientemente' : 'evaluated recently' },
          { label: t('overdueTitle'), value: overdueAthletes.length, sub: language === 'es' ? '+60 días sin evaluación' : '+60 days without eval', alert: overdueAthletes.length > 0 },
        ].map((card, i) => (
          <div key={i} className={`rounded-2xl p-4 ${card.alert && card.value > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${card.alert && card.value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {card.label}
            </p>
            <p className={`text-3xl font-bold ${card.alert && card.value > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'}`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Lab Evaluations Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: language === 'es' ? 'Lab Metabólico' : 'Metabolic Lab', value: totalTests },
          { label: language === 'es' ? 'Antropometría' : 'Anthropometry', value: labCounts.anthropometry },
          { label: language === 'es' ? 'Hidratación' : 'Hydration & Heat', value: labCounts.hydration },
          { label: language === 'es' ? 'Neuromuscular' : 'Neuromuscular', value: labCounts.neuromuscular },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Athlete Readiness Comparison */}
      {athletes.some(a => a.readiness != null) && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            {language === 'es' ? 'Disposición del Plantel' : 'Team Readiness'}
          </h2>
          <div className="space-y-2">
            {athletes
              .filter(a => a.readiness != null)
              .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
              .map(a => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-28 truncate">{a.name}</span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (a.readiness ?? 0) >= 75 ? 'bg-green-500' : (a.readiness ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${a.readiness ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-900 dark:text-white w-8 text-right">{a.readiness}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              {t('athleteOverview')}
            </h2>
            <div className="flex gap-1">
              {(['physiology', 'anthropometry'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${activeTab === tab
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                >
                  {t(tab)}
                </button>
              ))}
            </div>
          </div>
          {athletes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50 dark:border-gray-700/50">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-5 py-3">{t('name')}</th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-3 hidden sm:table-cell">{t('sport')}</th>
                    {activeTab === 'physiology' ? (
                      <>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-3">{t('vo2max')}</th>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-3 hidden md:table-cell">{t('lt2')}</th>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-5 py-3">{t('lastEval')}</th>
                      </>
                    ) : (
                      <>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-3">{t('bodyFat')}</th>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-3 hidden md:table-cell">{t('muscle')}</th>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-5 py-3">{t('bmi')}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {athletes.map(athlete => {
                    const overdue = athlete.daysWithoutTest !== undefined && athlete.daysWithoutTest > 60;
                    const clickable = !!onViewAthlete;
                    return (
                      <tr
                        key={athlete.id}
                        onClick={clickable ? () => onViewAthlete!({ id: athlete.id, name: athlete.name, sport: athlete.sport as any, created_at: '', updated_at: '' }) : undefined}
                        className={`transition-colors ${overdue && activeTab === 'physiology' ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/20'} ${clickable ? 'cursor-pointer' : ''}`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                {athlete.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className={`text-sm font-medium leading-tight ${clickable ? 'text-[#514163] dark:text-[#fdda36] hover:underline' : 'text-gray-900 dark:text-white'}`}>{athlete.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{athlete.testCount} {t('evals')}{athlete.lastTestDate ? ` · ${new Date(athlete.lastTestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 hidden sm:table-cell">
                          <span className="text-xs text-gray-500 dark:text-gray-400">{sportLabel(athlete.sport)}</span>
                        </td>
                        {activeTab === 'physiology' ? (
                          <>
                            <td className="px-3 py-3.5 text-right">
                              {athlete.vo2max ? (
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{athlete.vo2max.toFixed(1)}</span>
                              ) : (
                                <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 text-right hidden md:table-cell">
                              {athlete.lt2_hr ? (
                                <span className="text-sm text-gray-600 dark:text-gray-400">{athlete.lt2_hr} <span className="text-xs text-gray-400">{t('bpm')}</span></span>
                              ) : (
                                <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {athlete.daysWithoutTest !== undefined ? (
                                <span className={`text-xs font-medium ${overdue ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                  {athlete.daysWithoutTest}d
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600">{t('noEval')}</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-3.5 text-right">
                              {athlete.bodyFat ? (
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">{athlete.bodyFat.toFixed(1)}%</span>
                              ) : (
                                <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5 text-right hidden md:table-cell">
                              {athlete.muscleMass ? (
                                <span className="text-sm text-gray-600 dark:text-gray-400">{athlete.muscleMass.toFixed(1)} <span className="text-xs text-gray-400">{t('kg')}</span></span>
                              ) : (
                                <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {athlete.bmi ? (
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{athlete.bmi.toFixed(1)}</span>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-300 dark:text-gray-600">{t('noAthletes')}</div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            {t('labActivity')}
          </h2>
          {monthlyData.some(m => m.tests > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} cursor={{ fill: 'rgba(253,218,54,0.1)' }} />
                <Bar dataKey="tests" fill="#fdda36" radius={[4, 4, 0, 0]} name={t('tests')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">—</div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700/50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
              {t('overdueTitle')}
            </h3>
            {overdueAthletes.length > 0 ? (
              <div className="space-y-2">
                {overdueAthletes.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{a.name}</span>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0 ml-2">
                      {a.daysWithoutTest}d
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('noAlerts')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
