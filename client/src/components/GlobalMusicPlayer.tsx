import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, X, Volume2, VolumeX, SkipBack, SkipForward, Music } from 'lucide-react';
import { resolveMediaUrl } from '../utils/avatar';

export interface AudioTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  duration?: number;
}

interface GlobalMusicPlayerProps {
  currentTrack: AudioTrack | null;
  playlist?: AudioTrack[];
  onClose: () => void;
  onTrackChange?: (track: AudioTrack) => void;
}

export const GlobalMusicPlayer: React.FC<GlobalMusicPlayerProps> = ({
  currentTrack,
  playlist = [],
  onClose,
  onTrackChange,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!currentTrack) return;
    if (audioRef.current) {
      audioRef.current.src = resolveMediaUrl(currentTrack.url);
      audioRef.current.playbackRate = playbackRate;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [currentTrack]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const playNext = () => {
    if (!playlist || playlist.length === 0 || !currentTrack) return;
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % playlist.length;
    if (onTrackChange) onTrackChange(playlist[nextIndex]);
  };

  const playPrev = () => {
    if (!playlist || playlist.length === 0 || !currentTrack) return;
    const currentIndex = playlist.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    if (onTrackChange) onTrackChange(playlist[prevIndex]);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="w-full bg-[#17212b]/95 dark:bg-[#0e1621]/95 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3 text-white z-30 shadow-md select-none transition-all">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={playNext}
      />

      {/* Track Info */}
      <div className="flex items-center gap-2.5 min-w-0 max-w-[200px] sm:max-w-xs">
        <div className="w-8 h-8 rounded-lg bg-[#5288c1]/20 text-[#5288c1] flex items-center justify-center flex-shrink-0">
          <Music size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{currentTrack.title}</p>
          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
            {currentTrack.artist || 'PRITONN Music Player'}
          </p>
        </div>
      </div>

      {/* Controls & Scrubber */}
      <div className="flex-1 max-w-md flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          {playlist.length > 1 && (
            <button
              type="button"
              onClick={playPrev}
              className="text-zinc-400 hover:text-white transition p-1 cursor-pointer"
              title="Предыдущий трек"
            >
              <SkipBack size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={togglePlay}
            className="w-7 h-7 rounded-full bg-[#5288c1] hover:bg-blue-500 text-white flex items-center justify-center transition shadow cursor-pointer active:scale-95"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>

          {playlist.length > 1 && (
            <button
              type="button"
              onClick={playNext}
              className="text-zinc-400 hover:text-white transition p-1 cursor-pointer"
              title="Следующий трек"
            >
              <SkipForward size={15} />
            </button>
          )}
        </div>

        <div className="w-full flex items-center gap-2 text-[10px] text-zinc-400">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#5288c1]"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed, Volume & Close */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={cycleSpeed}
          className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-bold text-[#5288c1] transition cursor-pointer"
          title="Скорость воспроизведения"
        >
          {playbackRate}x
        </button>

        <button
          type="button"
          onClick={toggleMute}
          className="text-zinc-400 hover:text-white transition p-1 cursor-pointer hidden sm:block"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-rose-400 transition p-1 cursor-pointer"
          title="Закрыть плеер"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
