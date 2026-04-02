# DAW Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rubber-band selection/copy-paste to piano roll and step sequencer, sample drag-to-piano-roll, piano roll embedded mode (so sample browser stays visible), session view scene rename + reorder, and functional audio recording that downloads as a file when stopped.

**Architecture:** Each feature is self-contained. Piano roll gets a new `embedded` prop + rubber-band select state + clipboard ref. Step sequencer gets a selection overlay + clipboard ref. Session view gets inline rename + mouse-drag reorder. AudioEngine gets MediaRecorder wiring. All store changes are additive.

**Tech Stack:** React 18, TypeScript, Zustand + Immer, Tone.js, Web Audio API (MediaRecorder), Tailwind CSS (piano roll), inline styles (session view / transport)

---

## File Map

| File | Change |
|---|---|
| `src/components/PianoRoll/PianoRoll.tsx` | embedded prop, rubber-band, multi-move, copy-paste, drop handler |
| `src/components/Sequencer/StepSequencer.tsx` | drag-select overlay, copy-paste |
| `src/components/SessionView/SessionView.tsx` | scene rename, scene reorder |
| `src/store/useProjectStore.ts` | `reorderScenes`, `startRecording`, `stopRecording` actions; update `record()` |
| `src/engine/AudioEngine.ts` | `startRecording()`, `stopRecording()` methods |
| `src/components/Transport/TransportBar.tsx` | wire record button to new actions |

---

## Task 1: Piano Roll — Embedded Mode

**Files:**
- Modify: `src/components/PianoRoll/PianoRoll.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `embedded` prop to PianoRoll and change wrapper div**

In `src/components/PianoRoll/PianoRoll.tsx`, update the `PianoRollProps` interface and the top-level wrapper div:

```tsx
// Change interface (line ~67):
interface PianoRollProps {
  trackId: string;
  patternId: string;
  onClose: () => void;
  embedded?: boolean;
}

