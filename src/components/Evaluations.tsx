import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ClipboardList, ChevronRight, Calendar } from 'lucide-react';

interface Test {
  id: string;
  athlete_id: string;
  test_date: string;
  test_type: string;
  status: string;
  created_at: string;
  athletes: {
    name: string;
    sport?: string;
  } | null;
}

interface EvaluationsProps {
  onViewResults: (testId: string) => void;
}

export default function Evaluations({ onViewResults }: EvaluationsProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTests();
  }, [profile]);

  const fetchTests = async () => {
    try {
      let athleteIds: string[] | null = null;

      const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
      if (effectiveRole === 'coach') {
        // Use SECURITY DEFINER RPC to bypass any anon grant issues
        if (profile?.hub_user_id) {
          const { data: rpcIds } = await supabase
            .rpc('get_athlete_ids_by_coach_hub_id', { coach_hub_id: profile.hub_user_id });
          if (rpcIds && rpcIds.length > 0) {
            athleteIds = rpcIds.map((r: { id: string }) => r.id);
          }
        }
        // Fallback: direct query by coach_id
        if (!athleteIds && profile?.id) {
          const { data: coachAthletes } = await supabase
            .from('athletes')
            .select('id')
            .eq('coach_id', profile.id);
          athleteIds = (coachAthletes || []).map((a: { id: string }) => a.id);
        }
        if (!athleteIds || athleteIds.length === 0) {
          setTests([]);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from('tests')
        .select(`
          id,
          athlete_id,
          test_date,
          test_type,
          status,
          created_at,
          athletes (
            name,
            sport,
            coach_id
          )
        `)
        .order('test_date', { ascending: false });

      if (athleteIds !== null) {
        query = query.in('athlete_id', athleteIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTests((data as any) || []);
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTests = tests.filter(test =>
    !search || test.athletes?.name?.toLowerCase().includes(search.toLowerCase()) ||
    test.test_type?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    in_progress: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    pending: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
  };

  const testTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      vo2max: 'VO₂max',
      lactate: 'Lactate',
      ramp: 'Ramp Test',
      incremental: 'Incremental',
    };
    return map[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
            {t('evaluations.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filteredTests.length} evaluation{filteredTests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search athlete or type..."
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 w-full sm:w-64"
        />
      </div>

      {filteredTests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-7 h-7 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('evaluations.noEvaluations')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start by creating a new evaluation in the Lab
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((test) => (
            <div
              key={test.id}
              onClick={() => onViewResults(test.id)}
              className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-white/80" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">
                    {test.athletes?.name || t('evaluations.unknown')}
                  </h3>
                  {test.athletes?.sport && (
                    <p className="text-xs text-white/60 capitalize">{test.athletes.sport}</p>
                  )}
                </div>
              </div>

              <div className="p-5">
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                    {testTypeLabel(test.test_type)}
                  </span>
                  {test.status && (
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${statusColors[test.status] || statusColors.pending}`}>
                      {test.status.replace('_', ' ')}
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{new Date(test.test_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end text-sm font-semibold text-slate-600 dark:text-[#fdda36] group-hover:gap-1 transition-all">
                  View Results
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
