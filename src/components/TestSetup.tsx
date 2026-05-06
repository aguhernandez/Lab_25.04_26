import { useState } from 'react';
import { Athlete, TestType, Sport } from '../types';

export interface StageConfig {
  numStages: number;
  stageDurationSeconds: number;
}

interface TestSetupProps {
  athlete: Athlete;
  onSetupComplete: (testType: TestType, sport: Sport, stageConfig?: StageConfig) => void;
  onImportResults: () => void;
  loading: boolean;
}

export default function TestSetup({ athlete, onSetupComplete, onImportResults, loading }: TestSetupProps) {
  const [testType, setTestType] = useState<TestType>('ramp');
  const [sport, setSport] = useState<Sport>(athlete.sport);
  const [numStages, setNumStages] = useState<number>(5);
  const [stageDuration, setStageDuration] = useState<number>(180);

  const testTypes = [
    {
      value: 'ramp' as TestType,
      label: 'Ramp Test',
      description: 'Progressive intensity increase until exhaustion'
    },
    {
      value: 'step' as TestType,
      label: 'Step Test',
      description: 'Fixed stages with measurements at each step'
    },
    {
      value: 'steady_state' as TestType,
      label: 'Steady State Test',
      description: 'Constant intensity for HR drift and efficiency analysis'
    },
    {
      value: 'manual' as TestType,
      label: 'Manual Entry',
      description: 'Enter data from field tests or other sources'
    }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stageConfig = (testType === 'ramp' || testType === 'step')
      ? { numStages, stageDurationSeconds: stageDuration }
      : undefined;

    onSetupComplete(testType, sport, stageConfig);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        Test Setup
      </h2>

      <div
        className="card-content"
        style={{
          marginBottom: '1.5rem',
          border: '2px dashed var(--border-color)',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Already have results from another app?
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Skip the data entry and import VO2 Max, HR Max, VT1, VT2, Speed Max and ventilation metrics directly.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onImportResults}
          disabled={loading}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Import Results
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card-content" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Select Sport
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {(['cycling', 'running', 'triathlon', 'swimming'] as Sport[]).map((s) => (
              <button
                key={s}
                type="button"
                className="btn"
                onClick={() => setSport(s)}
                disabled={loading}
                style={{
                  backgroundColor: sport === s ? 'var(--primary-yellow)' : 'var(--bg-tertiary)',
                  color: sport === s ? 'var(--primary-purple)' : 'var(--text-primary)',
                  border: `1px solid ${sport === s ? 'var(--primary-yellow)' : 'var(--border-color)'}`,
                  padding: '0.75rem',
                  textAlign: 'center'
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="card-content" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Select Test Type
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {testTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                className="btn"
                onClick={() => setTestType(type.value)}
                disabled={loading}
                style={{
                  backgroundColor: testType === type.value ? 'var(--primary-yellow)' : 'var(--bg-tertiary)',
                  color: testType === type.value ? 'var(--primary-purple)' : 'var(--text-primary)',
                  border: `1px solid ${testType === type.value ? 'var(--primary-yellow)' : 'var(--border-color)'}`,
                  padding: '1rem',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{type.label}</div>
                <div style={{
                  fontSize: '0.8125rem',
                  opacity: testType === type.value ? 0.9 : 0.7
                }}>
                  {type.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {(testType === 'ramp' || testType === 'step') && (
          <div className="card-content" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Stage Configuration
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Pre-configure the number of stages and duration for the test. This will create rows with the specified durations.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label className="label">Number of Stages</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="input"
                  value={numStages}
                  onChange={(e) => setNumStages(parseInt(e.target.value) || 1)}
                  disabled={loading}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Typical: 5-10 stages
                </p>
              </div>
              <div>
                <label className="label">Stage Duration (seconds)</label>
                <input
                  type="number"
                  min="30"
                  max="600"
                  step="30"
                  className="input"
                  value={stageDuration}
                  onChange={(e) => setStageDuration(parseInt(e.target.value) || 180)}
                  disabled={loading}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Typical: 180-300 seconds (3-5 minutes)
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
          >
            {loading ? 'Creating Test...' : 'Start Test →'}
          </button>
        </div>
      </form>
    </div>
  );
}
