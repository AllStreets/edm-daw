// =====================================================
// Core Note & Pattern Types
// =====================================================

export interface Note {
  id: string;
  pitch: number; // MIDI note number 0-127
  startStep: number;
  duration: number; // in steps
  velocity: number; // 0-127
}

export interface Pattern {
  id: string;
  name: string;
  steps: number; // 16 or 32
  notes: Note[]; // For piano roll / melodic content
  stepData: boolean[][]; // [trackRow][step] for drum sequencer (8 x 32)
  color: string;
}

// =====================================================
// Synth Settings
// =====================================================

export type OscType = 'sawtooth' | 'square' | 'sine' | 'triangle' | 'noise';
export type SubOscType = 'sine' | 'square';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';
export type LFOShape = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type LFOTarget = 'pitch' | 'filter' | 'volume' | 'pan';
export type DistortionType = 'soft' | 'hard' | 'waveshape';

export interface OscSettings {
  type: OscType;
  octave: number;   // -2 to +2
  semitone: number; // -12 to +12
  fine: number;     // -100 to +100 cents
  volume: number;   // 0 to 1
  on: boolean;
}

export interface SubOscSettings {
  type: SubOscType;
  octave: number;   // -2 to 0
  volume: number;   // 0 to 1
  on: boolean;
}

export interface FilterSettings {
  type: FilterType;
  cutoff: number;      // 20 to 20000 Hz
  resonance: number;   // 0 to 1
  drive: number;       // 0 to 1
  envAmount: number;   // -1 to 1
  keyTracking: number; // 0 to 1
}

export interface EnvelopeSettings {
  attack: number;  // seconds
  decay: number;   // seconds
  sustain: number; // 0 to 1
  release: number; // seconds
}

export interface LFOSettings {
  shape: LFOShape;
  rate: number;    // Hz or BPM sync fraction
  amount: number;  // 0 to 1
  target: LFOTarget;
  on: boolean;
  sync: boolean;   // sync to BPM
}

export interface UnisonSettings {
  voices: number;  // 1 to 8
  detune: number;  // 0 to 1 (cents spread)
  spread: number;  // 0 to 1 (stereo spread)
  on: boolean;
}

export interface ReverbSettings {
  on: boolean;
  wet: number;      // 0 to 1
  decay: number;    // seconds
  preDelay: number; // seconds
}

export interface DelaySettings {
  on: boolean;
  wet: number;      // 0 to 1
  time: number;     // seconds or note value
  feedback: number; // 0 to 1
  pingPong: boolean;
}

export interface ChorusSettings {
  on: boolean;
  wet: number;   // 0 to 1
  rate: number;  // Hz
  depth: number; // 0 to 1
  delay: number; // ms
}

export interface DistortionSettings {
  on: boolean;
  wet: number;    // 0 to 1
  amount: number; // 0 to 1
  type: DistortionType;
}

export interface SynthFX {
  reverb: ReverbSettings;
  delay: DelaySettings;
  chorus: ChorusSettings;
  distortion: DistortionSettings;
}

export interface SynthSettings {
  oscillator1: OscSettings;
  oscillator2: OscSettings;
  sub: SubOscSettings;
  filter: FilterSettings;
  ampEnv: EnvelopeSettings;
  filterEnv: EnvelopeSettings;
  lfo: LFOSettings;
  unison: UnisonSettings;
  effects: SynthFX;
  preset: string;
}

// =====================================================
// Effects Rack
// =====================================================

export interface Effect {
  id: string;
  type: 'reverb' | 'delay' | 'chorus' | 'distortion' | 'compressor' | 'eq' | 'flanger' | 'limiter' | 'phaser' | 'bitcrusher' | 'stereo-widener';
  settings: Record<string, number | boolean | string>;
  on: boolean;
}

// =====================================================
// Tracks
// =====================================================

export type TrackType = 'synth' | 'drum' | 'audio';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number;   // 0 to 1
  pan: number;      // -1 to 1
  mute: boolean;
  solo: boolean;
  armed: boolean;
  patterns: Pattern[];
  synthSettings: SynthSettings;
  effects: Effect[];
}

