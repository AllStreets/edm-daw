// =====================================================
// Music Theory Utilities
// =====================================================

export const NOTES: string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

export const NOTE_ALIASES: Record<string, string> = {
  'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
};

export const SCALES: Record<string, number[]> = {
  major:       [0, 2, 4, 5, 7, 9, 11],
  minor:       [0, 2, 3, 5, 7, 8, 10],
  dorian:      [0, 2, 3, 5, 7, 9, 10],
  phrygian:    [0, 1, 3, 5, 7, 8, 10],
  lydian:      [0, 2, 4, 6, 7, 9, 11],
  mixolydian:  [0, 2, 4, 5, 7, 9, 10],
  locrian:     [0, 1, 3, 5, 6, 8, 10],
  pentatonic:  [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues:       [0, 3, 5, 6, 7, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor:  [0, 2, 3, 5, 7, 9, 11],
};

export const CHORD_TYPES: Record<string, number[]> = {
  major:     [0, 4, 7],
  minor:     [0, 3, 7],
  dim:       [0, 3, 6],
  aug:       [0, 4, 8],
  maj7:      [0, 4, 7, 11],
  min7:      [0, 3, 7, 10],
  dom7:      [0, 4, 7, 10],
  dim7:      [0, 3, 6, 9],
  sus2:      [0, 2, 7],
  sus4:      [0, 5, 7],
  add9:      [0, 4, 7, 14],
  min9:      [0, 3, 7, 10, 14],
};

/**
 * Converts a MIDI note number to a note name string (e.g. 60 -> 'C4')
 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTES[noteIndex]}${octave}`;
}

/**
 * Converts a note name string to a MIDI number (e.g. 'C4' -> 60)
 */
export function noteNameToMidi(name: string): number {
  // Extract note and octave: e.g. 'C#4', 'Bb3'
  const match = name.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60; // fallback to middle C

  let notePart = match[1];
  const octave = parseInt(match[2], 10);

  // Resolve aliases
  if (NOTE_ALIASES[notePart]) {
    notePart = NOTE_ALIASES[notePart];
  }

  const noteIndex = NOTES.indexOf(notePart);
  if (noteIndex === -1) return 60;

  return (octave + 1) * 12 + noteIndex;
}

/**
 * Returns all note names in a scale for all octaves within MIDI range
 */
export function getScaleNotes(root: string, scaleName: string): string[] {
  const intervals = SCALES[scaleName] ?? SCALES.major;
  const rootNote = NOTE_ALIASES[root] ?? root;
  const rootIndex = NOTES.indexOf(rootNote);
  if (rootIndex === -1) return [];

  const scaleNotes: string[] = [];
  for (let octave = 0; octave <= 8; octave++) {
    for (const interval of intervals) {
      const midiNote = (octave + 1) * 12 + rootIndex + interval;
      if (midiNote >= 0 && midiNote <= 127) {
        scaleNotes.push(midiToNoteName(midiNote));
      }
    }
  }
  return scaleNotes;
}

/**
 * Returns chord tones for a root + chord type
 */
export function getChordNotes(root: string, type: string, octave = 4): string[] {
  const intervals = CHORD_TYPES[type] ?? CHORD_TYPES.major;
  const rootNote = NOTE_ALIASES[root] ?? root;
  const rootIndex = NOTES.indexOf(rootNote);
  if (rootIndex === -1) return [];

  const rootMidi = (octave + 1) * 12 + rootIndex;
  return intervals.map(interval => midiToNoteName(rootMidi + interval));
}

/**
 * Transpose a note name by semitones
 */
export function transposeNote(noteName: string, semitones: number): string {
  const midi = noteNameToMidi(noteName);
  const transposed = Math.max(0, Math.min(127, midi + semitones));
  return midiToNoteName(transposed);
}

/**
 * Convert frequency (Hz) to MIDI number
 */
export function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

/**
 * Convert MIDI number to frequency (Hz)
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Get the scale degree of a MIDI note within a given key/scale
 */
export function getScaleDegree(midi: number, rootNote: string, scaleName: string): number | null {
  const intervals = SCALES[scaleName] ?? SCALES.major;
  const rootMidi = noteNameToMidi(`${rootNote}4`);
  const diff = ((midi - rootMidi) % 12 + 12) % 12;
  const degree = intervals.indexOf(diff);
  return degree >= 0 ? degree : null;
}

/**
 * Snap a MIDI note to the nearest scale note
 */
export function snapToScale(midi: number, rootNote: string, scaleName: string): number {
  const intervals = SCALES[scaleName] ?? SCALES.major;
  const rootNoteResolved = NOTE_ALIASES[rootNote] ?? rootNote;
  const rootIndex = NOTES.indexOf(rootNoteResolved);
  const octave = Math.floor(midi / 12);
  const noteInOctave = midi % 12;
  const rootOffset = rootIndex;

  // Find closest interval
  let bestInterval = intervals[0];
  let bestDist = Infinity;
  for (const interval of intervals) {
    const adjusted = (rootOffset + interval) % 12;
    const dist = Math.min(
      Math.abs(noteInOctave - adjusted),
      12 - Math.abs(noteInOctave - adjusted)
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestInterval = interval;
    }
  }

  return octave * 12 + ((rootOffset + bestInterval) % 12);
}

/**
 * Common chord progression patterns (Roman numeral -> scale degrees)
 */
export const CHORD_PROGRESSIONS: Record<string, number[][]> = {
  // [rootOffset, chordType] where chordType: 0=major,1=minor,2=dim
  'I-V-vi-IV': [[0, 0], [7, 0], [9, 1], [5, 0]],
  'i-VI-III-VII': [[0, 1], [8, 0], [3, 0], [10, 0]],
  'I-IV-V': [[0, 0], [5, 0], [7, 0]],
  'i-iv-v': [[0, 1], [5, 1], [7, 1]],
  'I-vi-IV-V': [[0, 0], [9, 1], [5, 0], [7, 0]],
  'i-VII-VI-VII': [[0, 1], [10, 0], [8, 0], [10, 0]],
};
