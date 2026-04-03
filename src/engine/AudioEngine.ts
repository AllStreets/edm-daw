import * as Tone from 'tone';
import type { Pattern, SynthSettings, TrackEffect, AutomationParameter } from '../types';
import { createSynth, updateSynth, type SynthChain } from './SynthEngine';
import { DrumMachine } from './DrumMachine';
import { Sequencer, type StepCallback } from './Sequencer';

interface TrackAudio {
  synthChain?: SynthChain;
  drumMachine?: DrumMachine;
  sequencer?: Sequencer;
  gain: Tone.Gain;
  fxBus: Tone.Gain;
  fxNodes: Map<string, Tone.ToneAudioNode>;
  panner: Tone.Panner;
  reverbSend: Tone.Gain;
  delaySend: Tone.Gain;
  trackAnalyser: Tone.Analyser;
}

class AudioEngine {
  masterGain: Tone.Gain;
  masterCompressor: Tone.Compressor;
  masterLimiter: Tone.Limiter;
  analyzer: Tone.Analyser;
  waveformAnalyzer: Tone.Analyser;
  // Effects are created lazily inside initialize() after Tone.start()
  reverbEffect: Tone.Reverb | null = null;
  delayEffect: Tone.FeedbackDelay | null = null;
  reverbAnalyser: Tone.Analyser | null = null;
  delayAnalyser: Tone.Analyser | null = null;

  private tracks: Map<string, TrackAudio> = new Map();
  private initialized = false;
  private recorder: Tone.Recorder | null = null;
  private onSongEnd: (() => void) | null = null;
  private songEndFired = false;

  // Sidechain
  private sidechainAnalyser: Tone.Analyser | null = null;
  private sidechainGains: Map<string, Tone.Gain> = new Map();
  private sidechainRaf: number | null = null;
  private sidechainSmoothed = 1;

  constructor() {
    // Only create simple gain/analysis nodes in the constructor.
    // Reverb/Delay require a running AudioContext — they're created in initialize().
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

    // Master chain: masterGain -> compressor -> limiter -> analysers -> Destination
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterLimiter);
    this.masterLimiter.connect(this.analyzer);
    this.masterLimiter.connect(this.waveformAnalyzer);
    this.masterLimiter.connect(Tone.getDestination());

    // Create send/return effects NOW (audio context is running after Tone.start())
    this.reverbAnalyser = new Tone.Analyser('waveform', 256);
    this.delayAnalyser  = new Tone.Analyser('waveform', 256);

    this.reverbEffect = new Tone.Reverb({ decay: 2.5, preDelay: 0.01 });
    this.reverbEffect.wet.value = 1;
    this.delayEffect  = new Tone.FeedbackDelay('8n', 0.35);
    this.delayEffect.wet.value = 1;

    this.reverbEffect.connect(this.masterGain);
    this.delayEffect.connect(this.masterGain);
    this.reverbEffect.connect(this.reverbAnalyser);
    this.delayEffect.connect(this.delayAnalyser);

    // Generate reverb IR asynchronously (non-blocking)
    this.reverbEffect.generate().catch(() => {});

