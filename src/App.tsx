import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useLanguage } from './contexts/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import AthleteSelector from './components/AthleteSelector';
import AthleteForm from './components/AthleteForm';
import AthleteEditForm from './components/AthleteEditForm';
import AthleteList from './components/AthleteList';
import AthleteDetail from './components/AthleteDetail';
import TestView from './components/TestView';
import ResultsView from './components/ResultsView';
import UserManagement from './components/UserManagement';
import Settings from './components/Settings';
import ProfileView from './components/ProfileView';
import MyEvaluations from './components/MyEvaluations';
import Evaluations from './components/Evaluations';
import AnthropometryPage from './pages/AnthropometryPage';
import AnthropometryDashboard from './pages/AnthropometryDashboard';
import EnvironmentalPhysiology from './pages/EnvironmentalPhysiology';
import LabWorkflow from './components/lab/LabWorkflow';
import ForceVelocityLab from './pages/ForceVelocityLab';
import ReferencePopulationsAdmin from './components/ReferencePopulationsAdmin';
import ReportsPage from './pages/ReportsPage';
import SimulationPage from './pages/SimulationPage';
import { Athlete } from './types';

type View = 'dashboard' | 'athlete-selector' | 'create-athlete' | 'edit-athlete' | 'athletes' | 'athlete-detail' | 'test' | 'results' | 'admin' | 'users' | 'settings' | 'profile' | 'my-evaluations' | 'evaluations' | 'anthropometry' | 'anthropometry-dashboard' | 'environmental-physiology' | 'lab' | 'force-velocity' | 'reference-populations' | 'reports' | 'simulation';

