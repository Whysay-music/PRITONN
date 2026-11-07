import React, { useState } from 'react';
import { X, Sparkles, Image as ImageIcon } from 'lucide-react';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (mediaUrl: string, caption: string) => void;
}

const PRESET_STORIES = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [mediaUrl, setMediaUrl] = useState(PRESET_STORIES[0]);
  const [caption, setCaption] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl.trim()) return;
    onSubmit(mediaUrl, caption);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--tg-border)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Sparkles className="text-amber-400" size={18} />
            <span>Опубликовать историю</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1.5">
              Предпросмотр фото
            </label>
            <div className="w-full h-48 rounded-xl overflow-hidden bg-black/20 border border-[var(--tg-border)] relative">
              <img
                src={mediaUrl}
                alt="Story preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PRESET_STORIES[0];
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1.5">
              Выберите фото или вставьте ссылку:
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {PRESET_STORIES.map((url, i) => (
                <div
                  key={i}
                  onClick={() => setMediaUrl(url)}
                  className={`h-14 rounded-lg overflow-hidden cursor-pointer border-2 transition ${
                    mediaUrl === url
                      ? 'border-blue-500 scale-105'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={url}
                    alt="preset"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-[var(--tg-sidebar)] px-3 py-2 rounded-xl border border-[var(--tg-border)]">
              <ImageIcon size={16} className="text-[var(--tg-text-muted)]" />
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                className="bg-transparent text-xs w-full outline-none text-[var(--tg-text)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1.5">
              Подпись к истории
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавьте яркую подпись..."
              className="w-full bg-[var(--tg-sidebar)] px-3 py-2.5 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)] placeholder-[var(--tg-text-muted)]"
            />
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white text-sm font-medium rounded-xl shadow-md transition"
            >
              Опубликовать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
