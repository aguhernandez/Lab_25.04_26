import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  computeReadiness,
  ReadinessResult,
  EngineInputs,
  DomainState,
  DomainStatus,
  TrendDirection,
} from '../../lib/physiologyEngine';

interface ReadinessEngineProps {
  athleteId: string;
}

function ScoreRing({ score, status, size = 80 }: { score: number; status: DomainStatus; size?: number }) {
  const colors: Record<DomainStatus, string> = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444' };
  const strokeWidth = size > 60 ? 6 : 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-200 dark:text-gray-700" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors[status]} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute font-bold" style={{ color: colors[status], fontSize: size > 60 ? 20 : 14 }}>
        {score}
      </span>
    </div>
  );
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  const config: Record<TrendDirection, { arrow: string; color: string }> = {
    improving: { arrow: '\u2191', color: 'text-green-500' },
    stable: { arrow: '\u2192', color: 'text-blue-500' },
    declining: { arrow: '\u2193', color: 'text-red-500' },
  };
  const c = config[direction];
  return <span className={`text-lg font-bold ${c.color}`}>{c.arrow}</span>;
}

function DomainCard({ domain, labelKey, t }: { domain: DomainState; labelKey: string; t: (k: string) => string }) {
  if (domain.score === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">{t(labelKey)}</h4>
        <p className="text-xs text-gray-400 dark:text-gray-500">{t('engine.noData')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-900 dark:text-white">{t(labelKey)}</h4>
        <TrendArrow direction={domain.trend} />
      </div>
      <div className="flex items-center gap-3">
        <ScoreRing score={domain.score} status={domain.status} size={52} />
        <p className="text-[11px] text-gray-500 dark:text-gray-400 flex-1">{t(domain.interpretationKey)}</p>
      </div>
    </div>
  );
}

export default function ReadinessEngine({ athleteId }: ReadinessEngineProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [result, setResult] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAndCompute();
  }, [athleteId]);

  const loadAndCompute = async () => {
    setLoading(true);

    // Gather inputs from all existing lab tables
    const [physioRes, fvRes, bioRes, hydRes, anthroRes, historyRes] = await Promise.all([
      supabase.from('athlete_physiology_profiles')
        .select('vo2max_relative_ml_kg_min, lt1_hr, lt2_hr, hrmax')
        .eq('athlete_id', athleteId).maybeSingle(),
      supabase.from('force_velocity_sessions')
        .select('f0_n_kg, v0_m_s, pmax_w_kg')
        .eq('athlete_id', athleteId)
        .order('session_date', { ascending: false }).limit(1),
      supabase.from('biochemical_tests')
        .select('oxygen_transport, recovery, hormonal, nutrition')
        .eq('athlete_id', athleteId)
        .order('test_date', { ascending: false }).limit(1),
      supabase.from('hydration_sessions')
        .select('sweat_rate_l_h, usg_pre, body_mass_change_pct, temperature_c, humidity_pct')
        .eq('athlete_id', athleteId)
        .order('session_date', { ascending: false }).limit(1),
      supabase.from('athlete_anthropometry_profiles')
        .select('body_fat_percent, muscle_mass_kg, weight_kg')
        .eq('athlete_id', athleteId).maybeSingle(),
      supabase.from('athlete_readiness_snapshots')
        .select('aerobic_score, neuromuscular_score, biological_health_score, hydration_stress_score')
        .eq('athlete_id', athleteId)
        .order('computed_at', { ascending: true })
        .limit(10),
    ]);

    const inputs: EngineInputs = {
      aerobic: {
        vo2max: physioRes.data?.vo2max_relative_ml_kg_min ?? null,
        lt1_hr: physioRes.data?.lt1_hr ?? null,
        lt2_hr: physioRes.data?.lt2_hr ?? null,
        hrmax: physioRes.data?.hrmax ?? null,
      },
      neuromuscular: {
        f0: fvRes.data?.[0]?.f0_n_kg ?? null,
        v0: fvRes.data?.[0]?.v0_m_s ?? null,
        pmax: fvRes.data?.[0]?.pmax_w_kg ?? null,
      },
      biological: extractBiologicalInputs(bioRes.data?.[0]),
      hydration: {
        usg: hydRes.data?.[0]?.usg_pre ?? null,
        body_mass_change_pct: hydRes.data?.[0]?.body_mass_change_pct ?? null,
        sweat_rate_l_h: hydRes.data?.[0]?.sweat_rate_l_h ?? null,
        temperature: hydRes.data?.[0]?.temperature_c ?? null,
        humidity: hydRes.data?.[0]?.humidity_pct ?? null,
      },
      anthropometric: {
        body_fat_pct: anthroRes.data?.body_fat_percent ?? null,
        ffm_kg: anthroRes.data?.muscle_mass_kg ?? null,
        total_mass_kg: anthroRes.data?.weight_kg ?? null,
        fat_mass_kg: null,
      },
    };

    // Build history from snapshots
    const snapshots = historyRes.data || [];
    const history = {
      aerobic: snapshots.map(s => s.aerobic_score).filter((v): v is number => v != null),
      neuromuscular: snapshots.map(s => s.neuromuscular_score).filter((v): v is number => v != null),
      biological: snapshots.map(s => s.biological_health_score).filter((v): v is number => v != null),
      hydration: snapshots.map(s => s.hydration_stress_score).filter((v): v is number => v != null),
    };

    const readiness = computeReadiness(inputs, history);
    setResult(readiness);

    // Save snapshot for future trend analysis
    if (readiness.globalReadiness > 0) {
      await supabase.from('athlete_readiness_snapshots').insert({
        athlete_id: athleteId,
        aerobic_score: readiness.aerobic.score || null,
        neuromuscular_score: readiness.neuromuscular.score || null,
        biological_health_score: readiness.biologicalHealth.score || null,
        hydration_stress_score: readiness.hydrationStress.score || null,
        global_readiness: readiness.globalReadiness,
        limiting_factor: readiness.limitingFactor.key,
        health_flags: readiness.healthFlags,
        inputs_snapshot: inputs,
        created_by: profile?.id || null,
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!result || result.globalReadiness === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('engine.noDataAvailable')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Global Readiness */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={result.globalReadiness} status={result.globalStatus} size={96} />
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('engine.readinessScore')}</h3>
            {result.limitingFactor.key !== 'none' && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('engine.limitingFactor')}</p>
                <p className={`text-sm font-medium mt-0.5 ${
                  result.limitingFactor.severity === 'red' ? 'text-red-600 dark:text-red-400' :
                  result.limitingFactor.severity === 'yellow' ? 'text-amber-600 dark:text-amber-400' :
                  'text-green-600 dark:text-green-400'
                }`}>
                  {t(result.limitingFactor.labelKey)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Domain Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <DomainCard domain={result.aerobic} labelKey="engine.domain.aerobic" t={t} />
        <DomainCard domain={result.neuromuscular} labelKey="engine.domain.neuromuscular" t={t} />
        <DomainCard domain={result.biologicalHealth} labelKey="engine.domain.biological" t={t} />
        <DomainCard domain={result.hydrationStress} labelKey="engine.domain.hydration" t={t} />
      </div>

      {/* Health Flags */}
      {result.healthFlags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('engine.flags')}</h4>
          <div className="space-y-2">
            {result.healthFlags.map(flag => (
              <div
                key={flag.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  flag.status === 'red'
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  flag.status === 'red' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <p className="text-xs text-gray-700 dark:text-gray-300">{t(flag.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function extractBiologicalInputs(bioData: Record<string, unknown> | null | undefined) {
  if (!bioData) return {};
  const ot = (bioData.oxygen_transport || {}) as Record<string, number>;
  const rec = (bioData.recovery || {}) as Record<string, number>;
  const hor = (bioData.hormonal || {}) as Record<string, number>;
  const nut = (bioData.nutrition || {}) as Record<string, number>;
  return {
    ferritin: ot.ferritin ?? null,
    hemoglobin: ot.hemoglobin ?? null,
    ck: rec.ck ?? null,
    cortisol: rec.cortisol ?? hor.cortisol_am ?? null,
    vitamin_d: nut.vitamin_d ?? null,
    crp: null,
  };
}
