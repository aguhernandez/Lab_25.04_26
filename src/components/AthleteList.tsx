import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Athlete } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, RefreshCw, ChevronRight, Trash2 } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { fetchHubCoachAthletes, isHubLinkingEnabled, syncHubAthletesToLocal } from '../lib/hubLink';
import { getDefaultCoachId } from '../lib/auth';

interface AthleteListProps {
  onViewAthlete: (athlete: Athlete) => void;
}

export default function AthleteList({ onViewAthlete }: AthleteListProps) {
  const { t } = useLanguage();
  const { profile, user } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Athlete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isCoach = profile?.role === 'coach' || profile?.role === 'trainer';

  useEffect(() => {
    loadAthletes();
  }, [profile, user]);

  const loadAthletes = async () => {
    try {
      setLoading(true);
      setError(null);

      const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;

      // Step 1: load local athletes filtered by coach using SECURITY DEFINER RPC
      // (bypasses anon RLS restrictions that would block coach-scoped queries)
      let localData: Athlete[];
      if (effectiveRole === 'coach') {
        const coachHubId = user?.id || profile?.hub_user_id;
        if (coachHubId) {
          const { data, error: rpcError } = await supabase
            .rpc('get_athletes_by_coach_hub_id', { coach_hub_id: coachHubId });
          if (rpcError) throw rpcError;
          localData = data || [];
        } else if (profile?.id) {
          const { data, error: qErr } = await supabase
            .from('athletes').select('*').eq('coach_id', profile.id).order('name', { ascending: true });
          if (qErr) throw qErr;
          localData = data || [];
        } else {
          localData = [];
        }
      } else {
        const { data, error: qErr } = await supabase
          .from('athletes').select('*').order('name', { ascending: true });
        if (qErr) throw qErr;
        localData = data || [];
      }

      let merged: Athlete[] = localData;

      // Step 2: for coaches, pull their Hub athlete roster and auto-provision missing local records
      if (effectiveRole === 'coach' && isHubLinkingEnabled()) {
        const coachHubId = user?.id || profile?.hub_user_id;
        if (coachHubId) {
          const hubAthletes = await fetchHubCoachAthletes(coachHubId);

          if (hubAthletes.length > 0) {
            const assignedCoachId = profile?.id || await getDefaultCoachId();
            await syncHubAthletesToLocal(hubAthletes, assignedCoachId);

            // Re-query to get the full, up-to-date list after sync
            const coachHubId2 = user?.id || profile?.hub_user_id;
            if (coachHubId2) {
              const { data: refreshed } = await supabase
                .rpc('get_athletes_by_coach_hub_id', { coach_hub_id: coachHubId2 });
              if (refreshed) merged = refreshed;
            } else if (profile?.id) {
              const { data: refreshed } = await supabase
                .from('athletes')
                .select('*')
                .eq('coach_id', profile.id)
                .order('name', { ascending: true });
              if (refreshed) merged = refreshed;
            }

          }
        }
      }

      setAthletes(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load athletes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAthlete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from('athletes').delete().eq('id', deleteTarget.id);
      setAthletes(prev => prev.filter(a => a.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const getSportLabel = (sport: string) => {
    if (sport === 'other') return 'Otros';
    const keys = ['cycling', 'running', 'triathlon', 'swimming'];
    if (keys.includes(sport)) return t(`athletes.sport.${sport}`);
    return sport;
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const sportColors: Record<string, string> = {
    cycling: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    running: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    triathlon: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    swimming: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800',
    other: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-8 border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 mb-4">{t('athletes.error')}: {error}</p>
        <button
          onClick={loadAthletes}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          {t('athletes.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
            {t('athletes.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {athletes.length} {athletes.length !== 1 ? t('athletes.athletes') : t('athletes.athlete')}
          </p>
        </div>
        <button
          onClick={loadAthletes}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-600 dark:text-gray-400"
        >
          <RefreshCw className="w-4 h-4" />
          {t('athletes.refresh')}
        </button>
      </div>

      {athletes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('athletes.notFound')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('athletes.notFoundDesc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {athletes.map((athlete) => {
            const age = calculateAge(athlete.date_of_birth);
            const sportClass = sportColors[athlete.sport] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600';
            return (
              <div
                key={athlete.id}
                onClick={() => onViewAthlete(athlete)}
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="px-5 py-4 flex items-center gap-3 relative" style={{ background: 'linear-gradient(135deg, #514163 0%, #6b5580 100%)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(253,218,54,0.18)' }}>
                    <Users className="w-5 h-5" style={{ color: '#fdda36' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white truncate">{athlete.name}</h3>
                    {age && <p className="text-xs" style={{ color: 'rgba(253,218,54,0.75)' }}>{age} {t('athletes.years')}</p>}
                  </div>
                  {(isAdmin || isCoach) && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(athlete); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/30 text-white/60 hover:text-red-300"
                      title={t('athletes.delete') || 'Delete athlete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${sportClass}`}>
                      {getSportLabel(athlete.sport)}
                    </span>
                    {athlete.sex && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                        {athlete.sex.charAt(0).toUpperCase() + athlete.sex.slice(1)}
                      </span>
                    )}
                    {athlete.hub_user_id && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        HUB
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {athlete.weight_kg ? (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">Weight</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{athlete.weight_kg}</p>
                        <p className="text-[10px] text-gray-400">kg</p>
                      </div>
                    ) : <div />}
                    {athlete.height_cm ? (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">Height</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{athlete.height_cm}</p>
                        <p className="text-[10px] text-gray-400">cm</p>
                      </div>
                    ) : <div />}
                    {athlete.body_fat_percent ? (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">Body Fat</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{athlete.body_fat_percent}</p>
                        <p className="text-[10px] text-gray-400">%</p>
                      </div>
                    ) : <div />}
                  </div>

                  <div className="flex items-center justify-end text-sm font-semibold transition-all" style={{ color: '#514163' }}>
                    {t('athletes.viewProfile')}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('athletes.deleteTitle') || 'Delete Athlete'}
        message={deleteTarget ? `${t('athletes.deleteConfirm') || 'Are you sure you want to permanently delete'} ${deleteTarget.name}? ${t('athletes.deleteWarning') || 'This action cannot be undone.'}` : ''}
        confirmLabel={deleting ? (t('athletes.deleting') || 'Deleting...') : (t('athletes.confirmDelete') || 'Delete')}
        cancelLabel={t('athletes.cancel') || 'Cancel'}
        onConfirm={handleDeleteAthlete}
        onCancel={() => setDeleteTarget(null)}
        isDanger
      />
    </div>
  );
}
