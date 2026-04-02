import { useState, useCallback } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { useProjectStore } from '../../store/useProjectStore';
import { generateFullSong } from '../../services/ClaudeSongGenerator';
import type { GeneratedSongV2 } from '../../services/ClaudeSongGenerator';
import { defaultPattern } from '../../types';
import { SYNTH_PRESETS } from '../../engine/SynthPresets';
import { useUIStore } from '../../store/useUIStore';
import { audioEngine } from '../../engine/AudioEngine';

// =====================================================
// Shared UI primitives
// =====================================================

function GradientButton({
  onClick,
  loading,
  children,
  disabled,
  small,
}: {
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="relative overflow-hidden font-bold font-mono tracking-wider transition-all"
      style={{
        width: '100%',
        padding: small ? '6px 16px' : '12px 24px',
        fontSize: small ? 10 : 13,
        borderRadius: 8,
        background: disabled || loading
          ? '#1a1a2a'
          : 'linear-gradient(135deg, #9945ff, #6633cc)',
        color: disabled || loading ? '#444' : '#fff',
        border: `1px solid ${disabled || loading ? '#222' : '#9945ff88'}`,
        boxShadow: disabled || loading ? 'none' : '0 0 20px rgba(153,69,255,0.5)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        justifyContent: 'center',
      }}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"
          />
          Generating...
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          {!small && (
            <svg width="11" height="14" viewBox="0 0 11 14" fill="currentColor">
              <polygon points="7,0 0,8 5,8 4,14 11,6 6,6"/>
            </svg>
          )}
          {children}
        </span>
      )}
    </button>
  );
}

