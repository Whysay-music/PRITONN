import React, { useState } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { Chat, User } from '../types';

interface DeleteChatModalProps {
  isOpen: boolean;
  chat: Chat | null;
  currentUser: User | null;
  onClose: () => void;
  onConfirmDelete: (chatId: string, forEveryone: boolean) => void;
}

export const DeleteChatModal: React.FC<DeleteChatModalProps> = ({
  isOpen,
  chat,
  currentUser,
  onClose,
  onConfirmDelete,
}) => {
  const [forEveryone, setForEveryone] = useState(true);

  if (!isOpen || !chat) return null;

  const displayName = chat.displayName || chat.name;
  const isDirect = chat.type === 'direct';

  const handleDelete = () => {
    onConfirmDelete(chat.id, forEveryone);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-[var(--tg-border)] flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2 font-semibold text-base text-rose-400">
            <Trash2 size={18} />
            <span>Удалить чат</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          <p className="text-sm leading-relaxed text-[var(--tg-text)]">
            Вы действительно хотите удалить диалог с <span className="font-semibold text-white">«{displayName}»</span>?
          </p>

          {isDirect && (
            <label className="flex items-center gap-2.5 cursor-pointer bg-[var(--tg-sidebar)] p-3 rounded-xl border border-[var(--tg-border)]">
              <input
                type="checkbox"
                checked={forEveryone}
                onChange={(e) => setForEveryone(e.target.checked)}
                className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
              />
              <span className="text-xs text-[var(--tg-text)] font-medium">
                Также удалить для {displayName}
              </span>
            </label>
          )}

          <div className="text-[11px] text-[var(--tg-text-muted)] leading-relaxed">
            Это действие нельзя будет отменить. Все сообщения и вложения из этого чата будут удалены.
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-[var(--tg-border)] bg-[var(--tg-sidebar)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition font-medium"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-md transition"
          >
            Удалить чат
          </button>
        </div>
      </div>
    </div>
  );
};
