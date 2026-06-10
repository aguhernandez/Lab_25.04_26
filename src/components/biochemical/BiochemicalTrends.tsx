import { useLanguage } from '../../contexts/LanguageContext';
import { DOMAINS, DomainTrend, TrendDirection } from '../../lib/biochemistry';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { BiochemicalTest } from '../../pages/BiochemicalLab';

interface BiochemicalTrendsProps {
  trends: DomainTrend[];
  tests: BiochemicalTest[];
}

function TrendBadge({ direction }: { direction: TrendDirection }) {
  const config: Record<TrendDirection, { icon: string; color: string; bg: string }> = {
    improving: { icon: '\u2191', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    stable: { icon: '\u2192', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    declining: { icon: '\u2193', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  };
  const c = config[direction];
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.color}`}>
      {c.icon} {direction}
    </span>
  );
}

export default function BiochemicalTrends({ trends, tests }: BiochemicalTrendsProps) {
  const { t } = useLanguage();

  if (trends.length === 0 || tests.length < 2) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t('bio.noTrends')}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t('bio.needMultipleTests')}</p>
      </div>
    );
  }

  // Global score trend chart data
  const globalChartData = tests
    .slice()
    .reverse()
    .map(test => ({
      date: new Date(test.test_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: test.global_score ?? 0,
    }));

  return (
    <div className="space-y-4">
      {/* Global Score Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('bio.globalTrend')}</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={globalChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <ReferenceLine y={80} stroke="#22c55e" strokeDasharray="3 3" />
              <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="score" stroke="#514163" strokeWidth={2} dot={{ fill: '#fdda36', strokeWidth: 2, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Domain Trends Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {trends.map(trend => {
          const domain = DOMAINS.find(d => d.key === trend.domain);
          const chartData = trend.points.map(p => ({
            date: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            score: p.score,
          }));

          return (
            <div key={trend.domain} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                  {domain ? t(domain.labelKey) : trend.domain}
                </h4>
                <TrendBadge direction={trend.direction} />
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="#9ca3af" hide />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={
                        trend.direction === 'improving' ? '#22c55e' :
                        trend.direction === 'declining' ? '#ef4444' : '#3b82f6'
                      }
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
