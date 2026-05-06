import { useState } from 'react';
import { TrendingDown, TrendingUp, Target } from 'lucide-react';
import type { KerrResults } from '../../types/anthropometry.types';
import { PHANTOM_REFERENCE } from '../../types/anthropometry.types';
import { useLanguage } from '../../contexts/LanguageContext';

interface BodyCompositionTargetsProps {
  results: KerrResults;
  stature?: number;
}

function adiposeMassFromZScore(z: number, stature: number): number {
  const heightRatio = 170.18 / stature;
  return ((z * 5.85) + 25.6) / Math.pow(heightRatio, 3);
}

function zScoreFromSum6(sum6mm: number, stature: number): number {
  const adiposeScaled = sum6mm * (170.18 / stature);
  return (adiposeScaled - PHANTOM_REFERENCE.adipose.mean) / PHANTOM_REFERENCE.adipose.sd;
}

function sum6FromZScore(z: number, stature: number): number {
  const adiposeScaled = z * PHANTOM_REFERENCE.adipose.sd + PHANTOM_REFERENCE.adipose.mean;
  return adiposeScaled / (170.18 / stature);
}

function massFromZScore(z: number, phantomMean: number, phantomSd: number): number {
  return phantomMean + z * phantomSd;
}

type AdiposeInputMode = 'z' | 'skinfolds';
type MuscleInputMode = 'z' | 'ratio';

