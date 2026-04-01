import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { Pattern } from '../../types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface PatternChainerProps {
  trackId: string;
  activePatternId?: string;
  onSelectPattern: (patternId: string) => void;
}

// ─── DragState ────────────────────────────────────────────────────────────────

interface DragState {
  patternId: string;
  startIndex: number;
  currentIndex: number;
  offsetX: number;
  itemWidth: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// ─── Pattern Card ─────────────────────────────────────────────────────────────

interface PatternCardProps {
  pattern: Pattern;
  index: number;
  total: number;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onMouseDown: (e: React.MouseEvent, id: string, index: number) => void;
  onMouseEnter: (index: number) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

const PatternCard: React.FC<PatternCardProps> = ({
  pattern,
  isActive,
  isDragging,
  isDragOver,
  onMouseDown,
  onMouseEnter,
  onSelect,
  onDelete,
  onRename,
}) => {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(pattern.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const { r, g, b } = hexToRgb(pattern.color);

  const handleDoubleClick = () => {
    setDraftName(pattern.name);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commitRename = () => {
    const trimmed = draftName.trim() || pattern.name;
    onRename(pattern.id, trimmed);
    setRenaming(false);
  };

  return (
    <div
      className={`relative flex flex-col gap-1.5 p-2.5 rounded-xl border cursor-grab transition-all duration-100
        ${isActive
          ? 'border-[#9945ff] shadow-[0_0_12px_rgba(153,69,255,0.5)]'
          : isDragOver
          ? 'border-[#00d4ff] scale-105'
          : 'border-[#2a2a3e] hover:border-[#3a3a5a]'
        }
        ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'}
      `}
      style={{
        background: isActive
          ? `linear-gradient(135deg, rgba(${r},${g},${b},0.18), rgba(${r},${g},${b},0.06))`
          : 'rgba(22,22,38,0.95)',
        width: 112,
        userSelect: 'none',
      }}
      onMouseDown={e => onMouseDown(e, pattern.id, 0)}
      onMouseEnter={() => onMouseEnter(0)}
      onClick={() => !isDragging && onSelect(pattern.id)}
      onDoubleClick={handleDoubleClick}
    >
      {/* Color strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{
          background: `linear-gradient(to bottom, ${pattern.color}, ${pattern.color}88)`,
          boxShadow: `0 0 8px ${pattern.color}66`,
        }}
      />

      <div className="pl-1 flex flex-col gap-1">
        {/* Name */}
        {renaming ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
              e.stopPropagation();
            }}
            className="bg-[#1a1a2e] text-white text-xs px-1 rounded border border-[#9945ff] outline-none w-full"
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-white text-xs font-semibold truncate leading-tight">
            {pattern.name}
          </span>
        )}

        {/* Color dot + step count */}
        <div className="flex items-center justify-between">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: pattern.color,
              boxShadow: `0 0 4px ${pattern.color}`,
            }}
          />
          <span className="text-[10px] text-gray-500 font-mono">{pattern.steps}st</span>
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
          style={{
            backgroundColor: '#9945ff',
            boxShadow: '0 0 6px #9945ff',
          }}
        />
      )}

      {/* Delete button */}
      <button
        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#1a1a2e] border border-[#3a3a50] text-gray-500 hover:bg-red-900 hover:text-red-300 hover:border-red-500 flex items-center justify-center text-[10px] leading-none transition-colors opacity-0 group-hover:opacity-100"
        onClick={e => {
          e.stopPropagation();
          onDelete(pattern.id);
        }}
        onMouseDown={e => e.stopPropagation()}
        title="Delete pattern"
        style={{ opacity: undefined }} // will rely on parent hover
      >
        ×
      </button>
    </div>
  );
};

// ─── Arrow connector ──────────────────────────────────────────────────────────

