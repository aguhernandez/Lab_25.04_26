import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { create, act } from 'react-test-renderer';
import * as XLSX from 'xlsx';
import LabPhaseStages from '../components/lab/LabPhaseStages';
import AthletePhysiologyHistory from '../components/AthletePhysiologyHistory';
import ResultsView from '../components/ResultsView';
import { initialLabSession } from './labSession';
import { calculatePhysiology } from './physiology';

const db=vi.hoisted(()=>({writes:[] as Array<{table:string;op:string;rows:any}>,tests:[] as any[],points:[] as any[],results:[] as any[],failStages:false}));
vi.mock('../contexts/LanguageContext',()=>({useLanguage:()=>({language:'es',t:(key:string)=>key}),getCurrentLanguage:()=> 'es'}));
vi.mock('../components/ResultsView',()=>({default:()=>null}));
vi.mock('recharts',()=>Object.fromEntries(['CartesianGrid','Legend','Line','LineChart','ResponsiveContainer','Scatter','ScatterChart','Tooltip','XAxis','YAxis'].map(name=>[name,`chart-${name}`])));
vi.mock('../lib/supabase',()=>({supabase:{from:(table:string)=>{
  const filters:Record<string,any>={};let op='select',rows:any,range:number[]|null=null,single=false;
  const q:any={};
  for(const method of ['select','order','not','limit'])q[method]=()=>q;
  for(const method of ['insert','update','upsert','delete'])q[method]=(value:any)=>{op=method;rows=value;return q;};
  q.eq=(key:string,value:any)=>{filters[key]=value;return q;};q.in=q.eq;
  q.range=(a:number,b:number)=>{range=[a,b];return q;};q.maybeSingle=q.single=()=>{single=true;return q;};
  q.then=(resolve:any)=>{
    if(op!=='select')db.writes.push({table,op,rows});
    const source=table==='tests'?db.tests:table==='test_data_points'?db.points:table==='test_results'?db.results:[];
    let data=source.filter(row=>Object.entries(filters).every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v));
    if(range)data=data.slice(range[0],range[1]+1);
    resolve({data:single?data[0]??null:data,error:db.failStages && table==='test_data_points' && op==='insert'?new Error('Stage write failed'):null});
  };return q;
}}}));
(globalThis as any).ResizeObserver=class {observe(){} unobserve(){} disconnect(){}};
const athlete={id:'synthetic',name:'Synthetic athlete',sport:'running',weight_kg:60,date_of_birth:'1990-01-01'} as any;
const makeFile=()=>{
  const wb=XLSX.utils.book_new();const data:any[][]=[['Metadata from another brand'],['Time[s]','HR[bpm]','Speed[km/h]','VO2[mL/kg/min]','VCO2[mL/min]']];
  for(let i=0;i<360;i++)data.push([i,120,i<180?10:12,35,1800]);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Data');
  return {name:'another-brand.xlsm',arrayBuffer:async()=>XLSX.write(wb,{type:'array',bookType:'xlsm'})} as File;
};
const text=(node:any):string=>typeof node==='string'?node:node?.children?.map(text).join(' ')??'';
const button=(view:any,name:string)=>view.root.findAllByType('button').find((n:any)=>text(n).includes(name));
beforeEach(()=>{db.writes=[];db.tests=[];db.points=[];db.results=[];db.failStages=false;});
async function importAndFinish(fail=false){
  const updated=vi.fn(),next=vi.fn();db.failStages=fail;
  const test={id:'test-synthetic',athlete_id:athlete.id,test_type:'ramp',sport:'running',status:'in_progress',test_date:'2026-11-01'};
  let view:any;
  await act(async()=>{view=create(React.createElement(LabPhaseStages,{session:{...initialLabSession(),athlete,test,testId:test.id,sport:'running',testType:'ramp',protocolId:'vo2_incremental',protocolSettings:{protocolId:'vo2_incremental',version:'1.0'}},onUpdate:updated,onNext:next,onBack:()=>{}}));});
  expect(view.root.findAllByType('input').filter((n:any)=>n.props.type==='file')).toHaveLength(1);
  await act(async()=>{await view.root.findAllByType('input').find((n:any)=>n.props.type==='file').props.onChange({target:{files:[makeFile()]}});});
  expect(text(view.toJSON())).toContain('Match columns');
  await act(async()=>{await button(view,'Confirm & Import').props.onClick();});
  await act(async()=>{await button(view,'Save & Calculate').props.onClick();});
  return {view,updated,next};
}
it('uses one importer and feeds imported gases and stages into completion in the actual components',async()=>{
  const {view,updated,next}=await importAndFinish();
  expect(next).toHaveBeenCalledOnce();
  const stages=db.writes.find(x=>x.table==='test_data_points' && x.op==='insert')!;
  expect(stages.rows).toHaveLength(2);expect(stages.rows[0].vo2_ml_kg_min).toBe(35);
  const statusIndex=db.writes.findIndex(x=>x.table==='tests' && x.rows?.status==='completed');
  expect(statusIndex).toBeGreaterThan(db.writes.indexOf(stages));
  expect(updated.mock.calls.at(-1)![0].breathData).toHaveLength(360);
  expect(updated.mock.calls.at(-1)![0].dataPoints[0].vco2_ml_kg_min).toBe(30);
  view.unmount();
});
it('does not mark a test complete or advance if stage persistence fails',async()=>{
  const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
  const {view,next}=await importAndFinish(true);
  expect(next).not.toHaveBeenCalled();expect(db.writes.some(x=>x.table==='tests' && x.rows?.status==='completed')).toBe(false);
  view.unmount();spy.mockRestore();
});
it('selects the newest test with VO2 data rather than blindly using the newest completed test',async()=>{
  db.tests=[{id:'new',athlete_id:athlete.id,test_date:'2026-11-01',status:'completed',sport:'running',test_type:'step'}, {id:'old',athlete_id:athlete.id,test_date:'2026-06-01',status:'completed',sport:'running',test_type:'ramp'}];
  db.points=db.tests.flatMap(t=>[1,2,3,4].map((n)=>({id:`${t.id}-${n}`,test_id:t.id,stage_number:n,duration_seconds:180,heart_rate:110+n*10,speed_pace:`${8+n} km/h`,lactate:n,vo2_ml_kg_min:t.id==='old'?20+n*5:null,power_watts:null})));
  db.results=db.tests.map(test=>({test_id:test.id,results_snapshot:{results:calculatePhysiology(athlete,db.points.filter(p=>p.test_id===test.id))}}));
  let view:any;await act(async()=>{view=create(React.createElement(AthletePhysiologyHistory,{athlete,domain:'vo2',onViewResults:()=>{}}));});
  expect(view.root.findByType(ResultsView).props.testId).toBe('old');
  expect(text(view.toJSON())).toContain('Evolución y resultados');
  view.unmount();
});
