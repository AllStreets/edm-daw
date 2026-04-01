import { useRef, useState, useCallback, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { Track } from '../../types';
import { StereoLevelMeter } from '../Meters/LevelMeter';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';

interface ChannelStripProps {
  track: Track;
  isSelected: boolean;
  onClick: () => void;
}

// Pan Knob component (SVG-based)
function PanKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  const angle = value * 135; // -135 to +135 degrees
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = 18, cy = 18, r = 13;
  const lineX = cx + Math.cos(rad) * r;
  const lineY = cy + Math.sin(rad) * r;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startValueRef.current = value;
    e.preventDefault();
  }, [value]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = (startYRef.current - e.clientY) / 100;
      const newValue = Math.max(-1, Math.min(1, startValueRef.current + delta));
      onChange(newValue);
    };
    const handleMouseUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onChange]);

  const handleDblClick = useCallback(() => onChange(0), [onChange]);

  return (
    <svg
      ref={svgRef}
      width={36}
      height={36}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDblClick}
      className="cursor-ns-resize select-none"
      aria-label={`Pan: ${value >= 0 ? 'R' : 'L'}${Math.round(Math.abs(value) * 100)}`}
    >
      {/* Track arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1a1a2a" strokeWidth={3} />
      {/* Active arc */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={Math.abs(value) > 0.05 ? '#9945ff' : '#333'}
        strokeWidth={2}
        strokeDasharray={`${Math.abs(value) * 40} 100`}
        strokeDashoffset={value < 0 ? 0 : -20}
        transform={`rotate(-90, ${cx}, ${cy})`}
      />
      {/* Knob body */}
      <defs>
        <radialGradient id="knobGrad" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#3a3a5a" />
          <stop offset="100%" stopColor="#14141e" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={11} fill="url(#knobGrad)" stroke="#555" strokeWidth={0.5} />
      {/* Indicator line */}
      <line x1={cx} y1={cy} x2={lineX} y2={lineY} stroke="#00d4ff" strokeWidth={2} strokeLinecap="round" />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={1.5} fill="#9945ff" />
    </svg>
  );
}

