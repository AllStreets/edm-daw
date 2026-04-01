import { useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';

interface OscilloscopeProps {
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTrigger?: boolean;
}

export function Oscilloscope({
  width = 300,
  height = 120,
  color = '#00ff88',
  showGrid = true,
  showTrigger = true,
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(0);
  const phase2Ref = useRef(0.7);
  const phase3Ref = useRef(1.4);

  const draw = useCallback((dt: number, timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const centerY = h / 2;

    // Advance phases — simulate complex waveform
    phaseRef.current += (dt / 1000) * 2.1; // ~2.1Hz fundamental
    phase2Ref.current += (dt / 1000) * 4.2; // harmonic
    phase3Ref.current += (dt / 1000) * 6.3; // harmonic

    // Phosphor decay (draw semi-transparent bg)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0,60,20,0.7)';
      ctx.lineWidth = 0.5;

      // Vertical grid lines (8 divisions)
      for (let i = 1; i < 8; i++) {
        const x = (i / 8) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      // Horizontal grid lines (4 divisions)
      for (let i = 1; i < 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center lines (brighter)
      ctx.strokeStyle = 'rgba(0,80,30,0.9)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();
    }

    // Generate waveform samples
    const samples = w * 2;
    const points: [number, number][] = [];

    for (let i = 0; i < samples; i++) {
      const x = (i / samples) * w;
      const t = (i / samples) * Math.PI * 4; // 2 full cycles

      // Complex multi-harmonic waveform
      const wave =
        Math.sin(t + phaseRef.current) * 0.45 +
        Math.sin(2 * t + phase2Ref.current) * 0.25 +
        Math.sin(3 * t + phase3Ref.current) * 0.12 +
        Math.sin(4 * t + phaseRef.current * 1.1) * 0.06 +
        // Subtle noise
        (Math.random() - 0.5) * 0.015;

      const amplitude = (h * 0.38);
      const y = centerY - wave * amplitude;
      points.push([x, Math.max(1, Math.min(h - 1, y))]);
    }

    // Find trigger point (rising zero-crossing near center)
    let triggerIdx = 0;
    if (showTrigger) {
      for (let i = 1; i < points.length; i++) {
        const [, y1] = points[i - 1];
        const [, y2] = points[i];
        if (y1 > centerY && y2 <= centerY) {
          triggerIdx = i;
          break;
        }
      }
    }

    // Draw waveform with glow
    const drawWave = (lineWidth: number, alpha: number, blur: number) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = alpha;
      if (blur > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur;
      }
      ctx.beginPath();

      let started = false;
      for (let i = triggerIdx; i < points.length; i++) {
        const [x, y] = points[i];
        const drawX = x - (points[triggerIdx]?.[0] ?? 0);
        if (drawX > w) break;
        if (!started) {
          ctx.moveTo(drawX, y);
          started = true;
        } else {
          ctx.lineTo(drawX, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    // Outer glow
    drawWave(4, 0.15, 12);
    // Mid glow
    drawWave(2, 0.4, 5);
    // Core line
    drawWave(1.2, 0.95, 0);

    // Trigger marker
    if (showTrigger) {
      ctx.strokeStyle = 'rgba(255,200,0,0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(8, centerY);
      ctx.stroke();

      // Trigger arrow
      ctx.fillStyle = 'rgba(255,200,0,0.8)';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, centerY - 5);
      ctx.lineTo(6, centerY);
      ctx.lineTo(0, centerY + 5);
      ctx.closePath();
      ctx.fill();
    }

    // Border
    ctx.strokeStyle = 'rgba(0,80,30,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, w, h);

    // Corner label
    ctx.fillStyle = 'rgba(0,180,80,0.5)';
    ctx.font = '8px monospace';
    ctx.fillText('OSC', 4, 12);

    // Time label
    const timeMs = (timestamp / 1000).toFixed(1);
    ctx.fillStyle = 'rgba(0,150,60,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(`${timeMs}s`, w - 4, 12);
    ctx.textAlign = 'left';
  }, [color, showGrid, showTrigger]);

  useAnimationFrame(draw, true);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded"
      style={{ display: 'block', background: '#000' }}
    />
  );
}
