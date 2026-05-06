import { useState } from 'react';
import { FVRepResult, calculateRepMetrics } from '../../lib/forceVelocity';
import { useLanguage } from '../../contexts/LanguageContext';

interface FVDataInputProps {
  bodyMassKg: number;
  onRepsUpdated: (reps: FVRepResult[]) => void;
}

interface RepRow {
  id: number;
  set: string;
  rep: string;
  load: string;
  displacement: string;
  duration: string;
  source: 'encoder' | 'video' | 'manual';
}

export default function FVDataInput({ bodyMassKg, onRepsUpdated }: FVDataInputProps) {
  const { t } = useLanguage();
  const [rows, setRows] = useState<RepRow[]>([
    { id: 1, set: '1', rep: '1', load: '', displacement: '', duration: '', source: 'manual' },
  ]);
  const [bulkText, setBulkText] = useState('');
  const [inputMode, setInputMode] = useState<'table' | 'bulk'>('table');
  const [bulkError, setBulkError] = useState('');

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    setRows(prev => [
      ...prev,
      {
        id: Date.now(),
        set: lastRow.set,
        rep: String(parseInt(lastRow.rep || '1') + 1),
        load: lastRow.load,
        displacement: '',
        duration: '',
        source: lastRow.source,
      },
    ]);
  };

  const parseNum = (v: string) => {
    const n = parseFloat(v.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const computeAndEmit = (currentRows: RepRow[]) => {
    const results: FVRepResult[] = [];
    for (const row of currentRows) {
      const load = parseNum(row.load);
      const disp = parseNum(row.displacement);
      const dur = parseNum(row.duration);
      if (load === null || disp === null || dur === null || dur <= 0) continue;

      results.push(calculateRepMetrics({
        load_kg: load,
        body_mass_kg: bodyMassKg,
        displacement_m: disp,
        duration_s: dur,
        set_number: parseInt(row.set) || 1,
        rep_number: parseInt(row.rep) || 1,
        data_source: row.source,
      }));
    }
    onRepsUpdated(results);
  };

  const handleFieldChange = (id: number, field: keyof RepRow, value: string) => {
    const updated = rows.map(r => r.id === id ? { ...r, [field]: value } : r);
    setRows(updated);
    computeAndEmit(updated);
  };

  const handleBulkParse = () => {
    setBulkError('');
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const newRows: RepRow[] = [];
    let id = Date.now();

    for (const line of lines) {
      const parts = line.trim().split(/[\t,;]+/).map(p => p.trim());
      if (parts.length < 3) {
        setBulkError(`Line "${line}" needs at least: load, displacement, duration`);
        return;
      }
      newRows.push({
        id: id++,
        set: parts[3] || '1',
        rep: parts[4] || String(newRows.length + 1),
        load: parts[0],
        displacement: parts[1],
        duration: parts[2],
        source: 'manual',
      });
    }

    setRows(newRows);
    computeAndEmit(newRows);
    setInputMode('table');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setInputMode('table')}
          className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
            inputMode === 'table'
              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('fv.rowByRow')}
        </button>
        <button
          onClick={() => setInputMode('bulk')}
          className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
            inputMode === 'bulk'
              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('fv.bulkImport')}
        </button>
      </div>

      {inputMode === 'bulk' ? (
        <div className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Format per line:</p>
            <code className="text-xs text-blue-600 dark:text-blue-300">load_kg, displacement_m, duration_s [, set, rep]</code>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Separator: comma, tab, or semicolon. Example: <code>60, 0.45, 0.52, 1, 1</code></p>
          </div>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={8}
            placeholder={"60, 0.45, 0.52\n80, 0.38, 0.61\n100, 0.28, 0.75"}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {bulkError && <p className="text-xs text-red-500">{bulkError}</p>}
          <button
            onClick={handleBulkParse}
            className="px-4 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
          >
            {t('fv.parseLoad')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-20">{t('fv.set')}</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-20">{t('fv.rep')}</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{t('fv.load')}</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Disp (m)</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Time (s)</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Source</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.set}
                      onChange={e => handleFieldChange(row.id, 'set', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={row.rep}
                      onChange={e => handleFieldChange(row.id, 'rep', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="60"
                      value={row.load}
                      onChange={e => handleFieldChange(row.id, 'load', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.45"
                      value={row.displacement}
                      onChange={e => handleFieldChange(row.id, 'displacement', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="0.52"
                      value={row.duration}
                      onChange={e => handleFieldChange(row.id, 'duration', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <select
                      value={row.source}
                      onChange={e => handleFieldChange(row.id, 'source', e.target.value)}
                      className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="manual">Manual</option>
                      <option value="encoder">Encoder</option>
                      <option value="video">Video</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <button
                      onClick={() => {
                        const updated = rows.filter(r => r.id !== row.id);
                        setRows(updated);
                        computeAndEmit(updated);
                      }}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={addRow}
            className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('fv.addLoad')}
          </button>
        </div>
      )}
    </div>
  );
}
