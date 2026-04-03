import React, { useState } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { useProjectStore } from '../../store/useProjectStore';

export const VocalsTab: React.FC = () => {
  const { generatedLyrics, setLyrics } = useAIStore();
  const { generatedSong, addVocalTrack } = useProjectStore();
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');

  const renderVocals = async () => {
    if (!generatedLyrics || !window.speechSynthesis) {
      setError('Speech synthesis not available in this browser.');
      return;
    }
    setRendering(true);
    setError('');

    try {
      const bpm = generatedSong?.plan.bpm ?? 128;

      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(dest.stream);
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const blob: Blob = await new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'audio/webm' }));

        const utterance = new SpeechSynthesisUtterance(generatedLyrics);
        utterance.rate = Math.max(0.5, Math.min(2, bpm / 120));
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onend = () => { recorder.stop(); ctx.close(); };
        utterance.onerror = (e) => { recorder.stop(); ctx.close(); reject(new Error(e.error)); };

        recorder.start();
        window.speechSynthesis.speak(utterance);
      });

      await addVocalTrack(blob);
      setRendering(false);
    } catch (e) {
      setRendering(false);
      setError(
        'Could not capture vocal audio. Try: Chrome with microphone permission, or download lyrics and record manually.'
      );
      console.error('Vocal render error:', e);
    }
  };

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
          disabled={!generatedLyrics || rendering}
          onClick={renderVocals}
          style={{
            flex: 1, padding: '8px 0',
            background: generatedLyrics ? '#9945ff33' : '#1a1a2e',
            border: `1px solid ${generatedLyrics ? '#9945ff66' : '#2a2a4a'}`,
            borderRadius: 6, color: generatedLyrics ? '#9945ff' : '#444',
            fontSize: 11, fontWeight: 700, cursor: generatedLyrics && !rendering ? 'pointer' : 'not-allowed',
          }}
        >
          {rendering ? 'Rendering...' : 'Render Vocals'}
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

      {error && (
        <div style={{ fontSize: 10, color: '#ff5577', background: '#ff004422', border: '1px solid #ff004444', borderRadius: 6, padding: '8px 10px' }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#333', fontStyle: 'italic' }}>
        ✦ AI singing synthesis coming in a future update
      </div>
    </div>
  );
};