export default function BodyCompositionTargets({ results, stature }: BodyCompositionTargetsProps) {
  const { t } = useLanguage();
  const [adiposeMode, setAdiposeMode] = useState<AdiposeInputMode>('z');
  const [targetAdiposeZ, setTargetAdiposeZ] = useState<string>(results.adipose_mass_z_score.toFixed(2));
  const [targetSum6, setTargetSum6] = useState<string>(
    stature ? sum6FromZScore(results.adipose_mass_z_score, stature).toFixed(1) : ''
  );

  const [muscleMode, setMuscleMode] = useState<MuscleInputMode>('z');
  const [targetMuscleZ, setTargetMuscleZ] = useState<string>(results.muscle_mass_z_score.toFixed(2));
  const currentRatio = results.bone_mass_kg > 0 ? results.muscle_mass_kg / results.bone_mass_kg : null;
  const [targetRatio, setTargetRatio] = useState<string>(
    currentRatio !== null ? currentRatio.toFixed(2) : ''
  );

  const currentSum6 = stature ? sum6FromZScore(results.adipose_mass_z_score, stature) : null;

  const parsedAdiposeZ = adiposeMode === 'z'
    ? parseFloat(targetAdiposeZ)
    : (stature && parseFloat(targetSum6) > 0
        ? zScoreFromSum6(parseFloat(targetSum6), stature)
        : NaN);

  const parsedMuscleZ = muscleMode === 'z'
    ? parseFloat(targetMuscleZ)
    : NaN;

  const validAdipose = !isNaN(parsedAdiposeZ);

  const targetMuscleMassFromRatio =
    muscleMode === 'ratio' && parseFloat(targetRatio) > 0 && results.bone_mass_kg > 0
      ? parseFloat(targetRatio) * results.bone_mass_kg
      : null;

  const targetMuscleMassFromZ = !isNaN(parsedMuscleZ)
    ? massFromZScore(parsedMuscleZ, PHANTOM_REFERENCE.muscle.mean, PHANTOM_REFERENCE.muscle.sd)
    : null;

  const targetMuscleMass = muscleMode === 'ratio' ? targetMuscleMassFromRatio : targetMuscleMassFromZ;
  const validMuscle = targetMuscleMass !== null;

  const targetAdiposeMass = validAdipose && stature
    ? adiposeMassFromZScore(parsedAdiposeZ, stature)
    : validAdipose
    ? massFromZScore(parsedAdiposeZ, PHANTOM_REFERENCE.adipose.mean, PHANTOM_REFERENCE.adipose.sd)
    : null;

  const isAdiposeUnchanged = adiposeMode === 'z'
    ? parseFloat(parsedAdiposeZ.toFixed(2)) === parseFloat(results.adipose_mass_z_score.toFixed(2))
    : (stature && Math.abs(parseFloat(targetSum6) - (currentSum6 ?? 0)) < 0.05);

  const adiposeDelta = targetAdiposeMass !== null
    ? (isAdiposeUnchanged ? 0 : targetAdiposeMass - results.adipose_mass_kg)
    : null;
  const muscleDelta = targetMuscleMass !== null ? targetMuscleMass - results.muscle_mass_kg : null;

  function DeltaBadge({ delta }: { delta: number }) {
    const abs = Math.abs(delta);
    const isZero = delta === 0;
    const isGain = delta > 0;
    return (
      <div className={`flex items-center gap-2 rounded-lg px-4 py-3 ${
        isZero
          ? 'bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600'
          : isGain
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
      }`}>
        {isZero ? (
          <Target className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
        ) : isGain ? (
          <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
        )}
        <span className={`text-lg font-bold ${
          isZero ? 'text-gray-600 dark:text-gray-300' : isGain ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
        }`}>
          {isZero ? '0.00' : isGain ? '+' : '-'}{isZero ? '' : abs.toFixed(2)} kg
        </span>
        <span className={`text-sm ${
          isZero ? 'text-gray-500 dark:text-gray-400' : isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        }`}>
          {isZero ? t('targets.noChange') : isGain ? t('targets.toGain') : t('targets.toLose')}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('targets.intro')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('targets.adiposeMass')}</h3>
              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-medium">
                {t('targets.currentZ')} {results.adipose_mass_z_score > 0 ? '+' : ''}{results.adipose_mass_z_score.toFixed(2)}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {t('targets.current')} <span className="font-semibold text-gray-700 dark:text-gray-300">{results.adipose_mass_kg.toFixed(2)} kg</span>
              &nbsp;({results.adipose_mass_pct.toFixed(1)}%)
            </div>
            {currentSum6 !== null && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t('targets.currentSum6')} <span className="font-semibold text-gray-700 dark:text-gray-300">{currentSum6.toFixed(1)} mm</span>
              </div>
            )}

            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 mb-3">
              <button
                onClick={() => setAdiposeMode('z')}
                className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                  adiposeMode === 'z'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {t('targets.byZScore')}
              </button>
              <button
                onClick={() => setAdiposeMode('skinfolds')}
                disabled={!stature}
                className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                  adiposeMode === 'skinfolds'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {t('targets.bySkinfolds')}
              </button>
            </div>

            {adiposeMode === 'z' ? (
              <>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('targets.targetZ')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetAdiposeZ}
                  onChange={(e) => setTargetAdiposeZ(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="ej: -0.5"
                />
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('targets.targetSum6')}
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={targetSum6}
                  onChange={(e) => setTargetSum6(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="ej: 45"
                />
                {validAdipose && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t('targets.equivalentZ')} {parsedAdiposeZ > 0 ? '+' : ''}{parsedAdiposeZ.toFixed(2)}
                  </p>
                )}
              </>
            )}
          </div>

          {validAdipose && targetAdiposeMass !== null && adiposeDelta !== null && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('targets.targetAdiposeMass')} <span className="font-semibold text-gray-800 dark:text-gray-200">{targetAdiposeMass.toFixed(2)} kg</span>
              </div>
              <DeltaBadge delta={adiposeDelta} />
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('targets.muscleMass')}</h3>
              <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-medium">
                {t('targets.currentZ')} {results.muscle_mass_z_score > 0 ? '+' : ''}{results.muscle_mass_z_score.toFixed(2)}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {t('targets.current')} <span className="font-semibold text-gray-700 dark:text-gray-300">{results.muscle_mass_kg.toFixed(2)} kg</span>
              &nbsp;({results.muscle_mass_pct.toFixed(1)}%)
            </div>
            {currentRatio !== null && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {t('targets.currentRatio')} <span className="font-semibold text-gray-700 dark:text-gray-300">{currentRatio.toFixed(2)}</span>
                &nbsp;<span className="text-xs text-gray-400 dark:text-gray-500">({results.muscle_mass_kg.toFixed(2)} / {results.bone_mass_kg.toFixed(2)} kg)</span>
              </div>
            )}

            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 mb-3">
              <button
                onClick={() => setMuscleMode('z')}
                className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                  muscleMode === 'z'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {t('targets.byZScore')}
              </button>
              <button
                onClick={() => setMuscleMode('ratio')}
                className={`flex-1 text-xs py-1.5 font-medium transition-colors ${
                  muscleMode === 'ratio'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {t('targets.byRatio')}
              </button>
            </div>

            {muscleMode === 'z' ? (
              <>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('targets.targetZ')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetMuscleZ}
                  onChange={(e) => setTargetMuscleZ(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="ej: +1.0"
                />
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('targets.targetRatio')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={targetRatio}
                  onChange={(e) => setTargetRatio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  placeholder="ej: 5.5"
                />
                {targetMuscleMassFromRatio !== null && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t('targets.resultingMuscle')} {targetMuscleMassFromRatio.toFixed(2)} kg
                    &nbsp;= {parseFloat(targetRatio).toFixed(2)} × {results.bone_mass_kg.toFixed(2)} kg {t('targets.boneFixed')}
                  </p>
                )}
              </>
            )}
          </div>

          {validMuscle && targetMuscleMass !== null && muscleDelta !== null && (
            <div className="space-y-2">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('targets.targetMuscleMass')} <span className="font-semibold text-gray-800 dark:text-gray-200">{targetMuscleMass.toFixed(2)} kg</span>
              </div>
              <DeltaBadge delta={muscleDelta} />
            </div>
          )}
        </div>
      </div>

      {(validAdipose || validMuscle) && (adiposeDelta !== null || muscleDelta !== null) && (
        <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('targets.changeSummary')}</h4>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {adiposeDelta !== null && (
              <div className="flex justify-between">
                <span>{t('targets.adiposeMassRow')}</span>
                <span className={`font-semibold ${adiposeDelta === 0 ? 'text-gray-500 dark:text-gray-400' : adiposeDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {adiposeDelta === 0 ? '0.00' : adiposeDelta > 0 ? '+' : ''}{adiposeDelta === 0 ? '' : adiposeDelta.toFixed(2)} kg
                  {adiposeMode === 'skinfolds' && currentSum6 !== null && parseFloat(targetSum6) > 0 && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal">
                      &nbsp;({currentSum6.toFixed(1)} → {parseFloat(targetSum6).toFixed(1)} mm)
                    </span>
                  )}
                  {adiposeMode === 'z' && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal">
                      &nbsp;(Z: {results.adipose_mass_z_score.toFixed(2)} → {parsedAdiposeZ > 0 ? '+' : ''}{parsedAdiposeZ.toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}
            {muscleDelta !== null && (
              <div className="flex justify-between">
                <span>{t('targets.muscleMassRow')}</span>
                <span className={`font-semibold ${muscleDelta === 0 ? 'text-gray-500 dark:text-gray-400' : muscleDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {muscleDelta === 0 ? '0.00' : muscleDelta > 0 ? '+' : ''}{muscleDelta === 0 ? '' : muscleDelta.toFixed(2)} kg
                  {muscleMode === 'ratio' && currentRatio !== null && parseFloat(targetRatio) > 0 ? (
                    <span className="text-gray-400 dark:text-gray-500 font-normal">
                      &nbsp;(M/O: {currentRatio.toFixed(2)} → {parseFloat(targetRatio).toFixed(2)})
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 font-normal">
                      &nbsp;(Z: {results.muscle_mass_z_score.toFixed(2)} → {parsedMuscleZ > 0 ? '+' : ''}{parsedMuscleZ.toFixed(2)})
                    </span>
                  )}
                </span>
              </div>
            )}
            {adiposeDelta !== null && muscleDelta !== null && (
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <span className="font-medium">{t('targets.netChange')}</span>
                <span className={`font-bold ${(adiposeDelta + muscleDelta) === 0 ? 'text-gray-500 dark:text-gray-400' : (adiposeDelta + muscleDelta) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(adiposeDelta + muscleDelta) > 0 ? '+' : ''}{(adiposeDelta + muscleDelta).toFixed(2)} kg
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            {t('targets.phantomNote')}
          </p>
        </div>
      )}
    </div>
  );
}
