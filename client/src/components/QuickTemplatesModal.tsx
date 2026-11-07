import React, { useState } from 'react';
import { X, Zap, Plus, Trash2, Send } from 'lucide-react';

interface QuickTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (text: string) => void;
}

const DEFAULT_TEMPLATES = [
  '👍 Принято, сейчас сделаю!',
  '📞 Перезвоню через пару минут.',
  '👋 Привет! Как твои дела?',
  '🚀 Работаем в штатном режиме, всё готово.',
  '🎮 Заходи играть в кости и Mini Apps!',
  '☕ Буду на связи через полчаса.',
  '🤝 Отличная идея, поддерживаю!',
  '✅ Ссылка и файлы проверены, спасибо.',
];

export const QuickTemplatesModal: React.FC<QuickTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [templates, setTemplates] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('pritonn_quick_templates');
      return raw ? JSON.parse(raw) : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  });

  const [newTemplate, setNewTemplate] = useState('');

  if (!isOpen) return null;

  const saveTemplates = (newItems: string[]) => {
    setTemplates(newItems);
    try {
      localStorage.setItem('pritonn_quick_templates', JSON.stringify(newItems));
    } catch {}
  };

  const handleAdd = () => {
    if (!newTemplate.trim()) return;
    const updated = [newTemplate.trim(), ...templates];
    saveTemplates(updated);
    setNewTemplate('');
  };

  const handleDelete = (index: number) => {
    const updated = templates.filter((_, i) => i !== index);
    saveTemplates(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 select-none animate-in fade-in duration-150">
      <div className="bg-[var(--tg-surface)] text-[var(--tg-text)] w-full max-w-sm rounded-3xl shadow-2xl border border-[var(--tg-card-border)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-3.5 bg-[var(--tg-sidebar)]/80 border-b border-[var(--tg-card-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Zap size={16} />
            </div>
            <div>
              <h3 className="font-bold text-xs text-[var(--tg-text)]">Быстрые ответы</h3>
              <div className="text-[10px] text-[var(--tg-text-muted)]">Нажмите для мгновенной отправки</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Add new template bar */}
        <div className="p-3 border-b border-[var(--tg-card-border)] flex items-center gap-2 bg-[var(--tg-sidebar)]/30">
          <input
            type="text"
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Добавить свой шаблон..."
            className="flex-1 bg-[var(--tg-surface)] border border-[var(--tg-card-border)] focus:border-[var(--tg-border-accent)] rounded-xl px-2.5 py-1.5 text-xs text-[var(--tg-text)] outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="p-2 bg-[var(--tg-accent)] hover:bg-[var(--tg-accent-hover)] text-white rounded-xl transition cursor-pointer"
            title="Добавить шаблон"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Templates list */}
        <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto no-scrollbar">
          {templates.map((tpl, idx) => (
            <div
              key={idx}
              className="group flex items-center justify-between p-2.5 rounded-2xl bg-[var(--tg-sidebar)]/60 hover:bg-[var(--tg-surface-hover)] border border-[var(--tg-card-border)] hover:border-[var(--tg-border-accent)]/50 transition cursor-pointer"
              onClick={() => {
                onSelectTemplate(tpl);
                onClose();
              }}
            >
              <span className="text-xs text-[var(--tg-text)] font-medium leading-snug truncate pr-2">
                {tpl}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(idx);
                  }}
                  className="p-1 text-rose-400 hover:text-rose-300 rounded-lg"
                  title="Удалить шаблон"
                >
                  <Trash2 size={13} />
                </button>
                <div className="p-1 text-[#5288c1]">
                  <Send size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
