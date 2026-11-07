import React from 'react';
import { MessageSquare, Camera, Phone, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface MobileBottomNavProps {
  activeTab: 'chats' | 'stories' | 'calls' | 'menu';
  unreadCount?: number;
  onSelectTab: (tab: 'chats' | 'stories' | 'calls' | 'menu') => void;
  currentUser: User;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  unreadCount = 0,
  onSelectTab,
  currentUser,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--tg-sidebar)]/95 border-t border-[var(--tg-card-border)] backdrop-blur-xl px-2 py-1 flex items-center justify-around shadow-2xl safe-area-bottom select-none">
      {/* Chats */}
      <button
        type="button"
        onClick={() => onSelectTab('chats')}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer relative ${
          activeTab === 'chats'
            ? 'text-[var(--tg-accent)] font-bold'
            : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
        }`}
      >
        <div className="relative">
          <MessageSquare size={19} className={activeTab === 'chats' ? 'scale-110 transition-transform' : ''} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">Чаты</span>
      </button>

      {/* Stories */}
      <button
        type="button"
        onClick={() => onSelectTab('stories')}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeTab === 'stories'
            ? 'text-[var(--tg-accent)] font-bold'
            : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
        }`}
      >
        <div className="w-5 h-5 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 via-rose-500 to-amber-500 flex items-center justify-center">
          <Camera size={13} className="text-white" />
        </div>
        <span className="text-[10px]">Истории</span>
      </button>

      {/* Calls */}
      <button
        type="button"
        onClick={() => onSelectTab('calls')}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeTab === 'calls'
            ? 'text-[var(--tg-accent)] font-bold'
            : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
        }`}
      >
        <Phone size={19} className={activeTab === 'calls' ? 'scale-110 transition-transform' : ''} />
        <span className="text-[10px]">Звонки</span>
      </button>

      {/* Menu / Profile */}
      <button
        type="button"
        onClick={() => onSelectTab('menu')}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition cursor-pointer ${
          activeTab === 'menu'
            ? 'text-[var(--tg-accent)] font-bold'
            : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
        }`}
      >
        <div className="w-5 h-5 rounded-full overflow-hidden border border-white/30">
          <img
            src={currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.name}`}
            alt={currentUser.name}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="text-[10px]">Меню</span>
      </button>
    </nav>
  );
};
