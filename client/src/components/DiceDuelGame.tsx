import React, { useState } from 'react';
import { Sparkles, Trophy, RotateCcw } from 'lucide-react';
import { User } from '../types';

export interface DiceDuelGameData {
  type: 'diceduel';
  player1: { id: string; name: string; score?: number | null };
  player2?: { id: string; name: string; score?: number | null };
  winnerId?: string | 'draw' | null;
  status: 'waiting' | 'finished';
}

interface DiceDuelGameProps {
  gameData?: DiceDuelGameData;
  currentUser: User;
  isOutgoing: boolean;
  onMove?: (newGameData: DiceDuelGameData) => void;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export const DiceDuelGame: React.FC<DiceDuelGameProps> = ({
  gameData,
  currentUser,
  onMove,
}) => {
  const [data, setData] = useState<DiceDuelGameData>(
    gameData || {
      type: 'diceduel',
      player1: { id: currentUser.id, name: currentUser.name },
      status: 'waiting',
    }
  );
  const [isRolling, setIsRolling] = useState(false);

  const isPlayer1 = currentUser.id === data.player1.id;
  const myScore = isPlayer1 ? data.player1.score : data.player2?.score;

  const handleRoll = () => {
    if (isRolling || myScore != null) return;

    setIsRolling(true);
    setTimeout(() => {
      const roll1 = Math.floor(Math.random() * 6) + 1;
      const roll2 = Math.floor(Math.random() * 6) + 1;
      const totalScore = roll1 + roll2;

      let updated: DiceDuelGameData;

      if (isPlayer1) {
        updated = {
          ...data,
          player1: { ...data.player1, score: totalScore },
        };
        if (updated.player2?.score != null) {
          const s1 = totalScore;
          const s2 = updated.player2.score;
          updated.winnerId = s1 === s2 ? 'draw' : s1 > s2 ? data.player1.id : updated.player2.id;
          updated.status = 'finished';
        }
      } else {
        const p2 = { id: currentUser.id, name: currentUser.name, score: totalScore };
        updated = {
          ...data,
          player2: p2,
        };
        if (data.player1.score != null) {
          const s1 = data.player1.score;
          const s2 = totalScore;
          updated.winnerId = s1 === s2 ? 'draw' : s1 > s2 ? data.player1.id : currentUser.id;
          updated.status = 'finished';
        }
      }

      setIsRolling(false);
      setData(updated);
      if (onMove) {
        onMove(updated);
      }
    }, 600);
  };

  const handlePlayAgain = () => {
    const clean: DiceDuelGameData = {
      type: 'diceduel',
      player1: { id: currentUser.id, name: currentUser.name, score: null },
      status: 'waiting',
      winnerId: null,
    };
    setData(clean);
    if (onMove) {
      onMove(clean);
    }
  };

  const isFinished = data.status === 'finished' && data.player1.score != null && data.player2?.score != null;

  return (
    <div className="flex flex-col p-3 rounded-2xl bg-black/25 dark:bg-white/5 border border-white/10 my-1 max-w-[260px] select-none text-white">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs font-bold flex items-center gap-1.5 text-purple-400">
          <Sparkles size={13} />
          <span>Дуэль на кубиках (2d6)</span>
        </span>
      </div>

      {/* Players & Dice Scores */}
      <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 mb-2">
        <div className="flex items-center justify-between text-xs font-medium px-2">
          <div className="text-center">
            <p className="text-[10px] text-zinc-400 truncate max-w-[90px]">{data.player1.name}</p>
            <div className="text-2xl mt-1 font-black text-amber-400">
              {data.player1.score != null ? data.player1.score : '—'}
            </div>
          </div>
          <span className="text-xs font-black text-rose-400">VS</span>
          <div className="text-center">
            <p className="text-[10px] text-zinc-400 truncate max-w-[90px]">{data.player2?.name || 'Игрок 2'}</p>
            <div className="text-2xl mt-1 font-black text-purple-400">
              {data.player2?.score != null ? data.player2.score : '—'}
            </div>
          </div>
        </div>

        {/* Action Button / Outcome */}
        <div className="mt-2.5 pt-2 border-t border-white/10 text-center">
          {isFinished ? (
            <div>
              {data.winnerId === 'draw' ? (
                <span className="text-xs font-bold text-amber-300">🤝 Ничья! Одинаковый бросок!</span>
              ) : (
                <span className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                  <Trophy size={13} className="text-amber-400" />
                  <span>
                    Победил {data.winnerId === currentUser.id ? 'Вы!' : data.winnerId === data.player1.id ? data.player1.name : data.player2?.name}!
                  </span>
                </span>
              )}
            </div>
          ) : myScore == null ? (
            <button
              type="button"
              disabled={isRolling}
              onClick={handleRoll}
              className={`w-full py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white transition shadow cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ${
                isRolling ? 'animate-pulse' : ''
              }`}
            >
              <span>🎲</span>
              <span>{isRolling ? 'Бросаем кубики...' : 'Бросить 2 кубика'}</span>
            </button>
          ) : (
            <span className="text-xs text-amber-400 font-semibold animate-pulse">
              ⏳ Ждём броска соперника...
            </span>
          )}
        </div>
      </div>

      {isFinished && (
        <button
          type="button"
          onClick={handlePlayAgain}
          className="w-full py-1.5 bg-[#3390ec] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow cursor-pointer active:scale-95"
        >
          <RotateCcw size={12} />
          <span>Бросить вызов снова</span>
        </button>
      )}
    </div>
  );
};
