import React, { useEffect, useRef, useCallback } from 'react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectStore } from './store/useProjectStore';
import { useUIStore } from './store/useUIStore';

// Component imports
import TransportBar from './components/Transport/TransportBar';
import SessionView from './components/SessionView/SessionView';
import { Mixer } from './components/Mixer/Mixer';
import { SynthEditor } from './components/Synth/SynthEditor';
import { EffectsRack } from './components/Effects/EffectsRack';
import { PianoRoll } from './components/PianoRoll/PianoRoll';
import StepSequencer from './components/Sequencer/StepSequencer';
import { AIPanel } from './components/AITools/AIPanel';
import { SampleBrowser } from './components/SampleBrowser/SampleBrowser';
import { SpectrumAnalyzer } from './components/Meters/SpectrumAnalyzer';
import { Oscilloscope } from './components/Meters/Oscilloscope';

// ─── Notification toast ────────────────────────────────────────────────────────

function NotificationToasts() {
  const { notifications, removeNotification } = useUIStore();
  if (notifications.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {notifications.map(n => (
        <div key={n.id} style={{
          background: n.type === 'error' ? '#300' : n.type === 'success' ? '#030' : '#1a1a2a',
          border: `1px solid ${n.type === 'error' ? '#f44' : n.type === 'success' ? '#0f8' : '#9945ff'}`,
          borderRadius: 6, padding: '8px 14px',
          color: '#e8e8f0', fontSize: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'all',
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 300,
          animation: 'slideIn 0.2s ease',
        }}>
          <span style={{ flex: 1 }}>{n.message}</span>
          <button onClick={() => removeNotification(n.id)}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, fontSize: 14 }}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Bottom panel resize handle ───────────────────────────────────────────────

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastY.current = e.clientY;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = lastY.current - e.clientY;
      lastY.current = e.clientY;
      onResize(delta);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onResize]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        height: 4,
        background: '#1e1e28',
        cursor: 'ns-resize',
        flexShrink: 0,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#9945ff')}
      onMouseLeave={e => (e.currentTarget.style.background = '#1e1e28')}
    />
  );
}

// ─── Left panel resize handle ─────────────────────────────────────────────────

function VerticalResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onResize(delta);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onResize]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        background: '#1e1e28',
        cursor: 'ew-resize',
        flexShrink: 0,
        zIndex: 10,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#9945ff')}
      onMouseLeave={e => (e.currentTarget.style.background = '#1e1e28')}
    />
  );
}

// ─── Bottom panel tab bar ─────────────────────────────────────────────────────

type BottomTab = 'sequencer' | 'piano-roll' | 'ai' | 'visualizer';

function BottomTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: BottomTab;
  onTabChange: (t: BottomTab) => void;
}) {
  const { project, selectedTrackId } = useProjectStore();
  const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);

  // SVG icons — no emojis
  const TabIcon = ({ id }: { id: BottomTab }) => {
    if (id === 'sequencer') return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <rect x="0" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="3.2" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="6.4" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="9.5" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="0" y="3.2" width="2.5" height="2.5" rx="0.4" opacity="0.5"/>
        <rect x="3.2" y="3.2" width="2.5" height="2.5" rx="0.4"/>
        <rect x="6.4" y="3.2" width="2.5" height="2.5" rx="0.4" opacity="0.5"/>
        <rect x="9.5" y="3.2" width="2.5" height="2.5" rx="0.4"/>
        <rect x="0" y="6.4" width="2.5" height="2.5" rx="0.4"/>
        <rect x="3.2" y="6.4" width="2.5" height="2.5" rx="0.4" opacity="0.5"/>
        <rect x="6.4" y="6.4" width="2.5" height="2.5" rx="0.4"/>
        <rect x="9.5" y="6.4" width="2.5" height="2.5" rx="0.4" opacity="0.5"/>
        <rect x="0" y="9.5" width="2.5" height="2.5" rx="0.4" opacity="0.5"/>
        <rect x="3.2" y="9.5" width="2.5" height="2.5" rx="0.4"/>
        <rect x="6.4" y="9.5" width="2.5" height="2.5" rx="0.4" opacity="0.5"/>
        <rect x="9.5" y="9.5" width="2.5" height="2.5" rx="0.4"/>
      </svg>
    );
    if (id === 'piano-roll') return (
      <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor">
        {/* White keys */}
        {[0,1.9,3.8,5.7,7.6,9.5,11.4].map((x, i) => (
          <rect key={i} x={x} y="0" width="1.7" height="11" rx="0.3" opacity="0.9"/>
        ))}
        {/* Black keys */}
        {[1.1,3,6.8,8.7,10.6].map((x, i) => (
          <rect key={i} x={x} y="0" width="1.2" height="6.5" rx="0.2" fill="currentColor" opacity="0.25"/>
        ))}
      </svg>
    );
    if (id === 'ai') return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <circle cx="6" cy="6" r="2.2"/>
        <line x1="6" y1="0.5" x2="6" y2="2.8"/>
        <line x1="6" y1="9.2" x2="6" y2="11.5"/>
        <line x1="0.5" y1="6" x2="2.8" y2="6"/>
        <line x1="9.2" y1="6" x2="11.5" y2="6"/>
        <line x1="1.9" y1="1.9" x2="3.5" y2="3.5"/>
        <line x1="8.5" y1="8.5" x2="10.1" y2="10.1"/>
        <line x1="10.1" y1="1.9" x2="8.5" y2="3.5"/>
        <line x1="3.5" y1="8.5" x2="1.9" y2="10.1"/>
      </svg>
    );
    if (id === 'visualizer') return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <rect x="0" y="7" width="2" height="5" rx="0.5"/>
        <rect x="2.5" y="4" width="2" height="8" rx="0.5"/>
        <rect x="5" y="1" width="2" height="11" rx="0.5"/>
        <rect x="7.5" y="3" width="2" height="9" rx="0.5"/>
        <rect x="10" y="5" width="2" height="7" rx="0.5"/>
      </svg>
    );
    return null;
  };

  const tabs: { id: BottomTab; label: string }[] = [
    { id: 'sequencer', label: 'STEP SEQ' },
    { id: 'piano-roll', label: 'PIANO ROLL' },
    { id: 'ai', label: 'AI TOOLS' },
    { id: 'visualizer', label: 'VISUALIZER' },
  ];

  return (
    <div style={{
      height: 32,
      background: '#0d0d15',
      borderBottom: '1px solid #1e1e28',
      display: 'flex',
      alignItems: 'stretch',
      flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              background: isActive ? '#1a1a24' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #9945ff' : '2px solid transparent',
              borderRight: '1px solid #1e1e28',
              color: isActive ? '#9945ff' : '#555',
              fontSize: 10,
              fontWeight: isActive ? 700 : 400,
              letterSpacing: 0.8,
              padding: '0 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.1s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#888'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#555'; }}
          >
            <TabIcon id={tab.id} />
            {tab.label}
          </button>
        );
      })}

      {/* Track context */}
      {selectedTrack && (
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingRight: 12,
          color: '#666',
          fontSize: 10,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: selectedTrack.color,
          }} />
          <span style={{ color: '#888' }}>{selectedTrack.name}</span>
          <span>—</span>
          <span>{selectedTrack.patterns[0]?.name ?? 'No Pattern'}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main view area ───────────────────────────────────────────────────────────

