import jsPDF from 'jspdf';
import type { Athlete, Test, TestDataPoint, TrainingZone } from '../types';
import type { PhysiologyResults } from './physiology';
import type { AdvancedMetrics } from '../types';
import type { AnthropometryMeasurement, KerrResults } from '../types/anthropometry.types';
import { getCurrentLanguage } from '../contexts/LanguageContext';
import type { PreTestData } from './labSession';

async function loadHtml2Canvas(): Promise<typeof import('html2canvas')['default']> {
  const mod = await import('html2canvas');
  return (mod as any).default || mod;
}

function sanitizeForPDF(text: string): string {
  return text
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00b0/g, ' deg')
    .replace(/\u00b2/g, '2')
    .replace(/\u00b3/g, '3')
    .replace(/\u00b5/g, 'u')
    .replace(/[^\x00-\x7E\xC0-\xFF]/g, (ch) => {
      const code = ch.charCodeAt(0);
      if (code > 0x00FF) return '?';
      return ch;
    });
}

const PDF_STRINGS: Record<string, { en: string; es: string }> = {
  coverSubtitle: { en: 'PERFORMANCE ASSESSMENT REPORT', es: 'INFORME DE EVALUACIÓN DE RENDIMIENTO' },
  coverDisclaimer: { en: 'For clinical decisions, consult a licensed sports medicine professional.', es: 'Para decisiones clínicas, consulte a un profesional habilitado en medicina del deporte.' },
  coverEvaluator: { en: 'Evaluator', es: 'Evaluador' },
  coverLab: { en: 'Asciende Metabolic Lab', es: 'Asciende Metabolic Lab' },
  pageLabel: { en: 'Page', es: 'Página' },

  secExecutiveSummary: { en: 'Executive Summary', es: 'Resumen Ejecutivo' },
  secVO2max: { en: 'VO\u2082max & Aerobic Capacity', es: 'VO\u2082max y Capacidad Aeróbica' },
  secThresholds: { en: 'Lactate Thresholds', es: 'Umbrales de Lactato' },
  secFatOx: { en: 'Fat Oxidation & FatMax', es: 'Oxidación de Grasas y FatMax' },
  secZones: { en: 'Training Zones', es: 'Zonas de Entrenamiento' },
  secEconomy: { en: 'Economy & Power Metrics', es: 'Economía y Métricas de Potencia' },
  secAnthro: { en: 'Body Composition — Conclusions', es: 'Composición Corporal — Conclusiones' },
  secAnthroResults: { en: 'Body Composition — Results', es: 'Composición Corporal — Resultados' },
  secAnthroTargets: { en: 'Body Composition — Targets', es: 'Composición Corporal — Objetivos' },
  secISAK: { en: 'ISAK Measurement Details', es: 'Detalle de Medidas ISAK' },
  secComparison: { en: 'Reference Comparison', es: 'Comparación de Referencia' },
  secHydration: { en: 'Hydration Analysis', es: 'Análisis de Hidratación' },
  secHeat: { en: 'Heat Adaptation', es: 'Adaptación al Calor' },
  secRaw: { en: 'Appendix — Raw Stage Data', es: 'Apéndice — Datos de Etapas' },
  secRec: { en: 'Recommendations', es: 'Recomendaciones' },

  vo2max: { en: 'VO\u2082max', es: 'VO\u2082max' },
  lt1: { en: 'LT1 (Aerobic Threshold)', es: 'LT1 (Umbral Aeróbico)' },
  lt2: { en: 'LT2 (Anaerobic Threshold)', es: 'LT2 (Umbral Anaeróbico)' },
  fatmax: { en: 'FatMax', es: 'FatMax' },
  hrMax: { en: 'HR max', es: 'FC máx' },
  hrRest: { en: 'HR rest', es: 'FC reposo' },
  measured: { en: 'measured', es: 'medido' },
  estimated: { en: 'estimated', es: 'estimado' },
  yearsOld: { en: 'years old', es: 'años' },
  years: { en: 'years', es: 'años' },

  totalKerr: { en: 'Total (Kerr)', es: 'Total (Kerr)' },
  muscleMass: { en: 'Muscle Mass', es: 'Masa Muscular' },
  adiposeMass: { en: 'Adipose Mass', es: 'Masa Adiposa' },
  boneMass: { en: 'Bone Mass', es: 'Masa Ósea' },
  residualMass: { en: 'Residual Mass', es: 'Masa Residual' },
  skinMass: { en: 'Skin Mass', es: 'Masa de Piel' },
  muscleBoneRatio: { en: 'Muscle/Bone Ratio', es: 'Ratio Músculo/Óseo' },
  ballastIndex: { en: 'Ballast Index', es: 'Índice de Lastre' },
  bmi: { en: 'BMI', es: 'IMC' },
  endomorphy: { en: 'Endomorphy', es: 'Endomorfismo' },
  mesomorphy: { en: 'Mesomorphy', es: 'Mesomorfismo' },
  ectomorphy: { en: 'Ectomorphy', es: 'Ectomorfismo' },
  compartment: { en: 'COMPARTMENT', es: 'COMPARTIMENTO' },
  total: { en: 'TOTAL', es: 'TOTAL' },
  muscular: { en: 'Muscular', es: 'Muscular' },
  adipose: { en: 'Adipose', es: 'Adiposa' },
  bone: { en: 'Bone', es: 'Osea' },
  residual: { en: 'Residual', es: 'Residual' },
  skin: { en: 'Skin', es: 'Piel' },
  bodyMass: { en: 'Body Mass', es: 'Masa Corporal' },
  stature: { en: 'Stature', es: 'Talla' },
  bodyFat: { en: 'Body Fat', es: 'Grasa Corporal' },
  noKerrData: { en: 'No Kerr body composition data available. Complete an ISAK assessment first.', es: 'Sin datos de composición corporal Kerr. Completá primero una evaluación ISAK.' },

  hydrationSessions: { en: 'Hydration Sessions', es: 'Sesiones de Hidratación' },
  sweatRate: { en: 'Sweat Rate', es: 'Tasa de Sudoración' },
  dehydration: { en: 'Dehydration', es: 'Deshidratación' },
  duration: { en: 'Duration', es: 'Duración' },
  temperature: { en: 'Temperature', es: 'Temperatura' },
  humidity: { en: 'Humidity', es: 'Humedad' },
  fluidIntake: { en: 'Fluid Intake', es: 'Ingesta de Líquido' },
  usgPre: { en: 'USG Pre', es: 'DUE Pre' },
  usgPost: { en: 'USG Post', es: 'DUE Post' },
  noHydrationData: { en: 'No hydration sessions recorded.', es: 'Sin sesiones de hidratación registradas.' },

  noPhysiologyData: { en: 'No physiology data available for this section.', es: 'Sin datos de fisiología disponibles para esta sección.' },
  noData: { en: 'No data available.', es: 'Sin datos disponibles.' },

  zone: { en: 'Zone', es: 'Zona' },
  zones5Title: { en: '5-Zone Model', es: 'Modelo de 5 Zonas' },
  zones7Title: { en: '7-Zone Model', es: 'Modelo de 7 Zonas' },
  vtTitle: { en: 'Ventilatory Thresholds (VT1 / VT2)', es: 'Umbrales Ventilatorios (VT1 / VT2)' },
  vtEstimatedNote: { en: 'Note: VT values estimated from lactate thresholds. Not directly measured.', es: 'Nota: Valores de VT estimados a partir de umbrales de lactato. No medidos directamente.' },
  hrRange: { en: 'HR Range', es: 'Rango FC' },
  powerRange: { en: 'Power Range', es: 'Rango Potencia' },
  description: { en: 'Description', es: 'Descripción' },

  stage: { en: 'Stage', es: 'Etapa' },
  power: { en: 'Power', es: 'Potencia' },
  hr: { en: 'HR', es: 'FC' },
  vo2: { en: 'VO\u2082', es: 'VO\u2082' },
  rer: { en: 'RER', es: 'RER' },
  lactate: { en: 'Lactate', es: 'Lactato' },
  rpe: { en: 'RPE', es: 'RPE' },

  recommendationsText: { en: 'Based on the assessment results, the following training and lifestyle recommendations are provided:', es: 'Con base en los resultados de la evaluación, se proveen las siguientes recomendaciones de entrenamiento y estilo de vida:' },
};

function tr(key: string): string {
  const lang = getCurrentLanguage();
  return PDF_STRINGS[key]?.[lang] ?? PDF_STRINGS[key]?.['en'] ?? key;
}

export type ReportSection =
  | 'cover'
  | 'executive_summary'
  | 'test_context'
  | 'anthropometry'
  | 'anthropometry_results'
  | 'anthropometry_targets'
  | 'isak_details'
  | 'anthropometry_comparison'
  | 'vo2max'
  | 'thresholds'
  | 'fat_oxidation'
  | 'energy_substrate'
  | 'training_zones'
  | 'economy_metrics'
  | 'vo2_comparison'
  | 'hydration'
  | 'heat_adaptation'
  | 'raw_data'
  | 'recommendations';

export type ReportStyle = 'scientific' | 'coach' | 'athlete' | 'minimal';
export type ReportType = 'full' | 'lab' | 'anthropometry' | 'hydration' | 'comparative' | 'custom';

export interface ReportBranding {
  labName: string;
  evaluatorName: string;
  credentials: string;
  contactInfo: string;
}

export type ChartType =
  | 'hr_power'
  | 'lactate_curve'
  | 'vo2_power'
  | 'rpe_stage'
  | 'substrate_oxidation'
  | 'rer_stage';

export interface ChartSeriesConfig {
  hr?: boolean;
  power?: boolean;
  lactate?: boolean;
  vo2?: boolean;
  rpe?: boolean;
  fat_pct?: boolean;
  carb_pct?: boolean;
  rer?: boolean;
}

export interface ChartSelection {
  type: ChartType;
  enabled: boolean;
  series: ChartSeriesConfig;
}

export type ZoneDisplayMode = '5' | '7' | 'both';

export interface ReportOptions {
  sections: ReportSection[];
  style: ReportStyle;
  branding: ReportBranding;
  reportNotes?: string;
  physiologyNotes?: string;
  anthropometryNotes?: string;
  useManualZones?: boolean;
  manualTrainingZones?: TrainingZone[];
  zoneDisplayMode?: ZoneDisplayMode;
  charts?: ChartSelection[];
}

export interface ReportData {
  athlete: Athlete;
  test?: Test | null;
  physiologyResults?: PhysiologyResults | null;
  dataPoints?: TestDataPoint[];
  advancedMetrics?: AdvancedMetrics | null;
  anthropometryMeasurement?: AnthropometryMeasurement | null;
  kerrResults?: KerrResults | null;
  hydrationSessions?: HydrationSessionData[];
  preTestData?: PreTestData | null;
}

export interface HydrationSessionData {
  id: string;
  session_date: string;
  duration_min: number;
  pre_weight_kg?: number;
  post_weight_kg?: number;
  fluid_intake_ml?: number;
  sweat_rate_l_h?: number;
  percent_dehydration?: number;
  ambient_temp_c?: number;
  humidity_pct?: number;
  usg_pre?: number;
  usg_post?: number;
}

export interface SectionDefinition {
  key: ReportSection;
  label: string;
  group: string;
  requiresData: ('physiology' | 'anthropometry' | 'dataPoints' | 'hydration')[];
}

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  { key: 'cover', label: 'Cover Page', group: 'General', requiresData: [] },
  { key: 'executive_summary', label: 'Executive Summary', group: 'General', requiresData: [] },
  { key: 'test_context', label: 'Condiciones del Test', group: 'General', requiresData: [] },
  { key: 'anthropometry', label: 'Body Composition — Conclusions', group: 'Anthropometry', requiresData: ['anthropometry'] },
  { key: 'anthropometry_results', label: 'Body Composition — Results (Z-scores, Table)', group: 'Anthropometry', requiresData: ['anthropometry'] },
  { key: 'anthropometry_targets', label: 'Body Composition — Targets & Change Summary', group: 'Anthropometry', requiresData: ['anthropometry'] },
  { key: 'isak_details', label: 'ISAK Measurement Details', group: 'Anthropometry', requiresData: ['anthropometry'] },
  { key: 'anthropometry_comparison', label: 'Anthropometry Reference Comparison', group: 'Anthropometry', requiresData: ['anthropometry'] },
  { key: 'vo2max', label: 'VO\u2082max', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'thresholds', label: 'Lactate Thresholds (LT1 / LT2)', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'fat_oxidation', label: 'Fat Oxidation & FatMax', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'energy_substrate', label: '% Energy by Substrate', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'training_zones', label: 'Training Zones', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'economy_metrics', label: 'Economy & Power Metrics', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'vo2_comparison', label: 'VO2max & Lactate Comparison', group: 'Physiology', requiresData: ['physiology'] },
  { key: 'hydration', label: 'Hydration Analysis', group: 'Environmental', requiresData: ['hydration'] },
  { key: 'heat_adaptation', label: 'Heat Adaptation Notes', group: 'Environmental', requiresData: [] },
  { key: 'raw_data', label: 'Appendix: Raw Stage Data', group: 'Data', requiresData: ['dataPoints'] },
  { key: 'recommendations', label: 'Recommendations', group: 'Conclusions', requiresData: [] },
];

export const REPORT_TYPE_PRESETS: Record<ReportType, ReportSection[]> = {
  full: ['cover', 'executive_summary', 'test_context', 'anthropometry', 'isak_details', 'vo2max', 'thresholds', 'fat_oxidation', 'energy_substrate', 'training_zones', 'economy_metrics', 'vo2_comparison', 'hydration', 'recommendations'],
  lab: ['cover', 'executive_summary', 'test_context', 'vo2max', 'thresholds', 'fat_oxidation', 'energy_substrate', 'training_zones', 'economy_metrics', 'vo2_comparison', 'raw_data'],
  anthropometry: ['cover', 'executive_summary', 'anthropometry', 'anthropometry_results', 'anthropometry_targets', 'isak_details', 'anthropometry_comparison'],
  hydration: ['cover', 'hydration', 'recommendations'],
  comparative: ['cover', 'executive_summary', 'anthropometry', 'anthropometry_results', 'anthropometry_comparison'],
  custom: [],
};

