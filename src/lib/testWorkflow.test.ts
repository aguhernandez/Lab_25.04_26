import { expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { autoDetectMapping, parseTimelineFile, readWorkbookTable } from './deviceImporters';
import { timelineToBreath, timelineToStages, hydrateStageGases, measuredBreathPeak } from './labImportPipeline';
import { calculateHRDrift, calculatePhysiology } from './physiology';
import { incrementalWorkStages, loadForStage, sanitizeTestResults } from './testInterpretation';
import type { TestDataPoint, Athlete } from '../types';

function spreadsheet(){
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Notes'],['Export from a different analyzer']]),'Notes');
  const data=[['Analyzer export'],['Time[s]','HR[bpm]','Speed[km/h]','VO2[mL/kg/min]','VCO2[mL/min]','VE[L/min]']];
  for(let i=0;i<360;i++)data.push([i,120+i/10,i<180?10:12,30+i/60,1800,60] as any);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Measurements');
  return XLSX.write(wb,{type:'array',bookType:'xlsm'}) as ArrayBuffer;
}
const file=(name:string,buffer:ArrayBuffer)=>({name,arrayBuffer:async()=>buffer} as File);
it('imports a multi-sheet XLSM from a non-default manufacturer through a single canonical pipeline',async()=>{
  const buffer=spreadsheet(),layout=readWorkbookTable(buffer);
  expect(layout.sheetName).toBe('Measurements');expect(layout.headerRow).toBe(1);
  const mapping=autoDetectMapping(layout.headers,[]).mapping;
  const samples=await parseTimelineFile(file('other-analyzer.xlsm',buffer),mapping,0,{deviceName:'Other analyzer'});
  expect(samples).toHaveLength(360);expect(samples[0].measurements?.vco2_mlmin).toBe(1800);
  const breath=timelineToBreath(samples,60);
  expect(breath[0].vo2_abs_mlmin).toBe(1800);expect(breath[0].vco2_mlmin).toBe(1800);
  const stages=timelineToStages(samples,'running',60);
  expect(stages).toHaveLength(2);expect(stages[0].heart_rate).toBe(136);
  expect(stages[0].vco2_ml_kg_min).toBe(30);
  expect(hydrateStageGases(stages.map(p=>({...p,vco2_ml_kg_min:null})),samples,60)[0].vco2_ml_kg_min).toBe(30);
});
it('converts source L/min exactly once and supports explicit source time units',async()=>{
  const csv='Time;HR;VO2[L/min];VCO2[ml/min]\n0;120;2;1600\n1;125;2.1;1700';
  const samples=await parseTimelineFile(file('cosmed.csv',new TextEncoder().encode(csv).buffer),{'Time':'time_s','HR':'hr_bpm','VO2[L/min]':'vo2_abs_mlmin','VCO2[ml/min]':'vco2_mlmin'},0,{units:{time_s:'min'}});
  expect(samples[1].timestamp_s).toBe(60);expect(samples[0].measurements?.vo2_abs_mlmin).toBe(2000);expect(samples[0].measurements?.vco2_mlmin).toBe(1600);
  expect(timelineToBreath(samples,50)[0].vo2_rel_mlkgmin).toBe(40);
});
it('does not infer heart rate from HRV and recognizes Unicode gas headers',()=>{
  const {mapping}=autoDetectMapping(['Time[s]','HRV[ms]','VO₂ [mL/kg/min]','VCO₂ [mL/min]'],[]);
  expect(mapping['HRV[ms]']).toBe('hrv_ms');expect(mapping['VO₂ [mL/kg/min]']).toBe('vo2_rel_mlkgmin');expect(mapping['VCO₂ [mL/min]']).toBe('vco2_mlmin');
});
it('preserves VO2-only data without inventing a pulse',async()=>{
  const data=new TextEncoder().encode('Time,VO2[mL/kg/min]\n0,30\n10,35\n20,40\n30,45').buffer;
  const samples=await parseTimelineFile(file('gas-only.csv',data),{Time:'time_s','VO2[mL/kg/min]':'vo2_rel_mlkgmin'});
  const breath=timelineToBreath(samples,60);
  expect(timelineToStages(samples,'running',60)).toEqual([]);
  const r=calculatePhysiology({sport:'running',weight_kg:60} as Athlete,[],undefined,null,{measuredVo2Peak:measuredBreathPeak(breath),testType:'ramp'});
  expect(r.vo2max).toBe(37.5);expect(r.hr_drift_percent).toBeNull();expect(r.training_zones).toEqual([]);
});
const point=(i:number,speed:number,hr=130)=>({stage_number:i,duration_seconds:300,speed_pace:`${speed} km/h`,heart_rate:hr,lactate:i,vo2_ml_kg_min:20+i,power_watts:null} as TestDataPoint);
it('keeps the increasing work segment and excludes the recovery that caused backwards curves',()=>{
  const raw=[point(1,0),point(2,5),point(3,8),point(4,12),point(5,17),point(6,16.1),point(7,5)];
  const work=incrementalWorkStages(raw,'running');expect(work.map(p=>loadForStage(p,'running'))).toEqual([5,8,12,17]);
  expect(raw).toHaveLength(7);
});
it('never computes HR drift for a long incremental test or a varying-load effort',()=>{
  const ramp=Array.from({length:8},(_,i)=>point(i+1,8+i,110+i*8));
  expect(calculateHRDrift(ramp,{testType:'ramp',sport:'running'})).toBeNull();
  expect(calculateHRDrift(ramp,{testType:'steady_state',sport:'running'})).toBeNull();
  expect(calculateHRDrift(ramp)).toBeNull();
});
it('computes a time-weighted drift at constant load and retains a measured zero',()=>{
  const steady=[point(1,10,120),point(2,10,120),point(3,10,132),point(4,10,132)];
  expect(calculateHRDrift(steady,{testType:'steady_state',sport:'running'})).toBe(10);
  expect(calculateHRDrift(steady.map(p=>({...p,heart_rate:120})),{testType:'steady_state',sport:'running'})).toBe(0);
});
it('hides invalid historical zero references and incremental drift without overwriting saved records',()=>{
  const saved={lt1_hr:0,lt1_power:0,lt1_pace:'0',lt2_hr:160,fatmax_pace:'0',hr_drift_percent:34,vo2max:60} as any;
  const clean=sanitizeTestResults(saved,{test_type:'ramp',sport:'running',protocol_id:null},[point(1,10)]);
  expect(clean.lt1_hr).toBeNull();expect(clean.lt1_pace).toBeNull();expect(clean.hr_drift_percent).toBeNull();expect(saved.hr_drift_percent).toBe(34);
});