function MainViewArea() {
  const { activePanel, setActivePanel } = useUIStore();

  const views = ['session', 'arrangement', 'mixer'] as const;

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* View tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #1e1e28',
        background: '#0d0d15',
        flexShrink: 0,
        height: 28,
      }}>
        {views.map(view => {
          const isActive = activePanel === view;
          const labels: Record<string, string> = {
            session: 'SESSION VIEW',
            arrangement: 'ARRANGEMENT',
            mixer: 'MIXER',
          };
          return (
            <button
              key={view}
              onClick={() => setActivePanel(view as any)}
              style={{
                background: isActive ? '#12121a' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #00d4ff' : '2px solid transparent',
                borderRight: '1px solid #1e1e28',
                color: isActive ? '#00d4ff' : '#555',
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                letterSpacing: 1,
                padding: '0 16px',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            >
              {labels[view]}
            </button>
          );
        })}
      </div>

      {/* View content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activePanel === 'session' && <SessionView />}
        {activePanel === 'arrangement' && <ArrangementPlaceholder />}
        {activePanel === 'mixer' && <Mixer />}
      </div>
    </div>
  );
}

// ─── Arrangement placeholder ──────────────────────────────────────────────────

function ArrangementPlaceholder() {
  const { project } = useProjectStore();
  const BEAT_W = 40;
  const TRACK_H = 48;
  const BARS = 32;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#0a0a0f' }}>
      <div style={{ display: 'flex', minWidth: BARS * BEAT_W + 200 }}>
        {/* Track names column */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #1e1e28' }}>
          <div style={{ height: 24, background: '#0d0d15', borderBottom: '1px solid #1e1e28' }} />
          {project.tracks.map(track => (
            <div key={track.id} style={{
              height: TRACK_H,
              borderBottom: '1px solid #1e1e28',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              background: '#0f0f18',
            }}>
              <div style={{ width: 3, height: 24, background: track.color, borderRadius: 2 }} />
              <span style={{ color: '#ccc', fontSize: 11 }}>{track.name}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Bar ruler */}
          <div style={{
            height: 24,
            background: '#0d0d15',
            borderBottom: '1px solid #1e1e28',
            display: 'flex',
            position: 'relative',
          }}>
            {Array.from({ length: BARS }, (_, i) => (
              <div key={i} style={{
                width: BEAT_W,
                flexShrink: 0,
                borderRight: '1px solid #1e1e28',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 4,
              }}>
                <span style={{ color: i % 4 === 0 ? '#888' : '#333', fontSize: 9 }}>{i + 1}</span>
              </div>
            ))}
          </div>

          {/* Track rows */}
          {project.tracks.map((track, ti) => (
            <div key={track.id} style={{
              height: TRACK_H,
              borderBottom: '1px solid #1e1e28',
              position: 'relative',
              background: ti % 2 === 0 ? '#0a0a0f' : '#0c0c14',
              display: 'flex',
            }}>
              {/* Beat grid lines */}
              {Array.from({ length: BARS }, (_, i) => (
                <div key={i} style={{
                  width: BEAT_W,
                  flexShrink: 0,
                  borderRight: `1px solid ${i % 4 === 0 ? '#1e1e28' : '#14141c'}`,
                }} />
              ))}
              {/* Clip blocks (first pattern placed at start) */}
              {track.patterns.slice(0, 1).map((pat, pi) => (
                <div key={pat.id} style={{
                  position: 'absolute',
                  left: pi * BEAT_W * 8,
                  top: 4,
                  width: BEAT_W * 8 - 2,
                  height: TRACK_H - 8,
                  background: `${track.color}33`,
                  border: `1px solid ${track.color}66`,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 6,
                  cursor: 'pointer',
                }}>
                  <span style={{ color: track.color, fontSize: 10, fontWeight: 600 }}>{pat.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Bottom panel ─────────────────────────────────────────────────────────────

function BottomPanel({ height }: { height: number }) {
  const { project, selectedTrackId, activeSceneId } = useProjectStore();
  const {
    bottomPanelTab: activeTab,
    setBottomPanelTab: setActiveTab,
    pianoRollTrackId,
    pianoRollPatternId,
  } = useUIStore();

  const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);

  // Helper: find the pattern assigned to a track in the active scene (if any)
  const activeScenePatternFor = (track: typeof selectedTrack) => {
    if (!track || !activeSceneId) return undefined;
    const scene = project.scenes.find(s => s.id === activeSceneId);
    const pid = scene?.clips[track.id];
    return pid ? track.patterns.find(p => p.id === pid) : undefined;
  };

  // Piano roll: prefer explicitly-opened clip, then active-scene clip, then patterns[0]
  const pianoRollTrack = pianoRollTrackId
    ? project.tracks.find(t => t.id === pianoRollTrackId)
    : selectedTrack;
  const pianoRollPattern = pianoRollTrack && pianoRollPatternId
    ? pianoRollTrack.patterns.find(p => p.id === pianoRollPatternId)
    : (activeScenePatternFor(pianoRollTrack) ?? pianoRollTrack?.patterns[0]);

  // Step sequencer: prefer active-scene clip, then patterns[0]
  const seqTrack = selectedTrack;
  const seqPattern = activeScenePatternFor(seqTrack) ?? seqTrack?.patterns[0];

  // Auto-switch to piano-roll tab when a clip is opened from session view
  const prevPianoRollTrackId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (pianoRollTrackId && pianoRollTrackId !== prevPianoRollTrackId.current) {
      setActiveTab('piano-roll' as const);
    }
    prevPianoRollTrackId.current = pianoRollTrackId ?? null;
  }, [pianoRollTrackId, setActiveTab]);

  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', background: '#0f0f18', flexShrink: 0 }}>
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'sequencer' && seqTrack && seqPattern ? (
          <StepSequencer trackId={seqTrack.id} patternId={seqPattern.id} />
        ) : activeTab === 'sequencer' ? (
          <EmptyPanelHint icon="seq" text="Select a track to use the step sequencer" />
        ) : null}

        {activeTab === 'piano-roll' && pianoRollTrack && pianoRollPattern ? (
          <div style={{ height: '100%', overflow: 'hidden' }}>
            <PianoRoll
              trackId={pianoRollTrack.id}
              patternId={pianoRollPattern.id}
              onClose={() => setActiveTab('sequencer' as const)}
              embedded={true}
            />
          </div>
        ) : activeTab === 'piano-roll' ? (
          <EmptyPanelHint icon="piano" text="Select a track to open the piano roll" />
        ) : null}

        {activeTab === 'ai' && <AIPanel />}

        {activeTab === 'visualizer' && (
          <div style={{
            display: 'flex',
            height: '100%',
            gap: 1,
            background: '#0a0a0f',
            padding: 8,
          }}>
            <div style={{ flex: 2, background: '#0d0d15', borderRadius: 4, overflow: 'hidden', border: '1px solid #1e1e28' }}>
              <div style={{ padding: '4px 8px', borderBottom: '1px solid #1e1e28', color: '#555', fontSize: 9, letterSpacing: 1 }}>
                SPECTRUM ANALYZER
              </div>
              <SpectrumAnalyzer height={height - 60} />
            </div>
            <div style={{ flex: 1, background: '#0d0d15', borderRadius: 4, overflow: 'hidden', border: '1px solid #1e1e28' }}>
              <div style={{ padding: '4px 8px', borderBottom: '1px solid #1e1e28', color: '#555', fontSize: 9, letterSpacing: 1 }}>
                OSCILLOSCOPE
              </div>
              <Oscilloscope height={height - 60} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyPanelHint({ icon, text }: { icon: string; text: string }) {
  const IconSvg = () => {
    if (icon === 'seq') return (
      <svg width="32" height="32" viewBox="0 0 12 12" fill="#333">
        <rect x="0" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="3.2" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="6.4" y="0" width="2.5" height="2.5" rx="0.4" opacity="0.4"/>
        <rect x="9.5" y="0" width="2.5" height="2.5" rx="0.4"/>
        <rect x="0" y="3.2" width="2.5" height="2.5" rx="0.4" opacity="0.4"/>
        <rect x="3.2" y="3.2" width="2.5" height="2.5" rx="0.4"/>
        <rect x="6.4" y="3.2" width="2.5" height="2.5" rx="0.4"/>
        <rect x="9.5" y="3.2" width="2.5" height="2.5" rx="0.4" opacity="0.4"/>
        <rect x="0" y="6.4" width="2.5" height="2.5" rx="0.4"/>
        <rect x="3.2" y="6.4" width="2.5" height="2.5" rx="0.4" opacity="0.4"/>
        <rect x="6.4" y="6.4" width="2.5" height="2.5" rx="0.4"/>
        <rect x="9.5" y="6.4" width="2.5" height="2.5" rx="0.4"/>
      </svg>
    );
    if (icon === 'piano') return (
      <svg width="36" height="28" viewBox="0 0 13 11" fill="#333">
        {[0,1.9,3.8,5.7,7.6,9.5,11.4].map((x, i) => (
          <rect key={i} x={x} y="0" width="1.7" height="11" rx="0.3"/>
        ))}
        {[1.1,3,6.8,8.7,10.6].map((x, i) => (
          <rect key={i} x={x} y="0" width="1.2" height="6.5" rx="0.2" fill="#111"/>
        ))}
      </svg>
    );
    return <span style={{ fontSize: 28 }}>{icon}</span>;
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333',
      gap: 10,
    }}>
      <IconSvg />
      <span style={{ fontSize: 11, color: '#444', fontFamily: 'monospace' }}>{text}</span>
    </div>
  );
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────

function LeftSidebar({ width }: { width: number }) {
  const { sampleBrowserOpen, setSampleBrowserOpen } = useUIStore();

  return (
    <div style={{
      width,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#0d0d15',
      borderRight: '1px solid #1e1e28',
      overflow: 'hidden',
    }}>
      {/* Sidebar icon tabs */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '6px 0',
        borderBottom: '1px solid #1e1e28',
        flexShrink: 0,
      }}>
        {/* Samples browser toggle — SVG icon, no emoji */}
        <button
          onClick={() => setSampleBrowserOpen(!sampleBrowserOpen)}
          title="Sample Browser"
          style={{
            background: sampleBrowserOpen ? '#9945ff22' : 'transparent',
            border: `1px solid ${sampleBrowserOpen ? '#9945ff55' : 'transparent'}`,
            borderRadius: 4,
            color: sampleBrowserOpen ? '#9945ff' : '#444',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
          }}
        >
          {/* Grid / waveform icon representing a sample library */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="0" y="0" width="6" height="4" rx="0.8" opacity="0.9"/>
            <rect x="7" y="0" width="9" height="4" rx="0.8" opacity="0.5"/>
            <rect x="0" y="5.5" width="9" height="4" rx="0.8" opacity="0.7"/>
            <rect x="10.5" y="5.5" width="5.5" height="4" rx="0.8" opacity="0.9"/>
            <rect x="0" y="11" width="4" height="4" rx="0.8" opacity="0.5"/>
            <rect x="5.5" y="11" width="10.5" height="4" rx="0.8" opacity="0.8"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {sampleBrowserOpen && (
          <SampleBrowser onClose={() => setSampleBrowserOpen(false)} />
        )}
        {!sampleBrowserOpen && (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#222',
            fontSize: 9,
            letterSpacing: 1,
            writingMode: 'vertical-rl',
          }}>
            BROWSER
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  useKeyboardShortcuts();

  const {
    synthEditorTrackId,
    effectsRackTrackId,
    closeSynthEditor,
    closeEffectsRack,
    bottomPanelHeight,
    leftPanelWidth,
    setBottomPanelHeight,
    setLeftPanelWidth,
    sampleBrowserOpen,
  } = useUIStore();

  const handleBottomResize = useCallback((delta: number) => {
    setBottomPanelHeight(bottomPanelHeight + delta);
  }, [bottomPanelHeight, setBottomPanelHeight]);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth(leftPanelWidth + delta);
  }, [leftPanelWidth, setLeftPanelWidth]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0f',
      overflow: 'hidden',
      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
    }}>
      {/* Transport bar — always on top */}
      <TransportBar />

      {/* Main area: sidebar + content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left sidebar */}
        <LeftSidebar width={sampleBrowserOpen ? leftPanelWidth : 40} />
        {sampleBrowserOpen && (
          <VerticalResizeHandle onResize={handleLeftResize} />
        )}

        {/* Center: main view + bottom panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <MainViewArea />
          <ResizeHandle onResize={handleBottomResize} />
          <BottomPanel height={bottomPanelHeight} />
        </div>
      </div>

      {/* Modals */}
      {synthEditorTrackId && (
        <SynthEditor trackId={synthEditorTrackId} onClose={closeSynthEditor} />
      )}
      {effectsRackTrackId && (
        <EffectsRack trackId={effectsRackTrackId} onClose={closeEffectsRack} />
      )}

      {/* Notifications */}
      <NotificationToasts />

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
