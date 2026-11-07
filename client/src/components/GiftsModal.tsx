import React, { useState } from 'react';
import { X, Sparkles, Send, Gift, Star, Check } from 'lucide-react';
import { User } from '../types';

export interface GiftItem {
  id: string;
  title: string;
  price: number;
  icon: string;
  description: string;
  color: string;
}

export const AVAILABLE_GIFTS: GiftItem[] = [
  {
    id: 'crown',
    title: 'Корона Власти',
    price: 100,
    icon: '👑',
    description: 'Символ абсолютного лидерства и уважения',
    color: 'from-amber-500 to-yellow-300',
  },
  {
    id: 'rocket',
    title: 'Космическая Ракета',
    price: 75,
    icon: '🚀',
    description: 'Только вперёд и к новым высотам!',
    color: 'from-rose-500 to-orange-400',
  },
  {
    id: 'diamond',
    title: 'Алмазный Кристалл',
    price: 50,
    icon: '💎',
    description: 'Чистый блеск и премиальная роскошь',
    color: 'from-cyan-400 to-blue-500',
  },
  {
    id: 'supercar',
    title: 'Спорткар CyberGT',
    price: 150,
    icon: '🏎️',
    description: 'Бешеная скорость, стиль и мощь',
    color: 'from-red-600 to-amber-500',
  },
  {
    id: 'cake',
    title: 'Праздничный Торт',
    price: 25,
    icon: '🎂',
    description: 'Сладкое и душевное поздравление',
    color: 'from-pink-500 to-rose-300',
  },
  {
    id: 'lightning',
    title: 'Неоновая Молния',
    price: 40,
    icon: '⚡',
    description: 'Чистый драйв и неукротимая энергия',
    color: 'from-amber-400 to-emerald-400',
  },
  {
    id: 'rose',
    title: 'Золотая Роза',
    price: 30,
    icon: '🌹',
    description: 'Знак особого внимания и симпатии',
    color: 'from-rose-600 to-pink-400',
  },
  {
    id: 'cup',
    title: 'Кубок Чемпиона',
    price: 80,
    icon: '🏆',
    description: 'Настоящему победителю по жизни',
    color: 'from-yellow-400 to-amber-600',
  },
];

interface GiftsModalProps {
  isOpen: boolean;
  targetUser: User;
  currentUser: User;
  onClose: () => void;
  onSendGift: (gift: GiftItem, message?: string) => void;
  onTopUpStars?: (amount: number) => void;
}

export const GiftsModal: React.FC<GiftsModalProps> = ({
  isOpen,
  targetUser,
  currentUser,
  onClose,
  onSendGift,
  onTopUpStars,
}) => {
  const [selectedGift, setSelectedGift] = useState<GiftItem>(AVAILABLE_GIFTS[0]);
  const [giftMessage, setGiftMessage] = useState('');
  const [starsBalance, setStarsBalance] = useState<number>(() => currentUser.starsBalance ?? 350);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = () => {
    if (starsBalance < selectedGift.price) {
      if (onTopUpStars) onTopUpStars(100);
      setStarsBalance((prev) => prev + 100);
      return;
    }
    const newBal = starsBalance - selectedGift.price;
    setStarsBalance(newBal);
    onSendGift(selectedGift, giftMessage.trim());
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1400);
  };

  const handleAddStars = () => {
    const added = 200;
    setStarsBalance((prev) => prev + added);
    if (onTopUpStars) onTopUpStars(added);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 select-none animate-in fade-in duration-200">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-md rounded-3xl shadow-2xl border border-[var(--tg-card-border)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[var(--tg-accent)]/20 via-amber-500/15 to-transparent border-b border-[var(--tg-card-border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg shadow-sm">
              <Gift size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight text-[var(--tg-text)]">
                Подарок для {targetUser.name}
              </h3>
              <div className="text-[10px] text-[var(--tg-text-muted)] flex items-center gap-1 mt-0.5">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                <span>Баланс: <strong className="text-amber-400 font-bold">{starsBalance} Stars</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddStars}
              className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 px-2 py-1 rounded-xl font-bold cursor-pointer transition active:scale-95 flex items-center gap-1"
              title="Пополнить баланс Stars"
            >
              <Star size={10} className="fill-current" />
              <span>+200 ⭐</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] hover:bg-[var(--tg-surface-hover)] transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Gift Grid */}
        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-4 gap-2">
            {AVAILABLE_GIFTS.map((gift) => {
              const isSelected = selectedGift.id === gift.id;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => setSelectedGift(gift)}
                  className={`p-2 rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-2 border-amber-400 bg-amber-500/15 scale-105 shadow-lg'
                      : 'border border-[var(--tg-card-border)] bg-[var(--tg-sidebar)]/60 hover:bg-[var(--tg-surface-hover)]'
                  }`}
                >
                  <span className="text-3xl mb-1 filter drop-shadow">{gift.icon}</span>
                  <span className="text-[11px] font-bold text-[var(--tg-text)] truncate w-full">
                    {gift.title}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-0.5 mt-0.5">
                    <Star size={9} className="fill-current" />
                    <span>{gift.price}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Gift Preview Card */}
          <div className="p-3.5 rounded-2xl bg-[var(--tg-sidebar)]/80 border border-[var(--tg-card-border)] flex items-center gap-3.5 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-3xl shadow-inner flex-shrink-0 animate-bounce">
              {selectedGift.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm text-[var(--tg-text)] truncate">
                  {selectedGift.title}
                </div>
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Star size={12} className="fill-current" />
                  <span>{selectedGift.price} Stars</span>
                </div>
              </div>
              <div className="text-[11px] text-[var(--tg-text-muted)] mt-0.5 leading-snug">
                {selectedGift.description}
              </div>
            </div>
          </div>

          {/* Optional Gift Note */}
          <div>
            <label className="text-[11px] font-semibold text-[var(--tg-text-muted)] block mb-1">
              Личное пожелание (отобразится в профиле):
            </label>
            <input
              type="text"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder="Например: С днём рождения! Удачи во всём! 🚀"
              maxLength={120}
              className="w-full bg-[var(--tg-sidebar)] border border-[var(--tg-card-border)] focus:border-[var(--tg-border-accent)] rounded-xl px-3 py-2 text-xs text-[var(--tg-text)] placeholder-[var(--tg-text-muted)] outline-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--tg-card-border)] bg-[var(--tg-sidebar)]/50 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[var(--tg-text-muted)]">
            К списанию: <span className="text-amber-400 font-bold">{selectedGift.price} ⭐</span>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSuccess}
            className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-md active:scale-95 ${
              isSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white'
            }`}
          >
            {isSuccess ? (
              <>
                <Check size={16} />
                <span>Подарок отправлен!</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Отправить подарок</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
