import * as Tone from 'tone';
import type { Pattern } from '../types';
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
            if (row[s]) {
              drumMachine.triggerDrum(drumIndex, time, 0.85);
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
    onEnd?: () => void
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
