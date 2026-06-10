import { useLanguage } from '../../contexts/LanguageContext';
import { DOMAINS, BiochemicalResult, FlagStatus } from '../../lib/biochemistry';
import type { BiochemicalTest } from '../../pages/BiochemicalLab';

interface BiochemicalResultsProps {
  result: BiochemicalResult | null;
  tests: BiochemicalTest[];
}

function StatusBadge({ status }: { status: FlagStatus }) {
  const config: Record<FlagStatus, { bg: string; text: string; label: string }> = {
    green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Optimal' },
    yellow: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Monitor' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Attention' },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function ScoreRing({ score, status, size = 'lg' }: { score: number; status: FlagStatus; size?: 'lg' | 'sm' }) {
  const colors: Record<FlagStatus, string> = {
    green: 'text-green-500',
    yellow: 'text-amber-500',
    red: 'text-red-500',
  };
  const strokeColors: Record<FlagStatus, string> = {
    green: 'stroke-green-500',
    yellow: 'stroke-amber-500',
    red: 'stroke-red-500',
  };
  const dim = size === 'lg' ? 96 : 56;
  const strokeWidth = size === 'lg' ? 6 : 4;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg className="transform -rotate-90" width={dim} height={dim}>
        <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-200 dark:text-gray-700" />
        <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={strokeColors[status]} />
      </svg>
      <span className={`absolute text-${size === 'lg' ? '2xl' : 'sm'} font-bold ${colors[status]}`}>
        {score}
      </span>
    </div>
  );
}

export default function BiochemicalResults({ result, tests }: BiochemicalResultsProps) {
  const { t } = useLanguage();

  if (!result) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t('bio.noResults')}</p>
      </div>
    );
  }

  const latestTest = tests[0];

  return (
    <div className="space-y-4">
      {/* Global Score */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={result.globalScore} status={result.globalStatus} />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('bio.globalScore')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {latestTest && new Date(latestTest.test_date).toLocaleDateString()}
            </p>
            <StatusBadge status={result.globalStatus} />
          </div>
        </div>
      </div>

      {/* Domain Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {result.domains.map(domain => {
          const cfg = DOMAINS.find(d => d.key === domain.key);
          return (
            <div key={domain.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {cfg ? t(cfg.labelKey) : domain.key}
                </h4>
                <ScoreRing score={domain.score} status={domain.status} size="sm" />
              </div>
              <div className="space-y-1.5">
                {domain.markers.map(mr => (
                  <div key={mr.key} className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate mr-2">
                      {t(`bio.marker.${mr.key}`)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{mr.value}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        mr.status === 'green' ? 'bg-green-500' :
                        mr.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Health Flags */}
      {result.healthFlags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{t('bio.healthFlags')}</h3>
          <div className="space-y-2">
            {result.healthFlags.map(flag => (
              <div
                key={flag.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  flag.status === 'red'
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  flag.status === 'red' ? 'bg-red-500' : 'bg-amber-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white">
                    {t(flag.markerLabelKey)}: {flag.value} {flag.unit}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {t(flag.domainLabelKey)}
                  </p>
                </div>
                <StatusBadge status={flag.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
