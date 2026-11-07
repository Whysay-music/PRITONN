import React, { useState } from 'react';
import { Trophy, RotateCcw, Sparkles } from 'lucide-react';
import { User } from '../types';

interface TicTacToeGameProps {
  gameData?: {
    type: 'tictactoe';
    board: (string | null)[];
    turn: string;
    winner?: string | null;
    playerX: { id: string; name: string };
    playerO?: { id: string; name: string };
  };
  currentUser: User;
  isOutgoing: boolean;
  onMove?: (newBoard: (string | null)[], winner: string | null) => void;
}

export const TicTacToeGame: React.FC<TicTacToeGameProps> = ({
  gameData,
  currentUser,
  isOutgoing,
  onMove,
}) => {
  // Local state for instant responsiveness
  const [board, setBoard] = useState<(string | null)[]>(
    gameData?.board || Array(9).fill(null)
  );
  const [turn, setTurn] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<string | null>(gameData?.winner || null);

  const checkWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every((sq) => sq !== null)) {
      return 'draw';
    }
    return null;
  };

  const handleClick = (index: number) => {
    if (board[index] || winner) return;

    const nextBoard = [...board];
    nextBoard[index] = turn;
    setBoard(nextBoard);

    const winResult = checkWinner(nextBoard);
    if (winResult) {
      setWinner(winResult);
    } else {
      setTurn(turn === 'X' ? 'O' : 'X');
    }

    if (onMove) {
      onMove(nextBoard, winResult);
    }
  };

  const handleReset = () => {
    const cleanBoard = Array(9).fill(null);
    setBoard(cleanBoard);
    setTurn('X');
    setWinner(null);
    if (onMove) {
      onMove(cleanBoard, null);
    }
  };

  return (
    <div className="flex flex-col items-center p-3 rounded-2xl bg-black/20 dark:bg-white/5 border border-white/10 my-1 max-w-[240px] select-none">
      {/* Game Title & Status */}
      <div className="flex items-center justify-between w-full mb-2">
        <span className="text-xs font-bold flex items-center gap-1 text-[#3390ec] dark:text-blue-300">
          <Sparkles size={13} />
          <span>Крестики-нолики</span>
        </span>
        {winner ? (
          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
            <Trophy size={12} />
            {winner === 'draw' ? 'Ничья!' : `Победа ${winner}!`}
          </span>
        ) : (
          <span className="text-[10px] text-[var(--tg-text-muted)] font-medium">
            Ход: <b className="text-white">{turn}</b>
          </span>
        )}
      </div>

      {/* 3x3 Grid */}
      <div className="grid grid-cols-3 gap-1.5 w-48 h-48 bg-black/30 p-2 rounded-xl border border-white/5 shadow-inner">
        {board.map((cell, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleClick(idx)}
            disabled={!!cell || !!winner}
            className={`w-full h-full rounded-lg text-2xl font-black flex items-center justify-center transition-all ${
              cell === 'X'
                ? 'text-[#3390ec] bg-blue-500/10 shadow-sm'
                : cell === 'O'
                ? 'text-rose-400 bg-rose-500/10 shadow-sm'
                : 'hover:bg-white/10 active:scale-95 bg-white/5'
            }`}
          >
            {cell}
          </button>
        ))}
      </div>

      {/* Replay button when finished */}
      {winner && (
        <button
          type="button"
          onClick={handleReset}
          className="mt-2.5 px-3 py-1 bg-[#3390ec] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow cursor-pointer active:scale-95"
        >
          <RotateCcw size={12} />
          <span>Сыграть ещё</span>
        </button>
      )}
    </div>
  );
};
