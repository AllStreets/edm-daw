# EDM•DAW Feature Expansion — Design Spec

> **For agentic workers:** Build groups in order A → B → C → D → E. Each group is independently deployable. Fix piano roll performance before implementing automation (Group D).

**Goal:** Add professional-grade audio features, sequencer enhancements, AI tools, automation, and vocal synthesis to the browser-based EDM DAW.

**Tech Stack:** React 18, TypeScript, Tone.js, Zustand+Immer, Anthropic SDK, Web Speech API

---

## Group A — Audio Engine Enhancements

### A1 — Per-Track FX Chain

**UI:** A bottom panel (Ableton device rack style) opens when the user clicks "FX" on any channel strip in the mixer. Shows the track name in the header. Contains a stacked list of effect slots. Each slot has:
- Power toggle (green dot = on, red = off)
- Effect name
- Primary wet/amount knob
- Expand chevron → reveals full parameters

**Effects available:** Reverb, Delay, Filter (LP/HP/BP), Distortion, Compressor. User clicks "+ Add Effect" to append from a dropdown. Effects can be reordered by drag handle. Removed by clicking ✕.

**Audio wiring:** Each track's signal chain currently ends at `trackGain → masterGain`. Insert a per-track `Tone.Channel` (which has send/gain built-in) and append effects in series after it. The `EffectsRack.tsx` component already exists as a stub — wire it.

**Store:** `Track.effects: Effect[]` already exists in the type system. Add audio-side initialization in `AudioEngine.createSynthTrack()` and `AudioEngine.createDrumSequencer()`. Add `audioEngine.addTrackEffect(trackId, type)`, `audioEngine.removeTrackEffect(trackId, effectId)`, `audioEngine.updateTrackEffect(trackId, effectId, params)`.

**Types:** Extend `EffectSettings` per effect type:
```typescript
interface ReverbSettings   { wet: number; decay: number; preDelay: number }
interface DelaySettings    { wet: number; time: string; feedback: number; pingPong: boolean }
interface FilterSettings   { type: 'lowpass'|'highpass'|'bandpass'; frequency: number; Q: number }
interface DistortionSettings { wet: number; distortion: number; oversample: '2x'|'4x' }
interface CompressorSettings { threshold: number; ratio: number; attack: number; release: number; knee: number }
```

**Testing:** Open FX panel, add reverb to a synth track, play — wet signal audible. Toggle power off — dry only. Remove effect — chain bypassed cleanly. No audio artifacts when adding/removing during playback.

---

### A2 — Sidechain Compression

**Auto mode (default on):** On every `play()`, the audio engine finds the kick drum track and creates a sidechain signal path: kick output feeds a `Tone.Compressor` sidechain input on every non-drum track. Default settings: threshold -20dB, ratio 8:1, attack 5ms, release 150ms. This produces the classic EDM pump.

**Store state:**
```typescript
sidechainEnabled: boolean          // global on/off, default true
sidechainAmount: number            // 0-1 maps to compressor ratio 1-20, default 0.6
sidechainRelease: number           // ms, default 150
sidechainSourceTrackId: string | null  // null = auto-detect kick
sidechainTargetOverrides: Record<string, boolean>  // trackId → included (default: all non-drum)
```

**Sidechain config page:** A "Sidechain" button in the transport bar opens a modal/panel showing:
- Global on/off toggle
- Amount knob (pump intensity)
- Release knob (how fast volume recovers)
- Source track selector (dropdown — which track triggers ducking)
- Per-target track toggles (which tracks get ducked)

**AudioEngine:** Add `setSidechainSource(trackId)`, `setSidechainTargets(trackIds)`, `setSidechainAmount(amount)`. Sidechain nodes created/destroyed on play/stop alongside sequencer setup.

**Testing:** Generate a house beat with pads. Play — pads pump in sync with kick. Disable sidechain — pump stops. Change amount to 0 — no ducking. Open config, exclude pads from sidechain — only bass ducks.

---

## Group B — Sequencer & Performance Enhancements

### B1 — Per-Step Velocity on Drums

**UI:** In the step sequencer, each drum row gets a velocity bar layer directly above it. Active steps show a colored bar whose height represents velocity (1–127). Inactive steps show no bar. Drag a bar up to increase velocity, down to decrease. Bars are 2px wide × up to 16px tall, colored to match the track color.

**Data model:** Change `Pattern.stepData` from `boolean[][]` to `number[][]`. A value of `0` = step off; `1–127` = step on with that velocity. All existing boolean patterns coerced on load: `true → 100`, `false → 0`.

**Store actions:**
- `setStepVelocity(trackId, patternId, drumRow, step, velocity: number)` — sets value 1–127
- `toggleStep` updated to toggle between 0 and 100 (default velocity) on click, preserving existing velocity on re-enable

**DrumMachine:** Update `trigger(drumIndex, time)` to `trigger(drumIndex, velocity, time)`. Pass velocity as a fraction `velocity/127` to `synth.triggerAttackRelease`.

**Testing:** Set kick step 1 to velocity 127, step 5 to velocity 40. Play — step 1 noticeably louder. Drag bar down — audio volume drops in real time. Toggle step off and back on — velocity restored to previous value.