// Change the component signature (line ~83):
export const PianoRoll: React.FC<PianoRollProps> = ({ trackId, patternId, onClose, embedded = false }) => {

// Change the wrapper div (line ~567) from:
<div className="fixed inset-0 z-50 flex flex-col bg-[#080810]" style={{ fontFamily: 'monospace' }}>
// to:
<div
  style={{
    ...(embedded
      ? { height: '100%', display: 'flex', flexDirection: 'column', background: '#080810', fontFamily: 'monospace' }
      : { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: '#080810', fontFamily: 'monospace' }),
  }}
>
```

- [ ] **Step 2: Pass `embedded` in App.tsx BottomPanel**

In `src/App.tsx`, find the PianoRoll usage inside `BottomPanel` (~line 466) and add the prop:

```tsx
<PianoRoll
  trackId={selectedTrack.id}
  patternId={selectedPattern.id}
  onClose={() => setActiveTab('sequencer' as const)}
  embedded={true}
/>
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open Piano Roll tab. The sample browser in the left sidebar should now remain visible alongside the piano roll. The piano roll fills the bottom panel instead of covering the whole screen.

- [ ] **Step 4: Commit**

```bash
git add src/components/PianoRoll/PianoRoll.tsx src/App.tsx
git commit -m "feat: add embedded mode to PianoRoll so sample browser stays visible"
```

---

## Task 2: Piano Roll — Rubber Band Selection

**Files:**
- Modify: `src/components/PianoRoll/PianoRoll.tsx`

- [ ] **Step 1: Add rubber band state and ref**

Add these after existing state declarations (~line 95):

```tsx
// Rubber band selection
const [selectionRect, setSelectionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
const rubberBandRef = useRef<{ startX: number; startY: number } | null>(null);
```

- [ ] **Step 2: Update `handleGridMouseDown` to start rubber band when in select mode**

Find `handleGridMouseDown` (~line 182). Add a branch for the `select` tool at the start (before the `pencil` branch):

```tsx
const handleGridMouseDown = useCallback(
  (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setContextMenu(null);
    const { rawX, rawY } = getGridPos(e);

    if (tool === 'select') {
      // Start rubber band — do NOT clear selection yet (allow clicking notes separately)
      rubberBandRef.current = { startX: rawX, startY: rawY };
      setSelectionRect({ x1: rawX, y1: rawY, x2: rawX, y2: rawY });
      return;
    }

    // ... existing pencil / eraser logic unchanged below
```

- [ ] **Step 3: Add rubber band mousemove/mouseup to the existing window listener effect**

Find the `useEffect` that attaches `mousemove` / `mouseup` to `window` (~line 210). Add rubber band tracking inside `onMove` and `onUp`:

```tsx
// Inside onMove, before the existing drag type checks:
if (rubberBandRef.current) {
  const scrollEl = scrollRef.current!;
  const rect = gridRef.current!.getBoundingClientRect();
  const rawX = e.clientX - rect.left + scrollEl.scrollLeft;
  const rawY = e.clientY - rect.top + scrollEl.scrollTop;
  setSelectionRect({
    x1: rubberBandRef.current.startX,
    y1: rubberBandRef.current.startY,
    x2: rawX,
    y2: rawY,
  });
  return;
}

// Inside onUp, before the existing dragRef cleanup:
if (rubberBandRef.current && selectionRect) {
  const minX = Math.min(selectionRect.x1, selectionRect.x2);
  const maxX = Math.max(selectionRect.x1, selectionRect.x2);
  const minY = Math.min(selectionRect.y1, selectionRect.y2);
  const maxY = Math.max(selectionRect.y1, selectionRect.y2);
  const ids = new Set<string>(
    notes
      .filter(n => {
        const nx = stepToX(n.startStep, stepWidth);
        const ny = (MIDI_MAX - n.pitch) * rowHeight;
        const nw = n.duration * stepWidth;
        const nh = rowHeight;
        return nx < maxX && nx + nw > minX && ny < maxY && ny + nh > minY;
      })
      .map(n => n.id)
  );
  setSelectedNoteIds(ids);
  rubberBandRef.current = null;
  setSelectionRect(null);
  return;
}
```

Note: `selectionRect` is captured in the closure. Since the effect re-runs when `selectionRect` changes, the latest value will be available. However, to avoid stale closure issues, store the selection rect in a ref too:

```tsx
const selectionRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
```

And sync it:
```tsx
// After setSelectionRect call in onMove:
selectionRectRef.current = { x1: ..., y1: ..., x2: ..., y2: ... };

// In onUp, use selectionRectRef.current instead of selectionRect state
```

Update the `useEffect` dependency array to include `notes`, `stepWidth`, `rowHeight`.

- [ ] **Step 4: Render the rubber band rect in the SVG**

Inside the main grid `<svg>`, after `{renderNotes()}` and before the playhead line:

```tsx
{/* Rubber band selection rect */}
{selectionRect && (
  <rect
    x={Math.min(selectionRect.x1, selectionRect.x2)}
    y={Math.min(selectionRect.y1, selectionRect.y2)}
    width={Math.abs(selectionRect.x2 - selectionRect.x1)}
    height={Math.abs(selectionRect.y2 - selectionRect.y1)}
    fill="rgba(0, 180, 255, 0.1)"
    stroke="rgba(0, 180, 255, 0.6)"
    strokeWidth={1}
    style={{ pointerEvents: 'none' }}
  />
)}
```

- [ ] **Step 5: Verify**

Run `npm run dev`. Switch to Select tool in piano roll. Click and drag on empty grid space — a blue rectangle should appear and notes inside it should be selected (highlighted) on mouse release.

- [ ] **Step 6: Commit**

```bash
git add src/components/PianoRoll/PianoRoll.tsx
git commit -m "feat: add rubber-band selection to piano roll select tool"
```

---

## Task 3: Piano Roll — Multi-Note Move

**Files:**
- Modify: `src/components/PianoRoll/PianoRoll.tsx`

- [ ] **Step 1: Extend `dragRef` type to hold original positions for multiple notes**

Change the `dragRef` type definition (~line 99):

```tsx
const dragRef = useRef<{
  type: 'move' | 'resize' | 'draw';
  noteId?: string;
  startX: number;
  startY: number;
  origStart?: number;
  origPitch?: number;
  origDuration?: number;
  draftNote?: Note;
  origPositions?: Map<string, { startStep: number; pitch: number }>;
} | null>(null);
```

- [ ] **Step 2: Store origPositions for all selected notes when starting a move drag**

Find `handleNoteMouseDown` (~line 205). At the start of the `move` branch (when `!isResize`), capture all selected notes' positions:

```tsx
// Inside handleNoteMouseDown, when !isResize:
const origPositions = new Map<string, { startStep: number; pitch: number }>();
// Always include the dragged note
origPositions.set(note.id, { startStep: note.startStep, pitch: note.pitch });
// Include all other selected notes if this note is selected
if (selectedNoteIds.has(note.id)) {
  notes.forEach(n => {
    if (n.id !== note.id && selectedNoteIds.has(n.id)) {
      origPositions.set(n.id, { startStep: n.startStep, pitch: n.pitch });
    }
  });
}
dragRef.current = {
  type: 'move',
  noteId: note.id,
  startX: rawX,
  startY: rawY,
  origStart: note.startStep,
  origPitch: note.pitch,
  origPositions,
};
```

- [ ] **Step 3: Apply delta to all notes in origPositions during mousemove**

Find the `onMove` handler inside the window listener effect. In the `type === 'move'` branch, replace the single-note update with:

```tsx
if (drag.type === 'move' && drag.noteId && drag.origPositions) {
  const scrollEl = scrollRef.current!;
  const rect = gridRef.current!.getBoundingClientRect();
  const rawX = e.clientX - rect.left + scrollEl.scrollLeft;
  const rawY = e.clientY - rect.top + scrollEl.scrollTop;
  const deltaStep = Math.round((rawX - drag.startX) / stepWidth / snap) * snap;
  const deltaPitch = -Math.round((rawY - drag.startY) / rowHeight);

  drag.origPositions.forEach((orig, nid) => {
    const newStart = Math.max(0, orig.startStep + deltaStep);
    const newPitch = Math.max(MIDI_MIN, Math.min(MIDI_MAX, orig.pitch + deltaPitch));
    updateNote(trackId, patternId, nid, { startStep: newStart, pitch: newPitch });
  });
}
```

- [ ] **Step 4: Verify**

Run `npm run dev`. In piano roll, select multiple notes with rubber band, then drag any selected note — all selected notes should move together.

- [ ] **Step 5: Commit**

```bash
git add src/components/PianoRoll/PianoRoll.tsx
git commit -m "feat: multi-note drag move in piano roll"
```

---

## Task 4: Piano Roll — Copy/Paste + Select All

**Files:**
- Modify: `src/components/PianoRoll/PianoRoll.tsx`

- [ ] **Step 1: Add clipboard ref**

After the existing `velDragRef` declaration (~line 111):

```tsx
const clipboardRef = useRef<Array<{ pitch: number; startOffset: number; duration: number; velocity: number }>>([]);
```

- [ ] **Step 2: Extend the keydown effect to handle Cmd+C, Cmd+V, Cmd+A**

Find the `useEffect` with `onKey` (~line 148). Replace it with:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // Delete / Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIds.size > 0) {
      selectedNoteIds.forEach(id => removeNote(trackId, patternId, id));
      setSelectedNoteIds(new Set());
      return;
    }

    // Escape
    if (e.key === 'Escape') {
      setSelectedNoteIds(new Set());
      setContextMenu(null);
      return;
    }

    // Cmd+A — select all
    if (mod && e.key === 'a') {
      e.preventDefault();
      setSelectedNoteIds(new Set(notes.map(n => n.id)));
      return;
    }

    // Cmd+C — copy selected
    if (mod && e.key === 'c' && selectedNoteIds.size > 0) {
      e.preventDefault();
      const selected = notes.filter(n => selectedNoteIds.has(n.id));
      const earliest = Math.min(...selected.map(n => n.startStep));
      clipboardRef.current = selected.map(n => ({
        pitch: n.pitch,
        startOffset: n.startStep - earliest,
        duration: n.duration,
        velocity: n.velocity,
      }));
      return;
    }

    // Cmd+V — paste
    if (mod && e.key === 'v' && clipboardRef.current.length > 0) {
      e.preventDefault();
      // Find a non-overlapping paste position: after last existing note
      const pasteStart = notes.length > 0
        ? Math.max(...notes.map(n => n.startStep + n.duration))
        : 0;
      const newIds = new Set<string>();
      clipboardRef.current.forEach(item => {
        const newNote: Note = {
          id: crypto.randomUUID(),
          pitch: item.pitch,
          startStep: pasteStart + item.startOffset,
          duration: item.duration,
          velocity: item.velocity,
        };
        addNote(trackId, patternId, newNote);
        newIds.add(newNote.id);
      });
      setSelectedNoteIds(newIds);
      return;
    }
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [selectedNoteIds, removeNote, addNote, trackId, patternId, notes]);
```

- [ ] **Step 3: Verify**

Run `npm run dev`. In piano roll:
- Select notes with rubber band, press Cmd+A (all selected), Cmd+C (copy), Cmd+V (paste) — pasted notes appear after the last existing note and are auto-selected.

- [ ] **Step 4: Commit**

```bash
git add src/components/PianoRoll/PianoRoll.tsx
git commit -m "feat: copy/paste and select-all in piano roll (Cmd+C/V/A)"
```

---

## Task 5: Piano Roll — Sample Drop to Create Note

**Files:**
- Modify: `src/components/PianoRoll/PianoRoll.tsx`

- [ ] **Step 1: Add `onDragOver` and `onDrop` handlers**

Add these two callbacks after `handleNoteMouseEnter` (~line 314):

```tsx
const handleGridDragOver = useCallback((e: React.DragEvent<SVGSVGElement>) => {
  if (e.dataTransfer.types.includes('application/x-daw-sample')) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
}, []);

