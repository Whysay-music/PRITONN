import React, { useEffect } from 'react';
import {
  User as UserIcon,
  Users,
  Radio,
  Phone,
  Bookmark,
  Settings,
  Moon,
  Sun,
  LogOut,
  Folder,
  Gamepad2,
  X,
} from 'lucide-react';
import { User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { TelegramPremiumBadge } from './TelegramPremiumBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

interface TelegramDrawerMenuProps {
  isOpen: boolean;
  currentUser: User;
  isDark: boolean;
  onClose: () => void;
  onOpenSettingsModal: () => void;
  onOpenNewGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenCalls?: () => void;
  onOpenSavedMessages: () => void;
  onOpenCustomFolders?: () => void;
  onOpenMiniApp?: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export const TelegramDrawerMenu: React.FC<TelegramDrawerMenuProps> = ({
  isOpen,
  currentUser,
  isDark,
  onClose,
  onOpenSettingsModal,
  onOpenNewGroup,
  onOpenNewChannel,
  onOpenCalls,
  onOpenSavedMessages,
  onOpenCustomFolders,
  onOpenMiniApp,
  onToggleTheme,
  onLogout,
}) => {
  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed inset-0 flex select-none animate-in fade-in duration-150"
    >
      {/* Fullscreen Backdrop overlay - clicking closes the menu */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ zIndex: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
        aria-label="Закрыть меню"
      />

      {/* Slide-out Drawer Panel starting below TitleBar on Desktop, full height on Mobile */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 2 }}
        className="relative md:top-7 top-0 w-[290px] max-w-[85vw] h-full md:h-[calc(100vh-28px)] bg-[var(--tg-sidebar)] shadow-2xl flex flex-col border-r border-[var(--tg-border)] text-[var(--tg-text)] animate-in slide-in-from-left duration-200"
      >
        {/* User Profile Header in Drawer */}
        <div className="p-4 bg-gradient-to-br from-[#2481cc] to-[#1c5f94] text-white flex flex-col gap-3 flex-shrink-0 shadow-md">
          <div className="flex items-center justify-between">
            <img
              src={getAvatarUrl(currentUser.avatar, currentUser.name)}
              onError={(e) => handleAvatarError(e, currentUser.name)}
              alt={currentUser.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-white/40 shadow-sm"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Переключить тему"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Закрыть меню"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight flex items-center gap-1.5">
              <span className="truncate">{currentUser.name}</span>
              {isUserVerified(currentUser) && <TelegramVerifiedBadge size={16} />}
              {currentUser.isPremium && <TelegramPremiumBadge emojiStatus={currentUser.emojiStatus} />}
            </h3>
            <p className="text-xs text-white/80">@{currentUser.username}</p>
            {currentUser.phone && (
              <p className="text-[11px] text-white/60 mt-0.5">{currentUser.phone}</p>
            )}
          </div>
        </div>

        {/* Menu options matching Telegram Desktop */}
        <div className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto no-scrollbar">
          {/* My Profile */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettingsModal();
            }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
          >
            <UserIcon size={18} className="text-[#5288c1] flex-shrink-0" />
            <span>Мой профиль</span>
          </button>

          {/* PRITONN Premium */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettingsModal();
            }}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <span className="text-base text-amber-400 flex-shrink-0">⭐</span>
              <span>PRITONN Premium</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
              АКТИВЕН
            </span>
          </button>

          {/* Mini Apps */}
          {onOpenMiniApp && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMiniApp();
              }}
              className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
            >
              <Gamepad2 size={18} className="text-amber-400 flex-shrink-0" />
              <span>PRITONN Mini Apps</span>
            </button>
          )}

          {/* Custom Folders */}
          {onOpenCustomFolders && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCustomFolders();
              }}
              className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
            >
              <Folder size={18} className="text-[#5288c1] flex-shrink-0" />
              <span>Папки с чатами</span>
            </button>
          )}

          {/* Create Group */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
          >
            <Users size={18} className="text-[#5288c1] flex-shrink-0" />
            <span>Создать группу</span>
          </button>

          {/* Create Channel */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewChannel();
            }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
          >
            <Radio size={18} className="text-[#5288c1] flex-shrink-0" />
            <span>Создать канал</span>
          </button>

          {/* Calls */}
          {onOpenCalls && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCalls();
              }}
              className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
            >
              <Phone size={18} className="text-[#5288c1] flex-shrink-0" />
              <span>Звонки</span>
            </button>
          )}

          {/* Saved Messages */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSavedMessages();
            }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
          >
            <Bookmark size={18} className="text-[#5288c1] flex-shrink-0" />
            <span>Избранное</span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettingsModal();
            }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer text-left"
          >
            <Settings size={18} className="text-[#7f91a4] flex-shrink-0" />
            <span>Настройки</span>
          </button>

          {/* Night Mode toggle row */}
          <div
            onClick={onToggleTheme}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--tg-surface-hover)] transition text-sm font-medium text-[var(--tg-text)] cursor-pointer"
          >
            <div className="flex items-center gap-3.5">
              <Moon size={18} className="text-[#5288c1] flex-shrink-0" />
              <span>Ночной режим</span>
            </div>
            <div
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition ${
                isDark ? 'bg-[#5288c1] justify-end' : 'bg-slate-300 dark:bg-[#2b3642] justify-start'
              }`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-md" />
            </div>
          </div>

          <div className="h-px bg-[var(--tg-border)] my-2" />

          {/* Logout button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-rose-500/10 text-rose-500 transition text-sm font-medium cursor-pointer text-left"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Выйти из аккаунта</span>
          </button>

          <div className="p-3 text-[11px] text-[var(--tg-text-muted)] mt-auto flex items-center gap-2.5 border-t border-[var(--tg-border)] pt-3">
            <img
              src="/logo.jpg"
              alt="PRITONN"
              className="w-7 h-7 rounded-full object-cover border border-[#2b5278] flex-shrink-0"
            />
            <div>
              <div className="font-semibold text-[var(--tg-text)] leading-tight">PRITONN v5.8.3</div>
              <div className="text-[10px] text-[var(--tg-text-muted)]">Сквозное шифрование & WebSockets</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
