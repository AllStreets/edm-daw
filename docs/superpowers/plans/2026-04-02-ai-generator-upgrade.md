# AI Song Generator 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the full song generator to produce multi-section song arrangements with semantic vibe understanding, expand the drum machine to 16 synthesized rows, add a named synth preset library, and fix the Tone.js near-zero parameter error.

**Architecture:** Eight sequential tasks, each independently buildable. Tasks 1–4 are engine/schema changes with no UI dependencies. Tasks 5–6 add sounds and presets. Tasks 7–8 wire up the new multi-section generator and update AIPanel. Each task ends with `npm run build` passing clean.

**Tech Stack:** React 18, TypeScript, Tone.js, Zustand+Immer, Zod, Anthropic SDK, Vite

---

## File Map

| File | Change |
|------|--------|
| `src/engine/SynthEngine.ts` | Add `snapToZero` helper, apply to all rampTo calls |
| `src/types/index.ts` | Change `defaultPattern` stepData from 8→16 rows |
| `src/store/useProjectStore.ts` | Add `addNamedScene`, `addPatternToTrack` actions |
| `src/engine/DrumMachine.ts` | Expand `DRUM_NAMES` + voices to 16 rows |
| `src/components/Sequencer/StepSequencer.tsx` | Render 16 rows, pad legacy 8-row patterns, "Show All" toggle |
| `src/engine/SynthPresets.ts` | New: 20 named `SynthSettings` presets |
| `src/components/SampleBrowser/SampleBrowser.tsx` | Add Leads/Basses/Pads/FX Presets categories + expand existing |
| `src/engine/AudioEngine.ts` | Add preview cases for new SampleBrowser categories |
| `src/services/ClaudeSongGenerator.ts` | Replace with multi-section planner+composer API, vibe detection |
| `src/components/AITools/AIPanel.tsx` | Progress UI, multi-section scene creation using new generator |

---

## Task 1: Fix Tone.js Near-Zero Parameter Error

**Files:**
- Modify: `src/engine/SynthEngine.ts`

The error `Value must be within [0, 0], got: 1e-7` occurs when a floating-point value that should be exactly `0` arrives as a near-zero float (e.g. `1e-7`) and is passed to a Tone.js parameter. The fix: add a `snapToZero` helper and apply it at every `rampTo`/direct-assignment site in `updateSynth`.

- [ ] **Step 1: Add `snapToZero` helper above `updateSynth`**

In `src/engine/SynthEngine.ts`, add directly above the `updateSynth` function:

```typescript
/** Round any value within `threshold` of 0 to exactly 0, preventing Tone.js range errors. */
function snapToZero(v: number, threshold = 1e-6): number {
  return Math.abs(v) < threshold ? 0 : v;
}
```

- [ ] **Step 2: Apply `snapToZero` to all numeric assignments in `updateSynth`**

Replace the body of `updateSynth` (everything after the oscillator type update) with this:

```typescript
  // Update gain
  chain.gain.gain.rampTo(snapToZero(oscillator1.volume), 0.05);

  // Update filter
  chain.filter.type = filterSettings.type;
  chain.filter.frequency.rampTo(Math.max(20, snapToZero(filterSettings.cutoff)), 0.05);
  chain.filter.Q.rampTo(snapToZero(filterSettings.resonance * 20), 0.05);

  // Update reverb
  try { chain.reverb.wet.rampTo(snapToZero(effects.reverb.on ? effects.reverb.wet : 0), 0.1); } catch { /* IR not ready */ }

  // Update delay
  try {
    chain.delay.wet.rampTo(snapToZero(effects.delay.on ? effects.delay.wet : 0), 0.1);
    chain.delay.feedback.rampTo(snapToZero(effects.delay.feedback), 0.1);
  } catch { /* not ready */ }

  // Update chorus
  chain.chorus.wet.rampTo(snapToZero(effects.chorus.on ? effects.chorus.wet : 0), 0.1);

  // Update distortion
  chain.distortion.wet.rampTo(snapToZero(effects.distortion.on ? effects.distortion.wet : 0), 0.1);
  chain.distortion.distortion = snapToZero(effects.distortion.amount);

  // Update LFO
  chain.lfo.frequency.rampTo(Math.max(0.01, snapToZero(lfoSettings.rate)), 0.1);
  chain.lfo.amplitude.rampTo(snapToZero(lfoSettings.on ? lfoSettings.amount : 0), 0.1);
  chain.lfo.type = lfoSettings.shape;

  if (lfoSettings.on && chain.lfo.state !== 'started') {
    chain.lfo.start();
  } else if (!lfoSettings.on && chain.lfo.state === 'started') {
    chain.lfo.stop();
  }
```

- [ ] **Step 3: Verify**

```bash
npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/engine/SynthEngine.ts
git commit -m "fix: snapToZero prevents Tone.js near-zero parameter errors"
```

---

## Task 2: Schema — Expand stepData to 16 Rows

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/useProjectStore.ts`

New patterns should have 16 drum rows. Existing persisted patterns still have 8 rows — they are padded to 16 lazily in the StepSequencer (Task 4). Here we just update `defaultPattern` and add two new store actions.

- [ ] **Step 1: Update `defaultPattern` to create 16 rows**

In `src/types/index.ts`, find `defaultPattern` (~line 306) and change:

```typescript
export function defaultPattern(overrides?: Partial<Pattern>): Pattern {
  return {
    id: crypto.randomUUID(),
    name: 'Pattern 1',
    steps: 16,
    notes: [],
    stepData: Array.from({ length: 16 }, () => Array(32).fill(false)),
    color: '#9945ff',
    ...overrides,
  };
}
```

- [ ] **Step 2: Add `addNamedScene` and `addPatternToTrack` to the store interface**

In `src/store/useProjectStore.ts`, add to the `ProjectState` interface after the `addScene` line:

```typescript
addNamedScene: (name: string) => string;  // returns the new scene's id
addPatternToTrack: (trackId: string, pattern: Pattern) => void;
```

- [ ] **Step 3: Implement `addNamedScene` in the store**

In `src/store/useProjectStore.ts`, add after the `addScene` implementation:

```typescript
addNamedScene(name) {
  get()._pushUndo();
  const id = crypto.randomUUID();
  const scene: Scene = { id, name, clips: {} };
  set(draft => {
    draft.project.scenes.push(scene);
    draft.project.modifiedAt = new Date().toISOString();
  });
  return id;
},
```

- [ ] **Step 4: Implement `addPatternToTrack` in the store**

Add after `addNamedScene`:

```typescript
addPatternToTrack(trackId, pattern) {
  set(draft => {
    const track = draft.project.tracks.find(t => t.id === trackId);
    if (track) {
      track.patterns.push(pattern);
      draft.project.modifiedAt = new Date().toISOString();
    }
  });
},
```

- [ ] **Step 5: Verify**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/store/useProjectStore.ts
git commit -m "feat: expand drum stepData to 16 rows, add addNamedScene and addPatternToTrack to store"
```