const handleGridDrop = useCallback(
  (e: React.DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-daw-sample');
    if (!raw) return;
    // Reuse getGridPos — DragEvent extends MouseEvent
    const { step, pitch } = getGridPos(e as unknown as React.MouseEvent);
    const newNote: Note = {
      id: crypto.randomUUID(),
      pitch,
      startStep: step,
      duration: snap,
      velocity: 100,
    };
    addNote(trackId, patternId, newNote);
  },
  [getGridPos, snap, addNote, trackId, patternId]
);
```

- [ ] **Step 2: Attach handlers to the grid SVG**

Find the main grid `<svg>` element (~line 741). Add the two handlers:

```tsx
<svg
  ref={gridRef}
  width={gridWidth}
  height={gridHeight}
  style={{ display: 'block', cursor: tool === 'eraser' ? 'crosshair' : tool === 'pencil' ? 'crosshair' : 'default' }}
  onMouseDown={handleGridMouseDown}
  onDragOver={handleGridDragOver}
  onDrop={handleGridDrop}
>
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Open piano roll. Open sample browser. Drag any sample from the browser list and drop it onto the piano roll grid — a note should appear at the pitch/step where it was dropped.

- [ ] **Step 4: Commit**

```bash
git add src/components/PianoRoll/PianoRoll.tsx
git commit -m "feat: drop sample from browser onto piano roll to create note"
```

