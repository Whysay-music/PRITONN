import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { Chat, User } from '../types';
import { APP_VERSION } from '../config';
import { areSoundsEnabled, setSoundsEnabled } from '../utils/notifications';

interface DesktopTitleBarProps {
  activeChat: Chat | null;
  currentUser?: User | null;
  allUsers?: User[];
  onClose?: () => void;
}

export const DesktopTitleBar: React.FC<DesktopTitleBarProps> = ({
  activeChat,
  currentUser,
  allUsers,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundsActive, setSoundsActive] = useState<boolean>(() => areSoundsEnabled());

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleSettingsChanged = () => {
      setSoundsActive(areSoundsEnabled());
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('pritonn-settings-changed', handleSettingsChanged);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('pritonn-settings-changed', handleSettingsChanged);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleToggleSound = () => {
    const next = !soundsActive;
    setSoundsActive(next);
    setSoundsEnabled(next);
  };

  let chatTitle = 'PRITONN';
  if (activeChat) {
    if (activeChat.type === 'saved') {
      chatTitle = 'Избранное';
    } else if (activeChat.type === 'direct') {
      const otherUserId =
        activeChat.members?.find((id) => id !== currentUser?.id) || activeChat.targetUserId;
      const target = allUsers?.find((u) => u.id === otherUserId) || activeChat.targetUser;
      chatTitle = target?.name || activeChat.displayName || activeChat.name;
    } else {
      chatTitle = activeChat.displayName || activeChat.name;
    }
  }

  return (
    <header className="h-7 bg-[var(--tg-titlebar-bg)] border-b border-[var(--tg-titlebar-border)] text-[var(--tg-titlebar-muted)] flex items-center justify-between px-2.5 text-xs select-none z-50 flex-shrink-0 transition-colors">
      {/* App branding */}
      <div className="flex items-center gap-2">
        <img
          src="/logo.jpg"
          alt="PRITONN"
          className="w-4 h-4 rounded-full object-cover border border-[#2b5278]"
        />
        <span className="font-semibold text-[11px] text-[var(--tg-titlebar-text)] tracking-wide">
          PRITONN
        </span>
        <span className="text-[10px] text-[#5288c1] bg-[var(--tg-surface)] px-1.5 py-0.2 rounded border border-[var(--tg-border)] font-mono">
          v{APP_VERSION}
        </span>
      </div>

      {/* Middle status */}
      <div className="truncate text-[11px] text-[var(--tg-titlebar-muted)] hidden sm:block max-w-sm font-medium">
        {chatTitle}
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleToggleSound}
          className="p-1 hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] rounded transition text-[var(--tg-titlebar-muted)] cursor-pointer"
          title={soundsActive ? 'Отключить звуки уведомлений' : 'Включить звуки уведомлений'}
        >
          {soundsActive ? <Volume2 size={12} /> : <VolumeX size={12} className="text-rose-400" />}
        </button>

        <button
          type="button"
          onClick={() => {
            const electron = (window as unknown as { electronAPI?: { maximize: () => void } })
              .electronAPI;
            if (electron) {
              electron.maximize();
            } else {
              toggleFullscreen();
            }
          }}
          className="p-1 hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] rounded transition text-[var(--tg-titlebar-muted)] cursor-pointer"
          title={isFullscreen ? 'Оконный режим' : 'Во весь экран'}
        >
          {isFullscreen ? <Square size={12} /> : <Maximize2 size={12} />}
        </button>

        <button
          type="button"
          onClick={() => {
            const electron = (window as unknown as { electronAPI?: { minimize: () => void } })
              .electronAPI;
            if (electron) {
              electron.minimize();
            } else if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="p-1 hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] rounded transition text-[var(--tg-titlebar-muted)] cursor-pointer"
          title="Свернуть окно"
        >
          <Minus size={12} />
        </button>

        <button
          type="button"
          onClick={() => {
            const electron = (window as unknown as { electronAPI?: { close: () => void } })
              .electronAPI;
            if (electron) {
              electron.close();
            } else if (window.confirm('Закрыть PRITONN?')) {
              window.close();
            }
          }}
          className="p-1 hover:bg-rose-600 hover:text-white rounded transition text-[#7f91a4] cursor-pointer"
          title="Закрыть"
        >
          <X size={12} />
        </button>
      </div>
    </header>
  );
};