function AppContent() {
  const { user, profile, loading, hasToken, isDevMode, login } = useAuth();
  const { t } = useLanguage();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [athleteForReports, setAthleteForReports] = useState<Athlete | null>(null);

  useEffect(() => {
    if (!loading && !user && !hasToken && !isDevMode) {
      console.log('🔄 No user, no token, redirecting to HUB...');
      const timer = setTimeout(() => {
        login();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading, hasToken, isDevMode, login]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-white text-2xl font-semibold">{t('app.loading')}</div>
      </div>
    );
  }

  if (!user && !isDevMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-600 text-3xl">🔐</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-4">
              Redirecting to HUB for authentication...
            </p>
            <p className="text-sm text-gray-500">
              If you're not redirected automatically, click the button below.
            </p>
            <button
              onClick={login}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition font-medium"
            >
              Go to HUB Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-yellow-600 text-3xl">⚠</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Profile Syncing</h2>
            <p className="text-gray-600 mb-4">
              Creating your profile in LAB satellite...
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  const handleViewAthlete = (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setCurrentView('athlete-detail');
  };

  const handleStartTest = (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setCurrentView('test');
  };

  const handleViewResults = (testId: string) => {
    setSelectedTestId(testId);
    setCurrentView('results');
  };

  const handleBackToAthletes = () => {
    setCurrentView('athletes');
    setSelectedAthlete(null);
    setSelectedTestId(null);
  };

  const handleBackToAthleteDetail = () => {
    setCurrentView('athlete-detail');
    setSelectedTestId(null);
  };

  const handleSelectAthleteForTest = (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setCurrentView('test');
  };

  const handleCreateNewAthlete = () => {
    setCurrentView('create-athlete');
  };

  const handleAthleteCreated = () => {
    setCurrentView('athletes');
  };

  const handleCancelCreateAthlete = () => {
    setCurrentView('athletes');
  };

  const handleEditAthlete = () => {
    setCurrentView('edit-athlete');
  };

  const handleAthleteUpdated = (updated: Athlete) => {
    setSelectedAthlete(updated);
    setCurrentView('athlete-detail');
  };

  const handleAthleteDeleted = () => {
    setSelectedAthlete(null);
    setCurrentView('athletes');
  };

  const handleNewTest = () => {
    setCurrentView('athlete-selector');
  };

  const handleNavigate = (path: string) => {
    const viewMap: { [key: string]: View } = {
      '/dashboard': 'dashboard',
      '/athletes': 'athletes',
      '/evaluations': 'evaluations',
      '/users': 'users',
      '/settings': 'settings',
      '/profile': 'profile',
      '/my-evaluations': 'my-evaluations',
      '/anthropometry': 'anthropometry',
      '/anthropometry-dashboard': 'anthropometry-dashboard',
      '/environmental-physiology': 'environmental-physiology',
      '/lab': 'lab',
      '/force-velocity': 'force-velocity',
      '/reference-populations': 'reference-populations',
      '/reports': 'reports',
      '/simulation': 'simulation',
    };
    const view = viewMap[path];
    if (view) {
      setCurrentView(view);
      setSelectedAthlete(null);
      setSelectedTestId(null);
      if (view !== 'reports') setAthleteForReports(null);
    }
  };

  const handleNavigateToReports = (athlete: Athlete) => {
    setAthleteForReports(athlete);
    setCurrentView('reports');
  };

  return (
    <>
    <ProtectedRoute>
      <Layout currentView={currentView} onNavigate={handleNavigate}>
        <div className="min-h-screen">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto flex justify-end items-center">
            <div className="flex gap-3 items-center">
              {currentView === 'athlete-selector' && (
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                  onClick={handleBackToAthletes}
                >
                  {t('app.manageathletes')}
                </button>
              )}
              {currentView === 'create-athlete' && (
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                  onClick={handleCancelCreateAthlete}
                >
                  {t('app.backathletes')}
                </button>
              )}
              {currentView === 'edit-athlete' && selectedAthlete && (
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                  onClick={() => setCurrentView('athlete-detail')}
                >
                  Cancelar
                </button>
              )}
              {currentView === 'athlete-detail' && (
                <>
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                    onClick={handleBackToAthletes}
                  >
                    {t('app.backathletes')}
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90 transition-colors font-body font-bold"
                    onClick={handleNewTest}
                  >
                    {t('app.newtest')}
                  </button>
                </>
              )}
              {currentView === 'test' && (
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                  onClick={() => setCurrentView('athlete-selector')}
                >
                  {t('app.canceltest')}
                </button>
              )}
              {currentView === 'results' && (
                <>
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                    onClick={handleBackToAthleteDetail}
                  >
                    {t('app.backtests')}
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90 transition-colors font-body font-bold"
                    onClick={handleNewTest}
                  >
                    {t('app.newtest')}
                  </button>
                </>
              )}
              {currentView === 'athletes' && (
                <button
                  className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors font-body font-semibold"
                  onClick={handleCreateNewAthlete}
                >
                  + New Athlete
                </button>
              )}
              {currentView === 'dashboard' && (
                <button
                  className="px-4 py-2 rounded-lg bg-[#fdda36] text-[#514163] hover:bg-[#fdda36]/90 transition-colors font-body font-bold"
                  onClick={() => setCurrentView('lab')}
                >
                  Start Lab Session
                </button>
              )}
              {currentView === 'lab' && (
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-body font-medium"
                  onClick={() => setCurrentView('dashboard')}
                >
                  Exit Lab
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'admin' && <AdminPanel />}
          {currentView === 'users' && <UserManagement />}
          {currentView === 'settings' && <Settings />}
          {currentView === 'profile' && <ProfileView />}
          {currentView === 'my-evaluations' && <MyEvaluations />}
          {currentView === 'evaluations' && <Evaluations onViewResults={handleViewResults} />}
          {currentView === 'anthropometry' && <AnthropometryPage onNavigateToReports={handleNavigateToReports} />}
          {currentView === 'anthropometry-dashboard' && <AnthropometryDashboard />}

          {currentView === 'environmental-physiology' && <EnvironmentalPhysiology />}

          {currentView === 'force-velocity' && <ForceVelocityLab />}

          {currentView === 'reference-populations' && <ReferencePopulationsAdmin />}

          {currentView === 'reports' && <ReportsPage initialAthlete={athleteForReports} />}

          {currentView === 'simulation' && <SimulationPage />}

          {currentView === 'lab' && (
            <LabWorkflow onExit={() => setCurrentView('dashboard')} />
          )}

          {currentView === 'athlete-selector' && (
            <AthleteSelector
              onSelectAthlete={handleSelectAthleteForTest}
              onCreateNew={handleCreateNewAthlete}
            />
          )}

          {currentView === 'create-athlete' && (
            <AthleteForm
              onCancel={handleCancelCreateAthlete}
              onSuccess={handleAthleteCreated}
            />
          )}

          {currentView === 'athletes' && (
            <AthleteList onViewAthlete={handleViewAthlete} />
          )}

          {currentView === 'athlete-detail' && selectedAthlete && (
            <AthleteDetail
              athlete={selectedAthlete}
              onStartTest={() => handleStartTest(selectedAthlete)}
              onViewResults={handleViewResults}
              onEditAthlete={handleEditAthlete}
              onAthleteDeleted={handleAthleteDeleted}
            />
          )}

          {currentView === 'edit-athlete' && selectedAthlete && (
            <AthleteEditForm
              athlete={selectedAthlete}
              onCancel={() => setCurrentView('athlete-detail')}
              onSuccess={handleAthleteUpdated}
            />
          )}

          {currentView === 'test' && selectedAthlete && (
            <TestView
              athlete={selectedAthlete}
              onComplete={(testId) => {
                setSelectedTestId(testId);
                setCurrentView('results');
              }}
            />
          )}

          {currentView === 'results' && selectedTestId && (
            <ResultsView
              testId={selectedTestId}
              onTestDeleted={handleBackToAthleteDetail}
            />
          )}
        </main>
      </div>
    </Layout>
    </ProtectedRoute>
    </>
  );
}

function App() {
  return <AppContent />;
}

export default App;
