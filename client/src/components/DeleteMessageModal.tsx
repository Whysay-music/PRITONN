import React from 'react';
import { X, Trash2, Users, User as UserIcon } from 'lucide-react';
import { Message, User } from '../types';

interface DeleteMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  currentUser: User;
  onClose: () => void;
  onConfirmDelete: (messageId: string, forEveryone: boolean) => void;
}

export const DeleteMessageModal: React.FC<DeleteMessageModalProps> = ({
  isOpen,
  message,
  currentUser,
  onClose,
  onConfirmDelete,
}) => {
  if (!isOpen || !message) return null;

  const isMine = message.senderId === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-[var(--tg-border)] flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Trash2 size={16} className="text-rose-400" />
            <span>Удалить сообщение?</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3">
          <p className="text-xs text-[var(--tg-text-muted)] leading-relaxed">
            {isMine
              ? 'Вы можете удалить это сообщение только для себя или у всех участников чата.'
              : 'Вы можете удалить это сообщение из своей истории чата.'}
          </p>

          {message.text && (
            <div className="p-2.5 rounded-xl bg-[var(--tg-sidebar)] text-xs text-[var(--tg-text)] truncate border border-[var(--tg-border)]">
              «{message.text}»
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 mt-2">
            {isMine && (
              <button
                type="button"
                onClick={() => {
                  onConfirmDelete(message.id, true);
                  onClose();
                }}
                className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Users size={14} />
                <span>Удалить у всех</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onConfirmDelete(message.id, false);
                onClose();
              }}
              className="w-full py-2.5 px-3 bg-[var(--tg-sidebar)] hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text)] font-medium text-xs rounded-xl border border-[var(--tg-border)] transition flex items-center justify-center gap-2"
            >
              <UserIcon size={14} />
              <span>Удалить только у меня</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition mt-1"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
