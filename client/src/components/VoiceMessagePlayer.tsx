import React, { useState, useEffect } from 'react';
import { Play, Pause, Sparkles, Loader2 } from 'lucide-react';

interface VoiceMessagePlayerProps {
  duration?: number;
  isOutgoing?: boolean;
  transcribedText?: string;
  onTranscribe?: () => void;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  duration = 12,
  isOutgoing = false,
  transcribedText,
  onTranscribe,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [localTranscribed, setLocalTranscribed] = useState(transcribedText);

  // 24 waveform bars
  const [bars] = useState(() =>
    Array.from({ length: 24 }, () => Math.floor(Math.random() * 20) + 6)
  );

  useEffect(() => {
    if (transcribedText) {
      setLocalTranscribed(transcribedText);
    }
  }, [transcribedText]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + (100 * speed) / (duration * 10);
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, duration, speed]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const cycleSpeed = () => {
    if (speed === 1) setSpeed(1.5);
    else if (speed === 1.5) setSpeed(2);
    else setSpeed(1);
  };

  const handleTranscribeClick = async () => {
    if (localTranscribed) {
      setLocalTranscribed(undefined);
      return;
    }
    setIsTranscribing(true);
    if (onTranscribe) {
      onTranscribe();
    }
    setTimeout(() => {
      setIsTranscribing(false);
      setLocalTranscribed('«Привет! Да, договорились, всё сделаю в точности как в Telegram Desktop, спасибо!»');
    }, 1200);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentSeconds = isPlaying
    ? (currentProgress / 100) * duration
    : duration;

  return (
    <div className="flex flex-col gap-1.5 py-1 px-1 min-w-[240px] select-none">
      <div className="flex items-center gap-3">
        {/* Play / Pause button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition shadow-sm cursor-pointer ${
            isOutgoing
              ? 'bg-[#3390ec] dark:bg-white text-white dark:text-blue-600 hover:opacity-90'
              : 'bg-[#3390ec] text-white hover:bg-blue-600'
          }`}
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        {/* Waveform and duration */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-[2.5px] h-6 cursor-pointer">
            {bars.map((height, i) => {
              const barProgress = (i / bars.length) * 100;
              const isFilled = currentProgress >= barProgress;
              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-all duration-75 ${
                    isFilled
                      ? isOutgoing
                        ? 'bg-[#3390ec] dark:bg-white'
                        : 'bg-[#3390ec]'
                      : isOutgoing
                      ? 'bg-emerald-700/25 dark:bg-blue-300/40'
                      : 'bg-slate-300 dark:bg-slate-500/40'
                  }`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
          <div className="text-[11px] font-mono opacity-80 flex items-center justify-between">
            <span>{formatSeconds(currentSeconds)}</span>
            <div className="flex items-center gap-1.5">
              {isPlaying && (
                <span className="text-[10px] opacity-75">
                  {Math.round(currentProgress)}%
                </span>
              )}
              <button
                type="button"
                onClick={cycleSpeed}
                className={`px-1 py-0.2 rounded text-[10px] font-bold border transition cursor-pointer ${
                  speed > 1
                    ? isOutgoing
                      ? 'bg-white/20 border-white text-white'
                      : 'bg-blue-500/20 border-blue-400 text-blue-400'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
                title="Скорость воспроизведения"
              >
                {speed}X
              </button>
            </div>
          </div>
        </div>

        {/* Telegram [->A] Voice Transcription button */}
        <button
          type="button"
          onClick={handleTranscribeClick}
          disabled={isTranscribing}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition border cursor-pointer flex-shrink-0 ${
            localTranscribed
              ? 'bg-amber-400 text-slate-900 border-amber-300'
              : isOutgoing
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[var(--tg-bubble-out-text)] border-black/10 dark:border-white/20'
              : 'bg-blue-500/10 hover:bg-blue-500/20 text-[#5288c1] border-[#5288c1]/30'
          }`}
          title="Расшифровать голос в текст (Telegram Voice-to-Text)"
        >
          {isTranscribing ? (
            <Loader2 size={13} className="animate-spin text-amber-300" />
          ) : (
            <span className="text-[10px] font-bold tracking-tight">→A</span>
          )}
        </button>
      </div>

      {/* Expanded transcribed text bubble */}
      {localTranscribed && (
        <div
          className={`p-2 rounded-xl text-xs font-normal border leading-relaxed animate-pop-in ${
            isOutgoing
              ? 'bg-blue-700/30 border-blue-400/30 text-white'
              : 'bg-black/20 border-white/10 text-white/90'
          }`}
        >
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-300 mb-0.5">
            <Sparkles size={11} />
            <span>Расшифровка речи:</span>
          </div>
          <div>{localTranscribed}</div>
        </div>
      )}
    </div>
  );
};
