import React, { useState } from 'react';
import { X, Sparkles, Trophy, Zap, Wallet, MoreVertical } from 'lucide-react';
import { User } from '../types';

interface TelegramMiniAppModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
}

export const TelegramMiniAppModal: React.FC<TelegramMiniAppModalProps> = ({
  isOpen,
  currentUser,
  onClose,
}) => {
  const [stars, setStars] = useState(250);
  const [energy, setEnergy] = useState(100);
  const [activeTab, setActiveTab] = useState<'game' | 'wallet' | 'tasks'>('game');
  const [floatingPoints, setFloatingPoints] = useState<{ id: number; x: number; y: number }[]>([]);

  if (!isOpen) return null;

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (energy < 2) return;
    setStars((prev) => prev + 1);
    setEnergy((prev) => Math.max(0, prev - 2));

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now() + Math.random();

    setFloatingPoints((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setFloatingPoints((prev) => prev.filter((p) => p.id !== id));
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fade-in">
      <div className="w-full max-w-md h-[580px] bg-[#17212b] rounded-3xl shadow-2xl flex flex-col border border-[#242f3d] overflow-hidden text-[#f5f5f5] animate-pop-in">
        {/* Telegram WebApp Header */}
        <div className="h-12 bg-[#0e1621] px-4 flex items-center justify-between border-b border-[#242f3d] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-400 to-rose-500 flex items-center justify-center text-xs font-bold text-black shadow">
              ⭐
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">PRITONN Arcade</div>
              <div className="text-[10px] text-[#5288c1]">бот @ai_assistant</div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#7f91a4]">
            <button className="p-1.5 hover:text-white rounded-lg hover:bg-white/5 transition">
              <MoreVertical size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:text-white rounded-lg hover:bg-white/5 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mini App Content */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 items-center justify-between bg-gradient-to-b from-[#17212b] to-[#0e1621]">
          {activeTab === 'game' && (
            <>
              {/* Balance Card */}
              <div className="flex flex-col items-center mt-2">
                <span className="text-xs text-[#7f91a4] font-medium flex items-center gap-1">
                  <Sparkles size={13} className="text-amber-400" />
                  Баланс PRITONN Stars
                </span>
                <div className="text-4xl font-black text-amber-400 flex items-center gap-2 mt-1 drop-shadow">
                  <span>⭐</span>
                  <span className="font-mono">{stars.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-[#5288c1] bg-[#5288c1]/10 px-2.5 py-0.5 rounded-full mt-1.5 border border-[#5288c1]/20">
                  Ранг: Мастер PRITONN 🏆
                </div>
              </div>

              {/* Tappable Big Star Button */}
              <div
                onClick={handleTap}
                className="relative w-44 h-44 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30 cursor-pointer active:scale-95 transition-transform my-auto border-4 border-amber-300"
              >
                <span className="text-7xl select-none filter drop-shadow">⭐</span>

                {/* Floating Click Numbers */}
                {floatingPoints.map((pt) => (
                  <div
                    key={pt.id}
                    className="absolute text-xl font-black text-amber-200 pointer-events-none animate-float-up drop-shadow"
                    style={{ left: pt.x, top: pt.y }}
                  >
                    +1
                  </div>
                ))}
              </div>

              {/* Energy bar */}
              <div className="w-full max-w-xs mb-2">
                <div className="flex justify-between text-xs text-[#7f91a4] mb-1 font-medium">
                  <span className="flex items-center gap-1 text-amber-400">
                    <Zap size={14} /> Энергия
                  </span>
                  <span>{energy}/100</span>
                </div>
                <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-[#242f3d]">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-200"
                    style={{ width: `${energy}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'wallet' && (
            <div className="w-full flex-1 flex flex-col items-center justify-center text-center p-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 border border-blue-500/30">
                <Wallet size={32} />
              </div>
              <h3 className="font-bold text-lg mb-1">PRITONN Кошелёк (Stars)</h3>
              <p className="text-xs text-[#7f91a4] max-w-xs mb-4">
                Сквозное хранение звёзд в профиле @{currentUser.username}. Доступно: {stars} ⭐
              </p>
              <button
                onClick={() => setStars((s) => s + 50)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg transition"
              >
                Пополнить баланс (+50 ⭐)
              </button>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="w-full flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                Ежедневные задания
              </div>
              {[
                { title: 'Подписаться на канал', reward: '+50 ⭐', done: true },
                { title: 'Пригласить друга в чат', reward: '+100 ⭐', done: false },
                { title: 'Сделать видео-кружочек', reward: '+25 ⭐', done: true },
                { title: 'Позвонить через WebRTC', reward: '+75 ⭐', done: true },
              ].map((task, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#0e1621] border border-[#242f3d]"
                >
                  <span className="text-xs font-medium">{task.title}</span>
                  <span className="text-xs font-bold text-amber-400">{task.reward}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Tab Bar */}
        <div className="h-14 bg-[#0e1621] border-t border-[#242f3d] flex items-center justify-around px-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('game')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
              activeTab === 'game' ? 'text-amber-400' : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            <Trophy size={18} />
            <span>Игра</span>
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
              activeTab === 'wallet' ? 'text-amber-400' : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            <Wallet size={18} />
            <span>Кошелёк</span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex flex-col items-center gap-1 text-[11px] font-medium transition ${
              activeTab === 'tasks' ? 'text-amber-400' : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            <Sparkles size={18} />
            <span>Задания</span>
          </button>
        </div>
      </div>
    </div>
  );
};
