import { useState } from 'react';
import RaceSimulation from '../components/simulation/RaceSimulation';
import AltitudeSimulation from '../components/simulation/AltitudeSimulation';
import InverseSimulation from '../components/simulation/InverseSimulation';
import AltitudeBlockComparison from '../components/simulation/AltitudeBlockComparison';
import SimulationHistory from '../components/simulation/SimulationHistory';
import { useLanguage } from '../contexts/LanguageContext';

type SimTab = 'race' | 'inverse' | 'altitude' | 'altblock' | 'history';

const REFERENCES = [
  {
    id: 1,
    cite: 'Joyner & Coyle (2008)',
    title: 'Endurance exercise performance: the physiology of champions.',
    journal: 'J Physiol, 586(1), 35–44.',
    detail: {
      en: 'VO2max, running economy and lactate threshold as the three key determinants of endurance performance. Foundation of the RE-based race pace model.',
      es: 'VO2max, economía de carrera y umbral de lactato como los tres determinantes del rendimiento de resistencia. Base del modelo de ritmo basado en RE.',
    },
  },
  {
    id: 2,
    cite: 'Faude et al. (2009)',
    title: 'Lactate threshold concepts.',
    journal: 'Sports Med, 39(6), 469–490.',
    detail: {
      en: 'Review of LT1/LT2 definitions and their use in training zone prescription. Basis for LT-based zone splits.',
      es: 'Revisión de definiciones de LT1/LT2 y su uso en la prescripción de zonas de entrenamiento. Base para la distribución de zonas.',
    },
  },
  {
    id: 3,
    cite: 'Margaria et al. (1963) / Daniels (1985)',
    title: 'Running economy as mlO2/kg/km.',
    journal: 'Margaria et al., J Appl Physiol 18:367; Daniels, Sports Med 2:176.',
    detail: {
      en: 'Foundational formulation of running economy as oxygen cost per kg per km. Used in pace-from-VO2max calculation: v = VO2max × 1000 / (RE × 60).',
      es: 'Formulación de la economía de carrera como coste de oxígeno por kg por km. Usada en el cálculo de ritmo a partir de VO2max: v = VO2max × 1000 / (RE × 60).',
    },
  },
  {
    id: 4,
    cite: 'Sawka et al. (2007) / ACSM Position Stand',
    title: 'Exercise and fluid replacement.',
    journal: 'Med Sci Sports Exerc, 39(2), 377–390.',
    detail: {
      en: 'Sweat rate estimation (0.4–2.5 L/h depending on intensity, temperature, humidity). Performance impairment above 2–3% body mass loss. Basis for dehydration risk flags.',
      es: 'Estimación de tasa de sudoración (0.4–2.5 L/h según intensidad, temperatura, humedad). Deterioro del rendimiento por encima del 2–3% de pérdida de masa corporal. Base para alertas de deshidratación.',
    },
  },
  {
    id: 5,
    cite: 'Burke et al. (2011)',
    title: 'Carbohydrates for training and competition.',
    journal: 'J Sports Sci, 29(S1), S17–S27.',
    detail: {
      en: 'Muscle glycogen stores ~400–600 g in trained athletes. CHO oxidation rate proportional to exercise intensity. Basis for bonk estimation (glycogen depletion km).',
      es: 'Reservas de glucógeno muscular ~400–600 g en atletas entrenados. Tasa de oxidación de CHO proporcional a la intensidad. Base para la estimación del bonk.',
    },
  },
  {
    id: 6,
    cite: 'West (2004)',
    title: 'The physiologic basis of high-altitude diseases.',
    journal: 'Ann Intern Med, 141(10), 789–800.',
    detail: {
      en: 'Barometric pressure and alveolar PO2 at altitude. VO2max reduction ~0.32%/100m above 1500m. Basis for altitude VO2max correction and SpO2 estimates.',
      es: 'Presión barométrica y PO2 alveolar en altitud. Reducción del VO2max ~0.32%/100m sobre 1500m. Base para corrección de VO2max en altitud y estimaciones de SpO2.',
    },
  },
  {
    id: 7,
    cite: 'Levine & Stray-Gundersen (1997)',
    title: '"Living high–training low": effect on sea-level performance.',
    journal: 'J Appl Physiol, 83(1), 102–112.',
    detail: {
      en: 'LHTL (Live High Train Low) protocol: optimal altitude 2200–3000m, training at 1200–1500m. Erythropoietic adaptation. Basis for LHTL recommendation and 7-21 day competition window.',
      es: 'Protocolo LHTL: altitud óptima 2200–3000m, entrenamiento a 1200–1500m. Adaptación eritropoyética. Base para la recomendación LHTL y ventana de competición 7-21 días.',
    },
  },
  {
    id: 8,
    cite: 'Stöggl & Sperlich (2014)',
    title: 'Polarized training has greater impact on key endurance variables.',
    journal: 'Front Physiol, 5, 33.',
    detail: {
      en: 'Basis for zone-time distribution models at different VO2max intensities. Z1-Z2 vs threshold vs VO2max splits.',
      es: 'Base para modelos de distribución del tiempo en zonas a distintas intensidades de VO2max. Distribución Z1-Z2 vs umbral vs VO2max.',
    },
  },
  {
    id: 9,
    cite: 'Noakes (2003)',
    title: 'Lore of Running (4th ed.).',
    journal: 'Human Kinetics.',
    detail: {
      en: 'Positive vs negative split strategy effects on lactate kinetics and glycogen use. Basis for strategy-specific fatigue models.',
      es: 'Efectos de estrategia positiva vs negativa en la cinética del lactato y el uso de glucógeno. Base para modelos de fatiga específicos por estrategia.',
    },
  },
  {
    id: 10,
    cite: 'Borg (1970) / Impellizzeri et al. (2004)',
    title: 'Heart rate-based training load and RPE.',
    journal: 'Med Sci Sports, 2:92; Int J Sports Med, 25:341.',
    detail: {
      en: 'HR drift as fatigue proxy. HR increase proportional to dehydration and duration. Basis for animated HR model in race progress.',
      es: 'Deriva de FC como indicador de fatiga. Aumento de FC proporcional a deshidratación y duración. Base para el modelo animado de FC en el progreso de la carrera.',
    },
  },
];

