import type { ProtocolStep, TimelineSample } from '../types/timeline.types';

export interface ProtocolAdvice { code: string; message: string }
/** Advisory only: do not infer sample completion from unmeasured placeholders. */
export function protocolAdvice(steps: ProtocolStep[], samples: TimelineSample[], elapsed: number, active: boolean, calibrationRecorded: boolean): ProtocolAdvice[] {
  const advice: ProtocolAdvice[] = [];
  if (!calibrationRecorded) advice.push({ code: 'calibration', message: 'No hay calibración registrada. Verifica y registra la calibración del dispositivo utilizado.' });
  if (!active || !steps.length) return advice;
  if (!Number.isFinite(elapsed) || elapsed < 0) return advice;
  const measuredSamples = samples.filter(s => Number.isFinite(s.timestamp_s) && s.timestamp_s >= 0 && s.timestamp_s <= elapsed && s.lactate != null && Number.isFinite(s.lactate) && s.lactate > 0);
  let completedSampleStages = 0;
  let start = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], duration = step.target_duration_s;
    if (!Number.isFinite(duration) || duration <= 0) { advice.push({ code: 'invalid_duration', message: `Revisa la duración del estadio ${i + 1}.` }); continue; }
    const end = start + duration;
    if (duration < 120) advice.push({ code: `short_${i}`, message: `Estadio ${i + 1}: menos de 2 minutos; revisa si esa duración es adecuada para el objetivo y protocolo elegido.` });
    const sampleAt = step.lactate_at_s;
    if (sampleAt != null && sampleAt >= 0 && sampleAt <= duration && elapsed >= start + sampleAt) {
      const measured = measuredSamples.some(s => (i === 0 ? s.timestamp_s >= start : s.timestamp_s > start) && s.timestamp_s >= start + sampleAt - 30 && s.timestamp_s <= end);
      if (measured) completedSampleStages += 1;
      if (!measured) advice.push({ code: `pending_${i}`, message: `Estadio ${i + 1} (${step.label}): muestra de lactato pendiente o aún no registrada.` });
    }
    start = end;
  }
  if (elapsed >= start && steps.some(s => s.lactate_at_s != null) && completedSampleStages < 4) advice.push({ code: 'additional', message: 'Hay menos de 4 estadios con muestra de lactato válida cerca del momento previsto (tolerancia anticipada: 30 s): revisa los registros o considera una prueba adicional antes de estimar umbrales.' });
  return advice;
}
