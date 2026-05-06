import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete } from '../types';
import AthleteSelector from '../components/AthleteSelector';
import { useLanguage } from '../contexts/LanguageContext';
import FVDataInput from '../components/forceVelocity/FVDataInput';
import FVCurveChart from '../components/forceVelocity/FVCurveChart';
import FVMetricsPanel from '../components/forceVelocity/FVMetricsPanel';
import FVRepTable from '../components/forceVelocity/FVRepTable';
import FVLoadRecommendations from '../components/forceVelocity/FVLoadRecommendations';
import {
  FVRepResult,
  FVProfile,
  computeFVProfile,
  COMMON_EXERCISES,
} from '../lib/forceVelocity';

type Step = 'select-athlete' | 'setup' | 'data';

interface SavedSession {
  id: string;
  session_date: string;
  exercise: string;
  f0: number | null;
  v0: number | null;
  pmax: number | null;
  r_squared: number | null;
}

export default function ForceVelocityLab() {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>('select-athlete');
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [exercise, setExercise] = useState('Back Squat');
  const [customExercise, setCustomExercise] = useState('');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [reps, setReps] = useState<FVRepResult[]>([]);
  const [profile, setProfile] = useState<FVProfile | null>(null);
  const [previousProfile, setPreviousProfile] = useState<FVProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<SavedSession[]>([]);
  const [activeTab, setActiveTab] = useState<'curve' | 'recommendations' | 'reps' | 'history'>('curve');

  const exerciseName = exercise === 'Other' ? customExercise : exercise;
  const validReps = reps.filter(r => r.is_valid);

  useEffect(() => {
    if (validReps.length >= 2) {
      const bodyMass = athlete?.weight_kg ?? 75;
      const computed = computeFVProfile(reps, bodyMass);
      setProfile(computed);
    } else {
      setProfile(null);
    }
  }, [reps, athlete]);

  useEffect(() => {
    if (athlete) loadPastSessions(athlete.id);
  }, [athlete]);

  const loadPastSessions = async (athleteId: string) => {
    const { data } = await supabase
      .from('fv_sessions')
      .select('id, session_date, exercise, f0, v0, pmax, r_squared')
      .eq('athlete_id', athleteId)
      .order('session_date', { ascending: false })
      .limit(10);
    setPastSessions(data || []);
  };

  const loadSessionForComparison = async (sessionId: string) => {
    const { data: repsData } = await supabase
      .from('fv_repetitions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_valid', true);

    if (!repsData || repsData.length < 2) return;

    const bodyMass = athlete?.weight_kg ?? 75;
    const prevReps: FVRepResult[] = repsData.map(r => ({
      load_kg: r.load_kg,
      set_number: r.set_number,
      rep_number: r.rep_number,
      mean_velocity_ms: r.mean_velocity_ms,
      peak_velocity_ms: r.peak_velocity_ms,
      mean_force_n: r.mean_force_n,
      peak_force_n: r.peak_force_n,
      mean_power_w: r.mean_power_w,
      peak_power_w: r.peak_power_w,
      displacement_m: r.displacement_m,
      duration_s: r.duration_s,
      data_source: r.data_source,
      is_valid: r.is_valid,
      validation_note: r.validation_note,
    }));

    setPreviousProfile(computeFVProfile(prevReps, bodyMass));
    setActiveTab('curve');
  };

  const handleSaveSession = async () => {
    if (!athlete || !profile) return;
    setSaving(true);
    try {
      const { data: session, error: sessionError } = await supabase
        .from('fv_sessions')
        .insert({
          athlete_id: athlete.id,
          session_date: sessionDate,
          exercise: exerciseName,
          notes: notes || null,
          f0: profile.f0,
          v0: profile.v0,
          pmax: profile.pmax,
          fv_slope: profile.slope,
          r_squared: profile.r_squared,
          body_mass_kg: athlete.weight_kg ?? null,
        })
        .select('id')
        .single();

      if (sessionError || !session) throw sessionError;

      const repRows = reps.map(r => ({
        session_id: session.id,
        set_number: r.set_number,
        rep_number: r.rep_number,
        load_kg: r.load_kg,
        mean_velocity_ms: r.mean_velocity_ms,
        peak_velocity_ms: r.peak_velocity_ms,
        mean_force_n: r.mean_force_n,
        peak_force_n: r.peak_force_n,
        mean_power_w: r.mean_power_w,
        peak_power_w: r.peak_power_w,
        displacement_m: r.displacement_m,
        duration_s: r.duration_s,
        data_source: r.data_source,
        is_valid: r.is_valid,
        validation_note: r.validation_note,
      }));

      await supabase.from('fv_repetitions').insert(repRows);

      setSavedSessionId(session.id);
      setSaved(true);
      await loadPastSessions(athlete.id);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (!reps.length) return;
    const headers = ['set', 'rep', 'load_kg', 'mean_velocity_ms', 'peak_velocity_ms', 'mean_force_n', 'peak_force_n', 'mean_power_w', 'peak_power_w', 'displacement_m', 'duration_s', 'is_valid'];
    const rows = reps.map(r => [
      r.set_number, r.rep_number, r.load_kg,
      r.mean_velocity_ms, r.peak_velocity_ms,
      r.mean_force_n, r.peak_force_n,
      r.mean_power_w, r.peak_power_w,
      r.displacement_m, r.duration_s, r.is_valid
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fv_${athlete?.name}_${exerciseName}_${sessionDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (step === 'select-athlete') {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg p-2.5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-heading font-bold text-white">{t('fv.title')}</h1>
                <p className="text-xs text-white/70 mt-0.5">{t('fv.subtitle')}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: t('fv.f0v0Profile'), desc: t('fv.f0v0Desc') },
                { label: t('fv.pmaxCalc'), desc: t('fv.pmaxDesc') },
                { label: t('fv.loadRec'), desc: t('fv.loadRecDesc') },
              ].map(card => (
                <div key={card.label} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{card.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('fv.selectAthlete')}</p>
            <AthleteSelector
              onSelectAthlete={(a) => { setAthlete(a); setStep('setup'); }}
              onCreateNew={() => {}}
            />
          </div>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{t('fv.sessionSetup')}</h2>
                <p className="text-xs text-white/70">{athlete?.name}</p>
              </div>
              <button onClick={() => setStep('select-athlete')} className="text-white/60 hover:text-white text-sm">
                {t('fv.changeAthlete')}
              </button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('fv.exercise')}</label>
              <select
                value={exercise}
                onChange={e => setExercise(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COMMON_EXERCISES.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
              {exercise === 'Other' && (
                <input
                  type="text"
                  placeholder={t('fv.exerciseName')}
                  value={customExercise}
                  onChange={e => setCustomExercise(e.target.value)}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('fv.sessionDate')}</label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('fv.notesOptional')}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder={t('fv.notesPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {athlete?.weight_kg ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {t('fv.bodyMassFound')} <strong>{athlete.weight_kg} kg</strong> {t('fv.bodyMassUsed')}
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t('fv.bodyMassDefault')}
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('data')}
              disabled={exercise === 'Other' && !customExercise.trim()}
              className="w-full py-3 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl font-semibold hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              {t('fv.startDataEntry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-white">{exerciseName} — F-V Profile</h2>
              <p className="text-xs text-white/70">{athlete?.name} · {sessionDate}</p>
            </div>
            <button
              onClick={() => setStep('setup')}
              className="px-3 py-1.5 text-xs bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition-colors"
            >
              {t('fv.changeSetup')}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('fv.dataEntry')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('fv.dataEntryDesc')}
          </p>
          <FVDataInput
            bodyMassKg={athlete?.weight_kg ?? 75}
            onRepsUpdated={setReps}
          />
        </div>
      </div>

      {reps.length > 0 && validReps.length < 2 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {t('fv.needMoreReps')}
          </p>
        </div>
      )}

      {profile && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 px-2">
              <div className="flex gap-0 overflow-x-auto">
                {([
                  { id: 'curve' as const, label: t('fv.tabCurve') },
                  { id: 'recommendations' as const, label: t('fv.tabRec') },
                  { id: 'reps' as const, label: t('fv.tabReps') },
                  { id: 'history' as const, label: t('fv.tabHistory') },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                      activeTab === tab.id
                        ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                        : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {activeTab === 'curve' && (
                <div className="space-y-6">
                  <FVMetricsPanel profile={profile} previousProfile={previousProfile} />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Force-Velocity Curve</h3>
                      <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                      </button>
                    </div>
                    <FVCurveChart profile={profile} reps={reps} previousProfile={previousProfile} />
                  </div>
                </div>
              )}

              {activeTab === 'recommendations' && (
                <FVLoadRecommendations
                  profile={profile}
                  bodyMassKg={athlete?.weight_kg ?? 75}
                  exercise={exerciseName}
                />
              )}

              {activeTab === 'reps' && (
                <FVRepTable reps={reps} />
              )}

              {activeTab === 'history' && (
                <div className="space-y-3">
                  {pastSessions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('fv.noPrevSessions')}</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('fv.clickSession')}</p>
                      <div className="space-y-2">
                        {pastSessions.filter(s => s.id !== savedSessionId).map(s => (
                          <button
                            key={s.id}
                            onClick={() => loadSessionForComparison(s.id)}
                            className="w-full text-left flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{s.exercise}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{s.session_date}</p>
                            </div>
                            <div className="text-right text-xs text-gray-600 dark:text-gray-300 space-y-0.5">
                              {s.f0 && <p>F0: {s.f0.toFixed(0)} N</p>}
                              {s.v0 && <p>V0: {s.v0.toFixed(3)} m/s</p>}
                              {s.pmax && <p>Pmax: {s.pmax.toFixed(0)} W</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pb-4">
            {!saved ? (
              <button
                onClick={handleSaveSession}
                disabled={saving}
                className="w-full py-4 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-2xl font-semibold text-base hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {saving ? t('fv.saving') : t('fv.save')}
              </button>
            ) : (
              <div className="flex items-center gap-2 justify-center py-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">{t('fv.saved')}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
