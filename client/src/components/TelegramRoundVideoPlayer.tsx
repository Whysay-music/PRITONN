import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { resolveMediaUrl } from '../utils/avatar';

interface TelegramRoundVideoPlayerProps {
  src: string;
  duration?: number;
  isOutgoing?: boolean;
}

export const TelegramRoundVideoPlayer: React.FC<TelegramRoundVideoPlayerProps> = ({
  src,
  duration = 10,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const videoRef = useRef<HTMLVideoElement>(null);

  const resolvedSrc = resolveMediaUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      if (video.duration && isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
        setTotalDuration(video.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
    };
  }, [resolvedSrc]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.muted = isMuted;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Fallback: play muted if mobile WebView requires mute first
          video.muted = true;
          setIsMuted(true);
          video.play().then(() => setIsPlaying(true)).catch(() => {});
        });
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const next = !isMuted;
      videoRef.current.muted = next;
      setIsMuted(next);
    }
  };

  const safeTotal = totalDuration > 0 && isFinite(totalDuration) ? totalDuration : Math.max(duration || 5, 1);
  const progressPercent = Math.min(100, (currentTime / safeTotal) * 100);
  const circumference = 2 * Math.PI * 105;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div
      onClick={togglePlay}
      className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-full cursor-pointer group select-none overflow-hidden shadow-xl border-2 border-[#5288c1]/40 bg-black"
      title={isPlaying ? 'Пауза' : 'Смотреть видеокружок'}
    >
      {/* SVG Circular Progress Track */}
      <svg viewBox="0 0 224 224" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-20">
        <circle
          cx="112"
          cy="112"
          r="105"
          className="text-white/15 stroke-current"
          strokeWidth="4"
          fill="transparent"
        />
        <circle
          cx="112"
          cy="112"
          r="105"
          className="text-[#3390ec] stroke-current transition-all duration-150"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>

      {/* Video Content */}
      <video
        ref={videoRef}
        src={resolvedSrc}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover rounded-full"
      />

      {/* Play/Pause Overlay Icon on Hover or when paused */}
      <div
        className={`absolute inset-0 bg-black/25 flex items-center justify-center transition z-10 ${
          isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-sm shadow-md">
          {isPlaying ? (
            <Pause size={20} className="fill-current" />
          ) : (
            <Play size={20} className="fill-current ml-0.5" />
          )}
        </div>
      </div>

      {/* Volume button at bottom */}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-2.5 right-10 z-20 p-2 rounded-full bg-black/65 hover:bg-black/85 text-white transition backdrop-blur-sm cursor-pointer"
        title={isMuted ? 'Включить звук' : 'Без звука'}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {/* Duration time badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-2.5 py-0.5 rounded-full bg-black/65 text-[10px] font-mono text-white backdrop-blur-sm">
        {Math.floor(currentTime)}с / {Math.floor(safeTotal)}с
      </div>
    </div>
  );
};
