import React from 'react';
import type { EnvelopeSettings } from '../../types';
import { Knob } from './Knob';

interface EnvelopeSectionProps {
  settings: EnvelopeSettings;
  label: string;
  onChange: (s: EnvelopeSettings) => void;
  color?: string;
}

function ADSRCurve({
  attack,
  decay,
  sustain,
  release,
  color,
}: EnvelopeSettings & { color: string }) {
  const W = 180, H = 52;
  const pad = 8;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  // Normalize times to relative widths (attack+decay+sustain_hold+release = 1)
  const atkN = Math.min(attack, 4);
  const decN = Math.min(decay, 4);
  const relN = Math.min(release, 4);

  const total = atkN + decN + 0.5 + relN; // hold section is fixed fraction
  const atkW = (atkN / total) * innerW;
  const decW = (decN / total) * innerW;
  const holdW = (0.5 / total) * innerW;
  const relW = (relN / total) * innerW;

  const bot = pad + innerH;
  const top = pad;
  const susY = top + innerH * (1 - sustain);

  const x0 = pad;
  const x1 = x0 + atkW;
  const x2 = x1 + decW;
  const x3 = x2 + holdW;
  const x4 = x3 + relW;

  // Curved path using quadratic bezier for smoother look
  const path = [
    `M${x0},${bot}`,
    `Q${x0 + atkW * 0.6},${bot} ${x1},${top}`,      // attack: convex curve
    `Q${x1 + decW * 0.4},${top} ${x2},${susY}`,      // decay: concave curve
    `L${x3},${susY}`,                                  // sustain hold
    `Q${x3 + relW * 0.5},${susY} ${x4},${bot}`,      // release: convex
  ].join(' ');

  const fillPath = path + ` L${x4},${bot} L${x0},${bot} Z`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }}>
      {/* Grid */}
      <line x1={pad} y1={bot} x2={W - pad} y2={bot} stroke="#1a1a2e" strokeWidth="1" />
      <line x1={pad} y1={top} x2={pad} y2={bot} stroke="#1a1a2e" strokeWidth="1" />

      {/* Sustain level guide */}
      <line
        x1={pad}
        y1={susY}
        x2={W - pad}
        y2={susY}
        stroke={`${color}22`}
        strokeWidth="1"
        strokeDasharray="3,3"
      />

      {/* Fill */}
      <path d={fillPath} fill={`${color}15`} />

      {/* Curve */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}99)` }}
      />

      {/* Phase marker dots */}
      {[
        { x: x1, y: top },
        { x: x2, y: susY },
        { x: x3, y: susY },
      ].map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={color} opacity={0.7} />
      ))}

      {/* Labels */}
      {[
        { x: x0 + atkW / 2, label: 'A' },
        { x: x1 + decW / 2, label: 'D' },
        { x: x2 + holdW / 2, label: 'S' },
        { x: x3 + relW / 2, label: 'R' },
      ].map(({ x, label }) => (
        <text key={label} x={x} y={bot + 0} textAnchor="middle" fontSize={7} fill={`${color}66`} fontFamily="monospace">
          {label}
        </text>
      ))}
    </svg>
  );
}

export const EnvelopeSection: React.FC<EnvelopeSectionProps> = ({
  settings,
  label,
  onChange,
  color = '#00ff88',
}) => {
  const set = (partial: Partial<EnvelopeSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, #0a0f0a 0%, #0e130e 100%)',
        border: `1px solid ${color}33`,
        boxShadow: `0 0 10px ${color}0d`,
      }}
    >
      {/* Header */}
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color, textTransform: 'uppercase' }}>
        {label}
      </span>

      {/* ADSR Curve */}
      <div style={{
        background: '#07080a',
        borderRadius: 5,
        border: '1px solid #181828',
        padding: '4px 4px 8px',
        overflow: 'hidden',
      }}>
        <ADSRCurve {...settings} color={color} />
      </div>

      {/* Knobs */}
      <div className="flex justify-around">
        <Knob
          value={settings.attack}
          min={0.001}
          max={4}
          onChange={v => set({ attack: v })}
          label="ATK"
          unit="s"
          size={36}
          color={color}
        />
        <Knob
          value={settings.decay}
          min={0.001}
          max={4}
          onChange={v => set({ decay: v })}
          label="DEC"
          unit="s"
          size={36}
          color={color}
        />
        <Knob
          value={settings.sustain}
          min={0}
          max={1}
          onChange={v => set({ sustain: v })}
          label="SUS"
          size={36}
          color={color}
        />
        <Knob
          value={settings.release}
          min={0.001}
          max={8}
          onChange={v => set({ release: v })}
          label="REL"
          unit="s"
          size={36}
          color={color}
        />
      </div>
    </div>
  );
};

export default EnvelopeSection;
