import React, { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import {
  Send,
  Paperclip,
  Smile,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  PhoneCall,
  Search,
  MoreVertical,
  Pin,
  X,
  Check,
  CheckCheck,
  Eye,
  Reply,
  Trash2,
  Mic,
  Square,
  Sparkles,
  Info,
  UserPlus,
  Copy,
  Edit3,
  Ban,
  Play,
  Maximize2,
  Video,
  FileText,
  Music,
  Download,
  Image as ImageIcon,
  Forward,
  BarChart2,
  Camera,
  BellOff,
  Clock,
  Radio,
  Flame,
  Timer,
  EyeOff,
  Bot,
  ArrowLeft,
} from 'lucide-react';
import { Chat, Message, User, ReplyInfo, InlineKeyboardButton } from '../types';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { EmojiPicker } from './EmojiPicker';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { TelegramPremiumBadge } from './TelegramPremiumBadge';
import { isUserVerified } from '../utils/verified';
import { API_BASE_URL } from '../config';
import { DiceAnimationWidget } from './DiceAnimationWidget';
import { TelegramSpoilerText } from './TelegramSpoilerText';
import { TelegramBurnTimer } from './TelegramBurnTimer';
import { PhotoViewerModal } from './PhotoViewerModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { TelegramAudioPlayer } from './TelegramAudioPlayer';
import { VideoNoteRecorder } from './VideoNoteRecorder';
import { TelegramRoundVideoPlayer } from './TelegramRoundVideoPlayer';
import { CreatePollModal } from './CreatePollModal';
import { TelegramPollWidget } from './TelegramPollWidget';
import { ForwardMessageModal } from './ForwardMessageModal';
import { GroupVoiceChatModal } from './GroupVoiceChatModal';

interface ChatAreaProps {
  chat: Chat | null;
  chats?: Chat[];
  messages: Message[];
  currentUser: User;
  allUsers: User[];
  socket?: Socket | null;
  isTyping: boolean;
  onSendMessage: (data: {
    text: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video' | 'file' | 'audio' | null;
    fileName?: string | null;
    fileSize?: string | null;
    isVoice?: boolean;
    isRoundVideo?: boolean;
    voiceDuration?: number;
    audioDuration?: number;
    videoDuration?: number;
    poll?: any;
    replyToId?: string;
    isSilent?: boolean;
    isSpoiler?: boolean;
    burnTimer?: number;
  }) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
  onForwardMessage?: (message: Message, targetChatId: string) => void;
  onReactMessage: (messageId: string, emoji: string) => void;
  onPinMessage: (messageId: string) => void;
  onDeleteMessage: (msg: Message) => void;
  onToggleInfoDrawer: () => void;
  onStartVoiceCall: () => void;
  onOpenInviteModal?: () => void;
  onOpenEditChatModal?: (chat: Chat) => void;
  isBlocked?: boolean;
  onToggleBlockUser?: () => void;
  onRequestDeleteChat?: (chat: Chat) => void;
  onBurnMessage?: (messageId: string) => void;
  onOpenMiniApp?: () => void;
  onOpenPremium?: () => void;
  onSaveDraft?: (chatId: string, text: string) => void;
  onTriggerFullscreenEmoji?: (emoji: string) => void;
  onTranscribeVoice?: (messageId: string) => void;
  onBack?: () => void;
}

const AUTHOR_COLORS = [
  '#e17076', // red
  '#faa774', // orange
  '#a695e7', // purple
  '#7bc862', // green
  '#6ec9cb', // cyan
  '#65aadd', // blue
  '#ee7aae', // pink
];

function getAuthorColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AUTHOR_COLORS.length;
  return AUTHOR_COLORS[index];
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  chat,
  chats = [],
  messages,
  currentUser,
  allUsers,
  socket,
  isTyping,
  onSendMessage,
  onEditMessage,
  onVotePoll,
  onForwardMessage,
  onReactMessage,
  onPinMessage,
  onDeleteMessage,
  onToggleInfoDrawer,
  onStartVoiceCall,
  onOpenInviteModal,
  onOpenEditChatModal,
  isBlocked,
  onToggleBlockUser,
  onRequestDeleteChat,
  onBurnMessage,
  onOpenMiniApp,
  onOpenPremium,
  onSaveDraft,
  onTriggerFullscreenEmoji,
  onTranscribeVoice,
  onBack,
}) => {
  const [inputText, setInputText] = useState('');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Spoiler send & Burn-on-read timer state
  const [isSpoilerSend, setIsSpoilerSend] = useState(false);
  const [selectedBurnTimer, setSelectedBurnTimer] = useState<number | undefined>(undefined);
  const [isBurnMenuOpen, setIsBurnMenuOpen] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<{ [msgId: string]: boolean }>({});

  // Sync draft text on chat change
  useEffect(() => {
    if (chat?.draft) {
      setInputText(chat.draft);
    } else {
      setInputText('');
    }
    setReplyingTo(null);
    setEditingMessage(null);
  }, [chat?.id]);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (chat && onSaveDraft) {
      onSaveDraft(chat.id, val);
    }
  };

  // New Modals: Polls, Video Notes, Forward, Group Voice Chat
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isVideoNoteRecorderOpen, setIsVideoNoteRecorderOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isGroupVoiceChatOpen, setIsGroupVoiceChatOpen] = useState(false);
  const [mediaInputMode, setMediaInputMode] = useState<'voice' | 'round_video'>('voice');
  const [isSilentSend, setIsSilentSend] = useState(false);

  // In-chat search & clipboard
  const [isSearchingChat, setIsSearchingChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Telegram Desktop Context Menu & Header Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  const handleCopyText = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Attachment popup menu & Media Modals
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; title?: string; timestamp?: number } | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ url: string; title?: string; timestamp?: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const photoVideoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileDocInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Voice recording timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecordingVoice) {
      setRecordingSeconds(0);
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecordingVoice]);

  const formatCallDuration = (sec?: number): string => {
    if (!sec || sec <= 0) return 'Без ответа';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);

    const parts: string[] = [];
    if (hrs > 0) parts.push(`${hrs} ч`);
    if (mins > 0) parts.push(`${mins} мин`);
    if (s > 0 || parts.length === 0) parts.push(`${s} сек`);
    return parts.join(' ');
  };

  if (!chat) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center tg-chat-pattern text-[var(--tg-text-muted)] select-none">
        <div className="bg-[var(--tg-surface)] p-6 rounded-2xl border border-[var(--tg-border)] text-center max-w-sm shadow-xl">
          <img
            src="/logo.jpg"
            alt="PRITONN"
            className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-purple-500/40 shadow-lg"
          />
          <h3 className="font-semibold text-base text-[var(--tg-text)] mb-1">
            Выберите чат для общения
          </h3>
          <p className="text-xs text-[var(--tg-text-muted)] leading-relaxed">
            Отправляйте сообщения, делитесь историями, записывайте войсы и создавайте каналы в PRITONN.
          </p>
        </div>
      </div>
    );
  }

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

  // Handle message submit
  const handleSend = (e?: React.FormEvent, forceSilent?: boolean) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    if (editingMessage && onEditMessage) {
      onEditMessage(editingMessage.id, inputText.trim());
      setEditingMessage(null);
      setInputText('');
      return;
    }

    onSendMessage({
      text: inputText,
      replyToId: replyingTo?.id,
      isSilent: forceSilent || isSilentSend,
      isSpoiler: isSpoilerSend,
      burnTimer: selectedBurnTimer,
    });

    setInputText('');
    if (chat && onSaveDraft) {
      onSaveDraft(chat.id, '');
    }
    setIsSpoilerSend(false);
    setSelectedBurnTimer(undefined);
    setReplyingTo(null);
    setIsEmojiPickerOpen(false);
    setIsSilentSend(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simulated voice recording finish
  const handleFinishVoiceRecording = () => {
    setIsRecordingVoice(false);
    onSendMessage({
      text: '',
      isVoice: true,
      voiceDuration: Math.max(recordingSeconds, 3),
      replyToId: replyingTo?.id,
    });
    setReplyingTo(null);
  };

  const handleCancelVoiceRecording = () => {
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  // Telegram Video Note (Кружочек) sending
  const handleSendVideoNote = async (blob: Blob, duration: number) => {
    try {
      const formData = new FormData();
      formData.append('file', blob, `video_note_${Date.now()}.webm`);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        onSendMessage({
          text: '',
          mediaUrl: data.url,
          isRoundVideo: true,
          videoDuration: duration,
          replyToId: replyingTo?.id,
        });
        return;
      }
    } catch {}

    const reader = new FileReader();
    reader.onload = () => {
      onSendMessage({
        text: '',
        mediaUrl: reader.result as string,
        isRoundVideo: true,
        videoDuration: duration,
        replyToId: replyingTo?.id,
      });
    };
    reader.readAsDataURL(blob);
  };

  // Telegram Poll creation
  const handleCreatePoll = (pollData: any) => {
    onSendMessage({
      text: '',
      poll: {
        id: `poll_${Date.now()}`,
        question: pollData.question,
        options: pollData.options.map((optText: string, i: number) => ({
          id: `opt_${i}`,
          text: optText,
          votes: [],
        })),
        isAnonymous: pollData.isAnonymous,
        multipleAnswers: pollData.multipleAnswers,
        isQuiz: pollData.isQuiz,
        correctOptionIndex: pollData.correctOptionIndex,
      },
      replyToId: replyingTo?.id,
    });
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  // Media / File upload (Photos, Videos, Music, Documents)
  const handleMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    typeHint?: 'image' | 'video' | 'audio' | 'file'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let mediaType: 'image' | 'video' | 'audio' | 'file' = 'file';
    if (typeHint) {
      mediaType = typeHint;
    } else if (file.type.startsWith('image/')) {
      mediaType = 'image';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'video';
    } else if (file.type.startsWith('audio/')) {
      mediaType = 'audio';
    }

    const sizeStr = formatFileSize(file.size);

    // Try server upload first
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onSendMessage({
          text: inputText,
          mediaUrl: data.url,
          mediaType,
          fileName: file.name,
          fileSize: sizeStr,
          replyToId: replyingTo?.id,
          isSpoiler: isSpoilerSend,
          burnTimer: selectedBurnTimer,
        });
        setInputText('');
        if (chat && onSaveDraft) {
          onSaveDraft(chat.id, '');
        }
        setIsSpoilerSend(false);
        setSelectedBurnTimer(undefined);
        setReplyingTo(null);
        e.target.value = '';
        return;
      }
    } catch (err) {
      console.warn('Server upload failed, falling back to local FileReader:', err);
    }

    // Fallback DataURL
    const reader = new FileReader();
    reader.onload = () => {
      onSendMessage({
        text: inputText,
        mediaUrl: reader.result as string,
        mediaType,
        fileName: file.name,
        fileSize: sizeStr,
        replyToId: replyingTo?.id,
        isSpoiler: isSpoilerSend,
        burnTimer: selectedBurnTimer,
      });
      setInputText('');
      if (chat && onSaveDraft) {
        onSaveDraft(chat.id, '');
      }
      setIsSpoilerSend(false);
      setSelectedBurnTimer(undefined);
      setReplyingTo(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Pinned message
  const pinnedMessage = chat.pinnedMessageId
    ? messages.find((m) => m.id === chat.pinnedMessageId)
    : null;

  return (
    <div key={chat.id} className="flex-1 min-w-0 h-full flex flex-col tg-chat-pattern relative overflow-hidden select-none animate-chat-enter">
      {/* Header */}
      <header className="h-14 bg-[var(--tg-sidebar)] border-b border-[var(--tg-border)] px-4 flex items-center justify-between z-20 flex-shrink-0 shadow-sm">
        {onBack && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="md:hidden mr-2 p-1.5 -ml-1 text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] rounded-full hover:bg-[var(--tg-surface-hover)] transition flex-shrink-0 cursor-pointer"
            title="Назад к списку чатов"
            aria-label="Назад к списку чатов"
          >
            <ArrowLeft size={22} />
          </button>
        )}
        <div
          onClick={onToggleInfoDrawer}
          className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
        >
          <img
            src={displayAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover border border-transparent group-hover:border-blue-400 transition"
          />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm leading-tight flex items-center gap-1.5 truncate text-[var(--tg-text)]">
              <span className="truncate">{displayName}</span>
              {isUserVerified(targetUser) && (
                <TelegramVerifiedBadge size={16} />
              )}
              {targetUser?.isPremium && (
                <TelegramPremiumBadge emojiStatus={targetUser.emojiStatus} />
              )}
            </h2>
            <div className="text-[11px] text-[var(--tg-text-muted)] flex items-center gap-1.5 truncate">
              {isTyping ? (
                <span className="text-blue-400 font-medium animate-pulse flex items-center gap-1">
                  печатает...
                </span>
              ) : chat.type === 'channel' ? (
                `${(chat.subscribersCount || 1).toLocaleString()} подписчиков`
              ) : chat.type === 'group' ? (
                `${(chat.membersCount || 1).toLocaleString()} участников`
              ) : isDirect && targetUser?.online ? (
                <span className="text-[#5288c1] font-medium">в сети</span>
              ) : isDirect && targetUser ? (
                <span>{targetUser.lastSeen || 'был(а) недавно'}</span>
              ) : (
                <span>{chat.targetUser?.lastSeen || 'был(а) недавно'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-[var(--tg-text-muted)]">
          {/* In-chat search toggle */}
          <button
            onClick={() => {
              setIsSearchingChat(!isSearchingChat);
              if (isSearchingChat) setChatSearchQuery('');
            }}
            className={`p-2 rounded-xl transition ${
              isSearchingChat
                ? 'text-blue-400 bg-blue-500/10'
                : 'hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)]'
            }`}
            title="Поиск сообщений в чате"
          >
            <Search size={18} />
          </button>

          {/* Quick Edit Chat button (Name & Photo) */}
          {(chat.type === 'group' || chat.type === 'channel') && onOpenEditChatModal && (
            <button
              onClick={() => onOpenEditChatModal(chat)}
              className="p-2 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition"
              title="Редактировать чат (название и аватарку)"
            >
              <Edit3 size={18} />
            </button>
          )}

          {(chat.type === 'group' || chat.type === 'channel') && onOpenInviteModal && (
            <button
              onClick={onOpenInviteModal}
              className="p-2 rounded-xl text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition flex items-center gap-1 text-xs font-medium"
              title="Пригласить участников в чат"
            >
              <UserPlus size={18} />
              <span className="hidden sm:inline">Пригласить</span>
            </button>
          )}

          {/* Group Voice Chat / Space */}
          {(chat.type === 'group' || chat.type === 'channel') && (
            <button
              type="button"
              onClick={() => setIsGroupVoiceChatOpen(true)}
              className="p-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition flex items-center gap-1.5 text-xs font-semibold"
              title="Начать голосовой чат"
            >
              <Radio size={16} />
              <span className="hidden sm:inline">Голосовой чат</span>
            </button>
          )}

          {chat.type === 'direct' && (
            <button
              onClick={onStartVoiceCall}
              className="p-2 rounded-xl hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] transition"
              title="Аудиозвонок"
            >
              <Phone size={18} />
            </button>
          )}

          <button
            onClick={onToggleInfoDrawer}
            className="p-2 rounded-xl hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] transition"
            title="Информация о чате"
          >
            <Info size={18} />
          </button>

          {/* 3-dots menu for Telegram Desktop */}
          <div className="relative">
            <button
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className="p-2 rounded-xl hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] transition"
              title="Меню действий"
            >
              <MoreVertical size={18} />
            </button>

            {isHeaderMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsHeaderMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-52 bg-[#212d3b] text-[#f5f5f5] rounded-xl shadow-2xl border border-[#17212b] p-1 z-50 animate-pop-in text-xs flex flex-col gap-0.5 select-none">
                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      onToggleInfoDrawer();
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left"
                  >
                    <Info size={14} className="text-[#5288c1]" />
                    <span>Информация о чате</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsHeaderMenuOpen(false);
                      setIsSearchingChat(true);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left"
                  >
                    <Search size={14} className="text-[#5288c1]" />
                    <span>Поиск сообщений</span>
                  </button>

                  {(chat.type === 'group' || chat.type === 'channel') && onOpenEditChatModal && (
                    <button
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onOpenEditChatModal(chat);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left"
                    >
                      <Edit3 size={14} className="text-[#5288c1]" />
                      <span>Редактировать чат</span>
                    </button>
                  )}

                  {chat.type === 'direct' && onToggleBlockUser && (
                    <button
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onToggleBlockUser();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#2b5278] transition text-left text-amber-400"
                    >
                      <Ban size={14} />
                      <span>{isBlocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}</span>
                    </button>
                  )}

                  <div className="h-px bg-[#17212b] my-0.5" />

                  {onRequestDeleteChat && (
                    <button
                      onClick={() => {
                        setIsHeaderMenuOpen(false);
                        onRequestDeleteChat(chat);
                      }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-600/20 text-rose-400 transition text-left"
                    >
                      <Trash2 size={14} />
                      <span>Удалить чат</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* In-chat Search Bar */}
      {isSearchingChat && (
        <div className="bg-[var(--tg-surface)] border-b border-[var(--tg-border)] px-4 py-2 flex items-center gap-2 animate-fade-in z-20">
          <Search size={16} className="text-blue-400 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder="Поиск по сообщениям в чате..."
            className="flex-1 bg-transparent text-xs text-[var(--tg-text)] placeholder-[var(--tg-text-muted)] outline-none"
          />
          {chatSearchQuery && (
            <span className="text-[11px] text-[var(--tg-text-muted)] px-1.5 py-0.5 rounded bg-[var(--tg-sidebar)]">
              Найдено: {messages.filter((m) => m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())).length}
            </span>
          )}
          <button
            onClick={() => {
              setIsSearchingChat(false);
              setChatSearchQuery('');
            }}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
            title="Закрыть поиск"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Pinned Message Bar */}
      {pinnedMessage && (
        <div
          onClick={() => {
            const el = document.getElementById(`msg-${pinnedMessage.id}`);
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-[var(--tg-surface)] border-b border-[var(--tg-border)] px-4 py-1.5 flex items-center justify-between cursor-pointer hover:bg-[var(--tg-surface-hover)] transition z-10"
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-1 h-7 bg-blue-500 rounded-full flex-shrink-0" />
            <Pin size={14} className="text-blue-400 flex-shrink-0" />
            <div className="min-w-0 text-xs">
              <div className="font-semibold text-blue-400 leading-tight">
                Закрепленное сообщение
              </div>
              <div className="truncate text-[var(--tg-text-muted)] text-[11px]">
                {pinnedMessage.text || 'Медиафайл'}
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPinMessage(pinnedMessage.id);
            }}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
            title="Открепить"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {/* Date pill */}
        <div className="flex justify-center my-1 select-none">
          <span className="text-[11px] bg-[var(--tg-date-pill-bg)] backdrop-blur-md text-[var(--tg-date-pill-text)] px-3 py-0.5 rounded-full font-medium shadow-sm">
            Сегодня
          </span>
        </div>

        {/* Message feed with optional search filter */}
        {(() => {
          const visibleMessages = chatSearchQuery.trim()
            ? messages.filter((m) =>
                m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())
              )
            : messages;

          if (chatSearchQuery.trim() && visibleMessages.length === 0) {
            return (
              <div className="text-center py-12 text-xs text-[var(--tg-text-muted)]">
                По запросу «{chatSearchQuery}» ничего не найдено
              </div>
            );
          }

          return visibleMessages.map((msg) => {
            const isOutgoing = msg.senderId === currentUser.id;
            const sender = allUsers.find((u) => u.id === msg.senderId);
            const senderName = isOutgoing ? currentUser.name : (sender ? sender.name : 'Пользователь');
            const authorColor = getAuthorColor(senderName);
            const isPinned = chat.pinnedMessageId === msg.id;
            const isSenderVerified = isOutgoing ? isUserVerified(currentUser) : isUserVerified(sender);

            {/* Special Call History Message in Chat */}
            if (msg.type === 'call') {
              const isCaller = msg.senderId === currentUser.id || msg.callData?.callerId === currentUser.id;
              const duration = msg.callData?.duration || 0;
              const isSuccess = duration > 0;
              const isVideo = !!msg.callData?.isVideo;
              const status = msg.callData?.status;

              let title = '';
              let icon = null;
              let iconBg = '';

              if (isSuccess) {
                if (isCaller) {
                  title = isVideo ? 'Исходящий видеозвонок' : 'Исходящий звонок';
                  icon = <PhoneOutgoing size={17} />;
                  iconBg = 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/25 dark:text-emerald-400';
                } else {
                  title = isVideo ? 'Входящий видеозвонок' : 'Входящий звонок';
                  icon = <PhoneIncoming size={17} />;
                  iconBg = 'bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/25 dark:text-emerald-400';
                }
              } else {
                if (isCaller) {
                  title = status === 'rejected' ? 'Звонок отклонён' : 'Отменённый звонок';
                  icon = <PhoneOff size={17} />;
                  iconBg = 'bg-rose-500/15 text-rose-500 dark:bg-rose-500/25 dark:text-rose-400';
                } else {
                  title = 'Пропущенный звонок';
                  icon = <PhoneMissed size={17} />;
                  iconBg = 'bg-rose-500/15 text-rose-500 dark:bg-rose-500/25 dark:text-rose-400';
                }
              }

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
                  }}
                  className={`flex flex-col group relative animate-msg-enter ${
                    isOutgoing ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`min-w-[240px] max-w-[85%] md:max-w-[70%] lg:max-w-[50%] rounded-2xl p-3 shadow-sm relative transition-all flex items-center gap-3 ${
                      isOutgoing
                        ? 'bg-[var(--tg-bubble-out)] text-[var(--tg-bubble-out-text)] rounded-br-none shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                        : 'bg-[var(--tg-bubble-in)] text-[var(--tg-bubble-in-text)] rounded-bl-none shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${iconBg}`}>
                      {icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs truncate leading-snug">{title}</span>
                        <span className={`text-[10px] flex-shrink-0 ${
                          isOutgoing ? 'text-[var(--tg-bubble-out-meta)]' : 'text-[var(--tg-bubble-in-meta)]'
                        }`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className={`text-[11px] truncate font-medium ${
                          isSuccess
                            ? isOutgoing ? 'text-[var(--tg-bubble-out-meta)]' : 'text-[var(--tg-bubble-in-meta)]'
                            : 'text-rose-500 dark:text-rose-400'
                        }`}>
                          {isSuccess ? formatCallDuration(duration) : 'Без ответа'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartVoiceCall();
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-lg transition flex items-center gap-1 cursor-pointer flex-shrink-0 ${
                            isOutgoing
                              ? 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-[var(--tg-bubble-out-text)] border border-black/10 dark:border-white/10'
                              : 'bg-[#5288c1]/10 hover:bg-[#5288c1]/20 text-[#3390ec] border border-[#5288c1]/20'
                          }`}
                          title="Позвонить абоненту"
                        >
                          <PhoneCall size={12} />
                          <span>Позвонить</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Floating Action toolbar for delete */}
                  {hoveredMessageId === msg.id && (
                    <div
                      className={`absolute -top-7 z-20 flex items-center gap-1 bg-[var(--tg-surface)] border border-[var(--tg-border)] px-1.5 py-0.5 rounded-full shadow-lg animate-pop-in ${
                        isOutgoing ? 'right-0' : 'left-0'
                      }`}
                    >
                      <button
                        onClick={() => onDeleteMessage(msg)}
                        className="p-1 text-[var(--tg-text-muted)] hover:text-rose-400 transition"
                        title="Удалить из истории"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
                }}
                className={`flex flex-col group relative animate-msg-enter ${
                  isOutgoing ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl p-2.5 shadow-sm relative transition-all ${
                    isOutgoing
                      ? 'bg-[var(--tg-bubble-out)] text-[var(--tg-bubble-out-text)] rounded-br-none shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                      : 'bg-[var(--tg-bubble-in)] text-[var(--tg-bubble-in-text)] rounded-bl-none shadow-[0_1px_2px_rgba(0,0,0,0.1)]'
                  }`}
                >
                  {/* Group sender name */}
                  {chat.type === 'group' && !isOutgoing && (
                    <div
                      className="text-xs font-semibold mb-1 cursor-pointer hover:underline flex items-center gap-1"
                      style={{ color: authorColor }}
                    >
                      <span>{senderName}</span>
                      {isSenderVerified && (
                        <TelegramVerifiedBadge size={13} />
                      )}
                    </div>
                  )}

                {/* Forwarded message banner */}
                {msg.forwardFrom && (
                  <div className="mb-1.5 pl-2 border-l-2 border-[#5288c1] text-[11px] text-[#5288c1] font-semibold flex items-center gap-1">
                    <Forward size={12} />
                    <span>Переслано от {msg.forwardFrom.name}</span>
                  </div>
                )}

                {/* Reply quote banner inside message bubble */}
                {msg.replyTo && (
                  <div className={`mb-1.5 pl-2 py-0.5 border-l-2 border-blue-500 rounded-r-md text-xs ${
                    isOutgoing ? 'bg-black/5 dark:bg-black/10' : 'bg-black/5 dark:bg-black/10'
                  }`}>
                    <div className="font-semibold text-blue-500 text-[11px]">
                      {msg.replyTo.senderName}
                    </div>
                    <div className={`text-[11px] truncate opacity-85 ${
                      isOutgoing ? 'text-[var(--tg-bubble-out-text)]' : 'text-[var(--tg-bubble-in-text)]'
                    }`}>
                      {msg.replyTo.text}
                    </div>
                  </div>
                )}

                {/* Round Video Message (Кружочек Telegram) */}
                {msg.isRoundVideo && msg.mediaUrl && (
                  <div className="mb-1.5 flex justify-center">
                    <TelegramRoundVideoPlayer
                      src={msg.mediaUrl}
                      duration={msg.videoDuration}
                      isOutgoing={isOutgoing}
                    />
                  </div>
                )}

                {/* Poll Widget */}
                {msg.poll && (
                  <div className="mb-1.5">
                    <TelegramPollWidget
                      poll={msg.poll}
                      currentUserId={currentUser.id}
                      onVote={(pId, optId) => onVotePoll && onVotePoll(pId, optId)}
                      isOutgoing={isOutgoing}
                    />
                  </div>
                )}

                {/* Image Media */}
                {msg.mediaUrl && (msg.mediaType === 'image' || (!msg.mediaType && !msg.isVoice)) && (
                  <div
                    onClick={() => {
                      if (msg.isSpoiler && !revealedSpoilers[msg.id]) {
                        setRevealedSpoilers((p) => ({ ...p, [msg.id]: true }));
                        return;
                      }
                      setSelectedPhoto({
                        url: msg.mediaUrl!,
                        title: msg.fileName || 'Фотография',
                        timestamp: msg.timestamp,
                      });
                    }}
                    className="relative rounded-xl overflow-hidden mb-1.5 max-h-80 bg-black/10 cursor-pointer group"
                    title={msg.isSpoiler && !revealedSpoilers[msg.id] ? 'Нажмите, чтобы открыть спойлер' : 'Нажмите, чтобы открыть фото'}
                  >
                    <img
                      src={msg.mediaUrl}
                      alt="attachment"
                      className={`w-full h-full object-cover group-hover:opacity-90 transition ${
                        msg.isSpoiler && !revealedSpoilers[msg.id] ? 'blur-xl scale-105' : ''
                      }`}
                    />
                    {msg.isSpoiler && !revealedSpoilers[msg.id] && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white p-3 text-center z-10">
                        <EyeOff size={28} className="mb-1 text-white/90" />
                        <span className="text-xs font-semibold">Спойлер</span>
                        <span className="text-[10px] text-white/70">Нажмите, чтобы открыть</span>
                      </div>
                    )}
                    {(!msg.isSpoiler || revealedSpoilers[msg.id]) && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="p-2 bg-black/60 rounded-full text-white backdrop-blur-sm shadow-md">
                          <Maximize2 size={18} />
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Video Media */}
                {msg.mediaUrl && msg.mediaType === 'video' && (
                  <div
                    onClick={() => {
                      if (msg.isSpoiler && !revealedSpoilers[msg.id]) {
                        setRevealedSpoilers((p) => ({ ...p, [msg.id]: true }));
                        return;
                      }
                      setSelectedVideo({
                        url: msg.mediaUrl!,
                        title: msg.fileName || 'Видеозапись',
                        timestamp: msg.timestamp,
                      });
                    }}
                    className="relative rounded-xl overflow-hidden mb-1.5 max-h-80 bg-black/50 cursor-pointer group flex items-center justify-center border border-white/10"
                    title={msg.isSpoiler && !revealedSpoilers[msg.id] ? 'Нажмите, чтобы открыть спойлер' : 'Нажмите, чтобы воспроизвести видео'}
                  >
                    <video
                      src={msg.mediaUrl}
                      className={`w-full max-h-80 object-cover ${
                        msg.isSpoiler && !revealedSpoilers[msg.id] ? 'blur-xl scale-105' : ''
                      }`}
                      preload="metadata"
                    />
                    {msg.isSpoiler && !revealedSpoilers[msg.id] ? (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white p-3 text-center z-10">
                        <EyeOff size={28} className="mb-1 text-white/90" />
                        <span className="text-xs font-semibold">Спойлер</span>
                        <span className="text-[10px] text-white/70">Нажмите, чтобы открыть</span>
                      </div>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-[#5288c1] hover:bg-[#6499d3] text-white flex items-center justify-center shadow-xl transform group-hover:scale-105 transition">
                            <Play size={24} className="fill-current ml-1" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] text-white font-medium flex items-center gap-1">
                          <Video size={11} />
                          <span>{msg.fileSize || 'Видео'}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Music / Audio Track */}
                {msg.mediaUrl && msg.mediaType === 'audio' && (
                  <div className="mb-1.5">
                    <TelegramAudioPlayer
                      src={msg.mediaUrl}
                      title={msg.fileName}
                      fileSize={msg.fileSize}
                      duration={msg.audioDuration}
                      isOutgoing={isOutgoing}
                      transcribedText={msg.transcribedText}
                      onTranscribe={() => onTranscribeVoice && onTranscribeVoice(msg.id)}
                    />
                  </div>
                )}

                {/* File / Document */}
                {msg.mediaUrl && msg.mediaType === 'file' && (
                  <div
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = msg.mediaUrl!;
                      a.download = msg.fileName || 'file';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl mb-1.5 cursor-pointer border select-none transition ${
                      isOutgoing
                        ? 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-400/30'
                        : 'bg-[#182533]/80 hover:bg-[#182533] border-white/5'
                    }`}
                    title="Нажмите, чтобы скачать файл"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#5288c1] text-white flex items-center justify-center flex-shrink-0 shadow-md">
                      <FileText size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate text-[var(--tg-text)]">
                        {msg.fileName || 'Документ'}
                      </div>
                      <div className="text-[10px] text-[var(--tg-text-muted)] flex items-center gap-2 mt-0.5">
                        <span>{msg.fileSize || 'Файл'}</span>
                        <span>•</span>
                        <span className="text-[#5288c1] flex items-center gap-0.5 hover:underline">
                          <Download size={11} /> Скачать
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Voice Message, Dice, or Text */}
                {msg.isVoice ? (
                  <VoiceMessagePlayer
                    duration={msg.voiceDuration || 12}
                    isOutgoing={isOutgoing}
                    transcribedText={msg.transcribedText}
                    onTranscribe={() => onTranscribeVoice && onTranscribeVoice(msg.id)}
                  />
                ) : msg.isDice ? (
                  <div className="py-1">
                    <DiceAnimationWidget
                      diceType={msg.diceType || 'dice'}
                      value={msg.diceValue || 6}
                    />
                  </div>
                ) : (
                  /* Text or Big Clickable Emoji */
                  msg.text && (
                    ['❤️', '🔥', '🎉', '💩', '🚀', '👍', '👏', '😍', '🤩', '⚡', '💎', '👑', '🎰', '🎯'].includes(msg.text.trim()) ? (
                      <div
                        onClick={() => onTriggerFullscreenEmoji && onTriggerFullscreenEmoji(msg.text!.trim())}
                        className="text-6xl cursor-pointer hover:scale-125 transition-transform duration-200 select-none py-1.5 animate-pulse"
                        title="Нажмите для эффекта на весь экран!"
                      >
                        {msg.text.trim()}
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
                        <TelegramSpoilerText text={msg.text} />
                      </div>
                    )
                  )
                )}

                {/* Meta info: burn timer, views, timestamp, checks */}
                <div className={`flex items-center justify-end gap-1.5 text-[10px] mt-1 select-none ${
                  isOutgoing ? 'text-[var(--tg-bubble-out-meta)]' : 'text-[var(--tg-bubble-in-meta)]'
                }`}>
                  {msg.burnTimer && (
                    <TelegramBurnTimer
                      burnSeconds={msg.burnTimer}
                      messageId={msg.id}
                      onBurn={(id) => onBurnMessage && onBurnMessage(id)}
                    />
                  )}
                  {msg.isSilent && (
                    <span title="Отправлено без звука">
                      <BellOff size={11} className="mr-0.5" />
                    </span>
                  )}
                  {msg.isEdited && (
                    <span className="text-[9px] opacity-75 italic mr-0.5">
                      изменено
                    </span>
                  )}
                  {msg.views && (
                    <span className="flex items-center gap-0.5 mr-1">
                      <Eye size={11} />
                      {msg.views}
                    </span>
                  )}
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isOutgoing && (
                    <span>
                      {msg.status === 'read' ? (
                        <CheckCheck size={13} className="text-[#3390ec] dark:text-blue-300 animate-check-pop" />
                      ) : (
                        <Check size={13} className="animate-check-pop" />
                      )}
                    </span>
                  )}
                </div>

                {/* Reactions badge on message */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 select-none">
                    {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                      const hasReacted = userIds.includes(currentUser.id);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReactMessage(msg.id, emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition border ${
                            hasReacted
                              ? 'bg-blue-500/20 border-blue-400 text-blue-500'
                              : 'bg-black/5 dark:bg-black/20 border-black/10 dark:border-transparent hover:bg-black/10 dark:hover:bg-black/30 text-[var(--tg-text)]'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[11px]">{userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Bot Interactive Inline Keyboard */}
                {msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-2 w-full">
                    {msg.inlineKeyboard.map((row, rIdx) => (
                      <div key={rIdx} className="flex gap-1.5 w-full">
                        {row.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            type="button"
                            onClick={() => {
                              if (btn.action === 'send_dice') {
                                onSendMessage({ text: btn.diceType || '🎲' });
                              } else if (btn.action === 'open_mini_app') {
                                onOpenMiniApp && onOpenMiniApp();
                              } else if (btn.action === 'open_premium') {
                                onOpenPremium && onOpenPremium();
                              } else if (btn.action === 'bot_cmd') {
                                onSendMessage({ text: btn.cmd || '/help' });
                              } else if (btn.url) {
                                window.open(btn.url, '_blank');
                              }
                            }}
                            className="flex-1 py-1.5 px-3 bg-[#5288c1]/20 hover:bg-[#5288c1]/35 active:scale-95 text-[#6ab2f2] hover:text-white rounded-xl text-xs font-semibold border border-[#5288c1]/30 transition truncate shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {btn.action === 'open_mini_app' && <span className="text-sm">🎮</span>}
                            {btn.action === 'send_dice' && <span className="text-sm">{btn.diceType || '🎲'}</span>}
                            {btn.action === 'open_premium' && <span className="text-sm">⭐</span>}
                            <span>{btn.text}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Quick Action Toolbar on hover */}
              {hoveredMessageId === msg.id && (
                <div
                  className={`absolute -top-7 z-20 flex items-center gap-1 bg-[var(--tg-surface)] border border-[var(--tg-border)] px-1.5 py-0.5 rounded-full shadow-lg animate-pop-in ${
                    isOutgoing ? 'right-0' : 'left-0'
                  }`}
                >
                  {/* Quick reactions */}
                  {['👍', '❤️', '🔥', '😂'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => onReactMessage(msg.id, emoji)}
                      className="hover:scale-125 transition-transform p-1 text-sm"
                    >
                      {emoji}
                    </button>
                  ))}

                  <div className="w-px h-3 bg-[var(--tg-border)] mx-0.5" />

                  {/* Reply button */}
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="p-1 hover:text-blue-400 text-[var(--tg-text-muted)] transition"
                    title="Ответить"
                  >
                    <Reply size={13} />
                  </button>

                  {/* Pin button */}
                  <button
                    onClick={() => onPinMessage(msg.id)}
                    className={`p-1 transition ${
                      isPinned ? 'text-blue-400' : 'text-[var(--tg-text-muted)] hover:text-blue-400'
                    }`}
                    title={isPinned ? 'Открепить' : 'Закрепить'}
                  >
                    <Pin size={13} />
                  </button>

                  {/* Copy text button */}
                  {msg.text && (
                    <button
                      onClick={() => handleCopyText(msg.text, msg.id)}
                      className="p-1 hover:text-blue-400 text-[var(--tg-text-muted)] transition relative"
                      title="Копировать текст"
                    >
                      <Copy size={13} />
                      {copiedMsgId === msg.id && (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                          Скопировано!
                        </span>
                      )}
                    </button>
                  )}

                  {/* Delete button (for me OR for everyone) */}
                  <button
                    onClick={() => onDeleteMessage(msg)}
                    className="p-1 text-[var(--tg-text-muted)] hover:text-rose-400 transition"
                    title="Удалить сообщение"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        });
      })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Replying banner */}
      {replyingTo && (
        <div className="bg-[var(--tg-surface)] border-t border-[var(--tg-border)] px-4 py-2 flex items-center justify-between text-xs animate-pop-in z-20">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-7 bg-blue-500 rounded-full" />
            <Reply size={15} className="text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-blue-400 leading-tight">
                Ответ для {allUsers.find((u) => u.id === replyingTo.senderId)?.name || 'Пользователя'}
              </div>
              <div className="truncate text-[var(--tg-text-muted)] text-[11px]">
                {replyingTo.text || 'Медиафайл'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Emoji / Sticker Picker */}
      <EmojiPicker
        isOpen={isEmojiPickerOpen}
        onSelectEmoji={(em) => setInputText((prev) => prev + em)}
        onSelectSticker={(stickerUrl) => {
          onSendMessage({
            text: '',
            mediaUrl: stickerUrl,
            mediaType: 'image',
            replyToId: replyingTo?.id,
          });
          setReplyingTo(null);
        }}
        onClose={() => setIsEmojiPickerOpen(false)}
      />

      {/* Bottom Input Bar */}
      {isBlocked ? (
        <div className="p-3 bg-[var(--tg-sidebar)] border-t border-[var(--tg-border)] flex items-center justify-between z-20">
          <div className="flex items-center gap-2.5 text-xs text-rose-400 font-medium">
            <Ban size={16} />
            <span>Этот пользователь заблокирован. Вы не можете отправлять сообщения.</span>
          </div>
          {onToggleBlockUser && (
            <button
              type="button"
              onClick={onToggleBlockUser}
              className="px-3.5 py-1.5 bg-[#5288c1]/20 hover:bg-[#5288c1]/30 text-[#5288c1] rounded-xl text-xs font-semibold border border-[#5288c1]/30 transition"
            >
              Разблокировать
            </button>
          )}
        </div>
      ) : (
        <div className="p-3 bg-[var(--tg-sidebar)] border-t border-[var(--tg-border)] flex items-end gap-2 z-20 relative">
          {/* Hidden file inputs */}
          <input
            type="file"
            ref={photoVideoInputRef}
            onChange={(e) => handleMediaUpload(e)}
            accept="image/*,video/*"
            className="hidden"
          />
          <input
            type="file"
            ref={audioInputRef}
            onChange={(e) => handleMediaUpload(e, 'audio')}
            accept="audio/*"
            className="hidden"
          />
          <input
            type="file"
            ref={fileDocInputRef}
            onChange={(e) => handleMediaUpload(e, 'file')}
            accept="*/*"
            className="hidden"
          />

          {/* Attachment Popup Menu */}
          {isAttachMenuOpen && (
            <>
              <div
                onClick={() => setIsAttachMenuOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute bottom-16 left-3 bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 w-56 animate-pop-in text-[var(--tg-text)]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachMenuOpen(false);
                    photoVideoInputRef.current?.click();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] text-xs font-medium transition text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-[#5288c1] flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--tg-text)]">Фото или видео</div>
                    <div className="text-[10px] text-[var(--tg-text-muted)]">Изображения, ролики</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAttachMenuOpen(false);
                    audioInputRef.current?.click();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] text-xs font-medium transition text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                    <Music size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--tg-text)]">Музыка / аудио</div>
                    <div className="text-[10px] text-[var(--tg-text-muted)]">MP3, WAV, FLAC</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAttachMenuOpen(false);
                    fileDocInputRef.current?.click();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] text-xs font-medium transition text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--tg-text)]">Файл / документ</div>
                    <div className="text-[10px] text-[var(--tg-text-muted)]">Любые форматы</div>
                  </div>
                </button>

                {/* Poll / Quiz button in attachment menu */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachMenuOpen(false);
                    setIsCreatePollOpen(true);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] text-xs font-medium transition text-left cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                    <BarChart2 size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--tg-text)]">Опрос или викторина</div>
                    <div className="text-[10px] text-[var(--tg-text-muted)]">Голосование в чате</div>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* Editing Message Banner */}
          {editingMessage && (
            <div className="absolute -top-12 left-0 right-0 bg-[var(--tg-surface)] border-t border-b border-[var(--tg-border)] px-4 py-2 flex items-center justify-between text-xs z-30 animate-pop-in">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-1 h-7 bg-[#5288c1] rounded-full" />
                <Edit3 size={15} className="text-[#5288c1] flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold text-[#5288c1] leading-tight">
                    Редактирование сообщения
                  </div>
                  <div className="truncate text-[var(--tg-text-muted)] text-[11px]">
                    {editingMessage.text}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setInputText('');
                }}
                className="p-1 rounded-full text-[var(--tg-text-muted)] hover:text-white"
                title="Отменить редактирование"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {isRecordingVoice ? (
            /* Voice Recording UI */
            <div className="flex-1 flex items-center justify-between bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 rounded-2xl animate-pulse">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                <span>Запись войса... 0:{recordingSeconds.toString().padStart(2, '0')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelVoiceRecording}
                  className="text-xs text-[var(--tg-text-muted)] hover:text-white px-2 py-1"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleFinishVoiceRecording}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Send size={12} />
                  <span>Отправить</span>
                </button>
              </div>
            </div>
          ) : (
            /* Normal text message input */
            <>
              <button
                type="button"
                onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                className={`p-2.5 rounded-full transition flex-shrink-0 ${
                  isAttachMenuOpen
                    ? 'text-[#5288c1] bg-[#5288c1]/10'
                    : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)]'
                }`}
                title="Прикрепить фото, видео, музыку, опрос или файл"
              >
                <Paperclip size={20} />
              </button>

              <div className="flex-1 bg-[var(--tg-surface)] rounded-2xl border border-transparent focus-within:border-blue-500 transition flex items-end px-3 py-1.5 min-h-[42px] max-h-36">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => {
                    handleInputChange(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={editingMessage ? 'Редактировать сообщение...' : 'Написать сообщение...'}
                  className="w-full bg-transparent text-sm text-[var(--tg-text)] placeholder-[var(--tg-text-muted)] outline-none resize-none py-1.5 max-h-28"
                />

                {/* Self-destruct Burn Timer button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBurnMenuOpen(!isBurnMenuOpen)}
                    className={`p-1.5 rounded-full transition flex-shrink-0 cursor-pointer ${
                      selectedBurnTimer
                        ? 'text-rose-400 bg-rose-500/20 font-bold text-xs'
                        : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
                    }`}
                    title={selectedBurnTimer ? `Самоуничтожение: ${selectedBurnTimer} сек` : 'Таймер самоуничтожения'}
                  >
                    {selectedBurnTimer ? (
                      <span className="flex items-center text-[10px] font-bold text-rose-400 px-0.5">
                        <Flame size={13} className="mr-0.5" /> {selectedBurnTimer}s
                      </span>
                    ) : (
                      <Timer size={18} />
                    )}
                  </button>

                  {isBurnMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsBurnMenuOpen(false)} />
                      <div className="absolute bottom-10 right-0 bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5 w-44 animate-pop-in text-xs text-[var(--tg-text)]">
                        <div className="text-[10px] uppercase font-bold text-[var(--tg-text-muted)] px-2 py-1">
                          Таймер самоуничтожения
                        </div>
                        {[
                          { label: 'Выключен', val: undefined },
                          { label: '5 секунд', val: 5 },
                          { label: '10 секунд', val: 10 },
                          { label: '30 секунд', val: 30 },
                        ].map((opt) => (
                          <button
                            key={String(opt.val)}
                            type="button"
                            onClick={() => {
                              setSelectedBurnTimer(opt.val);
                              setIsBurnMenuOpen(false);
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
                              selectedBurnTimer === opt.val
                                ? 'bg-[#2b5278] text-white font-semibold'
                                : 'hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text)]'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {selectedBurnTimer === opt.val && <Check size={13} className="text-[#5288c1]" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Spoiler Send button */}
                <button
                  type="button"
                  onClick={() => setIsSpoilerSend(!isSpoilerSend)}
                  className={`p-1.5 rounded-full transition flex-shrink-0 cursor-pointer ${
                    isSpoilerSend
                      ? 'text-amber-400 bg-amber-500/20 shadow-sm'
                      : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
                  }`}
                  title={isSpoilerSend ? 'Отправка со спойлером включена' : 'Отправить со спойлером'}
                >
                  <EyeOff size={18} />
                </button>

                {/* Emoji button */}
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                  className={`p-1.5 rounded-full transition flex-shrink-0 ${
                    isEmojiPickerOpen
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
                  }`}
                >
                  <Smile size={20} />
                </button>
              </div>

              {/* Send or Mic / Video Note button */}
              {inputText.trim() ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleSend(undefined, true);
                    }}
                    className="p-2.5 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white rounded-full transition flex-shrink-0 shadow-md hover:scale-105"
                    title="Отправить (Enter) • ПКМ: отправить без звука"
                  >
                    <Send size={18} />
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (mediaInputMode === 'voice') {
                        setIsRecordingVoice(true);
                      } else {
                        setIsVideoNoteRecorderOpen(true);
                      }
                    }}
                    className="p-2.5 rounded-full text-[var(--tg-text-muted)] hover:text-[#5288c1] hover:bg-[var(--tg-surface-hover)] transition"
                    title={
                      mediaInputMode === 'voice'
                        ? 'Записать голосовое сообщение'
                        : 'Записать видеосообщение в кружочке Telegram'
                    }
                  >
                    {mediaInputMode === 'voice' ? <Mic size={20} /> : <Camera size={20} />}
                  </button>

                  {/* Mode switcher badge */}
                  <button
                    type="button"
                    onClick={() =>
                      setMediaInputMode(mediaInputMode === 'voice' ? 'round_video' : 'voice')
                    }
                    className="absolute -top-1 -right-1 text-[8px] bg-[#5288c1] hover:bg-[#6499d3] text-white px-1.5 py-0.2 rounded-full font-bold shadow-sm"
                    title="Переключить: Войс / Кружочек"
                  >
                    {mediaInputMode === 'voice' ? 'МИК' : 'КРУГ'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Telegram Desktop Right-Click Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50 cursor-default"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 280),
              left: Math.min(contextMenu.x, window.innerWidth - 220),
            }}
            className="fixed z-50 w-52 bg-[var(--tg-surface)] text-[var(--tg-text)] rounded-xl shadow-2xl border border-[var(--tg-border)] p-1.5 flex flex-col gap-0.5 animate-pop-in text-xs select-none"
          >
            {/* Quick Emoji Reactions */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--tg-border)] mb-1">
              {['👍', '❤️', '🔥', '😂', '👏', '🎉'].map((em) => (
                <button
                  key={em}
                  onClick={() => {
                    onReactMessage(contextMenu.message.id, em);
                    setContextMenu(null);
                  }}
                  className="hover:scale-125 transition text-base"
                >
                  {em}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                setReplyingTo(contextMenu.message);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--tg-surface-hover)] transition text-left cursor-pointer"
            >
              <Reply size={14} className="text-[#5288c1]" />
              <span>Ответить</span>
            </button>

            {/* Edit message (only for my text messages) */}
            {contextMenu.message.senderId === currentUser.id && contextMenu.message.text && (
              <button
                onClick={() => {
                  setEditingMessage(contextMenu.message);
                  setInputText(contextMenu.message.text);
                  setContextMenu(null);
                  textareaRef.current?.focus();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--tg-surface-hover)] transition text-left cursor-pointer"
              >
                <Edit3 size={14} className="text-[#5288c1]" />
                <span>Изменить</span>
              </button>
            )}

            {/* Forward message */}
            <button
              onClick={() => {
                setForwardingMessage(contextMenu.message);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--tg-surface-hover)] transition text-left cursor-pointer"
            >
              <Forward size={14} className="text-[#5288c1]" />
              <span>Переслать</span>
            </button>

            {contextMenu.message.text && (
              <button
                onClick={() => {
                  handleCopyText(contextMenu.message.text, contextMenu.message.id);
                  setContextMenu(null);
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--tg-surface-hover)] transition text-left cursor-pointer"
              >
                <Copy size={14} className="text-[#5288c1]" />
                <span>Копировать текст</span>
              </button>
            )}

            <button
              onClick={() => {
                onPinMessage(contextMenu.message.id);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--tg-surface-hover)] transition text-left cursor-pointer"
            >
              <Pin size={14} className="text-[#5288c1]" />
              <span>
                {chat.pinnedMessageId === contextMenu.message.id ? 'Открепить' : 'Закрепить'}
              </span>
            </button>

            <div className="h-px bg-[var(--tg-border)] my-0.5" />

            <button
              onClick={() => {
                onDeleteMessage(contextMenu.message);
                setContextMenu(null);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-rose-600/20 text-rose-500 transition text-left cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Удалить сообщение</span>
            </button>
          </div>
        </>
      )}

      {/* Fullscreen Photo Viewer Modal */}
      <PhotoViewerModal
        isOpen={!!selectedPhoto}
        imageUrl={selectedPhoto?.url || null}
        title={selectedPhoto?.title}
        timestamp={selectedPhoto?.timestamp}
        onClose={() => setSelectedPhoto(null)}
      />

      {/* Fullscreen Video Player Modal */}
      <VideoPlayerModal
        isOpen={!!selectedVideo}
        videoUrl={selectedVideo?.url || null}
        title={selectedVideo?.title}
        timestamp={selectedVideo?.timestamp}
        onClose={() => setSelectedVideo(null)}
      />

      {/* Create Poll / Quiz Modal */}
      <CreatePollModal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        onSubmit={handleCreatePoll}
      />

      {/* Video Note Circle Recorder */}
      <VideoNoteRecorder
        isOpen={isVideoNoteRecorderOpen}
        onClose={() => setIsVideoNoteRecorderOpen(false)}
        onSend={handleSendVideoNote}
      />

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        message={forwardingMessage}
        chats={chats}
        currentUser={currentUser}
        onClose={() => setForwardingMessage(null)}
        onForward={(targetChatId) => {
          if (onForwardMessage && forwardingMessage) {
            onForwardMessage(forwardingMessage, targetChatId);
          }
        }}
      />

      {/* Group Voice Chat / Space Modal */}
      <GroupVoiceChatModal
        isOpen={isGroupVoiceChatOpen}
        chat={chat}
        currentUser={currentUser}
        allUsers={allUsers}
        socket={socket}
        onClose={() => setIsGroupVoiceChatOpen(false)}
      />
    </div>
  );
};
