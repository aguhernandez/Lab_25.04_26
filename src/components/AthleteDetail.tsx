import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Athlete, Test } from '../types';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';
import PhysiologyProfileCard from './PhysiologyProfileCard';
import HydrationProfileCard from './hydration/HydrationProfileCard';
import PushToHubButton from './PushToHubButton';
import { Pencil, Trash2, Mail, Calendar, User } from 'lucide-react';

interface AthleteDetailProps {
  athlete: Athlete;
  onStartTest: () => void;
  onViewResults: (testId: string) => void;
  onEditAthlete?: () => void;
  onAthleteDeleted?: () => void;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export default function AthleteDetail({ athlete, onViewResults, onEditAthlete, onAthleteDeleted }: AthleteDetailProps) {
  const { profile } = useAuth();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [testToDelete, setTestToDelete] = useState<string | null>(null);
  const [confirmDeleteAthlete, setConfirmDeleteAthlete] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
  const isAdmin = effectiveRole === 'admin';
  const isCoach = effectiveRole === 'coach';
  const canEdit = isAdmin || isCoach;

  useEffect(() => {
    loadTests();
  }, [athlete.id]);

  const loadTests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('test_date', { ascending: false });

      if (error) throw error;
      setTests(data || []);
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = (testId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestToDelete(testId);
  };

  const confirmDeleteTest = async () => {
    if (!testToDelete) return;

    try {
      const { error: dataPointsError } = await supabase
        .from('test_data_points')
        .delete()
        .eq('test_id', testToDelete);

      if (dataPointsError) throw dataPointsError;

      const { error: resultsError } = await supabase
        .from('test_results')
        .delete()
        .eq('test_id', testToDelete);

      if (resultsError) throw resultsError;

      const { error: testError } = await supabase
        .from('tests')
        .delete()
        .eq('id', testToDelete);

      if (testError) throw testError;

      setTests(tests.filter(t => t.id !== testToDelete));
      setTestToDelete(null);
    } catch (err) {
      console.error('Failed to delete test:', err);
      setToast({ message: 'Failed to delete test. Please try again.', type: 'error' });
    }
  };

  const handleDeleteAthlete = async () => {
    try {
      const { error } = await supabase
        .from('athletes')
        .delete()
        .eq('id', athlete.id);

      if (error) throw error;

      setToast({ message: 'Atleta eliminado correctamente.', type: 'success' });
      setTimeout(() => {
        onAthleteDeleted?.();
      }, 800);
    } catch (err) {
      console.error('Failed to delete athlete:', err);
      setToast({ message: 'Error al eliminar el atleta. Intenta de nuevo.', type: 'error' });
    }
    setConfirmDeleteAthlete(false);
  };

  const calculateAge = () => {
    if (!athlete.date_of_birth) return null;
    const birthDate = new Date(athlete.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { className: string; label: string }> = {
      'completed': { className: 'badge-green', label: 'Completed' },
      'in_progress': { className: 'badge-yellow', label: 'In Progress' },
      'cancelled': { className: 'badge-red', label: 'Cancelled' }
    };
    const style = styles[status] || styles['in_progress'];
    return <span className={`badge ${style.className}`}>{style.label}</span>;
  };

  const getTestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'ramp': 'Ramp Test',
      'steady_state': 'Steady State',
      'time_trial': 'Time Trial'
    };
    return labels[type] || type;
  };

  const age = calculateAge();
  const athleteEmail = (athlete as any).email;

  const sportLabels: Record<string, string> = {
    cycling: 'Ciclismo',
    running: 'Running',
    triathlon: 'Triatlón',
    swimming: 'Natación',
    other: 'Otros',
  };

  const sexLabels: Record<string, string> = {
    male: 'Masculino',
    female: 'Femenino',
    prefer_not_to_say: 'No especificado',
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
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #514163 0%, #6b5580 100%)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white/80" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{athlete.name}</h1>
                {athlete.sport && (
                  <p className="text-sm capitalize" style={{ color: 'rgba(253,218,54,0.75)' }}>
                    {sportLabels[athlete.sport] || athlete.sport}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && onEditAthlete && (
                <button
                  onClick={onEditAthlete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                  title="Editar datos del atleta"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
              {isAdmin && onAthleteDeleted && (
                <button
                  onClick={() => setConfirmDeleteAthlete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white text-xs font-medium transition-colors"
                  title="Eliminar atleta"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-1.5 flex-wrap">
            {athlete.sport && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 capitalize">
                {sportLabels[athlete.sport] || athlete.sport}
              </span>
            )}
            {athlete.sex && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                {sexLabels[athlete.sex] || athlete.sex}
              </span>
            )}
            {age && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {age} años
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {athlete.date_of_birth && (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Fecha de nacimiento</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(athlete.date_of_birth)}</p>
                </div>
              </div>
            )}
            {athleteEmail && (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Email</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{athleteEmail}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            {athlete.weight_kg && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Peso</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{athlete.weight_kg}</p>
                <p className="text-[10px] text-gray-400">kg</p>
              </div>
            )}
            {athlete.height_cm && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Altura</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{athlete.height_cm}</p>
                <p className="text-[10px] text-gray-400">cm</p>
              </div>
            )}
            {athlete.body_fat_percent && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">% Grasa</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{athlete.body_fat_percent}</p>
                <p className="text-[10px] text-gray-400">%</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <PhysiologyProfileCard
        athleteId={athlete.id}
        sport={athlete.sport}
        onToast={(message, type) => setToast({ message, type })}
      />

      {athlete.hub_user_id && (
        <PushToHubButton
          athleteId={athlete.id}
          athleteName={athlete.name}
          onToast={(message, type) => setToast({ message, type })}
        />
      )}

      <HydrationProfileCard athleteId={athlete.id} />

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">Historial de Tests</h3>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Cargando tests...</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">No hay tests registrados. Iniciá una Sesión de Lab para agregar tests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <div
                key={test.id}
                onClick={() => test.status === 'completed' && onViewResults(test.id)}
                className={`group bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-2 border-gray-200 dark:border-gray-700 transition-all duration-300 ${
                  test.status === 'completed' ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1' : 'opacity-70'
                }`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{getTestTypeLabel(test.test_type)}</h4>
                        {getStatusBadge(test.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(test.test_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => handleDeleteTest(test.id, e)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar test"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      {test.status === 'completed' && (
                        <div className="flex items-center text-[#514163] dark:text-[#fdda36] font-semibold text-sm group-hover:gap-2 transition-all">
                          Ver Resultados
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={testToDelete !== null}
        title="Eliminar Test"
        message="¿Estás seguro de que querés eliminar este test? Esta acción no se puede deshacer y todos los datos del test serán eliminados permanentemente."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={confirmDeleteTest}
        onCancel={() => setTestToDelete(null)}
        isDanger={true}
      />

      <ConfirmDialog
        isOpen={confirmDeleteAthlete}
        title="Eliminar Atleta"
        message={`¿Estás seguro de que querés eliminar a ${athlete.name}? Esta acción no se puede deshacer y todos los datos del atleta serán eliminados permanentemente.`}
        confirmLabel="Eliminar atleta"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteAthlete}
        onCancel={() => setConfirmDeleteAthlete(false)}
        isDanger={true}
      />
    </div>
  );
}
