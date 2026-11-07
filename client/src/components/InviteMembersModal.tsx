import React, { useState } from 'react';
import { X, UserPlus, Check, Search, Users } from 'lucide-react';
import { Chat, User } from '../types';

interface InviteMembersModalProps {
  isOpen: boolean;
  chat: Chat | null;
  allUsers: User[];
  currentUser: User;
  onClose: () => void;
  onInvite: (chatId: string, userIds: string[]) => void;
}

export const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  isOpen,
  chat,
  allUsers,
  currentUser,
  onClose,
  onInvite,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !chat) return null;

  // Filter users who are not yet members of this chat
  const nonMembers = allUsers.filter(
    (u) =>
      u.id !== currentUser.id &&
      (!chat.members || !chat.members.includes(u.id))
  );

  const filteredUsers = nonMembers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setIsSubmitting(true);
    await onInvite(chat.id, selectedIds);
    setIsSubmitting(false);
    setSelectedIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-[var(--tg-border)] flex flex-col max-h-[85vh] animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2 font-semibold text-base">
            <UserPlus size={18} className="text-blue-400" />
            <span>Пригласить в «{chat.displayName || chat.name}»</span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[var(--tg-border)] bg-[var(--tg-sidebar)]">
          <div className="flex items-center bg-[var(--tg-surface)] px-3 py-1.5 rounded-xl border border-[var(--tg-border)]">
            <Search size={15} className="text-[var(--tg-text-muted)] mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по имени или @username..."
              className="w-full bg-transparent text-xs text-[var(--tg-text)] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1 min-h-[160px]">
          {nonMembers.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--tg-text-muted)] flex flex-col items-center">
              <Users size={28} className="text-slate-500 mb-2 opacity-50" />
              <span>Все зарегистрированные пользователи уже состоят в этом чате.</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--tg-text-muted)]">
              Пользователи по запросу не найдены.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = selectedIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleSelect(u.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/50'
                      : 'hover:bg-[var(--tg-surface-hover)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={u.avatar}
                      alt={u.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-xs font-semibold leading-tight">{u.name}</div>
                      <div className="text-[11px] text-[var(--tg-text-muted)]">
                        @{u.username} • {u.lastSeen || 'в сети'}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-[var(--tg-border)] bg-transparent'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--tg-border)] bg-[var(--tg-sidebar)] flex items-center justify-between">
          <span className="text-xs text-[var(--tg-text-muted)]">
            Выбрано: {selectedIds.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0 || isSubmitting}
              onClick={handleInviteSubmit}
              className="px-4 py-1.5 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white text-xs font-semibold rounded-xl shadow-md transition disabled:opacity-40"
            >
              {isSubmitting ? 'Добавление...' : `Добавить (${selectedIds.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
