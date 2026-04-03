import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Note, AIGeneratorSettings, SynthSettings } from '../types';
import { defaultSynthSettings } from '../types';
import { NOTES, SCALES } from '../utils/musicTheory';

// =====================================================
// AI generation helper functions
// =====================================================

const CHORD_PROGRESSIONS_BY_MOOD: Record<string, Record<string, string[][]>> = {
  dark: {
    minor: [['i', 'VI', 'III', 'VII'], ['i', 'iv', 'VI', 'VII'], ['i', 'VII', 'VI', 'VII']],
    dorian: [['i', 'IV', 'VII', 'i'], ['i', 'II', 'VII', 'i'], ['i', 'VII', 'IV', 'VII']],
    phrygian: [['i', 'II', 'i', 'II'], ['i', 'VII', 'VI', 'VII'], ['i', 'II', 'VII', 'i']],
  },
  happy: {
    major: [['I', 'V', 'vi', 'IV'], ['I', 'IV', 'V', 'IV'], ['I', 'vi', 'IV', 'V']],
    mixolydian: [['I', 'VII', 'IV', 'I'], ['I', 'IV', 'VII', 'IV'], ['I', 'VII', 'I', 'IV']],
  },
  tense: {
    minor: [['i', 'v', 'VI', 'III'], ['i', 'II', 'v', 'i'], ['i', 'III', 'v', 'VII']],
    phrygian: [['i', 'II', 'i', 'VII'], ['i', 'v', 'II', 'i'], ['i', 'VII', 'II', 'i']],
  },
  euphoric: {
    major: [['I', 'IV', 'vi', 'V'], ['I', 'II', 'IV', 'V'], ['vi', 'IV', 'I', 'V']],
    dorian: [['i', 'IV', 'i', 'VII'], ['i', 'VII', 'IV', 'VII'], ['i', 'IV', 'VII', 'i']],
  },
};

// Roman numeral -> semitone offset
const ROMAN_OFFSETS: Record<string, number> = {
  'I': 0, 'i': 0,
  'II': 2, 'ii': 2,
  'III': 3, 'iii': 4,
  'IV': 5, 'iv': 5,
  'V': 7, 'v': 7,
  'VI': 8, 'vi': 9,
  'VII': 10, 'vii': 11,
};

// Whether roman numeral is major or minor
function isMinorNumeral(numeral: string): boolean {
  return numeral === numeral.toLowerCase() || ['ii', 'iii', 'vi', 'vii'].includes(numeral.toLowerCase());
}

function buildChordName(_root: string, minor: boolean, offset: number, keyRoot: string): string {
  const keyIndex = NOTES.indexOf(keyRoot);
  const noteIndex = (keyIndex + offset) % 12;
  const noteName = NOTES[noteIndex];
  return `${noteName}${minor ? 'm' : ''}`;
}

// =====================================================
// Store
// =====================================================

interface AIState {
  isGenerating: boolean;
  lastGeneratedChords: string[];
  lastGeneratedPattern: boolean[][];
  lastGeneratedMelody: Note[];
  aiSettings: AIGeneratorSettings;
  generatedLyrics: string;

  // Actions
  setAISettings: (settings: Partial<AIGeneratorSettings>) => void;
  generateChordProgression: (settings?: Partial<AIGeneratorSettings>) => string[];
  generateDrumPattern: (genre?: string) => boolean[][];
  generateBassline: (chords: string[], settings?: Partial<AIGeneratorSettings>) => Note[];
  generateMelody: (chords: string[], settings?: Partial<AIGeneratorSettings>) => Note[];
  applyAIPrompt: (prompt: string, trackId: string) => SynthSettings;
  setLyrics: (lyrics: string) => void;
}

