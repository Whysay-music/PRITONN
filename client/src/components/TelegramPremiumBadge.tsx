import React from 'react';

interface TelegramPremiumBadgeProps {
  size?: number;
  emojiStatus?: string;
}

export const TelegramPremiumBadge: React.FC<TelegramPremiumBadgeProps> = ({
  size = 14,
  emojiStatus,
}) => {
  return (
    <span className="inline-flex items-center gap-1 select-none flex-shrink-0">
      {/* Animated Emoji Status if present */}
      {emojiStatus && (
        <span
          className="inline-flex items-center justify-center text-xs animate-pulse"
          title={`Статус: ${emojiStatus}`}
        >
          {emojiStatus}
        </span>
      )}

      {/* Official Telegram Premium Star Icon */}
      <span
        className="inline-flex items-center justify-center text-amber-400 filter drop-shadow hover:scale-110 transition-transform cursor-pointer"
        style={{ fontSize: `${size}px` }}
        title="Telegram Premium"
      >
        ⭐
      </span>
    </span>
  );
};
