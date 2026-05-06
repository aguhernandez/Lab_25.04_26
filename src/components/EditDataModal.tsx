import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { TestDataPoint, Athlete, Test, AnthropometryData } from '../types';

interface EditRow {
  id: string;
  stage_number: number;
  duration_seconds: string;
  heart_rate: string;
  power_watts: string;
  speed_pace: string;
  vo2_ml_kg_min: string;
  lactate: string;
  rpe: string;
  vt1_marker: boolean;
  vt2_marker: boolean;
}

interface EditDataModalProps {
  testId: string;
  dataPoints: TestDataPoint[];
  athlete: Athlete;
  test: Test;
  onClose: () => void;
  onRecalculate: () => void;
}

function pointToRow(p: TestDataPoint): EditRow {
  return {
    id: p.id,
    stage_number: p.stage_number,
    duration_seconds: String(p.duration_seconds),
    heart_rate: String(p.heart_rate),
    power_watts: p.power_watts != null ? String(p.power_watts) : '',
    speed_pace: p.speed_pace ?? '',
    vo2_ml_kg_min: p.vo2_ml_kg_min != null ? String(p.vo2_ml_kg_min) : '',
    lactate: p.lactate != null ? String(p.lactate) : '',
    rpe: p.rpe != null ? String(p.rpe) : '',
    vt1_marker: p.vt1_marker,
    vt2_marker: p.vt2_marker,
  };
}

