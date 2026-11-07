import React, { useState } from 'react';
import { X, Forward, Search, Bookmark } from 'lucide-react';
import { Chat, Message, User } from '../types';

interface ForwardMessageModalProps {
  isOpen: boolean;
  message: Message | null;
  chats: Chat[];
  currentUser: User | null;
  onClose: () => void;
  onForward: (targetChatId: string) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  isOpen,
  message,
  chats,
  currentUser,
  onClose,
  onForward,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen || !message) return null;

  const filteredChats = chats.filter((c) => {
    const name = (c.displayName || c.name).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="w-full max-w-sm bg-[#17212b] text-[#f5f5f5] rounded-3xl p-5 shadow-2xl border border-[#242f3d] animate-pop-in flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
          <div className="flex items-center gap-2">
            <Forward size={18} className="text-[#5288c1]" />
            <h3 className="font-bold text-sm">Переслать сообщение</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message preview banner */}
        <div className="my-3 p-2.5 rounded-xl bg-[#0e1621] border border-[#242f3d] text-xs">
          <div className="text-[10px] text-[#5288c1] font-semibold mb-0.5">
            Сообщение для пересылки
          </div>
          <div className="text-[#f5f5f5] line-clamp-2">
            {message.text || (message.mediaUrl ? 'Медиафайл' : 'Голосовое сообщение')}
          </div>
        </div>

        {/* Search */}
        <div className="mb-2 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Выберите чат..."
            className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-[#7f91a4] outline-none focus:border-[#5288c1]"
          />
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7f91a4]" />
        </div>

        {/* Chats list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
          {filteredChats.map((c) => {
            const avatar = c.type === 'saved' ? '/telegram-saved.svg' : (c.displayAvatar || c.avatar);
            const name = c.displayName || c.name;

            return (
              <div
                key={c.id}
                onClick={() => {
                  onForward(c.id);
                  onClose();
                }}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#2b5278] cursor-pointer transition"
              >
                <img
                  src={avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate text-white">{name}</div>
                  <div className="text-[10px] text-[#7f91a4]">
                    {c.type === 'saved' ? 'Персональное облако' : c.type === 'channel' ? 'Канал' : c.type === 'group' ? 'Группа' : 'Личный чат'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