---

## Task 6: Step Sequencer — Drag Selection + Copy/Paste

**Files:**
- Modify: `src/components/Sequencer/StepSequencer.tsx`

- [ ] **Step 1: Add selection state and clipboard ref**

Add after existing state declarations (~line 134):

```tsx
// Selection state
const [selAnchor, setSelAnchor] = useState<{ row: number; step: number } | null>(null);
const [selRect, setSelRect] = useState<{ rowMin: number; rowMax: number; stepMin: number; stepMax: number } | null>(null);
const stepClipboard = useRef<Array<{ row: number; stepOffset: number; on: boolean }>>([]);
const isDragSelecting = useRef(false);
```

- [ ] **Step 2: Add helper to check if a cell is within the selection**

Add this pure function inside the component before `renderStepButton`:

```tsx
const isCellSelected = (row: number, step: number): boolean => {
  if (!selRect) return false;
  return (
    row >= selRect.rowMin && row <= selRect.rowMax &&
    step >= selRect.stepMin && step <= selRect.stepMax
  );
};
```

- [ ] **Step 3: Replace `onMouseDown` in renderStepButton with drag-aware handler**

Replace `onMouseDown={() => handleToggleStep(row, step)}` in `renderStepButton` with:

```tsx
onMouseDown={(e) => {
  e.preventDefault();
  isDragSelecting.current = false;
  setSelAnchor({ row, step });
  setSelRect({ rowMin: row, rowMax: row, stepMin: step, stepMax: step });

  const onMove = (me: MouseEvent) => {
    // Once mouse moves to a different cell, enter selection mode
    isDragSelecting.current = true;
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (!isDragSelecting.current) {
      // It was a click — toggle and clear selection
      handleToggleStep(row, step);
      setSelRect(null);
      setSelAnchor(null);
    }
    isDragSelecting.current = false;
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}}
onMouseEnter={() => {
  if (selAnchor && isDragSelecting.current) {
    setSelRect({
      rowMin: Math.min(selAnchor.row, row),
      rowMax: Math.max(selAnchor.row, row),
      stepMin: Math.min(selAnchor.step, step),
      stepMax: Math.max(selAnchor.step, step),
    });
  }
}}
```

