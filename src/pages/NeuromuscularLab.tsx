import { useState } from 'react';
import ForceVelocityLab from './ForceVelocityLab';

type NeuromuscularTab = 'force-velocity' | 'jump-testing' | 'sprint-testing' | 'strength-testing' | 'vbt' | 'fatigue-monitoring';

const TABS: { id: NeuromuscularTab; label: string }[] = [
  { id: 'force-velocity', label: 'Force Velocity Profile' },
  { id: 'jump-testing', label: 'Jump Testing' },
  { id: 'sprint-testing', label: 'Sprint Testing' },
  { id: 'strength-testing', label: 'Strength Testing' },
  { id: 'vbt', label: 'Velocity Based Training' },
  { id: 'fatigue-monitoring', label: 'Fatigue Monitoring' },
];

export default function NeuromuscularLab() {
  const [activeTab, setActiveTab] = useState<NeuromuscularTab>('force-velocity');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">Neuromuscular Lab</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Neuromuscular assessment and performance profiling</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-[#fdda36] text-[#514163]'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'force-velocity' && <ForceVelocityLab />}
      {activeTab !== 'force-velocity' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {TABS.find(t => t.id === activeTab)?.label}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400"></p>
        </div>
      )}
    </div>
  );
}
