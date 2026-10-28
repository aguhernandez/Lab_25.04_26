import type { ProtocolStep, TimelineSample } from '../types/timeline.types';

export interface ProtocolAdvice { code: string; message: string }
/** Advisory only: do not infer sample completion from unmeasured placeholders. */
export function protocolAdvice(steps: ProtocolStep[], samples: TimelineSample[], elapsed: number, active: boolean, calibrationRecorded: boolean): ProtocolAdvice[] {
  const advice: ProtocolAdvice[] = [];
  if (!calibrationRecorded) advice.push({ code: 'calibration', message: 'No hay calibración registrada. Verifica y registra la calibración del dispositivo utilizado.' });
  if (!active || !steps.length) return advice;
  let start = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i], duration = step.target_duration_s;
    if (!Number.isFinite(duration) || duration <= 0) { advice.push({ code: 'invalid_duration', message: `Revisa la duración del estadio ${i + 1}.` }); continue; }
    const end = start + duration;
    if (duration < 120) advice.push({ code: `short_${i}`, message: `Estadio ${i + 1}: menos de 2 minutos; revisa si esa duración es adecuada para el objetivo y protocolo elegido.` });
    const sampleAt = step.lactate_at_s;
    if (sampleAt != null && sampleAt >= 0 && sampleAt <= duration && elapsed >= start + sampleAt) {
      const measured = samples.some(s => s.lactate != null && Number.isFinite(s.lactate) && s.lactate > 0 && (i === 0 ? s.timestamp_s >= start : s.timestamp_s > start) && s.timestamp_s <= end);
      if (!measured) advice.push({ code: `pending_${i}`, message: `Estadio ${i + 1} (${step.label}): muestra de lactato pendiente o aún no registrada.` });
    }
    start = end;
  }
  if (elapsed >= start && samples.filter(s => s.lactate != null && Number.isFinite(s.lactate) && s.lactate > 0).length < 4) advice.push({ code: 'additional', message: 'Hay menos de 4 muestras de lactato: revisa los registros o considera una prueba adicional antes de estimar umbrales.' });
  return advice;
}