---

## Task 3: DrumMachine — 16 Synthesized Voices

**Files:**
- Modify: `src/engine/DrumMachine.ts`

Expand `DRUM_NAMES` from 8 to 16 entries and add 8 new synthesized voices (rows 8–15). Existing rows 0–7 are unchanged to preserve backward compatibility with saved patterns.

- [ ] **Step 1: Update `DRUM_NAMES` to 16 entries**

In `src/engine/DrumMachine.ts`, replace the `DRUM_NAMES` const:

```typescript
export const DRUM_NAMES = [
  'Kick',         // 0
  'Snare',        // 1
  'Clap',         // 2
  'HiHat Closed', // 3
  'HiHat Open',   // 4
  'Tom',          // 5
  'Rim',          // 6
  'Cymbal',       // 7
  'Kick 2',       // 8
  'Snare 2',      // 9
  'Crash',        // 10
  'Ride',         // 11
  'Tom Hi',       // 12
  'Tom Lo',       // 13
  'Impact',       // 14
  'Reverse',      // 15
] as const;
```

- [ ] **Step 2: Add 8 new voices to `createDrumVoices`**

In `src/engine/DrumMachine.ts`, add these 8 new voices at the end of the `createDrumVoices` method, after the existing row 7 (Cymbal) voice:

```typescript
    // 8: Kick 2 — distorted industrial kick
    const kick2 = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 14,
      envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2 },
    });
    this.addVoice(8, kick2, new Tone.Gain(1.1), 'C1', '8n', destination);

    // 9: Snare 2 — tight electronic rimshot
    const snare2 = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 },
    });
    this.addVoice(9, snare2, new Tone.Gain(0.75), 'C1', '32n', destination);

    // 10: Crash — long metallic swell
    const crash = new Tone.MetalSynth({
      envelope: { attack: 0.002, decay: 1.2, release: 0.4 },
      harmonicity: 5.8,
      modulationIndex: 48,
      resonance: 2800,
      octaves: 2.5,
    });
    crash.frequency.value = 250;
    this.addVoice(10, crash, new Tone.Gain(0.3), 'C1', '2n', destination);

    // 11: Ride — metallic ring
    const ride = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.5, release: 0.15 },
      harmonicity: 7.2,
      modulationIndex: 28,
      resonance: 3500,
      octaves: 1.8,
    });
    ride.frequency.value = 350;
    this.addVoice(11, ride, new Tone.Gain(0.35), 'C1', '4n', destination);

    // 12: Tom Hi — mid-pitch drum body
    const tomHi = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.15 },
    });
    this.addVoice(12, tomHi, new Tone.Gain(0.85), 'D2', '8n', destination);

    // 13: Tom Lo — low-pitch drum body
    const tomLo = new Tone.MembraneSynth({
      pitchDecay: 0.07,
      octaves: 7,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
    });
    this.addVoice(13, tomLo, new Tone.Gain(0.9), 'A1', '8n', destination);

    // 14: Impact — sub thud + noise burst for drops
    const impact = new Tone.MembraneSynth({
      pitchDecay: 0.12,
      octaves: 12,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 },
    });
    this.addVoice(14, impact, new Tone.Gain(1.2), 'B0', '4n', destination);

    // 15: Reverse — reverse-style noise swell (simulated with slow attack)
    const reverse = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.25, decay: 0.1, sustain: 0.3, release: 0.2 },
    });
    this.addVoice(15, reverse, new Tone.Gain(0.5), 'C1', '4n', destination);
```

- [ ] **Step 3: Verify**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/engine/DrumMachine.ts
git commit -m "feat: expand DrumMachine to 16 synthesized voices"
```

---

## Task 4: StepSequencer — 16-Row UI

**Files:**
- Modify: `src/components/Sequencer/StepSequencer.tsx`

Show all 16 rows. Pad legacy 8-row `stepData` to 16 rows when rendering (non-destructive — does not mutate store). Add row labels and colors for the 8 new rows.

- [ ] **Step 1: Read the current StepSequencer to understand its structure**

Read `src/components/Sequencer/StepSequencer.tsx` and locate:
- The `DRUM_NAMES` or row label array it uses for row labels
- The `DRUM_ROW_COLORS` array
- The row-rendering loop (where it maps over `stepData`)

- [ ] **Step 2: Update row labels and colors**

Find the row label array (likely named `DRUM_ROWS` or using `DRUM_NAMES` from DrumMachine) and the colors array. Replace/extend them to cover 16 rows:

```typescript
// If the component imports DRUM_NAMES from DrumMachine, the import update is automatic.
// Otherwise, if it has a local DRUM_ROWS array, replace it with:
const DRUM_ROWS = [
  'Kick', 'Snare', 'Clap', 'HH', 'PHH', 'Tom', 'Rim', 'Cym',
  'Kick2', 'Sn2', 'Crash', 'Ride', 'TomH', 'TomL', 'Impact', 'Rev',
];

// Extend DRUM_ROW_COLORS to 16 entries:
const DRUM_ROW_COLORS = [
  '#ff4444', '#ffaa00', '#ffcc00', '#00d4ff',
  '#00aaff', '#9945ff', '#ff88aa', '#ff6600',
  '#ff2222', '#ffdd44', '#00ffcc', '#44aaff',
  '#cc88ff', '#ff66cc', '#ff3300', '#aaffaa',
];
```

- [ ] **Step 3: Pad legacy stepData to 16 rows when rendering**

Find where the component iterates over `stepData` rows. Add a padding step before that loop:

```typescript
// Pad stepData to always have 16 rows (non-destructive — local variable only)
const paddedStepData = pattern.stepData.length >= 16
  ? pattern.stepData
  : [
      ...pattern.stepData,
      ...Array.from({ length: 16 - pattern.stepData.length }, () =>
        Array(pattern.steps).fill(false)
      ),
    ];
```

Then use `paddedStepData` everywhere the component previously used `pattern.stepData` for rendering.

- [ ] **Step 4: Verify**

```bash
npm run build
```

Run `npm run dev`, open the Step Sequencer tab. All 16 rows should be visible with correct labels and colors. Existing patterns (8 rows) display correctly with 8 empty rows appended.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sequencer/StepSequencer.tsx
git commit -m "feat: step sequencer renders 16 drum rows, pads legacy 8-row patterns"
```

---

## Task 5: SynthPresets Library

**Files:**
- Create: `src/engine/SynthPresets.ts`

