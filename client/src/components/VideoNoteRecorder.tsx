import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Video, Camera } from 'lucide-react';

interface VideoNoteRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (videoBlob: Blob, duration: number) => void;
}

export const VideoNoteRecorder: React.FC<VideoNoteRecorderProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSeconds(0);
      setIsRecording(false);
      chunksRef.current = [];

      navigator.mediaDevices
        ?.getUserMedia({
          video: { width: 360, height: 360, facingMode: 'user' },
          audio: true,
        })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          // Auto start recording
          try {
            const recorder = new MediaRecorder(stream, {
              mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
                ? 'video/webm;codecs=vp8,opus'
                : 'video/webm',
            });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.start(100);
            setIsRecording(true);
          } catch (err) {
            console.error('MediaRecorder start error:', err);
          }
        })
        .catch((err) => {
          console.error('Webcam access error:', err);
          alert('Не удалось получить доступ к веб-камере или микрофону.');
          onClose();
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, onClose]);

  // Recording timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 60) {
            handleFinish();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const handleFinish = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        onSend(blob, Math.max(seconds, 2));
        onClose();
      };
      mediaRecorderRef.current.stop();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  const circumference = 2 * Math.PI * 105;
  const strokeDashoffset = circumference - (seconds / 60) * circumference;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="relative flex flex-col items-center">
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
              className="text-blue-500 stroke-current transition-all duration-300"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Camera preview video in circle */}
          <div className="w-52 h-52 rounded-full overflow-hidden bg-black shadow-2xl border-2 border-white/20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </div>

          {/* Live recording indicator */}
          <div className="absolute top-2 bg-black/60 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-white flex items-center gap-1.5 shadow-md">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>0:{seconds.toString().padStart(2, '0')} / 1:00</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-6 mt-6">
          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-rose-500/20 text-white/80 hover:text-rose-400 flex items-center justify-center transition shadow-lg"
            title="Отмена"
          >
            <X size={22} />
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={handleFinish}
            className="w-14 h-14 rounded-full bg-[#5288c1] hover:bg-[#6499d3] text-white flex items-center justify-center transition shadow-xl transform hover:scale-105 active:scale-95"
            title="Отправить видеосообщение"
          >
            <Check size={26} />
          </button>
        </div>

        <p className="text-white/60 text-xs mt-4">
          Запись круглого видеосообщения Telegram
        </p>
      </div>
    </div>
  );
};
