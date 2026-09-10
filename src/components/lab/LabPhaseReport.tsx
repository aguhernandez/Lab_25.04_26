import { useState, useEffect } from 'react';
import { LabSession } from '../../lib/labSession';
import { exportJSONToFile } from '../../lib/jsonGenerator';
import { generateCompleteJSON } from '../../lib/jsonGenerator';
import { REPORT_TYPE_PRESETS } from '../../lib/reportGenerator';
import ReportBuilder from '../reports/ReportBuilder';
import RichTextEditor from '../RichTextEditor';
import Toast from '../Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import type { ReportData } from '../../lib/reportGenerator';
import { supabase } from '../../lib/supabase';

interface Props {
  session: LabSession;
  onBack: () => void;
  onStartNew: () => void;
}

export default function LabPhaseReport({ session, onBack, onStartNew }: Props) {
  const { t } = useLanguage();
  const [showBuilder, setShowBuilder] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [coachNotes, setCoachNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (session.testId) {
      supabase
        .from('test_results')
        .select('coach_notes')
        .eq('test_id', session.testId)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.coach_notes) setCoachNotes(data.coach_notes);
        });
    }
  }, [session.testId]);

  const handleSaveNotes = async () => {
    if (!session.testId) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from('test_results')
      .update({ coach_notes: coachNotes, updated_at: new Date().toISOString() })
      .eq('test_id', session.testId);
    setSavingNotes(false);
    if (error) {
      setToast({ message: 'Failed to save notes', type: 'error' });
    } else {
      setToast({ message: 'Notes saved', type: 'success' });
    }
  };

  const { results, advancedMetrics, dataPoints, test, athlete } = session;

  const handleExportJSON = () => {
    if (!athlete || !test || !results) return;
    try {
      const json = generateCompleteJSON(athlete, test, dataPoints, results, advancedMetrics ?? undefined);
      exportJSONToFile(json);
      setToast({ message: 'JSON exported successfully.', type: 'success' });
    } catch {
      setToast({ message: 'Export failed. Please try again.', type: 'error' });
    }
  };

  const getSummary = () => {
    if (!results || !athlete) return null;
    const lines: string[] = [];
    lines.push(`Athlete: ${athlete.name}`);
    if (test) lines.push(`Date: ${new Date(test.test_date).toLocaleDateString()}`);
    if (results.vo2max) lines.push(`VO\u2082max: ${(Math.round(results.vo2max * 10) / 10).toFixed(1)} ml/kg/min (${results.vo2max_confidence})`);
    if (results.lt1_hr) lines.push(`LT1: ${results.lt1_hr} bpm${results.lt1_power ? ` / ${results.lt1_power} W` : ''}`);
    if (results.lt2_hr) lines.push(`LT2: ${results.lt2_hr} bpm${results.lt2_power ? ` / ${results.lt2_power} W` : ''}`);
    if (results.fatmax_hr) lines.push(`FatMax: ${results.fatmax_hr} bpm`);
    if (results.vam_kmh) lines.push(`VAM: ${results.vam_kmh.toFixed(1)} km/h`);
    if (results.pam_watts) lines.push(`PAM: ${results.pam_watts} W`);
    lines.push(`Data quality: ${results.data_quality}`);
    return lines;
  };

  const summary = getSummary();

  const reportData: ReportData | null = athlete && results ? {
    athlete,
    test,
    physiologyResults: results,
    dataPoints,
    advancedMetrics: advancedMetrics ?? null,
    anthropometryMeasurement: null,
    kerrResults: null,
    hydrationSessions: [],
    preTestData: session.preTestData ?? null,
  } : null;

  if (showBuilder && reportData) {
    return (
      <div className="space-y-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <ReportBuilder
          data={reportData}
          defaultType="lab"
          defaultSections={REPORT_TYPE_PRESETS.lab}
          onClose={() => setShowBuilder(false)}
          manualTrainingZones={session.trainingZones?.heart_rate_zones}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('report.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{athlete?.name}</p>
        </div>
      </div>

      {summary && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t('report.sessionSummary')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {summary.map((line, i) => (
              <p key={i} className="text-sm text-gray-700 dark:text-gray-300">{line}</p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Professional Notes</h2>
          <p className="text-xs text-gray-400 mt-0.5">Add your conclusions and recommendations — these will be included in the generated report</p>
        </div>
        <div className="p-6 space-y-3">
          <RichTextEditor
            value={coachNotes}
            onChange={setCoachNotes}
            placeholder="Write your professional conclusions, training recommendations, and observations here..."
          />
          <div className="flex justify-end">
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes || !session.testId}
              className="px-4 py-2 bg-[#fdda36] text-[#514163] rounded-lg text-sm font-semibold hover:bg-[#fdda36]/90 transition-colors disabled:opacity-50"
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Generate PDF Report</h2>
          <p className="text-xs text-gray-400 mt-0.5">Choose sections, style, and add your branding</p>
        </div>
        <div className="p-6">
          <button
            onClick={() => setShowBuilder(true)}
            disabled={!reportData}
            className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-[#fdda36]/40 hover:border-[#fdda36] hover:bg-[#fdda36]/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-xl bg-[#fdda36]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#fdda36]/20 transition-colors">
              <svg className="w-5 h-5 text-[#514163] dark:text-[#fdda36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Open Report Builder</p>
              <p className="text-xs text-gray-400 mt-0.5">Customize sections, style, and branding for the PDF</p>
            </div>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-between items-center">
        <button
          onClick={handleExportJSON}
          className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t('report.exportJSON')}
        </button>

        <div className="flex gap-3">
          <button
            onClick={onStartNew}
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('report.newSession')}
          </button>
        </div>
      </div>
    </div>
  );
}
