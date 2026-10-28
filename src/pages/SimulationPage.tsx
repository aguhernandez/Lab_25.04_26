import { useState } from 'react';
import RaceSimulation from '../components/simulation/RaceSimulation';
import InverseSimulation from '../components/simulation/InverseSimulation';
import SimulationHistory from '../components/simulation/SimulationHistory';
import PhysiologicalSimulation from '../components/simulation/PhysiologicalSimulation';
import { useLanguage } from '../contexts/LanguageContext';

type SimTab = 'physiology' | 'performance' | 'history';

const REFERENCES = [
  {
    id: 1,
    cite: 'Faude et al. (2009)',
    title: 'Lactate threshold concepts.',
    journal: 'Sports Med, 39(6), 469–490.',
    detail: {
      en: 'Threshold methods and the limits of treating LT1, LT2 and MLSS as interchangeable markers.',
      es: 'Métodos de umbral y límites de tratar LT1, LT2 y MLSS como marcadores equivalentes.',
    },
  },
  {
    id: 2,
    cite: 'INSCYD · FAQ',
    title: 'Physiological profile and virtual comparisons.',
    journal: 'https://inscyd.com/faq',
    detail: {
      en: 'Virtual comparisons can explore changes in individual metrics; they do not predict the exact outcome of a training plan.',
      es: 'Las comparaciones virtuales pueden explorar cambios en métricas individuales; no predicen el resultado exacto de un plan de entrenamiento.',
    },
  },
  {
    id: 3,
    cite: 'INSCYD · For Coaches',
    title: 'Metabolic training zones.',
    journal: 'https://inscyd.com/for-coaches',
    detail: {
      en: 'Describes zones using metabolic markers, duration, aerobic/anaerobic contribution and carbohydrate oxidation.',
      es: 'Describe zonas con marcadores metabólicos, duración, contribución aeróbica/anaeróbica y oxidación de carbohidratos.',
    },
  },
];

export default function SimulationPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<SimTab>('physiology');
  const [performanceTab, setPerformanceTab] = useState<'race' | 'inverse'>('race');
  const [showRefs, setShowRefs] = useState(false);

  const TABS: { key: SimTab; label: string; desc: string }[] = [
    {
      key: 'physiology',
      label: language === 'es' ? 'Fisiología' : 'Physiology',
      desc: language === 'es' ? 'Escenarios metabólicos y prescripción de zonas' : 'Metabolic scenarios and zone prescription',
    },
    {
      key: 'performance',
      label: language === 'es' ? 'Rendimiento' : 'Performance',
      desc: language === 'es' ? 'Proyecciones de carrera' : 'Race projections',
    },
    {
      key: 'history',
      label: language === 'es' ? 'Historial' : 'History',
      desc: language === 'es' ? 'Simulaciones guardadas' : 'Saved simulations',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'es' ? 'Simulación Fisiológica' : 'Physiological Simulation'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'es'
              ? 'Explora escenarios metabólicos y prescribe zonas a partir de mediciones'
              : 'Explore metabolic scenarios and prescribe zones from measured data'}
          </p>
        </div>
        <button
          onClick={() => setShowRefs(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 hover:border-blue-400 transition-all"
        >
          <span className="text-base leading-none">①</span>
          {language === 'es' ? 'Referencias bibliográficas' : 'References'}
        </button>
      </div>

      {showRefs && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
            {language === 'es'
              ? 'Referencias científicas de los modelos de cálculo'
              : 'Scientific references for the calculation models'}
          </h3>
          <div className="space-y-3">
            {REFERENCES.map(ref => (
              <div key={ref.id} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-xs flex items-center justify-center font-bold mt-0.5">
                  {ref.id}
                </span>
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {ref.cite} — <span className="italic font-normal">{ref.title}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{ref.journal}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {language === 'es' ? ref.detail.es : ref.detail.en}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            title={tab.desc}
            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'physiology' && <PhysiologicalSimulation />}
      {activeTab === 'performance' && <>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          <button type="button" onClick={() => setPerformanceTab('race')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${performanceTab === 'race' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{language === 'es' ? 'Carrera' : 'Race'}</button>
          <button type="button" onClick={() => setPerformanceTab('inverse')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${performanceTab === 'inverse' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{language === 'es' ? 'VO₂max necesario' : 'Required VO₂max'}</button>
        </div>
        {performanceTab === 'race' ? <RaceSimulation /> : <InverseSimulation />}
      </>}
      {activeTab === 'history' && <SimulationHistory />}
    </div>
  );
}
