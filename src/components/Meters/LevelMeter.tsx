import { useRef, useCallback } from 'react';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';

interface LevelMeterProps {
  level: number; // 0-1
  peak?: number; // 0-1
  orientation?: 'vertical' | 'horizontal';
  width?: number;
  height?: number;
  showClip?: boolean;
  showdB?: boolean;
}

export function LevelMeter({
  level,
  peak,
  orientation = 'vertical',
  width = 12,
  height = 120,
  showClip = true,
  showdB = false,
}: LevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakHoldRef = useRef<number>(peak ?? level);
  const peakFallRef = useRef<number>(0);
  const smoothLevelRef = useRef<number>(level);
  const clippingRef = useRef<boolean>(false);
  const clipTimerRef = useRef<number>(0);

  // Update level reference when prop changes
  const levelRef = useRef(level);
  levelRef.current = level;
  const peakRef = useRef(peak);
  peakRef.current = peak;

  const draw = useCallback((_dt: number, timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const isVertical = orientation === 'vertical';

    // Smooth the incoming level
    const targetLevel = levelRef.current;
    const smoothFactor = targetLevel > smoothLevelRef.current ? 0.4 : 0.1;
    smoothLevelRef.current += (targetLevel - smoothLevelRef.current) * smoothFactor;
    const currentLevel = smoothLevelRef.current;

    // Peak hold logic
    const externalPeak = peakRef.current;
    if (externalPeak !== undefined) {
      peakHoldRef.current = externalPeak;
    } else {
      if (currentLevel > peakHoldRef.current) {
        peakHoldRef.current = currentLevel;
        peakFallRef.current = timestamp + 1200; // hold for 1.2s
      } else if (timestamp > peakFallRef.current) {
        peakHoldRef.current = Math.max(0, peakHoldRef.current - 0.003);
      }
    }

    // Clip detection
    if (currentLevel >= 0.98) {
      clippingRef.current = true;
      clipTimerRef.current = timestamp + 2000;
    } else if (timestamp > clipTimerRef.current) {
      clippingRef.current = false;
    }

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);

    const clipIndicatorH = showClip ? 6 : 0;
    const meterH = h - clipIndicatorH - 2;
    const meterY = clipIndicatorH + 2;

    if (isVertical) {
      // Segment count
      const totalSegments = 40;
      const segGap = 1;
      const segH = Math.max(1, (meterH - (totalSegments - 1) * segGap) / totalSegments);
      const filledSegments = Math.round(currentLevel * totalSegments);
      const peakSegment = Math.round(peakHoldRef.current * totalSegments);

      for (let i = 0; i < totalSegments; i++) {
        const segY = meterY + meterH - (i + 1) * (segH + segGap) + segGap;
        const segFrac = i / totalSegments;
        const filled = i < filledSegments;

        let color: string;
        if (segFrac >= 0.9) {
          color = filled ? '#ff2020' : '#2a0808';
        } else if (segFrac >= 0.7) {
          color = filled ? '#ffcc00' : '#1a1a04';
        } else {
          color = filled ? '#00e060' : '#041a0a';
        }

        ctx.fillStyle = color;
        ctx.fillRect(0, segY, w, segH);

        // Peak indicator segment
        if (i === peakSegment && peakHoldRef.current > 0.01) {
          ctx.fillStyle = peakHoldRef.current >= 0.9 ? '#ff6060' : peakHoldRef.current >= 0.7 ? '#ffee44' : '#44ffaa';
          ctx.fillRect(0, segY, w, segH);
        }
      }
    } else {
      // Horizontal
      const totalSegments = 40;
      const segGap = 1;
      const segW = Math.max(1, (w - (totalSegments - 1) * segGap) / totalSegments);
      const filledSegments = Math.round(currentLevel * totalSegments);
      const peakSegment = Math.round(peakHoldRef.current * totalSegments);

      for (let i = 0; i < totalSegments; i++) {
        const segX = i * (segW + segGap);
        const segFrac = i / totalSegments;
        const filled = i < filledSegments;

        let color: string;
        if (segFrac >= 0.9) {
          color = filled ? '#ff2020' : '#2a0808';
        } else if (segFrac >= 0.7) {
          color = filled ? '#ffcc00' : '#1a1a04';
        } else {
          color = filled ? '#00e060' : '#041a0a';
        }

        ctx.fillStyle = color;
        ctx.fillRect(segX, meterY, segW, meterH);

        if (i === peakSegment && peakHoldRef.current > 0.01) {
          ctx.fillStyle = peakHoldRef.current >= 0.9 ? '#ff6060' : peakHoldRef.current >= 0.7 ? '#ffee44' : '#44ffaa';
          ctx.fillRect(segX, meterY, segW, meterH);
        }
      }
    }

    // Clip LED
    if (showClip) {
      ctx.fillStyle = clippingRef.current ? '#ff2020' : '#2a0808';
      ctx.beginPath();
      ctx.arc(w / 2, 3, 3, 0, Math.PI * 2);
      ctx.fill();
      if (clippingRef.current) {
        ctx.shadowColor = '#ff4040';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.arc(w / 2, 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [orientation, showClip]);

  useAnimationFrame(draw, true);

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ imageRendering: 'pixelated' }}
      />
      {showdB && (
        <div
          className="text-[8px] text-gray-600 font-mono select-none"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 7 }}
        >
          +6 0 -6 -12 -∞
        </div>
      )}
    </div>
  );
}

// Stereo level meter (L+R side by side)
interface StereoLevelMeterProps {
  levelL: number;
  levelR: number;
  height?: number;
  width?: number;
  showClip?: boolean;
}

export function StereoLevelMeter({ levelL, levelR, height = 120, width = 28, showClip = true }: StereoLevelMeterProps) {
  const chanW = Math.floor((width - 2) / 2);
  return (
    <div className="flex gap-0.5" style={{ width, height }}>
      <LevelMeter level={levelL} orientation="vertical" width={chanW} height={height} showClip={showClip} />
      <LevelMeter level={levelR} orientation="vertical" width={chanW} height={height} showClip={showClip} />
    </div>
  );
}
