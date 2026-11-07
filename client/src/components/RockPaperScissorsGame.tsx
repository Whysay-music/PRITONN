import React, { useState } from 'react';
import { Sparkles, Trophy, RotateCcw } from 'lucide-react';
import { User } from '../types';

export type RPSChoice = 'rock' | 'paper' | 'scissors';

export interface RPSGameData {
  type: 'rps';
  player1: { id: string; name: string; choice?: RPSChoice | null };
  player2?: { id: string; name: string; choice?: RPSChoice | null };
  winnerId?: string | 'draw' | null;
  status: 'waiting' | 'finished';
}

interface RockPaperScissorsGameProps {
  gameData?: RPSGameData;
  currentUser: User;
  isOutgoing: boolean;
  onMove?: (newGameData: RPSGameData) => void;
}

const CHOICE_EMOJIS: Record<RPSChoice, string> = {
  rock: '🪨 Камень',
  paper: '📄 Бумага',
  scissors: '✂️ Ножницы',
};

export const RockPaperScissorsGame: React.FC<RockPaperScissorsGameProps> = ({
  gameData,
  currentUser,
  onMove,
}) => {
  const [data, setData] = useState<RPSGameData>(
    gameData || {
      type: 'rps',
      player1: { id: currentUser.id, name: currentUser.name },
      status: 'waiting',
    }
  );

  const isPlayer1 = currentUser.id === data.player1.id;
  const isPlayer2 = data.player2 ? currentUser.id === data.player2.id : !isPlayer1;

  // Has current user chosen?
  const myChoice = isPlayer1 ? data.player1.choice : data.player2?.choice;
  const opponentChoice = isPlayer1 ? data.player2?.choice : data.player1.choice;

  const calculateWinner = (c1: RPSChoice, c2: RPSChoice, p1Id: string, p2Id: string): string | 'draw' => {
    if (c1 === c2) return 'draw';
    if (
      (c1 === 'rock' && c2 === 'scissors') ||
      (c1 === 'scissors' && c2 === 'paper') ||
      (c1 === 'paper' && c2 === 'rock')
    ) {
      return p1Id;
    }
    return p2Id;
  };

  const handleMakeChoice = (choice: RPSChoice) => {
    if (data.status === 'finished') return;

    let updated: RPSGameData;

    if (isPlayer1) {
      if (data.player1.choice) return;
      updated = {
        ...data,
        player1: { ...data.player1, choice },
      };
      if (updated.player2?.choice) {
        const winner = calculateWinner(choice, updated.player2.choice, data.player1.id, updated.player2.id);
        updated.winnerId = winner;
        updated.status = 'finished';
      }
    } else {
      // Player 2
      const p2 = { id: currentUser.id, name: currentUser.name, choice };
      updated = {
        ...data,
        player2: p2,
      };
      if (data.player1.choice) {
        const winner = calculateWinner(data.player1.choice, choice, data.player1.id, currentUser.id);
        updated.winnerId = winner;
        updated.status = 'finished';
      }
    }

    setData(updated);
    if (onMove) {
      onMove(updated);
    }
  };

  const handlePlayAgain = () => {
    const clean: RPSGameData = {
      type: 'rps',
      player1: { id: currentUser.id, name: currentUser.name, choice: null },
      status: 'waiting',
      winnerId: null,
    };
    setData(clean);
    if (onMove) {
      onMove(clean);
    }
  };

  const isFinished = data.status === 'finished' && data.player1.choice && data.player2?.choice;

  return (
    <div className="flex flex-col p-3 rounded-2xl bg-black/25 dark:bg-white/5 border border-white/10 my-1 max-w-[260px] select-none text-white">
      {/* Game Header */}
      <div className="flex items-center justify-between w-full mb-2.5">
        <span className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
          <Sparkles size={13} />
          <span>Камень, Ножницы, Бумага</span>
        </span>
      </div>

      {/* Battle Display */}
      {isFinished ? (
        <div className="flex flex-col items-center bg-black/40 p-3 rounded-xl border border-white/10 mb-2">
          <div className="flex items-center justify-between w-full text-xs font-medium mb-2 px-1">
            <div className="text-center">
              <p className="text-[10px] text-zinc-400 truncate max-w-[90px]">{data.player1.name}</p>
              <p className="text-lg mt-0.5">{CHOICE_EMOJIS[data.player1.choice!]}</p>
            </div>
            <span className="text-xs font-black text-rose-400 px-2">VS</span>
            <div className="text-center">
              <p className="text-[10px] text-zinc-400 truncate max-w-[90px]">{data.player2?.name}</p>
              <p className="text-lg mt-0.5">{CHOICE_EMOJIS[data.player2!.choice!]}</p>
            </div>
          </div>

          <div className="mt-1 pt-2 border-t border-white/10 w-full text-center">
            {data.winnerId === 'draw' ? (
              <span className="text-xs font-bold text-amber-300">🤝 Ничья! Боевая ничья!</span>
            ) : (
              <span className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                <Trophy size={13} className="text-amber-400" />
                <span>
                  Победил {data.winnerId === currentUser.id ? 'Вы!' : data.winnerId === data.player1.id ? data.player1.name : data.player2?.name}!
                </span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5 mb-2">
          <p className="text-[11px] text-zinc-300 text-center font-medium">
            {myChoice ? '✅ Ваш выбор сделан! Ждём соперника...' : 'Сделайте ваш тайный выбор:'}
          </p>

          {!myChoice && (
            <div className="grid grid-cols-3 gap-1.5">
              {(['rock', 'scissors', 'paper'] as RPSChoice[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleMakeChoice(c)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  <span className="text-xl">
                    {c === 'rock' ? '🪨' : c === 'scissors' ? '✂️' : '📄'}
                  </span>
                  <span className="text-[9px] font-semibold text-zinc-200">
                    {c === 'rock' ? 'Камень' : c === 'scissors' ? 'Ножницы' : 'Бумага'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {myChoice && !isFinished && (
            <div className="text-center py-2">
              <span className="text-xs text-amber-400 font-semibold animate-pulse">
                ⏳ Соперник думает...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Play Again button */}
      {isFinished && (
        <button
          type="button"
          onClick={handlePlayAgain}
          className="w-full py-1.5 bg-[#3390ec] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow cursor-pointer active:scale-95"
        >
          <RotateCcw size={12} />
          <span>Сыграть ещё раунд</span>
        </button>
      )}
    </div>
  );
};
