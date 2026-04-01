import { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { Effect } from '../../types';

// =====================================================
// Mini Knob
// =====================================================
interface KnobProps {
  value: number; // 0-1 normalized
  label: string;
  size?: number;
  color?: string;
  onChange?: (v: number) => void;
}

function MiniKnob({ value, label, size = 32, color = '#9945ff', onChange }: KnobProps) {
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(0);

  const angle = -135 + value * 270; // -135 to +135 deg
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = size / 2, cy = size / 2, r = size / 2 - 3;
  const lineX = cx + Math.cos(rad) * (r - 2);
  const lineY = cy + Math.sin(rad) * (r - 2);

  const handleMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = (startYRef.current - e.clientY) / 120;
      onChange?.(Math.max(0, Math.min(1, startValRef.current + delta)));
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onChange]);

  // Arc path
  const startAngle = -135 * Math.PI / 180 - Math.PI / 2;
  const endAngle = startAngle + value * 270 * Math.PI / 180;
  const arcR = r - 1;
  const x1 = cx + Math.cos(startAngle) * arcR;
  const y1 = cy + Math.sin(startAngle) * arcR;
  const x2 = cx + Math.cos(endAngle) * arcR;
  const y2 = cy + Math.sin(endAngle) * arcR;
  const largeArc = value > 0.5 ? 1 : 0;

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ userSelect: 'none' }}>
      <svg
        width={size} height={size}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange?.(0.5)}
        className="cursor-ns-resize"
        aria-label={`${label}: ${Math.round(value * 100)}%`}
      >
        {/* Track */}
        <circle cx={cx} cy={cy} r={arcR} fill="none" stroke="#1a1a2a" strokeWidth={2} />
        {/* Active arc */}
        {value > 0.002 && (
          <path
            d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}
        {/* Knob body */}
        <circle
          cx={cx} cy={cy} r={r - 3}
          fill="url(#kgMix)"
          stroke="#444"
          strokeWidth={0.5}
        />
        <defs>
          <radialGradient id="kgMix" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#3a3a5a" />
            <stop offset="100%" stopColor="#12121e" />
          </radialGradient>
        </defs>
        {/* Indicator */}
        <line
          x1={cx} y1={cy}
          x2={lineX} y2={lineY}
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[8px] font-mono text-gray-500 text-center leading-tight" style={{ maxWidth: size }}>
        {label}
      </span>
    </div>
  );
}

// =====================================================
// Effect Parameter Definitions
// =====================================================
const EFFECT_DEFAULTS: Record<string, Record<string, number | boolean | string>> = {
  reverb: { decay: 0.5, preDelay: 0.1, wet: 0.3, roomSize: 0.6, roomType: 'hall' },
  delay: { time: 0.5, feedback: 0.4, wet: 0.3, pingPong: false, noteValue: '1/4' },
  chorus: { rate: 0.3, depth: 0.5, wet: 0.4 },
  distortion: { drive: 0.5, tone: 0.5, wet: 0.8, type: 'soft' },
  compressor: { threshold: 0.7, ratio: 0.3, attack: 0.1, release: 0.3, makeup: 0.5 },
  eq: { low: 0.5, mid: 0.5, high: 0.5, lowFreq: 0.1, midFreq: 0.4, highFreq: 0.8 },
  flanger: { rate: 0.3, depth: 0.5, feedback: 0.4, wet: 0.5 },
  phaser: { rate: 0.3, depth: 0.6, wet: 0.5 },
  bitcrusher: { bits: 0.7, downSample: 0.3, wet: 0.8 },
  'stereo-widener': { width: 0.5 },
  limiter: { threshold: 0.9, release: 0.2, lookahead: 0.1 },
};

const EFFECT_TYPE_COLORS: Record<string, string> = {
  reverb: '#00d4ff',
  delay: '#9945ff',
  chorus: '#00ff88',
  distortion: '#ff4444',
  compressor: '#ffaa00',
  eq: '#44aaff',
  flanger: '#ff88aa',
  phaser: '#aaffaa',
  bitcrusher: '#ff6600',
  'stereo-widener': '#88ffff',
  limiter: '#ffff00',
};