- [ ] **Step 4: Add visual highlight for selected cells**

In `renderStepButton`, add an outline style for selected cells:

```tsx
if (isCellSelected(row, step)) {
  buttonStyle.outline = '2px solid rgba(0,180,255,0.8)';
  buttonStyle.outlineOffset = '-2px';
  buttonStyle.background = buttonStyle.background ?? (isEvenGroup ? '#1a2535' : '#1e2840');
}
```

Add this block right after the `if (isCurrent)` block.

- [ ] **Step 5: Add Cmd+C / Cmd+V keydown listener**

Add a `useEffect` inside the component (after existing hooks):

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (mod && e.key === 'c' && selRect) {
      e.preventDefault();
      const items: Array<{ row: number; stepOffset: number; on: boolean }> = [];
      for (let r = selRect.rowMin; r <= selRect.rowMax; r++) {
        for (let s = selRect.stepMin; s <= selRect.stepMax; s++) {
          items.push({ row: r - selRect.rowMin, stepOffset: s - selRect.stepMin, on: stepData[r]?.[s] ?? false });
        }
      }
      stepClipboard.current = items;
      return;
    }

    if (mod && e.key === 'v' && stepClipboard.current.length > 0) {
      e.preventDefault();
      const pasteCol = selRect ? selRect.stepMin : 0;
      stepClipboard.current.forEach(({ row, stepOffset, on }) => {
        const targetStep = pasteCol + stepOffset;
        const targetRow = row;
        if (targetStep < stepCount && targetRow < 8) {
          const current = stepData[targetRow]?.[targetStep] ?? false;
          if (current !== on) toggleStep(trackId, patternId, targetRow, targetStep);
        }
      });
      return;
    }

    if (e.key === 'Escape') {
      setSelRect(null);
      setSelAnchor(null);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [selRect, stepData, stepCount, toggleStep, trackId, patternId]);
```

- [ ] **Step 6: Verify**

Run `npm run dev`. In step sequencer, click and drag across multiple step cells — they should get a blue outline selection. Press Cmd+C then Cmd+V — the pattern in the selection is pasted starting at the selection's first column.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sequencer/StepSequencer.tsx
git commit -m "feat: drag selection and copy/paste in step sequencer"
```

---

## Task 7: Session View — Scene Rename

**Files:**
- Modify: `src/components/SessionView/SessionView.tsx`

- [ ] **Step 1: Add `editingSceneId` state to `SessionView`**

Inside `SessionView` component (~line 183), after existing state:

```tsx
const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
const [editingName, setEditingName] = useState('');
```

- [ ] **Step 2: Also destructure `updateScene` from the store**

In the `useProjectStore()` destructure (~line 166):

```tsx
const {
  project,
  selectedTrackId,
  selectTrack,
  toggleMute,
  toggleSolo,
  toggleArmed,
  setTrackVolume,
  addTrack,
  addScene,
  launchScene,
  isPlaying,
  assignClipToScene,
  updateScene,   // ADD THIS
} = useProjectStore();
```

- [ ] **Step 3: Update `SceneHeaderCell` props to support rename**

Change the `SceneHeaderCellProps` interface (~line 10) and the component:

