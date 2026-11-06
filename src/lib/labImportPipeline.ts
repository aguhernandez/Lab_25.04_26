import type { Sport, TestDataPoint } from '../types';
import type { TimelineSample } from '../types/timeline.types';
import type { BreathSample } from '../types/breathData.types';

const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function timelineToBreath(samples: TimelineSample[], massKg?: number | null): BreathSample[] {
  return samples.flatMap(s => {
    const m = s.measurements ?? {};
    const rel = s.vo2_ml_kg_min ?? m.vo2_rel_mlkgmin ?? (positive(m.vo2_abs_mlmin) && positive(massKg) ? m.vo2_abs_mlmin / massKg : null);
    if (!positive(rel) && !positive(m.vo2_abs_mlmin) && !positive(m.ve_lmin)) return [];
    const abs = m.vo2_abs_mlmin ?? (positive(rel) && positive(massKg) ? rel * massKg : null);
    const co2 = m.vco2_mlmin ?? (positive(m.rer) && positive(abs) ? m.rer * abs : null);
    return [{ time_s: s.timestamp_s, speed_kmh: s.speed_kmh ?? m.speed_kmh ?? null, hr_bpm: s.heart_rate,
      vo2_rel_mlkgmin: rel, vo2_abs_mlmin: abs, vco2_mlmin: co2, rer: m.rer ?? (positive(co2) && positive(abs) ? co2 / abs : null),
      rf_bpm: m.rf_bpm ?? null, tv_l: m.tv_l ?? null, ve_lmin: m.ve_lmin ?? null, eqo2: m.eqo2 ?? null,
      feo2_pct: m.feo2_pct ?? null, hrv_ms: m.hrv_ms ?? null, rr_ms: m.rr_ms ?? null, provenance: s.provenance }];
  });
}
export function breathToTimeline(samples: BreathSample[], massKg?: number | null): TimelineSample[] {
  return samples.map(s => {
    const measurements = Object.fromEntries(Object.entries(s).filter(([k, v]) => k !== 'provenance' && positive(v)));
    return { id: crypto.randomUUID(), timestamp_s: s.time_s, speed_pace: s.speed_kmh != null ? `${s.speed_kmh} km/h` : null,
      speed_kmh: s.speed_kmh, heart_rate: s.hr_bpm, lactate: null, rpe: null,
      vo2_ml_kg_min: s.vo2_rel_mlkgmin ?? (positive(s.vo2_abs_mlmin) && positive(massKg) ? s.vo2_abs_mlmin / massKg : null),
      measurements, raw_data: { __canonicalMeasurements: measurements }, source: 'imported', edited_fields: [], provenance: s.provenance };
  });
}
/** The same canonical samples feed stage calculations, gases and completion. */
export function timelineToStages(samples: TimelineSample[], sport: Sport, massKg?: number | null, stageSeconds = 180, durations?: number[]): TestDataPoint[] {
  const sorted = samples.filter(s => Number.isFinite(s.timestamp_s) && s.timestamp_s >= 0).sort((a,b) => a.timestamp_s-b.timestamp_s);
  const groups: TimelineSample[][] = [];
  const highFrequency = sorted.length > 120 || sorted.some(s => (s.provenance?.sampleFrequencyHz ?? 0) >= 0.2);
  const boundaries = durations?.length ? durations.reduce<number[]>((xs,d) => [...xs, (xs[xs.length-1] ?? 0) + d], []) : null;
  let previousKey = '';
  for (const s of sorted) {
    const speed = s.speed_kmh ?? s.measurements?.speed_kmh;
    const power = s.power_watts ?? s.measurements?.power_watts;
    const load = sport === 'cycling' && positive(power) ? `w:${Math.round(power/5)}` : speed != null ? `v:${Math.round(speed*2)}` : s.speed_pace;
    const window = boundaries ? boundaries.findIndex(t => s.timestamp_s < t) : Math.floor(s.timestamp_s / stageSeconds);
    const key = load || (highFrequency ? `time:${window}` : `row:${s.id}`);
    if (!groups.length || key !== previousKey) groups.push([]);
    groups[groups.length-1].push(s); previousKey = key;
  }
  return groups.flatMap((g, i) => {
    const first = g[0], next = groups[i+1]?.[0];
    const end = next?.timestamp_s ?? (g[g.length-1].timestamp_s + (highFrequency ? 1 : stageSeconds));
    const tail = highFrequency ? g.filter(s => s.timestamp_s >= end - 30) : g;
    const window = tail.length ? tail : g;
    const hr = mean(window.map(s => s.heart_rate).filter(positive));
    const breaths = timelineToBreath(window, massKg);
    const vo2 = mean(breaths.map(s => s.vo2_rel_mlkgmin).filter(positive));
    const co2 = positive(massKg) ? mean(breaths.map(s => positive(s.vco2_mlmin) ? s.vco2_mlmin / massKg : null).filter(positive)) : null;
    const lactates = g.map(s => s.lactate).filter(positive);
    const lactate = lactates[lactates.length-1] ?? null;
    // The legacy stage table requires HR. Missing-HR respiratory data are retained
    // in the canonical timeline and breath archive instead of inventing a pulse.
    if (!positive(hr)) return [];
    const speed = mean(window.map(s => s.speed_kmh ?? s.measurements?.speed_kmh).filter(positive));
    return [{ id: crypto.randomUUID(), test_id: '', stage_number: i+1, duration_seconds: highFrequency ? Math.max(1, end-first.timestamp_s) : (durations?.[i] ?? stageSeconds),
      heart_rate: Math.round(hr), power_watts: mean(window.map(s => s.power_watts ?? s.measurements?.power_watts).filter(positive)),
      speed_pace: speed != null ? `${speed.toFixed(3)} km/h` : first.speed_pace, vo2_ml_kg_min: vo2, vco2_ml_kg_min: co2, lactate,
      rpe: mean(g.map(s => s.rpe).filter(positive)), vt1_marker: false, vt2_marker: false, created_at: new Date().toISOString() }];
  });
}

/** Restore gas channels from the canonical archive when reopening legacy stage rows. */
export function hydrateStageGases(points: TestDataPoint[], timeline: TimelineSample[], massKg?: number | null): TestDataPoint[] {
  let start=0;
  return points.map(p=>{
    const end=start+p.duration_seconds;
    const window=timeline.filter(s=>s.timestamp_s>=Math.max(start,end-30) && s.timestamp_s<end);
    const gases=timelineToBreath(window,massKg);
    const rel=mean(gases.map(s=>s.vo2_rel_mlkgmin).filter(positive));
    const co2=positive(massKg)?mean(gases.map(s=>positive(s.vco2_mlmin)?s.vco2_mlmin/massKg:null).filter(positive)):null;
    start=end;
    return {...p,vo2_ml_kg_min:p.vo2_ml_kg_min ?? rel,vco2_ml_kg_min:p.vco2_ml_kg_min ?? co2};
  });
}
export function measuredBreathPeak(samples: BreathSample[]): number | null {
  const sorted=samples.filter(s=>positive(s.vo2_rel_mlkgmin)).sort((a,b)=>a.time_s-b.time_s);
  let peak: number | null=null;
  for(let i=0;i<sorted.length;i++){
    const window=sorted.slice(Math.max(0,i-300),i+1).filter(s=>s.time_s>=sorted[i].time_s-30);
    if(sorted[i].time_s-(window[0]?.time_s ?? sorted[i].time_s)<20)continue;
    const value=mean(window.map(s=>s.vo2_rel_mlkgmin).filter(positive));
    if(value!=null)peak=Math.max(peak ?? 0,value);
  }
  return peak;
}
