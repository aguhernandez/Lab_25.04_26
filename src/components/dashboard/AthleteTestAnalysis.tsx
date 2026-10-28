import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import type { AdvancedMetrics, Test, TestDataPoint } from '../../types';
import type { PhysiologyResults, TimelineHRSample } from '../../lib/physiology';
import { normalizeLongitudinalLactate } from '../../lib/lactateAnalysis';
import AdvancedData from '../AdvancedData';
import MetabolicProfile from '../MetabolicProfile';
import {
  CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ScatterChart, Scatter,
} from 'recharts';

interface SavedTestAnalysis {
  test: Pick<Test, 'id' | 'test_date' | 'sport' | 'test_type' | 'anthropometry_snapshot'>;
  points: TestDataPoint[];
  timeline: TimelineHRSample[];
  results: PhysiologyResults;
  advanced: AdvancedMetrics | null;
}

interface SavedSnapshot {
  results?: PhysiologyResults;
  advancedMetrics?: AdvancedMetrics | null;
}

export default function AthleteTestAnalysis({ athleteId }: { athleteId: string }) {
  const { language } = useLanguage();
  const [tests, setTests] = useState<SavedTestAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const es = language === 'es';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: testRows, error: testError } = await supabase
          .from('tests')
          .select('id, test_date, sport, test_type, anthropometry_snapshot')
          .eq('athlete_id', athleteId)
          .eq('status', 'completed')
          .order('test_date', { ascending: false });
        if (testError) throw testError;
        const ids = (testRows ?? []).map(row => row.id as string);
        if (ids.length === 0) { if (!cancelled) setTests([]); return; }

        const [resultsRes, pointsRes, timelineRes] = await Promise.all([
          supabase.from('test_results').select('test_id, results_snapshot').in('test_id', ids),
          supabase.from('test_data_points').select('*').in('test_id', ids).order('stage_number', { ascending: true }),
          supabase.from('test_timeline_samples').select('test_id, timestamp_s, heart_rate, speed_pace, lactate, rpe, vo2_ml_kg_min').in('test_id', ids).order('timestamp_s', { ascending: true }),
        ]);
        if (resultsRes.error) throw resultsRes.error;
        if (pointsRes.error) throw pointsRes.error;
        if (timelineRes.error) throw timelineRes.error;

        const saved = (testRows ?? []).flatMap(row => {
          const record = resultsRes.data?.find(result => result.test_id === row.id);
          const snapshot = record?.results_snapshot as SavedSnapshot | null;
          if (!snapshot?.results) return [];
          return [{
            test: row as SavedTestAnalysis['test'],
            points: ((pointsRes.data ?? []).filter(point => point.test_id === row.id) as TestDataPoint[]),
            timeline: ((timelineRes.data ?? []).filter(sample => sample.test_id === row.id) as TimelineHRSample[]),
            results: snapshot.results,
            advanced: snapshot.advancedMetrics ?? null,
          }];
        });
        if (!cancelled) setTests(saved);
      } catch (error) {
        console.error('Failed to load athlete test analysis:', error);
        if (!cancelled) setTests([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [athleteId]);

  const lactateHistory = useMemo(() => tests
    .filter(test => test.points.some(point => point.lactate != null))
    .slice(0, 8)
    .reverse(), [tests]);

  const lactateByTest = useMemo(() => {
    const normalized = normalizeLongitudinalLactate(lactateHistory.map(test => ({
      id: test.test.id,
      date: test.test.test_date,
      points: test.points,
      weightKg: test.test.anthropometry_snapshot?.weight_kg,
    })));
    const latestBasis = normalized[normalized.length - 1]?.basis;
    return normalized.filter(series => series.basis === latestBasis).map(series => ({
      ...series,
      label: `${new Date(series.date).toLocaleDateString(es ? 'es-AR' : 'en-US', { month: 'short', year: '2-digit' })} · ${series.basis}`,
    }));
  }, [lactateHistory, es]);

  if (loading) return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-sm text-gray-500">{es ? 'Cargando resultados guardados…' : 'Loading saved test results…'}</div>;
  if (tests.length === 0) return null;

  const colors = ['#ef4444', '#2563eb', '#16a34a', '#9333ea', '#f97316', '#0891b2', '#db2777', '#4b5563'];
  const dateLabel = (date: string) => new Date(date).toLocaleDateString(es ? 'es-AR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <section className="space-y-5" aria-label={es ? 'Resultados completos de tests' : 'Full test results'}>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{es ? 'Resultados completos de tus tests' : 'Your complete test results'}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{es ? 'Gráficos y métricas guardados en cada evaluación.' : 'Charts and metrics saved with each evaluation.'}</p>
      </div>

      {lactateHistory.length > 1 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{es ? 'Curvas de lactato — evolución por test' : 'Lactate curves — test history'}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{es ? 'Cada línea corresponde a las mediciones guardadas de una evaluación.' : 'Each line shows the saved measurements from one evaluation.'}</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" dataKey="load" domain={['dataMin', 'dataMax']} label={{ value: lactateByTest[0]?.basis === 'W/kg' ? 'W/kg' : (es ? 'Velocidad (km/h)' : 'Speed (km/h)'), position: 'insideBottom', offset: -2 }} />
                <YAxis dataKey="lactate" unit=" mmol/L" />
                <Tooltip />
                <Legend />
                {lactateByTest.map((series, index) => <Scatter key={series.id} name={series.label} data={series.points} fill={colors[index % colors.length]} line={{ stroke: colors[index % colors.length], strokeWidth: 2 }} />)}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tests.map(({ test, points, timeline, results, advanced }) => (
        <article key={test.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{dateLabel(test.test_date)} <span className="font-normal text-gray-500">· {test.sport}</span></h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">{test.test_type.replace('_', ' ')}</span>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: 'VO₂max', value: results.vo2max, unit: 'ml/kg/min' },
              { label: 'LT1', value: results.lt1_power ?? results.lt1_pace ?? results.lt1_hr, unit: results.lt1_power != null ? 'W' : results.lt1_pace ? '' : (es ? 'lpm' : 'bpm') },
              { label: 'LT2', value: results.lt2_power ?? results.lt2_pace ?? results.lt2_hr, unit: results.lt2_power != null ? 'W' : results.lt2_pace ? '' : (es ? 'lpm' : 'bpm') },
              { label: 'PAM', value: results.pam_watts, unit: 'W' },
              { label: 'VAM', value: results.vam_kmh, unit: 'km/h' },
              { label: 'FatMax', value: results.fatmax_power ?? results.fatmax_pace ?? results.fatmax_hr, unit: results.fatmax_power != null ? 'W' : results.fatmax_pace ? '' : (es ? 'lpm' : 'bpm') },
            ].filter(metric => metric.value != null).map(metric => (
              <div key={metric.label} className="rounded-xl bg-white dark:bg-gray-800 px-3 py-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
                <p className="font-bold tabular-nums text-gray-900 dark:text-white">{typeof metric.value === 'number' ? Number(metric.value).toFixed(1) : metric.value} <span className="text-xs font-normal">{metric.unit}</span></p>
              </div>
            ))}
          </div>
          {points.length > 0 && <AdvancedData testId={test.id} bodyMassKg={test.anthropometry_snapshot?.weight_kg} leanBodyMassKg={test.anthropometry_snapshot?.leanBodyMassKg} sport={test.sport} dataPoints={points} results={results} advancedMetrics={advanced} timelineSamples={timeline} />}
          <MetabolicProfile results={results} />
          {[
            { key: 'LT1', value: results.thresholds?.LT1?.percent_vo2max },
            { key: 'LT2', value: results.thresholds?.LT2?.percent_vo2max },
            { key: 'VT1', value: results.thresholds?.VT1?.percent_vo2max },
            { key: 'VT2', value: results.thresholds?.VT2?.percent_vo2max },
          ].some(threshold => threshold.value != null) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { key: 'LT1', value: results.thresholds?.LT1?.percent_vo2max },
                { key: 'LT2', value: results.thresholds?.LT2?.percent_vo2max },
                { key: 'VT1', value: results.thresholds?.VT1?.percent_vo2max },
                { key: 'VT2', value: results.thresholds?.VT2?.percent_vo2max },
              ].filter(threshold => threshold.value != null).map(threshold => (
                <div key={threshold.key} className="rounded-xl bg-white dark:bg-gray-800 px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{threshold.key} · {es ? '% de VO₂máx' : '% of VO₂max'}</p>
                  <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{threshold.value}%</p>
                </div>
              ))}
            </div>
          )}
          {(results.zones_data?.zones7 ?? []).length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <h4 className="px-4 pt-4 font-semibold text-gray-900 dark:text-white">{es ? 'Tus 7 zonas de entrenamiento' : 'Your 7 training zones'}</h4>
              <table className="mt-2 min-w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500"><th className="px-4 py-2">{es ? 'Zona' : 'Zone'}</th><th className="px-4 py-2">{es ? 'Frecuencia cardíaca' : 'Heart rate'}</th><th className="px-4 py-2">{es ? 'Potencia' : 'Power'}</th><th className="px-4 py-2">{es ? 'Ritmo' : 'Pace'}</th></tr></thead>
                <tbody>{results.zones_data.zones7.map(zone => (
                  <tr key={zone.zone} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">Z{zone.zone} · {zone.name}</td>
                    <td className="px-4 py-2 tabular-nums">{zone.hr_min != null && zone.hr_max != null ? `${zone.hr_min}–${zone.hr_max} ${es ? 'lpm' : 'bpm'}` : null}</td>
                    <td className="px-4 py-2 tabular-nums">{zone.power_min != null && zone.power_max != null ? `${zone.power_min}–${zone.power_max} W` : null}</td>
                    <td className="px-4 py-2 tabular-nums">{zone.pace_min && zone.pace_max ? `${zone.pace_min}–${zone.pace_max}` : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
