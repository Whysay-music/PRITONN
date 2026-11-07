import React from 'react';
import {
  MessageSquare,
  User,
  Users,
  Radio,
  Bot,
  Bookmark,
  Settings,
  FolderPlus,
  Gamepad2,
} from 'lucide-react';
import { Chat, User as UserType } from '../types';

export type TabType = string;

interface DesktopFoldersBarProps {
  activeTab: string;
  chats: Chat[];
  currentUser?: UserType | null;
  hasUpdateAvailable?: boolean;
  onSelectTab: (tab: string) => void;
  onOpenSavedMessages: () => void;
  onOpenSettings: () => void;
  onOpenNewChatModal: () => void;
  onOpenCustomFolders?: () => void;
  onOpenMiniApp?: () => void;
  onOpenMenu?: () => void;
}

export const DesktopFoldersBar: React.FC<DesktopFoldersBarProps> = ({
  activeTab,
  chats,
  currentUser,
  hasUpdateAvailable = false,
  onSelectTab,
  onOpenSavedMessages,
  onOpenSettings,
  onOpenNewChatModal,
  onOpenCustomFolders,
  onOpenMiniApp,
  onOpenMenu,
}) => {
  // Calculate unread counts per folder
  const unreadAll = chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadDirect = chats
    .filter((c) => c.type === 'direct' || c.type === 'saved')
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadGroups = chats
    .filter((c) => c.type === 'group')
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadChannels = chats
    .filter((c) => c.type === 'channel')
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const unreadBots = chats
    .filter((c) => c.type === 'bot')
    .reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const customFolders = currentUser?.customFolders || [];

  const standardFolders: {
    id: string;
    label: string;
    icon: React.ReactNode;
    unread: number;
  }[] = [
    {
      id: 'all',
      label: 'Все',
      icon: <MessageSquare size={19} />,
      unread: unreadAll,
    },
    {
      id: 'direct',
      label: 'Личные',
      icon: <User size={19} />,
      unread: unreadDirect,
    },
    {
      id: 'groups',
      label: 'Группы',
      icon: <Users size={19} />,
      unread: unreadGroups,
    },
    {
      id: 'channels',
      label: 'Каналы',
      icon: <Radio size={19} />,
      unread: unreadChannels,
    },
    {
      id: 'bots',
      label: 'Боты',
      icon: <Bot size={19} />,
      unread: unreadBots,
    },
  ];

  return (
    <div className="w-[62px] h-full bg-[var(--tg-sidebar)]/90 backdrop-blur-xl border-r border-[var(--tg-card-border)] flex flex-col items-center py-2.5 select-none flex-shrink-0 z-40">
      {/* Telegram Hamburger button at top of folders bar */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="relative w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-[4px] text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] border border-transparent hover:border-[var(--tg-card-border)] active:scale-95 transition mb-2.5 cursor-pointer"
        title={hasUpdateAvailable ? 'Главное меню (Доступно обновление в Настройках!)' : 'Главное меню'}
      >
        <span className="w-[20px] h-[2px] bg-current rounded-full" />
        <span className="w-[20px] h-[2px] bg-current rounded-full" />
        <span className="w-[20px] h-[2px] bg-current rounded-full" />
        {hasUpdateAvailable && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[var(--tg-sidebar)] animate-pulse" />
        )}
      </button>

      {/* Standard Folder items */}
      <div className="flex-1 w-full flex flex-col items-center gap-1.5 overflow-y-auto no-scrollbar px-1">
        {standardFolders.map((f) => {
          const isActive = activeTab === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelectTab(f.id)}
              className={`relative w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 group cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-br from-[var(--tg-accent)]/30 to-[var(--tg-accent)]/10 text-white border border-[var(--tg-border-accent)]/60 shadow-sm'
                  : 'text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] border border-transparent hover:border-[var(--tg-card-border)]'
              }`}
              title={`${f.label} чаты`}
            >
              {/* Active left indicator pill */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[var(--tg-accent)] rounded-r-full shadow-sm" />
              )}
              <div className={`${isActive ? 'text-[var(--tg-accent)] scale-105' : 'group-hover:scale-105'} transition-transform`}>
                {f.icon}
              </div>
              <span className={`text-[9px] font-medium leading-none mt-1 truncate max-w-[46px] ${isActive ? 'text-[var(--tg-text)] font-semibold' : ''}`}>
                {f.label}
              </span>

              {/* Unread badge */}
              {f.unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-[var(--tg-accent)] text-white rounded-full text-[9px] font-bold flex items-center justify-center border border-[var(--tg-sidebar)] shadow">
                  {f.unread}
                </span>
              )}
            </button>
          );
        })}

        {/* Custom User Folders */}
        {customFolders.map((f) => {
          const isActive = activeTab === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelectTab(f.id)}
              className={`relative w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 group cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-br from-[var(--tg-accent)]/30 to-[var(--tg-accent)]/10 text-white border border-[var(--tg-border-accent)]/60 shadow-sm'
                  : 'text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] border border-transparent hover:border-[var(--tg-card-border)]'
              }`}
              title={`Папка: ${f.name}`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[var(--tg-accent)] rounded-r-full shadow-sm" />
              )}
              <span className="text-base leading-none group-hover:scale-110 transition-transform">{f.icon}</span>
              <span className="text-[8px] font-medium leading-none mt-1 truncate max-w-[46px]">
                {f.name}
              </span>
            </button>
          );
        })}

        {/* Mini Apps Shortcut Button */}
        {onOpenMiniApp && (
          <button
            type="button"
            onClick={onOpenMiniApp}
            className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-amber-400 hover:bg-[var(--tg-surface-hover)] hover:scale-105 border border-transparent hover:border-amber-500/30 transition-all mt-1 cursor-pointer"
            title="PRITONN Mini Apps"
          >
            <Gamepad2 size={18} />
            <span className="text-[8px] font-medium leading-none mt-1">Apps</span>
          </button>
        )}
      </div>

      {/* Bottom Actions: Saved Messages, Custom Folders, Settings */}
      <div className="w-full flex flex-col items-center gap-1.5 pt-2.5 border-t border-[var(--tg-card-border)] px-1">
        {onOpenCustomFolders && (
          <button
            type="button"
            onClick={onOpenCustomFolders}
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-[var(--tg-text-muted)] hover:text-[var(--tg-accent)] hover:bg-[var(--tg-surface-hover)] border border-transparent hover:border-[var(--tg-card-border)] transition cursor-pointer"
            title="Настроить папки чатов"
          >
            <FolderPlus size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSavedMessages}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-[var(--tg-text-muted)] hover:text-[var(--tg-accent)] hover:bg-[var(--tg-surface-hover)] border border-transparent hover:border-[var(--tg-card-border)] transition cursor-pointer"
          title="Избранное"
        >
          <Bookmark size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] border border-transparent hover:border-[var(--tg-card-border)] transition cursor-pointer"
          title={hasUpdateAvailable ? 'Настройки PRITONN — доступно обновление!' : 'Настройки PRITONN'}
        >
          <Settings size={18} />
          {hasUpdateAvailable && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[var(--tg-sidebar)] animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
};
