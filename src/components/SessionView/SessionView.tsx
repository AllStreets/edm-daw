import React, { useCallback, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useUIStore } from '../../store/useUIStore';
import { ClipCell } from './ClipCell';
import { TrackHeader } from '../TrackList/TrackHeader';
import type { Track } from '../../types';

// ─── Scene Header Cell ────────────────────────────────────────────────────────

interface SceneHeaderCellProps {
  name: string;
  color: string;
  onLaunch: () => void;
}

const SCENE_COLORS = ['#9945ff', '#00d4ff', '#ff0080', '#00ff88', '#ff6600', '#ffcc00'];

const SceneHeaderCell: React.FC<SceneHeaderCellProps> = ({ name, color, onLaunch }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        width: 120,
        minWidth: 120,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        background: hovered
          ? `linear-gradient(180deg, ${color}22 0%, ${color}0a 100%)`
          : 'linear-gradient(180deg, #131326 0%, #0f0f20 100%)',
        borderRight: '1px solid #1a1a2e',
        borderBottom: `2px solid ${color}`,
        transition: 'background 0.15s ease',
        cursor: 'pointer',
        gap: 4,
        flexShrink: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: hovered ? '#fff' : '#aaa',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        transition: 'color 0.1s ease',
      }}>
        {name}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onLaunch(); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 18,
          borderRadius: 4,
          border: `1px solid ${color}66`,
          background: `${color}22`,
          color: color,
          fontSize: 9,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          transition: 'all 0.1s ease',
          outline: 'none',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = `${color}44`;
          (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 8px ${color}66`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = `${color}22`;
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
        title={`Launch scene: ${name}`}
      >
        ▶
      </button>
    </div>
  );
};

// ─── Add Track Dropdown ───────────────────────────────────────────────────────

interface AddTrackDropdownProps {
  onAdd: (type: Track['type']) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

const AddTrackDropdown: React.FC<AddTrackDropdownProps> = ({ onAdd, onClose, anchorRef }) => {
  const rect = anchorRef.current?.getBoundingClientRect();
  const top = rect ? rect.bottom + 4 : 100;
  const left = rect ? rect.left : 200;

  const types: { type: Track['type']; label: string; icon: string; color: string }[] = [
    { type: 'synth', label: 'Synth Track', icon: '🎹', color: '#9945ff' },
    { type: 'drum', label: 'Drum Track', icon: '🥁', color: '#ff0080' },
    { type: 'audio', label: 'Audio Track', icon: '🎤', color: '#00d4ff' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width: 160,
        background: 'linear-gradient(180deg, #1a1a30 0%, #12121e 100%)',
        border: '1px solid #2a2a4a',
        borderRadius: 8,
        boxShadow: '0 8px 32px #00000099, 0 0 0 1px #9945ff22',
        zIndex: 1000,
        overflow: 'hidden',
        padding: '4px 0',
      }}
      onMouseLeave={onClose}
    >
      {types.map(({ type, label, icon, color }) => (
        <button
          key={type}
          onClick={() => { onAdd(type); onClose(); }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 12px',
            background: 'transparent',
            border: 'none',
            color: '#bbb',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = `${color}22`;
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#bbb';
          }}
        >
          <span>{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
};

// ─── SessionView ──────────────────────────────────────────────────────────────

export const SessionView: React.FC = () => {
  const {
    project,
    selectedTrackId,
    selectTrack,
    toggleMute,
    toggleSolo,
    toggleArmed,
    setTrackVolume,
    addTrack,
    addScene,
    launchScene,
    isPlaying,
  } = useProjectStore();

  const { openSynthEditor, openPianoRoll } = useUIStore();

  const [showAddTrack, setShowAddTrack] = useState(false);
  const addTrackBtnRef = useRef<HTMLButtonElement>(null);

  // Scroll sync between header col and grid
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback((source: 'grid' | 'header') => (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (source === 'grid' && headerScrollRef.current) {
      headerScrollRef.current.scrollTop = el.scrollTop;
    } else if (source === 'header' && gridScrollRef.current) {
      gridScrollRef.current.scrollTop = el.scrollTop;
    }
  }, []);

  const handleOpenSynth = useCallback((trackId: string) => {
    openSynthEditor(trackId);
  }, [openSynthEditor]);

  const handleEditClip = useCallback((trackId: string, patternId: string) => {
    openPianoRoll(trackId, patternId);
  }, [openPianoRoll]);

  // Determine which clip is playing per track (simplified: first clip if playing)
  const getPlayingPatternId = (_trackId: string): string | null => {
    return isPlaying ? null : null; // Would hook into real playback state
  };

  const scenes = project.scenes;
  const tracks = project.tracks;

  // Ensure at least 8 tracks shown (pad with nulls for empty rows)
  const MIN_TRACKS = 8;
  const MIN_SCENES = 4;
  const paddedTracks = tracks.length < MIN_TRACKS
    ? [...tracks, ...Array(MIN_TRACKS - tracks.length).fill(null)]
    : tracks;
  const paddedScenes = scenes.length < MIN_SCENES
    ? [...scenes, ...Array(MIN_SCENES - scenes.length).fill(null)]
    : scenes;

  return (
    <>
      <style>{`
        .session-scroll::-webkit-scrollbar {
          width: 6px; height: 6px;
        }
        .session-scroll::-webkit-scrollbar-track {
          background: #0a0a14;
        }
        .session-scroll::-webkit-scrollbar-thumb {
          background: #2a2a4a;
          border-radius: 3px;
        }
        .session-scroll::-webkit-scrollbar-thumb:hover {
          background: #9945ff55;
        }
        .session-scroll::-webkit-scrollbar-corner {
          background: #0a0a14;
        }
      `}</style>

      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        background: '#0a0a0f',
        userSelect: 'none',
      }}>

        {/* ── Left column: track headers ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          width: 200,
          background: '#0a0a18',
          borderRight: '1px solid #1a1a2e',
          zIndex: 10,
        }}>

          {/* Corner cell (top-left, aligns with scene header row) */}
          <div style={{
            height: 40,
            minHeight: 40,
            borderBottom: '2px solid #9945ff33',
            borderRight: '1px solid #1a1a2e',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            background: '#080818',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 9, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>
              TRACKS / SCENES
            </span>
          </div>

          {/* Track headers — scrollable */}
          <div
            ref={headerScrollRef}
            className="session-scroll"
            onScroll={syncScroll('header')}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {paddedTracks.map((track, i) => {
              if (!track) {
                // Empty placeholder row
                return (
                  <div
                    key={`empty-track-${i}`}
                    style={{
                      width: 200,
                      height: 56,
                      borderBottom: '1px solid #1a1a2e',
                      background: '#080812',
                    }}
                  />
                );
              }
              return (
                <TrackHeader
                  key={track.id}
                  track={track}
                  isSelected={selectedTrackId === track.id}
                  onClick={() => selectTrack(track.id)}
                  onMute={() => toggleMute(track.id)}
                  onSolo={() => toggleSolo(track.id)}
                  onArm={() => toggleArmed(track.id)}
                  onVolumeChange={vol => setTrackVolume(track.id, vol)}
                  onOpenSynth={() => handleOpenSynth(track.id)}
                />
              );
            })}

            {/* Add track button at bottom of header column */}
            <div style={{
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid #1a1a2e',
              position: 'relative',
            }}>
              <button
                ref={addTrackBtnRef}
                onClick={() => setShowAddTrack(v => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 12px',
                  background: showAddTrack ? '#9945ff22' : '#0d0d1e',
                  border: `1px solid ${showAddTrack ? '#9945ff' : '#2a2a3a'}`,
                  borderRadius: 6,
                  color: showAddTrack ? '#9945ff' : '#666',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  if (!showAddTrack) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#9945ff66';
                    (e.currentTarget as HTMLButtonElement).style.color = '#9945ff';
                  }
                }}
                onMouseLeave={e => {
                  if (!showAddTrack) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a3a';
                    (e.currentTarget as HTMLButtonElement).style.color = '#666';
                  }
                }}
              >
                <span style={{ fontSize: 14 }}>+</span>
                Add Track
              </button>

              {showAddTrack && (
                <AddTrackDropdown
                  onAdd={addTrack}
                  onClose={() => setShowAddTrack(false)}
                  anchorRef={addTrackBtnRef}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Right: scene columns + clip grid ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>

          {/* Scene header row (sticky top) */}
          <div style={{
            display: 'flex',
            flexShrink: 0,
            overflowX: 'hidden',
            background: '#0a0a18',
            borderBottom: '1px solid #1a1a2e',
            zIndex: 5,
          }}>
            {paddedScenes.map((scene, i) => {
              if (!scene) {
                return (
                  <div
                    key={`empty-scene-${i}`}
                    style={{
                      width: 120,
                      minWidth: 120,
                      height: 40,
                      borderRight: '1px solid #1a1a2e',
                      background: '#080818',
                      flexShrink: 0,
                    }}
                  />
                );
              }
              const color = SCENE_COLORS[i % SCENE_COLORS.length];
              return (
                <SceneHeaderCell
                  key={scene.id}
                  name={scene.name}
                  color={color}
                  onLaunch={() => launchScene(scene.id)}
                />
              );
            })}

            {/* "+ Add Scene" button */}
            <div style={{
              width: 80,
              minWidth: 80,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid #1a1a2e',
              flexShrink: 0,
            }}>
              <button
                onClick={addScene}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 22,
                  borderRadius: 5,
                  border: '1px dashed #2a2a3a',
                  background: 'transparent',
                  color: '#555',
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  outline: 'none',
                  fontWeight: 700,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#9945ff';
                  (e.currentTarget as HTMLButtonElement).style.color = '#9945ff';
                  (e.currentTarget as HTMLButtonElement).style.background = '#9945ff11';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a3a';
                  (e.currentTarget as HTMLButtonElement).style.color = '#555';
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
                title="Add scene"
              >
                +
              </button>
            </div>
          </div>

          {/* Clip grid (scrollable) */}
          <div
            ref={gridScrollRef}
            className="session-scroll"
            onScroll={syncScroll('grid')}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'auto',
            }}
          >
            {paddedTracks.map((track, trackIdx) => (
              <div
                key={track ? track.id : `empty-track-row-${trackIdx}`}
                style={{
                  display: 'flex',
                  height: 56,
                  minHeight: 56,
                  background: track && selectedTrackId === track.id
                    ? `${track.color}08`
                    : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                {paddedScenes.map((scene, sceneIdx) => {
                  if (!track) {
                    return (
                      <div
                        key={`empty-cell-${trackIdx}-${sceneIdx}`}
                        style={{
                          width: 120, minWidth: 120, height: 56,
                          borderRight: '1px solid #1a1a2e',
                          borderBottom: '1px solid #1a1a2e',
                          background: '#080812',
                          flexShrink: 0,
                        }}
                      />
                    );
                  }

                  if (!scene) {
                    return (
                      <div
                        key={`no-scene-${trackIdx}-${sceneIdx}`}
                        style={{
                          width: 120, minWidth: 120, height: 56,
                          borderRight: '1px solid #1a1a2e',
                          borderBottom: '1px solid #1a1a2e',
                          background: '#0a0a15',
                          flexShrink: 0,
                        }}
                      />
                    );
                  }

                  // Check if this scene has a clip for this track
                  const clipPatternId = scene.clips[track.id] ?? null;
                  const pattern = clipPatternId
                    ? track.patterns.find((p: { id: string }) => p.id === clipPatternId) ?? null
                    : null;

                  // Fallback: assign first pattern to first scene for demo purposes
                  const effectivePatternId =
                    clipPatternId ??
                    (sceneIdx === 0 && track.patterns.length > 0 ? track.patterns[0].id : null);
                  const effectivePattern = effectivePatternId
                    ? track.patterns.find((p: { id: string }) => p.id === effectivePatternId) ?? null
                    : null;

                  const playingPatternId = getPlayingPatternId(track.id);
                  const isCellPlaying = isPlaying && playingPatternId === effectivePatternId;

                  return (
                    <ClipCell
                      key={`${track.id}-${scene.id}`}
                      trackId={track.id}
                      sceneId={scene.id}
                      patternId={effectivePatternId}
                      patternName={effectivePattern?.name ?? pattern?.name}
                      trackColor={track.color}
                      isPlaying={isCellPlaying}
                      onLaunch={() => {
                        selectTrack(track.id);
                        launchScene(scene.id);
                      }}
                      onStop={() => {/* stop clip */}}
                      onEdit={() => {
                        if (effectivePatternId) {
                          handleEditClip(track.id, effectivePatternId);
                        }
                      }}
                      onDuplicate={() => {/* duplicate */}}
                      onDelete={() => {/* delete */}}
                    />
                  );
                })}

                {/* Empty cell after scenes for spacing */}
                <div style={{ width: 80, minWidth: 80, height: 56, flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
};

export default SessionView;
