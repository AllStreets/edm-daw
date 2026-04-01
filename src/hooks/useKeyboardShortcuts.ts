import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../store/useProjectStore';

export function useKeyboardShortcuts() {
  const {
    play,
    stop,
    pause,
    record,
    undo,
    redo,
    saveProject,
    isPlaying,
    project,
    setActiveView,
    activeView,
    selectTrack,
  } = useProjectStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Space - Play / Pause
      if (e.code === 'Space' && !ctrlOrCmd) {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      // Escape - Stop
      if (e.code === 'Escape') {
        e.preventDefault();
        stop();
        return;
      }

      // Cmd/Ctrl + Z - Undo
      if (ctrlOrCmd && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z - Redo
      if (ctrlOrCmd && e.shiftKey && e.code === 'KeyZ') {
        e.preventDefault();
        redo();
        return;
      }

      // Cmd/Ctrl + S - Save project
      if (ctrlOrCmd && e.code === 'KeyS') {
        e.preventDefault();
        saveProject();
        return;
      }

      // Tab - Switch views
      if (e.code === 'Tab' && !ctrlOrCmd) {
        e.preventDefault();
        const views: Array<'session' | 'arrangement' | 'mixer'> = ['session', 'arrangement', 'mixer'];
        const currentIndex = views.indexOf(activeView);
        const nextIndex = (currentIndex + 1) % views.length;
        setActiveView(views[nextIndex]);
        return;
      }

      // R - Toggle record
      if (e.code === 'KeyR' && !ctrlOrCmd) {
        e.preventDefault();
        record();
        return;
      }

      // 1-8 - Select track by number
      if (!ctrlOrCmd && e.code.startsWith('Digit')) {
        const digit = parseInt(e.code.replace('Digit', ''), 10);
        if (digit >= 1 && digit <= 8) {
          e.preventDefault();
          const track = project.tracks[digit - 1];
          if (track) {
            selectTrack(track.id);
          }
          return;
        }
      }

      // Cmd/Ctrl + D - Duplicate selected pattern (bonus shortcut)
      if (ctrlOrCmd && e.code === 'KeyD') {
        e.preventDefault();
        // Implementation left for UI to handle
        return;
      }
    },
    [isPlaying, play, stop, pause, record, undo, redo, saveProject, activeView, setActiveView, project, selectTrack]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
