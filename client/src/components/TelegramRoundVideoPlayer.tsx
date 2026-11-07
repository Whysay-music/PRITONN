import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration)) {
        setTotalDuration(video.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const circumference = 2 * Math.PI * 105;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div
      onClick={togglePlay}
      className="relative w-56 h-56 rounded-full cursor-pointer group select-none overflow-hidden shadow-xl border border-white/10"
      title={isPlaying ? 'Пауза' : 'Смотреть со звуком'}
    >
      {/* SVG Circular Progress Track */}
      <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-20">
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
          className="text-[#5288c1] stroke-current transition-all duration-150"
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
        src={src}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover rounded-full scale-x-[-1]"
      />

      {/* Play/Pause Overlay Icon on Hover or when paused */}
      <div
        className={`absolute inset-0 bg-black/25 flex items-center justify-center transition z-10 ${
          isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm shadow-md">
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
        className="absolute bottom-2 right-12 z-20 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition backdrop-blur-sm"
        title={isMuted ? 'Включить звук' : 'Без звука'}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {/* Duration time badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-mono text-white backdrop-blur-sm">
        {Math.floor(currentTime)}с / {Math.floor(totalDuration)}с
      </div>
    </div>
  );
};
