import React, { useState, useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface PhotoViewerModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  title?: string;
  timestamp?: number;
  onClose: () => void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  isOpen,
  imageUrl,
  title,
  timestamp,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(s + 0.25, 3));
      if (e.key === '-') setScale((s) => Math.max(s - 0.25, 0.5));
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setScale(1);
      setRotation(0);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = title || `telegram_photo_${Date.now()}.jpg`;
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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md select-none animate-fade-in">
      {/* Top Controls Bar */}
      <div className="h-14 px-5 flex items-center justify-between text-white bg-gradient-to-b from-black/80 to-transparent z-10">
        <div>
          <div className="font-medium text-sm truncate max-w-md">
            {title || 'Фотография'}
          </div>
          {formattedDate && (
            <div className="text-xs text-white/60">{formattedDate}</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
            title="Уменьшить (-)"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-white/70 min-w-[3rem] text-center font-mono">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.25, 3))}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
            title="Увеличить (+)"
          >
            <ZoomIn size={18} />
          </button>

          {/* Rotate */}
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
            title="Повернуть"
          >
            <RotateCw size={18} />
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
            title="Скачать фото"
          >
            <Download size={18} />
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

      {/* Main Image Container */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden cursor-zoom-out"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={imageUrl}
          alt={title || 'Фото'}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }}
          className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl cursor-default"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};
