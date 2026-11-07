import React, { useEffect, useState } from 'react';
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
  Palette,
  Check,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { TelegramPremiumBadge } from './TelegramPremiumBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import { APP_VERSION } from '../config';
import { APP_THEMES, getSavedThemeId, applyThemeToDocument, AppTheme } from '../utils/theme';

interface TelegramDrawerMenuProps {
  isOpen: boolean;
  currentUser: User;
  isDark: boolean;
  hasUpdateAvailable?: boolean;
  onClose: () => void;
  onOpenSettingsModal: () => void;
  onOpenNewGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenCalls?: () => void;
  onOpenSavedMessages: () => void;
  onOpenCustomFolders?: () => void;
  onOpenMiniApp?: () => void;
  onOpenEmojiStatus?: () => void;
  onOpenStickerMaker?: () => void;
  onOpenTapGame?: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

export const TelegramDrawerMenu: React.FC<TelegramDrawerMenuProps> = ({
  isOpen,
  currentUser,
  isDark,
  hasUpdateAvailable = false,
  onClose,
  onOpenSettingsModal,
  onOpenNewGroup,
  onOpenNewChannel,
  onOpenCalls,
  onOpenSavedMessages,
  onOpenCustomFolders,
  onOpenMiniApp,
  onOpenEmojiStatus,
  onOpenStickerMaker,
  onOpenTapGame,
  onToggleTheme,
  onLogout,
}) => {
  const [currentThemeId, setCurrentThemeId] = useState<string>(getSavedThemeId);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

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

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppTheme>;
      if (customEvent.detail?.id) {
        setCurrentThemeId(customEvent.detail.id);
      }
    };
    window.addEventListener('pritonn-theme-changed', handleThemeChange);
    return () => window.removeEventListener('pritonn-theme-changed', handleThemeChange);
  }, []);

  if (!isOpen) return null;

  const handleSelectTheme = (themeId: string) => {
    applyThemeToDocument(themeId);
    setCurrentThemeId(themeId);
  };

  return (
    <div
      style={{ zIndex: 9999 }}
      className="fixed inset-0 flex select-none animate-in fade-in duration-200"
    >
      {/* Fullscreen Backdrop overlay */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{ zIndex: 1 }}
        className="absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity cursor-pointer"
        aria-label="Закрыть меню"
      />

      {/* Slide-out Drawer Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 2 }}
        className="relative md:top-7 top-0 w-[310px] sm:w-[330px] max-w-[88vw] h-full md:h-[calc(100vh-28px)] bg-[var(--tg-sidebar)] shadow-2xl flex flex-col border-r border-[var(--tg-card-border)] text-[var(--tg-text)] animate-in slide-in-from-left duration-250 backdrop-blur-xl"
      >
        {/* User Profile Header with stylish gradient aura and framed layout */}
        <div className="p-4 relative overflow-hidden bg-gradient-to-br from-[var(--tg-accent)] via-[#1f3a56] to-[#121c27] text-white flex flex-col gap-3 flex-shrink-0 shadow-lg border-b border-[var(--tg-card-border)]">
          {/* Subtle decorative glow orb in corner */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between relative z-10">
            <div className="relative group">
              <img
                src={getAvatarUrl(currentUser.avatar, currentUser.name)}
                onError={(e) => handleAvatarError(e, currentUser.name)}
                alt={currentUser.name}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-white/40 ring-offset-2 ring-offset-[#121c27] shadow-md group-hover:scale-105 transition-transform"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#121c27] rounded-full shadow" />
            </div>

            <div className="flex items-center gap-1.5">
              {/* Palette button to toggle quick theme swatches */}
              <button
                type="button"
                onClick={() => setIsThemePickerOpen(!isThemePickerOpen)}
                className={`p-2 rounded-xl border border-white/20 transition cursor-pointer backdrop-blur-md ${
                  isThemePickerOpen ? 'bg-white/30 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Палитра тем оформления"
              >
                <Palette size={17} />
              </button>

              {/* Day / Night toggle */}
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition cursor-pointer text-white backdrop-blur-md"
                title="Переключить тему день/ночь"
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              {/* Close Drawer */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition cursor-pointer text-white backdrop-blur-md"
                title="Закрыть меню"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="relative z-10">
            <h3 className="font-bold text-base leading-tight flex items-center gap-1.5">
              <span className="truncate">{currentUser.name}</span>
              {isUserVerified(currentUser) && <TelegramVerifiedBadge size={16} />}
              {currentUser.isPremium && <TelegramPremiumBadge emojiStatus={currentUser.emojiStatus} />}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-white/90 font-medium">@{currentUser.username}</p>
              {currentUser.username?.toLowerCase() === 'admin' ? (
                <span className="text-[10px] bg-sky-500/30 text-sky-200 border border-sky-400/30 px-1.5 py-0.2 rounded-md font-semibold">
                  Создатель
                </span>
              ) : (
                <span className="text-[10px] bg-white/15 text-white/90 border border-white/20 px-1.5 py-0.2 rounded-md font-medium">
                  Онлайн
                </span>
              )}
            </div>
            {currentUser.phone && (
              <p className="text-[11px] text-white/70 mt-0.5">{currentUser.phone}</p>
            )}
          </div>

          {/* Quick Theme Swatches Strip (if open) */}
          {isThemePickerOpen && (
            <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
              {APP_THEMES.map((theme) => {
                const isSelected = currentThemeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleSelectTheme(theme.id)}
                    className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow border ${
                      isSelected ? 'ring-2 ring-white scale-110' : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{
                      background: theme.colors.gradientMain,
                      borderColor: theme.colors.borderAccent,
                    }}
                    title={theme.name}
                  >
                    {isSelected && <Check size={13} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Menu Items with Stylish Frames, glowing borders & detailed subtitles */}
        <div className="flex-1 p-2.5 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
          {/* My Profile */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettingsModal();
            }}
            className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-[#5288c1] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <UserIcon size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                  Мой профиль
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  Настройки аккаунта, аватар и био
                </div>
              </div>
            </div>
            <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
          </button>

          {/* PRITONN Premium */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettingsModal();
            }}
            className="w-full text-left p-2.5 rounded-2xl tg-framed-btn border-amber-500/30 hover:border-amber-500/60 flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0 text-base group-hover:scale-105 transition-transform">
                ⭐
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate flex items-center gap-1.5">
                  <span>PRITONN Premium</span>
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  Все привилегии и фичи разблокированы
                </div>
              </div>
            </div>
            <span className="text-[10px] bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-full font-bold shadow-sm">
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
              className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Gamepad2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                    PRITONN Mini Apps
                  </div>
                  <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                    Игры, веб-боты и web3 каталоги
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
            </button>
          )}

          {/* PRITONN Tap & Farm Game */}
          {onOpenTapGame && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTapGame();
              }}
              className="w-full text-left p-2.5 rounded-2xl tg-framed-btn border-amber-500/30 hover:border-amber-500/60 flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center flex-shrink-0 text-base group-hover:scale-105 transition-transform">
                  🪙
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                    PRITONN Tap & Farm
                  </div>
                  <div className="text-[10px] text-amber-300/80 truncate">
                    Кликер-игра с монетами и бустами
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
            </button>
          )}

          {/* Sticker Maker */}
          {onOpenStickerMaker && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStickerMaker();
              }}
              className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 flex items-center justify-center flex-shrink-0 text-base group-hover:scale-105 transition-transform">
                  🎨
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                    Конструктор стикеров
                  </div>
                  <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                    Создайте стикерпак из любого фото
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
            </button>
          )}

          {/* Emoji Status */}
          {onOpenEmojiStatus && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEmojiStatus();
              }}
              className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 flex items-center justify-center flex-shrink-0 text-base group-hover:scale-105 transition-transform">
                  ✨
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate flex items-center gap-1.5">
                    <span>Эмодзи-статус</span>
                    {currentUser.emojiStatus && <span>{currentUser.emojiStatus}</span>}
                  </div>
                  <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                    Значок возле имени во всех чатах
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
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
              className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Folder size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                    Папки с чатами
                  </div>
                  <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                    Сортировка диалогов и свои категории
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
            </button>
          )}

          {/* Create Group */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Users size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                  Создать группу
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  Общение до 200 000 участников
                </div>
              </div>
            </div>
            <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
          </button>

          {/* Create Channel */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewChannel();
            }}
            className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Radio size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                  Создать канал
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  Трансляция новостей и контента
                </div>
              </div>
            </div>
            <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
          </button>

          {/* Calls */}
          {onOpenCalls && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCalls();
              }}
              className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Phone size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                    Звонки
                  </div>
                  <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                    Аудио, HD видео и демонстрация экрана
                  </div>
                </div>
              </div>
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
            </button>
          )}

          {/* Saved Messages */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSavedMessages();
            }}
            className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Bookmark size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                  Избранное
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  Ваше персональное облачное хранилище
                </div>
              </div>
            </div>
            <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettingsModal();
            }}
            className="w-full text-left p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-500/15 border border-slate-500/30 text-slate-300 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Settings size={18} className={hasUpdateAvailable ? 'text-rose-400' : ''} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate flex items-center gap-2">
                  <span>Настройки</span>
                  {hasUpdateAvailable && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  Темы, конфиденциальность и память
                </div>
              </div>
            </div>
            {hasUpdateAvailable ? (
              <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold shadow animate-pulse">
                NEW
              </span>
            ) : (
              <ChevronRight size={15} className="text-[var(--tg-text-muted)] group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-1" />
            )}
          </button>

          {/* Night Mode Switch Card */}
          <div
            onClick={onToggleTheme}
            className="w-full p-2.5 rounded-2xl tg-framed-btn flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Moon size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tg-text)] leading-tight truncate">
                  Ночной режим
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)] truncate">
                  {isDark ? 'Тёмное оформление активно' : 'Светлое оформление активно'}
                </div>
              </div>
            </div>
            <div
              className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                isDark ? 'bg-[var(--tg-accent)] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <div className="w-5 h-5 bg-white rounded-full shadow-md" />
            </div>
          </div>

          <div className="h-px bg-[var(--tg-card-border)] my-1" />

          {/* Logout button */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full text-left p-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 transition-all duration-200 flex items-center justify-between cursor-pointer group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <LogOut size={18} />
              </div>
              <div>
                <div className="text-[13px] font-semibold leading-tight">Выйти из аккаунта</div>
                <div className="text-[10px] opacity-75">Завершить сессию на этом устройстве</div>
              </div>
            </div>
          </button>

          {/* Modern Footer with security info */}
          <div className="p-3 rounded-2xl bg-[var(--tg-surface)]/40 border border-[var(--tg-card-border)] mt-auto flex items-center justify-between text-[11px] text-[var(--tg-text-muted)]">
            <div className="flex items-center gap-2">
              <img
                src="/logo.jpg"
                alt="PRITONN"
                className="w-7 h-7 rounded-full object-cover border border-[var(--tg-border-accent)] flex-shrink-0 shadow"
              />
              <div>
                <div className="font-semibold text-[var(--tg-text)] leading-tight">PRITONN v{APP_VERSION}</div>
                <div className="text-[9.5px] text-[var(--tg-text-muted)] flex items-center gap-1">
                  <Shield size={10} className="text-emerald-400" />
                  <span>Шифрование & WebSockets</span>
                </div>
              </div>
            </div>
            <span className="text-[9.5px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
              LIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
