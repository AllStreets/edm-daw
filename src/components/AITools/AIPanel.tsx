import { useState, useCallback } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { useProjectStore } from '../../store/useProjectStore';

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
        padding: small ? '4px 12px' : '8px 20px',
        fontSize: small ? 10 : 12,
        borderRadius: 6,
        background: disabled || loading
          ? '#1a1a2a'
          : 'linear-gradient(135deg, #9945ff, #6633cc)',
        color: disabled || loading ? '#444' : '#fff',
        border: `1px solid ${disabled || loading ? '#222' : '#9945ff88'}`,
        boxShadow: disabled || loading ? 'none' : '0 0 12px rgba(153,69,255,0.4)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
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
          {!small && <span>⚡</span>}
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
const TABS = ['Chords', 'Bassline', 'Melody', 'Drums', 'Mix', 'Prompt'] as const;
type Tab = typeof TABS[number];

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
    addNote,
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<Tab>('Chords');
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

  const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SCALES = ['major', 'minor', 'dorian', 'phrygian', 'mixolydian'];
  const MOODS = ['Happy', 'Dark', 'Tense', 'Dreamy', 'Aggressive'];
  const BARS_OPTIONS = [4, 8, 16];
  const GENRES = [
    { id: 'house', label: 'House', icon: '🏠' },
    { id: 'techno', label: 'Techno', icon: '⚙️' },
    { id: 'dubstep', label: 'Dubstep', icon: '🔊' },
    { id: 'dnb', label: 'DnB', icon: '🥁' },
    { id: 'trap', label: 'Trap', icon: '💎' },
    { id: 'future-bass', label: 'Future', icon: '🌊' },
  ];

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
        width: 320,
        background: '#09090f',
        border: '1px solid #1a1a2a',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
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
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-2 text-[10px] font-bold font-mono whitespace-nowrap transition-all shrink-0"
            style={{
              color: activeTab === tab ? '#9945ff' : '#444',
              borderBottom: `2px solid ${activeTab === tab ? '#9945ff' : 'transparent'}`,
              background: 'transparent',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" style={{ minHeight: 0 }}>

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
                {GENRES.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => setAISettings({ genre: id })}
                    className="flex flex-col items-center gap-1 py-2 rounded transition-all"
                    style={{
                      background: aiSettings.genre === id ? '#9945ff22' : '#0e0e1c',
                      color: aiSettings.genre === id ? '#9945ff' : '#555',
                      border: `1px solid ${aiSettings.genre === id ? '#9945ff44' : '#1a1a2a'}`,
                      fontSize: 10,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span className="font-mono font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Complexity</SectionLabel>
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={complexity}
                onChange={(e) => setComplexity(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: '#9945ff' }}
              />
            </div>

            <div>
              <SectionLabel>Fill Probability</SectionLabel>
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={fillProb}
                onChange={(e) => setFillProb(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: '#9945ff' }}
              />
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
              <input
                type="range" min={0} max={1} step={0.01}
                value={melodyComplexity}
                onChange={(e) => setMelodyComplexity(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: '#9945ff' }}
              />
              <div className="flex justify-between text-[8px] font-mono text-gray-600 mt-0.5">
                <span>Simple</span><span>Complex</span>
              </div>
            </div>

            <div>
              <SectionLabel>Range</SectionLabel>
              <input type="range" min={0} max={1} step={0.01} defaultValue={0.5} className="w-full" style={{ accentColor: '#9945ff' }} />
            </div>

            <div>
              <SectionLabel>Rhythm Variation</SectionLabel>
              <input type="range" min={0} max={1} step={0.01} defaultValue={0.4} className="w-full" style={{ accentColor: '#9945ff' }} />
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
              <div className="flex flex-wrap gap-1.5">
                {promptExamples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="text-[9px] font-mono px-2 py-0.5 rounded transition-colors"
                    style={{
                      background: '#0e0e1c',
                      color: '#555',
                      border: '1px solid #1a1a2a',
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