```tsx
interface SceneHeaderCellProps {
  sceneId: string;
  name: string;
  color: string;
  onLaunch: () => void;
  isEditing: boolean;
  editingName: string;
  onDoubleClick: () => void;
  onNameChange: (v: string) => void;
  onNameCommit: () => void;
  onNameCancel: () => void;
}
```

Inside `SceneHeaderCell`, replace the `<span>` that shows the name with:

```tsx
{isEditing ? (
  <input
    autoFocus
    value={editingName}
    onChange={e => onNameChange(e.target.value)}
    onBlur={onNameCommit}
    onKeyDown={e => {
      if (e.key === 'Enter') onNameCommit();
      if (e.key === 'Escape') onNameCancel();
      e.stopPropagation();
    }}
    style={{
      flex: 1,
      background: 'transparent',
      border: 'none',
      borderBottom: `1px solid ${color}`,
      color: '#fff',
      fontSize: 11,
      fontWeight: 700,
      outline: 'none',
      fontFamily: 'monospace',
      padding: 0,
      minWidth: 0,
    }}
    onClick={e => e.stopPropagation()}
  />
) : (
  <span
    style={{
      fontSize: 11,
      fontWeight: 700,
      color: hovered ? '#fff' : '#aaa',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1,
      transition: 'color 0.1s ease',
    }}
    onDoubleClick={e => { e.stopPropagation(); onDoubleClick(); }}
  >
    {name}
  </span>
)}
```

- [ ] **Step 4: Wire rename props in SessionView where SceneHeaderCell is rendered**

Find where `<SceneHeaderCell` is used in `SessionView` and update to pass all new props:

```tsx
<SceneHeaderCell
  key={scene.id}
  sceneId={scene.id}
  name={scene.name}
  color={SCENE_COLORS[si % SCENE_COLORS.length]}
  onLaunch={() => launchScene(scene.id)}
  isEditing={editingSceneId === scene.id}
  editingName={editingName}
  onDoubleClick={() => {
    setEditingSceneId(scene.id);
    setEditingName(scene.name);
  }}
  onNameChange={setEditingName}
  onNameCommit={() => {
    if (editingName.trim()) updateScene(editingSceneId!, { name: editingName.trim() });
    setEditingSceneId(null);
  }}
  onNameCancel={() => setEditingSceneId(null)}
/>
```

- [ ] **Step 5: Verify**

Run `npm run dev`. Double-click a scene header name — an input should appear. Type a new name and press Enter — it saves. Press Escape — it cancels.

- [ ] **Step 6: Commit**

```bash
git add src/components/SessionView/SessionView.tsx
git commit -m "feat: inline scene rename on double-click in session view"
```

---

## Task 8: Session View — Scene Drag-Reorder

**Files:**
- Modify: `src/store/useProjectStore.ts`
- Modify: `src/components/SessionView/SessionView.tsx`

- [ ] **Step 1: Add `reorderScenes` action to store interface**

In `src/store/useProjectStore.ts`, add to the `ProjectState` interface (~line 144, after `launchScene`):

```typescript
reorderScenes: (fromIndex: number, toIndex: number) => void;
```

- [ ] **Step 2: Implement `reorderScenes` in the store**

Add after the `launchScene` implementation (~line 504):

```typescript
reorderScenes(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  get()._pushUndo();
  set(draft => {
    const scenes = draft.project.scenes;
    const [removed] = scenes.splice(fromIndex, 1);
    scenes.splice(toIndex, 0, removed);
    draft.project.modifiedAt = new Date().toISOString();
  });
},
```

- [ ] **Step 3: Add drag-reorder state to `SessionView`**

Inside `SessionView` component, after the rename state:

```tsx
const [draggingSceneIndex, setDraggingSceneIndex] = useState<number | null>(null);
const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
const sceneDragRef = useRef<{ startX: number; index: number } | null>(null);
```

Also destructure `reorderScenes` from the store:

```tsx
reorderScenes,  // add to the useProjectStore() destructure
```

- [ ] **Step 4: Add drag handlers to `SceneHeaderCell`**

Update `SceneHeaderCellProps` to include drag callbacks:

```tsx
interface SceneHeaderCellProps {
  // ... existing props ...
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStart?: (e: React.MouseEvent) => void;
}
```

