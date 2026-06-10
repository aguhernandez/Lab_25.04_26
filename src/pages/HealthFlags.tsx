import { useState } from 'react';

type FlagStatus = 'green' | 'yellow' | 'red';

interface HealthFlag {
  id: string;
  athleteName: string;
  category: string;
  status: FlagStatus;
  note: string;
  date: string;
}

export default function HealthFlags() {
  const [flags] = useState<HealthFlag[]>([]);

  const statusConfig: Record<FlagStatus, { label: string; color: string; bg: string }> = {
    green: { label: 'Normal', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    yellow: { label: 'Monitor', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    red: { label: 'Attention', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">Health Flags</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Cross-laboratory health alerts and monitoring</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(['green', 'yellow', 'red'] as FlagStatus[]).map(status => {
          const count = flags.filter(f => f.status === status).length;
          const cfg = statusConfig[status];
          return (
            <div key={status} className={`rounded-xl border p-4 ${cfg.bg}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-2xl font-bold ${cfg.color}`}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Active Flags</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Health flags will appear here when generated from laboratory assessments.</p>
      </div>
    </div>
  );
}
