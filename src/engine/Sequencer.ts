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
    drumMachine?: DrumMachine
  ): void {
    this.stop();
    this.currentStep = 0;

    const steps = Array.from({ length: pattern.steps }, (_, i) => i);

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
      },
      steps,
      '16n'
    );

    this.sequence.start(0);
  }

  startMelodic(
    pattern: Pattern,
    onStep: StepCallback,
    triggerNote: (note: number, velocity: number, time: number) => void
  ): void {
    this.stop();
    this.currentStep = 0;

    const steps = Array.from({ length: pattern.steps }, (_, i) => i);

    this.sequence = new Tone.Sequence(
      (time: number, step: unknown) => {
        const s = step as number;
        this.currentStep = s;
        onStep(s, time);

        // Find notes that start at this step
        const notesAtStep = pattern.notes.filter(n => n.startStep === s);
        notesAtStep.forEach(note => {
          triggerNote(note.pitch, note.velocity, time);
        });
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
