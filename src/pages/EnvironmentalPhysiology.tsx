import { useState } from 'react';
import { Athlete } from '../types';
import AthleteSelector from '../components/AthleteSelector';
import HydrationLab from '../components/hydration/HydrationLab';
import HeatAdaptationLab from '../components/heatAdaptation/HeatAdaptationLab';
import { useLanguage } from '../contexts/LanguageContext';

type Module = 'hydration' | 'heat-adaptation';
type Step = 'select-module' | 'select-athlete' | 'lab';

export default function EnvironmentalPhysiology() {
  const { t } = useLanguage();
  const [module, setModule] = useState<Module | null>(null);
  const [step, setStep] = useState<Step>('select-module');
  const [athlete, setAthlete] = useState<Athlete | null>(null);

  const handleSelectModule = (m: Module) => {
    setModule(m);
    setStep('select-athlete');
  };

  const handleSelectAthlete = (a: Athlete) => {
    setAthlete(a);
    setStep('lab');
  };

  const handleBack = () => {
    if (step === 'lab') {
      setStep('select-athlete');
      setAthlete(null);
    } else {
      setStep('select-module');
      setModule(null);
      setAthlete(null);
    }
  };

  if (step === 'select-module') {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-xl p-2.5">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{t('env.title')}</h2>
                <p className="text-teal-100 text-sm mt-0.5">{t('env.subtitle')}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-body mb-6">
              {t('env.selectModule')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <button
                onClick={() => handleSelectModule('hydration')}
                className="group text-left bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 rounded-xl p-3 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white font-body">{t('env.hydrationLab')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-body mt-1 leading-relaxed">
                      {t('env.hydrationDesc')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full font-body">{t('env.sweatRate')}</span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full font-body">{t('env.usg')}</span>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full font-body">{t('env.hydrationStress')}</span>
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleSelectModule('heat-adaptation')}
                className="group text-left bg-orange-50 dark:bg-orange-900/10 hover:bg-orange-100 dark:hover:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-2xl p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-orange-500 rounded-xl p-3 flex-shrink-0 group-hover:scale-105 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white font-body">{t('env.heatAdaptationLab')}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-body mt-1 leading-relaxed">
                      {t('env.heatDesc')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full font-body">{t('env.hrDrift')}</span>
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full font-body">{t('env.cardiacLoad')}</span>
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs rounded-full font-body">{t('env.hydrationCoupling')}</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-teal-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xs font-semibold text-teal-800 dark:text-teal-300 font-body mb-1">{t('env.crossModule')}</p>
                  <p className="text-xs text-teal-700 dark:text-teal-400 font-body leading-relaxed">
                    {t('env.crossModuleDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'select-athlete') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-body transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('env.backToEnv')}
        </button>
        <div className="flex items-center gap-2 px-1">
          <div className={`w-2 h-2 rounded-full ${module === 'hydration' ? 'bg-blue-500' : 'bg-orange-500'}`} />
          <span className="text-sm font-semibold font-body text-gray-700 dark:text-gray-300">
            {module === 'hydration' ? t('env.hydrationLab') : t('env.heatAdaptationLab')} — {t('env.selectAthlete')}
          </span>
        </div>
        <AthleteSelector
          onSelectAthlete={handleSelectAthlete}
          onCreateNew={() => {}}
        />
      </div>
    );
  }

  if (step === 'lab' && athlete) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-body transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('env.changeAthlete')}
        </button>
        {module === 'hydration' && <HydrationLab athlete={athlete} />}
        {module === 'heat-adaptation' && <HeatAdaptationLab athlete={athlete} />}
      </div>
    );
  }

  return null;
}
