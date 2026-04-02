import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { DRUM_PRESETS, DRUM_PRESET_NAMES } from '../../data/presets';

// ─── Constants ───────────────────────────────────────────────────────────────

const DRUM_NAMES = [
  'Kick', 'Snare', 'Clap', 'HH', 'PHH', 'Tom', 'Rim', 'Cym',
  'Kick2', 'Sn2', 'Crash', 'Ride', 'TomH', 'TomL', 'Impact', 'Rev',
];

const DRUM_COLORS = [
  '#ff4444', '#ffaa00', '#ffcc00', '#00d4ff',
  '#00aaff', '#9945ff', '#ff88aa', '#ff6600',
  '#ff2222', '#ffdd44', '#00ffcc', '#44aaff',
  '#cc88ff', '#ff66cc', '#ff3300', '#aaffaa',
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface StepSequencerProps {
  trackId: string;
  patternId: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface VelocityKnobProps {
  value: number; // 0-127
  color: string;
  onChange: (v: number) => void;
}

const VelocityKnob: React.FC<VelocityKnobProps> = ({ value, color, onChange }) => {
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startVal, setStartVal] = useState(value);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    setStartY(e.clientY);
    setStartVal(value);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      const delta = startY - e.clientY;
      const newVal = Math.max(0, Math.min(127, startVal + Math.round(delta * 1.2)));
      onChange(newVal);
    },
    [dragging, startY, startVal, onChange]
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const pct = value / 127;
  const rotation = -135 + pct * 270;
  const radius = 10;
  const cx = 14;
  const cy = 14;
  const angle = (rotation - 90) * (Math.PI / 180);
  const indicatorX = cx + radius * Math.cos(angle);
  const indicatorY = cy + radius * Math.sin(angle);

  return (
    <div
      className="flex flex-col items-center gap-0.5 cursor-ns-resize select-none"
      onMouseDown={handleMouseDown}
      title={`Velocity: ${value}`}
    >
      <svg width="28" height="28" viewBox="0 0 28 28">
        {/* Track arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#2a2a3a"
          strokeWidth="3"
          strokeDasharray={`${2 * Math.PI * radius * 0.75} ${2 * Math.PI * radius * 0.25}`}
          strokeDashoffset={2 * Math.PI * radius * 0.125}
          strokeLinecap="round"
        />
        {/* Fill arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${2 * Math.PI * radius * 0.75 * pct} ${2 * Math.PI * radius}`}
          strokeDashoffset={2 * Math.PI * radius * 0.125}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 2px ${color})` }}
        />
        {/* Knob body */}
        <circle cx={cx} cy={cy} r="6" fill="#1a1a2e" stroke="#3a3a4e" strokeWidth="1" />
        {/* Indicator dot */}
        <circle cx={indicatorX} cy={indicatorY} r="1.5" fill={color} />
      </svg>
      <span className="text-[8px] text-gray-500 font-mono leading-none">{value}</span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const StepSequencer: React.FC<StepSequencerProps> = ({ trackId, patternId }) => {
  const { project, toggleStep, updatePattern, currentStep } = useProjectStore();

  const track = project.tracks.find(t => t.id === trackId);
  const pattern = track?.patterns.find(p => p.id === patternId);

  const [stepCount, setStepCount] = useState<16 | 32>(
    (pattern?.steps as 16 | 32) ?? 16
  );
  const [velocities, setVelocities] = useState<number[]>(Array(16).fill(100));
  const [selectedPreset, setSelectedPreset] = useState('');
  // Track which sample name is "loaded" on each drum row (visual only)
  const [rowSamples, setRowSamples] = useState<(string | null)[]>(Array(16).fill(null));
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);

  // Selection state
  const [selAnchor, setSelAnchor] = useState<{ row: number; step: number } | null>(null);
  const [selRect, setSelRect] = useState<{ rowMin: number; rowMax: number; stepMin: number; stepMax: number } | null>(null);
  const stepClipboard = useRef<Array<{ row: number; stepOffset: number; on: boolean }>>([]);
  const isDragSelecting = useRef(false);

  if (!track || !pattern) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
        No pattern selected
      </div>
    );
  }

  const stepData: boolean[][] = pattern.stepData ?? Array.from({ length: 16 }, () => Array(32).fill(false));

  // Pad stepData to always have 16 rows (non-destructive — local variable only)
  const paddedStepData: boolean[][] = stepData.length >= 16
    ? stepData
    : [
        ...stepData,
        ...Array.from({ length: 16 - stepData.length }, () =>
          Array(pattern.steps).fill(false)
        ),
      ];

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleToggleStep = (row: number, step: number) => {
    toggleStep(trackId, patternId, row, step);
  };

  const handleStepCountChange = (count: 16 | 32) => {
    setStepCount(count);
    updatePattern(trackId, patternId, { steps: count });
  };

  const handleClear = () => {
    for (let row = 0; row < 8; row++) {
      for (let step = 0; step < 32; step++) {
        if (stepData[row]?.[step]) {
          toggleStep(trackId, patternId, row, step);
        }
      }
    }
  };

  const handleCopyPattern = () => {
    navigator.clipboard
      .writeText(JSON.stringify(stepData))
      .catch(() => {});
  };

  const handleRandomize = () => {
    handleClear();
    setTimeout(() => {
      // Kick on beats
      [0, 4, 8, 12].forEach(s => toggleStep(trackId, patternId, 0, s));
      // Snare on 4, 12
      [4, 12].forEach(s => toggleStep(trackId, patternId, 1, s));
      // Hi-hat with randomness
      for (let s = 0; s < stepCount; s += 2) {
        if (Math.random() > 0.3) toggleStep(trackId, patternId, 3, s);
      }
      // Random hits on other rows
      for (let row = 2; row < 8; row++) {
        if (row === 3) continue;
        for (let s = 0; s < stepCount; s++) {
          if (Math.random() < 0.08) toggleStep(trackId, patternId, row, s);
        }
      }
    }, 10);
  };

  const handlePreset = (presetName: string) => {
    if (!presetName) return;
    setSelectedPreset(presetName);
    const preset = DRUM_PRESETS[presetName];
    if (!preset) return;
    // Clear first
    for (let row = 0; row < 8; row++) {
      for (let step = 0; step < 32; step++) {
        if (stepData[row]?.[step]) toggleStep(trackId, patternId, row, step);
      }
    }
    setTimeout(() => {
      for (let row = 0; row < 8; row++) {
        for (let step = 0; step < Math.min(stepCount, preset[row]?.length ?? 0); step++) {
          if (preset[row][step]) toggleStep(trackId, patternId, row, step);
        }
      }
    }, 10);
  };

  const updateVelocity = (row: number, val: number) => {
    setVelocities(prev => {
      const next = [...prev];
      next[row] = val;
      return next;
    });
  };

  // ── Sample drag-and-drop onto rows ─────────────────────────────────────────

  const handleRowDragOver = (e: React.DragEvent, _row: number) => {
    if (e.dataTransfer.types.includes('application/x-daw-sample')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleRowDrop = (e: React.DragEvent, row: number) => {
    e.preventDefault();
    setDragOverRow(null);
    const raw = e.dataTransfer.getData('application/x-daw-sample');
    if (!raw) return;
    try {
      const { name } = JSON.parse(raw) as { name: string; category: string };
      const displayName = name.replace(/_/g, ' ').replace(/\.[^.]+$/, '');
      setRowSamples(prev => {
        const next = [...prev];
        next[row] = displayName;
        return next;
      });
    } catch {
      // ignore invalid drop data
    }
  };

  // ── Copy/paste keydown listener ─────────────────────────────────────────────

  useEffect(() => {
    const IS_MAC = typeof navigator !== 'undefined'
      ? ((navigator as any).userAgentData?.platform ?? navigator.platform).toUpperCase().includes('MAC')
      : false;

    const onKey = (e: KeyboardEvent) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;

      if (mod && e.key === 'c' && selRect) {
        e.preventDefault();
        const items: Array<{ row: number; stepOffset: number; on: boolean }> = [];
        for (let r = selRect.rowMin; r <= selRect.rowMax; r++) {
          for (let s = selRect.stepMin; s <= selRect.stepMax; s++) {
            items.push({ row: r - selRect.rowMin, stepOffset: s - selRect.stepMin, on: paddedStepData[r]?.[s] ?? false });
          }
        }
        stepClipboard.current = items;
        return;
      }

      if (mod && e.key === 'v' && stepClipboard.current.length > 0) {
        e.preventDefault();
        const pasteCol = selRect ? selRect.stepMin : 0;
        stepClipboard.current.forEach(({ row, stepOffset, on }) => {
          const targetStep = pasteCol + stepOffset;
          const targetRow = row;
          if (targetStep < stepCount && targetRow < 16) {
            const current = paddedStepData[targetRow]?.[targetStep] ?? false;
            if (current !== on) toggleStep(trackId, patternId, targetRow, targetStep);
          }
        });
        return;
      }

      if (e.key === 'Escape') {
        setSelRect(null);
        setSelAnchor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selRect, stepData, stepCount, toggleStep, trackId, patternId]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const isCellSelected = (row: number, step: number): boolean => {
    if (!selRect) return false;
    return (
      row >= selRect.rowMin && row <= selRect.rowMax &&
      step >= selRect.stepMin && step <= selRect.stepMax
    );
  };

  const renderStepButton = (row: number, step: number) => {
    const isOn = paddedStepData[row]?.[step] ?? false;
    const isCurrent = currentStep === step;
    const groupIndex = Math.floor(step / 4);
    const isEvenGroup = groupIndex % 2 === 0;
    const drumColor = DRUM_COLORS[row];

    let buttonStyle: React.CSSProperties = {};
    let className = 'relative w-8 h-8 rounded-[5px] transition-all duration-75 border border-transparent ';

    if (isOn) {
      buttonStyle = {
        backgroundColor: drumColor,
        boxShadow: `0 0 8px ${drumColor}, 0 0 16px ${drumColor}44`,
        borderColor: `${drumColor}cc`,
      };
      className += 'scale-95 ';
    } else {
      className += isEvenGroup
        ? 'bg-[#1a1a24] hover:bg-[#252535] border-[#2a2a3e] '
        : 'bg-[#1e1e2e] hover:bg-[#282840] border-[#2e2e42] ';
    }

    if (isCurrent) {
      buttonStyle.outline = '2px solid rgba(255,255,255,0.9)';
      buttonStyle.outlineOffset = '-2px';
      buttonStyle.boxShadow = (buttonStyle.boxShadow ?? '') + ', 0 0 12px rgba(255,255,255,0.3)';
    }

    if (isCellSelected(row, step)) {
      buttonStyle.outline = '2px solid rgba(0,180,255,0.8)';
      buttonStyle.outlineOffset = '-2px';
    }

    return (
      <button
        key={step}
        style={buttonStyle}
        className={className}
        onMouseDown={(e) => {
          e.preventDefault();
          isDragSelecting.current = false;
          setSelAnchor({ row, step });
          setSelRect({ rowMin: row, rowMax: row, stepMin: step, stepMax: step });

          const onMove = () => {
            isDragSelecting.current = true;
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            if (!isDragSelecting.current) {
              // It was a click — toggle and clear selection
              handleToggleStep(row, step);
              setSelRect(null);
              setSelAnchor(null);
            }
            isDragSelecting.current = false;
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
        onMouseEnter={() => {
          if (selAnchor && isDragSelecting.current) {
            setSelRect({
              rowMin: Math.min(selAnchor.row, row),
              rowMax: Math.max(selAnchor.row, row),
              stepMin: Math.min(selAnchor.step, step),
              stepMax: Math.max(selAnchor.step, step),
            });
          }
        }}
        aria-label={`Row ${row} step ${step + 1} ${isOn ? 'on' : 'off'}`}
      >
        {isOn && (
          <span
            className="absolute inset-0 rounded-[5px] opacity-40"
            style={{ background: `radial-gradient(circle at 40% 30%, white, transparent 70%)` }}
          />
        )}
      </button>
    );
  };

  const visibleSteps = stepCount;

  return (
    <div className="flex flex-col gap-3 bg-[#0d0d18] p-4 rounded-xl border border-[#2a2a3e] select-none">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: track.color, boxShadow: `0 0 6px ${track.color}` }}
          />
          <span className="text-white font-semibold text-sm tracking-wide truncate max-w-[140px]">
            {track.name}
          </span>
          <span className="text-gray-500 text-xs">›</span>
          <span className="text-[#9945ff] text-sm font-medium truncate max-w-[100px]">
            {pattern.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Step count */}
          <div className="flex rounded-lg overflow-hidden border border-[#3a3a50]">
            {([16, 32] as const).map(n => (
              <button
                key={n}
                onClick={() => handleStepCountChange(n)}
                className={`px-3 py-1 text-xs font-mono font-bold transition-colors ${
                  stepCount === n
                    ? 'bg-[#9945ff] text-white'
                    : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#252540] hover:text-gray-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Tempo display */}
          <div className="flex items-center gap-1.5 bg-[#1a1a2e] px-3 py-1.5 rounded-lg border border-[#3a3a50]">
            <span className="text-gray-500 text-xs">BPM</span>
            <span className="text-[#00d4ff] font-mono font-bold text-sm">{project.bpm}</span>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex gap-3">
        {/* Left: drum names + volume sliders */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {DRUM_NAMES.map((name, row) => (
            <div
              key={row}
              className="flex items-center gap-2 h-8 rounded px-1 transition-colors"
              style={{
                background: dragOverRow === row ? `${DRUM_COLORS[row]}22` : 'transparent',
                border: dragOverRow === row ? `1px dashed ${DRUM_COLORS[row]}88` : '1px solid transparent',
              }}
              onDragOver={e => { handleRowDragOver(e, row); setDragOverRow(row); }}
              onDragLeave={() => setDragOverRow(null)}
              onDrop={e => handleRowDrop(e, row)}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: DRUM_COLORS[row], boxShadow: `0 0 4px ${DRUM_COLORS[row]}88` }}
              />
              <div className="flex flex-col leading-none w-[60px]">
                <span className="text-gray-300 text-[11px] font-medium truncate">
                  {name}
                </span>
                {rowSamples[row] && (
                  <span
                    className="text-[8px] truncate"
                    style={{ color: DRUM_COLORS[row], opacity: 0.8 }}
                    title={rowSamples[row]!}
                  >
                    {rowSamples[row]}
                  </span>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.8}
                className="w-14 h-1 accent-[#9945ff] cursor-pointer"
                title="Volume"
              />
            </div>
          ))}
        </div>

        {/* Center: step grid */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex flex-col gap-1.5 min-w-max">
            {DRUM_NAMES.map((_name, row) => (
              <div
                key={row}
                className="flex gap-0.5 items-center h-8 rounded transition-colors"
                style={{
                  background: dragOverRow === row ? `${DRUM_COLORS[row]}15` : 'transparent',
                }}
                onDragOver={e => { handleRowDragOver(e, row); setDragOverRow(row); }}
                onDragLeave={() => setDragOverRow(null)}
                onDrop={e => handleRowDrop(e, row)}
              >
                {Array.from({ length: visibleSteps }, (_, step) => (
                  <React.Fragment key={step}>
                    {step > 0 && step % 4 === 0 && (
                      <div className="w-px h-6 bg-[#3a3a50] flex-shrink-0 mx-0.5" />
                    )}
                    {renderStepButton(row, step)}
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right: velocity knobs */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {DRUM_NAMES.map((_name, row) => (
            <div key={row} className="flex items-center h-8">
              <VelocityKnob
                value={velocities[row]}
                color={DRUM_COLORS[row]}
                onChange={val => updateVelocity(row, val)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Step number ruler ── */}
      <div className="flex gap-0.5 ml-[108px] pl-0 overflow-x-auto">
        {Array.from({ length: visibleSteps }, (_, step) => (
          <React.Fragment key={step}>
            {step > 0 && step % 4 === 0 && <div className="w-px mx-0.5" />}
            <div
              className={`w-8 text-center text-[9px] font-mono flex-shrink-0 ${
                step % 4 === 0 ? 'text-[#9945ff]' : 'text-gray-600'
              }`}
            >
              {step % 4 === 0 ? step / 4 + 1 : '·'}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* ── Bottom toolbar ── */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2a2a3e] flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={handleCopyPattern}
            className="px-3 py-1.5 text-xs text-gray-300 bg-[#1a1a2e] hover:bg-[#252540] border border-[#3a3a50] rounded-lg transition-colors"
          >
            Copy Pattern
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 text-xs text-gray-300 bg-[#1a1a2e] hover:bg-[#2e1a1a] border border-[#3a3a50] hover:border-[#ff4455] rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleRandomize}
            className="px-3 py-1.5 text-xs bg-[#1a1a2e] hover:bg-[#1a1a3a] border border-[#3a3a50] hover:border-[#9945ff] text-gray-300 hover:text-[#9945ff] rounded-lg transition-colors"
          >
            Randomize
          </button>
        </div>

        {/* Preset dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">Preset:</span>
          <select
            value={selectedPreset}
            onChange={e => handlePreset(e.target.value)}
            className="bg-[#1a1a2e] text-gray-200 text-xs border border-[#3a3a50] rounded-lg px-2 py-1.5 cursor-pointer focus:outline-none focus:border-[#9945ff] hover:border-[#9945ff] transition-colors"
          >
            <option value="">— Choose —</option>
            {DRUM_PRESET_NAMES.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default StepSequencer;
