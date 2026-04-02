import { useRef, useCallback, useEffect } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { audioEngine } from '../../engine/AudioEngine';

interface SpectrumAnalyzerProps {
  height?: number;
  showPeak?: boolean;
  showLabels?: boolean;
  barCount?: number;
}

const FREQ_LABELS = ['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'];

export function SpectrumAnalyzer({
  height = 160,
  showPeak = true,
  showLabels = true,
  barCount = 64,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peakRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));
  const peakTimerRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));
  const smoothRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));

  // Resize canvas to container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 400;
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
    const labelH = showLabels ? 18 : 0;
    const h = canvas.height - labelH;

    // --- Read REAL FFT data from audio engine ---
    const fftData = audioEngine.analyzer.getValue() as Float32Array;
    const fftSize = fftData.length; // e.g. 256 bins

    // Map FFT bins to bar buckets (logarithmic frequency scale)
    const levels = new Float32Array(barCount);
    for (let b = 0; b < barCount; b++) {
      // Log scale: map bar index to FFT bin range
      const startBin = Math.floor(Math.pow(b / barCount, 2) * fftSize);
      const endBin = Math.max(startBin + 1, Math.floor(Math.pow((b + 1) / barCount, 2) * fftSize));
      let maxDb = -140;
      for (let k = startBin; k < endBin && k < fftSize; k++) {
        if (fftData[k] > maxDb) maxDb = fftData[k];
      }
      // Normalize: -100dB → 0, 0dB → 1
      levels[b] = Math.max(0, Math.min(1, (maxDb + 100) / 100));
    }

    // Smooth toward real data
    for (let i = 0; i < barCount; i++) {
      const target = levels[i];
      const current = smoothRef.current[i];
      const factor = target > current ? 0.6 : 0.15;
      smoothRef.current[i] = current + (target - current) * factor;

      if (showPeak) {
        if (smoothRef.current[i] > peakRef.current[i]) {
          peakRef.current[i] = smoothRef.current[i];
          peakTimerRef.current[i] = timestamp + 1200;
        } else if (timestamp > peakTimerRef.current[i]) {
          peakRef.current[i] = Math.max(0, peakRef.current[i] - 0.004);
        }
      }
    }

    // Background
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, w, h + labelH);

    // Grid lines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(0, h - frac * h);
      ctx.lineTo(w, h - frac * h);
      ctx.stroke();
    }

    // Gradient
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#9945ff');
    grad.addColorStop(0.5, '#5588ff');
    grad.addColorStop(0.85, '#00d4ff');
    grad.addColorStop(1, '#00ffee');

    const barW = w / barCount;
    const gap = Math.max(0.5, barW * 0.15);

    for (let i = 0; i < barCount; i++) {
      const level = smoothRef.current[i];
      const x = i * barW + gap / 2;
      const bw = barW - gap;
      const barH = level * h;
      if (barH < 0.5) continue;

      ctx.fillStyle = grad;
      ctx.fillRect(x, h - barH, bw, barH);

      // Glow cap
      const glowGrad = ctx.createLinearGradient(0, h - barH, 0, h - barH - 6);
      glowGrad.addColorStop(0, 'rgba(0,212,255,0.8)');
      glowGrad.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x, h - barH - 6, bw, 6);

      // Peak line
      if (showPeak && peakRef.current[i] > 0.02) {
        const peakY = h - peakRef.current[i] * h;
        ctx.fillStyle = '#00ffee';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, peakY - 1, bw, 2);
        ctx.globalAlpha = 1;
      }
    }

    // Frequency labels
    if (showLabels) {
      ctx.font = '9px monospace';
      const step = w / (FREQ_LABELS.length - 1);
      FREQ_LABELS.forEach((label, idx) => {
        const x = idx * step;
        ctx.fillStyle = '#333355';
        ctx.fillRect(x, h, 1, 4);
        ctx.fillStyle = '#555577';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, h + labelH - 3);
      });
    }

    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h + labelH);
  }, [barCount, showLabels, showPeak]);

  useAnimationFrame(draw, true);

  return (
    <div ref={containerRef} style={{ width: '100%', height }}>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        style={{ display: 'block', width: '100%', height }}
      />
    </div>
  );
}
