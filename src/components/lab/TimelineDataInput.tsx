import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Plus, Upload, Clock, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Loader as Loader2, ChevronDown, ChevronUp, Trash2, Pencil, X, RotateCcw, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  parseTimelineFile, extractHeaders, autoDetectProfile,
  getDefaultProfiles, getRawColumnKeys,
} from '../../lib/timelineParser';
import type { DeviceProfile } from '../../types/breathData.types';
import type { TimelineSample, ProtocolStep } from '../../types/timeline.types';
import { DEFAULT_PROTOCOL, PRIMARY_COLUMNS, LACTATE_OFFSET_S } from '../../types/timeline.types';

interface Props {
  testId: string;
  onComplete: (samples: TimelineSample[]) => void;
  onCancel: () => void;
}

export default function TimelineDataInput({ testId, onComplete, onCancel }: Props) {
  const [samples, setSamples] = useState<TimelineSample[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<TimelineSample>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Import state
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [offset_s, setOffset_s] = useState(0);
  const [showProtocol, setShowProtocol] = useState(false);
  const [protocol, setProtocol] = useState<ProtocolStep[]>(DEFAULT_PROTOCOL);
  const [protocolLoaded, setProtocolLoaded] = useState(false);

  // Live capture fields
  const [liveSpeed, setLiveSpeed] = useState('');
  const [liveHR, setLiveHR] = useState('');
  const [liveLactate, setLiveLactate] = useState('');
  const [liveRPE, setLiveRPE] = useState('');
  const liveLactateRef = useRef<HTMLInputElement>(null);
  const liveHRRef = useRef<HTMLInputElement>(null);
  const liveSpeedRef = useRef<HTMLInputElement>(null);
  const liveRPERef = useRef<HTMLInputElement>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load profiles
  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('device_profiles').select('*').order('name');
    if (data && data.length > 0) setProfiles(data as DeviceProfile[]);
    else setProfiles(getDefaultProfiles());
  }, []);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // Load existing samples
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('test_timeline_samples')
        .select('*')
        .eq('test_id', testId)
        .order('timestamp_s', { ascending: true });
      if (data && data.length > 0) {
        setSamples(data.map((r: any) => ({
          id: r.id, timestamp_s: Number(r.timestamp_s), speed_pace: r.speed_pace,
          heart_rate: r.heart_rate != null ? Number(r.heart_rate) : null,
          lactate: r.lactate != null ? Number(r.lactate) : null,
          rpe: r.rpe != null ? Number(r.rpe) : null,
          vo2_ml_kg_min: r.vo2_ml_kg_min != null ? Number(r.vo2_ml_kg_min) : null,
          raw_data: r.raw_data ?? {}, source: r.source, edited_fields: r.edited_fields ?? [],
        })));
      }
    })();
  }, [testId]);

  // Timer
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // --- Live capture ---
  const handleLiveEnter = (field: 'speed' | 'hr' | 'lactate' | 'rpe') => {
    const ts = elapsed;
    let lactateTs = ts;
    let lactateVal: number | null = null;
    if (field === 'lactate' && liveLactate.trim()) {
      lactateVal = parseFloat(liveLactate);
      lactateTs = Math.max(0, ts - LACTATE_OFFSET_S);
    }

    const newSample: TimelineSample = {
      id: crypto.randomUUID(),
      timestamp_s: field === 'lactate' ? lactateTs : ts,
      speed_pace: field === 'speed' ? liveSpeed.trim() || null : null,
      heart_rate: field === 'hr' && liveHR.trim() ? parseInt(liveHR) : null,
      lactate: lactateVal,
      rpe: field === 'rpe' && liveRPE.trim() ? parseInt(liveRPE) : null,
      vo2_ml_kg_min: null,
      raw_data: {},
      source: 'manual',
      edited_fields: [],
    };

    // Merge: if a sample at same timestamp exists, merge fields
    setSamples((prev) => {
      const existingIdx = prev.findIndex((s) => s.timestamp_s === newSample.timestamp_s && s.source === 'manual');
      if (existingIdx >= 0) {
        const merged = { ...prev[existingIdx] };
        if (newSample.speed_pace) merged.speed_pace = newSample.speed_pace;
        if (newSample.heart_rate != null) merged.heart_rate = newSample.heart_rate;
        if (newSample.lactate != null) merged.lactate = newSample.lactate;
        if (newSample.rpe != null) merged.rpe = newSample.rpe;
        const copy = [...prev];
        copy[existingIdx] = merged;
        return copy;
      }
      return [...prev, newSample].sort((a, b) => a.timestamp_s - b.timestamp_s);
    });

    // Clear the field that was entered
    if (field === 'speed') { setLiveSpeed(''); liveSpeedRef.current?.focus(); }
    if (field === 'hr') { setLiveHR(''); liveHRRef.current?.focus(); }
    if (field === 'lactate') { setLiveLactate(''); liveLactateRef.current?.focus(); }
    if (field === 'rpe') { setLiveRPE(''); liveRPERef.current?.focus(); }
  };

  // --- Protocol preload ---
  const loadProtocol = () => {
    const newSamples: TimelineSample[] = [];
    let cumTime = 0;
    for (const step of protocol) {
      newSamples.push({
        id: crypto.randomUUID(),
        timestamp_s: cumTime,
        speed_pace: step.speed_pace,
        heart_rate: null,
        lactate: null,
        rpe: null,
        vo2_ml_kg_min: null,
        raw_data: {},
        source: 'manual',
        edited_fields: [],
      });
      if (step.lactate_at_s != null) {
        newSamples.push({
          id: crypto.randomUUID(),
          timestamp_s: cumTime + step.lactate_at_s,
          speed_pace: null,
          heart_rate: null,
          lactate: null,
          rpe: null,
          vo2_ml_kg_min: null,
          raw_data: {},
          source: 'manual',
          edited_fields: [],
        });
      }
      cumTime += step.target_duration_s;
    }
    setSamples(newSamples);
    setProtocolLoaded(true);
  };

  // --- Import ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const headers = await extractHeaders(file);
      const auto = autoDetectProfile(headers, profiles);
      const profile = auto || profiles.find((p) => p.id === selectedProfileId) || profiles[0];
      if (!profile) throw new Error('No device profiles available');
      setSelectedProfileId(profile.id);
      const imported = await parseTimelineFile(file, profile, offset_s);
      // Merge with existing manual samples
      setSamples((prev) => {
        const manual = prev.filter((s) => s.source === 'manual');
        return [...manual, ...imported].sort((a, b) => a.timestamp_s - b.timestamp_s);
      });
      setImportedCount(imported.length);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setImporting(false);
    }
  };

  // --- Edit ---
  const startEdit = (s: TimelineSample) => {
    setEditingId(s.id);
    setEditValues({
      speed_pace: s.speed_pace,
      heart_rate: s.heart_rate,
      lactate: s.lactate,
      rpe: s.rpe,
      vo2_ml_kg_min: s.vo2_ml_kg_min,
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = (id: string) => {
    setSamples((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const edited = [...s.edited_fields];
      const updated = { ...s };
      for (const key of ['speed_pace', 'heart_rate', 'lactate', 'rpe', 'vo2_ml_kg_min'] as const) {
        const newVal = (editValues as any)[key];
        const oldVal = (s as any)[key];
        if (newVal !== oldVal && newVal != null) {
          (updated as any)[key] = newVal;
          if (!edited.includes(key)) edited.push(key);
        }
      }
      updated.edited_fields = edited;
      return updated;
    }));
    setEditingId(null);
    setEditValues({});
  };

  const removeSample = (id: string) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
  };

  // --- Save ---
  const handleSave = async () => {
    if (samples.length === 0) { setError('Add at least one data point before saving.'); return; }
    setSaving(true);
    setError(null);
    try {
      await supabase.from('test_timeline_samples').delete().eq('test_id', testId);
      const rows = samples.map((s) => ({
        test_id: testId,
        timestamp_s: s.timestamp_s,
        speed_pace: s.speed_pace,
        heart_rate: s.heart_rate,
        lactate: s.lactate,
        rpe: s.rpe,
        vo2_ml_kg_min: s.vo2_ml_kg_min,
        raw_data: s.raw_data,
        source: s.source,
        edited_fields: s.edited_fields,
      }));
      const { error: insErr } = await supabase.from('test_timeline_samples').insert(rows);
      if (insErr) throw insErr;
      await supabase.from('tests').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', testId);
      onComplete(samples);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const rawKeys = showAllColumns ? getRawColumnKeys(samples) : [];
  const hasImported = samples.some((s) => s.source === 'imported');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Test Data Capture</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Record live data, import from any device, or preload a protocol. Press Enter to log each value.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Timer + Live Capture */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-mono font-bold text-gray-900 dark:text-white tabular-nums">
              {fmtTime(elapsed)}
            </span>
          </div>
          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={() => setRunning(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"
              >
                <Play className="w-4 h-4" /> Play
              </button>
            ) : (
              <button
                onClick={() => setRunning(false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-400 transition-colors"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
            )}
            <button
              onClick={() => { setRunning(false); setElapsed(0); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
          </div>
        </div>

        {/* Quick capture form */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Speed / Pace</label>
            <input
              ref={liveSpeedRef}
              type="text"
              className="input"
              placeholder="5:00/km"
              value={liveSpeed}
              onChange={(e) => setLiveSpeed(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLiveEnter('speed'); }}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">HR (bpm)</label>
            <input
              ref={liveHRRef}
              type="number"
              className="input"
              placeholder="150"
              value={liveHR}
              onChange={(e) => setLiveHR(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLiveEnter('hr'); }}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Lactate (mmol/L) <span className="text-gray-400">−15s offset</span>
            </label>
            <input
              ref={liveLactateRef}
              type="number"
              step="0.1"
              className="input"
              placeholder="2.0"
              value={liveLactate}
              onChange={(e) => setLiveLactate(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLiveEnter('lactate'); }}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">RPE (1-10)</label>
            <input
              ref={liveRPERef}
              type="number"
              min="1"
              max="10"
              className="input"
              placeholder="5"
              value={liveRPE}
              onChange={(e) => setLiveRPE(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLiveEnter('rpe'); }}
              disabled={saving}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Press Enter in any field to log it at the current timer time.</p>
      </div>

      {/* Protocol preload */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-4">
        <button
          onClick={() => setShowProtocol(!showProtocol)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {showProtocol ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Preload Protocol (solo mode)
        </button>
        {showProtocol && (
          <div className="mt-3 space-y-2">
            {protocol.map((step, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center text-sm">
                <input
                  type="text"
                  className="input"
                  value={step.label}
                  onChange={(e) => setProtocol(prev => prev.map((p, idx) => idx === i ? { ...p, label: e.target.value } : p))}
                />
                <input
                  type="text"
                  className="input"
                  value={step.speed_pace}
                  onChange={(e) => setProtocol(prev => prev.map((p, idx) => idx === i ? { ...p, speed_pace: e.target.value } : p))}
                />
                <input
                  type="number"
                  className="input"
                  value={step.target_duration_s}
                  onChange={(e) => setProtocol(prev => prev.map((p, idx) => idx === i ? { ...p, target_duration_s: parseInt(e.target.value) || 0 } : p))}
                />
                <button
                  onClick={() => setProtocol(prev => prev.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setProtocol(prev => [...prev, { step: prev.length + 1, label: `Stage ${prev.length}`, speed_pace: '4:00/km', target_duration_s: 180, lactate_at_s: 170 }])}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm"
              >
                <Plus className="w-3 h-3" /> Add Step
              </button>
              <button
                onClick={loadProtocol}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500"
              >
                <CheckCircle className="w-3 h-3" /> Load Protocol
              </button>
              {protocolLoaded && (
                <button
                  onClick={() => { setSamples([]); setProtocolLoaded(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm"
                >
                  <RotateCcw className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Import */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Import from Device</h3>
        </div>

        {importError && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{importError}</p>
          </div>
        )}

        {importedCount > 0 && !importError && (
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">{importedCount} samples imported.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Device Profile</label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="input"
            >
              <option value="">Auto-detect</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Time Offset (s)</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setOffset_s(o => o - 1)} className="px-2 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">−</button>
              <input
                type="number"
                className="input text-center"
                value={offset_s}
                onChange={(e) => setOffset_s(parseInt(e.target.value) || 0)}
              />
              <button onClick={() => setOffset_s(o => o + 1)} className="px-2 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">+</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">&nbsp;</label>
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-500 transition-colors">
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {importing ? 'Parsing...' : 'Browse files'}
              <input type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileSelect} className="hidden" disabled={importing} />
            </label>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Supports XLSX, CSV, TXT. FIT files: export to CSV first. Offset adjusts alignment if device started early/late.
        </p>
      </div>

      {/* Timeline Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Timeline ({samples.length} samples)
          </h3>
          <div className="flex items-center gap-3">
            {hasImported && (
              <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllColumns}
                  onChange={(e) => setShowAllColumns(e.target.checked)}
                  className="w-4 h-4"
                />
                Show every column
              </label>
            )}
            <button
              onClick={() => setSamples(prev => [...prev, {
                id: crypto.randomUUID(), timestamp_s: elapsed, speed_pace: null,
                heart_rate: null, lactate: null, rpe: null, vo2_ml_kg_min: null,
                raw_data: {}, source: 'manual' as const, edited_fields: [],
              }].sort((a, b) => a.timestamp_s - b.timestamp_s))}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm"
            >
              <Plus className="w-3 h-3" /> Add Row
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
              <tr>
                {PRIMARY_COLUMNS.map((col) => (
                  <th key={col.key} className="px-2 py-2 text-left font-semibold text-gray-600 dark:text-gray-300" style={{ minWidth: col.width }}>
                    {col.label}
                  </th>
                ))}
                {showAllColumns && rawKeys.map((k) => (
                  <th key={k} className="px-2 py-2 text-left font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {k}
                  </th>
                ))}
                <th className="px-2 py-2 text-left font-semibold text-gray-500">Src</th>
                <th className="px-2 py-2" style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {samples.length === 0 && (
                <tr>
                  <td colSpan={PRIMARY_COLUMNS.length + 2 + (showAllColumns ? rawKeys.length : 0)} className="text-center py-8 text-gray-400">
                    No data yet. Use the timer, import a file, or preload a protocol.
                  </td>
                </tr>
              )}
              {samples.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {editingId === s.id ? (
                    <>
                      <td className="px-2 py-1 font-mono text-gray-600 dark:text-gray-400">{fmtTime(s.timestamp_s)}</td>
                      <td className="px-2 py-1">
                        <input type="text" className="input" style={{ padding: '2px 4px', fontSize: '11px' }}
                          value={editValues.speed_pace ?? ''} onChange={(e) => setEditValues(v => ({ ...v, speed_pace: e.target.value }))} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="input" style={{ padding: '2px 4px', fontSize: '11px' }}
                          value={editValues.heart_rate ?? ''} onChange={(e) => setEditValues(v => ({ ...v, heart_rate: e.target.value ? parseInt(e.target.value) : null }))} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="0.1" className="input" style={{ padding: '2px 4px', fontSize: '11px' }}
                          value={editValues.lactate ?? ''} onChange={(e) => setEditValues(v => ({ ...v, lactate: e.target.value ? parseFloat(e.target.value) : null }))} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" className="input" style={{ padding: '2px 4px', fontSize: '11px' }}
                          value={editValues.rpe ?? ''} onChange={(e) => setEditValues(v => ({ ...v, rpe: e.target.value ? parseInt(e.target.value) : null }))} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="0.1" className="input" style={{ padding: '2px 4px', fontSize: '11px' }}
                          value={editValues.vo2_ml_kg_min ?? ''} onChange={(e) => setEditValues(v => ({ ...v, vo2_ml_kg_min: e.target.value ? parseFloat(e.target.value) : null }))} />
                      </td>
                      {showAllColumns && rawKeys.map((k) => <td key={k} className="px-2 py-1 text-gray-400">{s.raw_data[k] ?? '—'}</td>)}
                      <td className="px-2 py-1">{s.source[0].toUpperCase()}</td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(s.id)} className="text-green-600 hover:text-green-700"><CheckCircle className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1 font-mono text-gray-600 dark:text-gray-400">{fmtTime(s.timestamp_s)}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.speed_pace ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.heart_rate ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.lactate ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.rpe ?? '—'}</td>
                      <td className={`px-2 py-1 ${s.edited_fields.includes('vo2_ml_kg_min') ? 'bg-amber-100 dark:bg-amber-900/30 rounded' : ''} text-gray-700 dark:text-gray-300`}>
                        {s.vo2_ml_kg_min ?? '—'}
                      </td>
                      {showAllColumns && rawKeys.map((k) => (
                        <td key={k} className={`px-2 py-1 ${s.edited_fields.includes(k) ? 'bg-amber-100 dark:bg-amber-900/30' : ''} text-gray-500 dark:text-gray-400`}>
                          {s.raw_data[k] ?? '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${s.source === 'imported' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                          {s.source === 'imported' ? 'IMP' : 'MAN'}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(s)} className="text-gray-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeSample(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Calculate'}
        </button>
      </div>
    </div>
  );
}