// Vertical fader component
function VerticalFader({
  value,
  onChange,
  height = 150,
}: {
  value: number;
  onChange: (v: number) => void;
  height?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const newValue = Math.max(0, Math.min(1, 1 - relY / rect.height));
      onChange(newValue);
    };
    const handleMouseUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onChange]);

  const handleDblClick = useCallback(() => onChange(0.8), [onChange]);

  // Fader position (0=bottom, 1=top), with 8px handle half-height offset
  const faderPos = 1 - value; // 0 at top, 1 at bottom (CSS percentage)

  const dBLabels = [
    { val: 1, label: '+6' },
    { val: 0.875, label: '0' },
    { val: 0.75, label: '-6' },
    { val: 0.625, label: '-12' },
    { val: 0.375, label: '-24' },
    { val: 0, label: '-∞' },
  ];

  return (
    <div className="flex items-center gap-1">
      {/* dB labels */}
      <div className="relative flex flex-col justify-between text-[8px] text-gray-600 font-mono select-none" style={{ height }}>
        {dBLabels.map(({ label }) => (
          <span key={label} className="leading-none">{label}</span>
        ))}
      </div>

      {/* Fader track */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDblClick}
        className="relative cursor-pointer select-none rounded-sm"
        style={{ width: 14, height, position: 'relative' }}
      >
        {/* Track background */}
        <div
          className="absolute inset-x-0 rounded-sm"
          style={{
            top: 8,
            bottom: 8,
            background: 'linear-gradient(to top, #1a1a1a 0%, #2a2a2a 40%, #333 60%, #444 80%, #550000 95%, #660000 100%)',
          }}
        />
        {/* Filled portion (below fader) */}
        <div
          className="absolute inset-x-0 rounded-sm"
          style={{
            top: `${faderPos * 100}%`,
            bottom: 8,
            background: 'linear-gradient(to top, #00aa44, #88cc00 70%, #ffcc00 90%, #ff4400 100%)',
            opacity: 0.7,
          }}
        />
        {/* Tick marks */}
        {dBLabels.map(({ val }, idx) => (
          <div
            key={idx}
            className="absolute"
            style={{
              top: (1 - val) * (height - 16) + 8 - 0.5,
              left: 0,
              right: 0,
              height: 1,
              background: '#555',
            }}
          />
        ))}
        {/* Fader handle */}
        <div
          className="absolute left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
          style={{
            top: `calc(${faderPos * 100}% - 8px)`,
            width: 22,
            height: 16,
            background: 'linear-gradient(135deg, #5a5a7a 0%, #2a2a3a 50%, #1a1a2a 100%)',
            border: '1px solid #666',
            borderRadius: 3,
            boxShadow: '0 2px 4px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* Center line on handle */}
          <div
            className="absolute inset-x-0.5"
            style={{ top: '50%', height: 1, background: '#888', transform: 'translateY(-50%)' }}
          />
        </div>
      </div>
    </div>
  );
}

export function ChannelStrip({ track, isSelected, onClick }: ChannelStripProps) {
  const { setTrackVolume, setTrackPan, toggleMute, toggleSolo, toggleArmed } = useProjectStore();
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);

  // Simulate audio levels
  const levelTimeRef = useRef(0);
  const drawLevel = useCallback((_dt: number, timestamp: number) => {
    if (track.mute) {
      setLevelL(0);
      setLevelR(0);
      return;
    }
    levelTimeRef.current = timestamp;
    const base = track.volume * 0.7;
    const variation = Math.sin(timestamp * 0.003 + track.id.charCodeAt(0)) * 0.15;
    const noiseL = (Math.random() - 0.5) * 0.1;
    const noiseR = (Math.random() - 0.5) * 0.1;
    setLevelL(Math.max(0, Math.min(1, base + variation + noiseL)));
    setLevelR(Math.max(0, Math.min(1, base + variation + noiseR)));
  }, [track.mute, track.volume, track.id]);

  useAnimationFrame(drawLevel, true);

  const handleVolumeChange = useCallback((v: number) => {
    setTrackVolume(track.id, v);
  }, [track.id, setTrackVolume]);

  const handlePanChange = useCallback((v: number) => {
    setTrackPan(track.id, v);
  }, [track.id, setTrackPan]);

  const isSolo = track.solo;
  const isMuted = track.mute;
  const isArmed = track.armed;

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center gap-1 py-2 px-1 rounded select-none transition-all"
      style={{
        width: 80,
        minHeight: '100%',
        background: isSelected
          ? 'linear-gradient(180deg, #1a1a2e 0%, #12121c 100%)'
          : 'linear-gradient(180deg, #14141e 0%, #0e0e18 100%)',
        border: isSelected ? '1px solid #9945ff44' : '1px solid #1a1a2a',
        cursor: 'pointer',
        opacity: isMuted && !isSolo ? 0.5 : 1,
        boxShadow: isSolo
          ? '0 0 12px rgba(255,200,0,0.3), inset 0 0 20px rgba(255,200,0,0.05)'
          : 'none',
      }}
    >
      {/* Top color bar */}
      <div
        className="w-full rounded-sm mb-1"
        style={{ height: 3, background: track.color, boxShadow: `0 0 6px ${track.color}88` }}
      />

      {/* FX insert area */}
      <div className="w-full flex flex-col gap-0.5">
        {track.effects.slice(0, 3).map((fx) => (
          <div
            key={fx.id}
            className="w-full rounded text-center text-[8px] font-mono truncate px-1"
            style={{
              background: fx.on ? '#1a2a3a' : '#1a1a1a',
              color: fx.on ? '#00d4ff' : '#444',
              border: '1px solid',
              borderColor: fx.on ? '#00d4ff44' : '#222',
              height: 14,
              lineHeight: '14px',
            }}
          >
            {fx.type.slice(0, 4).toUpperCase()}
          </div>
        ))}
        {track.effects.length === 0 && (
          <div
            className="w-full rounded text-center text-[8px] font-mono"
            style={{ height: 14, background: '#111', color: '#333', lineHeight: '14px' }}
          >
            NO FX
          </div>
        )}
      </div>

      {/* Send knobs */}
      <div className="w-full flex justify-between px-1 mt-1">
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="rounded-full cursor-pointer"
            style={{
              width: 18, height: 18,
              background: 'radial-gradient(circle at 35% 35%, #3a3a5a, #111)',
              border: '1px solid #333',
            }}
          />
          <span className="text-[7px] text-gray-600 font-mono">REV</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="rounded-full cursor-pointer"
            style={{
              width: 18, height: 18,
              background: 'radial-gradient(circle at 35% 35%, #3a3a5a, #111)',
              border: '1px solid #333',
            }}
          />
          <span className="text-[7px] text-gray-600 font-mono">DLY</span>
        </div>
      </div>

      {/* Pan knob */}
      <div className="flex flex-col items-center gap-0.5">
        <PanKnob value={track.pan} onChange={handlePanChange} />
        <span className="text-[8px] font-mono" style={{ color: '#9945ff' }}>
          {track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(Math.abs(track.pan) * 100)}`}
        </span>
      </div>

      {/* EQ mini display */}
      <div
        className="w-full rounded"
        style={{ height: 22, background: '#0a0a14', border: '1px solid #1a1a2a', overflow: 'hidden' }}
      >
        <svg width="100%" height="100%" viewBox="0 0 70 20" preserveAspectRatio="none">
          <polyline
            points="0,12 12,10 24,8 36,11 48,9 60,13 70,15"
            fill="none"
            stroke="#9945ff"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <polyline
            points="0,12 12,10 24,8 36,11 48,9 60,13 70,15"
            fill="rgba(153,69,255,0.1)"
            stroke="none"
          />
        </svg>
      </div>

      {/* Volume fader */}
      <div className="flex justify-center mt-1">
        <VerticalFader value={track.volume} onChange={handleVolumeChange} height={130} />
      </div>

      {/* Level meters */}
      <div className="flex justify-center mt-1">
        <StereoLevelMeter levelL={levelL} levelR={levelR} height={80} width={28} showClip />
      </div>

      {/* Track name */}
      <div
        className="text-center text-[9px] font-mono font-bold truncate w-full px-1 mt-1"
        style={{ color: isSelected ? '#9945ff' : '#aaa' }}
      >
        {track.name}
      </div>

      {/* Track number + color */}
      <div
        className="text-[8px] font-mono text-center w-full rounded-sm"
        style={{ color: track.color, background: `${track.color}22`, padding: '1px 0' }}
      >
        CH{String(track.id.charCodeAt(track.id.length - 1) % 16 + 1).padStart(2, '0')}
      </div>

      {/* Mute / Solo / Arm buttons */}
      <div className="flex gap-1 mt-1">
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
          className="text-[9px] font-bold rounded transition-all"
          style={{
            width: 20, height: 16,
            background: isMuted ? '#cc4400' : '#1a1a1a',
            color: isMuted ? '#fff' : '#666',
            border: `1px solid ${isMuted ? '#ff6600' : '#333'}`,
            boxShadow: isMuted ? '0 0 6px rgba(255,100,0,0.5)' : 'none',
          }}
        >
          M
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
          className="text-[9px] font-bold rounded transition-all"
          style={{
            width: 20, height: 16,
            background: isSolo ? '#aa8800' : '#1a1a1a',
            color: isSolo ? '#ffe' : '#666',
            border: `1px solid ${isSolo ? '#ffcc00' : '#333'}`,
            boxShadow: isSolo ? '0 0 8px rgba(255,200,0,0.6)' : 'none',
          }}
        >
          S
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleArmed(track.id); }}
          className="text-[9px] font-bold rounded transition-all"
          style={{
            width: 20, height: 16,
            background: isArmed ? '#aa0000' : '#1a1a1a',
            color: isArmed ? '#fcc' : '#666',
            border: `1px solid ${isArmed ? '#ff3333' : '#333'}`,
            boxShadow: isArmed ? '0 0 6px rgba(255,0,0,0.5)' : 'none',
          }}
        >
          R
        </button>
      </div>

      {/* I/O routing label */}
      <div className="text-[7px] font-mono text-gray-600 truncate w-full text-center mt-0.5">
        {track.type === 'drum' ? 'DRUM OUT' : 'MAIN BUS'}
      </div>
    </div>
  );
}
