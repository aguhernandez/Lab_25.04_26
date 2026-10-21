import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Athlete } from '../../types';
import { fetchHubCoachAthletes, isHubLinkingEnabled, syncHubAthletesToLocal } from '../../lib/hubLink';
import { getDefaultCoachId } from '../../lib/auth';

interface AthleteSummary {
  id: string;
  name: string;
  sport: string;
  hub_user_id: string | null;
  latestTestDate: string | null;
  latestStatus: string | null;
  hasInProgressTest: boolean;
  completedTests: number;
  vo2max: number | null;
  lt2_hr: number | null;
}

type StatusFilter = 'all' | 'no-test' | 'in-progress' | 'completed' | 'old';

export default function CoachDashboard({ onViewAthlete }: { onViewAthlete?: (athlete: Athlete) => void }) {
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const [athletes, setAthletes] = useState<AthleteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const es = language === 'es';

  useEffect(() => {
    if (profile) void loadData();
  }, [profile]);

  async function loadData() {
    setLoading(true);
    try {
      const coachHubId = user?.id || profile?.hub_user_id;
      let athleteList: Array<{ id: string; name: string; sport: string; hub_user_id?: string | null }> = [];
      if (coachHubId) {
        const { data } = await supabase.rpc('get_athletes_by_coach_hub_id', { coach_hub_id: coachHubId });
        athleteList = data || [];
      } else if (profile) {
        const { data } = await supabase.from('athletes').select('id, name, sport, hub_user_id').eq('coach_id', profile.id).order('name');
        athleteList = data || [];
      }

      if (!athleteList.length && isHubLinkingEnabled() && coachHubId) {
        const hubAthletes = await fetchHubCoachAthletes(coachHubId);
        if (hubAthletes.length) {
          await syncHubAthletesToLocal(hubAthletes, profile?.id || await getDefaultCoachId());
          const { data } = await supabase.rpc('get_athletes_by_coach_hub_id', { coach_hub_id: coachHubId });
          athleteList = data || [];
        }
      }
      if (!athleteList.length) { setAthletes([]); return; }

      // Preserve the existing Hub synchronization behavior when the coach already has local rows.
      if (isHubLinkingEnabled() && coachHubId) {
        const hubAthletes = await fetchHubCoachAthletes(coachHubId);
        if (hubAthletes.length) {
          await syncHubAthletesToLocal(hubAthletes, profile?.id || await getDefaultCoachId());
          const { data } = await supabase.rpc('get_athletes_by_coach_hub_id', { coach_hub_id: coachHubId });
          if (data) athleteList = data;
        }
      }

      const ids = athleteList.map(a => a.id);
      const [testsRes, resultsRes, linksRes] = await Promise.all([
        supabase.from('tests').select('id, athlete_id, test_date, status').in('athlete_id', ids).order('test_date', { ascending: false }),
        supabase.from('test_results').select('test_id, vo2max, lt2_hr'),
        supabase.from('athletes').select('id, hub_user_id').in('id', ids),
      ]);
      const tests = testsRes.data || [];
      const results = resultsRes.data || [];
      const links = new Map((linksRes.data || []).map(a => [a.id, a.hub_user_id]));
      setAthletes(athleteList.map(a => {
        const ownTests = tests.filter(t => t.athlete_id === a.id);
        const latest = ownTests[0];
        const completed = ownTests.filter(t => t.status === 'completed');
        const latestCompleted = completed[0];
        const result = latestCompleted ? results.find(r => r.test_id === latestCompleted.id) : null;
        return {
          id: a.id,
          name: a.name,
          sport: a.sport,
          hub_user_id: a.hub_user_id ?? links.get(a.id) ?? null,
          latestTestDate: latest?.test_date ?? null,
          latestStatus: latest?.status ?? null,
          hasInProgressTest: ownTests.some(t => t.status === 'in_progress'),
          completedTests: completed.length,
          vo2max: result?.vo2max ?? null,
          lt2_hr: result?.lt2_hr ?? null,
        };
      }));
    } catch (error) {
      console.error('Failed to load coach dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => athletes.filter(a => {
    const matches = `${a.name} ${a.sport}`.toLowerCase().includes(query.trim().toLowerCase());
    const ageDays = a.latestTestDate ? (Date.now() - new Date(a.latestTestDate).getTime()) / 86400000 : null;
    const statusMatch = filter === 'all'
      || (filter === 'no-test' && a.completedTests === 0 && !a.hasInProgressTest)
      || (filter === 'in-progress' && a.hasInProgressTest)
      || (filter === 'completed' && a.completedTests > 0)
      || (filter === 'old' && ageDays !== null && ageDays > 60);
    return matches && statusMatch;
  }), [athletes, query, filter]);

  const statusLabel = (a: AthleteSummary) => {
    if (a.hasInProgressTest) return es ? 'Test en curso o incompleto' : 'Test in progress or incomplete';
    if (a.completedTests > 0) return es ? 'Test completado' : 'Test completed';
    return es ? 'Sin test' : 'No test';
  };
  const statusStyle = (a: AthleteSummary) => a.hasInProgressTest
    ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
    : a.completedTests > 0
      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  if (loading) return <div className="flex justify-center py-24"><div className="w-6 h-6 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" /></div>;

  const filters: Array<{ id: StatusFilter; label: string }> = [
    { id: 'all', label: es ? 'Todos' : 'All' },
    { id: 'no-test', label: es ? 'Sin test' : 'No test' },
    { id: 'in-progress', label: es ? 'En curso o incompleto' : 'In progress or incomplete' },
    { id: 'completed', label: es ? 'Completado' : 'Completed' },
    { id: 'old', label: es ? 'Antigüedad > 60 días' : 'Last test > 60 days' },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{es ? 'Vista profesional' : 'Professional view'}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{es ? 'Atletas' : 'Athletes'}</h1>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} / {athletes.length}</span>
      </header>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <label className="relative block w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={es ? 'Buscar atleta o deporte' : 'Search athlete or sport'} className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#fdda36]" />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label={es ? 'Filtrar atletas' : 'Filter athletes'}>
          {filters.map(item => <button key={item.id} onClick={() => setFilter(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === item.id ? 'bg-[#514163] text-white dark:bg-[#fdda36] dark:text-[#514163]' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{item.label}</button>)}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">{es ? 'Atleta' : 'Athlete'}</th>
                <th className="px-4 py-3">{es ? 'Estado del test' : 'Test status'}</th>
                <th className="px-4 py-3">{es ? 'Último test' : 'Last test'}</th>
                <th className="px-4 py-3 text-right">VO₂max</th>
                <th className="px-4 py-3 text-right">LT2 (lpm)</th>
                <th className="px-4 py-3">Hub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(a => {
                const days = a.latestTestDate ? Math.floor((Date.now() - new Date(a.latestTestDate).getTime()) / 86400000) : null;
                const athlete: Athlete = { id: a.id, name: a.name, sport: a.sport as Athlete['sport'], hub_user_id: a.hub_user_id, created_at: '', updated_at: '' };
                return <tr key={a.id} onClick={() => onViewAthlete?.(athlete)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-3"><span className="font-medium text-sm text-gray-900 dark:text-white">{a.name}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{a.sport}</span></td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(a)}`}>{statusLabel(a)}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{a.latestTestDate ? <><time dateTime={a.latestTestDate}>{new Date(a.latestTestDate).toLocaleDateString(es ? 'es-ES' : 'en-US')}</time><span className="ml-2 text-xs text-gray-500">{es ? `hace ${days} días` : `${days} days ago`}</span></> : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-gray-900 dark:text-white">{a.vo2max != null ? `${a.vo2max.toFixed(1)} ml/kg/min` : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sm text-gray-900 dark:text-white">{a.lt2_hr != null ? a.lt2_hr : '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs ${a.hub_user_id ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>{a.hub_user_id ? (es ? 'Vinculado' : 'Linked') : (es ? 'No vinculado' : 'Not linked')}</span></td>
                </tr>;
              })}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500">{athletes.length ? (es ? 'No hay atletas que coincidan con el filtro.' : 'No athletes match this filter.') : (es ? 'Aún no hay atletas asignados.' : 'No athletes assigned yet.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
