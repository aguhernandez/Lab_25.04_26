import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { DOMAINS, analyzeFullPanel } from '../../lib/biochemistry';

interface BiochemicalInputProps {
  athleteId: string;
  onSaved: () => void;
}

export default function BiochemicalInput({ athleteId, onSaved }: BiochemicalInputProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [markers, setMarkers] = useState<Record<string, Record<string, string>>>({});
  const [activeDomain, setActiveDomain] = useState(DOMAINS[0].key);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMarkerChange = (domain: string, marker: string, value: string) => {
    setMarkers(prev => ({
      ...prev,
      [domain]: { ...prev[domain], [marker]: value },
    }));
  };

  const getNumericMarkers = (): Record<string, Record<string, number>> => {
    const result: Record<string, Record<string, number>> = {};
    for (const [domain, domainMarkers] of Object.entries(markers)) {
      const numericValues: Record<string, number> = {};
      for (const [key, val] of Object.entries(domainMarkers)) {
        const n = parseFloat(val);
        if (!isNaN(n)) numericValues[key] = n;
      }
      if (Object.keys(numericValues).length > 0) result[domain] = numericValues;
    }
    return result;
  };

  const handleSave = async () => {
    const numericMarkers = getNumericMarkers();
    if (Object.keys(numericMarkers).length === 0) {
      setError(t('bio.errorNoMarkers'));
      return;
    }

    setSaving(true);
    setError(null);

    const result = analyzeFullPanel(numericMarkers);

    const row: Record<string, unknown> = {
      athlete_id: athleteId,
      test_date: testDate,
      notes: notes || null,
      created_by: profile?.id || null,
      health_flags: result.healthFlags,
      global_score: result.globalScore,
    };

    for (const domain of DOMAINS) {
      row[domain.key] = numericMarkers[domain.key] || {};
      const domainResult = result.domains.find(d => d.key === domain.key);
      row[`${domain.key}_score`] = domainResult?.score ?? null;
    }

    const { error: saveError } = await supabase.from('biochemical_tests').insert(row);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMarkers({});
    setNotes('');
    onSaved();
  };

  const filledCount = Object.values(markers).reduce((acc, d) =>
    acc + Object.values(d).filter(v => v && !isNaN(parseFloat(v))).length, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-5">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('bio.testDate')}
            </label>
            <input
              type="date"
              value={testDate}
              onChange={e => setTestDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('bio.notes')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('bio.notesPlaceholder')}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-gray-100 dark:border-gray-700">
          {DOMAINS.map(domain => {
            const domainMarkers = markers[domain.key] || {};
            const filled = Object.values(domainMarkers).filter(v => v && !isNaN(parseFloat(v))).length;
            return (
              <button
                key={domain.key}
                onClick={() => setActiveDomain(domain.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeDomain === domain.key
                    ? 'bg-[#514163] text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {t(domain.labelKey)}
                {filled > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[10px]">
                    {filled}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DOMAINS.find(d => d.key === activeDomain)?.markers.map(marker => (
            <div key={marker.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t(marker.labelKey)} <span className="text-gray-400">({marker.unit})</span>
              </label>
              <input
                type="number"
                step="any"
                value={markers[activeDomain]?.[marker.key] || ''}
                onChange={e => handleMarkerChange(activeDomain, marker.key, e.target.value)}
                placeholder={`${marker.min} - ${marker.max}`}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm placeholder-gray-400"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                {t('bio.optimal')}: {marker.optimalMin} - {marker.optimalMax} {marker.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {filledCount} {t('bio.markersEntered')}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || filledCount === 0}
          className="px-6 py-2.5 rounded-lg bg-[#fdda36] text-[#514163] font-bold text-sm hover:bg-[#fdda36]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('bio.saving') : t('bio.saveTest')}
        </button>
      </div>
    </div>
  );
}
