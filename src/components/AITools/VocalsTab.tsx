import React from 'react';
import { useAIStore } from '../../store/useAIStore';

export const VocalsTab: React.FC = () => {
  const { generatedLyrics, setLyrics } = useAIStore();

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 10, color: '#9945ff', letterSpacing: 2, fontWeight: 700 }}>VOCALS</div>

      <div>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 6, letterSpacing: 1 }}>LYRICS</div>
        <textarea
          value={generatedLyrics || 'Generate a song first to get lyrics.'}
          onChange={e => setLyrics(e.target.value)}
          disabled={!generatedLyrics}
          style={{
            width: '100%', height: 200, background: '#0a0a18',
            border: '1px solid #2a2a4a', borderRadius: 6,
            color: generatedLyrics ? '#ccc' : '#444',
            fontSize: 11, fontFamily: 'monospace',
            padding: 10, resize: 'vertical', lineHeight: 1.6,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          disabled={!generatedLyrics}
          style={{
            flex: 1, padding: '8px 0',
            background: generatedLyrics ? '#9945ff33' : '#1a1a2e',
            border: `1px solid ${generatedLyrics ? '#9945ff66' : '#2a2a4a'}`,
            borderRadius: 6, color: generatedLyrics ? '#9945ff' : '#444',
            fontSize: 11, fontWeight: 700, cursor: generatedLyrics ? 'pointer' : 'not-allowed',
          }}
        >
          Render Vocals
        </button>
        <button
          disabled
          title="Coming soon — AI singing synthesis"
          style={{
            flex: 1, padding: '8px 0',
            background: '#1a1a2e', border: '1px solid #2a2a4a',
            borderRadius: 6, color: '#333', fontSize: 11, cursor: 'not-allowed',
          }}
        >
          Use AI Singing ✦
        </button>
      </div>

      <div style={{ fontSize: 9, color: '#333', fontStyle: 'italic' }}>
        ✦ AI singing synthesis coming in a future update
      </div>
    </div>
  );
};
