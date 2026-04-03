import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { TrackEffect, TrackFXType, TrackFXSettings } from '../../types';

const FX_LABELS: Record<TrackFXType, string> = {
  reverb: 'Reverb', delay: 'Delay', filter: 'Filter',
  distortion: 'Distortion', compressor: 'Compressor',
};

const FX_OPTIONS: TrackFXType[] = ['reverb', 'delay', 'filter', 'distortion', 'compressor'];

// ── Per-effect parameter editors ────────────────────────────────────────────

function Knob({ label, value, min, max, step = 0.01, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: 56, accentColor: '#9945ff', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 9, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 9, color: '#aaa' }}>{typeof value === 'number' ? value.toFixed(2) : value}</span>
    </div>
  );
}

function EffectParams({ effect, trackId }: { effect: TrackEffect; trackId: string }) {
  const { updateTrackEffect } = useProjectStore();
  const s = effect.settings;
  const upd = (partial: Partial<TrackFXSettings>) => updateTrackEffect(trackId, effect.id, partial);

  switch (s.fxType) {
    case 'reverb': return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knob label="Wet" value={s.wet} min={0} max={1} onChange={v => upd({ ...s, wet: v })} />
        <Knob label="Decay" value={s.decay} min={0.1} max={10} step={0.1} onChange={v => upd({ ...s, decay: v })} />
        <Knob label="PreDelay" value={s.preDelay} min={0} max={0.1} onChange={v => upd({ ...s, preDelay: v })} />
      </div>
    );
    case 'delay': return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Knob label="Wet" value={s.wet} min={0} max={1} onChange={v => upd({ ...s, wet: v })} />
        <Knob label="Feedback" value={s.feedback} min={0} max={0.95} onChange={v => upd({ ...s, feedback: v })} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <select value={s.time} onChange={e => upd({ ...s, time: e.target.value })}
            style={{ background: '#1a1a30', border: '1px solid #333', color: '#aaa', fontSize: 10, padding: '2px 4px', borderRadius: 4 }}>
            {['8n', '16n', '4n', '2n', '8t', '16t'].map(t => <option key={t}>{t}</option>)}
          </select>
          <span style={{ fontSize: 9, color: '#888' }}>Time</span>
        </div>
        <label style={{ fontSize: 10, color: '#888', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={s.pingPong} onChange={e => upd({ ...s, pingPong: e.target.checked })} />
          Ping
        </label>
      </div>
    );
    case 'filter': return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <select value={s.filterType} onChange={e => upd({ ...s, filterType: e.target.value as 'lowpass' | 'highpass' | 'bandpass' })}
            style={{ background: '#1a1a30', border: '1px solid #333', color: '#aaa', fontSize: 10, padding: '2px 4px', borderRadius: 4 }}>
            <option value="lowpass">LP</option>
            <option value="highpass">HP</option>
            <option value="bandpass">BP</option>
          </select>
          <span style={{ fontSize: 9, color: '#888' }}>Type</span>
        </div>
        <Knob label="Freq" value={s.frequency} min={20} max={20000} step={10} onChange={v => upd({ ...s, frequency: v })} />
        <Knob label="Q" value={s.Q} min={0.1} max={20} step={0.1} onChange={v => upd({ ...s, Q: v })} />
      </div>
    );
    case 'distortion': return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knob label="Wet" value={s.wet} min={0} max={1} onChange={v => upd({ ...s, wet: v })} />
        <Knob label="Drive" value={s.distortion} min={0} max={1} onChange={v => upd({ ...s, distortion: v })} />
      </div>
    );
    case 'compressor': return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knob label="Thresh" value={s.threshold} min={-60} max={0} step={1} onChange={v => upd({ ...s, threshold: v })} />
        <Knob label="Ratio" value={s.ratio} min={1} max={20} step={0.5} onChange={v => upd({ ...s, ratio: v })} />
        <Knob label="Atk ms" value={s.attack} min={0} max={200} step={1} onChange={v => upd({ ...s, attack: v })} />
        <Knob label="Rel ms" value={s.release} min={10} max={1000} step={10} onChange={v => upd({ ...s, release: v })} />
        <Knob label="Knee" value={s.knee} min={0} max={40} step={1} onChange={v => upd({ ...s, knee: v })} />
      </div>
    );
  }
}

// ── FX Slot ──────────────────────────────────────────────────────────────────

interface SlotProps {
  effect: TrackEffect; trackId: string; trackColor: string;
  onToggle: () => void; onRemove: () => void;
}

const FXSlot: React.FC<SlotProps> = ({ effect, trackId, trackColor, onToggle, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const s = effect.settings;

  return (
    <div style={{
      background: '#0f0f1a',
      border: `1px solid ${effect.on ? trackColor + '55' : '#2a2a3a'}`,
      borderRadius: 6, padding: '6px 8px', minWidth: 90,
      opacity: effect.on ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: expanded ? 6 : 0 }}>
        {/* Power toggle */}
        <div
          onClick={onToggle}
          style={{ width: 8, height: 8, borderRadius: '50%', background: effect.on ? '#00ff88' : '#cc3333', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontSize: 10, color: '#ccc', flex: 1 }}>{FX_LABELS[s.fxType]}</span>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, padding: 0 }}
        >{expanded ? '▲' : '▼'}</button>
        <button
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
        >✕</button>
      </div>
      {expanded && <EffectParams effect={effect} trackId={trackId} />}
    </div>
  );
};

// ── Main Panel ───────────────────────────────────────────────────────────────

interface Props { trackId: string; trackName: string; trackColor: string; onClose: () => void; }

export const FXChainPanel: React.FC<Props> = ({ trackId, trackName, trackColor, onClose }) => {
  const { project, addTrackEffect, removeTrackEffect, toggleTrackEffect } = useProjectStore();
  const track = project.tracks.find(t => t.id === trackId);
  const effects: TrackEffect[] = track?.effects ?? [];
  const [showAdd, setShowAdd] = useState(false);

  if (!track) return null;

  return (
    <div style={{
      background: 'linear-gradient(180deg, #131326 0%, #0f0f20 100%)',
      borderTop: `2px solid ${trackColor}`,
      padding: '10px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 80,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, color: trackColor, letterSpacing: 2, fontWeight: 700 }}>
          FX — {trackName.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14, padding: 0 }}
        >✕</button>
      </div>

      {/* Effect slots */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {effects.map(effect => (
          <FXSlot
            key={effect.id}
            effect={effect}
            trackId={trackId}
            trackColor={trackColor}
            onToggle={() => toggleTrackEffect(trackId, effect.id)}
            onRemove={() => removeTrackEffect(trackId, effect.id)}
          />
        ))}

        {/* Add effect button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{
              width: 80, height: 64,
              background: '#0f0f1a', border: '1px dashed #2a2a4a',
              borderRadius: 6, color: '#444', fontSize: 20,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
          {showAdd && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0,
              background: '#1a1a30', border: '1px solid #2a2a4a',
              borderRadius: 6, overflow: 'hidden', zIndex: 100, minWidth: 120,
            }}>
              {FX_OPTIONS.map(type => (
                <button
                  key={type}
                  onClick={() => { addTrackEffect(trackId, type); setShowAdd(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '6px 12px', background: 'none', border: 'none',
                    color: '#ccc', fontSize: 12, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = '#2a2a4a'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
                >{FX_LABELS[type]}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
