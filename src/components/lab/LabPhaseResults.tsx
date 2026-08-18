import { useState } from 'react';
import { LabSession, ManualResults } from '../../lib/labSession';
import { PhysiologyResults } from '../../lib/physiology';
import { TrainingZone } from '../../types';
import { buildTrainingZonesData } from '../../lib/trainingZones';
import MetabolicProfile from '../MetabolicProfile';
import TrainingZonesTable from '../TrainingZonesTable';
import AdvancedData from '../AdvancedData';
import CoachNotes from '../CoachNotes';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
}

function Metric({ label, value, unit, badge }: { label: string; value: string | number | null | undefined; unit?: string; badge?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {value !== null && value !== undefined ? value : '—'}
        </span>
        {unit && <span className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">{unit}</span>}
      </div>
      {badge && (
        <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
          {badge}
        </span>
      )}
    </div>
  );
}

function ManualField({ label, value, unit, onChange, step, placeholder }: {
  label: string; value: string; unit?: string; onChange: (v: string) => void;
  step?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}{unit && <span className="text-gray-400 font-normal"> ({unit})</span>}
      </label>
      <input
        type="number"
        step={step || '1'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '—'}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

function buildPhysiologyFromManual(m: ManualResults, athlete: NonNullable<LabSession['athlete']>): PhysiologyResults {
  const hrmax = m.hrmax ?? 220 - (athlete.date_of_birth
    ? new Date().getFullYear() - new Date(athlete.date_of_birth).getFullYear()
    : 30);

  const zones: TrainingZone[] = [];
  if (m.lt1_hr && m.lt2_hr) {
    zones.push({ zone: 1, name: 'Zone 1', hr_min: 0, hr_max: m.lt1_hr - 1, description: 'Recovery / below LT1' });
    zones.push({ zone: 2, name: 'Zone 2', hr_min: m.lt1_hr, hr_max: Math.round((m.lt1_hr + m.lt2_hr) / 2), description: 'Aerobic / LT1–midpoint' });
    zones.push({ zone: 3, name: 'Zone 3', hr_min: Math.round((m.lt1_hr + m.lt2_hr) / 2) + 1, hr_max: m.lt2_hr, description: 'Tempo / LT2' });
    zones.push({ zone: 4, name: 'Zone 4', hr_min: m.lt2_hr + 1, hr_max: hrmax - 5, description: 'Threshold / above LT2' });
    zones.push({ zone: 5, name: 'Zone 5', hr_min: hrmax - 4, hr_max: hrmax, description: 'VO\u2082max / max effort' });
  }

  return {
    vo2max: m.vo2max ?? null,
    vo2max_confidence: 'measured',
    vo2max_ml_kg_min: m.vo2max ?? null,
    vo2max_ml_kg_lbm_min: null,
    vo2max_ml_kg_ffm_min: null,
    vo2max_ml_kg_muscle_min: null,
    vo2max_ml_min: m.vo2max_absolute ?? null,
    lt1_hr: m.lt1_hr ?? null,
    lt1_power: m.lt1_power ?? null,
    lt1_pace: null,
    lt1_vo2: m.lt1_vo2 ?? null,
    lt1_percent_vo2max: m.vo2max && m.lt1_vo2 ? Math.round((m.lt1_vo2 / m.vo2max) * 100) : null,
    lt1_percent_hrmax: m.lt1_hr ? Math.round((m.lt1_hr / hrmax) * 100) : null,
    lt1_confidence: 'measured',
    lt2_hr: m.lt2_hr ?? null,
    lt2_power: m.lt2_power ?? null,
    lt2_pace: null,
    lt2_vo2: m.lt2_vo2 ?? null,
    lt2_percent_vo2max: m.vo2max && m.lt2_vo2 ? Math.round((m.lt2_vo2 / m.vo2max) * 100) : null,
    lt2_percent_hrmax: m.lt2_hr ? Math.round((m.lt2_hr / hrmax) * 100) : null,
    lt2_confidence: 'measured',
    fatmax_hr: m.fatmax_hr ?? null,
    fatmax_power: m.fatmax_power ?? null,
    fatmax_pace: null,
    fatmax_vo2: null,
    fatmax_confidence: 'measured',
    vam_kmh: m.vam_kmh ?? null,
    pam_watts: m.pam_watts ?? null,
    hr_drift_percent: null,
    hrmax,
    hrmax_confidence: m.hrmax ? 'measured' : 'estimated',
    training_zones: zones,
    zones_data: buildTrainingZonesData(m.lt1_hr ?? null, m.lt2_hr ?? null, hrmax, athlete.sport ?? 'other', '5', undefined, { vam_kmh: m.vam_kmh ?? null, pam_watts: m.pam_watts ?? null }),
    data_quality: 'Manual Entry (VO\u2082 Master)',
    data_quality_score: 95,
    metabolic_profile: { aerobic_capacity: 'Manual entry', fat_utilization: 'unknown', anaerobic_contribution: 'unknown', durability: 'unknown' },
    stage_analysis: [],
    has_power: !!(m.lt1_power || m.lt2_power || m.pam_watts),
    has_lactate: false,
    has_vo2: true,
    has_rer: false,
    has_pace: false,
    threshold_source: 'lactate',
    thresholds: {
      LT1: { hr: m.lt1_hr ?? null, vo2: m.lt1_vo2 ?? null, power: m.lt1_power ?? null, pace: null, percent_vo2max: m.vo2max && m.lt1_vo2 ? Math.round((m.lt1_vo2 / m.vo2max) * 100) : null, percent_hrmax: m.lt1_hr ? Math.round((m.lt1_hr / hrmax) * 100) : null, confidence: 'measured' },
      LT2: { hr: m.lt2_hr ?? null, vo2: m.lt2_vo2 ?? null, power: m.lt2_power ?? null, pace: null, percent_vo2max: m.vo2max && m.lt2_vo2 ? Math.round((m.lt2_vo2 / m.vo2max) * 100) : null, percent_hrmax: m.lt2_hr ? Math.round((m.lt2_hr / hrmax) * 100) : null, confidence: 'measured' },
      VT1: { hr: m.lt1_hr ?? null, vo2: m.lt1_vo2 ?? null, power: m.lt1_power ?? null, pace: null, percent_vo2max: m.vo2max && m.lt1_vo2 ? Math.round((m.lt1_vo2 / m.vo2max) * 100) : null, percent_hrmax: m.lt1_hr ? Math.round((m.lt1_hr / hrmax) * 100) : null, confidence: 'estimated' },
      VT2: { hr: m.lt2_hr ?? null, vo2: m.lt2_vo2 ?? null, power: m.lt2_power ?? null, pace: null, percent_vo2max: m.vo2max && m.lt2_vo2 ? Math.round((m.lt2_vo2 / m.vo2max) * 100) : null, percent_hrmax: m.lt2_hr ? Math.round((m.lt2_hr / hrmax) * 100) : null, confidence: 'estimated' },
      vt_source: 'estimated_from_lt',
      delta_lt1_vt1_hr: null,
      delta_lt2_vt2_hr: null,
    },
  } as PhysiologyResults;
}

export default function LabPhaseResults({ session, onUpdate, onNext }: Props) {
  const { t } = useLanguage();
  const { results, advancedMetrics, dataPoints, test, athlete } = session;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualMode, setManualMode] = useState(session.manualResultsMode || !results);

  const [form, setForm] = useState<Record<string, string>>(() => {
    const mr = session.manualResults;
    return {
      vo2max: String(mr?.vo2max ?? results?.vo2max ?? ''),
      vo2max_absolute: String(mr?.vo2max_absolute ?? results?.vo2max_ml_min ?? ''),
      lt1_hr: String(mr?.lt1_hr ?? results?.lt1_hr ?? ''),
      lt1_power: String(mr?.lt1_power ?? results?.lt1_power ?? ''),
      lt1_vo2: String(mr?.lt1_vo2 ?? results?.lt1_vo2 ?? ''),
      lt2_hr: String(mr?.lt2_hr ?? results?.lt2_hr ?? ''),
      lt2_power: String(mr?.lt2_power ?? results?.lt2_power ?? ''),
      lt2_vo2: String(mr?.lt2_vo2 ?? results?.lt2_vo2 ?? ''),
      fatmax_hr: String(mr?.fatmax_hr ?? results?.fatmax_hr ?? ''),
      fatmax_power: String(mr?.fatmax_power ?? results?.fatmax_power ?? ''),
      hrmax: String(mr?.hrmax ?? results?.hrmax ?? ''),
      vam_kmh: String(mr?.vam_kmh ?? results?.vam_kmh ?? ''),
      pam_watts: String(mr?.pam_watts ?? results?.pam_watts ?? ''),
      rmr_kcal: String(mr?.rmr_kcal ?? session.preTestData?.rmr_kcal ?? ''),
    };
  });

  const setField = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleApplyManual = () => {
    if (!athlete) return;
    const mr: ManualResults = {
      vo2max: form.vo2max ? parseFloat(form.vo2max) : null,
      vo2max_absolute: form.vo2max_absolute ? parseFloat(form.vo2max_absolute) : null,
      lt1_hr: form.lt1_hr ? parseInt(form.lt1_hr) : null,
      lt1_power: form.lt1_power ? parseInt(form.lt1_power) : null,
      lt1_vo2: form.lt1_vo2 ? parseFloat(form.lt1_vo2) : null,
      lt2_hr: form.lt2_hr ? parseInt(form.lt2_hr) : null,
      lt2_power: form.lt2_power ? parseInt(form.lt2_power) : null,
      lt2_vo2: form.lt2_vo2 ? parseFloat(form.lt2_vo2) : null,
      fatmax_hr: form.fatmax_hr ? parseInt(form.fatmax_hr) : null,
      fatmax_power: form.fatmax_power ? parseInt(form.fatmax_power) : null,
      hrmax: form.hrmax ? parseInt(form.hrmax) : null,
      vam_kmh: form.vam_kmh ? parseFloat(form.vam_kmh) : null,
      pam_watts: form.pam_watts ? parseInt(form.pam_watts) : null,
      rmr_kcal: form.rmr_kcal ? parseFloat(form.rmr_kcal) : null,
    };
    const built = buildPhysiologyFromManual(mr, athlete);
    onUpdate({ manualResults: mr, manualResultsMode: true, results: built });
    setManualMode(false);
  };

  const activeResults = results;

  if (!athlete) return null;

  const testDate = test?.test_date ? new Date(test.test_date).toLocaleDateString() : new Date().toLocaleDateString();
  const testType = test?.test_type?.replace('_', ' ') ?? 'manual';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('results.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {athlete.name} · {testDate} · {testType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeResults && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              activeResults.data_quality.includes('Excellent')
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : activeResults.data_quality.includes('Good') || activeResults.data_quality.includes('Manual')
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}>
              {activeResults.data_quality}
            </span>
          )}
          <button
            onClick={() => setManualMode(!manualMode)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              manualMode
                ? 'bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-400'
                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {manualMode ? t('results.hideManual') : t('results.showManual')}
          </button>
        </div>
      </div>

      {manualMode && (
        <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-orange-200 dark:border-orange-800">
            <h2 className="text-sm font-semibold text-orange-900 dark:text-orange-300">{t('results.manualTitle')}</h2>
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">{t('results.manualDesc')}</p>
          </div>
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <ManualField label="VO\u2082max" unit="ml/kg/min" value={form.vo2max} onChange={v => setField('vo2max', v)} step="0.1" placeholder="e.g. 68" />
            <ManualField label="VO\u2082max absolute" unit="L/min" value={form.vo2max_absolute} onChange={v => setField('vo2max_absolute', v)} step="0.01" placeholder="e.g. 5.1" />
            <ManualField label="HR max" unit="bpm" value={form.hrmax} onChange={v => setField('hrmax', v)} placeholder="e.g. 188" />
            <ManualField label="LT1 HR" unit="bpm" value={form.lt1_hr} onChange={v => setField('lt1_hr', v)} placeholder="e.g. 142" />
            <ManualField label="LT1 Power" unit="W" value={form.lt1_power} onChange={v => setField('lt1_power', v)} placeholder="e.g. 220" />
            <ManualField label="LT1 VO\u2082" unit="ml/kg/min" value={form.lt1_vo2} onChange={v => setField('lt1_vo2', v)} step="0.1" placeholder="optional" />
            <ManualField label="LT2 HR" unit="bpm" value={form.lt2_hr} onChange={v => setField('lt2_hr', v)} placeholder="e.g. 162" />
            <ManualField label="LT2 Power" unit="W" value={form.lt2_power} onChange={v => setField('lt2_power', v)} placeholder="e.g. 280" />
            <ManualField label="LT2 VO\u2082" unit="ml/kg/min" value={form.lt2_vo2} onChange={v => setField('lt2_vo2', v)} step="0.1" placeholder="optional" />
            <ManualField label="FatMax HR" unit="bpm" value={form.fatmax_hr} onChange={v => setField('fatmax_hr', v)} placeholder="optional" />
            <ManualField label="FatMax Power" unit="W" value={form.fatmax_power} onChange={v => setField('fatmax_power', v)} placeholder="optional" />
            <ManualField label="VAM" unit="km/h" value={form.vam_kmh} onChange={v => setField('vam_kmh', v)} step="0.1" placeholder="optional" />
            <ManualField label="PAM" unit="W" value={form.pam_watts} onChange={v => setField('pam_watts', v)} placeholder="optional" />
            <ManualField label="RMR" unit="kcal/day" value={form.rmr_kcal} onChange={v => setField('rmr_kcal', v)} placeholder="e.g. 1850" />
          </div>
          <div className="px-6 pb-6 flex justify-end">
            <button
              onClick={handleApplyManual}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              {t('results.applyManual')}
            </button>
          </div>
        </div>
      )}

      {activeResults && !manualMode && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('results.coreMarkers')}</h2>
              <div className="flex gap-2">
                {activeResults.has_vo2 && (
                  <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">{t('results.vo2measured')}</span>
                )}
                {activeResults.has_lactate && (
                  <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">{t('results.lactate')}</span>
                )}
                {activeResults.has_power && (
                  <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">{t('results.power')}</span>
                )}
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <Metric
                label="VO\u2082max"
                value={activeResults.vo2max ? Math.round(activeResults.vo2max) : null}
                unit="ml/kg/min"
                badge={activeResults.vo2max_confidence !== 'measured' ? activeResults.vo2max_confidence : undefined}
              />
              <Metric label="LT1 HR" value={activeResults.lt1_hr} unit="bpm" />
              {activeResults.lt1_power && <Metric label="LT1 Power" value={activeResults.lt1_power} unit="W" />}
              <Metric label="LT2 HR" value={activeResults.lt2_hr} unit="bpm" />
              {activeResults.lt2_power && <Metric label="LT2 Power" value={activeResults.lt2_power} unit="W" />}
              {activeResults.fatmax_hr && <Metric label="FatMax HR" value={activeResults.fatmax_hr} unit="bpm" />}
              {activeResults.vam_kmh && <Metric label="VAM" value={activeResults.vam_kmh.toFixed(1)} unit="km/h" />}
              {activeResults.pam_watts && <Metric label="PAM" value={activeResults.pam_watts} unit="W" />}
              {activeResults.hr_drift_percent !== null && activeResults.hr_drift_percent !== undefined && (
                <Metric label="HR Drift" value={activeResults.hr_drift_percent.toFixed(1)} unit="%" />
              )}
              {session.preTestData?.rmr_kcal && (
                <Metric label="RMR" value={session.preTestData.rmr_kcal} unit="kcal/day" />
              )}
              {session.manualResults?.rmr_kcal && (
                <Metric label="RMR" value={session.manualResults.rmr_kcal} unit="kcal/day" />
              )}
              {advancedMetrics?.movementEconomy?.cycling?.watts_per_kg_lbm && (
                <Metric label="W/kg LBM" value={advancedMetrics.movementEconomy.cycling.watts_per_kg_lbm} unit="W/kg" />
              )}
              {advancedMetrics?.movementEconomy?.running?.cost_per_km_ml_o2_kg && (
                <Metric label="Running Economy" value={advancedMetrics.movementEconomy.running.cost_per_km_ml_o2_kg} unit="ml/kg/km" />
              )}
            </div>
          </div>

          <MetabolicProfile results={activeResults} />
          <TrainingZonesTable
            zonesData={activeResults.zones_data}
            zones={activeResults.training_zones}
            sport={test?.sport ?? 'cycling'}
            defaultMode="7"
            lt1_hr={activeResults.lt1_hr}
            lt2_hr={activeResults.lt2_hr}
            hrmax={activeResults.hrmax}
            vam_kmh={activeResults.vam_kmh}
            pam_watts={activeResults.pam_watts}
          />

          {(dataPoints.length > 0 || advancedMetrics) && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('results.advancedMetrics')}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{t('results.advancedDesc')}</p>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAdvanced && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-6">
                  <AdvancedData dataPoints={dataPoints} results={activeResults} advancedMetrics={advancedMetrics} />
                </div>
              )}
            </div>
          )}

          {session.testId && <CoachNotes testId={session.testId} />}
        </>
      )}

      {(activeResults && !manualMode) && (
        <div className="flex justify-end">
          <button
            onClick={onNext}
            className="px-8 py-3 bg-[#fdda36] text-[#514163] rounded-xl font-semibold text-sm hover:bg-[#fdda36]/90 transition-colors shadow-sm"
          >
            {t('results.applyZones')}
          </button>
        </div>
      )}
    </div>
  );
}