A map of 20 named `SynthSettings` presets covering leads, basses, pads, and FX. All are built from `defaultSynthSettings()` with targeted overrides. The AI generator imports this file to select presets by name; the SampleBrowser will import it in Task 6.

- [ ] **Step 1: Create `src/engine/SynthPresets.ts`**

```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run build
```

Expected: clean build. `SYNTH_PRESETS` and `PRESET_CATEGORIES` are exported, ready for import.

- [ ] **Step 3: Commit**

```bash
git add src/engine/SynthPresets.ts
git commit -m "feat: add SynthPresets library with 20 named synthesized presets"
```

---

## Task 6: SampleBrowser — Expanded Sound Library + Preset Browser

**Files:**
- Modify: `src/components/SampleBrowser/SampleBrowser.tsx`
- Modify: `src/engine/AudioEngine.ts`

Add new `Leads`, `Basses`, `Pads`, `FX Presets` categories that surface the synth presets from Task 5. Expand existing categories with more samples. Add preview support in `AudioEngine.previewDrumSound` for the new categories.

- [ ] **Step 1: Add new categories and expand existing ones in `SampleBrowser.tsx`**

In `src/components/SampleBrowser/SampleBrowser.tsx`, find the `BUILTIN_SAMPLES` const and add/expand entries:

Add these new categories after the existing ones:

```typescript
  Leads: [
    'Supersaw — 7-voice detuned saw, heavy chorus',
    'Acid Lead — resonant filter sweep, 303 style',
    'FM Bell — sine FM, metallic attack, reverb tail',
    'Reese Screech — distorted saw, aggressive filter',
    'Pluck — fast attack triangle, reverb',
    'Distorted Square — square + overdrive',
  ],
  Basses: [
    'Reese Bass — detuned saws, chorus, sub weight',
    'FM Bass — sine FM, punchy, sub emphasis',
    'Distorted Bass — square + hard drive, thick',
    'Sub Bass — pure sine, two octaves down',
    'Wobble Bass — LFO filter modulation, dubstep',
    'Portamento Bass — slow-attack glide feel',
  ],
  Pads: [
    'Choir Pad — formant saw, chorus, long reverb',
    'Lush Pad — detuned saw, heavy chorus and verb',
    'Dark Pad — minor sine, long attack, dark verb',
    'String Pad — tremolo saw, warm mid-high reverb',
  ],
  'FX Presets': [
    'Vocal Chop — bandpass sine, staccato, pitched',
    'Riser Synth — LFO filter sweep upward, verb',
    'Drop Bass — sub sine pitch drop, impact',
    'Impact Hit — sub + distortion, one-shot',
  ],
```

Also expand `Kicks` to add at least 4 more entries (append after existing 8):

```typescript
// In Kicks array, append:
    'Industrial Kick — C1 distorted punch, 300ms',
    'Electronic Kick — D1 punchy click, 220ms',
    'Deep Sub Kick — A0 heavy sub, 700ms',
    'Layered Kick — C1 click+body, 400ms',
```

And expand `Synths` with more entries:

```typescript
// In Synths array, append:
    'FM Stab — C4 frequency mod, metallic',
    'Supersaw Lead — C4-E4-G4 stacked saws',
    'Acid 303 Bass — C2 resonant sweep',
    'Reese Sub — C1 detuned saws, low',
    'Choir Chord — C4-E4-G4 vocal-like pad',
    'Dark Pad Chord — C3-Eb3-G3 minor slow',
    'Wobble Bass — C2 LFO filter 4Hz',
    'Drop Impact — C0 sub hit one-shot',
```

- [ ] **Step 2: Add category colors for new categories**

In the `CATEGORY_COLORS` object, add:

```typescript
  Leads: '#ff44ff',
  Basses: '#ff6600',
  Pads: '#44ddff',
  'FX Presets': '#ffaa00',
```

- [ ] **Step 3: Wire up preset application in `SampleBrowser.tsx`**

The SampleBrowser needs to apply a `SynthSettings` preset to the selected track when a Leads/Basses/Pads/FX Presets sample is clicked (not dragged — drag creates a note). Import what's needed:

```typescript
import { SYNTH_PRESETS } from '../../engine/SynthPresets';
import { useProjectStore } from '../../store/useProjectStore';
```

Inside the `SampleBrowser` component, add:

```typescript
const { selectedTrackId, updateSynthSettings } = useProjectStore();

const handlePresetClick = useCallback((sampleName: string) => {
  // Extract just the preset name (before ' — ')
  const presetName = sampleName.split(' — ')[0];
  const preset = SYNTH_PRESETS[presetName];
  if (preset && selectedTrackId) {
    updateSynthSettings(selectedTrackId, preset);
  }
}, [selectedTrackId, updateSynthSettings]);
```

In the sample list rendering, for preset categories call `handlePresetClick` on click instead of the existing `previewDrumSound` handler. Detect preset categories with:

```typescript
const isPresetCategory = ['Leads', 'Basses', 'Pads', 'FX Presets'].includes(selectedCategory);
```

When `isPresetCategory`, clicking a sample calls `handlePresetClick(sample.name)` AND `audioEngine.previewDrumSound(selectedCategory, idx)` for the audio preview.

- [ ] **Step 4: Add preview cases in `AudioEngine.previewDrumSound`**

In `src/engine/AudioEngine.ts`, find `previewDrumSound` and add these cases before the closing `default` or end of the switch:

