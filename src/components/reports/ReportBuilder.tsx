import { useState, useEffect } from 'react';
import {
  SECTION_DEFINITIONS,
  REPORT_TYPE_PRESETS,
  CHART_DEFINITIONS,
  type ReportSection,
  type ReportStyle,
  type ReportType,
  type ReportBranding,
  type ReportData,
  type ChartSelection,
  type ChartSeriesConfig,
  type ZoneDisplayMode,
  generateReport,
} from '../../lib/reportGenerator';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import RichTextEditor from '../RichTextEditor';
import type { TrainingZone } from '../../types';

interface Props {
  data: ReportData;
  defaultType?: ReportType;
  defaultSections?: ReportSection[];
  onClose?: () => void;
  manualTrainingZones?: TrainingZone[];
  initialPhysiologyNotes?: string;
}

const SECTION_GROUPS = ['General', 'Anthropometry', 'Physiology', 'Environmental', 'Data', 'Conclusions'];

function hasData(section: (typeof SECTION_DEFINITIONS)[0], data: ReportData): boolean {
  for (const req of section.requiresData) {
    if (req === 'physiology' && !data.physiologyResults) return false;
    if (req === 'anthropometry' && !data.kerrResults && !data.anthropometryMeasurement) return false;
    if (req === 'dataPoints' && (!data.dataPoints || data.dataPoints.length === 0)) return false;
    if (req === 'hydration' && (!data.hydrationSessions || data.hydrationSessions.length === 0)) return false;
  }
  return true;
}

