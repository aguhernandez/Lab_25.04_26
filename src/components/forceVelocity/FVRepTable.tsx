import { FVRepResult } from '../../lib/forceVelocity';

interface FVRepTableProps {
  reps: FVRepResult[];
}

export default function FVRepTable({ reps }: FVRepTableProps) {
  if (reps.length === 0) return null;

  const sets = [...new Set(reps.map(r => r.set_number))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      {sets.map(setNum => {
        const setReps = reps.filter(r => r.set_number === setNum);
        return (
          <div key={setNum}>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Set {setNum} — {setReps[0]?.load_kg} kg
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Rep</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Mean V (m/s)</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Peak V (m/s)</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Mean F (N)</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Peak F (N)</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Mean P (W)</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Disp (m)</th>
                    <th className="text-right py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Source</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {setReps.map((rep, i) => (
                    <tr key={i} className={rep.is_valid ? '' : 'opacity-50'}>
                      <td className="py-2 px-2 font-medium text-gray-900 dark:text-white">{rep.rep_number}</td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{rep.mean_velocity_ms.toFixed(3)}</td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{rep.peak_velocity_ms.toFixed(3)}</td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{rep.mean_force_n.toFixed(0)}</td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{rep.peak_force_n.toFixed(0)}</td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{rep.mean_power_w.toFixed(0)}</td>
                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{rep.displacement_m.toFixed(3)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">{rep.data_source}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {rep.is_valid ? (
                          <span className="text-green-500">
                            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        ) : (
                          <span title={rep.validation_note || 'Invalid'} className="text-red-400">
                            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        )}
                        {!rep.is_valid && rep.validation_note && (
                          <p className="text-xs text-red-400 mt-0.5 text-left">{rep.validation_note}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
