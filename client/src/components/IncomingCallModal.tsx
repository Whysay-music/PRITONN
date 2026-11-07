import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Shield } from 'lucide-react';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="w-full max-w-sm bg-[#17212b] text-[#f5f5f5] rounded-3xl p-6 shadow-2xl flex flex-col items-center border border-[#242f3d] relative overflow-hidden animate-pop-in">
        {/* Top Header */}
        <div className="flex items-center gap-1.5 text-xs text-[#5288c1] mb-6">
          <Shield size={14} />
          <span>Входящий звонок Telegram</span>
        </div>

        {/* Caller Avatar with Pulsing Ring */}
        <div className="relative mb-5">
          <div className="absolute inset-0 rounded-full bg-[#5288c1]/30 animate-ping" />
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-[#5288c1] shadow-2xl">
            <img
              src={callerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
              alt={callerName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="font-bold text-lg text-center flex items-center gap-1.5 mb-1">
          <span>{callerName}</span>
          {callerUsername?.toLowerCase() === 'admin' && <TelegramVerifiedBadge size={16} />}
        </h3>
        <p className="text-xs text-[#5288c1] animate-pulse mb-8">
          Входящий аудиозвонок...
        </p>

        {/* Action Buttons: Accept / Decline */}
        <div className="flex items-center justify-center gap-12 w-full">
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleDecline}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition"
              title="Отклонить"
            >
              <PhoneOff size={24} />
            </button>
            <span className="text-[11px] text-[#7f91a4]">Отклонить</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg transform hover:scale-110 active:scale-95 transition animate-bounce"
              title="Принять"
            >
              <Phone size={24} />
            </button>
            <span className="text-[11px] text-emerald-400 font-medium">Ответить</span>
          </div>
        </div>
      </div>
    </div>
  );
};
