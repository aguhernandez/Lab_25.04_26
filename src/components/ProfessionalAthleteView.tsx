import { useEffect, useState } from 'react';
import { Athlete } from '../types';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import AthleteDetail from './AthleteDetail';
import ResultsView from './ResultsView';
import AnthropometryPage from '../pages/AnthropometryPage';
import EnvironmentalPhysiology from '../pages/EnvironmentalPhysiology';
import ForceVelocityLab from '../pages/ForceVelocityLab';
import BiochemicalLab from '../pages/BiochemicalLab';
import DataConfidenceBadge, { ConfidenceLevel } from './DataConfidenceBadge';

type TabId = 'passport' | 'vo2' | 'lactate' | 'isak' | 'environment' | 'force' | 'biochemistry';
interface TestSummary { id: string; test_date: string; status: string; }
interface Confidence { level: ConfidenceLevel; reason: string; }
const noData = (reason: string): Confidence => ({ level: 'no-data', reason });

interface Props {
  athlete: Athlete;
  onStartTest: () => void;
  onViewResults: (testId: string) => void;
  onEditAthlete?: () => void;
  onAthleteDeleted?: () => void;
}

export default function ProfessionalAthleteView(props: Props) {
  const { athlete } = props;
  const { language } = useLanguage();
  const es = language === 'es';
  const [tab, setTab] = useState<TabId>('passport');
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [content, setContent] = useState<Record<TabId, boolean>>({ passport: true, vo2: false, lactate: false, isak: false, environment: false, force: false, biochemistry: false });
  const [confidence, setConfidence] = useState<Record<TabId, Confidence>>({
    passport: noData(''), vo2: noData(''), lactate: noData(''), isak: noData(''), environment: noData(''), force: noData(''), biochemistry: noData(''),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      setLoading(true);
      const [testsRes, anthroRes, hydrationRes, heatRes, forceRes, bioRes] = await Promise.all([
        supabase.from('tests').select('id, test_date, status').eq('athlete_id', athlete.id).order('test_date', { ascending: false }),
        supabase.from('anthropometry_measurements').select('*').eq('athlete_id', athlete.id).order('measurement_date', { ascending: false }).limit(1),
        supabase.from('athlete_hydration_sessions').select('*').eq('athlete_id', athlete.id).order('session_date', { ascending: false }).limit(1),
        supabase.from('athlete_heat_sessions').select('*').eq('athlete_id', athlete.id).order('session_date', { ascending: false }).limit(1),
        supabase.from('fv_sessions').select('*').eq('athlete_id', athlete.id).order('session_date', { ascending: false }).limit(1),
        supabase.from('biochemical_tests').select('*').eq('athlete_id', athlete.id).order('test_date', { ascending: false }).limit(1),
      ]);
      const loadedTests = (testsRes.data || []) as TestSummary[];
      const completed = loadedTests.filter(t => t.status === 'completed');
      const completedIds = completed.map(t => t.id);
      let hasVo2 = false;
      let hasLactate = false;
      let vo2Confidence = noData(es ? 'No hay resultados de fisiología para los tests completados.' : 'No physiology results are available for completed tests.');
      let lactateConfidence = noData(es ? 'No hay puntos de lactato registrados.' : 'No lactate points are recorded.');
      if (completedIds.length) {
        const [resultsRes, pointsRes, timelinePointsRes] = await Promise.all([
          supabase.from('test_results').select('test_id, vo2max, lt1_hr, lt2_hr, data_quality, breath_data, device_profile_id').in('test_id', completedIds),
          supabase.from('test_data_points').select('test_id, lactate, heart_rate, rpe').in('test_id', completedIds).not('lactate', 'is', null),
          supabase.from('test_timeline_samples').select('test_id, lactate, heart_rate, rpe').in('test_id', completedIds).not('lactate', 'is', null),
        ]);
        hasVo2 = (resultsRes.data || []).some(r => r.vo2max != null || r.lt1_hr != null || r.lt2_hr != null);
        const latestCompleted = completed[0];
        const latestResult = (resultsRes.data || []).find(r => r.test_id === latestCompleted?.id);
        const quality = String(latestResult?.data_quality || '').toLowerCase();
        const breathCount = Array.isArray(latestResult?.breath_data) ? latestResult.breath_data.length : 0;
        let deviceHasCo2: boolean | null = null;
        if (latestResult?.device_profile_id) {
          const { data: device } = await supabase.from('device_profiles').select('column_mapping').eq('id', latestResult.device_profile_id).maybeSingle();
          if (device?.column_mapping && typeof device.column_mapping === 'object') {
            deviceHasCo2 = Object.values(device.column_mapping as Record<string, unknown>).includes('vco2_mlmin');
          }
        }
        if (latestResult && (latestResult.vo2max != null || latestResult.lt1_hr != null || latestResult.lt2_hr != null)) {
          if (quality.includes('excellent')) vo2Confidence = { level: 'high', reason: es ? `Calidad registrada: ${latestResult.data_quality}${breathCount ? `; ${breathCount} muestras respiratorias guardadas` : ''}.` : `Recorded quality: ${latestResult.data_quality}${breathCount ? `; ${breathCount} breath samples saved` : ''}.` };
          else if (quality.includes('good')) vo2Confidence = { level: 'medium', reason: es ? `Calidad registrada: ${latestResult.data_quality}.` : `Recorded quality: ${latestResult.data_quality}.` };
          else if (quality.includes('fair') || quality.includes('basic') || !quality) vo2Confidence = { level: 'low', reason: quality ? (es ? `Calidad registrada: ${latestResult.data_quality}.` : `Recorded quality: ${latestResult.data_quality}.`) : (es ? 'El resultado no guarda una etiqueta de calidad.' : 'The result has no saved data-quality label.') };
          else vo2Confidence = { level: 'low', reason: es ? `Resultado importado o manual (${latestResult.data_quality}); no hay una etiqueta de calidad comparable.` : `Manual or imported result (${latestResult.data_quality}); no comparable quality label is available.` };
          if (!breathCount && latestResult.device_profile_id) {
            vo2Confidence = { level: 'medium', reason: es ? 'Hay perfil de dispositivo asociado, pero el resultado no conserva muestras respiratorias.' : 'A device profile is linked, but breath samples are not retained in this result.' };
          }
          if (deviceHasCo2 === false) {
            vo2Confidence = { level: 'medium', reason: es ? 'El mapeo del dispositivo no incluye VCO₂; la disponibilidad de V-slope queda limitada.' : 'The device mapping does not include VCO₂; V-slope availability is limited.' };
          }
        }
        const lactatePoints = [ ...(pointsRes.data || []), ...(timelinePointsRes.data || []) ].filter(p => p.test_id === latestCompleted?.id);
        hasLactate = lactatePoints.length > 0;
        if (hasLactate) {
          const missingHR = lactatePoints.some(p => p.heart_rate == null);
          const missingRpe = lactatePoints.some(p => p.rpe == null);
          if (!missingHR && !missingRpe) lactateConfidence = { level: 'high', reason: es ? 'Todos los puntos de lactato visibles tienen FC y RPE.' : 'Every available lactate point also has heart rate and RPE.' };
          else if (missingHR && missingRpe) lactateConfidence = { level: 'low', reason: es ? 'A los puntos de lactato les faltan FC y RPE.' : 'Lactate points are missing both heart rate and RPE.' };
          else lactateConfidence = { level: 'medium', reason: es ? `A algunos puntos de lactato les falta ${missingHR ? 'FC' : 'RPE'}.` : `Some lactate points are missing ${missingHR ? 'heart rate' : 'RPE'}.` };
        }
      }

      const measurement = (anthroRes.data || [])[0] as Record<string, any> | undefined;
      const measurementValue = (key: string) => {
        const value = measurement?.[key];
        if (value == null) return false;
        if (typeof value === 'object') return ['median', 'm1', 'm2', 'm3'].some(k => value[k] != null);
        return value !== '';
      };
      const requiredISAK = ['body_mass_kg', 'stature_cm', 'triceps_sf_mm', 'subscapular_sf_mm', 'supraspinale_sf_mm', 'abdominal_sf_mm', 'front_thigh_sf_mm', 'medial_calf_sf_mm', 'arm_flexed_girth_cm', 'chest_girth_cm', 'thigh_upper_girth_cm', 'calf_max_girth_cm'];
      const isakMissing = requiredISAK.filter(key => !measurementValue(key));
      const quality = String(measurement?.measurement_quality || '').toLowerCase();
      const isakConfidence: Confidence = !measurement
        ? noData(es ? 'No hay mediciones ISAK guardadas.' : 'No ISAK measurements are saved.')
        : measurement.validation_status === 'rejected' || quality === 'poor' || isakMissing.length > 0
          ? { level: 'low', reason: es ? `Validación/calidad registrada: ${measurement.validation_status || quality || (isakMissing.length ? `faltan ${isakMissing.length} campos requeridos` : 'sin valoración')}.` : `Recorded validation/quality: ${measurement.validation_status || quality || (isakMissing.length ? `${isakMissing.length} required fields missing` : 'not assessed')}.` }
          : measurement.validation_status === 'validated' && (quality === 'excellent' || quality === 'good')
            ? { level: 'high', reason: es ? `Medición ${measurement.validation_status}; calidad ${quality}; campos requeridos completos.` : `Measurement ${measurement.validation_status}; ${quality} quality; required fields complete.` }
            : { level: 'medium', reason: es ? `Estado guardado: ${measurement.validation_status || 'sin validar'}; calidad: ${quality || 'sin valorar'}.` : `Saved status: ${measurement.validation_status || 'not validated'}; quality: ${quality || 'not assessed'}.` };

      const hydration = (hydrationRes.data || [])[0] as Record<string, unknown> | undefined;
      const heat = (heatRes.data || [])[0] as Record<string, unknown> | undefined;
      const envMissing: string[] = [];
      if (hydration) for (const key of ['pre_weight_kg', 'post_weight_kg', 'duration_min']) if (hydration[key] == null) envMissing.push(key);
      if (heat) for (const key of ['temperature_c', 'duration_min']) if (heat[key] == null) envMissing.push(key);
      const hasEnvironment = !!hydration || !!heat;
      const hydrationContextFields = ['fluid_intake_l', 'urine_output_l', 'temperature_c', 'humidity_percent', 'avg_hr', 'rpe', 'usg_pre'];
      const heatContextFields = ['humidity_percent', 'avg_hr', 'hr_first_half', 'hr_second_half', 'external_load', 'pre_weight_kg', 'post_weight_kg', 'rpe'];
      const envOptionalMissing = [
        ...(hydration ? hydrationContextFields.filter(key => hydration[key] == null) : []),
        ...(heat ? heatContextFields.filter(key => heat[key] == null) : []),
      ];
      const envConfidence: Confidence = !hasEnvironment
        ? noData(es ? 'No hay sesiones de hidratación ni calor.' : 'No hydration or heat sessions are saved.')
        : envMissing.length
          ? { level: 'low', reason: es ? `Faltan campos base de la sesión: ${envMissing.join(', ')}.` : `Core session fields are missing: ${envMissing.join(', ')}.` }
          : envOptionalMissing.length === 0
            ? { level: 'high', reason: es ? 'Los campos base y contextuales disponibles están completos en la sesión.' : 'Core and available contextual session fields are complete.' }
            : { level: 'medium', reason: es ? 'Los campos base están completos; algunos campos contextuales opcionales no están registrados.' : 'Core fields are complete; some optional contextual fields are not recorded.' };

      const fvSession = (forceRes.data || [])[0] as Record<string, any> | undefined;
      let forceConfidence: Confidence = !fvSession
        ? noData(es ? 'No hay sesiones de fuerza-velocidad.' : 'No force-velocity sessions are saved.')
        : noData(es ? 'La sesión no tiene repeticiones válidas disponibles.' : 'The session has no valid repetitions available.');
      if (fvSession) {
        const { data: reps } = await supabase.from('fv_repetitions').select('load_kg, data_source, is_valid').eq('session_id', fvSession.id);
        const validReps = reps || [];
        if (validReps.some(rep => !rep.is_valid)) forceConfidence = { level: 'low', reason: es ? 'La sesión contiene repeticiones marcadas como inválidas.' : 'The session contains repetitions marked invalid.' };
        else if (validReps.length > 0 && validReps.every(rep => rep.data_source === 'encoder')) forceConfidence = { level: 'high', reason: es ? 'Las repeticiones guardadas son válidas y proceden de encoder.' : 'Saved repetitions are valid and sourced from an encoder.' };
        else if (validReps.length > 0) forceConfidence = { level: 'medium', reason: es ? 'Las repeticiones válidas usan entrada manual o video.' : 'Valid repetitions use manual or video input.' };
      }

      const biochemical = (bioRes.data || [])[0] as Record<string, unknown> | undefined;
      const bioDomains = ['oxygen_transport', 'recovery', 'inflammation', 'hormonal', 'energy_availability', 'nutrition', 'metabolic_health', 'hydration_renal'];
      const populatedDomains = bioDomains.filter(key => {
        const value = biochemical?.[key];
        return !!value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0;
      }).length;
      const bioConfidence: Confidence = !biochemical
        ? noData(es ? 'No hay paneles bioquímicos guardados.' : 'No biochemical panels are saved.')
        : populatedDomains === bioDomains.length
          ? { level: 'high', reason: es ? 'Los ocho dominios guardan marcadores.' : 'All eight domains contain marker values.' }
          : populatedDomains > 0
            ? { level: 'medium', reason: es ? `Hay marcadores en ${populatedDomains} de 8 dominios.` : `Markers are present in ${populatedDomains} of 8 domains.` }
            : noData(es ? 'El test existe, pero no contiene marcadores de los paneles.' : 'The test exists but contains no panel markers.');
      if (!cancelled) {
        setTests(loadedTests);
        setContent({
          passport: true,
          vo2: hasVo2,
          lactate: hasLactate,
          isak: (anthroRes.data || []).length > 0,
          environment: (hydrationRes.data || []).length > 0 || (heatRes.data || []).length > 0,
          force: (forceRes.data || []).length > 0,
          biochemistry: (bioRes.data || []).length > 0,
        });
        setConfidence({
          passport: noData(''),
          vo2: vo2Confidence,
          lactate: lactateConfidence,
          isak: isakConfidence,
          environment: envConfidence,
          force: forceConfidence,
          biochemistry: bioConfidence,
        });
        setLoading(false);
      }
    }
    void loadAvailability();
    return () => { cancelled = true; };
  }, [athlete.id]);

  const latestTest = tests[0];
  const latestCompletedTest = tests.find(test => test.status === 'completed');
  const status = !latestTest
    ? (es ? 'Sin test' : 'No test')
    : tests.some(test => test.status === 'in_progress')
      ? (es ? 'Test en curso o incompleto' : 'Test in progress or incomplete')
      : tests.some(test => test.status === 'completed')
        ? (es ? 'Test completado' : 'Test completed')
        : (es ? 'Sin test' : 'No test');

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'passport', label: es ? 'Pasaporte' : 'Passport' },
    { id: 'vo2', label: 'VO₂' },
    { id: 'lactate', label: es ? 'Lactato' : 'Lactate' },
    { id: 'isak', label: 'ISAK' },
    { id: 'environment', label: es ? 'Calor y altitud' : 'Heat & altitude' },
    { id: 'force', label: es ? 'Fuerza y potencia' : 'Strength & power' },
    { id: 'biochemistry', label: es ? 'Bioquímica' : 'Biochemistry' },
  ];

  const empty = <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-12 text-center text-sm text-gray-500 dark:text-gray-400">{es ? 'Módulo no evaluado' : 'Module not evaluated'}</div>;
  const confidencePanel = tab !== 'passport' && content[tab] ? <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
    <span>{es ? 'Confianza del dato' : 'Data confidence'}</span>
    <DataConfidenceBadge level={confidence[tab].level} reason={confidence[tab].reason} />
  </div> : null;

  function renderTab() {
    if (tab === 'passport') return <AthleteDetail key={athlete.id} athlete={athlete} onStartTest={props.onStartTest} onViewResults={props.onViewResults} onEditAthlete={props.onEditAthlete} onAthleteDeleted={props.onAthleteDeleted} />;
    if (tab === 'vo2' || tab === 'lactate') return content[tab] && latestCompletedTest ? <ResultsView key={`${athlete.id}-${latestCompletedTest.id}-${tab}`} testId={latestCompletedTest.id} /> : empty;
    if (tab === 'isak') return content.isak ? <AnthropometryPage key={athlete.id} initialAthlete={athlete} lockAthlete /> : empty;
    if (tab === 'environment') return content.environment ? <EnvironmentalPhysiology key={athlete.id} initialAthlete={athlete} /> : empty;
    if (tab === 'force') return content.force ? <ForceVelocityLab key={athlete.id} initialAthlete={athlete} /> : empty;
    return content.biochemistry ? <BiochemicalLab key={athlete.id} initialAthlete={athlete} lockAthlete /> : empty;
  }

  return <div className="space-y-4">
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{es ? 'Atleta' : 'Athlete'}</p>
        <h1 className="mt-1 text-xl font-bold text-gray-900 dark:text-white truncate">{athlete.name}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-gray-700 dark:text-gray-200">{status}</span>
        <span className="text-gray-600 dark:text-gray-300">{es ? 'Último test' : 'Last test'}: <span className="font-medium tabular-nums">{latestTest ? new Date(latestTest.test_date).toLocaleDateString(es ? 'es-ES' : 'en-US') : '—'}</span></span>
      </div>
    </section>
    <nav className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 gap-1" role="tablist" aria-label={es ? 'Módulos del atleta' : 'Athlete modules'}>
      {tabs.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap px-3 py-2.5 border-b-2 text-sm font-medium transition-colors ${tab === item.id ? 'border-[#514163] text-[#514163] dark:border-[#fdda36] dark:text-[#fdda36]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>{item.label}</button>)}
    </nav>
    <div role="tabpanel" className="min-w-0">{loading && tab !== 'passport' ? <div className="py-10 text-center text-sm text-gray-500">{es ? 'Cargando módulos…' : 'Loading modules…'}</div> : <>{confidencePanel}{renderTab()}</>}</div>
  </div>;
}
