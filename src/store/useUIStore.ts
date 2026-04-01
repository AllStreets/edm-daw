import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type ActivePanel = 'session' | 'arrangement' | 'piano-roll' | 'step-sequencer' | 'mixer';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface UIState {
  sidebarOpen: boolean;
  sampleBrowserOpen: boolean;
  activePanel: ActivePanel;
  pianoRollTrackId: string | null;
  pianoRollPatternId: string | null;
  synthEditorTrackId: string | null;
  effectsRackTrackId: string | null;
  bottomPanelHeight: number;
  leftPanelWidth: number;
  notifications: Notification[];

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSampleBrowserOpen: (open: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  openPianoRoll: (trackId: string, patternId: string) => void;
  closePianoRoll: () => void;
  openSynthEditor: (trackId: string) => void;
  closeSynthEditor: () => void;
  openEffectsRack: (trackId: string) => void;
  closeEffectsRack: () => void;
  setBottomPanelHeight: (height: number) => void;
  setLeftPanelWidth: (width: number) => void;
  addNotification: (message: string, type?: Notification['type']) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    sidebarOpen: true,
    sampleBrowserOpen: false,
    activePanel: 'session',
    pianoRollTrackId: null,
    pianoRollPatternId: null,
    synthEditorTrackId: null,
    effectsRackTrackId: null,
    bottomPanelHeight: 280,
    leftPanelWidth: 200,
    notifications: [],

    setSidebarOpen(open) {
      set(draft => { draft.sidebarOpen = open; });
    },

    toggleSidebar() {
      set(draft => { draft.sidebarOpen = !draft.sidebarOpen; });
    },

    setSampleBrowserOpen(open) {
      set(draft => { draft.sampleBrowserOpen = open; });
    },

    setActivePanel(panel) {
      set(draft => { draft.activePanel = panel; });
    },

    openPianoRoll(trackId, patternId) {
      set(draft => {
        draft.pianoRollTrackId = trackId;
        draft.pianoRollPatternId = patternId;
        draft.activePanel = 'piano-roll';
      });
    },

    closePianoRoll() {
      set(draft => {
        draft.pianoRollTrackId = null;
        draft.pianoRollPatternId = null;
        if (draft.activePanel === 'piano-roll') {
          draft.activePanel = 'session';
        }
      });
    },

    openSynthEditor(trackId) {
      set(draft => {
        draft.synthEditorTrackId = trackId;
      });
    },

    closeSynthEditor() {
      set(draft => {
        draft.synthEditorTrackId = null;
      });
    },

    openEffectsRack(trackId) {
      set(draft => {
        draft.effectsRackTrackId = trackId;
      });
    },

    closeEffectsRack() {
      set(draft => {
        draft.effectsRackTrackId = null;
      });
    },

    setBottomPanelHeight(height) {
      set(draft => {
        draft.bottomPanelHeight = Math.max(100, Math.min(600, height));
      });
    },

    setLeftPanelWidth(width) {
      set(draft => {
        draft.leftPanelWidth = Math.max(120, Math.min(400, width));
      });
    },

    addNotification(message, type = 'info') {
      const notification: Notification = {
        id: crypto.randomUUID(),
        message,
        type,
      };
      set(draft => {
        draft.notifications.push(notification);
        // Keep max 5 notifications
        if (draft.notifications.length > 5) {
          draft.notifications.shift();
        }
      });
      // Auto-remove after 3 seconds
      setTimeout(() => {
        set(draft => {
          draft.notifications = draft.notifications.filter(n => n.id !== notification.id);
        });
      }, 3000);
    },

    removeNotification(id) {
      set(draft => {
        draft.notifications = draft.notifications.filter(n => n.id !== id);
      });
    },

    clearNotifications() {
      set(draft => { draft.notifications = []; });
    },
  }))
);
