import { FVProfile, FVLoadZone, computeLoadRecommendations } from '../../lib/forceVelocity';

interface FVLoadRecommendationsProps {
  profile: FVProfile;
  bodyMassKg: number;
  exercise: string;
}

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  red:    { bg: 'bg-red-50 dark:bg-red-900/20',     text: 'text-red-700 dark:text-red-300',     border: 'border-red-200 dark:border-red-800',     badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
  amber:  { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-700 dark:text-amber-300',  border: 'border-amber-200 dark:border-amber-800',  badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  green:  { bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-300',  border: 'border-green-200 dark:border-green-800',  badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-700 dark:text-blue-300',    border: 'border-blue-200 dark:border-blue-800',    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
};

function VelocityBar({ zone, v0 }: { zone: FVLoadZone; v0: number }) {
  const left = Math.min(100, (zone.velocityRange[0] / v0) * 100);
  const width = Math.min(100 - left, ((zone.velocityRange[1] - zone.velocityRange[0]) / v0) * 100);
  const c = colorMap[zone.color] ?? colorMap.blue;
  return (
    <div className="relative h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`absolute h-full rounded-full ${c.badge.split(' ')[0]}`}
        style={{ left: `${left}%`, width: `${Math.max(4, width)}%` }}
      />
    </div>
  );
}

export default function FVLoadRecommendations({ profile, bodyMassKg, exercise }: FVLoadRecommendationsProps) {
  const { estimated1RM_kg, zones } = computeLoadRecommendations(profile, bodyMassKg);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Load Recommendations — {exercise}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Derived from the F-V curve. Target velocities guide load selection for each training stimulus.
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-2.5 text-center shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">Estimated 1RM</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{estimated1RM_kg} kg</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">from F-V extrapolation</p>
        </div>
      </div>

      <div className="space-y-3">
        {zones.map((zone) => {
          const c = colorMap[zone.color] ?? colorMap.blue;
          return (
            <div
              key={zone.stimulus}
              className={`rounded-xl border p-4 ${c.bg} ${c.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold ${c.text}`}>{zone.stimulus}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                      {zone.velocityRange[0].toFixed(2)}–{zone.velocityRange[1].toFixed(2)} m/s
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{zone.description}</p>
                  <VelocityBar zone={zone} v0={profile.v0} />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Target velocity: <span className="font-medium">{zone.targetVelocity.toFixed(2)} m/s</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-bold ${c.text}`}>{zone.recommendedLoad_kg} kg</p>
                  {zone.recommendedLoad_percent1RM > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      ~{zone.recommendedLoad_percent1RM}% 1RM
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong className="text-gray-700 dark:text-gray-300">How to use:</strong> During training, monitor bar velocity with an encoder or video. Select the zone matching today's training goal and use the listed load as your working weight. Adjust by 2.5–5 kg if the measured velocity falls outside the target range.
        </p>
      </div>
    </div>
  );
}
