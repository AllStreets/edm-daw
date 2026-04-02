import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { audioEngine } from '../../engine/AudioEngine';
import { SYNTH_PRESETS } from '../../engine/SynthPresets';
import { useProjectStore } from '../../store/useProjectStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SampleEntry {
  name: string;
  file?: File;
  isImported?: boolean;
}

// ─── Built-in sample data ─────────────────────────────────────────────────────

// Each name describes exactly what the synthesized preview sounds like.
// Index order matches the switch cases in audioEngine.previewDrumSound().
const BUILTIN_SAMPLES: Record<string, string[]> = {
  Kicks: [
    'Hard Kick — C1 fast punch, 400ms decay',
    'Sub Kick — B0 deep boom, 650ms decay',
    'Tight Kick — D1 short snap, 250ms decay',
    'Deep Kick — A0 subby thud, 550ms decay',
    'House Kick — C1 mid-punch, 400ms decay',
    'Trap Kick — D1 dry pop, 200ms decay',
    'Techno Kick — C1 industrial stomp',
    'Thick Kick — C1 slow swell, 500ms decay',
  ],
  Snares: [
    'Crisp Snare — white noise, 200ms',
    'Long Snare — white noise, 350ms tail',
    'Tight Snare — white noise, 150ms',
    'Electronic Snare — white noise, 200ms',
    'Brush Snare — pink noise, 200ms',
    'Snappy Snare — white noise, 220ms',
  ],
  Claps: [
    'Modern Clap — pink noise, 120ms',
    'Layered Clap — pink noise, 150ms',
    'Short Clap — pink noise, 60ms snap',
    'Reverb Clap — pink noise, 200ms long',
    'Tight Clap — pink noise, 80ms',
  ],
  'Hi-hats': [
    'Closed HH — metal tick, 50ms, 400Hz',
    'Tight HH — metal tick, 30ms, 500Hz',
    'Open HH — metal ring, 350ms, 400Hz',
    'Short Open HH — metal, 180ms, 450Hz',
    'Pedal HH — metal, 80ms, 380Hz',
    'Roll HH — metal, 50ms rapid, 400Hz',
    'Shuffle HH — metal, 70ms, 420Hz',
  ],
  Percs: [
    'Floor Tom — membrane G2, 300ms',
    'Rim Shot — membrane C3, 80ms snap',
    'Cowbell — metal ring, 80ms, 800Hz',
    'Clave — metal click, 120ms, 800Hz',
    'Shaker — membrane E3, 150ms',
    'Tambourine — membrane B2, 100ms',
  ],
  '808s': [
    '808 Sub C — membrane C1, 700ms long',
    '808 Sub D — membrane D1, 700ms long',
    '808 Sub G — membrane G1, 700ms long',
    '808 Sub A — membrane A1, 700ms long',
    '808 Distorted — membrane C1, 700ms',
    '808 Long — membrane C1, 1.2s decay',
    '808 Short — membrane C1, 300ms tight',
  ],
  Synths: [
    'Sawtooth Stab — C4, short attack',
    'Warm Triangle Pad — C4-E4-G4 chord, slow attack',
    'Detuned Sawtooth Lead — A4, sustained',
    'Square Bass — C2 analog low-end',
    'Supersaw Chord — C4-E4-G4-B4 stack',
    'Plucked String — G3 karplus-strong',
    'Arpeggio — C4-E4-G4-C5 16th notes',
  ],
  FX: [
    'White Noise Riser — 300ms attack swell',
    'Deep Impact — C0 membrane sub hit',
    'Downlifter — pink noise 600ms fade',
    'Filter Sweep — brown noise 500ms',
    'Noise Layer — brown noise sustained',
    'Transition Fill — white noise burst',
    'Vinyl Crackle — pink noise micro-hits',
  ],
  Vocals: [
    'Sine Vox Chop — A4, 8th note',
    'Sine Vox Sustain — G4, quarter note',
    'Sine Vox Stab — C5, 8th note',
    'Sine Vox Hold — E4, quarter note',
    'Sine Vox Breath — D4, half note',
  ],
  Loops: [
    'House Drum Loop — C3 membrane arp 140bpm',
    'Melodic Arp — C3-E3-G3-C4 triangle',
    'Trap Bass Loop — C2-D2-F2-G2',
    'Melody Hook — E4-G4-A4-B4',
    'Perc Loop — D3-F3-A3-D4',
    'Full Pattern — C3-E3-G3-B3-C4',
  ],
  Leads: [
    'Supersaw — 7-voice detuned saw, heavy chorus',
    'Acid Lead — resonant filter sweep, 303 style',
    'FM Bell — sine FM, metallic attack, reverb tail',
    'Reese Screech — distorted saw, aggressive filter',
    'Pluck — fast attack triangle, reverb',
    'Distorted Square — square + overdrive',
  ],
  Basses: [
    'Reese Bass — detuned saws, chorus, sub weight',
    'FM Bass — sine FM, punchy, sub emphasis',
    'Distorted Bass — square + hard drive, thick',
    'Sub Bass — pure sine, two octaves down',
    'Wobble Bass — LFO filter modulation, dubstep',
    'Portamento Bass — slow-attack glide feel',
  ],
  Pads: [
    'Choir Pad — formant saw, chorus, long reverb',
    'Lush Pad — detuned saw, heavy chorus and verb',
    'Dark Pad — minor sine, long attack, dark verb',
    'String Pad — tremolo saw, warm mid-high reverb',
  ],
  'FX Presets': [
    'Vocal Chop — bandpass sine, staccato, pitched',
    'Riser Synth — LFO filter sweep upward, verb',
    'Drop Bass — sub sine pitch drop, impact',
    'Impact Hit — sub + distortion, one-shot',
  ],
};

