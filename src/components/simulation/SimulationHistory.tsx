import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatTime } from '../../lib/simulationEngine';

interface SimRecord {
  id: string;
  athlete_id: string | null;
  simulation_type: 'race' | 'altitude';
  label: string;
  input_params: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  created_at: string;
  athletes?: { name: string } | null;
}

const FEASIBILITY_COLORS: Record<string, string> = {
  optimal: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  challenging: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  limit: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  impossible: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

export default function SimulationHistory() {
  const [records, setRecords] = useState<SimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'race' | 'altitude'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('simulation_history')
      .select('*, athletes(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    setRecords((data as SimRecord[]) ?? []);
    setLoading(false);
  }

  async function deleteRecord(id: string) {
    setDeletingId(id);
    await supabase.from('simulation_history').delete().eq('id', id);
    setRecords(r => r.filter(x => x.id !== id));
    setDeletingId(null);
  }

  const filtered = filter === 'all' ? records : records.filter(r => r.simulation_type === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(['all', 'race', 'altitude'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all border ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
              {f === 'all' ? 'Todas' : f === 'race' ? 'Carreras' : 'Altitud'}
            </button>
          ))}
        </div>
        <button onClick={load} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="text-center py-10 text-gray-400 text-sm">Cargando historial...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <div className="text-gray-400 text-sm">No hay simulaciones guardadas aun.</div>
          <div className="text-xs text-gray-300 dark:text-gray-500 mt-1">Usa el boton "Guardar" despues de simular.</div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(rec => {
          const summary = rec.result_summary;
          const isRace = rec.simulation_type === 'race';
          const feasibility = summary.feasibility as string | undefined;

          return (
            <div key={rec.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex items-start justify-between gap-4 hover:border-blue-200 dark:hover:border-blue-700 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isRace ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                    {isRace ? 'Carrera' : 'Altitud'}
                  </span>
                  {rec.athletes?.name && (
                    <span className="text-xs text-gray-500">{rec.athletes.name}</span>
                  )}
                  {feasibility && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEASIBILITY_COLORS[feasibility] ?? ''}`}>
                      {feasibility}
                    </span>
                  )}
                </div>

                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{rec.label}</div>

                <div className="flex flex-wrap gap-3 mt-2">
                  {isRace ? (
                    <>
                      {summary.predictedTime_min != null && (
                        <span className="text-xs text-gray-500">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{formatTime(summary.predictedTime_min as number)}</span> tiempo
                        </span>
                      )}
                      {summary.percentVO2max != null && (
                        <span className="text-xs text-gray-500">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">{(summary.percentVO2max as number).toFixed(0)}%</span> VO2max
                        </span>
                      )}
                      {summary.bonkRisk && (
                        <span className="text-xs text-red-600 font-semibold">Bonk risk km {summary.glycogenDepletionKm as number}</span>
                      )}
                      {summary.runningEconomy != null && (
                        <span className="text-xs text-gray-500">RE: {summary.runningEconomy as number} ml/kg/km</span>
                      )}
                    </>
                  ) : (
                    <>
                      {summary.postBlockVO2max != null && (
                        <span className="text-xs text-gray-500">
                          VO2max post: <span className="font-semibold text-gray-700 dark:text-gray-300">{summary.postBlockVO2max as number}</span>
                        </span>
                      )}
                      {summary.vo2maxBoost != null && (
                        <span className="text-xs text-emerald-600 font-semibold">+{(summary.vo2maxBoost as number).toFixed(1)} ml/kg/min</span>
                      )}
                      {summary.timeSaving_min != null && (summary.timeSaving_min as number) > 0 && (
                        <span className="text-xs text-emerald-600 font-semibold">-{formatTime(summary.timeSaving_min as number)} en carrera</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400">{new Date(rec.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                <button
                  onClick={() => deleteRecord(rec.id)}
                  disabled={deletingId === rec.id}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-xs disabled:opacity-40"
                >
                  {deletingId === rec.id ? '...' : 'Eliminar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
