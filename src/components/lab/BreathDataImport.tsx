import { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseBreathFile, extractHeaders, autoDetectProfile, hasCO2Data, getDefaultProfiles } from '../../lib/breathDataParser';
import { calculateVentilatoryThresholds } from '../../lib/ventilatoryThresholds';
import type { BreathSample, DeviceProfile } from '../../types/breathData.types';
import type { UnifiedThresholds } from '../../types';

interface Props {
  breathData: BreathSample[] | null;
  deviceProfile: DeviceProfile | null;
  onChange: (breathData: BreathSample[] | null, profile: DeviceProfile | null, vt: UnifiedThresholds | null) => void;
  hrmax: number | null;
  vo2max: number | null;
}

export default function BreathDataImport({ breathData, deviceProfile, onChange, hrmax, vo2max }: Props) {
  const [profiles, setProfiles] = useState<DeviceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [detectedProfile, setDetectedProfile] = useState<DeviceProfile | null>(null);
  const [parsedSamples, setParsedSamples] = useState<BreathSample[] | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('device_profiles').select('*').order('name');
    if (data && data.length > 0) {
      setProfiles(data as DeviceProfile[]);
    } else {
      setProfiles(getDefaultProfiles());
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const headers = await extractHeaders(file);
      const autoProfile = autoDetectProfile(headers, profiles);
      setDetectedProfile(autoProfile);
      const profileToUse = autoProfile || profiles[0];
      if (!profileToUse) throw new Error('No device profiles available');
      setSelectedProfileId(profileToUse.id);
      const samples = await parseBreathFile(file, profileToUse);
      setParsedSamples(samples);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setParsedSamples(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedSamples || !selectedProfileId) return;
    const profile = profiles.find((p) => p.id === selectedProfileId) || detectedProfile;
    if (!profile) return;

    let vt: UnifiedThresholds | null = null;
    if (hrmax && parsedSamples.length >= 4) {
      const co2 = hasCO2Data(profile);
      const vtResult = calculateVentilatoryThresholds(parsedSamples, hrmax, vo2max, co2);
      if (vtResult) {
        vt = {
          LT1: { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' },
          LT2: { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' },
          VT1: vtResult.VT1,
          VT2: vtResult.VT2,
          vt_source: 'direct_measurement',
          delta_lt1_vt1_hr: null,
          delta_lt2_vt2_hr: null,
        };
      }
    }
    onChange(parsedSamples, profile, vt);
  };

  const handleCancelImport = () => {
    setParsedSamples(null);
    setDetectedProfile(null);
    setShowPreview(false);
    setFileName('');
    onChange(null, null, null);
  };

  const co2Available = parsedSamples && deviceProfile ? hasCO2Data(deviceProfile) : false;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-gray-800 to-gray-700 dark:from-gray-900 dark:to-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-lg p-2">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">VO₂ Master Data Import</h3>
            <p className="text-sm text-white/70">Upload DataAverage.xlsx for automatic VT1/VT2 calculation</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {breathData && !loading && (
          <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                {breathData.length} breath samples imported
              </p>
              {deviceProfile && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  Device: {deviceProfile.name} · CO₂: {co2Available ? 'Available (V-slope)' : 'Not available (proxy method)'}
                </p>
              )}
            </div>
            <button
              onClick={handleCancelImport}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Remove
            </button>
          </div>
        )}

        {!breathData && (
          <>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Device Profile
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Auto-detect from file headers</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Parsing file...</p>
                </div>
              ) : (
                <>
                  <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Drop your DataAverage.xlsx file here or
                  </p>
                  <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-500 transition-colors">
                    Browse files
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  {fileName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{fileName}</p>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {parsedSamples && !breathData && showPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Preview ({parsedSamples.length} samples)
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelImport}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"
                >
                  Confirm Import
                </button>
              </div>
            </div>

            {detectedProfile && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                <CheckCircle className="w-4 h-4" />
                Auto-detected: {detectedProfile.name}
              </div>
            )}

            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">Time (s)</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">HR</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">VO₂rel</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">Rf</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">Ve</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">EqO₂</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-600 dark:text-gray-300">FeO₂</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedSamples.slice(0, 50).map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.time_s.toFixed(0)}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.hr_bpm ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.vo2_rel_mlkgmin?.toFixed(1) ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.rf_bpm ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.ve_lmin?.toFixed(1) ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.eqo2?.toFixed(1) ?? '—'}</td>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-300">{s.feo2_pct?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedSamples.length > 50 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Showing first 50 of {parsedSamples.length} samples
                </p>
              )}
            </div>

            <button
              onClick={() => setShowMapping(!showMapping)}
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showMapping ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Column mapping details
            </button>
            {showMapping && selectedProfileId && (() => {
              const p = profiles.find((pr) => pr.id === selectedProfileId) || detectedProfile;
              if (!p) return null;
              return (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs space-y-1">
                  {Object.entries(p.column_mapping).map(([fileCol, canonKey]) => (
                    <div key={fileCol} className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">{fileCol}</span>
                      <span className="text-gray-700 dark:text-gray-300 font-mono">→ {canonKey}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
