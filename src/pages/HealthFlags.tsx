import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Athlete } from '../types';
import { HealthFlag, FlagStatus } from '../lib/biochemistry';
import AthleteSelector from '../components/AthleteSelector';

export default function HealthFlags() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const isAthlete = profile?.role === 'athlete';
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [flags, setFlags] = useState<HealthFlag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAthlete && profile?.hub_user_id) {
      supabase
        .from('athletes')
        .select('*')
        .eq('hub_user_id', profile.hub_user_id)
        .maybeSingle()
        .then(({ data: a }) => { if (a) setSelectedAthlete(a as Athlete); });
    }
  }, [isAthlete, profile]);

  useEffect(() => {
    if (selectedAthlete) loadFlags(selectedAthlete.id);
  }, [selectedAthlete?.id]);

  const loadFlags = async (athleteId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('biochemical_tests')
      .select('health_flags, test_date')
      .eq('athlete_id', athleteId)
      .order('test_date', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && Array.isArray(data[0].health_flags)) {
      setFlags(data[0].health_flags as HealthFlag[]);
    } else {
      setFlags([]);
    }
    setLoading(false);
  };

  const statusConfig: Record<FlagStatus, { labelKey: string; color: string; bg: string }> = {
    green: { labelKey: 'healthFlags.normal', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    yellow: { labelKey: 'healthFlags.monitor', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    red: { labelKey: 'healthFlags.attention', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  };

  if (!isAthlete && !selectedAthlete) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{t('healthFlags.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('healthFlags.subtitle')}</p>
        </div>
        <AthleteSelector onSelectAthlete={setSelectedAthlete} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">{t('healthFlags.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('healthFlags.subtitle')}</p>
        </div>
        {!isAthlete && selectedAthlete && (
          <button
            onClick={() => setSelectedAthlete(null)}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          >
            {t('bio.changeAthlete')}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {(['green', 'yellow', 'red'] as FlagStatus[]).map(status => {
              const count = flags.filter(f => f.status === status).length;
              const cfg = statusConfig[status];
              return (
                <div key={status} className={`rounded-xl border p-4 ${cfg.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${cfg.color}`}>{t(cfg.labelKey)}</span>
                    <span className={`text-2xl font-bold ${cfg.color}`}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {flags.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{t('healthFlags.fromBiochemical')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{selectedAthlete?.name}</p>
              <div className="space-y-2">
                {flags.map(flag => (
                  <div
                    key={flag.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      flag.status === 'red'
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                        : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      flag.status === 'red' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(flag.markerLabelKey)}: {flag.value} {flag.unit}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(flag.domainLabelKey)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      flag.status === 'red'
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    }`}>
                      {t(statusConfig[flag.status].labelKey)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('healthFlags.noFlags')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('healthFlags.noFlagsDesc')}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
