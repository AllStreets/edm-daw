# DAW Features Design — 2026-04-02

## Overview

Six independent feature areas across four components: Piano Roll enhancements, Step Sequencer selection/copy-paste, Sample Browser integration, Session View scene management, and functional audio recording.

---

## 1. Piano Roll — Rubber Band Select, Multi-Move, Copy/Paste

### Rubber Band Selection

- Active only when `tool === 'select'`
- Mousedown on empty grid space (not on a note): store `selectionDragStart: {x, y}` in a ref, set `isRubberBanding = true`
- Mousemove while rubber banding: update `selectionRect: {x1, y1, x2, y2}` state (normalized min/max)
- Render a translucent blue rectangle (`rgba(0, 180, 255, 0.15)` fill, `rgba(0, 180, 255, 0.5)` stroke) as an SVG overlay during drag
- Mouseup: compute which notes' bounding boxes intersect the rect; add their IDs to `selectedNoteIds`; clear the rect

### Multi-Note Drag (Move)

- Mousedown on any selected note body (not the resize handle): enter `type: 'move'` drag for all selected notes
- Store `origPositions: Map<noteId, {startStep, pitch}>` at drag start
- Mousemove: compute `deltaStep` and `deltaPitch` from initial mouse position; apply to all selected note originals simultaneously via `updateNote`
- Clamp: `startStep >= 0`, `pitch` within MIDI_MIN–MIDI_MAX
- Mouseup: finalize; clear drag state

### Copy / Paste

- `Cmd+C` (keydown handler): if `selectedNoteIds.size > 0`, store `clipboardNotes: Note[]` in component ref — offsets relative to the earliest `startStep` in the selection (so earliest note starts at offset 0)
- `Cmd+V`: if `clipboardNotes` is non-empty, paste by creating new notes (`crypto.randomUUID()` IDs) starting at `currentStep` from the store; if `currentStep === 0` and no playhead moved, paste at `earliestNote.startStep + loopLength` as fallback
- Pasted notes are auto-selected (replace current selection)
- `Cmd+A`: select all notes in the current pattern

---

## 2. Step Sequencer — Drag Select + Copy/Paste

### Selection Mode

- Mousedown on a step cell: record `dragStart: {row, step}`
- If the mouse moves to a different cell before mouseup: enter selection mode (do NOT toggle the start cell)
- If mouseup occurs on the same cell it started: treat as a toggle (existing behavior)
- During selection drag: track `selectionRect: {rowStart, rowEnd, stepStart, stepEnd}` — highlight selected cells with a blue tint overlay (rendered as a semi-transparent div positioned over the grid)
- Mouseup: finalize selection; selected cells stored as `selectedSteps: Set<string>` (key = `"${row}-${step}"`)

### Copy / Paste

- `Cmd+C`: copy selected step states (row, step, on/off value) into `stepClipboard` ref — offsets relative to earliest selected step column
- `Cmd+V`: paste at column 0 (or at a tracked `stepPasteCursor` that advances by clipboard width after each paste)
- Clipboard stored in component local ref (no store needed)

---

## 3. Sample Browser → Piano Roll Drop

### SampleBrowser Changes

- Each sample list item: add `draggable={true}` and `onDragStart` handler
- `dragstart` sets `dataTransfer.setData('application/x-sample', JSON.stringify({ name, defaultPitch }))` where `defaultPitch` is parsed from the sample name (e.g. "Hard Kick — C1" → MIDI 36) or defaults to 60 (middle C) if not parseable

### PianoRoll Changes

- Add `onDragOver` (prevent default to allow drop) and `onDrop` handlers to the main grid SVG
- `onDrop`: parse sample data from `dataTransfer`; call existing `getGridPos(e)` to get `{step, pitch}`; use `pitch` from drop Y position (ignoring sample's defaultPitch — user drops where they want the pitch); create note with `duration: snap`, `velocity: 100`

### Embedded Mode Fix (Sample Browser Visibility)

- Add `embedded?: boolean` prop to `PianoRoll`
- When `embedded={true}`: top-level div uses `height: 100%; display: flex; flex-direction: column` instead of `position: fixed; inset: 0; z-index: 50`
- App's `BottomPanel` passes `embedded={true}` — piano roll renders within its panel, leaving the left sidebar (with sample browser) visible

---

## 4. Session View — Scene Rename

### Store

- `project.scenes[i].name` already exists
- Add `renameScene(sceneId: string, name: string)` action to `useProjectStore`

### UI

- Scene column header: double-click on the scene name text → replace with `<input>` (auto-focused, pre-filled with current name)
- Enter or blur: call `renameScene`, revert to text display
- Escape: cancel without saving
- Track `editingSceneId: string | null` in `SessionView` local state

---

## 5. Session View — Scene Drag-Reorder

### Store

- Add `reorderScenes(fromIndex: number, toIndex: number)` action: moves scene at `fromIndex` to `toIndex`, preserving all clip assignments

### UI (mouse events, no HTML5 DnD)

- Mousedown on scene header: record `dragSceneIndex` and mouse X in refs
- Mousemove: compute which column index the mouse is over; show a vertical drop indicator line between columns
- Mouseup: call `reorderScenes(from, to)` if position changed
- Track `draggingSceneIndex: number | null` and `dropTargetIndex: number | null` in `SessionView` local state
- Visual: dragging scene header gets reduced opacity (0.5); drop indicator is a 2px bright line between column headers

---

## 6. Recording → Download

### AudioEngine

Add two methods to `AudioEngine`:

```typescript
startRecording(): void
  // Create MediaStreamDestinationNode from Tone.getContext().rawContext
  // Connect Tone.Destination to the stream destination
  // Instantiate MediaRecorder on the stream with audio/webm
  // mediaRecorder.start(); store chunks in array

stopRecording(): Promise<Blob>
  // mediaRecorder.stop()
  // Return Promise that resolves with new Blob(chunks, { type: 'audio/webm' })
  // Disconnect the stream destination node
```

### Store

- Add `isRecording: boolean` (already exists in store at line 108)
- Add `startRecording()` and `stopRecording()` actions to store
- `stopRecording` calls `audioEngine.stopRecording()`, awaits the Blob, triggers download:
  ```typescript
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recording-${Date.now()}.mp3`; // .mp3 extension, webm container
  a.click();
  URL.revokeObjectURL(url);
  ```

### Transport UI

- Record button (`●`) in `TransportBar`: calls `store.startRecording()` on click when not recording; calls `store.stopRecording()` when already recording
- Button glows red and pulses when `isRecording === true`

### Format Note

Browsers record natively as `audio/webm` (Opus codec). The file is saved with `.mp3` extension for user convenience — it opens correctly in VLC, QuickTime, and most modern players. True MP3 encoding (via `lamejs`) can be added later if strict MP3 compliance is needed.

---

## Component Map

| Feature | Files Changed |
|---|---|
| Piano Roll select/move/copy | `PianoRoll.tsx` |
| Step Seq selection/copy | `StepSequencer.tsx` |
| Sample drag to piano roll | `SampleBrowser.tsx`, `PianoRoll.tsx` |
| Piano roll embedded mode | `PianoRoll.tsx`, `App.tsx` |
| Scene rename | `SessionView.tsx`, `useProjectStore.ts` |
| Scene reorder | `SessionView.tsx`, `useProjectStore.ts` |
| Recording | `AudioEngine.ts`, `useProjectStore.ts`, `TransportBar.tsx` |

---

## Out of Scope

- True MP3 encoding (lamejs) — deferred
- Paste into a specific step position via cursor click — deferred
- Multi-track recording — deferred
