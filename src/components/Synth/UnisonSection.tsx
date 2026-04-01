import React from 'react';
import type { UnisonSettings } from '../../types';
import { Knob } from './Knob';

interface UnisonSectionProps {
  settings: UnisonSettings;
  onChange: (s: UnisonSettings) => void;
}

const COLOR = '#ff4488';
const VOICE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export const UnisonSection: React.FC<UnisonSectionProps> = ({ settings, onChange }) => {
  const set = (partial: Partial<UnisonSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, #120a12 0%, #160e18 100%)',
        border: `1px solid ${settings.on ? COLOR + '44' : '#222235'}`,
        boxShadow: settings.on ? `0 0 12px ${COLOR}22` : 'none',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: COLOR, textTransform: 'uppercase' }}>
          Unison
        </span>
        <button
          onClick={() => set({ on: !settings.on })}
          style={{
            width: 32, height: 16, borderRadius: 8,
            background: settings.on
              ? `linear-gradient(90deg, ${COLOR}cc, ${COLOR}88)`
              : '#1a1a2e',
            border: `1px solid ${settings.on ? COLOR : '#333355'}`,
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.15s',
            boxShadow: settings.on ? `0 0 8px ${COLOR}88` : 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 2, left: settings.on ? 17 : 2,
            width: 10, height: 10, borderRadius: '50%',
            background: settings.on ? '#fff' : '#555577',
            transition: 'left 0.15s',
          }} />
        </button>
      </div>

      {/* Voice count visualization */}
      <div style={{
        background: '#07080f',
        borderRadius: 5,
        border: '1px solid #181828',
        padding: '6px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        justifyContent: 'center',
      }}>
        {Array.from({ length: settings.voices }).map((_, i) => {
          const spread = settings.on ? settings.spread : 0;
          const offset = settings.voices > 1
            ? ((i / (settings.voices - 1)) - 0.5) * spread * 40
            : 0;
          const opacity = settings.on ? 0.6 + (i === Math.floor(settings.voices / 2) ? 0.4 : 0) : 0.2;
          return (
            <div
              key={i}
              style={{
                width: 3,
                height: 20,
                background: `linear-gradient(to top, ${COLOR}44, ${COLOR})`,
                borderRadius: 2,
                transform: `translateX(${offset}px)`,
                opacity,
                transition: 'all 0.2s',
                boxShadow: settings.on ? `0 0 4px ${COLOR}88` : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Voice selector */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 8, color: '#606080', letterSpacing: 0.5, width: 24, textTransform: 'uppercase', flexShrink: 0 }}>
          VOI
        </span>
        <div className="flex gap-0.5 flex-1">
          {VOICE_OPTIONS.map(v => (
            <button
              key={v}
              onClick={() => set({ voices: v })}
              style={{
                flex: 1,
                height: 20,
                borderRadius: 3,
                fontSize: 9,
                fontWeight: 700,
                background: settings.voices === v
                  ? `linear-gradient(135deg, ${COLOR}55, ${COLOR}22)`
                  : '#0d0d1c',
                border: `1px solid ${settings.voices === v ? COLOR : '#222235'}`,
                color: settings.voices === v ? COLOR : '#505070',
                cursor: 'pointer',
                transition: 'all 0.12s',
                boxShadow: settings.voices === v ? `0 0 6px ${COLOR}44` : 'none',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Knobs */}
      <div className="flex justify-around">
        <Knob
          value={settings.detune}
          min={0}
          max={1}
          onChange={v => set({ detune: v })}
          label="DETUNE"
          size={40}
          color={COLOR}
        />
        <Knob
          value={settings.spread}
          min={0}
          max={1}
          onChange={v => set({ spread: v })}
          label="SPREAD"
          size={40}
          color={COLOR}
        />
      </div>
    </div>
  );
};

export default UnisonSection;