```typescript
      case 'Leads': {
        const leadTypes: Array<() => void> = [
          () => { // Supersaw
            const s = new Tone.PolySynth(Tone.Synth).connect(this.masterGain);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            const ch = new Tone.Chorus(2, 3.5, 0.4).connect(this.masterGain);
            s.disconnect(); s.connect(ch);
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '4n', now, 0.5);
            setTimeout(() => { s.dispose(); ch.dispose(); }, 1500);
          },
          () => { // Acid Lead
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.2 } }).connect(this.masterGain);
            s.triggerAttackRelease('C4', '4n', now, 0.6);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // FM Bell
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.8, sustain: 0.2, release: 1.2 } }).connect(this.masterGain);
            s.triggerAttackRelease('E5', '4n', now, 0.55);
            setTimeout(() => s.dispose(), 2000);
          },
          () => { // Reese Screech
            const dist = new Tone.Distortion(0.5).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.3 } }).connect(dist);
            s.triggerAttackRelease('A4', '4n', now, 0.6);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1200);
          },
          () => { // Pluck
            const rev = new Tone.Reverb({ decay: 1.5, wet: 0.3 }).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'triangle' as const }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 } }).connect(rev);
            s.triggerAttackRelease('G4', '8n', now, 0.65);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 1000);
          },
          () => { // Distorted Square
            const dist = new Tone.Distortion(0.6).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'square' as const }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.2 } }).connect(dist);
            s.triggerAttackRelease('C5', '4n', now, 0.55);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1000);
          },
        ];
        (leadTypes[sampleIdx % leadTypes.length] ?? leadTypes[0])();
        break;
      }

      case 'Basses': {
        const bassTypes: Array<() => void> = [
          () => { // Reese Bass
            const ch = new Tone.Chorus(1, 3.5, 0.6).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 } }).connect(ch);
            s.triggerAttackRelease('C2', '4n', now, 0.75);
            setTimeout(() => { s.dispose(); ch.dispose(); }, 1200);
          },
          () => { // FM Bass
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.3 } }).connect(this.masterGain);
            s.triggerAttackRelease('C2', '4n', now, 0.8);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // Distorted Bass
            const dist = new Tone.Distortion(0.5).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'square' as const }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.2 } }).connect(dist);
            s.triggerAttackRelease('C2', '4n', now, 0.75);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1200);
          },
          () => { // Sub Bass
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.4 } }).connect(this.masterGain);
            s.triggerAttackRelease('C1', '2n', now, 0.85);
            setTimeout(() => s.dispose(), 1500);
          },
          () => { // Wobble Bass
            const filter = new Tone.Filter({ frequency: 600, type: 'lowpass', Q: 8 }).connect(this.masterGain);
            const lfo = new Tone.LFO({ frequency: 4, min: 100, max: 2000 }).connect(filter.frequency);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3 } }).connect(filter);
            lfo.start(now);
            s.triggerAttackRelease('C2', '2n', now, 0.75);
            setTimeout(() => { s.dispose(); filter.dispose(); lfo.dispose(); }, 1500);
          },
          () => { // Portamento Bass
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.4 } }).connect(this.masterGain);
            s.triggerAttackRelease('C2', '4n', now, 0.75);
            setTimeout(() => s.dispose(), 1500);
          },
        ];
        (bassTypes[sampleIdx % bassTypes.length] ?? bassTypes[0])();
        break;
      }

      case 'Pads': {
        const padTypes: Array<() => void> = [
          () => { // Choir Pad
            const rev = new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(this.masterGain);
            const ch = new Tone.Chorus(0.8, 3.5, 0.5).connect(rev);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.4, decay: 0.3, sustain: 0.85, release: 2 } }).connect(ch);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now, 0.4);
            setTimeout(() => { s.dispose(); ch.dispose(); rev.dispose(); }, 3000);
          },
          () => { // Lush Pad
            const rev = new Tone.Reverb({ decay: 5, wet: 0.7 }).connect(this.masterGain);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.5, decay: 0.4, sustain: 0.8, release: 3 } }).connect(rev);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            s.triggerAttackRelease(['C4', 'E4', 'G4', 'B4'], '2n', now, 0.35);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 4000);
          },
          () => { // Dark Pad
            const rev = new Tone.Reverb({ decay: 6, wet: 0.5 }).connect(this.masterGain);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 4 } }).connect(rev);
            s.set({ oscillator: { type: 'sine' as never } });
            s.triggerAttackRelease(['C4', 'Eb4', 'G4'], '2n', now, 0.45);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 5000);
          },
          () => { // String Pad
            const rev = new Tone.Reverb({ decay: 3, wet: 0.4 }).connect(this.masterGain);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.2, decay: 0.3, sustain: 0.75, release: 1.5 } }).connect(rev);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now, 0.4);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 2500);
          },
        ];
        (padTypes[sampleIdx % padTypes.length] ?? padTypes[0])();
        break;
      }

      case 'FX Presets': {
        const fxTypes: Array<() => void> = [
          () => { // Vocal Chop
            const filter = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 8 }).connect(this.masterGain);
            const rev = new Tone.Reverb({ decay: 1, wet: 0.3 }).connect(this.masterGain);
            filter.connect(rev);
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 } }).connect(filter);
            s.triggerAttackRelease('A4', '8n', now, 0.6);
            setTimeout(() => { s.dispose(); filter.dispose(); rev.dispose(); }, 800);
          },
          () => { // Riser
            const rev = new Tone.Reverb({ decay: 3, wet: 0.4 }).connect(this.masterGain);
            const filter = new Tone.AutoFilter({ frequency: 0.25, baseFrequency: 200, octaves: 6 }).connect(rev);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.5, decay: 0.1, sustain: 0.9, release: 0.5 } }).connect(filter);
            filter.start(now);
            s.triggerAttackRelease('C3', '2n', now, 0.5);
            setTimeout(() => { s.dispose(); filter.stop(); filter.dispose(); rev.dispose(); }, 2500);
          },
          () => { // Drop Bass
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 } }).connect(this.masterGain);
            s.triggerAttackRelease('C1', '2n', now, 0.9);
            setTimeout(() => s.dispose(), 2000);
          },
          () => { // Impact Hit
            const dist = new Tone.Distortion(0.4).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 } }).connect(dist);
            s.triggerAttackRelease('C0', '8n', now, 1.0);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1500);
          },
        ];
        (fxTypes[sampleIdx % fxTypes.length] ?? fxTypes[0])();
        break;
      }
```

- [ ] **Step 5: Verify**

```bash
npm run build
```

Run `npm run dev`. Open the Sample Browser. New categories (Leads, Basses, Pads, FX Presets) should appear. Clicking a preset in these categories should play a preview sound AND apply the preset to the selected track's synth settings.

- [ ] **Step 6: Commit**

```bash
git add src/components/SampleBrowser/SampleBrowser.tsx src/engine/AudioEngine.ts
git commit -m "feat: add Leads/Basses/Pads/FX preset categories to sample browser with synth preset application"
```

---

## Task 7: Multi-Section ClaudeSongGenerator

**Files:**
- Modify: `src/services/ClaudeSongGenerator.ts`

Replace the single-pattern generator with a two-phase API: one planner call (Claude returns a song structure), then one composer call per section. Add client-side vibe detection from prompt keywords. Export new types. Keep the old `GeneratedSong` type exported for backward compatibility (it can be removed once AIPanel is updated in Task 8).

- [ ] **Step 1: Add new types at the top of `ClaudeSongGenerator.ts`**

After the existing `NoteSchema` / `GeneratedSongSchema` block, add:

```typescript
// ─── V2 Types ───────────────────────────────────────────────────────────────

export type Vibe = 'aggressive' | 'calm' | 'happy' | 'dark' | 'neutral';

export interface SongSection {
  name: string;
  bars: number;
  energy: 'low' | 'medium' | 'high' | 'peak' | 'rising' | 'fading';
}

export interface SongPlan {
  bpm: number;
  key: GeneratedSong['key'];
  scale: GeneratedSong['scale'];
  vibe: Vibe;
  sections: SongSection[];
}

export interface SectionDrums {
  kick: boolean[];        // row 0
  snare: boolean[];       // row 1
  clap: boolean[];        // row 2
  hihat: boolean[];       // row 3
  openHihat: boolean[];   // row 4
  tom: boolean[];         // row 5
  rim: boolean[];         // row 6
  cymbal: boolean[];      // row 7
  kick2: boolean[];       // row 8
  snare2: boolean[];      // row 9
  crash: boolean[];       // row 10
  ride: boolean[];        // row 11
  tomHi: boolean[];       // row 12
  tomLo: boolean[];       // row 13
  impact: boolean[];      // row 14
  reverseSweep: boolean[];// row 15
}

export interface SectionPatterns {
  leadPreset: string;   // key in SYNTH_PRESETS
  bassPreset: string;
  padPreset: string;
  lead: { oscType: GeneratedSong['lead']['oscType']; notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> };
  bass: { oscType: GeneratedSong['bass']['oscType']; notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> };
  pad:  { oscType: GeneratedSong['pad']['oscType'];  notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> };
  drums: SectionDrums;
}

export interface GeneratedSongV2 {
  plan: SongPlan;
  sections: Array<{ name: string; patterns: SectionPatterns }>;
}
```

- [ ] **Step 2: Add `detectVibe` function**

Add after the existing `buildPrompt` function:

```typescript
// ─── Vibe detection ────────────────────────────────────────────────────────

export function detectVibe(description: string): Vibe {
  const d = description.toLowerCase();
  if (/hard|heavy|aggressive|brutal|industrial|metal|distorted|dark\s*energy|crushing|intense|angry/.test(d)) return 'aggressive';
  if (/calm|chill|ambient|soft|peaceful|meditat|lo.?fi|relax|gentle|mellow/.test(d)) return 'calm';
  if (/happy|euphoric|uplifting|rave|festival|joyful|bright|energetic|anthem|summer/.test(d)) return 'happy';
  if (/dark|sinister|evil|horror|ominous|menac|eerie|haunting|grim|bleak/.test(d)) return 'dark';
  return 'neutral';
}
```

- [ ] **Step 3: Add planner system prompt and `planSong` function**

Add after `detectVibe`:

```typescript
// ─── Planner ──────────────────────────────────────────────────────────────

const VIBE_BPM: Record<Vibe, string> = {
  aggressive: '138–175',
  calm:       '80–115',
  happy:      '125–145',
  dark:       '130–148',
  neutral:    '120–135',
};

const VIBE_SCALE: Record<Vibe, string> = {
  aggressive: 'minor or phrygian',
  calm:       'major or dorian',
  happy:      'major or mixolydian',
  dark:       'minor or phrygian (enforce minor/dark tonality)',
  neutral:    'any',
};

function buildPlannerPrompt(description: string, vibe: Vibe): string {
  return `You are a professional EDM producer. Output ONLY valid JSON — no markdown, no explanation.

Compose a song structure for: "${description}"
Detected vibe: ${vibe}
BPM range for this vibe: ${VIBE_BPM[vibe]}
Scale preference: ${VIBE_SCALE[vibe]}

Return this exact JSON:
{
  "bpm": <integer in vibe range>,
  "key": <"C"|"C#"|"D"|"D#"|"E"|"F"|"F#"|"G"|"G#"|"A"|"A#"|"B">,
  "scale": <"major"|"minor"|"dorian"|"phrygian"|"mixolydian">,
  "vibe": "${vibe}",
  "sections": [
    { "name": <section name>, "bars": <4|8|16>, "energy": <"low"|"medium"|"high"|"peak"|"rising"|"fading"> }
  ]
}

Rules:
- 4–8 sections total
- Simple prompts: 4–5 sections. Complex/full-track prompts: 6–8 sections
- Valid section names: Intro, Build, Build 1, Build 2, Drop, Drop 1, Drop 2, Breakdown, Riser, Bridge, Outro, Hook, Verse, Chorus, Pre-Drop, Interlude
- energy "low" = sparse/intro/breakdown, "medium" = building, "high"/"peak" = full drops, "rising" = riser tension, "fading" = outro
- For aggressive vibe: include Impact/Drop moments; for calm: fewer sections, longer bars`;
}

const SongPlanSchema = z.object({
  bpm: z.number().min(60).max(220),
  key: z.enum(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']),
  scale: z.enum(['major','minor','dorian','phrygian','mixolydian']),
  vibe: z.enum(['aggressive','calm','happy','dark','neutral']),
  sections: z.array(z.object({
    name: z.string().min(1),
    bars: z.number().int().min(2).max(32),
    energy: z.enum(['low','medium','high','peak','rising','fading']),
  })).min(2).max(10),
});

export async function planSong(
  apiKey: string,
  description: string,
  model: string,
  vibe: Vibe,
  onProgress: (text: string) => void,
): Promise<SongPlan> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  onProgress('Planning song structure...');

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPlannerPrompt(description, vibe) }],
  });

  const rawText = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text).join('');

  const jsonStr = extractJson(rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim());
  if (!jsonStr) throw new Error('Planner did not return JSON');

  let parsed: unknown;
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error('Planner returned invalid JSON'); }

  const result = SongPlanSchema.safeParse(parsed);
  if (!result.success) {
    // Lenient fallback
    const p = parsed as Record<string, unknown>;
    return {
      bpm: Math.max(60, Math.min(220, Math.round(Number(p.bpm ?? 128)))),
      key: (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].includes(p.key as string) ? p.key : 'A') as SongPlan['key'],
      scale: (['major','minor','dorian','phrygian','mixolydian'].includes(p.scale as string) ? p.scale : 'minor') as SongPlan['scale'],
      vibe,
      sections: Array.isArray(p.sections) && (p.sections as unknown[]).length > 0
        ? (p.sections as Array<Record<string,unknown>>).map(s => ({
            name: String(s.name ?? 'Section'),
            bars: Math.max(2, Math.min(32, Math.round(Number(s.bars ?? 8)))),
            energy: (['low','medium','high','peak','rising','fading'].includes(s.energy as string) ? s.energy : 'medium') as SongSection['energy'],
          }))
        : [{ name: 'Intro', bars: 8, energy: 'low' as const }, { name: 'Drop', bars: 8, energy: 'high' as const }, { name: 'Outro', bars: 8, energy: 'fading' as const }],
    };
  }
  return result.data;
}
```

- [ ] **Step 4: Add composer system prompts and `composeSection` function**

Add after `planSong`:

```typescript
// ─── Composer ─────────────────────────────────────────────────────────────

const VIBE_COMPOSER_HINTS: Record<Vibe, string> = {
  aggressive: 'Use hard distorted timbres (sawtooth/square), dense drums at velocity 100-127, short sharp attacks, minimal reverb. Kick and snare every beat for high/peak energy. Use kick2 (row 8) and impact (row 14) for drops.',
  calm:       'Use soft timbres (sine/triangle), sparse drums at velocity 40-70, long attacks and releases, heavy reverb on pads. Only kick/shaker/ride for low energy sections.',
  happy:      'Use bright sawtooth leads, clap-heavy drums at velocity 80-110, busy mid-high frequencies. Uplifting chord motion (I-V-vi-IV patterns preferred).',
  dark:       'Enforce minor/phrygian scale. Low-cut heavy bass, sparse dark drums. Sub and tom dominate. High reverb decay (3-6s). Velocity 60-100.',
  neutral:    'Balanced drum density, medium velocity 70-100, standard EDM patterns.',
};

const ENERGY_DRUM_HINTS: Record<SongSection['energy'], string> = {
  low:     'Sparse drums: kick on beat 1 only, maybe hihat. No snare. Drums velocity 50-70. Lead and bass: few sparse notes.',
  medium:  'Building: kick + snare on 1+3, 8th hihats, some syncopation. Velocity 70-90. 8-12 lead notes.',
  high:    'Full: 4-on-floor kick, snare on 2+4, 16th hihats, clap. Velocity 90-115. Dense 16+ lead notes.',
  peak:    'Maximum: all major drum rows active, 16th hihats + clap + open hihat accents. Velocity 100-127. Very dense notes.',
  rising:  'Riser: skip kick and snare entirely. Use only hihat building to 16th notes, maybe reverseSweep row. Lead plays ascending run.',
  fading:  'Outro: gradual removal. Keep kick + soft hihat only. Velocity drops to 40-60. Very sparse lead/bass.',
};

const PRESET_HINTS: Record<Vibe, { lead: string; bass: string; pad: string }> = {
  aggressive: { lead: 'Reese Screech or Distorted Square', bass: 'Distorted Bass or Reese Bass', pad: 'Dark Pad' },
  calm:       { lead: 'Pluck or FM Bell',                  bass: 'Sub Bass or Portamento Bass',   pad: 'Lush Pad or Choir Pad' },
  happy:      { lead: 'Supersaw or Acid Lead',             bass: 'FM Bass or Portamento Bass',    pad: 'Lush Pad' },
  dark:       { lead: 'Distorted Square or Acid Lead',     bass: 'Reese Bass or Sub Bass',        pad: 'Dark Pad' },
  neutral:    { lead: 'Supersaw or Pluck',                 bass: 'Reese Bass or FM Bass',         pad: 'Lush Pad or String Pad' },
};

function buildComposerPrompt(plan: SongPlan, section: SongSection): string {
  const steps = section.bars * 16;
  const presetHint = PRESET_HINTS[plan.vibe];
  return `You are a professional EDM producer. Output ONLY valid JSON — no markdown, no explanation.

Song context: key=${plan.key}, scale=${plan.scale}, bpm=${plan.bpm}, vibe=${plan.vibe}
Section: "${section.name}", ${section.bars} bars (${steps} steps total), energy=${section.energy}

VIBE RULES: ${VIBE_COMPOSER_HINTS[plan.vibe]}
ENERGY RULES: ${ENERGY_DRUM_HINTS[section.energy]}
Preset hints: lead="${presetHint.lead}", bass="${presetHint.bass}", pad="${presetHint.pad}"

MIDI PITCHES: Bass(36-55): C2=36 D2=38 E2=40 F2=41 G2=43 A2=45 B2=47 C3=48 D3=50 E3=52 G3=55
              Lead(60-84): C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 G5=79
              Pad(52-76): E3=52 G3=55 B3=59 C4=60 E4=64 G4=67 B4=71 C5=72

DRUM ROWS: row0=kick row1=snare row2=clap row3=hihat row4=openHihat row5=tom row6=rim row7=cymbal
           row8=kick2 row9=snare2 row10=crash row11=ride row12=tomHi row13=tomLo row14=impact row15=reverseSweep

Output this exact JSON:
{
  "leadPreset": <one of: "Supersaw","Acid Lead","FM Bell","Reese Screech","Pluck","Distorted Square">,
  "bassPreset": <one of: "Reese Bass","FM Bass","Distorted Bass","Sub Bass","Wobble Bass","Portamento Bass">,
  "padPreset":  <one of: "Choir Pad","Lush Pad","Dark Pad","String Pad">,
  "lead": { "oscType": <"sawtooth"|"square"|"sine"|"triangle">, "notes": [{"pitch":<60-84>,"startStep":<0-${steps-1}>,"duration":<1-16>,"velocity":<40-127>},...] },
  "bass": { "oscType": <"sawtooth"|"square"|"sine"|"triangle">, "notes": [{"pitch":<36-55>,"startStep":<0-${steps-1}>,"duration":<1-8>,"velocity":<40-127>},...] },
  "pad":  { "oscType": <"sawtooth"|"square"|"sine"|"triangle">, "notes": [{"pitch":<52-76>,"startStep":<0-${steps-1}>,"duration":<4-16>,"velocity":<40-127>},...] },
  "drums": {
    "kick":        [<16 true/false>], "snare":       [<16 true/false>], "clap":        [<16 true/false>],
    "hihat":       [<16 true/false>], "openHihat":   [<16 true/false>], "tom":         [<16 true/false>],
    "rim":         [<16 true/false>], "cymbal":      [<16 true/false>], "kick2":       [<16 true/false>],
    "snare2":      [<16 true/false>], "crash":       [<16 true/false>], "ride":        [<16 true/false>],
    "tomHi":       [<16 true/false>], "tomLo":       [<16 true/false>], "impact":      [<16 true/false>],
    "reverseSweep":[<16 true/false>]
  }
}