---

### B2 — Swing / Groove

**UI:** A "Swing" knob added to the transport bar, range 0–100%, default 0. Tooltip: "Delays odd 16th notes — 50% = straight, 100% = full triplet feel". A small "%" readout shows current value. Per-pattern override: a "Swing" field in the step sequencer header (number input, blank = use global).

**Implementation:** Swing shifts odd-numbered steps using Tone.js `Transport.swingSubdivision = '16n'` and `Transport.swing = swingAmount / 100`. `Transport.swing` is global — it cannot differ per-pattern during simultaneous playback. Per-pattern swing therefore only applies during single-pattern preview mode in the step sequencer (when playing one pattern in isolation). During full song playback, the global swing value applies to all tracks.

**Store:**
```typescript
swingAmount: number          // 0-100, global
toggleSwing: (amount: number) => void
```
Pattern type gets optional `swing?: number`.

**Testing:** Set swing to 70%, play a 4-on-floor kick — kick stays straight, hihats develop shuffle feel. Set to 0 — perfectly quantized. Set per-pattern override to 30 on one pattern — only that pattern swings differently.

---

### B3 — Computer Keyboard Piano

**Trigger condition:** Only active when a synth track is selected and the piano roll or step sequencer is NOT capturing keyboard input (i.e., no text input is focused).

**Key mapping (starting C4):**
```
White keys: A=C4  S=D4  D=E4  F=F4  G=G4  H=A4  J=B4  K=C5
Black keys: W=C#4 E=D#4 T=F#4 Y=G#4 U=A#4
Octave:     Z = octave down, X = octave up
```

**UI:** A small floating keyboard indicator in the transport bar shows active keys highlighted. Displays current octave (e.g., "Oct 4").

**Implementation:** Global `keydown`/`keyup` listeners in a `useKeyboardPiano` hook. `keydown` calls `audioEngine.triggerNote(selectedTrackId, note, 100, '8n')`. `keyup` calls release. Sustain: holding multiple keys plays chords. Guard against key repeat (check `e.repeat`).

**Testing:** Select a synth track, press A — note plays. Press W — black key plays. Hold A+D — chord. Press Z — octave shifts down, A now plays C3. No notes fire when typing in a text input.

---

## Group C — Export & AI Features

### C1 — Offline WAV Export

**UI:** An "Export" button in the transport bar (floppy disk icon). Clicking it opens a small modal: "Export Song to WAV — this renders your entire song at full quality. Duration: ~{N}s. Ready?" with Export and Cancel buttons. During render, a progress bar appears. On completion, browser downloads `{project-name}-{date}.wav`.

**Implementation:** Uses `Tone.Offline(callback, duration)` where `duration` is calculated from `plan.sections.reduce((sum, s) => sum + s.bars * (60 / bpm) * 4, 0)`. Inside the offline context, rebuild all sequencers and synths identically to the live playback path. Use `blobToNormalizedWav` (already in audioUtils) to normalize before download.

**Edge cases:** If no song has been generated yet, show "Generate a song first." Export is disabled while already playing or recording.

**Testing:** Generate a song, click Export. WAV downloads in ~3 seconds. Open in macOS QuickTime — plays correctly at full quality. Duration matches the sum of section bars at the song BPM. File is normalized (not clipped, not silent).

---

### C2 — AI Clip Variation

**UI:** Right-click any occupied clip cell in the session view → context menu gains "Generate Variation..." option. Clicking opens a small inline panel below the clip showing:
- Label: "How different?"
- Slider: 0% (subtle) → 100% (full rewrite)
- "Generate" button
- Cancel

**Implementation:** Calls `composeSection` from `ClaudeSongGenerator.ts` with the existing plan context but a modified prompt instruction based on the slider value:
- 0–30%: "Make subtle variations to rhythm and velocity only. Keep the same melody contour."
- 31–70%: "Rewrite the melody with different notes but same energy and key."
- 71–100%: "Fully recompose this section. Same key, scale, and energy level only."

Result replaces the clip's pattern data via `updatePattern`. The original pattern is preserved in undo history.

**Testing:** Generate a song. Right-click a clip, set slider to 20%, generate — melody feels similar but different. Set to 90%, generate — completely new melody in same key. Undo — previous version restored.

---

### C3 — AI Auto-Mixing

**Trigger:** Runs automatically after `generateFullSong` completes. Not a blocking step — fires in the background, updates the mix settings silently.

**What it does:**
1. Sets reverb send level by track type: drums = 0%, bass = 5%, lead = 20%, pad = 40%
2. Sets sidechain amount to 0.6 (60%) and enables it
3. Sets pad track volume to -3dB relative to lead
4. Sets bass track volume to +2dB relative to lead

**UI:** After generation, a small toast appears: "AI mixed your song — reverb, sidechain, and levels set." with an "Undo Mix" button that reverts to flat settings.

**Testing:** Generate a song. Check mixer — pad reverb send is non-zero, sidechain is enabled. Click "Undo Mix" — all levels return to default. Re-generate — mix is reapplied.

---

