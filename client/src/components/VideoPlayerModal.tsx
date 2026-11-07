import React, { useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';
import { resolveMediaUrl } from '../utils/avatar';

interface VideoPlayerModalProps {
  isOpen: boolean;
  videoUrl: string | null;
  title?: string;
  timestamp?: number;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  isOpen,
  videoUrl,
  title,
  timestamp,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' && videoRef.current) {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !videoUrl) return null;

  const resolvedUrl = resolveMediaUrl(videoUrl);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = resolvedUrl;
    a.target = '_blank';
    a.download = title || `pritonn_video_${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleString([], {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none animate-fade-in safe-area-modal">
      {/* Top Header */}
      <div className="min-h-[56px] px-4 py-2 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-10">
        <div>
          <div className="font-medium text-sm truncate max-w-md">
            {title || 'Видеозапись'}
          </div>
          {formattedDate && (
            <div className="text-xs text-white/60">{formattedDate}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
            title="Скачать видео"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Скачать</span>
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Close */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-rose-500/20 text-white/80 hover:text-rose-400 transition"
            title="Закрыть (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center bg-black/40 rounded-xl overflow-hidden shadow-2xl border border-white/10">
          <video
            ref={videoRef}
            src={resolvedUrl}
            controls
            autoPlay
            playsInline
            className="w-full h-full max-h-[80vh] object-contain rounded-xl"
          />
        </div>
      </div>
    </div>
  );
};
