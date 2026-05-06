import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Athlete } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  HeatSessionInput,
  HeatSessionResults,
  HeatProfile,
  HeatHistoryEntry,
  computeTrend,
  getAdaptationBg,
} from '../../lib/heatAdaptation';
import { HydrationHistoryEntry } from '../../lib/hydration';
import { analyzeCoupling, CouplingAnalysis } from '../../lib/hydrationHeatCoupling';
import HeatAdaptationForm from './HeatAdaptationForm';
import HeatAdaptationResults from './HeatAdaptationResults';
import HeatAdaptationTrends from './HeatAdaptationTrends';
import HydrationHeatCouplingView from './HydrationHeatCoupling';
import Toast from '../Toast';

interface Props {
  athlete: Athlete;
}

interface ToastMsg {
  message: string;
  type: 'success' | 'error';
}

type Tab = 'new-session' | 'trends' | 'coupling';

export default function HeatAdaptationLab({ athlete }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('new-session');
  const [step, setStep] = useState<'form' | 'results'>('form');
  const [currentInput, setCurrentInput] = useState<HeatSessionInput | null>(null);
  const [currentResults, setCurrentResults] = useState<HeatSessionResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [profile, setProfile] = useState<HeatProfile | null>(null);
  const [hydrationHistory, setHydrationHistory] = useState<HydrationHistoryEntry[]>([]);
  const [couplingAnalysis, setCouplingAnalysis] = useState<CouplingAnalysis | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [athlete.id]);

  const loadAllData = async () => {
    try {
      setLoadingProfile(true);
      const [heatRes, hydrationRes] = await Promise.all([
        supabase.from('athlete_heat_profiles').select('*').eq('athlete_id', athlete.id).maybeSingle(),
        supabase.from('athlete_hydration_profiles').select('history').eq('athlete_id', athlete.id).maybeSingle(),
      ]);

      const heatProfile = heatRes.data ? { ...heatRes.data, history: heatRes.data.history || [] } : null;
      const hydHistory: HydrationHistoryEntry[] = hydrationRes.data?.history || [];

      setProfile(heatProfile);
      setHydrationHistory(hydHistory);

      if (heatProfile && heatProfile.history.length >= 1) {
        const analysis = analyzeCoupling(heatProfile.history, hydHistory);
        setCouplingAnalysis(analysis);
      }
    } catch {
      // silent
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCalculated = (input: HeatSessionInput, results: HeatSessionResults) => {
    setCurrentInput(input);
    setCurrentResults(results);
    setStep('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!currentInput || !currentResults) return;
    setSaving(true);

    try {
      const sessionPayload = {
        athlete_id: athlete.id,
        session_date: currentInput.sessionDate,
        temperature_c: currentInput.temperature_c,
        humidity_percent: currentInput.humidity_percent ?? null,
        sport: currentInput.sport,
        duration_min: currentInput.duration_min,
        avg_hr: currentInput.avgHR ?? null,
        hr_first_half: currentInput.hrFirstHalf ?? null,
        hr_second_half: currentInput.hrSecondHalf ?? null,
        external_load: currentInput.externalLoad ?? null,
        load_unit: currentInput.loadUnit,
        pre_weight_kg: currentInput.preWeight_kg ?? null,
        post_weight_kg: currentInput.postWeight_kg ?? null,
        fluid_intake_ml: currentInput.fluidIntake_mL ?? 0,
        percent_dehydration: currentResults.percentDehydration ?? null,
        sweat_rate_l_h: currentResults.sweatRate_L_h ?? null,
        rpe: currentInput.rpe ?? null,
        heat_cardiac_load: currentResults.heatCardiacLoad ?? null,
        hr_drift_percent: currentResults.hrDriftPercent ?? null,
        heat_adaptation_score: currentResults.heatAdaptationScore ?? null,
        notes: currentInput.notes ?? null,
      };

      const { error: sessionError } = await supabase
        .from('athlete_heat_sessions')
        .insert(sessionPayload);

      if (sessionError) throw sessionError;

      const newEntry: HeatHistoryEntry = {
        date: currentInput.sessionDate,
        temperature_c: currentInput.temperature_c,
        humidity_percent: currentInput.humidity_percent ?? null,
        avgHR: currentInput.avgHR ?? null,
        heatCardiacLoad: currentResults.heatCardiacLoad,
        hrDriftPercent: currentResults.hrDriftPercent,
        correctedDriftPercent: currentResults.correctedDriftPercent,
        rpe: currentInput.rpe ?? null,
        sweatRate_L_h: currentResults.sweatRate_L_h,
        percentDehydration: currentResults.percentDehydration,
        heatAdaptationScore: currentResults.heatAdaptationScore,
        adaptationClassification: currentResults.adaptationClassification,
      };

      const prevHistory: HeatHistoryEntry[] = profile?.history || [];
      const newHistory = [newEntry, ...prevHistory];

      const trends = computeTrend(newHistory);

      const allSweatRates = newHistory.filter(h => h.sweatRate_L_h !== null).map(h => h.sweatRate_L_h!);
      const avgSweat = allSweatRates.length > 0
        ? Math.round((allSweatRates.reduce((a, b) => a + b, 0) / allSweatRates.length) * 1000) / 1000
        : null;

      const baseline = newHistory[newHistory.length - 1];
      const latest = newHistory[0];

      const profilePayload = {
        athlete_id: athlete.id,
        total_sessions: newHistory.length,
        baseline_cardiac_load: baseline.heatCardiacLoad ?? profile?.baseline_cardiac_load ?? null,
        latest_cardiac_load: latest.heatCardiacLoad ?? null,
        cardiac_load_trend: trends.cardiacLoadTrend,
        baseline_hr_drift: baseline.hrDriftPercent ?? profile?.baseline_hr_drift ?? null,
        latest_hr_drift: latest.hrDriftPercent ?? null,
        hr_drift_trend: trends.hrDriftTrend,
        baseline_rpe: baseline.rpe ?? profile?.baseline_rpe ?? null,
        latest_rpe: latest.rpe ?? null,
        rpe_trend: trends.rpeTrend,
        avg_sweat_rate_l_h: avgSweat,
        latest_sweat_rate_l_h: latest.sweatRate_L_h ?? null,
        adaptation_score: currentResults.heatAdaptationScore ?? null,
        adaptation_classification: currentResults.adaptationClassification,
        last_session_date: currentInput.sessionDate,
        history: newHistory,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('athlete_heat_profiles')
        .upsert(profilePayload, { onConflict: 'athlete_id' });

      if (profileError) throw profileError;

      await loadAllData();
      setToast({ message: 'Heat session saved and adaptation profile updated.', type: 'success' });
      setStep('form');
      setCurrentInput(null);
      setCurrentResults(null);
      setTab('trends');
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to save session. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const tabClass = (t: Tab) =>
    `flex-1 py-3 text-sm font-semibold font-body transition-colors ${
      tab === t
        ? 'border-b-2 border-orange-500 text-orange-600 dark:text-orange-400'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
    }`;

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('heat.title')}</h2>
              <p className="text-orange-100 text-sm mt-0.5">{athlete.name}</p>
            </div>
          </div>
        </div>

        {!loadingProfile && profile && (
          <div className="px-6 py-4 bg-orange-50 dark:bg-orange-900/10 border-b border-orange-100 dark:border-orange-800/30">
            <div className="flex flex-wrap gap-4 text-sm items-center">
              <div>
                <span className="text-orange-600 dark:text-orange-400 font-medium">{t('heat.sessions')} </span>
                <span className="text-gray-700 dark:text-gray-300">{profile.total_sessions}</span>
              </div>
              {profile.latest_cardiac_load !== null && (
                <div>
                  <span className="text-orange-600 dark:text-orange-400 font-medium">{t('heat.latestCardiacLoad')} </span>
                  <span className="text-gray-700 dark:text-gray-300">{profile.latest_cardiac_load.toFixed(4)}</span>
                </div>
              )}
              {profile.latest_hr_drift !== null && (
                <div>
                  <span className="text-orange-600 dark:text-orange-400 font-medium">{t('heat.latestHrDrift')} </span>
                  <span className="text-gray-700 dark:text-gray-300">{profile.latest_hr_drift.toFixed(1)}%</span>
                </div>
              )}
              {profile.adaptation_score !== null && (
                <div>
                  <span className="text-orange-600 dark:text-orange-400 font-medium">{t('heat.adaptationScore')} </span>
                  <span className="text-gray-700 dark:text-gray-300">{profile.adaptation_score.toFixed(1)}/100</span>
                </div>
              )}
              {profile.adaptation_classification && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold font-body ${getAdaptationBg(profile.adaptation_classification)}`}>
                  {profile.adaptation_classification}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button onClick={() => { setTab('new-session'); setStep('form'); }} className={tabClass('new-session')}>
              {t('heat.newSession')}
            </button>
            <button onClick={() => setTab('trends')} className={tabClass('trends')}>
              {t('heat.adaptationTrends')} {profile && profile.total_sessions > 0 ? `(${profile.total_sessions})` : ''}
            </button>
            <button onClick={() => setTab('coupling')} className={tabClass('coupling')}>
              {t('heat.hydrationCoupling')}
            </button>
          </div>
        </div>

        <div className="p-6">
          {tab === 'new-session' && (
            step === 'form' ? (
              <HeatAdaptationForm onCalculated={handleCalculated} />
            ) : (
              currentInput && currentResults && (
                <HeatAdaptationResults
                  input={currentInput}
                  results={currentResults}
                  onSave={handleSave}
                  onReset={() => { setStep('form'); setCurrentInput(null); setCurrentResults(null); }}
                  saving={saving}
                />
              )
            )
          )}

          {tab === 'trends' && (
            loadingProfile ? (
              <div className="text-center py-8 text-gray-400 font-body text-sm">{t('heat.loading')}</div>
            ) : profile && profile.history.length > 0 ? (
              <HeatAdaptationTrends history={profile.history} />
            ) : (
              <EmptyState onAction={() => setTab('new-session')} />
            )
          )}

          {tab === 'coupling' && (
            loadingProfile ? (
              <div className="text-center py-8 text-gray-400 font-body text-sm">{t('heat.loading')}</div>
            ) : couplingAnalysis ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-body mb-1">Hydration ↔ HR Drift Stability Analysis</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-body">
                    Cross-references heat sessions with hydration history to identify whether HR drift is driven by dehydration or limited aerobic capacity.
                    {hydrationHistory.length === 0 && (
                      <span className="text-yellow-600 dark:text-yellow-400"> — No hydration sessions found. Add sessions in Hydration Lab to enrich this analysis.</span>
                    )}
                  </p>
                </div>
                <HydrationHeatCouplingView analysis={couplingAnalysis} />
              </div>
            ) : (
              <EmptyState onAction={() => setTab('new-session')} />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <p className="text-gray-500 dark:text-gray-400 font-body text-sm">{t('heat.noSessions')}</p>
      <p className="text-gray-400 dark:text-gray-500 font-body text-xs mt-1">{t('heat.noSessionsDesc')}</p>
      <button
        onClick={onAction}
        className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors font-body"
      >
        {t('heat.recordFirst')}
      </button>
    </div>
  );
}
