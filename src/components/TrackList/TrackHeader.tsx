import React, { useState, useRef, useCallback } from 'react';
import type { Track } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrackHeaderProps {
  track: Track;
  isSelected: boolean;
  onClick: () => void;
  onMute: () => void;
  onSolo: () => void;
  onArm: () => void;
  onVolumeChange: (vol: number) => void;
  onOpenSynth: () => void;
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<Track['type'], string> = {
  synth: '#9945ff',
  drum: '#ff0080',
  audio: '#00d4ff',
};

const TYPE_LABELS: Record<Track['type'], string> = {
  synth: 'SYNTH',
  drum: 'DRUM',
  audio: 'AUDIO',
};

const TypeBadge: React.FC<{ type: Track['type'] }> = ({ type }) => (
  <span style={{
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 1.5,
    padding: '1px 5px',
    borderRadius: 3,
    border: `1px solid ${TYPE_COLORS[type]}55`,
    color: TYPE_COLORS[type],
    background: `${TYPE_COLORS[type]}18`,
    flexShrink: 0,
    textTransform: 'uppercase',
    lineHeight: '14px',
  }}>
    {TYPE_LABELS[type]}
  </span>
);

// ─── Small toggle button (M / S / R) ─────────────────────────────────────────

interface TogglePillProps {
  label: string;
  active: boolean;
  activeColor: string;
  onClick: (e: React.MouseEvent) => void;
  title: string;
}

const TogglePill: React.FC<TogglePillProps> = ({ label, active, activeColor, onClick, title }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      width: 20,
      height: 18,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 3,
      border: `1px solid ${active ? activeColor : '#282838'}`,
      background: active ? `${activeColor}33` : '#0e0e1c',
      color: active ? activeColor : '#444',
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: 0.5,
      cursor: 'pointer',
      transition: 'all 0.12s ease',
      flexShrink: 0,
      padding: 0,
      outline: 'none',
      textShadow: active ? `0 0 6px ${activeColor}` : 'none',
      boxShadow: active ? `0 0 6px ${activeColor}44` : 'none',
    }}
  >
    {label}
  </button>
);

// ─── Volume Slider ────────────────────────────────────────────────────────────

interface VolumeSliderProps {
  value: number;
  color: string;
  onChange: (v: number) => void;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({ value, color, onChange }) => (
  <input
    type="range"
    min={0}
    max={1}
    step={0.01}
    value={value}
    onClick={e => e.stopPropagation()}
    onChange={e => onChange(parseFloat(e.target.value))}
    style={{
      WebkitAppearance: 'none',
      appearance: 'none',
      width: '100%',
      height: 3,
      borderRadius: 2,
      background: `linear-gradient(90deg, ${color} ${value * 100}%, #1a1a2e ${value * 100}%)`,
      outline: 'none',
      cursor: 'pointer',
    }}
    title={`Volume: ${Math.round(value * 100)}%`}
  />
);

// ─── TrackHeader ──────────────────────────────────────────────────────────────

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  isSelected,
  onClick,
  onMute,
  onSolo,
  onArm,
  onVolumeChange,
  onOpenSynth,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitName = useCallback(() => {
    setIsEditing(false);
    // Parent could handle rename via a prop — for now we keep local state
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNameValue(track.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [track.name]);

  const handleOpenSynth = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenSynth();
  }, [onOpenSynth]);

  const glowColor = isSelected ? track.color : 'transparent';

  return (
    <>
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--thumb-color, #9945ff);
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--thumb-color, #9945ff);
          cursor: pointer;
          border: none;
        }
      `}</style>

      <div
        onClick={onClick}
        style={{
          width: 200,
          minWidth: 200,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          background: isSelected
            ? `linear-gradient(90deg, ${track.color}22 0%, #0f0f1e 100%)`
            : 'linear-gradient(90deg, #0d0d1e 0%, #0a0a18 100%)',
          borderBottom: '1px solid #1a1a2e',
          borderRight: '1px solid #1a1a2e',
          boxShadow: isSelected
            ? `inset 0 0 20px ${glowColor}18, 0 0 8px ${glowColor}22`
            : 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Colored left border strip */}
        <div style={{
          width: 4,
          flexShrink: 0,
          background: track.color,
          boxShadow: isSelected ? `0 0 12px ${track.color}cc` : 'none',
          transition: 'box-shadow 0.15s ease',
        }} />

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '5px 7px 5px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflow: 'hidden',
        }}>

          {/* Row 1: Name + Type Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
            {isEditing ? (
              <input
                ref={inputRef}
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={commitName}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitName(); }}
                onClick={e => e.stopPropagation()}
                style={{
                  flex: 1,
                  background: '#050510',
                  border: `1px solid ${track.color}`,
                  borderRadius: 3,
                  color: '#e0e0ff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 4px',
                  outline: 'none',
                  minWidth: 0,
                }}
                autoFocus
              />
            ) : (
              <span
                onDoubleClick={handleDoubleClick}
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: 700,
                  color: isSelected ? '#e8e0ff' : '#aaa',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  textShadow: isSelected ? `0 0 8px ${track.color}88` : 'none',
                  transition: 'color 0.12s ease',
                }}
                title={`${track.name} — double-click to rename`}
              >
                {track.name}
              </span>
            )}
            <TypeBadge type={track.type} />
          </div>

          {/* Row 2: M S R buttons + synth icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <TogglePill
              label="M"
              active={track.mute}
              activeColor="#ffaa00"
              onClick={e => { e.stopPropagation(); onMute(); }}
              title="Mute"
            />
            <TogglePill
              label="S"
              active={track.solo}
              activeColor="#00d4ff"
              onClick={e => { e.stopPropagation(); onSolo(); }}
              title="Solo"
            />
            <TogglePill
              label="R"
              active={track.armed}
              activeColor="#ff3355"
              onClick={e => { e.stopPropagation(); onArm(); }}
              title="Arm for recording"
            />

            <div style={{ flex: 1 }} />

            {/* Open Synth / context button */}
            {track.type === 'synth' && (
              <button
                title="Open synth editor"
                onClick={handleOpenSynth}
                style={{
                  width: 20, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 3,
                  border: '1px solid #2a1a4a',
                  background: '#12081e',
                  color: '#9945ff',
                  fontSize: 10,
                  cursor: 'pointer',
                  padding: 0,
                  outline: 'none',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#9945ff';
                  (e.currentTarget as HTMLButtonElement).style.background = '#9945ff22';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a1a4a';
                  (e.currentTarget as HTMLButtonElement).style.background = '#12081e';
                }}
              >
                ⚙
              </button>
            )}
          </div>

          {/* Row 3: Volume slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 8, color: '#444', letterSpacing: 1 }}>VOL</span>
            <div style={{ flex: 1 }}>
              <VolumeSlider
                value={track.volume}
                color={track.color}
                onChange={onVolumeChange}
              />
            </div>
            <span style={{
              fontSize: 8,
              color: '#555',
              fontFamily: 'monospace',
              width: 22,
              textAlign: 'right',
            }}>
              {Math.round(track.volume * 100)}
            </span>
          </div>

        </div>
      </div>
    </>
  );
};

export default TrackHeader;