const CATEGORY_COLORS: Record<string, string> = {
  Kicks: '#ff6b6b',
  Snares: '#ffa500',
  Claps: '#ffdd00',
  'Hi-hats': '#00d4ff',
  Percs: '#9945ff',
  '808s': '#ff2d78',
  Synths: '#00ff88',
  FX: '#ff9500',
  Vocals: '#ff69b4',
  Loops: '#00d4ff',
  Leads: '#ff44ff',
  Basses: '#ff6600',
  Pads: '#44ddff',
  'FX Presets': '#ffaa00',
  'My Samples': '#aaffcc',
};

// ─── Mini waveform SVG ────────────────────────────────────────────────────────

function MiniWaveform({ color, seed }: { color: string; seed: number }) {
  const bars = Array.from({ length: 20 }, (_, i) => {
    const h = 4 + Math.abs(Math.sin((i + seed) * 2.7)) * 16;
    return h;
  });
  return (
    <svg width={48} height={20} viewBox="0 0 48 20" style={{ opacity: 0.7 }}>
      {bars.map((h, i) => (
        <rect key={i} x={i * 2.4} y={(20 - h) / 2} width={1.8} height={h} rx={0.5} fill={color} />
      ))}
    </svg>
  );
}

// ─── SampleBrowser ────────────────────────────────────────────────────────────

interface SampleBrowserProps {
  onClose?: () => void;
}

