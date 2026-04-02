# AI Song Generator 2.0 — Design Spec
# 2026-04-02

## Overview

Upgrade the full song generator from a single-pattern-per-track system to a multi-section, semantically-aware generator that produces a complete named song arrangement (Intro → Build → Drop 1 → Breakdown → Riser → Drop 2 → Outro). Expand the drum machine from 8 to 16 synthesized rows. Add a named synth preset library. Fix a Tone.js parameter validation error.

---

## 1. Multi-Section Generation Architecture

### Phase 1 — Planner Call

One Claude call that returns a song structure plan:

```json
{
  "bpm": 140,
  "key": "A",
  "scale": "minor",
  "vibe": "aggressive",
  "sections": [
    { "name": "Intro",      "bars": 8, "energy": "low"    },
    { "name": "Build 1",    "bars": 8, "energy": "medium" },
    { "name": "Drop 1",     "bars": 8, "energy": "high"   },
    { "name": "Breakdown",  "bars": 8, "energy": "low"    },
    { "name": "Riser",      "bars": 4, "energy": "rising" },
    { "name": "Drop 2",     "bars": 8, "energy": "peak"   },
    { "name": "Outro",      "bars": 8, "energy": "fading" }
  ]
}
```

Claude decides how many sections to generate (typically 4–8). Simpler prompts produce fewer sections; "full festival banger" produces 7+.

### Phase 2 — Composer Calls

One Claude call per section, executed sequentially. Each call receives:
- Global context: key, BPM, scale, vibe
- Section context: name, bar count, energy level
- Vibe-specific system prompt (see Semantic Vibe Detection below)

Each call returns `{ lead, bass, pad, drums }` patterns sized to that section's bar count.

### Semantic Vibe Detection

Client-side keyword parsing of the user's prompt before any API calls:

| Keywords | Vibe |
|----------|------|
| hard, heavy, aggressive, brutal, industrial, metal, distorted | `aggressive` |
| calm, chill, ambient, soft, peaceful, meditative, lo-fi | `calm` |
| happy, euphoric, uplifting, rave, festival, joyful | `happy` |
| dark, sinister, evil, horror, ominous, menacing | `dark` |
| (default) | `neutral` |

Vibe shapes the system prompt for every section call:
- **aggressive**: BPM 138–175, sawtooth/square oscillators, dense drums at high velocity (100–127), distorted timbres, short attack/release, minimal reverb
- **calm**: BPM 80–120, sine/triangle oscillators, sparse drums at low velocity (40–80), heavy reverb, long attack/release, pad-heavy
- **happy**: BPM 125–145, bright sawtooth, clap-heavy drums, mid-high velocity (80–110), chorus, uplifting chord motion
- **dark**: BPM 130–145, minor scale enforced, low-cut filter, sub-heavy drums, phrygian/minor scales, high reverb decay
- **neutral**: BPM 120–135, no vibe override

Energy level per section also shapes the call:
- `low`: sparse notes, minimal drum rows, low velocity
- `medium`: moderate density, building elements
- `high` / `peak`: all instruments active, high velocity, dense drums
- `rising`: increasing density, ascending melodic motion
- `fading`: decreasing density, fewer active rows

### Progress UI

A live section list appears in AIPanel as each section completes:

```
Planning structure...   ✓
Composing Intro...      ✓
Composing Build 1...    ✓
Composing Drop 1...     [spinner]
...
```

### Scene Creation

After generation completes, the project is fully rebuilt:
- All existing scenes replaced with new named sections
- Each scene gets its own patterns per track (lead, bass, pad, drums)
- `assignClipToScene` wires each pattern to its scene
- BPM updated; synth settings updated per track per vibe
- Session view shows the complete arrangement immediately

---

## 2. Drum Machine Expansion — 8 → 16 Rows

All sounds are pure Tone.js synthesis — no external audio files.

| Row | Name | Synthesis |
|-----|------|-----------|
| 0 | Kick 1 | Sine pitch drop (80Hz→30Hz), punch transient |
| 1 | Kick 2 | Distorted sine + click, industrial character |
| 2 | Snare 1 | White noise burst + 200Hz body tone |
| 3 | Snare 2 | Electronic rimshot — short noise, tight decay |
| 4 | Clap | Three layered noise bursts, slight reverb |
| 5 | Hi-Hat Closed | Filtered noise, very short decay |
| 6 | Hi-Hat Open | Filtered noise, longer decay + ring |
| 7 | Crash | Long filtered noise swell, slow attack |
| 8 | Ride | Metallic sine + ring modulation |
| 9 | Tom Hi | Mid-pitch sine body, short decay |
| 10 | Tom Lo | Low-pitch sine body, medium decay |
| 11 | Shaker | Fast noise burst, high-pass filtered |
| 12 | Cowbell | Square wave + bandpass resonance |
| 13 | Sub 808 | Deep sine pitch sweep, long sustain |
| 14 | Impact | Sub thud + noise burst — for drop moments |
| 15 | Reverse Sweep | Reversed filtered noise swell — for risers |

### Schema Changes

`Pattern.stepData` expands from 8 boolean arrays to 16. Existing projects with 8-row patterns are migrated by appending 8 empty `false` arrays. The AI generator returns 16 boolean arrays; aggressive vibe activates rows 0–1 + 14; calm vibe activates only rows 0, 5, 8, 11.

### StepSequencer UI

- Rows 0–7 always visible
- Rows 8–15 shown when user expands ("Show All" toggle) or when active rows exist beyond row 7
- Row labels updated to match new names
- Row colors updated: new rows follow the existing color array pattern

