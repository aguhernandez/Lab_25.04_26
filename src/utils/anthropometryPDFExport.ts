import jsPDF from 'jspdf';
import type { AnthropometryMeasurement, KerrResults } from '../types/anthropometry.types';

export type PDFExportLanguage = 'en' | 'es' | 'bilingual';

export interface PDFExportOptions {
  language: PDFExportLanguage;
  includeCharts?: boolean;
  includeComparison?: boolean;
  includeSomatotype?: boolean;
  athleteName?: string;
  organizationName?: string;
  technicianName?: string;
}

export function generateAnthropometryPDF(
  measurement: AnthropometryMeasurement,
  kerrResults: KerrResults | null,
  options: PDFExportOptions
): jsPDF {
  const pdf = new jsPDF();
  const { language, athleteName, organizationName, technicianName } = options;

  let yPos = 20;

  const isEn = language === 'en' || language === 'bilingual';

  if (organizationName) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(organizationName, 105, yPos, { align: 'center' });
    yPos += 10;
  }

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  const title = isEn ? 'Anthropometry Report' : 'Reporte de Antropometría';
  pdf.text(title, 105, yPos, { align: 'center' });
  yPos += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  if (athleteName) {
    const athleteLabel = isEn ? 'Athlete' : 'Atleta';
    pdf.text(`${athleteLabel}: ${athleteName}`, 20, yPos);
    yPos += 7;
  }

  const dateLabel = isEn ? 'Date' : 'Fecha';
  const measurementDate = new Date(measurement.measurement_date).toLocaleDateString();
  pdf.text(`${dateLabel}: ${measurementDate}`, 20, yPos);
  yPos += 7;

  if (technicianName || measurement.technician_name) {
    const techLabel = isEn ? 'Technician' : 'Técnico';
    pdf.text(`${techLabel}: ${technicianName || measurement.technician_name}`, 20, yPos);
    yPos += 7;
  }

  yPos += 5;
  pdf.setDrawColor(0);
  pdf.line(20, yPos, 190, yPos);
  yPos += 10;

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  const basicLabel = isEn ? 'Basic Measurements' : 'Mediciones Básicas';
  pdf.text(basicLabel, 20, yPos);
  yPos += 7;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');

  const bodyMassLabel = isEn ? 'Body Mass' : 'Masa Corporal';
  const statureLabel = isEn ? 'Stature' : 'Estatura';

  if (measurement.body_mass_kg_median) {
    pdf.text(`${bodyMassLabel}: ${measurement.body_mass_kg_median.toFixed(2)} kg`, 20, yPos);
    yPos += 7;
  }

  if (measurement.stature_cm_median) {
    pdf.text(`${statureLabel}: ${measurement.stature_cm_median.toFixed(2)} cm`, 20, yPos);
    yPos += 7;
  }

  if (kerrResults) {
    yPos += 5;
    pdf.line(20, yPos, 190, yPos);
    yPos += 10;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    const kerrLabel = isEn ? 'Kerr 5-Component Body Composition' : 'Composición Corporal Kerr 5-Componentes';
    pdf.text(kerrLabel, 20, yPos);
    yPos += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    const components = [
      { label: isEn ? 'Skin Mass' : 'Masa de Piel', kg: kerrResults.skin_mass_kg, pct: kerrResults.skin_mass_pct },
      { label: isEn ? 'Adipose Mass' : 'Masa Adiposa', kg: kerrResults.adipose_mass_kg, pct: kerrResults.adipose_mass_pct },
      { label: isEn ? 'Muscle Mass' : 'Masa Muscular', kg: kerrResults.muscle_mass_kg, pct: kerrResults.muscle_mass_pct },
      { label: isEn ? 'Residual Mass' : 'Masa Residual', kg: kerrResults.residual_mass_kg, pct: kerrResults.residual_mass_pct },
      { label: isEn ? 'Bone Mass' : 'Masa Ósea', kg: kerrResults.bone_mass_kg, pct: kerrResults.bone_mass_pct },
    ];

    for (const comp of components) {
      pdf.text(`${comp.label}: ${comp.kg.toFixed(2)} kg (${comp.pct.toFixed(1)}%)`, 20, yPos);
      yPos += 7;
    }

    yPos += 5;
    pdf.setFont('helvetica', 'bold');
    const indicesLabel = isEn ? 'Derived Indices' : 'Índices Derivados';
    pdf.text(indicesLabel, 20, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`BMI: ${kerrResults.bmi.toFixed(2)}`, 20, yPos);
    yPos += 7;

    const muscleLabel = isEn ? 'Muscle/Bone Ratio' : 'Ratio Músculo/Hueso';
    pdf.text(`${muscleLabel}: ${kerrResults.muscle_bone_ratio.toFixed(2)}`, 20, yPos);
    yPos += 7;

    const ballastLabel = isEn ? 'Ballast Index' : 'Índice de Lastre';
    pdf.text(`${ballastLabel}: ${kerrResults.ballast_index.toFixed(2)}%`, 20, yPos);
    yPos += 7;

    if (options.includeSomatotype) {
      yPos += 5;
      pdf.setFont('helvetica', 'bold');
      const somatoLabel = isEn ? 'Somatotype' : 'Somatotipo';
      pdf.text(somatoLabel, 20, yPos);
      yPos += 7;

      pdf.setFont('helvetica', 'normal');
      const endo = kerrResults.somatotype_endomorphy.toFixed(1);
      const meso = kerrResults.somatotype_mesomorphy.toFixed(1);
      const ecto = kerrResults.somatotype_ectomorphy.toFixed(1);
      pdf.text(`${endo} - ${meso} - ${ecto}`, 20, yPos);
      yPos += 7;
    }
  }

  if (yPos > 250) {
    pdf.addPage();
    yPos = 20;
  }

  yPos += 10;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'italic');
  const footerText = isEn
    ? 'Generated by Asciende Metabolic Lab - ISAK Level 2 Protocol'
    : 'Generado por Asciende Metabolic Lab - Protocolo ISAK Nivel 2';
  pdf.text(footerText, 105, 280, { align: 'center' });

  return pdf;
}

export function downloadPDF(pdf: jsPDF, filename: string): void {
  pdf.save(filename);
}
