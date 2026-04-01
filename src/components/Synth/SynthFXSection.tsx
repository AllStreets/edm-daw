import React from 'react';
import type {
  SynthFX,
  ReverbSettings,
  DelaySettings,
  ChorusSettings,
  DistortionSettings,
  DistortionType,
} from '../../types';
import { Knob } from './Knob';

interface SynthFXSectionProps {
  settings: SynthFX;
  onChange: (s: SynthFX) => void;
}

function Toggle({
  on,
  color,
  onChange,
}: {
  on: boolean;
  color: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 28, height: 14, borderRadius: 7,
        background: on ? `linear-gradient(90deg, ${color}cc, ${color}88)` : '#1a1a2e',
        border: `1px solid ${on ? color : '#333355'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s',
        boxShadow: on ? `0 0 6px ${color}88` : 'none',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 2, left: on ? 15 : 2,
        width: 8, height: 8, borderRadius: '50%',
        background: on ? '#fff' : '#555577',
        transition: 'left 0.15s',
      }} />
    </button>
  );
}

function FXPanel({
  label,
  color,
  on,
  onToggle,
  children,
}: {
  label: string;
  color: string;
  on: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 p-2 rounded-lg flex-1"
      style={{
        background: 'linear-gradient(135deg, #0a0a16 0%, #0e0e1c 100%)',
        border: `1px solid ${on ? color + '44' : '#1c1c2e'}`,
        opacity: on ? 1 : 0.5,
        boxShadow: on ? `0 0 10px ${color}15` : 'none',
        transition: 'all 0.2s',
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.2,
          color: on ? color : '#505070',
          textTransform: 'uppercase',
          transition: 'color 0.2s',
        }}>
          {label}
        </span>
        <Toggle on={on} color={color} onChange={onToggle} />
      </div>
      <div className="flex justify-around flex-wrap gap-1">
        {children}
      </div>
    </div>
  );
}

const DISTORTION_TYPES: DistortionType[] = ['soft', 'hard', 'waveshape'];

export const SynthFXSection: React.FC<SynthFXSectionProps> = ({ settings, onChange }) => {
  const setReverb = (partial: Partial<ReverbSettings>) =>
    onChange({ ...settings, reverb: { ...settings.reverb, ...partial } });

  const setDelay = (partial: Partial<DelaySettings>) =>
    onChange({ ...settings, delay: { ...settings.delay, ...partial } });

  const setChorus = (partial: Partial<ChorusSettings>) =>
    onChange({ ...settings, chorus: { ...settings.chorus, ...partial } });

  const setDist = (partial: Partial<DistortionSettings>) =>
    onChange({ ...settings, distortion: { ...settings.distortion, ...partial } });

  return (
    <div className="flex gap-2">
      {/* REVERB */}
      <FXPanel
        label="REVERB"
        color="#9945ff"
        on={settings.reverb.on}
        onToggle={() => setReverb({ on: !settings.reverb.on })}
      >
        <Knob value={settings.reverb.wet} min={0} max={1} onChange={v => setReverb({ wet: v })}
          label="WET" size={30} color="#9945ff" />
        <Knob value={settings.reverb.decay} min={0.1} max={10} onChange={v => setReverb({ decay: v })}
          label="DEC" unit="s" size={30} color="#9945ff" />
        <Knob value={settings.reverb.preDelay} min={0} max={0.1} onChange={v => setReverb({ preDelay: v })}
          label="PRE" unit="s" size={30} color="#9945ff" />
      </FXPanel>

      {/* DELAY */}
      <FXPanel
        label="DELAY"
        color="#00d4ff"
        on={settings.delay.on}
        onToggle={() => setDelay({ on: !settings.delay.on })}
      >
        <Knob value={settings.delay.wet} min={0} max={1} onChange={v => setDelay({ wet: v })}
          label="WET" size={30} color="#00d4ff" />
        <Knob value={settings.delay.time} min={0.01} max={2} onChange={v => setDelay({ time: v })}
          label="TIME" unit="s" size={30} color="#00d4ff" />
        <Knob value={settings.delay.feedback} min={0} max={0.99} onChange={v => setDelay({ feedback: v })}
          label="FDBK" size={30} color="#00d4ff" />
        <div className="flex flex-col items-center gap-0.5">
          <button
            onClick={() => setDelay({ pingPong: !settings.delay.pingPong })}
            style={{
              padding: '2px 5px',
              borderRadius: 3,
              fontSize: 7,
              fontWeight: 700,
              background: settings.delay.pingPong ? '#00d4ff33' : '#0d0d1c',
              border: `1px solid ${settings.delay.pingPong ? '#00d4ff' : '#222235'}`,
              color: settings.delay.pingPong ? '#00d4ff' : '#505070',
              cursor: 'pointer',
              letterSpacing: 0.4,
              marginTop: 4,
            }}
          >
            PING
          </button>
          <span style={{ fontSize: 7, color: '#404060' }}>PONG</span>
        </div>
      </FXPanel>

      {/* CHORUS */}
      <FXPanel
        label="CHORUS"
        color="#00ff88"
        on={settings.chorus.on}
        onToggle={() => setChorus({ on: !settings.chorus.on })}
      >
        <Knob value={settings.chorus.wet} min={0} max={1} onChange={v => setChorus({ wet: v })}
          label="WET" size={30} color="#00ff88" />
        <Knob value={settings.chorus.rate} min={0.01} max={10} onChange={v => setChorus({ rate: v })}
          label="RATE" unit="Hz" size={30} color="#00ff88" />
        <Knob value={settings.chorus.depth} min={0} max={1} onChange={v => setChorus({ depth: v })}
          label="DPTH" size={30} color="#00ff88" />
      </FXPanel>

      {/* DISTORTION */}
      <FXPanel
        label="DIST"
        color="#ff4444"
        on={settings.distortion.on}
        onToggle={() => setDist({ on: !settings.distortion.on })}
      >
        <Knob value={settings.distortion.wet} min={0} max={1} onChange={v => setDist({ wet: v })}
          label="WET" size={30} color="#ff4444" />
        <Knob value={settings.distortion.amount} min={0} max={1} onChange={v => setDist({ amount: v })}
          label="AMT" size={30} color="#ff4444" />
        <div className="flex flex-col gap-0.5 mt-1">
          {DISTORTION_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setDist({ type: t })}
              style={{
                padding: '1px 5px',
                borderRadius: 3,
                fontSize: 7,
                fontWeight: 700,
                background: settings.distortion.type === t ? '#ff444433' : '#0d0d1c',
                border: `1px solid ${settings.distortion.type === t ? '#ff4444' : '#222235'}`,
                color: settings.distortion.type === t ? '#ff4444' : '#505070',
                cursor: 'pointer',
                letterSpacing: 0.3,
                textTransform: 'uppercase',
                transition: 'all 0.12s',
              }}
            >
              {t === 'waveshape' ? 'WAVE' : t.toUpperCase()}
            </button>
          ))}
        </div>
      </FXPanel>
    </div>
  );
};

export default SynthFXSection;
