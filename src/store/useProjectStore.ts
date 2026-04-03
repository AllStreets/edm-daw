import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as Tone from 'tone';
import type {
  Project,
  Track,
  Pattern,
  Note,
  Scene,
  Effect,
  SynthSettings,
  TrackEffect,
  TrackFXType,
  TrackFXSettings,
} from '../types';
import type { GeneratedSongV2 } from '../services/ClaudeSongGenerator';
import {
  defaultTrack,
  defaultPattern,
  defaultSynthSettings,
} from '../types';
import { audioEngine } from '../engine/AudioEngine';
import { downloadBlob, blobToNormalizedWav } from '../utils/audioUtils';

// =====================================================
// Default project factory
// =====================================================

function createDefaultProject(): Project {
  const now = new Date().toISOString();

  const leadPattern = defaultPattern({ name: 'Lead 1', color: '#9945ff' });
  const bassPattern = defaultPattern({ name: 'Bass 1', color: '#00d4ff' });
  const drumPattern = defaultPattern({ name: 'Drums 1', color: '#ff0080' });
  const padPattern  = defaultPattern({ name: 'Pad 1',  color: '#00ff88' });

  const leadTrack: Track = defaultTrack({
    id: 'track-lead',
    name: 'Lead Synth',
    type: 'synth',
    color: '#9945ff',
    patterns: [leadPattern],
  });

  const bassTrack: Track = defaultTrack({
    id: 'track-bass',
    name: 'Bass',
    type: 'synth',
    color: '#00d4ff',
    patterns: [bassPattern],
  });

  const drumTrack: Track = defaultTrack({
    id: 'track-drums',
    name: 'Drums',
    type: 'drum',
    color: '#ff0080',
    patterns: [drumPattern],
    synthSettings: defaultSynthSettings(),
  });

  const padTrack: Track = defaultTrack({
    id: 'track-pad',
    name: 'Pad',
    type: 'synth',
    color: '#00ff88',
    patterns: [padPattern],
  });

  const scenes: Scene[] = [
    { id: 'scene-1', name: 'Intro', clips: {} },
    { id: 'scene-2', name: 'Drop', clips: {} },
    { id: 'scene-3', name: 'Breakdown', clips: {} },
    { id: 'scene-4', name: 'Outro', clips: {} },
  ];

  return {
    id: crypto.randomUUID(),
    name: 'Untitled Project',
    bpm: 140,
    timeSignature: [4, 4],
    tracks: [leadTrack, bassTrack, drumTrack, padTrack],
    scenes,
    masterVolume: 0.8,
    masterCompressor: {
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
      on: true,
    },
    createdAt: now,
    modifiedAt: now,
  };
}

// =====================================================
// Store types
// =====================================================

export type ActiveView = 'session' | 'arrangement' | 'mixer';

interface ProjectState {
  project: Project;
  activeView: ActiveView;
  selectedTrackId: string | null;
  selectedPatternId: string | null;
  selectedClipId: string | null;
  showPianoRoll: boolean;
  showSynthEditor: boolean;
  showEffectsRack: boolean;
  openFxTrackId: string | null;
  isPlaying: boolean;
  isRecording: boolean;
  loopEnabled: boolean;
  currentStep: number;
  activeSceneId: string | null;
  undoStack: Project[];
  redoStack: Project[];

  // Actions
  setActiveView: (view: ActiveView) => void;
  selectTrack: (id: string | null) => void;
  selectPattern: (id: string | null) => void;
  selectClip: (id: string | null) => void;
  togglePianoRoll: () => void;
  toggleSynthEditor: () => void;
  toggleEffectsRack: () => void;
  openFxPanel: (trackId: string) => void;
  closeFxPanel: () => void;
  addTrackEffect: (trackId: string, fxType: TrackFXType) => void;
  removeTrackEffect: (trackId: string, effectId: string) => void;
  updateTrackEffect: (trackId: string, effectId: string, settings: Partial<TrackFXSettings>) => void;
  toggleTrackEffect: (trackId: string, effectId: string) => void;

