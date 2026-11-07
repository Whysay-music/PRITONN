import React, { useState, useEffect } from 'react';
import { PhoneOff, Mic, MicOff, Maximize2 } from 'lucide-react';
import { Chat, User } from '../types';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

interface FloatingCallPillProps {
  isVoiceCall: boolean;
  isGroupCall: boolean;
  callChat: Chat | null;
  callTargetUser: User | null;
  groupCallChat: Chat | null;
  onMaximize: () => void;
  onEndCall: () => void;
  onToggleMute?: () => void;
  isMuted?: boolean;
}

export const FloatingCallPill: React.FC<FloatingCallPillProps> = ({
  isVoiceCall,
  callChat,
  callTargetUser,
  groupCallChat,
  onMaximize,
  onEndCall,
  onToggleMute,
  isMuted = false,
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const displayName = isVoiceCall
    ? callTargetUser?.name || callChat?.displayName || callChat?.name || 'Собеседник'
    : groupCallChat?.displayName || groupCallChat?.name || 'Голосовой чат';

  const avatarUrl = isVoiceCall
    ? getAvatarUrl(callTargetUser?.avatar, displayName)
    : getAvatarUrl(groupCallChat?.avatar, displayName);

  return (
    <div
      style={{ zIndex: 9990 }}
      className="fixed top-11 sm:top-13 right-3 sm:right-6 bg-[#17212b]/95 border border-emerald-500/50 rounded-2xl shadow-2xl p-2 px-3 flex items-center gap-3 backdrop-blur-xl animate-in slide-in-from-top-4 duration-200 select-none text-white max-w-[94vw]"
    >
      {/* Clickable Area to Expand Call */}
      <div
        onClick={onMaximize}
        className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition min-w-0"
        title="Нажмите, чтобы развернуть звонок"
      >
        <div className="relative flex-shrink-0">
          <img
            src={avatarUrl}
            onError={(e) => handleAvatarError(e, displayName)}
            alt={displayName}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-400"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#17212b] rounded-full animate-ping" />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-xs truncate max-w-[120px] sm:max-w-[170px]">
            <span className="truncate">{displayName}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
            {/* Live animated wave equalizer bars */}
            <span className="flex items-end gap-0.5 h-3 mr-1">
              <span className="w-[2px] h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="w-[2px] h-3 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '120ms' }} />
              <span className="w-[2px] h-1.5 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '240ms' }} />
            </span>
            <span>{formatTimer(seconds)}</span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1.5 pl-2 border-l border-white/15">
        {onToggleMute && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMaximize();
          }}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          title="Развернуть звонок"
        >
          <Maximize2 size={15} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEndCall();
          }}
          className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
          title="Завершить звонок"
        >
          <PhoneOff size={15} />
        </button>
      </div>
    </div>
  );
};
