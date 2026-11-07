import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Sparkles, Loader2 } from 'lucide-react';
import { resolveMediaUrl } from '../utils/avatar';
import { transcribeAudioUrl } from '../utils/speechToText';

interface TelegramAudioPlayerProps {
  messageId?: string;
  src: string;
  title?: string | null;
  fileSize?: string | null;
  duration?: number;
  isOutgoing?: boolean;
  transcribedText?: string;
  onTranscribe?: () => void;
  onSaveTranscription?: (text: string) => void;
}

export const TelegramAudioPlayer: React.FC<TelegramAudioPlayerProps> = ({
  messageId,
  src,
  title,
  fileSize,
  duration: initialDuration,
  isOutgoing,
  transcribedText,
  onSaveTranscription,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [localTranscribed, setLocalTranscribed] = useState(transcribedText);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedSrc = resolveMediaUrl(src);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = resolvedSrc;
    a.target = '_blank';
    a.download = title || `audio_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleTranscribeClick = async () => {
    if (isTranscribing) return;
    if (localTranscribed) {
      setLocalTranscribed(undefined);
      return;
    }
    setIsTranscribing(true);
    try {
      const recognized = await transcribeAudioUrl(resolvedSrc, undefined, messageId);
      setLocalTranscribed(recognized);
      if (onSaveTranscription && recognized && !recognized.startsWith('[')) {
        onSaveTranscription(recognized);
      }
    } catch (err: any) {
      setLocalTranscribed(`Ошибка распознавания: ${err?.message || 'не удалось распознать аудио'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <div
        className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[260px] max-w-[340px] ${
          isOutgoing ? 'bg-black/5 dark:bg-blue-600/20' : 'bg-black/5 dark:bg-[#182533]/80'
        } border border-black/5 dark:border-white/5 transition`}
      >
        <audio ref={audioRef} src={resolvedSrc} preload="metadata" />

        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-11 h-11 rounded-full bg-[#5288c1] hover:bg-[#6499d3] text-white flex items-center justify-center flex-shrink-0 shadow-md transition transform active:scale-95 cursor-pointer"
          title={isPlaying ? 'Пауза' : 'Слушать'}
        >
          {isPlaying ? (
            <Pause size={18} className="fill-current" />
          ) : (
            <Play size={18} className="fill-current ml-0.5" />
          )}
        </button>

        {/* Info & Scrubber */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-semibold text-xs truncate text-[var(--tg-text)]">
              {title || 'Голосовое сообщение'}
            </span>
            <div className="flex items-center gap-1">
              {/* Voice-to-text button [->A] */}
              <button
                type="button"
                onClick={handleTranscribeClick}
                disabled={isTranscribing}
                className="text-xs px-1.5 py-0.5 rounded font-mono font-bold text-[#5288c1] bg-[#5288c1]/10 hover:bg-[#5288c1]/20 transition flex items-center gap-1"
                title="Расшифровать в текст (Voice-to-Text)"
              >
                {isTranscribing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span>[→A]</span>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="text-[var(--tg-text-muted)] hover:text-[var(--tg-text)] transition p-1"
                title="Скачать трек"
              >
                <Download size={13} />
              </button>
            </div>
          </div>

          {/* Seekbar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#5288c1]"
          />

          <div className="flex items-center justify-between text-[10px] text-[var(--tg-text-muted)] mt-0.5 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>
              {formatTime(duration)}
              {fileSize ? ` • ${fileSize}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Transcribed Text Banner if transcribed */}
      {(transcribedText || localTranscribed) && (
        <div className="bg-black/30 border border-[#5288c1]/30 rounded-xl p-2.5 text-xs text-[#f5f5f5] leading-relaxed animate-fade-in flex items-start gap-1.5 max-w-[340px]">
          <Sparkles size={14} className="text-[#5288c1] mt-0.5 flex-shrink-0" />
          <div className="flex-1 italic">{transcribedText || localTranscribed}</div>
        </div>
      )}
    </div>
  );
};