  sidechainEnabled: boolean;
  sidechainAmount: number;
  sidechainRelease: number;
  sidechainSourceTrackId: string | null;
  sidechainTargetOverrides: Record<string, boolean>;
  setSidechainEnabled: (enabled: boolean) => void;
  setSidechainAmount: (amount: number) => void;
  setSidechainRelease: (release: number) => void;
  setSidechainSource: (trackId: string | null) => void;
  toggleSidechainTarget: (trackId: string) => void;

  swingAmount: number;
  setSwingAmount: (amount: number) => void;

  generatedSong: GeneratedSongV2 | null;
  setGeneratedSong: (song: GeneratedSongV2 | null) => void;
  generateClipVariation: (trackId: string, sceneId: string, howDifferent: number) => Promise<void>;

  exportSong: (onProgress: (msg: string) => void) => Promise<void>;

  setBPM: (bpm: number) => void;
  play: () => Promise<void>;
  stop: () => void;
  toggleLoop: () => void;
  setActiveSceneId: (id: string | null) => void;
  pause: () => void;
  record: () => void;
  startRecording: () => void;
  stopRecording: () => void;

  addTrack: (type: Track['type']) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, changes: Partial<Track>) => void;
  setTrackVolume: (id: string, vol: number) => void;
  setTrackPan: (id: string, pan: number) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  toggleArmed: (id: string) => void;

  addPattern: (trackId: string) => void;
  updatePattern: (trackId: string, patternId: string, changes: Partial<Pattern>) => void;
  toggleStep: (trackId: string, patternId: string, drumRow: number, step: number) => void;
  setStepVelocity: (trackId: string, patternId: string, drumRow: number, step: number, velocity: number) => void;
  addNote: (trackId: string, patternId: string, note: Note) => void;
  removeNote: (trackId: string, patternId: string, noteId: string) => void;
  updateNote: (trackId: string, patternId: string, noteId: string, changes: Partial<Note>) => void;

  addScene: () => void;
  addNamedScene: (name: string) => string;  // returns the new scene's id
  addPatternToTrack: (trackId: string, pattern: Pattern) => void;
  removeScene: (id: string) => void;
  updateScene: (id: string, changes: Partial<Scene>) => void;
  assignClipToScene: (sceneId: string, trackId: string, clipId: string | null) => void;
  launchScene: (sceneId: string, once?: boolean) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;

  updateSynthSettings: (trackId: string, settings: SynthSettings) => void;
  setMasterVolume: (vol: number) => void;
  addEffect: (trackId: string, type: Effect['type']) => void;
  removeEffect: (trackId: string, effectId: string) => void;
  updateEffect: (trackId: string, effectId: string, settings: Effect['settings']) => void;

  saveProject: () => void;
  loadProject: (json: string) => void;
  undo: () => void;
  redo: () => void;
  setCurrentStep: (step: number) => void;

  // Internal
  _pushUndo: () => void;
}

// =====================================================
// Store implementation
// =====================================================

