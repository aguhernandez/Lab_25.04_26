import { useState } from 'react';
import { LabSession, LabPhase, PHASE_ORDER, initialLabSession } from '../../lib/labSession';
import { useLanguage } from '../../contexts/LanguageContext';
import LabPhaseSelection from './LabPhaseSelection';
import LabPhasePretest from './LabPhasePretest';
import LabPhaseStages from './LabPhaseStages';
import LabPhaseProcessing from './LabPhaseProcessing';
import LabPhaseResults from './LabPhaseResults';
import LabPhaseApply from './LabPhaseApply';
import LabPhaseReport from './LabPhaseReport';

interface Props {
  onExit?: () => void;
}

const VISIBLE_PHASES: LabPhase[] = ['selection', 'pretest', 'stages', 'processing', 'results', 'apply', 'report'];

export default function LabWorkflow({ onExit }: Props) {
  const { t } = useLanguage();
  const [session, setSession] = useState<LabSession>(initialLabSession());

  const PHASE_TRANSLATION_KEYS: Record<LabPhase, string> = {
    selection: 'workflow.selection',
    pretest: 'workflow.preTest',
    stages: 'workflow.dataEntry',
    processing: 'workflow.processing',
    results: 'workflow.results',
    apply: 'workflow.apply',
    report: 'workflow.report',
  };

  const updateSession = (updates: Partial<LabSession>) => {
    setSession(prev => ({ ...prev, ...updates }));
  };

  const goTo = (phase: LabPhase) => {
    setSession(prev => ({ ...prev, phase }));
  };

  const goNext = () => {
    const idx = PHASE_ORDER.indexOf(session.phase);
    let nextIdx = idx + 1;
    if (session.skipPretest && PHASE_ORDER[nextIdx] === 'pretest') {
      nextIdx++;
    }
    if (nextIdx < PHASE_ORDER.length) {
      goTo(PHASE_ORDER[nextIdx]);
    }
  };

  const goBack = () => {
    const idx = PHASE_ORDER.indexOf(session.phase);
    let prevIdx = idx - 1;
    if (session.skipPretest && PHASE_ORDER[prevIdx] === 'pretest') {
      prevIdx--;
    }
    if (prevIdx >= 0) {
      goTo(PHASE_ORDER[prevIdx]);
    }
  };

  const startNew = () => {
    setSession(initialLabSession());
  };

  const currentIdx = PHASE_ORDER.indexOf(session.phase);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {VISIBLE_PHASES.map((phase, idx) => {
                const done = idx < currentIdx;
                const active = phase === session.phase;
                const reachable = idx <= currentIdx;

                return (
                  <div key={phase} className="flex items-center gap-2 flex-shrink-0">
                    {idx > 0 && (
                      <div className={`w-6 h-px ${done ? 'bg-blue-400' : 'bg-gray-200 dark:bg-gray-600'}`} />
                    )}
                    <button
                      disabled={!reachable}
                      onClick={() => reachable && goTo(phase)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        active
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : done
                          ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {done && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {!done && (
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center border ${
                          active ? 'border-blue-500 text-blue-700 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600 text-gray-400'
                        }`}>
                          {idx + 1}
                        </span>
                      )}
                      <span className="hidden sm:inline">{t(PHASE_TRANSLATION_KEYS[phase])}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {onExit && (
              <button
                onClick={onExit}
                className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm"
              >
                {t('workflow.exit')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${session.phase === 'stages' ? 'max-w-7xl' : 'max-w-4xl'}`}>
        {session.phase === 'selection' && (
          <LabPhaseSelection
            session={session}
            onUpdate={updateSession}
            onNext={goNext}
          />
        )}

        {session.phase === 'pretest' && session.athlete && (
          <LabPhasePretest
            session={session}
            onUpdate={updateSession}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {session.phase === 'stages' && session.athlete && (
          <LabPhaseStages
            session={session}
            onUpdate={updateSession}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {session.phase === 'processing' && (session.testId || session.manualResultsMode) && (
          <LabPhaseProcessing
            session={session}
            onUpdate={updateSession}
            onNext={goNext}
          />
        )}

        {session.phase === 'results' && (session.results || session.manualResultsMode) && (
          <LabPhaseResults
            session={session}
            onUpdate={updateSession}
            onNext={goNext}
          />
        )}

        {session.phase === 'apply' && session.results && (
          <LabPhaseApply
            session={session}
            onUpdate={updateSession}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {session.phase === 'report' && (
          <LabPhaseReport
            session={session}
            onBack={goBack}
            onStartNew={startNew}
          />
        )}
      </div>
    </div>
  );
}
