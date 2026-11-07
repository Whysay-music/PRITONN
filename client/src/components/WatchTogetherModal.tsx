import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Film, Link2, Volume2, VolumeX, Maximize2, RotateCcw } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface WatchTogetherModalProps {
  isOpen: boolean;
  socket?: Socket | null;
  chatId: string;
  currentUserId: string;
  onClose: () => void;
}

export const WatchTogetherModal: React.FC<WatchTogetherModalProps> = ({
  isOpen,
  socket,
  chatId,
  currentUserId,
  onClose,
}) => {
  const [videoUrl, setVideoUrl] = useState('https://www.w3schools.com/html/mov_bbb.mp4');
  const [inputUrl, setInputUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleSync = (payload: {
      action: 'play' | 'pause' | 'seek' | 'change_url';
      time?: number;
      url?: string;
      senderId?: string;
    }) => {
      if (payload.senderId === currentUserId) return;
      isSyncingRef.current = true;

      if (payload.action === 'change_url' && payload.url) {
        setVideoUrl(payload.url);
      } else if (payload.action === 'play') {
        if (payload.time !== undefined && videoRef.current) {
          videoRef.current.currentTime = payload.time;
        }
        videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      } else if (payload.action === 'pause') {
        videoRef.current?.pause();
        setIsPlaying(false);
        if (payload.time !== undefined && videoRef.current) {
          videoRef.current.currentTime = payload.time;
        }
      } else if (payload.action === 'seek' && payload.time !== undefined && videoRef.current) {
        videoRef.current.currentTime = payload.time;
        setCurrentTime(payload.time);
      }

      setTimeout(() => {
        isSyncingRef.current = false;
      }, 300);
    };

    socket.on('watch_together_sync', handleSync);
    return () => {
      socket.off('watch_together_sync', handleSync);
    };
  }, [socket, isOpen, currentUserId]);

  if (!isOpen) return null;

  const emitSync = (action: 'play' | 'pause' | 'seek' | 'change_url', time?: number, url?: string) => {
    if (isSyncingRef.current || !socket) return;
    socket.emit('watch_together_sync', {
      chatId,
      action,
      time: time ?? (videoRef.current ? videoRef.current.currentTime : 0),
      url: url ?? videoUrl,
      senderId: currentUserId,
    });
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      emitSync('pause', videoRef.current.currentTime);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        emitSync('play', videoRef.current ? videoRef.current.currentTime : 0);
      }).catch(() => {});
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      emitSync('seek', val);
    }
  };

  const handleLoadUrl = () => {
    if (!inputUrl.trim()) return;
    let finalUrl = inputUrl.trim();
    // Support youtube embed conversion if link is youtube
    if (finalUrl.includes('youtube.com/watch?v=')) {
      const vid = finalUrl.split('watch?v=')[1]?.split('&')[0];
      if (vid) finalUrl = `https://www.youtube.com/embed/${vid}?autoplay=1`;
    }
    setVideoUrl(finalUrl);
    emitSync('change_url', 0, finalUrl);
    setInputUrl('');
  };

  const isIframe = videoUrl.includes('youtube.com/embed') || videoUrl.includes('player.vimeo');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in duration-200">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-2xl rounded-3xl shadow-2xl border border-[var(--tg-card-border)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-3.5 bg-[var(--tg-sidebar)]/90 border-b border-[var(--tg-card-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Film size={18} />
            </div>
            <div>
              <h3 className="font-bold text-xs text-[var(--tg-text)] leading-tight">
                Кинозал • Совместный просмотр (Watch Together)
              </h3>
              <div className="text-[10px] text-[var(--tg-text-muted)]">
                Видео синхронизировано для всех участников звонка
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Area */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {isIframe ? (
            <iframe
              src={videoUrl}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              muted={isMuted}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setDuration(videoRef.current.duration || 0);
                }
              }}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain cursor-pointer"
              onClick={handleTogglePlay}
            />
          )}
        </div>

        {/* Media Controls for HTML5 video */}
        {!isIframe && (
          <div className="p-3 bg-[var(--tg-sidebar)]/60 border-t border-[var(--tg-card-border)] flex flex-col gap-2">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full accent-[var(--tg-accent)] h-1.5 bg-[var(--tg-surface)] rounded-lg cursor-pointer"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="w-8 h-8 rounded-xl bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white flex items-center justify-center transition cursor-pointer"
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] rounded-lg"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <span className="text-[11px] text-[var(--tg-text-muted)] font-mono">
                  {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} /{' '}
                  {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Load Video URL Bar */}
        <div className="p-3 bg-[var(--tg-sidebar)] border-t border-[var(--tg-card-border)] flex items-center gap-2">
          <Link2 size={16} className="text-[var(--tg-text-muted)] ml-1 flex-shrink-0" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Вставьте ссылку на MP4 видео или YouTube..."
            className="flex-1 bg-[var(--tg-surface)] border border-[var(--tg-card-border)] focus:border-[var(--tg-border-accent)] rounded-xl px-3 py-1.5 text-xs text-[var(--tg-text)] outline-none"
          />
          <button
            type="button"
            onClick={handleLoadUrl}
            className="px-3.5 py-1.5 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Запустить для всех
          </button>
        </div>
      </div>
    </div>
  );
};