export interface ChartDefinition {
  type: ChartType;
  label: string;
  availableSeries: { key: keyof ChartSeriesConfig; label: string }[];
  requiresData: ('physiology' | 'dataPoints')[];
}

export const CHART_DEFINITIONS: ChartDefinition[] = [
  {
    type: 'hr_power',
    label: 'HR vs Power by Stage',
    availableSeries: [
      { key: 'hr', label: 'Heart Rate (bpm)' },
      { key: 'power', label: 'Power (W)' },
    ],
    requiresData: ['dataPoints'],
  },
  {
    type: 'lactate_curve',
    label: 'Lactate Curve',
    availableSeries: [
      { key: 'lactate', label: 'Lactate (mmol/L)' },
      { key: 'hr', label: 'Heart Rate (bpm)' },
    ],
    requiresData: ['dataPoints'],
  },
  {
    type: 'vo2_power',
    label: 'VO2 vs Power',
    availableSeries: [
      { key: 'vo2', label: 'VO2 (ml/kg/min)' },
      { key: 'power', label: 'Power (W)' },
    ],
    requiresData: ['dataPoints'],
  },
  {
    type: 'rpe_stage',
    label: 'RPE by Stage',
    availableSeries: [
      { key: 'rpe', label: 'RPE (1-10)' },
    ],
    requiresData: ['dataPoints'],
  },
  {
    type: 'substrate_oxidation',
    label: 'Substrate Oxidation (%)',
    availableSeries: [
      { key: 'fat_pct', label: 'Fat %' },
      { key: 'carb_pct', label: 'Carb %' },
    ],
    requiresData: ['dataPoints', 'physiology'],
  },
  {
    type: 'rer_stage',
    label: 'RER by Stage',
    availableSeries: [
      { key: 'rer', label: 'RER' },
    ],
    requiresData: ['dataPoints', 'physiology'],
  },
];

const C = {
  yellow: '#fdda36',
  dark: '#514163',
  darkBg: '#3a2e4a',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray500: '#6b7280',
  gray700: '#374151',
  gray900: '#111827',
  white: '#ffffff',
  z1: '#3b82f6',
  z2: '#10b981',
  z3: '#f59e0b',
  z4: '#f97316',
  z5: '#ef4444',
  adipose: '#fb923c',
  muscle: '#ef4444',
  bone: '#9ca3af',
  skin: '#fcd34d',
  residual: '#a78bfa',
};

interface LogoInfo {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

async function loadLogo(): Promise<LogoInfo | null> {
  try {
    const res = await fetch('/logo_transp.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, naturalWidth: dims.w, naturalHeight: dims.h };
  } catch {
    return null;
  }
}

function addLogoImage(doc: jsPDF, logo: LogoInfo, x: number, y: number, maxW: number, maxH: number) {
  const ratio = logo.naturalWidth / logo.naturalHeight;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  const cx = x + (maxW - w) / 2;
  doc.addImage(logo.dataUrl, 'PNG', cx, y, w, h, undefined, 'FAST');
}

async function fetchFontAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

interface FontSet {
  kronaOne: string | null;
  jostRegular: string | null;
  jostBold: string | null;
}

async function resolveFontUrl(family: string, weight: number): Promise<string | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const res = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const css = await res.text();
    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function loadFonts(): Promise<FontSet> {
  const [kronaOneUrl, jostRegularUrl, jostBoldUrl] = await Promise.all([
    resolveFontUrl('Krona One', 400),
    resolveFontUrl('Jost', 400),
    resolveFontUrl('Jost', 700),
  ]);
  const [kronaOne, jostRegular, jostBold] = await Promise.all([
    kronaOneUrl ? fetchFontAsBase64(kronaOneUrl) : Promise.resolve(null),
    jostRegularUrl ? fetchFontAsBase64(jostRegularUrl) : Promise.resolve(null),
    jostBoldUrl ? fetchFontAsBase64(jostBoldUrl) : Promise.resolve(null),
  ]);
  return { kronaOne, jostRegular, jostBold };
}

function registerFonts(doc: jsPDF, fonts: FontSet) {
  try {
    if (fonts.kronaOne) {
      doc.addFileToVFS('KronaOne-Regular.ttf', fonts.kronaOne);
      doc.addFont('KronaOne-Regular.ttf', 'KronaOne', 'normal');
    }
    if (fonts.jostRegular) {
      doc.addFileToVFS('Jost-Regular.ttf', fonts.jostRegular);
      doc.addFont('Jost-Regular.ttf', 'Jost', 'normal');
    }
    if (fonts.jostBold) {
      doc.addFileToVFS('Jost-Bold.ttf', fonts.jostBold);
      doc.addFont('Jost-Bold.ttf', 'Jost', 'bold');
    }
  } catch {
    // font registration optional
  }
}

const ZONE_COLORS: Record<number, string> = { 1: C.z1, 2: C.z2, 3: C.z3, 4: C.z4, 5: C.z5 };

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

class PDFBuilder {
  pdf: jsPDF;
  y: number;
  readonly ml = 15;
  readonly mr = 15;
  readonly w = 210;
  readonly h = 297;
  readonly cw: number;
  readonly pageBottom = 280;
  pageNum = 1;
  private branding: ReportBranding;
  private athleteName: string;
  hasKrona = false;
  hasJost = false;

  constructor(branding: ReportBranding, athleteName: string) {
    this.pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    this.y = this.ml;
    this.cw = this.w - this.ml - this.mr;
    this.branding = branding;
    this.athleteName = athleteName;
  }

  setKronaFont(size: number) {
    if (this.hasKrona) {
      this.pdf.setFont('KronaOne', 'normal');
    } else {
      this.pdf.setFont('helvetica', 'bold');
    }
    this.pdf.setFontSize(size);
  }

  setJostFont(size: number, weight: 'normal' | 'bold' = 'normal') {
    if (this.hasJost) {
      this.pdf.setFont('Jost', weight);
    } else {
      this.pdf.setFont('helvetica', weight);
    }
    this.pdf.setFontSize(size);
  }

  fill(hex: string) { const [r, g, b] = hexToRgb(hex); this.pdf.setFillColor(r, g, b); }
  stroke(hex: string) { const [r, g, b] = hexToRgb(hex); this.pdf.setDrawColor(r, g, b); }
  textColor(hex: string) { const [r, g, b] = hexToRgb(hex); this.pdf.setTextColor(r, g, b); }

  checkPage(needed = 20) {
    if (this.y + needed > this.pageBottom) {
      this.pdf.addPage();
      this.pageNum++;
      this.y = 20;
      this.addPageFooter();
    }
  }

  addPageFooter() {
    const footerY = this.h - 8;
    this.fill(C.gray100);
    this.pdf.rect(0, footerY - 3, this.w, 11, 'F');
    this.textColor(C.gray500);
    this.pdf.setFontSize(7);
    this.pdf.setFont('helvetica', 'normal');
    const lab = this.branding.labName || 'Metabolic Lab';
    this.pdf.text(lab, this.ml, footerY + 2);
    this.pdf.text(`${tr('pageLabel')} ${this.pageNum}`, this.w / 2, footerY + 2, { align: 'center' });
    this.pdf.text(this.athleteName, this.w - this.mr, footerY + 2, { align: 'right' });
  }

  sectionHeader(title: string) {
    this.checkPage(16);
    this.fill(C.yellow);
    this.pdf.rect(this.ml, this.y, 3, 10, 'F');
    this.fill(C.gray900);
    this.pdf.rect(this.ml + 3, this.y, this.cw - 3, 10, 'F');
    this.textColor(C.white);
    this.setKronaFont(8);
    this.pdf.text(title.toUpperCase(), this.ml + 7, this.y + 6.5);
    this.y += 13;
  }

  metricGrid(items: Array<{ label: string; value: string; unit?: string; note?: string }>, cols = 3) {
    const colW = this.cw / cols;
    const boxH = 16;
    const perRow = cols;
    for (let i = 0; i < items.length; i += perRow) {
      const row = items.slice(i, i + perRow);
      this.checkPage(boxH + 3);
      row.forEach((item, j) => {
        const x = this.ml + j * colW;
        this.fill(C.gray100);
        this.stroke(C.gray200);
        this.pdf.setLineWidth(0.3);
        this.pdf.rect(x, this.y, colW - 1, boxH, 'FD');
        this.textColor(C.gray500);
        this.setJostFont(6.5, 'normal');
        this.pdf.text(item.label.toUpperCase(), x + 3, this.y + 4.5);
        this.textColor(C.gray900);
        this.setKronaFont(12);
        const valueWidth = this.pdf.getTextWidth(item.value);
        this.pdf.text(item.value, x + 3, this.y + 11);
        if (item.unit) {
          this.textColor(C.gray500);
          this.pdf.setFontSize(7);
          this.pdf.setFont('helvetica', 'normal');
          this.pdf.text(item.unit, x + 3 + valueWidth + 2, this.y + 11);
        }
        if (item.note) {
          this.textColor(C.gray500);
          this.pdf.setFontSize(6);
          this.pdf.text(item.note, x + 3, this.y + 14.5);
        }
      });
      this.y += boxH + 2;
    }
  }

  tableHeader(cols: Array<{ label: string; width: number }>) {
    this.checkPage(10);
    let x = this.ml;
    this.fill(C.gray900);
    this.pdf.rect(this.ml, this.y, this.cw, 8, 'F');
    this.textColor(C.white);
    this.setJostFont(7, 'bold');
    cols.forEach(col => {
      this.pdf.text(col.label, x + 2, this.y + 5.5);
      x += col.width;
    });
    this.y += 8;
  }

  tableRow(cols: Array<{ value: string; width: number }>, isEven: boolean, accentColor?: string) {
    this.checkPage(8);
    let x = this.ml;
    if (accentColor) {
      const [r, g, b] = hexToRgb(accentColor);
      this.pdf.setFillColor(r, g, b);
      this.pdf.rect(this.ml, this.y, 3, 7, 'F');
    }
    this.fill(isEven ? C.white : C.gray100);
    this.pdf.rect(this.ml + (accentColor ? 3 : 0), this.y, this.cw - (accentColor ? 3 : 0), 7, 'F');
    this.textColor(C.gray700);
    this.setJostFont(8, 'normal');
    cols.forEach((col, i) => {
      const tx = i === 0 ? x + (accentColor ? 5 : 2) : x + 2;
      this.pdf.text(col.value, tx, this.y + 5);
      x += col.width;
    });
    this.stroke(C.gray200);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(this.ml, this.y + 7, this.ml + this.cw, this.y + 7);
    this.y += 7;
  }

  paragraph(text: string, fontSize = 8.5) {
    this.checkPage(10);
    this.textColor(C.gray700);
    this.setJostFont(fontSize, 'normal');
    const lines = this.pdf.splitTextToSize(sanitizeForPDF(text), this.cw);
    lines.forEach((line: string) => {
      this.checkPage(6);
      this.setJostFont(fontSize, 'normal');
      this.pdf.text(line, this.ml, this.y);
      this.y += 5;
    });
    this.y += 2;
  }

  label(text: string, note?: string) {
    this.checkPage(7);
    this.textColor(C.gray500);
    this.setJostFont(7, 'bold');
    this.pdf.text(text.toUpperCase(), this.ml, this.y);
    if (note) {
      this.textColor(C.gray500);
      this.setJostFont(6.5, 'normal');
      this.pdf.text(note, this.ml + this.pdf.getTextWidth(text.toUpperCase()) + 2, this.y);
    }
    this.y += 5;
  }

  spacer(h = 4) { this.y += h; }

  horizontalBar(value: number, max: number, color: string, x: number, y: number, w: number, h: number) {
    this.fill(C.gray200);
    this.pdf.rect(x, y, w, h, 'F');
    const bw = Math.max(0, Math.min(1, value / max)) * w;
    this.fill(color);
    this.pdf.rect(x, y, bw, h, 'F');
  }

  get doc() { return this.pdf; }
}

function val(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined) return '—';
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

function renderCover(b: PDFBuilder, data: ReportData, options: ReportOptions, logo: LogoInfo | null) {
  const { athlete, test } = data;
  const { branding } = options;

  b.fill(C.white);
  b.doc.rect(0, 0, 210, 297, 'F');

  b.fill(C.dark);
  b.doc.rect(0, 0, 8, 297, 'F');

  b.fill(C.yellow);
  b.doc.rect(8, 0, 4, 297, 'F');

  if (logo) {
    try {
      addLogoImage(b.doc, logo, 120, 18, 75, 55);
    } catch {
      // logo optional
    }
  }

  b.textColor(C.dark);
  b.setKronaFont(24);
  const labName = branding.labName || 'ASCIENDE';
  b.doc.text(labName.toUpperCase(), 22, 40);

  b.textColor(C.dark);
  b.setKronaFont(11);
  b.doc.text('METABOLIC LAB', 22, 50);

  b.fill(C.yellow);
  b.doc.rect(22, 56, 80, 1, 'F');

  b.textColor(C.gray500);
  b.setJostFont(9, 'normal');
  b.doc.text(tr('coverSubtitle'), 22, 65);

  if (logo) {
    try {
      b.doc.saveGraphicsState();
      b.doc.setGState(b.doc.GState({ opacity: 0.04 }));
      addLogoImage(b.doc, logo, 30, 100, 150, 110);
      b.doc.restoreGraphicsState();
    } catch {
      // watermark optional
    }
  }

  b.fill(C.dark);
  b.doc.rect(22, 155, 168, 0.5, 'F');

  b.textColor(C.dark);
  b.setKronaFont(28);
  const lines = b.doc.splitTextToSize(athlete.name, 168);
  let ny = 170;
  lines.forEach((line: string) => {
    b.doc.text(line, 22, ny);
    ny += 12;
  });

  b.textColor(C.gray500);
  b.setJostFont(10, 'normal');
  const sportName = athlete.sport && athlete.sport !== 'other' ? (athlete.sport.charAt(0).toUpperCase() + athlete.sport.slice(1).replace(/_/g, ' ')) : null;
  const testTypeLabel = test?.test_type ? test.test_type.replace(/_/g, ' ').toUpperCase() : '';
  const parts: string[] = [];
  if (sportName) parts.push(`Sport: ${sportName}`);
  if (testTypeLabel) parts.push(testTypeLabel);
  if (parts.length > 0) b.doc.text(parts.join('   ·   '), 22, ny + 4);

  if (athlete.date_of_birth) {
    const age = new Date().getFullYear() - new Date(athlete.date_of_birth).getFullYear();
    b.doc.text(`${age} years`, 22, ny + 12);
  }

  if (test?.test_date) {
    b.textColor(C.gray500);
    b.doc.setFontSize(9);
    b.doc.text(new Date(test.test_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }), 22, ny + 20);
  }

  const infoLines: string[] = [];
  if (branding.evaluatorName) infoLines.push(`${tr('coverEvaluator')}: ${branding.evaluatorName}`);
  if (branding.credentials) infoLines.push(branding.credentials);
  if (branding.contactInfo) infoLines.push(branding.contactInfo);

  b.fill(C.gray100);
  b.doc.rect(22, 255, 168, infoLines.length > 0 ? infoLines.length * 6 + 10 : 16, 'F');
  b.fill(C.yellow);
  b.doc.rect(22, 255, 3, infoLines.length > 0 ? infoLines.length * 6 + 10 : 16, 'F');

  b.textColor(C.dark);
  b.doc.setFontSize(8.5);
  b.doc.setFont('helvetica', 'normal');
  let iy = 263;
  if (infoLines.length > 0) {
    infoLines.forEach(line => {
      b.doc.text(line, 29, iy);
      iy += 6;
    });
  } else {
    b.doc.text(tr('coverLab'), 29, iy);
  }

  b.textColor(C.gray500);
  b.doc.setFontSize(7);
  b.doc.text(tr('coverDisclaimer'), 22, 289);

  b.doc.addPage();
  b.y = 20;
  b.pageNum = 2;
  b.addPageFooter();
}

function renderExecutiveSummary(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secExecutiveSummary'));
  const { physiologyResults: r, kerrResults: k, athlete } = data;

  const items: Array<{ label: string; value: string; unit?: string; note?: string }> = [];

  if (r?.vo2max) {
    items.push({ label: 'VO\u2082max', value: val(r.vo2max, 1), unit: 'ml/kg/min', note: r.vo2max_confidence !== 'measured' ? `(${r.vo2max_confidence})` : undefined });
  }
  if (r?.lt1_hr) {
    items.push({ label: 'LT1 Heart Rate', value: val(r.lt1_hr), unit: 'bpm' });
  }
  if (r?.lt2_hr) {
    items.push({ label: 'LT2 Heart Rate', value: val(r.lt2_hr), unit: 'bpm' });
  }
  if (r?.hrmax) {
    items.push({ label: 'HR Max', value: val(r.hrmax), unit: 'bpm', note: r.hrmax_confidence !== 'measured' ? '(estimated)' : undefined });
  }
  if (r?.lt1_power) items.push({ label: 'LT1 Power', value: val(r.lt1_power), unit: 'W' });
  if (r?.lt2_power) items.push({ label: 'LT2 Power', value: val(r.lt2_power), unit: 'W' });
  if (r?.fatmax_hr) items.push({ label: 'FatMax HR', value: val(r.fatmax_hr), unit: 'bpm' });
  if (r?.pam_watts) items.push({ label: 'PAM', value: val(r.pam_watts), unit: 'W' });
  if (r?.vam_kmh) items.push({ label: 'VAM', value: r.vam_kmh.toFixed(1), unit: 'km/h' });

  if (k) {
    items.push({ label: 'Muscle Mass', value: k.muscle_mass_kg.toFixed(1), unit: 'kg' });
    items.push({ label: 'Adipose Mass', value: k.adipose_mass_kg.toFixed(1), unit: 'kg' });
    items.push({ label: 'Bone Mass', value: k.bone_mass_kg.toFixed(1), unit: 'kg' });
  } else if (athlete.body_fat_percent) {
    items.push({ label: 'Body Fat', value: athlete.body_fat_percent.toFixed(1), unit: '%' });
  }

  if (athlete.weight_kg) items.push({ label: 'Body Mass', value: athlete.weight_kg.toFixed(1), unit: 'kg' });
  if (athlete.height_cm) items.push({ label: 'Stature', value: String(Math.round(athlete.height_cm)), unit: 'cm' });

  if (items.length === 0) {
    b.paragraph('No key metrics available for this report.');
    return;
  }

  b.metricGrid(items, 3);

  if (r?.data_quality) {
    b.spacer(2);
    b.textColor(C.gray500);
    b.doc.setFontSize(7.5);
    b.doc.setFont('helvetica', 'italic');
    b.doc.text(`Data quality: ${r.data_quality}`, b.ml, b.y);
    b.y += 6;
  }
  b.spacer(4);
}

type VO2Card = { label: string; value: string; unit?: string; color: string };

function renderVO2CardRow(b: PDFBuilder, metrics: VO2Card[]) {
  if (metrics.length === 0) return;
  b.checkPage(28);
  const cardW = (b.cw - (metrics.length - 1) * 3) / metrics.length;
  metrics.forEach((metric, i) => {
    const cx = b.ml + i * (cardW + 3);
    const [cr, cg, cb] = hexToRgb(metric.color);
    b.fill(C.gray100);
    b.doc.rect(cx, b.y, cardW, 22, 'F');
    b.doc.setFontSize(7.5);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(C.gray500);
    b.doc.text(metric.label, cx + 3, b.y + 5);
    b.doc.setFontSize(13);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(metric.color);
    const valueWidth = b.doc.getTextWidth(metric.value);
    b.doc.text(metric.value, cx + 3, b.y + 14);
    if (metric.unit) {
      b.doc.setFontSize(7);
      b.doc.setFont('helvetica', 'normal');
      b.textColor(C.gray500);
      b.doc.text(metric.unit, cx + 3 + valueWidth + 2, b.y + 14);
    }
    b.doc.setFillColor(cr, cg, cb);
    b.doc.circle(cx + cardW - 5, b.y + 16, 2.5, 'F');
  });
  b.y += 26;
}

function renderVO2max(b: PDFBuilder, data: ReportData, style: ReportStyle) {
  b.sectionHeader(tr('secVO2max'));
  const r = data.physiologyResults;
  if (!r) { b.paragraph('No physiology data available.'); return; }

  const k = data.kerrResults as any;
  const vo2_ml_min = r.vo2max_ml_min;

  let vo2_ffm: number | null = null;
  let vo2_muscle: number | null = null;
  if (vo2_ml_min && k) {
    const adiposeKg = k.adipose_mass_kg;
    const muscleKg = k.muscle_mass_kg;
    const weightKg = k.structured_weight_kg || data.athlete.weight_kg;
    if (weightKg && adiposeKg != null && adiposeKg >= 0) {
      const ffmKg = weightKg - adiposeKg;
      if (ffmKg > 0) vo2_ffm = vo2_ml_min / ffmKg;
    }
    if (muscleKg != null && muscleKg > 0) {
      vo2_muscle = vo2_ml_min / muscleKg;
    }
  }

  const row1: VO2Card[] = [];
  if (r.vo2max) row1.push({ label: 'VO\u2082max (total body)', value: val(r.vo2max, 1), unit: 'ml/kg/min', color: '#10B981' });
  if (vo2_ml_min) row1.push({ label: 'VO\u2082max (absolute)', value: (vo2_ml_min / 1000).toFixed(2), unit: 'L/min', color: '#3B82F6' });
  if (r.vo2max_ml_kg_lbm_min) row1.push({ label: 'VO\u2082max (LBM)', value: val(r.vo2max_ml_kg_lbm_min, 1), unit: 'ml/kgLBM/min', color: '#F59E0B' });
  if (r.hrmax) row1.push({ label: 'HRmax', value: val(r.hrmax), unit: 'bpm', color: '#EF4444' });

  const row2: VO2Card[] = [];
  if (vo2_ffm) row2.push({ label: 'VO\u2082max / Fat-Free Mass', value: vo2_ffm.toFixed(1), unit: 'ml/kgFFM/min', color: '#059669' });
  if (vo2_muscle) row2.push({ label: 'VO\u2082max / Muscle Mass', value: vo2_muscle.toFixed(1), unit: 'ml/kgMM/min', color: '#0284C7' });

  renderVO2CardRow(b, row1);
  if (row2.length > 0) {
    b.spacer(2);
    renderVO2CardRow(b, row2);
  }

  b.spacer(2);

  if (style === 'scientific' || style === 'coach') {
    b.label('Metabolic Profile');
    b.paragraph(`Aerobic capacity: ${r.metabolic_profile.aerobic_capacity}`);
    b.paragraph(`Fat utilization: ${r.metabolic_profile.fat_utilization}`);
    b.paragraph(`Anaerobic contribution: ${r.metabolic_profile.anaerobic_contribution}`);
  }

  if (r.thresholds && (r.thresholds.VT1.hr || r.thresholds.VT2.hr)) {
    b.spacer(4);
    b.doc.setFontSize(9);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.gray700);
    b.doc.text(tr('vtTitle'), b.ml, b.y);
    b.y += 6;

    const vt = r.thresholds;
    const vtCols = [
      { label: 'THRESHOLD', width: 38 },
      { label: 'HR (bpm)', width: 28 },
      { label: 'POWER (W)', width: 28 },
      { label: 'VO\u2082 (ml/kg/min)', width: 38 },
      { label: '% VO\u2082max', width: 28 },
      { label: '% HRmax', width: 22 },
    ];
    b.tableHeader(vtCols);

    if (vt.VT1.hr) {
      b.tableRow([
        { value: 'VT1 (First Ventilatory)', width: 38 },
        { value: val(vt.VT1.hr), width: 28 },
        { value: val(vt.VT1.power), width: 28 },
        { value: val(vt.VT1.vo2, 1), width: 38 },
        { value: vt.VT1.percent_vo2max ? `${vt.VT1.percent_vo2max}%` : '\u2014', width: 28 },
        { value: vt.VT1.percent_hrmax ? `${vt.VT1.percent_hrmax}%` : '\u2014', width: 22 },
      ], true);
    }
    if (vt.VT2.hr) {
      b.tableRow([
        { value: 'VT2 (Second Ventilatory)', width: 38 },
        { value: val(vt.VT2.hr), width: 28 },
        { value: val(vt.VT2.power), width: 28 },
        { value: val(vt.VT2.vo2, 1), width: 38 },
        { value: vt.VT2.percent_vo2max ? `${vt.VT2.percent_vo2max}%` : '\u2014', width: 28 },
        { value: vt.VT2.percent_hrmax ? `${vt.VT2.percent_hrmax}%` : '\u2014', width: 22 },
      ], false);
    }
    b.spacer(2);
    if (vt.vt_source === 'estimated_from_lt') {
      b.textColor(C.gray500);
      b.setJostFont(7.5, 'normal');
      b.doc.text(tr('vtEstimatedNote'), b.ml, b.y);
      b.y += 4;
    }
  }

