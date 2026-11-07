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
  Wand2,
  Headphones,
  Film,
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Chat, User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { isUserVerified } from '../utils/verified';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import { VoiceEffectType, AVAILABLE_VOICE_EFFECTS, applyVoiceEffect } from '../utils/audioEffects';
import { ScreenSharePickerModal, DesktopSource } from './ScreenSharePickerModal';
import { WatchTogetherModal } from './WatchTogetherModal';
import {
  hasNativeAndroidScreenShare,
  startNativeAndroidScreenShare,
  forceStopNativeAndroidScreenShare,
  MobileScreenShareSession,
} from '../utils/mobileScreenShare';
import {
  updateActiveCallSystemNotification,
  clearCallSystemNotifications,
  onSystemCallAction,
} from '../utils/notifications';

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
  isMinimizedControlled?: boolean;
  onToggleMinimize?: (min: boolean) => void;
  onClose: () => void;
}

export const GroupVoiceChatModal: React.FC<GroupVoiceChatModalProps> = ({
  isOpen,
  chat,
  currentUser,
  allUsers,
  socket,
  isMinimizedControlled,
  onToggleMinimize,
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
  const [localMinimized, setLocalMinimized] = useState(false);
  const isMinimized = isMinimizedControlled !== undefined ? isMinimizedControlled : localMinimized;
  const setMinimizedState = useCallback((min: boolean) => {
    setLocalMinimized(min);
    if (onToggleMinimize) onToggleMinimize(min);
  }, [onToggleMinimize]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([
    8, 14, 10, 18, 12, 16, 20, 14, 18, 15, 10, 19,
  ]);
  const [selectedVoiceEffect, setSelectedVoiceEffect] = useState<VoiceEffectType>('normal');
  const [isVoiceEffectsOpen, setIsVoiceEffectsOpen] = useState(false);
  const [isVoiceMonitorOn, setIsVoiceMonitorOn] = useState(false);
  const [isScreenPickerOpen, setIsScreenPickerOpen] = useState(false);
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);
  const [desktopSources, setDesktopSources] = useState<DesktopSource[]>([]);

  const modalContainerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const effectAudioCtxRef = useRef<AudioContext | null>(null);
  const effectCleanupRef = useRef<(() => void) | null>(null);
  const mobileScreenSessionRef = useRef<MobileScreenShareSession | null>(null);

  const applyGroupVoiceEffect = useCallback(
    async (effect: VoiceEffectType, monitorEnabled: boolean) => {
      if (effectCleanupRef.current) {
        effectCleanupRef.current();
        effectCleanupRef.current = null;
      }
      if (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0) return;
      if (effect === 'normal' && !monitorEnabled) return;

      try {
        if (!effectAudioCtxRef.current || effectAudioCtxRef.current.state === 'closed') {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          effectAudioCtxRef.current = new AudioContextClass();
        }
        const ctx = effectAudioCtxRef.current;
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

        const rawTrack = localStreamRef.current.getAudioTracks()[0];
        const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));
        const busGain = ctx.createGain();
        busGain.gain.value = 1.0;
        const cleanup = applyVoiceEffect(ctx, source, busGain, effect);
        const dest = ctx.createMediaStreamDestination();
        busGain.connect(dest);

        let monGain: GainNode | null = null;
        if (monitorEnabled) {
          monGain = ctx.createGain();
          monGain.gain.value = 0.85;
          busGain.connect(monGain);
          monGain.connect(ctx.destination);
        }

        effectCleanupRef.current = () => {
          cleanup();
          try { source.disconnect(); } catch {}
          try { busGain.disconnect(); } catch {}
          if (monGain) {
            try { monGain.disconnect(); } catch {}
          }
        };
      } catch (err) {
        console.warn('Group voice effect error:', err);
      }
    },
    []
  );

  // Participants list (starts strictly with current user; invited members show in ringing state until joined)
  const [roomParticipants, setRoomParticipants] = useState<GroupParticipant[]>([]);

  // Initialize room participants on open (ONLY the active user who starts or joins, NO fake members)
  useEffect(() => {
    if (!isOpen || !chat || !currentUser) return;

    setRoomParticipants([{ user: currentUser, status: 'active', isSpeaking: !isMuted }]);
    setSeconds(0);
    setMinimizedState(false);
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

  const stopScreenSharing = useCallback(() => {
    setIsScreenSharing(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (mobileScreenSessionRef.current) {
      const session = mobileScreenSessionRef.current;
      mobileScreenSessionRef.current = null;
      session.stop();
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

  const startGroupScreenStream = async (screenStream: MediaStream, skipCanvasLoop = false) => {
    screenStreamRef.current = screenStream;
    setIsScreenSharing(true);
    setMinimizedState(false);
    setSelectedStreamId('local');

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(() => {});
    }

    if (!skipCanvasLoop) {
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
        if (
          !screenStreamRef.current ||
          screenStreamRef.current.getVideoTracks().length === 0 ||
          screenStreamRef.current.getVideoTracks()[0].readyState !== 'live'
        ) {
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
      }, 85);
    }

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
  };

  // Screen Sharing Toggle across Electron PC, Android APK MediaProjection, Desktop Web, or Mobile Browser
  const handleToggleScreenShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isScreenSharing) {
      const electronAPI = (window as unknown as { electronAPI?: { getDesktopSources?: () => Promise<DesktopSource[]> } }).electronAPI;
      if (electronAPI && typeof electronAPI.getDesktopSources === 'function') {
        try {
          const sources = await electronAPI.getDesktopSources();
          if (sources && sources.length > 0) {
            setDesktopSources(sources);
            setIsScreenPickerOpen(true);
            return;
          }
        } catch {}
      }

      if (hasNativeAndroidScreenShare()) {
        try {
          const session = await startNativeAndroidScreenShare(
            (frameData) => {
              if (socket && chat && currentUser) {
                socket.emit('voice_chat_screen_frame', {
                  chatId: chat.id,
                  frame: frameData,
                  sharerId: currentUser.id,
                  sharerName: currentUser.name,
                });
              }
            },
            () => {
              stopScreenSharing();
            }
          );
          mobileScreenSessionRef.current = session;
          await startGroupScreenStream(session.stream, true);
          return;
        } catch (err) {
          console.warn('Native Android group screen share canceled or failed:', err);
          return;
        }
      }

      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' } as any,
            audio: true,
          } as any);
          await startGroupScreenStream(screenStream);
          return;
        } catch (err: any) {
          if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return;
        }
      }

      try {
        const rearStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        await startGroupScreenStream(rearStream);
      } catch {
        alert(
          'Для демонстрации экрана телефона используйте приложение PRITONN на Android и разрешите запись экрана.'
        );
      }
    } else {
      stopScreenSharing();
    }
  };

  const handleSelectDesktopSource = async (source: DesktopSource) => {
    setIsScreenPickerOpen(false);
    try {
      const screenStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
          },
        },
      });
      await startGroupScreenStream(screenStream);
    } catch {
      try {
        const fallbackStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        await startGroupScreenStream(fallbackStream);
      } catch {}
    }
  };

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
  const handleLeaveRoom = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    forceStopNativeAndroidScreenShare();
    clearCallSystemNotifications();
    if (isScreenSharing) {
      stopScreenSharing();
    }
    if (effectCleanupRef.current) {
      effectCleanupRef.current();
      effectCleanupRef.current = null;
    }
    if (effectAudioCtxRef.current) {
      try {
        effectAudioCtxRef.current.close();
      } catch {}
      effectAudioCtxRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    onClose();
  }, [isScreenSharing, stopScreenSharing, onClose]);

  // Guaranteed unmount cleanup
  useEffect(() => {
    return () => {
      forceStopNativeAndroidScreenShare();
      clearCallSystemNotifications();
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (mobileScreenSessionRef.current) {
        try {
          mobileScreenSessionRef.current.stop();
        } catch {}
        mobileScreenSessionRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        screenStreamRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        localStreamRef.current = null;
      }
      if (effectCleanupRef.current) {
        try {
          effectCleanupRef.current();
        } catch {}
        effectCleanupRef.current = null;
      }
    };
  }, []);

  // Sync active OS notification
  useEffect(() => {
    if (isOpen && chat) {
      updateActiveCallSystemNotification({
        title: `🎙 ${chat.displayName || chat.name || 'Голосовой чат'}`,
        body: isScreenSharing
          ? '🖥️ Вы транслируете экран в голосовом чате'
          : `Голосовой чат (${formatTime(seconds)})`,
        isScreenSharing,
        chatId: chat.id,
      });
    }
  }, [isOpen, chat, isScreenSharing, seconds]);

  // Handle system notification action
  useEffect(() => {
    const unsub = onSystemCallAction(({ action }) => {
      if (action === 'hangup') {
        handleLeaveRoom();
      } else if (action === 'stop_screen') {
        stopScreenSharing();
      } else if (action === 'expand') {
        setMinimizedState(false);
      }
    });
    return unsub;
  }, [handleLeaveRoom, stopScreenSharing, setMinimizedState]);

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
        onClick={() => setMinimizedState(false)}
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
              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-semibold border border-rose-500/30">
                <Tv size={10} />
                <span>Экран ВКЛ</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2" onClick={(e) => e.stopPropagation()}>
          {isScreenSharing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                stopScreenSharing();
              }}
              className="px-2 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Остановить трансляцию экрана"
            >
              <MonitorUp size={13} />
              <span className="hidden xs:inline">Выкл. экран</span>
            </button>
          )}

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
            onClick={() => setMinimizedState(false)}
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
      className="fixed inset-0 h-[100dvh] bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 safe-area-modal select-none animate-fade-in"
    >
      <div
        ref={modalContainerRef}
        className={`w-full transition-all duration-300 relative flex flex-col overflow-hidden border border-[#242f3d] shadow-2xl text-[#f5f5f5] ${
          isTheaterActive
            ? isFullscreen
              ? 'fixed inset-0 z-50 rounded-none bg-black p-3 sm:p-4 safe-area-modal'
              : 'max-w-5xl h-[90dvh] max-h-[92dvh] bg-[#17212b] rounded-3xl p-3 sm:p-5'
            : 'max-w-2xl h-[86dvh] max-h-[90dvh] bg-[#17212b] rounded-3xl p-4 sm:p-6 animate-pop-in'
        }`}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#242f3d] flex-shrink-0 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <img
                src={getAvatarUrl(chatAvatar, chatName)}
                onError={(e) => handleAvatarError(e, chatName)}
                alt={chatName}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-emerald-500 shadow-md"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#17212b] rounded-full animate-ping" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base leading-tight truncate max-w-[150px] sm:max-w-xs">{chatName}</h3>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
                <span className="text-xs text-emerald-400 font-mono font-medium">
                  {formatTime(seconds)}
                </span>
              </div>
              <p className="text-[11px] text-[#7f91a4] flex items-center gap-1 mt-0.5">
                <Users size={11} />
                <span>{roomParticipants.length} участн.</span>
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
              onClick={() => setMinimizedState(true)}
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

        {/* Prominent Quick-Stop Badge when current user shares screen */}
        {isScreenSharing && (
          <div className="w-full mb-2 px-3 py-1.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl flex items-center justify-between gap-2 animate-fade-in flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
              <span className="text-xs font-bold text-rose-200 truncate">
                Вы делитесь своим экраном — все участники видят ваш экран
              </span>
            </div>
            <button
              type="button"
              onClick={stopScreenSharing}
              className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95"
            >
              <MonitorUp size={13} />
              <span>Выкл. экран</span>
            </button>
          </div>
        )}

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

        {/* Voice Changer Sheet */}
        {isVoiceEffectsOpen && (
          <div className="absolute inset-0 z-50 bg-[#17212b]/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 flex flex-col animate-fade-in text-[#f5f5f5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
              <div className="flex items-center gap-2">
                <Wand2 size={18} className="text-purple-400" />
                <h3 className="font-semibold text-sm">Модуляция голоса</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVoiceEffectsOpen(false)}
                className="p-1.5 rounded-lg text-[#7f91a4] hover:text-white hover:bg-[#242f3d] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-3">
              <button
                type="button"
                onClick={() => {
                  const next = !isVoiceMonitorOn;
                  setIsVoiceMonitorOn(next);
                  applyGroupVoiceEffect(selectedVoiceEffect, next);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isVoiceMonitorOn
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-[#0e1621] border-[#242f3d] text-[#7f91a4] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Headphones size={16} className={isVoiceMonitorOn ? 'text-emerald-400' : 'text-[#5288c1]'} />
                  <span>Прослушать свой голос (самопроверка)</span>
                </div>
                <span>{isVoiceMonitorOn ? 'ВКЛ' : 'ВЫКЛ'}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 no-scrollbar min-h-0">
              {AVAILABLE_VOICE_EFFECTS.map((eff) => (
                <button
                  key={eff.id}
                  type="button"
                  onClick={() => {
                    setSelectedVoiceEffect(eff.id);
                    setIsVoiceEffectsOpen(false);
                    applyGroupVoiceEffect(eff.id, isVoiceMonitorOn);
                  }}
                  className={`flex items-center justify-between p-3 rounded-2xl transition cursor-pointer border ${
                    selectedVoiceEffect === eff.id
                      ? 'bg-purple-600/35 border-purple-400 text-white font-semibold shadow-lg'
                      : 'bg-[#0e1621]/80 hover:bg-[#0e1621] border-white/5 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{eff.icon}</span>
                    <span className="text-xs sm:text-sm">{eff.name}</span>
                  </div>
                  {selectedVoiceEffect === eff.id && <Check size={16} className="text-purple-300" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM CONTROL BAR — Responsive & Wrapped so all buttons fit on phones */}
        <div className="pt-3 border-t border-[#242f3d] flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsHandRaised(!isHandRaised)}
            className={`w-11 h-11 sm:w-auto sm:px-3.5 sm:py-2.5 flex items-center justify-center gap-1.5 rounded-full sm:rounded-2xl text-xs font-semibold transition border cursor-pointer active:scale-95 ${
              isHandRaised
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-[#242f3d] text-[#f5f5f5] border-transparent hover:bg-[#2b394a]'
            }`}
            title={isHandRaised ? 'Опустить руку' : 'Поднять руку'}
          >
            <Hand size={18} />
            <span className="hidden sm:inline">{isHandRaised ? 'Рука поднята' : 'Рука'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isVideoEnabled
                ? 'bg-[#5288c1] text-white'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
          >
            {isVideoEnabled ? <Video size={19} /> : <VideoOff size={19} />}
          </button>

          <button
            type="button"
            onClick={(e) => handleToggleScreenShare(e)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isScreenSharing
                ? 'bg-emerald-600 text-white shadow-emerald-600/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isScreenSharing ? 'Остановить демонстрацию экрана' : 'Демонстрация экрана'}
          >
            <MonitorUp size={19} />
          </button>

          <button
            type="button"
            onClick={(e) => handleToggleMute(e)}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-xl transition transform hover:scale-105 active:scale-95 cursor-pointer ${
              isMuted
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/40'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <button
            type="button"
            onClick={(e) => handleToggleSpeaker(e)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              !isSpeakerOn
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isSpeakerOn ? 'Отключить динамик' : 'Включить динамик'}
          >
            {isSpeakerOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>

          <button
            type="button"
            onClick={() => setIsVoiceEffectsOpen(true)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer relative active:scale-95 ${
              selectedVoiceEffect !== 'normal' || isVoiceMonitorOn
                ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title="Модуляция голоса"
          >
            <Wand2 size={19} />
          </button>

          <button
            type="button"
            onClick={() => setIsWatchTogetherOpen(true)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer relative active:scale-95 ${
              isWatchTogetherOpen
                ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title="Кинозал • Совместный просмотр видео"
          >
            <Film size={19} />
          </button>

          <button
            type="button"
            onClick={(e) => handleLeaveRoom(e)}
            className="w-11 h-11 sm:w-auto sm:px-4 sm:py-2.5 flex items-center justify-center gap-1.5 rounded-full sm:rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-md shadow-rose-600/30 cursor-pointer active:scale-95"
            title="Завершить / выйти из голосового чата"
          >
            <PhoneOff size={17} />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </div>

      <WatchTogetherModal
        isOpen={isWatchTogetherOpen}
        onClose={() => setIsWatchTogetherOpen(false)}
        socket={socket}
        chatId={chat?.id || 'group_general'}
        currentUserId={currentUser?.id || ''}
      />

      <ScreenSharePickerModal
        isOpen={isScreenPickerOpen}
        sources={desktopSources}
        onSelectSource={handleSelectDesktopSource}
        onClose={() => setIsScreenPickerOpen(false)}
      />
    </div>
  );
};
