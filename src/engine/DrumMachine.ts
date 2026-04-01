import * as Tone from 'tone';

export const DRUM_NAMES = [
  'Kick',
  'Snare',
  'Clap',
  'HiHat Closed',
  'HiHat Open',
  'Tom',
  'Rim',
  'Cymbal',
] as const;

export type DrumName = typeof DRUM_NAMES[number];

interface DrumVoice {
  synth: Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth;
  gain: Tone.Gain;
  note: string;
  duration: string;
}

export class DrumMachine {
  private voices: Map<number, DrumVoice> = new Map();

  createDrumVoices(destination: Tone.ToneAudioNode): void {
    this.disposeVoices();

    // 0: Kick - MembraneSynth
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 10,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 },
    });
    this.addVoice(0, kick, new Tone.Gain(1.0), 'C1', '8n', destination);

    // 1: Snare - NoiseSynth
    const snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    });
    this.addVoice(1, snare, new Tone.Gain(0.8), 'C1', '16n', destination);

    // 2: Clap - NoiseSynth
    const clap = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.05 },
    });
    this.addVoice(2, clap, new Tone.Gain(0.7), 'C1', '32n', destination);

    // 3: HiHat Closed - MetalSynth
    const hhClosed = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    });
    hhClosed.frequency.value = 400;
    this.addVoice(3, hhClosed, new Tone.Gain(0.5), 'C1', '32n', destination);

    // 4: HiHat Open - MetalSynth
    const hhOpen = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    });
    hhOpen.frequency.value = 400;
    this.addVoice(4, hhOpen, new Tone.Gain(0.45), 'C1', '8n', destination);

    // 5: Tom - MembraneSynth
    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.06,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
    });
    this.addVoice(5, tom, new Tone.Gain(0.85), 'G1', '8n', destination);

    // 6: Rim - MetalSynth
    const rim = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.08, release: 0.02 },
      harmonicity: 8,
      modulationIndex: 16,
      resonance: 5000,
      octaves: 2,
    });
    rim.frequency.value = 800;
    this.addVoice(6, rim, new Tone.Gain(0.4), 'C1', '32n', destination);

    // 7: Cymbal - MetalSynth
    const cymbal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.8, release: 0.2 },
      harmonicity: 8.2,
      modulationIndex: 64,
      resonance: 3000,
      octaves: 2,
    });
    cymbal.frequency.value = 300;
    this.addVoice(7, cymbal, new Tone.Gain(0.35), 'C1', '4n', destination);
  }

  private addVoice(
    index: number,
    synth: Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth,
    gain: Tone.Gain,
    note: string,
    duration: string,
    destination: Tone.ToneAudioNode
  ): void {
    synth.connect(gain);
    gain.connect(destination);
    this.voices.set(index, { synth, gain, note, duration });
  }

  triggerDrum(drumIndex: number, time: number, velocity = 0.8): void {
    const voice = this.voices.get(drumIndex);
    if (!voice) return;

    const gainVal = Math.max(0.01, Math.min(1, velocity));
    voice.gain.gain.setValueAtTime(gainVal, time);

    const synth = voice.synth;
    if (synth instanceof Tone.MembraneSynth) {
      synth.triggerAttackRelease(voice.note, voice.duration, time);
    } else if (synth instanceof Tone.MetalSynth) {
      synth.triggerAttackRelease(voice.duration, time);
    } else if (synth instanceof Tone.NoiseSynth) {
      synth.triggerAttackRelease(voice.duration, time);
    }
  }

  triggerDrumByName(name: DrumName, time: number, velocity = 0.8): void {
    const index = DRUM_NAMES.indexOf(name);
    if (index >= 0) this.triggerDrum(index, time, velocity);
  }

  setDrumVolume(drumIndex: number, volume: number): void {
    const voice = this.voices.get(drumIndex);
    if (voice) {
      voice.gain.gain.rampTo(volume, 0.05);
    }
  }

  private disposeVoices(): void {
    this.voices.forEach((voice) => {
      voice.synth.dispose();
      voice.gain.dispose();
    });
    this.voices.clear();
  }

  dispose(): void {
    this.disposeVoices();
  }
}