export function SampleBrowser({ onClose }: SampleBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState('Kicks');
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [hoveredSample, setHoveredSample] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [importedSamples, setImportedSamples] = useState<File[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [_playingUrl, setPlayingUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedTrackId = useProjectStore(s => s.selectedTrackId);
  const updateSynthSettings = useProjectStore(s => s.updateSynthSettings);

  const isPresetCategory = ['Leads', 'Basses', 'Pads', 'FX Presets'].includes(selectedCategory);

  const handlePresetClick = useCallback((sampleName: string) => {
    const presetName = sampleName.split(' — ')[0];
    const preset = SYNTH_PRESETS[presetName];
    if (preset && selectedTrackId) {
      updateSynthSettings(selectedTrackId, preset);
    }
  }, [selectedTrackId, updateSynthSettings]);

  const allCategories = useMemo(() => {
    const cats = Object.keys(BUILTIN_SAMPLES);
    if (importedSamples.length > 0) return [...cats, 'My Samples'];
    return cats;
  }, [importedSamples.length]);

  const filteredSamples = useMemo((): SampleEntry[] => {
    if (selectedCategory === 'My Samples') {
      const entries = importedSamples.map(f => ({ name: f.name, file: f, isImported: true }));
      if (!searchQuery.trim()) return entries;
      return entries.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    const names = BUILTIN_SAMPLES[selectedCategory] ?? [];
    const filtered = searchQuery.trim()
      ? names.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      : names;
    return filtered.map(name => ({ name }));
  }, [selectedCategory, searchQuery, importedSamples]);

  const categoryColor = CATEGORY_COLORS[selectedCategory] ?? '#9945ff';

  // Handle file import from input
  const handleFileInput = useCallback((files: FileList | null) => {
    if (!files) return;
    const audioFiles = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aif|aiff)$/i.test(f.name)
    );
    if (audioFiles.length === 0) return;
    setImportedSamples(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...audioFiles.filter(f => !names.has(f.name))];
    });
    setSelectedCategory('My Samples');
  }, []);

  // Global drop zone — accept files dropped anywhere on browser
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    handleFileInput(e.dataTransfer.files);
  }, [handleFileInput]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only show overlay if dragging a file from OS (not a sample row)
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  // Preview audio — real file for imports, synthesized sound for built-ins
  const previewSample = useCallback((sample: SampleEntry, sampleIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    audioEngine.start().then(() => {
      if (sample.file) {
        const url = URL.createObjectURL(sample.file);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
          setPlayingUrl(url);
        }
      } else {
        // Each sample index maps to a distinct sound variant
        audioEngine.previewDrumSound(selectedCategory, sampleIdx);
      }
    });
  }, [selectedCategory]);

  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#12121a',
        borderRight: '1px solid #2a2a3a',
        overflow: 'hidden',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Drop overlay */}
      {isDraggingOver && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: '#9945ff22',
          border: '2px dashed #9945ff',
          borderRadius: 4,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 32 }}>🎵</div>
          <div style={{ color: '#9945ff', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
            Drop audio files here
          </div>
          <div style={{ color: '#9945ff88', fontSize: 10, fontFamily: 'monospace' }}>
            .wav .mp3 .ogg .flac .aif
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.wav,.mp3,.ogg,.flac,.aif,.aiff"
        style={{ display: 'none' }}
        onChange={e => handleFileInput(e.target.files)}
      />

      {/* Header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid #2a2a3a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill={categoryColor}>
            <path d="M2 2h4v4H2V2zm6 0h4v4H8V2zM2 8h4v4H2V8zm6 3a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/>
          </svg>
          <span style={{ color: '#e8e8f0', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            SAMPLES
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}
          >×</button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', flexShrink: 0, borderBottom: '1px solid #1e1e28' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#0a0a14', border: '1px solid #2a2a3a',
          borderRadius: 4, padding: '4px 8px', gap: 6,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="4" cy="4" r="3" stroke="#555" strokeWidth="1.5"/>
            <line x1="6.5" y1="6.5" x2="9" y2="9" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search samples..."
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: '#e8e8f0', fontSize: 11, flex: 1, fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Import bar */}
      <div style={{
        padding: '6px 10px', flexShrink: 0,
        borderBottom: '1px solid #1e1e28', display: 'flex', gap: 4, alignItems: 'center',
      }}>
        <div style={{
          flex: 1, background: '#1a1a24', border: '1px solid #2a2a3a',
          borderRadius: 3, padding: '3px 8px', color: '#888', fontSize: 10,
        }}>
          {importedSamples.length > 0
            ? `${importedSamples.length} imported file${importedSamples.length > 1 ? 's' : ''}`
            : 'Synthesized Sounds (Tone.js)'}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#9945ff22', border: '1px solid #9945ff55',
            borderRadius: 3, color: '#9945ff', fontSize: 10,
            padding: '3px 8px', cursor: 'pointer', fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#9945ff44'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#9945ff22'; }}
        >
          + Import
        </button>
      </div>

      {/* Drop hint when empty */}
      {importedSamples.length === 0 && (
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid #1e1e28',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <div style={{
            flex: 1, border: '1px dashed #2a2a3a', borderRadius: 4,
            padding: '5px 8px', textAlign: 'center',
            color: '#444', fontSize: 9, fontFamily: 'monospace',
          }}>
            Drag .wav / .mp3 files from Finder to import
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 1,
        padding: '6px 6px', flexShrink: 0, borderBottom: '1px solid #1e1e28',
        overflowY: 'auto', maxHeight: 200,
      }}>
        {allCategories.map(cat => {
          const color = CATEGORY_COLORS[cat] ?? '#9945ff';
          const isActive = cat === selectedCategory;
          const count = cat === 'My Samples'
            ? importedSamples.length
            : (BUILTIN_SAMPLES[cat]?.length ?? 0);
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', borderRadius: 4, border: 'none',
                background: isActive ? `${color}22` : 'transparent',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: isActive ? color : '#333', flexShrink: 0,
              }} />
              <span style={{ color: isActive ? color : '#888', fontSize: 11, fontWeight: isActive ? 700 : 400, flex: 1 }}>
                {cat}
              </span>
              <span style={{ color: '#444', fontSize: 10 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Sample list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        {filteredSamples.length === 0 ? (
          <div style={{ color: '#444', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
            {selectedCategory === 'My Samples' ? 'No imported samples' : 'No samples found'}
          </div>
        ) : (
          filteredSamples.map((sample, idx: number) => {
            const isSelected = selectedSample === sample.name;
            const isHovered = hoveredSample === sample.name;
            return (
              <div
                key={sample.name + idx}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-daw-sample', JSON.stringify({
                    name: sample.name,
                    category: selectedCategory,
                    isImported: sample.isImported ?? false,
                  }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  setSelectedSample(isSelected ? null : sample.name);
                  if (isPresetCategory) handlePresetClick(sample.name);
                }}
                onMouseEnter={() => setHoveredSample(sample.name)}
                onMouseLeave={() => setHoveredSample(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 8px', borderRadius: 4, cursor: 'grab',
                  background: isSelected ? `${categoryColor}22` : isHovered ? '#1e1e28' : 'transparent',
                  border: `1px solid ${isSelected ? `${categoryColor}55` : 'transparent'}`,
                  marginBottom: 1, userSelect: 'none',
                }}
              >
                <div style={{ color: '#444', fontSize: 10, flexShrink: 0 }}>⠿</div>
                <div style={{ flexShrink: 0 }}>
                  <MiniWaveform color={categoryColor} seed={idx * 3 + 7} />
                </div>
                <span style={{
                  color: isSelected ? categoryColor : '#ccc', fontSize: 10,
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {sample.isImported
                    ? sample.name.replace(/\.[^.]+$/, '')
                    : sample.name}
                </span>
                {(isHovered || isSelected) && (
                  <button
                    onClick={e => previewSample(sample, idx, e)}
                    style={{
                      background: `${categoryColor}33`,
                      border: `1px solid ${categoryColor}66`,
                      borderRadius: 3, color: categoryColor,
                      fontSize: 9, padding: '2px 5px', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={sample.file ? 'Play preview' : 'Play synthesized preview'}
                  >
                    ▶
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '6px 8px', borderTop: '1px solid #1e1e28',
        flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 4,
      }}>
        {['EDM•DAW', selectedCategory, `${filteredSamples.length} items`].map(tag => (
          <span key={tag} style={{
            background: '#1a1a24', border: '1px solid #2a2a3a',
            borderRadius: 3, color: '#666', fontSize: 9, padding: '2px 5px',
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
