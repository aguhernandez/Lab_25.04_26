import { expect, it } from 'vitest';
import { protocolAdvice } from './protocolAssistant';
import type { ProtocolStep, TimelineSample } from '../types/timeline.types';
const steps: ProtocolStep[] = [{ step: 1, label: 'A', speed_pace: '5:00', target_duration_s: 180, lactate_at_s: 165 }];
const sample = { timestamp_s: 160, lactate: 2 } as TimelineSample;
it('warns about missing calibration', () => expect(protocolAdvice(steps, [], 0, false, false).map(x => x.code)).toContain('calibration'));
it('does not ask for a sample before its scheduled time', () => expect(protocolAdvice(steps, [], 160, true, true).map(x => x.code)).not.toContain('pending_0'));
it('asks for a scheduled sample when absent and clears it after recording', () => {
  expect(protocolAdvice(steps, [], 170, true, true).map(x => x.code)).toContain('pending_0');
  expect(protocolAdvice(steps, [sample], 170, true, true).map(x => x.code)).not.toContain('pending_0');
  const second = { ...steps[0], step: 2, label: 'B' };
  expect(protocolAdvice([steps[0], second], [{ ...sample, timestamp_s: 180 }], 350, true, true).map(x => x.code)).toContain('pending_1');
});
it('warns when a configured stage is short', () => expect(protocolAdvice([{ ...steps[0], target_duration_s: 90 }], [], 0, true, true).map(x => x.code)).toContain('short_0'));
it('suggests more data after finishing with insufficient samples', () => expect(protocolAdvice(steps, [sample], 180, true, true).map(x => x.code)).toContain('additional'));
