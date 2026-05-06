import type { KerrResults } from '../../types/anthropometry.types';

interface MorphologicalBodyModelProps {
  kerrResults: KerrResults | null;
}

export default function MorphologicalBodyModel({ kerrResults }: MorphologicalBodyModelProps) {
  if (!kerrResults) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <p className="text-gray-600 dark:text-gray-400 text-center">No body composition data available</p>
      </div>
    );
  }

  const components = [
    { name: 'Adipose', pct: kerrResults.adipose_mass_pct, color: '#f59e0b' },
    { name: 'Muscle', pct: kerrResults.muscle_mass_pct, color: '#ef4444' },
    { name: 'Bone', pct: kerrResults.bone_mass_pct, color: '#6b7280' },
    { name: 'Residual', pct: kerrResults.residual_mass_pct, color: '#a855f7' },
    { name: 'Skin', pct: kerrResults.skin_mass_pct, color: '#eab308' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Morphological Body Model
      </h3>

      <div className="relative h-96 flex items-center justify-center">
        <div className="relative w-64 h-80">
          {components.map((comp, index) => {
            const height = (comp.pct / 100) * 320;
            const startY = components.slice(0, index).reduce((sum, c) => sum + (c.pct / 100) * 320, 0);

            return (
              <div
                key={comp.name}
                className="absolute left-1/2 -translate-x-1/2 rounded-lg flex items-center justify-center text-white font-semibold text-sm transition-all hover:opacity-80"
                style={{
                  backgroundColor: comp.color,
                  width: '60%',
                  height: `${height}px`,
                  bottom: `${startY}px`,
                }}
              >
                <span>{comp.name} ({comp.pct.toFixed(1)}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {components.map((comp) => (
          <div key={comp.name} className="text-center">
            <div
              className="w-full h-4 rounded mb-1"
              style={{ backgroundColor: comp.color }}
            />
            <div className="text-xs text-gray-600 dark:text-gray-400">{comp.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
