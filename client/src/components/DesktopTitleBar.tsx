import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Send, Volume2, VolumeX } from 'lucide-react';
import { Chat, User } from '../types';

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
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  let chatTitle = 'PRITONN';
  if (activeChat) {
    if (activeChat.type === 'saved') {
      chatTitle = 'Избранное';
    } else if (activeChat.type === 'direct') {
      const otherUserId = activeChat.members?.find((id) => id !== currentUser?.id) || activeChat.targetUserId;
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
        <span className="font-semibold text-[11px] text-[var(--tg-titlebar-text)] tracking-wide">PRITONN</span>
        <span className="text-[10px] text-[#5288c1] bg-[var(--tg-surface)] px-1.5 py-0.2 rounded border border-[var(--tg-border)]">
          v5.8.3
        </span>
      </div>

      {/* Middle status */}
      <div className="truncate text-[11px] text-[var(--tg-titlebar-muted)] hidden sm:block max-w-sm font-medium">
        {chatTitle}
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-1 hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] rounded transition text-[var(--tg-titlebar-muted)]"
          title={isMuted ? 'Включить звук' : 'Отключить звук'}
        >
          {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>

        <button
          onClick={() => {
            const electron = (window as unknown as { electronAPI?: { maximize: () => void } }).electronAPI;
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
          onClick={() => {
            const electron = (window as unknown as { electronAPI?: { minimize: () => void } }).electronAPI;
            if (electron) {
              electron.minimize();
            } else {
              window.location.reload();
            }
          }}
          className="p-1 hover:bg-[var(--tg-surface-hover)] hover:text-[var(--tg-text)] rounded transition text-[var(--tg-titlebar-muted)] cursor-pointer"
          title="Свернуть"
        >
          <Minus size={12} />
        </button>

        <button
          onClick={() => {
            const electron = (window as unknown as { electronAPI?: { close: () => void } }).electronAPI;
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
