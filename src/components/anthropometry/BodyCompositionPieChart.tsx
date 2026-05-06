import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLanguage } from '../../contexts/LanguageContext';
import type { KerrResults } from '../../types/anthropometry.types';

interface BodyCompositionPieChartProps {
  results: KerrResults;
  sum6Skinfolds?: number;
}

const COLORS = {
  Piel: '#F59E0B',
  Adiposa: '#EF4444',
  Muscular: '#10B981',
  Residual: '#6B7280',
  Ósea: '#3B82F6',
};

const RADIAN = Math.PI / 180;

function renderCustomLabel({
  cx, cy, midAngle, innerRadius, outerRadius, pct,
}: any) {
  if (pct < 4) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
      {`${pct.toFixed(1)}%`}
    </text>
  );
}

export default function BodyCompositionPieChart({ results, sum6Skinfolds }: BodyCompositionPieChartProps) {
  const { t } = useLanguage();

  const total = results.skin_mass_kg + results.adipose_mass_kg + results.muscle_mass_kg +
    results.residual_mass_kg + results.bone_mass_kg;

  const components = [
    { name: 'Muscular', kg: results.muscle_mass_kg, pct: results.muscle_mass_pct },
    { name: 'Adiposa', kg: results.adipose_mass_kg, pct: results.adipose_mass_pct },
    { name: 'Ósea', kg: results.bone_mass_kg, pct: results.bone_mass_pct },
    { name: 'Residual', kg: results.residual_mass_kg, pct: results.residual_mass_pct },
    { name: 'Piel', kg: results.skin_mass_kg, pct: results.skin_mass_pct },
  ];

  const pieData = components.map(c => ({ name: c.name, value: c.kg, pct: c.pct }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-8 items-center">
        <div className="w-full lg:w-1/2" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={130}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [`${value.toFixed(2)} kg`, name]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="w-full lg:w-1/2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400 font-semibold">{t('kerr.compartment')}</th>
                <th className="text-right py-2 pr-4 text-gray-600 dark:text-gray-400 font-semibold">kg</th>
                <th className="text-right py-2 text-gray-600 dark:text-gray-400 font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.name} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[c.name as keyof typeof COLORS] }}
                      />
                      <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-gray-900 dark:text-white">
                    {c.kg.toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                    {c.pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                <td className="py-2.5 pr-4 font-bold text-gray-900 dark:text-white">Total</td>
                <td className="py-2.5 pr-4 text-right font-bold text-gray-900 dark:text-white">
                  {total.toFixed(2)}
                </td>
                <td className="py-2.5 text-right font-bold text-gray-900 dark:text-white">100%</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">{t('kerr.muscleBoneRatio')}</div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {results.muscle_bone_ratio.toFixed(2)}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-0.5">{t('kerr.ballastIndex')}</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                {results.ballast_index.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {sum6Skinfolds !== undefined && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">{t('kerr.sum6Skinfolds')}: </span>
          <span className="text-lg font-bold text-amber-800 dark:text-amber-300">{sum6Skinfolds.toFixed(1)} mm</span>
        </div>
      )}
    </div>
  );
}