  b.spacer(4);
}

function renderThresholds(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secThresholds'));
  const r = data.physiologyResults;
  if (!r) { b.paragraph('No threshold data available.'); return; }

  const cols = [
    { label: 'THRESHOLD', width: 38 },
    { label: 'HR (bpm)', width: 28 },
    { label: 'POWER (W)', width: 28 },
    { label: 'VO\u2082 (ml/kg/min)', width: 38 },
    { label: '% VO\u2082max', width: 28 },
    { label: '% HRmax', width: 22 },
  ];
  b.tableHeader(cols);

  if (r.lt1_hr) {
    b.tableRow([
      { value: 'LT1 (Aerobic Threshold)', width: 38 },
      { value: val(r.lt1_hr), width: 28 },
      { value: val(r.lt1_power), width: 28 },
      { value: val(r.lt1_vo2, 1), width: 38 },
      { value: r.lt1_percent_vo2max ? `${r.lt1_percent_vo2max}%` : '—', width: 28 },
      { value: r.lt1_percent_hrmax ? `${r.lt1_percent_hrmax}%` : '—', width: 22 },
    ], true);
  }

  if (r.lt2_hr) {
    b.tableRow([
      { value: 'LT2 (Anaerobic Threshold)', width: 38 },
      { value: val(r.lt2_hr), width: 28 },
      { value: val(r.lt2_power), width: 28 },
      { value: val(r.lt2_vo2, 1), width: 38 },
      { value: r.lt2_percent_vo2max ? `${r.lt2_percent_vo2max}%` : '—', width: 28 },
      { value: r.lt2_percent_hrmax ? `${r.lt2_percent_hrmax}%` : '—', width: 22 },
    ], false);
  }

  if (r.fatmax_hr) {
    b.tableRow([
      { value: 'FatMax (Max Fat Oxidation)', width: 38 },
      { value: val(r.fatmax_hr), width: 28 },
      { value: val(r.fatmax_power), width: 28 },
      { value: val(r.fatmax_vo2, 1), width: 38 },
      { value: '—', width: 28 },
      { value: '—', width: 22 },
    ], true);
  }

  // Ventilatory Thresholds
  if (r.thresholds) {
    b.spacer(6);
    b.paragraph('Ventilatory Thresholds (VT1 / VT2)');
    b.spacer(2);
    const vt = r.thresholds;
    if (vt.VT1.hr) {
      b.tableRow([
        { value: 'VT1 (First Ventilatory)', width: 38 },
        { value: val(vt.VT1.hr), width: 28 },
        { value: val(vt.VT1.power), width: 28 },
        { value: val(vt.VT1.vo2, 1), width: 38 },
        { value: vt.VT1.percent_vo2max ? `${vt.VT1.percent_vo2max}%` : '—', width: 28 },
        { value: vt.VT1.percent_hrmax ? `${vt.VT1.percent_hrmax}%` : '—', width: 22 },
      ], true);
    }
    if (vt.VT2.hr) {
      b.tableRow([
        { value: 'VT2 (Second Ventilatory)', width: 38 },
        { value: val(vt.VT2.hr), width: 28 },
        { value: val(vt.VT2.power), width: 28 },
        { value: val(vt.VT2.vo2, 1), width: 38 },
        { value: vt.VT2.percent_vo2max ? `${vt.VT2.percent_vo2max}%` : '—', width: 28 },
        { value: vt.VT2.percent_hrmax ? `${vt.VT2.percent_hrmax}%` : '—', width: 22 },
      ], false);
    }
    b.spacer(3);
    if (vt.delta_lt1_vt1_hr !== null || vt.delta_lt2_vt2_hr !== null) {
      const d1 = vt.delta_lt1_vt1_hr !== null ? `${vt.delta_lt1_vt1_hr > 0 ? '+' : ''}${vt.delta_lt1_vt1_hr} bpm` : '—';
      const d2 = vt.delta_lt2_vt2_hr !== null ? `${vt.delta_lt2_vt2_hr > 0 ? '+' : ''}${vt.delta_lt2_vt2_hr} bpm` : '—';
      b.paragraph(`Delta LT1-VT1: ${d1} | Delta LT2-VT2: ${d2}`);
    }
    b.spacer(2);
    b.paragraph('Lactate thresholds represent metabolic changes. Ventilatory thresholds represent respiratory changes. They are related but not necessarily identical.');
    if (vt.vt_source === 'estimated_from_lt') {
      b.paragraph('Note: VT values estimated from lactate thresholds. Not directly measured.');
    }
  }

  b.spacer(4);
}

