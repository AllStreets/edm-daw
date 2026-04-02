import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUIStore } from '../../store/useUIStore';

// ─── Tiny reusable button ────────────────────────────────────────────────────

interface IconBtnProps {
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
  pulse?: boolean;
}

const IconBtn: React.FC<IconBtnProps> = ({
  onClick,
  active = false,
  activeColor = '#9945ff',
  title,
  danger = false,
  children,
  pulse = false,
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
    border: `1px solid ${active ? activeColor : '#2a2a3a'}`,
    background: active
      ? `${activeColor}22`
      : 'linear-gradient(180deg, #1a1a2e 0%, #12121e 100%)',
    color: active ? activeColor : '#888',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 700,
    transition: 'all 0.15s ease',
    boxShadow: active ? `0 0 8px ${activeColor}55` : 'none',
    outline: 'none',
    flexShrink: 0,
    animation: pulse ? 'pulse-record 1s ease-in-out infinite' : 'none',
  };

  const dangerActive: React.CSSProperties = danger && active
    ? { border: '1px solid #ff3355', background: '#ff335522', color: '#ff3355', boxShadow: '0 0 8px #ff335555' }
    : {};

  return (
    <button
      style={{ ...baseStyle, ...dangerActive }}
      onClick={onClick}
      title={title}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = active ? activeColor : '#555';
        (e.currentTarget as HTMLButtonElement).style.color = active ? activeColor : '#ccc';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = active ? activeColor : '#2a2a3a';
        (e.currentTarget as HTMLButtonElement).style.color = active ? activeColor : '#888';
      }}
    >
      {children}
    </button>
  );
};

// ─── BPM Control ─────────────────────────────────────────────────────────────

interface BPMControlProps {
  bpm: number;
  onSetBPM: (bpm: number) => void;
}

const BPMControl: React.FC<BPMControlProps> = ({ bpm, onSetBPM }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(bpm));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setRaw(String(bpm));
  }, [bpm, editing]);

  const commit = () => {
    const val = Math.max(60, Math.min(200, parseInt(raw, 10) || bpm));
    onSetBPM(val);
    setEditing(false);
  };

  const nudge = (delta: number) => {
    onSetBPM(Math.max(60, Math.min(200, bpm + delta)));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => nudge(-1)}
        style={{
          width: 18, height: 28, borderRadius: '4px 0 0 4px',
          border: '1px solid #2a2a3a', borderRight: 'none',
          background: '#12121e', color: '#666', cursor: 'pointer',
          fontSize: 11, fontWeight: 900, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="BPM -1"
      >−</button>

      {editing ? (
        <input
          ref={inputRef}
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={{
            width: 52, height: 28, textAlign: 'center',
            background: '#0a0a1a', border: '1px solid #9945ff',
            color: '#e0d0ff', fontSize: 18, fontWeight: 800,
            fontFamily: 'monospace', outline: 'none',
            boxShadow: '0 0 8px #9945ff44',
          }}
          autoFocus
        />
      ) : (
        <div
          onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}
          style={{
            width: 52, height: 28, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#0d0d1f', border: '1px solid #2a2a3a',
            color: '#d4b8ff', fontSize: 18, fontWeight: 800,
            fontFamily: 'monospace', cursor: 'text', userSelect: 'none',
          }}
          title="Click to edit BPM"
        >
          {bpm}
        </div>
      )}

      <button
        onClick={() => nudge(+1)}
        style={{
          width: 18, height: 28, borderRadius: '0 4px 4px 0',
          border: '1px solid #2a2a3a', borderLeft: 'none',
          background: '#12121e', color: '#666', cursor: 'pointer',
          fontSize: 11, fontWeight: 900, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="BPM +1"
      >+</button>
    </div>
  );
};

// ─── CPU Meter ────────────────────────────────────────────────────────────────

const CPUMeter: React.FC = () => {
  const [level] = useState(23);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>CPU</div>
      <div style={{
        width: 40, height: 8, borderRadius: 4,
        background: '#0d0d1f', border: '1px solid #2a2a3a', overflow: 'hidden',
      }}>
        <div style={{
          width: `${level}%`, height: '100%',
          background: level > 80
            ? 'linear-gradient(90deg, #ff6600, #ff0000)'
            : level > 60
              ? 'linear-gradient(90deg, #00d4ff, #ff9900)'
              : 'linear-gradient(90deg, #00d4ff, #9945ff)',
          borderRadius: 4,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>{level}%</div>
    </div>
  );
};

// ─── Master Volume ────────────────────────────────────────────────────────────

interface MasterVolumeProps {
  value: number;
  onChange: (v: number) => void;
}

const MasterVolume: React.FC<MasterVolumeProps> = ({ value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>VOL</span>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          WebkitAppearance: 'none',
          appearance: 'none',
          width: 72,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, #9945ff ${value * 100}%, #1e1e32 ${value * 100}%)`,
          outline: 'none',
          cursor: 'pointer',
        }}
        title={`Master volume: ${Math.round(value * 100)}%`}
      />
    </div>
    <span style={{ fontSize: 10, color: '#777', fontFamily: 'monospace', width: 26, textAlign: 'right' }}>
      {Math.round(value * 100)}
    </span>
  </div>
);

// ─── Position Display ────────────────────────────────────────────────────────

const PositionDisplay: React.FC<{ currentStep: number; bpm: number }> = ({ currentStep, bpm: _bpm }) => {
  // Convert step to bar.beat.tick (16 steps per bar, 4 beats per bar)
  const bar = Math.floor(currentStep / 16) + 1;
  const beat = Math.floor((currentStep % 16) / 4) + 1;
  const tick = (currentStep % 4) * 6;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 80, height: 28,
      background: '#050510',
      border: '1px solid #1a1a2e',
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 14,
      fontWeight: 700,
      color: '#00d4ff',
      letterSpacing: 1,
      textShadow: '0 0 8px #00d4ff88',
      padding: '0 8px',
      userSelect: 'none',
    }}>
      {String(bar).padStart(2, '0')}.{beat}.{String(tick).padStart(2, '0')}
    </div>
  );
};