export const useProjectStore = create<ProjectState>()(
  immer((set, get) => ({
    project: createDefaultProject(),
    activeView: 'session',
    selectedTrackId: 'track-lead',
    selectedPatternId: null,
    selectedClipId: null,
    showPianoRoll: false,
    showSynthEditor: false,
    showEffectsRack: false,
    openFxTrackId: null,
    sidechainEnabled: true,
    sidechainAmount: 0.6,
    sidechainRelease: 150,
    sidechainSourceTrackId: null,
    sidechainTargetOverrides: {},
    swingAmount: 0,
    generatedSong: null,
    isPlaying: false,
    isRecording: false,
    loopEnabled: false,
    currentStep: 0,
    activeSceneId: null,
    undoStack: [],
    redoStack: [],

    _pushUndo() {
      const state = get();
      set(draft => {
        draft.undoStack.push(JSON.parse(JSON.stringify(state.project)));
        if (draft.undoStack.length > 50) {
          draft.undoStack.shift();
        }
        draft.redoStack = [];
      });
    },

    setActiveView(view) {
      set(draft => { draft.activeView = view; });
    },

    selectTrack(id) {
      set(draft => { draft.selectedTrackId = id; });
    },

    selectPattern(id) {
      set(draft => { draft.selectedPatternId = id; });
    },

    selectClip(id) {
      set(draft => { draft.selectedClipId = id; });
    },

    togglePianoRoll() {
      set(draft => { draft.showPianoRoll = !draft.showPianoRoll; });
    },

    toggleSynthEditor() {
      set(draft => { draft.showSynthEditor = !draft.showSynthEditor; });
    },

    toggleEffectsRack() {
      set(draft => { draft.showEffectsRack = !draft.showEffectsRack; });
    },

    openFxPanel(trackId) {
      set(draft => { draft.openFxTrackId = trackId; });
    },

    closeFxPanel() {
      set(draft => { draft.openFxTrackId = null; });
    },

    addTrackEffect(trackId, fxType) {
      get()._pushUndo();
      const defaults: Record<TrackFXType, TrackFXSettings> = {
        reverb:     { fxType: 'reverb',     wet: 0.3,  decay: 2,      preDelay: 0.01 },
        delay:      { fxType: 'delay',      wet: 0.3,  time: '8n',    feedback: 0.3,  pingPong: false },
        filter:     { fxType: 'filter',     filterType: 'lowpass', frequency: 2000, Q: 1 },
        distortion: { fxType: 'distortion', wet: 0.5,  distortion: 0.3 },
        compressor: { fxType: 'compressor', threshold: -24, ratio: 4, attack: 3, release: 150, knee: 6 },
      };
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.effects.push({ id: crypto.randomUUID(), on: true, settings: defaults[fxType] });
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
      const track = get().project.tracks.find(t => t.id === trackId);
      if (track) audioEngine.applyTrackEffects(trackId, track.effects);
    },

    removeTrackEffect(trackId, effectId) {
      get()._pushUndo();
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.effects = track.effects.filter(e => e.id !== effectId);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
      const track = get().project.tracks.find(t => t.id === trackId);
      if (track) audioEngine.applyTrackEffects(trackId, track.effects);
    },

    updateTrackEffect(trackId, effectId, settings) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        const effect = track?.effects.find(e => e.id === effectId);
        if (effect) Object.assign(effect.settings, settings);
      });
      const track = get().project.tracks.find(t => t.id === trackId);
      if (track) audioEngine.applyTrackEffects(trackId, track.effects);
    },

    toggleTrackEffect(trackId, effectId) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        const effect = track?.effects.find(e => e.id === effectId);
        if (effect) effect.on = !effect.on;
      });
      const track = get().project.tracks.find(t => t.id === trackId);
      if (track) audioEngine.applyTrackEffects(trackId, track.effects);
    },

    setSidechainEnabled(enabled) {
      set(draft => { draft.sidechainEnabled = enabled; });
      if (!enabled) audioEngine.teardownSidechain();
    },
    setSidechainAmount(amount) {
      set(draft => { draft.sidechainAmount = amount; });
    },
    setSidechainRelease(release) {
      set(draft => { draft.sidechainRelease = release; });
    },
    setSidechainSource(trackId) {
      set(draft => { draft.sidechainSourceTrackId = trackId; });
    },
    toggleSidechainTarget(trackId) {
      set(draft => {
        const current = draft.sidechainTargetOverrides[trackId];
        draft.sidechainTargetOverrides[trackId] = current === false ? true : false;
      });
    },

    setSwingAmount(amount) {
      set(draft => { draft.swingAmount = amount; });
    },

    setGeneratedSong(song) {
      set(draft => { draft.generatedSong = song; });
    },

    async generateClipVariation(trackId, sceneId, howDifferent) {
      const { project, generatedSong } = get();
      if (!generatedSong) return;

      const scene = project.scenes.find(s => s.id === sceneId);
      const clipId = scene?.clips[trackId];
      const track = project.tracks.find(t => t.id === trackId);
      const pattern = track?.patterns.find(p => p.id === clipId);
      if (!pattern) return;

      const sectionIdx = generatedSong.sections.findIndex(s => s.name === scene?.name);
      const sectionData = generatedSong.sections[sectionIdx >= 0 ? sectionIdx : 0];
      const section = generatedSong.plan.sections[sectionIdx >= 0 ? sectionIdx : 0];
      if (!sectionData || !section) return;

      const apiKey = localStorage.getItem('claude_api_key') ?? '';
      const model = localStorage.getItem('claude_model') ?? 'claude-sonnet-4-5';
      if (!apiKey) return;

      const { generateVariation } = await import('../services/ClaudeSongGenerator');
      const varied = await generateVariation(
        apiKey, model,
        generatedSong.plan, section, sectionIdx >= 0 ? sectionIdx : 0,
        sectionData.patterns, howDifferent,
        () => {},
      );

      get()._pushUndo();
      set(draft => {
        const t = draft.project.tracks.find(t => t.id === trackId);
        const p = t?.patterns.find(p => p.id === clipId);
        if (p) {
          p.notes = varied.lead.notes.map(n => ({
            id: crypto.randomUUID(),
            pitch: n.pitch,
            startStep: n.startStep,
            duration: n.duration,
            velocity: n.velocity,
          }));
        }
      });
    },

    async exportSong(onProgress) {
      const { project, isPlaying } = get();
      if (isPlaying) { onProgress('Stop playback first'); setTimeout(() => onProgress(''), 2000); return; }

      onProgress('Recording...');
      try {
        await audioEngine.startRecording();
        audioEngine.setOnSongEnd(null); // will be overridden by our promise
        await new Promise<void>((resolve, reject) => {
          audioEngine.setOnSongEnd(async () => {
            try {
              const rawBlob = await audioEngine.stopRecording();
              onProgress('Encoding WAV...');
              const wav = await blobToNormalizedWav(rawBlob);
              const name = `${project.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.wav`;
              downloadBlob(wav, name);
              resolve();
            } catch (e) { reject(e); }
          });
          void get().play();
        });
      } catch (e) {
        console.error('Export failed:', e);
        onProgress('Export failed');
        setTimeout(() => onProgress(''), 2000);
        return;
      }
      onProgress('');
    },

    setBPM(bpm) {
      set(draft => {
        draft.project.bpm = bpm;
        draft.project.modifiedAt = new Date().toISOString();
      });
      audioEngine.setBPM(bpm);
    },

    setActiveSceneId(id) {
      set(draft => { draft.activeSceneId = id; });
    },

    async play() {
      await audioEngine.start();

      // If transport is paused, just resume — don't rebuild sequencers (causes note bursts)
      if (audioEngine.isPaused()) {
        audioEngine.play();
        set(draft => { draft.isPlaying = true; });
        return;
      }

      const { project, activeSceneId, loopEnabled } = get();

      // Unless looping is enabled, stop after one full pass
      if (!loopEnabled) {
        audioEngine.setOnSongEnd(() => get().stop());
      }

      const activeScene = activeSceneId ? project.scenes.find(s => s.id === activeSceneId) : null;

      for (const track of project.tracks) {
        // When a scene is active, use the pattern assigned to that scene for this track.
        // Fall back to patterns[0] for normal (non-scene) playback.
        const patternId = activeScene ? activeScene.clips[track.id] : undefined;
        const pattern = patternId
          ? track.patterns.find(p => p.id === patternId)
          : track.patterns[0];
        if (!pattern) continue;

        // Create synth for melodic tracks
        if (track.type === 'synth') {
          if (!audioEngine.getSynth(track.id)) {
            audioEngine.createSynthTrack(track.id, track.synthSettings);
          }
          // Start melodic sequencer if the pattern has piano-roll notes
          if (pattern.notes.length > 0) {
            audioEngine.startMelodicSequencer(track.id, pattern, (step) => {
              get().setCurrentStep(step);
            });
          }
        }

        // Start drum sequencer for ANY track that has step data toggled on.
        // This means using the step sequencer on a bass/lead track still fires drums.
        const hasStepData = pattern.stepData?.some(row => row?.some(Boolean));
        if (hasStepData || track.type === 'drum') {
          audioEngine.createDrumSequencer(track.id, pattern, (step) => {
            get().setCurrentStep(step);
          });
        }
      }

      audioEngine.setBPM(project.bpm);

      // Apply swing
      const { swingAmount } = get();
      Tone.getTransport().swingSubdivision = '16n';
      Tone.getTransport().swing = swingAmount / 100;

      // Auto-sidechain setup
      const { sidechainEnabled, sidechainAmount, sidechainRelease,
              sidechainSourceTrackId, sidechainTargetOverrides } = get();
      if (sidechainEnabled) {
        const tracks = project.tracks;
        const kickTrack = sidechainSourceTrackId
          ? tracks.find(t => t.id === sidechainSourceTrackId)
          : tracks.find(t => t.type === 'drum');
        if (kickTrack) {
          const targetIds = tracks
            .filter(t => t.type !== 'drum' && t.id !== kickTrack.id)
            .filter(t => sidechainTargetOverrides[t.id] !== false)
            .map(t => t.id);
          audioEngine.setupSidechain(kickTrack.id, targetIds, sidechainAmount, sidechainRelease);
        }
      }

      audioEngine.play();
      set(draft => { draft.isPlaying = true; });
    },

    stop() {
      const { project, isRecording } = get();
      for (const track of project.tracks) {
        // Stop both drum and melodic sequencers for every track (safe to call even if not running)
        audioEngine.stopDrumSequencer(track.id);
        audioEngine.stopMelodicSequencer(track.id);
      }
      Tone.getTransport().swing = 0;
      audioEngine.stop();
      set(draft => {
        draft.isPlaying = false;
        draft.isRecording = false;
        draft.currentStep = 0;
      });
      // If recording was active, finalize it and auto-download instead of leaving
      // the Tone.Recorder dangling (accumulating instances causes audio degradation)
      if (isRecording) {
        get().stopRecording();
      }
    },

    pause() {
      audioEngine.pause();
      set(draft => { draft.isPlaying = false; });
    },

    toggleLoop() {
      set(draft => { draft.loopEnabled = !draft.loopEnabled; });
    },

    record() {
      const { isRecording, startRecording, stopRecording } = get();
      if (isRecording) stopRecording();
      else startRecording();
    },

    startRecording() {
      audioEngine.startRecording().then(() => {
        set(draft => { draft.isRecording = true; });
      }).catch(e => console.error('startRecording failed:', e));
    },

    stopRecording() {
      set(draft => { draft.isRecording = false; });
      audioEngine.stopRecording()
        .then(blob => blobToNormalizedWav(blob))
        .then(wav => downloadBlob(wav, `recording-${Date.now()}.wav`))
        .catch(e => console.error('stopRecording failed:', e));
    },

    addTrack(type) {
      get()._pushUndo();
      const track = defaultTrack({ type, name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${Date.now()}` });
      set(draft => {
        draft.project.tracks.push(track);
        draft.project.modifiedAt = new Date().toISOString();
      });
    },

    removeTrack(id) {
      get()._pushUndo();
      audioEngine.disposeTrack(id);
      set(draft => {
        draft.project.tracks = draft.project.tracks.filter(t => t.id !== id);
        if (draft.selectedTrackId === id) {
          draft.selectedTrackId = draft.project.tracks[0]?.id ?? null;
        }
        draft.project.modifiedAt = new Date().toISOString();
      });
    },

    updateTrack(id, changes) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === id);
        if (track) {
          Object.assign(track, changes);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    setTrackVolume(id, vol) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === id);
        if (track) track.volume = vol;
      });
      audioEngine.setTrackVolume(id, vol);
    },

    setTrackPan(id, pan) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === id);
        if (track) track.pan = pan;
      });
      audioEngine.setTrackPan(id, pan);
    },

    toggleMute(id) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === id);
        if (track) {
          track.mute = !track.mute;
          audioEngine.setTrackMute(id, track.mute);
        }
      });
    },

    toggleSolo(id) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === id);
        if (track) track.solo = !track.solo;
      });
      // Apply solo to audio engine: mute all tracks that aren't soloed
      const { project } = get();
      const anySoloed = project.tracks.some(t => t.solo);
      project.tracks.forEach(t => {
        const shouldMute = t.mute || (anySoloed && !t.solo);
        audioEngine.setTrackMute(t.id, shouldMute);
      });
    },

    toggleArmed(id) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === id);
        if (track) track.armed = !track.armed;
      });
    },

    addPattern(trackId) {
      get()._pushUndo();
      const pattern = defaultPattern({ name: `Pattern ${Date.now()}` });
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.patterns.push(pattern);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    updatePattern(trackId, patternId, changes) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          const pattern = track.patterns.find(p => p.id === patternId);
          if (pattern) {
            Object.assign(pattern, changes);
            draft.project.modifiedAt = new Date().toISOString();
          }
        }
      });
    },

    toggleStep(trackId, patternId, drumRow, step) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const pattern = track.patterns.find(p => p.id === patternId);
        if (!pattern) return;
        if (!pattern.stepData[drumRow]) {
          pattern.stepData[drumRow] = Array(32).fill(0);
        }
        const current = pattern.stepData[drumRow][step] ?? 0;
        pattern.stepData[drumRow][step] = current > 0 ? 0 : 100; // toggle off/on at velocity 100
        draft.project.modifiedAt = new Date().toISOString();
      });
      // Hot-reload drum sequencer with updated pattern while playing (any track type)
      if (get().isPlaying) {
        const track = get().project.tracks.find(t => t.id === trackId);
        const pattern = track?.patterns.find(p => p.id === patternId);
        if (pattern) {
          audioEngine.createDrumSequencer(trackId, pattern, (s) => get().setCurrentStep(s));
        }
      }
    },

    setStepVelocity(trackId, patternId, drumRow, step, velocity) {
      set(draft => {
        const pattern = draft.project.tracks.find(t => t.id === trackId)?.patterns.find(p => p.id === patternId);
        if (!pattern) return;
        if (!pattern.stepData[drumRow]) pattern.stepData[drumRow] = Array(32).fill(0);
        pattern.stepData[drumRow][step] = Math.max(1, Math.min(127, Math.round(velocity)));
        draft.project.modifiedAt = new Date().toISOString();
      });
    },

    addNote(trackId, patternId, note) {
      get()._pushUndo();
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const pattern = track.patterns.find(p => p.id === patternId);
        if (pattern) {
          pattern.notes.push(note);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    removeNote(trackId, patternId, noteId) {
      get()._pushUndo();
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const pattern = track.patterns.find(p => p.id === patternId);
        if (pattern) {
          pattern.notes = pattern.notes.filter(n => n.id !== noteId);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    updateNote(trackId, patternId, noteId, changes) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const pattern = track.patterns.find(p => p.id === patternId);
        if (!pattern) return;
        const note = pattern.notes.find(n => n.id === noteId);
        if (note) {
          Object.assign(note, changes);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    addScene() {
      get()._pushUndo();
      const scene: Scene = {
        id: crypto.randomUUID(),
        name: `Scene ${get().project.scenes.length + 1}`,
        clips: {},
      };
      set(draft => {
        draft.project.scenes.push(scene);
        draft.project.modifiedAt = new Date().toISOString();
      });
    },

    addNamedScene(name) {
      get()._pushUndo();
      const id = crypto.randomUUID();
      const scene: Scene = { id, name, clips: {} };
      set(draft => {
        draft.project.scenes.push(scene);
        draft.project.modifiedAt = new Date().toISOString();
      });
      return id;
    },

    addPatternToTrack(trackId, pattern) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.patterns.push(pattern);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    removeScene(id) {
      get()._pushUndo();
      set(draft => {
        draft.project.scenes = draft.project.scenes.filter(s => s.id !== id);
        draft.project.modifiedAt = new Date().toISOString();
      });
    },

    updateScene(id, changes) {
      set(draft => {
        const scene = draft.project.scenes.find(s => s.id === id);
        if (scene) {
          Object.assign(scene, changes);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    assignClipToScene(sceneId, trackId, clipId) {
      set(draft => {
        const scene = draft.project.scenes.find(s => s.id === sceneId);
        if (scene) {
          scene.clips[trackId] = clipId;
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    launchScene(sceneId, once = false) {
      const { project } = get();
      const scene = project.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      // Stop current audio, set active scene, then start playback with that scene's clips
      get().stop();
      set(draft => { draft.activeSceneId = sceneId; });
      if (once) {
        // Force one-shot regardless of loopEnabled — set callback BEFORE play
        audioEngine.setOnSongEnd(() => get().stop());
        // Temporarily disable loop so play() doesn't override the callback
        const wasLooping = get().loopEnabled;
        if (wasLooping) set(draft => { draft.loopEnabled = false; });
        void get().play().then(() => {
          if (wasLooping) set(draft => { draft.loopEnabled = true; });
        });
      } else {
        void get().play();
      }
    },

    reorderScenes(fromIndex, toIndex) {
      if (fromIndex === toIndex) return;
      get()._pushUndo();
      set(draft => {
        const scenes = draft.project.scenes;
        const [removed] = scenes.splice(fromIndex, 1);
        scenes.splice(toIndex, 0, removed);
        draft.project.modifiedAt = new Date().toISOString();
      });
    },

    updateSynthSettings(trackId, settings) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.synthSettings = settings;
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
      audioEngine.updateSynthSettings(trackId, settings);
    },

    setMasterVolume(vol) {
      set(draft => {
        draft.project.masterVolume = Math.max(0, Math.min(1, vol));
      });
      audioEngine.setMasterVolume(vol);
    },

    addEffect(trackId, type) {
      get()._pushUndo();
      const effect: Effect = {
        id: crypto.randomUUID(),
        type,
        settings: {},
        on: true,
      };
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.effects.push(effect);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    removeEffect(trackId, effectId) {
      get()._pushUndo();
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (track) {
          track.effects = track.effects.filter(e => e.id !== effectId);
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    updateEffect(trackId, effectId, settings) {
      set(draft => {
        const track = draft.project.tracks.find(t => t.id === trackId);
        if (!track) return;
        const effect = track.effects.find(e => e.id === effectId);
        if (effect) {
          effect.settings = { ...effect.settings, ...settings };
          draft.project.modifiedAt = new Date().toISOString();
        }
      });
    },

    saveProject() {
      const { project } = get();
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      downloadBlob(blob, `${project.name.replace(/\s+/g, '-')}.edm-daw`);
    },

    loadProject(json) {
      try {
        const project = JSON.parse(json) as Project;
        get()._pushUndo();
        set(draft => {
          draft.project = project;
          draft.selectedTrackId = project.tracks[0]?.id ?? null;
        });
      } catch (e) {
        console.error('Failed to load project:', e);
      }
    },

    undo() {
      const { undoStack, project } = get();
      if (undoStack.length === 0) return;
      const prev = undoStack[undoStack.length - 1];
      set(draft => {
        draft.redoStack.push(JSON.parse(JSON.stringify(project)));
        draft.undoStack.pop();
        draft.project = prev;
      });
    },

    redo() {
      const { redoStack, project } = get();
      if (redoStack.length === 0) return;
      const next = redoStack[redoStack.length - 1];
      set(draft => {
        draft.undoStack.push(JSON.parse(JSON.stringify(project)));
        draft.redoStack.pop();
        draft.project = next;
      });
    },

    setCurrentStep(step) {
      set(draft => { draft.currentStep = step; });
    },
  }))
);
