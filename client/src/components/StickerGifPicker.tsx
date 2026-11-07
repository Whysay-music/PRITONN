import React, { useState } from 'react';
import { Search, X, Sparkles, Flame, Smile, Heart, ThumbsUp, PartyPopper } from 'lucide-react';

interface StickerGifPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (url: string) => void;
  onSelectGif: (url: string) => void;
}

// Curated high quality animated vector stickers and GIFs
const STICKER_PACKS = [
  {
    name: '🐱 Котята',
    stickers: [
      'https://media.tenor.com/264p-GzM3jEAAAAM/cat-dance.gif',
      'https://media.tenor.com/T0bC0L7Q-JIAAAAM/cat-vibe.gif',
      'https://media.tenor.com/wA0C4T_45KkAAAAM/happy-cat.gif',
      'https://media.tenor.com/Z4c9r1s05gMAAAAM/cat-hug.gif',
      'https://media.tenor.com/j1bFjJ4hN58AAAAM/cute-cat.gif',
      'https://media.tenor.com/gK9xZ_N94HAAAAAM/cat-nod.gif',
    ],
  },
  {
    name: '🐸 Мемы и Пепе',
    stickers: [
      'https://media.tenor.com/7P5h_n5L018AAAAM/pepe-dance.gif',
      'https://media.tenor.com/8QzQ5rV2n7IAAAAM/pepe-hype.gif',
      'https://media.tenor.com/tC4s7H7yK6wAAAAM/pepe-clap.gif',
      'https://media.tenor.com/qLq3m6F-0WAAAAAM/pepe-heart.gif',
      'https://media.tenor.com/pZzYvYyB5xIAAAAM/pepe-coffee.gif',
      'https://media.tenor.com/n6tF8C3xQG4AAAAM/pepe-cool.gif',
    ],
  },
  {
    name: '🦆 Телеграм Утята',
    stickers: [
      'https://media.tenor.com/jQ1v9Z3r_wAAAAAM/duck-dance.gif',
      'https://media.tenor.com/1gH_V7p6m0AAAAAM/duck-vibing.gif',
      'https://media.tenor.com/k9b6Q7k53qUAAAAM/duck-happy.gif',
      'https://media.tenor.com/3_4Pz2z0NzkAAAAM/duck-walk.gif',
      'https://media.tenor.com/4qN0H7yB2JkAAAAM/duck-heart.gif',
      'https://media.tenor.com/lM3N4p9Q1kMAAAAM/duck-cool.gif',
    ],
  },
];

const GIF_CATEGORIES = [
  { label: 'Все', query: '' },
  { label: '🔥 Огонь', query: 'fire' },
  { label: '😂 Смех', query: 'laugh' },
  { label: '❤️ Любовь', query: 'love' },
  { label: '🎉 Праздник', query: 'party' },
  { label: '💃 Танцы', query: 'dance' },
  { label: '😱 Шок', query: 'shock' },
  { label: '👍 Класс', query: 'thumbs up' },
  { label: '🐱 Котики', query: 'cat' },
];

const POPULAR_GIFS = [
  { url: 'https://media.tenor.com/gO_j6w6KkPAAAAAM/party-parrot.gif', tag: 'party' },
  { url: 'https://media.tenor.com/T0bC0L7Q-JIAAAAM/cat-vibe.gif', tag: 'dance' },
  { url: 'https://media.tenor.com/k9b6Q7k53qUAAAAM/duck-happy.gif', tag: 'party' },
  { url: 'https://media.tenor.com/8QzQ5rV2n7IAAAAM/pepe-hype.gif', tag: 'fire' },
  { url: 'https://media.tenor.com/Z4c9r1s05gMAAAAM/cat-hug.gif', tag: 'love' },
  { url: 'https://media.tenor.com/7P5h_n5L018AAAAM/pepe-dance.gif', tag: 'dance' },
  { url: 'https://media.tenor.com/wA0C4T_45KkAAAAM/happy-cat.gif', tag: 'laugh' },
  { url: 'https://media.tenor.com/tC4s7H7yK6wAAAAM/pepe-clap.gif', tag: 'thumbs up' },
  { url: 'https://media.tenor.com/qLq3m6F-0WAAAAAM/pepe-heart.gif', tag: 'love' },
  { url: 'https://media.tenor.com/264p-GzM3jEAAAAM/cat-dance.gif', tag: 'cat' },
  { url: 'https://media.tenor.com/j1bFjJ4hN58AAAAM/cute-cat.gif', tag: 'cat' },
  { url: 'https://media.tenor.com/1gH_V7p6m0AAAAAM/duck-vibing.gif', tag: 'dance' },
];

