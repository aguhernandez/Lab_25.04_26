import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Athlete, Test } from '../types';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';
import PhysiologyProfileCard from './PhysiologyProfileCard';
import HydrationProfileCard from './hydration/HydrationProfileCard';
import PushToHubButton from './PushToHubButton';
import { Pencil, Trash2, Mail, Calendar, User, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

interface TestResult {
  id: string;
  test_id: string;
  vo2max?: number | null;
  vo2max_measured?: boolean | null;
  lt1_hr?: number | null;
  lt1_power?: number | null;
  lt2_hr?: number | null;
  lt2_power?: number | null;
  fatmax_hr?: number | null;
  coach_notes?: string | null;
  data_quality?: string | null;
}

interface TestWithResult extends Test {
  result: TestResult | null;
}

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

const TEST_TYPE_LABELS: Record<string, string> = {
  ramp: 'Ramp Test',
  step: 'Step Test',
  steady_state: 'Steady State',
  time_trial: 'Time Trial',
  manual: 'Manual',
};

const SPORT_LABELS: Record<string, string> = {
  cycling: 'Ciclismo',
  running: 'Running',
  triathlon: 'Triatlón',
  swimming: 'Natación',
  other: 'Otros',
};

const SEX_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  prefer_not_to_say: 'No especificado',
};

function DeltaBadge({ delta, unit }: { delta: number; unit: string }) {
  if (Math.abs(delta) < 0.01) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400">
        <Minus className="w-3 h-3" /> {unit}
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {positive ? '+' : ''}{delta % 1 === 0 ? delta : delta.toFixed(1)} {unit}
    </span>
  );
}

