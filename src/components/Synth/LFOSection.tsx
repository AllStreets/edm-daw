import React, { useEffect, useRef } from 'react';
import type { LFOSettings, LFOShape, LFOTarget } from '../../types';
import { Knob } from './Knob';

interface LFOSectionProps {
  settings: LFOSettings;
  onChange: (s: LFOSettings) => void;
}

const COLOR = '#ff9500';

const SHAPES: { shape: LFOShape; icon: React.ReactNode }[] = [
  {
    shape: 'sine',
    icon: (
      <svg width="24" height="14" viewBox="0 0 24 14">
        <path d="M2,7 C4,7 5,2 7,2 C9,2 10,12 12,12 C14,12 15,2 17,2 C19,2 20,7 22,7"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    shape: 'triangle',
    icon: (
      <svg width="24" height="14" viewBox="0 0 24 14">
        <polyline points="2,12 7,2 12,12 17,2 22,12"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    shape: 'square',
    icon: (
      <svg width="24" height="14" viewBox="0 0 24 14">
        <polyline points="2,12 2,3 9,3 9,12 9,3 15,3 15,12 15,3 22,3 22,12"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
      </svg>
    ),
  },
  {
    shape: 'sawtooth',
    icon: (
      <svg width="24" height="14" viewBox="0 0 24 14">
        <polyline points="2,12 9,2 9,12 16,2 16,12 22,2"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const TARGETS: { target: LFOTarget; label: string }[] = [
  { target: 'pitch', label: 'PITCH' },
  { target: 'filter', label: 'FILTER' },
  { target: 'volume', label: 'VOL' },
  { target: 'pan', label: 'PAN' },
];

function AnimatedWaveform({ shape, on, rate }: { shape: LFOShape; on: boolean; rate: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, W, H);

      // Center line
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      if (!on) {
        // Static center line
        ctx.strokeStyle = `${COLOR}33`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }

      // Draw waveform with phase offset
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLOR;
      ctx.shadowBlur = 6;
      ctx.beginPath();

      for (let px = 0; px <= W; px++) {
        const t = (px / W) * 2 + phaseRef.current;
        let y: number;

        switch (shape) {
          case 'sine':
            y = Math.sin(t * Math.PI);
            break;
          case 'triangle':
            y = 1 - Math.abs(((t % 2) + 2) % 2 - 1) * 2;
            break;
          case 'square':
            y = Math.sin(t * Math.PI) >= 0 ? 1 : -1;
            break;
          case 'sawtooth':
            y = 1 - ((t % 2) + 2) % 2;
            break;
          default:
            y = 0;
        }

        const canvasY = H / 2 - y * (H / 2 - 4);
        if (px === 0) ctx.moveTo(px, canvasY);
        else ctx.lineTo(px, canvasY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    let lastTime = 0;
    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      if (on) {
        phaseRef.current += dt * rate * 0.5;
      }
      draw();
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [shape, on, rate]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={36}
      style={{ display: 'block', width: '100%', borderRadius: 4 }}
    />
  );
}

export const LFOSection: React.FC<LFOSectionProps> = ({ settings, onChange }) => {
  const set = (partial: Partial<LFOSettings>) => onChange({ ...settings, ...partial });

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, #130e00 0%, #18120a 100%)',
        border: `1px solid ${settings.on ? COLOR + '44' : '#222235'}`,
        boxShadow: settings.on ? `0 0 12px ${COLOR}22` : 'none',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: COLOR, textTransform: 'uppercase' }}>
          LFO
        </span>
        <div className="flex items-center gap-2">
          {/* BPM Sync */}
          <button
            onClick={() => set({ sync: !settings.sync })}
            style={{
              padding: '2px 7px',
              borderRadius: 3,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.5,
              background: settings.sync ? `${COLOR}33` : '#0d0d1c',
              border: `1px solid ${settings.sync ? COLOR : '#333355'}`,
              color: settings.sync ? COLOR : '#505070',
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            SYNC
          </button>
          {/* On/Off */}
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
      </div>

      {/* Animated waveform preview */}
      <div style={{ background: '#07080f', borderRadius: 5, border: '1px solid #181828', padding: 4, overflow: 'hidden' }}>
        <AnimatedWaveform shape={settings.shape} on={settings.on} rate={settings.rate} />
      </div>

      {/* Shape selector */}
      <div className="flex gap-1">
        {SHAPES.map(({ shape, icon }) => (
          <button
            key={shape}
            onClick={() => set({ shape })}
            style={{
              flex: 1,
              padding: '4px 2px',
              borderRadius: 5,
              background: settings.shape === shape
                ? `linear-gradient(135deg, ${COLOR}33, ${COLOR}11)`
                : '#0d0d1c',
              border: `1px solid ${settings.shape === shape ? COLOR : '#222235'}`,
              color: settings.shape === shape ? COLOR : '#505070',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s',
              boxShadow: settings.shape === shape ? `0 0 8px ${COLOR}44` : 'none',
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* Knobs */}
      <div className="flex justify-around">
        <Knob
          value={settings.rate}
          min={0.01}
          max={20}
          onChange={v => set({ rate: v })}
          label={settings.sync ? 'BEAT' : 'RATE'}
          unit={settings.sync ? '' : 'Hz'}
          size={40}
          color={COLOR}
        />
        <Knob
          value={settings.amount}
          min={0}
          max={1}
          onChange={v => set({ amount: v })}
          label="AMT"
          size={40}
          color={COLOR}
        />
      </div>

      {/* Target selector */}
      <div className="flex gap-1">
        {TARGETS.map(({ target, label }) => (
          <button
            key={target}
            onClick={() => set({ target })}
            style={{
              flex: 1,
              padding: '3px 4px',
              borderRadius: 10,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.4,
              background: settings.target === target
                ? `linear-gradient(135deg, ${COLOR}44, ${COLOR}22)`
                : '#0d0d1c',
              border: `1px solid ${settings.target === target ? COLOR : '#222235'}`,
              color: settings.target === target ? COLOR : '#505070',
              cursor: 'pointer',
              transition: 'all 0.12s',
              textAlign: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LFOSection;
