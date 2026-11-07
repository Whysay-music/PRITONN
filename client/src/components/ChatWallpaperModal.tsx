import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Image as ImageIcon, Upload, Loader2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { resolveMediaUrl } from '../utils/avatar';

interface ChatWallpaperModalProps {
  isOpen: boolean;
  chatId: string;
  currentWallpaper?: string;
  onClose: () => void;
  onSaveWallpaper: (wallpaperUrl: string, applyToAllChats?: boolean) => void;
}

export const WALLPAPER_PRESETS = [
  {
    id: 'default',
    name: 'Стандартный',
    url: '',
    preview: 'linear-gradient(135deg, #0e1621 0%, #17212b 100%)',
  },
  {
    id: 'space',
    name: '🌌 Космос',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1200&q=80',
    preview: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
  },
  {
    id: 'sunset',
    name: '🌅 Закат',
    url: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=1200&q=80',
    preview: 'linear-gradient(135deg, #431407 0%, #7c2d12 50%, #991b1b 100%)',
  },
  {
    id: 'cyber',
    name: '🌲 Изумруд',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80',
    preview: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
  },
  {
    id: 'ocean',
    name: '🌊 Океан',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80',
    preview: 'linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)',
  },
  {
    id: 'neon',
    name: '🌸 Неон',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&q=80',
    preview: 'linear-gradient(135deg, #581c87 0%, #3b0764 100%)',
  },
];

/**
 * Compresses an image file on a canvas so local fallback never exceeds localStorage quota.
 */
function compressImageToDataUrl(file: File, maxDim = 1440, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const ChatWallpaperModal: React.FC<ChatWallpaperModalProps> = ({
  isOpen,
  currentWallpaper = '',
  onClose,
  onSaveWallpaper,
}) => {
  const [selectedWallpaper, setSelectedWallpaper] = useState(currentWallpaper);
  const [customInputUrl, setCustomInputUrl] = useState('');
  const [applyToAllChats, setApplyToAllChats] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedWallpaper(currentWallpaper || '');
      setCustomInputUrl('');
      setApplyToAllChats(false);
    }
  }, [isOpen, currentWallpaper]);

  if (!isOpen) return null;

  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          const fullUrl = resolveMediaUrl(data.url);
          setSelectedWallpaper(fullUrl);
          setCustomInputUrl('');
          setIsUploading(false);
          e.target.value = '';
          return;
        }
      }
    } catch (err) {
      console.warn('Wallpaper server upload fallback to compressed DataURL:', err);
    }

    try {
      const compressed = await compressImageToDataUrl(file);
      setSelectedWallpaper(compressed);
      setCustomInputUrl('');
    } catch (err) {
      console.error('Failed to process gallery image:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleApply = () => {
    const rawUrl = customInputUrl.trim() || selectedWallpaper;
    const finalUrl = rawUrl ? resolveMediaUrl(rawUrl) : '';
    onSaveWallpaper(finalUrl, applyToAllChats);
    onClose();
  };

  const isCustomGallerySelected =
    !!selectedWallpaper &&
    !customInputUrl &&
    !WALLPAPER_PRESETS.some((p) => p.url === selectedWallpaper);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in safe-area-modal">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md max-h-[90dvh] rounded-2xl shadow-2xl border border-[var(--tg-border)] overflow-hidden flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-[#3390ec]" />
            <h3 className="font-bold text-sm">Фон (обои) чата</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Custom Gallery Photo Upload Button */}
          <div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleGalleryFileChange}
              className="sr-only"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => galleryInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#3390ec] to-[#5288c1] hover:opacity-95 text-white font-semibold text-xs flex items-center justify-center gap-2.5 shadow-md transition active:scale-[0.98] cursor-pointer disabled:opacity-60"
            >
              {isUploading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  <span>Загрузка фото...</span>
                </>
              ) : (
                <>
                  <Upload size={17} />
                  <span>Выбрать своё фото из галереи / устройства</span>
                </>
              )}
            </button>
          </div>

          {/* Preview of chosen gallery photo */}
          {isCustomGallerySelected && (
            <div className="relative h-32 rounded-xl overflow-hidden border-2 border-[#3390ec] shadow-md">
              <img
                src={resolveMediaUrl(selectedWallpaper)}
                alt="Ваше фото фона"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-400" />
                  Ваше фото выбрано
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedWallpaper('')}
                  className="px-2 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Сбросить</span>
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--tg-text-muted)]">
            Готовые темы оформления фона:
          </p>

          {/* Grid of Presets */}
          <div className="grid grid-cols-3 gap-2.5">
            {WALLPAPER_PRESETS.map((preset) => {
              const isSelected = selectedWallpaper === preset.url && !customInputUrl;
              return (
                <div
                  key={preset.id}
                  onClick={() => {
                    setSelectedWallpaper(preset.url);
                    setCustomInputUrl('');
                  }}
                  className={`relative h-24 rounded-xl cursor-pointer overflow-hidden border-2 transition-all flex flex-col justify-end p-2 group ${
                    isSelected
                      ? 'border-[#3390ec] shadow-md scale-[1.03]'
                      : 'border-transparent opacity-85 hover:opacity-100'
                  }`}
                  style={
                    preset.url
                      ? {
                          backgroundImage: `url("${preset.url}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        }
                      : { background: preset.preview }
                  }
                >
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition" />
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#3390ec] text-white flex items-center justify-center shadow">
                      <Check size={12} />
                    </div>
                  )}
                  <span className="relative z-10 text-[11px] font-bold text-white drop-shadow">
                    {preset.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Custom URL Input */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--tg-border)]">
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block">
              Или вставьте прямую ссылку на картинку (URL):
            </label>
            <input
              type="text"
              placeholder="https://example.com/wallpaper.jpg"
              value={customInputUrl}
              onChange={(e) => setCustomInputUrl(e.target.value)}
              className="w-full bg-[var(--tg-surface-hover)] px-3 py-2 rounded-xl text-xs text-[var(--tg-text)] outline-none border border-transparent focus:border-[#3390ec]"
            />
          </div>

          {/* Apply to all chats option */}
          <label className="flex items-center gap-2.5 pt-1 cursor-pointer text-xs text-[var(--tg-text)]">
            <input
              type="checkbox"
              checked={applyToAllChats}
              onChange={(e) => setApplyToAllChats(e.target.checked)}
              className="w-4 h-4 rounded accent-[#3390ec] cursor-pointer"
            />
            <span>Установить этот фон для всех чатов</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 bg-black/10 dark:bg-white/5 border-t border-[var(--tg-border)] flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={handleApply}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#3390ec] hover:bg-blue-600 text-white transition shadow cursor-pointer active:scale-95 disabled:opacity-50"
          >
            Применить обои
          </button>
        </div>
      </div>
    </div>
  );
};