---

## 3. Synth Preset Library

New file: `src/engine/SynthPresets.ts`

Exports a `SYNTH_PRESETS` map: `Record<string, SynthSettings>`. All presets are built from `defaultSynthSettings()` with targeted overrides — no new synth architecture needed.

### Leads
- **Supersaw** — oscillator type: sawtooth, detune: ±8 cents (approximated via chorus), filter cutoff: 4000Hz, chorus on
- **Acid Lead** — sawtooth, resonant filter cutoff: 800Hz, filter Q: 12, LFO on filter
- **FM Bell** — sine, short attack (0.001s), long decay (0.8s), low sustain (0.2), reverb wet: 0.5
- **Reese Screech** — sawtooth, filter cutoff: 2000Hz, distortion on, chorus on
- **Pluck** — triangle, attack: 0.001s, decay: 0.15s, sustain: 0, reverb wet: 0.3
- **Distorted Square** — square, distortion on, filter cutoff: 3000Hz

### Basses
- **Reese Bass** — sawtooth, octave: -1, filter cutoff: 400Hz, chorus on
- **Portamento Bass** — sawtooth, octave: -1, filter cutoff: 600Hz, glide/portamento effect achieved via slow filter sweep on note triggers (not a new SynthSettings field — implemented as a preset variation with slow attack)
- **FM Bass** — sine, octave: -1, attack: 0.005s, decay: 0.2s, filter cutoff: 500Hz
- **Distorted Bass** — square, octave: -1, distortion on, filter cutoff: 800Hz
- **Sub Bass** — sine, octave: -2, filter cutoff: 200Hz, no effects
- **Wobble Bass** — sawtooth, octave: -1, filter cutoff: 600Hz, LFO on filter, rate: 4Hz

### Pads
- **Choir Pad** — sawtooth, attack: 0.4s, sustain: 0.8, release: 2s, reverb wet: 0.6, chorus on, filter cutoff: 2000Hz
- **Lush Pad** — sawtooth, attack: 0.5s, release: 3s, reverb wet: 0.7, chorus on, detune
- **Dark Pad** — sine, attack: 0.6s, release: 4s, reverb wet: 0.5, filter cutoff: 800Hz
- **String Pad** — sawtooth, attack: 0.2s, release: 1.5s, tremolo, reverb wet: 0.4

### Vocals / FX
- **Vocal Chop** — sine + formant filter (bandpass at 800Hz, Q: 8), short staccato envelope, reverb wet: 0.3
- **Riser Synth** — sawtooth, filter cutoff sweeps 200Hz→8000Hz over 8 bars (via automation), reverb wet: 0.4
- **Drop Bass** — sine, octave: -2, pitch envelope drops 2 octaves in 0.5s, high velocity only
- **Impact Hit** — noise burst + sub sine, attack: 0.001s, decay: 0.3s, distortion on

### Sample Browser Integration

Presets appear in the SampleBrowser sidebar organized by category (Leads / Basses / Pads / FX). Clicking a preset applies it to the currently selected track via `updateSynthSettings`. The AI generator selects presets by name based on vibe + section role.

### Vibe → Preset Mapping (AI Generator)

| Vibe | Lead | Bass | Pad |
|------|------|------|-----|
| aggressive | Reese Screech / Distorted Square | Distorted Bass / Reese Bass | Dark Pad |
| calm | Pluck / FM Bell | Sub Bass / Portamento Bass | Lush Pad / Choir Pad |
| happy | Supersaw / Acid Lead | Portamento Bass / FM Bass | Lush Pad |
| dark | Distorted Square / Acid Lead | Reese Bass / Sub Bass | Dark Pad |
| neutral | Supersaw / Pluck | Reese Bass / FM Bass | Lush Pad / String Pad |

---

## 4. Tone.js Error Fix

**Error:** `Value must be within [0, 0], got: 1e-7`

**Cause:** Floating-point precision drift — a value that should be exactly `0` arrives as a near-zero float (e.g., `1e-7`) when passed to a Tone.js parameter whose valid range is `[0, 0]` (i.e., must be exactly zero).

**Fix:** Add utility function in `src/engine/AudioEngine.ts`:

```typescript
function snapToZero(v: number, threshold = 1e-6): number {
  return Math.abs(v) < threshold ? 0 : v;
}
```

Apply `snapToZero` to all numeric parameter values before passing to Tone.js nodes in `AudioEngine.ts` — specifically detune, pan, and any parameter that can legitimately be zero.

---

## 5. Component Map

| Area | Files |
|------|-------|
| Multi-section generator | `src/services/ClaudeSongGenerator.ts` |
| 16-row drum engine | `src/engine/DrumMachine.ts` |
| Synth preset library | `src/engine/SynthPresets.ts` (new) |
| Step sequencer UI | `src/components/Sequencer/StepSequencer.tsx` |
| Sample browser presets | `src/components/SampleBrowser/SampleBrowser.tsx` |
| AI panel progress + scene creation | `src/components/AITools/AIPanel.tsx` |
| Tone.js error fix | `src/engine/AudioEngine.ts` |
| Schema (16 drum rows + migration) | `src/store/useProjectStore.ts`, `src/types.ts` |

---

## Out of Scope

- Real audio sample import (deferred — this is for synthesized sounds only)
- True MP3 encoding (already deferred from previous sprint)
- MIDI export of generated patterns
- Multiple simultaneous song generations
