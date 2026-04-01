import React, { useRef, useState, useCallback } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
  unit?: string;
  size?: number;
  color?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export const Knob: React.FC<KnobProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  unit,
  size = 44,
  color = '#9945ff',
}) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const START_ANGLE = 225;
  const END_ANGLE = 495; // 225 + 270
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const fillAngle = START_ANGLE + normalized * 270;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const trackR = r - 2;

  const formatValue = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (Number.isInteger(v)) return `${v}`;
    return v.toFixed(2).replace(/\.?0+$/, '');
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startValue: value };

    const onMouseMove = (me: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - me.clientY;
      const range = max - min;
      const sensitivity = me.shiftKey ? 0.001 : 0.005;
      const newVal = Math.max(min, Math.min(max, dragRef.current.startValue + dy * range * sensitivity));
      onChange(newVal);
    };

    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [value, min, max, onChange]);

  const handleDoubleClick = useCallback(() => {
    setInputVal(formatValue(value));
    setEditing(true);
  }, [value]);

  const commitEdit = useCallback(() => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      onChange(Math.max(min, Math.min(max, parsed)));
    }
    setEditing(false);
  }, [inputVal, min, max, onChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const range = max - min;
    const step = range * 0.01;
    const newVal = Math.max(min, Math.min(max, value - Math.sign(e.deltaY) * step));
    onChange(newVal);
  }, [value, min, max, onChange]);

  // Indicator line endpoint
  const indicatorOuter = polarToCartesian(cx, cy, r - 3, fillAngle);
  const indicatorInner = polarToCartesian(cx, cy, r - 9, fillAngle);

  const gradId = `knob-grad-${label?.replace(/\s/g, '') ?? Math.random().toString(36).slice(2)}`;
  const glowId = `knob-glow-${label?.replace(/\s/g, '') ?? Math.random().toString(36).slice(2)}`;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none" style={{ width: size + 16 }}>
      <div
        style={{ position: 'relative', width: size, height: size, cursor: 'ns-resize' }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          width={size}
          height={size}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#2a2a3e" />
              <stop offset="100%" stopColor="#111120" />
            </radialGradient>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Body circle */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={`url(#${gradId})`}
            stroke="#333355"
            strokeWidth="1.5"
          />

          {/* Track arc */}
          <path
            d={describeArc(cx, cy, trackR, START_ANGLE, END_ANGLE)}
            fill="none"
            stroke="#1e1e2e"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Fill arc */}
          {normalized > 0 && (
            <path
              d={describeArc(cx, cy, trackR, START_ANGLE, Math.min(fillAngle, END_ANGLE))}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            />
          )}

          {/* Outer ring highlight */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />

          {/* Center dot */}
          <circle
            cx={cx}
            cy={cy}
            r={size * 0.08}
            fill="#0d0d1a"
            stroke={color}
            strokeWidth="0.75"
            style={{ filter: `drop-shadow(0 0 2px ${color})` }}
          />

          {/* Indicator line */}
          <line
            x1={indicatorInner.x}
            y1={indicatorInner.y}
            x2={indicatorOuter.x}
            y2={indicatorOuter.y}
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 2px ${color})` }}
          />
        </svg>
      </div>

      {/* Value display */}
      {editing ? (
        <input
          autoFocus
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
          style={{
            width: size + 8,
            background: 'rgba(153,69,255,0.15)',
            border: `1px solid ${color}`,
            color: '#e0e0ff',
            fontSize: 9,
            textAlign: 'center',
            borderRadius: 3,
            outline: 'none',
            padding: '1px 2px',
          }}
        />
      ) : (
        <span style={{ fontSize: 9, color: '#9090b0', letterSpacing: 0.3 }}>
          {formatValue(value)}{unit ?? ''}
        </span>
      )}

      {label && (
        <span style={{ fontSize: 8, color: '#606080', letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>
          {label}
        </span>
      )}
    </div>
  );
};

export default Knob;