// =====================================================
// EQ Display (8-band)
// =====================================================
function EQDisplay({ settings }: { settings: Record<string, number | boolean | string> }) {
  const points: [number, number][] = [];
  const w = 200, h = 60;
  for (let i = 0; i < 8; i++) {
    const x = (i / 7) * w;
    const y = h / 2 - ((settings[`band${i}`] as number ?? 0.5) - 0.5) * h * 0.8;
    points.push([x, y]);
  }
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');

  return (
    <div className="relative rounded overflow-hidden" style={{ width: w, height: h, background: '#060610', border: '1px solid #1a1a3a' }}>
      <svg width={w} height={h}>
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} y1={f * h} x2={w} y2={f * h} stroke="#1a1a3a" strokeWidth={0.5} />
        ))}
        {/* EQ curve */}
        <path d={path} fill="none" stroke="#44aaff" strokeWidth={1.5} />
        {/* Filled area under curve */}
        <path
          d={`${path} L ${w} ${h} L 0 ${h} Z`}
          fill="rgba(68,170,255,0.08)"
        />
        {/* Band dots */}
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="#44aaff" stroke="#fff" strokeWidth={0.5} />
        ))}
      </svg>
      <div className="absolute bottom-0.5 left-1 text-[7px] font-mono text-gray-600">20Hz</div>
      <div className="absolute bottom-0.5 right-1 text-[7px] font-mono text-gray-600">20kHz</div>
    </div>
  );
}

// =====================================================
// Per-Effect Parameter UI
// =====================================================
interface EffectParamsProps {
  effect: Effect;
  onUpdate: (settings: Record<string, number | boolean | string>) => void;
  expanded: boolean;
}