function PillButton({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  const c = color ?? '#9945ff';
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all"
      style={{
        background: active ? `${c}33` : '#111',
        color: active ? c : '#555',
        border: `1px solid ${active ? c : '#222'}`,
        boxShadow: active ? `0 0 8px ${c}44` : 'none',
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold font-mono tracking-widest text-gray-600 uppercase mb-1">
      {children}
    </div>
  );
}

// ── Themed range slider ───────────────────────────────────────────────────────
// Renders purple fill on the left, dark track on the right, matching the app theme.
// Uses inline background gradient computed from the current value since CSS
// ::-webkit-slider-runnable-track can't read JS state.

const THUMB = 20;   // thumb diameter px
const TRACK = 4;    // track height px

function SliderInput({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ position: 'relative', width: '100%', height: THUMB }}>
      {/* Track background */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: THUMB / 2,
          right: THUMB / 2,
          height: TRACK,
          transform: 'translateY(-50%)',
          borderRadius: TRACK / 2,
          background: '#1a1a2e',
          overflow: 'hidden',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: '#9945ff',
            borderRadius: TRACK / 2,
          }}
        />
      </div>

      {/* Thumb — perfectly centered on track */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `calc(${pct / 100} * (100% - ${THUMB}px))`,
          transform: 'translateY(-50%)',
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          background: '#9945ff',
          border: '2px solid #0d0d18',
          boxShadow: '0 0 8px rgba(153,69,255,0.7)',
          pointerEvents: 'none',
        }}
      />

      {/* Invisible native input for drag interaction */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          margin: 0,
          padding: 0,
        }}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded px-2 py-1 text-[11px] font-mono outline-none transition-colors"
      style={{
        background: '#0e0e1c',
        color: '#aaa',
        border: '1px solid #2a2a3a',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// =====================================================
// Chord progression display
// =====================================================
const CHORD_COLORS: Record<string, string> = {
  'C': '#9945ff', 'C#': '#7755ff', 'D': '#5566ff', 'D#': '#3388ff',
  'E': '#00aaff', 'F': '#00ccff', 'F#': '#00ffcc', 'G': '#00ff88',
  'G#': '#44ff66', 'A': '#88ff44', 'A#': '#ffcc00', 'B': '#ff8844',
};

function ChordPill({ chord }: { chord: string }) {
  const root = chord.replace(/m$/, '').replace(/\d$/, '');
  const color = CHORD_COLORS[root] ?? '#9945ff';
  const isMinor = chord.endsWith('m');
  return (
    <span
      className="px-3 py-1 rounded-full text-[11px] font-bold font-mono"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}66`,
        boxShadow: `0 0 8px ${color}33`,
        fontStyle: isMinor ? 'italic' : 'normal',
      }}
    >
      {chord}
    </span>
  );
}

// =====================================================
// Drum pattern mini grid
// =====================================================
const DRUM_ROWS = ['Kick', 'Snare', 'Clap', 'HH', 'PHH', 'Tom', 'Perc', '808'];
const DRUM_ROW_COLORS = ['#ff4444', '#ffaa00', '#ffcc00', '#00d4ff', '#00aaff', '#9945ff', '#ff88aa', '#ff6600'];

function DrumPatternPreview({ pattern }: { pattern: boolean[][] }) {
  return (
    <div className="rounded overflow-hidden" style={{ background: '#080810', border: '1px solid #1a1a2a' }}>
      {pattern.slice(0, 8).map((row, ri) => (
        <div key={ri} className="flex items-center" style={{ height: 16 }}>
          <div
            className="text-[7px] font-mono text-right shrink-0"
            style={{ width: 28, color: DRUM_ROW_COLORS[ri], paddingRight: 4 }}
          >
            {DRUM_ROWS[ri]}
          </div>
          <div className="flex gap-px flex-1 px-1">
            {row.map((active, si) => (
              <div
                key={si}
                className="flex-1 rounded-sm"
                style={{
                  height: 10,
                  background: active ? DRUM_ROW_COLORS[ri] : '#1a1a2a',
                  opacity: active ? 1 : 0.5,
                  boxShadow: active ? `0 0 4px ${DRUM_ROW_COLORS[ri]}88` : 'none',
                  borderLeft: si % 4 === 0 ? '1px solid #2a2a3a' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// Piano Roll mini preview (for bassline/melody)
// =====================================================
function MiniPianoRoll({ noteCount = 8 }: { noteCount?: number }) {
  // Show placeholder notes
  const notes = Array.from({ length: noteCount }, (_, i) => ({
    x: (i / noteCount) * 100,
    y: 20 + Math.sin(i * 1.3) * 25 + Math.random() * 10,
    w: 8 + Math.random() * 6,
  }));

  return (
    <div
      className="relative rounded overflow-hidden"
      style={{ height: 60, background: '#060610', border: '1px solid #1a1a2a' }}
    >
      {/* Piano keys on left */}
      <div className="absolute left-0 top-0 bottom-0 w-4" style={{ background: '#0a0a18', borderRight: '1px solid #1a1a2a' }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="absolute w-full"
            style={{
              height: '12.5%',
              top: `${i * 12.5}%`,
              background: [1, 3, 5].includes(i % 7) ? '#0a0a0a' : '#141420',
              borderBottom: '1px solid #1a1a2a',
            }}
          />
        ))}
      </div>
      {/* Grid */}
      <svg className="absolute inset-0" style={{ left: 16 }} width="calc(100% - 16px)" height="100%">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={`${f * 100}%`} x2="100%" y2={`${f * 100}%`} stroke="#1a1a2a" strokeWidth="0.5" />
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={`${f * 100}%`} y1="0" x2={`${f * 100}%`} y2="100%" stroke="#1a1a2a" strokeWidth="0.5" />
        ))}
        {/* Notes */}
        {notes.map((note, i) => (
          <rect
            key={i}
            x={`${note.x + 1}%`}
            y={`${note.y}%`}
            width={`${note.w}%`}
            height="14%"
            rx={1}
            fill="#9945ff"
            opacity={0.85}
          />
        ))}
      </svg>
    </div>
  );
}

// =====================================================
// Mix suggestion card
// =====================================================
function MixSuggestionCard({
  title,
  suggestion,
  onApply,
}: {
  title: string;
  suggestion: string;
  onApply: () => void;
}) {
  return (
    <div
      className="rounded p-2.5 transition-all"
      style={{
        background: '#0e0e1c',
        border: '1px solid #1a1a2a',
        borderLeft: '3px solid #9945ff',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold font-mono text-gray-200">{title}</div>
          <div className="text-[10px] font-mono text-gray-500 mt-0.5">{suggestion}</div>
        </div>
        <button
          onClick={onApply}
          className="shrink-0 text-[9px] font-mono px-2 py-0.5 rounded transition-colors"
          style={{ background: '#9945ff22', color: '#9945ff', border: '1px solid #9945ff44' }}
        >
          APPLY
        </button>
      </div>
    </div>
  );
}

// =====================================================
// Tab definitions
// =====================================================
const TABS = ['Song', 'Chords', 'Bassline', 'Melody', 'Drums', 'Mix', 'Prompt'] as const;
type Tab = typeof TABS[number];

const TAB_ICONS: Record<Tab, string> = {
  Song:     '✦',
  Chords:   '♩',
  Bassline: '⌇',
  Melody:   '~',
  Drums:    '◈',
  Mix:      '≋',
  Prompt:   '›',
};

const MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Sonnet 4.5', cost: '~$0.01', desc: 'Fast · Cheap' },
  { id: 'claude-opus-4-5',   label: 'Opus 4.5',   cost: '~$0.15', desc: 'Best · Expensive' },
] as const;

// =====================================================
// Main AIPanel
// =====================================================
export function AIPanel() {
  const {
    generateChordProgression,
    generateDrumPattern,
    generateBassline,
    generateMelody,
    applyAIPrompt,
    isGenerating,
    lastGeneratedChords,
    aiSettings,
    setAISettings,
  } = useAIStore();

  const {
    project, selectedTrackId,
    updateSynthSettings, toggleStep,
    addNote, setBPM, play, stop, isPlaying,
    assignClipToScene, addNamedScene, addPatternToTrack, removeScene,
  } = useProjectStore();

  const { setActivePanel, setBottomPanelTab } = useUIStore();

  const [activeTab, setActiveTab] = useState<Tab>('Song');
  const [prompt, setPrompt] = useState('');
  const [promptApplied, setPromptApplied] = useState('');
  const [selectedTrackForAI, setSelectedTrackForAI] = useState(selectedTrackId ?? project.tracks[0]?.id ?? '');
  const [genChords, setGenChords] = useState<string[]>(lastGeneratedChords);
  const [genPattern, setGenPattern] = useState<boolean[][]>([]);
  const [genNotes, setGenNotes] = useState<{ pitch: number; startStep: number; duration: number; velocity: number }[]>([]);
  const [showDrumPreview, setShowDrumPreview] = useState(false);
  const [showBassPreview, setShowBassPreview] = useState(false);
  const [showMelodyPreview, setShowMelodyPreview] = useState(false);
  const [complexity, setComplexity] = useState(0.5);
  const [fillProb, setFillProb] = useState(0.3);
  const [analyzeDone, setAnalyzeDone] = useState(false);
  const [bassStyle, setBassStyle] = useState<'Simple' | 'Walking' | 'Aggressive' | 'Melodic'>('Simple');
  const [melodyComplexity, setMelodyComplexity] = useState(0.5);
  const [melodyRange, setMelodyRange] = useState(0.5);
  const [melodyRhythm, setMelodyRhythm] = useState(0.4);

  // Song generator state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('claude_api_key') ?? '');
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('claude_model') ?? 'claude-sonnet-4-5'
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [songPrompt, setSongPrompt] = useState('');
  const [songGenerating, setSongGenerating] = useState(false);
  const [songProgress, setSongProgress] = useState('');
  const [sectionsDone, setSectionsDone] = useState<string[]>([]);
  const [songResult, setSongResult] = useState<GeneratedSongV2 | null>(null);
  const [songError, setSongError] = useState('');
  const [songPlanPreview, setSongPlanPreview] = useState<string[]>([]);

  const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SCALES = ['major', 'minor', 'dorian', 'phrygian', 'mixolydian'];
  const MOODS = ['Happy', 'Dark', 'Tense', 'Dreamy', 'Aggressive'];
  const BARS_OPTIONS = [4, 8, 16];
  // SVG icons for each genre — no emojis
  const GenreIcon = ({ id, active }: { id: string; active: boolean }) => {
    const c = active ? '#9945ff' : '#555';
    if (id === 'house') return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill={c}>
        {/* 4-on-floor kick dots */}
        <circle cx="3" cy="10" r="2.2"/><circle cx="8.3" cy="10" r="2.2"/>
        <circle cx="13.6" cy="10" r="2.2"/><circle cx="18.9" cy="10" r="2.2"/>
        <rect x="1" y="14" width="18" height="1.5" rx="0.5" opacity="0.4"/>
        <rect x="1" y="5" width="18" height="1" rx="0.5" opacity="0.25"/>
      </svg>
    );
    if (id === 'techno') return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
        {/* Gear-like mechanical lines */}
        <circle cx="10" cy="10" r="4" stroke={c} strokeWidth="1.5"/>
        <line x1="10" y1="1" x2="10" y2="4"/><line x1="10" y1="16" x2="10" y2="19"/>
        <line x1="1" y1="10" x2="4" y2="10"/><line x1="16" y1="10" x2="19" y2="10"/>
        <line x1="3.2" y1="3.2" x2="5.4" y2="5.4"/><line x1="14.6" y1="14.6" x2="16.8" y2="16.8"/>
        <line x1="16.8" y1="3.2" x2="14.6" y2="5.4"/><line x1="5.4" y1="14.6" x2="3.2" y2="16.8"/>
      </svg>
    );
    if (id === 'dubstep') return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill={c}>
        {/* Waveform with a drop/spike */}
        <rect x="0" y="9" width="20" height="2" rx="1" opacity="0.3"/>
        <rect x="1" y="7" width="2" height="6" rx="1"/>
        <rect x="4.5" y="5" width="2" height="10" rx="1"/>
        <rect x="8" y="1" width="2.5" height="18" rx="1"/>
        <rect x="12" y="6" width="2" height="8" rx="1"/>
        <rect x="15.5" y="8" width="2" height="4" rx="1"/>
        <rect x="18" y="9" width="2" height="2" rx="1"/>
      </svg>
    );
    if (id === 'dnb') return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill={c}>
        {/* Breakbeat pattern — syncopated dots */}
        <circle cx="2" cy="7" r="2"/><circle cx="7" cy="13" r="2"/>
        <circle cx="10.5" cy="7" r="2"/><circle cx="13" cy="13" r="2"/>
        <circle cx="16" cy="7" r="2"/>
        <rect x="1" y="17" width="18" height="1" rx="0.5" opacity="0.3"/>
      </svg>
    );
    if (id === 'trap') return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill={c}>
        {/* Hi-hat roll dots (small rapid hits) + sparse kick */}
        {[1,3,5,7,9,11,13,15,17].map(x => (
          <circle key={x} cx={x} cy="5" r="0.9" opacity={x % 4 === 1 ? 1 : 0.45}/>
        ))}
        <rect x="1" y="10" width="5" height="3" rx="1"/>
        <rect x="13" y="10" width="5" height="3" rx="1"/>
        <rect x="7" y="14" width="8" height="3" rx="1" opacity="0.5"/>
      </svg>
    );
    if (id === 'future-bass') return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* Uplifting curve + chord stack */}
        <path d="M1 18 Q5 4 10 8 Q15 12 19 2"/>
        <line x1="6" y1="14" x2="6" y2="18" stroke={c} strokeWidth="1.2" opacity="0.6"/>
        <line x1="10" y1="12" x2="10" y2="18" stroke={c} strokeWidth="1.2" opacity="0.6"/>
        <line x1="14" y1="10" x2="14" y2="18" stroke={c} strokeWidth="1.2" opacity="0.6"/>
      </svg>
    );
    return null;
  };

  const GENRES = [
    { id: 'house',      label: 'House'   },
    { id: 'techno',     label: 'Techno'  },
    { id: 'dubstep',    label: 'Dubstep' },
    { id: 'dnb',        label: 'DnB'     },
    { id: 'trap',       label: 'Trap'    },
    { id: 'future-bass',label: 'Future'  },
  ];

  const handleGenerateSong = useCallback(async () => {
    if (!apiKey.trim()) { setSongError('Enter your Anthropic API key first.'); return; }
    if (!songPrompt.trim()) { setSongError('Describe the song you want.'); return; }

    localStorage.setItem('claude_api_key', apiKey.trim());
    localStorage.setItem('claude_model', selectedModel);

    audioEngine.start().catch(() => {});

    setSongGenerating(true);
    setSongProgress('');
    setSectionsDone([]);
    setSongPlanPreview([]);
    setSongResult(null);
    setSongError('');

    try {
      if (isPlaying) stop();

      const result = await generateFullSong(
        apiKey.trim(),
        songPrompt.trim(),
        selectedModel,
        (text, done) => {
          setSongProgress(text);
          setSectionsDone([...done]);
          if (text.startsWith('Structure planned:')) {
            const names = text.replace('Structure planned: ', '').split(' \u2192 ');
            setSongPlanPreview(names);
          }
        },
      );

      const { plan, sections } = result;
      setBPM(plan.bpm);

      // Remove all existing scenes
      const existingSceneIds = [...project.scenes.map(s => s.id)];
      existingSceneIds.forEach(id => removeScene(id));

      // Find tracks by known IDs (from createDefaultProject) — constant across all sections
      const leadTrack = project.tracks.find(t => t.id === 'track-lead');
      const bassTrack = project.tracks.find(t => t.id === 'track-bass');
      const padTrack = project.tracks.find(t => t.id === 'track-pad');
      const drumTrack = project.tracks.find(t => t.id === 'track-drums');

      // Apply synth presets once from the first section
      if (sections.length > 0) {
        const firstSection = sections[0];
        if (leadTrack) {
          const presetSettings = SYNTH_PRESETS[firstSection.patterns.leadPreset] ?? SYNTH_PRESETS['Supersaw'];
          updateSynthSettings(leadTrack.id, presetSettings);
        }
        if (bassTrack) {
          const presetSettings = SYNTH_PRESETS[firstSection.patterns.bassPreset] ?? SYNTH_PRESETS['Reese Bass'];
          updateSynthSettings(bassTrack.id, presetSettings);
        }
        if (padTrack) {
          const presetSettings = SYNTH_PRESETS[firstSection.patterns.padPreset] ?? SYNTH_PRESETS['Lush Pad'];
          updateSynthSettings(padTrack.id, presetSettings);
        }
      }

      // For each section: create a scene + patterns per track
      for (let i = 0; i < sections.length; i++) {
        const { name, patterns } = sections[i];
        const sceneId = addNamedScene(name);

        const sectionBars = result.plan.sections[i]?.bars ?? 8;
        const loopSteps = sectionBars * 16;

        if (leadTrack) {
          const pat = defaultPattern({ name: `${name} Lead`, steps: loopSteps, notes: patterns.lead.notes.map(n => ({ ...n, id: crypto.randomUUID() })) });
          addPatternToTrack(leadTrack.id, pat);
          assignClipToScene(sceneId, leadTrack.id, pat.id);
        }

        if (bassTrack) {
          const pat = defaultPattern({ name: `${name} Bass`, steps: loopSteps, notes: patterns.bass.notes.map(n => ({ ...n, id: crypto.randomUUID() })) });
          addPatternToTrack(bassTrack.id, pat);
          assignClipToScene(sceneId, bassTrack.id, pat.id);
        }

        if (padTrack) {
          const pat = defaultPattern({ name: `${name} Pad`, steps: loopSteps, notes: patterns.pad.notes.map(n => ({ ...n, id: crypto.randomUUID() })) });
          addPatternToTrack(padTrack.id, pat);
          assignClipToScene(sceneId, padTrack.id, pat.id);
        }

        if (drumTrack) {
          const d = patterns.drums;
          const pad16 = (arr: boolean[]) => [...arr, ...Array(16).fill(false)];
          const stepData = [
            pad16(d.kick), pad16(d.snare), pad16(d.clap), pad16(d.hihat),
            pad16(d.openHihat), pad16(d.tom), pad16(d.rim), pad16(d.cymbal),
            pad16(d.kick2), pad16(d.snare2), pad16(d.crash), pad16(d.ride),
            pad16(d.tomHi), pad16(d.tomLo), pad16(d.impact), pad16(d.reverseSweep),
          ];
          const pat = defaultPattern({ name: `${name} Drums`, steps: 32, stepData });
          addPatternToTrack(drumTrack.id, pat);
          assignClipToScene(sceneId, drumTrack.id, pat.id);
        }
      }

      setSongResult(result);
      setActivePanel('session');
      setBottomPanelTab('sequencer');
      await play();

    } catch (err) {
      setSongError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setSongGenerating(false);
    }
  }, [apiKey, selectedModel, songPrompt, isPlaying, stop, setBPM,
      project.tracks, project.scenes, updateSynthSettings, addPatternToTrack,
      assignClipToScene, addNamedScene, removeScene,
      setActivePanel, setBottomPanelTab, play]);

  const handleGenerateChords = useCallback(() => {
    const chords = generateChordProgression();
    setGenChords(chords);
  }, [generateChordProgression]);

  const handleGenerateDrums = useCallback(() => {
    const pattern = generateDrumPattern(aiSettings.genre);
    setGenPattern(pattern);
    setShowDrumPreview(true);
  }, [generateDrumPattern, aiSettings.genre]);

  const handleApplyDrums = useCallback(() => {
    const drumTrack = project.tracks.find(t => t.type === 'drum');
    if (!drumTrack || genPattern.length === 0) return;
    const pattern = drumTrack.patterns[0];
    if (!pattern) return;
    // Write each row's steps
    for (let row = 0; row < genPattern.length; row++) {
      for (let step = 0; step < genPattern[row].length; step++) {
        const current = pattern.stepData[row]?.[step] ?? false;
        if (current !== genPattern[row][step]) {
          toggleStep(drumTrack.id, pattern.id, row, step);
        }
      }
    }
  }, [project.tracks, genPattern, toggleStep]);

  const handleGenerateBassline = useCallback(() => {
    const chords = genChords.length > 0 ? genChords : ['Am', 'F', 'C', 'G'];
    const notes = generateBassline(chords);
    setGenNotes(notes);
    setShowBassPreview(true);
  }, [generateBassline, genChords]);

  const handleApplyBassline = useCallback(() => {
    const bassTrack = project.tracks.find(t => t.name.toLowerCase().includes('bass') && t.type === 'synth')
      ?? project.tracks.find(t => t.type === 'synth');
    if (!bassTrack) return;
    const pattern = bassTrack.patterns[0];
    if (!pattern) return;
    genNotes.forEach(n => addNote(bassTrack.id, pattern.id, { ...n, id: crypto.randomUUID() }));
  }, [project.tracks, genNotes, addNote]);

  const handleGenerateMelody = useCallback(() => {
    const chords = genChords.length > 0 ? genChords : ['Am', 'F', 'C', 'G'];
    const notes = generateMelody(chords);
    setGenNotes(notes);
    setShowMelodyPreview(true);
  }, [genChords, generateMelody]);

  const handleApplyMelody = useCallback(() => {
    const leadTrack = project.tracks.find(t => t.name.toLowerCase().includes('lead') && t.type === 'synth')
      ?? project.tracks.find(t => t.type === 'synth');
    if (!leadTrack) return;
    const pattern = leadTrack.patterns[0];
    if (!pattern) return;
    genNotes.forEach(n => addNote(leadTrack.id, pattern.id, { ...n, id: crypto.randomUUID() }));
  }, [project.tracks, genNotes, addNote]);

  const handleAnalyzeMix = useCallback(() => {
    setAnalyzeDone(true);
  }, []);

  const handleApplyPrompt = useCallback(() => {
    if (!prompt.trim() || !selectedTrackForAI) return;
    const newSettings = applyAIPrompt(prompt, selectedTrackForAI);
    updateSynthSettings(selectedTrackForAI, newSettings);
    setPromptApplied(newSettings.preset ?? 'AI Preset');
  }, [prompt, selectedTrackForAI, applyAIPrompt, updateSynthSettings]);

  const mixSuggestions = [
    { title: 'Lead Synth', suggestion: 'Boost 3kHz +2dB, add slight reverb (wet: 20%)' },
    { title: 'Bass', suggestion: 'High-pass at 40Hz, compress 4:1 with fast attack' },
    { title: 'Drums', suggestion: 'Boost 80Hz on kick, sidechain compress to bass' },
    { title: 'Pad', suggestion: 'Cut 200-400Hz to reduce muddiness, widen stereo' },
  ];

  const promptExamples = ['aggressive dubstep bass', 'dreamy pad with reverb', 'punchy trap 808', 'supersaw lead synth', 'dark techno pluck'];

  return (
    <div
      className="flex flex-col"
      style={{
        width: '100%',
        height: '100%',
        background: '#09090f',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 shrink-0 flex items-center gap-2"
        style={{ borderBottom: '1px solid #1a1a2a', background: '#0e0e1c' }}
      >
        <div
          className="text-xs font-bold font-mono tracking-widest"
          style={{
            background: 'linear-gradient(90deg, #9945ff, #00d4ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AI TOOLS
        </div>
        {isGenerating && (
          <div
            className="w-2 h-2 rounded-full ml-auto animate-pulse"
            style={{ background: '#9945ff', boxShadow: '0 0 8px #9945ff' }}
          />
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid #1a1a2a', background: '#0a0a14' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0"
              style={{
                padding: '8px 16px',
                fontSize: 10,
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'monospace',
                letterSpacing: '0.08em',
                color: isActive ? '#9945ff' : '#555',
                borderBottom: `2px solid ${isActive ? '#9945ff' : 'transparent'}`,
                background: isActive ? '#12121e' : 'transparent',
                borderRight: '1px solid #1a1a2a',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#888'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#555'; }}
            >
              <span style={{ fontSize: 11, opacity: 0.8 }}>{TAB_ICONS[tab]}</span>
              {tab.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" style={{ minHeight: 0, maxWidth: 600, width: '100%', alignSelf: 'center' }}>

        {/* ==================== SONG TAB ==================== */}
        {activeTab === 'Song' && (
          <>
            {/* Header + Model selector — compact single row */}
            <div className="flex items-center gap-2 flex-wrap" style={{ gap: '6px' }}>
              <span className="text-[9px] font-bold font-mono tracking-widest" style={{
                background: 'linear-gradient(90deg, #9945ff, #00d4ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>✦ FULL SONG GENERATOR</span>
              <div className="flex gap-1 ml-auto">
                {MODELS.map(m => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className="rounded px-2 py-1 text-left transition-all"
                      style={{
                        background: isSelected ? '#9945ff22' : '#0a0a14',
                        border: `1px solid ${isSelected ? '#9945ff88' : '#1a1a2a'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <span className="text-[9px] font-bold font-mono" style={{ color: isSelected ? '#9945ff' : '#555' }}>
                        {m.label}
                      </span>
                      <span className="text-[8px] font-mono ml-1" style={{ color: isSelected ? '#00d4ff' : '#333' }}>
                        {m.cost}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Song Description */}
            <div>
              <SectionLabel>Describe Your Song</SectionLabel>
              <textarea
                value={songPrompt}
                onChange={(e) => setSongPrompt(e.target.value)}
                placeholder="dark dubstep banger with heavy bass drops and aggressive synths..."
                rows={3}
                className="w-full rounded p-2 text-[11px] font-mono outline-none resize-none"
                style={{
                  background: '#0e0e1c',
                  color: '#ccc',
                  border: '1px solid #2a2a3a',
                  caretColor: '#9945ff',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#9945ff44'; }}
                onBlur={(e) => { e.target.style.borderColor = '#2a2a3a'; }}
              />
            </div>

            {/* Quick examples */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
              {[
                'dark dubstep drop',
                'euphoric future bass',
                'minimal techno loop',
                'trap hi-hat riddim',
                'melodic house groove',
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => setSongPrompt(ex)}
                  style={{
                    fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                    padding: '3px 8px', borderRadius: 4,
                    background: '#0e0e1c', color: '#555', border: '1px solid #1a1a2a',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#9945ff'; e.currentTarget.style.borderColor = '#9945ff44'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = '#1a1a2a'; }}
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* API Key — inline above button so it's always visible */}
            <div>
              <SectionLabel>Anthropic API Key</SectionLabel>
              <div className="flex gap-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-... (get yours at console.anthropic.com)"
                  className="flex-1 rounded px-2 py-1 text-[11px] font-mono outline-none"
                  style={{
                    background: '#0e0e1c',
                    color: apiKey ? '#9945ff' : '#444',
                    border: `1px solid ${apiKey ? '#9945ff44' : '#ff444433'}`,
                    caretColor: '#9945ff',
                  }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="px-2 rounded text-[10px] font-mono"
                  style={{ background: '#1a1a2a', color: '#555', border: '1px solid #2a2a3a' }}
                >
                  {showApiKey ? '●' : '○'}
                </button>
              </div>
            </div>

            {/* Generate button */}
            <div style={{ display: 'flex' }}>
              <GradientButton
                onClick={handleGenerateSong}
                loading={songGenerating}
                disabled={!apiKey.trim() || !songPrompt.trim()}
              >
                {!apiKey.trim() ? '⚠ Enter API Key Above' : !songPrompt.trim() ? '⚠ Describe Your Song First' : 'Generate Full Song'}
              </GradientButton>
            </div>

            {/* Error */}
            {songError && !songGenerating && (
              <div
                className="p-2 rounded text-[10px] font-mono"
                style={{ background: '#1a0a0a', border: '1px solid #aa333344', color: '#ff6666' }}
              >
                ✗ {songError}
              </div>
            )}

            {/* Progress */}
            {songGenerating && (
              <div style={{ background: '#0a0a18', border: '1px solid #1a1a2e', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: '#9945ff', fontFamily: 'monospace', marginBottom: 8, letterSpacing: 2 }}>
                  GENERATING...
                </div>
                {songPlanPreview.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {songPlanPreview.map(name => {
                      const done = sectionsDone.includes(name);
                      return (
                        <span key={name} style={{
                          fontSize: 9, fontFamily: 'monospace', fontWeight: 700,
                          padding: '2px 8px', borderRadius: 12,
                          background: done ? '#9945ff33' : '#1a1a2e',
                          color: done ? '#9945ff' : '#444',
                          border: `1px solid ${done ? '#9945ff' : '#2a2a3a'}`,
                          transition: 'all 0.3s ease',
                        }}>
                          {done ? '\u2713 ' : ''}{name}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#666', fontFamily: 'monospace' }}>{songProgress}</div>
              </div>
            )}

            {/* Result */}
            {songResult && !songGenerating && (
              <div style={{ background: '#0a1a0a', border: '1px solid #00ff8833', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 10, color: '#00ff88', fontFamily: 'monospace', fontWeight: 700, marginBottom: 6 }}>
                  {'\u2713'} SONG GENERATED {'\u2014'} {songResult.plan.bpm} BPM {'\u00b7'} {songResult.plan.key} {songResult.plan.scale} {'\u00b7'} {songResult.plan.vibe}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {songResult.sections.map(({ name }) => (
                    <span key={name} style={{
                      fontSize: 9, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 12,
                      background: '#9945ff33', color: '#9945ff', border: '1px solid #9945ff55',
                    }}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== CHORDS TAB ==================== */}
        {activeTab === 'Chords' && (
          <>
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <SectionLabel>Key</SectionLabel>
                <Select
                  value={aiSettings.key}
                  onChange={(v) => setAISettings({ key: v })}
                  options={KEYS.map((k) => ({ value: k, label: k }))}
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <SectionLabel>Scale</SectionLabel>
                <Select
                  value={aiSettings.scale}
                  onChange={(v) => setAISettings({ scale: v })}
                  options={SCALES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                />
              </div>
            </div>

            <div>
              <SectionLabel>Mood</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((mood) => (
                  <PillButton
                    key={mood}
                    active={aiSettings.mood === mood.toLowerCase()}
                    onClick={() => setAISettings({ mood: mood.toLowerCase() })}
                  >
                    {mood}
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Bars</SectionLabel>
              <div className="flex gap-1.5">
                {BARS_OPTIONS.map((b) => (
                  <PillButton
                    key={b}
                    active={aiSettings.bars === b}
                    onClick={() => setAISettings({ bars: b })}
                  >
                    {b}
                  </PillButton>
                ))}
              </div>
            </div>

            <GradientButton onClick={handleGenerateChords} loading={isGenerating}>
              Generate Chords
            </GradientButton>

            {genChords.length > 0 && (
              <div className="flex flex-col gap-2">
                <SectionLabel>Progression</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {genChords.map((chord, i) => (
                    <ChordPill key={i} chord={chord} />
                  ))}
                </div>
                <button
                  onClick={() => {
                    const synthTrack = project.tracks.find(t => t.type === 'synth');
                    if (synthTrack && genChords.length > 0) {
                      // Write chord root notes into the pattern as a simple chord stab
                      const pattern = synthTrack.patterns[0];
                      if (pattern) {
                        genChords.forEach((chord, i) => {
                          const root = chord.replace(/m$/, '');
                          const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
                          const midiBase = 60 + NOTES.indexOf(root);
                          if (midiBase >= 60) {
                            addNote(synthTrack.id, pattern.id, { id: crypto.randomUUID(), pitch: midiBase, startStep: i * 16, duration: 14, velocity: 90 });
                            // add fifth
                            addNote(synthTrack.id, pattern.id, { id: crypto.randomUUID(), pitch: midiBase + 7, startStep: i * 16, duration: 14, velocity: 80 });
                          }
                        });
                      }
                    }
                  }}
                  className="text-[10px] font-mono px-3 py-1.5 rounded mt-1 transition-colors"
                  style={{
                    background: '#00d4ff22',
                    color: '#00d4ff',
                    border: '1px solid #00d4ff44',
                    cursor: 'pointer',
                  }}
                >
                  Apply to Track
                </button>
              </div>
            )}
          </>
        )}

        {/* ==================== DRUMS TAB ==================== */}
        {activeTab === 'Drums' && (
          <>
            <div>
              <SectionLabel>Genre</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {GENRES.map(({ id, label }) => {
                  const active = aiSettings.genre === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setAISettings({ genre: id })}
                      className="flex flex-col items-center gap-1.5 py-3 rounded transition-all"
                      style={{
                        background: active ? '#9945ff22' : '#0e0e1c',
                        color: active ? '#9945ff' : '#555',
                        border: `1px solid ${active ? '#9945ff55' : '#1a1a2a'}`,
                        fontSize: 10,
                        boxShadow: active ? '0 0 8px rgba(153,69,255,0.2)' : 'none',
                      }}
                    >
                      <GenreIcon id={id} active={active} />
                      <span className="font-mono font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Complexity</SectionLabel>
              <SliderInput value={complexity} onChange={setComplexity} />
            </div>

            <div>
              <SectionLabel>Fill Probability</SectionLabel>
              <SliderInput value={fillProb} onChange={setFillProb} />
            </div>

            <GradientButton onClick={handleGenerateDrums} loading={isGenerating}>
              Generate Pattern
            </GradientButton>

            {showDrumPreview && genPattern.length > 0 && (
              <div className="flex flex-col gap-2">
                <SectionLabel>Pattern Preview</SectionLabel>
                <DrumPatternPreview pattern={genPattern} />
                <button
                  onClick={handleApplyDrums}
                  className="text-[10px] font-mono px-3 py-1.5 rounded transition-colors"
                  style={{ background: '#00d4ff22', color: '#00d4ff', border: '1px solid #00d4ff44', cursor: 'pointer' }}
                >
                  Apply to Drum Track
                </button>
              </div>
            )}
          </>
        )}

        {/* ==================== BASSLINE TAB ==================== */}
        {activeTab === 'Bassline' && (
          <>
            <div
              className="p-2 rounded text-[10px] font-mono text-gray-600"
              style={{ background: '#0e0e1c', border: '1px solid #1a1a2a' }}
            >
              Using chord progression:{' '}
              <span style={{ color: '#9945ff' }}>
                {genChords.length > 0 ? genChords.join(' – ') : 'Am – F – C – G (default)'}
              </span>
            </div>

            <div>
              <SectionLabel>Style</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {(['Simple', 'Walking', 'Aggressive', 'Melodic'] as const).map((style) => (
                  <PillButton
                    key={style}
                    active={bassStyle === style}
                    onClick={() => setBassStyle(style)}
                    color="#00d4ff"
                  >
                    {style}
                  </PillButton>
                ))}
              </div>
            </div>

            <GradientButton onClick={handleGenerateBassline} loading={isGenerating}>
              Generate Bassline
            </GradientButton>

            {showBassPreview && (
              <div className="flex flex-col gap-2">
                <SectionLabel>Preview</SectionLabel>
                <MiniPianoRoll noteCount={12} />
                <button
                  onClick={handleApplyBassline}
                  className="text-[10px] font-mono px-3 py-1.5 rounded transition-colors"
                  style={{ background: '#00d4ff22', color: '#00d4ff', border: '1px solid #00d4ff44', cursor: 'pointer' }}
                >
                  Apply to Bass Track
                </button>
              </div>
            )}
          </>
        )}

        {/* ==================== MELODY TAB ==================== */}
        {activeTab === 'Melody' && (
          <>
            <div
              className="p-2 rounded text-[10px] font-mono text-gray-600"
              style={{ background: '#0e0e1c', border: '1px solid #1a1a2a' }}
            >
              Key: <span style={{ color: '#9945ff' }}>{aiSettings.key} {aiSettings.scale}</span>
            </div>

            <div>
              <SectionLabel>Complexity</SectionLabel>
              <SliderInput value={melodyComplexity} onChange={setMelodyComplexity} />
              <div className="flex justify-between text-[8px] font-mono text-gray-600 mt-1">
                <span>Simple</span><span>Complex</span>
              </div>
            </div>

            <div>
              <SectionLabel>Range</SectionLabel>
              <SliderInput value={melodyRange} onChange={setMelodyRange} />
              <div className="flex justify-between text-[8px] font-mono text-gray-600 mt-1">
                <span>Narrow</span><span>Wide</span>
              </div>
            </div>

            <div>
              <SectionLabel>Rhythm Variation</SectionLabel>
              <SliderInput value={melodyRhythm} onChange={setMelodyRhythm} />
              <div className="flex justify-between text-[8px] font-mono text-gray-600 mt-1">
                <span>Steady</span><span>Varied</span>
              </div>
            </div>

            <GradientButton onClick={handleGenerateMelody} loading={isGenerating}>
              Generate Melody
            </GradientButton>

            {showMelodyPreview && (
              <div className="flex flex-col gap-2">
                <SectionLabel>Preview</SectionLabel>
                <MiniPianoRoll noteCount={16} />
                <button
                  onClick={handleApplyMelody}
                  className="text-[10px] font-mono px-3 py-1.5 rounded transition-colors"
                  style={{ background: '#9945ff22', color: '#9945ff', border: '1px solid #9945ff44', cursor: 'pointer' }}
                >
                  Apply to Synth Track
                </button>
              </div>
            )}
          </>
        )}

        {/* ==================== MIX TAB ==================== */}
        {activeTab === 'Mix' && (
          <>
            <GradientButton onClick={handleAnalyzeMix} loading={isGenerating}>
              Analyze Mix
            </GradientButton>

            {analyzeDone && (
              <div className="flex flex-col gap-2">
                <SectionLabel>Suggestions</SectionLabel>
                {mixSuggestions.map((s, i) => (
                  <MixSuggestionCard
                    key={i}
                    title={s.title}
                    suggestion={s.suggestion}
                    onApply={() => {}}
                  />
                ))}
                <button
                  className="text-[10px] font-mono px-3 py-2 rounded font-bold transition-colors mt-1"
                  style={{ background: '#9945ff33', color: '#9945ff', border: '1px solid #9945ff44' }}
                >
                  Apply All Suggestions
                </button>
              </div>
            )}

            {!analyzeDone && (
              <div
                className="p-4 rounded text-center"
                style={{ background: '#0e0e1c', border: '1px dashed #1a1a2a' }}
              >
                <div className="text-2xl mb-2">🎛️</div>
                <div className="text-[11px] font-mono text-gray-600">
                  Click "Analyze Mix" to get AI-powered suggestions for your tracks
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== PROMPT TAB ==================== */}
        {activeTab === 'Prompt' && (
          <>
            <div>
              <SectionLabel>Target Track</SectionLabel>
              <Select
                value={selectedTrackForAI}
                onChange={setSelectedTrackForAI}
                options={project.tracks.map((t) => ({ value: t.id, label: t.name }))}
              />
            </div>

            <div>
              <SectionLabel>Describe Your Sound</SectionLabel>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="aggressive dubstep bass with heavy distortion..."
                rows={4}
                className="w-full rounded p-2 text-[11px] font-mono outline-none resize-none transition-colors"
                style={{
                  background: '#0e0e1c',
                  color: '#ccc',
                  border: '1px solid #2a2a3a',
                  caretColor: '#9945ff',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#9945ff44'; }}
                onBlur={(e) => { e.target.style.borderColor = '#2a2a3a'; }}
              />
            </div>

            <div>
              <SectionLabel>Examples</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                {promptExamples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    style={{
                      fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                      padding: '3px 8px', borderRadius: 4,
                      background: '#0e0e1c', color: '#555', border: '1px solid #1a1a2a',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#9945ff';
                      e.currentTarget.style.borderColor = '#9945ff44';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#555';
                      e.currentTarget.style.borderColor = '#1a1a2a';
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <GradientButton
              onClick={handleApplyPrompt}
              loading={isGenerating}
              disabled={!prompt.trim()}
            >
              Configure Synth
            </GradientButton>

            {promptApplied && (
              <div
                className="p-2 rounded text-[10px] font-mono"
                style={{ background: '#0a1a0a', border: '1px solid #00aa4433', color: '#00aa44' }}
              >
                ✓ Applied preset "{promptApplied}" to {project.tracks.find(t => t.id === selectedTrackForAI)?.name ?? 'track'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
