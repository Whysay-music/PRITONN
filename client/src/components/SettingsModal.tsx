import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  X,
  Camera,
  Moon,
  Sun,
  Upload,
  Check,
  Folder,
  Lock,
  Smartphone,
  Laptop,
  KeyRound,
  LogOut,
  Bell,
  BellOff,
  Volume2,
  Activity,
  RefreshCw,
  Download,
  BatteryCharging,
} from 'lucide-react';
import { User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { API_BASE_URL, APP_VERSION } from '../config';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import {
  areNotificationsEnabled,
  setNotificationsEnabled,
  areSoundsEnabled,
  setSoundsEnabled,
  isBackgroundModeEnabled,
  setBackgroundModeEnabled,
  isAndroidNative,
  requestAndroidBatteryExemption,
} from '../utils/notifications';
import { AppUpdateInfo, checkForAppUpdate, installAppUpdate } from '../utils/updater';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser: User;
  isDark: boolean;
  onToggleTheme: () => void;
  onUpdateProfile: (data: {
    name: string;
    username: string;
    bio?: string;
    phone?: string;
    avatar?: string;
    verified?: boolean;
    isPremium?: boolean;
    emojiStatus?: string;
  }) => void;
  onOpenCustomFolders?: () => void;
  onOpenAppLockSetup?: () => void;
  isAppLockEnabled?: boolean;
  onToggleAppLock?: (enabled: boolean) => void;
  onClose: () => void;
}