export const useAIStore = create<AIState>()(
  immer((set, get) => ({
    isGenerating: false,
    lastGeneratedChords: [],
    lastGeneratedPattern: Array.from({ length: 8 }, () => Array(16).fill(false)),
    lastGeneratedMelody: [],
    generatedLyrics: '',
    aiSettings: {
      scale: 'minor',
      key: 'A',
      mood: 'dark',
      genre: 'dubstep',
      bars: 4,
    },

    setAISettings(settings) {
      set(draft => {
        Object.assign(draft.aiSettings, settings);
      });
    },

    generateChordProgression(settingsOverride = {}) {
      const settings = { ...get().aiSettings, ...settingsOverride };
      set(draft => { draft.isGenerating = true; });

      const { scale, key, mood } = settings;

      // Get progressions for mood + scale, fallback chain
      const moodProgressions = CHORD_PROGRESSIONS_BY_MOOD[mood] ?? CHORD_PROGRESSIONS_BY_MOOD.dark;
      const scaleProgressions = moodProgressions[scale] ?? moodProgressions[Object.keys(moodProgressions)[0]];

      // Pick a progression deterministically based on key
      const keyIndex = NOTES.indexOf(key) ?? 0;
      const progressionIndex = keyIndex % scaleProgressions.length;
      const romanNumerals = scaleProgressions[progressionIndex];

      const chords = romanNumerals.map(numeral => {
        const offset = ROMAN_OFFSETS[numeral] ?? 0;
        const minor = isMinorNumeral(numeral);
        return buildChordName(key, minor, offset, key);
      });

      set(draft => {
        draft.lastGeneratedChords = chords;
        draft.isGenerating = false;
      });

      return chords;
    },

    generateDrumPattern(genre) {
      const g = genre ?? get().aiSettings.genre;
      set(draft => { draft.isGenerating = true; });

      // Preset patterns for each genre
      const patterns: Record<string, boolean[][]> = {
        dubstep: [
          [true,  false, false, false, false, false, false, false, false, true,  false, false, false, false, false, false],
          [false, false, false, false, true,  false, false, true,  false, false, false, true,  false, false, false, false],
          [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
          [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
          [false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false, true ],
          [false, false, false, false, false, false, false, false, false, false, true,  false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ],
        dnb: [
          [true,  false, false, false, false, false, true,  false, false, false, false, false, false, false, false, false],
          [false, false, false, false, true,  false, false, false, false, false, true,  false, true,  false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [true,  false, true,  true,  true,  false, true,  false, true,  true,  true,  false, true,  false, true,  false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true ],
          [false, false, false, false, false, false, false, false, false, false, false, false, true,  false, false, false],
          [false, false, false, false, false, false, false, false, false, true,  false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ],
        'future-bass': [
          [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, true,  false],
          [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
          [false, false, false, false, true,  false, false, true,  false, false, false, false, true,  false, false, true ],
          [true,  true,  false, true,  true,  true,  false, true,  true,  true,  false, true,  true,  true,  false, true ],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, true,  false, false, false, false, false, true,  false],
          [false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false, false, false],
          [true,  false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ],
        trap: [
          [true,  false, false, false, false, false, false, false, false, false, true,  false, false, false, false, false],
          [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
          [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, true ],
          [true,  false, false, true,  false, true,  false, true,  false, false, true,  false, true,  false, true,  true ],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ],
        house: [
          [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
          [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false, true,  false],
          [false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        ],
        techno: [
          [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
          [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, true,  false, false, false, false],
          [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
          [true,  false, false, false, false, false, false, false, true,  false, false, false, false, false, false, false],
        ],
      };

      const pattern = patterns[g] ?? patterns.house;

      set(draft => {
        draft.lastGeneratedPattern = pattern;
        draft.isGenerating = false;
      });

      return pattern;
    },

    generateBassline(chords, settingsOverride = {}) {
      const settings = { ...get().aiSettings, ...settingsOverride };
      set(draft => { draft.isGenerating = true; });

      const { key, scale, bars } = settings;
      const scaleIntervals = SCALES[scale] ?? SCALES.minor;
      const keyIndex = NOTES.indexOf(key);

      // Generate a simple bassline based on chord roots
      const notes: Note[] = [];
      const stepsPerBar = 16;
      const totalSteps = bars * stepsPerBar;
      const stepsPerChord = Math.floor(totalSteps / Math.max(chords.length, 1));

      chords.forEach((chord, chordIndex) => {
        // Parse chord root
        const chordRoot = chord.replace(/m$/, '').replace(/7$/, '').replace(/maj.*$/, '');
        const chordRootIndex = NOTES.indexOf(chordRoot);
        if (chordRootIndex === -1) return;

        const bassMidi = 36 + chordRootIndex; // C2 = 36

        const startStep = chordIndex * stepsPerChord;

        // Root note - whole chord duration
        notes.push({
          id: crypto.randomUUID(),
          pitch: bassMidi,
          startStep,
          duration: Math.max(1, Math.floor(stepsPerChord * 0.8)),
          velocity: 100,
        });

        // Add passing notes for interest
        if (stepsPerChord >= 8) {
          // Add fifth
          const fifthMidi = bassMidi + 7;
          notes.push({
            id: crypto.randomUUID(),
            pitch: fifthMidi,
            startStep: startStep + Math.floor(stepsPerChord / 2),
            duration: Math.floor(stepsPerChord * 0.3),
            velocity: 85,
          });
        }

        // Add scale run at end of chord
        if (stepsPerChord >= 12) {
          const nextChordRoot = chords[(chordIndex + 1) % chords.length].replace(/m$/, '');
          const nextRootIndex = NOTES.indexOf(nextChordRoot);
          if (nextRootIndex !== -1) {
            const nextBassMidi = 36 + nextRootIndex;
            // Approach note (semitone below or above)
            const approach = nextBassMidi > bassMidi ? nextBassMidi - 1 : nextBassMidi + 1;
            notes.push({
              id: crypto.randomUUID(),
              pitch: approach,
              startStep: startStep + stepsPerChord - 2,
              duration: 2,
              velocity: 80,
            });
          }
        }
      });

      // Add scale variation
      const extraNotes: Note[] = [];
      if (scaleIntervals.length > 0 && keyIndex >= 0) {
        for (let step = 0; step < Math.min(8, totalSteps); step += 4) {
          const intervalIndex = step % scaleIntervals.length;
          const pitch = 36 + keyIndex + scaleIntervals[intervalIndex];
          if (!notes.some(n => n.startStep === step)) {
            extraNotes.push({
              id: crypto.randomUUID(),
              pitch,
              startStep: step,
              duration: 2,
              velocity: 75,
            });
          }
        }
      }

      const allNotes = [...notes, ...extraNotes].sort((a, b) => a.startStep - b.startStep);

      set(draft => {
        draft.lastGeneratedMelody = allNotes;
        draft.isGenerating = false;
      });

      return allNotes;
    },

    generateMelody(_chords, settingsOverride = {}) {
      const settings = { ...get().aiSettings, ...settingsOverride };
      set(draft => { draft.isGenerating = true; });

      const { key, scale, bars, mood } = settings;
      const scaleIntervals = SCALES[scale] ?? SCALES.minor;
      const keyIndex = NOTES.indexOf(key);
      if (keyIndex === -1) return [];

      const stepsPerBar = 16;
      const totalSteps = bars * stepsPerBar;

      // Melody range based on mood
      const octave = mood === 'dark' ? 4 : mood === 'happy' ? 5 : 4;
      const baseOctaveMidi = (octave + 1) * 12 + keyIndex;

      const notes: Note[] = [];
      const melodyPatterns: Record<string, number[]> = {
        dark:     [0, 2, 1, 3, 0, -1, 2, 0],
        happy:    [0, 2, 4, 2, 3, 4, 2, 0],
        tense:    [0, -1, 2, -1, 3, 2, 0, -2],
        euphoric: [0, 3, 4, 2, 4, 3, 4, 5],
      };

      const pattern = melodyPatterns[mood] ?? melodyPatterns['dark'];

      let noteIndex = 0;
      let step = 0;

      while (step < totalSteps && noteIndex < 32) {
        const patternPos = noteIndex % pattern.length;
        const scaleStep = ((pattern[patternPos] % scaleIntervals.length) + scaleIntervals.length) % scaleIntervals.length;
        const pitch = baseOctaveMidi + scaleIntervals[scaleStep];

        // Vary note duration for rhythm
        const durations = [1, 2, 2, 4, 1, 2, 1, 4];
        const duration = durations[noteIndex % durations.length];

        // Occasional rest (no note) for rhythm
        const hasRest = (noteIndex % 3 === 2) && mood !== 'euphoric';

        if (!hasRest) {
          notes.push({
            id: crypto.randomUUID(),
            pitch: Math.max(48, Math.min(84, pitch)), // clamp to range
            startStep: step,
            duration,
            velocity: 80 + Math.floor((noteIndex % 5) * 8), // velocity variation
          });
        }

        step += duration + (hasRest ? duration : 0);
        noteIndex++;
      }

      set(draft => {
        draft.lastGeneratedMelody = notes;
        draft.isGenerating = false;
      });

      return notes;
    },

    applyAIPrompt(prompt: string, _trackId: string): SynthSettings {
      const lower = prompt.toLowerCase();
      const settings = defaultSynthSettings();

      // Parse keywords and configure synth
      if (lower.includes('aggressive') || lower.includes('hard')) {
        settings.oscillator1.type = 'sawtooth';
        settings.filter.cutoff = 800;
        settings.filter.resonance = 0.6;
        settings.filter.drive = 0.7;
        settings.effects.distortion = { on: true, wet: 0.8, amount: 0.7, type: 'hard' };
        settings.preset = 'AI: Aggressive';
      }

      if (lower.includes('dubstep')) {
        settings.oscillator1.type = 'sawtooth';
        settings.filter.type = 'lowpass';
        settings.filter.cutoff = 400;
        settings.filter.resonance = 0.7;
        settings.lfo = { shape: 'sine', rate: 0.5, amount: 0.8, target: 'filter', on: true, sync: true };
        settings.effects.distortion = { on: true, wet: 0.9, amount: 0.8, type: 'hard' };
        settings.preset = 'AI: Dubstep';
      }

      if (lower.includes('bass') || lower.includes('sub')) {
        settings.oscillator1.type = 'sine';
        settings.oscillator1.octave = -2;
        settings.sub.on = true;
        settings.sub.volume = 0.8;
        settings.filter.type = 'lowpass';
        settings.filter.cutoff = 250;
        settings.preset = 'AI: Sub Bass';
      }

      if (lower.includes('lead')) {
        settings.oscillator1.type = 'sawtooth';
        settings.unison = { voices: 5, detune: 0.3, spread: 0.8, on: true };
        settings.effects.reverb = { on: true, wet: 0.2, decay: 2, preDelay: 0.01 };
        settings.preset = 'AI: Lead';
      }

      if (lower.includes('pad')) {
        settings.oscillator1.type = 'sawtooth';
        settings.oscillator2.on = true;
        settings.oscillator2.fine = 8;
        settings.ampEnv = { attack: 0.8, decay: 0.5, sustain: 0.9, release: 2.0 };
        settings.effects.reverb = { on: true, wet: 0.7, decay: 4, preDelay: 0.05 };
        settings.effects.chorus = { on: true, wet: 0.5, rate: 0.5, depth: 0.6, delay: 5 };
        settings.preset = 'AI: Pad';
      }

      if (lower.includes('pluck')) {
        settings.oscillator1.type = 'sawtooth';
        settings.ampEnv = { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.2 };
        settings.filter.envAmount = 0.6;
        settings.effects.delay = { on: true, wet: 0.3, time: 0.25, feedback: 0.3, pingPong: false };
        settings.preset = 'AI: Pluck';
      }

      if (lower.includes('supersaw')) {
        settings.oscillator1.type = 'sawtooth';
        settings.oscillator2.type = 'sawtooth';
        settings.oscillator2.on = true;
        settings.unison = { voices: 7, detune: 0.35, spread: 0.8, on: true };
        settings.effects.chorus = { on: true, wet: 0.4, rate: 1.2, depth: 0.4, delay: 3.5 };
        settings.preset = 'AI: Supersaw';
      }

      if (lower.includes('soft') || lower.includes('gentle')) {
        settings.ampEnv.attack = 0.5;
        settings.ampEnv.release = 1.5;
        settings.filter.cutoff = 2000;
        settings.filter.resonance = 0.1;
        settings.effects.reverb = { on: true, wet: 0.5, decay: 3, preDelay: 0.03 };
        settings.preset = 'AI: Soft';
      }

      if (lower.includes('dark')) {
        settings.oscillator1.type = 'square';
        settings.filter.type = 'lowpass';
        settings.filter.cutoff = 600;
        settings.filter.resonance = 0.5;
        settings.effects.reverb = { on: true, wet: 0.4, decay: 3, preDelay: 0.02 };
        settings.preset = 'AI: Dark';
      }

      if (lower.includes('bright')) {
        settings.filter.cutoff = 8000;
        settings.filter.resonance = 0.2;
        settings.effects.chorus = { on: true, wet: 0.3, rate: 2, depth: 0.2, delay: 3 };
        settings.preset = 'AI: Bright';
      }

      return settings;
    },

    setLyrics(lyrics) {
      set(draft => { draft.generatedLyrics = lyrics; });
    },
  }))
);
