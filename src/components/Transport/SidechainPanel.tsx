import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export const SidechainPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    project, sidechainEnabled, sidechainAmount, sidechainRelease,
    sidechainSourceTrackId, sidechainTargetOverrides,
    setSidechainEnabled, setSidechainAmount, setSidechainRelease,
    setSidechainSource, toggleSidechainTarget,
  } = useProjectStore();

  return (
    <div style={{
      position: 'fixed', top: 60, right: 16, width: 240, zIndex: 1000,
      background: 'linear-gradient(180deg, #1a1a30 0%, #12121e 100%)',
      border: '1px solid #9945ff44', borderRadius: 8,
      boxShadow: '0 8px 32px #00000099', padding: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: '#9945ff', fontWeight: 700, letterSpacing: 2 }}>SIDECHAIN</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      {/* Global toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
        <div onClick={() => setSidechainEnabled(!sidechainEnabled)} style={{
          width: 32, height: 16, borderRadius: 8,
          background: sidechainEnabled ? '#9945ff' : '#2a2a4a',
          position: 'relative', cursor: 'pointer',
        }}>
          <div style={{
            position: 'absolute', top: 2, left: sidechainEnabled ? 16 : 2,
            width: 12, height: 12, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s',
          }} />
        </div>
        <span style={{ fontSize: 11, color: '#aaa' }}>Enabled</span>
      </label>

      {/* Amount */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: '#666', letterSpacing: 1 }}>AMOUNT</span>
          <span style={{ fontSize: 9, color: '#9945ff' }}>{Math.round(sidechainAmount * 100)}%</span>
        </div>
        <input type="range" min={0} max={100}
          value={Math.round(sidechainAmount * 100)}
          onChange={e => setSidechainAmount(Number(e.target.value) / 100)}
          style={{ width: '100%', accentColor: '#9945ff' }}
        />
      </div>

      {/* Release */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontSize: 9, color: '#666', letterSpacing: 1 }}>RELEASE</span>
          <span style={{ fontSize: 9, color: '#9945ff' }}>{sidechainRelease}ms</span>
        </div>
        <input type="range" min={50} max={500}
          value={sidechainRelease}
          onChange={e => setSidechainRelease(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#9945ff' }}
        />
      </div>

      {/* Source track */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 9, color: '#666', letterSpacing: 1, display: 'block', marginBottom: 4 }}>SOURCE TRACK</span>
        <select
          value={sidechainSourceTrackId ?? ''}
          onChange={e => setSidechainSource(e.target.value || null)}
          style={{ width: '100%', background: '#0f0f1a', border: '1px solid #2a2a4a', borderRadius: 4, color: '#aaa', fontSize: 11, padding: '3px 6px' }}
        >
          <option value="">Auto (first drum track)</option>
          {project.tracks.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Target tracks */}
      <div>
        <span style={{ fontSize: 9, color: '#666', letterSpacing: 1, display: 'block', marginBottom: 6 }}>DUCK THESE TRACKS</span>
        {project.tracks.filter(t => t.type !== 'drum').map(t => {
          const included = sidechainTargetOverrides[t.id] !== false;
          return (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={included} onChange={() => toggleSidechainTarget(t.id)} style={{ accentColor: '#9945ff' }} />
              <span style={{ fontSize: 11, color: '#aaa' }}>{t.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
