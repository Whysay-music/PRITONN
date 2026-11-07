import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Upload, Edit3, Image as ImageIcon } from 'lucide-react';
import { Chat } from '../types';
import { API_BASE_URL } from '../config';

interface EditChatModalProps {
  isOpen: boolean;
  chat: Chat | null;
  onClose: () => void;
  onSave: (chatId: string, updated: { name: string; description: string; avatar: string }) => void;
}

export const EditChatModal: React.FC<EditChatModalProps> = ({
  isOpen,
  chat,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever modal opens or active chat changes
  useEffect(() => {
    if (chat && isOpen) {
      setName(chat.displayName || chat.name || '');
      setDescription(chat.description || '');
      setAvatar(chat.displayAvatar || chat.avatar || '');
    }
  }, [chat, isOpen]);

  if (!isOpen || !chat) return null;

  // Handle custom photo upload from PC
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local object URL preview immediately
    const tempUrl = URL.createObjectURL(file);
    setAvatar(tempUrl);
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
        setAvatar(data.url);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (!name.trim()) return;

    onSave(chat.id, {
      name: name.trim(),
      description: description.trim(),
      avatar: avatar.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--tg-border)] flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2 font-semibold text-base">
            <Edit3 size={18} className="text-blue-400" />
            <span>Редактировать чат</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full cursor-pointer group transition hover:scale-105 border-2 border-blue-500 overflow-hidden shadow-md bg-[#17212b] flex items-center justify-center"
              title="Нажмите, чтобы загрузить фото для чата"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon size={32} className="text-[var(--tg-text-muted)]" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                <Camera size={24} />
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1.5 mt-1"
            >
              <Upload size={13} />
              <span>{isUploading ? 'Загрузка...' : 'Загрузить фото с компьютера'}</span>
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
              Название чата *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название..."
              className="w-full bg-[var(--tg-sidebar)] px-3.5 py-2.5 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)] focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
              Описание чата
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите о чем чат..."
              className="w-full bg-[var(--tg-sidebar)] px-3.5 py-2 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)] resize-none focus:border-blue-500"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              {isUploading ? 'Загрузка фото...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