Inside `SceneHeaderCell`, wrap the outer div's style and add `onMouseDown`:

```tsx
// Add to the outer div style:
opacity: isDragging ? 0.4 : 1,
cursor: isEditing ? 'text' : 'grab',
borderLeft: isDropTarget ? '3px solid #00d4ff' : '3px solid transparent',

// Add to the outer div:
onMouseDown={e => { if (!isEditing) onDragStart?.(e); }}
```

- [ ] **Step 5: Implement drag logic in SessionView**

Add this function inside `SessionView`:

```tsx
const handleSceneDragStart = useCallback((sceneIndex: number, e: React.MouseEvent) => {
  e.preventDefault();
  setDraggingSceneIndex(sceneIndex);
  sceneDragRef.current = { startX: e.clientX, index: sceneIndex };

  const SCENE_WIDTH = 120;

  const onMove = (me: MouseEvent) => {
    if (!sceneDragRef.current) return;
    const delta = me.clientX - sceneDragRef.current.startX;
    const newIndex = Math.max(0, Math.min(
      scenes.length - 1,
      sceneDragRef.current.index + Math.round(delta / SCENE_WIDTH)
    ));
    setDropTargetIndex(newIndex);
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (sceneDragRef.current && dropTargetIndex !== null && dropTargetIndex !== sceneDragRef.current.index) {
      reorderScenes(sceneDragRef.current.index, dropTargetIndex);
    }
    setDraggingSceneIndex(null);
    setDropTargetIndex(null);
    sceneDragRef.current = null;
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}, [scenes.length, reorderScenes, dropTargetIndex]);
```

Note: `dropTargetIndex` is a state value that's captured in the closure at the time `onUp` is called. Since `onUp` is defined once per `handleSceneDragStart` call, use a ref to track the latest drop target:

```tsx
const dropTargetRef = useRef<number | null>(null);
// In onMove: dropTargetRef.current = newIndex; setDropTargetIndex(newIndex);
// In onUp: use dropTargetRef.current
```

- [ ] **Step 6: Pass drag props to SceneHeaderCell in render**

```tsx
<SceneHeaderCell
  // ... existing props ...
  isDragging={draggingSceneIndex === si}
  isDropTarget={dropTargetIndex === si && draggingSceneIndex !== null && draggingSceneIndex !== si}
  onDragStart={(e) => handleSceneDragStart(si, e)}
/>
```

- [ ] **Step 7: Verify**

Run `npm run dev`. In session view, click and drag a scene header horizontally — it should dim during drag. A blue left border appears on the target position. On release, the scenes reorder.

- [ ] **Step 8: Commit**

```bash
git add src/store/useProjectStore.ts src/components/SessionView/SessionView.tsx
git commit -m "feat: drag to reorder scenes in session view"
```

---

## Task 9: Audio Recording → File Download

**Files:**
- Modify: `src/engine/AudioEngine.ts`
- Modify: `src/store/useProjectStore.ts`
- Modify: `src/components/Transport/TransportBar.tsx`

- [ ] **Step 1: Add recording methods to AudioEngine**

In `src/engine/AudioEngine.ts`, add private recording fields to the `AudioEngine` class (after the existing private fields ~line 30):

```typescript
private mediaRecorder: MediaRecorder | null = null;
private recordingChunks: Blob[] = [];
private streamDestination: MediaStreamAudioDestinationNode | null = null;
```

Add these two methods to the class (after `stopMelodicSequencer`):

```typescript
startRecording(): void {
  this.initialize();
  const rawCtx = Tone.getContext().rawContext as AudioContext;
  this.streamDestination = rawCtx.createMediaStreamDestination();
  // Connect master limiter output to the recording destination
  this.masterLimiter.connect(this.streamDestination as unknown as Tone.ToneAudioNode);
  this.recordingChunks = [];
  this.mediaRecorder = new MediaRecorder(this.streamDestination.stream, {
    mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm',
  });
  this.mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) this.recordingChunks.push(e.data);
  };
  this.mediaRecorder.start(100); // collect chunks every 100ms
}

stopRecording(): Promise<Blob> {
  return new Promise(resolve => {
    if (!this.mediaRecorder) {
      resolve(new Blob([], { type: 'audio/webm' }));
      return;
    }
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordingChunks, { type: 'audio/webm' });
      this.recordingChunks = [];
      if (this.streamDestination) {
        try {
          this.masterLimiter.disconnect(this.streamDestination as unknown as Tone.ToneAudioNode);
        } catch { /* already disconnected */ }
        this.streamDestination = null;
      }
      this.mediaRecorder = null;
      resolve(blob);
    };
    this.mediaRecorder.stop();
  });
}
```

