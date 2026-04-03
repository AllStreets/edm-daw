import * as Tone from 'tone';
import type { Pattern, AutomationParameter } from '../types';
import type { DrumMachine } from './DrumMachine';

export type StepCallback = (step: number, time: number) => void;

export class Sequencer {
  currentStep: number = 0;
  private sequence: Tone.Sequence | null = null;

  start(
    pattern: Pattern,
    onStep: StepCallback,
    drumMachine?: DrumMachine,
    onEnd?: () => void
  ): void {
    this.stop();
    this.currentStep = 0;

    const totalSteps = pattern.steps;
    const steps = Array.from({ length: totalSteps }, (_, i) => i);

    this.sequence = new Tone.Sequence(
      (time: number, step: unknown) => {
        const s = step as number;
        this.currentStep = s;
        onStep(s, time);

        // Trigger drum voices if drum machine provided
        if (drumMachine) {
          pattern.stepData.forEach((row, drumIndex) => {
            const vel = row[s];
            if (vel) {
              // vel is 1-127; handle legacy coercion (boolean true = 1 → use default 100)
              const normVel = vel > 1 ? vel / 127 : 100 / 127;
              drumMachine.triggerDrum(drumIndex, time, normVel);
            }
          });
        }

        // Fire onEnd when we reach the last step
        if (onEnd && s === totalSteps - 1) {
          setTimeout(onEnd, 0);
        }
      },
      steps,
      '16n'
    );

    this.sequence.start(0);
  }

  startMelodic(
    pattern: Pattern,
    onStep: StepCallback,
    triggerNote: (note: number, velocity: number, time: number, duration: number) => void,
    onEnd?: () => void,
    applyAutomation?: (param: AutomationParameter, value: number, time: number) => void,
  ): void {
    this.stop();
    this.currentStep = 0;

    // Use the actual content length, not the default pattern.steps.
    // Round up to nearest 16 so the loop boundary is always bar-aligned.
    const maxStep = pattern.notes.reduce(
      (m, n) => Math.max(m, n.startStep + n.duration),
      pattern.steps
    );
    const loopLen = Math.ceil(maxStep / 16) * 16;

    const steps = Array.from({ length: loopLen }, (_, i) => i);

    this.sequence = new Tone.Sequence(
      (time: number, step: unknown) => {
        const s = step as number;
        this.currentStep = s;
        onStep(s, time);

        const notesAtStep = pattern.notes.filter(n => n.startStep === s);
        notesAtStep.forEach(note => {
          triggerNote(note.pitch, note.velocity, time, note.duration);
        });

        // Apply automation at this step
        if (applyAutomation && pattern.automation) {
          for (const lane of pattern.automation) {
            const point = lane.points.find(pt => pt.step === s);
            if (point !== undefined) {
              applyAutomation(lane.parameter, point.value, time);
            }
          }
        }

        // Fire onEnd when we reach the last step
        if (onEnd && s === loopLen - 1) {
          setTimeout(onEnd, 0);
        }
      },
      steps,
      '16n'
    );

    this.sequence.start(0);
  }

  stop(): void {
    if (this.sequence) {
      this.sequence.stop();
      this.sequence.dispose();
      this.sequence = null;
    }
    this.currentStep = 0;
  }

  getStep(): number {
    return this.currentStep;
  }

  dispose(): void {
    this.stop();
  }
}
