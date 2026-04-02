import { useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { ChannelStrip } from './ChannelStrip';
import { StereoLevelMeter } from '../Meters/LevelMeter';
import { audioEngine } from '../../engine/AudioEngine';

// Master channel strip
function MasterStrip() {
  const { project, setMasterVolume } = useProjectStore();
  const [masterLevel, setMasterLevel] = useState(0);
  const [isOverloading, setIsOverloading] = useState(false);
  const overloadTimerRef = useRef(0);

  const animateMaster = useCallback((_dt: number, timestamp: number) => {
    // Use real waveform data for master level metering
    const waveData = audioEngine.getWaveformData();
    let sum = 0;
    for (let i = 0; i < waveData.length; i++) sum += waveData[i] * waveData[i];
    const rms = Math.sqrt(sum / waveData.length);
    const level = Math.min(1, rms * 4);
    setMasterLevel(level);

    if (level > 0.93) {
      setIsOverloading(true);
      overloadTimerRef.current = timestamp + 1500;
    } else if (timestamp > overloadTimerRef.current) {
      setIsOverloading(false);
    }
  }, []);

  useAnimationFrame(animateMaster, true);

  const handleMasterVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVolume(val);
  }, [setMasterVolume]);

  const faderPos = 1 - project.masterVolume;

  return (
    <div
      className="flex flex-col items-center gap-1 py-2 px-2 rounded"
      style={{
        width: 100,
        minHeight: '100%',
        background: 'linear-gradient(180deg, #1a1820 0%, #0e0c14 100%)',
        border: '1px solid #2a1a3a',
        boxShadow: '0 0 20px rgba(153,69,255,0.1)',
      }}
    >
      {/* Master label */}
      <div
        className="w-full text-center text-[10px] font-bold font-mono rounded py-0.5"
        style={{
          background: 'linear-gradient(90deg, #9945ff, #00d4ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '0.1em',
        }}
      >
        MASTER
      </div>

      {/* Overload indicator */}
      <div className="flex gap-1 items-center">
        <span className="text-[8px] font-mono text-gray-600">CLIP</span>
        <div
          className="rounded-full transition-all"
          style={{
            width: 8, height: 8,
            background: isOverloading ? '#ff2020' : '#2a0808',
            boxShadow: isOverloading ? '0 0 8px #ff4040' : 'none',
          }}
        />
      </div>

      {/* Limiter indicator */}
      <div
        className="w-full text-center text-[8px] font-mono rounded py-0.5"
        style={{
          background: '#0a1a0a',
          color: '#00aa44',
          border: '1px solid #00aa4444',
        }}
      >
        LIMITER
      </div>

      {/* Stereo meters - wider for master */}
      <div className="flex gap-1">
        <StereoLevelMeter levelL={masterLevel} levelR={masterLevel * 0.97} height={130} width={40} showClip />
      </div>

      {/* Master fader */}
      <div className="relative" style={{ height: 150, width: 20, marginTop: 8 }}>
        <div
          className="absolute inset-x-0 rounded-sm"
          style={{
            top: 8, bottom: 8,
            background: 'linear-gradient(to top, #1a1a1a, #333 70%, #550000 95%, #660000 100%)',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 cursor-grab"
          style={{
            top: `calc(${faderPos * 100}% - 10px)`,
            width: 26, height: 18,
            background: 'linear-gradient(135deg, #5a4a7a 0%, #2a1a3a 50%, #1a0a2a 100%)',
            border: '1px solid #9945ff88',
            borderRadius: 4,
            boxShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 8px rgba(153,69,255,0.2)',
          }}
        >
          <div
            className="absolute inset-x-1"
            style={{ top: '50%', height: 1.5, background: '#9945ff88', transform: 'translateY(-50%)' }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={project.masterVolume}
          onChange={handleMasterVolume}
          className="absolute inset-0 opacity-0 cursor-grab"
          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
        />
      </div>

      {/* Volume reading */}
      <div
        className="text-[10px] font-mono font-bold"
        style={{ color: '#9945ff' }}
      >
        {project.masterVolume >= 1 ? '+6' : project.masterVolume >= 0.875 ? '0' : project.masterVolume >= 0.75 ? '-6' : '-12'} dB
      </div>

      {/* Main out label */}
      <div className="text-[7px] font-mono text-gray-600 text-center mt-auto">
        MAIN OUT
      </div>
    </div>
  );
}

// Send/Return channel — reads real level from audio engine
function SendReturnStrip({ name, color, effectKey }: { name: string; color: string; effectKey: 'reverb' | 'delay' }) {
  const [level, setLevel] = useState(0);

  const animate = useCallback((_dt: number) => {
    const rms = audioEngine.getEffectLevel(effectKey);
    setLevel(Math.min(1, rms * 5));
  }, [effectKey]);

  useAnimationFrame(animate, true);

  const barH = Math.round(level * 80);

  return (
    <div
      className="flex flex-col items-center gap-1 py-2 px-1 rounded"
      style={{
        width: 70,
        minHeight: '100%',
        background: 'linear-gradient(180deg, #111118 0%, #0c0c12 100%)',
        border: '1px solid #1a1a28',
      }}
    >
      <div className="w-full rounded-sm" style={{ height: 2, background: color, boxShadow: `0 0 4px ${color}88` }} />
      <div className="text-[8px] font-mono text-center" style={{ color }}>{name}</div>

      {/* Real level meters */}
      <div className="flex gap-0.5 mt-auto">
        {[1, 0.92].map((scale, i) => (
          <div
            key={i}
            className="relative rounded-sm overflow-hidden"
            style={{ width: 8, height: 80, background: '#0a0a0a', border: '1px solid #1a1a2a' }}
          >
            <div
              className="absolute bottom-0 left-0 right-0 rounded-sm transition-none"
              style={{
                height: barH * scale,
                background: `linear-gradient(to top, ${color}, ${color}66)`,
                boxShadow: barH > 10 ? `0 0 4px ${color}88` : 'none',
              }}
            />
          </div>
        ))}
      </div>

      <div className="text-[7px] font-mono text-gray-600 mt-1">RETURN</div>
    </div>
  );
}

export function Mixer() {
  const { project, selectedTrackId, selectTrack } = useProjectStore();
  const [showSendReturns] = useState(true);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#08080f', minHeight: 0 }}
    >
      {/* Mixer header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid #1a1a2a', background: '#0a0a14' }}
      >
        <div className="flex items-center gap-3">
          <h2
            className="text-sm font-bold font-mono tracking-widest"
            style={{
              background: 'linear-gradient(90deg, #9945ff, #00d4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            MIXER
          </h2>
          <span className="text-[10px] font-mono text-gray-600">
            {project.tracks.length} CHANNELS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
            style={{ background: '#1a1a2a', color: '#666', border: '1px solid #222' }}
          >
            INSERTS
          </button>
          <button
            className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
            style={{ background: '#1a1a2a', color: '#666', border: '1px solid #222' }}
          >
            SENDS
          </button>
          <button
            className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: '#1a2a3a', color: '#00d4ff', border: '1px solid #00d4ff33' }}
          >
            EQ
          </button>
        </div>
      </div>

      {/* Channel strips container */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ minHeight: 0 }}>
        <div
          className="flex gap-0.5 p-2 h-full"
          style={{ minWidth: 'max-content' }}
        >
          {/* Track channel strips */}
          {project.tracks.map((track) => (
            <ChannelStrip
              key={track.id}
              track={track}
              isSelected={selectedTrackId === track.id}
              onClick={() => selectTrack(track.id)}
            />
          ))}

          {/* Divider */}
          <div
            className="mx-1 rounded"
            style={{ width: 1, background: 'linear-gradient(to bottom, transparent, #9945ff44, transparent)' }}
          />

          {/* Send/Return strips */}
          {showSendReturns && (
            <>
              <SendReturnStrip name="REVERB" color="#9945ff" effectKey="reverb" />
              <SendReturnStrip name="DELAY" color="#00d4ff" effectKey="delay" />
            </>
          )}

          {/* Another divider */}
          <div
            className="mx-1 rounded"
            style={{ width: 1, background: 'linear-gradient(to bottom, transparent, #9945ff44, transparent)' }}
          />

          {/* Master strip */}
          <MasterStrip />
        </div>
      </div>

      {/* Bottom status bar */}
      <div
        className="flex items-center gap-4 px-4 py-1 shrink-0 text-[9px] font-mono"
        style={{ borderTop: '1px solid #1a1a2a', background: '#0a0a14', color: '#444' }}
      >
        <span>BPM: {project.bpm}</span>
        <span>SAMPLE RATE: 44100 Hz</span>
        <span>BIT DEPTH: 32-bit Float</span>
        <span>LATENCY: 5.8ms</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#00aa44', boxShadow: '0 0 4px #00aa44' }} />
          <span style={{ color: '#00aa44' }}>AUDIO ENGINE READY</span>
        </div>
      </div>
    </div>
  );
}