function renderFatOxidation(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secFatOx'));
  const r = data.physiologyResults;
  if (!r?.fatmax_hr) { b.paragraph('FatMax data not available. Include RER measurements during testing.'); return; }

  const items: Array<{ label: string; value: string; unit?: string }> = [
    { label: 'FatMax HR', value: val(r.fatmax_hr), unit: 'bpm' },
    { label: 'FatMax Power', value: val(r.fatmax_power), unit: 'W' },
    { label: 'FatMax VO\u2082', value: val(r.fatmax_vo2, 1), unit: 'ml/kg/min' },
  ];
  b.metricGrid(items.filter(i => i.value !== '—'), 3);
  b.spacer(2);
  b.paragraph('FatMax is the exercise intensity at which the rate of fat oxidation is maximal. Training near this intensity optimizes fat utilization and improves metabolic efficiency.');
  b.spacer(4);
}

function renderZoneTable(b: PDFBuilder, zones: TrainingZone[], title: string, hasPower: boolean, hasPace: boolean, hasRpe: boolean) {
  b.doc.setFontSize(9);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray700);
  b.doc.text(title, b.ml, b.y);
  b.y += 5;

  const cols = [
    { label: 'ZONE', width: 12 },
    { label: 'NAME', width: hasPower || hasPace ? 32 : 38 },
    { label: 'HR RANGE (bpm)', width: 34 },
    ...(hasPower ? [{ label: 'POWER (W)', width: 28 }] : []),
    ...(hasPace ? [{ label: 'PACE', width: 24 }] : []),
    ...(hasRpe ? [{ label: 'RPE', width: 16 }] : []),
    { label: 'PURPOSE', width: hasPower || hasPace || hasRpe ? 34 : 70 },
  ];
  b.tableHeader(cols);

  zones.forEach((zone: TrainingZone, i: number) => {
    const color = ZONE_COLORS[zone.zone] || C.gray500;
    const row: Array<{ value: string; width: number }> = [
      { value: `Z${zone.zone}`, width: 12 },
      { value: zone.name, width: hasPower || hasPace ? 32 : 38 },
      { value: zone.hr_min != null && zone.hr_max != null
          ? `${zone.hr_min} - ${zone.hr_max}`
          : (zone as any).hr_label || '\u2014', width: 34 },
    ];
    if (hasPower) row.push({ value: zone.power_min && zone.power_max ? `${zone.power_min} - ${zone.power_max}` : '\u2014', width: 28 });
    if (hasPace) row.push({ value: zone.pace_min && zone.pace_max ? `${zone.pace_min} - ${zone.pace_max}` : '\u2014', width: 24 });
    if (hasRpe) {
      const rpeMin = (zone as any).rpe_min;
      const rpeMax = (zone as any).rpe_max;
      row.push({ value: rpeMin != null && rpeMax != null ? `${rpeMin} - ${rpeMax}` : '\u2014', width: 16 });
    }
    row.push({ value: zone.description || '', width: hasPower || hasPace || hasRpe ? 34 : 70 });
    b.tableRow(row, i % 2 === 0, color);
  });
  b.spacer(3);
}

function renderTrainingZones(b: PDFBuilder, data: ReportData, options: ReportOptions) {
  b.sectionHeader(tr('secZones'));

  const zones = options.useManualZones && options.manualTrainingZones?.length
    ? options.manualTrainingZones
    : data.physiologyResults?.training_zones;

  if (!zones?.length) { b.paragraph('No training zones available.'); return; }

  const mode: ZoneDisplayMode = options.zoneDisplayMode ?? '5';
  const zonesData = data.physiologyResults?.zones_data;

  const computeFlags = (zs: TrainingZone[]) => ({
    hasPower: zs.some(z => z.power_min || z.power_max),
    hasPace: zs.some(z => z.pace_min || z.pace_max),
    hasRpe: zs.some(z => (z as any).rpe_min != null || (z as any).rpe_max != null),
  });

  if (mode === 'both' && zonesData) {
    const z5 = zonesData.zones5 as unknown as TrainingZone[];
    const z7 = zonesData.zones7 as unknown as TrainingZone[];
    const f5 = computeFlags(z5);
    const f7 = computeFlags(z7);
    renderZoneTable(b, z5, tr('zones5Title') || '5-Zone Model', f5.hasPower, f5.hasPace, f5.hasRpe);
    b.spacer(3);
    renderZoneTable(b, z7, tr('zones7Title') || '7-Zone Model', f7.hasPower, f7.hasPace, f7.hasRpe);
  } else if (mode === '7' && zonesData) {
    const z7 = zonesData.zones7 as unknown as TrainingZone[];
    const f7 = computeFlags(z7);
    renderZoneTable(b, z7, tr('zones7Title') || '7-Zone Model', f7.hasPower, f7.hasPace, f7.hasRpe);
  } else {
    const f = computeFlags(zones);
    renderZoneTable(b, zones, tr('zones5Title') || '5-Zone Model', f.hasPower, f.hasPace, f.hasRpe);
  }

  if (options.useManualZones && options.manualTrainingZones?.length) {
    b.spacer(2);
    b.textColor(C.gray500);
    b.setJostFont(7, 'normal');
    b.doc.text('* Manually adjusted zones', b.ml, b.y);
    b.y += 4;
  }

  b.spacer(4);
}

function renderEconomy(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secEconomy'));
  const r = data.physiologyResults;
  if (!r) { b.paragraph('No data available.'); return; }

  const items: Array<{ label: string; value: string; unit?: string; note?: string }> = [];
  if (r.pam_watts) items.push({ label: 'PAM (Peak Aerobic Power)', value: val(r.pam_watts), unit: 'W' });
  if (r.vam_kmh) items.push({ label: 'VAM (Velocity at VO\u2082max)', value: r.vam_kmh.toFixed(1), unit: 'km/h' });
  if (r.hr_drift_percent != null) items.push({ label: 'HR Drift', value: r.hr_drift_percent.toFixed(1), unit: '%' });

  const adv = data.advancedMetrics;
  if (adv?.movementEconomy?.cycling?.watts_per_kg_lbm && r.lt2_power && data.athlete.weight_kg) {
    const wpkg = (r.lt2_power / data.athlete.weight_kg).toFixed(2);
    items.push({ label: 'W/kg at LT2', value: wpkg, unit: 'W/kg' });
  }
  if (adv?.movementEconomy?.cycling?.watts_per_kg_lbm) {
    items.push({ label: 'W/kg LBM at LT2', value: adv.movementEconomy.cycling.watts_per_kg_lbm.toFixed(2), unit: 'W/kg LBM' });
  }
  if (adv?.movementEconomy?.running?.cost_per_km_ml_o2_kg) {
    items.push({ label: 'Running Economy', value: adv.movementEconomy.running.cost_per_km_ml_o2_kg.toFixed(1), unit: 'ml/kg/km' });
  }

  if (items.length === 0) { b.paragraph('Economy metrics require power meter or VO\u2082 data.'); return; }
  b.metricGrid(items, 3);
  b.spacer(4);
}

function drawPieChart(b: PDFBuilder, components: Array<{ label: string; kg: number; pct: number; color: string }>, totalMass: number) {
  b.checkPage(85);
  const pieX = b.ml + 38;
  const pieY = b.y + 40;
  const pieR = 36;
  let startAngle = -Math.PI / 2;
  const steps = 60;

  components.forEach(comp => {
    if (comp.pct <= 0) return;
    const sweep = (comp.pct / 100) * 2 * Math.PI;
    const [cr, cg, cb] = hexToRgb(comp.color);
    b.doc.setFillColor(cr, cg, cb);
    b.doc.setDrawColor(255, 255, 255);
    b.doc.setLineWidth(0.2);
    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + (sweep / steps) * i;
      const a2 = startAngle + (sweep / steps) * (i + 1);
      b.doc.triangle(pieX, pieY, pieX + pieR * Math.cos(a1), pieY + pieR * Math.sin(a1), pieX + pieR * Math.cos(a2), pieY + pieR * Math.sin(a2), 'F');
    }
    if (comp.pct >= 5) {
      const mid = startAngle + sweep / 2;
      b.doc.setTextColor(255, 255, 255);
      b.doc.setFontSize(7);
      b.doc.setFont('helvetica', 'bold');
      b.doc.text(`${comp.pct.toFixed(1)}%`, pieX + pieR * 0.62 * Math.cos(mid), pieY + pieR * 0.62 * Math.sin(mid), { align: 'center' });
    }
    startAngle += sweep;
  });

  const lx = b.ml + 85;
  let ly = b.y + 4;
  b.doc.setFontSize(7.5);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray500);
  b.doc.text('COMPARTMENT', lx, ly);
  b.doc.text('kg', lx + 55, ly, { align: 'right' });
  b.doc.text('%', lx + 70, ly, { align: 'right' });
  ly += 4;
  b.fill(C.gray200);
  b.doc.rect(lx, ly, 70, 0.3, 'F');
  ly += 5;

  components.forEach((comp, i) => {
    const [cr, cg, cb] = hexToRgb(comp.color);
    b.doc.setFillColor(cr, cg, cb);
    b.doc.circle(lx + 2, ly - 1.5, 2, 'F');
    b.doc.setFont('helvetica', 'normal');
    b.doc.setFontSize(8.5);
    b.textColor(C.gray700);
    b.doc.text(comp.label, lx + 7, ly);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.gray900);
    b.doc.text(comp.kg.toFixed(2), lx + 55, ly, { align: 'right' });
    b.doc.text(comp.pct.toFixed(1), lx + 70, ly, { align: 'right' });
    ly += i < components.length - 1 ? 8 : 4;
  });

  b.fill(C.gray200);
  b.doc.rect(lx, ly, 70, 0.3, 'F');
  ly += 5;
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray900);
  b.doc.text('TOTAL', lx + 7, ly);
  b.doc.text(totalMass.toFixed(3), lx + 55, ly, { align: 'right' });
  b.doc.text('100.0', lx + 70, ly, { align: 'right' });
  b.y += 84;
}

function renderAnthropometry(b: PDFBuilder, data: ReportData, _style: ReportStyle) {
  b.sectionHeader(tr('secAnthro'));
  const k = data.kerrResults;

  if (!k) {
    if (data.athlete.weight_kg || data.athlete.body_fat_percent) {
      const items: Array<{ label: string; value: string; unit?: string }> = [];
      if (data.athlete.weight_kg) items.push({ label: 'Body Mass', value: data.athlete.weight_kg.toFixed(1), unit: 'kg' });
      if (data.athlete.height_cm) items.push({ label: 'Stature', value: String(Math.round(data.athlete.height_cm)), unit: 'cm' });
      if (data.athlete.body_fat_percent) items.push({ label: 'Body Fat', value: data.athlete.body_fat_percent.toFixed(1), unit: '%' });
      b.metricGrid(items, 3);
    } else {
      b.paragraph(tr('noKerrData'));
    }
    return;
  }

  const totalMass = k.structured_weight_kg || (k.skin_mass_kg + k.adipose_mass_kg + k.muscle_mass_kg + k.residual_mass_kg + k.bone_mass_kg);
  const components: Array<{ label: string; kg: number; pct: number; color: string }> = [
    { label: 'Muscular', kg: k.muscle_mass_kg, pct: k.muscle_mass_pct, color: '#10B981' },
    { label: 'Adipose', kg: k.adipose_mass_kg, pct: k.adipose_mass_pct, color: '#EF4444' },
    { label: 'Bone', kg: k.bone_mass_kg, pct: k.bone_mass_pct, color: '#3B82F6' },
    { label: 'Residual', kg: k.residual_mass_kg, pct: k.residual_mass_pct, color: '#6B7280' },
    { label: 'Skin', kg: k.skin_mass_kg, pct: k.skin_mass_pct, color: '#F59E0B' },
  ];

  drawPieChart(b, components, totalMass);

  b.spacer(6);

  const cardItems: Array<{ label: string; value: string; unit?: string }> = [
    { label: 'Somatotype', value: `${k.somatotype_endomorphy.toFixed(1)} – ${k.somatotype_mesomorphy.toFixed(1)} – ${k.somatotype_ectomorphy.toFixed(1)}` },
    { label: 'BMI', value: k.bmi.toFixed(1), unit: 'kg/m²' },
    { label: 'Surface Area', value: k.surface_area_m2.toFixed(3), unit: 'm²' },
  ];
  b.metricGrid(cardItems, 3);

  b.spacer(4);
}

function computeSum6Skinfolds(data: ReportData): number | null {
  const m = data.anthropometryMeasurement as any;
  if (m) {
    const t = m.triceps_sf_mm_median ?? m.triceps_sf_mm;
    const sub = m.subscapular_sf_mm_median ?? m.subscapular_sf_mm;
    const sup = m.supraspinale_sf_mm_median ?? m.supraspinale_sf_mm;
    const ab = m.abdominal_sf_mm_median ?? m.abdominal_sf_mm;
    const ft = m.front_thigh_sf_mm_median ?? m.front_thigh_sf_mm;
    const mc = m.medial_calf_sf_mm_median ?? m.medial_calf_sf_mm;
    if (t && sub && sup && ab && ft && mc) return Number(t) + Number(sub) + Number(sup) + Number(ab) + Number(ft) + Number(mc);
  }
  const k = data.kerrResults;
  if (k && k.sum_6_skinfolds > 0) return k.sum_6_skinfolds;
  return null;
}

