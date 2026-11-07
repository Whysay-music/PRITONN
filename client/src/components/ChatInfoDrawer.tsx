import React, { useState } from 'react';
import {
  X,
  Bell,
  BellOff,
  Image as ImageIcon,
  FileText,
  Link,
  Mic,
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle,
  Edit3,
  Camera,
  Trash2,
  Ban,
  Phone,
  Gift,
  Star,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Chat, User, Message } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import { GiftsModal, GiftItem } from './GiftsModal';
import { API_BASE_URL } from '../config';

interface ChatInfoDrawerProps {
  chat: Chat | null;
  currentUser?: User | null;
  allUsers: User[];
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  onSelectUserChat?: (user: User) => void;
  onOpenInviteModal?: (chat: Chat) => void;
  onOpenEditChatModal?: (chat: Chat) => void;
  isBlocked?: boolean;
  onToggleBlockUser?: () => void;
  onRequestDeleteChat?: (chat: Chat) => void;
  onStartVoiceCall?: () => void;
}

export const ChatInfoDrawer: React.FC<ChatInfoDrawerProps> = ({
  chat,
  currentUser,
  allUsers,
  messages,
  isOpen,
  onClose,
  onSelectUserChat,
  onOpenInviteModal,
  onOpenEditChatModal,
  isBlocked,
  onToggleBlockUser,
  onRequestDeleteChat,
  onStartVoiceCall,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'members'>('media');
  const [isMuted, setIsMuted] = useState(false);
  const [isGiftsModalOpen, setIsGiftsModalOpen] = useState(false);
  const [giftSentToast, setGiftSentToast] = useState<string | null>(null);

  if (!isOpen || !chat) return null;

  const isSaved = chat.type === 'saved';
  const isDirect = chat.type === 'direct';
  const otherUserId = isDirect
    ? chat.members?.find((id) => id !== currentUser?.id) || chat.targetUserId
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

  // Filter media from messages
  const mediaMessages = messages.filter((m) => m.mediaUrl);
  const voiceMessages = messages.filter((m) => m.isVoice);

  // Members list
  const memberUsers = (chat.members || [])
    .map((mId) => allUsers.find((u) => u.id === mId))
    .filter(Boolean) as User[];

  return (
    <div className="w-80 h-full bg-[var(--tg-sidebar)] border-l border-[var(--tg-border)] flex flex-col flex-shrink-0 animate-fade-in select-none z-20">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-[var(--tg-border)]">
        <h3 className="font-semibold text-sm">Информация</h3>
        <div className="flex items-center gap-1">
          {onOpenEditChatModal && (chat.type === 'group' || chat.type === 'channel') && (
            <button
              onClick={() => onOpenEditChatModal(chat)}
              className="text-blue-400 hover:text-blue-300 p-1.5 rounded-full hover:bg-[var(--tg-surface-hover)] transition"
              title="Редактировать чат (название и фото)"
            >
              <Edit3 size={17} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] p-1 rounded-full hover:bg-[var(--tg-surface-hover)]"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Cover Banner */}
        <div className="relative w-full h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 overflow-hidden shadow-inner">
          {targetUser?.bannerUrl ? (
            <img src={targetUser.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2481cc]/80 via-[#1f3a56] to-[#121c27] flex items-center justify-center opacity-85" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--tg-sidebar)] via-transparent to-transparent opacity-80" />
        </div>

        {/* Profile Card */}
        <div className="flex flex-col items-center px-6 pb-6 pt-0 border-b border-[var(--tg-border)] -mt-12 relative z-10">
          <div
            onClick={() => onOpenEditChatModal && (chat.type === 'group' || chat.type === 'channel') && onOpenEditChatModal(chat)}
            className={`relative mb-2 ${onOpenEditChatModal && (chat.type === 'group' || chat.type === 'channel') ? 'cursor-pointer group' : ''}`}
            title="Нажмите для смены фото чата"
          >
            <img
              src={getAvatarUrl(displayAvatar, displayName)}
              onError={(e) => handleAvatarError(e, displayName)}
              alt={displayName}
              className="w-24 h-24 rounded-full object-cover border-4 border-[var(--tg-sidebar)] shadow-xl group-hover:brightness-90 transition"
            />
            {onOpenEditChatModal && (chat.type === 'group' || chat.type === 'channel') && (
              <div className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                <Camera size={24} />
              </div>
            )}
            {targetUser?.emojiStatus ? (
              <div className="absolute bottom-0 right-0 bg-[var(--tg-sidebar)] rounded-full p-0.5 text-lg ring-2 ring-[var(--tg-card-border)] shadow" title="Эмодзи-статус">
                {targetUser.emojiStatus}
              </div>
            ) : isUserVerified(targetUser) ? (
              <div className="absolute bottom-0 right-0 bg-[var(--tg-sidebar)] rounded-full p-0.5">
                <TelegramVerifiedBadge size={22} />
              </div>
            ) : null}
          </div>
          <h2 className="font-bold text-base text-center flex items-center justify-center gap-1.5">
            <span>{displayName}</span>
            {isUserVerified(targetUser) && <TelegramVerifiedBadge size={17} />}
          </h2>

          {/* Badges Row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
            {targetUser?.username?.toLowerCase() === 'admin' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                👑 Основатель
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25 text-[10px] font-medium flex items-center gap-1 shadow-sm">
              💎 Участник
            </span>
            {targetUser?.gifts && targetUser.gifts.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25 text-[10px] font-semibold flex items-center gap-1 shadow-sm">
                🎁 Топ-Донатер
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--tg-text-muted)] mt-0.5">
            {chat.type === 'channel'
              ? `${(chat.subscribersCount || 1).toLocaleString()} подписчиков`
              : chat.type === 'group'
              ? `${(chat.membersCount || memberUsers.length).toLocaleString()} участников`
              : isDirect && targetUser?.online
              ? 'в сети'
              : isDirect && targetUser
              ? targetUser.lastSeen || 'был(а) недавно'
              : chat.targetUser?.lastSeen || 'был(а) недавно'}
          </span>

          {/* Direct Chat Actions: Call & Send Gift */}
          {chat.type === 'direct' && targetUser && (
            <div className="flex items-center gap-2 mt-3">
              {onStartVoiceCall && (
                <button
                  type="button"
                  onClick={onStartVoiceCall}
                  className="px-3.5 py-2 rounded-xl bg-[#5288c1]/15 hover:bg-[#5288c1]/25 text-[#5288c1] text-xs font-semibold flex items-center gap-1.5 transition border border-[#5288c1]/30 cursor-pointer shadow-sm active:scale-95"
                >
                  <Phone size={14} />
                  <span>Позвонить</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsGiftsModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition border border-amber-400/40 cursor-pointer shadow-sm active:scale-95"
              >
                <Gift size={14} className="text-amber-400" />
                <span>Подарок</span>
              </button>
            </div>
          )}

          {/* Group Forum / Topics Toggle */}
          {chat.type === 'group' && onOpenEditChatModal && (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => onOpenEditChatModal(chat)}
                className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition border border-blue-500/30 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Настроить чат</span>
              </button>
            </div>
          )}
        </div>

        {/* Gift Showcase for user */}
        {targetUser && targetUser.gifts && targetUser.gifts.length > 0 && (
          <div className="p-3.5 border-b border-[var(--tg-border)] bg-[var(--tg-sidebar)]/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} />
                <span>Витрина подарков ({targetUser.gifts.length})</span>
              </div>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {targetUser.gifts.map((g, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center p-2 rounded-xl bg-[var(--tg-surface)] border border-amber-500/30 min-w-[76px] max-w-[84px] text-center shadow-sm"
                  title={`${g.title} от ${g.fromUserName}${g.message ? `: «${g.message}»` : ''}`}
                >
                  <span className="text-2xl mb-0.5">{g.icon}</span>
                  <span className="text-[10px] font-bold text-[var(--tg-text)] truncate w-full">
                    {g.title}
                  </span>
                  <span className="text-[8.5px] text-[var(--tg-text-muted)] truncate w-full">
                    от {g.fromUserName.split(' ')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toast confirmation */}
        {giftSentToast && (
          <div className="mx-4 mt-2 p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs text-center font-medium animate-in fade-in">
            {giftSentToast}
          </div>
        )}

        {/* Info details */}
        <div className="p-4 flex flex-col gap-3 border-b border-[var(--tg-border)]">
          {chat.description && (
            <div>
              <div className="text-[11px] text-[var(--tg-text-muted)] uppercase tracking-wider font-semibold mb-1">
                Описание
              </div>
              <div className="text-xs text-[var(--tg-text)] leading-relaxed">
                {chat.description}
              </div>
            </div>
          )}

          {chat.username && (
            <div>
              <div className="text-[11px] text-[var(--tg-text-muted)] uppercase tracking-wider font-semibold mb-1">
                Ссылка
              </div>
              <div className="text-xs text-blue-400 hover:underline cursor-pointer">
                t.me/{chat.username}
              </div>
            </div>
          )}

          {/* Notifications toggle */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2.5 text-xs font-medium">
              {isMuted ? (
                <BellOff size={16} className="text-rose-400" />
              ) : (
                <Bell size={16} className="text-blue-400" />
              )}
              <span>Уведомления</span>
            </div>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                isMuted ? 'bg-zinc-600' : 'bg-blue-600'
              }`}
            >
              <div
                className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                  isMuted ? 'left-0.5' : 'right-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tabs: Media / Members */}
        <div className="flex border-b border-[var(--tg-border)] bg-[var(--tg-surface)] text-xs font-medium">
          <button
            onClick={() => setActiveTab('media')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'media'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
            }`}
          >
            <ImageIcon size={14} />
            <span>Медиа ({mediaMessages.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeTab === 'files'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
            }`}
          >
            <FileText size={14} />
            <span>Голосовые ({voiceMessages.length})</span>
          </button>
          {(chat.type === 'group' || chat.type === 'channel') && (
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'members'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
              }`}
            >
              <Users size={14} />
              <span>Участники</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-3">
          {activeTab === 'media' && (
            <div>
              {mediaMessages.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--tg-text-muted)]">
                  Нет сохраненных фото
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {mediaMessages.map((m) => (
                    <a
                      key={m.id}
                      href={m.mediaUrl || ''}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-black/20 hover:opacity-85 transition block"
                    >
                      <img
                        src={m.mediaUrl || ''}
                        alt="media"
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex flex-col gap-2">
              {voiceMessages.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--tg-text-muted)]">
                  Нет голосовых сообщений
                </div>
              ) : (
                voiceMessages.map((vm) => (
                  <div
                    key={vm.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--tg-surface)] text-xs"
                  >
                    <Mic size={15} className="text-blue-400" />
                    <div className="flex-1">
                      <div className="font-medium">Голосовая запись</div>
                      <div className="text-[10px] text-[var(--tg-text-muted)]">
                        {new Date(vm.timestamp).toLocaleDateString()} • {vm.voiceDuration || 10} сек.
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'members' && (chat.type === 'group' || chat.type === 'channel') && (
            <div className="flex flex-col gap-2">
              {/* Add member button */}
              {onOpenInviteModal && (
                <button
                  type="button"
                  onClick={() => onOpenInviteModal(chat)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 cursor-pointer transition w-full text-left font-semibold text-xs border border-blue-500/30"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center">
                    <UserPlus size={14} />
                  </div>
                  <span>Добавить участников</span>
                </button>
              )}

              <div className="flex flex-col gap-1">
                {memberUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => onSelectUserChat && onSelectUserChat(u)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--tg-surface-hover)] cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getAvatarUrl(u.avatar, u.name)}
                        onError={(e) => handleAvatarError(e, u.name)}
                        alt={u.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-semibold flex items-center gap-1">
                          <span>{u.name}</span>
                          {isUserVerified(u) && <TelegramVerifiedBadge size={13} />}
                        </div>
                        <div className="text-[10px]">
                          {u.online ? (
                            <span className="text-[#5288c1] font-medium">в сети</span>
                          ) : (
                            <span className="text-[var(--tg-text-muted)]">
                              {u.lastSeen || 'был(а) недавно'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {onSelectUserChat && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectUserChat(u);
                          }}
                          className="p-1.5 rounded-lg text-[#5288c1] hover:bg-[#5288c1]/15 transition"
                          title={`Написать / Позвонить ${u.name}`}
                        >
                          <Phone size={14} />
                        </button>
                      )}
                      {u.id === chat.creatorId && (
                        <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                          <ShieldCheck size={11} /> Создатель
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Telegram Desktop Danger Actions: Block User & Delete Chat */}
        <div className="p-4 border-t border-[var(--tg-border)] flex flex-col gap-2 mt-auto bg-[var(--tg-surface)]/40">
          {chat.type === 'direct' && onToggleBlockUser && (
            <button
              type="button"
              onClick={onToggleBlockUser}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition border ${
                isBlocked
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
              }`}
            >
              <Ban size={15} />
              <span>{isBlocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}</span>
            </button>
          )}

          {onRequestDeleteChat && (
            <button
              type="button"
              onClick={() => onRequestDeleteChat(chat)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-600/30 transition"
            >
              <Trash2 size={15} />
              <span>
                {chat.type === 'channel'
                  ? 'Удалить канал'
                  : chat.type === 'group'
                  ? 'Покинуть и удалить группу'
                  : 'Удалить диалог'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Gifts Modal */}
      {targetUser && currentUser && (
        <GiftsModal
          isOpen={isGiftsModalOpen}
          targetUser={targetUser}
          currentUser={currentUser}
          onClose={() => setIsGiftsModalOpen(false)}
          onSendGift={(gift, message) => {
            fetch(`${API_BASE_URL}/api/users/${targetUser.id}/gifts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fromUserId: currentUser.id,
                gift,
                message,
              }),
            })
              .then((r) => r.json())
              .then(() => {
                setGiftSentToast(`Подарок «${gift.title}» успешно отправлен! 🎁`);
                setTimeout(() => setGiftSentToast(null), 3500);
              })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
};
