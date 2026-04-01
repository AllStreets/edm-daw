import { useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';

interface SpectrumAnalyzerProps {
  width?: number;
  height?: number;
  mirror?: boolean;
  showPeak?: boolean;
  showLabels?: boolean;
  barCount?: number;
}

const FREQ_LABELS = ['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'];

export function SpectrumAnalyzer({
  width = 400,
  height = 160,
  mirror = false,
  showPeak = true,
  showLabels = true,
  barCount = 64,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulated spectrum state
  const spectrumRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));
  const peakRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));
  const peakTimerRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));
  const targetRef = useRef<Float32Array>(new Float32Array(barCount).fill(0));
  const phaseRef = useRef<Float32Array>((() => {
    const arr = new Float32Array(barCount);
    for (let i = 0; i < barCount; i++) arr[i] = Math.random() * Math.PI * 2;
    return arr;
  })());

  const updateTarget = useCallback((timestamp: number) => {
    // Generate a convincing EDM spectrum
    for (let i = 0; i < barCount; i++) {
      const frac = i / barCount;

      // Sub-bass bump (0-5%)
      let level = 0;
      if (frac < 0.05) {
        level = 0.6 + Math.sin(timestamp * 0.002 + phaseRef.current[i]) * 0.3;
      }
      // Bass region (5-15%)
      else if (frac < 0.15) {
        level = 0.75 + Math.sin(timestamp * 0.003 + phaseRef.current[i]) * 0.2;
      }
      // Low mid (15-30%)
      else if (frac < 0.3) {
        level = 0.45 + Math.sin(timestamp * 0.004 + phaseRef.current[i]) * 0.15;
      }
      // Mid presence (30-50%)
      else if (frac < 0.5) {
        level = 0.35 + Math.sin(timestamp * 0.005 + phaseRef.current[i]) * 0.12;
      }
      // High mid (50-70%)
      else if (frac < 0.7) {
        level = 0.25 + Math.sin(timestamp * 0.006 + phaseRef.current[i]) * 0.1;
      }
      // High freq (70-90%)
      else if (frac < 0.9) {
        level = 0.15 + Math.sin(timestamp * 0.007 + phaseRef.current[i]) * 0.08;
      }
      // Air (90-100%)
      else {
        level = 0.08 + Math.sin(timestamp * 0.008 + phaseRef.current[i]) * 0.06;
      }

      // Add periodic "beat" spike in low end
      const beatPhase = (timestamp * 0.002) % (Math.PI * 2);
      if (i < 4 && Math.sin(beatPhase) > 0.7) {
        level = Math.min(1, level + Math.sin(beatPhase) * 0.25);
      }

      // Add some transient noise
      level += (Math.random() - 0.5) * 0.04;
      targetRef.current[i] = Math.max(0, Math.min(1, level));
    }
  }, [barCount]);

  const draw = useCallback((_dt: number, timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const labelH = showLabels ? 18 : 0;
    const h = canvas.height - labelH;

    updateTarget(timestamp);

    // Smooth spectrum toward target
    for (let i = 0; i < barCount; i++) {
      const target = targetRef.current[i];
      const current = spectrumRef.current[i];
      const factor = target > current ? 0.35 : 0.12;
      spectrumRef.current[i] = current + (target - current) * factor;

      // Peak hold
      if (spectrumRef.current[i] > peakRef.current[i]) {
        peakRef.current[i] = spectrumRef.current[i];
        peakTimerRef.current[i] = timestamp + 1500;
      } else if (timestamp > peakTimerRef.current[i]) {
        peakRef.current[i] = Math.max(0, peakRef.current[i] - 0.005);
      }
    }

    // Background
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, w, h + labelH);

    // Grid lines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    const gridLines = [0.25, 0.5, 0.75];
    for (const frac of gridLines) {
      const y = h - frac * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const barW = w / barCount;
    const gap = Math.max(0.5, barW * 0.15);

    // Create gradient
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#9945ff');
    grad.addColorStop(0.5, '#5588ff');
    grad.addColorStop(0.85, '#00d4ff');
    grad.addColorStop(1, '#00ffee');

    const mirrorGrad = ctx.createLinearGradient(0, 0, 0, h);
    mirrorGrad.addColorStop(0, 'rgba(153,69,255,0.15)');
    mirrorGrad.addColorStop(1, 'rgba(0,212,255,0)');

    for (let i = 0; i < barCount; i++) {
      const level = spectrumRef.current[i];
      const x = i * barW + gap / 2;
      const bw = barW - gap;
      const barH = level * h;

      if (barH < 0.5) continue;

      // Main bar
      ctx.fillStyle = grad;
      ctx.fillRect(x, h - barH, bw, barH);

      // Glow at top of bar
      const glowGrad = ctx.createLinearGradient(0, h - barH, 0, h - barH - 8);
      glowGrad.addColorStop(0, 'rgba(0,212,255,0.8)');
      glowGrad.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x, h - barH - 8, bw, 8);

      // Mirror reflection
      if (mirror) {
        ctx.fillStyle = mirrorGrad;
        ctx.fillRect(x, h, bw, barH * 0.4);
      }

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
    if (showLabels && FREQ_LABELS.length > 0) {
      ctx.fillStyle = '#444466';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      const step = w / (FREQ_LABELS.length - 1);
      FREQ_LABELS.forEach((label, idx) => {
        const x = idx * step;
        ctx.fillStyle = '#333355';
        ctx.fillRect(x, h, 1, 4);
        ctx.fillStyle = '#555577';
        ctx.fillText(label, x, h + labelH - 3);
      });
    }

    // Border
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h + labelH);
  }, [barCount, showLabels, showPeak, mirror, updateTarget]);

  useAnimationFrame(draw, true);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded"
      style={{ display: 'block' }}
    />
  );
}
