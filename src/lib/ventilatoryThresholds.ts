import type { BreathSample } from '../types/breathData.types';
import type { ThresholdData, ThresholdConfidence } from '../types';

interface VTResult {
  VT1: ThresholdData;
  VT2: ThresholdData;
  method: 'v_slope' | 'ventilatory_proxy';
}

export function calculateVentilatoryThresholds(
  samples: BreathSample[],
  hrmax: number,
  vo2max: number | null,
  hasCO2: boolean
): VTResult | null {
  const valid = samples.filter((s) => s.hr_bpm != null && s.time_s != null);
  if (valid.length < 4) return null;

  if (hasCO2) {
    const result = calculateVSlope(valid, hrmax, vo2max);
    if (result) return result;
  }

  return calculateProxyThresholds(valid, hrmax, vo2max);
}

function calculateVSlope(
  samples: BreathSample[],
  hrmax: number,
  vo2max: number | null
): VTResult | null {
  const hasVCO2 = samples.some((s) => s.vco2_mlmin != null);
  const hasVO2abs = samples.some((s) => s.vo2_abs_mlmin != null);
  if (!hasVCO2 || !hasVO2abs) return null;

  const pts = samples
    .filter((s) => s.vo2_abs_mlmin != null && s.vco2_mlmin != null)
    .map((s) => ({ vo2: s.vo2_abs_mlmin!, vco2: s.vco2_mlmin!, hr: s.hr_bpm!, sample: s }))
    .sort((a, b) => a.vo2 - b.vo2);
  if (pts.length < 6) return null;

  const vt1Idx = findVSlopeBreakPoint(pts.map((p) => ({ x: p.vo2, y: p.vco2 })));
  const vt2Idx = findVSlopeBreakPoint(pts.map((p) => ({ x: p.vo2, y: p.vco2 })), true);

  if (vt1Idx == null && vt2Idx == null) return null;

  const buildThreshold = (idx: number | null): ThresholdData => {
    if (idx == null || idx >= pts.length) return emptyThreshold();
    const p = pts[idx];
    return buildTdFromSample(p.sample, p.hr, hrmax, vo2max, 'measured');
  };

  return {
    VT1: buildThreshold(vt1Idx),
    VT2: buildThreshold(vt2Idx),
    method: 'v_slope',
  };
}

