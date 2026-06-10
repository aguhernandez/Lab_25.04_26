import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

interface AdminStats {
  totalAthletes: number;
  totalTests: number;
  testsThisMonth: number;
  testsLastMonth: number;
  anthropometryCount: number;
  hydrationCount: number;
  fvCount: number;
  coachCount: number;
}

interface MonthlyData {
  month: string;
  tests: number;
}

interface SportDist {
  name: string;
  value: number;
}

interface RecentTest {
  id: string;
  test_date: string;
  sport: string;
  athlete_id: string;
  athleteName?: string;
}

const SPORT_COLORS: Record<string, string> = {
  cycling: '#3b82f6',
  running: '#22c55e',
  triathlon: '#f97316',
  swimming: '#06b6d4',
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [stats, setStats] = useState<AdminStats>({ totalAthletes: 0, totalTests: 0, testsThisMonth: 0, testsLastMonth: 0, anthropometryCount: 0, hydrationCount: 0, fvCount: 0, coachCount: 0 });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [sportDist, setSportDist] = useState<SportDist[]>([]);
  const [recentTests, setRecentTests] = useState<RecentTest[]>([]);
  const [readinessDist, setReadinessDist] = useState<{ green: number; yellow: number; red: number }>({ green: 0, yellow: 0, red: 0 });
  const [loading, setLoading] = useState(true);

  const tr: Record<string, Record<string, string>> = {
    adminLabel: { en: 'Admin View', es: 'Vista Administrador' },
    overview: { en: 'Lab Overview', es: 'Visión General del Lab' },
    totalAthletes: { en: 'Athletes', es: 'Atletas' },
    totalTests: { en: 'Evaluations', es: 'Evaluaciones' },
    thisMonth: { en: 'This Month', es: 'Este Mes' },
    growth: { en: 'vs. last month', es: 'vs. mes anterior' },
    evalPerMonth: { en: 'Evaluations per Month', es: 'Evaluaciones por Mes' },
    sportDist: { en: 'Sport Distribution', es: 'Distribución por Deporte' },
    recentActivity: { en: 'Recent Lab Activity', es: 'Actividad Reciente del Lab' },
    cycling: { en: 'Cycling', es: 'Ciclismo' },
    running: { en: 'Running', es: 'Carrera' },
    triathlon: { en: 'Triathlon', es: 'Triatlón' },
    swimming: { en: 'Swimming', es: 'Natación' },
    tests: { en: 'Tests', es: 'Tests' },
    noData: { en: 'No data', es: 'Sin datos' },
    utilization: { en: 'Lab Utilization', es: 'Utilización del Lab' },
    avgPerAthlete: { en: 'Avg. evals / athlete', es: 'Evaluaciones / atleta promedio' },
  };

  const t = (key: string) => tr[key]?.[language] ?? tr[key]?.en ?? key;

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile]);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      const [athletesRes, testsCountRes, thisMonthRes, lastMonthRes, recentRes, athleteNamesRes, anthroCountRes, hydrationCountRes, fvCountRes, coachCountRes] = await Promise.all([
        supabase.from('athletes').select('id, sport'),
        supabase.from('tests').select('id', { count: 'exact', head: true }),
        supabase.from('tests').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
        supabase.from('tests').select('id', { count: 'exact', head: true }).gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth),
        supabase.from('tests').select('id, test_date, sport, athlete_id').eq('status', 'completed').order('test_date', { ascending: false }).limit(8),
        supabase.from('athletes').select('id, name'),
        supabase.from('anthropometry_measurements').select('id', { count: 'exact', head: true }),
        supabase.from('hydration_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('force_velocity_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach'),
      ]);

      setStats({
        totalAthletes: athletesRes.data?.length || 0,
        totalTests: testsCountRes.count || 0,
        testsThisMonth: thisMonthRes.count || 0,
        testsLastMonth: lastMonthRes.count || 0,
        anthropometryCount: anthroCountRes.count || 0,
        hydrationCount: hydrationCountRes.count || 0,
        fvCount: fvCountRes.count || 0,
        coachCount: coachCountRes.count || 0,
      });

      const sportCounts: Record<string, number> = { cycling: 0, running: 0, triathlon: 0, swimming: 0 };
      for (const a of athletesRes.data || []) {
        if (a.sport in sportCounts) sportCounts[a.sport]++;
      }
      setSportDist(
        Object.entries(sportCounts)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name: t(name), value }))
      );

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      const monthCounts: Record<string, number> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { month: 'short', year: '2-digit' });
        monthCounts[key] = 0;
      }
      const { data: allTestsForMonths } = await supabase
        .from('tests')
        .select('test_date')
        .gte('test_date', sixMonthsAgo.toISOString().split('T')[0]);

      for (const test of allTestsForMonths || []) {
        const d = new Date(test.test_date);
        const key = d.toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { month: 'short', year: '2-digit' });
        if (key in monthCounts) monthCounts[key]++;
      }
      setMonthlyData(Object.entries(monthCounts).map(([month, tests]) => ({ month, tests })));

      const athleteMap = Object.fromEntries((athleteNamesRes.data || []).map(a => [a.id, a.name]));
      setRecentTests((recentRes.data || []).map(test => ({ ...test, athleteName: athleteMap[test.athlete_id] })));

      // Load readiness distribution
      const { data: readinessData } = await supabase
        .from('athlete_readiness_snapshots')
        .select('athlete_id, global_readiness')
        .order('computed_at', { ascending: false });
      if (readinessData) {
        const seen = new Set<string>();
        let green = 0, yellow = 0, red = 0;
        for (const r of readinessData) {
          if (seen.has(r.athlete_id)) continue;
          seen.add(r.athlete_id);
          if (r.global_readiness >= 75) green++;
          else if (r.global_readiness >= 50) yellow++;
          else red++;
        }
        setReadinessDist({ green, yellow, red });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const avgEvalsPerAthlete = stats.totalAthletes > 0 ? (stats.totalTests / stats.totalAthletes).toFixed(1) : '—';
  const growthPct = stats.testsLastMonth > 0
    ? Math.round(((stats.testsThisMonth - stats.testsLastMonth) / stats.testsLastMonth) * 100)
    : null;

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
            {t('adminLabel')}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('overview')}</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('totalAthletes'), value: stats.totalAthletes, sub: language === 'es' ? 'registrados' : 'registered' },
          { label: t('totalTests'), value: stats.totalTests, sub: language === 'es' ? 'evaluaciones totales' : 'total evaluations' },
          { label: t('thisMonth'), value: stats.testsThisMonth, sub: growthPct !== null ? `${growthPct > 0 ? '+' : ''}${growthPct}% ${t('growth')}` : t('growth') },
          { label: t('utilization'), value: avgEvalsPerAthlete, sub: t('avgPerAthlete') },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Lab Section Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Anthropometry', value: stats.anthropometryCount, icon: '📏' },
          { label: 'Metabolic', value: stats.totalTests, icon: '🧪' },
          { label: 'Hydration & Heat', value: stats.hydrationCount, icon: '💧' },
          { label: 'Neuromuscular', value: stats.fvCount, icon: '⚡' },
          { label: language === 'es' ? 'Entrenadores' : 'Coaches', value: stats.coachCount, icon: '👤' },
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Population Readiness Distribution */}
      {(readinessDist.green + readinessDist.yellow + readinessDist.red) > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            {language === 'es' ? 'Distribución de Disposición' : 'Readiness Distribution'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center border border-green-200 dark:border-green-800">
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{readinessDist.green}</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">{language === 'es' ? 'Óptimo (75+)' : 'Optimal (75+)'}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center border border-amber-200 dark:border-amber-800">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{readinessDist.yellow}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{language === 'es' ? 'Monitorear (50-74)' : 'Monitor (50-74)'}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center border border-red-200 dark:border-red-800">
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{readinessDist.red}</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">{language === 'es' ? 'Atención (<50)' : 'Attention (<50)'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            {t('evalPerMonth')}
          </h2>
          {monthlyData.some(m => m.tests > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} cursor={{ fill: 'rgba(253,218,54,0.08)' }} />
                <Bar dataKey="tests" fill="#fdda36" radius={[4, 4, 0, 0]} name={t('tests')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">{t('noData')}</div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-4">
            {t('sportDist')}
          </h2>
          {sportDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sportDist} cx="50%" cy="45%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value">
                  {sportDist.map((entry, index) => {
                    const colorMap: Record<string, string> = {
                      [t('cycling')]: SPORT_COLORS.cycling,
                      [t('running')]: SPORT_COLORS.running,
                      [t('triathlon')]: SPORT_COLORS.triathlon,
                      [t('swimming')]: SPORT_COLORS.swimming,
                    };
                    return <Cell key={index} fill={colorMap[entry.name] || '#6b7280'} />;
                  })}
                </Pie>
                <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-gray-300 dark:text-gray-600">{t('noData')}</div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700/50">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            {t('recentActivity')}
          </h2>
        </div>
        {recentTests.length > 0 ? (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {recentTests.map(test => (
              <div key={test.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: SPORT_COLORS[test.sport] || '#6b7280' }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{test.athleteName || '—'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{sportLabel(test.sport)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {new Date(test.test_date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-300 dark:text-gray-600">{t('noData')}</div>
        )}
      </div>
    </div>
  );
}
