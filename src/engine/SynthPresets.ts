import { defaultSynthSettings } from '../types';
import type { SynthSettings } from '../types';

function preset(name: string, overrides: (s: SynthSettings) => void): SynthSettings {
  const s = defaultSynthSettings();
  s.preset = name;
  overrides(s);
  return s;
}

export const SYNTH_PRESETS: Record<string, SynthSettings> = {

  // ── Leads ──────────────────────────────────────────────────────────────────

  'Supersaw': preset('Supersaw', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 4000;
    s.filter.resonance = 0.3;
    s.effects.chorus = { on: true, wet: 0.6, rate: 2, depth: 0.4, delay: 3.5 };
    s.ampEnv = { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.4 };
  }),

  'Acid Lead': preset('Acid Lead', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 800;
    s.filter.resonance = 0.8;
    s.lfo = { shape: 'sine', rate: 4, amount: 0.6, target: 'filter', on: true, sync: false };
    s.ampEnv = { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.2 };
  }),

  'FM Bell': preset('FM Bell', s => {
    s.oscillator1.type = 'sine';
    s.filter.cutoff = 6000;
    s.ampEnv = { attack: 0.001, decay: 0.8, sustain: 0.2, release: 1.2 };
    s.effects.reverb = { on: true, wet: 0.5, decay: 3, preDelay: 0.01 };
  }),

  'Reese Screech': preset('Reese Screech', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 2000;
    s.filter.resonance = 0.5;
    s.effects.distortion = { on: true, wet: 0.7, amount: 0.5, type: 'hard' };
    s.effects.chorus = { on: true, wet: 0.4, rate: 1.5, depth: 0.5, delay: 3.5 };
    s.ampEnv = { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.3 };
  }),

  'Pluck': preset('Pluck', s => {
    s.oscillator1.type = 'triangle';
    s.filter.cutoff = 5000;
    s.ampEnv = { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 };
    s.effects.reverb = { on: true, wet: 0.3, decay: 1.5, preDelay: 0.01 };
  }),

  'Distorted Square': preset('Distorted Square', s => {
    s.oscillator1.type = 'square';
    s.filter.cutoff = 3000;
    s.effects.distortion = { on: true, wet: 0.8, amount: 0.6, type: 'hard' };
    s.ampEnv = { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.2 };
  }),

  // ── Basses ─────────────────────────────────────────────────────────────────

  'Reese Bass': preset('Reese Bass', s => {
    s.oscillator1.type = 'sawtooth';
    s.oscillator1.octave = -1;
    s.filter.cutoff = 400;
    s.filter.resonance = 0.3;
    s.effects.chorus = { on: true, wet: 0.5, rate: 1, depth: 0.6, delay: 3.5 };
    s.ampEnv = { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 };
  }),

  'FM Bass': preset('FM Bass', s => {
    s.oscillator1.type = 'sine';
    s.oscillator1.octave = -1;
    s.filter.cutoff = 500;
    s.filter.resonance = 0.2;
    s.ampEnv = { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.3 };
  }),

  'Distorted Bass': preset('Distorted Bass', s => {
    s.oscillator1.type = 'square';
    s.oscillator1.octave = -1;
    s.filter.cutoff = 800;
    s.effects.distortion = { on: true, wet: 0.8, amount: 0.5, type: 'hard' };
    s.ampEnv = { attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.2 };
  }),

  'Sub Bass': preset('Sub Bass', s => {
    s.oscillator1.type = 'sine';
    s.oscillator1.octave = -2;
    s.filter.cutoff = 200;
    s.filter.resonance = 0.1;
    s.ampEnv = { attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.4 };
  }),

  'Wobble Bass': preset('Wobble Bass', s => {
    s.oscillator1.type = 'sawtooth';
    s.oscillator1.octave = -1;
    s.filter.cutoff = 600;
    s.filter.resonance = 0.6;
    s.lfo = { shape: 'sine', rate: 4, amount: 0.7, target: 'filter', on: true, sync: false };
    s.ampEnv = { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3 };
  }),

  'Portamento Bass': preset('Portamento Bass', s => {
    s.oscillator1.type = 'sawtooth';
    s.oscillator1.octave = -1;
    s.filter.cutoff = 600;
    s.ampEnv = { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.4 };
  }),

  // ── Pads ───────────────────────────────────────────────────────────────────

  'Choir Pad': preset('Choir Pad', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 2000;
    s.filter.resonance = 0.15;
    s.ampEnv = { attack: 0.4, decay: 0.3, sustain: 0.85, release: 2.0 };
    s.effects.reverb = { on: true, wet: 0.6, decay: 4, preDelay: 0.01 };
    s.effects.chorus = { on: true, wet: 0.7, rate: 0.8, depth: 0.5, delay: 3.5 };
  }),

  'Lush Pad': preset('Lush Pad', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 3000;
    s.ampEnv = { attack: 0.5, decay: 0.4, sustain: 0.8, release: 3.0 };
    s.effects.reverb = { on: true, wet: 0.7, decay: 5, preDelay: 0.01 };
    s.effects.chorus = { on: true, wet: 0.6, rate: 0.5, depth: 0.4, delay: 3.5 };
  }),

  'Dark Pad': preset('Dark Pad', s => {
    s.oscillator1.type = 'sine';
    s.filter.cutoff = 800;
    s.filter.resonance = 0.4;
    s.ampEnv = { attack: 0.6, decay: 0.5, sustain: 0.7, release: 4.0 };
    s.effects.reverb = { on: true, wet: 0.5, decay: 6, preDelay: 0.01 };
  }),

  'String Pad': preset('String Pad', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 4000;
    s.ampEnv = { attack: 0.2, decay: 0.3, sustain: 0.75, release: 1.5 };
    s.effects.reverb = { on: true, wet: 0.4, decay: 3, preDelay: 0.01 };
    s.lfo = { shape: 'sine', rate: 5, amount: 0.15, target: 'volume', on: true, sync: false };
  }),

  // ── FX / Vocals ────────────────────────────────────────────────────────────

  'Vocal Chop': preset('Vocal Chop', s => {
    s.oscillator1.type = 'sine';
    s.filter.cutoff = 800;
    s.filter.resonance = 0.7;
    s.filter.type = 'bandpass';
    s.ampEnv = { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 };
    s.effects.reverb = { on: true, wet: 0.3, decay: 1, preDelay: 0.01 };
  }),

  'Riser Synth': preset('Riser Synth', s => {
    s.oscillator1.type = 'sawtooth';
    s.filter.cutoff = 200;
    s.filter.resonance = 0.3;
    s.lfo = { shape: 'sawtooth', rate: 0.125, amount: 0.9, target: 'filter', on: true, sync: false };
    s.ampEnv = { attack: 0.5, decay: 0.1, sustain: 0.9, release: 0.5 };
    s.effects.reverb = { on: true, wet: 0.4, decay: 3, preDelay: 0.01 };
  }),

  'Drop Bass': preset('Drop Bass', s => {
    s.oscillator1.type = 'sine';
    s.oscillator1.octave = -2;
    s.filter.cutoff = 200;
    s.ampEnv = { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 };
    s.oscillator1.volume = 1.0;
  }),

  'Impact Hit': preset('Impact Hit', s => {
    s.oscillator1.type = 'sine';
    s.oscillator1.octave = -2;
    s.filter.cutoff = 300;
    s.ampEnv = { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 };
    s.effects.distortion = { on: true, wet: 0.6, amount: 0.4, type: 'hard' };
    s.oscillator1.volume = 1.0;
  }),
};

export type PresetName = keyof typeof SYNTH_PRESETS;

export const PRESET_CATEGORIES: Record<string, PresetName[]> = {
  Leads:  ['Supersaw', 'Acid Lead', 'FM Bell', 'Reese Screech', 'Pluck', 'Distorted Square'],
  Basses: ['Reese Bass', 'FM Bass', 'Distorted Bass', 'Sub Bass', 'Wobble Bass', 'Portamento Bass'],
  Pads:   ['Choir Pad', 'Lush Pad', 'Dark Pad', 'String Pad'],
  FX:     ['Vocal Chop', 'Riser Synth', 'Drop Bass', 'Impact Hit'],
};
