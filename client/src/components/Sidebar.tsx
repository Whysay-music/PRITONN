import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Bookmark,
  Radio,
  Users,
  Moon,
  Sun,
  Settings,
  PlusCircle,
  Pin,
  Check,
  CheckCheck,
  Sparkles,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  MessageSquarePlus,
  Trash2,
  Bell,
  BellOff,
  Phone,
  Archive,
  Folder,
  ArrowLeft,
  Gamepad2,
} from 'lucide-react';
import { Chat, User, Story, CustomFolder } from '../types';
import { StoriesBar } from './StoriesBar';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { TelegramPremiumBadge } from './TelegramPremiumBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

interface SidebarProps {
  chats: Chat[];
  activeChat: Chat | null;
  currentUser: User;
  allUsers: User[];
  stories: Story[];
  isDark: boolean;
  activeTab?: string;
  isMenuOpen?: boolean;
  onToggleMenu?: () => void;
  onCloseMenu?: () => void;
  onSelectTab?: (tab: string) => void;
  onSelectChat: (chat: Chat) => void;
  onStartDirectChat: (targetUser: User) => void;
  onOpenSavedMessages: () => void;
  onOpenNewChatModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenCalls?: () => void;
  onOpenCustomFolders?: () => void;
  onOpenMiniApp?: () => void;
  onTogglePinChat?: (chat: Chat) => void;
  onToggleArchiveChat?: (chat: Chat) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onSelectStory: (story: Story) => void;
  onCreateStory: () => void;
  onRequestDeleteChat?: (chat: Chat) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChat,
  currentUser,
  allUsers,
  stories,
  isDark,
  activeTab: propActiveTab,
  isMenuOpen: propIsMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onSelectTab,
  onSelectChat,
  onStartDirectChat,
  onOpenSavedMessages,
  onOpenNewChatModal,
  onOpenSettingsModal,
  onOpenCalls,
  onOpenCustomFolders,
  onOpenMiniApp,
  onTogglePinChat,
  onToggleArchiveChat,
  onToggleTheme,
  onLogout,
  onSelectStory,
  onCreateStory,
  onRequestDeleteChat,
}) => {
  const [localTab, setLocalTab] = useState<string>('all');
  const activeTab = propActiveTab || localTab;
  const setActiveTab = onSelectTab || setLocalTab;
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const isMenuOpen = propIsMenuOpen !== undefined ? propIsMenuOpen : localMenuOpen;
  const setIsMenuOpen = (val: boolean) => {
    if (onCloseMenu && !val) {
      onCloseMenu();
    } else if (onToggleMenu) {
      onToggleMenu();
    } else {
      setLocalMenuOpen(val);
    }
  };
  const [chatContextMenu, setChatContextMenu] = useState<{ x: number; y: number; chat: Chat } | null>(null);
  const [highlightedChatId, setHighlightedChatId] = useState<string | null>(null);
  const prevLastMsgMap = useRef<{ [chatId: string]: string | undefined }>({});

  // Animate chat list item when a new message is received or sent
  useEffect(() => {
    chats.forEach((c) => {
      const prevMsgId = prevLastMsgMap.current[c.id];
      const currMsgId = c.lastMessage?.id;
      if (prevMsgId !== undefined && prevMsgId !== currMsgId) {
        setHighlightedChatId(c.id);
        const timer = setTimeout(() => {
          setHighlightedChatId((curr) => (curr === c.id ? null : curr));
        }, 1200);
        return () => clearTimeout(timer);
      }
      prevLastMsgMap.current[c.id] = currMsgId;
    });
  }, [chats]);

  const customFolders: CustomFolder[] = currentUser.customFolders || [];

  // Filter chats by tab
  const tabFilteredChats = chats.filter((c) => {
    if (showArchive) return c.isArchived;
    if (c.isArchived) return false;

    if (activeTab === 'all') return true;
    if (activeTab === 'channels') return c.type === 'channel';
    if (activeTab === 'groups') return c.type === 'group';
    if (activeTab === 'bots') return c.type === 'bot';
    if (activeTab === 'direct') return c.type === 'direct' || c.type === 'saved';

    // Check if custom folder
    const customFld = customFolders.find((f) => f.id === activeTab);
    if (customFld && customFld.chatIds) {
      return customFld.chatIds.includes(c.id);
    }

    return true;
  });

  // Helper to resolve display name, avatar, and target user for any chat
  const getChatInfo = (chat: Chat) => {
    const isSaved = chat.type === 'saved';
    const isDirect = chat.type === 'direct';
    const otherUserId = isDirect
      ? chat.members?.find((id) => id !== currentUser.id) || chat.targetUserId
      : null;
    const targetUser = isDirect
      ? (otherUserId ? allUsers.find((u) => u.id === otherUserId) : null) || chat.targetUser
      : null;

    const displayName = isSaved
      ? 'Избранное'
      : isDirect && targetUser
      ? targetUser.name
      : chat.displayName || chat.name;

    const displayAvatar = isSaved
      ? '/telegram-saved.svg'
      : isDirect && targetUser
      ? targetUser.avatar
      : (chat.displayAvatar || chat.avatar);

    return { displayName, displayAvatar, targetUser, isSaved, isDirect };
  };

  // Filter chats by search
  const filteredChats = tabFilteredChats.filter((c) => {
    if (!searchQuery.trim()) return true;
    const { displayName } = getChatInfo(c);
    const name = displayName.toLowerCase();
    const lastMsg = c.lastMessage?.text?.toLowerCase() || '';
    const q = searchQuery.toLowerCase();
    return name.includes(q) || lastMsg.includes(q);
  });

  // Sort: Pinned chats first, then recent
  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const timeA = a.lastMessage?.timestamp || 0;
    const timeB = b.lastMessage?.timestamp || 0;
    return timeB - timeA;
  });

  const archivedChats = chats.filter((c) => c.isArchived);

  // Filter users matching search query for direct messaging
  const matchingUsers = searchQuery.trim()
    ? allUsers.filter(
        (u) =>
          u.id !== currentUser.id &&
          (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const formatMessageTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="w-full md:w-[320px] lg:w-[350px] h-full bg-[var(--tg-sidebar)] md:border-r border-[var(--tg-border)] flex flex-col flex-shrink-0 select-none relative z-30">
      {/* Top Header: Telegram Desktop Hamburger Menu + Search Bar */}
      <div className="p-2.5 pb-2 flex items-center gap-2">
        {/* Telegram 3-line Hamburger Button (exact replica of Telegram Desktop) */}
        <button
          type="button"
          onClick={onToggleMenu}
          className="w-9 h-9 rounded-full flex flex-col items-center justify-center gap-[3.5px] text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] active:scale-95 transition flex-shrink-0 cursor-pointer"
          title="Главное меню"
          aria-label="Главное меню"
        >
          <span className="w-[18px] h-[2px] bg-current rounded-full transition-all" />
          <span className="w-[18px] h-[2px] bg-current rounded-full transition-all" />
          <span className="w-[18px] h-[2px] bg-current rounded-full transition-all" />
        </button>

        {/* Search Bar */}
        <div className="flex-1 flex items-center bg-[var(--tg-surface)] px-3 py-2 rounded-full border border-transparent focus-within:border-[#5288c1] transition">
          <Search size={16} className="text-[var(--tg-text-muted)] mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск"
            className="w-full bg-transparent text-xs text-[var(--tg-text)] placeholder-[var(--tg-text-muted)] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] ml-1 p-0.5 rounded-full"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stories Bar */}
      {!showArchive && (
        <StoriesBar
          stories={stories}
          currentUser={currentUser}
          onSelectStory={onSelectStory}
          onCreateStory={onCreateStory}
        />
      )}

      {/* Tabs (Standard + Custom User Folders) */}
      {!showArchive && (
        <div className="flex px-1 border-b border-[var(--tg-border)] text-xs font-medium text-[var(--tg-text-muted)] overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Все' },
            { id: 'direct', label: 'Личные' },
            { id: 'channels', label: 'Каналы' },
            { id: 'groups', label: 'Группы' },
            { id: 'bots', label: 'Боты' },
            ...customFolders.map((f) => ({ id: f.id, label: `${f.icon} ${f.name}` })),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 whitespace-nowrap text-center border-b-2 transition font-medium cursor-pointer ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent hover:text-[var(--tg-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Archive View Header */}
      {showArchive && (
        <div className="flex items-center gap-2.5 p-3 border-b border-[var(--tg-border)] bg-[var(--tg-surface)]">
          <button
            onClick={() => setShowArchive(false)}
            className="p-1.5 rounded-full hover:bg-[var(--tg-surface-hover)] text-[#5288c1] transition"
            title="Назад к чатам"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="font-semibold text-sm">Архив чатов ({archivedChats.length})</div>
        </div>
      )}

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {/* Contact search results if any */}
        {matchingUsers.length > 0 && (
          <div className="mb-2">
            <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider px-3 py-1">
              Глобальный поиск пользователей
            </div>
            {matchingUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => {
                  setSearchQuery('');
                  onStartDirectChat(u);
                }}
                className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-[var(--tg-surface-hover)] transition my-0.5"
              >
                <div className="relative">
                  <img
                    src={getAvatarUrl(u.avatar, u.name)}
                    onError={(e) => handleAvatarError(e, u.name)}
                    alt={u.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  {u.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[var(--tg-sidebar)] rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-xs truncate flex items-center gap-1">
                    <span>{u.name}</span>
                    {isUserVerified(u) && <TelegramVerifiedBadge size={14} />}
                    {u.isPremium && <TelegramPremiumBadge emojiStatus={u.emojiStatus} />}
                  </div>
                  <div className="text-[11px] text-[var(--tg-text-muted)] truncate">
                    @{u.username} •{' '}
                    {u.online ? (
                      <span className="text-[#5288c1] font-medium">в сети</span>
                    ) : (
                      <span>{u.lastSeen || 'был(а) недавно'}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="h-px bg-[var(--tg-border)] my-1" />
          </div>
        )}

        {/* Archive Folder Banner at top of chat list */}
        {!showArchive && archivedChats.length > 0 && (
          <div
            onClick={() => setShowArchive(true)}
            className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[var(--tg-surface-hover)] cursor-pointer transition mb-1 border-b border-[var(--tg-border)]/40"
          >
            <div className="w-12 h-12 rounded-full bg-[#182533] flex items-center justify-center text-[#5288c1] shadow-inner">
              <Archive size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm leading-tight text-[var(--tg-text)]">
                Архив чатов
              </div>
              <div className="text-xs text-[var(--tg-text-muted)] truncate mt-0.5">
                {archivedChats.length} диалогов скрыто
              </div>
            </div>
          </div>
        )}

        {sortedChats.length === 0 && matchingUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--tg-text-muted)] flex flex-col items-center justify-center h-64">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
              <MessageSquarePlus size={22} />
            </div>
            <p className="font-semibold text-sm text-[var(--tg-text)] mb-1">
              {showArchive ? 'Архив пуст' : 'У вас пока нет чатов'}
            </p>
            <p className="text-[11px] leading-relaxed max-w-[210px]">
              {showArchive
                ? 'Нажмите правой кнопкой на любой чат, чтобы отправить его в архив'
                : 'Нажмите кнопку ниже, чтобы создать группу, канал или напишите другу.'}
            </p>
          </div>
        ) : (
          sortedChats.map((chat) => {
            const isActive = activeChat?.id === chat.id;
            const lastMsg = chat.lastMessage;
            const isSentByMe = lastMsg?.senderId === currentUser.id;
            const { displayName, displayAvatar, targetUser, isSaved, isDirect } = getChatInfo(chat);

            const isHighlighted = highlightedChatId === chat.id;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setChatContextMenu({ x: e.clientX, y: e.clientY, chat });
                }}
                className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-200 my-0.5 relative group ${
                  isActive
                    ? 'bg-[#2b5278] text-white shadow-sm'
                    : 'hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text)]'
                } ${isHighlighted ? 'animate-chat-updated ring-1 ring-[#5288c1]/60' : ''}`}
              >
                {/* Chat Avatar */}
                <div className="relative flex-shrink-0">
                  {isSaved ? (
                    <div className="w-12 h-12 rounded-full bg-[#2481cc] flex items-center justify-center shadow-sm">
                      <Bookmark size={22} className="text-white fill-current" />
                    </div>
                  ) : (
                    <img
                      src={getAvatarUrl(displayAvatar, displayName)}
                      onError={(e) => handleAvatarError(e, displayName)}
                      alt={displayName}
                      className="w-12 h-12 rounded-full object-cover shadow-sm"
                    />
                  )}

                  {/* Online dot for direct chats */}
                  {isDirect && targetUser?.online && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[var(--tg-sidebar)] rounded-full" />
                  )}

                  {/* Channel icon badge */}
                  {chat.type === 'channel' && (
                    <span className="absolute -bottom-1 -right-1 bg-amber-500/90 text-white p-0.5 rounded-full border border-[var(--tg-sidebar)]">
                      <Radio size={10} />
                    </span>
                  )}
                </div>

                {/* Chat details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1 font-semibold text-sm truncate">
                      <span className="truncate">{displayName}</span>
                      {isUserVerified(targetUser) && (
                        <TelegramVerifiedBadge
                          size={14}
                          className={isActive ? 'brightness-125' : ''}
                        />
                      )}
                      {chat.targetUser?.isPremium && (
                        <TelegramPremiumBadge emojiStatus={chat.targetUser.emojiStatus} />
                      )}
                    </div>
                    <span
                      className={`text-[11px] flex-shrink-0 ml-1.5 ${
                        isActive ? 'text-blue-100' : 'text-[var(--tg-text-muted)]'
                      }`}
                    >
                      {formatMessageTime(lastMsg?.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-xs">
                    {/* Draft Indicator vs Last message */}
                    {chat.draft && !isActive ? (
                      <p className="truncate flex-1 text-[13px]">
                        <span className="text-rose-400 font-semibold mr-1">Черновик:</span>
                        <span className="text-[var(--tg-text-muted)] opacity-90">{chat.draft}</span>
                      </p>
                    ) : (
                      <p
                        className={`truncate flex-1 text-[13px] ${
                          isActive ? 'text-blue-100' : 'text-[var(--tg-text-muted)]'
                        }`}
                      >
                        {lastMsg ? (
                          <>
                            {isSentByMe ? (
                              <span className="inline-flex items-center mr-1">
                                {lastMsg?.status === 'read' ? (
                                  <CheckCheck size={14} className={isActive ? 'text-white' : 'text-[#5288c1]'} />
                                ) : (
                                  <Check size={14} className={isActive ? 'text-white' : ''} />
                                )}
                                <span className={`ml-1 font-medium ${isActive ? 'text-white' : 'text-[#5288c1]'}`}>Вы: </span>
                              </span>
                            ) : (
                              chat.type === 'group' && (
                                <span className={`font-medium mr-1 ${isActive ? 'text-white' : 'text-[#e1e3e6]'}`}>
                                  {(allUsers.find((u) => u.id === lastMsg.senderId)?.name || 'Участник').split(' ')[0]}:
                                </span>
                              )
                            )}
                            {lastMsg.type === 'call' ? (
                              lastMsg.callData?.duration && lastMsg.callData.duration > 0
                                ? `📞 Звонок (${Math.floor(lastMsg.callData.duration / 60)}:${(lastMsg.callData.duration % 60).toString().padStart(2, '0')})`
                                : `📞 Пропущенный звонок`
                            ) : lastMsg.isDice ? (
                              '🎲 Игра на кубике'
                            ) : lastMsg.isVoice ? (
                              '🎙 Голосовое сообщение'
                            ) : lastMsg.mediaUrl ? (
                              '📷 Фотография'
                            ) : (
                              lastMsg.text
                            )}
                          </>
                        ) : (
                          chat.description || 'Чат пуст'
                        )}
                      </p>
                    )}

                    {/* Unread badge & pinned */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {chat.isPinned && (
                        <Pin
                          size={13}
                          className={isActive ? 'text-blue-200' : 'text-[var(--tg-text-muted)] rotate-45'}
                        />
                      )}
                      {(chat.unreadCount || 0) > 0 && !isActive && (
                        <span className="min-w-[19px] h-[19px] px-1.5 bg-[#5288c1] text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-sm">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button (New Channel/Group) */}
      <button
        onClick={onOpenNewChatModal}
        className="absolute bottom-18 md:bottom-5 right-5 w-12 h-12 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white rounded-full flex items-center justify-center shadow-lg transition hover:scale-105 active:scale-95 z-20 cursor-pointer"
        title="Создать канал или группу"
      >
        <PlusCircle size={24} />
      </button>

      {/* Modern Mobile Bottom Navigation Bar (Telegram style on mobile phones) */}
      <nav className="md:hidden flex items-center justify-around py-2 px-1 border-t border-[var(--tg-border)] bg-[var(--tg-sidebar)] text-[var(--tg-text-muted)] z-20 pb-safe flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            setShowArchive(false);
            if (activeTab !== 'all') onSelectTab?.('all');
          }}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
            !showArchive && activeTab === 'all' ? 'text-[#2481cc] font-semibold' : 'hover:text-[var(--tg-text)]'
          }`}
        >
          <div className="relative">
            <Radio size={20} />
            {chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0) > 0 && (
              <span className="absolute -top-1 -right-2 px-1 min-w-[15px] h-3.5 bg-[#2481cc] text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0)}
              </span>
            )}
          </div>
          <span className="text-[10px]">Чаты</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenCalls?.()}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl hover:text-[var(--tg-text)] transition cursor-pointer"
        >
          <Phone size={20} />
          <span className="text-[10px]">Звонки</span>
        </button>

        <button
          type="button"
          onClick={onCreateStory}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl hover:text-[var(--tg-text)] transition cursor-pointer"
        >
          <PlusCircle size={20} className="text-[#2481cc]" />
          <span className="text-[10px]">История</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettingsModal}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl hover:text-[var(--tg-text)] transition cursor-pointer"
        >
          <Settings size={20} />
          <span className="text-[10px]">Настройки</span>
        </button>
      </nav>

      {/* Telegram Desktop Chat Context Menu */}
      {chatContextMenu && (
        <>
          <div
            className="fixed inset-0 z-50 cursor-default"
            onClick={() => setChatContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setChatContextMenu(null);
            }}
          />
          <div
            style={{
              top: Math.min(chatContextMenu.y, window.innerHeight - 240),
              left: Math.min(chatContextMenu.x, window.innerWidth - 220),
            }}
            className="fixed z-50 w-52 bg-[#212d3b] text-[#f5f5f5] rounded-xl shadow-2xl border border-[#17212b] p-1 animate-pop-in text-xs flex flex-col gap-0.5 select-none"
          >
            <button
              onClick={() => {
                onSelectChat(chatContextMenu.chat);
                setChatContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left cursor-pointer"
            >
              <span>Открыть чат</span>
            </button>

            {onTogglePinChat && (
              <button
                onClick={() => {
                  onTogglePinChat(chatContextMenu.chat);
                  setChatContextMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left cursor-pointer"
              >
                <Pin size={14} className="text-[#5288c1]" />
                <span>{chatContextMenu.chat.isPinned ? 'Открепить чат' : 'Закрепить чат'}</span>
              </button>
            )}

            {onToggleArchiveChat && (
              <button
                onClick={() => {
                  onToggleArchiveChat(chatContextMenu.chat);
                  setChatContextMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left cursor-pointer"
              >
                <Archive size={14} className="text-[#5288c1]" />
                <span>{chatContextMenu.chat.isArchived ? 'Вернуть из архива' : 'В архив'}</span>
              </button>
            )}

            <button
              onClick={() => {
                alert(`Уведомления для чата изменены`);
                setChatContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left cursor-pointer"
            >
              <Bell size={14} className="text-[#5288c1]" />
              <span>Отключить уведомления</span>
            </button>

            <div className="h-px bg-[#17212b] my-0.5" />

            {onRequestDeleteChat && (
              <button
                onClick={() => {
                  const target = chatContextMenu.chat;
                  setChatContextMenu(null);
                  onRequestDeleteChat(target);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-600/20 text-rose-400 transition text-left cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Удалить чат</span>
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
