import React from 'react';
import { X, Check } from 'lucide-react';

interface EmojiStatusOption {
  emoji: string;
  label: string;
  color: string;
}

export const EMOJI_STATUS_OPTIONS: EmojiStatusOption[] = [
  { emoji: '🔥', label: 'На связи', color: 'from-orange-500 to-amber-500' },
  { emoji: '🎮', label: 'В игре', color: 'from-purple-500 to-indigo-600' },
  { emoji: '🎧', label: 'Слушает трек', color: 'from-cyan-500 to-blue-600' },
  { emoji: '💻', label: 'Кодит', color: 'from-emerald-500 to-teal-600' },
  { emoji: '💎', label: 'PRITONN VIP', color: 'from-sky-400 to-blue-500' },
  { emoji: '🚀', label: 'В полёте', color: 'from-rose-500 to-red-600' },
  { emoji: '👑', label: 'Создатель', color: 'from-amber-400 to-yellow-500' },
  { emoji: '⚡', label: 'Энергичен', color: 'from-yellow-400 to-amber-500' },
  { emoji: '💤', label: 'Спит', color: 'from-indigo-400 to-slate-600' },
  { emoji: '☕', label: 'Кофе-брейк', color: 'from-amber-700 to-orange-800' },
  { emoji: '🍕', label: 'Обед', color: 'from-red-500 to-orange-500' },
  { emoji: '🏆', label: 'Победитель', color: 'from-yellow-500 to-amber-600' },
];

interface EmojiStatusPickerModalProps {
  isOpen: boolean;
  currentStatus?: string;
  onClose: () => void;
  onSelectStatus: (emoji: string | undefined) => void;
}

export const EmojiStatusPickerModal: React.FC<EmojiStatusPickerModalProps> = ({
  isOpen,
  currentStatus,
  onClose,
  onSelectStatus,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[var(--tg-sidebar)] rounded-3xl border border-[var(--tg-card-border)] shadow-2xl overflow-hidden flex flex-col text-[var(--tg-text)]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--tg-card-border)] flex items-center justify-between bg-[var(--tg-surface)]/60">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-bold text-sm">Выбрать эмодзи-статус</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--tg-surface-hover)] text-[var(--tg-text-muted)] hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Grid */}
        <div className="p-4 grid grid-cols-2 gap-2 max-h-80 overflow-y-auto no-scrollbar">
          {EMOJI_STATUS_OPTIONS.map((item) => {
            const isSelected = currentStatus === item.emoji;
            return (
              <button
                key={item.emoji}
                type="button"
                onClick={() => {
                  onSelectStatus(isSelected ? undefined : item.emoji);
                  onClose();
                }}
                className={`p-3 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer group ${
                  isSelected
                    ? 'border-[var(--tg-border-accent)] bg-[var(--tg-surface-hover)] shadow-md ring-1 ring-[var(--tg-border-accent)]'
                    : 'border-[var(--tg-card-border)] bg-[var(--tg-surface)]/50 hover:bg-[var(--tg-surface)] hover:border-[var(--tg-border-accent)]/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl group-hover:scale-110 transition-transform">
                    {item.emoji}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold leading-tight">{item.label}</span>
                  </div>
                </div>
                {isSelected && <Check size={14} className="text-[var(--tg-border-accent)]" />}
              </button>
            );
          })}
        </div>

        {/* Clear Status Button */}
        {currentStatus && (
          <div className="p-3 border-t border-[var(--tg-card-border)] bg-[var(--tg-surface)]/40 flex justify-center">
            <button
              type="button"
              onClick={() => {
                onSelectStatus(undefined);
                onClose();
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer py-1 px-3 rounded-lg hover:bg-rose-500/10 transition"
            >
              Сбросить текущий статус
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
