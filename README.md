# EDM•DAW

A fully browser-based EDM digital audio workstation built with React, Tone.js, and the Claude API.

## Features

- **Session View** — Ableton-style clip launcher with scenes, right-click variation generation
- **Step Sequencer** — 16-step drum grid with per-step velocity and swing/groove
- **Piano Roll** — MIDI note editor with automation lanes (volume, pan, filter, reverb, delay, pitch)
- **Synth Engine** — Polyphonic synthesizer with oscillator, filter, envelope, LFO, unison, and built-in FX
- **Mixer** — Per-track channel strips with volume, pan, mute/solo, send FX, and sidechain compression
- **FX Chain** — Per-track effects rack (distortion, bitcrusher, chorus, phaser, EQ)
- **Sample Browser** — Load and preview audio samples with drag-to-track support
- **AI Song Generator** — Claude composes full multi-section songs (lead, bass, pad, drums) from a text prompt
- **AI Clip Variation** — Regenerate any clip with a subtle-to-full-rewrite slider
- **AI Auto-Mix** — Automatically sets track levels, reverb sends, and sidechain after generation
- **AI Lyrics + Vocals** — Claude writes lyrics; Web Speech API reads them back at song BPM
- **WAV Export** — Bounce the full song to a normalized stereo WAV file
- **Computer Keyboard Piano** — Play synth notes from A–K keys, Z/X for octave shift
- **Undo/Redo** — Full project history with keyboard shortcuts

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19, TypeScript |
| Build | Vite 8 |
| Audio | Tone.js 15 |
| State | Zustand 5 + Immer |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Validation | Zod |
| UI Primitives | Radix UI (Tabs, Slider, Select, Tooltip, ContextMenu) |

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. On first launch, enter your Anthropic API key in the AI panel to enable song generation.

```bash
npm run build   # production build
npm run preview # preview production build locally
```

## Project Structure

```
src/
├── main.tsx                        # React entry point
├── App.tsx                         # Root layout — view routing and panel arrangement
│
├── engine/                         # Audio engine (no React, no store imports)
│   ├── AudioEngine.ts              # Singleton: Tone.js graph, track routing, FX, sidechain
│   ├── Sequencer.ts                # Tone.Sequence wrapper for both drum and melodic tracks
│   ├── DrumMachine.ts              # Per-voice drum synthesis (kick, snare, hat, etc.)
│   ├── SynthEngine.ts              # Polyphonic synth chain (osc → filter → env → FX)
│   └── SynthPresets.ts             # Named preset bank for SynthEngine
│
├── services/
│   └── ClaudeSongGenerator.ts      # Claude API calls: song plan, section composition,
│                                   #   variation, lyric generation
│
├── store/                          # Zustand stores
│   ├── useProjectStore.ts          # Main project state: tracks, patterns, scenes, playback,
│                                   #   undo/redo, AI actions (applyAIMix, generateClipVariation)
│   ├── useAIStore.ts               # AI panel state: prompt, progress, generated song, lyrics
│   └── useUIStore.ts               # UI-only state: active view, open panels, selection
│
├── types/
│   └── index.ts                    # Shared TypeScript types: Track, Pattern, Note,
│                                   #   AutomationLane, AutomationPoint, FXChain, etc.
│
├── components/
│   ├── AITools/
│   │   ├── AIPanel.tsx             # Tabbed AI panel (Generate, Mix, Lyrics, Vocals)
│   │   └── VocalsTab.tsx           # Lyric display + Web Speech API playback
│   │
│   ├── Effects/
│   │   ├── EffectsRack.tsx         # Full effects rack modal
│   │   └── FXChainPanel.tsx        # Inline per-track FX chain strip
│   │
│   ├── Meters/
│   │   ├── LevelMeter.tsx          # VU meter bar
│   │   ├── Oscilloscope.tsx        # Canvas waveform display
│   │   └── SpectrumAnalyzer.tsx    # Canvas FFT spectrum display
│   │
│   ├── Mixer/
│   │   ├── Mixer.tsx               # Mixer view — renders all channel strips
│   │   └── ChannelStrip.tsx        # Per-track fader, pan, mute/solo, sends
│   │
│   ├── PianoRoll/
│   │   └── PianoRoll.tsx           # MIDI note editor + automation lane editor
│   │
│   ├── SampleBrowser/
│   │   └── SampleBrowser.tsx       # File picker, preview player, drag-to-track
│   │
│   ├── Sequencer/
│   │   ├── StepSequencer.tsx       # Drum step grid with velocity bars
│   │   └── PatternChainer.tsx      # Pattern arrangement / chain editor
│   │
│   ├── SessionView/
│   │   ├── SessionView.tsx         # Clip launcher grid (scenes × tracks)
│   │   └── ClipCell.tsx            # Single clip cell with context menu + variation panel
│   │
│   ├── Synth/
│   │   ├── SynthEditor.tsx         # Full synth editor modal
│   │   ├── OscillatorSection.tsx   # Waveform, detune, octave controls
│   │   ├── FilterSection.tsx       # Filter type, cutoff, resonance
│   │   ├── EnvelopeSection.tsx     # ADSR controls
│   │   ├── LFOSection.tsx          # LFO rate, depth, target
│   │   ├── UnisonSection.tsx       # Unison voices, spread, detune
│   │   ├── SynthFXSection.tsx      # Synth-level reverb, delay, distortion
│   │   ├── Knob.tsx                # Reusable rotary knob component
│   │   └── index.ts                # Re-exports
│   │
│   ├── TrackList/
│   │   └── TrackHeader.tsx         # Track name, type badge, add-track controls
│   │
│   └── Transport/
│       ├── TransportBar.tsx        # Play/stop/record, BPM, time sig, swing, key/export
│       └── SidechainPanel.tsx      # Sidechain source routing and amount control
│
├── hooks/
│   ├── useAnimationFrame.ts        # rAF loop hook for meter/oscilloscope polling
│   ├── useKeyboardPiano.ts         # A–K key → MIDI note mapping
│   └── useKeyboardShortcuts.ts     # Global shortcuts (space, cmd+z, cmd+s, etc.)
│
├── data/
│   └── presets.ts                  # Built-in synth preset definitions
│
└── utils/
    ├── audioUtils.ts               # WAV encoding, buffer helpers
    └── musicTheory.ts              # Scale/chord/note name utilities
```

## Architecture Notes

**Audio engine isolation** — `src/engine/` has no React or Zustand imports. Components call `audioEngine.*` methods directly for real-time audio changes (volume, FX) and update Zustand separately for persistence. This keeps the audio graph deterministic and avoids React render overhead in the audio path.

**Automation** — Automation lanes live on `Pattern.automation?: AutomationLane[]`. Both `Sequencer.start()` (drums) and `Sequencer.startMelodic()` (synths) accept an `applyAutomation` callback that fires `AudioEngine.setTrackParam()` per step.

**Undo/Redo** — `useProjectStore._pushUndo()` snapshots the full project state before any mutation. Undo pops the snapshot stack; redo pushes the current state before restoring. The AI auto-mix pushes a snapshot so the entire mix can be reverted in one step.

**AI song structure** — `ClaudeSongGenerator` returns `GeneratedSongV2 { plan: SongPlan, sections: SectionData[] }`. Each `SectionData` holds four pattern sets (`lead`, `bass`, `pad`, `drums`). The store maps these onto the project's track list by name matching at generation time.
