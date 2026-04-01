import type { SynthSettings } from '../types';
import {
  defaultOscSettings,
  defaultSubOscSettings,
  defaultFilterSettings,
  defaultEnvelopeSettings,
  defaultLFOSettings,
  defaultUnisonSettings,
  defaultSynthFX,
} from '../types';

// =====================================================
// Synth Presets
// =====================================================

export const SYNTH_PRESETS: Record<string, SynthSettings> = {
  'Init': {
    oscillator1: defaultOscSettings(),
    oscillator2: defaultOscSettings({ on: false }),
    sub: defaultSubOscSettings(),
    filter: defaultFilterSettings(),
    ampEnv: defaultEnvelopeSettings(),
    filterEnv: defaultEnvelopeSettings(),
    lfo: defaultLFOSettings(),
    unison: defaultUnisonSettings(),
    effects: defaultSynthFX(),
    preset: 'Init',
  },

  'Supersaw Lead': {
    oscillator1: { type: 'sawtooth', octave: 0, semitone: 0, fine: 0, volume: 0.9, on: true },
    oscillator2: { type: 'sawtooth', octave: 0, semitone: 0, fine: 12, volume: 0.6, on: true },
    sub: { type: 'sine', octave: -1, volume: 0.2, on: false },
    filter: { type: 'lowpass', cutoff: 6000, resonance: 0.3, drive: 0.1, envAmount: 0.2, keyTracking: 0.5 },
    ampEnv: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.5 },
    filterEnv: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.5 },
    lfo: { shape: 'sine', rate: 0.5, amount: 0.05, target: 'pitch', on: false, sync: false },
    unison: { voices: 7, detune: 0.35, spread: 0.8, on: true },
    effects: {
      reverb: { on: true, wet: 0.25, decay: 2.5, preDelay: 0.02 },
      delay: { on: true, wet: 0.2, time: 0.375, feedback: 0.35, pingPong: false },
      chorus: { on: true, wet: 0.4, rate: 1.2, depth: 0.4, delay: 3.5 },
      distortion: { on: false, wet: 0.3, amount: 0.1, type: 'soft' },
    },
    preset: 'Supersaw Lead',
  },

  'Dubstep Bass': {
    oscillator1: { type: 'sawtooth', octave: -1, semitone: 0, fine: 0, volume: 1.0, on: true },
    oscillator2: { type: 'square', octave: -1, semitone: 7, fine: 0, volume: 0.5, on: true },
    sub: { type: 'sine', octave: -2, volume: 0.7, on: true },
    filter: { type: 'lowpass', cutoff: 400, resonance: 0.7, drive: 0.6, envAmount: 0.8, keyTracking: 0.2 },
    ampEnv: { attack: 0.001, decay: 0.1, sustain: 0.9, release: 0.3 },
    filterEnv: { attack: 0.001, decay: 0.8, sustain: 0.2, release: 0.5 },
    lfo: { shape: 'sine', rate: 0.5, amount: 0.8, target: 'filter', on: true, sync: true },
    unison: { voices: 3, detune: 0.2, spread: 0.4, on: true },
    effects: {
      reverb: { on: false, wet: 0.1, decay: 1, preDelay: 0.01 },
      delay: { on: false, wet: 0.15, time: 0.25, feedback: 0.2, pingPong: false },
      chorus: { on: false, wet: 0.2, rate: 0.8, depth: 0.2, delay: 2 },
      distortion: { on: true, wet: 0.9, amount: 0.8, type: 'hard' },
    },
    preset: 'Dubstep Bass',
  },

  'Sub Bass': {
    oscillator1: { type: 'sine', octave: -2, semitone: 0, fine: 0, volume: 1.0, on: true },
    oscillator2: { type: 'sine', octave: -1, semitone: 0, fine: 0, volume: 0.2, on: true },
    sub: { type: 'sine', octave: -2, volume: 0.8, on: true },
    filter: { type: 'lowpass', cutoff: 300, resonance: 0.1, drive: 0, envAmount: 0, keyTracking: 0 },
    ampEnv: { attack: 0.01, decay: 0.1, sustain: 1.0, release: 0.3 },
    filterEnv: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.2 },
    lfo: { shape: 'sine', rate: 0.1, amount: 0, target: 'pitch', on: false, sync: false },
    unison: { voices: 1, detune: 0, spread: 0, on: false },
    effects: {
      reverb: { on: false, wet: 0.05, decay: 0.5, preDelay: 0.005 },
      delay: { on: false, wet: 0.05, time: 0.125, feedback: 0.1, pingPong: false },
      chorus: { on: false, wet: 0.1, rate: 0.5, depth: 0.1, delay: 2 },
      distortion: { on: false, wet: 0.2, amount: 0.1, type: 'soft' },
    },
    preset: 'Sub Bass',
  },

  'Future Bass Chord': {
    oscillator1: { type: 'sawtooth', octave: 0, semitone: 0, fine: 5, volume: 0.85, on: true },
    oscillator2: { type: 'sawtooth', octave: 0, semitone: 0, fine: -5, volume: 0.85, on: true },
    sub: { type: 'sine', octave: -1, volume: 0.3, on: false },
    filter: { type: 'lowpass', cutoff: 5000, resonance: 0.4, drive: 0.1, envAmount: 0.3, keyTracking: 0.3 },
    ampEnv: { attack: 0.02, decay: 0.2, sustain: 0.9, release: 0.8 },
    filterEnv: { attack: 0.02, decay: 0.5, sustain: 0.6, release: 0.5 },
    lfo: { shape: 'sine', rate: 8, amount: 0.2, target: 'pitch', on: true, sync: false },
    unison: { voices: 5, detune: 0.25, spread: 0.9, on: true },
    effects: {
      reverb: { on: true, wet: 0.5, decay: 3, preDelay: 0.03 },
      delay: { on: true, wet: 0.3, time: 0.375, feedback: 0.4, pingPong: true },
      chorus: { on: true, wet: 0.6, rate: 2, depth: 0.5, delay: 4 },
      distortion: { on: false, wet: 0.15, amount: 0.05, type: 'soft' },
    },
    preset: 'Future Bass Chord',
  },

  'Pluck Lead': {
    oscillator1: { type: 'sawtooth', octave: 0, semitone: 0, fine: 0, volume: 0.9, on: true },
    oscillator2: { type: 'triangle', octave: 1, semitone: 0, fine: 0, volume: 0.3, on: false },
    sub: { type: 'sine', octave: -1, volume: 0.2, on: false },
    filter: { type: 'lowpass', cutoff: 3000, resonance: 0.5, drive: 0.1, envAmount: 0.6, keyTracking: 0.4 },
    ampEnv: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.2 },
    filterEnv: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.15 },
    lfo: { shape: 'sine', rate: 0.5, amount: 0, target: 'pitch', on: false, sync: false },
    unison: { voices: 2, detune: 0.1, spread: 0.3, on: true },
    effects: {
      reverb: { on: true, wet: 0.2, decay: 1.5, preDelay: 0.01 },
      delay: { on: true, wet: 0.35, time: 0.25, feedback: 0.3, pingPong: false },
      chorus: { on: false, wet: 0.2, rate: 1, depth: 0.2, delay: 2 },
      distortion: { on: false, wet: 0.1, amount: 0.05, type: 'soft' },
    },
    preset: 'Pluck Lead',
  },

  'Trap 808': {
    oscillator1: { type: 'sine', octave: -1, semitone: 0, fine: 0, volume: 1.0, on: true },
    oscillator2: { type: 'triangle', octave: -1, semitone: 0, fine: 0, volume: 0.3, on: false },
    sub: { type: 'sine', octave: -2, volume: 0.9, on: true },
    filter: { type: 'lowpass', cutoff: 200, resonance: 0.2, drive: 0.3, envAmount: 0.1, keyTracking: 0.1 },
    ampEnv: { attack: 0.001, decay: 0.05, sustain: 0.9, release: 1.8 },
    filterEnv: { attack: 0.001, decay: 0.1, sustain: 0.8, release: 1.5 },
    lfo: { shape: 'sawtooth', rate: 0.3, amount: 0.05, target: 'pitch', on: false, sync: false },
    unison: { voices: 1, detune: 0, spread: 0, on: false },
    effects: {
      reverb: { on: false, wet: 0.1, decay: 1, preDelay: 0.01 },
      delay: { on: false, wet: 0.1, time: 0.125, feedback: 0.1, pingPong: false },
      chorus: { on: false, wet: 0.1, rate: 0.5, depth: 0.1, delay: 2 },
      distortion: { on: true, wet: 0.3, amount: 0.2, type: 'soft' },
    },
    preset: 'Trap 808',
  },

  'Pad Atmospheric': {
    oscillator1: { type: 'sawtooth', octave: 0, semitone: 0, fine: 7, volume: 0.75, on: true },
    oscillator2: { type: 'sawtooth', octave: 0, semitone: 12, fine: -7, volume: 0.75, on: true },
    sub: { type: 'sine', octave: -1, volume: 0.3, on: false },
    filter: { type: 'lowpass', cutoff: 2000, resonance: 0.2, drive: 0, envAmount: 0.1, keyTracking: 0.3 },
    ampEnv: { attack: 0.8, decay: 0.5, sustain: 0.9, release: 2.0 },
    filterEnv: { attack: 1.0, decay: 1.0, sustain: 0.7, release: 2.0 },
    lfo: { shape: 'sine', rate: 0.2, amount: 0.1, target: 'filter', on: true, sync: false },
    unison: { voices: 4, detune: 0.3, spread: 0.9, on: true },
    effects: {
      reverb: { on: true, wet: 0.7, decay: 5, preDelay: 0.05 },
      delay: { on: true, wet: 0.3, time: 0.5, feedback: 0.5, pingPong: true },
      chorus: { on: true, wet: 0.5, rate: 0.5, depth: 0.6, delay: 5 },
      distortion: { on: false, wet: 0.05, amount: 0.02, type: 'soft' },
    },
    preset: 'Pad Atmospheric',
  },

  'Bass Stab': {
    oscillator1: { type: 'square', octave: -1, semitone: 0, fine: 0, volume: 1.0, on: true },
    oscillator2: { type: 'sawtooth', octave: -1, semitone: 7, fine: 0, volume: 0.5, on: true },
    sub: { type: 'sine', octave: -2, volume: 0.6, on: true },
    filter: { type: 'lowpass', cutoff: 800, resonance: 0.6, drive: 0.4, envAmount: 0.7, keyTracking: 0.2 },
    ampEnv: { attack: 0.001, decay: 0.2, sustain: 0.0, release: 0.15 },
    filterEnv: { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.1 },
    lfo: { shape: 'square', rate: 4, amount: 0, target: 'filter', on: false, sync: false },
    unison: { voices: 2, detune: 0.15, spread: 0.3, on: true },
    effects: {
      reverb: { on: false, wet: 0.1, decay: 0.5, preDelay: 0.005 },
      delay: { on: true, wet: 0.2, time: 0.125, feedback: 0.2, pingPong: false },
      chorus: { on: false, wet: 0.1, rate: 1, depth: 0.1, delay: 2 },
      distortion: { on: true, wet: 0.7, amount: 0.5, type: 'hard' },
    },
    preset: 'Bass Stab',
  },

  'Psy Lead': {
    oscillator1: { type: 'sawtooth', octave: 0, semitone: 0, fine: 0, volume: 0.9, on: true },
    oscillator2: { type: 'sawtooth', octave: 1, semitone: -7, fine: 15, volume: 0.4, on: true },
    sub: { type: 'sine', octave: -1, volume: 0.2, on: false },
    filter: { type: 'bandpass', cutoff: 2000, resonance: 0.8, drive: 0.2, envAmount: 0.5, keyTracking: 0.5 },
    ampEnv: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3 },
    filterEnv: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
    lfo: { shape: 'sine', rate: 5, amount: 0.6, target: 'pitch', on: true, sync: false },
    unison: { voices: 3, detune: 0.2, spread: 0.5, on: true },
    effects: {
      reverb: { on: true, wet: 0.3, decay: 2, preDelay: 0.02 },
      delay: { on: true, wet: 0.4, time: 0.375, feedback: 0.5, pingPong: true },
      chorus: { on: true, wet: 0.3, rate: 1.5, depth: 0.3, delay: 3 },
      distortion: { on: true, wet: 0.5, amount: 0.35, type: 'waveshape' },
    },
    preset: 'Psy Lead',
  },

  'Reese Bass': {
    oscillator1: { type: 'sawtooth', octave: -1, semitone: 0, fine: 8, volume: 0.9, on: true },
    oscillator2: { type: 'sawtooth', octave: -1, semitone: 0, fine: -8, volume: 0.9, on: true },
    sub: { type: 'sine', octave: -2, volume: 0.6, on: true },
    filter: { type: 'lowpass', cutoff: 600, resonance: 0.4, drive: 0.3, envAmount: 0.2, keyTracking: 0.1 },
    ampEnv: { attack: 0.005, decay: 0.1, sustain: 0.9, release: 0.4 },
    filterEnv: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.3 },
    lfo: { shape: 'sine', rate: 0.3, amount: 0.3, target: 'filter', on: true, sync: false },
    unison: { voices: 2, detune: 0.4, spread: 0.6, on: true },
    effects: {
      reverb: { on: false, wet: 0.1, decay: 1, preDelay: 0.01 },
      delay: { on: false, wet: 0.1, time: 0.25, feedback: 0.2, pingPong: false },
      chorus: { on: false, wet: 0.2, rate: 0.5, depth: 0.3, delay: 3 },
      distortion: { on: true, wet: 0.6, amount: 0.45, type: 'hard' },
    },
    preset: 'Reese Bass',
  },
};

