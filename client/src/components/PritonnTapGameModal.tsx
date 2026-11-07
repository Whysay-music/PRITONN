import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, Trophy, TrendingUp, Sparkles, ShoppingBag, Check } from 'lucide-react';
import { User } from '../types';
import { API_BASE_URL } from '../config';

interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  value: number;
}

interface PritonnTapGameModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onCoinsUpdated?: (coins: number) => void;
}

export const PritonnTapGameModal: React.FC<PritonnTapGameModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onCoinsUpdated,
}) => {
  const [coins, setCoins] = useState<number>(() => {
    return currentUser.pritonnCoins || Number(localStorage.getItem('pritonn_tap_coins') || '150');
  });
  const [tapPower, setTapPower] = useState<number>(() => {
    return Number(localStorage.getItem('pritonn_tap_power') || '1');
  });
  const [passiveIncome, setPassiveIncome] = useState<number>(() => {
    return Number(localStorage.getItem('pritonn_tap_passive') || '0');
  });
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [isCoinPressed, setIsCoinPressed] = useState(false);
  const [activeTab, setActiveTab] = useState<'game' | 'shop'>('game');

  const nextFloatingIdRef = useRef(1);

  // Passive income generator
  useEffect(() => {
    if (!isOpen || passiveIncome <= 0) return;
    const interval = setInterval(() => {
      setCoins((prev) => {
        const next = prev + passiveIncome;
        localStorage.setItem('pritonn_tap_coins', String(next));
        return next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isOpen, passiveIncome]);

  // Sync coins with server periodically on close or every 10s
  useEffect(() => {
    if (!isOpen) return;
    const syncTimer = setInterval(() => {
      fetch(`${API_BASE_URL}/api/users/${currentUser.id}/coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0 }),
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(syncTimer);
  }, [isOpen, currentUser.id]);

  if (!isOpen) return null;

  const handleCoinTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const gain = tapPower;
    setCoins((prev) => {
      const next = prev + gain;
      localStorage.setItem('pritonn_tap_coins', String(next));
      if (onCoinsUpdated) onCoinsUpdated(next);
      return next;
    });

    const newFloat: FloatingNumber = {
      id: nextFloatingIdRef.current++,
      x,
      y,
      value: gain,
    };
    setFloatingNumbers((prev) => [...prev, newFloat]);
    setTimeout(() => {
      setFloatingNumbers((prev) => prev.filter((f) => f.id !== newFloat.id));
    }, 800);

    setIsCoinPressed(true);
    setTimeout(() => setIsCoinPressed(false), 100);
  };

  const buyUpgrade = (type: 'power' | 'passive', cost: number, boost: number) => {
    if (coins < cost) {
      alert('Недостаточно монет PRITONN!');
      return;
    }

    setCoins((prev) => {
      const next = prev - cost;
      localStorage.setItem('pritonn_tap_coins', String(next));
      return next;
    });

    if (type === 'power') {
      const nextPower = tapPower + boost;
      setTapPower(nextPower);
      localStorage.setItem('pritonn_tap_power', String(nextPower));
    } else {
      const nextPassive = passiveIncome + boost;
      setPassiveIncome(nextPassive);
      localStorage.setItem('pritonn_tap_passive', String(nextPassive));
    }
  };

  const getRank = (c: number) => {
    if (c > 5000) return { title: '👑 PRITONN Lord', color: 'text-amber-400' };
    if (c > 2000) return { title: '💎 Платина', color: 'text-sky-400' };
    if (c > 1000) return { title: '🥇 Золото', color: 'text-yellow-400' };
    if (c > 400) return { title: '🥈 Серебро', color: 'text-slate-300' };
    return { title: '🥉 Новичок', color: 'text-amber-600' };
  };

  const rank = getRank(coins);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm h-[680px] max-h-[92vh] bg-gradient-to-b from-[#131b26] via-[#0d141e] to-[#070b10] rounded-3xl border border-[var(--tg-card-border)] shadow-2xl overflow-hidden flex flex-col text-white relative">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between z-10 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪙</span>
            <div>
              <h3 className="font-bold text-sm leading-tight">PRITONN Tap & Farm</h3>
              <p className="text-[10px] text-white/60">Официальная Mini App игра</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/15 text-white/70 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 z-10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('game')}
            className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'game' ? 'border-b-2 border-amber-400 text-amber-400 bg-white/5' : 'text-white/60 hover:text-white'
            }`}
          >
            <Zap size={14} />
            <span>Майнинг</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-2.5 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'shop' ? 'border-b-2 border-amber-400 text-amber-400 bg-white/5' : 'text-white/60 hover:text-white'
            }`}
          >
            <ShoppingBag size={14} />
            <span>Улучшения</span>
          </button>
        </div>

        {/* Body */}
        {activeTab === 'game' ? (
          <div className="flex-1 flex flex-col items-center justify-between p-6 z-10">
            {/* Balance & Rank */}
            <div className="flex flex-col items-center gap-1 mt-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full bg-white/10 border border-white/15 ${rank.color}`}>
                {rank.title}
              </span>
              <div className="flex items-center gap-2 text-4xl font-extrabold tracking-tight mt-1 text-amber-300 drop-shadow-[0_2px_12px_rgba(251,191,36,0.4)]">
                <span>🪙</span>
                <span>{coins.toLocaleString()}</span>
              </div>
              <span className="text-[11px] text-white/60">
                +{tapPower} за тап • {passiveIncome > 0 ? `+${passiveIncome * 30}/мин пассивно` : 'Авто-доход выключен'}
              </span>
            </div>

            {/* Giant 3D Tappable Coin */}
            <div
              onClick={handleCoinTap}
              onTouchStart={handleCoinTap}
              className={`relative w-56 h-56 rounded-full cursor-pointer transition-transform duration-100 flex items-center justify-center select-none ${
                isCoinPressed ? 'scale-90' : 'hover:scale-105 active:scale-95'
              }`}
            >
              {/* Outer Golden Aura */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 shadow-[0_0_40px_rgba(245,158,11,0.55)] animate-pulse" />
              {/* Inner Metallic Coin */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-b from-yellow-300 via-amber-500 to-yellow-600 border-4 border-yellow-200/80 shadow-inner flex flex-col items-center justify-center">
                <span className="text-6xl drop-shadow-md">👑</span>
                <span className="text-xs font-black tracking-widest text-amber-950 uppercase mt-1">PRITONN</span>
              </div>

              {/* Floating Tap Numbers */}
              {floatingNumbers.map((f) => (
                <span
                  key={f.id}
                  style={{ left: f.x, top: f.y }}
                  className="absolute pointer-events-none font-black text-2xl text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] animate-bounce"
                >
                  +{f.value}
                </span>
              ))}
            </div>

            {/* Hint */}
            <div className="text-center text-xs text-white/60 mb-2">
              Тапайте по монете, копите баланс и открывайте бусты в магазине!
            </div>
          </div>
        ) : (
          /* Upgrades Shop */
          <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-y-auto no-scrollbar z-10 text-xs">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-amber-300">⚡ Турбо-Тап (+1 к клику)</div>
                <div className="text-[11px] text-white/60">Текущая сила: +{tapPower} за тап</div>
              </div>
              <button
                type="button"
                onClick={() => buyUpgrade('power', 100, 1)}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl hover:opacity-90 transition active:scale-95 cursor-pointer shadow"
              >
                100 🪙
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-sky-300">⛏️ Авто-Майнер (+2/сек)</div>
                <div className="text-[11px] text-white/60">Фармит монеты в фоновом режиме</div>
              </div>
              <button
                type="button"
                onClick={() => buyUpgrade('passive', 300, 2)}
                className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:opacity-90 transition active:scale-95 cursor-pointer shadow"
              >
                300 🪙
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-purple-300">🚀 Мега-Буст (+5 к клику)</div>
                <div className="text-[11px] text-white/60">Колоссальный прирост за каждый тап</div>
              </div>
              <button
                type="button"
                onClick={() => buyUpgrade('power', 600, 5)}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-xl hover:opacity-90 transition active:scale-95 cursor-pointer shadow"
              >
                600 🪙
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-emerald-300">🏭 Ферма PRITONN (+8/сек)</div>
                <div className="text-[11px] text-white/60">Сверхбыстрый пассивный доход</div>
              </div>
              <button
                type="button"
                onClick={() => buyUpgrade('passive', 1500, 8)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 transition active:scale-95 cursor-pointer shadow"
              >
                1500 🪙
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