function findVSlopeBreakPoint(
  pts: Array<{ x: number; y: number }>,
  forVT2 = false
): number | null {
  if (pts.length < 6) return null;
  const n = pts.length;
  const startIdx = forVT2 ? Math.floor(n * 0.3) : Math.floor(n * 0.1);
  const endIdx = forVT2 ? Math.floor(n * 0.85) : Math.floor(n * 0.6);

  let maxDist = 0;
  let maxIdx: number | null = null;

  for (let i = startIdx; i <= endIdx && i < n - 2; i++) {
    const p0 = pts[0];
    const p1 = pts[n - 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const dist = Math.abs(
      (dy * pts[i].x - dx * pts[i].y + p1.x * p0.y - p1.y * p0.x) / len
    );
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }
  return maxIdx;
}

function calculateProxyThresholds(
  samples: BreathSample[],
  hrmax: number,
  vo2max: number | null
): VTResult | null {
  const vt1Idx = detectVT1Proxy(samples);
  const vt2Idx = detectVT2Proxy(samples);

  if (vt1Idx == null && vt2Idx == null) return null;

  const buildThreshold = (idx: number | null): ThresholdData => {
    if (idx == null || idx >= samples.length) return emptyThreshold();
    const s = samples[idx];
    return buildTdFromSample(s, s.hr_bpm!, hrmax, vo2max, 'measured');
  };

  return {
    VT1: buildThreshold(vt1Idx),
    VT2: buildThreshold(vt2Idx),
    method: 'ventilatory_proxy',
  };
}

function detectVT1Proxy(samples: BreathSample[]): number | null {
  const hasEqo2 = samples.some((s) => s.eqo2 != null);
  const hasFeo2 = samples.some((s) => s.feo2_pct != null);
  const hasTv = samples.some((s) => s.tv_l != null);

  if (hasEqo2 && hasFeo2) {
    const eqo2Series = extractSeries(samples, 'eqo2');
    const feo2Series = extractSeries(samples, 'feo2_pct');
    const eqo2Break = detectPlateauBreak(eqo2Series);
    const feo2Break = detectPlateauBreak(feo2Series);
    if (eqo2Break != null && feo2Break != null) {
      return Math.max(eqo2Break, feo2Break);
    }
    if (eqo2Break != null) return eqo2Break;
    if (feo2Break != null) return feo2Break;
  }

  if (hasTv) {
    const tvSeries = extractSeries(samples, 'tv_l');
    const tvPlateauEnd = detectPlateauEnd(tvSeries);
    if (tvPlateauEnd != null) return tvPlateauEnd;
  }

  return null;
}

function detectVT2Proxy(samples: BreathSample[]): number | null {
  const hasRf = samples.some((s) => s.rf_bpm != null);
  const hasVe = samples.some((s) => s.ve_lmin != null);
  const hasTv = samples.some((s) => s.tv_l != null);

  if (hasRf) {
    const rfSeries = extractSeries(samples, 'rf_bpm');
    const rfBreak = detectPlateauBreak(rfSeries);
    if (rfBreak != null) {
      if (hasVe && hasTv) {
        const tvSeries = extractSeries(samples, 'tv_l');
        const tvPlateauEnd = detectPlateauEnd(tvSeries);
        if (tvPlateauEnd != null && tvPlateauEnd < rfBreak) {
          return rfBreak;
        }
      }
      return rfBreak;
    }
  }

  if (hasVe && hasTv) {
    const veSeries = extractSeries(samples, 've_lmin');
    const tvSeries = extractSeries(samples, 'tv_l');
    const veBreak = detectPlateauBreak(veSeries);
    const tvPlateauEnd = detectPlateauEnd(tvSeries);
    if (veBreak != null && tvPlateauEnd != null && tvPlateauEnd < veBreak) {
      return veBreak;
    }
  }

  return null;
}

type SeriesPoint = { idx: number; value: number };

function extractSeries(
  samples: BreathSample[],
  field: keyof BreathSample
): SeriesPoint[] {
  const result: SeriesPoint[] = [];
  samples.forEach((s, i) => {
    const v = s[field] as number | null;
    if (v != null && !isNaN(v)) result.push({ idx: i, value: v });
  });
  return result;
}

function detectPlateauBreak(series: SeriesPoint[]): number | null {
  if (series.length < 5) return null;
  const baseline = series.slice(0, Math.min(5, Math.floor(series.length * 0.3)));
  const baselineMean = baseline.reduce((a, p) => a + p.value, 0) / baseline.length;
  const baselineStd = Math.sqrt(
    baseline.reduce((a, p) => a + Math.pow(p.value - baselineMean, 2), 0) / baseline.length
  );
  const threshold = baselineMean + Math.max(baselineStd * 1.5, baselineMean * 0.05);

  let consecutiveCount = 0;
  for (let i = 0; i < series.length; i++) {
    if (series[i].value > threshold) {
      consecutiveCount++;
      if (consecutiveCount >= 3) {
        return series[i - 2].idx;
      }
    } else {
      consecutiveCount = 0;
    }
  }
  return null;
}

function detectPlateauEnd(series: SeriesPoint[]): number | null {
  if (series.length < 5) return null;
  const baseline = series.slice(0, Math.min(5, Math.floor(series.length * 0.3)));
  const baselineMean = baseline.reduce((a, p) => a + p.value, 0) / baseline.length;
  const baselineStd = Math.sqrt(
    baseline.reduce((a, p) => a + Math.pow(p.value - baselineMean, 2), 0) / baseline.length
  );
  const growthThreshold = baselineMean + Math.max(baselineStd * 2, baselineMean * 0.03);

  for (let i = Math.floor(series.length * 0.3); i < series.length - 1; i++) {
    const slope = series[i + 1].value - series[i].value;
    if (Math.abs(slope) < baselineStd * 0.5 && series[i].value < growthThreshold) {
      continue;
    }
    if (series[i].value >= growthThreshold) {
      return series[i].idx;
    }
  }
  return null;
}

function buildTdFromSample(
  s: BreathSample,
  hr: number,
  hrmax: number,
  vo2max: number | null,
  confidence: ThresholdConfidence
): ThresholdData {
  const percent_hrmax = hrmax > 0 ? Math.round((hr / hrmax) * 100) : null;
  const vo2 = s.vo2_rel_mlkgmin;
  const percent_vo2max = vo2 != null && vo2max != null && vo2max > 0 ? Math.round((vo2 / vo2max) * 100) : null;
  return {
    hr: Math.round(hr),
    vo2: vo2,
    power: null,
    pace: null,
    percent_vo2max,
    percent_hrmax,
    confidence,
  };
}

function emptyThreshold(): ThresholdData {
  return {
    hr: null,
    vo2: null,
    power: null,
    pace: null,
    percent_vo2max: null,
    percent_hrmax: null,
    confidence: 'estimated',
  };
}
