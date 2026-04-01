import { useState, useMemo } from 'react';

// ─── Fake sample data ─────────────────────────────────────────────────────────

const FAKE_SAMPLES: Record<string, string[]> = {
  Kicks: [
    'Kick_Hard_01', 'Kick_Sub_Deep_01', 'Kick_Punchy_01', 'Kick_808_01',
    'Kick_Distorted_01', 'Kick_Tight_01', 'Kick_House_01', 'Kick_Trap_01',
  ],
  Snares: [
    'Snare_Crisp_01', 'Snare_Reverb_01', 'Snare_Tight_01', 'Snare_Electronic_01',
    'Snare_Brush_01', 'Snare_Clap_Combo_01',
  ],
  Claps: [
    'Clap_Modern_01', 'Clap_Layered_01', 'Clap_Short_01', 'Clap_Reverb_01',
    'Clap_Tight_01',
  ],
  'Hi-hats': [
    'HH_Closed_01', 'HH_Closed_Tight_01', 'HH_Open_Long_01', 'HH_Open_Short_01',
    'HH_Pedal_01', 'HH_Roll_01', 'HH_8th_01',
  ],
  Percs: [
    'Perc_Tom_01', 'Perc_Rim_01', 'Perc_Cowbell_01', 'Perc_Clave_01',
    'Perc_Shaker_01', 'Perc_Tambourine_01',
  ],
  '808s': [
    '808_Sub_C_01', '808_Sub_D_01', '808_Sub_G_01', '808_Sub_A_01',
    '808_Distorted_01', '808_Long_01', '808_Short_01',
  ],
  Synths: [
    'Synth_Stab_01', 'Synth_Pad_C_01', 'Synth_Lead_01', 'Synth_Bass_01',
    'Synth_Chord_01', 'Synth_Pluck_01', 'Synth_Arp_01',
  ],
  FX: [
    'FX_Riser_01', 'FX_Impact_01', 'FX_Downlifter_01', 'FX_Sweep_01',
    'FX_Noise_01', 'FX_Transition_01', 'FX_Vinyl_Crackle_01',
  ],
  Vocals: [
    'Vox_Chop_01', 'Vox_Chant_01', 'Vox_Stab_01', 'Vox_Ad_Lib_01',
    'Vox_Loop_01',
  ],
  Loops: [
    'Loop_Drum_House_140_01', 'Loop_Drum_DnB_174_01', 'Loop_Bass_Trap_01',
    'Loop_Melody_01', 'Loop_Perc_01', 'Loop_Full_01',
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
};

// ─── Mini waveform SVG ────────────────────────────────────────────────────────

function MiniWaveform({ color, seed }: { color: string; seed: number }) {
  const bars = Array.from({ length: 20 }, (_, i) => {
    const h = 4 + (Math.abs(Math.sin((i + seed) * 2.7)) * 16);
    return h;
  });
  return (
    <svg width={48} height={20} viewBox="0 0 48 20" style={{ opacity: 0.7 }}>
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 2.4}
          y={(20 - h) / 2}
          width={1.8}
          height={h}
          rx={0.5}
          fill={color}
        />
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

  const categories = Object.keys(FAKE_SAMPLES);

  const filteredSamples = useMemo(() => {
    const samples = FAKE_SAMPLES[selectedCategory] ?? [];
    if (!searchQuery.trim()) return samples;
    return samples.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [selectedCategory, searchQuery]);

  const categoryColor = CATEGORY_COLORS[selectedCategory] ?? '#9945ff';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#12121a',
        borderRight: '1px solid #2a2a3a',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
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
            style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
          >×</button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', flexShrink: 0, borderBottom: '1px solid #1e1e28' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#0a0a14',
          border: '1px solid #2a2a3a',
          borderRadius: 4,
          padding: '4px 8px',
          gap: 6,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="#555">
            <circle cx="4" cy="4" r="3" fill="none" stroke="#555" strokeWidth="1.5"/>
            <line x1="6.5" y1="6.5" x2="9" y2="9" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search samples..."
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#e8e8f0',
              fontSize: 11,
              flex: 1,
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Pack selector */}
      <div style={{
        padding: '6px 10px',
        flexShrink: 0,
        borderBottom: '1px solid #1e1e28',
        display: 'flex',
        gap: 4,
      }}>
        <div style={{
          flex: 1,
          background: '#1a1a24',
          border: '1px solid #2a2a3a',
          borderRadius: 3,
          padding: '3px 8px',
          color: '#888',
          fontSize: 10,
          cursor: 'pointer',
        }}>
          Default Pack ▾
        </div>
        <button style={{
          background: '#9945ff22',
          border: '1px solid #9945ff55',
          borderRadius: 3,
          color: '#9945ff',
          fontSize: 10,
          padding: '3px 6px',
          cursor: 'pointer',
        }}>
          + Import
        </button>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        padding: '6px 6px',
        flexShrink: 0,
        borderBottom: '1px solid #1e1e28',
      }}>
        {categories.map(cat => {
          const color = CATEGORY_COLORS[cat] ?? '#9945ff';
          const isActive = cat === selectedCategory;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                borderRadius: 4,
                border: 'none',
                background: isActive ? `${color}22` : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isActive ? color : '#333',
                flexShrink: 0,
              }} />
              <span style={{
                color: isActive ? color : '#888',
                fontSize: 11,
                fontWeight: isActive ? 700 : 400,
              }}>
                {cat}
              </span>
              <span style={{ marginLeft: 'auto', color: '#444', fontSize: 10 }}>
                {FAKE_SAMPLES[cat]?.length ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sample list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        {filteredSamples.length === 0 ? (
          <div style={{ color: '#444', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
            No samples found
          </div>
        ) : (
          filteredSamples.map((sample, idx) => {
            const isSelected = selectedSample === sample;
            const isHovered = hoveredSample === sample;
            return (
              <div
                key={sample}
                onClick={() => setSelectedSample(isSelected ? null : sample)}
                onMouseEnter={() => setHoveredSample(sample)}
                onMouseLeave={() => setHoveredSample(null)}
                draggable
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 4,
                  cursor: 'grab',
                  background: isSelected
                    ? `${categoryColor}22`
                    : isHovered
                      ? '#1e1e28'
                      : 'transparent',
                  border: `1px solid ${isSelected ? `${categoryColor}55` : 'transparent'}`,
                  marginBottom: 1,
                  userSelect: 'none',
                }}
              >
                {/* Drag handle */}
                <div style={{ color: '#333', fontSize: 10, flexShrink: 0 }}>⠿</div>

                {/* Waveform thumb */}
                <div style={{ flexShrink: 0 }}>
                  <MiniWaveform color={categoryColor} seed={idx * 3 + 7} />
                </div>

                {/* Name */}
                <span style={{
                  color: isSelected ? categoryColor : '#ccc',
                  fontSize: 10,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {sample.replace(/_/g, ' ')}
                </span>

                {/* Play button on hover */}
                {(isHovered || isSelected) && (
                  <button
                    onClick={e => { e.stopPropagation(); /* preview */ }}
                    style={{
                      background: `${categoryColor}33`,
                      border: `1px solid ${categoryColor}66`,
                      borderRadius: 3,
                      color: categoryColor,
                      fontSize: 9,
                      padding: '2px 5px',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    ▶
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer: tags */}
      <div style={{
        padding: '6px 8px',
        borderTop: '1px solid #1e1e28',
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
      }}>
        {['BPM:140', 'Key:Cm', 'EDM', selectedCategory].map(tag => (
          <span
            key={tag}
            style={{
              background: '#1a1a24',
              border: '1px solid #2a2a3a',
              borderRadius: 3,
              color: '#666',
              fontSize: 9,
              padding: '2px 5px',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
