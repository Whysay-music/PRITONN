import React from 'react';
import { Check, CheckCircle2, XCircle, BarChart2 } from 'lucide-react';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // userIds
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  isAnonymous: boolean;
  multipleAnswers: boolean;
  isQuiz: boolean;
  correctOptionIndex?: number;
}

interface TelegramPollWidgetProps {
  poll: PollData;
  currentUserId: string;
  onVote: (pollId: string, optionId: string) => void;
  isOutgoing?: boolean;
}

export const TelegramPollWidget: React.FC<TelegramPollWidgetProps> = ({
  poll,
  currentUserId,
  onVote,
  isOutgoing,
}) => {
  const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);
  const userVotedOptionIds = poll.options
    .filter((opt) => opt.votes.includes(currentUserId))
    .map((opt) => opt.id);
  const hasVoted = userVotedOptionIds.length > 0;

  return (
    <div
      className={`p-3.5 rounded-2xl min-w-[270px] max-w-[360px] select-none ${
        isOutgoing ? 'bg-black/5 dark:bg-blue-600/15' : 'bg-black/5 dark:bg-[#182533]/90'
      } border border-black/5 dark:border-white/5`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#5288c1] font-semibold mb-1">
        <BarChart2 size={13} />
        <span>{poll.isQuiz ? 'Викторина' : poll.isAnonymous ? 'Анонимный опрос' : 'Опрос'}</span>
      </div>

      {/* Question */}
      <h4 className="font-bold text-sm text-[var(--tg-text)] mb-3 leading-snug">
        {poll.question}
      </h4>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {poll.options.map((option, idx) => {
          const isSelected = option.votes.includes(currentUserId);
          const percent = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
          const isCorrect = poll.isQuiz && poll.correctOptionIndex === idx;

          return (
            <div
              key={option.id}
              onClick={() => {
                if (!hasVoted || poll.multipleAnswers) {
                  onVote(poll.id, option.id);
                }
              }}
              className={`relative overflow-hidden rounded-xl p-2.5 transition border ${
                hasVoted
                  ? isCorrect
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : isSelected && !isCorrect && poll.isQuiz
                    ? 'border-rose-500/40 bg-rose-500/10'
                    : 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20'
                  : 'border-black/10 dark:border-white/10 hover:border-[#5288c1] hover:bg-black/5 dark:hover:bg-black/20 cursor-pointer'
              }`}
            >
              {/* Animated Progress Bar fill */}
              {hasVoted && (
                <div
                  style={{ width: `${percent}%` }}
                  className={`absolute left-0 top-0 bottom-0 opacity-20 transition-all duration-500 ${
                    isCorrect
                      ? 'bg-emerald-500'
                      : isSelected && poll.isQuiz
                      ? 'bg-rose-500'
                      : 'bg-[#5288c1]'
                  }`}
                />
              )}

              <div className="relative z-10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                  {/* Selector icon or checkmark */}
                  {!hasVoted ? (
                    <div className="w-4 h-4 rounded-full border border-black/30 dark:border-white/40 flex-shrink-0" />
                  ) : isCorrect ? (
                    <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                  ) : isSelected && poll.isQuiz ? (
                    <XCircle size={15} className="text-rose-400 flex-shrink-0" />
                  ) : isSelected ? (
                    <div className="w-4 h-4 rounded-full bg-[#5288c1] flex items-center justify-center text-white flex-shrink-0">
                      <Check size={10} />
                    </div>
                  ) : (
                    <div className="w-4 h-4" />
                  )}

                  <span className="truncate font-medium text-[var(--tg-text)]">
                    {option.text}
                  </span>
                </div>

                {hasVoted && (
                  <span className="font-mono text-[11px] font-semibold text-[var(--tg-text-muted)] flex-shrink-0">
                    {percent}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: vote count */}
      <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] text-[var(--tg-text-muted)] flex items-center justify-between">
        <span>
          {totalVotes} {totalVotes === 1 ? 'голос' : totalVotes < 5 ? 'голоса' : 'голосов'}
        </span>
        {hasVoted && (
          <span className="text-[#5288c1]">
            {poll.isQuiz ? 'Ответ принят' : 'Вы проголосовали'}
          </span>
        )}
      </div>
    </div>
  );
};
