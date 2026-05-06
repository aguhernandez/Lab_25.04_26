import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete, Sport, TrainingZone } from '../types';
import { loadAnthropometryFromHub, saveTestAnthropometry } from '../lib/anthropometry';
import Toast from './Toast';

interface ManualResultsImportProps {
  athlete: Athlete;
  onComplete: (testId: string) => void;
  onCancel: () => void;
}

interface ImportForm {
  sport: Sport;
  testDate: string;
  vo2max: string;
  hrmax: string;
  speedMax: string;
  vt1Hr: string;
  vt2Hr: string;
  veMax: string;
  tvMax: string;
  rfMax: string;
}

function fieldNum(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function buildZones(hrmax: number, lt1Hr: number | null, lt2Hr: number | null, sport: Sport): TrainingZone[] {
  const lt1 = lt1Hr || Math.round(hrmax * 0.70);
  const lt2 = lt2Hr || Math.round(hrmax * 0.90);

  const zoneNames: Record<number, Record<Sport, string>> = {
    1: { cycling: 'Recovery', running: 'Recovery', triathlon: 'Recovery', swimming: 'Recovery', other: 'Recovery' },
    2: { cycling: 'Endurance', running: 'Aerobic Base', triathlon: 'Endurance', swimming: 'Aerobic', other: 'Endurance' },
    3: { cycling: 'Tempo', running: 'Tempo', triathlon: 'Tempo', swimming: 'Threshold', other: 'Tempo' },
    4: { cycling: 'Threshold', running: 'Lactate Threshold', triathlon: 'Threshold', swimming: 'VO2', other: 'Threshold' },
    5: { cycling: 'VO2max', running: 'VO2max', triathlon: 'VO2max', swimming: 'Sprint', other: 'VO2max' },
  };

  return [
    {
      zone: 1,
      name: zoneNames[1][sport],
      hr_min: Math.round(hrmax * 0.50),
      hr_max: lt1,
      description: 'Recovery and base aerobic development',
    },
    {
      zone: 2,
      name: zoneNames[2][sport],
      hr_min: lt1 + 1,
      hr_max: Math.round(lt1 * 1.05),
      description: 'Aerobic endurance',
    },
    {
      zone: 3,
      name: zoneNames[3][sport],
      hr_min: Math.round(lt1 * 1.05) + 1,
      hr_max: lt2,
      description: 'Tempo and sustainable pace',
    },
    {
      zone: 4,
      name: zoneNames[4][sport],
      hr_min: lt2 + 1,
      hr_max: Math.round(lt2 * 1.05),
      description: 'Lactate threshold training',
    },
    {
      zone: 5,
      name: zoneNames[5][sport],
      hr_min: Math.round(lt2 * 1.05) + 1,
      hr_max: hrmax,
      description: 'VO2max and anaerobic capacity',
    },
  ];
}

export default function ManualResultsImport({ athlete, onComplete, onCancel }: ManualResultsImportProps) {
  const [form, setForm] = useState<ImportForm>({
    sport: athlete.sport,
    testDate: new Date().toISOString().split('T')[0],
    vo2max: '',
    hrmax: '',
    speedMax: '',
    vt1Hr: '',
    vt2Hr: '',
    veMax: '',
    tvMax: '',
    rfMax: '',
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const set = (field: keyof ImportForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    const hrmax = fieldNum(form.hrmax);
    if (!hrmax) {
      setToast({ message: 'HR Max is required.', type: 'error' });
      return;
    }

    const vo2max = fieldNum(form.vo2max);
    const speedMax = fieldNum(form.speedMax);
    const vt1Hr = fieldNum(form.vt1Hr);
    const vt2Hr = fieldNum(form.vt2Hr);
    const veMax = fieldNum(form.veMax);
    const tvMax = fieldNum(form.tvMax);
    const rfMax = fieldNum(form.rfMax);

    setLoading(true);
    try {
      const { data: test, error: testErr } = await supabase
        .from('tests')
        .insert({
          athlete_id: athlete.id,
          test_date: form.testDate,
          sport: form.sport,
          test_type: 'manual',
          status: 'completed',
        })
        .select()
        .single();

      if (testErr) throw testErr;

      const anthroStatus = await loadAnthropometryFromHub(athlete.id);
      if (anthroStatus.data) {
        await saveTestAnthropometry(test.id, anthroStatus.data);
      }

      const dataPoints: {
        test_id: string;
        stage_number: number;
        duration_seconds: number;
        heart_rate: number;
        speed_pace: string | null;
        vo2_ml_kg_min: number | null;
        vt1_marker: boolean;
        vt2_marker: boolean;
      }[] = [];

      let stageNum = 1;

      if (vt1Hr) {
        dataPoints.push({
          test_id: test.id,
          stage_number: stageNum++,
          duration_seconds: 180,
          heart_rate: vt1Hr,
          speed_pace: null,
          vo2_ml_kg_min: vo2max ? Math.round(vo2max * 0.65 * 10) / 10 : null,
          vt1_marker: true,
          vt2_marker: false,
        });
      }

      if (vt2Hr) {
        dataPoints.push({
          test_id: test.id,
          stage_number: stageNum++,
          duration_seconds: 180,
          heart_rate: vt2Hr,
          speed_pace: null,
          vo2_ml_kg_min: vo2max ? Math.round(vo2max * 0.88 * 10) / 10 : null,
          vt1_marker: false,
          vt2_marker: true,
        });
      }

      dataPoints.push({
        test_id: test.id,
        stage_number: stageNum,
        duration_seconds: 180,
        heart_rate: hrmax,
        speed_pace: speedMax ? `${speedMax} km/h` : null,
        vo2_ml_kg_min: vo2max,
        vt1_marker: false,
        vt2_marker: false,
      });

      if (dataPoints.length > 0) {
        const { error: dpErr } = await supabase.from('test_data_points').insert(dataPoints);
        if (dpErr) throw dpErr;
      }

      const trainingZones = buildZones(hrmax, vt1Hr, vt2Hr, form.sport);

      const lt1PercentHRmax = vt1Hr ? Math.round((vt1Hr / hrmax) * 100) : null;
      const lt2PercentHRmax = vt2Hr ? Math.round((vt2Hr / hrmax) * 100) : null;
      const lt1PercentVO2max = lt1PercentHRmax ? Math.round(lt1PercentHRmax * 0.85) : null;
      const lt2PercentVO2max = lt2PercentHRmax ? Math.round(lt2PercentHRmax * 0.93) : null;

      const advancedMetrics = (veMax || tvMax || rfMax)
        ? {
            ve_max_l_min: veMax,
            tv_max_l: tvMax,
            rf_max_bpm: rfMax,
          }
        : null;

      const { error: resErr } = await supabase.from('test_results').upsert({
        test_id: test.id,
        vo2max: vo2max,
        vo2max_measured: true,
        lt1_hr: vt1Hr,
        lt2_hr: vt2Hr,
        fatmax_hr: vt1Hr ? Math.round(vt1Hr * 0.97) : null,
        hr_drift_percent: null,
        training_zones: trainingZones,
        data_quality: 'manual_import',
        advanced_metrics: advancedMetrics,
      });

      if (resErr) throw resErr;

      await supabase.from('athlete_physiology_profiles').upsert({
        athlete_id: athlete.id,
        source: 'lab',
        last_test_date: form.testDate,
        last_test_id: test.id,
        vo2max_relative_ml_kg_min: vo2max,
        vo2max_absolute_l_min: vo2max && athlete.weight_kg
          ? Math.round((vo2max * athlete.weight_kg) / 1000 * 100) / 100
          : null,
        vo2max_confidence: 'measured',
        lt1_hr: vt1Hr,
        lt1_percent_vo2max: lt1PercentVO2max,
        lt1_percent_hrmax: lt1PercentHRmax,
        lt1_confidence: vt1Hr ? 'measured' : 'estimated',
        lt2_hr: vt2Hr,
        lt2_percent_vo2max: lt2PercentVO2max,
        lt2_percent_hrmax: lt2PercentHRmax,
        lt2_confidence: vt2Hr ? 'measured' : 'estimated',
        fatmax_hr: vt1Hr ? Math.round(vt1Hr * 0.97) : null,
        vam_kmh: speedMax,
        hrmax: hrmax,
        physiology_zones: trainingZones,
      }, { onConflict: 'athlete_id' });

      onComplete(test.id);
    } catch (err) {
      console.error('Manual import error:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to save results.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] px-6 py-4">
          <h2 className="text-xl font-semibold text-white">Import Results from External App</h2>
          <p className="text-white/70 text-sm mt-1">
            Enter the results provided by your VO2 testing software
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Test Date</label>
              <input type="date" className="input" value={form.testDate} onChange={set('testDate')} />
            </div>
            <div>
              <label className="label">Sport</label>
              <select className="input" value={form.sport} onChange={set('sport')}>
                {(['cycling', 'running', 'triathlon', 'swimming'] as Sport[]).map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Primary Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  VO2 Max <span className="text-gray-400 font-normal">(ml/kg/min)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="e.g. 58.4"
                  value={form.vo2max}
                  onChange={set('vo2max')}
                />
              </div>
              <div>
                <label className="label">
                  HR Max <span className="text-red-500">*</span>{' '}
                  <span className="text-gray-400 font-normal">(bpm)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  placeholder="e.g. 185"
                  value={form.hrmax}
                  onChange={set('hrmax')}
                />
              </div>
              <div>
                <label className="label">
                  Speed Max <span className="text-gray-400 font-normal">(km/h)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="e.g. 18.5"
                  value={form.speedMax}
                  onChange={set('speedMax')}
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Ventilatory Thresholds
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <label className="label">
                  VT1 — Heart Rate <span className="text-gray-400 font-normal">(bpm)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  placeholder="e.g. 148"
                  value={form.vt1Hr}
                  onChange={set('vt1Hr')}
                />
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Aerobic threshold (LT1)</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <label className="label">
                  VT2 — Heart Rate <span className="text-gray-400 font-normal">(bpm)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  placeholder="e.g. 167"
                  value={form.vt2Hr}
                  onChange={set('vt2Hr')}
                />
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Anaerobic threshold (LT2)</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Ventilation at Max <span className="text-gray-400 font-normal text-xs normal-case">(optional)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">
                  Ve Max <span className="text-gray-400 font-normal">(L/min)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  placeholder="e.g. 145.2"
                  value={form.veMax}
                  onChange={set('veMax')}
                />
              </div>
              <div>
                <label className="label">
                  Tv Max <span className="text-gray-400 font-normal">(L)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="e.g. 3.2"
                  value={form.tvMax}
                  onChange={set('tvMax')}
                />
              </div>
              <div>
                <label className="label">
                  Rf Max <span className="text-gray-400 font-normal">(breaths/min)</span>
                </label>
                <input
                  type="number"
                  step="1"
                  className="input"
                  placeholder="e.g. 52"
                  value={form.rfMax}
                  onChange={set('rfMax')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            disabled={loading}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !form.hrmax}
            className="px-6 py-2 rounded-lg bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save & View Results'}
          </button>
        </div>
      </div>
    </div>
  );
}
