import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// ─── Rate-limit retry ───────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let delay = 10_000; // start at 10 s
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < maxAttempts) {
        await new Promise(res => setTimeout(res, delay));
        delay = Math.min(delay * 2, 60_000); // cap at 60 s
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retry attempts reached');
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const NoteSchema = z.object({
  pitch:     z.number().int().min(24).max(108),
  startStep: z.number().int().min(0).max(127),
  duration:  z.number().int().min(1).max(16),
  velocity:  z.number().int().min(40).max(127),
});

export const GeneratedSongSchema = z.object({
  bpm:   z.number().min(60).max(220),
  key:   z.enum(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']),
  scale: z.enum(['major','minor','dorian','phrygian','mixolydian']),
  lead: z.object({
    oscType: z.enum(['sawtooth','square','sine','triangle']),
    notes:   z.array(NoteSchema).min(4).max(64),
  }),
  bass: z.object({
    oscType: z.enum(['sawtooth','square','sine','triangle']),
    notes:   z.array(NoteSchema).min(4).max(64),
  }),
  pad: z.object({
    oscType: z.enum(['sawtooth','square','sine','triangle']),
    notes:   z.array(NoteSchema).min(2).max(32),
  }),
  drums: z.object({
    kick:      z.array(z.boolean()).length(16),
    snare:     z.array(z.boolean()).length(16),
    clap:      z.array(z.boolean()).length(16),
    hihat:     z.array(z.boolean()).length(16),
    openHihat: z.array(z.boolean()).length(16),
    tom:       z.array(z.boolean()).length(16),
    perc:      z.array(z.boolean()).length(16),
    sub808:    z.array(z.boolean()).length(16),
  }),
});

export type GeneratedSong = z.infer<typeof GeneratedSongSchema>;

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional EDM producer. You compose music in JSON format. Output ONLY a valid JSON object — no markdown, no code fences, no explanation, no text outside the JSON.

MIDI PITCHES (memorize):
  Bass range (36-55): C2=36 D2=38 E2=40 F2=41 G2=43 A2=45 B2=47 C3=48 D3=50 E3=52 F3=53 G3=55
  Lead range (60-84): C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 G5=79 A5=81 C6=84
  Pad range (52-76):  E3=52 G3=55 B3=59 C4=60 E4=64 G4=67 B4=71 C5=72 E5=76

SCALES (intervals from root): major=[0,2,4,5,7,9,11] minor=[0,2,3,5,7,8,10] dorian=[0,2,3,5,7,9,10] phrygian=[0,1,3,5,7,8,10] mixolydian=[0,2,4,5,7,9,10]

STEP DURATIONS (16th note grid): 1=16th 2=8th 4=quarter 8=half 16=whole

RULES:
1. Bass notes MUST have pitch 36-55. Lead MUST be 60-84. Pad MUST be 52-76.
2. Velocity MUST be 40-127 integer.
3. Duration MUST be 1-16 integer.
4. Each drum row MUST be exactly 16 boolean values.
5. No note overlaps: for each track, notes sorted by startStep must satisfy note[i].startStep + note[i].duration <= note[i+1].startStep
6. startStep values 0-63 (spread across 4 bars = 64 steps).

GENRE BLUEPRINTS:
dubstep (bpm 138-142): kick=[T,F,F,F,F,F,F,F,T,F,F,F,F,F,F,F] snare=[F,F,F,F,F,F,F,F,T,F,F,F,F,F,F,F] hihat=[T,F,T,F,T,F,T,F,T,F,T,F,T,F,T,F]
techno (bpm 128-138): kick=[T,F,F,F,T,F,F,F,T,F,F,F,T,F,F,F] snare=[F,F,F,F,T,F,F,F,F,F,F,F,T,F,F,F] hihat all true
house (bpm 120-128): kick=[T,F,F,F,T,F,F,F,T,F,F,F,T,F,F,F] snare=[F,F,F,F,T,F,F,F,F,F,F,F,T,F,F,F] offbeat hihat
trap (bpm 130-145): sparse kick, snare on beat 3, rolling hihat
future bass (bpm 150-160): busy kick, clap on 2+4, 8th hihat`;

function buildPrompt(description: string): string {
  return `Compose an EDM track for: "${description}"

Required JSON structure (output ONLY this, no other text):
{
  "bpm": <integer 60-220>,
  "key": <"C"|"C#"|"D"|"D#"|"E"|"F"|"F#"|"G"|"G#"|"A"|"A#"|"B">,
  "scale": <"major"|"minor"|"dorian"|"phrygian"|"mixolydian">,
  "lead": {
    "oscType": <"sawtooth"|"square"|"sine"|"triangle">,
    "notes": [{"pitch":<60-84>,"startStep":<0-63>,"duration":<1-16>,"velocity":<40-127>}, ...]
  },
  "bass": {
    "oscType": <"sawtooth"|"square"|"sine"|"triangle">,
    "notes": [{"pitch":<36-55>,"startStep":<0-63>,"duration":<1-16>,"velocity":<40-127>}, ...]
  },
  "pad": {
    "oscType": <"sawtooth"|"square"|"sine"|"triangle">,
    "notes": [{"pitch":<52-76>,"startStep":<0-63>,"duration":<2-16>,"velocity":<40-127>}, ...]
  },
  "drums": {
    "kick":      [<exactly 16 true/false values>],
    "snare":     [<exactly 16 true/false values>],
    "clap":      [<exactly 16 true/false values>],
    "hihat":     [<exactly 16 true/false values>],
    "openHihat": [<exactly 16 true/false values>],
    "tom":       [<exactly 16 true/false values>],
    "perc":      [<exactly 16 true/false values>],
    "sub808":    [<exactly 16 true/false values>]
  }
}

Generate at least 16 lead notes, 16 bass notes, and 6 pad notes. Make the rhythm interesting with syncopation. Vary velocities.`;
}

// ─── Extraction helpers ────────────────────────────────────────────────────────

/** Pull the first {...} object out of arbitrary text (handles nested braces). */
function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Leniently coerce drum rows to exactly 16 booleans. */
function normalizeDrumRow(row: unknown): boolean[] {
  if (!Array.isArray(row)) return Array(16).fill(false);
  const out: boolean[] = [];
  for (let i = 0; i < 16; i++) {
    const v = row[i];
    out.push(v === true || v === 1 || v === 'true');
  }
  return out;
}

/** Clamp and coerce note fields to valid ranges. */
function normalizeNote(
  n: Record<string, unknown>,
  pitchMin: number,
  pitchMax: number
): { pitch: number; startStep: number; duration: number; velocity: number } | null {
  const pitch     = Math.round(Number(n.pitch));
  const startStep = Math.round(Number(n.startStep ?? n.start_step ?? 0));
  const duration  = Math.round(Number(n.duration ?? 2));
  const velocity  = Math.round(Number(n.velocity ?? 80));

  if (isNaN(pitch) || isNaN(startStep) || isNaN(duration) || isNaN(velocity)) return null;

  return {
    pitch:     Math.max(pitchMin, Math.min(pitchMax, pitch)),
    startStep: Math.max(0, Math.min(127, startStep)),
    duration:  Math.max(1, Math.min(16, duration)),
    velocity:  Math.max(40, Math.min(127, velocity)),
  };
}

/** Remove overlapping notes (sort by startStep, trim duration if needed). */
function deoverlapNotes(
  notes: { pitch: number; startStep: number; duration: number; velocity: number }[]
): typeof notes {
  notes.sort((a, b) => a.startStep - b.startStep);
  for (let i = 1; i < notes.length; i++) {
    const prev = notes[i - 1];
    const cur  = notes[i];
    if (prev.startStep + prev.duration > cur.startStep) {
      prev.duration = Math.max(1, cur.startStep - prev.startStep);
    }
  }
  return notes;
}

// ─── Main generator ────────────────────────────────────────────────────────────

export async function generateSong(
  apiKey: string,
  description: string,
  model: string,
  onProgress: (text: string, done: boolean) => void,
): Promise<GeneratedSong> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  onProgress('Sending request to Claude...', false);

  // Non-streaming for reliability — no risk of accumulation bugs
  const message = await withRetry(() => client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(description) }],
  }));

  const rawText = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text)
    .join('');

  onProgress(rawText, false);

  // Strip markdown fences
  let stripped = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  const jsonStr = extractJson(stripped);
  if (!jsonStr) {
    throw new Error(
      `Claude did not return JSON. Response started with: "${rawText.slice(0, 200)}"`
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error('Claude returned invalid JSON. Try again or simplify your prompt.');
  }

  onProgress(jsonStr, false);

  // ── Lenient normalization ──────────────────────────────────────────────────
  // This handles cases where Claude returns subtly wrong data that Zod would reject

  const coerceDrums = (d: unknown) => {
    if (!d || typeof d !== 'object') return null;
    const dr = d as Record<string, unknown>;
    return {
      kick:      normalizeDrumRow(dr.kick),
      snare:     normalizeDrumRow(dr.snare),
      clap:      normalizeDrumRow(dr.clap),
      hihat:     normalizeDrumRow(dr.hihat),
      openHihat: normalizeDrumRow(dr.openHihat ?? dr.open_hihat ?? dr.openhat),
      tom:       normalizeDrumRow(dr.tom),
      perc:      normalizeDrumRow(dr.perc),
      sub808:    normalizeDrumRow(dr.sub808 ?? dr['808'] ?? dr.bass808),
    };
  };

  const coerceTrack = (t: unknown, pitchMin: number, pitchMax: number) => {
    if (!t || typeof t !== 'object') return null;
    const tr = t as Record<string, unknown>;
    const rawNotes = Array.isArray(tr.notes) ? tr.notes : [];
    const notes = (rawNotes as Record<string, unknown>[])
      .map(n => normalizeNote(n, pitchMin, pitchMax))
      .filter((n): n is NonNullable<typeof n> => n !== null);
    return {
      oscType: (['sawtooth','square','sine','triangle'].includes(tr.oscType as string)
        ? tr.oscType : 'sawtooth') as 'sawtooth'|'square'|'sine'|'triangle',
      notes: deoverlapNotes(notes),
    };
  };

  const normalized = {
    bpm:   Math.max(60, Math.min(220, Math.round(Number(parsed.bpm ?? 128)))),
    key:   (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].includes(parsed.key as string)
      ? parsed.key : 'C') as GeneratedSong['key'],
    scale: (['major','minor','dorian','phrygian','mixolydian'].includes(parsed.scale as string)
      ? parsed.scale : 'minor') as GeneratedSong['scale'],
    lead:  coerceTrack(parsed.lead, 60, 84),
    bass:  coerceTrack(parsed.bass, 36, 55),
    pad:   coerceTrack(parsed.pad,  52, 76),
    drums: coerceDrums(parsed.drums),
  };

  // Fallback notes if Claude returned empty arrays
  if (!normalized.lead || normalized.lead.notes.length < 2) {
    normalized.lead = {
      oscType: 'sawtooth',
      notes: [
        { pitch: 72, startStep: 0, duration: 2, velocity: 90 },
        { pitch: 74, startStep: 4, duration: 2, velocity: 80 },
        { pitch: 76, startStep: 8, duration: 2, velocity: 85 },
        { pitch: 72, startStep: 12, duration: 4, velocity: 88 },
      ],
    };
  }
  if (!normalized.bass || normalized.bass.notes.length < 2) {
    normalized.bass = {
      oscType: 'sawtooth',
      notes: [
        { pitch: 48, startStep: 0, duration: 2, velocity: 100 },
        { pitch: 48, startStep: 4, duration: 2, velocity: 90 },
        { pitch: 43, startStep: 8, duration: 2, velocity: 95 },
        { pitch: 45, startStep: 12, duration: 4, velocity: 92 },
      ],
    };
  }
  if (!normalized.pad || normalized.pad.notes.length < 1) {
    normalized.pad = {
      oscType: 'triangle',
      notes: [
        { pitch: 60, startStep: 0, duration: 8, velocity: 70 },
        { pitch: 62, startStep: 8, duration: 8, velocity: 65 },
      ],
    };
  }
  if (!normalized.drums) {
    normalized.drums = {
      kick:      [true,false,false,false,true,false,false,false,true,false,false,false,true,false,false,false],
      snare:     [false,false,false,false,true,false,false,false,false,false,false,false,true,false,false,false],
      clap:      Array(16).fill(false),
      hihat:     [true,false,true,false,true,false,true,false,true,false,true,false,true,false,true,false],
      openHihat: Array(16).fill(false),
      tom:       Array(16).fill(false),
      perc:      Array(16).fill(false),
      sub808:    Array(16).fill(false),
    };
  }

  // Final Zod validation
  try {
    return GeneratedSongSchema.parse(normalized);
  } catch (zodErr) {
    const msg = zodErr instanceof Error ? zodErr.message : String(zodErr);
    throw new Error(`Song data invalid after normalization: ${msg.slice(0, 200)}`);
  }
}

// ─── V2 Types ───────────────────────────────────────────────────────────────

export type Vibe = 'aggressive' | 'calm' | 'happy' | 'dark' | 'neutral';

export interface SongSection {
  name: string;
  bars: number;
  energy: 'low' | 'medium' | 'high' | 'peak' | 'rising' | 'fading';
}

export interface SongPlan {
  bpm: number;
  key: GeneratedSong['key'];
  scale: GeneratedSong['scale'];
  vibe: Vibe;
  sections: SongSection[];
}

export interface SectionDrums {
  kick: boolean[];
  snare: boolean[];
  clap: boolean[];
  hihat: boolean[];
  openHihat: boolean[];
  tom: boolean[];
  rim: boolean[];
  cymbal: boolean[];
  kick2: boolean[];
  snare2: boolean[];
  crash: boolean[];
  ride: boolean[];
  tomHi: boolean[];
  tomLo: boolean[];
  impact: boolean[];
  reverseSweep: boolean[];
}

export interface SectionPatterns {
  leadPreset: string;
  bassPreset: string;
  padPreset: string;
  lead: { oscType: GeneratedSong['lead']['oscType']; notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> };
  bass: { oscType: GeneratedSong['bass']['oscType']; notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> };
  pad:  { oscType: GeneratedSong['pad']['oscType'];  notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> };
  drums: SectionDrums;
}

export interface GeneratedSongV2 {
  plan: SongPlan;
  sections: Array<{ name: string; patterns: SectionPatterns }>;
}

// ─── V2 helper ────────────────────────────────────────────────────────────────

function coerceTrackV2(
  raw: unknown,
  pitchMin: number,
  pitchMax: number,
  maxSteps?: number,
  minDuration = 1,
): { oscType: 'sawtooth' | 'square' | 'sine' | 'triangle'; notes: Array<{ pitch: number; startStep: number; duration: number; velocity: number }> } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const validOsc = ['sawtooth', 'square', 'sine', 'triangle'];
  const oscType = validOsc.includes(r.oscType as string) ? r.oscType as 'sawtooth' | 'square' | 'sine' | 'triangle' : 'sawtooth';
  if (!Array.isArray(r.notes)) return null;
  const notes = (r.notes as Array<Record<string, unknown>>)
    .filter(n => typeof n === 'object' && n !== null)
    .map(n => {
      const startStep = Math.max(0, Math.min(maxSteps != null ? maxSteps - 1 : 32767, Math.round(Number(n.startStep ?? 0))));
      const rawDur    = Math.max(minDuration, Math.round(Number(n.duration ?? minDuration)));
      const duration  = maxSteps != null ? Math.min(rawDur, maxSteps - startStep) : rawDur;
      return {
        pitch:     Math.max(pitchMin, Math.min(pitchMax, Math.round(Number(n.pitch ?? 60)))),
        startStep,
        duration:  Math.max(minDuration, duration),
        velocity:  Math.max(1, Math.min(127, Math.round(Number(n.velocity ?? 80)))),
      };
    });
  // Remove overlapping notes — same fix V1 applies
  return { oscType, notes: deoverlapNotes(notes) };
}

// ─── Vibe detection ────────────────────────────────────────────────────────

export function detectVibe(description: string): Vibe {
  const d = description.toLowerCase();
  if (/hard|heavy|aggressive|brutal|industrial|metal|distorted|dark\s*energy|crushing|intense|angry/.test(d)) return 'aggressive';
  if (/calm|chill|ambient|soft|peaceful|meditat|lo.?fi|relax|gentle|mellow/.test(d)) return 'calm';
  if (/happy|euphoric|uplifting|rave|festival|joyful|bright|energetic|anthem|summer/.test(d)) return 'happy';
  if (/dark|sinister|evil|horror|ominous|menac|eerie|haunting|grim|bleak/.test(d)) return 'dark';
  return 'neutral';
}

// ─── Planner ──────────────────────────────────────────────────────────────

const VIBE_BPM: Record<Vibe, string> = {
  aggressive: '138–175',
  calm:       '80–115',
  happy:      '125–145',
  dark:       '130–148',
  neutral:    '120–135',
};

const VIBE_SCALE: Record<Vibe, string> = {
  aggressive: 'minor or phrygian',
  calm:       'major or dorian',
  happy:      'major or mixolydian',
  dark:       'minor or phrygian (enforce minor/dark tonality)',
  neutral:    'any',
};

function buildPlannerPrompt(description: string, vibe: Vibe): string {
  return `You are a professional EDM producer. Output ONLY valid JSON — no markdown, no explanation.

Compose a song structure for: "${description}"
Detected vibe: ${vibe}
BPM range for this vibe: ${VIBE_BPM[vibe]}
Scale preference: ${VIBE_SCALE[vibe]}

Return this exact JSON:
{
  "bpm": <integer in vibe range>,
  "key": <"C"|"C#"|"D"|"D#"|"E"|"F"|"F#"|"G"|"G#"|"A"|"A#"|"B">,
  "scale": <"major"|"minor"|"dorian"|"phrygian"|"mixolydian">,
  "vibe": "${vibe}",
  "sections": [
    { "name": <section name>, "bars": <8|16>, "energy": <"low"|"medium"|"high"|"peak"|"rising"|"fading"> }
  ]
}

Rules:
- 6–10 sections total. Never fewer than 6.
- Simple/short prompts: 6–7 sections. Complex/full-track prompts: 8–10 sections.
- Valid section names: Intro, Build, Build 1, Build 2, Drop, Drop 1, Drop 2, Breakdown, Riser, Bridge, Outro, Hook, Verse, Chorus, Pre-Drop, Interlude
- bars MUST be 8 or 16 — never 4, never 32. Short transitions (Riser, Pre-Drop) = 8 bars. Drops and Breakdowns = 16 bars. Intro/Outro = 8 or 16.
- energy "low" = sparse/intro/breakdown, "medium" = building, "high"/"peak" = full drops, "rising" = riser tension, "fading" = outro
- TARGET DURATION: aim for total song length 90–240 seconds. At bpm X: each bar ≈ ${240}/X seconds. Sum all section bars and multiply to verify duration >= 90s.
- For aggressive vibe: include Impact/Drop moments; for calm: fewer sections, longer bars
- ENERGY FLOW RULES (CRITICAL — never violate):
  * A Breakdown (energy=low) must NEVER be immediately followed by a Drop (energy=peak/high). Always insert a Build or Riser between them.
  * Correct pattern: Intro → Build → Drop → Breakdown → Build → Drop → Outro
  * WRONG pattern: Intro → Build → Drop → Breakdown → Drop (no build after breakdown — forbidden)
  * Energy must build progressively to every drop: low/medium → rising → high/peak. Never jump from low directly to peak.`;
}

const SongPlanSchema = z.object({
  bpm: z.number().min(60).max(220),
  key: z.enum(['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']),
  scale: z.enum(['major','minor','dorian','phrygian','mixolydian']),
  vibe: z.enum(['aggressive','calm','happy','dark','neutral']),
  sections: z.array(z.object({
    name: z.string().min(1),
    bars: z.number().int().min(8).max(16).transform(b => (b < 8 ? 8 : b > 16 ? 16 : b)),
    energy: z.enum(['low','medium','high','peak','rising','fading']),
  })).min(6).max(12),
});

export async function planSong(
  apiKey: string,
  description: string,
  model: string,
  vibe: Vibe,
  onProgress: (text: string) => void,
): Promise<SongPlan> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  onProgress('Planning song structure...');

  const message = await withRetry(() => client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPlannerPrompt(description, vibe) }],
  }));

  const rawText = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text).join('');

  const jsonStr = extractJson(rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim());
  if (!jsonStr) throw new Error('Planner did not return JSON');

  let parsed: unknown;
  try { parsed = JSON.parse(jsonStr); } catch { throw new Error('Planner returned invalid JSON'); }

  const result = SongPlanSchema.safeParse(parsed);
  if (!result.success) {
    const p = parsed as Record<string, unknown>;
    return {
      bpm: Math.max(60, Math.min(220, Math.round(Number(p.bpm ?? 128)))),
      key: (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].includes(p.key as string) ? p.key : 'A') as SongPlan['key'],
      scale: (['major','minor','dorian','phrygian','mixolydian'].includes(p.scale as string) ? p.scale : 'minor') as SongPlan['scale'],
      vibe,
      sections: Array.isArray(p.sections) && (p.sections as unknown[]).length > 0
        ? (p.sections as Array<Record<string,unknown>>).map(s => ({
            name: String(s.name ?? 'Section'),
            bars: Math.max(8, Math.min(16, Math.round(Number(s.bars ?? 8)))),
            energy: (['low','medium','high','peak','rising','fading'].includes(s.energy as string) ? s.energy : 'medium') as SongSection['energy'],
          }))
        : [
            { name: 'Intro',      bars: 8,  energy: 'low'    as const },
            { name: 'Build 1',    bars: 8,  energy: 'medium' as const },
            { name: 'Drop 1',     bars: 16, energy: 'peak'   as const },
            { name: 'Breakdown',  bars: 8,  energy: 'low'    as const },
            { name: 'Build 2',    bars: 8,  energy: 'rising' as const },
            { name: 'Drop 2',     bars: 16, energy: 'peak'   as const },
            { name: 'Outro',      bars: 8,  energy: 'fading' as const },
          ],
    };
  }
  return result.data;
}

// ─── Composer ─────────────────────────────────────────────────────────────

const VIBE_COMPOSER_HINTS: Record<Vibe, string> = {
  aggressive: 'Use hard distorted timbres (sawtooth/square), dense drums at velocity 100-127, short sharp attacks, minimal reverb. Kick and snare every beat for high/peak energy. Use kick2 (row 8) and impact (row 14) for drops.',
  calm:       'Use soft timbres (sine/triangle), sparse drums at velocity 40-70, long attacks and releases, heavy reverb on pads. Only kick/shaker/ride for low energy sections.',
  happy:      'Use bright sawtooth leads, clap-heavy drums at velocity 80-110, busy mid-high frequencies. Uplifting chord motion (I-V-vi-IV patterns preferred).',
  dark:       'Enforce minor/phrygian scale. Low-cut heavy bass, sparse dark drums. Sub and tom dominate. High reverb decay (3-6s). Velocity 60-100.',
  neutral:    'Balanced drum density, medium velocity 70-100, standard EDM patterns.',
};

const ENERGY_DRUM_HINTS: Record<SongSection['energy'], string> = {
  low:     'Sparse drums: kick on beat 1 only, maybe hihat. No snare. Drums velocity 50-70. Lead and bass: few sparse notes.',
  medium:  'Building: kick + snare on 1+3, 8th hihats, some syncopation. Velocity 70-90. 8-12 lead notes.',
  high:    'Full: 4-on-floor kick, snare on 2+4, 16th hihats, clap. Velocity 90-115. Dense 16+ lead notes.',
  peak:    'Maximum: all major drum rows active, 16th hihats + clap + open hihat accents. Velocity 100-127. Very dense notes.',
  rising:  'Riser: skip kick and snare entirely. Use only hihat building to 16th notes, maybe reverseSweep row. Lead plays ascending run.',
  fading:  'Outro: gradual removal. Keep kick + soft hihat only. Velocity drops to 40-60. Very sparse lead/bass.',
};

const PRESET_HINTS: Record<Vibe, { lead: string; bass: string; pad: string }> = {
  aggressive: { lead: 'Reese Screech or Distorted Square', bass: 'Distorted Bass or Reese Bass', pad: 'Dark Pad' },
  calm:       { lead: 'Pluck or FM Bell',                  bass: 'Sub Bass or Portamento Bass',   pad: 'Lush Pad or Choir Pad' },
  happy:      { lead: 'Supersaw or Acid Lead',             bass: 'FM Bass or Portamento Bass',    pad: 'Lush Pad' },
  dark:       { lead: 'Distorted Square or Acid Lead',     bass: 'Reese Bass or Sub Bass',        pad: 'Dark Pad' },
  neutral:    { lead: 'Supersaw or Pluck',                 bass: 'Reese Bass or FM Bass',         pad: 'Lush Pad or String Pad' },
};

function buildComposerPrompt(plan: SongPlan, section: SongSection, sectionIdx: number, assignedLeadPreset: string): string {
  const steps = section.bars * 16;
  const presetHint = PRESET_HINTS[plan.vibe];
  return `You are a professional EDM producer. Output ONLY valid JSON — no markdown, no explanation.

Song context: key=${plan.key}, scale=${plan.scale}, bpm=${plan.bpm}, vibe=${plan.vibe}
Section ${sectionIdx + 1}: "${section.name}", ${section.bars} bars (${steps} steps total), energy=${section.energy}

VIBE RULES: ${VIBE_COMPOSER_HINTS[plan.vibe]}
ENERGY RULES: ${ENERGY_DRUM_HINTS[section.energy]}

LEAD PRESET ASSIGNMENT (MANDATORY): You MUST set leadPreset="${assignedLeadPreset}" — do not use any other lead preset.
This preset is used consistently across the entire song for coherence. Honour this assignment exactly.
bass hint: "${presetHint.bass}", pad hint: "${presetHint.pad}"

MIDI PITCHES: Bass(36-55): C2=36 D2=38 E2=40 F2=41 G2=43 A2=45 B2=47 C3=48 D3=50 E3=52 G3=55
              Lead(60-84): C4=60 D4=62 E4=64 F4=65 G4=67 A4=69 B4=71 C5=72 D5=74 E5=76 G5=79
              Pad(52-76): E3=52 G3=55 B3=59 C4=60 E4=64 G4=67 B4=71 C5=72

DRUM ROWS: row0=kick row1=snare row2=clap row3=hihat row4=openHihat row5=tom row6=rim row7=cymbal
           row8=kick2 row9=snare2 row10=crash row11=ride row12=tomHi row13=tomLo row14=impact row15=reverseSweep

Output this exact JSON:
{
  "leadPreset": "${assignedLeadPreset}",
  "bassPreset": <one of: "Reese Bass","FM Bass","Distorted Bass","Sub Bass","Wobble Bass","Portamento Bass">,
  "padPreset":  <one of: "Choir Pad","Lush Pad","Dark Pad","String Pad">,
  "lead": { "oscType": <"sawtooth"|"square"|"sine"|"triangle">, "notes": [{"pitch":<60-84>,"startStep":<0-${steps-1}>,"duration":<1-16>,"velocity":<40-127>},...] },
  "bass": { "oscType": <"sawtooth"|"square"|"sine">, "notes": [{"pitch":<36-55>,"startStep":<0-${steps-1}>,"duration":<4-16>,"velocity":<85-127>},...] },
  "pad":  { "oscType": <"sawtooth"|"square"|"sine"|"triangle">, "notes": [{"pitch":<52-76>,"startStep":<0-${steps-1}>,"duration":<8-16>,"velocity":<40-90>},...] },
  "drums": {
    "kick":        [<16 true/false>], "snare":       [<16 true/false>], "clap":        [<16 true/false>],
    "hihat":       [<16 true/false>], "openHihat":   [<16 true/false>], "tom":         [<16 true/false>],
    "rim":         [<16 true/false>], "cymbal":      [<16 true/false>], "kick2":       [<16 true/false>],
    "snare2":      [<16 true/false>], "crash":       [<16 true/false>], "ride":        [<16 true/false>],
    "tomHi":       [<16 true/false>], "tomLo":       [<16 true/false>], "impact":      [<16 true/false>],
    "reverseSweep":[<16 true/false>]
  }
}

Rules:
- No note overlaps. Notes sorted by startStep. note[i].startStep + note[i].duration <= note[i+1].startStep.
- Bass CRITICAL: duration MUST be >= 4 steps (quarter note minimum) for felt low-end. Velocity MUST be >= 85 for punch. Use pitch 36-48 (C2-C3) for sub-bass weight. At least one note per 2 bars.
- Minimum note counts by energy:
  lead:  low=4  medium=8  high=14 peak=16 (use VARIED rhythms — NOT just uniform 8th notes)
  bass:  low=4  medium=6  high=10 peak=14 (bass must be HEAVY and FELT — never thin or short)
  pad:   low=2  medium=4  high=6  peak=8  (long chords, duration 8-16 steps — atmospheric sustain)`;
}

export async function composeSection(
  apiKey: string,
  plan: SongPlan,
  section: SongSection,
  sectionIdx: number,
  assignedLeadPreset: string,
  model: string,
  onProgress: (text: string) => void,
): Promise<SectionPatterns> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  onProgress(`Composing ${section.name}...`);

  const message = await withRetry(() => client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildComposerPrompt(plan, section, sectionIdx, assignedLeadPreset) }],
  }));

  const rawText = message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text).join('');

  const stripped = rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
  const jsonStr = extractJson(stripped);
  if (!jsonStr) throw new Error(`Composer returned no JSON for section "${section.name}"`);

  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(jsonStr) as Record<string, unknown>; }
  catch { throw new Error(`Composer returned invalid JSON for section "${section.name}"`); }

  return parseComposerResponse(parsed, section, assignedLeadPreset);
}

function parseComposerResponse(
  parsed: Record<string, unknown>,
  section: SongSection,
  assignedLeadPreset: string,
): SectionPatterns {
  const VALID_PRESETS_LEAD = ['Supersaw','Acid Lead','FM Bell','Reese Screech','Pluck','Distorted Square'];
  const VALID_PRESETS_BASS = ['Reese Bass','FM Bass','Distorted Bass','Sub Bass','Wobble Bass','Portamento Bass'];
  const VALID_PRESETS_PAD  = ['Choir Pad','Lush Pad','Dark Pad','String Pad'];

  const coerceDrum16 = (key: string): boolean[] => {
    const row = (parsed.drums as Record<string, unknown>)?.[key];
    return normalizeDrumRow(row);
  };

  const sectionSteps = section.bars * 16;
  const leadTrack = coerceTrackV2(parsed.lead, 60, 84, sectionSteps, 1);
  const bassTrack = coerceTrackV2(parsed.bass, 36, 55, sectionSteps, 4);
  const padTrack  = coerceTrackV2(parsed.pad,  52, 76, sectionSteps, 1);

  return {
    leadPreset: VALID_PRESETS_LEAD.includes(parsed.leadPreset as string) ? (parsed.leadPreset as string) : assignedLeadPreset,
    bassPreset: VALID_PRESETS_BASS.includes(parsed.bassPreset as string) ? (parsed.bassPreset as string) : VALID_PRESETS_BASS[0],
    padPreset:  VALID_PRESETS_PAD.includes(parsed.padPreset  as string)  ? (parsed.padPreset  as string) : VALID_PRESETS_PAD[0],
    lead: (leadTrack && leadTrack.notes.length >= 1) ? leadTrack : {
      oscType: 'sawtooth',
      notes: [
        { pitch: 72, startStep: 0, duration: 2, velocity: 90 },
        { pitch: 74, startStep: 4, duration: 2, velocity: 80 },
        { pitch: 76, startStep: 8, duration: 2, velocity: 85 },
        { pitch: 72, startStep: 12, duration: 4, velocity: 88 },
      ],
    },
    bass: (bassTrack && bassTrack.notes.length >= 2) ? bassTrack : {
      oscType: 'sawtooth',
      notes: [
        { pitch: 48, startStep: 0,  duration: 4, velocity: 100 },
        { pitch: 48, startStep: 8,  duration: 4, velocity: 95  },
        { pitch: 43, startStep: 16, duration: 4, velocity: 100 },
        { pitch: 45, startStep: 24, duration: 8, velocity: 95  },
      ],
    },
    pad: (padTrack && padTrack.notes.length >= 1) ? padTrack : {
      oscType: 'triangle',
      notes: [
        { pitch: 60, startStep: 0,  duration: 8, velocity: 65 },
        { pitch: 64, startStep: 8,  duration: 8, velocity: 60 },
      ],
    },
    drums: {
      kick:         coerceDrum16('kick'),
      snare:        coerceDrum16('snare'),
      clap:         coerceDrum16('clap'),
      hihat:        coerceDrum16('hihat'),
      openHihat:    coerceDrum16('openHihat'),
      tom:          coerceDrum16('tom'),
      rim:          coerceDrum16('rim'),
      cymbal:       coerceDrum16('cymbal'),
      kick2:        coerceDrum16('kick2'),
      snare2:       coerceDrum16('snare2'),
      crash:        coerceDrum16('crash'),
      ride:         coerceDrum16('ride'),
      tomHi:        coerceDrum16('tomHi'),
      tomLo:        coerceDrum16('tomLo'),
      impact:       coerceDrum16('impact'),
      reverseSweep: coerceDrum16('reverseSweep'),
    },
  };
}

export async function generateVariation(
  apiKey: string,
  model: string,
  plan: SongPlan,
  section: SongSection,
  sectionIdx: number,
  existingPatterns: SectionPatterns,
  howDifferent: number,
  onProgress: (text: string) => void,
): Promise<SectionPatterns> {
  const instructions =
    howDifferent < 30
      ? 'Make SUBTLE variations only — change rhythmic timing and velocities slightly. Keep the same melody contour and notes mostly intact.'
      : howDifferent < 70
      ? 'Rewrite the melody with different notes but preserve the overall energy, density, and feel. Same key and scale.'
      : 'Fully recompose this section. Only the key, scale, and energy level must be preserved. Everything else is free.';

  const basePrompt = buildComposerPrompt(plan, section, sectionIdx, existingPatterns.leadPreset);
  const variationPrompt = basePrompt + `\n\nVARIATION INSTRUCTIONS: ${instructions}\n\nExisting lead notes for reference: ${JSON.stringify(existingPatterns.lead.notes.slice(0, 8))}`;

  onProgress('Generating variation...');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const message = await withRetry(() => client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: variationPrompt }],
  }));

  const rawText = message.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map(c => c.text).join('');
  const jsonStr = extractJson(rawText.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim());
  if (!jsonStr) throw new Error('Variation returned no JSON');
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(jsonStr) as Record<string, unknown>; } catch { throw new Error('Variation returned invalid JSON'); }

  return parseComposerResponse(parsed, section, existingPatterns.leadPreset);
}

// ─── Main V2 entry point ───────────────────────────────────────────────────

export async function generateFullSong(
  apiKey: string,
  description: string,
  model: string,
  onProgress: (text: string, sectionsDone: string[]) => void,
): Promise<GeneratedSongV2> {
  const vibe = detectVibe(description);
  const sectionsDone: string[] = [];

  const plan = await planSong(apiKey, description, model, vibe, text => onProgress(text, sectionsDone));
  sectionsDone.push('structure');
  onProgress(`Structure planned: ${plan.sections.map(s => s.name).join(' \u2192 ')}`, [...sectionsDone]);

  const sections: GeneratedSongV2['sections'] = [];

  // Pick ONE lead preset for the entire song based on vibe — consistent within a song,
  // but the pool gives variety across different song generations.
  const LEAD_PRESET_BY_VIBE: Record<Vibe, string[]> = {
    aggressive: ['Reese Screech', 'Distorted Square'],
    calm:       ['FM Bell', 'Pluck'],
    happy:      ['Supersaw', 'Acid Lead'],
    dark:       ['Distorted Square', 'Reese Screech'],
    neutral:    ['Supersaw', 'Pluck', 'Acid Lead', 'FM Bell'],
  };
  const vibePool = LEAD_PRESET_BY_VIBE[vibe];
  const songLeadPreset = vibePool[Math.floor(Math.random() * vibePool.length)];

  for (let i = 0; i < plan.sections.length; i++) {
    const section = plan.sections[i];
    const patterns = await composeSection(apiKey, plan, section, i, songLeadPreset, model, text => onProgress(text, [...sectionsDone]));
    sections.push({ name: section.name, patterns });
    sectionsDone.push(section.name);
    onProgress(`${section.name} \u2713`, [...sectionsDone]);
  }

  return { plan, sections };
}

export async function generateLyrics(
  apiKey: string,
  model: string,
  description: string,
  plan: SongPlan,
  onProgress: (text: string) => void,
): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  onProgress('Generating lyrics...');

  const sectionList = plan.sections.map((s, i) => `${i + 1}. ${s.name} (${s.bars} bars, ${s.energy} energy)`).join('\n');

  const message = await withRetry(() => client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Write lyrics for an EDM track. Song description: "${description}". Vibe: ${plan.vibe}. Key: ${plan.key} ${plan.scale}. BPM: ${plan.bpm}.

Song structure:
${sectionList}

Write lyrics for each section. Sections like Intro/Riser/Outro can have short phrases or be marked [instrumental]. Keep it authentic to the genre. Format:

[Section Name]
lyrics here

[Next Section]
lyrics here`,
    }],
  }));

  return message.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text).join('');
}