function calculateAge(dateOfBirth?: string): number {
  if (!dateOfBirth) return 0;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function EditDataModal({ testId, dataPoints, athlete, test, onClose, onRecalculate }: EditDataModalProps) {
  const existingSnapshot = test.anthropometry_snapshot;

  const [anthro, setAnthro] = useState({
    weight_kg: String(existingSnapshot?.weight_kg ?? (athlete.weight_kg ? Number(athlete.weight_kg) : '')),
    height_cm: String(existingSnapshot?.height_cm ?? (athlete.height_cm ? Number(athlete.height_cm) : '')),
    age: String(existingSnapshot?.age ?? (calculateAge(athlete.date_of_birth) || '')),
    sex: (existingSnapshot?.sex ?? athlete.sex ?? 'male') as string,
    bodyFatPercent: String(existingSnapshot?.bodyFatPercent ?? (athlete.body_fat_percent ? Number(athlete.body_fat_percent) : '')),
  });

  const [rows, setRows] = useState<EditRow[]>(
    [...dataPoints].sort((a, b) => a.stage_number - b.stage_number).map(pointToRow)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnthro, setShowAnthro] = useState(!existingSnapshot || !existingSnapshot.weight_kg);

  const updateRow = (id: string, field: keyof EditRow, value: string | boolean) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setError(null);
  };

  const updateAnthro = (field: string, value: string) => {
    setAnthro(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSaveAndRecalculate = async () => {
    setError(null);

    const weight = parseFloat(anthro.weight_kg);
    const height = parseFloat(anthro.height_cm);
    const age = parseInt(anthro.age);

    if (!anthro.weight_kg.trim() || isNaN(weight) || weight <= 0) {
      setError('Weight is required and must be greater than 0');
      return;
    }
    if (!anthro.height_cm.trim() || isNaN(height) || height <= 0) {
      setError('Height is required and must be greater than 0');
      return;
    }
    if (!anthro.age.trim() || isNaN(age) || age <= 0) {
      setError('Age is required and must be greater than 0');
      return;
    }

    for (const row of rows) {
      const hr = parseInt(row.heart_rate);
      if (!row.heart_rate.trim() || isNaN(hr) || hr < 30 || hr > 250) {
        setError(`Stage ${row.stage_number}: Heart rate must be between 30–250 bpm`);
        return;
      }
      const dur = parseInt(row.duration_seconds);
      if (!row.duration_seconds.trim() || isNaN(dur) || dur <= 0) {
        setError(`Stage ${row.stage_number}: Duration must be greater than 0`);
        return;
      }
    }

    setSaving(true);
    try {
      const bodyFatPercent = anthro.bodyFatPercent.trim() ? parseFloat(anthro.bodyFatPercent) : null;
      const leanBodyMassKg = bodyFatPercent ? weight * (1 - bodyFatPercent / 100) : null;

      const snapshot: AnthropometryData = {
        weight_kg: weight,
        height_cm: height,
        age,
        sex: anthro.sex as AnthropometryData['sex'],
        bodyFatPercent: bodyFatPercent ?? undefined,
        leanBodyMassKg: leanBodyMassKg ?? undefined,
        source: existingSnapshot?.source ?? 'manual',
      };

      await supabase
        .from('tests')
        .update({
          anthropometry_snapshot: snapshot,
          anthropometry_source: snapshot.source,
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', testId);

      for (const row of rows) {
        const vo2 = row.vo2_ml_kg_min.trim() ? parseFloat(row.vo2_ml_kg_min) : null;
        const { error: updateError } = await supabase
          .from('test_data_points')
          .update({
            duration_seconds: parseInt(row.duration_seconds),
            heart_rate: parseInt(row.heart_rate),
            power_watts: row.power_watts.trim() ? parseFloat(row.power_watts) : null,
            speed_pace: row.speed_pace.trim() || null,
            vo2_ml_kg_min: vo2,
            lactate: row.lactate.trim() ? parseFloat(row.lactate) : null,
            rpe: row.rpe.trim() ? parseInt(row.rpe) : null,
            vt1_marker: row.vt1_marker,
            vt2_marker: row.vt2_marker,
          })
          .eq('id', row.id);

        if (updateError) throw updateError;
      }

      onRecalculate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      setSaving(false);
    }
  };

  const missingWeight = !anthro.weight_kg.trim() || parseFloat(anthro.weight_kg) <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-5xl my-8">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Test Data</h2>
            <p className="text-sm text-gray-400 mt-0.5">Modify values and click Save & Recalculate to update results</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {missingWeight && !showAnthro && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-300 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Weight is missing — VO₂ and energy calculations require athlete weight.
              <button onClick={() => setShowAnthro(true)} className="underline font-semibold ml-1">Enter now</button>
            </div>
          )}

          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAnthro(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                Anthropometry
                {missingWeight && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">Weight required</span>
                )}
                {!missingWeight && (
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    {anthro.weight_kg} kg · {anthro.height_cm} cm · Age {anthro.age}
                  </span>
                )}
              </span>
              <svg className={`w-4 h-4 transition-transform ${showAnthro ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showAnthro && (
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={anthro.weight_kg}
                    onChange={e => updateAnthro('weight_kg', e.target.value)}
                    disabled={saving}
                    placeholder="70"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Height (cm) *</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={anthro.height_cm}
                    onChange={e => updateAnthro('height_cm', e.target.value)}
                    disabled={saving}
                    placeholder="175"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Age *</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={anthro.age}
                    onChange={e => updateAnthro('age', e.target.value)}
                    disabled={saving}
                    placeholder="30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Sex *</label>
                  <select
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={anthro.sex}
                    onChange={e => updateAnthro('sex', e.target.value)}
                    disabled={saving}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={anthro.bodyFatPercent}
                    onChange={e => updateAnthro('bodyFatPercent', e.target.value)}
                    disabled={saving}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end">
                  {anthro.bodyFatPercent.trim() && parseFloat(anthro.bodyFatPercent) > 0 && parseFloat(anthro.weight_kg) > 0 && (
                    <div className="w-full px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                      LBM: {(parseFloat(anthro.weight_kg) * (1 - parseFloat(anthro.bodyFatPercent) / 100)).toFixed(1)} kg
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '820px' }}>
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Stage</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Dur (s) *</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">HR (bpm) *</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Power (W)</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Speed/Pace</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">VO₂ ml/kg/min</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">Lactate mmol/L</th>
                  <th className="text-left pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">RPE</th>
                  <th className="text-center pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">VT1</th>
                  <th className="text-center pb-3 px-2 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">VT2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 px-2">
                      <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-gray-700 dark:text-gray-300 text-sm">
                        {row.stage_number}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        className="w-20 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.duration_seconds}
                        onChange={e => updateRow(row.id, 'duration_seconds', e.target.value)}
                        disabled={saving}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        className="w-20 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.heart_rate}
                        onChange={e => updateRow(row.id, 'heart_rate', e.target.value)}
                        disabled={saving}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        className="w-20 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.power_watts}
                        onChange={e => updateRow(row.id, 'power_watts', e.target.value)}
                        disabled={saving}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        className="w-24 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.speed_pace}
                        onChange={e => updateRow(row.id, 'speed_pace', e.target.value)}
                        disabled={saving}
                        placeholder="5:00/km"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        className="w-24 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.vo2_ml_kg_min}
                        onChange={e => updateRow(row.id, 'vo2_ml_kg_min', e.target.value)}
                        disabled={saving}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.1"
                        className="w-24 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.lactate}
                        onChange={e => updateRow(row.id, 'lactate', e.target.value)}
                        disabled={saving}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="w-16 px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={row.rpe}
                        onChange={e => updateRow(row.id, 'rpe', e.target.value)}
                        disabled={saving}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.vt1_marker}
                        onChange={e => updateRow(row.id, 'vt1_marker', e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 rounded cursor-pointer accent-green-600"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={row.vt2_marker}
                        onChange={e => updateRow(row.id, 'vt2_marker', e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 rounded cursor-pointer accent-red-600"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            * Required fields. Optional fields left blank will be stored as empty.
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAndRecalculate}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Save & Recalculate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
