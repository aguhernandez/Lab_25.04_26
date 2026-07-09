import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Athlete, Sport, TestType } from '../../types';
import { LabSession, LAB_TEST_TYPES } from '../../lib/labSession';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
}

const SPORT_ICONS: Record<string, string> = {
  cycling: '🚴',
  running: '🏃',
  triathlon: '🏊',
  swimming: '🌊',
};
const SPORT_KEYS = ['cycling', 'running', 'triathlon', 'swimming'] as const;

export default function LabPhaseSelection({ session, onUpdate, onNext }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isAthleteRole = profile?.role === 'athlete';

  useEffect(() => {
    loadAthletes();
  }, []);

  const loadAthletes = async () => {
    try {
      const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
      let query = supabase.from('athletes').select('*').order('name', { ascending: true });
      if (effectiveRole === 'athlete' && profile?.hub_user_id) {
        query = query.eq('hub_user_id', profile.hub_user_id);
      } else if (effectiveRole === 'coach' && profile?.id) {
        query = query.eq('coach_id', profile.id);
      }
      const { data } = await query;
      const list = data || [];
      setAthletes(list);
      // Auto-select the single athlete when logged in as athlete role
      if (effectiveRole === 'athlete' && list.length === 1 && !session.athlete) {
        onUpdate({ athlete: list[0], sport: list[0].sport });
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = athletes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const canProceed = session.athlete !== null && session.testType !== null && session.sport !== null;

  const selectAthlete = (a: Athlete) => {
    onUpdate({ athlete: a, sport: a.sport });
  };

  const selectTestType = (t: TestType) => {
    onUpdate({ testType: t });
  };

  const selectSport = (s: Sport) => {
    onUpdate({ sport: s });
  };


  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('lab.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400">{t('lab.subtitle')}</p>
      </div>

      {isAthleteRole ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 px-6 py-5">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('lab.loadingAthletes')}
            </div>
          ) : session.athlete ? (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-sm flex-shrink-0">
                {session.athlete.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{session.athlete.name}</div>
                <div className="text-xs text-gray-400 capitalize mt-0.5">{session.athlete.sport}</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t('lab.step1')}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">{t('lab.noAthletes')}</div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('lab.step1')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">To add a new athlete, go to the Athletes section first.</p>
          </div>
          <div className="p-6">
            <input
              type="text"
              placeholder={t('lab.searchAthletes')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 mb-4 text-sm"
            />
            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">{t('lab.loadingAthletes')}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {filtered.map(a => (
                  <button
                    key={a.id}
                    onClick={() => selectAthlete(a)}
                    className={`text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      session.athlete?.id === a.id
                        ? 'border-slate-700 bg-slate-50 dark:bg-slate-700/40'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/30'
                    }`}
                  >
                    <div className="font-semibold text-sm text-gray-900 dark:text-white">{a.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">{a.sport}</div>
                  </button>
                ))}
                {filtered.length === 0 && !loading && (
                  <div className="col-span-3 text-center py-8 text-gray-400 text-sm">
                    {t('lab.noAthletes')} — create athletes in the Athletes section.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {session.athlete && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('lab.step2')}</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SPORT_KEYS.map(sportKey => (
                <button
                  key={sportKey}
                  onClick={() => selectSport(sportKey as Sport)}
                  className={`py-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    session.sport === sportKey
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/30'
                  }`}
                >
                  <span className="text-2xl">{SPORT_ICONS[sportKey]}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{t(`lab.sport.${sportKey}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {session.athlete && session.sport && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('lab.step3')}</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {LAB_TEST_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => selectTestType(t.value)}
                className={`text-left px-5 py-4 rounded-xl border-2 transition-all ${
                  session.testType === t.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/30'
                }`}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <svg className={`w-5 h-5 ${session.testType === t.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                  </svg>
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">{t.label}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.description}</p>
              </button>
            ))}
          </div>

          {(session.testType === 'ramp' || session.testType === 'step') && (
            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('lab.numStages')}</label>
                  <input
                    type="number"
                    min={1} max={20}
                    value={session.numStages}
                    onChange={e => {
                      const n = parseInt(e.target.value) || 1;
                      onUpdate({ numStages: n, customStageDurations: Array(n).fill(session.stageDurationSeconds) });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('lab.typicalStages')}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{t('lab.stageDuration')}</label>
                  <input
                    type="number"
                    min={30} max={600} step={30}
                    value={session.stageDurationSeconds}
                    onChange={e => {
                      const d = parseInt(e.target.value) || 180;
                      onUpdate({ stageDurationSeconds: d, customStageDurations: Array(session.numStages).fill(d) });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('lab.typicalDuration')}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => onUpdate({ includeCooldown: !session.includeCooldown })}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      session.includeCooldown ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {session.includeCooldown && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('lab.includeCooldown')}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => onUpdate({ customProtocol: !session.customProtocol })}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                      session.customProtocol ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {session.customProtocol && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('lab.customProtocol')}</span>
                </label>
              </div>

              {session.customProtocol && (
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{t('lab.durationPerStage')}</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {Array.from({ length: session.numStages }).map((_, i) => (
                      <div key={i}>
                        <label className="block text-[10px] text-gray-400 mb-1 text-center">S{i + 1}</label>
                        <input
                          type="number"
                          min={10} max={3600} step={10}
                          value={session.customStageDurations[i] ?? session.stageDurationSeconds}
                          onChange={e => {
                            const durations = session.customStageDurations.length === session.numStages
                              ? [...session.customStageDurations]
                              : Array(session.numStages).fill(session.stageDurationSeconds);
                            durations[i] = parseInt(e.target.value) || session.stageDurationSeconds;
                            onUpdate({ customStageDurations: durations });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{t('lab.partialTip')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {canProceed && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 px-6 py-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => onUpdate({ skipPretest: !session.skipPretest })}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                session.skipPretest ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {session.skipPretest && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{t('lab.skipPretest')}</span>
              <p className="text-xs text-gray-400 mt-0.5">{t('lab.skipPretestDesc')}</p>
            </div>
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all shadow-sm ${
            canProceed
              ? 'bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          {t('lab.startSession')}
        </button>
      </div>
    </div>
  );
}
