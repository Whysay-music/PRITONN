import React, { useState } from 'react';
import { Smile, Sparkles, Film, Image as ImageIcon } from 'lucide-react';

interface EmojiPickerProps {
  isOpen: boolean;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
  onSelectGif?: (gifUrl: string) => void;
  onClose: () => void;
}

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄',
  '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
  '👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
  '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '🔥', '✨', '⚡', '💥', '🎉', '🎊', '🎈', '🚀', '💯', '💩'
];

const TELEGRAM_STICKERS = [
  {
    name: 'Duck Hello',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f986.png',
  },
  {
    name: 'Party Popper',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f389.png',
  },
  {
    name: 'Fire Star',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png',
  },
  {
    name: 'Rocket',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png',
  },
  {
    name: 'Cool Cat',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f638.png',
  },
  {
    name: 'Love Heart',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f496.png',
  },
  {
    name: 'Diamond',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48e.png',
  },
  {
    name: 'Crown King',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f451.png',
  },
  {
    name: 'Smiling Imp',
    url: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f608.png',
  },
];

const TELEGRAM_GIFS = [
  {
    title: 'Happy Dance',
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
  },
  {
    title: 'Cat Typing Fast',
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  },
  {
    title: 'Popcorn Excitement',
    url: 'https://media.giphy.com/media/t3cL1iXeWEkY8/giphy.gif',
  },
  {
    title: 'Mind Blown',
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  },
  {
    title: 'Success Kid',
    url: 'https://media.giphy.com/media/nXxOjZrbnbRxS/giphy.gif',
  },
  {
    title: 'Applause Cheers',
    url: 'https://media.giphy.com/media/9g8PH1MbwTy4o/giphy.gif',
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  isOpen,
  onSelectEmoji,
  onSelectSticker,
  onSelectGif,
  onClose,
}) => {
  const [tab, setTab] = useState<'emoji' | 'stickers' | 'gif'>('emoji');

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-16 right-4 z-40 w-80 bg-[var(--tg-surface)] border border-[var(--tg-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-pop-in select-none">
      {/* Header Tabs */}
      <div className="flex border-b border-[var(--tg-border)] bg-[var(--tg-sidebar)]">
        <button
          type="button"
          onClick={() => setTab('emoji')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            tab === 'emoji'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
          }`}
        >
          <Smile size={15} />
          <span>Эмодзи</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('stickers')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            tab === 'stickers'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
          }`}
        >
          <Sparkles size={15} />
          <span>Стикеры</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('gif')}
          className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            tab === 'gif'
              ? 'text-blue-400 border-b-2 border-blue-500'
              : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
          }`}
        >
          <Film size={15} />
          <span>GIF</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 h-72 overflow-y-auto">
        {tab === 'emoji' && (
          <div className="grid grid-cols-7 gap-1 text-2xl">
            {EMOJIS.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectEmoji(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--tg-surface-hover)] hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {tab === 'stickers' && (
          <div>
            <div className="text-[11px] text-[var(--tg-text-muted)] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
              <ImageIcon size={13} />
              <span>Официальные стикеры Telegram</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {TELEGRAM_STICKERS.map((stk, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onSelectSticker(stk.url);
                    onClose();
                  }}
                  className="aspect-square rounded-2xl overflow-hidden cursor-pointer hover:scale-110 transition-transform bg-black/10 p-3 flex items-center justify-center border border-white/5"
                  title={stk.name}
                >
                  <img
                    src={stk.url}
                    alt={stk.name}
                    className="w-full h-full object-contain filter drop-shadow-md"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'gif' && (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] text-[var(--tg-text-muted)] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
              <Film size={13} />
              <span>Популярные реакции GIF</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TELEGRAM_GIFS.map((g, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (onSelectGif) onSelectGif(g.url);
                    else onSelectSticker(g.url);
                    onClose();
                  }}
                  className="rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition relative aspect-video bg-black/20"
                >
                  <img
                    src={g.url}
                    alt={g.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] text-white">
                    GIF
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