- [ ] **Step 2: Add `startRecording` / `stopRecording` to store interface**

In `src/store/useProjectStore.ts`, update the `ProjectState` interface. Replace the existing `record: () => void` (~line 126) with:

```typescript
record: () => void;          // keep for backward compat (toggles isRecording)
startRecording: () => void;  // starts audio capture
stopRecording: () => void;   // stops capture and triggers download
```

- [ ] **Step 3: Implement `startRecording` and `stopRecording` in store**

Replace the existing `record()` implementation (~line 289) with:

```typescript
record() {
  // Kept for backward compat; startRecording/stopRecording are preferred
  const { isRecording, startRecording, stopRecording } = get();
  if (isRecording) stopRecording();
  else startRecording();
},

startRecording() {
  audioEngine.startRecording();
  set(draft => { draft.isRecording = true; });
},

stopRecording() {
  set(draft => { draft.isRecording = false; });
  audioEngine.stopRecording().then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
},
```

- [ ] **Step 4: Update TransportBar record button**

In `src/components/Transport/TransportBar.tsx`, update the destructure to get `startRecording` and `stopRecording`:

```tsx
const { project, isPlaying, isRecording, currentStep, play, stop, pause, startRecording, stopRecording, setBPM, setActiveView, activeView } =
  useProjectStore();
```

Update `handleRecord`:

```tsx
const handleRecord = useCallback(() => {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}, [isRecording, startRecording, stopRecording]);
```

Find the record `IconBtn` in the JSX and verify it passes `pulse={isRecording}` and `active={isRecording}` — these should already be wired, but confirm:

```tsx
<IconBtn
  onClick={handleRecord}
  active={isRecording}
  activeColor="#ff3355"
  danger
  pulse={isRecording}
  title={isRecording ? 'Stop Recording' : 'Record'}
>
  ●
</IconBtn>
```

- [ ] **Step 5: Verify**

Run `npm run dev`. Press the Record button (●) — it should turn red and pulse. Press it again — a file download dialog should appear for a `.mp3` file (webm container). The file should play in VLC or QuickTime.

- [ ] **Step 6: Commit**

```bash
git add src/engine/AudioEngine.ts src/store/useProjectStore.ts src/components/Transport/TransportBar.tsx
git commit -m "feat: functional audio recording with file download on stop"
```

---

## Self-Review Checklist

- [x] Spec: Piano roll rubber-band → Task 2 ✓
- [x] Spec: Piano roll multi-move → Task 3 ✓
- [x] Spec: Piano roll copy/paste → Task 4 ✓
- [x] Spec: Sample browser visible with piano roll → Task 1 ✓
- [x] Spec: Sample drag to piano roll → Task 5 ✓
- [x] Spec: Step seq drag selection → Task 6 ✓
- [x] Spec: Step seq copy/paste → Task 6 ✓
- [x] Spec: Scene rename → Task 7 ✓
- [x] Spec: Scene reorder → Task 8 ✓
- [x] Spec: Recording → download → Task 9 ✓
- [x] Type consistency: `Note` type imported in PianoRoll already; `reorderScenes` matches store interface and implementation
- [x] `application/x-daw-sample` drag format: SampleBrowser already uses this exact key (verified in source)
- [x] `updateScene` already exists in store (line 479) — Task 7 uses it directly, no new store action needed
- [x] `masterLimiter` is a public field on AudioEngine class — accessible in `startRecording()` ✓
- [x] `selectionRectRef` needed to avoid stale closure in Task 2 — noted inline ✓
- [x] `dropTargetRef` needed to avoid stale closure in Task 8 — noted inline ✓