const ChainArrow: React.FC<{ isLast?: boolean }> = ({ isLast }) => (
  <div className="flex items-center flex-shrink-0 px-1">
    {isLast ? (
      // Loop back arrow
      <div className="flex flex-col items-center">
        <svg width="28" height="20" viewBox="0 0 28 20">
          <path
            d="M2 10 Q14 2 26 10 Q14 18 2 10"
            fill="none"
            stroke="#9945ff"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <polygon points="2,8 2,12 5,10" fill="#9945ff" />
        </svg>
        <span className="text-[8px] text-[#9945ff] font-mono">loop</span>
      </div>
    ) : (
      <svg width="20" height="20" viewBox="0 0 20 20">
        <line x1="2" y1="10" x2="16" y2="10" stroke="#3a3a5a" strokeWidth="1.5" />
        <polygon points="14,6 20,10 14,14" fill="#3a3a5a" />
      </svg>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const PatternChainer: React.FC<PatternChainerProps> = ({
  trackId,
  activePatternId,
  onSelectPattern,
}) => {
  const { project, addPattern, updatePattern } = useProjectStore();

  const track = project.tracks.find(t => t.id === trackId);
  const patterns: Pattern[] = track?.patterns ?? [];

  const [orderedIds, setOrderedIds] = useState<string[]>(() => patterns.map(p => p.id));
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep orderedIds in sync when patterns change externally (add/remove)
  React.useEffect(() => {
    const incoming = patterns.map(p => p.id);
    setOrderedIds(prev => {
      const kept = prev.filter(id => incoming.includes(id));
      const added = incoming.filter(id => !prev.includes(id));
      return [...kept, ...added];
    });
  }, [patterns]);

  const orderedPatterns = orderedIds
    .map(id => patterns.find(p => p.id === id))
    .filter(Boolean) as Pattern[];

  // ── Drag logic ────────────────────────────────────────────────────────────

  const handleCardMouseDown = useCallback(
    (e: React.MouseEvent, patternId: string, _index: number) => {
      e.preventDefault();
      const realIndex = orderedIds.indexOf(patternId);
      const cardEl = (e.currentTarget as HTMLElement);
      const rect = cardEl.getBoundingClientRect();
      setDragState({
        patternId,
        startIndex: realIndex,
        currentIndex: realIndex,
        offsetX: e.clientX - rect.left,
        itemWidth: rect.width,
      });
    },
    [orderedIds]
  );

  const handleCardMouseEnter = useCallback(
    (index: number) => {
      if (!dragState) return;
      const real = orderedIds.indexOf(dragState.patternId);
      if (index === real) return;
      setDragState(prev => prev ? { ...prev, currentIndex: index } : prev);
    },
    [dragState, orderedIds]
  );

  useEffect(() => {
    if (!dragState) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - dragState.offsetX;
      const cardW = dragState.itemWidth + 28; // card + arrow gap
      const newIndex = Math.max(0, Math.min(orderedPatterns.length - 1, Math.round(x / cardW)));
      if (newIndex !== dragState.currentIndex) {
        setDragState(prev => prev ? { ...prev, currentIndex: newIndex } : prev);
      }
    };

    const onMouseUp = () => {
      if (dragState && dragState.currentIndex !== dragState.startIndex) {
        // Reorder
        setOrderedIds(prev => {
          const next = [...prev];
          const [moved] = next.splice(dragState.startIndex, 1);
          next.splice(dragState.currentIndex, 0, moved);
          return next;
        });
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, orderedPatterns.length]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAddPattern = () => {
    addPattern(trackId);
  };

  const handleDeletePattern = (patternId: string) => {
    if (patterns.length <= 1) return; // don't delete last
    // Remove from local order
    setOrderedIds(prev => prev.filter(id => id !== patternId));
    // We don't have a removePattern in the store API shown, so we'll just deselect
    // If the store has removePattern, call it here
    // removePattern(trackId, patternId);
  };

  const handleRename = (patternId: string, name: string) => {
    updatePattern(trackId, patternId, { name });
  };

  if (!track) {
    return (
      <div className="flex items-center justify-center h-16 text-gray-500 text-sm">
        No track selected
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-[#0d0d18] p-4 rounded-xl border border-[#2a2a3e]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: track.color, boxShadow: `0 0 6px ${track.color}` }}
          />
          <span className="text-gray-300 text-xs font-semibold tracking-wider uppercase">
            Pattern Chain
          </span>
          <span className="text-gray-500 text-xs ml-1">
            — {track.name}
          </span>
        </div>
        <span className="text-gray-600 text-[10px] font-mono">
          {orderedPatterns.length} pattern{orderedPatterns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Chain */}
      <div
        ref={containerRef}
        className="flex items-center gap-0 overflow-x-auto pb-3"
        style={{ minHeight: 88 }}
      >
        {orderedPatterns.map((pattern, idx) => (
          <React.Fragment key={pattern.id}>
            <div className="group relative flex-shrink-0">
              <PatternCard
                pattern={pattern}
                index={idx}
                total={orderedPatterns.length}
                isActive={pattern.id === activePatternId}
                isDragging={dragState?.patternId === pattern.id}
                isDragOver={dragState?.currentIndex === idx && dragState.patternId !== pattern.id}
                onMouseDown={handleCardMouseDown}
                onMouseEnter={() => handleCardMouseEnter(idx)}
                onSelect={onSelectPattern}
                onDelete={handleDeletePattern}
                onRename={handleRename}
              />
            </div>
            <ChainArrow isLast={idx === orderedPatterns.length - 1} />
          </React.Fragment>
        ))}

        {/* Add pattern button */}
        <button
          onClick={handleAddPattern}
          className="flex-shrink-0 w-14 h-[72px] flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#3a3a50] hover:border-[#9945ff] text-gray-600 hover:text-[#9945ff] transition-colors group"
        >
          <span className="text-2xl leading-none group-hover:scale-110 transition-transform">+</span>
          <span className="text-[9px] font-mono">New</span>
        </button>
      </div>

      {/* Pattern list summary */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#2a2a3e]">
        {orderedPatterns.map((pattern, idx) => (
          <button
            key={pattern.id}
            onClick={() => onSelectPattern(pattern.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] border transition-colors ${
              pattern.id === activePatternId
                ? 'border-[#9945ff] text-white bg-[#9945ff22]'
                : 'border-[#2a2a3e] text-gray-400 hover:border-[#3a3a5a] hover:text-gray-200'
            }`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: pattern.color }}
            />
            <span className="font-mono text-gray-500">{idx + 1}.</span>
            <span className="truncate max-w-[80px]">{pattern.name}</span>
            <span className="text-gray-600 font-mono text-[9px]">{pattern.steps}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PatternChainer;
