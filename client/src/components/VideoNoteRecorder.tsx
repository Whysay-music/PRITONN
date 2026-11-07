import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, RefreshCw } from 'lucide-react';

interface VideoNoteRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (videoBlob: Blob, duration: number, mimeType?: string) => void;
}

export const VideoNoteRecorder: React.FC<VideoNoteRecorderProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [errorText, setErrorText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const secondsRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('video/webm');
  const finishedRef = useRef<boolean>(false);

  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }
  }, []);

  const pickSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm',
      'video/mp4',
    ];
    for (const mime of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) {
          return mime;
        }
      } catch {}
    }
    return '';
  };

  const acquireStreamWithFallback = async (mode: 'user' | 'environment'): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 480 },
          height: { ideal: 480 },
        },
        audio: true,
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    }
  };

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const recorder = mediaRecorderRef.current;
    const recordedDuration = Math.max(secondsRef.current, 1);

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeTypeRef.current || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        stopAllTracks();
        if (blob.size > 0) {
          onSend(blob, recordedDuration, finalMime);
        }
        onClose();
      };
      try {
        if (recorder.state === 'recording') {
          recorder.requestData();
        }
        recorder.stop();
      } catch {
        const finalMime = mimeTypeRef.current || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: finalMime });
        stopAllTracks();
        if (blob.size > 0) {
          onSend(blob, recordedDuration, finalMime);
        }
        onClose();
      }
    } else {
      stopAllTracks();
      onClose();
    }
  }, [onClose, onSend, stopAllTracks]);

  const handleCancel = () => {
    finishedRef.current = true;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
    } catch {}
    stopAllTracks();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    finishedRef.current = false;
    secondsRef.current = 0;
    setSeconds(0);
    setIsRecording(false);
    setErrorText(null);
    chunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorText('Камера недоступна на этом устройстве');
      return;
    }

    acquireStreamWithFallback(facingMode)
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        try {
          const chosenMime = pickSupportedMimeType();
          const recorder = chosenMime
            ? new MediaRecorder(stream, { mimeType: chosenMime })
            : new MediaRecorder(stream);

          mimeTypeRef.current = recorder.mimeType || chosenMime || 'video/webm';
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              chunksRef.current.push(e.data);
            }
          };

          recorder.start(250);
          setIsRecording(true);
        } catch (err) {
          console.error('MediaRecorder start error:', err);
          setErrorText('Не удалось запустить запись видеокружка');
        }
      })
      .catch((err) => {
        console.error('Webcam access error:', err);
        if (!cancelled) {
          setErrorText('Разрешите доступ к камере и микрофону для записи кружочка');
        }
      });

    return () => {
      cancelled = true;
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        }
      } catch {}
      stopAllTracks();
    };
  }, [isOpen, facingMode, stopAllTracks]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= 60) {
        handleFinish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, handleFinish]);

  if (!isOpen) return null;

  const circumference = 2 * Math.PI * 105;
  const strokeDashoffset = circumference - (seconds / 60) * circumference;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 select-none animate-fade-in safe-area-modal">
      <div className="relative flex flex-col items-center max-w-xs w-full">
        {/* Circular Viewfinder */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* Circular Countdown Progress Ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle
              cx="128"
              cy="128"
              r="105"
              className="text-white/20 stroke-current"
              strokeWidth="6"
              fill="transparent"
            />
            <circle
              cx="128"
              cy="128"
              r="105"
              className="text-[#3390ec] stroke-current transition-all duration-300"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Camera preview video in circle */}
          <div className="w-52 h-52 rounded-full overflow-hidden bg-black shadow-2xl border-2 border-white/25 flex items-center justify-center">
            {errorText ? (
              <p className="text-xs text-rose-400 text-center px-4 leading-relaxed">{errorText}</p>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
            )}
          </div>

          {/* Live recording indicator */}
          <div className="absolute top-2 bg-black/70 px-3 py-0.5 rounded-full text-[11px] font-mono text-white flex items-center gap-1.5 shadow-md">
            <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
            <span>0:{seconds.toString().padStart(2, '0')} / 1:00</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-5 mt-6">
          {/* Cancel */}
          <button
            type="button"
            onClick={handleCancel}
            className="w-12 h-12 rounded-full bg-white/15 hover:bg-rose-500/30 text-white hover:text-rose-300 flex items-center justify-center transition shadow-lg cursor-pointer active:scale-95"
            title="Отмена"
          >
            <X size={22} />
          </button>

          {/* Send */}
          <button
            type="button"
            disabled={!!errorText || !isRecording}
            onClick={handleFinish}
            className="w-16 h-16 rounded-full bg-[#3390ec] hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition shadow-xl transform hover:scale-105 active:scale-95 cursor-pointer"
            title="Отправить видеосообщение"
          >
            <Check size={28} />
          </button>

          {/* Switch Front / Back Camera */}
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))}
            className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition shadow-lg cursor-pointer active:scale-95"
            title="Сменить камеру"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        <p className="text-white/70 text-xs mt-4 text-center">
          Запись видеокружка PRITONN • Нажмите ✓ для отправки
        </p>
      </div>
    </div>
  );
};
