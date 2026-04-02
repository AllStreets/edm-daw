import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { midiToNoteName } from '../../utils/musicTheory';
import type { Note } from '../../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const SEMITONE_HEIGHT = 18;       // px per semitone row
const STEP_WIDTH = 40;            // px per step (at zoom 1)
const STEPS_PER_BAR = 16;        // 16 steps = 1 bar (4/4 at 1/16)
const WHITE_KEY_WIDTH = 52;       // total piano keyboard width
const MIDI_MIN = 21;              // A0
const MIDI_MAX = 108;             // C8
const TOTAL_SEMITONES = MIDI_MAX - MIDI_MIN + 1;

// Black key semitones within an octave (0 = C)
const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);

const SNAP_VALUES = [4, 2, 1, 0.5] as const;
type SnapValue = (typeof SNAP_VALUES)[number];
const SNAP_LABELS: Record<SnapValue, string> = { 4: '1/4', 2: '1/8', 1: '1/16', 0.5: '1/32' };

type ToolMode = 'pencil' | 'select' | 'eraser';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isBlackKey(midi: number): boolean {
  return BLACK_KEY_OFFSETS.has(midi % 12);
}

function isCNote(midi: number): boolean {
  return midi % 12 === 0;
}

function pitchToY(midi: number): number {
  // Higher MIDI = lower Y (higher on screen)
  return (MIDI_MAX - midi) * SEMITONE_HEIGHT;
}

function yToPitch(y: number): number {
  return Math.round(MIDI_MAX - y / SEMITONE_HEIGHT);
}

function stepToX(step: number, stepWidth: number): number {
  return step * stepWidth;
}

