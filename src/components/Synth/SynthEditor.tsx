import React, { useState, useCallback, useEffect } from 'react';
import type {
  SynthSettings,
  SubOscSettings,
  SubOscType,
} from '../../types';
import { useProjectStore } from '../../store/useProjectStore';
import { SYNTH_PRESETS, PRESET_NAMES } from '../../data/presets';
import { Knob } from './Knob';
import { OscillatorSection } from './OscillatorSection';
import { FilterSection } from './FilterSection';
import { EnvelopeSection } from './EnvelopeSection';
import { LFOSection } from './LFOSection';
import { UnisonSection } from './UnisonSection';
import { SynthFXSection } from './SynthFXSection';

interface SynthEditorProps {
  trackId: string;
  onClose: () => void;
}

// ─── Sub Oscillator mini panel ────────────────────────────────────────────────

function SubOscPanel({
  settings,
  onChange,
}: {
  settings: SubOscSettings;
  onChange: (s: SubOscSettings) => void;
}) {
  const set = (p: Partial<SubOscSettings>) => onChange({ ...settings, ...p });
  const COLOR = '#aa44ff';

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-lg h-full"
      style={{
        background: 'linear-gradient(135deg, #0d0a18 0%, #110d1e 100%)',
        border: `1px solid ${settings.on ? COLOR + '44' : '#222235'}`,
        boxShadow: settings.on ? `0 0 10px ${COLOR}22` : 'none',
        transition: 'all 0.2s',
      }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: COLOR, textTransform: 'uppercase' }}>
          SUB
        </span>
        <button
          onClick={() => set({ on: !settings.on })}
          style={{
            width: 32, height: 16, borderRadius: 8,
            background: settings.on ? `linear-gradient(90deg, ${COLOR}cc, ${COLOR}88)` : '#1a1a2e',
            border: `1px solid ${settings.on ? COLOR : '#333355'}`,
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.15s',
            boxShadow: settings.on ? `0 0 8px ${COLOR}88` : 'none',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 2, left: settings.on ? 17 : 2,
            width: 10, height: 10, borderRadius: '50%',
            background: settings.on ? '#fff' : '#555577',
            transition: 'left 0.15s',
          }} />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1">
        {(['sine', 'square'] as SubOscType[]).map(t => (
          <button
            key={t}
            onClick={() => set({ type: t })}
            style={{
              flex: 1,
              padding: '4px 4px',
              borderRadius: 5,
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 0.5,
              background: settings.type === t ? `${COLOR}33` : '#0d0d1c',
              border: `1px solid ${settings.type === t ? COLOR : '#222235'}`,
              color: settings.type === t ? COLOR : '#505070',
              cursor: 'pointer',
              transition: 'all 0.12s',
              textTransform: 'uppercase',
            }}
          >
            {t === 'sine' ? (
              <svg width="100%" height="14" viewBox="0 0 36 14">
                <path d="M2,7 C4,7 6,2 9,2 C12,2 14,12 17,12 C20,12 22,2 25,2 C28,2 30,7 34,7"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="100%" height="14" viewBox="0 0 36 14">
                <polyline points="2,12 2,3 13,3 13,12 13,3 24,3 24,12 24,3 34,3 34,12"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="miter" />
              </svg>
            )}
            <div style={{ fontSize: 7, marginTop: 2 }}>{t.toUpperCase()}</div>
          </button>
        ))}
      </div>

      {/* Octave */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: 8, color: '#606080', width: 24, textTransform: 'uppercase' }}>OCT</span>
        <div className="flex gap-0.5 flex-1">
          {[-2, -1, 0].map(oct => (
            <button
              key={oct}
              onClick={() => set({ octave: oct })}
              style={{
                flex: 1, height: 20, borderRadius: 3, fontSize: 9, fontWeight: 600,
                background: settings.octave === oct ? `${COLOR}55` : '#0d0d1c',
                border: `1px solid ${settings.octave === oct ? COLOR : '#222235'}`,
                color: settings.octave === oct ? COLOR : '#505070',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {oct}
            </button>
          ))}
        </div>
      </div>

      <Knob
        value={settings.volume}
        min={0}
        max={1}
        onChange={v => set({ volume: v })}
        label="VOL"
        size={36}
        color={COLOR}
      />
    </div>
  );
}