export const StickerGifPicker: React.FC<StickerGifPickerProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
  onSelectGif,
}) => {
  const [activeTab, setActiveTab] = useState<'stickers' | 'gifs'>('stickers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGifCategory, setSelectedGifCategory] = useState('');

  if (!isOpen) return null;

  const filteredGifs = POPULAR_GIFS.filter((g) => {
    if (selectedGifCategory && g.tag !== selectedGifCategory) return false;
    if (searchQuery.trim() && !g.tag.includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="absolute bottom-16 right-4 sm:right-16 z-50 w-80 sm:w-96 bg-[var(--tg-surface)] text-[var(--tg-text)] rounded-2xl shadow-2xl border border-[var(--tg-border)] flex flex-col overflow-hidden animate-pop-in h-96 select-none">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1 border-b border-[var(--tg-border)] bg-[var(--tg-header-bg)]/50 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('stickers')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'stickers'
                ? 'bg-[#3390ec] text-white shadow-sm'
                : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)]'
            }`}
          >
            <Sparkles size={14} />
            <span>Стикеры</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gifs')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'gifs'
                ? 'bg-[#3390ec] text-white shadow-sm'
                : 'text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)]'
            }`}
          >
            <Flame size={14} />
            <span>GIF</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] transition cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'stickers' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {STICKER_PACKS.map((pack) => (
            <div key={pack.name}>
              <div className="text-xs font-bold text-[var(--tg-text-muted)] mb-2 px-1">
                {pack.name}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {pack.stickers.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectSticker(url);
                      onClose();
                    }}
                    className="p-1.5 rounded-xl hover:bg-[var(--tg-surface-hover)] hover:scale-105 active:scale-95 transition cursor-pointer flex items-center justify-center bg-black/10 dark:bg-white/5 aspect-square"
                  >
                    <img
                      src={url}
                      alt="Sticker"
                      className="w-full h-full object-contain rounded-lg"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="p-2 border-b border-[var(--tg-border)] flex items-center gap-2">
            <div className="flex-1 flex items-center bg-[var(--tg-surface-hover)] px-2.5 py-1.5 rounded-xl border border-transparent focus-within:border-[#3390ec]">
              <Search size={14} className="text-[var(--tg-text-muted)] mr-1.5" />
              <input
                type="text"
                placeholder="Поиск GIF анимаций..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-[var(--tg-text)] outline-none placeholder-[var(--tg-text-muted)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Quick Categories Pills */}
          <div className="flex items-center gap-1 overflow-x-auto p-2 border-b border-[var(--tg-border)] no-scrollbar flex-shrink-0">
            {GIF_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setSelectedGifCategory(cat.query)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedGifCategory === cat.query
                    ? 'bg-[#3390ec] text-white shadow-sm'
                    : 'bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-[var(--tg-text)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* GIF Grid */}
          <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 custom-scrollbar">
            {filteredGifs.map((gif, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectGif(gif.url);
                  onClose();
                }}
                className="relative rounded-xl overflow-hidden group hover:scale-[1.02] active:scale-95 transition cursor-pointer bg-black/10 dark:bg-white/5 aspect-video"
              >
                <img
                  src={gif.url}
                  alt="GIF"
                  className="w-full h-full object-cover rounded-xl"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                  Отправить
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
