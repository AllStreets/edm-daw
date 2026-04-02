import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  Project,
  Track,
  Pattern,
  Note,
  Scene,
  Effect,
  SynthSettings,
} from '../types';
import {
  defaultTrack,
  defaultPattern,
  defaultSynthSettings,
} from '../types';
import { audioEngine } from '../engine/AudioEngine';
import { downloadBlob } from '../utils/audioUtils';

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
      audioEngine.stopRecording().then(blob => {
        const ext = blob.type.includes('mp4') ? 'm4a'
                  : blob.type.includes('ogg') ? 'ogg'
                  : 'webm';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      });
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
          pattern.stepData[drumRow] = Array(32).fill(false);
        }
        pattern.stepData[drumRow][step] = !pattern.stepData[drumRow][step];
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
