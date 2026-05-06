import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete, Test, TestDataPoint, TestType, Sport, AnthropometryData } from '../types';
import { loadAnthropometryFromHub, saveTestAnthropometry } from '../lib/anthropometry';
import TestSetup, { StageConfig } from './TestSetup';
import DataInput from './DataInput';
import ManualResultsImport from './ManualResultsImport';
import Toast from './Toast';

interface TestViewProps {
  athlete: Athlete;
  onComplete: (testId: string) => void;
}

type Stage = 'setup' | 'data_entry' | 'manual_import';

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export default function TestView({ athlete, onComplete }: TestViewProps) {
  const [stage, setStage] = useState<Stage>('setup');
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(false);
  const [anthropometry, setAnthropometry] = useState<AnthropometryData | null>(null);
  const [stageConfig, setStageConfig] = useState<StageConfig | undefined>(undefined);
  const [anthropometryStatus, setAnthropometryStatus] = useState<{
    isComplete: boolean;
    missingFields: string[];
  }>({ isComplete: false, missingFields: [] });
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    loadAthleteAnthropometry();
  }, [athlete.id]);

  const loadAthleteAnthropometry = async () => {
    const status = await loadAnthropometryFromHub(athlete.id);
    setAnthropometryStatus({
      isComplete: status.isComplete,
      missingFields: status.missingFields,
    });
    if (status.data) {
      setAnthropometry(status.data);
    }
  };

  const handleTestSetup = async (testType: TestType, sport: Sport, config?: StageConfig) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tests')
        .insert([{
          athlete_id: athlete.id,
          test_date: new Date().toISOString().split('T')[0],
          sport: sport,
          test_type: testType,
          status: 'in_progress'
        }])
        .select()
        .single();

      if (error) throw error;

      if (anthropometry) {
        await saveTestAnthropometry(data.id, anthropometry);
      }

      setStageConfig(config);
      setCurrentTest(data);
      setStage('data_entry');
    } catch (err) {
      console.error('Failed to create test:', err);
      setToast({ message: 'Failed to create test. Please try again.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDataComplete = async (_points: TestDataPoint[]) => {
    if (!currentTest) return;

    try {
      const { error } = await supabase
        .from('tests')
        .update({ status: 'completed' })
        .eq('id', currentTest.id);

      if (error) throw error;

      onComplete(currentTest.id);
    } catch (err) {
      console.error('Failed to complete test:', err);
      setToast({ message: 'Failed to complete test. Please try again.', type: 'error' });
    }
  };

  const handleBackToSetup = () => {
    setStage('setup');
    setCurrentTest(null);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{athlete.name}</h2>
              </div>
            </div>
            {stage === 'data_entry' && (
              <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
                Data Entry
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
              {athlete.sport}
            </span>
            {athlete.weight_kg && (
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                {athlete.weight_kg} kg
              </span>
            )}
            {athlete.sex && (
              <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-sm font-medium">
                {athlete.sex.charAt(0).toUpperCase() + athlete.sex.slice(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      {anthropometryStatus.isComplete && anthropometry && (
        <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Anthropometry loaded from HUB
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Weight: {anthropometry.weight_kg} kg • Height: {anthropometry.height_cm} cm • Age: {anthropometry.age} • Sex: {anthropometry.sex}
                {anthropometry.bodyFatPercent && ` • Body Fat: ${anthropometry.bodyFatPercent}%`}
              </p>
            </div>
          </div>
        </div>
      )}

      {!anthropometryStatus.isComplete && anthropometryStatus.missingFields.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                Incomplete anthropometry in HUB
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Missing: {anthropometryStatus.missingFields.join(', ')}. You'll need to enter this data manually.
              </p>
            </div>
          </div>
        </div>
      )}

      {stage === 'setup' && (
        <TestSetup
          athlete={athlete}
          onSetupComplete={handleTestSetup}
          onImportResults={() => setStage('manual_import')}
          loading={loading}
        />
      )}

      {stage === 'manual_import' && (
        <ManualResultsImport
          athlete={athlete}
          onComplete={onComplete}
          onCancel={() => setStage('setup')}
        />
      )}

      {stage === 'data_entry' && currentTest && (
        <DataInput
          test={currentTest}
          athlete={athlete}
          onComplete={handleDataComplete}
          onCancel={handleBackToSetup}
          initialAnthropometry={anthropometry}
          anthropometrySource={anthropometry ? 'hub' : 'manual'}
          stageConfig={stageConfig}
        />
      )}
    </div>
  );
}
