import React, { useMemo } from 'react';
import type { FilterSettings, FilterType } from '../../types';
import { Knob } from './Knob';

interface FilterSectionProps {
  settings: FilterSettings;
  onChange: (s: FilterSettings) => void;
}

const COLOR = '#00d4ff';

const FILTER_TYPES: { type: FilterType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'lowpass',
    label: 'LP',
    icon: (
      <svg width="28" height="16" viewBox="0 0 28 16">
        <path d="M2,3 L12,3 Q20,3 24,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'highpass',
    label: 'HP',
    icon: (
      <svg width="28" height="16" viewBox="0 0 28 16">
        <path d="M4,13 Q8,3 16,3 L26,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: 'bandpass',
    label: 'BP',
    icon: (
      <svg width="28" height="16" viewBox="0 0 28 16">
        <path d="M2,13 L8,13 Q12,2 14,2 Q16,2 20,13 L26,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

function logFreqToNorm(freq: number): number {
  return (Math.log10(freq) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20));
}

function normToLogFreq(norm: number): number {
  return Math.pow(10, norm * (Math.log10(20000) - Math.log10(20)) + Math.log10(20));
}

function FilterCurve({
  type,
  cutoff,
  resonance,
}: {
  type: FilterType;
  cutoff: number;
  resonance: number;
}) {
  const W = 200, H = 60;
  const path = useMemo(() => {
    const pts: [number, number][] = [];
    const cutNorm = logFreqToNorm(cutoff);
    const res = resonance; // 0..1

    for (let px = 0; px <= W; px += 2) {
      const norm = px / W;
      let db = 0;

      if (type === 'lowpass') {
        if (norm < cutNorm - 0.05) {
          db = 0;
        } else if (norm < cutNorm) {
          const t = (norm - (cutNorm - 0.05)) / 0.05;
          db = res * 12 * Math.sin(t * Math.PI);
        } else {
          const slope = (norm - cutNorm) / (1 - cutNorm + 0.001);
          db = -slope * 36 * (1 - res * 0.3);
        }
      } else if (type === 'highpass') {
        if (norm > cutNorm + 0.05) {
          db = 0;
        } else if (norm > cutNorm) {
          const t = (cutNorm + 0.05 - norm) / 0.05;
          db = res * 12 * Math.sin(t * Math.PI);
        } else {
          const slope = (cutNorm - norm) / (cutNorm + 0.001);
          db = -slope * 36 * (1 - res * 0.3);
        }
      } else {
        // bandpass
        const dist = Math.abs(norm - cutNorm);
        const bw = 0.08 * (1 - res * 0.7);
        if (dist < bw) {
          const t = dist / bw;
          db = (1 - t * t) * (6 + res * 12);
        } else {
          db = -(dist - bw) * 60;
        }
      }

      const y = H / 2 - (db / 40) * (H / 2 - 6);
      const clampedY = Math.max(4, Math.min(H - 4, y));
      pts.push([px, clampedY]);
    }

    return 'M' + pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' L');
  }, [type, cutoff, resonance]);

  const cutNorm = logFreqToNorm(cutoff);
  const cutX = cutNorm * W;

  return (
    <svg width={W} height={H} style={{ display: 'block', width: '100%' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={t * W} y1={0} x2={t * W} y2={H} stroke="#1a1a2e" strokeWidth="1" />
      ))}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#1a1a2e" strokeWidth="1" />

      {/* Fill under curve */}
      <path
        d={path + ` L${W},${H} L0,${H} Z`}
        fill={`${COLOR}0d`}
      />

      {/* Curve */}
      <path
        d={path}
        fill="none"
        stroke={COLOR}
        strokeWidth="2"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${COLOR}aa)` }}
      />

      {/* Cutoff marker */}
      <line
        x1={cutX}
        y1={0}
        x2={cutX}
        y2={H}
        stroke={`${COLOR}66`}
        strokeWidth="1"
        strokeDasharray="2,2"
      />
    </svg>
  );
}

function formatFreq(hz: number) {
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)}k`;
  return `${Math.round(hz)}`;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ settings, onChange }) => {
  const set = (partial: Partial<FilterSettings>) => onChange({ ...settings, ...partial });
  const cutoffNorm = logFreqToNorm(settings.cutoff);

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, #0a0e14 0%, #0d1118 100%)',
        border: `1px solid ${COLOR}33`,
        boxShadow: `0 0 12px ${COLOR}11`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: COLOR, textTransform: 'uppercase' }}>
          Filter
        </span>
        {/* Filter type buttons */}
        <div className="flex gap-1">
          {FILTER_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => set({ type })}
              style={{
                padding: '3px 8px',
                borderRadius: 4,
                background: settings.type === type
                  ? `linear-gradient(135deg, ${COLOR}33, ${COLOR}11)`
                  : '#0d0d1c',
                border: `1px solid ${settings.type === type ? COLOR : '#222235'}`,
                color: settings.type === type ? COLOR : '#505070',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                transition: 'all 0.12s',
                boxShadow: settings.type === type ? `0 0 8px ${COLOR}44` : 'none',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter curve */}
      <div style={{
        background: '#07080f',
        borderRadius: 5,
        border: '1px solid #181828',
        padding: '6px',
        overflow: 'hidden',
      }}>
        <FilterCurve type={settings.type} cutoff={settings.cutoff} resonance={settings.resonance} />
        <div style={{ fontSize: 8, color: '#404060', textAlign: 'center', marginTop: 2 }}>
          {formatFreq(settings.cutoff)} Hz
        </div>
      </div>

      {/* Knobs */}
      <div className="flex justify-around flex-wrap gap-1">
        <Knob
          value={cutoffNorm}
          min={0}
          max={1}
          onChange={v => set({ cutoff: Math.round(normToLogFreq(v)) })}
          label="CUTOFF"
          size={48}
          color={COLOR}
        />
        <Knob
          value={settings.resonance}
          min={0}
          max={1}
          onChange={v => set({ resonance: v })}
          label="RES"
          size={36}
          color={COLOR}
        />
        <Knob
          value={settings.drive}
          min={0}
          max={1}
          onChange={v => set({ drive: v })}
          label="DRIVE"
          size={36}
          color={COLOR}
        />
        <Knob
          value={settings.envAmount}
          min={-1}
          max={1}
          onChange={v => set({ envAmount: v })}
          label="ENV"
          size={36}
          color={COLOR}
        />
        <Knob
          value={settings.keyTracking}
          min={0}
          max={1}
          onChange={v => set({ keyTracking: v })}
          label="KEY"
          size={36}
          color={COLOR}
        />
      </div>
    </div>
  );
};

export default FilterSection;
