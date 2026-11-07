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
  Lock,
  GripVertical,
} from 'lucide-react';
import { Chat, User, Story, CustomFolder, Message } from '../types';
import { StoriesBar } from './StoriesBar';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { TelegramPremiumBadge } from './TelegramPremiumBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import { API_BASE_URL } from '../config';
import { getChatDraft } from '../utils/drafts';

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
  onLockApp?: () => void;
  isAppLockEnabled?: boolean;
  hasUpdateAvailable?: boolean;
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
  onLockApp,
  isAppLockEnabled,
  hasUpdateAvailable = false,
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
  const [, setDraftRefreshTick] = useState(0);

  useEffect(() => {
    const onDraftUpdate = () => setDraftRefreshTick((t) => t + 1);
    window.addEventListener('pritonn-draft-updated', onDraftUpdate);
    return () => window.removeEventListener('pritonn-draft-updated', onDraftUpdate);
  }, []);
  const [highlightedChatId, setHighlightedChatId] = useState<string | null>(null);
  const prevLastMsgMap = useRef<{ [chatId: string]: string | undefined }>({});

  // Drag and Drop & Custom Chat Reordering state
  const [chatOrder, setChatOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`pritonn_chat_order_${currentUser.id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveChatOrder = (newOrder: string[]) => {
    setChatOrder(newOrder);
    try {
      localStorage.setItem(`pritonn_chat_order_${currentUser.id}`, JSON.stringify(newOrder));
    } catch {}
  };

  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [dragOverChatId, setDragOverChatId] = useState<string | null>(null);
  const [isOverArchiveZone, setIsOverArchiveZone] = useState<boolean>(false);

  // Global Messages Search State
  const [matchedMessages, setMatchedMessages] = useState<Message[]>([]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setMatchedMessages([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/messages/search?q=${encodeURIComponent(q)}&userId=${currentUser.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setMatchedMessages(data);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser.id]);

  // Animate chat list item when a new message is received in background chats (NEVER the currently active one)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    chats.forEach((c) => {
      const prevMsgId = prevLastMsgMap.current[c.id];
      const currMsgId = c.lastMessage?.id;
      // Strictly ignore active chat so it never blinks while typing or viewing
      if (activeChat?.id === c.id) {
        prevLastMsgMap.current[c.id] = currMsgId;
        return;
      }
      if (prevMsgId !== undefined && currMsgId && prevMsgId !== currMsgId) {
        setHighlightedChatId(c.id);
        timer = setTimeout(() => {
          setHighlightedChatId((curr) => (curr === c.id ? null : curr));
        }, 1200);
      }
      prevLastMsgMap.current[c.id] = currMsgId;
    });
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [chats, activeChat?.id]);

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

  // Sort: Pinned chats first (respecting custom order if set), then regular chats (custom order or recent timestamp)
  const pinnedChats = filteredChats.filter((c) => c.isPinned);
  const regularChats = filteredChats.filter((c) => !c.isPinned);

  pinnedChats.sort((a, b) => {
    const iA = chatOrder.indexOf(a.id);
    const iB = chatOrder.indexOf(b.id);
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1;
    if (iB !== -1) return 1;
    return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
  });

  regularChats.sort((a, b) => {
    const iA = chatOrder.indexOf(a.id);
    const iB = chatOrder.indexOf(b.id);
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1;
    if (iB !== -1) return 1;
    return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0);
  });

  const sortedChats = [...pinnedChats, ...regularChats];

  const handleDropOnChat = (targetChatId: string) => {
    if (!draggedChatId || draggedChatId === targetChatId) {
      setDraggedChatId(null);
      setDragOverChatId(null);
      return;
    }

    const currentIds = sortedChats.map((c) => c.id);
    const fromIndex = currentIds.indexOf(draggedChatId);
    const toIndex = currentIds.indexOf(targetChatId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...currentIds];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      saveChatOrder(updated);
    }

    setDraggedChatId(null);
    setDragOverChatId(null);
  };

  const handleDropIntoArchive = () => {
    if (!draggedChatId) return;
    const target = chats.find((c) => c.id === draggedChatId);
    if (target && onToggleArchiveChat && !target.isArchived) {
      onToggleArchiveChat(target);
    }
    setDraggedChatId(null);
    setDragOverChatId(null);
    setIsOverArchiveZone(false);
  };

  const handleExtractFromArchive = (chatId: string) => {
    const target = chats.find((c) => c.id === chatId);
    if (target && onToggleArchiveChat && target.isArchived) {
      onToggleArchiveChat(target);
    }
    setDraggedChatId(null);
    setDragOverChatId(null);
  };

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
          className="relative w-9 h-9 rounded-full flex flex-col items-center justify-center gap-[3.5px] text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] active:scale-95 transition flex-shrink-0 cursor-pointer"
          title={hasUpdateAvailable ? 'Главное меню (Доступно обновление в Настройках!)' : 'Главное меню'}
          aria-label="Главное меню"
        >
          <span className="w-[18px] h-[2px] bg-current rounded-full transition-all" />
          <span className="w-[18px] h-[2px] bg-current rounded-full transition-all" />
          <span className="w-[18px] h-[2px] bg-current rounded-full transition-all" />
          {hasUpdateAvailable && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-[var(--tg-sidebar)] animate-pulse" />
          )}
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

        {/* Quick App Lock button */}
        {isAppLockEnabled && onLockApp && (
          <button
            type="button"
            onClick={onLockApp}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--tg-text-muted)] hover:text-[#3390ec] hover:bg-[var(--tg-surface-hover)] transition cursor-pointer flex-shrink-0"
            title="Заблокировать PRITONN (App Lock)"
          >
            <Lock size={16} />
          </button>
        )}
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

        {/* Global Messages Search Results */}
        {matchedMessages.length > 0 && (
          <div className="mb-2">
            <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider px-3 py-1 flex items-center justify-between">
              <span>Найденные сообщения</span>
              <span className="text-[10px] text-[var(--tg-text-muted)] font-normal">{matchedMessages.length} шт.</span>
            </div>
            {matchedMessages.map((m) => {
              const parentChat = chats.find((c) => c.id === m.chatId);
              const sender = allUsers.find((u) => u.id === m.senderId);
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (parentChat) {
                      setSearchQuery('');
                      onSelectChat(parentChat);
                    }
                  }}
                  className="flex flex-col p-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] cursor-pointer text-xs transition my-0.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold mb-0.5">
                    <span className="truncate max-w-[160px] text-[#5288c1]">
                      {parentChat?.name || sender?.name || 'Диалог'}
                    </span>
                    <span className="text-[10px] text-[var(--tg-text-muted)]">
                      {new Date(m.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="truncate text-[var(--tg-text-muted)] text-[11px]">
                    {m.text}
                  </p>
                </div>
              );
            })}
            <div className="h-px bg-[var(--tg-border)] my-1" />
          </div>
        )}

        {/* Archive Folder Banner & Drag-to-Archive Drop Zone at top of chat list */}
        {!showArchive && (archivedChats.length > 0 || draggedChatId) && (
          <div
            onClick={() => setShowArchive(true)}
            onDragOver={(e) => {
              e.preventDefault();
              setIsOverArchiveZone(true);
            }}
            onDragLeave={() => setIsOverArchiveZone(false)}
            onDrop={(e) => {
              e.preventDefault();
              handleDropIntoArchive();
            }}
            className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all mb-1 border ${
              isOverArchiveZone
                ? 'bg-[var(--tg-accent)]/25 border-[var(--tg-border-accent)] scale-[1.02] shadow-lg animate-pulse'
                : draggedChatId
                ? 'bg-[var(--tg-surface)] border-dashed border-[var(--tg-border-accent)]/70 animate-pulse'
                : 'hover:bg-[var(--tg-surface-hover)] border-transparent border-b-[var(--tg-card-border)]'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-inner transition-colors ${
                isOverArchiveZone ? 'bg-[var(--tg-accent)] text-white' : 'bg-[#182533] text-[#5288c1]'
              }`}
            >
              <Archive size={20} className={isOverArchiveZone ? 'animate-bounce' : ''} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm leading-tight text-[var(--tg-text)] flex items-center justify-between">
                <span>Архив чатов</span>
                {draggedChatId && (
                  <span className="text-[10px] text-[var(--tg-accent)] font-bold">
                    {isOverArchiveZone ? 'Отпустите здесь' : 'Бросьте в архив'}
                  </span>
                )}
              </div>
              <div className="text-xs text-[var(--tg-text-muted)] truncate mt-0.5">
                {draggedChatId
                  ? 'Перетащите диалог сюда для скрытия'
                  : `${archivedChats.length} диалогов скрыто`}
              </div>
            </div>
          </div>
        )}

        {/* Drag out of archive drop target (when inside archive) */}
        {showArchive && draggedChatId && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsOverArchiveZone(true);
            }}
            onDragLeave={() => setIsOverArchiveZone(false)}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedChatId) handleExtractFromArchive(draggedChatId);
            }}
            className="p-3 mb-2 rounded-2xl border-2 border-dashed border-emerald-500/70 bg-emerald-500/15 text-emerald-400 text-xs font-semibold text-center flex items-center justify-center gap-2 cursor-pointer shadow animate-pulse"
          >
            <ArrowLeft size={16} />
            <span>Отпустите здесь, чтобы вернуть чат из Архива</span>
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
            const localDraft = getChatDraft(currentUser.id, chat.id);

            const isBeingDragged = draggedChatId === chat.id;
            const isTargetOver = dragOverChatId === chat.id;

            return (
              <div
                key={chat.id}
                draggable={!searchQuery}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', chat.id);
                  setDraggedChatId(chat.id);
                }}
                onDragEnd={() => {
                  setDraggedChatId(null);
                  setDragOverChatId(null);
                  setIsOverArchiveZone(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedChatId && draggedChatId !== chat.id) {
                    setDragOverChatId(chat.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverChatId === chat.id) setDragOverChatId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnChat(chat.id);
                }}
                onClick={() => onSelectChat(chat)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setChatContextMenu({ x: e.clientX, y: e.clientY, chat });
                }}
                className={`flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer my-0.5 relative group select-none transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--tg-accent)]/35 via-[#2b5278]/40 to-[#1c5f94]/20 border border-[var(--tg-border-accent)]/60 text-white shadow-md'
                    : 'border border-transparent hover:border-[var(--tg-card-border)] hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text)]'
                } ${isBeingDragged ? 'opacity-30 scale-95 border-dashed border-[var(--tg-accent)]' : ''} ${
                  isHighlighted && !isActive ? 'animate-chat-updated ring-1 ring-[#5288c1]/60' : ''
                }`}
              >
                {/* Visual line indicating where the chat will drop when reordering */}
                {isTargetOver && (
                  <div className="absolute -top-1 left-2 right-2 h-1 bg-[var(--tg-accent)] rounded-full shadow-md z-30 animate-pulse" />
                )}
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
                      {targetUser?.emojiStatus && (
                        <span className="text-xs flex-shrink-0 select-none" title="Эмодзи-статус">
                          {targetUser.emojiStatus}
                        </span>
                      )}
                      {chat.liveStream?.isLive && (
                        <span className="px-1.5 py-0.2 rounded-md bg-rose-600 text-white text-[9px] font-bold animate-pulse flex-shrink-0">
                          LIVE
                        </span>
                      )}
                      {targetUser?.listeningTrack?.isPlaying && (
                        <span
                          className="text-[10.5px] text-cyan-400 font-semibold flex items-center gap-0.5 ml-1 animate-pulse flex-shrink-0"
                          title={`Слушает: ${targetUser.listeningTrack.title}`}
                        >
                          <span>🎵</span>
                          <span className="truncate max-w-[90px] hidden sm:inline text-[10px] font-medium text-cyan-300">
                            {targetUser.listeningTrack.title}
                          </span>
                        </span>
                      )}
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
                    {/* Draft Indicator (strictly local to currentUser) vs Last message */}
                    {localDraft && !isActive ? (
                      <p className="truncate flex-1 text-[13px]">
                        <span className="text-rose-400 font-semibold mr-1">Черновик:</span>
                        <span className="text-[var(--tg-text-muted)] opacity-90">{localDraft}</span>
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

                    {/* Unread badge, pinned & drag handle */}
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
                      <span title="Перетащите для изменения порядка" className="hidden sm:inline-flex">
                        <GripVertical
                          size={13}
                          className="text-[var(--tg-text-muted)] opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing"
                        />
                      </span>
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
