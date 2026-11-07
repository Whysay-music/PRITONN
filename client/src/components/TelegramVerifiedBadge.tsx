import React from 'react';

interface TelegramVerifiedBadgeProps {
  size?: number;
  className?: string;
}

// Authentic Telegram Verified Rosette Badge
export const TelegramVerifiedBadge: React.FC<TelegramVerifiedBadgeProps> = ({
  size = 16,
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 align-middle ${className}`}
      title="Подтверждённый аккаунт Telegram"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="flex-shrink-0"
      >
        {/* Telegram 8-point smooth scalloped rosette */}
        <path
          d="M10.12 2.37a2.5 2.5 0 0 1 3.76 0l.4.43c.53.58 1.34.84 2.11.7l.58-.1a2.5 2.5 0 0 1 2.87 2.45v.58c0 .78.47 1.48 1.2 1.77l.55.22a2.5 2.5 0 0 1 1.44 3.25l-.22.54a2 2 0 0 0 0 1.58l.22.54a2.5 2.5 0 0 1-1.44 3.25l-.55.22a2 2 0 0 0-1.2 1.77v.58a2.5 2.5 0 0 1-2.87 2.45l-.58-.1a2 2 0 0 0-2.11.7l-.4.43a2.5 2.5 0 0 1-3.76 0l-.4-.43a2 2 0 0 0-2.11-.7l-.58.1a2.5 2.5 0 0 1-2.87-2.45v-.58a2 2 0 0 0-1.2-1.77l-.55-.22a2.5 2.5 0 0 1-1.44-3.25l.22-.54a2 2 0 0 0 0-1.58l-.22-.54a2.5 2.5 0 0 1 1.44-3.25l.55-.22a2 2 0 0 0 1.2-1.77v-.58a2.5 2.5 0 0 1 2.87-2.45l.58.1a2 2 0 0 0 2.11-.7l.4-.43Z"
          fill="#2481cc"
        />
        {/* Crisp white checkmark */}
        <path
          d="m8.5 12 2.5 2.5 5-5"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
};