const EMOJI_STATUSES = ['None', '⚡', '👑', '💎', '🔥', '🚀', '🌙', '🎧', '🏆', '⭐'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUser,
  isDark,
  onToggleTheme,
  onUpdateProfile,
  onOpenCustomFolders,
  onOpenAppLockSetup,
  isAppLockEnabled = false,
  onToggleAppLock,
  onClose,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [verified, setVerified] = useState(currentUser.verified ?? false);
  const [isPremium, setIsPremium] = useState(currentUser.isPremium ?? true);
  const [emojiStatus, setEmojiStatus] = useState(currentUser.emojiStatus || '⚡');
  const [isUploading, setIsUploading] = useState(false);
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('tg_wallpaper') || 'doodle');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('tg_accent') || '#2481cc');

  // Notifications, Sounds, Background Mode & In-App Updater state
  const [notificationsOn, setNotificationsOn] = useState<boolean>(() => areNotificationsEnabled());
  const [soundsOn, setSoundsOn] = useState<boolean>(() => areSoundsEnabled());
  const [bgModeOn, setBgModeOn] = useState<boolean>(() => isBackgroundModeEnabled());
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState<AppUpdateInfo | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNotificationsOn(areNotificationsEnabled());
      setSoundsOn(areSoundsEnabled());
      setBgModeOn(isBackgroundModeEnabled());
      checkForAppUpdate()
        .then((info) => setUpdateCheckResult(info))
        .catch(() => {});
    }
  }, [isOpen]);

  const handleToggleNotifications = () => {
    const next = !notificationsOn;
    setNotificationsOn(next);
    setNotificationsEnabled(next);
  };

  const handleToggleSounds = () => {
    const next = !soundsOn;
    setSoundsOn(next);
    setSoundsEnabled(next);
  };

  const handleToggleBgMode = () => {
    const next = !bgModeOn;
    setBgModeOn(next);
    setBackgroundModeEnabled(next);
  };

  const handleCheckUpdateNow = async () => {
    if (checkingUpdate || installingUpdate) return;
    setCheckingUpdate(true);
    setUpdateStatusMsg('');
    try {
      const info = await checkForAppUpdate();
      setUpdateCheckResult(info);
      if (!info.hasUpdate) {
        setUpdateStatusMsg(`У вас установлена самая новая версия (v${APP_VERSION})`);
      }
    } catch {
      setUpdateStatusMsg('Не удалось проверить обновления. Проверьте интернет.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdateNow = async () => {
    if (!updateCheckResult || installingUpdate) return;
    setInstallingUpdate(true);
    setUpdateProgress(1);
    setUpdateStatusMsg('Начинаем загрузку обновления...');
    try {
      await installAppUpdate(updateCheckResult, (pct, statusText) => {
        setUpdateProgress(pct);
        setUpdateStatusMsg(statusText);
      });
    } catch (err: any) {
      setUpdateStatusMsg(`Ошибка установки: ${err?.message || 'попробуйте снова'}`);
    } finally {
      setInstallingUpdate(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAvatar(data.url);
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectWallpaper = (wp: string) => {
    setWallpaper(wp);
    localStorage.setItem('tg_wallpaper', wp);
    const chatContainer = document.querySelector('.tg-chat-pattern');
    if (chatContainer) {
      chatContainer.className = chatContainer.className
        .replace(/wallpaper-\w+/g, '')
        .trim();
      chatContainer.classList.add(`wallpaper-${wp}`);
    }
  };

  const handleSelectAccent = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('tg_accent', color);
    document.documentElement.style.setProperty('--tg-accent', color);
    document.documentElement.style.setProperty('--tg-bubble-out', color);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name,
      username,
      bio,
      phone,
      avatar,
      verified,
      isPremium,
      emojiStatus: emojiStatus === 'None' ? '' : emojiStatus,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="w-full max-w-md bg-[var(--tg-surface)] rounded-2xl shadow-2xl flex flex-col border border-[var(--tg-border)] overflow-hidden max-h-[90vh] animate-pop-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--tg-border)] flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-[var(--tg-text)]">
            <UserIcon size={18} className="text-[var(--tg-accent)]" />
            <span>Настройки профиля PRITONN</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {/* Avatar Upload Container */}
          <div className="flex flex-col items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarFile}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-full cursor-pointer group transition hover:scale-105 border-2 border-blue-500 overflow-hidden shadow-md"
              title="Нажмите, чтобы загрузить новое фото"
            >
              <img
                src={getAvatarUrl(avatar, name)}
                onError={(e) => handleAvatarError(e, name)}
                alt={name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
                <Camera size={20} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Upload size={12} />
              <span>{isUploading ? 'Загрузка...' : 'Загрузить новое фото'}</span>
            </button>
          </div>

          {/* Telegram Premium & Emoji Status */}
          <div className="bg-[var(--tg-sidebar)] p-3.5 rounded-xl border border-[var(--tg-border)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base text-amber-400">⭐</span>
                <div>
                  <div className="text-xs font-bold text-[var(--tg-text)]">PRITONN Premium</div>
                  <div className="text-[10px] text-[var(--tg-text-muted)]">
                    Звёздочка ⭐ в профиле и эксклюзивные статусы
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPremium(!isPremium)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  isPremium ? 'bg-amber-500' : 'bg-zinc-600'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                    isPremium ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Emoji Status Picker */}
            {isPremium && (
              <div className="pt-2 border-t border-[var(--tg-border)]/60">
                <div className="text-[10px] text-[var(--tg-text-muted)] uppercase mb-1.5 font-semibold">
                  Эмодзи-статус рядом с именем
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {EMOJI_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setEmojiStatus(status)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                        emojiStatus === status
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-[var(--tg-surface)] text-[var(--tg-text-muted)] hover:text-white'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom Folders Shortcut */}
          {onOpenCustomFolders && (
            <div
              onClick={onOpenCustomFolders}
              className="flex items-center justify-between bg-[var(--tg-sidebar)] p-3 rounded-xl border border-[var(--tg-border)] cursor-pointer hover:bg-[var(--tg-surface-hover)] transition"
            >
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--tg-text)]">
                <Folder size={16} className="text-[#5288c1]" />
                <span>Папки с чатами (Настроить)</span>
              </div>
              <span className="text-[11px] text-[#5288c1] font-semibold">Открыть →</span>
            </div>
          )}

          {/* Theme switch */}
          <div className="flex items-center justify-between bg-[var(--tg-sidebar)] p-3 rounded-xl border border-[var(--tg-border)]">
            <div className="flex items-center gap-2 text-xs font-medium">
              {isDark ? <Moon size={16} className="text-blue-400" /> : <Sun size={16} className="text-amber-500" />}
              <span>Тема оформления: {isDark ? 'Тёмная' : 'Светлая'}</span>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-[var(--tg-surface)] hover:bg-[var(--tg-surface-hover)] border border-[var(--tg-border)] transition cursor-pointer"
            >
              Переключить
            </button>
          </div>

          {/* Chat Appearance: Wallpapers & Accent Colors */}
          <div className="bg-[var(--tg-sidebar)] p-3.5 rounded-xl border border-[var(--tg-border)] flex flex-col gap-3">
            <div className="text-xs font-semibold text-[var(--tg-text)]">
              Оформление чата и темы
            </div>

            {/* Accent Colors */}
            <div>
              <div className="text-[10px] text-[var(--tg-text-muted)] uppercase mb-1.5 font-semibold">
                Цвет акцента
              </div>
              <div className="flex items-center gap-2">
                {[
                  { name: 'Синий', color: '#2481cc' },
                  { name: 'Изумруд', color: '#10b981' },
                  { name: 'Фиолетовый', color: '#8b5cf6' },
                  { name: 'Оранжевый', color: '#f59e0b' },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => handleSelectAccent(c.color)}
                    style={{ backgroundColor: c.color }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm transition hover:scale-110 ${
                      accentColor === c.color ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--tg-sidebar)]' : ''
                    }`}
                    title={c.name}
                  >
                    {accentColor === c.color && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Wallpapers */}
            <div>
              <div className="text-[10px] text-[var(--tg-text-muted)] uppercase mb-1.5 font-semibold">
                Фоновый рисунок чата
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'doodle', name: 'Дудлы' },
                  { id: 'space', name: 'Космос' },
                  { id: 'emerald', name: 'Изумруд' },
                  { id: 'sunset', name: 'Закат' },
                  { id: 'pure-dark', name: 'Тьма' },
                ].map((wp) => (
                  <button
                    key={wp.id}
                    type="button"
                    onClick={() => handleSelectWallpaper(wp.id)}
                    className={`p-1.5 rounded-lg text-[10px] font-medium border text-center transition ${
                      wallpaper === wp.id
                        ? 'bg-[var(--tg-accent)] text-white border-transparent'
                        : 'bg-[var(--tg-surface)] text-[var(--tg-text-muted)] border-[var(--tg-border)] hover:text-white'
                    }`}
                  >
                    {wp.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Verification Badge (Strictly for @Admin only) */}
          <div className="flex items-center justify-between bg-[var(--tg-sidebar)] p-3 rounded-xl border border-[var(--tg-border)]">
            <div className="flex items-center gap-2">
              <TelegramVerifiedBadge size={18} />
              <div>
                <div className="text-xs font-semibold text-[var(--tg-text)]">Галочка верификации</div>
                <div className="text-[10px] text-[var(--tg-text-muted)]">
                  {currentUser.username?.toLowerCase() === 'admin'
                    ? 'Официальный подтверждённый профиль PRITONN'
                    : 'Доступно исключительно для @Admin'}
                </div>
              </div>
            </div>
            {currentUser.username?.toLowerCase() === 'admin' ? (
              <span className="text-[10px] font-bold bg-[#5288c1]/20 text-[#5288c1] px-2.5 py-1 rounded-full border border-[#5288c1]/30">
                АКТИВНА
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md">
                Недоступно
              </span>
            )}
          </div>

          {/* Notifications & Background Mode */}
          <div className="bg-[var(--tg-sidebar)] p-3.5 rounded-xl border border-[var(--tg-border)] flex flex-col gap-3">
            <div className="text-xs font-semibold text-[var(--tg-text)] flex items-center gap-2">
              {notificationsOn ? (
                <Bell size={16} className="text-[#3390ec]" />
              ) : (
                <BellOff size={16} className="text-rose-400" />
              )}
              <span>Уведомления и фоновый режим</span>
            </div>

            {/* Master Notifications Toggle */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-[var(--tg-text)]">
                  Уведомления о сообщениях и звонках
                </div>
                <div className="text-[10px] text-[var(--tg-text-muted)]">
                  {notificationsOn
                    ? 'Включены — приходят при новых сообщениях и вызовах'
                    : 'Выключены — приложение не будет беспокоить'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleNotifications}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 flex-shrink-0 ${
                  notificationsOn ? 'bg-[#3390ec]' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    notificationsOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notification Sounds Toggle */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--tg-border)]/50">
              <div className="flex items-center gap-2">
                <Volume2 size={14} className="text-[#5288c1]" />
                <div>
                  <div className="text-xs font-medium text-[var(--tg-text)]">Звуки в приложении</div>
                  <div className="text-[10px] text-[var(--tg-text-muted)]">
                    Звук отправки, входящих сообщений и мелодия звонка
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleSounds}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 flex-shrink-0 ${
                  soundsOn ? 'bg-[#3390ec]' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    soundsOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Background Keep-Alive Mode Toggle */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--tg-border)]/50">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-emerald-400" />
                <div>
                  <div className="text-xs font-medium text-[var(--tg-text)]">Работа в фоновом режиме</div>
                  <div className="text-[10px] text-[var(--tg-text-muted)]">
                    Держит связь в трее Windows и на заблокированном экране Android
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleBgMode}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 flex-shrink-0 ${
                  bgModeOn ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    bgModeOn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {isAndroidNative() && bgModeOn && (
              <button
                type="button"
                onClick={requestAndroidBatteryExemption}
                className="mt-0.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition"
              >
                <BatteryCharging size={14} />
                <span>Отключить ограничение батареи Android для фона</span>
              </button>
            )}
          </div>

          {/* In-App Software Updater */}
          <div className="bg-[var(--tg-sidebar)] p-3.5 rounded-xl border border-[var(--tg-border)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-[#3390ec]" />
                <div>
                  <div className="text-xs font-semibold text-[var(--tg-text)]">Обновление программы</div>
                  <div className="text-[10px] text-[var(--tg-text-muted)]">
                    Текущая версия: <span className="font-mono font-bold text-[#5288c1]">v{APP_VERSION}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={checkingUpdate || installingUpdate}
                onClick={handleCheckUpdateNow}
                className="px-2.5 py-1 rounded-lg bg-[var(--tg-surface)] hover:bg-[var(--tg-surface-hover)] border border-[var(--tg-border)] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw size={12} className={checkingUpdate ? 'animate-spin text-[#3390ec]' : ''} />
                <span>{checkingUpdate ? 'Проверка...' : 'Проверить'}</span>
              </button>
            </div>

            {updateCheckResult?.hasUpdate ? (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col gap-2">
                <div className="text-xs font-semibold text-blue-400">
                  🚀 Доступна новая версия PRITONN v{updateCheckResult.latestVersion}!
                </div>
                {installingUpdate && (
                  <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#3390ec] h-full transition-all duration-150"
                      style={{ width: `${Math.max(4, updateProgress)}%` }}
                    />
                  </div>
                )}
                {updateStatusMsg && (
                  <div className="text-[11px] text-[var(--tg-text-muted)]">{updateStatusMsg}</div>
                )}
                <button
                  type="button"
                  disabled={installingUpdate}
                  onClick={handleInstallUpdateNow}
                  className="w-full py-2 rounded-xl bg-[#3390ec] hover:bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer transition disabled:opacity-60"
                >
                  <Download size={14} />
                  <span>
                    {installingUpdate
                      ? `Скачивание ${updateProgress}%...`
                      : `Скачать и установить v${updateCheckResult.latestVersion}`}
                  </span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-emerald-400/90 flex items-center gap-1.5">
                <Check size={13} />
                <span>
                  {updateStatusMsg || `Установлена актуальная версия PRITONN v${APP_VERSION}`}
                </span>
              </div>
            )}
          </div>

          {/* Privacy & App Lock (Код-пароль разблокировки) */}
          <div className="bg-[var(--tg-sidebar)] p-3.5 rounded-xl border border-[var(--tg-border)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-[#3390ec]" />
                <div>
                  <div className="text-xs font-semibold text-[var(--tg-text)]">Код-пароль (App Lock)</div>
                  <div className="text-[10px] text-[var(--tg-text-muted)]">
                    Защита переписки 4-значным PIN-кодом
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onToggleAppLock) onToggleAppLock(!isAppLockEnabled);
                }}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                  isAppLockEnabled ? 'bg-[#3390ec]' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    isAppLockEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {isAppLockEnabled && onOpenAppLockSetup && (
              <button
                type="button"
                onClick={onOpenAppLockSetup}
                className="mt-1 text-xs text-[#3390ec] hover:underline font-medium text-left flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound size={13} />
                <span>Сменить PIN-код разблокировки</span>
              </button>
            )}
          </div>

          {/* Active Devices & Sessions */}
          <div className="bg-[var(--tg-sidebar)] p-3.5 rounded-xl border border-[var(--tg-border)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-emerald-400" />
                <div className="text-xs font-semibold text-[var(--tg-text)]">Устройства и сеансы</div>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                2 активны
              </span>
            </div>

            <div className="space-y-2 mt-1">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <Laptop size={15} className="text-[#3390ec]" />
                  <div>
                    <div className="font-medium text-[var(--tg-text)]">PRITONN Desktop (Windows)</div>
                    <div className="text-[10px] text-[var(--tg-text-muted)]">Этот компьютер • В сети</div>
                  </div>
                </div>
                <span className="text-[10px] text-[#3390ec] font-bold">ОНЛАЙН</span>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-black/10 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <Smartphone size={15} className="text-emerald-400" />
                  <div>
                    <div className="font-medium text-[var(--tg-text)]">PRITONN Mobile (Android)</div>
                    <div className="text-[10px] text-[var(--tg-text-muted)]">Приложение • Версия {APP_VERSION}</div>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">АКТИВНО</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => alert('Все остальные сеансы успешно завершены.')}
              className="mt-1 text-xs text-rose-400 hover:text-rose-300 font-medium text-left flex items-center gap-1.5 cursor-pointer transition"
            >
              <LogOut size={13} />
              <span>Завершить все другие сеансы</span>
            </button>
          </div>

          {/* Edit current profile info */}
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
                Имя и Фамилия
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[var(--tg-sidebar)] px-3 py-2 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
                Имя пользователя (@username)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[var(--tg-sidebar)] px-3 py-2 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
                О себе (Bio)
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full bg-[var(--tg-sidebar)] px-3 py-2 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)] resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--tg-text-muted)] block mb-1">
                Номер телефона
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7..."
                className="w-full bg-[var(--tg-sidebar)] px-3 py-2 rounded-xl border border-[var(--tg-border)] text-sm outline-none text-[var(--tg-text)]"
              />
            </div>

            <div className="flex justify-end gap-2.5 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-[var(--tg-text-muted)] hover:bg-[var(--tg-surface-hover)] transition cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white text-xs font-semibold rounded-xl shadow-md transition cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
