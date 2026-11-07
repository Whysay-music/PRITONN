import React, { useState, useEffect, useRef } from 'react';
import { X, Video, VideoOff, Mic, MicOff, Users, Radio, MonitorUp, Heart, Flame, Sparkles, Send } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Chat, User } from '../types';
import { API_BASE_URL } from '../config';

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

interface ChannelLiveStreamModalProps {
  isOpen: boolean;
  chat: Chat;
  currentUser: User;
  socket?: Socket | null;
  isHost: boolean;
  onClose: () => void;
}

export const ChannelLiveStreamModal: React.FC<ChannelLiveStreamModalProps> = ({
  isOpen,
  chat,
  currentUser,
  socket,
  isHost,
  onClose,
}) => {
  const [viewersCount, setViewersCount] = useState<number>(chat.liveStream?.viewersCount || 1);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [streamComment, setStreamComment] = useState('');
  const [comments, setComments] = useState<Array<{ sender: string; text: string }>>([
    { sender: 'PRITONN Live', text: 'Трансляция началась! Добро пожаловать.' },
  ]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reactionIdRef = useRef(1);

  // Setup broadcast if host
  useEffect(() => {
    if (!isOpen) return;

    if (isHost) {
      navigator.mediaDevices
        ?.getUserMedia({ video: true, audio: true })
        .then((s) => {
          streamRef.current = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }

          // Broadcast frames over socket to channel viewers
          if (socket) {
            frameIntervalRef.current = setInterval(() => {
              if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
              const v = videoRef.current;
              const c = canvasRef.current;
              if (v.videoWidth === 0) return;

              c.width = 480;
              c.height = 270;
              const ctx = c.getContext('2d');
              if (ctx) {
                ctx.drawImage(v, 0, 0, c.width, c.height);
                const frameData = c.toDataURL('image/jpeg', 0.5);
                socket.emit('channel_live_frame', { chatId: chat.id, frame: frameData });
              }
            }, 100);
          }
        })
        .catch((err) => {
          console.warn('Camera stream error:', err);
        });
    } else {
      // Viewer join
      if (socket) {
        socket.emit('channel_live_join', { chatId: chat.id });

        const handleLiveFrame = (data: { chatId: string; frame: string }) => {
          if (data.chatId === chat.id && videoRef.current) {
            videoRef.current.src = data.frame;
          }
        };

        socket.on(`channel_live_frame_${chat.id}`, handleLiveFrame);

        return () => {
          socket.emit('channel_live_leave', { chatId: chat.id });
          socket.off(`channel_live_frame_${chat.id}`, handleLiveFrame);
        };
      }
    }

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, isHost, chat.id, socket]);

  // Listen to viewers count
  useEffect(() => {
    if (!socket || !isOpen) return;
    const handleViewers = (data: { chatId: string; viewersCount: number }) => {
      if (data.chatId === chat.id) setViewersCount(data.viewersCount);
    };
    socket.on('channel_live_viewers', handleViewers);
    return () => {
      socket.off('channel_live_viewers', handleViewers);
    };
  }, [socket, isOpen, chat.id]);

  if (!isOpen) return null;

  const triggerReaction = (emoji: string) => {
    const newR: FloatingReaction = {
      id: reactionIdRef.current++,
      emoji,
      x: Math.random() * 80 + 10,
    };
    setFloatingReactions((prev) => [...prev, newR]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== newR.id));
    }, 1500);
  };

  const handleSendComment = () => {
    if (!streamComment.trim()) return;
    setComments((prev) => [...prev, { sender: currentUser.name, text: streamComment.trim() }]);
    setStreamComment('');
  };

  const handleEndStream = async () => {
    if (isHost) {
      await fetch(`${API_BASE_URL}/api/chats/${chat.id}/live/stop`, {
        method: 'POST',
      }).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl h-[90vh] bg-[#0c1017] rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row">
        {/* Main Video Stream Area */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {/* Header overlay */}
          <div className="absolute top-4 inset-x-4 z-30 flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg animate-pulse">
                <Radio size={14} />
                <span>В ЭФИРЕ</span>
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold border border-white/10">
                <Users size={14} className="text-sky-400" />
                <span>{viewersCount}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleEndStream}
              className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md cursor-pointer active:scale-95"
            >
              {isHost ? 'Завершить эфир' : 'Выйти'}
            </button>
          </div>

          {/* Stream display */}
          {isHost ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              ref={videoRef as any}
              alt="Live stream"
              className="w-full h-full object-contain"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Floating Emoji Reactions */}
          {floatingReactions.map((r) => (
            <div
              key={r.id}
              style={{ left: `${r.x}%` }}
              className="absolute bottom-16 text-3xl pointer-events-none animate-float-up drop-shadow-lg"
            >
              {r.emoji}
            </div>
          ))}

          {/* Host Controls */}
          {isHost && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/15 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (streamRef.current) {
                    streamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
                  }
                }}
                className={`p-3 rounded-full text-white transition cursor-pointer ${
                  isMuted ? 'bg-rose-600' : 'bg-white/15 hover:bg-white/25'
                }`}
                title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsVideoEnabled(!isVideoEnabled);
                  if (streamRef.current) {
                    streamRef.current.getVideoTracks().forEach((t) => (t.enabled = !isVideoEnabled));
                  }
                }}
                className={`p-3 rounded-full text-white transition cursor-pointer ${
                  !isVideoEnabled ? 'bg-rose-600' : 'bg-white/15 hover:bg-white/25'
                }`}
                title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
              >
                {isVideoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </button>
            </div>
          )}
        </div>

        {/* Live Chat & Reactions Sidebar */}
        <div className="w-full md:w-80 h-64 md:h-full bg-[var(--tg-sidebar)] border-t md:border-t-0 md:border-l border-[var(--tg-card-border)] flex flex-col text-[var(--tg-text)]">
          <div className="p-3.5 border-b border-[var(--tg-card-border)] font-bold text-xs flex items-center justify-between">
            <span>Чат трансляции</span>
            <span className="text-[10px] text-[var(--tg-text-muted)]">{chat.name}</span>
          </div>

          {/* Comments list */}
          <div className="flex-1 p-3 overflow-y-auto no-scrollbar flex flex-col gap-2 text-xs">
            {comments.map((c, i) => (
              <div key={i} className="flex flex-col bg-[var(--tg-surface)]/50 p-2 rounded-xl">
                <span className="font-bold text-[11px] text-[#5288c1]">{c.sender}</span>
                <span className="text-[var(--tg-text)] mt-0.5">{c.text}</span>
              </div>
            ))}
          </div>

          {/* Reactions bar */}
          <div className="p-2 border-t border-[var(--tg-card-border)] flex items-center justify-around bg-[var(--tg-surface)]/40">
            {['❤️', '🔥', '👏', '🎉', '🚀'].map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => triggerReaction(em)}
                className="hover:scale-130 transition text-xl cursor-pointer active:scale-95"
              >
                {em}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div className="p-3 border-t border-[var(--tg-card-border)] flex items-center gap-2">
            <input
              type="text"
              value={streamComment}
              onChange={(e) => setStreamComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              placeholder="Написать в чат..."
              className="flex-1 px-3 py-1.5 bg-[var(--tg-surface)] border border-[var(--tg-card-border)] rounded-xl text-xs outline-none focus:border-[var(--tg-border-accent)]"
            />
            <button
              type="button"
              onClick={handleSendComment}
              className="p-2 rounded-xl bg-[var(--tg-accent)] text-white hover:opacity-90 transition cursor-pointer"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
