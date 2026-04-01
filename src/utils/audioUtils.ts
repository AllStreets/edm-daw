import * as Tone from 'tone';

/**
 * Convert decibels to linear gain (0 dB -> 1.0)
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to decibels (1.0 -> 0 dB)
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Convert MIDI velocity (0-127) to normalized gain (0-1)
 */
export function midiVelocityToGain(velocity: number): number {
  return Math.max(0, Math.min(1, velocity / 127));
}

/**
 * Convert note name to frequency in Hz using Tone.js
 */
export function noteToFrequency(note: string): number {
  try {
    return Tone.Frequency(note).toFrequency();
  } catch {
    return 440; // fallback to A4
  }
}

/**
 * Generate downsampled waveform data from an AudioBuffer for display
 */
export function generateWaveformData(audioBuffer: AudioBuffer, samples = 256): Float32Array {
  const channelData = audioBuffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / samples);
  const waveform = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[i * blockSize + j]);
    }
    waveform[i] = sum / blockSize;
  }

  return waveform;
}

/**
 * Trigger a file download in the browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

/**
 * Convert a normalized value (0-1) to an exponential range
 * Useful for frequency knobs
 */
export function normalizedToExp(normalized: number, min: number, max: number): number {
  return min * Math.pow(max / min, normalized);
}

/**
 * Convert an exponential value back to normalized (0-1)
 */
export function expToNormalized(value: number, min: number, max: number): number {
  return Math.log(value / min) / Math.log(max / min);
}

/**
 * Format time in seconds to mm:ss:ms display
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

/**
 * Format bars:beats:steps
 */
export function formatPosition(step: number, stepsPerBeat = 4, beatsPerBar = 4): string {
  const bar = Math.floor(step / (stepsPerBeat * beatsPerBar)) + 1;
  const beat = Math.floor((step % (stepsPerBeat * beatsPerBar)) / stepsPerBeat) + 1;
  const stepInBeat = (step % stepsPerBeat) + 1;
  return `${bar}:${beat}:${stepInBeat}`;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Smooth a value towards a target (for meter animations)
 */
export function smoothValue(current: number, target: number, factor = 0.1): number {
  return current + (target - current) * factor;
}