    this.initialized = true;
  }

  async start(): Promise<void> {
    await Tone.start();
    // Belt-and-suspenders: explicitly resume the raw AudioContext if it is still
    // suspended (browser inactivity / tab-switch can re-suspend it even after Tone.start())
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (rawCtx.state !== 'running') {
      try { await rawCtx.resume(); } catch { /* ignore */ }
    }
    this.initialize();
    // Small lookahead gives scheduler breathing room without pre-committing too many notes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Tone.getTransport() as any).lookAhead = 0.15;
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

  isPaused(): boolean {
    return Tone.getTransport().state === 'paused';
  }

  stop(): void {
    Tone.getTransport().stop();
    Tone.getTransport().cancel(0); // purge Transport-level events
    Tone.getTransport().position = '0:0:0';
    this.onSongEnd = null;
    this.songEndFired = false;
    // Dispose all synths and drum machines so Web Audio-scheduled note events
    // (triggerAttackRelease futures) don't bleed into the next play.
    // The gain/panner/send routing nodes stay intact.
    this.resetTracks();
    this.teardownSidechain();
  }

  /**
   * Dispose all per-track synth chains, drum machines, and sequencers so that
   * the next call to play() rebuilds them from scratch. The gain/panner/send
   * routing stays intact. Call this before each new song generation to prevent
   * accumulated Tone.js internal state from causing audio degradation.
   */
  resetTracks(): void {
    for (const track of this.tracks.values()) {
      if (track.synthChain) {
        track.synthChain.dispose();
        delete track.synthChain;
      }
      if (track.drumMachine) {
        track.drumMachine.dispose();
        delete track.drumMachine;
      }
      if (track.sequencer) {
        track.sequencer.dispose();
        delete track.sequencer;
      }
    }
  }

  /** Call with a callback to stop playback after one full pass; call with null to loop. */
  setOnSongEnd(cb: (() => void) | null): void {
    this.onSongEnd = cb;
    this.songEndFired = false;
  }

  private fireSongEnd(): void {
    if (!this.songEndFired && this.onSongEnd) {
      this.songEndFired = true;
      this.onSongEnd();
    }
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.rampTo(Math.max(0, Math.min(1, volume)), 0.02);
  }

  getAnalyserData(): Float32Array {
    return this.analyzer.getValue() as Float32Array;
  }

  getWaveformData(): Float32Array {
    return this.waveformAnalyzer.getValue() as Float32Array;
  }

  // ── Track level metering (RMS from per-track waveform analyser) ────────────

  getTrackLevel(trackId: string): number {
    const track = this.tracks.get(trackId);
    if (!track) return 0;
    const data = track.trackAnalyser.getValue() as Float32Array;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / data.length);
  }

  // ── Send / Return levels ───────────────────────────────────────────────────

  getEffectLevel(effect: 'reverb' | 'delay'): number {
    const analyser = effect === 'reverb' ? this.reverbAnalyser : this.delayAnalyser;
    if (!analyser) return 0;
    const data = analyser.getValue() as Float32Array;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    return Math.sqrt(sum / data.length);
  }

  setTrackReverbSend(trackId: string, amount: number): void {
    const track = this.tracks.get(trackId);
    if (track && this.reverbEffect) {
      track.reverbSend.gain.rampTo(Math.max(0, Math.min(1, amount)), 0.05);
    }
  }

  setTrackDelaySend(trackId: string, amount: number): void {
    const track = this.tracks.get(trackId);
    if (track && this.delayEffect) {
      track.delaySend.gain.rampTo(Math.max(0, Math.min(1, amount)), 0.05);
    }
  }

  setTrackParam(trackId: string, param: AutomationParameter, value: number, time?: number): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    const rampTime = time ?? Tone.now();
    const rampDuration = 0.016;

    switch (param) {
      case 'volume':
        track.gain.gain.linearRampTo(value, rampDuration, rampTime);
        break;
      case 'pan':
        track.panner.pan.linearRampTo(value * 2 - 1, rampDuration, rampTime);
        break;
      case 'filterCutoff': {
        const chain = track.synthChain;
        if (chain) chain.filter.frequency.linearRampTo(20 + value * 19980, rampDuration, rampTime);
        break;
      }
      case 'filterResonance': {
        const chain = track.synthChain;
        if (chain) chain.filter.Q.linearRampTo(value * 20, rampDuration, rampTime);
        break;
      }
      case 'reverbWet':
        track.reverbSend.gain.linearRampTo(value, rampDuration, rampTime);
        break;
      case 'delayWet':
        track.delaySend.gain.linearRampTo(value, rampDuration, rampTime);
        break;
      case 'pitch': {
        const chain = track.synthChain;
        if (chain) {
          const semitones = (value - 0.5) * 24;
          chain.synth.set({ detune: semitones * 100 });
        }
        break;
      }
    }
  }

  // ── Track Management ───────────────────────────────────────────────────────

  private ensureTrack(trackId: string): TrackAudio {
    if (!this.tracks.has(trackId)) {
      const gain = new Tone.Gain(0.8);
      const fxBus = new Tone.Gain(1);
      const fxNodes = new Map<string, Tone.ToneAudioNode>();
      const panner = new Tone.Panner(0);
      const reverbSend = new Tone.Gain(0);
      const delaySend  = new Tone.Gain(0);
      const trackAnalyser = new Tone.Analyser('waveform', 256);

      // gain → fxBus → panner (fx nodes are inserted between fxBus and panner)
      gain.connect(fxBus);
      fxBus.connect(panner);
      panner.connect(this.masterGain);
      gain.connect(trackAnalyser);

      // Only wire send buses if effects are initialized (requires audio context)
      if (this.reverbEffect) {
        gain.connect(reverbSend);
        reverbSend.connect(this.reverbEffect);
      }
      if (this.delayEffect) {
        gain.connect(delaySend);
        delaySend.connect(this.delayEffect);
      }

      this.tracks.set(trackId, { gain, fxBus, fxNodes, panner, reverbSend, delaySend, trackAnalyser });
    }
    return this.tracks.get(trackId)!;
  }

  // ── Per-track FX chain ──────────────────────────────────────────────────────

  private rebuildFxChain(track: TrackAudio, effects: TrackEffect[]): void {
    // Disconnect fxBus from panner and each existing fx node individually.
    // Do NOT call fxBus.disconnect() with no arguments — that kills ALL outputs
    // including any sidechain gain node that may be inserted by setupSidechain().
    try { track.fxBus.disconnect(track.panner); } catch { /* ignore */ }
    track.fxNodes.forEach((node, _id) => {
      try { track.fxBus.disconnect(node); } catch { /* ignore */ }
    });

    // Dispose existing fx nodes after disconnecting
    track.fxNodes.forEach(node => {
      try { node.disconnect(); } catch { /* ignore */ }
      try { (node as Tone.ToneAudioNode).dispose(); } catch { /* ignore */ }
    });
    track.fxNodes.clear();

    const activeEffects = effects.filter(e => e.on);
    if (activeEffects.length === 0) {
      track.fxBus.connect(track.panner);
      return;
    }

    const nodes: Tone.ToneAudioNode[] = activeEffects.map(e => this.createFxNode(e));
    activeEffects.forEach((e, i) => track.fxNodes.set(e.id, nodes[i]));

    // Wire in series: fxBus → node[0] → ... → node[n-1] → panner
    track.fxBus.connect(nodes[0]);
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(track.panner);
  }

  private createFxNode(effect: TrackEffect): Tone.ToneAudioNode {
    const s = effect.settings;
    switch (s.fxType) {
      case 'reverb': {
        const r = new Tone.Reverb({ decay: s.decay, preDelay: s.preDelay });
        r.wet.value = s.wet;
        r.generate().catch(() => {});
        return r;
      }
      case 'delay': {
        const d = s.pingPong
          ? new Tone.PingPongDelay(s.time, s.feedback)
          : new Tone.FeedbackDelay(s.time, s.feedback);
        d.wet.value = s.wet;
        return d;
      }
      case 'filter': {
        return new Tone.Filter(s.frequency, s.filterType as Tone.FilterType);
      }
      case 'distortion': {
        const dist = new Tone.Distortion(s.distortion);
        dist.wet.value = s.wet;
        return dist;
      }
      case 'compressor': {
        return new Tone.Compressor({
          threshold: s.threshold,
          ratio: s.ratio,
          attack: s.attack / 1000,
          release: s.release / 1000,
          knee: s.knee,
        });
      }
    }
  }

  applyTrackEffects(trackId: string, effects: TrackEffect[]): void {
    const track = this.tracks.get(trackId);
    if (track) this.rebuildFxChain(track, effects);
  }

  // ── Sidechain ──────────────────────────────────────────────────────────────

  setupSidechain(kickTrackId: string, targetTrackIds: string[], amount: number, release: number): void {
    this.teardownSidechain();

    const kickTrack = this.tracks.get(kickTrackId);
    if (!kickTrack) return;

    this.sidechainAnalyser = new Tone.Analyser('waveform', 128);
    kickTrack.gain.connect(this.sidechainAnalyser);
    this.sidechainSmoothed = 1;

    // Insert a sidechain gain node into each target track after its fxBus
    targetTrackIds.forEach(targetId => {
      const targetTrack = this.tracks.get(targetId);
      if (!targetTrack) return;
      const scGain = new Tone.Gain(1);
      try { targetTrack.fxBus.disconnect(targetTrack.panner); } catch { /* ignore */ }
      targetTrack.fxBus.connect(scGain);
      scGain.connect(targetTrack.panner);
      this.sidechainGains.set(targetId, scGain);
    });

    const releaseCoeff = Math.exp(-1 / (release / 16.67));
    const tick = () => {
      const values = this.sidechainAnalyser!.getValue() as Float32Array;
      let peak = 0;
      for (let i = 0; i < values.length; i++) {
        const abs = Math.abs(values[i]);
        if (abs > peak) peak = abs;
      }
      const targetGain = peak > 0.05 ? Math.max(0.05, 1 - peak * amount * 2.5) : 1;
      if (targetGain < this.sidechainSmoothed) {
        this.sidechainSmoothed = targetGain;
      } else {
        this.sidechainSmoothed = this.sidechainSmoothed + (targetGain - this.sidechainSmoothed) * (1 - releaseCoeff);
      }
      this.sidechainGains.forEach(g => { g.gain.value = this.sidechainSmoothed; });
      this.sidechainRaf = requestAnimationFrame(tick);
    };
    this.sidechainRaf = requestAnimationFrame(tick);
  }

  teardownSidechain(): void {
    if (this.sidechainRaf !== null) {
      cancelAnimationFrame(this.sidechainRaf);
      this.sidechainRaf = null;
    }
    this.sidechainGains.forEach((scGain, targetId) => {
      const targetTrack = this.tracks.get(targetId);
      if (targetTrack) {
        try { targetTrack.fxBus.disconnect(scGain); } catch { /* ignore */ }
        try { scGain.disconnect(targetTrack.panner); } catch { /* ignore */ }
        targetTrack.fxBus.connect(targetTrack.panner);
      }
      scGain.dispose();
    });
    this.sidechainGains.clear();
    if (this.sidechainAnalyser) {
      this.sidechainAnalyser.dispose();
      this.sidechainAnalyser = null;
    }
  }

  createSynthTrack(trackId: string, settings: SynthSettings): Tone.PolySynth {
    this.initialize();
    const track = this.ensureTrack(trackId);
    if (track.synthChain) track.synthChain.dispose();
    const chain = createSynth(settings, track.gain);
    track.synthChain = chain;
    return chain.synth;
  }

  updateSynthSettings(trackId: string, settings: SynthSettings): void {
    const track = this.tracks.get(trackId);
    if (track?.synthChain) {
      try {
        updateSynth(track.synthChain, settings);
      } catch (e) {
        console.warn('updateSynth: param update skipped (audio context not ready)', e);
      }
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

  createDrumSequencer(trackId: string, pattern: Pattern, onStep: StepCallback): void {
    this.initialize();
    const track = this.ensureTrack(trackId);
    if (!track.drumMachine) {
      track.drumMachine = new DrumMachine();
      track.drumMachine.createDrumVoices(track.gain);
    }
    if (!track.sequencer) track.sequencer = new Sequencer();
    track.sequencer.start(pattern, onStep, track.drumMachine, () => this.fireSongEnd(),
      (param, value, time) => this.setTrackParam(trackId, param, value, time));
  }

  stopDrumSequencer(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track?.sequencer) track.sequencer.stop();
  }

  startMelodicSequencer(trackId: string, pattern: Pattern, onStep: StepCallback): void {
    this.initialize();
    const track = this.ensureTrack(trackId);
    if (!track.sequencer) track.sequencer = new Sequencer();
    const synth = track.synthChain?.synth;
    track.sequencer.startMelodic(pattern, onStep, (pitch, velocity, time, duration) => {
      if (synth) {
        const noteName = Tone.Frequency(pitch, 'midi').toNote();
        const stepSec = Tone.Time('16n').toSeconds();
        const noteSec = Math.max(stepSec * 0.5, stepSec * duration * 0.95);
        synth.triggerAttackRelease(noteName, noteSec, time, velocity / 127);
      }
    }, () => this.fireSongEnd(),
    (param, value, time) => this.setTrackParam(trackId, param, value, time));
  }

  stopMelodicSequencer(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track?.sequencer) track.sequencer.stop();
  }

  async startRecording(): Promise<void> {
    await Tone.start();
    this.initialize();
    if (this.recorder) {
      try { await this.recorder.stop(); } catch { /* ignore */ }
      this.recorder.dispose();
      this.recorder = null;
    }
    this.recorder = new Tone.Recorder();
    this.masterLimiter.connect(this.recorder);
    await this.recorder.start();
  }

  async stopRecording(): Promise<Blob> {
    if (!this.recorder) {
      return new Blob([], { type: 'audio/webm' });
    }
    const blob = await this.recorder.stop();
    // Dispose the recorder — its own dispose() handles internal disconnection.
    // Do NOT call masterLimiter.disconnect(recorder) first: the actual connection
    // went to recorder.input, so that call throws silently and leaves stale state
    // in Tone.js's fan-out list, which dispose() then corrupts.
    this.recorder.dispose();
    this.recorder = null;
    // Re-establish the limiter → destination path unconditionally.
    // Tone.js internal bookkeeping for masterLimiter can be broken by the disposal
    // of a node that was connected to it, so we always reconnect to be safe.
    try { this.masterLimiter.disconnect(Tone.getDestination()); } catch { /* not connected */ }
    this.masterLimiter.connect(Tone.getDestination());
    return blob;
  }

  triggerNote(trackId: string, note: string, velocity: number, duration: string): void {
    const track = this.tracks.get(trackId);
    if (track?.synthChain) {
      track.synthChain.synth.triggerAttackRelease(note, duration, Tone.now(), velocity);
    }
  }

  setTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (track) track.gain.gain.rampTo(volume, 0.05);
  }

  setTrackPan(trackId: string, pan: number): void {
    const track = this.tracks.get(trackId);
    if (track) track.panner.pan.rampTo(pan, 0.05);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) track.gain.gain.rampTo(muted ? 0 : 0.8, 0.05);
  }

  disposeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (!track) return;
    track.synthChain?.dispose();
    track.drumMachine?.dispose();
    track.sequencer?.dispose();
    track.gain.dispose();
    track.panner.dispose();
    track.reverbSend.dispose();
    track.delaySend.dispose();
    track.trackAnalyser.dispose();
    this.tracks.delete(trackId);
  }

  // ── Sample preview (synthesized sounds) ───────────────────────────────────

  /**
   * Preview a synthesized sound for a sample-browser entry.
   * category = browser category, sampleIdx = which sample in the list (0-based)
   * so each sample within a category sounds distinctly different.
   */
  previewDrumSound(category: string, sampleIdx = 0): void {
    this.initialize();
    const now = Tone.now();

    switch (category) {
      case 'Kicks': {
        // Vary pitch and decay per sample
        const pitches = ['C1', 'B0', 'D1', 'A0', 'C1', 'D1', 'C1', 'C1'];
        const decays  = [0.40, 0.65, 0.25, 0.55, 0.40, 0.20, 0.35, 0.50];
        const octaves = [10,   8,    8,    10,   6,    8,    10,   10  ];
        const kick = new Tone.MembraneSynth({
          pitchDecay: decays[sampleIdx % decays.length] * 0.2,
          octaves: octaves[sampleIdx % octaves.length],
          envelope: { attack: 0.001, decay: decays[sampleIdx % decays.length], sustain: 0, release: 0.3 },
        }).connect(this.masterGain);
        kick.triggerAttackRelease(pitches[sampleIdx % pitches.length], '8n', now, 0.9);
        setTimeout(() => kick.dispose(), 1500);
        break;
      }

      case '808s': {
        const notes808 = ['C1', 'D1', 'G1', 'A1', 'C1', 'C1', 'C1'];
        const decays808 = [0.7, 0.7, 0.7, 0.7, 0.7, 1.2, 0.3];
        const e808 = new Tone.MembraneSynth({
          pitchDecay: 0.18, octaves: 8,
          envelope: { attack: 0.001, decay: decays808[sampleIdx % decays808.length], sustain: 0, release: 0.4 },
        }).connect(this.masterGain);
        e808.triggerAttackRelease(notes808[sampleIdx % notes808.length], '4n', now, 0.85);
        setTimeout(() => e808.dispose(), 2000);
        break;
      }

      case 'Snares': {
        const snDecays = [0.20, 0.35, 0.15, 0.20, 0.12, 0.22];
        const snare = new Tone.NoiseSynth({
          noise: { type: sampleIdx === 4 ? 'pink' : 'white' },
          envelope: { attack: 0.001, decay: snDecays[sampleIdx % snDecays.length], sustain: 0, release: 0.08 },
        }).connect(this.masterGain);
        (snare as Tone.NoiseSynth).triggerAttackRelease('16n', now, 0.8);
        setTimeout(() => snare.dispose(), 700);
        break;
      }

      case 'Claps': {
        const clDecays = [0.12, 0.15, 0.06, 0.20, 0.08];
        const clap = new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.005, decay: clDecays[sampleIdx % clDecays.length], sustain: 0, release: 0.04 },
        }).connect(this.masterGain);
        (clap as Tone.NoiseSynth).triggerAttackRelease('32n', now, 0.75);
        setTimeout(() => clap.dispose(), 500);
        break;
      }

      case 'Hi-hats': {
        const hhDecays  = [0.05, 0.03, 0.35, 0.18, 0.08, 0.05, 0.07];
        const hhFreqs   = [400,  500,  400,  450,  380,  400,  420 ];
        const hh = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: hhDecays[sampleIdx % hhDecays.length], release: 0.01 },
          harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        }).connect(this.masterGain);
        hh.frequency.value = hhFreqs[sampleIdx % hhFreqs.length];
        hh.triggerAttackRelease('32n', now, 0.7);
        setTimeout(() => hh.dispose(), 600);
        break;
      }

      case 'Percs': {
        const percNotes  = ['G2', 'C3', 'A3', 'D3', 'E3', 'B2'];
        const percDecays = [0.3,  0.08, 0.08, 0.12, 0.15, 0.10];
        const usesMetal  = [false, false, true, true, false, false];
        const idx = sampleIdx % percNotes.length;
        if (usesMetal[idx]) {
          const m = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: percDecays[idx], release: 0.02 },
            harmonicity: 8, modulationIndex: 16, resonance: 5000, octaves: 2,
          }).connect(this.masterGain);
          m.frequency.value = 800;
          m.triggerAttackRelease('32n', now, 0.65);
          setTimeout(() => m.dispose(), 500);
        } else {
          const tom = new Tone.MembraneSynth({
            pitchDecay: 0.06, octaves: 6,
            envelope: { attack: 0.001, decay: percDecays[idx], sustain: 0, release: 0.15 },
          }).connect(this.masterGain);
          tom.triggerAttackRelease(percNotes[idx], '8n', now, 0.75);
          setTimeout(() => tom.dispose(), 800);
        }
        break;
      }

      case 'Synths': {
        // Vary timbre per sample: stab, pad, lead, bass, chord, pluck, arp
        const synthTypes: Array<() => void> = [
          () => { // Sawtooth Stab
            const s = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'sawtooth' as const },
              envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.2 },
            }).connect(this.masterGain);
            s.triggerAttackRelease('C4', '8n', now, 0.6);
            setTimeout(() => s.dispose(), 800);
          },
          () => { // Warm Pad
            const s = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'triangle' as const },
              envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.5 },
            }).connect(this.masterGain);
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '4n', now, 0.4);
            setTimeout(() => s.dispose(), 1500);
          },
          () => { // Detuned Lead
            const s = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'sawtooth' as const },
              envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
            }).connect(this.masterGain);
            s.triggerAttackRelease('A4', '4n', now, 0.55);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // Analog Bass
            const s = new Tone.Synth({
              oscillator: { type: 'square' as const },
              envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 },
            }).connect(this.masterGain);
            s.triggerAttackRelease('C2', '4n', now, 0.7);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // Trance Supersaw Chord
            const s = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'sawtooth' as const },
              envelope: { attack: 0.02, decay: 0.15, sustain: 0.6, release: 0.4 },
            }).connect(this.masterGain);
            s.triggerAttackRelease(['C4', 'E4', 'G4', 'B4'], '4n', now, 0.45);
            setTimeout(() => s.dispose(), 1500);
          },
          () => { // Plucked String
            const s = new Tone.PluckSynth({ attackNoise: 1, dampening: 4000, resonance: 0.98 })
              .connect(this.masterGain);
            s.triggerAttack('G3', now);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // Arpeggio
            const s = new Tone.PolySynth(Tone.Synth, {
              oscillator: { type: 'square' as const },
              envelope: { attack: 0.005, decay: 0.08, sustain: 0.2, release: 0.1 },
            }).connect(this.masterGain);
            ['C4', 'E4', 'G4', 'C5'].forEach((n, i) => {
              s.triggerAttackRelease(n, '16n', now + i * 0.1, 0.5);
            });
            setTimeout(() => s.dispose(), 1000);
          },
        ];
        (synthTypes[sampleIdx % synthTypes.length] ?? synthTypes[0])();
        break;
      }

      case 'FX': {
        const fxTypes: Array<() => void> = [
          () => { // White Noise Riser
            const n = new Tone.NoiseSynth({
              noise: { type: 'white' },
              envelope: { attack: 0.3, decay: 0.1, sustain: 0.5, release: 0.1 },
            }).connect(this.masterGain);
            (n as Tone.NoiseSynth).triggerAttackRelease('4n', now, 0.4);
            setTimeout(() => n.dispose(), 1500);
          },
          () => { // Deep Impact
            const kick = new Tone.MembraneSynth({
              pitchDecay: 0.5, octaves: 4,
              envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.5 },
            }).connect(this.masterGain);
            kick.triggerAttackRelease('C0', '4n', now, 0.9);
            setTimeout(() => kick.dispose(), 2000);
          },
          () => { // Downlifter
            const n = new Tone.NoiseSynth({
              noise: { type: 'pink' },
              envelope: { attack: 0.05, decay: 0.6, sustain: 0, release: 0.2 },
            }).connect(this.masterGain);
            (n as Tone.NoiseSynth).triggerAttackRelease('4n', now, 0.45);
            setTimeout(() => n.dispose(), 1500);
          },
          () => { // Filter Sweep
            const n = new Tone.NoiseSynth({
              noise: { type: 'brown' },
              envelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 0.3 },
            }).connect(this.masterGain);
            (n as Tone.NoiseSynth).triggerAttackRelease('4n', now, 0.35);
            setTimeout(() => n.dispose(), 1800);
          },
          () => { // Noise Layer
            const n = new Tone.NoiseSynth({
              noise: { type: 'brown' },
              envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
            }).connect(this.masterGain);
            (n as Tone.NoiseSynth).triggerAttackRelease('4n', now, 0.3);
            setTimeout(() => n.dispose(), 1500);
          },
          () => { // Transition Fill
            const n = new Tone.NoiseSynth({
              noise: { type: 'white' },
              envelope: { attack: 0.05, decay: 0.15, sustain: 0.1, release: 0.2 },
            }).connect(this.masterGain);
            (n as Tone.NoiseSynth).triggerAttackRelease('8n', now, 0.5);
            setTimeout(() => n.dispose(), 800);
          },
          () => { // Vinyl Crackle
            const n = new Tone.NoiseSynth({
              noise: { type: 'pink' },
              envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
            }).connect(this.masterGain);
            for (let i = 0; i < 5; i++) {
              (n as Tone.NoiseSynth).triggerAttackRelease('32n', now + i * 0.07, 0.25);
            }
            setTimeout(() => n.dispose(), 700);
          },
        ];
        (fxTypes[sampleIdx % fxTypes.length] ?? fxTypes[0])();
        break;
      }

      case 'Vocals': {
        const voxNotes = ['A4', 'G4', 'C5', 'E4', 'D4'];
        const voxDurs  = ['8n', '4n', '8n', '4n', '2n'];
        const vox = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' as const },
          envelope: { attack: 0.05, decay: 0.1, sustain: 0.6, release: 0.4 },
        }).connect(this.masterGain);
        vox.triggerAttackRelease(voxNotes[sampleIdx % voxNotes.length], voxDurs[sampleIdx % voxDurs.length], now, 0.45);
        setTimeout(() => vox.dispose(), 1500);
        break;
      }

      case 'Loops': {
        // Play different melodic patterns to represent different loops
        const loopPatterns: Array<[string[], number]> = [
          [['C3', 'C3', 'E3', 'G3'], 0.12],      // house drum feel
          [['C3', 'E3', 'G3', 'C4'], 0.08],      // melodic
          [['C2', 'D2', 'F2', 'G2'], 0.15],      // trap bass
          [['E4', 'G4', 'A4', 'B4'], 0.10],      // melody hook
          [['D3', 'F3', 'A3', 'D4'], 0.12],      // perc
          [['C3', 'E3', 'G3', 'B3', 'C4'], 0.09], // full
        ];
        const [notes, step] = loopPatterns[sampleIdx % loopPatterns.length];
        const ls = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' as const },
          envelope: { attack: 0.01, decay: 0.08, sustain: 0.3, release: 0.15 },
        }).connect(this.masterGain);
        notes.forEach((n, i) => { ls.triggerAttackRelease(n, '16n', now + i * step, 0.5); });
        setTimeout(() => ls.dispose(), 1500);
        break;
      }

      case 'Leads': {
        const leadTypes: Array<() => void> = [
          () => { // Supersaw
            const s = new Tone.PolySynth(Tone.Synth).connect(this.masterGain);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            const ch = new Tone.Chorus(2, 3.5, 0.4).connect(this.masterGain);
            s.disconnect(); s.connect(ch);
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '4n', now, 0.5);
            setTimeout(() => { s.dispose(); ch.dispose(); }, 1500);
          },
          () => { // Acid Lead
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.4, release: 0.2 } }).connect(this.masterGain);
            s.triggerAttackRelease('C4', '4n', now, 0.6);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // FM Bell
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.8, sustain: 0.2, release: 1.2 } }).connect(this.masterGain);
            s.triggerAttackRelease('E5', '4n', now, 0.55);
            setTimeout(() => s.dispose(), 2000);
          },
          () => { // Reese Screech
            const dist = new Tone.Distortion(0.5).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.7, release: 0.3 } }).connect(dist);
            s.triggerAttackRelease('A4', '4n', now, 0.6);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1200);
          },
          () => { // Pluck
            const rev = new Tone.Reverb({ decay: 1.5, wet: 0.3 }).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'triangle' as const }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2 } }).connect(rev);
            s.triggerAttackRelease('G4', '8n', now, 0.65);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 1000);
          },
          () => { // Distorted Square
            const dist = new Tone.Distortion(0.6).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'square' as const }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.2 } }).connect(dist);
            s.triggerAttackRelease('C5', '4n', now, 0.55);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1000);
          },
        ];
        (leadTypes[sampleIdx % leadTypes.length] ?? leadTypes[0])();
        break;
      }

      case 'Basses': {
        const bassTypes: Array<() => void> = [
          () => { // Reese Bass
            const ch = new Tone.Chorus(1, 3.5, 0.6).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 } }).connect(ch);
            s.triggerAttackRelease('C2', '4n', now, 0.75);
            setTimeout(() => { s.dispose(); ch.dispose(); }, 1200);
          },
          () => { // FM Bass
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.3 } }).connect(this.masterGain);
            s.triggerAttackRelease('C2', '4n', now, 0.8);
            setTimeout(() => s.dispose(), 1200);
          },
          () => { // Distorted Bass
            const dist = new Tone.Distortion(0.5).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'square' as const }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.2 } }).connect(dist);
            s.triggerAttackRelease('C2', '4n', now, 0.75);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1200);
          },
          () => { // Sub Bass
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.9, release: 0.4 } }).connect(this.masterGain);
            s.triggerAttackRelease('C1', '2n', now, 0.85);
            setTimeout(() => s.dispose(), 1500);
          },
          () => { // Wobble Bass
            const filter = new Tone.Filter({ frequency: 600, type: 'lowpass', Q: 8 }).connect(this.masterGain);
            const lfo = new Tone.LFO({ frequency: 4, min: 100, max: 2000 }).connect(filter.frequency);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.3 } }).connect(filter);
            lfo.start(now);
            s.triggerAttackRelease('C2', '2n', now, 0.75);
            setTimeout(() => { s.dispose(); filter.dispose(); lfo.dispose(); }, 1500);
          },
          () => { // Portamento Bass
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.08, decay: 0.2, sustain: 0.7, release: 0.4 } }).connect(this.masterGain);
            s.triggerAttackRelease('C2', '4n', now, 0.75);
            setTimeout(() => s.dispose(), 1500);
          },
        ];
        (bassTypes[sampleIdx % bassTypes.length] ?? bassTypes[0])();
        break;
      }

      case 'Pads': {
        const padTypes: Array<() => void> = [
          () => { // Choir Pad
            const rev = new Tone.Reverb({ decay: 4, wet: 0.6 }).connect(this.masterGain);
            const ch = new Tone.Chorus(0.8, 3.5, 0.5).connect(rev);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.4, decay: 0.3, sustain: 0.85, release: 2 } }).connect(ch);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now, 0.4);
            setTimeout(() => { s.dispose(); ch.dispose(); rev.dispose(); }, 3000);
          },
          () => { // Lush Pad
            const rev = new Tone.Reverb({ decay: 5, wet: 0.7 }).connect(this.masterGain);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.5, decay: 0.4, sustain: 0.8, release: 3 } }).connect(rev);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            s.triggerAttackRelease(['C4', 'E4', 'G4', 'B4'], '2n', now, 0.35);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 4000);
          },
          () => { // Dark Pad
            const rev = new Tone.Reverb({ decay: 6, wet: 0.5 }).connect(this.masterGain);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.6, decay: 0.5, sustain: 0.7, release: 4 } }).connect(rev);
            s.set({ oscillator: { type: 'sine' as never } });
            s.triggerAttackRelease(['C4', 'Eb4', 'G4'], '2n', now, 0.45);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 5000);
          },
          () => { // String Pad
            const rev = new Tone.Reverb({ decay: 3, wet: 0.4 }).connect(this.masterGain);
            const s = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.2, decay: 0.3, sustain: 0.75, release: 1.5 } }).connect(rev);
            s.set({ oscillator: { type: 'sawtooth' as never } });
            s.triggerAttackRelease(['C4', 'E4', 'G4'], '2n', now, 0.4);
            setTimeout(() => { s.dispose(); rev.dispose(); }, 2500);
          },
        ];
        (padTypes[sampleIdx % padTypes.length] ?? padTypes[0])();
        break;
      }

      case 'FX Presets': {
        const fxPresetTypes: Array<() => void> = [
          () => { // Vocal Chop
            const filter = new Tone.Filter({ frequency: 800, type: 'bandpass', Q: 8 }).connect(this.masterGain);
            const rev = new Tone.Reverb({ decay: 1, wet: 0.3 }).connect(this.masterGain);
            filter.connect(rev);
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 } }).connect(filter);
            s.triggerAttackRelease('A4', '8n', now, 0.6);
            setTimeout(() => { s.dispose(); filter.dispose(); rev.dispose(); }, 800);
          },
          () => { // Riser
            const rev = new Tone.Reverb({ decay: 3, wet: 0.4 }).connect(this.masterGain);
            const filter = new Tone.AutoFilter({ frequency: 0.25, baseFrequency: 200, octaves: 6 }).connect(rev);
            const s = new Tone.Synth({ oscillator: { type: 'sawtooth' as const }, envelope: { attack: 0.5, decay: 0.1, sustain: 0.9, release: 0.5 } }).connect(filter);
            filter.start(now);
            s.triggerAttackRelease('C3', '2n', now, 0.5);
            setTimeout(() => { s.dispose(); filter.stop(); filter.dispose(); rev.dispose(); }, 2500);
          },
          () => { // Drop Bass
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.6, sustain: 0, release: 0.4 } }).connect(this.masterGain);
            s.triggerAttackRelease('C1', '2n', now, 0.9);
            setTimeout(() => s.dispose(), 2000);
          },
          () => { // Impact Hit
            const dist = new Tone.Distortion(0.4).connect(this.masterGain);
            const s = new Tone.Synth({ oscillator: { type: 'sine' as const }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 } }).connect(dist);
            s.triggerAttackRelease('C0', '8n', now, 1.0);
            setTimeout(() => { s.dispose(); dist.dispose(); }, 1500);
          },
        ];
        (fxPresetTypes[sampleIdx % fxPresetTypes.length] ?? fxPresetTypes[0])();
        break;
      }

      default: {
        const def = new Tone.Synth({
          oscillator: { type: 'triangle' as const },
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.3 },
        }).connect(this.masterGain);
        def.triggerAttackRelease('C3', '8n', now, 0.6);
        setTimeout(() => def.dispose(), 800);
      }
    }
  }

  async export(_format: 'wav'): Promise<Blob> {
    const bpm = Tone.getTransport().bpm.value;
    const duration = (60 / bpm) * 4 * 16;
    const audioBuffer = await Tone.Offline(async () => {
      const osc = new Tone.Oscillator(440, 'sine').toDestination();
      osc.start(0).stop(0.001);
    }, duration);
    return audioBufferToWav(audioBuffer as unknown as AudioBuffer);
  }

  dispose(): void {
    this.tracks.forEach((_, id) => this.disposeTrack(id));
    this.masterGain.dispose();
    this.masterCompressor.dispose();
    this.masterLimiter.dispose();
    this.analyzer.dispose();
    this.waveformAnalyzer.dispose();
    this.reverbEffect?.dispose();
    this.delayEffect?.dispose();
    this.reverbAnalyser?.dispose();
    this.delayAnalyser?.dispose();
    this.initialized = false;
  }
}

// Simple WAV encoder
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
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
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