function renderAnthropometryResults(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secAnthroResults'));
  const k = data.kerrResults;
  if (!k) { b.paragraph(tr('noKerrData')); return; }

  b.doc.setFontSize(8);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray500);
  b.doc.text('Z-SCORES (PHANTOM REFERENCE)', b.ml, b.y);
  b.y += 6;

  const zItems = [
    { label: 'Adipose', z: k.adipose_mass_z_score, inverted: true },
    { label: 'Muscle', z: k.muscle_mass_z_score, inverted: false },
    { label: 'Residual', z: k.residual_mass_z_score, inverted: false },
    { label: 'Bone', z: k.bone_mass_z_score, inverted: false },
  ];

  b.checkPage(28);
  const cardW = (b.cw - 9) / 4;
  zItems.forEach((item, i) => {
    const cx = b.ml + i * (cardW + 3);
    const isGood = item.inverted ? item.z <= 0 : item.z >= 0;
    b.fill(C.gray100);
    b.doc.rect(cx, b.y, cardW, 22, 'F');
    b.doc.setFontSize(7.5);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(C.gray500);
    b.doc.text(item.label, cx + 3, b.y + 5);
    b.doc.setFontSize(13);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(isGood ? '#059669' : '#DC2626');
    b.doc.text(`${item.z > 0 ? '+' : ''}${item.z.toFixed(2)}`, cx + 3, b.y + 15);
    b.doc.setFontSize(8);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(isGood ? '#059669' : '#DC2626');
    b.doc.text(isGood ? '↑' : '↓', cx + cardW - 6, b.y + 15);
  });
  b.y += 26;

  b.spacer(4);
  b.doc.setFontSize(8);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray500);
  b.doc.text('ALL COMPARTMENTS', b.ml, b.y);
  b.y += 6;

  b.checkPage(60);
  const colKg = b.ml + b.cw - 60;
  const colPct = b.ml + b.cw - 32;
  const colZ = b.ml + b.cw;
  b.doc.setFontSize(8);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray500);
  b.doc.text('Compartment', b.ml, b.y);
  b.doc.text('kg', colKg, b.y, { align: 'right' });
  b.doc.text('%', colPct, b.y, { align: 'right' });
  b.doc.text('Z-score', colZ, b.y, { align: 'right' });
  b.y += 2;
  b.fill(C.gray200);
  b.doc.rect(b.ml, b.y, b.cw, 0.4, 'F');
  b.y += 5;

  const rows = [
    { name: 'Muscle', kg: k.muscle_mass_kg, pct: k.muscle_mass_pct, z: k.muscle_mass_z_score, color: '#10B981' },
    { name: 'Adipose', kg: k.adipose_mass_kg, pct: k.adipose_mass_pct, z: k.adipose_mass_z_score, color: '#EF4444' },
    { name: 'Bone', kg: k.bone_mass_kg, pct: k.bone_mass_pct, z: k.bone_mass_z_score, color: '#3B82F6' },
    { name: 'Residual', kg: k.residual_mass_kg, pct: k.residual_mass_pct, z: k.residual_mass_z_score, color: '#6B7280' },
    { name: 'Skin', kg: k.skin_mass_kg, pct: k.skin_mass_pct, z: k.skin_mass_z_score, color: '#F59E0B' },
  ];

  rows.forEach(row => {
    b.checkPage(10);
    const [cr, cg, cb] = hexToRgb(row.color);
    b.doc.setFillColor(cr, cg, cb);
    b.doc.circle(b.ml + 2, b.y - 1.5, 2, 'F');
    b.doc.setFont('helvetica', 'bold');
    b.doc.setFontSize(8.5);
    b.textColor(C.gray900);
    b.doc.text(row.name, b.ml + 8, b.y);
    b.doc.setFont('helvetica', 'normal');
    b.doc.text(row.kg.toFixed(2), colKg, b.y, { align: 'right' });
    b.doc.text(`${row.pct.toFixed(1)}%`, colPct, b.y, { align: 'right' });
    b.doc.setFont('helvetica', 'bold');
    b.textColor(row.z >= 0 ? '#059669' : '#DC2626');
    b.doc.text(`${row.z > 0 ? '+' : ''}${row.z.toFixed(2)}`, colZ, b.y, { align: 'right' });
    b.y += 2;
    b.fill(C.gray100);
    b.doc.rect(b.ml, b.y, b.cw, 0.3, 'F');
    b.y += 6;
  });

  const hasBoneBreakdown = k.bone_mass_head_kg > 0 || k.bone_mass_body_kg > 0;
  if (hasBoneBreakdown) {
    const boneRows = [
      { name: '↳ Bone (head)', kg: k.bone_mass_head_kg, pct: k.bone_mass_head_pct, z: k.bone_mass_head_z_score },
      { name: '↳ Bone (body)', kg: k.bone_mass_body_kg, pct: k.bone_mass_body_pct, z: k.bone_mass_body_z_score },
    ];
    boneRows.forEach(row => {
      b.checkPage(8);
      b.fill(C.gray100);
      b.doc.rect(b.ml, b.y - 3, b.cw, 7, 'F');
      b.doc.setFont('helvetica', 'normal');
      b.doc.setFontSize(7.5);
      b.textColor(C.gray500);
      b.doc.text(row.name, b.ml + 10, b.y);
      b.doc.text(row.kg.toFixed(3), colKg, b.y, { align: 'right' });
      b.doc.text(`${row.pct.toFixed(2)}%`, colPct, b.y, { align: 'right' });
      b.doc.text(`${row.z > 0 ? '+' : ''}${row.z.toFixed(2)}`, colZ, b.y, { align: 'right' });
      b.y += 7;
    });
  }

  b.spacer(4);

  b.checkPage(24);
  b.fill(C.gray100);
  b.doc.rect(b.ml, b.y, b.cw, 22, 'F');
  b.doc.setFontSize(7.5);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray500);
  b.doc.text('STRUCTURED WEIGHT VS GROSS WEIGHT', b.ml + 4, b.y + 5);
  const sw3ColW = (b.cw - 8) / 3;
  const sw3Labels = ['Structured weight', 'Difference (Gross − Struct.)', 'Technical Error (%)'];
  const sw3Vals = [
    `${k.structured_weight_kg.toFixed(3)} kg`,
    `${k.structured_weight_diff_kg > 0 ? '+' : ''}${k.structured_weight_diff_kg.toFixed(3)} kg`,
    `${k.structured_weight_diff_pct > 0 ? '+' : ''}${k.structured_weight_diff_pct.toFixed(2)}%`,
  ];
  const sw3Colors = [
    C.gray900,
    Math.abs(k.structured_weight_diff_kg) <= 1 ? '#059669' : '#D97706',
    Math.abs(k.structured_weight_diff_pct) <= 2 ? '#059669' : '#D97706',
  ];
  sw3Labels.forEach((lbl, i) => {
    const cx = b.ml + 4 + i * sw3ColW;
    b.doc.setFontSize(7);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(C.gray500);
    b.doc.text(lbl, cx, b.y + 11);
    b.doc.setFontSize(10);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(sw3Colors[i]);
    b.doc.text(sw3Vals[i], cx, b.y + 19);
  });
  b.y += 26;

  b.spacer(4);

  b.checkPage(28);
  const sum6 = computeSum6Skinfolds(data);
  const metCards = [
    { label: 'Sum 6 Skinfolds', value: sum6 !== null ? `${sum6.toFixed(1)} mm` : '—', bg: '#FFFBEB', border: '#FCD34D', textC: '#92400E' },
    { label: 'Muscle/Bone Ratio', value: k.muscle_bone_ratio.toFixed(2), bg: '#ECFDF5', border: '#6EE7B7', textC: '#065F46' },
    { label: 'Ballast Index', value: `${k.ballast_index.toFixed(1)}%`, bg: '#EFF6FF', border: '#BFDBFE', textC: '#1E40AF' },
    { label: 'Adipose/Muscle Ratio', value: k.adipose_muscle_ratio.toFixed(2), bg: C.gray100, border: C.gray200, textC: C.gray700 },
  ];
  const mcW = (b.cw - 9) / 4;
  metCards.forEach((mc, i) => {
    const cx = b.ml + i * (mcW + 3);
    const [bgR, bgG, bgB] = hexToRgb(mc.bg);
    const [bdR, bdG, bdB] = hexToRgb(mc.border);
    b.doc.setFillColor(bgR, bgG, bgB);
    b.doc.setDrawColor(bdR, bdG, bdB);
    b.doc.setLineWidth(0.4);
    b.doc.roundedRect(cx, b.y, mcW, 22, 2, 2, 'FD');
    b.doc.setFontSize(7);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(mc.textC);
    b.doc.text(mc.label, cx + 3, b.y + 6);
    b.doc.setFontSize(11);
    b.doc.setFont('helvetica', 'bold');
    b.doc.text(mc.value, cx + 3, b.y + 16);
  });
  b.y += 26;

  b.spacer(4);
}

function renderAnthropometryTargets(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secAnthroTargets'));
  const k = data.kerrResults;
  const m = data.anthropometryMeasurement;
  if (!k) { b.paragraph(tr('noKerrData')); return; }

  b.doc.setFontSize(8.5);
  b.doc.setFont('helvetica', 'normal');
  b.textColor(C.gray500);
  b.doc.text('Current body composition values and Phantom-based reference targets.', b.ml, b.y);
  b.y += 8;

  const stature = m?.stature_cm ? Number(m.stature_cm) : null;

  const tblRows = [
    { label: 'Adipose Mass', current: `${k.adipose_mass_kg.toFixed(2)} kg (${k.adipose_mass_pct.toFixed(1)}%)`, z: k.adipose_mass_z_score, note: 'Lower is generally better for performance' },
    { label: 'Muscle Mass', current: `${k.muscle_mass_kg.toFixed(2)} kg (${k.muscle_mass_pct.toFixed(1)}%)`, z: k.muscle_mass_z_score, note: 'Higher is generally better for performance' },
    { label: 'Bone Mass', current: `${k.bone_mass_kg.toFixed(2)} kg (${k.bone_mass_pct.toFixed(1)}%)`, z: k.bone_mass_z_score, note: 'Within normal range is ideal' },
    { label: 'Residual Mass', current: `${k.residual_mass_kg.toFixed(2)} kg (${k.residual_mass_pct.toFixed(1)}%)`, z: k.residual_mass_z_score, note: 'Organ/visceral mass' },
    { label: 'Skin Mass', current: `${k.skin_mass_kg.toFixed(2)} kg (${k.skin_mass_pct.toFixed(1)}%)`, z: k.skin_mass_z_score, note: 'Skin tissue' },
  ];

  b.checkPage(12);
  b.fill(C.darkBg);
  b.doc.rect(b.ml, b.y, b.cw, 7, 'F');
  b.doc.setFontSize(7.5);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.white);
  b.doc.text('Compartment', b.ml + 3, b.y + 4.5);
  b.doc.text('Current Value', b.ml + 60, b.y + 4.5);
  b.doc.text('Z-score (Phantom)', b.ml + 110, b.y + 4.5);
  b.doc.text('Interpretation', b.ml + 148, b.y + 4.5);
  b.y += 9;

  tblRows.forEach((row, i) => {
    const rowH = 9;
    b.checkPage(rowH + 2);
    b.fill(i % 2 === 0 ? C.gray100 : C.white);
    b.doc.rect(b.ml, b.y, b.cw, rowH, 'F');
    b.doc.setFontSize(8);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.gray900);
    b.doc.text(row.label, b.ml + 3, b.y + 5.5);
    b.doc.setFont('helvetica', 'normal');
    b.doc.text(row.current, b.ml + 60, b.y + 5.5);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(row.z >= 0 ? '#059669' : '#DC2626');
    b.doc.text(`${row.z > 0 ? '+' : ''}${row.z.toFixed(2)}`, b.ml + 110, b.y + 5.5);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(C.gray500);
    b.doc.setFontSize(7);
    b.doc.text(row.note, b.ml + 148, b.y + 5.5);
    b.y += rowH;
  });

  if (stature) {
    b.spacer(6);
    b.checkPage(30);
    b.fill(C.gray100);
    b.doc.rect(b.ml, b.y, b.cw, 28, 'F');
    const adiposeDelta = 0;
    const muscleDelta = 0;
    b.doc.setFontSize(8.5);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.gray900);
    b.doc.text('Change Summary', b.ml + 4, b.y + 7);
    b.doc.setFont('helvetica', 'normal');
    b.doc.setFontSize(8);
    b.textColor(C.gray700);
    const sumLines = [
      `Adipose Mass: ${k.adipose_mass_kg.toFixed(2)} kg  |  Z: ${k.adipose_mass_z_score > 0 ? '+' : ''}${k.adipose_mass_z_score.toFixed(2)}  |  Sum 6 Skinfolds: ${computeSum6Skinfolds(data) !== null ? computeSum6Skinfolds(data)!.toFixed(1) + ' mm' : '—'}`,
      `Muscle Mass: ${k.muscle_mass_kg.toFixed(2)} kg  |  Z: ${k.muscle_mass_z_score > 0 ? '+' : ''}${k.muscle_mass_z_score.toFixed(2)}  |  Muscle/Bone Ratio: ${k.muscle_bone_ratio.toFixed(2)}`,
      `Net change (Adipose + Muscle): ${(adiposeDelta + muscleDelta).toFixed(2)} kg`,
    ];
    sumLines.forEach((line, j) => {
      b.doc.text(line, b.ml + 4, b.y + 14 + j * 5.5);
    });
    b.y += 32;
  }

  b.spacer(4);
}

