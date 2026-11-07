import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';

interface TelegramBurnTimerProps {
  burnSeconds: number;
  messageId: string;
  onBurn: (messageId: string) => void;
}

export const TelegramBurnTimer: React.FC<TelegramBurnTimerProps> = ({
  burnSeconds,
  messageId,
  onBurn,
}) => {
  const [timeLeft, setTimeLeft] = useState(burnSeconds);
  const [isBurningOut, setIsBurningOut] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      setIsBurningOut(true);
      const burnTimeout = setTimeout(() => {
        onBurn(messageId);
      }, 500);
      return () => clearTimeout(burnTimeout);
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, messageId, onBurn]);

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border transition select-none ${
        isBurningOut
          ? 'bg-rose-500 text-white animate-ping'
          : timeLeft <= 3
          ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
          : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
      }`}
      title={`Самоуничтожится через ${timeLeft} сек`}
    >
      <Flame size={11} className={timeLeft <= 3 ? 'text-rose-400 animate-bounce' : 'text-amber-400'} />
      <span>{timeLeft}s</span>
    </div>
  );
};
