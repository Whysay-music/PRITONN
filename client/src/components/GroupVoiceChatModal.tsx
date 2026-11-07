import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Mic,
  MicOff,
  Hand,
  Volume2,
  VolumeX,
  Users,
  Radio,
  MonitorUp,
  UserPlus,
  PhoneOff,
  Maximize2,
  Minimize2,
  Minus,
  Search,
  Check,
  Video,
  VideoOff,
  Tv,
  Sparkles,
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Chat, User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

export interface GroupParticipant {
  user: User;
  status: 'active' | 'invited';
  isSpeaking?: boolean;
}

interface GroupVoiceChatModalProps {
  isOpen: boolean;
  chat: Chat | null;
  currentUser: User | null;
  allUsers: User[];
  socket?: Socket | null;
  onClose: () => void;
}

export const GroupVoiceChatModal: React.FC<GroupVoiceChatModalProps> = ({
  isOpen,
  chat,
  currentUser,
  allUsers,
  socket,
  onClose,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isViewingRemoteScreen, setIsViewingRemoteScreen] = useState(false);
  const [remoteScreenFrames, setRemoteScreenFrames] = useState<Record<string, string>>({});
  const [activeRemoteSharers, setActiveRemoteSharers] = useState<
    Array<{ sharerId: string; sharerName: string; avatar?: string }>
  >([]);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([
    8, 14, 10, 18, 12, 16, 20, 14, 18, 15, 10, 19,
  ]);

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Participants list (starts strictly with current user; invited members show in ringing state until joined)
  const [roomParticipants, setRoomParticipants] = useState<GroupParticipant[]>([]);

  // Initialize room participants on open (ONLY the active user who starts or joins, NO fake members)
  useEffect(() => {
    if (!isOpen || !chat || !currentUser) return;

    setRoomParticipants([{ user: currentUser, status: 'active', isSpeaking: !isMuted }]);
    setSeconds(0);
    setIsMinimized(false);
    setIsInviteOpen(false);
    setInvitedUserIds(new Set());

    if (socket) {
      // 1. Notify that voice chat is active in this group
      socket.emit('voice_chat_start', {
        chatId: chat.id,
        chatName: chat.displayName || chat.name || 'Голосовой чат',
        initiatorId: currentUser.id,
        initiatorName: currentUser.name,
      });

      // 2. Join voice chat room
      socket.emit('voice_chat_join', {
        chatId: chat.id,
        user: currentUser,
      });

      // 3. Listen for other users joining
      const handleUserJoined = (data: { chatId: string; user: User }) => {
        if (data.chatId === chat.id && data.user.id !== currentUser.id) {
          setRoomParticipants((prev) => {
            const exists = prev.some((p) => p.user.id === data.user.id);
            if (exists) {
              return prev.map((p) => (p.user.id === data.user.id ? { ...p, status: 'active' } : p));
            }
            return [...prev, { user: data.user, status: 'active' }];
          });
        }
      };

      // 4. Listen for other users leaving
      const handleUserLeft = (data: { chatId: string; userId: string }) => {
        if (data.chatId === chat.id) {
          setRoomParticipants((prev) => prev.filter((p) => p.user.id !== data.userId));
        }
      };

      socket.on('voice_chat_user_joined', handleUserJoined);
      socket.on('voice_chat_user_left', handleUserLeft);

      return () => {
        socket.off('voice_chat_user_joined', handleUserJoined);
        socket.off('voice_chat_user_left', handleUserLeft);
        socket.emit('voice_chat_leave', {
          chatId: chat.id,
          userId: currentUser.id,
        });
      };
    }
  }, [isOpen, chat?.id, currentUser?.id]);

  // Duration timer
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Real Microphone & Audio Visualizer
  useEffect(() => {
    if (!isOpen) return;

    let localStream: MediaStream | null = null;
    let animationId: number;

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: isVideoEnabled })
      .then((stream) => {
        localStream = stream;
        localStreamRef.current = stream;

        if (cameraVideoRef.current && isVideoEnabled) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }

        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateWaveform = () => {
              if (!localStreamRef.current) return;
              analyser.getByteFrequencyData(dataArray);
              const heights = Array.from({ length: 12 }, (_, i) => {
                const val = dataArray[i * 2] || 0;
                return Math.max(6, Math.min(32, Math.round((val / 255) * 28) + 6));
              });
              setVisualizerHeights(heights);
              animationId = requestAnimationFrame(updateWaveform);
            };
            updateWaveform();
          }
        } catch {}
      })
      .catch((err) => {
        console.warn('Microphone permission not granted:', err);
      });

    return () => {
      cancelAnimationFrame(animationId);
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }
    };
  }, [isOpen, isVideoEnabled]);

  // Toggle Mute
  const handleToggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
  };

  // Toggle Speaker
  const handleToggleSpeaker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Callback ref for Screen Video
  const setScreenVideo = useCallback((node: HTMLVideoElement | null) => {
    screenVideoRef.current = node;
    if (node && screenStreamRef.current) {
      node.srcObject = screenStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Listen for group voice chat screen sharing & frame streaming
  useEffect(() => {
    if (!socket || !chat) return;

    socket.emit('voice_chat_get_shares', { chatId: chat.id });

    const handleSharesList = ({
      chatId,
      activeShares,
    }: {
      chatId: string;
      activeShares: Array<{ sharerId: string; sharerName: string }>;
    }) => {
      if (chatId !== chat.id) return;
      const others = (activeShares || []).filter((s) => s.sharerId !== currentUser?.id);
      const resolved = others.map((s) => {
        const u = allUsers.find((user) => user.id === s.sharerId);
        return {
          sharerId: s.sharerId,
          sharerName: s.sharerName || u?.name || 'Участник',
          avatar: u?.avatar,
        };
      });
      setActiveRemoteSharers(resolved);
      setIsRemoteScreenSharing(resolved.length > 0);
      if (resolved.length > 0) {
        setSelectedStreamId((curr) => curr || resolved[0].sharerId);
      }
    };

    const handleScreenShareStatus = ({
      chatId,
      isSharing,
      sharerName,
      sharerId,
      activeShares,
    }: {
      chatId: string;
      isSharing: boolean;
      sharerName: string;
      sharerId: string;
      activeShares?: Array<{ sharerId: string; sharerName: string }>;
    }) => {
      if (chatId !== chat.id) return;

      if (activeShares) {
        const others = activeShares.filter((s) => s.sharerId !== currentUser?.id);
        const resolved = others.map((s) => {
          const u = allUsers.find((user) => user.id === s.sharerId);
          return {
            sharerId: s.sharerId,
            sharerName: s.sharerName || u?.name || 'Участник',
            avatar: u?.avatar,
          };
        });
        setActiveRemoteSharers(resolved);
        setIsRemoteScreenSharing(resolved.length > 0);
        if (resolved.length === 0) {
          setIsViewingRemoteScreen(false);
          setRemoteScreenFrames({});
        } else {
          setSelectedStreamId((curr) => {
            if (curr && curr !== 'local' && !resolved.some((r) => r.sharerId === curr)) {
              return resolved[0]?.sharerId || (isScreenSharing ? 'local' : null);
            }
            return curr || resolved[0]?.sharerId || null;
          });
        }
      } else {
        if (sharerId !== currentUser?.id) {
          if (isSharing) {
            setActiveRemoteSharers((prev) => {
              if (prev.some((p) => p.sharerId === sharerId)) return prev;
              const u = allUsers.find((user) => user.id === sharerId);
              return [...prev, { sharerId, sharerName: sharerName || u?.name || 'Участник', avatar: u?.avatar }];
            });
            setIsRemoteScreenSharing(true);
            setSelectedStreamId((curr) => curr || sharerId);
          } else {
            setActiveRemoteSharers((prev) => {
              const updated = prev.filter((p) => p.sharerId !== sharerId);
              if (updated.length === 0) {
                setIsViewingRemoteScreen(false);
              }
              return updated;
            });
            setRemoteScreenFrames((prev) => {
              const next = { ...prev };
              delete next[sharerId];
              return next;
            });
          }
        }
      }
    };

    const handleScreenFrame = ({
      chatId,
      frame,
      sharerId,
      sharerName,
    }: {
      chatId: string;
      frame: string;
      sharerId: string;
      sharerName: string;
    }) => {
      if (chatId !== chat.id) return;
      if (sharerId === currentUser?.id) return;

      setRemoteScreenFrames((prev) => ({
        ...prev,
        [sharerId]: frame,
      }));
      setIsRemoteScreenSharing(true);

      setActiveRemoteSharers((prev) => {
        if (prev.some((p) => p.sharerId === sharerId)) return prev;
        const u = allUsers.find((user) => user.id === sharerId);
        return [...prev, { sharerId, sharerName: sharerName || u?.name || 'Участник', avatar: u?.avatar }];
      });

      setSelectedStreamId((curr) => curr || sharerId);
    };

    socket.on('voice_chat_shares_list', handleSharesList);
    socket.on('voice_chat_screen_share_status', handleScreenShareStatus);
    socket.on('voice_chat_screen_frame', handleScreenFrame);

    return () => {
      socket.off('voice_chat_shares_list', handleSharesList);
      socket.off('voice_chat_screen_share_status', handleScreenShareStatus);
      socket.off('voice_chat_screen_frame', handleScreenFrame);
    };
  }, [socket, chat, currentUser, allUsers, isScreenSharing]);

  // Screen Sharing Toggle with full Window/Screen/Tab support and frame streaming
  const handleToggleScreenShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: undefined,
          } as any,
          audio: true,
          selfBrowserSurface: 'include',
          surfaceSwitching: 'include',
          systemAudio: 'include',
        } as any);

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);
        setIsMinimized(false);

        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = screenStream;
          screenVideoRef.current.play().catch(() => {});
        }

        // Live high-speed canvas frame streaming for all group participants
        const captureVideo = document.createElement('video');
        captureVideo.muted = true;
        captureVideo.autoplay = true;
        captureVideo.playsInline = true;
        captureVideo.srcObject = screenStream;
        captureVideo.play().catch(() => {});

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = setInterval(() => {
          if (!screenStreamRef.current || screenStreamRef.current.getVideoTracks().length === 0 || screenStreamRef.current.getVideoTracks()[0].readyState !== 'live') {
            stopScreenSharing();
            return;
          }
          if (captureVideo.videoWidth > 0 && captureVideo.videoHeight > 0) {
            const maxDim = 1280;
            let w = captureVideo.videoWidth;
            let h = captureVideo.videoHeight;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }
            canvas.width = w;
            canvas.height = h;
            if (ctx) {
              ctx.drawImage(captureVideo, 0, 0, w, h);
              const frameData = canvas.toDataURL('image/jpeg', 0.65);
              if (socket && chat && currentUser) {
                socket.emit('voice_chat_screen_frame', {
                  chatId: chat.id,
                  frame: frameData,
                  sharerId: currentUser.id,
                  sharerName: currentUser.name,
                });
              }
            }
          }
        }, 65);

        if (socket && chat && currentUser) {
          socket.emit('voice_chat_screen_share', {
            chatId: chat.id,
            isSharing: true,
            sharerName: currentUser.name,
            sharerId: currentUser.id,
          });
        }

        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopScreenSharing();
          };
        }
      } catch (err) {
        console.warn('Screen share canceled or error:', err);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = useCallback(() => {
    setIsScreenSharing(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (socket && chat && currentUser) {
      socket.emit('voice_chat_screen_share', {
        chatId: chat.id,
        isSharing: false,
        sharerName: currentUser.name,
        sharerId: currentUser.id,
      });
    }
  }, [socket, chat, currentUser]);

  // Fullscreen Stage
  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Invite user to group voice chat
  const handleInviteUser = (user: User) => {
    setInvitedUserIds((prev) => new Set(prev).add(user.id));

    // Immediately add to room participants as 'invited' (blinking gray card until they join)
    setRoomParticipants((prev) => {
      if (prev.some((p) => p.user.id === user.id)) return prev;
      return [...prev, { user, status: 'invited' }];
    });

    if (socket && chat && currentUser) {
      socket.emit('voice_chat_invite', {
        chatId: chat.id,
        chatName: chat.displayName || chat.name || 'Голосовой чат',
        inviterName: currentUser.name,
        inviterId: currentUser.id,
        targetUserId: user.id,
      });
    }
  };

  // Leave room and stop streams
  const handleLeaveRoom = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isScreenSharing) {
      stopScreenSharing();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    onClose();
  };

  if (!isOpen || !chat || !currentUser) return null;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const chatName = chat.displayName || chat.name;
  const chatAvatar = chat.displayAvatar || chat.avatar;

  // Filter contacts available to invite
  const filteredUsersToInvite = allUsers.filter((u) => {
    if (u.id === currentUser.id) return false;
    if (!inviteSearchQuery.trim()) return true;
    const q = inviteSearchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  // --- FLOATING MINIMIZED ISLAND ---
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{ zIndex: 9999 }}
        className="fixed top-3 left-1/2 -translate-x-1/2 bg-[#17212b]/95 hover:bg-[#202b36] border border-emerald-500/50 hover:border-emerald-400 backdrop-blur-md rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-3.5 cursor-pointer transition-all duration-200 select-none group max-w-[95vw] animate-pop-in"
        title="Нажмите в любое место, чтобы вернуться в голосовой чат"
      >
        <div className="relative flex-shrink-0">
          <img
            src={chatAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt={chatName}
            className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#17212b] rounded-full animate-ping" />
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-white truncate">
            <Radio size={13} className="text-emerald-400 animate-pulse" />
            <span className="truncate">{chatName}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-emerald-400 font-mono font-medium">{formatTime(seconds)}</span>
            <span className="text-[10px] text-[#7f91a4]">{roomParticipants.length} участн.</span>
            {isScreenSharing && (
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                <Tv size={10} />
                <span>Экран</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => handleToggleMute(e)}
            className={`p-2 rounded-xl transition cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          <button
            type="button"
            onClick={(e) => handleLeaveRoom(e)}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-md cursor-pointer"
            title="Покинуть голосовой чат"
          >
            <PhoneOff size={15} />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-md flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
            title="Развернуть голосовой чат"
          >
            <Maximize2 size={13} />
            <span className="hidden sm:inline">Развернуть</span>
          </button>
        </div>
      </div>
    );
  }

  const allAvailableStreams: Array<{
    id: string;
    name: string;
    avatar?: string;
    isLocal: boolean;
  }> = [];

  if (isScreenSharing) {
    allAvailableStreams.push({
      id: 'local',
      name: `${currentUser?.name || 'Вы'} (Ваш экран)`,
      avatar: currentUser?.avatar,
      isLocal: true,
    });
  }

  activeRemoteSharers.forEach((s) => {
    allAvailableStreams.push({
      id: s.sharerId,
      name: s.sharerName,
      avatar: s.avatar || allUsers.find((u) => u.id === s.sharerId)?.avatar,
      isLocal: false,
    });
  });

  const effectiveSelectedStreamId =
    selectedStreamId && allAvailableStreams.some((s) => s.id === selectedStreamId)
      ? selectedStreamId
      : allAvailableStreams[0]?.id || null;

  const currentViewingStream = allAvailableStreams.find((s) => s.id === effectiveSelectedStreamId);

  const isTheaterActive = isScreenSharing || (isRemoteScreenSharing && isViewingRemoteScreen);

  return (
    <div
      style={{ zIndex: 9990 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fade-in"
    >
      <div
        ref={modalContainerRef}
        className={`w-full transition-all duration-300 relative flex flex-col overflow-hidden border border-[#242f3d] shadow-2xl text-[#f5f5f5] ${
          isTheaterActive
            ? isFullscreen
              ? 'fixed inset-0 z-50 rounded-none bg-black p-4'
              : 'max-w-5xl h-[88vh] bg-[#17212b] rounded-3xl p-4 md:p-6'
            : 'max-w-2xl h-[80vh] bg-[#17212b] rounded-3xl p-5 md:p-6 animate-pop-in'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#242f3d] flex-shrink-0 mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={chatAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={chatName}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-md"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#17212b] rounded-full animate-ping" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight truncate max-w-xs">{chatName}</h3>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  В ЭФИРЕ
                </span>
                <span className="text-xs text-emerald-400 font-mono font-medium">
                  {formatTime(seconds)}
                </span>
              </div>
              <p className="text-xs text-[#7f91a4] flex items-center gap-1.5 mt-0.5">
                <Users size={12} />
                <span>{roomParticipants.length} участников в голосовом звонке</span>
              </p>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Invite Button */}
            <button
              type="button"
              onClick={() => setIsInviteOpen(!isInviteOpen)}
              className="px-3 py-1.5 rounded-xl bg-[#2481cc]/15 hover:bg-[#2481cc]/25 text-[#5288c1] border border-[#2481cc]/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
              title="Пригласить участников в звонок"
            >
              <UserPlus size={14} />
              <span>Пригласить</span>
            </button>

            {isTheaterActive && (
              <button
                type="button"
                onClick={() => {
                  if (isScreenSharing) {
                    stopScreenSharing();
                  } else {
                    setIsViewingRemoteScreen(false);
                  }
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#242f3d] hover:bg-[#2c394a] text-[#7f91a4] hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
                title="Свернуть просмотр в компактный режим звонка"
              >
                <Minimize2 size={14} />
                <span className="hidden sm:inline">Свернуть в мини</span>
              </button>
            )}

            {isTheaterActive && (
              <button
                type="button"
                onClick={(e) => toggleFullscreen(e)}
                className="p-1.5 rounded-lg bg-[#242f3d] hover:bg-[#2c394a] text-white transition cursor-pointer"
                title={isFullscreen ? 'Свернуть' : 'Во весь экран'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}

            {/* Minimize Call */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg bg-[#242f3d] hover:bg-[#2c394a] text-[#7f91a4] hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
              title="Свернуть звонок в плавающее окно"
            >
              <Minus size={15} />
              <span className="hidden sm:inline">Свернуть</span>
            </button>

            {/* Leave Room Button */}
            <button
              type="button"
              onClick={(e) => handleLeaveRoom(e)}
              className="p-1.5 rounded-lg bg-[#242f3d] hover:bg-rose-500/20 text-[#7f91a4] hover:text-rose-400 transition cursor-pointer"
              title="Покинуть голосовой чат"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* --- MAIN CONTENT: THEATER SCREEN SHARE OR PARTICIPANTS GRID --- */}
        <div className="flex-1 w-full min-h-0 flex flex-col relative overflow-hidden">
          {/* SCREEN SHARE THEATER MODE */}
          {isTheaterActive ? (
            <div className="flex-1 w-full min-h-0 flex flex-col mb-2">
              <div className="flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-xl bg-black/40 border border-white/5 text-xs flex-shrink-0">
                <div className="flex items-center gap-2 text-white">
                  <Tv size={16} className="text-emerald-400" />
                  <span className="font-semibold text-sm">
                    {currentViewingStream?.isLocal
                      ? 'Ваша трансляция экрана'
                      : `Демонстрация экрана: ${currentViewingStream?.name || 'Участник'}`}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                    HD 1080p 60FPS
                  </span>
                </div>
                <div className="text-[11px] text-[#7f91a4] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Прямой эфир</span>
                </div>
              </div>

              {/* Multi-Stream Switcher Bar: when 2 or more participants have shared their screen */}
              {allAvailableStreams.length > 1 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-2 bg-[#0e1621]/95 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar flex-shrink-0">
                  <div className="text-[11px] text-[#7f91a4] font-semibold flex items-center gap-1.5 mr-1 flex-shrink-0">
                    <Tv size={13} className="text-emerald-400" />
                    <span>Выбор демонстрации ({allAvailableStreams.length}):</span>
                  </div>
                  {allAvailableStreams.map((stream) => {
                    const isSelected = effectiveSelectedStreamId === stream.id;
                    return (
                      <button
                        key={stream.id}
                        type="button"
                        onClick={() => setSelectedStreamId(stream.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer flex-shrink-0 active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 border border-emerald-400'
                            : 'bg-[#17212b] text-[#7f91a4] hover:text-white hover:bg-[#202b36] border border-white/5'
                        }`}
                      >
                        <img
                          src={stream.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={stream.name}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span className="truncate max-w-[130px]">{stream.name}</span>
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300 animate-pulse' : 'bg-emerald-500'}`} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Video Element / Frame for Selected Screen Presentation */}
              <div className="flex-1 w-full relative min-h-0 bg-black rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center shadow-inner">
                {effectiveSelectedStreamId === 'local' ? (
                  <video
                    ref={setScreenVideo}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    {effectiveSelectedStreamId && remoteScreenFrames[effectiveSelectedStreamId] ? (
                      <img
                        src={remoteScreenFrames[effectiveSelectedStreamId]}
                        alt={`Прямая трансляция экрана ${currentViewingStream?.name || ''}`}
                        className="w-full h-full object-contain select-none pointer-events-none"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-3 text-[#7f91a4]">
                        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Подключение к демонстрации экрана {currentViewingStream?.name || ''}...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Floating active participants strip */}
                <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur-md px-3 py-2 rounded-2xl border border-white/10 flex items-center justify-between overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-2">
                    {roomParticipants.map((p) => {
                      const u = p.user;
                      const isMe = u.id === currentUser.id;
                      const isSpeaking = isMe ? !isMuted : !!p.isSpeaking;
                      return (
                        <div
                          key={u.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs"
                        >
                          <img
                            src={getAvatarUrl(u.avatar, u.name)}
                            onError={(e) => handleAvatarError(e, u.name)}
                            alt={u.name}
                            className={`w-5 h-5 rounded-full object-cover border ${
                              isSpeaking ? 'border-emerald-400' : 'border-transparent'
                            }`}
                          />
                          <span className="truncate max-w-[80px] text-white/90">{u.name}</span>
                          {isSpeaking && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PARTICIPANTS GRID WITH MULTI-SCREEN SHARE BANNER */
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto py-2">
              {activeRemoteSharers.length > 0 && (
                <div className="w-full mb-3 p-3.5 bg-gradient-to-r from-emerald-500/20 to-[#2481cc]/25 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg flex-shrink-0 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md relative flex-shrink-0">
                      <MonitorUp size={20} />
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#17212b] animate-ping" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-white leading-tight">
                        {activeRemoteSharers.length > 1
                          ? `Транслируют экран (${activeRemoteSharers.length}): ${activeRemoteSharers.map(s => s.sharerName).join(', ')}`
                          : `${activeRemoteSharers[0].sharerName} запустил(а) трансляцию экрана`}
                      </p>
                      <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        Выберите демонстрацию для просмотра
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeRemoteSharers.map((s) => (
                      <button
                        key={s.sharerId}
                        type="button"
                        onClick={() => {
                          setSelectedStreamId(s.sharerId);
                          setIsViewingRemoteScreen(true);
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <img
                          src={s.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                          alt={s.sharerName}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span>Смотреть: {s.sharerName}</span>
                        <Maximize2 size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {roomParticipants.map((p) => {
                const u = p.user;
                const isMe = u.id === currentUser.id;
                const isInvited = p.status === 'invited';
                const isSpeaking = isMe ? !isMuted : !!p.isSpeaking;

                return (
                  <div
                    key={u.id}
                    className={`relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 border-2 ${
                      isInvited
                        ? 'border-dashed border-zinc-600 bg-zinc-900/60 opacity-60 animate-pulse'
                        : isSpeaking
                        ? 'bg-emerald-500/10 border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-[#0e1621] border-emerald-500/50 hover:border-emerald-400'
                    }`}
                  >
                    <div className="relative mb-2.5">
                      {isSpeaking && !isInvited && (
                        <div className="absolute -inset-2.5 rounded-full bg-emerald-500/25 animate-ping" />
                      )}
                      <img
                        src={getAvatarUrl(u.avatar, u.name)}
                        onError={(e) => handleAvatarError(e, u.name)}
                        alt={u.name}
                        className={`w-16 h-16 rounded-full object-cover border-2 transition-all duration-300 ${
                          isInvited
                            ? 'grayscale border-zinc-600'
                            : isSpeaking
                            ? 'border-emerald-400 shadow-emerald-400/40'
                            : 'border-emerald-500'
                        }`}
                      />
                      {isMe && isHandRaised && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-1 rounded-full text-xs shadow-md animate-bounce">
                          ✋
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-xs text-center truncate max-w-[130px]">
                      <span className={`truncate ${isInvited ? 'text-zinc-400' : 'text-white'}`}>{u.name}</span>
                      {isMe && <span className="text-[#5288c1] font-normal">(Вы)</span>}
                      {isUserVerified(u) && <TelegramVerifiedBadge size={13} />}
                    </div>

                    <div className="text-[10px] mt-1 flex items-center gap-1">
                      {isInvited ? (
                        <span className="text-amber-400 font-medium animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          Приглашение...
                        </span>
                      ) : isSpeaking ? (
                        <span className="text-emerald-400 font-medium animate-pulse flex items-center gap-1">
                          <Volume2 size={11} /> Говорит...
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          В сети
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Real Audio Waveform Visualizer */}
          <div className="flex items-center justify-center gap-1 h-6 my-2">
            {visualizerHeights.map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isMuted ? 'bg-zinc-700' : 'bg-emerald-400'
                }`}
                style={{
                  height: isMuted ? '4px' : `${h}px`,
                }}
              />
            ))}
          </div>

          {/* SLIDE-OVER INVITE PARTICIPANTS DRAWER */}
          {isInviteOpen && (
            <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-[#17212b] border-l border-[#242f3d] z-30 flex flex-col shadow-2xl p-4 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <UserPlus size={16} className="text-[#5288c1]" />
                  <span>Пригласить в звонок</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="my-3 flex items-center bg-[#0e1621] px-3 py-1.5 rounded-xl border border-[#242f3d]">
                <Search size={14} className="text-[#7f91a4] mr-2 flex-shrink-0" />
                <input
                  type="text"
                  value={inviteSearchQuery}
                  onChange={(e) => setInviteSearchQuery(e.target.value)}
                  placeholder="Поиск контактов"
                  className="w-full bg-transparent text-xs text-white placeholder-[#7f91a4] outline-none"
                />
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
                {filteredUsersToInvite.length === 0 ? (
                  <p className="text-center text-xs text-[#7f91a4] my-6">Контакты не найдены</p>
                ) : (
                  filteredUsersToInvite.map((u) => {
                    const isAlreadyInRoom = roomParticipants.some((p) => p.user.id === u.id && p.status === 'active');
                    const isInvited = invitedUserIds.has(u.id);

                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[#202b36] transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={getAvatarUrl(u.avatar, u.name)}
                            onError={(e) => handleAvatarError(e, u.name)}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate flex items-center gap-1">
                              <span className="truncate">{u.name}</span>
                              {isUserVerified(u) && <TelegramVerifiedBadge size={12} />}
                            </div>
                            <span className="text-[10px] text-[#7f91a4] truncate">
                              @{u.username}
                            </span>
                          </div>
                        </div>

                        {isAlreadyInRoom ? (
                          <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
                            В звонке
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInviteUser(u)}
                            disabled={isInvited}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                              isInvited
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-[#2481cc] hover:bg-[#1e70b3] text-white active:scale-95 shadow-md'
                            }`}
                          >
                            {isInvited ? (
                              <>
                                <Check size={12} />
                                <span>Позван</span>
                              </>
                            ) : (
                              'Позвать'
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROL BAR */}
        <div className="pt-3.5 border-t border-[#242f3d] flex items-center justify-between flex-shrink-0">
          {/* Hand Raise Toggle */}
          <button
            type="button"
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition border cursor-pointer ${
              isHandRaised
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-amber-500/10'
                : 'bg-[#0e1621] text-[#7f91a4] border-[#242f3d] hover:text-white'
            }`}
          >
            <Hand size={16} />
            <span className="hidden sm:inline">{isHandRaised ? 'Рука поднята' : 'Поднять руку'}</span>
          </button>

          {/* Central Control Cluster */}
          <div className="flex items-center gap-3">
            {/* Screen Share Button */}
            <button
              type="button"
              onClick={(e) => handleToggleScreenShare(e)}
              className={`p-3 rounded-full transition shadow-md cursor-pointer ${
                isScreenSharing
                  ? 'bg-emerald-600 text-white shadow-emerald-600/40'
                  : 'bg-[#242f3d] hover:bg-[#202b36] text-white'
              }`}
              title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Создать демонстрацию экрана'}
            >
              <MonitorUp size={20} />
            </button>

            {/* Central Big Mic Toggle */}
            <button
              type="button"
              onClick={(e) => handleToggleMute(e)}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition transform hover:scale-105 active:scale-95 cursor-pointer ${
                isMuted
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/40 animate-pulse'
              }`}
              title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            {/* Speaker Sound Toggle */}
            <button
              type="button"
              onClick={(e) => handleToggleSpeaker(e)}
              className={`p-3 rounded-full transition shadow-md cursor-pointer ${
                !isSpeakerOn
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-[#242f3d] hover:bg-[#202b36] text-white'
              }`}
              title={isSpeakerOn ? 'Отключить динамик' : 'Включить динамик'}
            >
              {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>

          {/* Leave Voice Room Button */}
          <button
            type="button"
            onClick={(e) => handleLeaveRoom(e)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
            title="Завершить / выйти из голосового чата"
          >
            <PhoneOff size={15} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>
    </div>
  );
};