function renderISAKDetails(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secISAK'));
  const m = data.anthropometryMeasurement;
  if (!m) { b.paragraph('No ISAK measurement data available.'); return; }

  const date = m.measurement_date ? new Date(m.measurement_date).toLocaleDateString() : '—';
  const tech = m.technician_name || '—';

  b.textColor(C.gray500);
  b.doc.setFontSize(8);
  b.doc.text(`Date: ${date}  ·  Technician: ${tech}`, b.ml, b.y);
  b.y += 7;

  type ISAKItem = { key: string; label: string; unit: string; isSimple?: boolean };

  const categories: Array<{ title: string; items: ISAKItem[] }> = [
    {
      title: 'Basic Measurements',
      items: [
        { key: 'body_mass_kg', label: 'Body Mass', unit: 'kg', isSimple: true },
        { key: 'stature_cm', label: 'Stature', unit: 'cm', isSimple: true },
        { key: 'sitting_height_cm', label: 'Sitting Height', unit: 'cm', isSimple: true },
      ]
    },
    {
      title: 'Skinfolds (mm)',
      items: [
        { key: 'triceps_sf_mm', label: 'Triceps', unit: 'mm' },
        { key: 'subscapular_sf_mm', label: 'Subscapular', unit: 'mm' },
        { key: 'biceps_sf_mm', label: 'Biceps', unit: 'mm' },
        { key: 'supraspinale_sf_mm', label: 'Supraspinale', unit: 'mm' },
        { key: 'abdominal_sf_mm', label: 'Abdominal', unit: 'mm' },
        { key: 'front_thigh_sf_mm', label: 'Front Thigh', unit: 'mm' },
        { key: 'medial_calf_sf_mm', label: 'Medial Calf', unit: 'mm' },
        { key: 'iliac_crest_sf_mm', label: 'Iliac Crest', unit: 'mm' },
      ]
    },
    {
      title: 'Girths (cm)',
      items: [
        { key: 'arm_flexed_girth_cm', label: 'Arm Flexed', unit: 'cm' },
        { key: 'chest_girth_cm', label: 'Chest', unit: 'cm' },
        { key: 'waist_girth_cm', label: 'Waist', unit: 'cm' },
        { key: 'thigh_upper_girth_cm', label: 'Thigh Upper', unit: 'cm' },
        { key: 'calf_max_girth_cm', label: 'Calf Max', unit: 'cm' },
        { key: 'gluteal_girth_cm', label: 'Gluteal', unit: 'cm' },
      ]
    },
    {
      title: 'Breadths (cm)',
      items: [
        { key: 'humerus_diameter_cm', label: 'Humerus Diameter', unit: 'cm' },
        { key: 'femur_diameter_cm', label: 'Femur Diameter', unit: 'cm' },
        { key: 'biacromial_breadth_cm', label: 'Biacromial Breadth', unit: 'cm' },
        { key: 'biiliocristal_breadth_cm', label: 'Biiliocristal Breadth', unit: 'cm' },
      ]
    },
  ];

  categories.forEach(cat => {
    const available = cat.items.filter(item =>
      item.isSimple ? m[item.key] != null : m[`${item.key}_median`] != null
    );
    if (available.length === 0) return;

    b.checkPage(12);
    b.label(cat.title);
    const cols = [{ label: 'MEASUREMENT', width: 70 }, { label: 'VALUE', width: 30 }, { label: 'UNIT', width: 25 }];
    b.tableHeader(cols);
    available.forEach((item, i) => {
      const raw = item.isSimple ? m[item.key] : m[`${item.key}_median`];
      const displayVal = raw != null ? Number(raw).toFixed(2) : '—';
      b.tableRow([{ value: item.label, width: 70 }, { value: displayVal, width: 30 }, { value: item.unit, width: 25 }], i % 2 === 0);
    });
    b.spacer(4);
  });
}

function renderHydration(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secHydration'));
  const sessions = data.hydrationSessions;
  if (!sessions?.length) { b.paragraph('No hydration session data available.'); return; }

  const latest = sessions[0];
  const items: Array<{ label: string; value: string; unit?: string }> = [];
  if (latest.sweat_rate_l_h != null) items.push({ label: 'Sweat Rate', value: latest.sweat_rate_l_h.toFixed(2), unit: 'L/h' });
  if (latest.percent_dehydration != null) items.push({ label: 'Dehydration', value: latest.percent_dehydration.toFixed(1), unit: '%' });
  if (latest.ambient_temp_c != null) items.push({ label: 'Ambient Temp', value: String(latest.ambient_temp_c), unit: '°C' });
  if (latest.usg_pre != null) items.push({ label: 'USG Pre', value: latest.usg_pre.toFixed(3) });
  if (latest.usg_post != null) items.push({ label: 'USG Post', value: latest.usg_post.toFixed(3) });
  if (latest.duration_min) items.push({ label: 'Duration', value: String(latest.duration_min), unit: 'min' });

  if (items.length > 0) b.metricGrid(items, 3);

  if (sessions.length > 1) {
    b.spacer(2);
    b.label(`All Sessions (${sessions.length} total)`);
    const cols = [
      { label: 'DATE', width: 35 },
      { label: 'SWEAT RATE (L/h)', width: 40 },
      { label: 'DEHYDRATION (%)', width: 40 },
      { label: 'TEMP (°C)', width: 30 },
      { label: 'DURATION (min)', width: 35 },
    ];
    b.tableHeader(cols);
    sessions.slice(0, 10).forEach((s, i) => {
      b.tableRow([
        { value: s.session_date ? new Date(s.session_date).toLocaleDateString() : '—', width: 35 },
        { value: s.sweat_rate_l_h != null ? s.sweat_rate_l_h.toFixed(2) : '—', width: 40 },
        { value: s.percent_dehydration != null ? s.percent_dehydration.toFixed(1) : '—', width: 40 },
        { value: s.ambient_temp_c != null ? String(s.ambient_temp_c) : '—', width: 30 },
        { value: s.duration_min ? String(s.duration_min) : '—', width: 35 },
      ], i % 2 === 0);
    });
  }
  b.spacer(4);
}

function renderRawData(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secRaw'));
  const pts = data.dataPoints;

  if (!pts?.length) {
    const r = data.physiologyResults;
    if (r?.stage_analysis && r.stage_analysis.length > 0) {
      const stages = r.stage_analysis;
      const hasPower = stages.some(s => s.power_watts);
      const hasVO2 = stages.some(s => s.vo2_ml_kg_min);
      const hasLactate = stages.some(s => s.lactate);

      const cols = [
        { label: 'STAGE', width: 16 },
        { label: 'HR (bpm)', width: 25 },
        ...(hasPower ? [{ label: 'POWER (W)', width: 28 }] : []),
        ...(hasVO2 ? [{ label: 'VO\u2082 (ml/kg/min)', width: 35 }] : []),
        ...(hasLactate ? [{ label: 'LACTATE (mmol/L)', width: 37 }] : []),
      ];
      b.tableHeader(cols);

      stages.forEach((s, i) => {
        const row: Array<{ value: string; width: number }> = [
          { value: String(s.stage_number || i + 1), width: 16 },
          { value: s.heart_rate ? String(Math.round(s.heart_rate)) : '—', width: 25 },
        ];
        if (hasPower) row.push({ value: s.power_watts != null ? String(Math.round(s.power_watts)) : '—', width: 28 });
        if (hasVO2) row.push({ value: s.vo2_ml_kg_min != null ? s.vo2_ml_kg_min.toFixed(1) : '—', width: 35 });
        if (hasLactate) row.push({ value: s.lactate != null ? s.lactate.toFixed(2) : '—', width: 37 });
        b.tableRow(row, i % 2 === 0);
      });
      b.spacer(4);
    } else {
      b.paragraph('No stage data available.');
    }
    return;
  }

  const hasPower = pts.some(p => p.power_watts);
  const hasVO2 = pts.some(p => p.vo2_ml_kg_min);
  const hasLactate = pts.some(p => p.lactate);

  const cols = [
    { label: 'STAGE', width: 16 },
    { label: 'DURATION', width: 24 },
    { label: 'HR (bpm)', width: 25 },
    ...(hasPower ? [{ label: 'POWER (W)', width: 28 }] : []),
    ...(hasVO2 ? [{ label: 'VO\u2082 (ml/kg/min)', width: 35 }] : []),
    ...(hasLactate ? [{ label: 'LACTATE (mmol/L)', width: 37 }] : []),
    { label: 'RPE', width: 15 },
  ];
  b.tableHeader(cols);

  pts.forEach((p, i) => {
    const dur = p.duration_seconds ? `${Math.floor(p.duration_seconds / 60)}:${String(p.duration_seconds % 60).padStart(2, '0')}` : '—';
    const row: Array<{ value: string; width: number }> = [
      { value: String(p.stage_number), width: 16 },
      { value: dur, width: 24 },
      { value: String(p.heart_rate), width: 25 },
    ];
    if (hasPower) row.push({ value: p.power_watts != null ? String(Math.round(p.power_watts)) : '—', width: 28 });
    if (hasVO2) row.push({ value: p.vo2_ml_kg_min != null ? p.vo2_ml_kg_min.toFixed(1) : '—', width: 35 });
    if (hasLactate) row.push({ value: p.lactate != null ? p.lactate.toFixed(2) : '—', width: 37 });
    row.push({ value: p.rpe != null ? String(p.rpe) : '—', width: 15 });
    b.tableRow(row, i % 2 === 0, p.vt1_marker ? C.z2 : p.vt2_marker ? C.z4 : undefined);
  });
  b.spacer(3);
  b.textColor(C.gray500);
  b.doc.setFontSize(7);
  b.doc.text('* Green markers = VT1, Orange markers = VT2', b.ml, b.y);
  b.y += 5;
  b.spacer(4);
}

async function renderRecommendations(b: PDFBuilder, data: ReportData, opts: ReportOptions) {
  b.sectionHeader(tr('secRec'));

  const noteBlocks: Array<{ label: string; html: string }> = [];

  const physiologyText = opts.physiologyNotes || opts.reportNotes || '';
  const anthropometryText = opts.anthropometryNotes || data.anthropometryMeasurement?.coach_notes || '';

  if (physiologyText.trim()) {
    noteBlocks.push({ label: 'Physiology Test Notes', html: physiologyText });
  }
  if (anthropometryText.trim() && anthropometryText.trim() !== physiologyText.trim()) {
    noteBlocks.push({ label: 'Anthropometry Notes', html: anthropometryText });
  }

  if (noteBlocks.length > 0) {
    b.checkPage(30);
    b.label('Professional Notes & Conclusions');
    b.spacer(2);

    for (const block of noteBlocks) {
      b.checkPage(20);
      b.textColor(C.gray500);
      b.doc.setFont('helvetica', 'bold');
      b.doc.setFontSize(7.5);
      b.doc.text(block.label.toUpperCase(), b.ml, b.y);
      b.y += 5;

      await renderHTMLToPDF(b, block.html);
      b.spacer(6);
    }
  }

  b.spacer(4);
}

