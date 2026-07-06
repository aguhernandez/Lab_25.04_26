import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Athlete } from '../types';
import AthleteSelector from '../components/AthleteSelector';
import ReadinessEngine from '../components/engine/ReadinessEngine';

interface PhysiologyProfileProps {
  preselectedAthlete?: Athlete | null;
}

interface ProfileData {
  bodyComposition: { bodyFat?: number | null; muscleMass?: number | null; weight?: number | null } | null;
  aerobic: { vo2max?: number | null; lt1_hr?: number | null; lt2_hr?: number | null; hrmax?: number | null } | null;
  neuromuscular: { hasData: boolean } | null;
  hydration: { sweatRate?: number | null; lastSession?: string | null } | null;
  biochemical: { globalScore?: number | null; testDate?: string | null; flagCount?: number } | null;
}

function ProfileCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function AthletePhysiologyProfile({ preselectedAthlete }: PhysiologyProfileProps) {
  const { profile } = useAuth();
  const isAthlete = profile?.role === 'athlete';
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(preselectedAthlete ?? null);
  const [data, setData] = useState<ProfileData>({ bodyComposition: null, aerobic: null, neuromuscular: null, hydration: null, biochemical: null });
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
    if (selectedAthlete) loadData(selectedAthlete.id);
  }, [selectedAthlete?.id]);

  const loadData = async (athleteId: string) => {
    setLoading(true);
    try {
      const [anthroRes, physioRes, fvRes, hydRes, bioRes] = await Promise.all([
        supabase.from('athlete_anthropometry_profiles').select('body_fat_percent, muscle_mass_kg, weight_kg').eq('athlete_id', athleteId).maybeSingle(),
        supabase.from('athlete_physiology_profiles').select('vo2max_relative_ml_kg_min, lt1_hr, lt2_hr, hrmax').eq('athlete_id', athleteId).maybeSingle(),
        supabase.from('fv_sessions').select('id').eq('athlete_id', athleteId).limit(1),
        supabase.from('hydration_sessions').select('sweat_rate_l_h, session_date').eq('athlete_id', athleteId).order('session_date', { ascending: false }).limit(1),
        supabase.from('biochemical_tests').select('global_score, test_date, health_flags').eq('athlete_id', athleteId).order('test_date', { ascending: false }).limit(1),
      ]);

      setData({
        bodyComposition: anthroRes.data ? { bodyFat: anthroRes.data.body_fat_percent, muscleMass: anthroRes.data.muscle_mass_kg, weight: anthroRes.data.weight_kg } : null,
        aerobic: physioRes.data ? { vo2max: physioRes.data.vo2max_relative_ml_kg_min, lt1_hr: physioRes.data.lt1_hr, lt2_hr: physioRes.data.lt2_hr, hrmax: physioRes.data.hrmax } : null,
        neuromuscular: { hasData: !!(fvRes.data && fvRes.data.length > 0) },
        hydration: hydRes.data && hydRes.data.length > 0 ? { sweatRate: hydRes.data[0].sweat_rate_l_h, lastSession: hydRes.data[0].session_date } : null,
        biochemical: bioRes.data && bioRes.data.length > 0 ? { globalScore: bioRes.data[0].global_score, testDate: bioRes.data[0].test_date, flagCount: Array.isArray(bioRes.data[0].health_flags) ? bioRes.data[0].health_flags.length : 0 } : null,
      });
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAthlete && !selectedAthlete) {
    return <AthleteSelector onSelectAthlete={setSelectedAthlete} />;
  }

  if (!selectedAthlete) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
      </div>
    );
  }

  const MetricValue = ({ value, unit, label }: { value: string | number | null | undefined; unit?: string; label: string }) => (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white">
        {value != null ? <>{value} <span className="text-sm font-normal text-gray-500">{unit}</span></> : <span className="text-gray-300 dark:text-gray-600">--</span>}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">Physiology Profile</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedAthlete.name}</p>
        </div>
        {!isAthlete && (
          <button
            onClick={() => setSelectedAthlete(null)}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          >
            Change Athlete
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
        <ReadinessEngine athleteId={selectedAthlete.id} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProfileCard title="Body Composition" icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}>
            <div className="grid grid-cols-2 gap-4">
              <MetricValue label="Body Fat" value={data.bodyComposition?.bodyFat?.toFixed(1)} unit="%" />
              <MetricValue label="Muscle Mass" value={data.bodyComposition?.muscleMass?.toFixed(1)} unit="kg" />
              <MetricValue label="Weight" value={data.bodyComposition?.weight?.toFixed(1)} unit="kg" />
            </div>
          </ProfileCard>

          <ProfileCard title="Aerobic System" icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}>
            <div className="grid grid-cols-2 gap-4">
              <MetricValue label="VO2max" value={data.aerobic?.vo2max?.toFixed(1)} unit="ml/kg/min" />
              <MetricValue label="HRmax" value={data.aerobic?.hrmax} unit="bpm" />
              <MetricValue label="LT1" value={data.aerobic?.lt1_hr} unit="bpm" />
              <MetricValue label="LT2" value={data.aerobic?.lt2_hr} unit="bpm" />
            </div>
          </ProfileCard>

          <ProfileCard title="Neuromuscular System" icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {data.neuromuscular?.hasData ? (
                <p className="text-green-600 dark:text-green-400 font-medium">F-V data available</p>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">No assessments yet</p>
              )}
            </div>
          </ProfileCard>

          <ProfileCard title="Recovery System" icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}>
            <div className="text-sm text-gray-400 dark:text-gray-500">
              <p>No data yet</p>
            </div>
          </ProfileCard>

          <ProfileCard title="Hydration & Thermoregulation" icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}>
            <div className="grid grid-cols-2 gap-4">
              <MetricValue label="Sweat Rate" value={data.hydration?.sweatRate?.toFixed(2)} unit="L/h" />
              <MetricValue label="Last Session" value={data.hydration?.lastSession ? new Date(data.hydration.lastSession).toLocaleDateString() : null} />
            </div>
          </ProfileCard>

          <ProfileCard title="Biochemical Status" icon={<svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}>
            {data.biochemical ? (
              <div className="grid grid-cols-2 gap-4">
                <MetricValue label="Global Score" value={data.biochemical.globalScore?.toFixed(0)} unit="/100" />
                <MetricValue label="Flags" value={data.biochemical.flagCount} unit="" />
                <MetricValue label="Last Test" value={data.biochemical.testDate ? new Date(data.biochemical.testDate).toLocaleDateString() : null} />
              </div>
            ) : (
              <div className="text-sm text-gray-400 dark:text-gray-500">
                <p>No data yet</p>
              </div>
            )}
          </ProfileCard>
        </div>
        </>
      )}
    </div>
  );
}