function xToStep(x: number, stepWidth: number, snap: SnapValue): number {
  const raw = x / stepWidth;
  return Math.floor(raw / snap) * snap;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PianoRollProps {
  trackId: string;
  patternId: string;
  onClose: () => void;
  embedded?: boolean;
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  noteId: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const PianoRoll: React.FC<PianoRollProps> = ({ trackId, patternId, onClose, embedded = false }) => {
  const { project, addNote, removeNote, updateNote, currentStep } = useProjectStore();

  const track = project.tracks.find(t => t.id === trackId);
  const pattern = track?.patterns.find(p => p.id === patternId);
  const notes: Note[] = pattern?.notes ?? [];

  // ── View state ──────────────────────────────────────────────────────────────
  const [hZoom, setHZoom] = useState(1);
  const [vZoom, setVZoom] = useState(1);
  const [snap, setSnap] = useState<SnapValue>(1);
  const [tool, setTool] = useState<ToolMode>('pencil');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Rubber band selection
  const [selectionRect, setSelectionRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const rubberBandRef = useRef<{ startX: number; startY: number } | null>(null);
  const selectionRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    type: 'move' | 'resize' | 'draw';
    noteId?: string;
    startX: number;
    startY: number;
    origStart?: number;
    origPitch?: number;
    origDuration?: number;
    draftNote?: Note;
  } | null>(null);

  // ── Velocity lane drag ──────────────────────────────────────────────────────
  const velDragRef = useRef<{ noteId: string; startY: number; origVel: number } | null>(null);

  // ── Tooltip ─────────────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const gridRef = useRef<SVGSVGElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pianoColRef = useRef<HTMLDivElement>(null);

  const stepWidth = STEP_WIDTH * hZoom;
  const rowHeight = SEMITONE_HEIGHT * vZoom;
  const gridWidth = (pattern?.steps ?? 16) * STEPS_PER_BAR * stepWidth;
  const gridHeight = TOTAL_SEMITONES * rowHeight;
  const playheadX = currentStep * stepWidth;

  // Scroll to middle C on mount
  useEffect(() => {
    if (scrollRef.current) {
      const middleC = pitchToY(60) * vZoom;
      scrollRef.current.scrollTop = middleC - scrollRef.current.clientHeight / 2;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync piano column scroll with main grid scroll
  useEffect(() => {
    const grid = scrollRef.current;
    const piano = pianoColRef.current;
    if (!grid || !piano) return;
    const sync = () => { piano.scrollTop = grid.scrollTop; };
    grid.addEventListener('scroll', sync, { passive: true });
    return () => grid.removeEventListener('scroll', sync);
  }, []);

  const trackColor = track?.color ?? '#9945ff';
  const { r, g, b } = hexToRgb(trackColor);

  // ── Key down for delete ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIds.size > 0) {
        selectedNoteIds.forEach(id => removeNote(trackId, patternId, id));
        setSelectedNoteIds(new Set());
      }
      if (e.key === 'Escape') {
        setSelectedNoteIds(new Set());
        setContextMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedNoteIds, removeNote, trackId, patternId]);

  // ── Grid mouse events ────────────────────────────────────────────────────────

  const getGridPos = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!gridRef.current) return { step: 0, pitch: 60, rawX: 0, rawY: 0 };
      const rect = (gridRef.current as Element).getBoundingClientRect();
      const scrollEl = scrollRef.current!;
      const x = e.clientX - rect.left + scrollEl.scrollLeft;
      const y = e.clientY - rect.top + scrollEl.scrollTop;
      return {
        step: xToStep(x, stepWidth, snap),
        pitch: Math.max(MIDI_MIN, Math.min(MIDI_MAX, yToPitch(y / vZoom))),
        rawX: x,
        rawY: y,
      };
    },
    [stepWidth, snap, vZoom]
  );

  const handleGridMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setContextMenu(null);
      const { step, pitch, rawX, rawY } = getGridPos(e);

      if (tool === 'select') {
        rubberBandRef.current = { startX: rawX, startY: rawY };
        const rect = { x1: rawX, y1: rawY, x2: rawX, y2: rawY };
        setSelectionRect(rect);
        selectionRectRef.current = rect;
        return;
      }

      if (tool === 'pencil') {
        const newNote: Note = {
          id: crypto.randomUUID(),
          pitch,
          startStep: step,
          duration: snap,
          velocity: 100,
        };
        addNote(trackId, patternId, newNote);
        dragRef.current = {
          type: 'draw',
          noteId: newNote.id,
          startX: e.clientX,
          startY: e.clientY,
          origStart: step,
          origDuration: snap,
          draftNote: newNote,
        };
        setSelectedNoteIds(new Set([newNote.id]));
      }
    },
    [tool, getGridPos, addNote, trackId, patternId, snap]
  );

  const handleNoteMouseDown = useCallback(
    (e: React.MouseEvent, note: Note, resizing: boolean) => {
      e.stopPropagation();
      if (e.button === 0) {
        setSelectedNoteIds(new Set([note.id]));
        dragRef.current = {
          type: resizing ? 'resize' : 'move',
          noteId: note.id,
          startX: e.clientX,
          startY: e.clientY,
          origStart: note.startStep,
          origPitch: note.pitch,
          origDuration: note.duration,
        };
      }
    },
    []
  );

  const handleNoteRightClick = useCallback(
    (e: React.MouseEvent, noteId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, noteId });
    },
    []
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (rubberBandRef.current) {
        const scrollEl = scrollRef.current!;
        const svgEl = gridRef.current!;
        const rect = svgEl.getBoundingClientRect();
        const rawX = e.clientX - rect.left + scrollEl.scrollLeft;
        const rawY = e.clientY - rect.top + scrollEl.scrollTop;
        const newRect = {
          x1: rubberBandRef.current.startX,
          y1: rubberBandRef.current.startY,
          x2: rawX,
          y2: rawY,
        };
        selectionRectRef.current = newRect;
        setSelectionRect(newRect);
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const stepDelta = Math.round((dx / stepWidth) / snap) * snap;
      const pitchDelta = -Math.round(dy / rowHeight);

      if (drag.type === 'move' && drag.noteId) {
        const newStart = Math.max(0, (drag.origStart ?? 0) + stepDelta);
        const newPitch = Math.max(MIDI_MIN, Math.min(MIDI_MAX, (drag.origPitch ?? 60) + pitchDelta));
        updateNote(trackId, patternId, drag.noteId, { startStep: newStart, pitch: newPitch });
      } else if (drag.type === 'resize' && drag.noteId) {
        const newDuration = Math.max(snap, (drag.origDuration ?? snap) + stepDelta);
        updateNote(trackId, patternId, drag.noteId, { duration: newDuration });
      } else if (drag.type === 'draw' && drag.noteId) {
        const newDuration = Math.max(snap, snap + Math.round((dx / stepWidth) / snap) * snap);
        updateNote(trackId, patternId, drag.noteId, { duration: newDuration });
      }
    };

    const onMouseUp = () => {
      if (rubberBandRef.current) {
        const sr = selectionRectRef.current;
        if (sr) {
          const minX = Math.min(sr.x1, sr.x2);
          const maxX = Math.max(sr.x1, sr.x2);
          const minY = Math.min(sr.y1, sr.y2);
          const maxY = Math.max(sr.y1, sr.y2);
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
        }
        rubberBandRef.current = null;
        selectionRectRef.current = null;
        setSelectionRect(null);
        return;
      }

      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [stepWidth, rowHeight, snap, updateNote, trackId, patternId, notes]);

  // ── Velocity lane ─────────────────────────────────────────────────────────

  const velLaneHeight = 60;

  const handleVelMouseDown = useCallback(
    (e: React.MouseEvent, noteId: string, origVel: number) => {
      e.stopPropagation();
      velDragRef.current = { noteId, startY: e.clientY, origVel };
    },
    []
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = velDragRef.current;
      if (!d) return;
      const dy = d.startY - e.clientY;
      const newVel = Math.max(1, Math.min(127, Math.round(d.origVel + dy * 1.5)));
      updateNote(trackId, patternId, d.noteId, { velocity: newVel });
    };
    const onUp = () => { velDragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [updateNote, trackId, patternId]);

  // ── Erase on hover while dragging ────────────────────────────────────────────
  const handleNoteMouseEnter = useCallback(
    (_e: React.MouseEvent, noteId: string) => {
      if (tool === 'eraser' && dragRef.current?.type === 'draw') {
        removeNote(trackId, patternId, noteId);
      }
    },
    [tool, removeNote, trackId, patternId]
  );

  // ── Piano key rows ───────────────────────────────────────────────────────────

  const pianoKeys = useMemo(() => {
    const keys = [];
    for (let midi = MIDI_MAX; midi >= MIDI_MIN; midi--) {
      keys.push(midi);
    }
    return keys;
  }, []);

  // ── Grid lines ───────────────────────────────────────────────────────────────

  const totalSteps = (pattern?.steps ?? 16) * STEPS_PER_BAR;

  const renderGridLines = () => {
    const lines = [];
    for (let s = 0; s <= totalSteps; s++) {
      const x = s * stepWidth;
      const isBar = s % STEPS_PER_BAR === 0;
      const isBeat = s % 4 === 0;
      lines.push(
        <line
          key={`v${s}`}
          x1={x}
          y1={0}
          x2={x}
          y2={gridHeight}
          stroke={isBar ? '#4a4a6a' : isBeat ? '#3a3a50' : '#252535'}
          strokeWidth={isBar ? 1.5 : 0.5}
        />
      );
    }
    // Horizontal lines (semitones)
    for (let i = 0; i < TOTAL_SEMITONES; i++) {
      const midi = MIDI_MAX - i;
      const y = i * rowHeight;
      const isC = isCNote(midi);
      const isBlack = isBlackKey(midi);
      lines.push(
        <rect
          key={`row${midi}`}
          x={0}
          y={y}
          width={gridWidth}
          height={rowHeight}
          fill={
            isC
              ? 'rgba(153,69,255,0.06)'
              : isBlack
              ? 'rgba(0,0,0,0.2)'
              : 'rgba(255,255,255,0.01)'
          }
        />
      );
      if (isC) {
        lines.push(
          <text
            key={`label${midi}`}
            x={4}
            y={y + rowHeight * 0.7}
            fill="rgba(153,69,255,0.4)"
            fontSize={9}
            fontFamily="monospace"
          >
            {midiToNoteName(midi)}
          </text>
        );
      }
      lines.push(
        <line
          key={`h${midi}`}
          x1={0}
          y1={y}
          x2={gridWidth}
          y2={y}
          stroke={isC ? '#4a4a6a' : '#252535'}
          strokeWidth={isC ? 0.8 : 0.3}
        />
      );
    }
    return lines;
  };

  // ── Bar ruler ─────────────────────────────────────────────────────────────

  const renderRuler = () => {
    const marks = [];
    const barCount = pattern?.steps ?? 16;
    for (let bar = 0; bar <= barCount; bar++) {
      const x = bar * STEPS_PER_BAR * stepWidth;
      marks.push(
        <React.Fragment key={bar}>
          <line x1={x} y1={0} x2={x} y2={24} stroke="#4a4a6a" strokeWidth={1.5} />
          <text x={x + 4} y={14} fill="#9945ff" fontSize={10} fontFamily="monospace" fontWeight="bold">
            {bar + 1}
          </text>
          {/* Beat marks */}
          {[1, 2, 3].map(beat => {
            const bx = x + beat * 4 * stepWidth;
            return (
              <React.Fragment key={beat}>
                <line x1={bx} y1={12} x2={bx} y2={24} stroke="#3a3a50" strokeWidth={0.8} />
                <text x={bx + 2} y={22} fill="#555566" fontSize={8} fontFamily="monospace">
                  {beat + 1}
                </text>
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    }
    return marks;
  };

  // ── Note elements ─────────────────────────────────────────────────────────

  const renderNotes = () => {
    return notes.map(note => {
      const x = stepToX(note.startStep, stepWidth);
      const y = (MIDI_MAX - note.pitch) * rowHeight;
      const w = Math.max(4, note.duration * stepWidth - 2);
      const h = rowHeight - 1;
      const isSelected = selectedNoteIds.has(note.id);
      const velAlpha = 0.4 + (note.velocity / 127) * 0.6;

      return (
        <g key={note.id}>
          <rect
            x={x + 1}
            y={y + 0.5}
            width={w}
            height={h}
            rx={3}
            ry={3}
            fill={`rgba(${r},${g},${b},${velAlpha})`}
            stroke={isSelected ? 'white' : `rgba(${r},${g},${b},0.9)`}
            strokeWidth={isSelected ? 1.5 : 0.5}
            style={{
              filter: isSelected
                ? `drop-shadow(0 0 4px ${trackColor})`
                : `drop-shadow(0 0 2px rgba(${r},${g},${b},0.5))`,
              cursor: tool === 'eraser' ? 'crosshair' : 'grab',
            }}
            onMouseDown={e => {
              if (tool === 'eraser') {
                e.stopPropagation();
                removeNote(trackId, patternId, note.id);
              } else {
                handleNoteMouseDown(e, note, false);
              }
            }}
            onContextMenu={e => handleNoteRightClick(e, note.id)}
            onMouseEnter={e => {
              handleNoteMouseEnter(e, note.id);
              setTooltip({
                x: e.clientX,
                y: e.clientY - 32,
                text: `${midiToNoteName(note.pitch)} vel:${note.velocity}`,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
          />
          {/* Gradient overlay */}
          <rect
            x={x + 1}
            y={y + 0.5}
            width={w}
            height={Math.min(h * 0.4, 6)}
            rx={3}
            ry={3}
            fill="rgba(255,255,255,0.15)"
            style={{ pointerEvents: 'none' }}
          />
          {/* Resize handle */}
          {tool !== 'eraser' && (
            <rect
              x={x + w - 3}
              y={y + 0.5}
              width={4}
              height={h}
              rx={2}
              fill="rgba(255,255,255,0.2)"
              style={{ cursor: 'ew-resize' }}
              onMouseDown={e => handleNoteMouseDown(e, note, true)}
            />
          )}
        </g>
      );
    });
  };

  // ── Velocity lane ─────────────────────────────────────────────────────────

  const renderVelocityLane = () => {
    return notes.map(note => {
      const x = stepToX(note.startStep, stepWidth) + 1;
      const barH = (note.velocity / 127) * (velLaneHeight - 4);
      const y = velLaneHeight - barH;
      const isSelected = selectedNoteIds.has(note.id);

      return (
        <g key={note.id}>
          <rect
            x={x}
            y={y}
            width={Math.max(3, note.duration * stepWidth - 4)}
            height={barH}
            rx={2}
            fill={isSelected ? trackColor : `rgba(${r},${g},${b},0.7)`}
            style={{
              cursor: 'ns-resize',
              filter: isSelected ? `drop-shadow(0 0 3px ${trackColor})` : undefined,
            }}
            onMouseDown={e => handleVelMouseDown(e, note.id, note.velocity)}
          />
          <text
            x={x + 2}
            y={y - 2}
            fill="rgba(255,255,255,0.4)"
            fontSize={7}
            fontFamily="monospace"
          >
            {note.velocity}
          </text>
        </g>
      );
    });
  };

  // ── Clear all notes ────────────────────────────────────────────────────────
  const handleClear = () => {
    notes.forEach(n => removeNote(trackId, patternId, n.id));
    setSelectedNoteIds(new Set());
  };

  const handleQuantize = () => {
    notes.forEach(n => {
      const snapped = Math.round(n.startStep / snap) * snap;
      updateNote(trackId, patternId, n.id, { startStep: snapped });
    });
  };

  if (!track || !pattern) {
    return (
      <div style={embedded
        ? { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }
        : { position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
      }>
        <div className="text-gray-400">Pattern not found</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#080810',
        fontFamily: 'monospace',
        ...(embedded ? { height: '100%' } : { position: 'fixed', inset: 0, zIndex: 50 }),
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0d0d1a] border-b border-[#2a2a3e] flex-shrink-0 flex-wrap">
        {/* Track + pattern name */}
        <div className="flex items-center gap-2 mr-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: trackColor, boxShadow: `0 0 6px ${trackColor}` }}
          />
          <span className="text-white font-bold text-sm">{track.name}</span>
          <span className="text-gray-500">›</span>
          <span className="text-sm" style={{ color: trackColor }}>{pattern.name}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-[#3a3a50]" />

        {/* Tools */}
        {(['pencil', 'select', 'eraser'] as ToolMode[]).map(t => (
          <button
            key={t}
            onClick={() => setTool(t)}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm transition-colors ${
              tool === t
                ? 'bg-[#9945ff] border-[#9945ff] text-white'
                : 'bg-[#1a1a2e] border-[#3a3a50] text-gray-400 hover:border-[#9945ff] hover:text-white'
            }`}
          >
            {t === 'pencil' && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M10 1l3 3-8 8H2v-3L10 1z" />
              </svg>
            )}
            {t === 'select' && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M1 1l4 10 2-4 4-2L1 1z" />
              </svg>
            )}
            {t === 'eraser' && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M9 1L13 5 6 12H2L1 11 9 1zm-6 9l6-7 2 2-6 7H3l-1-2z" />
              </svg>
            )}
          </button>
        ))}

        <div className="w-px h-5 bg-[#3a3a50]" />

        {/* Zoom H */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-xs">H</span>
          <input
            type="range" min={0.25} max={4} step={0.25} value={hZoom}
            onChange={e => setHZoom(Number(e.target.value))}
            className="w-16 h-1 accent-[#9945ff]"
          />
        </div>

        {/* Zoom V */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-xs">V</span>
          <input
            type="range" min={0.5} max={3} step={0.25} value={vZoom}
            onChange={e => setVZoom(Number(e.target.value))}
            className="w-16 h-1 accent-[#00d4ff]"
          />
        </div>

        <div className="w-px h-5 bg-[#3a3a50]" />

        {/* Snap */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 text-xs">Snap</span>
          <div className="flex rounded-lg overflow-hidden border border-[#3a3a50]">
            {SNAP_VALUES.map(s => (
              <button
                key={s}
                onClick={() => setSnap(s)}
                className={`px-2 py-1 text-[10px] font-bold transition-colors ${
                  snap === s
                    ? 'bg-[#9945ff] text-white'
                    : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#252540]'
                }`}
              >
                {SNAP_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-5 bg-[#3a3a50]" />

        {/* Actions */}
        <button
          onClick={handleQuantize}
          className="px-3 py-1.5 text-xs text-gray-300 bg-[#1a1a2e] hover:bg-[#252540] border border-[#3a3a50] hover:border-[#9945ff] rounded-lg transition-colors"
        >
          Quantize
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-1.5 text-xs text-gray-300 bg-[#1a1a2e] hover:bg-[#2e1a1a] border border-[#3a3a50] hover:border-red-500 rounded-lg transition-colors"
        >
          Clear
        </button>

        <div className="ml-auto" />

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1a1a2e] hover:bg-[#2e1a1a] border border-[#3a3a50] hover:border-red-500 text-gray-400 hover:text-red-400 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* ── Main content (piano + grid) ── */}
      <div className="flex flex-1 min-h-0">
        {/* Piano keyboard column */}
        <div className="flex-shrink-0 bg-[#0a0a14] border-r border-[#2a2a3e] overflow-hidden">
          <div
            ref={pianoColRef}
            style={{
              height: gridHeight,
              width: WHITE_KEY_WIDTH,
              overflowY: 'hidden',
              position: 'relative',
            }}
          >
            <PianoKeyboard
              keys={pianoKeys}
              rowHeight={rowHeight}
              trackColor={trackColor}
            />
          </div>
        </div>

        {/* Scrollable grid area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          {/* Ruler */}
          <div
            className="flex-shrink-0 bg-[#0d0d1a] border-b border-[#2a2a3e] overflow-hidden"
            style={{ height: 28 }}
          >
            <div
              style={{
                width: gridWidth,
                height: 28,
                overflowX: 'hidden',
              }}
              id="ruler-scroll"
            >
              <svg width={gridWidth} height={28}>
                {renderRuler()}
                <line
                  x1={playheadX}
                  y1={0}
                  x2={playheadX}
                  y2={28}
                  stroke="white"
                  strokeWidth={1.5}
                  opacity={0.85}
                  style={{ pointerEvents: 'none' }}
                />
              </svg>
            </div>
          </div>

          {/* Grid + velocity lane */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto"
            style={{ minHeight: 0 }}
            onScroll={e => {
              // Sync ruler horizontal scroll
              const rulerEl = document.getElementById('ruler-scroll');
              if (rulerEl) rulerEl.scrollLeft = (e.target as HTMLDivElement).scrollLeft;
            }}
          >
            <div style={{ width: gridWidth, position: 'relative' }}>
              {/* Main grid */}
              <svg
                ref={gridRef}
                width={gridWidth}
                height={gridHeight}
                style={{ display: 'block', cursor: tool === 'eraser' ? 'crosshair' : tool === 'pencil' ? 'crosshair' : 'default' }}
                onMouseDown={handleGridMouseDown}
              >
                {renderGridLines()}
                {renderNotes()}
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
                {/* Playhead */}
                <line
                  x1={playheadX}
                  y1={0}
                  x2={playheadX}
                  y2={gridHeight}
                  stroke="white"
                  strokeWidth={1.5}
                  opacity={0.85}
                  style={{ pointerEvents: 'none' }}
                />
              </svg>

              {/* Velocity lane */}
              <div
                className="border-t border-[#2a2a3e] bg-[#0a0a14]"
                style={{ height: velLaneHeight + 16 }}
              >
                <div className="flex items-center gap-2 px-2 pt-1">
                  <span className="text-gray-500 text-[10px] tracking-widest uppercase">Velocity</span>
                </div>
                <svg
                  width={gridWidth}
                  height={velLaneHeight}
                  style={{ display: 'block' }}
                >
                  {/* Background lines */}
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <line
                      key={pct}
                      x1={0}
                      y1={velLaneHeight * (1 - pct)}
                      x2={gridWidth}
                      y2={velLaneHeight * (1 - pct)}
                      stroke="#252535"
                      strokeWidth={0.5}
                    />
                  ))}
                  {renderVelocityLane()}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-[#15152a] border border-[#3a3a50] rounded-xl shadow-2xl overflow-hidden text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {[
            {
              label: 'Delete',
              action: () => {
                removeNote(trackId, patternId, contextMenu.noteId);
                setContextMenu(null);
              },
            },
            {
              label: 'Duplicate',
              action: () => {
                const src = notes.find(n => n.id === contextMenu.noteId);
                if (src) {
                  addNote(trackId, patternId, {
                    ...src,
                    id: crypto.randomUUID(),
                    startStep: src.startStep + src.duration,
                  });
                }
                setContextMenu(null);
              },
            },
            {
              label: 'Set Velocity…',
              action: () => {
                const v = window.prompt('Velocity (1-127)', '100');
                if (v) {
                  const vel = Math.max(1, Math.min(127, parseInt(v, 10)));
                  updateNote(trackId, patternId, contextMenu.noteId, { velocity: vel });
                }
                setContextMenu(null);
              },
            },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-4 py-2 text-gray-300 hover:bg-[#9945ff] hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[70] pointer-events-none bg-[#1a1a2e] border border-[#3a3a50] text-white text-xs px-2 py-1 rounded-lg shadow-lg font-mono"
          style={{ left: tooltip.x + 12, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
};

// ─── Piano Keyboard SVG ────────────────────────────────────────────────────────

interface PianoKeyboardProps {
  keys: number[]; // midi notes, highest first
  rowHeight: number;
  trackColor: string;
}

const PianoKeyboard: React.FC<PianoKeyboardProps> = ({ keys, rowHeight, trackColor }) => {
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const totalHeight = keys.length * rowHeight;
  const whiteW = 52;
  const blackW = 30;
  const blackH = rowHeight * 0.6;

  const handleKeyClick = (midi: number) => {
    setActiveKey(midi);
    // Try to preview with Tone.js if available
    try {
      // @ts-ignore
      if (window.Tone) {
        // @ts-ignore
        const synth = new window.Tone.Synth().toDestination();
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        synth.triggerAttackRelease(freq, '8n');
      }
    } catch {
      // Tone.js not available, silently fail
    }
    setTimeout(() => setActiveKey(null), 200);
  };

  return (
    <svg
      width={whiteW}
      height={totalHeight}
      style={{ display: 'block', userSelect: 'none' }}
    >
      {keys.map((midi, idx) => {
        const y = idx * rowHeight;
        const isBlack = isBlackKey(midi);
        const isC = isCNote(midi);
        const isActive = activeKey === midi;
        const noteName = midiToNoteName(midi);

        if (isBlack) {
          return (
            <g key={midi} onClick={() => handleKeyClick(midi)} style={{ cursor: 'pointer' }}>
              <rect
                x={0}
                y={y}
                width={blackW}
                height={rowHeight}
                fill={isActive ? trackColor : '#1a1a2e'}
                stroke="#3a3a50"
                strokeWidth={0.5}
              />
              {/* Black key visual */}
              <rect
                x={1}
                y={y + 0.5}
                width={blackW - 2}
                height={blackH}
                rx={2}
                fill={isActive ? trackColor : '#111118'}
                style={{
                  filter: isActive ? `drop-shadow(0 0 4px ${trackColor})` : undefined,
                }}
              />
            </g>
          );
        }

        // White key
        return (
          <g key={midi} onClick={() => handleKeyClick(midi)} style={{ cursor: 'pointer' }}>
            <rect
              x={0}
              y={y}
              width={whiteW}
              height={rowHeight}
              fill={isActive ? `rgba(153,69,255,0.3)` : isC ? 'rgba(153,69,255,0.06)' : '#18182a'}
              stroke="#2a2a3e"
              strokeWidth={0.3}
            />
            {/* White key visual */}
            <rect
              x={blackW + 1}
              y={y + 0.5}
              width={whiteW - blackW - 2}
              height={rowHeight - 1}
              rx={2}
              fill={
                isActive
                  ? trackColor
                  : isC
                  ? 'rgba(153,69,255,0.15)'
                  : 'rgba(255,255,255,0.06)'
              }
              style={{
                filter: isActive ? `drop-shadow(0 0 4px ${trackColor})` : undefined,
              }}
            />
            {isC && (
              <text
                x={blackW + 3}
                y={y + rowHeight * 0.72}
                fill={isActive ? 'white' : 'rgba(153,69,255,0.7)'}
                fontSize={Math.max(7, rowHeight * 0.45)}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {noteName}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default PianoRoll;
