import React, { useState } from 'react';
import { X, Plus, Trash2, HelpCircle, CheckSquare, BarChart2 } from 'lucide-react';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pollData: {
    question: string;
    options: string[];
    isAnonymous: boolean;
    multipleAnswers: boolean;
    isQuiz: boolean;
    correctOptionIndex?: number;
  }) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number>(0);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
      if (correctOptionIndex >= index && correctOptionIndex > 0) {
        setCorrectOptionIndex(correctOptionIndex - 1);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) return;

    onSubmit({
      question: question.trim(),
      options: cleanOptions,
      isAnonymous,
      multipleAnswers: isQuiz ? false : multipleAnswers,
      isQuiz,
      correctOptionIndex: isQuiz ? correctOptionIndex : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="w-full max-w-md bg-[#17212b] text-[#f5f5f5] rounded-3xl p-6 shadow-2xl border border-[#242f3d] animate-pop-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242f3d] mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 size={20} className="text-[#5288c1]" />
            <h3 className="font-bold text-base">Новый опрос</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Question input */}
          <div>
            <label className="block text-xs font-semibold text-[#7f91a4] mb-1.5 uppercase">
              Вопрос
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Задайте вопрос..."
              className="w-full bg-[#0e1621] border border-[#242f3d] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#7f91a4] outline-none focus:border-[#5288c1]"
              required
            />
          </div>

          {/* Options */}
          <div>
            <label className="block text-xs font-semibold text-[#7f91a4] mb-1.5 uppercase">
              Варианты ответа (от 2 до 8)
            </label>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  {isQuiz && (
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOptionIndex === i}
                      onChange={() => setCorrectOptionIndex(i)}
                      className="accent-emerald-500 cursor-pointer"
                      title="Отметить как правильный ответ"
                    />
                  )}
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    placeholder={`Вариант ${i + 1}`}
                    className="flex-1 bg-[#0e1621] border border-[#242f3d] rounded-xl px-3 py-2 text-xs text-white placeholder-[#7f91a4] outline-none focus:border-[#5288c1]"
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="text-[#7f91a4] hover:text-rose-400 p-1.5"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs text-[#5288c1] hover:underline flex items-center gap-1 font-medium"
              >
                <Plus size={14} /> Добавить вариант
              </button>
            )}
          </div>

          {/* Settings toggles */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#242f3d] text-xs">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[#f5f5f5]">Анонимное голосование</span>
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="accent-[#5288c1] w-4 h-4 rounded cursor-pointer"
              />
            </label>

            {!isQuiz && (
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-[#f5f5f5]">Выбор нескольких ответов</span>
                <input
                  type="checkbox"
                  checked={multipleAnswers}
                  onChange={(e) => setMultipleAnswers(e.target.checked)}
                  className="accent-[#5288c1] w-4 h-4 rounded cursor-pointer"
                />
              </label>
            )}

            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-1.5">
                <span className="text-[#f5f5f5]">Режим викторины</span>
                <span className="text-[10px] text-amber-400">(1 правильный ответ)</span>
              </div>
              <input
                type="checkbox"
                checked={isQuiz}
                onChange={(e) => {
                  setIsQuiz(e.target.checked);
                  if (e.target.checked) setMultipleAnswers(false);
                }}
                className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#242f3d]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#7f91a4] hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#5288c1] hover:bg-[#6499d3] text-white text-xs font-semibold shadow-md transition"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
