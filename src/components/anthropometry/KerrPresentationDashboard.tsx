import { useState } from 'react';
import { TrendingUp, TrendingDown, Target, PieChart as PieIcon, FileText } from 'lucide-react';
import type { KerrResults } from '../../types/anthropometry.types';
import BodyCompositionPieChart from './BodyCompositionPieChart';
import BodyCompositionTargets from './BodyCompositionTargets';
import { useLanguage } from '../../contexts/LanguageContext';

interface KerrPresentationDashboardProps {
  results: KerrResults;
  athleteName?: string;
  sum6Skinfolds?: number;
  stature?: number;
}

type Tab = 'conclusiones' | 'resultados' | 'objetivos';

export default function KerrPresentationDashboard({ results, athleteName, sum6Skinfolds, stature }: KerrPresentationDashboardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('conclusiones');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'conclusiones', label: t('kerr.tab.conclusions'), icon: <PieIcon className="w-4 h-4" /> },
    { id: 'resultados', label: t('kerr.tab.results'), icon: <FileText className="w-4 h-4" /> },
    { id: 'objetivos', label: t('kerr.tab.targets'), icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('kerr.title')}
            </h2>
            {athleteName && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{athleteName}</p>
            )}
          </div>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'conclusiones' && (
          <div className="space-y-6">
            <BodyCompositionPieChart results={results} sum6Skinfolds={sum6Skinfolds} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('kerr.somatotype')}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {results.somatotype_endomorphy.toFixed(1)} – {results.somatotype_mesomorphy.toFixed(1)} – {results.somatotype_ectomorphy.toFixed(1)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{t('kerr.endoMesoEcto')}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('kerr.bmi')}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{results.bmi.toFixed(1)}</div>
                <div className="text-xs text-gray-400 mt-0.5">kg/m²</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('kerr.surfaceArea')}</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{results.surface_area_m2.toFixed(3)}</div>
                <div className="text-xs text-gray-400 mt-0.5">m²</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resultados' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {t('kerr.zScoresTitle')}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { labelKey: 'kerr.comp.adipose', z: results.adipose_mass_z_score, inverted: true },
                  { labelKey: 'kerr.comp.muscle', z: results.muscle_mass_z_score, inverted: false },
                  { labelKey: 'kerr.comp.residual', z: results.residual_mass_z_score, inverted: false },
                  { labelKey: 'kerr.comp.bone', z: results.bone_mass_z_score, inverted: false },
                ].map(({ labelKey, z, inverted }) => {
                  const label = t(labelKey);
                  const isPositive = z > 0;
                  const isGood = inverted ? !isPositive : isPositive;
                  return (
                    <div key={label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {z > 0 ? '+' : ''}{z.toFixed(2)}
                        </span>
                        {isGood ? (
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {t('kerr.allCompartments')}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 pr-4 text-gray-600 dark:text-gray-400 font-semibold">{t('kerr.compartment')}</th>
                      <th className="text-right py-2 pr-4 text-gray-600 dark:text-gray-400 font-semibold">kg</th>
                      <th className="text-right py-2 pr-4 text-gray-600 dark:text-gray-400 font-semibold">%</th>
                      <th className="text-right py-2 text-gray-600 dark:text-gray-400 font-semibold">Z-score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const hasBoneBreakdown = results.bone_mass_head_kg > 0 || results.bone_mass_body_kg > 0;
                      const rows = [
                        { nameKey: 'kerr.comp.muscle', kg: results.muscle_mass_kg, pct: results.muscle_mass_pct, z: results.muscle_mass_z_score },
                        { nameKey: 'kerr.comp.adipose', kg: results.adipose_mass_kg, pct: results.adipose_mass_pct, z: results.adipose_mass_z_score },
                        { nameKey: 'kerr.comp.bone', kg: results.bone_mass_kg, pct: results.bone_mass_pct, z: results.bone_mass_z_score },
                        { nameKey: 'kerr.comp.residual', kg: results.residual_mass_kg, pct: results.residual_mass_pct, z: results.residual_mass_z_score },
                        { nameKey: 'kerr.comp.skin', kg: results.skin_mass_kg, pct: results.skin_mass_pct, z: results.skin_mass_z_score },
                      ];
                      return rows.map(row => (
                        <>
                          <tr key={row.nameKey} className="border-b border-gray-100 dark:border-gray-800">
                            <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{t(row.nameKey)}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-900 dark:text-white">{row.kg.toFixed(2)}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-900 dark:text-white">{row.pct.toFixed(1)}%</td>
                            <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">
                              {row.z > 0 ? '+' : ''}{row.z.toFixed(2)}
                            </td>
                          </tr>
                          {row.nameKey === 'kerr.comp.bone' && hasBoneBreakdown && (
                            <>
                              <tr key="bone-head" className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                                <td className="py-1.5 pr-4 pl-4 text-gray-500 dark:text-gray-400 italic text-xs">{t('kerr.comp.boneHead')}</td>
                                <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-gray-300 text-xs">{results.bone_mass_head_kg.toFixed(3)}</td>
                                <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-gray-300 text-xs">{results.bone_mass_head_pct.toFixed(2)}%</td>
                                <td className="py-1.5 text-right text-gray-500 dark:text-gray-400 text-xs">
                                  {results.bone_mass_head_z_score > 0 ? '+' : ''}{results.bone_mass_head_z_score.toFixed(2)}
                                </td>
                              </tr>
                              <tr key="bone-body" className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                                <td className="py-1.5 pr-4 pl-4 text-gray-500 dark:text-gray-400 italic text-xs">{t('kerr.comp.boneBody')}</td>
                                <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-gray-300 text-xs">{results.bone_mass_body_kg.toFixed(3)}</td>
                                <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-gray-300 text-xs">{results.bone_mass_body_pct.toFixed(2)}%</td>
                                <td className="py-1.5 text-right text-gray-500 dark:text-gray-400 text-xs">
                                  {results.bone_mass_body_z_score > 0 ? '+' : ''}{results.bone_mass_body_z_score.toFixed(2)}
                                </td>
                              </tr>
                            </>
                          )}
                        </>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                {t('kerr.structuredWeight')}
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t('kerr.structuredWeightLabel')}</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {results.structured_weight_kg.toFixed(3)} kg
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t('kerr.diffLabel')}</div>
                  <div className={`text-lg font-bold ${results.structured_weight_diff_kg < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {results.structured_weight_diff_kg > 0 ? '+' : ''}{results.structured_weight_diff_kg.toFixed(3)} kg
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{t('kerr.techError')}</div>
                  <div className={`text-lg font-bold ${Math.abs(results.structured_weight_diff_pct) <= 2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {results.structured_weight_diff_pct > 0 ? '+' : ''}{results.structured_weight_diff_pct.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sum6Skinfolds !== undefined && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">{t('kerr.sum6Skinfolds')}</div>
                  <div className="text-xl font-bold text-amber-800 dark:text-amber-300">{sum6Skinfolds.toFixed(1)} mm</div>
                </div>
              )}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">{t('kerr.muscleBoneRatio')}</div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{results.muscle_bone_ratio.toFixed(2)}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">{t('kerr.ballastIndex')}</div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{results.ballast_index.toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">{t('kerr.adiposeMuscleRatio')}</div>
                <div className="text-xl font-bold text-gray-700 dark:text-gray-300">{results.adipose_muscle_ratio.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'objetivos' && (
          <BodyCompositionTargets results={results} stature={stature} />
        )}
      </div>
    </div>
  );
}
