import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Trash2,
  Search,
  Video,
} from 'lucide-react';
import { User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { TelegramPremiumBadge } from './TelegramPremiumBadge';
import { isUserVerified } from '../utils/verified';
import { API_BASE_URL } from '../config';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

export interface CallRecord {
  id: string;
  callerId: string;
  receiverId: string;
  duration: number;
  status: 'completed' | 'missed';
  direction?: 'incoming' | 'outgoing' | 'missed';
  isVideo?: boolean;
  timestamp: number;
  otherUser?: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    online?: boolean;
    verified?: boolean;
    isPremium?: boolean;
    emojiStatus?: string;
  } | null;
}

interface CallHistoryModalProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onStartCall: (targetUser: User) => void;
}

export const CallHistoryModal: React.FC<CallHistoryModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onStartCall,
}) => {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'missed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch calls on open
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/users/${currentUser.id}/calls`)
      .then((res) => res.json())
      .then((data) => {
        setCalls(data || []);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [isOpen, currentUser]);

  const handleClearHistory = async () => {
    if (!currentUser) return;
    if (!confirm('Вы уверены, что хотите очистить всю историю звонков?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/users/${currentUser.id}/calls`, {
        method: 'DELETE',
      });
      setCalls([]);
    } catch (err) {
      console.error('Error clearing calls:', err);
    }
  };

  if (!isOpen || !currentUser) return null;

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return 'Пропущен';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} сек`;
    return `${m} мин ${s > 0 ? `${s} сек` : ''}`;
  };

  const formatCallTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Сегодня в ${timeStr}`;
    if (isYesterday) return `Вчера в ${timeStr}`;
    return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} в ${timeStr}`;
  };

  const filteredCalls = calls
    .filter((c) => {
      if (activeTab === 'missed') {
        return c.direction === 'missed' || c.status === 'missed';
      }
      return true;
    })
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = c.otherUser?.name?.toLowerCase() || '';
      const username = c.otherUser?.username?.toLowerCase() || '';
      return name.includes(q) || username.includes(q);
    });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Window */}
      <div className="relative w-full max-w-[460px] bg-[#17212b] rounded-2xl shadow-2xl border border-[#202b36] flex flex-col z-[71] overflow-hidden text-[#f5f5f5] animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202b36] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#5288c1]/15 text-[#5288c1] flex items-center justify-center">
              <Phone size={19} />
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">Звонки</h2>
              <p className="text-[11px] text-[#7f91a4]">История недавних вызовов</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {calls.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-2 rounded-full hover:bg-rose-500/10 text-[#7f91a4] hover:text-rose-400 transition cursor-pointer"
                title="Очистить историю звонков"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#202b36] text-[#7f91a4] hover:text-[#f5f5f5] transition cursor-pointer"
              title="Закрыть"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center bg-[#242f3d] px-3 py-2 rounded-xl border border-transparent focus-within:border-[#5288c1] transition">
            <Search size={15} className="text-[#7f91a4] mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по истории звонков..."
              className="w-full bg-transparent text-xs text-[#f5f5f5] placeholder-[#7f91a4] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#7f91a4] hover:text-[#f5f5f5] text-xs cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs: Все звонки / Пропущенные */}
        <div className="flex px-5 border-b border-[#202b36] text-xs font-medium text-[#7f91a4]">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'all'
                ? 'border-[#5288c1] text-[#5288c1] font-semibold'
                : 'border-transparent hover:text-[#f5f5f5]'
            }`}
          >
            Все звонки ({calls.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('missed')}
            className={`py-2 px-3 border-b-2 transition cursor-pointer ${
              activeTab === 'missed'
                ? 'border-[#5288c1] text-[#5288c1] font-semibold'
                : 'border-transparent hover:text-[#f5f5f5]'
            }`}
          >
            Пропущенные ({calls.filter((c) => c.direction === 'missed' || c.status === 'missed').length})
          </button>
        </div>

        {/* Calls List */}
        <div className="flex-1 max-h-[380px] overflow-y-auto p-2 no-scrollbar">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[#7f91a4]">
              Загрузка истории звонков...
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-full bg-[#242f3d] text-[#5288c1] flex items-center justify-center mb-3">
                <Phone size={24} />
              </div>
              <p className="font-semibold text-sm mb-1">
                {activeTab === 'missed' ? 'Нет пропущенных звонков' : 'Здесь пока нет звонков'}
              </p>
              <p className="text-xs text-[#7f91a4] max-w-[260px]">
                {activeTab === 'missed'
                  ? 'Все входящие вызовы были приняты.'
                  : 'Все совершённые и входящие звонки будут сохраняться здесь.'}
              </p>
            </div>
          ) : (
            filteredCalls.map((call) => {
              const otherUser = call.otherUser;
              if (!otherUser) return null;
              const isMissed = call.direction === 'missed' || call.status === 'missed';
              const isIncoming = call.direction === 'incoming';
              const isOutgoing = call.direction === 'outgoing';

              return (
                <div
                  key={call.id}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#202b36] transition group my-0.5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* User Avatar */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={getAvatarUrl(otherUser.avatar, otherUser.name)}
                        onError={(e) => handleAvatarError(e, otherUser.name)}
                        alt={otherUser.name}
                        className="w-11 h-11 rounded-full object-cover shadow-sm"
                      />
                      {otherUser.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#17212b] rounded-full" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm flex items-center gap-1 leading-tight truncate">
                        <span className="truncate">{otherUser.name}</span>
                        {isUserVerified(otherUser) && <TelegramVerifiedBadge size={14} />}
                        {otherUser.isPremium && (
                          <TelegramPremiumBadge emojiStatus={otherUser.emojiStatus} />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs mt-1 text-[#7f91a4]">
                        {/* Call Direction Icon */}
                        {isMissed ? (
                          <span className="text-rose-400 flex items-center gap-1 font-medium">
                            <PhoneMissed size={13} />
                            <span>Пропущенный</span>
                          </span>
                        ) : isIncoming ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            <PhoneIncoming size={13} />
                            <span>Входящий ({formatDuration(call.duration)})</span>
                          </span>
                        ) : (
                          <span className="text-[#5288c1] flex items-center gap-1 font-medium">
                            <PhoneOutgoing size={13} />
                            <span>Исходящий ({formatDuration(call.duration)})</span>
                          </span>
                        )}

                        <span>•</span>
                        <span className="text-[11px]">{formatCallTime(call.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Call Button */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onStartCall(otherUser as User);
                    }}
                    className="w-9 h-9 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white transition flex items-center justify-center flex-shrink-0 ml-2 shadow-sm cursor-pointer"
                    title={`Позвонить ${otherUser.name}`}
                  >
                    <Phone size={16} fill="currentColor" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
