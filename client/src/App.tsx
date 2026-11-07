import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, Chat, Message, Story } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ChatInfoDrawer } from './components/ChatInfoDrawer';
import { StoriesModal } from './components/StoriesModal';
import { CreateStoryModal } from './components/CreateStoryModal';
import { NewChatModal } from './components/NewChatModal';
import { SettingsModal } from './components/SettingsModal';
import { VoiceCallModal } from './components/VoiceCallModal';
import { IncomingCallModal } from './components/IncomingCallModal';
import { InviteMembersModal } from './components/InviteMembersModal';
import { DeleteMessageModal } from './components/DeleteMessageModal';
import { DeleteChatModal } from './components/DeleteChatModal';
import { EditChatModal } from './components/EditChatModal';
import { AuthScreen } from './components/AuthScreen';
import { DesktopTitleBar } from './components/DesktopTitleBar';
import { DesktopFoldersBar, TabType } from './components/DesktopFoldersBar';
import { TelegramDrawerMenu } from './components/TelegramDrawerMenu';
import { TelegramMiniAppModal } from './components/TelegramMiniAppModal';
import { CustomFoldersModal } from './components/CustomFoldersModal';
import { FullscreenEmojiEffect } from './components/FullscreenEmojiEffect';
import { CallHistoryModal } from './components/CallHistoryModal';
import { AppLockModal } from './components/AppLockModal';
import { GlobalMusicPlayer, AudioTrack } from './components/GlobalMusicPlayer';
import { soundEffects } from './utils/sound';
import { API_BASE_URL, APP_VERSION } from './config';
import { getAvatarUrl } from './utils/avatar';
import { setChatDraft } from './utils/drafts';
import {
  areNotificationsEnabled,
  showAppNotification,
  syncNativeBackgroundSettings,
} from './utils/notifications';
import { AppUpdateInfo, checkForAppUpdate, installAppUpdate } from './utils/updater';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [isTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isInitializing, setIsInitializing] = useState(true);

  // App Lock PIN Code state
  const [savedPin, setSavedPin] = useState<string | null>(() => {
    return localStorage.getItem('pritonn_app_pin') || null;
  });
  const [isAppLockEnabled, setIsAppLockEnabled] = useState<boolean>(() => {
    return localStorage.getItem('pritonn_app_lock_enabled') === 'true';
  });
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    const hasPin = !!localStorage.getItem('pritonn_app_pin');
    const enabled = localStorage.getItem('pritonn_app_lock_enabled') === 'true';
    return hasPin && enabled;
  });
  const [isSettingPin, setIsSettingPin] = useState<boolean>(false);

  // Global Audio / Music Player state
  const [activeAudioTrack, setActiveAudioTrack] = useState<AudioTrack | null>(null);
  const [musicPlaylist, setMusicPlaylist] = useState<AudioTrack[]>([]);

  // Sync background mode & notification permissions on startup + periodic update checks
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number>(0);
  const [updateStatusText, setUpdateStatusText] = useState<string>('');
  const [voiceChatInviteBanner, setVoiceChatInviteBanner] = useState<{
    chatId: string;
    chatName: string;
    inviterName: string;
  } | null>(null);

  useEffect(() => {
    syncNativeBackgroundSettings();
    if (areNotificationsEnabled() && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const runUpdateCheck = () => {
      checkForAppUpdate()
        .then((info) => {
          setUpdateInfo(info);
          if (info.hasUpdate && info.latestVersion) {
            const lastNotifiedVer = localStorage.getItem('pritonn_notified_update_ver');
            if (lastNotifiedVer !== info.latestVersion) {
              localStorage.setItem('pritonn_notified_update_ver', info.latestVersion);
              setIsUpdateDismissed(false);
              if (areNotificationsEnabled()) {
                showAppNotification({
                  title: `🚀 Вышло обновление PRITONN v${info.latestVersion}`,
                  body: 'Доступно новое обновление в Настройках! Откройте Настройки, чтобы обновить приложение.',
                  tag: `update_${info.latestVersion}`,
                  isCall: false,
                });
              }
            }
          }
        })
        .catch(() => {});
    };
    runUpdateCheck();
    const updateTimer = setInterval(runUpdateCheck, 3 * 60 * 1000);
    return () => clearInterval(updateTimer);
  }, []);

  // Open chat when user taps a system / OS notification
  useEffect(() => {
    const openChatById = (chatId?: string) => {
      if (!chatId) return;
      const found = chatsRef.current.find((c) => c.id === chatId);
      if (found) {
        selectChat(found);
      }
    };

    const onWebNotifOpen = (e: Event) => {
      const custom = e as CustomEvent<{ chatId?: string }>;
      openChatById(custom.detail?.chatId);
    };
    window.addEventListener('pritonn-open-chat', onWebNotifOpen);

    (window as any).__onAndroidNotificationOpen = (chatId: string) => {
      openChatById(chatId);
    };

    let unsubElectron: (() => void) | undefined;
    const electron = (window as any).electronAPI;
    if (electron && typeof electron.onNotificationClick === 'function') {
      unsubElectron = electron.onNotificationClick((chatId: string) => {
        openChatById(chatId);
      });
    }

    return () => {
      window.removeEventListener('pritonn-open-chat', onWebNotifOpen);
      if (unsubElectron) unsubElectron();
    };
  }, []);

  // Modals & Drawers
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [callChat, setCallChat] = useState<Chat | null>(null);
  const [callTargetUser, setCallTargetUser] = useState<User | null>(null);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    callerId: string;
    callerName: string;
    callerAvatar: string;
    callerVerified?: boolean;
    chatId: string;
    isVideo?: boolean;
  } | null>(null);
  const [isIncomingAccepted, setIsIncomingAccepted] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [chatToEdit, setChatToEdit] = useState<Chat | null>(null);
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [isMainMenuOpen, setIsMainMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('pritonn_is_dark');
    return saved !== null ? saved === 'true' : true;
  });
  const [isMiniAppOpen, setIsMiniAppOpen] = useState(false);
  const [isFoldersModalOpen, setIsFoldersModalOpen] = useState(false);
  const [activeFullscreenEmoji, setActiveFullscreenEmoji] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const currentUserRef = useRef<User | null>(currentUser);
  currentUserRef.current = currentUser;
  const activeChatRef = useRef<Chat | null>(activeChat);
  activeChatRef.current = activeChat;
  const allUsersRef = useRef<User[]>(allUsers);
  allUsersRef.current = allUsers;
  const chatsRef = useRef<Chat[]>(chats);
  chatsRef.current = chats;

  // Apply dark or light theme & update mobile status bar color
  useEffect(() => {
    localStorage.setItem('pritonn_is_dark', String(isDark));
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (isDark) {
      document.documentElement.classList.remove('light-theme');
      document.body.classList.remove('light-theme');
      if (metaTheme) metaTheme.setAttribute('content', '#0e1621');
    } else {
      document.documentElement.classList.add('light-theme');
      document.body.classList.add('light-theme');
      if (metaTheme) metaTheme.setAttribute('content', '#eef1f5');
    }
  }, [isDark]);

  // Android Hardware Back Button navigation support (prevents app crashes & accidental exits)
  useEffect(() => {
    const handleAndroidBack = () => {
      if (activeFullscreenEmoji) {
        setActiveFullscreenEmoji(null);
        return;
      }
      if (isMainMenuOpen) {
        setIsMainMenuOpen(false);
        return;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return;
      }
      if (isCallHistoryOpen) {
        setIsCallHistoryOpen(false);
        return;
      }
      if (isNewChatOpen) {
        setIsNewChatOpen(false);
        return;
      }
      if (isFoldersModalOpen) {
        setIsFoldersModalOpen(false);
        return;
      }
      if (isVoiceCallOpen) {
        setIsVoiceCallOpen(false);
        return;
      }
      if (isInfoDrawerOpen) {
        setIsInfoDrawerOpen(false);
        return;
      }
      // If user is inside an active chat on mobile, take them back to the chat list!
      if (activeChatRef.current) {
        setActiveChat(null);
        return;
      }
    };

    (window as any).onAndroidBack = handleAndroidBack;
    window.addEventListener('androidBackButton', handleAndroidBack);
    return () => {
      delete (window as any).onAndroidBack;
      window.removeEventListener('androidBackButton', handleAndroidBack);
    };
  }, [
    activeFullscreenEmoji,
    isMainMenuOpen,
    isSettingsOpen,
    isCallHistoryOpen,
    isNewChatOpen,
    isFoldersModalOpen,
    isVoiceCallOpen,
    isInfoDrawerOpen,
  ]);

  // Connect to Socket.io once and keep connection alive across server updates
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      query: {
        userId: localStorage.getItem('tg_user_id') || '',
        appVersion: APP_VERSION,
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const uid = currentUserRef.current?.id || localStorage.getItem('tg_user_id');
      if (uid) {
        socket.emit('user_online', { userId: uid });
      }
    });

    socket.on('new_message', (msg: Message & { members?: string[] }) => {
      const myId = currentUserRef.current?.id;
      if (!myId) return;

      // STRICT PRIVACY CHECK: Is current user a participant of this conversation?
      const currentChats = chatsRef.current || [];
      const targetChat = currentChats.find((c) => c.id === msg.chatId);
      const isRecipient =
        (Array.isArray(msg.members) && msg.members.includes(myId)) ||
        (targetChat && Array.isArray(targetChat.members) && targetChat.members.includes(myId)) ||
        msg.senderId === myId;

      if (!isRecipient) {
        // Message is between other people: do not play sound, do not modify state
        return;
      }

      // Check if message belongs to active chat
      if (activeChatRef.current && activeChatRef.current.id === msg.chatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      // Update chats list
      setChats((prevChats) => {
        const chatExists = prevChats.some((c) => c.id === msg.chatId);
        if (!chatExists && currentUserRef.current) {
          // If a new direct message or group message arrived, refresh user chats
          fetch(`${API_BASE_URL}/api/chats?userId=${currentUserRef.current.id}`)
            .then((r) => r.json())
            .then((newChats) => setChats(newChats))
            .catch(() => {});
          return prevChats;
        }

        return prevChats.map((c) => {
          if (c.id === msg.chatId) {
            return {
              ...c,
              lastMessage: msg,
              unreadCount:
                msg.senderId !== currentUserRef.current?.id && activeChatRef.current?.id !== msg.chatId
                  ? (c.unreadCount || 0) + 1
                  : c.unreadCount,
            };
          }
          return c;
        });
      });

      if (msg.senderId === myId) {
        soundEffects.playSent();
      } else if (!msg.isSilent && areNotificationsEnabled()) {
        soundEffects.playReceive();

        const shouldShowSystemNotif =
          document.hidden ||
          !document.hasFocus() ||
          activeChatRef.current?.id !== msg.chatId;

        if (shouldShowSystemNotif) {
          const sender = allUsersRef.current.find((u) => u.id === msg.senderId);
          const chatObj = chatsRef.current.find((c) => c.id === msg.chatId);
          const notifTitle =
            chatObj && (chatObj.type === 'group' || chatObj.type === 'channel')
              ? `${chatObj.displayName || chatObj.name} • ${sender?.name || 'Участник'}`
              : sender?.name || chatObj?.displayName || 'PRITONN';

          const notifBody = msg.isVoice
            ? '🎙 Голосовое сообщение'
            : msg.isRoundVideo
            ? '🎥 Видеосообщение'
            : msg.isSticker
            ? '✨ Стикер'
            : msg.mediaUrl
            ? msg.mediaType === 'audio'
              ? '🎵 Аудиозапись'
              : msg.mediaType === 'video'
              ? '🎬 Видео'
              : msg.mediaType === 'file'
              ? `📎 Файл: ${msg.fileName || 'документ'}`
              : '📷 Фотография'
            : msg.text || 'Новое сообщение';

          showAppNotification({
            title: notifTitle,
            body: notifBody,
            icon: getAvatarUrl(sender?.avatar, sender?.name),
            tag: msg.chatId,
            chatId: msg.chatId,
            isCall: false,
          });
        }

        if (document.hidden && 'vibrate' in navigator) {
          try {
            navigator.vibrate([200, 100, 200]);
          } catch {}
        }
      }
    });

    socket.on('messages_read', ({ chatId }: { chatId: string }) => {
      setActiveChat((curr) => {
        if (curr && curr.id === chatId) {
          setMessages((prev) =>
            prev.map((m) => (m.status !== 'read' ? { ...m, status: 'read' } : m))
          );
        }
        return curr;
      });
    });

    socket.on('message_updated', (updated: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    });

    socket.on('message_deleted', ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    });

    socket.on('message_deleted_for_user', ({ id, userId }: { id: string; userId: string }) => {
      if (currentUserRef.current && currentUserRef.current.id === userId) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    });

    socket.on('chat_deleted', ({ chatId, forEveryone, userId }: { chatId: string; forEveryone: boolean; userId?: string }) => {
      if (forEveryone || (currentUserRef.current && currentUserRef.current.id === userId)) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setActiveChat((curr) => (curr && curr.id === chatId ? null : curr));
      }
    });

    socket.on('chat_updated', (updatedChat: Chat) => {
      if (currentUserRef.current && updatedChat.members && !updatedChat.members.includes(currentUserRef.current.id)) {
        return;
      }
      const formatted = {
        ...updatedChat,
        name: updatedChat.name,
        displayName: updatedChat.name,
        avatar: updatedChat.avatar,
        displayAvatar: updatedChat.avatar,
        description: updatedChat.description,
      };
      setChats((prev) =>
        prev.map((c) =>
          c.id === updatedChat.id
            ? {
                ...c,
                ...formatted,
                lastMessage: updatedChat.lastMessage || c.lastMessage,
                unreadCount: updatedChat.unreadCount !== undefined ? updatedChat.unreadCount : c.unreadCount,
              }
            : c
        )
      );
      setActiveChat((curr) =>
        curr && curr.id === updatedChat.id
          ? {
              ...curr,
              ...formatted,
              lastMessage: updatedChat.lastMessage || curr.lastMessage,
              unreadCount: updatedChat.unreadCount !== undefined ? updatedChat.unreadCount : curr.unreadCount,
            }
          : curr
      );
    });

    // Strict chat isolation: only add if current user is an invited member!
    socket.on('new_chat', (chat: Chat) => {
      if (!currentUserRef.current) return;
      if (chat.members && !chat.members.includes(currentUserRef.current.id)) return;

      const isSaved = chat.type === 'saved';
      const isDirect = chat.type === 'direct';
      const otherUserId = isDirect
        ? chat.members?.find((id) => id !== currentUserRef.current?.id) || chat.targetUserId
        : null;
      const otherUser = otherUserId
        ? allUsersRef.current.find((u) => u.id === otherUserId) || chat.targetUser
        : null;

      const formattedChat: Chat = {
        ...chat,
        displayName: isSaved
          ? 'Избранное'
          : otherUser
          ? otherUser.name
          : chat.displayName || chat.name,
        displayAvatar: isSaved
          ? '/telegram-saved.svg'
          : otherUser
          ? otherUser.avatar
          : chat.displayAvatar || chat.avatar,
        targetUser: otherUser || chat.targetUser,
      };

      setChats((prev) => {
        if (prev.some((c) => c.id === chat.id)) return prev;
        return [formattedChat, ...prev];
      });
    });

    socket.on('new_story', (story: Story) => {
      setStories((prev) => [story, ...prev]);
    });

    socket.on('user_registered', (newUser: User) => {
      setAllUsers((prev) => {
        if (prev.some((u) => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
    });

    socket.on('user_updated', (updatedUser: User) => {
      setAllUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
      setCurrentUser((curr) =>
        curr && curr.id === updatedUser.id ? updatedUser : curr
      );
    });

    // Real-time online/offline presence tracking
    socket.on(
      'user_status_changed',
      ({
        userId,
        online,
        lastSeen,
        lastSeenTimestamp,
      }: {
        userId: string;
        online: boolean;
        lastSeen: string;
        lastSeenTimestamp?: number | null;
      }) => {
        setAllUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, online, lastSeen, lastSeenTimestamp } : u
          )
        );
        setChats((prev) =>
          prev.map((c) => {
            if (c.targetUser && c.targetUser.id === userId) {
              return {
                ...c,
                targetUser: { ...c.targetUser, online, lastSeen, lastSeenTimestamp },
              };
            }
            return c;
          })
        );
        setActiveChat((curr) => {
          if (curr && curr.targetUser && curr.targetUser.id === userId) {
            return {
              ...curr,
              targetUser: { ...curr.targetUser, online, lastSeen, lastSeenTimestamp },
            };
          }
          return curr;
        });
      }
    );

    // Call signaling & message editing/poll updates
    socket.on('incoming_call', (callData: any) => {
      setIncomingCall(callData);
      if (areNotificationsEnabled()) {
        showAppNotification({
          title: `📞 Входящий звонок: ${callData?.callerName || 'PRITONN'}`,
          body: 'Откройте приложение, чтобы ответить на вызов',
          icon: getAvatarUrl(callData?.callerAvatar, callData?.callerName),
          tag: 'incoming_call',
          chatId: callData?.chatId,
          isCall: true,
        });
      }
    });

    socket.on('call_ended', () => {
      setIncomingCall(null);
      setIsVoiceCallOpen(false);
      setIsIncomingAccepted(false);
      setCallChat(null);
      setCallTargetUser(null);
    });

    socket.on('voice_chat_invitation', ({ chatId, chatName, inviterName }: { chatId: string; chatName: string; inviterName: string }) => {
      if (areNotificationsEnabled()) {
        soundEffects.playReceive();
        showAppNotification({
          title: `🎙 Голосовой чат «${chatName}»`,
          body: `${inviterName} приглашает вас подключиться`,
          tag: `vc_${chatId}`,
          chatId,
          isCall: true,
        });
      }
      setVoiceChatInviteBanner({ chatId, chatName, inviterName });
    });

    socket.on('message_edited', (editedMsg: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === editedMsg.id ? editedMsg : m))
      );
    });

    socket.on('message_updated', (updatedMsg: Message) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
      );
    });

    socket.on('game_move', (payload: { messageId: string; board?: (string | null)[]; winner?: string | null; gameData?: any }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? {
                ...m,
                gameData: payload.gameData
                  ? payload.gameData
                  : m.gameData
                  ? { ...m.gameData, board: payload.board, winner: payload.winner }
                  : { type: 'tictactoe', board: payload.board, turn: 'X', winner: payload.winner, playerX: { id: '', name: '' } },
              }
            : m
        )
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Inform server when current user comes online & keep handshake query synced for auto-reconnects
  useEffect(() => {
    if (currentUser?.id && socketRef.current) {
      try {
        (socketRef.current.io.opts as any).query = {
          userId: currentUser.id,
          appVersion: APP_VERSION,
        };
      } catch {}
      socketRef.current.emit('user_online', { userId: currentUser.id });
    }
  }, [currentUser?.id]);

  const readSavedAccountVault = (): any | null => {
    try {
      const raw = localStorage.getItem('tg_user_backup');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const writeSavedAccountVault = (userObj: User) => {
    try {
      const prev = readSavedAccountVault();
      const preservedPassword = prev && prev.id === userObj.id ? prev.password : prev?.password;
      localStorage.setItem(
        'tg_user_backup',
        JSON.stringify({
          ...prev,
          ...userObj,
          ...(preservedPassword ? { password: preservedPassword } : {}),
        })
      );
    } catch {}
  };

  // Load initial data for user (with seamless account auto-restore across server updates)
  const loadUserData = async (userId: string) => {
    const vault = readSavedAccountVault();
    try {
      let [userRes, allUsersRes, chatsRes, storiesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/me?userId=${userId}`),
        fetch(`${API_BASE_URL}/api/users`),
        fetch(`${API_BASE_URL}/api/chats?userId=${userId}`),
        fetch(`${API_BASE_URL}/api/stories`),
      ]);

      // If server restarted or redeployed and account needs auto-restoration from local vault
      if (userRes.status === 404 && vault && vault.username) {
        const syncRes = await fetch(`${API_BASE_URL}/api/auth/sync-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(vault),
        });
        if (syncRes.ok) {
          const syncedUser = await syncRes.json();
          if (syncedUser?.id) {
            localStorage.setItem('tg_user_id', syncedUser.id);
            [userRes, allUsersRes, chatsRes] = await Promise.all([
              fetch(`${API_BASE_URL}/api/me?userId=${syncedUser.id}`),
              fetch(`${API_BASE_URL}/api/users`),
              fetch(`${API_BASE_URL}/api/chats?userId=${syncedUser.id}`),
            ]);
          }
        }
      }

      if (!userRes.ok) {
        // Temporary 502/503 during Railway deploy: keep user logged in from vault and retry!
        if (userRes.status >= 500 && vault) {
          setCurrentUser(vault);
          setTimeout(() => loadUserData(userId), 4000);
          return;
        }
        localStorage.removeItem('tg_user_id');
        setCurrentUser(null);
        setIsInitializing(false);
        return;
      }

      const user = await userRes.json();
      const allU = await allUsersRes.json();
      const chs = await chatsRes.json();
      const sts = await storiesRes.json();

      writeSavedAccountVault(user);
      setCurrentUser(user);
      setAllUsers(allU);
      setChats(chs);
      setStories(sts);

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (chs.length > 0 && !activeChat && !isMobile) {
        selectChat(chs[0], user.id);
      } else if (chs.length === 0) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      // Network offline or server restarting: preserve session via vault instead of logging out!
      if (vault && vault.id) {
        setCurrentUser((curr) => curr || vault);
        setTimeout(() => loadUserData(userId), 5000);
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    const savedUserId = localStorage.getItem('tg_user_id');
    fetch(`${API_BASE_URL}/api/users`)
      .then((res) => res.json())
      .then((users) => {
        if (Array.isArray(users)) setAllUsers(users);
        if (savedUserId) {
          loadUserData(savedUserId);
        } else {
          setIsInitializing(false);
        }
      })
      .catch(() => {
        if (savedUserId) {
          loadUserData(savedUserId);
        } else {
          setIsInitializing(false);
        }
      });
  }, []);

  // Login handler
  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('tg_user_id', user.id);
    writeSavedAccountVault(user);
    setCurrentUser(user);
    loadUserData(user.id);
  };

  // Logout handler
  const handleLogout = () => {
    if (currentUser?.id && socketRef.current) {
      socketRef.current.emit('user_offline', { userId: currentUser.id });
    }
    localStorage.removeItem('tg_user_id');
    localStorage.removeItem('tg_user_backup');
    setCurrentUser(null);
    setActiveChat(null);
    setChats([]);
    setMessages([]);
  };

  // Select a chat and fetch its messages
  const selectChat = async (chat: Chat, currentUserId?: string) => {
    setActiveChat(chat);
    const uid = currentUserId || currentUser?.id || '';
    if (!uid) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${chat.id}/messages?userId=${uid}`);
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const msgs = await res.json();
      setMessages(msgs);

      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  // Start direct chat with user
  const handleStartDirectChat = async (targetUser: User) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          targetUserId: targetUser.id,
        }),
      });
      const chat = await res.json();
      selectChat(chat);
    } catch (err) {
      console.error('Error starting direct chat:', err);
    }
  };

  // Start call directly with user from Call History Modal
  const handleStartCallWithUser = async (targetUser: User) => {
    setIsCallHistoryOpen(false);
    if (!currentUser) return;
    try {
      let directChat = chats.find(
        (c) => c.type === 'direct' && c.members?.includes(targetUser.id)
      );
      if (!directChat) {
        const res = await fetch(`${API_BASE_URL}/api/chats/direct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentUserId: currentUser.id,
            targetUserId: targetUser.id,
          }),
        });
        directChat = await res.json();
      }
      if (directChat) {
        if (!chats.some((c) => c.id === directChat.id)) {
          setChats((prev) => [directChat, ...prev]);
        }
        selectChat(directChat);
        setCallChat(directChat);
        setCallTargetUser(targetUser);
        setIsIncomingAccepted(false);
        setIsVoiceCallOpen(true);
      }
    } catch (err) {
      console.error('Error starting call with user:', err);
    }
  };

  // Open / create Saved Messages
  const handleOpenSavedMessages = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/saved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: currentUser.id }),
      });
      const chat = await res.json();
      selectChat(chat);
    } catch (err) {
      console.error('Error opening saved messages:', err);
    }
  };

  // Send message
  const handleSendMessage = async (data: {
    text: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video' | 'file' | 'audio' | 'voice' | null;
    fileName?: string | null;
    fileSize?: string | null;
    isVoice?: boolean;
    isRoundVideo?: boolean;
    voiceDuration?: number;
    audioDuration?: number;
    videoDuration?: number;
    poll?: any;
    replyToId?: string;
    forwardFrom?: { name: string; username?: string };
    isSilent?: boolean;
    isSticker?: boolean;
    stickerUrl?: string;
    isGif?: boolean;
    gifUrl?: string;
    gameData?: any;
    scheduledFor?: number;
  }) => {
    if (!activeChat || !currentUser) return;

    if (data.scheduledFor && data.scheduledFor > Date.now()) {
      const delay = data.scheduledFor - Date.now();
      setTimeout(() => {
        handleSendMessage({ ...data, scheduledFor: undefined });
      }, delay);
      alert(`Сообщение отложено и будет отправлено автоматически в ${new Date(data.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      return;
    }

    const targetChatId = activeChat.id;
    const directPartnerId =
      activeChat.type === 'direct'
        ? activeChat.members?.find((id) => id !== currentUser.id) || activeChat.targetUserId
        : undefined;

    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${targetChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          targetUserId: directPartnerId,
          ...data,
        }),
      });
      if (res.ok) {
        const savedMsg: Message = await res.json();
        const effectiveChatId = savedMsg.chatId || targetChatId;
        if (activeChatRef.current?.id === targetChatId || activeChatRef.current?.id === effectiveChatId) {
          setMessages((prev) => (prev.some((m) => m.id === savedMsg.id) ? prev : [...prev, savedMsg]));
        }
        setChats((prev) =>
          prev.map((c) =>
            c.id === targetChatId || c.id === effectiveChatId
              ? { ...c, id: effectiveChatId, lastMessage: savedMsg }
              : c
          )
        );
      } else {
        const errData = await res.json().catch(() => ({}));
        if (errData?.error) {
          alert(errData.error);
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Edit message
  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newText }),
      });
    } catch (err) {
      console.error('Error editing message:', err);
    }
  };

  // Vote in poll
  const handleVotePoll = async (pollId: string, optionId: string) => {
    if (!currentUser) return;
    const msg = messages.find((m) => m.poll && m.poll.id === pollId);
    if (!msg) return;
    try {
      await fetch(`${API_BASE_URL}/api/messages/${msg.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, userId: currentUser.id }),
      });
    } catch (err) {
      console.error('Error voting in poll:', err);
    }
  };

  // Forward message
  const handleForwardMessage = async (message: Message, targetChatId: string) => {
    if (!currentUser) return;
    const sender = allUsers.find((u) => u.id === message.senderId);
    try {
      await fetch(`${API_BASE_URL}/api/chats/${targetChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          text: message.text,
          mediaUrl: message.mediaUrl,
          mediaType: message.mediaType,
          fileName: message.fileName,
          fileSize: message.fileSize,
          isRoundVideo: message.isRoundVideo,
          isVoice: message.isVoice,
          voiceDuration: message.voiceDuration,
          poll: message.poll,
          forwardFrom: {
            name: sender ? sender.name : 'Пользователь',
            username: sender?.username,
          },
        }),
      });
    } catch (err) {
      console.error('Error forwarding message:', err);
    }
  };

  // React to message
  const handleReactMessage = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    try {
      await fetch(`${API_BASE_URL}/api/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emoji,
          userId: currentUser.id,
        }),
      });
    } catch (err) {
      console.error('Error reacting to message:', err);
    }
  };

  // Pin message
  const handlePinMessage = async (messageId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/messages/${messageId}/pin`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error pinning message:', err);
    }
  };

  // Delete message (only for me OR for everyone)
  const handleConfirmDeleteMessage = async (messageId: string, forEveryone: boolean) => {
    if (!currentUser) return;
    try {
      await fetch(
        `${API_BASE_URL}/api/messages/${messageId}?forEveryone=${forEveryone}&userId=${currentUser.id}`,
        { method: 'DELETE' }
      );
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  // Edit Chat details (Name, description, avatar)
  const handleSaveChat = async (chatId: string, updated: { name: string; description: string; avatar: string }) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updated,
          currentUserId: currentUser.id,
        }),
      });
      const newChat = await res.json();
      const formatted = {
        ...newChat,
        name: newChat.name,
        displayName: newChat.name,
        avatar: newChat.avatar,
        displayAvatar: newChat.avatar,
        description: newChat.description,
      };
      setActiveChat((curr) => (curr && curr.id === newChat.id ? { ...curr, ...formatted } : curr));
      setChats((prev) =>
        prev.map((c) => (c.id === newChat.id ? { ...c, ...formatted } : c))
      );
    } catch (err) {
      console.error('Error updating chat:', err);
    }
  };

  // Delete Chat (for current user OR for everyone)
  const handleDeleteChat = async (chatId: string, forEveryone: boolean) => {
    if (!currentUser) return;
    try {
      await fetch(
        `${API_BASE_URL}/api/chats/${chatId}?forEveryone=${forEveryone}&userId=${currentUser.id}`,
        { method: 'DELETE' }
      );
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChat?.id === chatId) {
        setActiveChat(null);
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  // Block / Unblock target user
  const handleToggleBlockUser = async () => {
    if (!currentUser || !activeChat) return;
    const targetUserId =
      activeChat.members?.find((id) => id !== currentUser.id) || activeChat.targetUserId;
    if (!targetUserId) return;

    const isBlocked = currentUser.blockedUserIds?.includes(targetUserId);
    const endpoint = isBlocked ? 'unblock' : 'block';

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${targetUserId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: currentUser.id }),
      });
      const data = await res.json();
      const updatedBlocked = data.blockedUserIds || [];
      const updatedUser = { ...currentUser, blockedUserIds: updatedBlocked };
      setCurrentUser(updatedUser);
      localStorage.setItem('tg_user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Error toggling block user:', err);
    }
  };

  // Create new channel or group with invited friends
  const handleCreateChat = async (chatData: {
    type: 'channel' | 'group';
    name: string;
    description: string;
    username: string;
    avatar?: string;
    memberIds: string[];
  }) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...chatData,
          currentUserId: currentUser.id,
        }),
      });
      const newChat = await res.json();
      selectChat(newChat);
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  // Invite members to existing chat
  const handleInviteMembers = async (chatId: string, userIds: string[]) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${chatId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          targetUserIds: userIds,
        }),
      });
      const updatedChat = await res.json();
      setActiveChat(updatedChat);
      setChats((prev) =>
        prev.map((c) => (c.id === updatedChat.id ? { ...c, ...updatedChat } : c))
      );
    } catch (err) {
      console.error('Error inviting members:', err);
    }
  };

  // Create Story
  const handleCreateStory = async (mediaUrl: string, caption: string) => {
    if (!currentUser) return;
    try {
      await fetch(`${API_BASE_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          mediaUrl,
          caption,
        }),
      });
    } catch (err) {
      console.error('Error creating story:', err);
    }
  };

  // Update profile
  const handleUpdateProfile = async (updated: Partial<User>) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          ...updated,
        }),
      });
      if (res.ok) {
        const u = await res.json();
        setCurrentUser(u);
        writeSavedAccountVault(u);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  // Toggle Pin chat
  const handleTogglePinChat = async (chat: Chat) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${chat.id}/pin`, { method: 'PUT' });
      const updated = await res.json();
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, isPinned: updated.isPinned } : c))
      );
      if (activeChat?.id === chat.id) {
        setActiveChat((curr) => (curr ? { ...curr, isPinned: updated.isPinned } : null));
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  // Toggle Archive chat
  const handleToggleArchiveChat = async (chat: Chat) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/${chat.id}/archive`, { method: 'PUT' });
      const updated = await res.json();
      setChats((prev) =>
        prev.map((c) => (c.id === chat.id ? { ...c, isArchived: updated.isArchived } : c))
      );
      if (activeChat?.id === chat.id) {
        setActiveChat((curr) => (curr ? { ...curr, isArchived: updated.isArchived } : null));
      }
    } catch (err) {
      console.error('Error toggling archive:', err);
    }
  };

  // Save chat draft text strictly locally on user's own device (never shared with other users!)
  const handleSaveDraft = (chatId: string, draft: string) => {
    if (!currentUser) return;
    setChatDraft(currentUser.id, chatId, draft);
  };

  // Burn message
  const handleBurnMessage = async (messageId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/messages/${messageId}/burn`, { method: 'POST' });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Error burning message:', err);
    }
  };

  // Persist real speech-to-text transcription for voice / audio message
  const handleTranscribeVoice = async (messageId: string, transcribedText?: string) => {
    if (!transcribedText || !transcribedText.trim()) return;
    try {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, transcribedText } : m))
      );
      const res = await fetch(`${API_BASE_URL}/api/messages/${messageId}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcribedText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.transcribedText) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, transcribedText: data.transcribedText } : m))
          );
        }
      }
    } catch (err) {
      console.error('Error saving message transcription:', err);
    }
  };

  const handleTriggerInAppUpdate = async () => {
    if (!updateInfo || isInstallingUpdate) return;
    setIsInstallingUpdate(true);
    setUpdateProgress(1);
    setUpdateStatusText('Подготовка обновления...');
    try {
      await installAppUpdate(updateInfo, (pct, status) => {
        setUpdateProgress(pct);
        setUpdateStatusText(status);
      });
    } catch (err: any) {
      alert(`Ошибка обновления: ${err?.message || 'Попробуйте снова через Настройки'}`);
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  // Create custom chat folder
  const handleCreateFolder = async (name: string, icon: string, chatIds: string[]) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, chatIds }),
      });
      const folder = await res.json();
      const updatedFolders = [...(currentUser.customFolders || []), folder];
      const updatedUser = { ...currentUser, customFolders: updatedFolders };
      setCurrentUser(updatedUser);
      localStorage.setItem('tg_user', JSON.stringify(updatedUser));
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  // Delete custom chat folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!currentUser) return;
    try {
      await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/folders/${folderId}`, {
        method: 'DELETE',
      });
      const updatedFolders = (currentUser.customFolders || []).filter((f) => f.id !== folderId);
      const updatedUser = { ...currentUser, customFolders: updatedFolders };
      setCurrentUser(updatedUser);
      localStorage.setItem('tg_user', JSON.stringify(updatedUser));
      if (activeTab === folderId) {
        setActiveTab('all');
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  if (isInitializing) {
    return (
      <div className="w-full h-[100dvh] flex items-center justify-center bg-[#0e1621] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Загрузка PRITONN...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show AuthScreen (Registration & Login)
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const isDirectChat = activeChat?.type === 'direct';
  const otherUserId = isDirectChat
    ? activeChat.members?.find((id) => id !== currentUser.id) || activeChat.targetUserId
    : null;
  const isTargetBlocked = !!(otherUserId && currentUser.blockedUserIds?.includes(otherUserId));

  return (
    <div className="w-full h-[100dvh] flex flex-col overflow-hidden bg-[var(--tg-bg)] text-[var(--tg-text)] font-sans antialiased">
      {/* Desktop Window Title Bar */}
      <div className="hidden md:block">
        <DesktopTitleBar activeChat={activeChat} currentUser={currentUser} allUsers={allUsers} />
      </div>

      {/* In-App Software Update Notification pointing to Settings */}
      {updateInfo?.hasUpdate && !isUpdateDismissed && (
        <div className="bg-gradient-to-r from-[#2481cc] via-blue-600 to-indigo-600 text-white px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg z-40 border-b border-white/15">
          <div className="flex items-center gap-2 font-medium">
            <span>
              🔔 Вышло обновление <b>PRITONN v{updateInfo.latestVersion}</b>! Обновление доступно в <b>Настройках</b>.
            </span>
            {isInstallingUpdate && (
              <span className="text-blue-100 font-mono">
                ({updateStatusText || `${updateProgress}%`})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-1 rounded-lg bg-white text-blue-700 font-bold hover:bg-blue-50 transition cursor-pointer shadow-sm"
            >
              Открыть Настройки
            </button>
            <button
              type="button"
              disabled={isInstallingUpdate}
              onClick={handleTriggerInAppUpdate}
              className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold transition cursor-pointer disabled:opacity-60"
            >
              {isInstallingUpdate ? `Загрузка ${updateProgress}%...` : 'Обновить сразу'}
            </button>
            {!isInstallingUpdate && (
              <button
                type="button"
                onClick={() => setIsUpdateDismissed(true)}
                className="px-2 py-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                Позже
              </button>
            )}
          </div>
        </div>
      )}

      {/* Non-blocking Group Voice Chat Invitation Banner */}
      {voiceChatInviteBanner && (
        <div className="bg-emerald-600/95 text-white px-4 py-2.5 text-xs flex items-center justify-between gap-3 shadow-lg z-40 animate-fade-in">
          <div className="truncate font-medium">
            🎙 <b>{voiceChatInviteBanner.inviterName}</b> приглашает вас в голосовой чат «{voiceChatInviteBanner.chatName}»
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const target = chats.find((c) => c.id === voiceChatInviteBanner.chatId);
                if (target) selectChat(target);
                setVoiceChatInviteBanner(null);
              }}
              className="px-3 py-1 rounded-lg bg-white text-emerald-700 font-bold hover:bg-emerald-50 cursor-pointer"
            >
              Открыть чат
            </button>
            <button
              type="button"
              onClick={() => setVoiceChatInviteBanner(null)}
              className="px-2 py-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Global Music Player (Header Bar) */}
      <GlobalMusicPlayer
        currentTrack={activeAudioTrack}
        playlist={musicPlaylist}
        onClose={() => setActiveAudioTrack(null)}
        onTrackChange={(t) => setActiveAudioTrack(t)}
      />

      {/* Main Workspace: Left Folders Bar + Chat List Sidebar + Main Chat Area + Right Drawer */}
      <div className="flex-1 flex overflow-hidden relative w-full h-full min-w-0">
        <div className="hidden md:flex flex-shrink-0">
          <DesktopFoldersBar
            activeTab={activeTab}
            chats={chats}
            currentUser={currentUser}
            hasUpdateAvailable={!!updateInfo?.hasUpdate}
            onSelectTab={(tab) => setActiveTab(tab)}
            onOpenSavedMessages={handleOpenSavedMessages}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenNewChatModal={() => setIsNewChatOpen(true)}
            onOpenCustomFolders={() => setIsFoldersModalOpen(true)}
            onOpenMiniApp={() => setIsMiniAppOpen(true)}
            onOpenMenu={() => setIsMainMenuOpen((prev) => !prev)}
          />
        </div>

        <div className={`h-full ${activeChat ? 'hidden md:flex' : 'flex w-full'} md:w-[320px] lg:w-[350px] flex-shrink-0`}>
          <Sidebar
            chats={chats}
            activeChat={activeChat}
            currentUser={currentUser}
            allUsers={allUsers}
            stories={stories}
            isDark={isDark}
            activeTab={activeTab}
            isMenuOpen={isMainMenuOpen}
            onToggleMenu={() => setIsMainMenuOpen((prev) => !prev)}
            onCloseMenu={() => setIsMainMenuOpen(false)}
            onSelectTab={(tab) => setActiveTab(tab)}
            onSelectChat={(c) => selectChat(c)}
            onStartDirectChat={handleStartDirectChat}
            onOpenSavedMessages={handleOpenSavedMessages}
            onOpenNewChatModal={() => setIsNewChatOpen(true)}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
            onOpenCalls={() => setIsCallHistoryOpen(true)}
            onOpenCustomFolders={() => setIsFoldersModalOpen(true)}
            onOpenMiniApp={() => setIsMiniAppOpen(true)}
            onTogglePinChat={handleTogglePinChat}
            onToggleArchiveChat={handleToggleArchiveChat}
            onToggleTheme={() => setIsDark(!isDark)}
            onLogout={handleLogout}
            onSelectStory={(s) => setActiveStory(s)}
            onCreateStory={() => setIsCreateStoryOpen(true)}
            onRequestDeleteChat={(c) => setChatToDelete(c)}
            onLockApp={() => setIsAppLocked(true)}
            isAppLockEnabled={isAppLockEnabled}
            hasUpdateAvailable={!!updateInfo?.hasUpdate}
          />
        </div>

        {/* Main Chat Area */}
        <div className={`h-full flex-1 min-w-0 ${activeChat ? 'flex w-full' : 'hidden md:flex'}`}>
          <ChatArea
            chat={activeChat}
            chats={chats}
            messages={messages}
            currentUser={currentUser}
            allUsers={allUsers}
            socket={socketRef.current}
            isTyping={isTyping}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onVotePoll={handleVotePoll}
            onForwardMessage={handleForwardMessage}
            onReactMessage={handleReactMessage}
            onPinMessage={handlePinMessage}
            onDeleteMessage={(msg) => setMessageToDelete(msg)}
            onToggleInfoDrawer={() => setIsInfoDrawerOpen(!isInfoDrawerOpen)}
            onBack={() => setActiveChat(null)}
            onStartVoiceCall={() => {
              if (activeChat) {
                setCallChat(activeChat);
                setCallTargetUser(activeChat.targetUser || null);
              }
              setIsIncomingAccepted(false);
              setIsVoiceCallOpen(true);
            }}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            onOpenEditChatModal={(c) => setChatToEdit(c)}
            isBlocked={isTargetBlocked}
            onToggleBlockUser={handleToggleBlockUser}
            onRequestDeleteChat={(c) => setChatToDelete(c)}
            onBurnMessage={handleBurnMessage}
            onOpenMiniApp={() => setIsMiniAppOpen(true)}
            onOpenPremium={() => setIsSettingsOpen(true)}
            onSaveDraft={handleSaveDraft}
            onTriggerFullscreenEmoji={(em) => setActiveFullscreenEmoji(em)}
            onTranscribeVoice={handleTranscribeVoice}
            onPlayGlobalAudio={(track) => {
              setActiveAudioTrack(track);
              setMusicPlaylist((prev) => (prev.some((t) => t.id === track.id) ? prev : [...prev, track]));
            }}
          />
        </div>

        {/* Right Drawer: Chat & Channel Info */}
        <ChatInfoDrawer
          chat={activeChat}
          currentUser={currentUser}
          allUsers={allUsers}
          messages={messages}
          isOpen={isInfoDrawerOpen}
          onClose={() => setIsInfoDrawerOpen(false)}
          onSelectUserChat={(u) => handleStartDirectChat(u)}
          onOpenInviteModal={() => setIsInviteModalOpen(true)}
          onOpenEditChatModal={(c) => setChatToEdit(c)}
          isBlocked={isTargetBlocked}
          onToggleBlockUser={handleToggleBlockUser}
          onRequestDeleteChat={(c) => setChatToDelete(c)}
          onStartVoiceCall={() => {
            if (activeChat) {
              setCallChat(activeChat);
              setCallTargetUser(activeChat.targetUser || null);
            }
            setIsIncomingAccepted(false);
            setIsVoiceCallOpen(true);
          }}
        />
      </div>

      {/* Fullscreen Story Viewer */}
      <StoriesModal
        story={activeStory}
        stories={stories}
        currentUser={currentUser}
        onClose={() => setActiveStory(null)}
        onSelectStory={(s) => setActiveStory(s)}
      />

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateStoryOpen}
        onClose={() => setIsCreateStoryOpen(false)}
        onSubmit={handleCreateStory}
      />

      {/* New Channel / Group Modal with Friend Invites */}
      <NewChatModal
        isOpen={isNewChatOpen}
        currentUser={currentUser}
        allUsers={allUsers}
        onClose={() => setIsNewChatOpen(false)}
        onCreateChat={handleCreateChat}
      />

      {/* Invite Members Modal for existing chat */}
      <InviteMembersModal
        isOpen={isInviteModalOpen}
        chat={activeChat}
        allUsers={allUsers}
        currentUser={currentUser}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInviteMembers}
      />

      {/* Delete Message Modal (for me vs for everyone) */}
      <DeleteMessageModal
        isOpen={!!messageToDelete}
        message={messageToDelete}
        currentUser={currentUser}
        onClose={() => setMessageToDelete(null)}
        onConfirmDelete={handleConfirmDeleteMessage}
      />

      {/* Delete Chat Modal */}
      <DeleteChatModal
        isOpen={!!chatToDelete}
        chat={chatToDelete}
        currentUser={currentUser}
        onClose={() => setChatToDelete(null)}
        onConfirmDelete={handleDeleteChat}
      />

      {/* Edit Chat Modal (Name, Description, Custom Photo) */}
      <EditChatModal
        isOpen={!!chatToEdit}
        chat={chatToEdit}
        onClose={() => setChatToEdit(null)}
        onSave={handleSaveChat}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        currentUser={currentUser}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onUpdateProfile={handleUpdateProfile}
        onOpenCustomFolders={() => setIsFoldersModalOpen(true)}
        onOpenAppLockSetup={() => setIsSettingPin(true)}
        isAppLockEnabled={isAppLockEnabled}
        onToggleAppLock={(enabled) => {
          setIsAppLockEnabled(enabled);
          localStorage.setItem('pritonn_app_lock_enabled', String(enabled));
          if (enabled && !savedPin) {
            setIsSettingPin(true);
          }
        }}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* App Lock PIN Code Screen */}
      <AppLockModal
        isLocked={isAppLocked}
        savedPin={savedPin}
        onUnlock={() => setIsAppLocked(false)}
        isSettingPin={isSettingPin}
        onCloseSetup={() => setIsSettingPin(false)}
        onSetNewPin={(newPin) => {
          setSavedPin(newPin);
          localStorage.setItem('pritonn_app_pin', newPin);
          setIsAppLockEnabled(true);
          localStorage.setItem('pritonn_app_lock_enabled', 'true');
          setIsSettingPin(false);
          alert('Код-пароль успешно сохранён!');
        }}
      />

      {/* Simulated & Real-time Voice Call Modal */}
      {isVoiceCallOpen && (
        <VoiceCallModal
          chat={callChat || activeChat}
          targetUser={callTargetUser || (activeChat?.type === 'direct' ? activeChat.targetUser : null)}
          currentUser={currentUser}
          allUsers={allUsers}
          socket={socketRef.current}
          isIncomingAccepted={isIncomingAccepted}
          onClose={() => {
            setIsVoiceCallOpen(false);
            setIsIncomingAccepted(false);
            setCallChat(null);
            setCallTargetUser(null);
          }}
        />
      )}

      {/* Incoming Call Popup */}
      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          callerVerified={incomingCall.callerVerified}
          onAccept={() => {
            let targetChat = chats.find((c) => c.id === incomingCall.chatId);
            const callerObj = allUsers.find((u) => u.id === incomingCall.callerId);
            if (!targetChat && callerObj) {
              targetChat = {
                id: incomingCall.chatId || `chat_dm_${incomingCall.callerId}`,
                type: 'direct',
                name: incomingCall.callerName || callerObj.name,
                avatar: incomingCall.callerAvatar || callerObj.avatar,
                targetUserId: incomingCall.callerId,
                targetUser: callerObj,
                members: [currentUser.id, incomingCall.callerId],
              };
            }
            if (targetChat) {
              setActiveChat(targetChat);
              setCallChat(targetChat);
            }
            if (callerObj) {
              setCallTargetUser(callerObj);
            }
            setIsIncomingAccepted(true);
            setIsVoiceCallOpen(true);
            socketRef.current?.emit('call_accept', {
              callerId: incomingCall.callerId,
              targetUserId: currentUser.id,
            });
            setIncomingCall(null);
          }}
          onDecline={() => {
            socketRef.current?.emit('call_reject', {
              callerId: incomingCall.callerId,
              targetUserId: currentUser.id,
            });
            setIncomingCall(null);
          }}
        />
      )}

      {/* Telegram Mini App Modal (Stars & Arcade Clicker) */}
      <TelegramMiniAppModal
        isOpen={isMiniAppOpen}
        currentUser={currentUser}
        onClose={() => setIsMiniAppOpen(false)}
      />

      {/* Custom Chat Folders Modal */}
      <CustomFoldersModal
        isOpen={isFoldersModalOpen}
        currentUser={currentUser}
        chats={chats}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onClose={() => setIsFoldersModalOpen(false)}
      />

      {/* Fullscreen Animated Emoji Particles Effect */}
      {activeFullscreenEmoji && (
        <FullscreenEmojiEffect
          emoji={activeFullscreenEmoji}
          onComplete={() => setActiveFullscreenEmoji(null)}
        />
      )}

      {/* Telegram Desktop Main Drawer Menu */}
      <TelegramDrawerMenu
        isOpen={isMainMenuOpen}
        currentUser={currentUser}
        isDark={isDark}
        hasUpdateAvailable={!!updateInfo?.hasUpdate}
        onClose={() => setIsMainMenuOpen(false)}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
        onOpenNewGroup={() => setIsNewChatOpen(true)}
        onOpenNewChannel={() => setIsNewChatOpen(true)}
        onOpenCalls={() => setIsCallHistoryOpen(true)}
        onOpenSavedMessages={handleOpenSavedMessages}
        onOpenCustomFolders={() => setIsFoldersModalOpen(true)}
        onOpenMiniApp={() => setIsMiniAppOpen(true)}
        onToggleTheme={() => setIsDark(!isDark)}
        onLogout={handleLogout}
      />

      {/* Telegram Calls History Modal */}
      <CallHistoryModal
        isOpen={isCallHistoryOpen}
        currentUser={currentUser}
        onClose={() => setIsCallHistoryOpen(false)}
        onStartCall={handleStartCallWithUser}
      />
    </div>
  );
};

export default App;
