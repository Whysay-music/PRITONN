import React, { useState } from 'react';
import { Clock, X, Calendar, Send } from 'lucide-react';

interface ScheduledMessageModalProps {
  isOpen: boolean;
  messageText: string;
  onClose: () => void;
  onSchedule: (timestamp: number) => void;
}

export const ScheduledMessageModal: React.FC<ScheduledMessageModalProps> = ({
  isOpen,
  messageText,
  onClose,
  onSchedule,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(60);
  const [customDateTime, setCustomDateTime] = useState('');

  if (!isOpen) return null;

  const presets = [
    { label: 'Через 15 минут', min: 15 },
    { label: 'Через 1 час', min: 60 },
    { label: 'Через 3 часа', min: 180 },
    { label: 'Через 8 часов', min: 480 },
    { label: 'Завтра утром (09:00)', min: 'tomorrow_morning' },
  ];

  const handleApply = () => {
    let targetTime = Date.now() + selectedMinutes * 60 * 1000;
    if (customDateTime) {
      const parsed = new Date(customDateTime).getTime();
      if (!isNaN(parsed) && parsed > Date.now()) {
        targetTime = parsed;
      }
    }
    onSchedule(targetTime);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-sm rounded-2xl shadow-2xl border border-[var(--tg-border)] overflow-hidden flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--tg-border)]">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[#3390ec]" />
            <h3 className="font-bold text-sm">Отложенное сообщение</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-[var(--tg-text-muted)] line-clamp-2 italic bg-black/10 dark:bg-white/5 p-2 rounded-xl">
            «{messageText || 'Ваше сообщение'}»
          </p>

          <div className="text-xs font-semibold text-[var(--tg-text-muted)]">Быстрый выбор:</div>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (typeof p.min === 'number') {
                    setSelectedMinutes(p.min);
                    setCustomDateTime('');
                  } else {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(9, 0, 0, 0);
                    setSelectedMinutes(Math.round((tomorrow.getTime() - Date.now()) / 60000));
                    setCustomDateTime('');
                  }
                }}
                className="px-2.5 py-2 rounded-xl bg-[var(--tg-surface-hover)] hover:bg-[#3390ec] hover:text-white transition text-xs font-medium text-left cursor-pointer border border-white/5"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-[var(--tg-border)]">
            <label className="text-[11px] font-medium text-[var(--tg-text-muted)] block mb-1">
              Или точное время:
            </label>
            <input
              type="datetime-local"
              value={customDateTime}
              onChange={(e) => setCustomDateTime(e.target.value)}
              className="w-full bg-[var(--tg-surface-hover)] px-3 py-2 rounded-xl text-xs text-[var(--tg-text)] outline-none border border-transparent focus:border-[#3390ec]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 bg-black/10 dark:bg-white/5 border-t border-[var(--tg-border)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#3390ec] hover:bg-blue-600 text-white transition shadow cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <Send size={13} />
            <span>Запланировать</span>
          </button>
        </div>
      </div>
    </div>
  );
};
