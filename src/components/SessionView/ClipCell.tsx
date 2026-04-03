import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SampleDropData {
  name: string;
  category: string;
  isImported: boolean;
}

interface ClipCellProps {
  trackId: string;
  sceneId: string;
  patternId: string | null;
  patternName?: string;
  trackColor: string;
  isPlaying: boolean;
  onLaunch: () => void;
  onStop?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSampleDrop?: (data: SampleDropData) => void;
}

// ─── Mini Waveform (fake animated bars) ──────────────────────────────────────

const WaveformBars: React.FC<{ color: string; animated: boolean }> = ({ color, animated }) => {
  const barCount = 20;
  const heights = useRef<number[]>(
    Array.from({ length: barCount }, () => 20 + Math.random() * 60)
  );

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animated) return;
    const id = setInterval(() => setTick(t => t + 1), 120);
    return () => clearInterval(id);
  }, [animated]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      height: 18,
      overflow: 'hidden',
      opacity: 0.7,
    }}>
      {heights.current.map((h, i) => {
        const animOffset = animated ? Math.sin((tick + i) * 0.5) * 0.3 : 0;
        const finalH = Math.max(15, Math.min(100, h + animOffset * 20));
        return (
          <div
            key={i}
            style={{
              width: 2,
              height: `${finalH}%`,
              background: color,
              borderRadius: 1,
              transition: animated ? 'height 0.12s ease' : 'none',
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  hasClip: boolean;
  onClose: () => void;
  onLaunch: () => void;
  onStop?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  hasClip,
  onClose,
  onLaunch,
  onStop,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Adjust position to keep in viewport
  const adjustedY = Math.min(y, window.innerHeight - 180);
  const adjustedX = Math.min(x, window.innerWidth - 160);

  const menuItems: { label: string; icon: string; action: (() => void) | undefined; danger?: boolean; disabled?: boolean }[] = hasClip
    ? [
        { label: 'Launch', icon: '▶', action: onLaunch },
        { label: 'Stop', icon: '■', action: onStop },
        { label: 'Edit in Piano Roll', icon: '✏', action: onEdit },
        { label: 'Duplicate', icon: '⧉', action: onDuplicate },
        { label: 'Delete', icon: '✕', action: onDelete, danger: true },
      ]
    : [
        { label: 'Create Clip', icon: '+', action: onLaunch },
      ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        width: 160,
        background: 'linear-gradient(180deg, #1a1a2e 0%, #12121e 100%)',
        border: '1px solid #2a2a4a',
        borderRadius: 8,
        boxShadow: '0 8px 32px #00000099, 0 0 0 1px #9945ff22',
        zIndex: 9999,
        overflow: 'hidden',
        padding: '4px 0',
      }}
    >
      {menuItems.map(({ label, icon, action, danger, disabled }) => (
        <button
          key={label}
          onClick={() => { action?.(); onClose(); }}
          disabled={disabled || !action}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'transparent',
            border: 'none',
            color: danger ? '#ff5577' : '#bbb',
            fontSize: 12,
            fontWeight: 500,
            cursor: disabled || !action ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            transition: 'background 0.1s ease',
            opacity: disabled || !action ? 0.4 : 1,
          }}
          onMouseEnter={e => {
            if (!disabled && action) {
              (e.currentTarget as HTMLButtonElement).style.background = danger ? '#ff335522' : '#9945ff22';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <span style={{ width: 14, textAlign: 'center', fontSize: 11 }}>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
};

// ─── ClipCell ─────────────────────────────────────────────────────────────────

export const ClipCell: React.FC<ClipCellProps> = ({
  trackId: _trackId,
  sceneId: _sceneId,
  patternId,
  patternName,
  trackColor,
  isPlaying,
  onLaunch,
  onStop,
  onEdit,
  onDuplicate,
  onDelete,
  onSampleDrop,
}) => {
  const hasClip = patternId !== null;
  const [hovered, setHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-daw-sample')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData('application/x-daw-sample');
    if (!raw || !onSampleDrop) return;
    try {
      const data = JSON.parse(raw) as SampleDropData;
      onSampleDrop(data);
    } catch { /* ignore bad data */ }
  }, [onSampleDrop]);

  // Pulse animation when playing
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => setPulsePhase(p => p + 1), 500);
    return () => clearInterval(id);
  }, [isPlaying]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClick = useCallback(() => {
    onLaunch();
  }, [onLaunch]);

  // Derive colors
  const hex = trackColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const glowIntensity = isPlaying ? (pulsePhase % 2 === 0 ? 0.9 : 0.5) : (hovered ? 0.4 : 0);

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          width: 120,
          minWidth: 120,
          height: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: hasClip ? '5px 8px' : '0',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.15s ease',
          borderRight: '1px solid #1a1a2e',
          borderBottom: '1px solid #1a1a2e',

          // Background
          background: isDragOver
            ? 'rgba(153,69,255,0.18)'
            : hasClip
              ? isPlaying
                ? `linear-gradient(135deg, rgba(${r},${g},${b},0.45) 0%, rgba(${r},${g},${b},0.22) 100%)`
                : hovered
                  ? `linear-gradient(135deg, rgba(${r},${g},${b},0.35) 0%, rgba(${r},${g},${b},0.15) 100%)`
                  : `linear-gradient(135deg, rgba(${r},${g},${b},0.28) 0%, rgba(${r},${g},${b},0.10) 100%)`
              : hovered
                ? 'rgba(153,69,255,0.08)'
                : '#0a0a18',

          // Border
          border: isDragOver
            ? '2px dashed #9945ff'
            : isPlaying
              ? `1px solid rgba(${r},${g},${b},${glowIntensity})`
              : hasClip
                ? `1px solid rgba(${r},${g},${b},0.35)`
                : hovered
                  ? '1px dashed #9945ff55'
                  : '1px dashed #1e1e2e',

          boxShadow: isDragOver
            ? '0 0 16px #9945ff44'
            : isPlaying
              ? `inset 0 0 16px rgba(${r},${g},${b},0.25), 0 0 12px rgba(${r},${g},${b},0.35)`
              : hasClip && hovered
                ? `inset 0 0 10px rgba(${r},${g},${b},0.15)`
                : 'none',
        }}
      >
        {/* Drop target overlay */}
        {isDragOver && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 2,
          }}>
            <span style={{ fontSize: 11, color: '#9945ff', fontWeight: 700, letterSpacing: 1 }}>
              {hasClip ? '↺ REPLACE' : '+ DROP'}
            </span>
          </div>
        )}

        {hasClip ? (
          <>
            {/* Playing indicator bar at top */}
            {isPlaying && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: 2,
                width: '100%',
                background: `linear-gradient(90deg, transparent, ${trackColor}, transparent)`,
                animation: 'clip-scan 1s linear infinite',
              }} />
            )}

            {/* Clip name row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginBottom: 3,
            }}>
              {isPlaying && (
                <span style={{
                  fontSize: 9,
                  color: trackColor,
                  textShadow: `0 0 6px ${trackColor}`,
                  animation: 'blink-play 1s ease-in-out infinite',
                  flexShrink: 0,
                }}>
                  ▶
                </span>
              )}
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: isPlaying ? '#fff' : '#ccc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                textShadow: isPlaying ? `0 0 8px ${trackColor}88` : 'none',
              }}>
                {patternName ?? 'Clip'}
              </span>
            </div>

            {/* Waveform bars */}
            <WaveformBars color={trackColor} animated={isPlaying} />

          </>
        ) : (
          /* Empty cell */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}>
            <span style={{
              fontSize: 18,
              color: '#9945ff',
              textShadow: '0 0 10px #9945ff',
              lineHeight: 1,
            }}>
              +
            </span>
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasClip={hasClip}
          onClose={() => setContextMenu(null)}
          onLaunch={() => { onLaunch(); setContextMenu(null); }}
          onStop={onStop}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}

      <style>{`
        @keyframes clip-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes blink-play {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
};

export default ClipCell;