Rules: No note overlaps. Notes sorted by startStep. note[i].startStep + note[i].duration <= note[i+1].startStep.
Generate at least: low=4 notes, medium=8 notes, high=14 notes, peak=16 notes for lead.`;
}

export async function composeSection(
  apiKey: string,
  plan: SongPlan,
  section: SongSection,
  model: string,
  onProgress: (text: string) => void,
): Promise<SectionPatterns> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  onProgress(`Composing ${section.name}...`);

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildComposerPrompt(plan, section) }],
  });

  const rawText = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text).join('');

  const stripped = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
  const jsonStr = extractJson(stripped);
  if (!jsonStr) throw new Error(`Composer returned no JSON for section "${section.name}"`);

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(jsonStr) as Record<string, unknown>; }
  catch { throw new Error(`Composer returned invalid JSON for section "${section.name}"`); }

  const VALID_PRESETS_LEAD = ['Supersaw','Acid Lead','FM Bell','Reese Screech','Pluck','Distorted Square'];
  const VALID_PRESETS_BASS = ['Reese Bass','FM Bass','Distorted Bass','Sub Bass','Wobble Bass','Portamento Bass'];
  const VALID_PRESETS_PAD  = ['Choir Pad','Lush Pad','Dark Pad','String Pad'];

  const coerceDrum16 = (key: string): boolean[] => {
    const row = (parsed.drums as Record<string, unknown>)?.[key];
    return normalizeDrumRow(row);
  };

  const leadTrack = coerceTrack(parsed.lead, 60, 84);
  const bassTrack = coerceTrack(parsed.bass, 36, 55);
  const padTrack  = coerceTrack(parsed.pad,  52, 76);

  return {
    leadPreset: VALID_PRESETS_LEAD.includes(parsed.leadPreset as string) ? (parsed.leadPreset as string) : VALID_PRESETS_LEAD[0],
    bassPreset: VALID_PRESETS_BASS.includes(parsed.bassPreset as string) ? (parsed.bassPreset as string) : VALID_PRESETS_BASS[0],
    padPreset:  VALID_PRESETS_PAD.includes(parsed.padPreset  as string)  ? (parsed.padPreset  as string) : VALID_PRESETS_PAD[0],
    lead: leadTrack ?? { oscType: 'sawtooth', notes: [{ pitch: 72, startStep: 0, duration: 2, velocity: 90 }] },
    bass: bassTrack ?? { oscType: 'sawtooth', notes: [{ pitch: 48, startStep: 0, duration: 2, velocity: 100 }] },
    pad:  padTrack  ?? { oscType: 'triangle', notes: [{ pitch: 60, startStep: 0, duration: 8, velocity: 70 }] },
    drums: {
      kick:         coerceDrum16('kick'),
      snare:        coerceDrum16('snare'),
      clap:         coerceDrum16('clap'),
      hihat:        coerceDrum16('hihat'),
      openHihat:    coerceDrum16('openHihat'),
      tom:          coerceDrum16('tom'),
      rim:          coerceDrum16('rim'),
      cymbal:       coerceDrum16('cymbal'),
      kick2:        coerceDrum16('kick2'),
      snare2:       coerceDrum16('snare2'),
      crash:        coerceDrum16('crash'),
      ride:         coerceDrum16('ride'),
      tomHi:        coerceDrum16('tomHi'),
      tomLo:        coerceDrum16('tomLo'),
      impact:       coerceDrum16('impact'),
      reverseSweep: coerceDrum16('reverseSweep'),
    },
  };
}
```

- [ ] **Step 5: Add the main `generateFullSong` function**

Add at the end of the file:

```typescript
// ─── Main V2 entry point ───────────────────────────────────────────────────

export async function generateFullSong(
  apiKey: string,
  description: string,
  model: string,
  onProgress: (text: string, sectionsDone: string[]) => void,
): Promise<GeneratedSongV2> {
  const vibe = detectVibe(description);
  const sectionsDone: string[] = [];

  const plan = await planSong(apiKey, description, model, vibe, text => onProgress(text, sectionsDone));
  sectionsDone.push('structure');
  onProgress(`Structure planned: ${plan.sections.map(s => s.name).join(' → ')}`, [...sectionsDone]);

  const sections: GeneratedSongV2['sections'] = [];

  for (const section of plan.sections) {
    const patterns = await composeSection(apiKey, plan, section, model, text => onProgress(text, [...sectionsDone]));
    sections.push({ name: section.name, patterns });
    sectionsDone.push(section.name);
    onProgress(`${section.name} ✓`, [...sectionsDone]);
  }

  return { plan, sections };
}
```

