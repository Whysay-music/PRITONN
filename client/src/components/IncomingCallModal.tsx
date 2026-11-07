import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Shield } from 'lucide-react';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

interface IncomingCallModalProps {
  callerName: string;
  callerAvatar: string;
  callerVerified?: boolean;
  callerUsername?: string;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callerName,
  callerAvatar,
  callerVerified,
  callerUsername,
  onAccept,
  onDecline,
}) => {
  // Auto-decline if unanswered for 30s
  useEffect(() => {
    const timer = setTimeout(() => {
      onDecline();
    }, 30000);
    return () => clearTimeout(timer);
  }, [onDecline]);

  // System notification and vibration
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          const notif = new Notification(`Входящий звонок: ${callerName}`, {
            body: 'Нажмите, чтобы ответить на звонок в PRITONN',
            icon: getAvatarUrl(callerAvatar, callerName),
            tag: 'incoming_call',
          });
          notif.onclick = () => {
            window.focus();
            onAccept();
          };
        } catch {}
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 600]);
      } catch {}
    }
  }, [callerName, callerAvatar, onAccept]);

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
      try { navigator.vibrate(0); } catch {}
    }
  };

  useEffect(() => {
    isStoppedRef.current = false;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

            gain.gain.setValueAtTime(0.12, ctx.currentTime);
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
    onDecline();
  };

  return (
    <div
      style={{ zIndex: 9995 }}
      className="fixed inset-0 h-[100dvh] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 safe-area-modal select-none animate-fade-in relative overflow-hidden"
    >
      {/* Ambient background avatar glow */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-125"
        style={{ backgroundImage: `url(${getAvatarUrl(callerAvatar, callerName)})` }}
      />

      <div className="w-full max-w-sm bg-[#17212b]/90 backdrop-blur-2xl text-[#f5f5f5] rounded-3xl p-7 shadow-2xl flex flex-col items-center border border-[#242f3d]/80 relative overflow-hidden animate-pop-in z-10">
        {/* Top Header */}
        <div className="flex items-center gap-1.5 text-xs text-[#5288c1] mb-6 font-semibold">
          <Shield size={14} />
          <span>Входящий звонок PRITONN</span>
        </div>

        {/* Caller Avatar with Pulsing Ring */}
        <div className="relative mb-5">
          <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="absolute -inset-1 rounded-full bg-[#5288c1]/30 animate-pulse" />
          <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-[#5288c1] shadow-2xl">
            <img
              src={getAvatarUrl(callerAvatar, callerName)}
              onError={(e) => handleAvatarError(e, callerName)}
              alt={callerName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="font-bold text-xl text-center flex items-center gap-1.5 mb-1 text-white">
          <span>{callerName}</span>
          {(callerVerified || callerUsername?.toLowerCase() === 'admin') && <TelegramVerifiedBadge size={17} />}
        </h3>
        <p className="text-xs text-emerald-400 font-medium animate-pulse mb-8 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Входящий защищённый вызов...</span>
        </p>

        {/* Action Buttons: Accept / Decline */}
        <div className="flex items-center justify-center gap-14 w-full">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transform hover:scale-110 active:scale-95 transition cursor-pointer"
              title="Отклонить"
            >
              <PhoneOff size={26} />
            </button>
            <span className="text-xs text-[#7f91a4] font-medium">Отклонить</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transform hover:scale-110 active:scale-95 transition animate-bounce cursor-pointer"
              title="Принять вызов"
            >
              <Phone size={26} />
            </button>
            <span className="text-xs text-emerald-400 font-bold">Ответить</span>
          </div>
        </div>
      </div>
    </div>
  );
};