// ─── View Switcher ────────────────────────────────────────────────────────────

type ViewTab = 'session' | 'arrangement' | 'mixer';

interface ViewSwitcherProps {
  active: ViewTab;
  onChange: (v: ViewTab) => void;
}

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ active, onChange }) => {
  const tabs: { key: ViewTab; label: string }[] = [
    { key: 'session', label: 'SESSION' },
    { key: 'arrangement', label: 'ARRANGE' },
    { key: 'mixer', label: 'MIXER' },
  ];

  return (
    <div style={{
      display: 'flex',
      background: '#0d0d1f',
      border: '1px solid #2a2a3a',
      borderRadius: 8,
      overflow: 'hidden',
      gap: 0,
    }}>
      {tabs.map(({ key, label }, i) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              border: 'none',
              borderLeft: i > 0 ? '1px solid #1e1e32' : 'none',
              background: isActive
                ? 'linear-gradient(180deg, #9945ff33 0%, #9945ff11 100%)'
                : 'transparent',
              color: isActive ? '#c080ff' : '#555',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textShadow: isActive ? '0 0 8px #9945ff' : 'none',
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#999';
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#555';
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

// ─── Main TransportBar ────────────────────────────────────────────────────────

export const TransportBar: React.FC = () => {
  const { project, isPlaying, isRecording, currentStep, play, stop, pause, startRecording, stopRecording, setBPM, setActiveView, activeView } =
    useProjectStore();
  const { setActivePanel, activePanel, setBottomPanelTab } = useUIStore();

  const [loopActive, setLoopActive] = useState(false);
  const [masterVolume, setMasterVolume] = useState(project.masterVolume);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      void play();
    }
  }, [isPlaying, play, pause]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleRewind = useCallback(() => {
    stop();
  }, [stop]);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleViewChange = useCallback((view: ViewTab) => {
    setActiveView(view);
    setActivePanel(view as 'session' | 'arrangement' | 'mixer');
  }, [setActiveView, setActivePanel]);

  // Suppress unused warning — activePanel is read for future use
  void activePanel;

  return (
    <>
      {/* Inject keyframe animations */}
      <style>{`
        @keyframes pulse-record {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #ff335599; }
          50% { opacity: 0.6; box-shadow: 0 0 18px #ff335599; }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #9945ff;
          cursor: pointer;
          box-shadow: 0 0 6px #9945ff99;
        }
        input[type=range]::-moz-range-thumb {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #9945ff;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 6px #9945ff99;
        }
      `}</style>

      <header style={{
        width: '100%',
        height: 48,
        minHeight: 48,
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(180deg, #111124 0%, #0a0a1e 100%)',
        borderBottom: '1px solid #1e1e3a',
        boxShadow: '0 2px 16px #00000088',
        padding: '0 12px',
        gap: 12,
        userSelect: 'none',
        zIndex: 100,
        position: 'relative',
        flexShrink: 0,
      }}>

        {/* ── Logo ── */}
        <button
          onClick={() => {
            setActivePanel('session');
            setBottomPanelTab('sequencer');
          }}
          title="Home — Session View"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            minWidth: 80, flexShrink: 0,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          }}
          onMouseEnter={e => { (e.currentTarget.querySelector('.logo-text') as HTMLElement).style.textShadow = '0 0 18px #9945ffff, 0 0 36px #9945ffaa'; }}
          onMouseLeave={e => { (e.currentTarget.querySelector('.logo-text') as HTMLElement).style.textShadow = '0 0 12px #9945ffcc, 0 0 24px #9945ff66'; }}
        >
          <div className="logo-text" style={{
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: 2,
            color: '#9945ff',
            textShadow: '0 0 12px #9945ffcc, 0 0 24px #9945ff66',
            lineHeight: 1,
            transition: 'text-shadow 0.15s',
          }}>
            EDM<span style={{ color: '#00d4ff', textShadow: '0 0 12px #00d4ffcc' }}>•</span>DAW
          </div>
          <div style={{ fontSize: 9, color: '#443366', letterSpacing: 2, fontWeight: 600, marginTop: 2 }}>v1.0</div>
        </button>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 30, background: '#1e1e3a', flexShrink: 0 }} />

        {/* ── Transport Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Rewind */}
          <IconBtn onClick={handleRewind} title="Rewind to start">
            <span style={{ fontSize: 12 }}>⏮</span>
          </IconBtn>

          {/* Play / Pause */}
          <IconBtn
            onClick={handlePlayPause}
            active={isPlaying}
            activeColor="#00cc44"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying
              ? <span style={{ fontSize: 11, letterSpacing: 1 }}>⏸</span>
              : <span style={{ fontSize: 13 }}>▶</span>
            }
          </IconBtn>

          {/* Stop */}
          <IconBtn onClick={handleStop} title="Stop">
            <span style={{ fontSize: 11 }}>■</span>
          </IconBtn>

          {/* Record */}
          <IconBtn
            onClick={handleRecord}
            active={isRecording}
            danger
            pulse={isRecording}
            title={isRecording ? 'Stop Recording' : 'Record'}
          >
            <span style={{ fontSize: 13 }}>●</span>
          </IconBtn>

          {/* Loop */}
          <IconBtn
            onClick={() => setLoopActive(v => !v)}
            active={loopActive}
            activeColor="#00d4ff"
            title="Toggle Loop"
          >
            <span style={{ fontSize: 13 }}>↺</span>
          </IconBtn>
        </div>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 30, background: '#1e1e3a', flexShrink: 0 }} />

        {/* ── Position ── */}
        <PositionDisplay currentStep={currentStep} bpm={project.bpm} />

        {/* ── BPM ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, textTransform: 'uppercase' }}>BPM</div>
          <BPMControl bpm={project.bpm} onSetBPM={setBPM} />
        </div>

        {/* ── Time Signature ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '2px 8px',
          background: '#0d0d1f', border: '1px solid #1e1e32',
          borderRadius: 4,
        }}>
          <div style={{ fontSize: 9, color: '#444', letterSpacing: 1, textTransform: 'uppercase' }}>TIME</div>
          <div style={{
            fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
            color: '#7755aa', letterSpacing: 1,
          }}>
            {project.timeSignature[0]}/{project.timeSignature[1]}
          </div>
        </div>

        {/* ── Flex spacer ── */}
        <div style={{ flex: 1 }} />

        {/* ── View Switcher ── */}
        <ViewSwitcher active={activeView as ViewTab} onChange={handleViewChange} />

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 30, background: '#1e1e3a', flexShrink: 0 }} />

        {/* ── Master Volume ── */}
        <MasterVolume value={masterVolume} onChange={setMasterVolume} />

        {/* ── CPU Meter ── */}
        <CPUMeter />

      </header>
    </>
  );
};

export default TransportBar;
