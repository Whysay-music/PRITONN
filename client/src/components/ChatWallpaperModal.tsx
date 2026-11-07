import React, { useState } from 'react';
import { X, Check, Image as ImageIcon, Sparkles, Upload } from 'lucide-react';

interface ChatWallpaperModalProps {
  isOpen: boolean;
  chatId: string;
  currentWallpaper?: string;
  onClose: () => void;
  onSaveWallpaper: (wallpaperUrl: string) => void;
}

export const WALLPAPER_PRESETS = [
  {
    id: 'default',
    name: 'Стандартный тёмный',
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

export const ChatWallpaperModal: React.FC<ChatWallpaperModalProps> = ({
  isOpen,
  chatId,
  currentWallpaper = '',
  onClose,
  onSaveWallpaper,
}) => {
  const [selectedWallpaper, setSelectedWallpaper] = useState(currentWallpaper);
  const [customInputUrl, setCustomInputUrl] = useState('');

  if (!isOpen) return null;

  const handleApply = () => {
    const finalUrl = customInputUrl.trim() || selectedWallpaper;
    onSaveWallpaper(finalUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md rounded-2xl shadow-2xl border border-[var(--tg-border)] overflow-hidden flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-[#3390ec]" />
            <h3 className="font-bold text-sm">Обои для чата</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-xs text-[var(--tg-text-muted)]">
            Выберите готовый фоновый рисунок или укажите ссылку на своё изображение:
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
                      ? 'border-[#3390ec] shadow-md scale-105'
                      : 'border-transparent opacity-80 hover:opacity-100 hover:scale-102'
                  }`}
                  style={{
                    background: preset.url
                      ? `url(${preset.url}) center/cover no-repeat`
                      : preset.preview,
                  }}
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
              Или вставьте ссылку на картинку (URL):
            </label>
            <input
              type="text"
              placeholder="https://example.com/wallpaper.jpg"
              value={customInputUrl}
              onChange={(e) => setCustomInputUrl(e.target.value)}
              className="w-full bg-[var(--tg-surface-hover)] px-3 py-2 rounded-xl text-xs text-[var(--tg-text)] outline-none border border-transparent focus:border-[#3390ec]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 bg-black/10 dark:bg-white/5 border-t border-[var(--tg-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#3390ec] hover:bg-blue-600 text-white transition shadow cursor-pointer active:scale-95"
          >
            Применить обои
          </button>
        </div>
      </div>
    </div>
  );
};
