import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete, Test, TestDataPoint, AnthropometryData, AnthropometrySource } from '../types';
import { saveTestAnthropometry, updateAthleteAnthropometry } from '../lib/anthropometry';
import { StageConfig } from './TestSetup';

interface DataInputProps {
  test: Test;
  athlete: Athlete;
  onComplete: (dataPoints: TestDataPoint[]) => void;
  onCancel: () => void;
  initialAnthropometry?: AnthropometryData | null;
  anthropometrySource?: AnthropometrySource;
  stageConfig?: StageConfig;
}

interface DataRow {
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

export default function DataInput({
  test,
  athlete,
  onComplete,
  onCancel,
  initialAnthropometry,
  anthropometrySource = 'manual',
  stageConfig
}: DataInputProps) {
  const initializeRows = (): DataRow[] => {
    if (stageConfig) {
      return Array.from({ length: stageConfig.numStages }, (_, index) => ({
        id: crypto.randomUUID(),
        stage_number: index + 1,
        duration_seconds: stageConfig.stageDurationSeconds.toString(),
        heart_rate: '',
        power_watts: '',
        speed_pace: '',
        vo2_ml_kg_min: '',
        lactate: '',
        rpe: '',
        vt1_marker: false,
        vt2_marker: false
      }));
    }

    return [{
      id: crypto.randomUUID(),
      stage_number: 1,
      duration_seconds: '',
      heart_rate: '',
      power_watts: '',
      speed_pace: '',
      vo2_ml_kg_min: '',
      lactate: '',
      rpe: '',
      vt1_marker: false,
      vt2_marker: false
    }];
  };

  const [rows, setRows] = useState<DataRow[]>(initializeRows());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [anthropometry, setAnthropometry] = useState<AnthropometryData>({
    weight_kg: initialAnthropometry?.weight_kg ?? athlete.weight_kg ?? 0,
    height_cm: initialAnthropometry?.height_cm ?? athlete.height_cm ?? 0,
    age: initialAnthropometry?.age ?? (athlete.date_of_birth ? calculateAge(athlete.date_of_birth) : 0),
    sex: initialAnthropometry?.sex ?? athlete.sex ?? 'other',
    bodyFatPercent: initialAnthropometry?.bodyFatPercent ?? athlete.body_fat_percent,
    leanBodyMassKg: initialAnthropometry?.leanBodyMassKg ?? athlete.lean_body_mass_kg,
    source: anthropometrySource
  });

  const [showAnthropometryEdit, setShowAnthropometryEdit] = useState(anthropometrySource === 'manual');
  const [syncToHub, setSyncToHub] = useState(false);

  function calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  const updateAnthropometry = (field: keyof AnthropometryData, value: any) => {
    setAnthropometry(prev => {
      const updated = { ...prev, [field]: value };

      if (field === 'weight_kg' || field === 'bodyFatPercent') {
        if (updated.weight_kg && updated.bodyFatPercent) {
          updated.leanBodyMassKg = updated.weight_kg * (1 - updated.bodyFatPercent / 100);
        }
      }

      if (prev.source === 'hub') {
        updated.source = 'mixed';
      }

      return updated;
    });
  };

  const addRow = () => {
    const newStageNumber = rows.length + 1;
    setRows([...rows, {
      id: crypto.randomUUID(),
      stage_number: newStageNumber,
      duration_seconds: '',
      heart_rate: '',
      power_watts: '',
      speed_pace: '',
      vo2_ml_kg_min: '',
      lactate: '',
      rpe: '',
      vt1_marker: false,
      vt2_marker: false
    }]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    const filtered = rows.filter(r => r.id !== id);
    const renumbered = filtered.map((row, index) => ({
      ...row,
      stage_number: index + 1
    }));
    setRows(renumbered);
  };

  const updateRow = (id: string, field: keyof DataRow, value: string | boolean) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
    setError(null);
  };

  const validateAndSave = async () => {
    if (!anthropometry.weight_kg || anthropometry.weight_kg <= 0) {
      setError('Weight is required and must be greater than 0');
      return;
    }
    if (!anthropometry.height_cm || anthropometry.height_cm <= 0) {
      setError('Height is required and must be greater than 0');
      return;
    }
    if (!anthropometry.age || anthropometry.age <= 0) {
      setError('Age is required and must be greater than 0');
      return;
    }

    for (const row of rows) {
      if (!row.duration_seconds.trim() || !row.heart_rate.trim()) {
        setError('Duration and Heart Rate are required for all stages');
        return;
      }

      const hr = parseInt(row.heart_rate);
      if (isNaN(hr) || hr < 30 || hr > 250) {
        setError(`Invalid heart rate in stage ${row.stage_number}. Must be between 30-250 bpm`);
        return;
      }

      const duration = parseInt(row.duration_seconds);
      if (isNaN(duration) || duration <= 0) {
        setError(`Invalid duration in stage ${row.stage_number}`);
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      await saveTestAnthropometry(test.id, anthropometry);

      if (syncToHub && anthropometry.source !== 'hub') {
        const birthYear = new Date().getFullYear() - anthropometry.age;
        await updateAthleteAnthropometry(athlete.id, {
          weight_kg: anthropometry.weight_kg,
          height_cm: anthropometry.height_cm,
          date_of_birth: `${birthYear}-01-01`,
          sex: anthropometry.sex,
          body_fat_percent: anthropometry.bodyFatPercent,
          lean_body_mass_kg: anthropometry.leanBodyMassKg
        });
      }

      const dataToInsert = rows.map(row => {
        const vo2_ml_kg_min = row.vo2_ml_kg_min.trim() ? parseFloat(row.vo2_ml_kg_min) : null;

        if (vo2_ml_kg_min && anthropometry.weight_kg) {
          const vo2_l_min = (vo2_ml_kg_min * anthropometry.weight_kg) / 1000;
          if (vo2_l_min > 8) {
            throw new Error(
              `VO2 value at stage ${row.stage_number} is physiologically invalid. ` +
              `Calculated VO2 absolute: ${vo2_l_min.toFixed(2)} L/min (max: 8 L/min). ` +
              `Please verify your entered value of ${vo2_ml_kg_min} ml/kg/min.`
            );
          }
        }

        return {
          test_id: test.id,
          stage_number: Number.parseInt(String(row.stage_number), 10),
          duration_seconds: parseInt(row.duration_seconds, 10),
          heart_rate: parseInt(row.heart_rate),
          power_watts: row.power_watts.trim() ? parseFloat(row.power_watts) : null,
          speed_pace: row.speed_pace.trim() || null,
          vo2_ml_kg_min,
          lactate: row.lactate.trim() ? parseFloat(row.lactate) : null,
          rpe: row.rpe.trim() ? parseInt(row.rpe) : null,
          vt1_marker: row.vt1_marker,
          vt2_marker: row.vt2_marker
        };
      });

      const { error: deleteError } = await supabase
        .from('test_data_points')
        .delete()
        .eq('test_id', test.id);
      if (deleteError) throw deleteError;

      const { data, error: insertError } = await supabase
        .from('test_data_points')
        .insert(dataToInsert)
        .select();

      if (insertError) throw insertError;

      await supabase
        .from('tests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', test.id);

      onComplete(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save data');
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
          Data Entry
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Enter test data for each stage. Duration and Heart Rate are required.
        </p>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--accent-red)',
          borderRadius: '0.375rem',
          padding: '0.75rem',
          marginBottom: '1.5rem',
          color: 'var(--accent-red)',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>
            Anthropometry Data
            {anthropometry.source === 'hub' && (
              <span className="badge badge-green" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                From HUB
              </span>
            )}
            {anthropometry.source === 'mixed' && (
              <span className="badge badge-yellow" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                Mixed (HUB + Manual)
              </span>
            )}
            {anthropometry.source === 'manual' && (
              <span className="badge" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', backgroundColor: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-secondary)' }}>
                Manual Entry
              </span>
            )}
          </h3>
          <button
            className="btn btn-secondary"
            onClick={() => setShowAnthropometryEdit(!showAnthropometryEdit)}
            disabled={saving}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
          >
            {showAnthropometryEdit ? 'Hide' : 'Edit'}
          </button>
        </div>

        {showAnthropometryEdit ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="label">Weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={anthropometry.weight_kg || ''}
                onChange={(e) => updateAnthropometry('weight_kg', parseFloat(e.target.value) || 0)}
                disabled={saving}
              />
            </div>
            <div>
              <label className="label">Height (cm) *</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={anthropometry.height_cm || ''}
                onChange={(e) => updateAnthropometry('height_cm', parseFloat(e.target.value) || 0)}
                disabled={saving}
              />
            </div>
            <div>
              <label className="label">Age (years) *</label>
              <input
                type="number"
                className="input"
                value={anthropometry.age || ''}
                onChange={(e) => updateAnthropometry('age', parseInt(e.target.value) || 0)}
                disabled={saving}
              />
            </div>
            <div>
              <label className="label">Biological Sex *</label>
              <select
                className="input"
                value={anthropometry.sex}
                onChange={(e) => updateAnthropometry('sex', e.target.value)}
                disabled={saving}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Many physiological formulas are based on biological sex
              </p>
            </div>
            <div>
              <label className="label">Body Fat %</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={anthropometry.bodyFatPercent || ''}
                onChange={(e) => updateAnthropometry('bodyFatPercent', parseFloat(e.target.value) || undefined)}
                disabled={saving}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Lean Body Mass (kg)</label>
              <input
                type="number"
                step="0.1"
                className="input"
                value={anthropometry.leanBodyMassKg?.toFixed(1) || ''}
                disabled
                placeholder="Auto-calculated"
                style={{ backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed' }}
              />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Weight: {anthropometry.weight_kg} kg • Height: {anthropometry.height_cm} cm • Age: {anthropometry.age} • Sex: {anthropometry.sex}
            {anthropometry.bodyFatPercent && ` • Body Fat: ${anthropometry.bodyFatPercent}%`}
            {anthropometry.leanBodyMassKg && ` • LBM: ${anthropometry.leanBodyMassKg.toFixed(1)} kg`}
          </div>
        )}

        {anthropometry.source !== 'hub' && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={syncToHub}
                onChange={(e) => setSyncToHub(e.target.checked)}
                disabled={saving}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Save these values to athlete's HUB profile for future tests</span>
            </label>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" onClick={addRow} disabled={saving}>
          + Add Stage
        </button>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table className="table" style={{ minWidth: '860px', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '46px' }}>Stage</th>
              <th style={{ width: '86px' }}>Dur (s) *</th>
              <th style={{ width: '82px' }}>HR (bpm) *</th>
              <th style={{ width: '82px' }}>Power (W)</th>
              <th style={{ width: '96px' }}>Speed/Pace</th>
              <th style={{ width: '96px' }}>VO₂ ml/kg/min</th>
              <th style={{ width: '96px' }}>Lactate mmol/L</th>
              <th style={{ width: '64px' }}>RPE</th>
              <th style={{ width: '44px' }}>VT1</th>
              <th style={{ width: '44px' }}>VT2</th>
              <th style={{ width: '36px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ textAlign: 'center', fontWeight: '600' }}>{row.stage_number}</td>
                <td>
                  <input
                    type="number"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.duration_seconds}
                    onChange={(e) => updateRow(row.id, 'duration_seconds', e.target.value)}
                    placeholder="300"
                    disabled={saving}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.heart_rate}
                    onChange={(e) => updateRow(row.id, 'heart_rate', e.target.value)}
                    placeholder="150"
                    disabled={saving}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.power_watts}
                    onChange={(e) => updateRow(row.id, 'power_watts', e.target.value)}
                    placeholder="200"
                    disabled={saving}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.speed_pace}
                    onChange={(e) => updateRow(row.id, 'speed_pace', e.target.value)}
                    placeholder="5:00/km"
                    disabled={saving}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.vo2_ml_kg_min}
                    onChange={(e) => updateRow(row.id, 'vo2_ml_kg_min', e.target.value)}
                    placeholder="50"
                    disabled={saving}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.lactate}
                    onChange={(e) => updateRow(row.id, 'lactate', e.target.value)}
                    placeholder="2.0"
                    disabled={saving}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input"
                    style={{ padding: '0.375rem 0.5rem', fontSize: '0.8125rem' }}
                    value={row.rpe}
                    onChange={(e) => updateRow(row.id, 'rpe', e.target.value)}
                    placeholder="5"
                    disabled={saving}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row.vt1_marker}
                    onChange={(e) => updateRow(row.id, 'vt1_marker', e.target.checked)}
                    disabled={saving}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row.vt2_marker}
                    onChange={(e) => updateRow(row.id, 'vt2_marker', e.target.checked)}
                    disabled={saving}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  {rows.length > 1 && (
                    <button
                      className="btn"
                      onClick={() => removeRow(row.id)}
                      disabled={saving}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'transparent',
                        color: 'var(--accent-red)',
                        border: 'none'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={validateAndSave} disabled={saving}>
          {saving ? 'Saving & Calculating...' : 'Save & Calculate Results'}
        </button>
      </div>
    </div>
  );
}