// ─── Mod Matrix mini panel ───────────────────────────────────────────────────

function ModMatrixPanel({ settings }: { settings: SynthSettings; onChange?: (s: SynthSettings) => void }) {
  const rows = [
    { source: 'LFO', target: 'Filter', amount: settings.lfo.amount * (settings.lfo.target === 'filter' ? 1 : 0), color: '#ff9500' },
    { source: 'LFO', target: 'Pitch', amount: settings.lfo.amount * (settings.lfo.target === 'pitch' ? 1 : 0), color: '#ff9500' },
    { source: 'Env2', target: 'Filter', amount: Math.abs(settings.filter.envAmount), color: '#00d4ff' },
    { source: 'Vel', target: 'Amp', amount: 0.7, color: '#00ff88' },
  ];

  return (
    <div
      className="flex flex-col gap-1.5 p-3 rounded-lg"
      style={{
        background: 'linear-gradient(135deg, #090912 0%, #0c0c16 100%)',
        border: '1px solid #1e1e30',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#6060a0', textTransform: 'uppercase' }}>
        Mod Matrix
      </span>
      <div className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span style={{ fontSize: 8, color: row.color, width: 28, textAlign: 'right', letterSpacing: 0.3 }}>
              {row.source}
            </span>
            <svg width="12" height="8" viewBox="0 0 12 8">
              <path d="M0,4 L8,4 M6,2 L10,4 L6,6" fill="none" stroke="#404060" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 8, color: '#8080a0', width: 30, letterSpacing: 0.3 }}>
              {row.target}
            </span>
            <div style={{ flex: 1, height: 4, background: '#0d0d1c', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${row.amount * 100}%`,
                  background: `linear-gradient(90deg, ${row.color}88, ${row.color})`,
                  borderRadius: 2,
                  boxShadow: `0 0 4px ${row.color}88`,
                  transition: 'width 0.2s',
                }}
              />
            </div>
            <span style={{ fontSize: 7, color: '#505070', width: 20, textAlign: 'right' }}>
              {(row.amount * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Preset Browser ──────────────────────────────────────────────────────────

function PresetBrowser({
  currentPreset,
  onSelect,
}: {
  currentPreset: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = PRESET_NAMES.filter(n =>
    n.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '4px 12px',
          borderRadius: 4,
          background: open ? '#9945ff22' : '#0d0d1c',
          border: '1px solid #9945ff44',
          color: '#c0a0ff',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.12s',
          letterSpacing: 0.3,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="4" height="4" rx="1" fill="#9945ff" opacity="0.8" />
          <rect x="7" y="1" width="4" height="4" rx="1" fill="#9945ff" opacity="0.5" />
          <rect x="1" y="7" width="4" height="4" rx="1" fill="#9945ff" opacity="0.5" />
          <rect x="7" y="7" width="4" height="4" rx="1" fill="#9945ff" opacity="0.3" />
        </svg>
        {currentPreset}
        <svg width="8" height="8" viewBox="0 0 8 8" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}>
          <path d="M1,2 L4,6 L7,2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            width: 200,
            background: '#0d0d1e',
            border: '1px solid #9945ff44',
            borderRadius: 6,
            boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px #9945ff22',
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #1a1a2e' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search presets..."
              style={{
                width: '100%',
                background: '#07070f',
                border: '1px solid #2a2a3e',
                borderRadius: 3,
                color: '#c0c0e0',
                fontSize: 10,
                padding: '3px 6px',
                outline: 'none',
              }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(name => (
              <button
                key={name}
                onClick={() => { onSelect(name); setOpen(false); setSearch(''); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  background: name === currentPreset ? '#9945ff22' : 'transparent',
                  border: 'none',
                  color: name === currentPreset ? '#c0a0ff' : '#8080a0',
                  fontSize: 10,
                  cursor: 'pointer',
                  borderLeft: `2px solid ${name === currentPreset ? '#9945ff' : 'transparent'}`,
                  transition: 'all 0.1s',
                  letterSpacing: 0.2,
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#9945ff11'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = name === currentPreset ? '#9945ff22' : 'transparent'; }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div style={{ width: 3, height: 14, borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 8, fontWeight: 700, color: `${color}99`, letterSpacing: 2, textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}22, transparent)` }} />
    </div>
  );
}

// ─── Main SynthEditor ────────────────────────────────────────────────────────

