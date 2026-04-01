import * as Tone from 'tone';
import type { Pattern, SynthSettings } from '../types';
import { createSynth, updateSynth, type SynthChain } from './SynthEngine';
import { DrumMachine } from './DrumMachine';
import { Sequencer, type StepCallback } from './Sequencer';

interface TrackAudio {
  synthChain?: SynthChain;
  drumMachine?: DrumMachine;
  sequencer?: Sequencer;
  gain: Tone.Gain;
  panner: Tone.Panner;
}

class AudioEngine {
  masterGain: Tone.Gain;
  masterCompressor: Tone.Compressor;
  masterLimiter: Tone.Limiter;
  analyzer: Tone.Analyser;
  waveformAnalyzer: Tone.Analyser;

  private tracks: Map<string, TrackAudio> = new Map();
  private initialized = false;

  constructor() {
    this.masterGain = new Tone.Gain(0.8);
    this.masterCompressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    });
    this.masterLimiter = new Tone.Limiter(-3);
    this.analyzer = new Tone.Analyser('fft', 256);
    this.waveformAnalyzer = new Tone.Analyser('waveform', 512);
  }

  initialize(): void {
    if (this.initialized) return;

    // Master chain: masterGain -> masterCompressor -> masterLimiter -> analyzers -> Destination
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.analyzer);
    this.masterLimiter.connect(this.waveformAnalyzer);
    this.masterLimiter.connect(Tone.getDestination());

    this.initialized = true;
  }

  async start(): Promise<void> {
    await Tone.start();
    this.initialize();
  }

  setBPM(bpm: number): void {
    Tone.getTransport().bpm.value = bpm;
  }

  getBPM(): number {
    return Tone.getTransport().bpm.value;
  }

  play(): void {
    Tone.getTransport().start();
  }

  stop(): void {
    Tone.getTransport().stop();
    Tone.getTransport().position = '0:0:0';
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  setMasterVolume(db: number): void {
    this.masterGain.gain.rampTo(Tone.dbToGain(db), 0.05);
  }

  getAnalyserData(): Float32Array {
    return this.analyzer.getValue() as Float32Array;
  }

  getWaveformData(): Float32Array {
    return this.waveformAnalyzer.getValue() as Float32Array;
  }

  // ===== Track Management =====

  private ensureTrack(trackId: string): TrackAudio {
    if (!this.tracks.has(trackId)) {
      const gain = new Tone.Gain(0.8);
      const panner = new Tone.Panner(0);
      gain.connect(panner);
      panner.connect(this.masterGain);
      this.tracks.set(trackId, { gain, panner });
    }
    return this.tracks.get(trackId)!;
  }

  createSynthTrack(trackId: string, settings: SynthSettings): Tone.PolySynth {
    this.initialize();
    const track = this.ensureTrack(trackId);

    // Dispose existing synth chain
    if (track.synthChain) {
      track.synthChain.dispose();
    }

    const chain = createSynth(settings, track.gain);
    track.synthChain = chain;
    return chain.synth;
  }

  updateSynthSettings(trackId: string, settings: SynthSettings): void {
    const track = this.tracks.get(trackId);
    if (track?.synthChain) {
      updateSynth(track.synthChain, settings);
    }
  }

  getSynth(trackId: string): Tone.PolySynth | null {
    return this.tracks.get(trackId)?.synthChain?.synth ?? null;
  }

  disposeSynth(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track?.synthChain) {
      track.synthChain.dispose();
      delete track.synthChain;
    }
  }

  createDrumSequencer(
    trackId: string,
    pattern: Pattern,
    onStep: StepCallback
  ): void {
    this.initialize();
    const track = this.ensureTrack(trackId);

    // Create drum machine if needed
    if (!track.drumMachine) {
      track.drumMachine = new DrumMachine();
      track.drumMachine.createDrumVoices(track.gain);
    }

    // Create/restart sequencer
    if (!track.sequencer) {
      track.sequencer = new Sequencer();
    }

    track.sequencer.start(pattern, onStep, track.drumMachine);
  }

  stopDrumSequencer(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track?.sequencer) {
      track.sequencer.stop();
    }
  }

  startMelodicSequencer(
    trackId: string,
    pattern: Pattern,
    onStep: StepCallback
  ): void {
    this.initialize();
    const track = this.ensureTrack(trackId);

    if (!track.sequencer) {
      track.sequencer = new Sequencer();
    }

    const synth = track.synthChain?.synth;
    track.sequencer.startMelodic(pattern, onStep, (pitch, velocity, time) => {
      if (synth) {
        const noteName = Tone.Frequency(pitch, 'midi').toNote();
        synth.triggerAttackRelease(noteName, '8n', time, velocity / 127);
      }
    });
  }

  stopMelodicSequencer(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track?.sequencer) {
      track.sequencer.stop();
    }
  }

  triggerNote(trackId: string, note: string, velocity: number, duration: string): void {
    const track = this.tracks.get(trackId);
    if (track?.synthChain) {
      track.synthChain.synth.triggerAttackRelease(note, duration, Tone.now(), velocity);
    }
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.gain.gain.rampTo(volume, 0.05);
    }
  }

  setTrackPan(trackId: string, pan: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.panner.pan.rampTo(pan, 0.05);
    }
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.gain.gain.rampTo(muted ? 0 : 0.8, 0.05);
    }
  }

  disposeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (!track) return;

    track.synthChain?.dispose();
    track.drumMachine?.dispose();
    track.sequencer?.dispose();
    track.gain.dispose();
    track.panner.dispose();
    this.tracks.delete(trackId);
  }

  async export(_format: 'wav'): Promise<Blob> {
    // Offline render - 16 bars at current BPM
    const bpm = Tone.getTransport().bpm.value;
    const duration = (60 / bpm) * 4 * 16; // 16 bars

    const audioBuffer = await Tone.Offline(async () => {
      // Basic offline render - in a real app would re-create the synth chain offline
      const osc = new Tone.Oscillator(440, 'sine').toDestination();
      osc.start(0).stop(0.001); // minimal sound to avoid errors
    }, duration);

    // Convert AudioBuffer to WAV blob
    const wavBlob = audioBufferToWav(audioBuffer as unknown as AudioBuffer);
    return wavBlob;
  }

  dispose(): void {
    this.tracks.forEach((_, id) => this.disposeTrack(id));
    this.masterGain.dispose();
    this.masterCompressor.dispose();
    this.masterLimiter.dispose();
    this.analyzer.dispose();
    this.waveformAnalyzer.dispose();
    this.initialized = false;
  }
}

// Simple WAV encoder
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const channelData = buffer.getChannelData(ch);
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export const audioEngine = new AudioEngine();
