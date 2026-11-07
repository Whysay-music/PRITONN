import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Sparkles, Send, Image as ImageIcon } from 'lucide-react';
import { User, Story } from '../types';
import { API_BASE_URL } from '../config';

interface CreateStoryModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onStoryCreated: (story: Story) => void;
}

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onStoryCreated,
}) => {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video/');
    setMediaType(isVid ? 'video' : 'image');

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
        setMediaUrl(data.url);
        setIsUploading(false);
        return;
      }
    } catch (err) {
      console.warn('Upload error, using fallback DataURL:', err);
    }

    // Fallback DataURL
    const reader = new FileReader();
    reader.onload = () => {
      setMediaUrl(reader.result as string);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!mediaUrl) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          mediaUrl,
          mediaType,
          caption: caption.trim(),
        }),
      });

      if (res.ok) {
        const newStory: Story = await res.json();
        onStoryCreated(newStory);
        onClose();
        setMediaUrl(null);
        setCaption('');
      }
    } catch (err) {
      console.error('Create story error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[var(--tg-sidebar)] rounded-3xl border border-[var(--tg-card-border)] shadow-2xl overflow-hidden flex flex-col text-[var(--tg-text)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--tg-card-border)] flex items-center justify-between bg-[var(--tg-surface)]/60">
          <div className="flex items-center gap-2">
            <span className="text-xl">📸</span>
            <h3 className="font-bold text-base">Опубликовать историю</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Media Preview or Picker */}
        <div className="p-5 flex flex-col items-center gap-4">
          {mediaUrl ? (
            <div className="relative w-full aspect-[9/14] max-h-96 rounded-2xl overflow-hidden bg-black shadow-inner flex items-center justify-center">
              {mediaType === 'video' ? (
                <video src={mediaUrl} controls autoPlay loop className="w-full h-full object-contain" />
              ) : (
                <img src={mediaUrl} alt="Story preview" className="w-full h-full object-contain" />
              )}
              <button
                type="button"
                onClick={() => setMediaUrl(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                title="Сменить фото"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[9/12] max-h-80 rounded-2xl border-2 border-dashed border-[var(--tg-border-accent)]/50 bg-[var(--tg-surface)]/40 hover:bg-[var(--tg-surface)]/70 transition flex flex-col items-center justify-center gap-3 cursor-pointer group"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                <Camera size={26} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-[var(--tg-text)]">
                  {isUploading ? 'Загрузка медиа...' : 'Выберите фото или видео'}
                </div>
                <div className="text-xs text-[var(--tg-text-muted)] mt-0.5">
                  История будет видна всем контактам 24 часа
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Caption Input */}
          <div className="w-full">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Добавьте подпись к истории..."
              className="w-full px-4 py-2.5 bg-[var(--tg-surface)] border border-[var(--tg-card-border)] rounded-xl text-sm text-[var(--tg-text)] placeholder-[var(--tg-text-muted)] outline-none focus:border-[var(--tg-border-accent)] transition"
              maxLength={150}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--tg-card-border)] flex items-center justify-end gap-2 bg-[var(--tg-surface)]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!mediaUrl || isUploading}
            onClick={handleSubmit}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
              mediaUrl && !isUploading
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:opacity-95 active:scale-95'
                : 'bg-gray-600/30 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send size={14} />
            <span>Опубликовать</span>
          </button>
        </div>
      </div>
    </div>
  );
};