## Group D — Automation Lanes

### D0 — Piano Roll Performance Fix (prerequisite)

**Problem:** The piano roll causes audio lag because it subscribes to `currentStep` in the Zustand store, triggering a full React re-render every 16th note during playback.

**Fix:**
1. Remove `currentStep` from the piano roll's store subscription.
2. Move the playhead position to a `useRef` + `requestAnimationFrame` loop that reads `Tone.getTransport().seconds` directly — same approach already used by the elapsed timer in TransportBar.
3. Memoize the note grid with `React.memo` and `useMemo` — only re-render when `pattern.notes` changes, not on every step.
4. The step sequencer's playhead (the column highlight) also moves to rAF.

**Testing:** Open piano roll while a song plays. No audio glitches, no latency. CPU usage in DevTools does not spike on piano roll open. Playhead moves smoothly.

---

### D1 — Automation Lanes in Piano Roll

**UI:** Below the note grid, a collapsible "Automation" section. A "+" button adds a lane. Each lane has:
- Parameter dropdown: Volume, Pan, Filter Cutoff, Filter Resonance, Reverb Wet, Delay Wet, Pitch Bend
- A canvas where clicking adds a point, dragging moves it, right-clicking removes it
- Lane height: 60px, resizable
- Points connected by straight lines (linear interpolation)
- A color-coded header matching the track color

Notes remain fully visible above — automation panel is additive, not replacing.

**Data model:** Add to `Pattern`:
```typescript
automation?: AutomationLane[]

interface AutomationLane {
  id: string
  parameter: 'volume'|'pan'|'filterCutoff'|'filterResonance'|'reverbWet'|'delayWet'|'pitch'
  points: Array<{ step: number; value: number }>  // step 0-N, value 0-1 normalized
}
```

**Playback:** In `Sequencer.startMelodic()`, after scheduling notes, iterate each automation lane and schedule `audioEngine.setTrackParam(trackId, parameter, value, time)` at each point's step time using `Tone.Transport.schedule`. Linear interpolation between points is handled by Tone.js ramp methods.

**AudioEngine:** Add `setTrackParam(trackId, param, value, time)` which maps param names to the correct Tone.js node and calls `.rampTo(value, 0.01, time)`.

**Testing:** Add a filter cutoff automation lane to a lead synth. Draw a sweep from low to high over 16 steps. Play — filter opens audibly. Delete a point — curve updates in real time. Add a second lane for volume — both apply simultaneously.

---

## Group E — Vocals

### E1 — Lyric Generation

**UI:** In the AI Tools panel, a new "Vocals" tab. Shows a textarea pre-filled with Claude-generated lyrics after a song is generated. User can edit freely. Below: "Render Vocals" button and a disabled "Use AI Singing (coming soon)" button with tooltip.

**Lyric generation:** After `generateFullSong`, an additional Claude call generates lyrics structured to match the section names (Intro, Verse, Drop, etc.). Prompt includes the song BPM, key, vibe, and section list. Output is plain text, one section per block.

**Store:** Add `generatedLyrics: string` and `setLyrics(text: string)` to `useAIStore`.

---

### E2 — Vocal Audio Synthesis

**Implementation:**
1. Split lyrics into sections matching song sections.
2. For each section, use `window.speechSynthesis.speak(utterance)` with rate set proportionally to BPM and pitch set to a mid value.
3. Capture the audio output via `navigator.mediaDevices.getUserMedia` with loopback, or use a `ScriptProcessorNode` workaround to capture `SpeechSynthesis` output into an `AudioBuffer`.
4. Apply `Tone.PitchShift` to snap the vocal to the song's root key.
5. Place the resulting audio as a new `audio` track in the session view, assigned to the appropriate scenes.

**Known limitation:** Browser `SpeechSynthesis` audio capture is not natively supported — the implementation will use a `MediaRecorder` on a loopback `AudioContext` destination. This may require the user to enable a browser permission. A clear error message is shown if capture fails, with a fallback to download the speech as a WAV and import it manually.

**Future path (E-v2):** The "Use AI Singing" button is wired to a `VocalSynthProvider` interface. When a singing API (ElevenLabs Turbo v3 / Suno vocal endpoint) becomes available, implement `ElevenLabsVocalProvider` or `SunoVocalProvider` implementing the same interface. Zero changes to the UI or store.

**Testing:** Generate a song. Go to Vocals tab. Edit lyrics. Click "Render Vocals." A new audio track appears in the session view. Play — vocal audio plays with the music. Pitch shift adjusts to song key. Fallback message appears correctly if browser capture fails.

---

## Implementation Order

1. **D0** — Piano roll performance fix (unblocks all playback testing)
2. **A1** — Per-track FX chain (biggest audio quality win)
3. **A2** — Sidechain compression (automatic pump effect)
4. **B1** — Per-step velocity (drum humanization)
5. **B2** — Swing/groove
6. **B3** — Keyboard piano
7. **C1** — WAV export
8. **C2** — AI clip variation
9. **C3** — AI auto-mixing
10. **D1** — Automation lanes
11. **E1** — Lyric generation
12. **E2** — Vocal audio synthesis
