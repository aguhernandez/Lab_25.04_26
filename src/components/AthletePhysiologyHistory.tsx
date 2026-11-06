import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { Athlete, Sport, Test, TestDataPoint } from '../types';
import { supabase } from '../lib/supabase';
import { calculatePhysiology, type PhysiologyResults } from '../lib/physiology';
import { useLanguage } from '../contexts/LanguageContext';
import { incrementalWorkStages, isIncremental, loadForStage, sanitizeTestResults } from '../lib/testInterpretation';
import { paceToKmh } from '../lib/trainingZones';
import ResultsView from './ResultsView';

type Domain = 'all' | 'vo2' | 'lactate';
type Entry = { test: Test; points: TestDataPoint[]; results: PhysiologyResults; saved: boolean };
const colors = ['#514163','#2563eb','#d97706','#dc2626','#059669','#9333ea'];
const valid = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v > 0;

export default function AthletePhysiologyHistory({ athlete, domain = 'all', onViewResults }: { athlete: Athlete; domain?: Domain; onViewResults: (id: string) => void }) {
  const { language } = useLanguage(); const es = language === 'es';
  const [entries, setEntries] = useState<Entry[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState('');
  const [sport,setSport]=useState<Sport | ''>(''), [selectedId,setSelectedId]=useState('');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let cancelled=false; setLoading(true); setError(''); setEntries([]); setSelectedId(''); setSport('');
    void (async()=>{
      const {data: tests,error: testError}=await supabase.from('tests').select('*').eq('athlete_id',athlete.id).eq('status','completed').order('test_date',{ascending:false});
      if(testError)throw testError;
      const ids=(tests ?? []).map(t=>t.id); if(!ids.length)return;
      const points: TestDataPoint[]=[], records: Array<{test_id:string;results_snapshot:any}>=[];
      // Stable pagination avoids silently losing older tests after PostgREST's row limit.
      for(let start=0;start<ids.length;start+=50){
        const chunk=ids.slice(start,start+50);
        const {data: resultRows,error: resultError}=await supabase.from('test_results').select('test_id,results_snapshot').in('test_id',chunk);
        if(resultError)throw resultError; records.push(...(resultRows ?? []));
        for(let page=0;;page++){
          const {data,error}=await supabase.from('test_data_points').select('*').in('test_id',chunk).order('test_id').order('stage_number').range(page*1000,page*1000+999);
          if(error)throw error; points.push(...((data ?? []) as TestDataPoint[])); if(!data || data.length<1000)break;
        }
      }
      const loaded=(tests as Test[]).flatMap(test=>{
        const stages=points.filter(p=>p.test_id===test.id);
        const snapshot=records.find(r=>r.test_id===test.id)?.results_snapshot;
        const person={...athlete,sport:test.sport,weight_kg:test.anthropometry_snapshot?.weight_kg ?? athlete.weight_kg};
        if(!stages.length && !snapshot?.results)return [];
        const calculated=snapshot?.results ?? calculatePhysiology(person,stages,test.anthropometry_snapshot?.threshold_overrides,undefined,{testType:test.test_type,protocolId:test.protocol_id});
        return [{test,points:stages,results:sanitizeTestResults(calculated,test,stages),saved:!!snapshot?.results}];
      });
      if(!cancelled)setEntries(loaded);
    })().catch(()=>{if(!cancelled)setError(es?'No se pudieron cargar los resultados. Reintenta; no se interpreta un error de acceso como falta de datos.':'Could not load results. Retry; an access error is not treated as missing data.');}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[athlete.id,domain,reload]);
  const relevant=entries.filter(e=>domain==='all' || (domain==='lactate' ? e.points.some(p=>valid(p.lactate)) : e.points.some(p=>valid(p.vo2_ml_kg_min)) || e.results.has_vo2));
  const sports=[...new Set(relevant.map(e=>e.test.sport))];
  const currentSport=sport || sports[0];
  const filtered=relevant.filter(e=>e.test.sport===currentSport);
  const selected=filtered.find(e=>e.test.id===selectedId) ?? filtered[0];
  const unit=currentSport==='cycling' || currentSport?.startsWith('cycling_') ? 'W':'km/h';
  const evolution=useMemo(()=>[...filtered].reverse().map(e=>({id:e.test.id,date:e.test.test_date,
    vo2:e.results.has_vo2 && valid(e.results.vo2max)?e.results.vo2max:null,
    lt1:unit==='W'?e.results.lt1_power:e.results.lt1_pace?paceToKmh(e.results.lt1_pace,e.test.sport):null,
    lt2:unit==='W'?e.results.lt2_power:e.results.lt2_pace?paceToKmh(e.results.lt2_pace,e.test.sport):null,
    lt1hr:e.results.lt1_hr,lt2hr:e.results.lt2_hr})),[entries,domain,currentSport]);
  const curves=filtered.filter(e=>e.points.some(p=>valid(p.lactate))).slice(0,6).reverse().map(e=>{
    const stages=isIncremental({testType:e.test.test_type,protocolId:e.test.protocol_id})?incrementalWorkStages(e.points,e.test.sport):e.points;
    const groups=new Map<number,number[]>();
    stages.forEach(p=>{const load=loadForStage(p,e.test.sport);if(load!=null && valid(p.lactate))groups.set(load,[...(groups.get(load)??[]),p.lactate!]);});
    return {id:e.test.id,date:e.test.test_date,points:[...groups].sort((a,b)=>a[0]-b[0]).map(([load,xs])=>({load,lactate:xs.reduce((a,b)=>a+b,0)/xs.length}))};
  }).filter(e=>e.points.length);
  const dateLabel=(s:string)=>new Date(`${s}T12:00:00`).toLocaleDateString(es?'es-AR':'en-GB');
  const tooltip={backgroundColor:'#fff',color:'#111827',border:'1px solid #d1d5db'};
  const chart=(keys:Array<[string,string,string]>,label:string)=> <div className="h-64 min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={evolution} margin={{top:8,right:15,bottom:20,left:10}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={dateLabel}/><YAxis domain={['auto','auto']} label={{value:label,angle:-90,position:'insideLeft'}}/><Tooltip labelFormatter={v=>dateLabel(String(v))} contentStyle={tooltip}/><Legend/>{keys.map(([key,name,color])=><Line key={key} type="linear" dataKey={key} name={name} stroke={color} dot={{r:4}} connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div>;
  if(loading)return <p role="status" className="py-6 text-sm text-gray-500">{es?'Cargando historia fisiológica…':'Loading physiological history…'}</p>;
  if(error)return <div role="alert" className="p-4 text-sm text-red-700">{error} <button className="underline" onClick={()=>setReload(x=>x+1)}>{es?'Reintentar':'Retry'}</button></div>;
  if(!relevant.length)return <p className="border-y py-8 text-sm text-gray-500">{es?'Todavía no hay evaluaciones completadas con mediciones para esta sección.':'No completed assessments with measurements are available for this section yet.'}</p>;
  return <section className="space-y-6" aria-label={es?'Evolución y resultados del atleta':'Athlete evolution and results'}>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-gray-900 dark:text-white">{es?'Evolución y resultados':'Evolution and results'}</h2><p className="mt-1 text-xs text-gray-500">{filtered.length} {es?'evaluaciones completadas · se comparan solo tests del mismo deporte':'completed assessments · comparisons use the same sport'}</p></div><label className="text-xs dark:text-gray-200">{es?'Deporte':'Sport'}<select className="input mt-1" value={currentSport} onChange={e=>{setSport(e.target.value as Sport);setSelectedId('');}}>{sports.map(s=><option key={s}>{s}</option>)}</select></label></div>
    <p className="text-xs text-gray-500">{es?'Cada punto corresponde a una evaluación. Las diferencias de protocolo, método o condiciones requieren revisión antes de interpretar una tendencia como mejora. Con un único test se muestra su punto de partida.':'Each point represents an assessment. Review protocol, method and conditions before interpreting a trend as improvement. A single test shows the starting point.'}</p>
    <div className="grid gap-6 lg:grid-cols-2">
      {domain!=='lactate' && evolution.some(e=>valid(e.vo2)) && <div className="min-w-0 border-t pt-4"><h3 className="mb-3 font-semibold dark:text-white">VO₂ {es?'medido':'measured'} · ml/kg/min</h3>{chart([['vo2','VO₂','#514163']],'ml/kg/min')}</div>}
      {evolution.some(e=>valid(e.lt1)||valid(e.lt2)) && <div className="min-w-0 border-t pt-4"><h3 className="mb-3 font-semibold dark:text-white">LT1 / LT2 · {unit}</h3>{chart([['lt1','LT1','#d97706'],['lt2','LT2','#514163']],unit)}</div>}
      {evolution.some(e=>valid(e.lt1hr)||valid(e.lt2hr)) && <div className="min-w-0 border-t pt-4"><h3 className="mb-3 font-semibold dark:text-white">LT1 / LT2 · {es?'frecuencia cardíaca':'heart rate'}</h3>{chart([['lt1hr','LT1 · bpm','#d97706'],['lt2hr','LT2 · bpm','#514163']],'bpm')}</div>}
    </div>
    {domain!=='vo2' && curves.length>0 && <div className="border-t pt-4"><h3 className="font-semibold dark:text-white">{es?'Curvas de lactato entre evaluaciones':'Lactate response across assessments'}</h3><p className="mt-1 text-xs text-gray-500">{es?'Últimos seis tests del deporte seleccionado. Carga absoluta; puntos repetidos a igual carga se promedian. Recuperación excluida en protocolos incrementales.':'Last six tests in the selected sport. Absolute workload; repeated measurements at the same load are averaged. Recovery is excluded for incremental protocols.'}</p><div className="mt-4 h-72"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{bottom:20,left:12,right:18}}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" dataKey="load" name={unit} unit={` ${unit}`} domain={['dataMin','dataMax']}/><YAxis type="number" dataKey="lactate" name="Lactate" unit=" mmol/L"/><Tooltip contentStyle={tooltip}/><Legend/>{curves.map((c,i)=><Scatter key={c.id} data={c.points} name={dateLabel(c.date)} fill={colors[i]} line={{stroke:colors[i],strokeWidth:2}} isAnimationActive={false}/>)}</ScatterChart></ResponsiveContainer></div></div>}
    <div className="flex flex-wrap items-end gap-3 border-t pt-4"><label className="text-xs dark:text-gray-200">{es?'Evaluación':'Assessment'}<select className="input mt-1" value={selected?.test.id ?? ''} onChange={e=>setSelectedId(e.target.value)}>{filtered.map(e=><option key={e.test.id} value={e.test.id}>{dateLabel(e.test.test_date)} · {e.test.test_type} · {e.saved?(es?'guardado':'saved'):(es?'calculado desde muestras':'calculated from samples')}</option>)}</select></label>{selected && <button className="btn btn-secondary" onClick={()=>onViewResults(selected.test.id)}>{es?'Abrir test completo':'Open full test'}</button>}</div>
    {domain!=='all' && selected && <ResultsView key={`${selected.test.id}-${domain}`} testId={selected.test.id} initialSection="curves"/>}
  </section>;
}