function EffectParams({ effect, onUpdate, expanded }: EffectParamsProps) {
  const settings = { ...EFFECT_DEFAULTS[effect.type] ?? {}, ...effect.settings };
  const color = EFFECT_TYPE_COLORS[effect.type] ?? '#9945ff';

  const update = (key: string, val: number | boolean | string) => {
    onUpdate({ ...settings, [key]: val });
  };

  if (effect.type === 'eq') {
    return (
      <div className="flex flex-col gap-2">
        <EQDisplay settings={settings} />
        {expanded && (
          <div className="grid grid-cols-3 gap-2">
            {['Low', 'Mid', 'High'].map((band) => (
              <MiniKnob
                key={band}
                value={(settings[band.toLowerCase()] as number) ?? 0.5}
                label={band}
                color={color}
                onChange={(v) => update(band.toLowerCase(), v)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (effect.type === 'compressor') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['threshold', 'ratio', 'attack', 'release'] as const).slice(0, expanded ? 5 : 3).map((key) => (
            <MiniKnob
              key={key}
              value={(settings[key] as number) ?? 0.5}
              label={key.slice(0, 5).toUpperCase()}
              color={color}
              onChange={(v) => update(key, v)}
            />
          ))}
          {expanded && (
            <MiniKnob
              value={(settings.makeup as number) ?? 0.5}
              label="MAKEUP"
              color={color}
              onChange={(v) => update('makeup', v)}
            />
          )}
        </div>
        {/* GR meter */}
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-gray-600">GR</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: '#0a0a12' }}>
            <div
              className="h-full rounded-full"
              style={{ width: '30%', background: 'linear-gradient(90deg, #00d4ff, #9945ff)' }}
            />
          </div>
          <span className="text-[8px] font-mono" style={{ color }}>-4dB</span>
        </div>
      </div>
    );
  }

  if (effect.type === 'reverb') {
    const roomTypes = ['hall', 'room', 'plate'];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['decay', 'preDelay', 'wet'] as const).map((key) => (
            <MiniKnob
              key={key}
              value={(settings[key] as number) ?? 0.5}
              label={key === 'preDelay' ? 'PRE' : key.toUpperCase()}
              color={color}
              onChange={(v) => update(key, v)}
            />
          ))}
          {expanded && (
            <MiniKnob
              value={(settings.roomSize as number) ?? 0.5}
              label="SIZE"
              color={color}
              onChange={(v) => update('roomSize', v)}
            />
          )}
        </div>
        {expanded && (
          <div className="flex gap-1">
            {roomTypes.map((rt) => (
              <button
                key={rt}
                onClick={() => update('roomType', rt)}
                className="text-[8px] font-mono px-2 py-0.5 rounded capitalize transition-colors"
                style={{
                  background: settings.roomType === rt ? `${color}33` : '#0a0a14',
                  color: settings.roomType === rt ? color : '#555',
                  border: `1px solid ${settings.roomType === rt ? color : '#222'}`,
                }}
              >
                {rt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (effect.type === 'delay') {
    const noteValues = ['1/32', '1/16', '1/8', '1/4', '1/2', '1'];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['time', 'feedback', 'wet'] as const).map((key) => (
            <MiniKnob
              key={key}
              value={(settings[key] as number) ?? 0.5}
              label={key.toUpperCase()}
              color={color}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>
        {expanded && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-1 flex-wrap">
              {noteValues.map((nv) => (
                <button
                  key={nv}
                  onClick={() => update('noteValue', nv)}
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded transition-colors"
                  style={{
                    background: settings.noteValue === nv ? `${color}33` : '#0a0a14',
                    color: settings.noteValue === nv ? color : '#555',
                    border: `1px solid ${settings.noteValue === nv ? color : '#222'}`,
                  }}
                >
                  {nv}
                </button>
              ))}
            </div>
            <button
              onClick={() => update('pingPong', !settings.pingPong)}
              className="text-[8px] font-mono px-2 py-0.5 rounded self-start transition-colors"
              style={{
                background: settings.pingPong ? `${color}33` : '#0a0a14',
                color: settings.pingPong ? color : '#555',
                border: `1px solid ${settings.pingPong ? color : '#222'}`,
              }}
            >
              PING-PONG
            </button>
          </div>
        )}
      </div>
    );
  }

  if (effect.type === 'distortion') {
    const distTypes = ['soft', 'hard', 'bitcrush', 'fold'];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['drive', 'tone', 'wet'] as const).map((key) => (
            <MiniKnob
              key={key}
              value={(settings[key] as number) ?? 0.5}
              label={key.toUpperCase()}
              color={color}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>
        {expanded && (
          <div className="flex gap-1 flex-wrap">
            {distTypes.map((dt) => (
              <button
                key={dt}
                onClick={() => update('type', dt)}
                className="text-[8px] font-mono px-2 py-0.5 rounded capitalize transition-colors"
                style={{
                  background: settings.type === dt ? `${color}33` : '#0a0a14',
                  color: settings.type === dt ? color : '#555',
                  border: `1px solid ${settings.type === dt ? color : '#222'}`,
                }}
              >
                {dt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (effect.type === 'limiter') {
    return (
      <div className="flex gap-2 flex-wrap">
        {(['threshold', 'release', 'lookahead'] as const).map((key) => (
          <MiniKnob
            key={key}
            value={(settings[key] as number) ?? 0.5}
            label={key === 'lookahead' ? 'LA' : key.slice(0, 5).toUpperCase()}
            color={color}
            onChange={(v) => update(key, v)}
          />
        ))}
      </div>
    );
  }

  // Generic: chorus, flanger, phaser, stereo-widener, bitcrusher
  const paramKeys = Object.keys(settings).filter(
    (k) => typeof settings[k] === 'number'
  ).slice(0, expanded ? undefined : 3);

  return (
    <div className="flex gap-2 flex-wrap">
      {paramKeys.map((key) => (
        <MiniKnob
          key={key}
          value={(settings[key] as number)}
          label={key.slice(0, 6).toUpperCase()}
          color={color}
          onChange={(v) => update(key, v)}
        />
      ))}
    </div>
  );
}

// =====================================================
// Effect Row
// =====================================================
interface EffectRowProps {
  effect: Effect;
  trackId: string;
  onRemove: () => void;
  onToggle: () => void;
  onUpdate: (settings: Record<string, number | boolean | string>) => void;
}

function EffectRow({ effect, onRemove, onToggle, onUpdate }: EffectRowProps) {
  const [expanded, setExpanded] = useState(false);
  const color = EFFECT_TYPE_COLORS[effect.type] ?? '#9945ff';

  const DISPLAY_NAMES: Record<string, string> = {
    reverb: 'Reverb',
    delay: 'Delay',
    chorus: 'Chorus',
    distortion: 'Distortion',
    compressor: 'Compressor',
    eq: 'EQ-8',
    flanger: 'Flanger',
    phaser: 'Phaser',
    bitcrusher: 'Bitcrusher',
    'stereo-widener': 'Stereo Widener',
    limiter: 'Limiter',
  };

  return (
    <div
      className="rounded transition-all"
      style={{
        background: expanded ? '#0e0e1a' : '#0a0a14',
        border: `1px solid #1a1a2a`,
        borderLeft: `3px solid ${effect.on ? color : '#333'}`,
        boxShadow: expanded ? `0 0 12px ${color}22` : 'none',
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle */}
        <span className="text-gray-600 cursor-grab select-none text-sm" title="Drag to reorder">
          ⠿
        </span>

        {/* Power toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="w-4 h-4 rounded-full border transition-all shrink-0"
          style={{
            background: effect.on ? color : '#1a1a2a',
            borderColor: effect.on ? color : '#333',
            boxShadow: effect.on ? `0 0 6px ${color}88` : 'none',
          }}
          title={effect.on ? 'Bypass' : 'Enable'}
        />

        {/* Effect name */}
        <span
          className="text-[11px] font-bold font-mono flex-1"
          style={{ color: effect.on ? '#ddd' : '#555' }}
        >
          {DISPLAY_NAMES[effect.type] ?? effect.type.toUpperCase()}
        </span>

        {/* Expand indicator */}
        <span
          className="text-[10px] transition-transform"
          style={{ color: '#444', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▼
        </span>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-[10px] font-mono w-5 h-5 rounded flex items-center justify-center transition-colors"
          style={{ color: '#555', background: 'transparent', border: '1px solid transparent' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ff4444';
            e.currentTarget.style.borderColor = '#ff444444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#555';
            e.currentTarget.style.borderColor = 'transparent';
          }}
          title="Remove effect"
        >
          ✕
        </button>
      </div>

      {/* Parameters */}
      <div className={`px-3 pb-2 ${expanded ? '' : 'pt-0'}`} style={{ display: expanded ? 'block' : 'none' }}>
        {/* Always show inline knobs */}
        <EffectParams effect={effect} onUpdate={onUpdate} expanded={expanded} />
      </div>
      {/* Collapsed inline knobs */}
      {!expanded && (
        <div className="px-3 pb-2">
          <EffectParams effect={effect} onUpdate={onUpdate} expanded={false} />
        </div>
      )}
    </div>
  );
}

// =====================================================
// Effects Rack Main
// =====================================================
const EFFECT_TYPES: Array<{ type: Effect['type'] | 'phaser' | 'bitcrusher' | 'stereo-widener' | 'limiter'; label: string }> = [
  { type: 'eq', label: 'EQ-8' },
  { type: 'compressor', label: 'Compressor' },
  { type: 'reverb', label: 'Reverb' },
  { type: 'delay', label: 'Delay' },
  { type: 'chorus', label: 'Chorus' },
  { type: 'distortion', label: 'Distortion' },
  { type: 'bitcrusher', label: 'Bitcrusher' },
  { type: 'flanger', label: 'Flanger' },
  { type: 'phaser', label: 'Phaser' },
  { type: 'stereo-widener', label: 'Stereo Widener' },
  { type: 'limiter', label: 'Limiter' },
];

interface EffectsRackProps {
  trackId: string;
  onClose: () => void;
}

export function EffectsRack({ trackId, onClose }: EffectsRackProps) {
  const { project, addEffect, removeEffect, updateEffect, updateTrack } = useProjectStore();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return null;

  const handleAddEffect = useCallback((type: string) => {
    addEffect(trackId, type as Effect['type']);
    setShowAddMenu(false);
  }, [trackId, addEffect]);

  const handleRemoveEffect = useCallback((effectId: string) => {
    removeEffect(trackId, effectId);
  }, [trackId, removeEffect]);

  const handleToggleEffect = useCallback((effectId: string) => {
    const effect = track.effects.find((e) => e.id === effectId);
    if (!effect) return;
    updateTrack(trackId, {
      effects: track.effects.map((e) =>
        e.id === effectId ? { ...e, on: !e.on } : e
      ),
    });
  }, [trackId, track.effects, updateTrack]);

  const handleUpdateEffect = useCallback((effectId: string, settings: Record<string, number | boolean | string>) => {
    updateEffect(trackId, effectId, settings);
  }, [trackId, updateEffect]);

  // Close add menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{
        width: 340,
        minWidth: 280,
        maxWidth: 420,
        background: '#0a0a14',
        border: '1px solid #1a1a2a',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 60px rgba(153,69,255,0.1)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: '1px solid #1a1a2a', background: '#0e0e1c' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: track.color, boxShadow: `0 0 6px ${track.color}` }}
          />
          <div>
            <div
              className="text-[10px] font-bold font-mono tracking-wider"
              style={{ color: '#9945ff' }}
            >
              EFFECTS RACK
            </div>
            <div className="text-[11px] font-mono text-gray-300">
              {track.name}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-300 transition-colors w-6 h-6 flex items-center justify-center rounded"
          style={{ border: '1px solid #222' }}
        >
          ✕
        </button>
      </div>

      {/* Effect slots */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-1 p-2"
        style={{ minHeight: 0, maxHeight: 500 }}
      >
        {track.effects.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-8 text-center"
            style={{ color: '#333', border: '1px dashed #1a1a2a', borderRadius: 6 }}
          >
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-[11px] font-mono">No effects loaded</div>
            <div className="text-[9px] text-gray-700 mt-1">Click "Add Effect" to get started</div>
          </div>
        )}
        {track.effects.map((effect) => (
          <EffectRow
            key={effect.id}
            effect={effect}
            trackId={trackId}
            onRemove={() => handleRemoveEffect(effect.id)}
            onToggle={() => handleToggleEffect(effect.id)}
            onUpdate={(settings) => handleUpdateEffect(effect.id, settings)}
          />
        ))}
      </div>

      {/* Add Effect button */}
      <div
        className="px-2 py-2 shrink-0 relative"
        style={{ borderTop: '1px solid #1a1a2a' }}
        ref={addMenuRef}
      >
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="w-full py-1.5 rounded font-mono text-[11px] font-bold transition-all"
          style={{
            background: showAddMenu
              ? 'linear-gradient(135deg, #9945ff33, #00d4ff22)'
              : 'linear-gradient(135deg, #1a1a2a, #141420)',
            color: showAddMenu ? '#9945ff' : '#555',
            border: `1px solid ${showAddMenu ? '#9945ff44' : '#222'}`,
          }}
        >
          + ADD EFFECT
        </button>

        {/* Dropdown menu */}
        {showAddMenu && (
          <div
            className="absolute left-2 right-2 z-50 rounded overflow-hidden"
            style={{
              bottom: '100%',
              marginBottom: 4,
              background: '#0e0e1c',
              border: '1px solid #2a1a3a',
              boxShadow: '0 -8px 24px rgba(0,0,0,0.8)',
            }}
          >
            <div className="p-1">
              {EFFECT_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleAddEffect(type)}
                  className="w-full text-left px-3 py-1.5 rounded text-[11px] font-mono transition-all"
                  style={{
                    color: '#aaa',
                    borderLeft: `2px solid ${EFFECT_TYPE_COLORS[type] ?? '#9945ff'}33`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${EFFECT_TYPE_COLORS[type] ?? '#9945ff'}22`;
                    e.currentTarget.style.color = EFFECT_TYPE_COLORS[type] ?? '#9945ff';
                    e.currentTarget.style.borderLeftColor = EFFECT_TYPE_COLORS[type] ?? '#9945ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#aaa';
                    e.currentTarget.style.borderLeftColor = `${EFFECT_TYPE_COLORS[type] ?? '#9945ff'}33`;
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