export default function SimulationPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<SimTab>('race');
  const [showRefs, setShowRefs] = useState(false);

  const TABS: { key: SimTab; label: string; desc: string }[] = [
    {
      key: 'race',
      label: language === 'es' ? 'Carrera' : 'Race',
      desc: language === 'es' ? 'Proyección de rendimiento con estrategia' : 'Performance projection with strategy',
    },
    {
      key: 'inverse',
      label: language === 'es' ? 'VO2max necesario' : 'Required VO2max',
      desc: language === 'es' ? '¿Qué VO2max necesito para X tiempo?' : 'What VO2max do I need for a target time?',
    },
    {
      key: 'altitude',
      label: language === 'es' ? 'Altitud' : 'Altitude',
      desc: language === 'es' ? 'Impacto fisiológico de la altitud' : 'Physiological impact of altitude',
    },
    {
      key: 'altblock',
      label: language === 'es' ? 'Bloque de Altitud' : 'Altitude Block',
      desc: language === 'es' ? 'Antes vs. Después del campo de altura' : 'Before vs. after altitude camp',
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
            {language === 'es' ? 'Simulación de Rendimiento' : 'Performance Simulation'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {language === 'es'
              ? 'Proyecciones fisiológicas basadas en el perfil del atleta'
              : 'Physiological projections based on the athlete profile'}
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

      {activeTab === 'race' && <RaceSimulation />}
      {activeTab === 'inverse' && <InverseSimulation />}
      {activeTab === 'altitude' && <AltitudeSimulation />}
      {activeTab === 'altblock' && <AltitudeBlockComparison />}
      {activeTab === 'history' && <SimulationHistory />}
    </div>
  );
}
