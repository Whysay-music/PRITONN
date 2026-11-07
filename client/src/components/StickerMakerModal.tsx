import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Upload, Download, Send, Check } from 'lucide-react';
import { User } from '../types';
import { API_BASE_URL } from '../config';

interface StickerMakerModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onSaveSticker?: (stickerUrl: string) => void;
  onSendSticker?: (stickerUrl: string) => void;
}

export const StickerMakerModal: React.FC<StickerMakerModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSaveSticker,
  onSendSticker,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [borderWidth, setBorderWidth] = useState<number>(8);
  const [borderColor, setBorderColor] = useState<string>('#ffffff');
  const [stickerText, setStickerText] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 320;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);

      // Fit image inside canvas with padding for sticker border
      const pad = borderWidth + 16;
      const drawSize = size - pad * 2;
      const hRatio = drawSize / img.width;
      const vRatio = drawSize / img.height;
      const ratio = Math.min(hRatio, vRatio);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (size - w) / 2;
      const y = (size - h) / 2;

      // Draw sticker shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;

      // White outline sticker effect
      if (borderWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth * 2;
        ctx.lineJoin = 'round';
        ctx.strokeRect(x, y, w, h);
      }

      ctx.shadowColor = 'transparent';
      ctx.drawImage(img, x, y, w, h);

      // Draw text if entered
      if (stickerText.trim()) {
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(stickerText.trim(), size / 2, size - 20);
        ctx.fillText(stickerText.trim(), size / 2, size - 20);
      }
    };
  }, [imageSrc, borderWidth, borderColor, stickerText]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setIsSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const getCanvasDataUrl = (): string | null => {
    if (!canvasRef.current) return null;
    return canvasRef.current.toDataURL('image/png');
  };

  const handleSave = async () => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) return;

    try {
      await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/stickers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickerUrl: dataUrl }),
      });
      setIsSaved(true);
      if (onSaveSticker) onSaveSticker(dataUrl);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.warn('Save sticker error:', err);
    }
  };

  const handleSend = () => {
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) return;
    if (onSendSticker) onSendSticker(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--tg-sidebar)] rounded-3xl border border-[var(--tg-card-border)] shadow-2xl overflow-hidden flex flex-col text-[var(--tg-text)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--tg-card-border)] flex items-center justify-between bg-[var(--tg-surface)]/60">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-amber-400" />
            <h3 className="font-bold text-base">Конструктор стикеров</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center gap-4">
          {imageSrc ? (
            <div className="w-72 h-72 rounded-2xl bg-pattern bg-checkerboard flex items-center justify-center border border-[var(--tg-card-border)] shadow-inner">
              <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-72 h-72 rounded-2xl border-2 border-dashed border-[var(--tg-border-accent)]/50 bg-[var(--tg-surface)]/40 hover:bg-[var(--tg-surface)]/70 transition flex flex-col items-center justify-center gap-3 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm">Загрузить фото для стикера</div>
                <div className="text-xs text-[var(--tg-text-muted)] mt-0.5">PNG, JPG или WebP</div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {imageSrc && (
            <div className="w-full flex flex-col gap-3 text-xs">
              {/* Border Width Slider */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-[var(--tg-text-muted)] font-medium">Обводка стикера:</span>
                <input
                  type="range"
                  min="0"
                  max="16"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                  className="flex-1 accent-[var(--tg-accent)]"
                />
                <span className="font-bold w-6 text-right">{borderWidth}px</span>
              </div>

              {/* Text over sticker */}
              <input
                type="text"
                value={stickerText}
                onChange={(e) => setStickerText(e.target.value)}
                placeholder="Текст на стикере (мем)..."
                className="w-full px-3 py-2 bg-[var(--tg-surface)] border border-[var(--tg-card-border)] rounded-xl outline-none focus:border-[var(--tg-border-accent)] text-xs text-[var(--tg-text)]"
                maxLength={30}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--tg-card-border)] flex items-center justify-between bg-[var(--tg-surface)]/60">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer"
          >
            {imageSrc ? 'Выбрать другое фото' : ''}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!imageSrc}
              onClick={handleSave}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isSaved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--tg-surface)] hover:bg-[var(--tg-surface-hover)] border border-[var(--tg-card-border)] text-[var(--tg-text)]'
              }`}
            >
              {isSaved ? <Check size={14} /> : <Download size={14} />}
              <span>{isSaved ? 'Сохранено!' : 'В мои стикеры'}</span>
            </button>

            <button
              type="button"
              disabled={!imageSrc}
              onClick={handleSend}
              className="px-4 py-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>Отправить</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