async function renderHTMLToPDF(b: PDFBuilder, html: string) {
  // Build an off-screen container styled identically to the on-screen RichTextRenderer.
  // html2canvas will render it as a pixel-accurate image, preserving bold, italic,
  // underline, colors, alignment, lists, tables, images, and links exactly as seen.
  const container = document.createElement('div');
  container.className = 'rich-text-renderer';
  container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: ${Math.round((b.cw / 25.4) * 96)}px;
    background: #ffffff;
    color: #1f2937;
    font-family: 'Jost', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    padding: 0;
    box-sizing: border-box;
  `;
  container.innerHTML = html;
  document.body.appendChild(container);

  // Collect hyperlink positions relative to the container so we can overlay
  // clickable annotations on the PDF after embedding the canvas image.
  const linkRects: Array<{ x: number; y: number; w: number; h: number; href: string }> = [];
  const containerRect = container.getBoundingClientRect();
  container.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const rect = a.getBoundingClientRect();
    linkRects.push({
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      w: rect.width,
      h: rect.height,
      href,
    });
  });

  try {
    const html2canvas = await loadHtml2Canvas();
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pxToMm = 25.4 / 96;
    const imgWmm = canvas.width * pxToMm / 2;
    const imgHmm = canvas.height * pxToMm / 2;
    const maxW = b.cw;
    const maxH = b.pageBottom - b.y - 4;

    let w = imgWmm;
    let h = imgHmm;
    if (w > maxW) {
      h = (h * maxW) / w;
      w = maxW;
    }

    // If the content is taller than the remaining page space, split across pages.
    if (h <= maxH) {
      b.checkPage(h + 4);
      b.doc.addImage(imgData, 'PNG', b.ml, b.y, w, h, undefined, 'FAST');
      addLinkAnnotations(b, linkRects, imgWmm, imgHmm, w, h, 0);
      b.y += h + 4;
    } else {
      // Multi-page: slice the canvas vertically and place each slice on its own page.
      const sliceHmm = maxH;
      const slicePx = Math.floor((sliceHmm / h) * canvas.height);
      const numSlices = Math.ceil(canvas.height / slicePx);
      for (let i = 0; i < numSlices; i++) {
        const sliceCanvas = document.createElement('canvas');
        const startY = i * slicePx;
        const endY = Math.min(startY + slicePx, canvas.height);
        const sliceHpx = endY - startY;
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, startY, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
        }
        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHmm = (sliceHpx * pxToMm / 2) * (w / imgWmm);
        if (i > 0) {
          b.doc.addPage();
          b.pageNum++;
          b.y = 20;
          b.addPageFooter();
        }
        b.doc.addImage(sliceData, 'PNG', b.ml, b.y, w, sliceHmm, undefined, 'FAST');
        addLinkAnnotations(b, linkRects, imgWmm, imgHmm, w, h, i * sliceHmm);
        b.y += sliceHmm + 4;
      }
    }
  } catch {
    // Fallback: render as plain text if html2canvas fails
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const text = doc.body?.textContent || '';
    if (text.trim()) {
      b.textColor(C.gray900);
      b.doc.setFont('helvetica', 'normal');
      b.doc.setFontSize(9);
      const lines = b.doc.splitTextToSize(sanitizeForPDF(text), b.cw - 4);
      for (const line of lines) {
        b.checkPage(6);
        b.doc.text(line, b.ml + 2, b.y);
        b.y += 5;
      }
    }
  } finally {
    document.body.removeChild(container);
  }
}

// Overlay clickable link annotations on the PDF at the positions where <a> tags
// were rendered in the canvas image.
function addLinkAnnotations(
  b: PDFBuilder,
  linkRects: Array<{ x: number; y: number; w: number; h: number; href: string }>,
  sourceWmm: number,
  sourceHmm: number,
  renderedWmm: number,
  renderedHmm: number,
  offsetHmm: number,
) {
  const scaleX = renderedWmm / sourceWmm;
  const scaleY = renderedHmm / sourceHmm;
  const pxToMm = 25.4 / 96;
  for (const lr of linkRects) {
    const xMm = b.ml + lr.x * pxToMm * scaleX;
    const yMm = b.y + (lr.y * pxToMm * scaleY) - offsetHmm;
    const wMm = lr.w * pxToMm * scaleX;
    const hMm = lr.h * pxToMm * scaleY;
    if (yMm + hMm < b.y || yMm > b.y + renderedHmm) continue;
    try {
      b.doc.link(xMm, yMm, wMm, hMm, { url: lr.href });
    } catch {
      // skip invalid links
    }
  }
}

function renderAnthropometryComparison(b: PDFBuilder, data: ReportData) {
  b.sectionHeader(tr('secComparison'));
  const k = data.kerrResults;
  const m = data.anthropometryMeasurement;
  if (!k) { b.paragraph('No body composition data for comparison.'); return; }

  const sex = (m as any)?.sex || data.athlete.sex || 'male';
  const sport = data.athlete.sport || 'general';
  const isFemale = sex === 'female';

  const sportLabel = sport.charAt(0).toUpperCase() + sport.slice(1).replace('_', ' ');

  b.doc.setFontSize(8.5);
  b.doc.setFont('helvetica', 'normal');
  b.textColor(C.gray700);
  const introText = `Comparison against published reference values for ${isFemale ? 'female' : 'male'} ${sportLabel} athletes using the Kerr 5-component model (Phantom stratagem, Ross & Ward 1984).`;
  const introLines = b.doc.splitTextToSize(introText, b.cw);
  introLines.forEach((line: string) => { b.doc.text(line, b.ml, b.y); b.y += 5; });
  b.spacer(2);

  const muscleLow = isFemale ? 35 : 40;
  const muscleHigh = isFemale ? 47 : 52;
  const adiposeLow = isFemale ? 14 : 8;
  const adiposeHigh = isFemale ? 28 : 18;
  const boneLow = isFemale ? 12 : 13;
  const boneHigh = isFemale ? 16 : 18;

  const comps = [
    { label: 'Muscle Mass', value: k.muscle_mass_pct, unit: '%', kg: k.muscle_mass_kg, z: k.muscle_mass_z_score, ref_low: muscleLow, ref_high: muscleHigh, color: '#10B981', ref: 'Kerr et al. (1988)' },
    { label: 'Adipose Mass', value: k.adipose_mass_pct, unit: '%', kg: k.adipose_mass_kg, z: k.adipose_mass_z_score, ref_low: adiposeLow, ref_high: adiposeHigh, color: '#EF4444', ref: 'Ross & Ward (1984)' },
    { label: 'Bone Mass', value: k.bone_mass_pct, unit: '%', kg: k.bone_mass_kg, z: k.bone_mass_z_score, ref_low: boneLow, ref_high: boneHigh, color: '#3B82F6', ref: 'Martin et al. (1990)' },
    { label: 'Residual Mass', value: k.residual_mass_pct, unit: '%', kg: k.residual_mass_kg, z: k.residual_mass_z_score, ref_low: isFemale ? 9 : 10, ref_high: isFemale ? 12 : 13, color: '#6B7280', ref: 'Kerr et al. (1988)' },
    { label: 'Skin Mass', value: k.skin_mass_pct, unit: '%', kg: k.skin_mass_kg, z: k.skin_mass_z_score, ref_low: 4, ref_high: 8, color: '#F59E0B', ref: 'Kerr et al. (1988)' },
  ];

  comps.forEach(comp => {
    b.checkPage(22);
    const inRange = comp.value >= comp.ref_low && comp.value <= comp.ref_high;
    const statusColor = inRange ? '#059669' : '#DC2626';

    b.fill(C.gray100);
    b.doc.rect(b.ml, b.y, b.cw, 18, 'F');
    const [compR, compG, compB] = hexToRgb(comp.color);
    b.doc.setFillColor(compR, compG, compB);
    b.doc.rect(b.ml, b.y, 3, 18, 'F');

    b.doc.setFontSize(8.5);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.gray900);
    b.doc.text(comp.label, b.ml + 7, b.y + 5);

    b.doc.setFont('helvetica', 'normal');
    b.doc.setFontSize(7.5);
    b.textColor(C.gray500);
    b.doc.text(`Ref: ${comp.ref_low}–${comp.ref_high}%  (${comp.ref})`, b.ml + 7, b.y + 11);

    b.doc.setFont('helvetica', 'bold');
    b.doc.setFontSize(10);
    b.textColor(statusColor);
    b.doc.text(`${comp.value.toFixed(1)}%`, b.ml + 80, b.y + 6);
    b.doc.setFontSize(8);
    b.doc.text(`${comp.kg.toFixed(2)} kg`, b.ml + 80, b.y + 13);

    b.doc.setFontSize(8);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(statusColor);
    b.doc.text(`Z: ${comp.z > 0 ? '+' : ''}${comp.z.toFixed(2)}`, b.ml + 110, b.y + 6);
    b.doc.setFont('helvetica', 'normal');
    b.doc.setFontSize(7.5);
    b.textColor(statusColor);
    b.doc.text(inRange ? 'Within range' : (comp.value > comp.ref_high ? 'Above reference' : 'Below reference'), b.ml + 110, b.y + 13);

    const barW = 55;
    const barX = b.ml + b.cw - barW - 5;
    const barH = 5;
    const barY = b.y + 7;
    b.fill(C.gray200);
    b.doc.rect(barX, barY, barW, barH, 'F');
    const maxPct = comp.ref_high * 1.5;
    const refStartX = barX + (comp.ref_low / maxPct) * barW;
    const refW = Math.max(1, ((comp.ref_high - comp.ref_low) / maxPct) * barW);
    b.fill('#BBF7D0');
    b.doc.rect(refStartX, barY, refW, barH, 'F');
    const valueX = barX + Math.min(1, comp.value / maxPct) * barW;
    b.fill(statusColor);
    b.doc.rect(Math.max(barX, Math.min(barX + barW - 3, valueX - 1.5)), barY, 3, barH, 'F');

    b.y += 21;
  });

  b.spacer(4);
  b.checkPage(24);
  b.fill(C.gray100);
  b.doc.rect(b.ml, b.y, b.cw, 22, 'F');
  b.doc.setFontSize(7.5);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.gray700);
  b.doc.text('Scientific References', b.ml + 4, b.y + 5);
  const refs = [
    'Ross WD, Ward R (1984). Proportionality of Olympic Athletes. Med Sport Sci. 18:110-143.',
    'Kerr DA et al. (1988). 5-Component model of body composition. J Exp Biol. 44:119-124.',
    'Martin AD et al. (1990). Assessment of body fat using skinfold calipers. Hum Biol.',
  ];
  b.doc.setFont('helvetica', 'normal');
  b.doc.setFontSize(6.5);
  b.textColor(C.gray500);
  refs.forEach((ref, i) => {
    b.doc.text(ref, b.ml + 4, b.y + 11 + i * 4);
  });
  b.y += 26;

  b.spacer(4);
}

function renderTestContext(b: PDFBuilder, data: ReportData) {
  const p = data.preTestData;
  const test = data.test;

  b.sectionHeader('TEST CONDITIONS / CONDICIONES DEL TEST');

  const na = 'N/A';
  const fmt = (v: number | null | undefined, decimals = 1) =>
    v != null ? v.toFixed(decimals) : na;

  const rows: Array<{ label: string; value: string }> = [];

  // Date & time
  if (test?.test_date) {
    const dateStr = new Date(test.test_date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    rows.push({ label: 'Test Date / Fecha del Test', value: dateStr });
  } else {
    rows.push({ label: 'Test Date / Fecha del Test', value: na });
  }

  rows.push({
    label: 'Test Time / Hora del Test',
    value: p?.test_time ?? na,
  });

  rows.push({
    label: 'Location / Ubicación',
    value: p?.city ?? na,
  });

  rows.push({
    label: 'Altitude / Altitud',
    value: p?.elevation_m != null ? `${p.elevation_m} m.s.l. / m.s.n.m.` : na,
  });

  // Outdoor conditions
  rows.push({
    label: 'Outdoor Temperature / Temperatura Exterior',
    value: p?.outdoor_weather?.temperature_c != null
      ? `${fmt(p.outdoor_weather.temperature_c)} °C`
      : na,
  });

  rows.push({
    label: 'Outdoor Humidity / Humedad Exterior',
    value: p?.outdoor_weather?.humidity_percent != null
      ? `${p.outdoor_weather.humidity_percent} %`
      : na,
  });

  rows.push({
    label: 'Atmospheric Pressure / Presión Atmosférica',
    value: p?.outdoor_weather?.pressure_hpa != null
      ? `${fmt(p.outdoor_weather.pressure_hpa, 0)} hPa`
      : na,
  });

  rows.push({
    label: 'Wind Speed / Velocidad del Viento',
    value: p?.outdoor_weather?.wind_speed_kmh != null
      ? `${fmt(p.outdoor_weather.wind_speed_kmh)} km/h`
      : na,
  });

  rows.push({
    label: 'Weather Conditions / Condiciones Climáticas',
    value: p?.outdoor_weather?.description ?? na,
  });

  // Indoor conditions
  rows.push({
    label: 'Indoor Temperature / Temperatura Interior',
    value: p?.indoor_temp_c != null ? `${fmt(p.indoor_temp_c)} °C` : na,
  });

  rows.push({
    label: 'Indoor Humidity / Humedad Interior',
    value: p?.indoor_humidity_percent != null ? `${p.indoor_humidity_percent} %` : na,
  });

  if (p?.indoor_conditions_notes) {
    rows.push({
      label: 'Lab Notes / Notas del Laboratorio',
      value: p.indoor_conditions_notes,
    });
  }

  // Pre-test athlete state
  rows.push({
    label: 'Resting HR / FC en Reposo',
    value: p?.hr_rest != null ? `${p.hr_rest} bpm` : na,
  });

  rows.push({
    label: 'HRV',
    value: p?.hrv_ms != null ? `${p.hrv_ms} ms` : na,
  });

  rows.push({
    label: 'Basal Lactate / Lactato Basal',
    value: p?.basal_lactate != null ? `${fmt(p.basal_lactate)} mmol/L` : na,
  });

  rows.push({
    label: 'Urine Specific Gravity / Gravedad Urinaria',
    value: p?.usg != null ? fmt(p.usg, 3) : na,
  });

  // Render as two-column table
  const colLabel = b.cw * 0.52;

  // Table header row
  b.checkPage(10 + rows.length * 7);
  const [hr, hg, hb] = hexToRgb(C.dark);
  b.doc.setFillColor(hr, hg, hb);
  b.doc.rect(b.ml, b.y, b.cw, 7, 'F');
  b.doc.setFontSize(7);
  b.doc.setFont('helvetica', 'bold');
  b.doc.setTextColor(255, 255, 255);
  b.doc.text('PARAMETER / PARÁMETRO', b.ml + 3, b.y + 4.8);
  b.doc.text('VALUE / VALOR', b.ml + colLabel + 3, b.y + 4.8);
  b.y += 7;

  rows.forEach((row, i) => {
    const rowH = 7;
    b.checkPage(rowH + 4);
    if (i % 2 === 0) {
      const [br2, bg2, bb2] = hexToRgb(C.gray100);
      b.doc.setFillColor(br2, bg2, bb2);
    } else {
      b.doc.setFillColor(255, 255, 255);
    }
    b.doc.rect(b.ml, b.y, b.cw, rowH, 'F');

    // Divider line
    b.doc.setDrawColor(220, 220, 220);
    b.doc.setLineWidth(0.2);
    b.doc.line(b.ml, b.y + rowH, b.ml + b.cw, b.y + rowH);
    b.doc.line(b.ml + colLabel, b.y, b.ml + colLabel, b.y + rowH);

    b.doc.setFontSize(7.5);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.dark);
    b.doc.text(row.label, b.ml + 3, b.y + 4.8);

    b.doc.setFont('helvetica', 'normal');
    const isNA = row.value === na;
    b.textColor(isNA ? C.gray500 : C.dark);
    b.doc.text(row.value, b.ml + colLabel + 3, b.y + 4.8);

    b.y += rowH;
  });

  b.spacer(4);
}


function renderEnergySubstrate(b: PDFBuilder, data: ReportData) {
  b.sectionHeader('% ENERGY BY SUBSTRATE');
  const adv = data.advancedMetrics;
  if (!adv?.energyProfile.rer_vs_stage.some(v => v !== null)) {
    b.paragraph('No VO2 data available to calculate energy substrate profile. Provide VO2 measurements to enable this section.');
    return;
  }

  const dp = data.dataPoints || [];
  const sorted = [...dp].sort((a, b) => a.stage_number - b.stage_number);
  const ep = adv.energyProfile;

  b.paragraph('Estimated distribution of fat and carbohydrate as energy sources per stage, based on Respiratory Exchange Ratio (RER).');
  b.spacer(2);

  const cols = [
    { label: 'STAGE', width: 16 },
    { label: 'HR (bpm)', width: 22 },
    { label: 'VO2 (ml/kg/min)', width: 30 },
    { label: 'RER', width: 20 },
    { label: '% FAT', width: 24 },
    { label: '% CARB', width: 24 },
    { label: 'VISUAL', width: 44 },
  ];
  b.tableHeader(cols);

  sorted.forEach((point, i) => {
    const rer = ep.rer_vs_stage[i];
    const fatPct = ep.percent_fat_vs_stage[i];
    const carbPct = ep.percent_carb_vs_stage[i];
    if (rer == null) return;

    const row: Array<{ value: string; width: number }> = [
      { value: String(point.stage_number), width: 16 },
      { value: String(point.heart_rate), width: 22 },
      { value: point.vo2_ml_kg_min != null ? point.vo2_ml_kg_min.toFixed(1) : '\u2014', width: 30 },
      { value: rer.toFixed(3), width: 20 },
      { value: fatPct != null ? `${fatPct.toFixed(0)}%` : '\u2014', width: 24 },
      { value: carbPct != null ? `${carbPct.toFixed(0)}%` : '\u2014', width: 24 },
      { value: '', width: 44 },
    ];
    b.tableRow(row, i % 2 === 0);

    if (fatPct != null && carbPct != null) {
      const barX = b.ml + 16 + 22 + 30 + 20 + 24 + 24 + 2;
      const barW = 40;
      const barY = b.y - 5.5;
      const fatW = (fatPct / 100) * barW;
      const [fr, fg, fb] = hexToRgb('#10B981');
      b.doc.setFillColor(fr, fg, fb);
      b.doc.rect(barX, barY, fatW, 4, 'F');
      const [cr, cg, ccb] = hexToRgb('#F59E0B');
      b.doc.setFillColor(cr, cg, ccb);
      b.doc.rect(barX + fatW, barY, barW - fatW, 4, 'F');
    }
  });

  b.spacer(4);
  b.doc.setFontSize(7);
  b.doc.setFont('helvetica', 'normal');
  b.textColor(C.gray500);
  const [fr2, fg2, fb2] = hexToRgb('#10B981');
  b.doc.setFillColor(fr2, fg2, fb2);
  b.doc.rect(b.ml, b.y - 2, 8, 3, 'F');
  b.doc.text('Fat', b.ml + 10, b.y);
  const [cr2, cg2, cb2] = hexToRgb('#F59E0B');
  b.doc.setFillColor(cr2, cg2, cb2);
  b.doc.rect(b.ml + 28, b.y - 2, 8, 3, 'F');
  b.doc.text('Carbohydrate', b.ml + 38, b.y);
  b.y += 6;

  b.paragraph('RER 0.70 = 100% fat oxidation. RER 1.0 = 100% carbohydrate oxidation. Crossover at RER 0.85.');
  b.spacer(4);
}

function renderVO2Comparison(b: PDFBuilder, data: ReportData) {
  b.sectionHeader('VO2MAX & LACTATE COMPARISON');
  const r = data.physiologyResults;
  if (!r?.vo2max) { b.paragraph('No VO2max data available for comparison.'); return; }

  b.paragraph('Comparison of the athlete\'s key metrics against reference values from published research in sport science.');
  b.spacer(2);

  const vo2 = r.vo2max;
  b.label('VO2max Relative: ' + vo2.toFixed(1) + ' ml/kg/min');
  b.spacer(2);

  const benchmarks = [
    { label: 'Sedentary', min: 25, max: 35, color: '#6b7280' },
    { label: 'Recreational', min: 35, max: 50, color: '#3b82f6' },
    { label: 'Well-trained', min: 50, max: 60, color: '#10b981' },
    { label: 'Competitive', min: 60, max: 70, color: '#f59e0b' },
    { label: 'Elite / Pro', min: 70, max: 90, color: '#ef4444' },
  ];

  b.checkPage(40);
  const barY = b.y;
  const barX = b.ml + 30;
  const barW = b.cw - 30;
  const scaleMin = 20;
  const scaleMax = 90;

  benchmarks.forEach((bm, i) => {
    const y = barY + i * 8;
    const x1 = barX + ((bm.min - scaleMin) / (scaleMax - scaleMin)) * barW;
    const x2 = barX + ((bm.max - scaleMin) / (scaleMax - scaleMin)) * barW;
    const [cr, cg, cb] = hexToRgb(bm.color);
    b.doc.setFillColor(cr, cg, cb);
    b.doc.roundedRect(x1, y, x2 - x1, 6, 1, 1, 'F');
    b.doc.setFontSize(7);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(bm.color);
    b.doc.text(bm.label, b.ml, y + 4.5);
    b.textColor(C.gray500);
    b.doc.text(`${bm.min}-${bm.max}`, x2 + 2, y + 4.5);
  });

  const athleteX = barX + ((Math.min(Math.max(vo2, scaleMin), scaleMax) - scaleMin) / (scaleMax - scaleMin)) * barW;
  b.doc.setLineWidth(0.8);
  const [ar, ag, ab] = hexToRgb(C.yellow);
  b.doc.setDrawColor(ar, ag, ab);
  b.doc.line(athleteX, barY - 2, athleteX, barY + 5 * 8 + 2);
  b.doc.setFontSize(7);
  b.doc.setFont('helvetica', 'bold');
  b.textColor(C.yellow);
  b.doc.text(`${vo2.toFixed(1)}`, athleteX - 3, barY - 4);

  b.y = barY + 5 * 8 + 8;

  if (r.lt1_hr || r.lt2_hr) {
    b.spacer(4);
    b.label('Lactate Thresholds');
    b.spacer(2);

    const items: Array<{ label: string; value: string; unit?: string }> = [];
    if (r.lt1_hr) items.push({ label: 'LT1 Heart Rate', value: String(r.lt1_hr), unit: 'bpm' });
    if (r.lt2_hr) items.push({ label: 'LT2 Heart Rate', value: String(r.lt2_hr), unit: 'bpm' });
    if (r.lt1_hr && r.lt2_hr) {
      const gap = r.lt2_hr - r.lt1_hr;
      items.push({ label: 'LT1-LT2 Gap', value: String(gap), unit: 'bpm' });
    }
    if (r.lt1_percent_vo2max) items.push({ label: 'LT1 % VO2max', value: r.lt1_percent_vo2max.toFixed(0), unit: '%' });
    if (r.lt2_percent_vo2max) items.push({ label: 'LT2 % VO2max', value: r.lt2_percent_vo2max.toFixed(0), unit: '%' });
    b.metricGrid(items, 3);
  }

  b.spacer(4);
}

function renderCharts(b: PDFBuilder, data: ReportData, options: ReportOptions) {
  const charts = options.charts?.filter(c => c.enabled);
  if (!charts || charts.length === 0) return;

  const dp = data.dataPoints;
  if (!dp || dp.length === 0) return;

  const sorted = [...dp].sort((a, b2) => a.stage_number - b2.stage_number);
  const adv = data.advancedMetrics;

  b.sectionHeader('CHARTS');
  b.spacer(2);

  const chartW = b.cw;
  const chartH = 55;
  const axisOffset = 12;
  const plotW = chartW - axisOffset - 4;
  const plotH = chartH - 12;

  const SERIES_COLORS: Record<string, string> = {
    hr: '#ef4444',
    power: '#f97316',
    lactate: '#0d9488',
    vo2: '#3b82f6',
    rpe: '#10b981',
    fat_pct: '#10b981',
    carb_pct: '#f59e0b',
    rer: '#8b5cf6',
  };

  if (sorted.length < 2) return;

  for (const chart of charts) {
    b.checkPage(chartH + 20);

    b.doc.setFontSize(9);
    b.doc.setFont('helvetica', 'bold');
    b.textColor(C.dark);
    const def = CHART_DEFINITIONS.find(d => d.type === chart.type);
    b.doc.text(def?.label ?? chart.type, b.ml, b.y);
    b.y += 5;

    const plotX = b.ml + axisOffset;
    const plotY = b.y;

    const [bgr, bgg, bgb] = hexToRgb(C.gray100);
    b.doc.setFillColor(bgr, bgg, bgb);
    b.doc.roundedRect(plotX, plotY, plotW, plotH, 1, 1, 'F');

    b.doc.setDrawColor(200, 200, 200);
    b.doc.setLineWidth(0.2);
    for (let i = 1; i < 4; i++) {
      const gy = plotY + (plotH / 4) * i;
      b.doc.line(plotX, gy, plotX + plotW, gy);
    }
    for (let i = 1; i < sorted.length; i++) {
      const gx = plotX + (plotW / sorted.length) * i;
      b.doc.line(gx, plotY, gx, plotY + plotH);
    }

    const enabledSeries = Object.entries(chart.series)
      .filter(([, v]) => v)
      .map(([k]) => k as keyof ChartSeriesConfig);

    const seriesData: Record<string, (number | null)[]> = {};
    for (const key of enabledSeries) {
      seriesData[key] = sorted.map((p, i) => {
        switch (key) {
          case 'hr': return p.heart_rate;
          case 'power': return p.power_watts ?? null;
          case 'lactate': return p.lactate ?? null;
          case 'vo2': return p.vo2_ml_kg_min ?? null;
          case 'rpe': return p.rpe ?? null;
          case 'fat_pct': return adv?.energyProfile.percent_fat_vs_stage[i] ?? null;
          case 'carb_pct': return adv?.energyProfile.percent_carb_vs_stage[i] ?? null;
          case 'rer': return adv?.energyProfile.rer_vs_stage[i] ?? null;
          default: return null;
        }
      });
    }

    for (const key of enabledSeries) {
      const values = seriesData[key];
      if (!values) continue;
      const nums = values.filter((v): v is number => v != null);
      if (nums.length < 2) continue;

      const minV = Math.min(...nums);
      const maxV = Math.max(...nums);
      const range = maxV - minV || 1;

      const color = SERIES_COLORS[key] || '#6b7280';
      const [sr, sg, sb] = hexToRgb(color);
      b.doc.setDrawColor(sr, sg, sb);
      b.doc.setLineWidth(0.6);

      let prevX: number | null = null;
      let prevYp: number | null = null;

      for (let i = 0; i < values.length; i++) {
        if (values[i] == null) { prevX = null; prevYp = null; continue; }
        const val = values[i]!;
        const x = plotX + (i / (sorted.length - 1)) * plotW;
        const yp = plotY + plotH - ((val - minV) / range) * (plotH - 4) - 2;

        if (prevX != null && prevYp != null) {
          b.doc.line(prevX, prevYp, x, yp);
        }
        b.doc.setFillColor(sr, sg, sb);
        b.doc.circle(x, yp, 0.8, 'F');
        prevX = x;
        prevYp = yp;
      }

      b.doc.setFontSize(6);
      b.doc.setFont('helvetica', 'normal');
      b.textColor(color);
      b.doc.text(`${maxV.toFixed(1)}`, b.ml, plotY + 4);
      b.doc.text(`${minV.toFixed(1)}`, b.ml, plotY + plotH - 1);
    }

    b.doc.setFontSize(6);
    b.doc.setFont('helvetica', 'normal');
    b.textColor(C.gray500);
    for (let i = 0; i < sorted.length; i++) {
      const x = plotX + (i / (sorted.length - 1)) * plotW;
      b.doc.text(String(sorted[i].stage_number), x - 1, plotY + plotH + 4);
    }
    b.doc.text('Stage', plotX + plotW / 2 - 3, plotY + plotH + 8);

    const legendY = plotY + plotH + 10;
    let legendX = plotX;
    for (const key of enabledSeries) {
      const color = SERIES_COLORS[key] || '#6b7280';
      const [lr, lg, lb] = hexToRgb(color);
      b.doc.setFillColor(lr, lg, lb);
      b.doc.rect(legendX, legendY - 2, 6, 2.5, 'F');
      b.doc.setFontSize(6);
      b.doc.setFont('helvetica', 'normal');
      b.textColor(C.gray500);
      const label = def?.availableSeries.find(s => s.key === key)?.label ?? key;
      b.doc.text(label, legendX + 8, legendY);
      legendX += b.pdf.getTextWidth(label) + 14;
    }

    b.y = legendY + 8;
    b.spacer(4);
  }
}

type SectionRenderer = (b: PDFBuilder, data: ReportData, options: ReportOptions, logo: LogoInfo | null) => void | Promise<void>;

const SECTION_RENDERERS: Partial<Record<ReportSection, SectionRenderer>> = {
  cover: (b, data, opts, logo) => renderCover(b, data, opts, logo),
  executive_summary: (b, data) => renderExecutiveSummary(b, data),
  test_context: (b, data) => renderTestContext(b, data),
  vo2max: (b, data, opts) => renderVO2max(b, data, opts.style),
  thresholds: (b, data) => renderThresholds(b, data),
  fat_oxidation: (b, data) => renderFatOxidation(b, data),
  energy_substrate: (b, data) => renderEnergySubstrate(b, data),
  training_zones: (b, data, opts) => renderTrainingZones(b, data, opts),
  economy_metrics: (b, data) => renderEconomy(b, data),
  vo2_comparison: (b, data) => renderVO2Comparison(b, data),
  anthropometry: (b, data, opts) => renderAnthropometry(b, data, opts.style),
  anthropometry_results: (b, data) => renderAnthropometryResults(b, data),
  anthropometry_targets: (b, data) => renderAnthropometryTargets(b, data),
  isak_details: (b, data) => renderISAKDetails(b, data),
  anthropometry_comparison: (b, data) => renderAnthropometryComparison(b, data),
  hydration: (b, data) => renderHydration(b, data),
  raw_data: (b, data) => renderRawData(b, data),
  recommendations: (b, data, opts) => renderRecommendations(b, data, opts),
};

export async function generateReport(data: ReportData, options: ReportOptions): Promise<void> {
  const [logo, fonts] = await Promise.all([loadLogo(), loadFonts()]);
  const b = new PDFBuilder(options.branding, data.athlete.name);

  registerFonts(b.doc, fonts);
  b.hasKrona = !!fonts.kronaOne;
  b.hasJost = !!fonts.jostRegular;

  b.addPageFooter();

  const hasRecommendations = options.sections.includes('recommendations');

  for (const section of options.sections) {
    const renderer = SECTION_RENDERERS[section];
    if (renderer) {
      await renderer(b, data, options, logo);
    }
  }

  renderCharts(b, data, options);

  if (!hasRecommendations && (options.reportNotes?.trim() || options.physiologyNotes?.trim() || options.anthropometryNotes?.trim() || data.anthropometryMeasurement?.coach_notes)) {
    await renderRecommendations(b, data, options);
  }

  const date = data.test?.test_date
    ? new Date(data.test.test_date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const filename = `${data.athlete.name.replace(/\s+/g, '_')}_${date}_report.pdf`;
  b.doc.save(filename);
}