- [ ] **Step 6: Verify**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add src/services/ClaudeSongGenerator.ts
git commit -m "feat: multi-section ClaudeSongGenerator with vibe detection and sequential composer calls"
```

---

## Task 8: AIPanel — Progress UI + Multi-Section Scene Creation

**Files:**
- Modify: `src/components/AITools/AIPanel.tsx`

Replace `handleGenerateSong` with a new handler that calls `generateFullSong`, shows live section-by-section progress, and rebuilds the project's scenes and patterns from the generated sections. Each section becomes a named scene with its own patterns per track.

- [ ] **Step 1: Update imports in `AIPanel.tsx`**

Replace the existing generator import:

```typescript
import { generateFullSong, detectVibe } from '../../services/ClaudeSongGenerator';
import type { GeneratedSongV2 } from '../../services/ClaudeSongGenerator';
import { SYNTH_PRESETS } from '../../engine/SynthPresets';
import { defaultPattern } from '../../types';
```

- [ ] **Step 2: Update state variables for the new progress model**

Find the existing song generator state block and add/replace:

```typescript
const [songGenerating, setSongGenerating] = useState(false);
const [songProgress, setSongProgress] = useState('');
const [sectionsDone, setSectionsDone] = useState<string[]>([]);
const [songResult, setSongResult] = useState<GeneratedSongV2 | null>(null);
const [songError, setSongError] = useState('');
const [songPlanPreview, setSongPlanPreview] = useState<string[]>([]); // section names from plan
```

- [ ] **Step 3: Update the store destructure in `AIPanel`**

Add the two new store actions to the destructure:

```typescript
const {
  project, selectedTrackId,
  updateSynthSettings, toggleStep,
  addNote, updatePattern, setBPM, play, stop, isPlaying,
  assignClipToScene, addNamedScene, addPatternToTrack,
  removeScene, updateScene,
} = useProjectStore();
```

- [ ] **Step 4: Replace `handleGenerateSong` with the new multi-section handler**

Replace the existing `handleGenerateSong` function entirely:

```typescript
  const handleGenerateSong = useCallback(async () => {
    if (!apiKey.trim()) { setSongError('Enter your Anthropic API key first.'); return; }
    if (!songPrompt.trim()) { setSongError('Describe the song you want.'); return; }

    localStorage.setItem('claude_api_key', apiKey.trim());
    localStorage.setItem('claude_model', selectedModel);

    audioEngine.start().catch(() => {});

    setSongGenerating(true);
    setSongProgress('');
    setSectionsDone([]);
    setSongPlanPreview([]);
    setSongResult(null);
    setSongError('');

    try {
      if (isPlaying) stop();

      const result = await generateFullSong(
        apiKey.trim(),
        songPrompt.trim(),
        selectedModel,
        (text, done) => {
          setSongProgress(text);
          setSectionsDone([...done]);
          // When we get section names from the plan, show them
          if (text.startsWith('Structure planned:')) {
            const names = text.replace('Structure planned: ', '').split(' → ');
            setSongPlanPreview(names);
          }
        },
      );

      const { plan, sections } = result;
      setBPM(plan.bpm);

      // ── Remove all existing scenes ──
      const existingSceneIds = [...project.scenes.map(s => s.id)];
      existingSceneIds.forEach(id => removeScene(id));

      // ── For each section: create a scene + patterns per track ──
      for (const { name, patterns } of sections) {
        const sceneId = addNamedScene(name);

        const sectionBars = result.plan.sections.find(s => s.name === name)?.bars ?? 8;
        const loopSteps = sectionBars * 16;

        // Lead track
        const leadTrack = project.tracks.find(t => t.id === 'track-lead');
        if (leadTrack) {
          const preset = SYNTH_PRESETS[patterns.leadPreset] ?? SYNTH_PRESETS['Supersaw'];
          updateSynthSettings('track-lead', preset);
          const pat = defaultPattern({ name: `${name} Lead`, steps: loopSteps, notes: patterns.lead.notes.map(n => ({ ...n, id: crypto.randomUUID() })) });
          addPatternToTrack('track-lead', pat);
          assignClipToScene(sceneId, 'track-lead', pat.id);
        }

        // Bass track
        const bassTrack = project.tracks.find(t => t.id === 'track-bass');
        if (bassTrack) {
          const preset = SYNTH_PRESETS[patterns.bassPreset] ?? SYNTH_PRESETS['Reese Bass'];
          updateSynthSettings('track-bass', preset);
          const pat = defaultPattern({ name: `${name} Bass`, steps: loopSteps, notes: patterns.bass.notes.map(n => ({ ...n, id: crypto.randomUUID() })) });
          addPatternToTrack('track-bass', pat);
          assignClipToScene(sceneId, 'track-bass', pat.id);
        }

        // Pad track
        const padTrack = project.tracks.find(t => t.id === 'track-pad');
        if (padTrack) {
          const preset = SYNTH_PRESETS[patterns.padPreset] ?? SYNTH_PRESETS['Lush Pad'];
          updateSynthSettings('track-pad', preset);
          const pat = defaultPattern({ name: `${name} Pad`, steps: loopSteps, notes: patterns.pad.notes.map(n => ({ ...n, id: crypto.randomUUID() })) });
          addPatternToTrack('track-pad', pat);
          assignClipToScene(sceneId, 'track-pad', pat.id);
        }

        // Drums track
        const drumTrack = project.tracks.find(t => t.id === 'track-drums');
        if (drumTrack) {
          const d = patterns.drums;
          const pad16 = (arr: boolean[]) => [...arr, ...Array(16).fill(false)];
          const stepData = [
            pad16(d.kick), pad16(d.snare), pad16(d.clap), pad16(d.hihat),
            pad16(d.openHihat), pad16(d.tom), pad16(d.rim), pad16(d.cymbal),
            pad16(d.kick2), pad16(d.snare2), pad16(d.crash), pad16(d.ride),
            pad16(d.tomHi), pad16(d.tomLo), pad16(d.impact), pad16(d.reverseSweep),
          ];
          const pat = defaultPattern({ name: `${name} Drums`, steps: 32, stepData });
          addPatternToTrack('track-drums', pat);
          assignClipToScene(sceneId, 'track-drums', pat.id);
        }
      }

      setSongResult(result);
      setActivePanel('session');
      setBottomPanelTab('sequencer');
      await play();

    } catch (err) {
      setSongError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setSongGenerating(false);
    }
  }, [apiKey, selectedModel, songPrompt, isPlaying, stop, setBPM,
      project.tracks, project.scenes, updateSynthSettings, addPatternToTrack,
      assignClipToScene, addNamedScene, removeScene,
      setActivePanel, setBottomPanelTab, play]);
```

- [ ] **Step 5: Update the Song tab progress display in the JSX**

Find where `songProgress` and `songResult` are rendered in the Song tab JSX. Replace the progress/result display with:

```tsx
{/* Progress */}
{songGenerating && (
  <div style={{ background: '#0a0a18', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 16px' }}>
    <div style={{ fontSize: 10, color: '#9945ff', fontFamily: 'monospace', marginBottom: 8, letterSpacing: 2 }}>
      GENERATING...
    </div>
    {songPlanPreview.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {songPlanPreview.map(name => {
          const done = sectionsDone.includes(name);
          return (
            <span key={name} style={{
              fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
              padding: '2px 8px', borderRadius: 12,
              background: done ? '#9945ff33' : '#1a1a2e',
              color: done ? '#9945ff' : '#444',
              border: `1px solid ${done ? '#9945ff' : '#2a2a3a'}`,
              transition: 'all 0.3s ease',
            }}>
              {done ? '✓ ' : ''}{name}
            </span>
          );
        })}
      </div>
    )}
    <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{songProgress}</div>
  </div>
)}

{/* Result */}
{songResult && !songGenerating && (
  <div style={{ background: '#0a1a0a', border: '1px solid #00ff8833', borderRadius: 8, padding: '12px 16px' }}>
    <div style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>
      ✓ SONG GENERATED — {songResult.plan.bpm} BPM · {songResult.plan.key} {songResult.plan.scale} · {songResult.plan.vibe}
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {songResult.sections.map(({ name }) => (
        <span key={name} style={{
          fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 12,
          background: '#9945ff33', color: '#9945ff', border: '1px solid #9945ff55',
        }}>
          {name}
        </span>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 7: Smoke test**

Run `npm run dev`. Open AI Tools → Song tab. Enter an API key and prompt like "hard aggressive dubstep". Click Generate. You should see:
- "Planning song structure..." message
- Section pills appear (Intro, Build, Drop 1, etc.) and turn purple as each completes
- After generation, session view shows the correct named scenes
- Playback starts automatically

- [ ] **Step 8: Commit**

```bash
git add src/components/AITools/AIPanel.tsx
git commit -m "feat: AI panel generates multi-section song with live progress and named scenes"
```

---

## Self-Review Checklist

- [ ] Task 1 (snapToZero): covers all rampTo calls in updateSynth ✓
- [ ] Task 2 (schema): defaultPattern creates 16 rows; addNamedScene/addPatternToTrack in store ✓
- [ ] Task 3 (DrumMachine): 16 voices; rows 0-7 unchanged (backward compat) ✓
- [ ] Task 4 (StepSequencer): pads legacy 8-row patterns; new labels/colors for rows 8-15 ✓
- [ ] Task 5 (SynthPresets): 20 presets across Leads/Basses/Pads/FX; PRESET_CATEGORIES exported ✓
- [ ] Task 6 (SampleBrowser): new categories; preview audio; preset application on click ✓
- [ ] Task 7 (Generator): detectVibe, planSong, composeSection, generateFullSong all exported; 16 drum rows in SectionDrums ✓
- [ ] Task 8 (AIPanel): removes old scenes, creates named scenes per section, progress UI ✓
