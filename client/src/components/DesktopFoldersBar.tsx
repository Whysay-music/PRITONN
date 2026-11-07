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
    <div className="w-[58px] h-full bg-[#0e1621] border-r border-[#101921] flex flex-col items-center py-2 select-none flex-shrink-0 z-40">
      {/* Telegram Hamburger button at top of folders bar */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="relative w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-[3.5px] text-[#7f91a4] hover:text-[#f5f5f5] hover:bg-[#17212b] active:scale-95 transition mb-2 cursor-pointer"
        title={hasUpdateAvailable ? 'Главное меню (Доступно обновление в Настройках!)' : 'Главное меню'}
      >
        <span className="w-[18px] h-[2px] bg-current rounded-full" />
        <span className="w-[18px] h-[2px] bg-current rounded-full" />
        <span className="w-[18px] h-[2px] bg-current rounded-full" />
        {hasUpdateAvailable && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#0e1621] animate-pulse" />
        )}
      </button>

      {/* Standard Folder items */}
      <div className="flex-1 w-full flex flex-col items-center gap-1 overflow-y-auto no-scrollbar">
        {standardFolders.map((f) => {
          const isActive = activeTab === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelectTab(f.id)}
              className={`relative w-11 h-11 rounded-xl flex flex-col items-center justify-center transition group cursor-pointer ${
                isActive
                  ? 'bg-[#2b5278] text-[#5288c1]'
                  : 'text-[#7f91a4] hover:bg-[#17212b] hover:text-[#f5f5f5]'
              }`}
              title={`${f.label} чаты`}
            >
              {/* Active left indicator pill */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#5288c1] rounded-r-full" />
              )}
              <div className={`${isActive ? 'text-white' : ''}`}>{f.icon}</div>
              <span className="text-[9px] font-medium leading-none mt-1 truncate max-w-[44px]">
                {f.label}
              </span>

              {/* Unread badge */}
              {f.unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#5288c1] text-white rounded-full text-[9px] font-bold flex items-center justify-center border border-[#0e1621]">
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
              className={`relative w-11 h-11 rounded-xl flex flex-col items-center justify-center transition group cursor-pointer ${
                isActive
                  ? 'bg-[#2b5278] text-[#5288c1]'
                  : 'text-[#7f91a4] hover:bg-[#17212b] hover:text-[#f5f5f5]'
              }`}
              title={`Папка: ${f.name}`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#5288c1] rounded-r-full" />
              )}
              <span className="text-base leading-none">{f.icon}</span>
              <span className="text-[8px] font-medium leading-none mt-1 truncate max-w-[44px]">
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
            className="w-11 h-11 rounded-xl flex flex-col items-center justify-center text-amber-400 hover:bg-[#17212b] hover:scale-105 transition mt-1 cursor-pointer"
            title="PRITONN Mini Apps"
          >
            <Gamepad2 size={18} />
            <span className="text-[8px] font-medium leading-none mt-1">Apps</span>
          </button>
        )}
      </div>

      {/* Bottom Actions: Saved Messages, Custom Folders, Settings */}
      <div className="w-full flex flex-col items-center gap-1 pt-2 border-t border-[#17212b]/60">
        {onOpenCustomFolders && (
          <button
            type="button"
            onClick={onOpenCustomFolders}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[#7f91a4] hover:text-[#5288c1] hover:bg-[#17212b] transition cursor-pointer"
            title="Настроить папки чатов"
          >
            <FolderPlus size={18} />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSavedMessages}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#7f91a4] hover:text-[#5288c1] hover:bg-[#17212b] transition cursor-pointer"
          title="Избранное"
        >
          <Bookmark size={18} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="relative w-10 h-10 rounded-xl flex items-center justify-center text-[#7f91a4] hover:text-[#f5f5f5] hover:bg-[#17212b] transition cursor-pointer"
          title={hasUpdateAvailable ? 'Настройки PRITONN — доступно обновление!' : 'Настройки PRITONN'}
        >
          <Settings size={18} />
          {hasUpdateAvailable && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[#0e1621] animate-pulse" />
          )}
        </button>
      </div>
    </div>
  );
};
