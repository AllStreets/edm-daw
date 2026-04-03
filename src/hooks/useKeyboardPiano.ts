import { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { audioEngine } from '../engine/AudioEngine';

// Key → semitone offset within octave (C=0)
const WHITE_KEY_MAP: Record<string, number> = {
  a: 0,  // C
  s: 2,  // D
  d: 4,  // E
  f: 5,  // F
  g: 7,  // G
  h: 9,  // A
  j: 11, // B
  k: 12, // C+1
};

const BLACK_KEY_MAP: Record<string, number> = {
  w: 1,  // C#
  e: 3,  // D#
  t: 6,  // F#
  y: 8,  // G#
  u: 10, // A#
};

const ALL_PIANO_KEYS = new Set([
  ...Object.keys(WHITE_KEY_MAP),
  ...Object.keys(BLACK_KEY_MAP),
  'z', 'x',
]);

function keyToMidi(key: string, octave: number): number | null {
  const semitone = WHITE_KEY_MAP[key] ?? BLACK_KEY_MAP[key];
  if (semitone === undefined) return null;
  return (octave + 1) * 12 + semitone; // MIDI: C4 = 60, octave 4 → (4+1)*12=60
}

export function useKeyboardPiano(selectedTrackId: string | null) {
  const [octave, setOctave] = useState(4);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const activeNotesRef = useRef<Map<string, number>>(new Map()); // key → midi note

  const isInputFocused = useCallback(() => {
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isInputFocused()) return;
      if (!selectedTrackId) return;
      if (!ALL_PIANO_KEYS.has(e.key.toLowerCase())) return;

      const key = e.key.toLowerCase();

      if (key === 'z') {
        setOctave(o => Math.max(0, o - 1));
        return;
      }
      if (key === 'x') {
        setOctave(o => Math.min(8, o + 1));
        return;
      }

      // Use functional update to read current octave
      setOctave(currentOctave => {
        const midi = keyToMidi(key, currentOctave);
        if (midi !== null && !activeNotesRef.current.has(key)) {
          activeNotesRef.current.set(key, midi);
          setActiveKeys(prev => new Set([...prev, key]));
          const synth = audioEngine.getSynth(selectedTrackId);
          if (synth) {
            try {
              const noteName = Tone.Frequency(midi, 'midi').toNote();
              synth.triggerAttack(noteName, undefined, 0.8);
            } catch { /* ignore */ }
          }
        }
        return currentOctave;
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (!selectedTrackId) return;
      const key = e.key.toLowerCase();
      const midi = activeNotesRef.current.get(key);
      if (midi !== undefined) {
        activeNotesRef.current.delete(key);
        setActiveKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
        const synth = audioEngine.getSynth(selectedTrackId);
        if (synth) {
          try {
            const noteName = Tone.Frequency(midi, 'midi').toNote();
            synth.triggerRelease(noteName);
          } catch { /* ignore */ }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selectedTrackId, isInputFocused]);

  return { octave, activeKeys };
}