export default function ReportBuilder({ data, defaultType = 'custom', defaultSections, onClose, manualTrainingZones, initialPhysiologyNotes }: Props) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [reportType, setReportType] = useState<ReportType>(defaultType);
  const [sections, setSections] = useState<ReportSection[]>(
    defaultSections || REPORT_TYPE_PRESETS[defaultType] || []
  );
  const [style, setStyle] = useState<ReportStyle>('coach');
  const [branding, setBranding] = useState<ReportBranding>({
    labName: '',
    evaluatorName: '',
    credentials: '',
    contactInfo: '',
  });
  const [generating, setGenerating] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [physiologyNotes, setPhysiologyNotes] = useState(initialPhysiologyNotes ?? '');
  const [anthropometryNotes, setAnthropometryNotes] = useState('');
  const [includePhysiologyNotes, setIncludePhysiologyNotes] = useState(true);
  const [includeAnthropometryNotes, setIncludeAnthropometryNotes] = useState(true);
  const [useManualZones, setUseManualZones] = useState(
    !!(manualTrainingZones && manualTrainingZones.length > 0)
  );
  const [zoneDisplayMode, setZoneDisplayMode] = useState<ZoneDisplayMode>('5');
  const [chartSelections, setChartSelections] = useState<ChartSelection[]>(
    CHART_DEFINITIONS.map(def => ({
      type: def.type,
      enabled: false,
      series: Object.fromEntries(def.availableSeries.map(s => [s.key, true])) as ChartSeriesConfig,
    }))
  );

  const hasManualZones = manualTrainingZones && manualTrainingZones.length > 0;

  useEffect(() => {
    loadConfig();
  }, [profile?.id]);

  useEffect(() => {
    if (initialPhysiologyNotes !== undefined) {
      setPhysiologyNotes(initialPhysiologyNotes);
    } else if (data.test?.id) {
      supabase
        .from('test_results')
        .select('coach_notes')
        .eq('test_id', data.test.id)
        .maybeSingle()
        .then(({ data: row }) => {
          if (row?.coach_notes) setPhysiologyNotes(row.coach_notes);
        });
    }
    if (data.anthropometryMeasurement?.coach_notes) {
      setAnthropometryNotes(data.anthropometryMeasurement.coach_notes);
    }
  }, [data.test?.id, data.anthropometryMeasurement?.id, initialPhysiologyNotes]);

  const loadConfig = async () => {
    if (!profile?.id) { setConfigLoaded(true); return; }
    const { data: cfg } = await supabase
      .from('report_configs')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (cfg) {
      setBranding({
        labName: cfg.lab_name || '',
        evaluatorName: cfg.evaluator_name || '',
        credentials: cfg.credentials || '',
        contactInfo: cfg.contact_info || '',
      });
      if (!defaultSections && cfg.last_sections?.length > 0) {
        setSections(cfg.last_sections as ReportSection[]);
      }
      if (cfg.last_style) setStyle(cfg.last_style as ReportStyle);
      if (cfg.last_type && !defaultSections) setReportType(cfg.last_type as ReportType);
    }
    setConfigLoaded(true);
  };

  const saveConfig = async () => {
    if (!profile?.id) return;
    await supabase.from('report_configs').upsert({
      profile_id: profile.id,
      lab_name: branding.labName,
      evaluator_name: branding.evaluatorName,
      credentials: branding.credentials,
      contact_info: branding.contactInfo,
      last_sections: sections,
      last_style: style,
      last_type: reportType,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });
  };

  const handleTypeChange = (type: ReportType) => {
    setReportType(type);
    if (type !== 'custom') {
      setSections(REPORT_TYPE_PRESETS[type]);
    }
  };

  const toggleSection = (key: ReportSection) => {
    setSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
    if (reportType !== 'custom') setReportType('custom');
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await saveConfig();
      await generateReport(data, {
        sections,
        style,
        branding,
        physiologyNotes: includePhysiologyNotes ? physiologyNotes.trim() || undefined : undefined,
        anthropometryNotes: includeAnthropometryNotes ? anthropometryNotes.trim() || undefined : undefined,
        useManualZones: useManualZones && hasManualZones,
        manualTrainingZones: useManualZones && hasManualZones ? manualTrainingZones : undefined,
        zoneDisplayMode,
        charts: chartSelections.some(c => c.enabled) ? chartSelections : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!configLoaded) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const typeOptions: Array<{ value: ReportType; label: string; desc: string }> = [
    { value: 'full', label: t('reportType.full'), desc: t('reportType.fullDesc') },
    { value: 'lab', label: t('reportType.lab'), desc: t('reportType.labDesc') },
    { value: 'anthropometry', label: t('reportType.anthropometry'), desc: t('reportType.anthropometryDesc') },
    { value: 'hydration', label: t('reportType.hydration'), desc: t('reportType.hydrationDesc') },
    { value: 'comparative', label: t('reportType.comparative'), desc: t('reportType.comparativeDesc') },
    { value: 'custom', label: t('reportType.custom'), desc: t('reportType.customDesc') },
  ];

  const styleOptions: Array<{ value: ReportStyle; label: string; desc: string }> = [
    { value: 'scientific', label: t('reportStyle.scientific'), desc: t('reportStyle.scientificDesc') },
    { value: 'coach', label: t('reportStyle.coach'), desc: t('reportStyle.coachDesc') },
    { value: 'athlete', label: t('reportStyle.athlete'), desc: t('reportStyle.athleteDesc') },
    { value: 'minimal', label: t('reportStyle.minimal'), desc: t('reportStyle.minimalDesc') },
  ];

  const grouped = SECTION_GROUPS.map(group => ({
    group,
    groupLabel: t(`reportGroup.${group}`),
    items: SECTION_DEFINITIONS.filter(s => s.group === group),
  })).filter(g => g.items.length > 0);

  const brandingFields: Array<{ key: keyof ReportBranding; labelKey: string; placeholderKey: string }> = [
    { key: 'labName', labelKey: 'reportBuilder.labName', placeholderKey: 'reportBuilder.labNamePlaceholder' },
    { key: 'evaluatorName', labelKey: 'reportBuilder.evaluatorName', placeholderKey: 'reportBuilder.evaluatorPlaceholder' },
    { key: 'credentials', labelKey: 'reportBuilder.credentials', placeholderKey: 'reportBuilder.credentialsPlaceholder' },
    { key: 'contactInfo', labelKey: 'reportBuilder.contactInfo', placeholderKey: 'reportBuilder.contactPlaceholder' },
  ];

  return (
    <div className="space-y-6">
      {onClose && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('reportBuilder.title')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {data.athlete.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('reportBuilder.typeSection')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{t('reportBuilder.typeDesc')}</p>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleTypeChange(opt.value)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    reportType === opt.value
                      ? 'border-[#fdda36] bg-[#fdda36]/10'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <p className={`text-xs font-semibold ${reportType === opt.value ? 'text-[#514163] dark:text-[#fdda36]' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('reportBuilder.sectionsSection')}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{sections.length} {t('reportBuilder.selected')}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSections(SECTION_DEFINITIONS.map(s => s.key)); setReportType('custom'); }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('reportBuilder.all')}
                </button>
                <button
                  onClick={() => { setSections([]); setReportType('custom'); }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('reportBuilder.none')}
                </button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {grouped.map(({ group, groupLabel, items }) => (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{groupLabel}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map(item => {
                      const active = sections.includes(item.key);
                      const available = hasData(item, data);
                      const sectionLabel = t(`reportSection.${item.key}`);
                      return (
                        <button
                          key={item.key}
                          onClick={() => toggleSection(item.key)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all border ${
                            active
                              ? 'bg-[#fdda36]/15 border-[#fdda36]/50 text-gray-900 dark:text-white'
                              : available
                              ? 'bg-white dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                              : 'bg-gray-50 dark:bg-gray-700/20 border-gray-100 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          }`}
                          disabled={!available && !active}
                          title={!available ? t('reportBuilder.noData') : undefined}
                        >
                          <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                            active ? 'bg-[#fdda36] border-[#fdda36]' : 'border-gray-300 dark:border-gray-500'
                          }`}>
                            {active && (
                              <svg className="w-2.5 h-2.5 text-[#514163]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs font-medium leading-tight">{sectionLabel}</span>
                          {!available && (
                            <span className="ml-auto text-xs text-gray-300 dark:text-gray-600 flex-shrink-0">{t('reportBuilder.noData')}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.dataPoints && data.dataPoints.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Charts</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {chartSelections.filter(c => c.enabled).length} chart{chartSelections.filter(c => c.enabled).length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setChartSelections(prev => prev.map(c => ({ ...c, enabled: true })))}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setChartSelections(prev => prev.map(c => ({ ...c, enabled: false })))}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {CHART_DEFINITIONS.map((def, idx) => {
                  const sel = chartSelections[idx];
                  const hasRequiredData = def.requiresData.every(req => {
                    if (req === 'dataPoints') return data.dataPoints && data.dataPoints.length > 0;
                    if (req === 'physiology') return !!data.physiologyResults;
                    return true;
                  });
                  return (
                    <div key={def.type} className={`rounded-xl border transition-all ${
                      sel.enabled ? 'border-[#fdda36]/50 bg-[#fdda36]/5' : 'border-gray-200 dark:border-gray-600'
                    } ${!hasRequiredData ? 'opacity-50' : ''}`}>
                      <button
                        onClick={() => {
                          if (!hasRequiredData) return;
                          setChartSelections(prev => prev.map((c, i) => i === idx ? { ...c, enabled: !c.enabled } : c));
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3"
                        disabled={!hasRequiredData}
                      >
                        <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                          sel.enabled ? 'bg-[#fdda36] border-[#fdda36]' : 'border-gray-300 dark:border-gray-500'
                        }`}>
                          {sel.enabled && (
                            <svg className="w-2.5 h-2.5 text-[#514163]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{def.label}</span>
                        {!hasRequiredData && (
                          <span className="ml-auto text-xs text-gray-400">No data</span>
                        )}
                      </button>
                      {sel.enabled && def.availableSeries.length > 1 && (
                        <div className="px-4 pb-3 pl-11 flex flex-wrap gap-3">
                          {def.availableSeries.map(s => {
                            const active = sel.series[s.key] ?? false;
                            return (
                              <label key={s.key} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={active}
                                  onChange={() => {
                                    setChartSelections(prev => prev.map((c, i) => {
                                      if (i !== idx) return c;
                                      return { ...c, series: { ...c.series, [s.key]: !active } };
                                    }));
                                  }}
                                  className="w-3 h-3 rounded border-gray-300 text-[#fdda36] focus:ring-[#fdda36]/50"
                                />
                                <span className="text-xs text-gray-600 dark:text-gray-400">{s.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('reportBuilder.styleSection')}</h3>
            </div>
            <div className="p-5 space-y-2">
              {styleOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStyle(opt.value)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    style === opt.value
                      ? 'border-[#fdda36] bg-[#fdda36]/10'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <p className={`text-xs font-semibold ${style === opt.value ? 'text-[#514163] dark:text-[#fdda36]' : 'text-gray-700 dark:text-gray-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('reportBuilder.branding')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{t('reportBuilder.brandingDesc')}</p>
            </div>
            <div className="p-5 space-y-3">
              {brandingFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t(field.labelKey)}</label>
                  <input
                    type="text"
                    value={branding[field.key]}
                    onChange={e => setBranding(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={t(field.placeholderKey)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#fdda36]/50 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('reportBuilder.professionalNotes')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{t('reportBuilder.professionalNotesDesc')}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className={`rounded-xl border transition-all ${includePhysiologyNotes ? 'border-[#fdda36]/50 bg-[#fdda36]/5' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30'}`}>
                <button
                  onClick={() => setIncludePhysiologyNotes(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${includePhysiologyNotes ? 'bg-[#fdda36] border-[#fdda36]' : 'border-gray-300 dark:border-gray-500'}`}>
                    {includePhysiologyNotes && (
                      <svg className="w-2.5 h-2.5 text-[#514163]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Physiology Test Notes</span>
                  {!physiologyNotes.trim() && (
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">No notes</span>
                  )}
                </button>
                {includePhysiologyNotes && (
                  <div className="px-4 pb-3">
                    <RichTextEditor
                      value={physiologyNotes}
                      onChange={setPhysiologyNotes}
                      placeholder="Notes from the physiology/metabolic test..."
                    />
                  </div>
                )}
              </div>

              <div className={`rounded-xl border transition-all ${includeAnthropometryNotes ? 'border-[#fdda36]/50 bg-[#fdda36]/5' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30'}`}>
                <button
                  onClick={() => setIncludeAnthropometryNotes(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${includeAnthropometryNotes ? 'bg-[#fdda36] border-[#fdda36]' : 'border-gray-300 dark:border-gray-500'}`}>
                    {includeAnthropometryNotes && (
                      <svg className="w-2.5 h-2.5 text-[#514163]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Anthropometry Notes</span>
                  {!anthropometryNotes.trim() && (
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">No notes</span>
                  )}
                </button>
                {includeAnthropometryNotes && (
                  <div className="px-4 pb-3">
                    <RichTextEditor
                      value={anthropometryNotes}
                      onChange={setAnthropometryNotes}
                      placeholder="Notes from the anthropometry assessment..."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {hasManualZones && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Training Zones Data Source</h3>
                <p className="text-xs text-gray-400 mt-0.5">Choose which zone values to include in the report</p>
              </div>
              <div className="p-5 space-y-2">
                <button
                  onClick={() => setUseManualZones(false)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    !useManualZones
                      ? 'border-[#fdda36] bg-[#fdda36]/10'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <p className={`text-xs font-semibold ${!useManualZones ? 'text-[#514163] dark:text-[#fdda36]' : 'text-gray-700 dark:text-gray-300'}`}>
                    Auto-calculated zones
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Use values computed from test thresholds</p>
                </button>
                <button
                  onClick={() => setUseManualZones(true)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    useManualZones
                      ? 'border-[#fdda36] bg-[#fdda36]/10'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <p className={`text-xs font-semibold ${useManualZones ? 'text-[#514163] dark:text-[#fdda36]' : 'text-gray-700 dark:text-gray-300'}`}>
                    Manually edited zones
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Use your custom-adjusted HR, RPE and pace values ({manualTrainingZones!.length} zones)</p>
                </button>
              </div>
            </div>
          )}

          {data.physiologyResults?.zones_data && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Training Zone Model</h3>
                <p className="text-xs text-gray-400 mt-0.5">Choose which zone model(s) to include in the report</p>
              </div>
              <div className="p-5 space-y-2">
                {([
                  { value: '5' as const, label: '5-Zone Model', desc: 'Simplified: Recovery, Aerobic, Threshold, VO2max, Anaerobic' },
                  { value: '7' as const, label: '7-Zone Model', desc: 'Detailed: 7 physiological zones anchored to LT1/LT2/VAM-PAM' },
                  { value: 'both' as const, label: 'Both Models', desc: 'Include both 5-zone and 7-zone tables in the report' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setZoneDisplayMode(opt.value)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      zoneDisplayMode === opt.value
                        ? 'border-[#fdda36] bg-[#fdda36]/10'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <p className={`text-xs font-semibold ${zoneDisplayMode === opt.value ? 'text-[#514163] dark:text-[#fdda36]' : 'text-gray-700 dark:text-gray-300'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || sections.length === 0}
            className="w-full px-6 py-3 bg-[#fdda36] text-[#514163] rounded-xl font-semibold text-sm hover:bg-[#fdda36]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-[#514163] border-t-transparent rounded-full animate-spin" />
                {t('reportBuilder.generating')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('reportBuilder.generate')} ({sections.length} {t('reportBuilder.sections')})
              </>
            )}
          </button>

          {sections.length === 0 && (
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">{t('reportBuilder.noSections')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