export const SynthEditor: React.FC<SynthEditorProps> = ({ trackId, onClose }) => {
  const project = useProjectStore(s => s.project);
  const updateSynthSettings = useProjectStore(s => s.updateSynthSettings);

  const track = project.tracks.find(t => t.id === trackId);
  const settings: SynthSettings = track?.synthSettings ?? SYNTH_PRESETS['Init'];

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const update = useCallback(
    (partial: Partial<SynthSettings>) => {
      updateSynthSettings(trackId, { ...settings, ...partial });
    },
    [settings, trackId, updateSynthSettings]
  );

  const loadPreset = useCallback(
    (name: string) => {
      const preset = SYNTH_PRESETS[name];
      if (preset) {
        updateSynthSettings(trackId, { ...preset, preset: name });
      }
    },
    [trackId, updateSynthSettings]
  );

  const prevPreset = useCallback(() => {
    const idx = PRESET_NAMES.indexOf(settings.preset);
    const prev = PRESET_NAMES[(idx - 1 + PRESET_NAMES.length) % PRESET_NAMES.length];
    loadPreset(prev);
  }, [settings.preset, loadPreset]);

  const nextPreset = useCallback(() => {
    const idx = PRESET_NAMES.indexOf(settings.preset);
    const next = PRESET_NAMES[(idx + 1) % PRESET_NAMES.length];
    loadPreset(next);
  }, [settings.preset, loadPreset]);

  const handleAIPrompt = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    // Simulate AI response — pick a preset based on keywords
    await new Promise(r => setTimeout(r, 600));
    const lower = aiPrompt.toLowerCase();
    let match = 'Init';
    if (lower.includes('bass') && lower.includes('dub')) match = 'Dubstep Bass';
    else if (lower.includes('sub') || lower.includes('808')) match = lower.includes('808') ? 'Trap 808' : 'Sub Bass';
    else if (lower.includes('pad') || lower.includes('atmo')) match = 'Pad Atmospheric';
    else if (lower.includes('lead') || lower.includes('super')) match = 'Supersaw Lead';
    else if (lower.includes('future') || lower.includes('chord')) match = 'Future Bass Chord';
    else if (lower.includes('pluck')) match = 'Pluck Lead';
    else if (lower.includes('reese')) match = 'Reese Bass';
    else if (lower.includes('psy')) match = 'Psy Lead';
    else if (lower.includes('stab')) match = 'Bass Stab';
    else if (lower.includes('bass')) match = 'Reese Bass';
    loadPreset(match);
    setAiPrompt('');
    setAiLoading(false);
  }, [aiPrompt, loadPreset]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 920,
          maxWidth: '98vw',
          maxHeight: '96vh',
          overflowY: 'auto',
          background: 'linear-gradient(160deg, #080810 0%, #0b0b18 50%, #080810 100%)',
          border: '1px solid #1e1e38',
          borderRadius: 12,
          boxShadow: '0 0 60px rgba(153,69,255,0.2), 0 0 120px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #1a1a2e',
            background: 'linear-gradient(90deg, #0d0d1e 0%, #110d20 50%, #0d0d1e 100%)',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Logo / Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg, #9945ff, #00d4ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px #9945ff66',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path d="M2,12 L7,2 L12,12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="7" cy="7" r="2" fill="white" opacity="0.6" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#c0a0ff', letterSpacing: 1 }}>
                {track?.name ?? 'Synth'}
              </div>
              <div style={{ fontSize: 7, color: '#5050a0', letterSpacing: 0.5 }}>SYNTHESIZER</div>
            </div>
          </div>

          {/* Preset nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={prevPreset} style={{
              width: 22, height: 22, borderRadius: 4, background: '#0d0d1c',
              border: '1px solid #2a2a3e', color: '#9090c0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, transition: 'all 0.1s',
            }}>‹</button>

            <PresetBrowser currentPreset={settings.preset} onSelect={loadPreset} />

            <button onClick={nextPreset} style={{
              width: 22, height: 22, borderRadius: 4, background: '#0d0d1c',
              border: '1px solid #2a2a3e', color: '#9090c0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, transition: 'all 0.1s',
            }}>›</button>
          </div>

          {/* AI Prompt */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 200 }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 4,
              background: '#07070f',
              border: '1px solid #2a2a3e',
              borderRadius: 5,
              padding: '3px 8px',
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <circle cx="5" cy="5" r="4" fill="none" stroke="#505090" strokeWidth="1" />
                <path d="M3,5 L5,3 L7,5 L5,7 Z" fill="#505090" />
              </svg>
              <input
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAIPrompt(); }}
                placeholder="Describe your sound..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#c0c0e0',
                  fontSize: 10,
                  outline: 'none',
                }}
              />
            </div>
            <button
              onClick={handleAIPrompt}
              disabled={aiLoading || !aiPrompt.trim()}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                background: aiLoading ? '#1a1a2e' : 'linear-gradient(135deg, #9945ff, #7733cc)',
                border: '1px solid #9945ff66',
                color: '#fff',
                fontSize: 12,
                cursor: aiLoading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                boxShadow: aiLoading ? 'none' : '0 0 10px #9945ff44',
                transition: 'all 0.2s',
              }}
              title="Generate with AI"
            >
              {aiLoading ? (
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="6" cy="6" r="4" fill="none" stroke="#9945ff" strokeWidth="2" strokeDasharray="12 4" />
                </svg>
              ) : '⚡'}
            </button>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: '#1a1a2e',
              border: '1px solid #2a2a3e',
              color: '#7070a0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ff444422'; (e.currentTarget as HTMLButtonElement).style.color = '#ff7777'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1a2e'; (e.currentTarget as HTMLButtonElement).style.color = '#7070a0'; }}
          >
            ×
          </button>
        </div>

        {/* ── BODY ────────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ROW 1: OSC1 | OSC2 | SUB */}
          <div>
            <SectionLabel label="Oscillators" color="#9945ff" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <OscillatorSection
                settings={settings.oscillator1}
                label="OSC 1"
                onChange={oscillator1 => update({ oscillator1 })}
              />
              <OscillatorSection
                settings={settings.oscillator2}
                label="OSC 2"
                onChange={oscillator2 => update({ oscillator2 })}
              />
              <div style={{ width: 140 }}>
                <SubOscPanel
                  settings={settings.sub}
                  onChange={sub => update({ sub })}
                />
              </div>
            </div>
          </div>

          {/* ROW 2: FILTER | AMP ENV | FILTER ENV */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
            <div>
              <SectionLabel label="Filter" color="#00d4ff" />
              <FilterSection
                settings={settings.filter}
                onChange={filter => update({ filter })}
              />
            </div>
            <div>
              <SectionLabel label="Amp Envelope" color="#00ff88" />
              <EnvelopeSection
                settings={settings.ampEnv}
                label="AMP ENV"
                onChange={ampEnv => update({ ampEnv })}
                color="#00ff88"
              />
            </div>
            <div>
              <SectionLabel label="Filter Envelope" color="#00d4ff" />
              <EnvelopeSection
                settings={settings.filterEnv}
                label="FILTER ENV"
                onChange={filterEnv => update({ filterEnv })}
                color="#00d4ff"
              />
            </div>
          </div>

          {/* ROW 3: LFO | UNISON | MOD MATRIX */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <SectionLabel label="LFO" color="#ff9500" />
              <LFOSection
                settings={settings.lfo}
                onChange={lfo => update({ lfo })}
              />
            </div>
            <div>
              <SectionLabel label="Unison" color="#ff4488" />
              <UnisonSection
                settings={settings.unison}
                onChange={unison => update({ unison })}
              />
            </div>
            <div>
              <SectionLabel label="Modulation" color="#6060a0" />
              <ModMatrixPanel settings={settings} onChange={s => updateSynthSettings(trackId, s)} />
            </div>
          </div>

          {/* ROW 4: FX */}
          <div>
            <SectionLabel label="Effects" color="#ff4444" />
            <SynthFXSection
              settings={settings.effects}
              onChange={effects => update({ effects })}
            />
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <div style={{
          padding: '6px 16px',
          borderTop: '1px solid #1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '0 0 12px 12px',
          background: '#07070f',
        }}>
          <span style={{ fontSize: 8, color: '#303050', letterSpacing: 0.5 }}>
            EDM DAW · SYNTH ENGINE · {PRESET_NAMES.length} PRESETS
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 4px #00ff88' }} />
            <span style={{ fontSize: 8, color: '#404060' }}>READY</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SynthEditor;
