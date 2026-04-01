import React from 'react';
import type { OscSettings, OscType } from '../../types';
import { Knob } from './Knob';

interface OscillatorSectionProps {
  settings: OscSettings;
  label: string;
  onChange: (s: OscSettings) => void;
}

const WAVEFORMS: { type: OscType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'sawtooth',
    label: 'SAW',
    icon: (
      <svg width="22" height="14" viewBox="0 0 22 14">
        <polyline points="2,12 11,2 11,12 20,2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'square',
    label: 'SQR',
    icon: (
      <svg width="22" height="14" viewBox="0 0 22 14">
        <polyline points="2,12 2,3 11,3 11,12 11,3 20,3 20,12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
      </svg>
    ),
  },
  {
    type: 'sine',
    label: 'SIN',
    icon: (
      <svg width="22" height="14" viewBox="0 0 22 14">
        <path d="M2,7 C4,7 5,2 7,2 C9,2 10,12 12,12 C14,12 15,2 17,2 C19,2 20,7 20,7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'triangle',
    label: 'TRI',
    icon: (
      <svg width="22" height="14" viewBox="0 0 22 14">
        <polyline points="2,12 6.5,2 11,12 15.5,2 20,12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'noise',
    label: 'NOZ',
    icon: (
      <svg width="22" height="14" viewBox="0 0 22 14">
        <polyline
          points="2,7 3.5,3 5,10 6.5,5 8,9 9.5,4 11,11 12.5,3 14,8 15.5,5 17,10 18.5,6 20,7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const OCTAVES = [-2, -1, 0, 1, 2];

function WaveformPreview({ type, color }: { type: OscType; color: string }) {
  const w = 80, h = 28;
  let path = '';
  switch (type) {
    case 'sawtooth':
      path = 'M0,24 L20,4 L20,24 L40,4 L40,24 L60,4 L60,24 L80,4';
      break;
    case 'square':
      path = 'M0,24 L0,4 L20,4 L20,24 L40,24 L40,4 L60,4 L60,24 L80,24 L80,4';
      break;
    case 'sine': {
      const pts: string[] = [];
      for (let i = 0; i <= 80; i += 2) {
        const y = 14 - 10 * Math.sin((i / 80) * Math.PI * 2);
        pts.push(`${i},${y}`);
      }
      path = 'M' + pts.join(' L');
      break;
    }
    case 'triangle': {
      path = 'M0,24 L10,4 L30,24 L50,4 L70,24 L80,14';
      break;
    }
    case 'noise': {
      const pts: string[] = [];
      const rng = (seed: number) => ((seed * 1234567 + 891011) % 17) / 17;
      for (let i = 0; i <= 80; i += 3) {
        const y = 4 + rng(i) * 20;
        pts.push(`${i},${y}`);
      }
      path = 'M' + pts.join(' L');
      break;
    }
  }
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}66)` }} />
    </svg>
  );
}

export const OscillatorSection: React.FC<OscillatorSectionProps> = ({ settings, label, onChange }) => {
  const isOsc1 = label === 'OSC 1';
  const accentColor = isOsc1 ? '#9945ff' : '#00d4ff';

  const set = (partial: Partial<OscSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, #0e0e1c 0%, #12121f 100%)',
        border: `1px solid ${settings.on ? accentColor + '44' : '#222235'}`,
        boxShadow: settings.on ? `0 0 12px ${accentColor}22` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: accentColor, textTransform: 'uppercase' }}>
          {label}
        </span>
        {/* On/Off toggle */}
        <button
          onClick={() => set({ on: !settings.on })}
          style={{
            width: 32, height: 16, borderRadius: 8,
            background: settings.on
              ? `linear-gradient(90deg, ${accentColor}cc, ${accentColor}88)`
              : '#1a1a2e',
            border: `1px solid ${settings.on ? accentColor : '#333355'}`,
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.15s',
            boxShadow: settings.on ? `0 0 8px ${accentColor}88` : 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 2, left: settings.on ? 17 : 2,
            width: 10, height: 10, borderRadius: '50%',
            background: settings.on ? '#fff' : '#555577',
            transition: 'left 0.15s',
            boxShadow: settings.on ? `0 0 4px ${accentColor}` : 'none',
          }} />
        </button>
      </div>

      {/* Waveform selector */}
      <div className="flex gap-1">
        {WAVEFORMS.map(({ type, label: wLabel, icon }) => (
          <button
            key={type}
            onClick={() => set({ type })}
            title={type}
            style={{
              flex: 1,
              padding: '4px 2px',
              borderRadius: 5,
              background: settings.type === type
                ? `linear-gradient(135deg, ${accentColor}33, ${accentColor}11)`
                : '#0d0d1c',
              border: `1px solid ${settings.type === type ? accentColor : '#222235'}`,
              color: settings.type === type ? accentColor : '#505070',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.12s',
              boxShadow: settings.type === type ? `0 0 8px ${accentColor}44` : 'none',
            }}
          >
            {icon}
            <span style={{ fontSize: 7, letterSpacing: 0.5 }}>{wLabel}</span>
          </button>
        ))}
      </div>

      {/* Waveform preview */}
      <div style={{
        background: '#08080f',
        borderRadius: 5,
        border: '1px solid #181828',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: settings.on ? 1 : 0.4,
      }}>
        <WaveformPreview type={settings.type} color={accentColor} />
      </div>

      {/* Octave selector */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 8, color: '#606080', letterSpacing: 0.5, width: 24, textTransform: 'uppercase' }}>OCT</span>
        <div className="flex gap-0.5 flex-1">
          {OCTAVES.map(oct => (
            <button
              key={oct}
              onClick={() => set({ octave: oct })}
              style={{
                flex: 1,
                height: 20,
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 600,
                background: settings.octave === oct
                  ? `linear-gradient(135deg, ${accentColor}55, ${accentColor}22)`
                  : '#0d0d1c',
                border: `1px solid ${settings.octave === oct ? accentColor : '#222235'}`,
                color: settings.octave === oct ? accentColor : '#505070',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {oct > 0 ? `+${oct}` : oct}
            </button>
          ))}
        </div>
      </div>

      {/* Knobs row */}
      <div className="flex justify-around">
        <Knob
          value={settings.semitone}
          min={-12}
          max={12}
          onChange={v => set({ semitone: Math.round(v) })}
          label="SEMI"
          size={36}
          color={accentColor}
        />
        <Knob
          value={settings.fine}
          min={-100}
          max={100}
          onChange={v => set({ fine: v })}
          label="FINE"
          unit="¢"
          size={36}
          color={accentColor}
        />
        <Knob
          value={settings.volume}
          min={0}
          max={1}
          onChange={v => set({ volume: v })}
          label="VOL"
          size={36}
          color={accentColor}
        />
      </div>
    </div>
  );
};

export default OscillatorSection;
