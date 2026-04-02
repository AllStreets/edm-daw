import * as Tone from 'tone';
import type { SynthSettings } from '../types';

export interface SynthChain {
  synth: Tone.PolySynth;
  filter: Tone.Filter;
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay | Tone.PingPongDelay;
  chorus: Tone.Chorus;
  distortion: Tone.Distortion;
  lfo: Tone.LFO;
  gain: Tone.Gain;
  dispose: () => void;
}

// Tone.js PolySynth oscillator uses "fat" prefix for unison / multiple oscillator types
// Use standard TypeWithPartials format (e.g. "sawtooth2" means 2 harmonics, bare = basic)
// For PolySynth, use 'fatsaw', 'fatsquare' etc., or use Tone.Synth with direct type prop
type OmniType = 'sawtooth' | 'square' | 'sine' | 'triangle';

function getOscType(type: string): OmniType {
  switch (type) {
    case 'sawtooth': return 'sawtooth';
    case 'square':   return 'square';
    case 'triangle': return 'triangle';
    case 'sine':     return 'sine';
    case 'noise':    return 'sawtooth'; // fallback
    default:         return 'sawtooth';
  }
}

// Custom Synth voice that uses the correct type
function makeSynthVoice(oscType: OmniType, ampEnv: SynthSettings['ampEnv']): Tone.Synth {
  const synth = new Tone.Synth({
    envelope: {
      attack: ampEnv.attack,
      decay: ampEnv.decay,
      sustain: ampEnv.sustain,
      release: ampEnv.release,
    },
  });
  // Set oscillator type after construction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (synth.oscillator as any).type = oscType;
  return synth;
}

/**
 * Creates a full synthesizer signal chain using Tone.js
 */
export function createSynth(
  settings: SynthSettings,
  destination: Tone.ToneAudioNode
): SynthChain {
  const { oscillator1, filter: filterSettings, ampEnv, effects, lfo: lfoSettings } = settings;

  // ----- Gain Output -----
  const gain = new Tone.Gain(oscillator1.volume);

  // ----- PolySynth -----
  // We create PolySynth with Tone.Synth voice, then post-configure oscillator type
  const synth = new Tone.PolySynth<Tone.Synth>({
    voice: Tone.Synth,
    options: {
      envelope: {
        attack: ampEnv.attack,
        decay: ampEnv.decay,
        sustain: ampEnv.sustain,
        release: ampEnv.release,
      },
    },
  });

  // Suppress the oscillator type inference issue by using 'set' after creation
  const oscType = getOscType(oscillator1.type);
  try {
    // This works around the TypeWithPartials issue
    synth.set({ oscillator: { type: `${oscType}` as never } });
  } catch {
    // Ignore type coercion errors
  }

  // ----- Filter -----
  const filter = new Tone.Filter({
    type: filterSettings.type,
    frequency: filterSettings.cutoff,
    Q: filterSettings.resonance * 20,
    rolloff: -24,
  });

  // ----- LFO -----
  const lfo = new Tone.LFO({
    type: lfoSettings.shape,
    frequency: lfoSettings.rate,
    min: 0,
    max: 1,
    amplitude: lfoSettings.on ? lfoSettings.amount : 0,
  });

  if (lfoSettings.target === 'filter') {
    lfo.min = filterSettings.cutoff * 0.1;
    lfo.max = filterSettings.cutoff * 2;
    lfo.connect(filter.frequency);
  }

  // ----- Effects -----
  const reverb = new Tone.Reverb({
    decay: effects.reverb.decay,
    preDelay: effects.reverb.preDelay,
    wet: effects.reverb.on ? effects.reverb.wet : 0,
  });
  reverb.generate().catch(() => {});

  let delay: Tone.FeedbackDelay | Tone.PingPongDelay;
  if (effects.delay.pingPong) {
    delay = new Tone.PingPongDelay({
      delayTime: effects.delay.time,
      feedback: effects.delay.feedback,
      wet: effects.delay.on ? effects.delay.wet : 0,
    });
  } else {
    delay = new Tone.FeedbackDelay({
      delayTime: effects.delay.time,
      feedback: effects.delay.feedback,
      wet: effects.delay.on ? effects.delay.wet : 0,
    });
  }

  const chorus = new Tone.Chorus({
    frequency: effects.chorus.rate,
    delayTime: effects.chorus.delay,
    depth: effects.chorus.depth,
    wet: effects.chorus.on ? effects.chorus.wet : 0,
  });
  chorus.start();

  const distortion = new Tone.Distortion({
    distortion: effects.distortion.amount,
    wet: effects.distortion.on ? effects.distortion.wet : 0,
  });

  // ----- Signal Chain -----
  synth.connect(filter);
  filter.connect(gain);
  gain.connect(chorus);
  chorus.connect(distortion);
  distortion.connect(delay);
  delay.connect(reverb);
  reverb.connect(destination);

  if (lfoSettings.on) {
    lfo.start();
  }

  const dispose = () => {
    lfo.stop();
    lfo.dispose();
    synth.dispose();
    filter.dispose();
    gain.dispose();
    chorus.dispose();
    distortion.dispose();
    delay.dispose();
    reverb.dispose();
  };

  return { synth, filter, reverb, delay, chorus, distortion, lfo, gain, dispose };
}