// =====================================================
// Session / Arrangement
// =====================================================

export interface Clip {
  id: string;
  patternId: string;
  color: string;
  name: string;
}

export interface Scene {
  id: string;
  name: string;
  clips: Record<string, string | null>; // trackId -> clipId or null
}

// =====================================================
// Project
// =====================================================

export interface MasterCompressorSettings {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  on: boolean;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number]; // e.g. [4, 4]
  tracks: Track[];
  scenes: Scene[];
  masterVolume: number;
  masterCompressor: MasterCompressorSettings;
  createdAt: string;
  modifiedAt: string;
}

// =====================================================
// AI Generator
// =====================================================

export interface AIGeneratorSettings {
  scale: string;  // 'major' | 'minor' | 'dorian' | ...
  key: string;    // 'C' | 'C#' | 'D' | ...
  mood: string;   // 'dark' | 'happy' | 'tense' | 'euphoric' | ...
  genre: string;  // 'dubstep' | 'house' | 'dnb' | ...
  bars: number;   // 1 | 2 | 4 | 8
}

// =====================================================
// Default factory functions
// =====================================================

export function defaultOscSettings(overrides?: Partial<OscSettings>): OscSettings {
  return {
    type: 'sawtooth',
    octave: 0,
    semitone: 0,
    fine: 0,
    volume: 0.8,
    on: true,
    ...overrides,
  };
}

export function defaultSubOscSettings(): SubOscSettings {
  return {
    type: 'sine',
    octave: -1,
    volume: 0.5,
    on: false,
  };
}

export function defaultFilterSettings(): FilterSettings {
  return {
    type: 'lowpass',
    cutoff: 8000,
    resonance: 0.2,
    drive: 0,
    envAmount: 0,
    keyTracking: 0,
  };
}

export function defaultEnvelopeSettings(): EnvelopeSettings {
  return {
    attack: 0.01,
    decay: 0.2,
    sustain: 0.7,
    release: 0.5,
  };
}

export function defaultLFOSettings(): LFOSettings {
  return {
    shape: 'sine',
    rate: 2,
    amount: 0.3,
    target: 'filter',
    on: false,
    sync: false,
  };
}

export function defaultUnisonSettings(): UnisonSettings {
  return {
    voices: 1,
    detune: 0,
    spread: 0,
    on: false,
  };
}

export function defaultSynthFX(): SynthFX {
  return {
    reverb: { on: false, wet: 0.3, decay: 2, preDelay: 0.01 },
    delay: { on: false, wet: 0.3, time: 0.375, feedback: 0.4, pingPong: false },
    chorus: { on: false, wet: 0.5, rate: 1.5, depth: 0.3, delay: 3.5 },
    distortion: { on: false, wet: 0.8, amount: 0.3, type: 'soft' },
  };
}

export function defaultSynthSettings(): SynthSettings {
  return {
    oscillator1: defaultOscSettings(),
    oscillator2: defaultOscSettings({ on: false, semitone: 7 }),
    sub: defaultSubOscSettings(),
    filter: defaultFilterSettings(),
    ampEnv: defaultEnvelopeSettings(),
    filterEnv: defaultEnvelopeSettings(),
    lfo: defaultLFOSettings(),
    unison: defaultUnisonSettings(),
    effects: defaultSynthFX(),
    preset: 'Init',
  };
}

export function defaultPattern(overrides?: Partial<Pattern>): Pattern {
  return {
    id: crypto.randomUUID(),
    name: 'Pattern 1',
    steps: 16,
    notes: [],
    stepData: Array.from({ length: 8 }, () => Array(32).fill(false)),
    color: '#9945ff',
    ...overrides,
  };
}

export function defaultTrack(overrides?: Partial<Track>): Track {
  return {
    id: crypto.randomUUID(),
    name: 'New Track',
    type: 'synth',
    color: '#9945ff',
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    armed: false,
    patterns: [defaultPattern()],
    synthSettings: defaultSynthSettings(),
    effects: [],
    ...overrides,
  };
}
