import { useRef, useCallback, useEffect } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { audioEngine } from '../../engine/AudioEngine';

interface OscilloscopeProps {
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTrigger?: boolean;
}

export function Oscilloscope({
  height = 120,
  color = '#00ff88',
  showGrid = true,
  showTrigger = true,
}: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Resize canvas to container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 300;
      if (canvasRef.current) canvasRef.current.width = Math.floor(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback((_dt: number, timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const centerY = h / 2;

    // --- Read REAL waveform data from audio engine ---
    const waveData = audioEngine.waveformAnalyzer.getValue() as Float32Array;
    const samples = waveData.length;

    // Phosphor decay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0,60,20,0.7)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 8; i++) {
        const x = (i / 8) * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let i = 1; i < 4; i++) {
        const y = (i / 4) * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,80,30,0.9)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(w, centerY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    }

    // Find trigger point (rising zero-crossing) for stable display
    let triggerIdx = 0;
    if (showTrigger) {
      for (let i = 1; i < samples - 1; i++) {
        if (waveData[i - 1] < 0 && waveData[i] >= 0) {
          triggerIdx = i;
          break;
        }
      }
    }

    // Build display points
    const displaySamples = Math.min(samples - triggerIdx, samples);
    const points: [number, number][] = [];
    for (let i = 0; i < displaySamples; i++) {
      const x = (i / displaySamples) * w;
      const sample = waveData[triggerIdx + i] ?? 0;
      const y = centerY - sample * (h * 0.42);
      points.push([x, Math.max(1, Math.min(h - 1, y))]);
    }

    // Draw waveform with glow layers
    const drawWave = (lineWidth: number, alpha: number, blur: number) => {
      if (points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = alpha;
      if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
      ctx.restore();
    };

    drawWave(4, 0.12, 12);
    drawWave(2, 0.35, 5);
    drawWave(1.2, 0.95, 0);

    // Trigger marker
    if (showTrigger) {
      ctx.strokeStyle = 'rgba(255,200,0,0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(0, centerY); ctx.lineTo(8, centerY); ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,0,0.8)';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, centerY - 5);
      ctx.lineTo(6, centerY);
      ctx.lineTo(0, centerY + 5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(0,80,30,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(0,180,80,0.5)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('OSC', 4, 12);

    ctx.fillStyle = 'rgba(0,150,60,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText(`${(timestamp / 1000).toFixed(1)}s`, w - 4, 12);
    ctx.textAlign = 'left';
  }, [color, showGrid, showTrigger]);

  useAnimationFrame(draw, true);

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <canvas
        ref={canvasRef}
        width={300}
        height={height}
        style={{ display: 'block', width: '100%', height, background: '#000' }}
      />
    </div>
  );
}