/** Round any value within `threshold` of 0 to exactly 0, preventing Tone.js range errors. */
function snapToZero(v: number, threshold = 1e-6): number {
  return Math.abs(v) < threshold ? 0 : v;
}

/**
 * Updates all parameters of an existing synth chain
 */
export function updateSynth(chain: SynthChain, settings: SynthSettings): void {
  const { oscillator1, filter: filterSettings, ampEnv, effects, lfo: lfoSettings } = settings;

  // Update oscillator type via set (avoids TypeWithPartials inference)
  const oscType = getOscType(oscillator1.type);
  try {
    chain.synth.set({
      envelope: {
        attack: ampEnv.attack,
        decay: ampEnv.decay,
        sustain: ampEnv.sustain,
        release: ampEnv.release,
      },
    });
    chain.synth.set({ oscillator: { type: `${oscType}` as never } });
  } catch {
    // ignore
  }

  // Update gain
  chain.gain.gain.rampTo(snapToZero(oscillator1.volume), 0.05);

  // Update filter
  chain.filter.type = filterSettings.type;
  chain.filter.frequency.rampTo(Math.max(20, snapToZero(filterSettings.cutoff)), 0.05);
  chain.filter.Q.rampTo(snapToZero(filterSettings.resonance * 20), 0.05);

  // Update reverb
  try { chain.reverb.wet.rampTo(snapToZero(effects.reverb.on ? effects.reverb.wet : 0), 0.1); } catch { /* IR not ready */ }

  // Update delay
  try {
    chain.delay.wet.rampTo(snapToZero(effects.delay.on ? effects.delay.wet : 0), 0.1);
    chain.delay.feedback.rampTo(snapToZero(effects.delay.feedback), 0.1);
  } catch { /* not ready */ }

  // Update chorus
  chain.chorus.wet.rampTo(snapToZero(effects.chorus.on ? effects.chorus.wet : 0), 0.1);

  // Update distortion
  chain.distortion.wet.rampTo(snapToZero(effects.distortion.on ? effects.distortion.wet : 0), 0.1);
  chain.distortion.distortion = snapToZero(effects.distortion.amount);

  // Update LFO
  chain.lfo.frequency.rampTo(Math.max(0.01, snapToZero(lfoSettings.rate)), 0.1);
  chain.lfo.amplitude.rampTo(snapToZero(lfoSettings.on ? lfoSettings.amount : 0), 0.1);
  chain.lfo.type = lfoSettings.shape;

  if (lfoSettings.on && chain.lfo.state !== 'started') {
    chain.lfo.start();
  } else if (!lfoSettings.on && chain.lfo.state === 'started') {
    chain.lfo.stop();
  }
}

// Export the helper for use in AudioEngine
export { makeSynthVoice };
