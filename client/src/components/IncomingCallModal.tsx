import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Shield, Video } from 'lucide-react';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import {
  areNotificationsEnabled,
  areSoundsEnabled,
  showIncomingCallSystemNotification,
  clearCallSystemNotifications,
} from '../utils/notifications';

interface IncomingCallModalProps {
  callerId?: string;
  callerName: string;
  callerAvatar: string;
  callerVerified?: boolean;
  callerUsername?: string;
  chatId?: string;
  isVideo?: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callerId = '',
  callerName,
  callerAvatar,
  callerVerified,
  callerUsername,
  chatId = '',
  isVideo = false,
  onAccept,
  onDecline,
}) => {
  const onDeclineRef = useRef(onDecline);
  onDeclineRef.current = onDecline;

  // Auto-decline if unanswered for 32s (stable ref so App re-renders never reset timer)
  useEffect(() => {
    const timer = setTimeout(() => {
      onDeclineRef.current();
    }, 32000);
    return () => clearTimeout(timer);
  }, []);

  // Interactive System Notification (Accept / Decline right from Android / PC / Web notification!)
  useEffect(() => {
    if (areNotificationsEnabled()) {
      showIncomingCallSystemNotification({
        callerId,
        callerName,
        chatId,
        isVideo,
      });

      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([400, 200, 400, 200, 600]);
        } catch {}
      }
    }

    return () => {
      clearCallSystemNotifications();
    };
  }, [callerId, callerName, chatId, isVideo]);

  const isStoppedRef = useRef(false);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringGainRef = useRef<GainNode | null>(null);
  const ringOscillatorsRef = useRef<OscillatorNode[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopRing = () => {
    isStoppedRef.current = true;
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (ringGainRef.current) {
      try {
        ringGainRef.current.gain.setValueAtTime(0, audioContextRef.current?.currentTime || 0);
        ringGainRef.current.disconnect();
      } catch {}
      ringGainRef.current = null;
    }
    ringOscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {}
    });
    ringOscillatorsRef.current = [];
    try {
      audioContextRef.current?.close();
    } catch {}
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  };

  useEffect(() => {
    isStoppedRef.current = false;
    if (!areNotificationsEnabled() || !areSoundsEnabled()) {
      return () => {
        stopRing();
      };
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const playIncomingRing = () => {
          if (isStoppedRef.current) return;
          try {
            if (ctx.state === 'suspended') ctx.resume();
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            ringGainRef.current = gain;

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(440, ctx.currentTime);
            osc2.frequency.setValueAtTime(480, ctx.currentTime);

            gain.gain.setValueAtTime(0.11, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start();
            osc2.start();
            osc1.stop(ctx.currentTime + 1.4);
            osc2.stop(ctx.currentTime + 1.4);

            ringOscillatorsRef.current = [osc1, osc2];
          } catch {}
        };

        playIncomingRing();
        ringIntervalRef.current = setInterval(playIncomingRing, 2800);
      }
    } catch {}

    return () => {
      stopRing();
    };
  }, []);

  const handleAccept = () => {
    stopRing();
    onAccept();
  };

  const handleDecline = () => {
    stopRing();
    clearCallSystemNotifications();
    onDecline();
  };

  return (
    <div
      style={{ zIndex: 9995 }}
      className="fixed inset-0 h-[100dvh] bg-[#070c14]/88 backdrop-blur-2xl flex items-center justify-center p-4 safe-area-modal select-none animate-fade-in relative overflow-hidden"
    >
      {/* Ambient background avatar glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-25 scale-125 pointer-events-none"
        style={{ backgroundImage: `url(${getAvatarUrl(callerAvatar, callerName)})` }}
      />

      <div className="w-full max-w-sm bg-gradient-to-b from-[#162231]/95 to-[#0f1824]/98 backdrop-blur-2xl text-[#f5f5f5] rounded-[30px] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.65)] flex flex-col items-center border border-white/10 relative overflow-hidden animate-pop-in z-10">
        {/* Top Header Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/25 text-xs text-sky-300 mb-6 font-semibold">
          <Shield size={13} />
          <span>{isVideo ? 'Входящий видеозвонок' : 'Защищённый звонок PRITONN'}</span>
        </div>

        {/* Caller Avatar with Pulsing Halo */}
        <div className="relative mb-5">
          <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-sky-500/40 to-indigo-500/40 animate-pulse" />
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-sky-400/80 shadow-2xl">
            <img
              src={getAvatarUrl(callerAvatar, callerName)}
              onError={(e) => handleAvatarError(e, callerName)}
              alt={callerName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="font-bold text-xl text-center flex items-center gap-1.5 mb-1.5 text-white">
          <span className="truncate max-w-[240px]">{callerName}</span>
          {(callerVerified || callerUsername?.toLowerCase() === 'admin') && (
            <TelegramVerifiedBadge size={17} />
          )}
        </h3>
        <p className="text-xs text-emerald-400 font-medium animate-pulse mb-8 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{isVideo ? 'Вызывает вас по видеосвязи...' : 'Входящий аудиовызов...'}</span>
        </p>

        {/* Action Buttons: Decline / Accept */}
        <div className="flex items-center justify-center gap-14 w-full">
          <div className="flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transform hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Отклонить"
            >
              <PhoneOff size={26} />
            </button>
            <span className="text-xs text-[#94a3b8] font-medium">Отклонить</span>
          </div>

          <div className="flex flex-col items-center gap-2.5">
            <button
              type="button"
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white flex items-center justify-center shadow-xl shadow-emerald-600/40 transform hover:scale-105 active:scale-95 transition animate-bounce cursor-pointer"
              title="Принять вызов"
            >
              {isVideo ? <Video size={26} /> : <Phone size={26} />}
            </button>
            <span className="text-xs text-emerald-400 font-bold">Принять</span>
          </div>
        </div>
      </div>
    </div>
  );
};
