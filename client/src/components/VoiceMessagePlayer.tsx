import React, { useState, useEffect, useRef, useId } from 'react';
import { Play, Pause, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { resolveMediaUrl } from '../utils/avatar';
import { transcribeAudioUrl } from '../utils/speechToText';

interface VoiceMessagePlayerProps {
  messageId?: string;
  src?: string | null;
  duration?: number;
  isOutgoing?: boolean;
  transcribedText?: string;
  onTranscribe?: () => void;
  onSaveTranscription?: (text: string) => void;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  messageId,
  src,
  duration = 1,
  isOutgoing = false,
  transcribedText,
  onSaveTranscription,
}) => {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedSrc = resolveMediaUrl(src || '');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState<number>(Math.max(1, duration || 1));
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [localTranscribed, setLocalTranscribed] = useState<string | undefined>(transcribedText);
  const [showTranscription, setShowTranscription] = useState<boolean>(!!transcribedText);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Deterministic 26 waveform bars based on resolvedSrc/duration so bars don't flicker on re-render
  const [bars] = useState(() => {
    const seedStr = src || String(duration) || 'voice';
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
    }
    return Array.from({ length: 26 }, (_, idx) => {
      const v = Math.abs(Math.sin(hash + idx * 1.73));
      return Math.floor(v * 18) + 6;
    });
  });

  useEffect(() => {
    if (transcribedText) {
      setLocalTranscribed(transcribedText);
      setShowTranscription(true);
    }
  }, [transcribedText]);

  useEffect(() => {
    if (duration && duration > 0) {
      setAudioDuration((prev) => (prev <= 1 ? duration : prev));
    }
  }, [duration]);

  // Pause this player if another voice message starts playing
  useEffect(() => {
    const onOtherVoicePlay = (e: Event) => {
      const custom = e as CustomEvent<{ playerId: string }>;
      if (custom.detail?.playerId && custom.detail.playerId !== playerId) {
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    };
    window.addEventListener('pritonn-voice-play', onOtherVoicePlay);
    return () => window.removeEventListener('pritonn-voice-play', onOtherVoicePlay);
  }, [playerId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateDurationIfValid = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setAudioDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
      updateDurationIfValid();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setAudioError(null);
    };

    const handleError = () => {
      setIsPlaying(false);
      if (resolvedSrc) {
        setAudioError('Не удалось воспроизвести запись');
      }
    };

    audio.addEventListener('loadedmetadata', updateDurationIfValid);
    audio.addEventListener('durationchange', updateDurationIfValid);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', updateDurationIfValid);
      audio.removeEventListener('durationchange', updateDurationIfValid);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('error', handleError);
    };
  }, [resolvedSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  const effectiveDuration = Math.max(
    audioDuration || duration || 1,
    currentTime > 0 ? currentTime : 1
  );

  const currentProgress = isPlaying || currentTime > 0
    ? Math.min(100, (currentTime / effectiveDuration) * 100)
    : 0;

  const togglePlay = async () => {
    if (!resolvedSrc) {
      setAudioError('Нет аудиозаписи (сообщение старой версии)');
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      window.dispatchEvent(new CustomEvent('pritonn-voice-play', { detail: { playerId } }));
      audio.playbackRate = speed;
      try {
        await audio.play();
        setIsPlaying(true);
        setAudioError(null);
      } catch {
        setIsPlaying(false);
        setAudioError('Ошибка запуска воспроизведения');
      }
    }
  };

  const cycleSpeed = () => {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!resolvedSrc || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / Math.max(1, rect.width)));
    const targetSec = ratio * effectiveDuration;
    try {
      audioRef.current.currentTime = targetSec;
      setCurrentTime(targetSec);
    } catch {}
    if (!isPlaying) {
      togglePlay();
    }
  };

  const handleTranscribeClick = async () => {
    if (isTranscribing) return;

    // Toggle visibility if already transcribed
    if (localTranscribed) {
      setShowTranscription((prev) => !prev);
      return;
    }

    if (!resolvedSrc) {
      setLocalTranscribed('Аудиофайл отсутствует (сообщение отправлено до обновления записи голоса).');
      setShowTranscription(true);
      return;
    }

    setIsTranscribing(true);
    setTranscribeStatus('Распознавание речи...');
    try {
      const recognized = await transcribeAudioUrl(
        resolvedSrc,
        (st) => setTranscribeStatus(st),
        messageId
      );
      setLocalTranscribed(recognized);
      setShowTranscription(true);
      if (
        onSaveTranscription &&
        recognized &&
        !recognized.startsWith('[') &&
        !recognized.startsWith('Нет аудиозаписи')
      ) {
        onSaveTranscription(recognized);
      }
    } catch (err: any) {
      setLocalTranscribed(`Ошибка распознавания: ${err?.message || 'попробуйте ещё раз'}`);
      setShowTranscription(true);
    } finally {
      setIsTranscribing(false);
      setTranscribeStatus('');
    }
  };

  const formatSeconds = (sec: number) => {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayedSeconds = isPlaying || currentTime > 0 ? currentTime : effectiveDuration;

  return (
    <div className="flex flex-col gap-1.5 py-1 px-1 min-w-[245px] max-w-[320px] select-none">
      {resolvedSrc && (
        <audio ref={audioRef} src={resolvedSrc} preload="metadata" playsInline />
      )}

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
          title={isPlaying ? 'Пауза' : 'Воспроизвести голосовое сообщение'}
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>

        {/* Waveform and duration */}
        <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
          <div
            onClick={handleSeek}
            title="Нажмите в любое место волны для перемотки"
            className="flex items-center gap-[2.5px] h-6 cursor-pointer py-1 group/wave"
          >
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
          <div className="text-[11px] font-mono opacity-80 flex items-center justify-between gap-2">
            <span>
              {formatSeconds(displayedSeconds)}
              {(isPlaying || currentTime > 0) && ` / ${formatSeconds(effectiveDuration)}`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleSpeed}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                  speed > 1
                    ? isOutgoing
                      ? 'bg-white/20 border-white text-white'
                      : 'bg-blue-500/20 border-blue-400 text-blue-400'
                    : 'border-white/10 opacity-70 hover:opacity-100'
                }`}
                title="Скорость воспроизведения"
              >
                {speed}X
              </button>
            </div>
          </div>
        </div>

        {/* Real Voice-to-Text [->A] button */}
        <button
          type="button"
          onClick={handleTranscribeClick}
          disabled={isTranscribing}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition border cursor-pointer flex-shrink-0 ${
            localTranscribed && showTranscription
              ? 'bg-amber-400 text-slate-900 border-amber-300'
              : isOutgoing
              ? 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[var(--tg-bubble-out-text)] border-black/10 dark:border-white/20'
              : 'bg-blue-500/10 hover:bg-blue-500/20 text-[#5288c1] border-[#5288c1]/30'
          }`}
          title="Распознать голосовое сообщение в текст"
        >
          {isTranscribing ? (
            <Loader2 size={13} className="animate-spin text-amber-300" />
          ) : (
            <span className="text-[10px] font-bold tracking-tight">→A</span>
          )}
        </button>
      </div>

      {/* Live transcription progress indicator */}
      {isTranscribing && transcribeStatus && (
        <div className="text-[10px] text-amber-300/90 flex items-center gap-1.5 px-1 animate-pulse">
          <Loader2 size={11} className="animate-spin flex-shrink-0" />
          <span className="truncate">{transcribeStatus}</span>
        </div>
      )}

      {/* Missing / playback error indicator */}
      {audioError && (
        <div className="text-[11px] text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-lg px-2 py-1 flex items-center gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0" />
          <span>{audioError}</span>
        </div>
      )}

      {/* Expanded transcribed text bubble */}
      {localTranscribed && showTranscription && (
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
          <div className="break-words">{localTranscribed}</div>
        </div>
      )}
    </div>
  );
};
