import { FVProfile, getFVImbalanceLabel, getFVQualityLabel } from '../../lib/forceVelocity';

interface FVMetricsPanelProps {
  profile: FVProfile;
  previousProfile?: FVProfile | null;
}

export default function FVMetricsPanel({ profile, previousProfile }: FVMetricsPanelProps) {
  const quality = getFVQualityLabel(profile.r_squared);
  const imbalanceLabel = getFVImbalanceLabel(profile);

  const delta = (current: number, prev?: number | null, unit = '', decimals = 1) => {
    if (prev === undefined || prev === null) return null;
    const diff = current - prev;
    const sign = diff > 0 ? '+' : '';
    return (
      <span className={`text-xs ml-1 ${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-400' : 'text-gray-400'}`}>
        ({sign}{diff.toFixed(decimals)}{unit})
      </span>
    );
  };

  const imbalanceColor = {
    balanced: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    force_deficit: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    velocity_deficit: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  }[profile.fv_imbalance_direction];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard
          label="F0 (max force)"
          value={profile.f0.toFixed(0)}
          unit="N"
          sub={`${profile.f0_relative.toFixed(2)} N/kg`}
          delta={delta(profile.f0, previousProfile?.f0, ' N', 0)}
          color="blue"
        />
        <MetricCard
          label="V0 (max velocity)"
          value={profile.v0.toFixed(3)}
          unit="m/s"
          delta={delta(profile.v0, previousProfile?.v0, ' m/s', 3)}
          color="green"
        />
        <MetricCard
          label="Pmax"
          value={profile.pmax.toFixed(0)}
          unit="W"
          sub={`${profile.pmax_relative.toFixed(1)} W/kg`}
          delta={delta(profile.pmax, previousProfile?.pmax, ' W', 0)}
          color="amber"
        />
        <MetricCard
          label="F-V Slope"
          value={profile.slope.toFixed(1)}
          unit="N·s/m"
          delta={delta(profile.slope, previousProfile?.slope, '', 1)}
          color="slate"
        />
        <MetricCard
          label="Optimal Velocity"
          value={profile.optimal_velocity.toFixed(3)}
          unit="m/s"
          color="slate"
        />
        <MetricCard
          label="R² fit"
          value={profile.r_squared.toFixed(4)}
          unit=""
          badge={quality.label}
          badgeColor={quality.color}
          color="slate"
        />
      </div>

      <div className={`rounded-xl px-4 py-3 ${imbalanceColor}`}>
        <p className="text-xs font-bold uppercase tracking-wider mb-0.5 opacity-60">F-V Profile Balance</p>
        <p className="text-sm font-semibold">{imbalanceLabel}</p>
      </div>

      {previousProfile && (
        <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Comparison with previous session</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <CompareRow label="F0" current={profile.f0} prev={previousProfile.f0} unit=" N" />
            <CompareRow label="V0" current={profile.v0} prev={previousProfile.v0} unit=" m/s" decimals={3} />
            <CompareRow label="Pmax" current={profile.pmax} prev={previousProfile.pmax} unit=" W" />
          </div>
        </div>
      )}
    </div>
  );
}

function CompareRow({ label, current, prev, unit, decimals = 0 }: { label: string; current: number; prev: number; unit: string; decimals?: number }) {
  const diff = current - prev;
  const pct = ((diff / prev) * 100).toFixed(1);
  const sign = diff > 0 ? '+' : '';
  const color = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-500';

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="font-semibold text-gray-900 dark:text-white">{current.toFixed(decimals)}{unit}</p>
      <p className={`text-xs ${color}`}>{sign}{diff.toFixed(decimals)}{unit} ({sign}{pct}%)</p>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  badge?: string;
  badgeColor?: string;
  delta?: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

const COLOR_MAP = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
  red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  slate: 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300',
};

const BADGE_COLOR_MAP: Record<string, string> = {
  green: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
  amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
  red: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
};

function MetricCard({ label, value, unit, sub, badge, badgeColor, delta, color }: MetricCardProps) {
  return (
    <div className={`rounded-xl p-3 ${COLOR_MAP[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-xs opacity-60">{unit}</span>}
        {delta}
      </div>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      {badge && (
        <span className={`inline-block mt-1 px-1.5 py-0.5 text-xs rounded font-medium ${BADGE_COLOR_MAP[badgeColor || 'slate'] || 'bg-gray-100 text-gray-600'}`}>
          {badge}
        </span>
      )}
    </div>
  );
}