export default function AthleteDetail({ athlete, onViewResults, onEditAthlete, onAthleteDeleted }: AthleteDetailProps) {
  const { profile } = useAuth();
  const [tests, setTests] = useState<TestWithResult[]>([]);
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
      const { data: testsData, error: testsError } = await supabase
        .from('tests')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('test_date', { ascending: false });

      if (testsError) throw testsError;

      if (!testsData || testsData.length === 0) {
        setTests([]);
        return;
      }

      const { data: resultsData } = await supabase
        .from('test_results')
        .select('*')
        .in('test_id', testsData.map(t => t.id));

      setTests(testsData.map(t => ({
        ...t,
        result: resultsData?.find(r => r.test_id === t.id) ?? null,
      })));
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
      await supabase.from('test_data_points').delete().eq('test_id', testToDelete);
      await supabase.from('test_results').delete().eq('test_id', testToDelete);
      const { error } = await supabase.from('tests').delete().eq('id', testToDelete);
      if (error) throw error;
      setTests(prev => prev.filter(t => t.id !== testToDelete));
      setTestToDelete(null);
    } catch (err) {
      console.error('Failed to delete test:', err);
      setToast({ message: 'Failed to delete test. Please try again.', type: 'error' });
    }
  };

  const handleDeleteAthlete = async () => {
    try {
      const { error } = await supabase.from('athletes').delete().eq('id', athlete.id);
      if (error) throw error;
      setToast({ message: 'Atleta eliminado correctamente.', type: 'success' });
      setTimeout(() => onAthleteDeleted?.(), 800);
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
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { className: string; label: string }> = {
      completed: { className: 'badge-green', label: 'Completed' },
      in_progress: { className: 'badge-yellow', label: 'In Progress' },
      cancelled: { className: 'badge-red', label: 'Cancelled' },
    };
    const s = map[status] || map['in_progress'];
    return <span className={`badge ${s.className}`}>{s.label}</span>;
  };

  // Sorted ascending for chart and progress comparison (newest last for chart)
  const completedWithResults = tests
    .filter(t => t.status === 'completed' && t.result?.vo2max != null)
    .slice()
    .sort((a, b) => new Date(a.test_date).getTime() - new Date(b.test_date).getTime());

  const latestTest = completedWithResults[completedWithResults.length - 1];
  const previousTest = completedWithResults[completedWithResults.length - 2];

  const chartData = completedWithResults.map(t => ({
    date: new Date(t.test_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
    'VO₂max': t.result?.vo2max ? +t.result.vo2max.toFixed(1) : null,
    'LT2 HR': t.result?.lt2_hr ?? null,
  }));

  const age = calculateAge();
  const athleteEmail = (athlete as any).email;

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Athlete header card */}
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
                    {SPORT_LABELS[athlete.sport] || athlete.sport}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {canEdit && onEditAthlete && (
                <button
                  onClick={onEditAthlete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
              {isAdmin && onAthleteDeleted && (
                <button
                  onClick={() => setConfirmDeleteAthlete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-200 hover:text-white text-xs font-medium transition-colors"
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
                {SPORT_LABELS[athlete.sport] || athlete.sport}
              </span>
            )}
            {athlete.sex && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                {SEX_LABELS[athlete.sex] || athlete.sex}
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

      {/* Test history section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="text-2xl font-heading font-bold text-gray-900 dark:text-white mb-6">Historial de Tests</h3>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-[#fdda36] border-t-transparent animate-spin" />
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm text-gray-400 dark:text-gray-500">No hay tests registrados. Iniciá una Sesión de Lab para agregar tests.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Progress comparison (requires 2+ completed tests with results) */}
            {latestTest && previousTest && (
              <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
                  Progreso — {formatDate(previousTest.test_date)} → {formatDate(latestTest.test_date)}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {/* VO2max delta */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">VO₂max</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {latestTest.result!.vo2max!.toFixed(1)}
                      <span className="text-xs font-normal text-gray-400 ml-1">ml/kg/min</span>
                    </p>
                    <DeltaBadge
                      delta={+(latestTest.result!.vo2max! - previousTest.result!.vo2max!).toFixed(1)}
                      unit="ml/kg/min"
                    />
                  </div>

                  {/* LT2 HR delta */}
                  {latestTest.result?.lt2_hr != null && previousTest.result?.lt2_hr != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">LT2 FC</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {latestTest.result.lt2_hr}
                        <span className="text-xs font-normal text-gray-400 ml-1">bpm</span>
                      </p>
                      <DeltaBadge
                        delta={latestTest.result.lt2_hr - previousTest.result.lt2_hr}
                        unit="bpm"
                      />
                    </div>
                  )}

                  {/* LT2 Power delta */}
                  {latestTest.result?.lt2_power != null && previousTest.result?.lt2_power != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">LT2 Potencia</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {Math.round(latestTest.result.lt2_power)}
                        <span className="text-xs font-normal text-gray-400 ml-1">W</span>
                      </p>
                      <DeltaBadge
                        delta={Math.round(latestTest.result.lt2_power - previousTest.result.lt2_power)}
                        unit="W"
                      />
                    </div>
                  )}

                  {/* LT1 HR delta */}
                  {latestTest.result?.lt1_hr != null && previousTest.result?.lt1_hr != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">LT1 FC</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {latestTest.result.lt1_hr}
                        <span className="text-xs font-normal text-gray-400 ml-1">bpm</span>
                      </p>
                      <DeltaBadge
                        delta={latestTest.result.lt1_hr - previousTest.result.lt1_hr}
                        unit="bpm"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VO2max trend chart */}
            {chartData.length >= 2 && (
              <div className="rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
                  Evolución Fisiológica
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="vo2"
                      orientation="left"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                    />
                    {chartData.some(d => d['LT2 HR'] != null) && (
                      <YAxis
                        yAxisId="hr"
                        orientation="right"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        domain={['auto', 'auto']}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        background: '#1f2937',
                        border: 'none',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#fff',
                      }}
                      cursor={{ stroke: '#fdda36', strokeWidth: 1, strokeDasharray: '4 2' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#6b7280' }}
                    />
                    <Line
                      yAxisId="vo2"
                      type="monotone"
                      dataKey="VO₂max"
                      stroke="#fdda36"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#fdda36', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                    {chartData.some(d => d['LT2 HR'] != null) && (
                      <Line
                        yAxisId="hr"
                        type="monotone"
                        dataKey="LT2 HR"
                        stroke="#6366f1"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Test list */}
            <div className="space-y-3">
              {tests.map((test) => {
                const r = test.result;
                return (
                  <div
                    key={test.id}
                    onClick={() => test.status === 'completed' && onViewResults(test.id)}
                    className={`group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 ${
                      test.status === 'completed'
                        ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5'
                        : 'opacity-70'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {TEST_TYPE_LABELS[test.test_type] || test.test_type}
                            </h4>
                            {getStatusBadge(test.status)}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(test.test_date)}</p>

                          {/* Key results row */}
                          {r && test.status === 'completed' && (
                            <div className="flex flex-wrap gap-3 mt-2.5">
                              {r.vo2max != null && (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-base font-bold text-gray-900 dark:text-white">
                                    {r.vo2max.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">ml/kg/min</span>
                                </div>
                              )}
                              {r.lt2_hr != null && (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    {r.lt2_hr}
                                  </span>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">bpm LT2</span>
                                </div>
                              )}
                              {r.lt2_power != null && (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    {Math.round(r.lt2_power)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">W LT2</span>
                                </div>
                              )}
                              {r.lt1_hr != null && (
                                <div className="flex items-baseline gap-1">
                                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    {r.lt1_hr}
                                  </span>
                                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">bpm LT1</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => handleDeleteTest(test.id, e)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {test.status === 'completed' && (
                            <span className="text-xs font-semibold text-[#514163] dark:text-[#fdda36] opacity-0 group-hover:opacity-100 transition-opacity">
                              Ver →
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
        isDanger
      />

      <ConfirmDialog
        isOpen={confirmDeleteAthlete}
        title="Eliminar Atleta"
        message={`¿Estás seguro de que querés eliminar a ${athlete.name}? Esta acción no se puede deshacer y todos los datos del atleta serán eliminados permanentemente.`}
        confirmLabel="Eliminar atleta"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteAthlete}
        onCancel={() => setConfirmDeleteAthlete(false)}
        isDanger
      />
    </div>
  );
}
