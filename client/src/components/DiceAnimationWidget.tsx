import React, { useState } from 'react';

interface DiceAnimationWidgetProps {
  diceType: 'dice' | 'dart' | 'basket' | 'football' | 'casino';
  value?: number;
  onReroll?: () => void;
}

export const DiceAnimationWidget: React.FC<DiceAnimationWidgetProps> = ({
  diceType,
  value = 6,
  onReroll,
}) => {
  const [isRolling, setIsRolling] = useState(false);
  const [currentVal, setCurrentVal] = useState(value);

  const handleRoll = () => {
    if (isRolling) return;
    setIsRolling(true);
    let frames = 0;
    const interval = setInterval(() => {
      frames++;
      if (diceType === 'casino') {
        setCurrentVal(Math.floor(Math.random() * 64) + 1);
      } else if (diceType === 'basket' || diceType === 'football') {
        setCurrentVal(Math.random() > 0.5 ? 1 : 0);
      } else {
        setCurrentVal(Math.floor(Math.random() * 6) + 1);
      }
      if (frames >= 8) {
        clearInterval(interval);
        setIsRolling(false);
        if (onReroll) onReroll();
      }
    }, 100);
  };

  const getDiceDots = (v: number) => {
    switch (v) {
      case 1:
        return ['col-start-2 row-start-2'];
      case 2:
        return ['col-start-1 row-start-1', 'col-start-3 row-start-3'];
      case 3:
        return ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'];
      case 4:
        return ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'];
      case 5:
        return ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'];
      case 6:
      default:
        return ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'];
    }
  };

  return (
    <div
      onClick={handleRoll}
      className="inline-flex flex-col items-center justify-center p-2 rounded-2xl bg-black/20 hover:bg-black/30 transition cursor-pointer select-none group"
      title="Нажмите, чтобы бросить снова"
    >
      {diceType === 'dice' && (
        <div
          className={`w-16 h-16 bg-white text-zinc-900 rounded-2xl p-2.5 shadow-xl grid grid-cols-3 grid-rows-3 gap-1 border-2 border-zinc-200 transition-transform ${
            isRolling ? 'animate-spin' : 'group-hover:scale-105'
          }`}
        >
          {getDiceDots(currentVal).map((pos, idx) => (
            <div key={idx} className={`w-2.5 h-2.5 bg-rose-500 rounded-full place-self-center shadow-inner ${pos}`} />
          ))}
        </div>
      )}

      {diceType === 'dart' && (
        <div className={`relative w-16 h-16 flex items-center justify-center transition-transform ${isRolling ? 'animate-bounce' : 'group-hover:scale-105'}`}>
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-600 via-rose-600 to-amber-500 flex items-center justify-center shadow-lg border-2 border-white/20">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-white/40">
              <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center text-[10px] text-white font-bold">
                🎯
              </div>
            </div>
          </div>
          <span className="absolute -bottom-1 right-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-black shadow">
            {currentVal}
          </span>
        </div>
      )}

      {diceType === 'basket' && (
        <div className={`w-16 h-16 flex flex-col items-center justify-center transition-transform ${isRolling ? 'animate-bounce' : 'group-hover:scale-105'}`}>
          <div className="text-3xl">🏀</div>
          <span className={`text-[11px] font-bold mt-0.5 ${currentVal === 1 ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {currentVal === 1 ? 'Попадание! 🎯' : 'Мимо...'}
          </span>
        </div>
      )}

      {diceType === 'football' && (
        <div className={`w-16 h-16 flex flex-col items-center justify-center transition-transform ${isRolling ? 'animate-spin' : 'group-hover:scale-105'}`}>
          <div className="text-3xl">⚽</div>
          <span className={`text-[11px] font-bold mt-0.5 ${currentVal === 1 ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {currentVal === 1 ? 'ГОЛ! 🥅' : 'Штанга!'}
          </span>
        </div>
      )}

      {diceType === 'casino' && (
        <div className={`w-24 h-14 bg-zinc-900 border-2 border-amber-500/80 rounded-xl flex items-center justify-around px-2 shadow-xl ${isRolling ? 'animate-pulse' : 'group-hover:scale-105'}`}>
          <div className="text-base font-black text-amber-400 font-mono">
            {currentVal === 64 ? '7' : Math.floor(currentVal / 10) % 7 + 1}
          </div>
          <div className="text-base font-black text-amber-400 font-mono">
            {currentVal === 64 ? '7' : Math.floor(currentVal / 5) % 7 + 1}
          </div>
          <div className="text-base font-black text-amber-400 font-mono">
            {currentVal === 64 ? '7' : currentVal % 7 + 1}
          </div>
          {currentVal === 64 && (
            <span className="absolute -top-2 bg-gradient-to-r from-amber-400 to-rose-500 text-black text-[9px] font-extrabold px-1 rounded shadow">
              JACKPOT!
            </span>
          )}
        </div>
      )}

      <div className="text-[10px] text-white/60 mt-1 font-medium group-hover:text-white transition">
        🎲 Бросить
      </div>
    </div>
  );
};