// =====================================================
// Drum Presets (8 rows x 16 steps)
// =====================================================
// Row order: 0=Kick, 1=Snare, 2=Clap, 3=HiHat Closed, 4=HiHat Open, 5=Tom, 6=Rim, 7=Cymbal

const F = false;
const T = true;

export const DRUM_PRESETS: Record<string, boolean[][]> = {
  'House': [
    // Kick:         1   .   .   .   2   .   .   .   3   .   .   .   4   .   .   .
    [T, F, F, F, T, F, F, F, T, F, F, F, T, F, F, F],
    // Snare:
    [F, F, F, F, T, F, F, F, F, F, F, F, T, F, F, F],
    // Clap:
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    // HiHat Closed:
    [T, F, T, F, T, F, T, F, T, F, T, F, T, F, T, F],
    // HiHat Open:
    [F, F, F, F, F, F, F, T, F, F, F, F, F, F, F, F],
    // Tom:
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    // Rim:
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    // Cymbal:
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
  ],

  'Techno': [
    [T, F, F, F, T, F, F, F, T, F, F, F, T, F, F, F],
    [F, F, F, F, T, F, F, F, F, F, F, F, T, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, T, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [T, F, F, F, F, F, F, F, T, F, F, F, F, F, F, F],
  ],

  'Dubstep': [
    [T, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F],
    [F, F, F, F, T, F, F, T, F, F, F, T, F, F, F, F],
    [F, F, F, F, T, F, F, F, F, F, F, F, T, F, F, F],
    [T, F, T, F, T, F, T, F, T, F, T, F, T, F, T, F],
    [F, F, F, F, F, F, F, T, F, F, F, F, F, F, F, T],
    [F, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
  ],

  'DnB': [
    [T, F, F, F, F, F, T, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, T, F, F, F, F, F, T, F, T, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [T, F, T, T, T, F, T, F, T, T, T, F, T, F, T, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, T],
    [F, F, F, F, F, F, F, F, F, F, F, F, T, F, F, F],
    [F, F, F, F, F, F, F, F, F, T, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
  ],

  'Trap': [
    [T, F, F, F, F, F, F, F, F, F, T, F, F, F, F, F],
    [F, F, F, F, T, F, F, F, F, F, F, F, T, F, F, F],
    [F, F, F, F, T, F, F, F, F, F, F, F, T, F, F, T],
    [T, F, F, T, F, T, F, T, F, F, T, F, T, F, T, T],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, T, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
  ],

  'Future Bass': [
    [T, F, F, F, T, F, F, F, T, F, F, F, T, F, T, F],
    [F, F, F, F, T, F, F, F, F, F, F, F, T, F, F, F],
    [F, F, F, F, T, F, F, T, F, F, F, F, T, F, F, T],
    [T, T, F, T, T, T, F, T, T, T, F, T, T, T, F, T],
    [F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, T, F, F, F, F, F, T, F],
    [F, F, T, F, F, F, T, F, F, F, T, F, F, F, F, F],
    [T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F],
  ],
};

export const PRESET_NAMES = Object.keys(SYNTH_PRESETS);
export const DRUM_PRESET_NAMES = Object.keys(DRUM_PRESETS);
