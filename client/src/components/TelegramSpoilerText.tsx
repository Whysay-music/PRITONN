import React, { useState } from 'react';

interface TelegramSpoilerTextProps {
  text: string;
}

export const TelegramSpoilerText: React.FC<TelegramSpoilerTextProps> = ({ text }) => {
  // Check if text has ||spoiler|| syntax
  const parts = text.split(/(\|\|.*?\|\|)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('||') && part.endsWith('||')) {
          const content = part.slice(2, -2);
          return <SpoilerBlock key={index} content={content} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

const SpoilerBlock: React.FC<{ content: string }> = ({ content }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setRevealed(true);
      }}
      className={`relative inline-block cursor-pointer rounded px-1 transition-all ${
        revealed
          ? 'bg-transparent'
          : 'bg-[#2b5278]/80 text-transparent select-none animate-pulse hover:brightness-110'
      }`}
      title={revealed ? '' : 'Спойлер: нажмите, чтобы прочитать'}
      style={
        !revealed
          ? {
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)',
              backgroundSize: '4px 4px',
            }
          : undefined
      }
    >
      <span className={revealed ? 'animate-fade-in' : 'opacity-0'}>
        {content}
      </span>
      {!revealed && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-[11px] text-white/50">
          •••
        </span>
      )}
    </span>
  );
};
