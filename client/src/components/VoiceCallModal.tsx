import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  MonitorUp,
  Shield,
  Sparkles,
  Maximize2,
  Minimize2,
  Minus,
  Tv,
  UserPlus,
  Check,
  X,
  Radio,
  Wand2,
  RefreshCw,
  Headphones,
  Film,
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Chat, User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { isUserVerified } from '../utils/verified';
import { ScreenSharePickerModal, DesktopSource } from './ScreenSharePickerModal';
import { WatchTogetherModal } from './WatchTogetherModal';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';
import { VoiceEffectType, AVAILABLE_VOICE_EFFECTS, applyVoiceEffect } from '../utils/audioEffects';
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

interface VoiceCallModalProps {
  chat: Chat | null;
  targetUser?: User | null;
  currentUser?: User | null;
  allUsers?: User[];
  socket?: Socket | null;
  isIncomingAccepted?: boolean;
  isMinimizedControlled?: boolean;
  onToggleMinimize?: (min: boolean) => void;
  onClose: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  chat,
  targetUser: propTargetUser,
  currentUser,
  allUsers = [],
  socket,
  isIncomingAccepted = false,
  isMinimizedControlled,
  onToggleMinimize,
  onClose,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<'calling' | 'connecting' | 'active' | 'no_answer' | 'declined'>(
    isIncomingAccepted ? 'active' : 'calling'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isRemoteCameraActive, setIsRemoteCameraActive] = useState(false);
  const [remoteCameraFrameUrl, setRemoteCameraFrameUrl] = useState<string | null>(null);
  const [isRemoteCamWebRtcPlaying, setIsRemoteCamWebRtcPlaying] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isViewingRemoteScreen, setIsViewingRemoteScreen] = useState(false);
  const [remoteFrameDataUrl, setRemoteFrameDataUrl] = useState<string | null>(null);
  const [isRemoteVideoPlaying, setIsRemoteVideoPlaying] = useState(false);
  const [remoteScreenSenderName, setRemoteScreenSenderName] = useState<string>('');
  const [selectedCallStream, setSelectedCallStream] = useState<'remote' | 'local'>('remote');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localMinimized, setLocalMinimized] = useState(false);
  const isMinimized = isMinimizedControlled !== undefined ? isMinimizedControlled : localMinimized;
  const setMinimizedState = useCallback((min: boolean) => {
    setLocalMinimized(min);
    if (onToggleMinimize) onToggleMinimize(min);
  }, [onToggleMinimize]);
  const [isSoloEchoMode, setIsSoloEchoMode] = useState(false);
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([
    8, 14, 10, 18, 12, 16, 20, 14, 18, 15, 10, 19,
  ]);

  // Screen share picker & in-call friend invites
  const [isScreenPickerOpen, setIsScreenPickerOpen] = useState(false);
  const [desktopSources, setDesktopSources] = useState<DesktopSource[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<string[]>([]);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Voice Changer & Background Blur states
  const [selectedVoiceEffect, setSelectedVoiceEffect] = useState<VoiceEffectType>('normal');
  const [isVoiceEffectsOpen, setIsVoiceEffectsOpen] = useState(false);
  const [isVoiceMonitorOn, setIsVoiceMonitorOn] = useState(false);
  const [isBackgroundBlur, setIsBackgroundBlur] = useState(false);
  const [isWatchTogetherOpen, setIsWatchTogetherOpen] = useState(false);
  const [isNoiseGateOn, setIsNoiseGateOn] = useState(true);
  const effectAudioCtxRef = useRef<AudioContext | null>(null);
  const effectCleanupRef = useRef<(() => void) | null>(null);
  const effectMonitorGainRef = useRef<GainNode | null>(null);
  const rawMicStreamRef = useRef<MediaStream | null>(null);
  const processedAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const mobileScreenSessionRef = useRef<MobileScreenShareSession | null>(null);
  const camFrameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyEffectToStream = useCallback(
    async (effect: VoiceEffectType, monitorEnabled: boolean) => {
      if (effectCleanupRef.current) {
        effectCleanupRef.current();
        effectCleanupRef.current = null;
      }
      if (effectMonitorGainRef.current) {
        try { effectMonitorGainRef.current.disconnect(); } catch {}
        effectMonitorGainRef.current = null;
      }

      const baseMicStream = rawMicStreamRef.current || localStreamRef.current;
      if (!baseMicStream || baseMicStream.getAudioTracks().length === 0) return;

      const rawTrack = baseMicStream.getAudioTracks()[0];

      if (effect === 'normal' && !monitorEnabled) {
        processedAudioTrackRef.current = null;
        rawTrack.enabled = !isMuted;
        const pc = peerConnectionRef.current;
        if (pc) {
          const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
          if (audioSender && audioSender.track !== rawTrack) {
            await audioSender.replaceTrack(rawTrack).catch(() => {});
          }
        }
        return;
      }

      try {
        if (!effectAudioCtxRef.current || effectAudioCtxRef.current.state === 'closed') {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          effectAudioCtxRef.current = new AudioContextClass();
        }
        const ctx = effectAudioCtxRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        const audioOnlyStream = new MediaStream([rawTrack]);
        const source = ctx.createMediaStreamSource(audioOnlyStream);
        const busGain = ctx.createGain();
        busGain.gain.value = 1.0;
        const destination = ctx.createMediaStreamDestination();

        const cleanup = applyVoiceEffect(ctx, source, busGain, effect);
        busGain.connect(destination);

        if (monitorEnabled) {
          const monitorGain = ctx.createGain();
          monitorGain.gain.value = 0.85;
          busGain.connect(monitorGain);
          monitorGain.connect(ctx.destination);
          effectMonitorGainRef.current = monitorGain;
        }

        effectCleanupRef.current = () => {
          cleanup();
          try { source.disconnect(); } catch {}
          try { busGain.disconnect(); } catch {}
        };

        const modulatedTrack = destination.stream.getAudioTracks()[0];
        if (modulatedTrack) {
          modulatedTrack.enabled = !isMuted;
          processedAudioTrackRef.current = modulatedTrack;
          const pc = peerConnectionRef.current;
          if (pc) {
            const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
            if (audioSender) {
              await audioSender.replaceTrack(modulatedTrack).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Error applying in-call voice effect:', err);
      }
    },
    [isMuted]
  );

  const handleSelectVoiceEffect = (effect: VoiceEffectType) => {
    setSelectedVoiceEffect(effect);
    setIsVoiceEffectsOpen(false);
    applyEffectToStream(effect, isVoiceMonitorOn);
  };

  const handleToggleVoiceMonitor = () => {
    const next = !isVoiceMonitorOn;
    setIsVoiceMonitorOn(next);
    applyEffectToStream(selectedVoiceEffect, next);
  };

  const toggleCallRecording = () => {
    if (isRecordingCall) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingCall(false);
      alert('Запись звонка остановлена и загружена на ваше устройство!');
    } else {
      try {
        const stream = localStreamRef.current || remoteStreamRef.current;
        if (!stream) {
          alert('Нет активного аудиопотока для записи');
          return;
        }
        const mediaRecorder = new MediaRecorder(stream);
        recordedChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `PRITONN_Call_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecordingCall(true);
      } catch (err) {
        console.warn('Call recording error:', err);
      }
    }
  };

  const localScreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const ringOscillatorsRef = useRef<OscillatorNode[]>([]);
  const ringGainRef = useRef<GainNode | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCallConnectedRef = useRef(isIncomingAccepted);

  // Telegram 4-emoji security verification code
  const [encryptionEmojis] = useState(() => ['🦊', '🍇', '💎', '🚀']);

  const targetUserId =
    propTargetUser?.id ||
    (chat?.type === 'direct'
      ? chat.members?.find((id) => id !== currentUser?.id) || chat.targetUserId
      : chat?.targetUserId) ||
    null;

  const targetName =
    propTargetUser?.name ||
    chat?.displayName ||
    chat?.name ||
    'Собеседник';

  const targetAvatar =
    propTargetUser?.avatar ||
    (chat?.type === 'saved'
      ? '/telegram-saved.svg'
      : chat?.displayAvatar || chat?.avatar);

  // Callback ref for local screen share video
  const setLocalScreenVideo = useCallback((node: HTMLVideoElement | null) => {
    localScreenVideoRef.current = node;
    if (node && screenStreamRef.current) {
      node.srcObject = screenStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Callback ref for local camera PiP video
  const setLocalCameraVideo = useCallback((node: HTMLVideoElement | null) => {
    localCameraVideoRef.current = node;
    if (node && localStreamRef.current) {
      node.srcObject = localStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Callback ref for remote video: binds stream immediately upon mounting
  const setRemoteVideo = useCallback((node: HTMLVideoElement | null) => {
    remoteVideoRef.current = node;
    if (node) {
      const stream = remoteVideoStreamRef.current || remoteStreamRef.current;
      if (stream) {
        node.srcObject = stream;
        node.play().catch(() => {});
      }
    }
  }, []);

  // Keep video elements synced whenever camera/screen layout toggles
  useEffect(() => {
    if (localCameraVideoRef.current && localStreamRef.current && isVideoEnabled) {
      if (localCameraVideoRef.current.srcObject !== localStreamRef.current) {
        localCameraVideoRef.current.srcObject = localStreamRef.current;
      }
      localCameraVideoRef.current.play().catch(() => {});
    }
    if (localScreenVideoRef.current && screenStreamRef.current && isScreenSharing) {
      if (localScreenVideoRef.current.srcObject !== screenStreamRef.current) {
        localScreenVideoRef.current.srcObject = screenStreamRef.current;
      }
      localScreenVideoRef.current.play().catch(() => {});
    }
    if (remoteVideoRef.current && remoteVideoStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteVideoStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteVideoStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [isVideoEnabled, isRemoteCameraActive, isScreenSharing, isViewingRemoteScreen]);

  // Callback ref for remote audio to guarantee immediate autoplay even if track arrived before DOM mount
  const setRemoteAudio = useCallback((node: HTMLAudioElement | null) => {
    remoteAudioRef.current = node;
    if (node) {
      node.muted = !isSpeakerOn;
      node.volume = 1.0;
      if (remoteStreamRef.current) {
        node.srcObject = remoteStreamRef.current;
        node.play().catch((err) => {
          console.warn('Audio play prevented on mount, waiting for user interaction:', err);
        });
      }
    }
  }, [isSpeakerOn]);

  // Stop ringtone helper
  const stopRingtone = useCallback(() => {
    isCallConnectedRef.current = true;
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (ringGainRef.current) {
      try {
        ringGainRef.current.gain.setValueAtTime(0, audioContextRef.current?.currentTime || 0);
        ringGainRef.current.disconnect();
      } catch {}
      ringGainRef.current = null;
    }
    ringOscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {}
    });
    ringOscillatorsRef.current = [];
  }, []);

  // Play Telegram Dual-tone Ringing
  const playRingtone = useCallback(() => {
    // If call is already connected or accepted, NEVER play ringtone!
    if (isCallConnectedRef.current || isIncomingAccepted) return;

    // Clear any previous interval first so it can NEVER leak or double-play
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    ringOscillatorsRef.current.forEach((osc) => {
      try { osc.stop(0); osc.disconnect(); } catch {}
    });
    ringOscillatorsRef.current = [];

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const ring = () => {
        // If subscriber answered in the meantime, stop immediately!
        if (isCallConnectedRef.current) {
          if (ringIntervalRef.current) {
            clearInterval(ringIntervalRef.current);
            ringIntervalRef.current = null;
          }
          return;
        }
        try {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          ringGainRef.current = gain;

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(425, ctx.currentTime);
          osc2.frequency.setValueAtTime(450, ctx.currentTime);

          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 1.2);
          osc2.stop(ctx.currentTime + 1.2);

          ringOscillatorsRef.current = [osc1, osc2];
        } catch {}
      };

      ring();
      ringIntervalRef.current = setInterval(ring, 2800);
    } catch {}
  }, [isIncomingAccepted]);

  // Play connect chime
  const playConnectChime = useCallback(() => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }, []);

  // Initialize WebRTC Peer Connection with queued candidate support
  const initPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);

      if (event.track.kind === 'video') {
        remoteVideoStreamRef.current = stream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }
        setIsRemoteCameraActive(true);

        event.track.onended = () => {
          setIsRemoteCameraActive(false);
          setIsRemoteScreenSharing(false);
          setIsViewingRemoteScreen(false);
          setIsRemoteVideoPlaying(false);
          setRemoteFrameDataUrl(null);
        };
      }

      if (event.track.kind === 'audio') {
        remoteStreamRef.current = stream;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.muted = !isSpeakerOn;
          remoteAudioRef.current.volume = 1.0;
          remoteAudioRef.current.play().catch((err) => {
            console.warn('Audio play error in ontrack:', err);
          });
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && targetUserId) {
        socket.emit('webrtc_ice_candidate', {
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        isCallConnectedRef.current = true;
        setStatus('active');
        stopRingtone();
        if (remoteAudioRef.current && remoteStreamRef.current) {
          remoteAudioRef.current.srcObject = remoteStreamRef.current;
          remoteAudioRef.current.play().catch(() => {});
        }
      }
    };

    return pc;
  }, [socket, targetUserId, stopRingtone, isSpeakerOn]);

  const stopCameraFrameFallback = useCallback(() => {
    if (camFrameIntervalRef.current) {
      clearInterval(camFrameIntervalRef.current);
      camFrameIntervalRef.current = null;
    }
  }, []);

  const startCameraFrameFallback = useCallback(
    (stream: MediaStream) => {
      stopCameraFrameFallback();
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;

      const captureVideo = document.createElement('video');
      captureVideo.muted = true;
      captureVideo.autoplay = true;
      captureVideo.playsInline = true;
      captureVideo.srcObject = new MediaStream([videoTrack]);
      captureVideo.play().catch(() => {});

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      camFrameIntervalRef.current = setInterval(() => {
        if (!videoTrack || videoTrack.readyState !== 'live') {
          stopCameraFrameFallback();
          return;
        }
        if (captureVideo.videoWidth > 0 && captureVideo.videoHeight > 0 && ctx) {
          const maxDim = 480;
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
          ctx.drawImage(captureVideo, 0, 0, w, h);
          const frame = canvas.toDataURL('image/jpeg', 0.55);
          if (socket && targetUserId && currentUser) {
            socket.emit('call_camera_frame', {
              targetUserId,
              frame,
              senderId: currentUser.id,
            });
          }
        }
      }, 125);
    },
    [socket, targetUserId, currentUser, stopCameraFrameFallback]
  );

  // Acquire local audio media stream on call startup
  const setupLocalMedia = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      localStreamRef.current = stream;
      rawMicStreamRef.current = new MediaStream(stream.getAudioTracks());

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
          const ctx = audioContextRef.current;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVisualizer = () => {
            if (!localStreamRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            const heights = Array.from({ length: 12 }, (_, i) => {
              const val = dataArray[i * 2] || 0;
              return Math.max(6, Math.min(28, Math.round((val / 255) * 26) + 6));
            });
            setVisualizerHeights(heights);
            requestAnimationFrame(updateVisualizer);
          };
          updateVisualizer();
        }
      } catch {}

      return stream;
    } catch (err) {
      console.warn('Microphone permission not granted or solo test:', err);
      return null;
    }
  }, []);

  // Start Call Flow & Socket Listeners
  useEffect(() => {
    let callTimeoutTimer: ReturnType<typeof setTimeout>;

    if (!isIncomingAccepted && !isCallConnectedRef.current) {
      playRingtone();

      if (socket && currentUser && targetUserId) {
        socket.emit('call_user', {
          callerId: currentUser.id,
          callerName: currentUser.name,
          callerAvatar: currentUser.avatar,
          callerVerified: isUserVerified(currentUser),
          targetUserId,
          chatId: chat?.id,
          isVideo: false,
        });
      }

      callTimeoutTimer = setTimeout(() => {
        if (!isCallConnectedRef.current) {
          stopRingtone();
          setStatus('no_answer');
          if (socket && targetUserId && currentUser) {
            socket.emit('call_end', {
              callerId: currentUser.id,
              targetUserId,
              duration: 0,
              status: 'missed',
              chatId: chat?.id,
            });
          }
          setTimeout(() => {
            onClose();
          }, 2200);
        }
      }, 28000);
    } else {
      isCallConnectedRef.current = true;
      stopRingtone();
      playConnectChime();
      setStatus('active');
    }

    setupLocalMedia().then((stream) => {
      if (stream) {
        const pc = initPeerConnection();
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          const trackToSend =
            track.kind === 'audio' && processedAudioTrackRef.current
              ? processedAudioTrackRef.current
              : track;
          const alreadyAdded = senders.some((s) => s.track?.kind === trackToSend.kind);
          if (!alreadyAdded) {
            try {
              pc.addTrack(trackToSend, stream);
            } catch {}
          }
        });
      }
    });

    if (socket) {
      const handleAccepted = async () => {
        clearTimeout(callTimeoutTimer);
        isCallConnectedRef.current = true;
        stopRingtone();
        playConnectChime();
        setStatus('active');

        const pc = initPeerConnection();
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc_offer', {
            targetUserId,
            sdp: offer,
          });
        } catch (err) {
          console.error('Error creating WebRTC offer:', err);
        }
      };

      const handleOffer = async ({ senderId, sdp }: { senderId: string; sdp: RTCSessionDescriptionInit }) => {
        isCallConnectedRef.current = true;
        stopRingtone();
        const pc = initPeerConnection();
        try {
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => {
              const trackToSend =
                track.kind === 'audio' && processedAudioTrackRef.current
                  ? processedAudioTrackRef.current
                  : track;
              const senders = pc.getSenders();
              const existingSender = senders.find((s) => s.track && s.track.kind === trackToSend.kind);
              if (!existingSender) {
                try {
                  pc.addTrack(trackToSend, localStreamRef.current!);
                } catch {}
              }
            });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc_answer', {
            targetUserId: senderId,
            sdp: answer,
          });
        } catch (err) {
          console.error('Error handling WebRTC offer:', err);
        }
      };

      const handleAnswer = async ({ sdp }: { senderId: string; sdp: RTCSessionDescriptionInit }) => {
        isCallConnectedRef.current = true;
        stopRingtone();
        setStatus('active');
        const pc = initPeerConnection();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            if (cand) {
              await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
            }
          }
        } catch (err) {
          console.error('Error setting remote description from answer:', err);
        }
      };

      const handleIceCandidate = async ({ candidate }: { senderId: string; candidate: RTCIceCandidateInit }) => {
        const pc = initPeerConnection();
        try {
          if (candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            } else {
              pendingCandidatesRef.current.push(candidate);
            }
          }
        } catch {}
      };

      const handleScreenShareStatus = ({
        callerName,
        isSharing,
      }: {
        callerId: string;
        callerName: string;
        isSharing: boolean;
      }) => {
        setIsRemoteScreenSharing(isSharing);
        if (isSharing) {
          setRemoteScreenSenderName(callerName || 'Собеседник');
          setIsViewingRemoteScreen(true);
          setMinimizedState(false);
        } else {
          setIsViewingRemoteScreen(false);
          setIsRemoteVideoPlaying(false);
          setRemoteFrameDataUrl(null);
        }
      };

      const handleScreenStreamFrame = ({
        frame,
        senderName,
      }: {
        frame: string;
        senderId?: string;
        senderName?: string;
      }) => {
        setRemoteFrameDataUrl(frame);
        setIsRemoteScreenSharing(true);
        setIsViewingRemoteScreen(true);
        if (senderName) {
          setRemoteScreenSenderName(senderName);
        }
      };

      const handleCameraFrame = ({ frame }: { frame: string; senderId?: string }) => {
        setRemoteCameraFrameUrl(frame);
        setIsRemoteCameraActive(true);
      };

      const handleRejected = () => {
        clearTimeout(callTimeoutTimer);
        stopRingtone();
        setStatus('declined');
        setTimeout(() => onClose(), 900);
      };

      const handleEnded = () => {
        clearTimeout(callTimeoutTimer);
        stopRingtone();
        onClose();
      };

      const handleCameraStatus = ({
        isVideo,
      }: {
        callerId: string;
        callerName?: string;
        isVideo: boolean;
      }) => {
        setIsRemoteCameraActive(isVideo);
        if (!isVideo) {
          setRemoteCameraFrameUrl(null);
          setIsRemoteCamWebRtcPlaying(false);
        }
      };

      socket.on('call_accepted', handleAccepted);
      socket.on('webrtc_offer', handleOffer);
      socket.on('webrtc_answer', handleAnswer);
      socket.on('webrtc_ice_candidate', handleIceCandidate);
      socket.on('call_camera_status', handleCameraStatus);
      socket.on('call_camera_frame', handleCameraFrame);
      socket.on('call_screen_share_status', handleScreenShareStatus);
      socket.on('screen_stream_frame', handleScreenStreamFrame);
      socket.on('call_rejected', handleRejected);
      socket.on('call_ended', handleEnded);

      return () => {
        clearTimeout(callTimeoutTimer);
        stopRingtone();
        socket.off('call_accepted', handleAccepted);
        socket.off('webrtc_offer', handleOffer);
        socket.off('webrtc_answer', handleAnswer);
        socket.off('webrtc_ice_candidate', handleIceCandidate);
        socket.off('call_camera_status', handleCameraStatus);
        socket.off('call_camera_frame', handleCameraFrame);
        socket.off('call_screen_share_status', handleScreenShareStatus);
        socket.off('screen_stream_frame', handleScreenStreamFrame);
        socket.off('call_rejected', handleRejected);
        socket.off('call_ended', handleEnded);
      };
    }
  }, [
    socket,
    currentUser,
    targetUserId,
    isIncomingAccepted,
    chat?.id,
    playRingtone,
    stopRingtone,
    playConnectChime,
    setupLocalMedia,
    initPeerConnection,
    onClose,
  ]);

  // Duration counter
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (status === 'active') {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // Mute Mic (including raw + modulated voice tracks)
  const handleToggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (processedAudioTrackRef.current) {
      processedAudioTrackRef.current.enabled = !nextMuted;
    }
  };

  // Speaker Mute
  const handleToggleSpeaker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextSpeaker;
    }
  };

  // Find or attach video sender safely without touching audio sender
  const replaceOrAddVideoTrack = async (pc: RTCPeerConnection, track: MediaStreamTrack | null, stream?: MediaStream) => {
    const senders = pc.getSenders();
    const videoSender =
      senders.find((s) => s.track?.kind === 'video') ||
      pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video')?.sender;

    if (videoSender) {
      await videoSender.replaceTrack(track).catch(() => {});
    } else if (track && stream) {
      try {
        pc.addTrack(track, stream);
      } catch {}
    }
  };

  // Stop Screen Share
  const stopScreenSharing = useCallback(async () => {
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
    if (peerConnectionRef.current) {
      const camTrack =
        isVideoEnabled && localStreamRef.current
          ? localStreamRef.current.getVideoTracks()[0] || null
          : null;
      await replaceOrAddVideoTrack(
        peerConnectionRef.current,
        camTrack,
        localStreamRef.current || undefined
      );
    }
    if (socket && targetUserId && currentUser) {
      socket.emit('call_screen_share', {
        callerId: currentUser.id,
        callerName: currentUser.name,
        targetUserId,
        isSharing: false,
      });
    }
  }, [isVideoEnabled, socket, targetUserId, currentUser]);

  // Helper to acquire camera with multi-step hardware fallback
  const openCameraWithMode = async (mode: 'user' | 'environment') => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.stop();
        localStreamRef.current?.removeTrack(t);
      });
    }

    let camStream: MediaStream | null = null;
    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      { video: { facingMode: mode }, audio: false },
      { video: true, audio: false },
    ];

    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try {
        camStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (camStream && camStream.getVideoTracks().length > 0) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!camStream || camStream.getVideoTracks().length === 0) {
      throw lastErr || new Error('Camera unavailable');
    }

    const newVideoTrack = camStream.getVideoTracks()[0];
    newVideoTrack.enabled = true;

    if (localStreamRef.current) {
      localStreamRef.current.addTrack(newVideoTrack);
    } else {
      localStreamRef.current = camStream;
    }

    if (localCameraVideoRef.current) {
      localCameraVideoRef.current.srcObject = localStreamRef.current;
      localCameraVideoRef.current.play().catch(() => {});
    }

    startCameraFrameFallback(localStreamRef.current);

    if (!isScreenSharing) {
      const pc = initPeerConnection();
      await replaceOrAddVideoTrack(pc, newVideoTrack, localStreamRef.current);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket && targetUserId) {
          socket.emit('webrtc_offer', {
            targetUserId,
            sdp: offer,
          });
        }
      } catch (err) {
        console.warn('Renegotiation offer error on camera toggle:', err);
      }
    }

    if (socket && targetUserId && currentUser) {
      socket.emit('call_camera_status', {
        callerId: currentUser.id,
        callerName: currentUser.name,
        targetUserId,
        isVideo: true,
      });
    }
  };

  // Camera Video toggle with real WebRTC track streaming & frame fallback
  const handleToggleCamera = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextVideoState = !isVideoEnabled;

    if (nextVideoState) {
      setIsVideoEnabled(true);
      try {
        await openCameraWithMode(cameraFacingMode);
      } catch (err) {
        console.warn('Camera permission or error:', err);
        setIsVideoEnabled(false);
        stopCameraFrameFallback();
        alert(
          'Не удалось включить видеокамеру. Проверьте разрешение на доступ к камере в настройках приложения.'
        );
      }
    } else {
      setIsVideoEnabled(false);
      stopCameraFrameFallback();

      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => {
          t.stop();
          localStreamRef.current?.removeTrack(t);
        });
      }

      if (peerConnectionRef.current && !isScreenSharing) {
        await replaceOrAddVideoTrack(peerConnectionRef.current, null);
        try {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          if (socket && targetUserId) {
            socket.emit('webrtc_offer', {
              targetUserId,
              sdp: offer,
            });
          }
        } catch {}
      }

      if (socket && targetUserId && currentUser) {
        socket.emit('call_camera_status', {
          callerId: currentUser.id,
          callerName: currentUser.name,
          targetUserId,
          isVideo: false,
        });
      }
    }
  };

  // Switch between front and rear camera on mobile
  const handleSwitchCamera = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextMode);
    if (isVideoEnabled) {
      try {
        await openCameraWithMode(nextMode);
      } catch (err) {
        console.warn('Switch camera error:', err);
      }
    }
  };

  // Stream setup helper for both full screen & individual window selection
  const startStreamWithMedia = async (screenStream: MediaStream, skipCanvasLoop = false) => {
    screenStreamRef.current = screenStream;
    setIsScreenSharing(true);
    setMinimizedState(false);

    if (localScreenVideoRef.current) {
      localScreenVideoRef.current.srcObject = screenStream;
      localScreenVideoRef.current.play().catch(() => {});
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
            if (socket && targetUserId && currentUser) {
              socket.emit('screen_stream_frame', {
                targetUserId,
                frame: frameData,
                senderId: currentUser.id,
                senderName: currentUser.name,
              });
            }
          }
        }
      }, 85);
    }

    const pc = initPeerConnection();
    const videoTrack = screenStream.getVideoTracks()[0];
    if (videoTrack) {
      await replaceOrAddVideoTrack(pc, videoTrack, screenStream);
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socket && targetUserId) {
        socket.emit('webrtc_offer', {
          targetUserId,
          sdp: offer,
        });
      }
    } catch (err) {
      console.warn('Renegotiation offer error:', err);
    }

    if (socket && targetUserId && currentUser) {
      socket.emit('call_screen_share', {
        callerId: currentUser.id,
        callerName: currentUser.name,
        targetUserId,
        isSharing: true,
      });
    }

    if (videoTrack) {
      videoTrack.onended = () => {
        stopScreenSharing();
      };
    }
  };

  // Start Screen Share across Electron PC, Android APK MediaProjection, Desktop Web, or Mobile Browser
  const handleToggleScreenShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isScreenSharing) {
      // 1. Electron Desktop Window / Screen Picker
      const electronAPI = (window as unknown as { electronAPI?: { getDesktopSources?: () => Promise<DesktopSource[]> } }).electronAPI;
      if (electronAPI && typeof electronAPI.getDesktopSources === 'function') {
        try {
          const sources = await electronAPI.getDesktopSources();
          if (sources && sources.length > 0) {
            setDesktopSources(sources);
            setIsScreenPickerOpen(true);
            return;
          }
        } catch (err) {
          console.warn('Error fetching desktop sources in Electron, fallback to getDisplayMedia:', err);
        }
      }

      // 2. Native Android APK MediaProjection Bridge
      if (hasNativeAndroidScreenShare()) {
        try {
          const session = await startNativeAndroidScreenShare(
            (frameData) => {
              if (socket && targetUserId && currentUser) {
                socket.emit('screen_stream_frame', {
                  targetUserId,
                  frame: frameData,
                  senderId: currentUser.id,
                  senderName: currentUser.name,
                });
              }
            },
            () => {
              stopScreenSharing();
            }
          );
          mobileScreenSessionRef.current = session;
          await startStreamWithMedia(session.stream, true);
          return;
        } catch (err: any) {
          console.warn('Native Android screen share canceled or failed:', err);
          return;
        }
      }

      // 3. Standard Web Browser getDisplayMedia
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
            } as any,
            audio: true,
          } as any);

          await startStreamWithMedia(screenStream);
          return;
        } catch (err: any) {
          console.warn('getDisplayMedia error or canceled:', err);
          if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
            return;
          }
        }
      }

      // 4. Mobile Web Browser fallback (share rear camera view when outside native APK)
      try {
        const rearStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        await startStreamWithMedia(rearStream);
      } catch {
        alert(
          'Для системной демонстрации экрана телефона используйте приложение PRITONN на Android и разрешите запись экрана.'
        );
      }
    } else {
      stopScreenSharing();
    }
  };

  // User picked a specific window or screen from the picker
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

      await startStreamWithMedia(screenStream);
    } catch (err) {
      console.warn('Failed to capture chosen window/screen:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        await startStreamWithMedia(fallbackStream);
      } catch {}
    }
  };

  // Filter available users for in-call invitation
  const availableUsersToInvite = (allUsers || []).filter(
    (u) =>
      u.id !== currentUser?.id &&
      u.id !== targetUserId &&
      (u.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(inviteSearch.toLowerCase()))
  );

  // Invite another friend into the call
  const handleInviteUser = (u: User) => {
    if (socket && currentUser) {
      socket.emit('voice_chat_invite', {
        chatId: chat?.id || `call_${currentUser.id}_${u.id}`,
        chatName: chat?.displayName || chat?.name || `Звонок с ${currentUser.name}`,
        inviterName: currentUser.name,
        inviterId: currentUser.id,
        targetUserId: u.id,
      });

      socket.emit('call_user', {
        callerId: currentUser.id,
        callerName: currentUser.name,
        callerAvatar: currentUser.avatar,
        callerVerified: isUserVerified(currentUser),
        targetUserId: u.id,
        chatId: chat?.id,
        isVideo: isVideoEnabled,
      });

      setInvitedUserIds((prev) => [...prev, u.id]);
      setInviteToast(`Приглашение отправлено ${u.name}`);
      setTimeout(() => setInviteToast(null), 3500);
    }
  };

  // Fullscreen Theater
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

  // End Call & Cleanup
  const handleEndCall = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    stopRingtone();
    stopCameraFrameFallback();
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
    if (socket && targetUserId && currentUser) {
      const actualCallerId = isIncomingAccepted ? targetUserId : currentUser.id;
      const actualTargetUserId = isIncomingAccepted ? currentUser.id : targetUserId;
      socket.emit('call_end', {
        callerId: actualCallerId,
        targetUserId: actualTargetUserId,
        duration: seconds,
        isVideo: isVideoEnabled || isScreenSharing,
        chatId: chat?.id,
      });
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (rawMicStreamRef.current) {
      rawMicStreamRef.current.getTracks().forEach((t) => t.stop());
      rawMicStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    onClose();
  }, [
    stopRingtone,
    stopCameraFrameFallback,
    isScreenSharing,
    stopScreenSharing,
    socket,
    targetUserId,
    currentUser,
    isIncomingAccepted,
    seconds,
    isVideoEnabled,
    chat?.id,
    onClose,
  ]);

  // Guaranteed unmount cleanup (prevents ghost screen shares & background WebRTC audio)
  useEffect(() => {
    return () => {
      stopRingtone();
      stopCameraFrameFallback();
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
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        localStreamRef.current = null;
      }
      if (rawMicStreamRef.current) {
        rawMicStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        rawMicStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        screenStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch {}
        peerConnectionRef.current = null;
      }
      if (effectCleanupRef.current) {
        try {
          effectCleanupRef.current();
        } catch {}
        effectCleanupRef.current = null;
      }
    };
  }, [stopRingtone, stopCameraFrameFallback]);

  // Sync active OS Call & Screen Sharing Notification
  useEffect(() => {
    if (status === 'active' || status === 'connecting') {
      updateActiveCallSystemNotification({
        title: `📞 ${targetName}`,
        body: isScreenSharing
          ? '🖥️ Вы транслируете экран в звонке'
          : `Звонок активен (${formatTime(seconds)})`,
        isScreenSharing,
        chatId: chat?.id,
      });
    }
  }, [status, isScreenSharing, seconds, targetName, chat?.id]);

  // Handle system actions from Android shade / PC toast / Web SW
  useEffect(() => {
    const unsub = onSystemCallAction(({ action }) => {
      if (action === 'hangup') {
        handleEndCall();
      } else if (action === 'stop_screen') {
        stopScreenSharing();
      } else if (action === 'expand') {
        setMinimizedState(false);
      }
    });
    return unsub;
  }, [handleEndCall, stopScreenSharing, setMinimizedState]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const effectiveSelectedCallStream =
    isScreenSharing && isRemoteScreenSharing
      ? selectedCallStream
      : isScreenSharing
      ? 'local'
      : 'remote';

  const isScreenSharingActive =
    isScreenSharing || (isRemoteScreenSharing && isViewingRemoteScreen);
  const isCameraVideoActive = isVideoEnabled || isRemoteCameraActive;
  const isTheaterActive = isScreenSharingActive || isCameraVideoActive;

  // --- FLOATING MINIMIZED CALL WIDGET (Telegram Dynamic Island) ---
  if (isMinimized) {
    return (
      <>
        <audio ref={setRemoteAudio} autoPlay playsInline muted={!isSpeakerOn} />

        <div
          onClick={() => setMinimizedState(false)}
          style={{ zIndex: 9999 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 bg-[#17212b]/95 hover:bg-[#202b36] border border-[#2b5278] hover:border-[#5288c1] backdrop-blur-md rounded-2xl px-3.5 py-2 shadow-2xl flex items-center gap-3 cursor-pointer transition-all duration-200 select-none group max-w-[94vw] animate-pop-in"
          title="Нажмите в любое место, чтобы вернуться к звонку"
        >
          <div className="relative flex-shrink-0">
            <img
              src={getAvatarUrl(targetAvatar, targetName)}
              onError={(e) => handleAvatarError(e, targetName)}
              alt={targetName}
              className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#17212b] rounded-full animate-pulse" />
          </div>

          <div className="flex flex-col min-w-0 pr-1">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-white truncate">
              <span className="truncate">{targetName}</span>
              {isUserVerified(propTargetUser || chat?.targetUser) && <TelegramVerifiedBadge size={13} />}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-400 font-mono font-medium">
                {status === 'active' ? formatTime(seconds) : status === 'calling' ? 'Вызов...' : 'Соединение...'}
              </span>
              {(isScreenSharing || isRemoteScreenSharing) && (
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[#2481cc]/25 text-[#5288c1] text-[10px] font-semibold border border-[#2481cc]/30">
                  <Tv size={10} />
                  <span>Экран</span>
                </span>
              )}
              {(isVideoEnabled || isRemoteCameraActive) && !(isScreenSharing || isRemoteScreenSharing) && (
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                  <Video size={10} />
                  <span>Видео</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-1" onClick={(e) => e.stopPropagation()}>
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
              onClick={(e) => handleEndCall(e)}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-md cursor-pointer"
              title="Завершить звонок"
            >
              <PhoneOff size={15} />
            </button>

            <button
              type="button"
              onClick={() => setMinimizedState(false)}
              className="px-2.5 py-1.5 rounded-xl bg-[#2481cc] hover:bg-[#1e70b3] text-white transition shadow-md flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
              title="Развернуть звонок"
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline">Развернуть</span>
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      style={{ zIndex: 9990 }}
      className="fixed inset-0 h-[100dvh] bg-black/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 safe-area-modal select-none animate-fade-in"
    >
      <audio ref={setRemoteAudio} autoPlay playsInline muted={!isSpeakerOn} />

      <div
        ref={modalContainerRef}
        className={`w-full transition-all duration-300 relative flex flex-col items-center overflow-hidden border border-[#242f3d] shadow-2xl text-[#f5f5f5] ${
          isTheaterActive
            ? isFullscreen
              ? 'fixed inset-0 z-50 rounded-none bg-black p-3 sm:p-4 safe-area-modal'
              : 'max-w-5xl h-[90dvh] max-h-[92dvh] bg-[#17212b] rounded-3xl p-3 sm:p-5'
            : 'max-w-md max-h-[92dvh] bg-[#17212b] rounded-3xl p-4 sm:p-6 animate-pop-in'
        }`}
      >
        {/* Top Header: Security, Status & Controls */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#242f3d]/70 mb-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-1 text-xs text-[#5288c1]">
              <Shield size={14} className="text-[#5288c1] flex-shrink-0" />
              <span className="font-medium text-[11px] truncate">E2E WebRTC</span>
            </div>
            {isTheaterActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                HD
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <div
              className="hidden xs:flex sm:flex items-center gap-1 bg-[#0e1621] px-2 py-1 rounded-full border border-[#242f3d]"
              title="Ключ сквозного шифрования"
            >
              {encryptionEmojis.map((emoji, i) => (
                <span key={i} className="text-[11px] select-none">
                  {emoji}
                </span>
              ))}
            </div>

            {isTheaterActive && (
              <button
                type="button"
                onClick={(e) => toggleFullscreen(e)}
                className="p-2 rounded-xl bg-[#242f3d] hover:bg-[#2c394a] text-white transition cursor-pointer"
                title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Во весь экран'}
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#242f3d] hover:bg-[#2c394a] text-white transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
              title="Пригласить участников в звонок"
            >
              <UserPlus size={14} className="text-[#5288c1]" />
              <span className="hidden sm:inline">Позвать</span>
            </button>

            <button
              type="button"
              onClick={() => setMinimizedState(true)}
              className="p-2 rounded-xl bg-[#242f3d] hover:bg-[#2c394a] text-[#7f91a4] hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
              title="Свернуть звонок в плавающее окно"
            >
              <Minus size={15} />
              <span className="hidden sm:inline">Свернуть</span>
            </button>
          </div>
        </div>

        {/* Prominent Quick-Stop Badge when current user shares screen */}
        {isScreenSharing && (
          <div className="w-full mb-2 px-3 py-1.5 bg-rose-500/15 border border-rose-500/40 rounded-2xl flex items-center justify-between gap-2 animate-fade-in flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
              <span className="text-xs font-bold text-rose-200 truncate">
                Вы делитесь своим экраном — собеседники видят ваш экран
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

        {/* --- THEATER SCREEN / CAMERA VIEW --- */}
        {isTheaterActive ? (
          <div className="flex-1 w-full min-h-0 flex flex-col relative my-0.5">
            <div className="flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-xl bg-black/40 border border-white/5 text-xs gap-2">
              <div className="flex items-center gap-2 text-white min-w-0">
                {isScreenSharingActive ? (
                  <>
                    <Tv size={15} className="text-[#5288c1] flex-shrink-0" />
                    <span className="font-semibold text-xs sm:text-sm truncate">
                      {effectiveSelectedCallStream === 'local'
                        ? 'Ваш экран'
                        : `Экран: ${remoteScreenSenderName || targetName}`}
                    </span>
                  </>
                ) : (
                  <>
                    <Video size={15} className="text-emerald-400 flex-shrink-0" />
                    <span className="font-semibold text-xs sm:text-sm truncate">
                      {isRemoteCameraActive
                        ? `Видео: ${targetName}`
                        : 'Ваша камера'}
                    </span>
                  </>
                )}
                <span className="text-[11px] text-emerald-400 font-mono tracking-wider flex-shrink-0">
                  {formatTime(seconds)}
                </span>
              </div>
              <div className="text-[11px] text-[#7f91a4] flex items-center gap-1.5 flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="hidden sm:inline">Прямой эфир</span>
              </div>
            </div>

            {/* Multi-Stream Switcher Bar when both participants share screen */}
            {isScreenSharing && isRemoteScreenSharing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 mb-2 bg-[#0e1621]/95 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedCallStream('remote')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer flex-shrink-0 active:scale-95 ${
                    effectiveSelectedCallStream === 'remote'
                      ? 'bg-[#2481cc] text-white shadow-md shadow-blue-500/25 border border-blue-400'
                      : 'bg-[#17212b] text-[#7f91a4] hover:text-white hover:bg-[#202b36] border border-white/5'
                  }`}
                >
                  <img
                    src={getAvatarUrl(targetAvatar, targetName)}
                    onError={(e) => handleAvatarError(e, targetName)}
                    alt={targetName}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>Экран: {remoteScreenSenderName || targetName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCallStream('local')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer flex-shrink-0 active:scale-95 ${
                    effectiveSelectedCallStream === 'local'
                      ? 'bg-[#2481cc] text-white shadow-md shadow-blue-500/25 border border-blue-400'
                      : 'bg-[#17212b] text-[#7f91a4] hover:text-white hover:bg-[#202b36] border border-white/5'
                  }`}
                >
                  <img
                    src={getAvatarUrl(currentUser?.avatar, currentUser?.name || 'Вы')}
                    onError={(e) => handleAvatarError(e, currentUser?.name || 'Вы')}
                    alt={currentUser?.name || 'Вы'}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>Ваш экран</span>
                </button>
              </div>
            )}

            <div className="flex-1 w-full relative min-h-0 bg-black rounded-2xl border border-white/10 flex items-center justify-center shadow-inner overflow-hidden">
              {isScreenSharingActive ? (
                effectiveSelectedCallStream === 'local' ? (
                  <video
                    ref={setLocalScreenVideo}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center bg-black">
                    <video
                      ref={setRemoteVideo}
                      autoPlay
                      playsInline
                      onPlaying={() => setIsRemoteVideoPlaying(true)}
                      className={`w-full h-full object-contain ${isRemoteVideoPlaying ? 'block' : 'hidden'}`}
                    />

                    {(!isRemoteVideoPlaying || !remoteVideoStreamRef.current) && remoteFrameDataUrl && (
                      <img
                        src={remoteFrameDataUrl}
                        alt="Прямая трансляция экрана"
                        className="w-full h-full object-contain select-none pointer-events-none"
                      />
                    )}

                    {!isRemoteVideoPlaying && !remoteFrameDataUrl && (
                      <div className="flex flex-col items-center justify-center gap-3 text-[#7f91a4]">
                        <div className="w-9 h-9 border-3 border-[#5288c1] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Подключение к трансляции экрана...</span>
                      </div>
                    )}
                  </div>
                )
              ) : isRemoteCameraActive ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  <video
                    ref={setRemoteVideo}
                    autoPlay
                    playsInline
                    onPlaying={() => setIsRemoteCamWebRtcPlaying(true)}
                    className={`w-full h-full object-contain ${isRemoteCamWebRtcPlaying ? 'block' : 'hidden'}`}
                  />
                  {(!isRemoteCamWebRtcPlaying || !remoteVideoStreamRef.current) && remoteCameraFrameUrl && (
                    <img
                      src={remoteCameraFrameUrl}
                      alt={targetName}
                      className="w-full h-full object-contain select-none pointer-events-none"
                    />
                  )}
                  {!isRemoteCamWebRtcPlaying && !remoteCameraFrameUrl && (
                    <div className="flex flex-col items-center justify-center gap-2 text-[#7f91a4]">
                      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Загрузка видеокамеры...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0e1621] p-4 text-center">
                  <img
                    src={getAvatarUrl(targetAvatar, targetName)}
                    onError={(e) => handleAvatarError(e, targetName)}
                    alt={targetName}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-[#242f3d] mb-3 shadow-xl"
                  />
                  <h3 className="font-bold text-base text-white mb-1">{targetName}</h3>
                  <span className="text-xs text-[#7f91a4] mb-3">Камера собеседника выключена</span>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Ваша камера активна
                  </div>
                </div>
              )}

              {/* Picture-in-Picture floating preview for local camera */}
              {isVideoEnabled && (
                <div className="absolute bottom-3 right-3 w-24 h-36 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-[#5288c1] shadow-2xl bg-black z-30">
                  <video
                    ref={setLocalCameraVideo}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-all ${
                      cameraFacingMode === 'user' ? 'scale-x-[-1]' : ''
                    } ${isBackgroundBlur ? 'blur-[1.5px] scale-105 contrast-125' : ''}`}
                  />
                  <div className="absolute top-1.5 left-1.5 bg-black/65 px-2 py-0.5 rounded-full text-[10px] text-white flex items-center gap-1">
                    <Video size={10} className="text-emerald-400" />
                    <span>Вы</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="absolute bottom-1.5 right-1.5 p-1.5 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 transition cursor-pointer active:scale-90"
                    title="Переключить камеру (фронтальная / основная)"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              )}

              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-2 shadow-lg z-20">
                <img
                  src={getAvatarUrl(targetAvatar, targetName)}
                  onError={(e) => handleAvatarError(e, targetName)}
                  alt={targetName}
                  className="w-5 h-5 rounded-full object-cover border border-white/20"
                />
                <span className="text-xs font-medium text-white max-w-[110px] truncate">{targetName}</span>
                {isUserVerified(propTargetUser || chat?.targetUser) && <TelegramVerifiedBadge size={12} />}
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        ) : (
          /* --- COMPACT CALL VIEW (Pure Audio) --- */
          <div className="flex flex-col items-center w-full overflow-y-auto no-scrollbar py-1">
            {isRemoteScreenSharing && (
              <div className="w-full mb-3 p-2.5 bg-gradient-to-r from-[#2481cc]/25 to-emerald-500/20 border border-[#5288c1]/40 rounded-2xl flex items-center justify-between gap-2 animate-pulse">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#5288c1] flex items-center justify-center text-white shadow-md flex-shrink-0">
                    <MonitorUp size={16} />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {remoteScreenSenderName || 'Собеседник'} делится экраном
                    </p>
                    <p className="text-[10px] text-emerald-400 font-medium">Нажмите, чтобы смотреть</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsViewingRemoteScreen(true)}
                  className="px-3 py-1.5 bg-[#2481cc] hover:bg-[#1e70b3] text-white text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1 cursor-pointer active:scale-95 flex-shrink-0"
                >
                  <span>Смотреть</span>
                  <Maximize2 size={12} />
                </button>
              </div>
            )}

            <div className="relative mb-4 mt-1">
              <div
                className={`absolute -inset-2 rounded-full bg-[#5288c1]/20 transition-all ${
                  status === 'calling'
                    ? 'animate-ping'
                    : status === 'connecting'
                    ? 'animate-pulse'
                    : 'animate-spin-slow'
                }`}
              />
              <img
                src={getAvatarUrl(targetAvatar, targetName)}
                onError={(e) => handleAvatarError(e, targetName)}
                alt={targetName}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-[#242f3d] relative z-10 shadow-xl"
              />
            </div>

            <h3 className="font-bold text-lg text-center flex items-center justify-center gap-1.5 mb-1 max-w-full px-2">
              <span className="truncate">{targetName}</span>
              {isUserVerified(propTargetUser || chat?.targetUser) && (
                <TelegramVerifiedBadge size={17} />
              )}
            </h3>

            <div className="text-xs mb-3 text-center">
              {status === 'calling' && (
                <span className="text-[#7f91a4] font-medium flex items-center gap-1.5 justify-center animate-pulse">
                  <span>Вызов...</span>
                </span>
              )}
              {status === 'connecting' && (
                <span className="text-amber-400 font-medium flex items-center gap-1.5 justify-center animate-pulse">
                  <span>Соединение...</span>
                </span>
              )}
              {status === 'no_answer' && (
                <span className="text-rose-400 font-semibold flex items-center gap-1.5 justify-center animate-pulse">
                  <span>Абонент не отвечает...</span>
                </span>
              )}
              {status === 'declined' && (
                <span className="text-rose-400 font-semibold flex items-center gap-1.5 justify-center">
                  <span>Звонок отклонён</span>
                </span>
              )}
              {status === 'active' && (
                <div className="flex flex-col items-center">
                  <span className="text-emerald-400 font-bold text-sm tracking-widest font-mono">
                    {formatTime(seconds)}
                  </span>
                  <span className="text-[10px] text-[#7f91a4] flex items-center gap-1 mt-0.5">
                    {selectedVoiceEffect !== 'normal' ? (
                      <span className="text-purple-300 font-semibold">
                        Голос: {AVAILABLE_VOICE_EFFECTS.find((e) => e.id === selectedVoiceEffect)?.name}
                      </span>
                    ) : isSoloEchoMode ? (
                      <span className="text-[#5288c1] flex items-center gap-1">
                        <Sparkles size={11} /> Эхо-тест микрофона
                      </span>
                    ) : (
                      'защищённое соединение'
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 h-6 mb-3">
              {visualizerHeights.map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isMuted
                      ? 'bg-zinc-600'
                      : status === 'active'
                      ? 'bg-[#5288c1]'
                      : 'bg-zinc-600'
                  }`}
                  style={{
                    height: isMuted ? '4px' : status === 'active' ? `${h}px` : '6px',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Responsive Wrapping Action Controls Grid/Row — ALL buttons always visible on phones & PC */}
        <div
          className={`flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 w-full flex-shrink-0 ${
            isTheaterActive ? 'pt-2.5' : 'pt-1'
          }`}
        >
          <button
            type="button"
            onClick={(e) => handleToggleMute(e)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isMuted
                ? 'bg-rose-500/25 text-rose-400 border border-rose-500/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <MicOff size={19} /> : <Mic size={19} />}
          </button>

          <button
            type="button"
            onClick={(e) => handleToggleCamera(e)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isVideoEnabled
                ? 'bg-[#5288c1] text-white ring-2 ring-[#5288c1]/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить видеокамеру'}
          >
            {isVideoEnabled ? <Video size={19} /> : <VideoOff size={19} />}
          </button>

          {isVideoEnabled && (
            <button
              type="button"
              onClick={(e) => handleSwitchCamera(e)}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#242f3d] hover:bg-[#2b394a] text-white transition shadow-md cursor-pointer active:scale-95"
              title="Переключить фронтальную / основную камеру"
            >
              <RefreshCw size={18} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleToggleSpeaker(e)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              !isSpeakerOn
                ? 'bg-rose-500/25 text-rose-400 border border-rose-500/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isSpeakerOn ? 'Отключить динамик' : 'Включить динамик'}
          >
            {isSpeakerOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>

          <button
            type="button"
            onClick={(e) => handleToggleScreenShare(e)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isScreenSharing
                ? 'bg-emerald-600 text-white shadow-emerald-600/40 ring-2 ring-emerald-400/50'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isScreenSharing ? 'Остановить трансляцию экрана' : 'Демонстрация экрана'}
          >
            <MonitorUp size={19} />
          </button>

          <button
            type="button"
            onClick={() => setIsVoiceEffectsOpen(true)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer relative active:scale-95 ${
              selectedVoiceEffect !== 'normal' || isVoiceMonitorOn
                ? 'bg-purple-600 text-white shadow-purple-600/40 ring-2 ring-purple-400'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title="Модуляция голоса (Voice Changer)"
          >
            <Wand2 size={19} />
            {selectedVoiceEffect !== 'normal' && (
              <span className="absolute -top-1 -right-1 text-xs">✨</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#242f3d] hover:bg-[#2b394a] text-white transition shadow-md cursor-pointer active:scale-95"
            title="Пригласить участников в звонок"
          >
            <UserPlus size={19} />
          </button>

          <button
            type="button"
            onClick={toggleCallRecording}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isRecordingCall
                ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
            }`}
            title={isRecordingCall ? 'Остановить запись звонка' : 'Записать звонок'}
          >
            <Radio size={19} className={isRecordingCall ? 'animate-spin' : ''} />
          </button>

          {/* Watch Together & Studio Noise Filter Buttons */}
          <button
            type="button"
            onClick={() => setIsWatchTogetherOpen(true)}
            className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#242f3d] hover:bg-rose-600/30 text-rose-400 hover:text-white transition shadow-md cursor-pointer active:scale-95"
            title="Кинозал • Совместный просмотр видео (Watch Together)"
          >
            <Film size={19} />
          </button>

          <button
            type="button"
            onClick={() => setIsNoiseGateOn(!isNoiseGateOn)}
            className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
              isNoiseGateOn
                ? 'bg-emerald-600 text-white shadow-emerald-600/40'
                : 'bg-[#242f3d] hover:bg-[#2b394a] text-zinc-400'
            }`}
            title={isNoiseGateOn ? 'AI Шумоподавление: ВКЛ' : 'AI Шумоподавление: ВЫКЛ'}
          >
            <Shield size={18} />
          </button>

          {isVideoEnabled && (
            <button
              type="button"
              onClick={() => setIsBackgroundBlur(!isBackgroundBlur)}
              className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full transition shadow-md cursor-pointer active:scale-95 ${
                isBackgroundBlur
                  ? 'bg-amber-500 text-white shadow-amber-500/40 ring-2 ring-amber-300'
                  : 'bg-[#242f3d] hover:bg-[#2b394a] text-white'
              }`}
              title={isBackgroundBlur ? 'Отключить размытие фона' : 'Размытие фона'}
            >
              <Sparkles size={19} />
            </button>
          )}

          {isRemoteScreenSharing && !isViewingRemoteScreen && (
            <button
              type="button"
              onClick={() => setIsViewingRemoteScreen(true)}
              className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-[#2481cc] hover:bg-[#1e70b3] text-white transition shadow-md animate-pulse cursor-pointer active:scale-95"
              title="Смотреть демонстрацию экрана собеседника"
            >
              <Tv size={19} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleEndCall(e)}
            className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/40 transition hover:scale-105 active:scale-95 cursor-pointer"
            title="Завершить звонок"
          >
            <PhoneOff size={22} />
          </button>
        </div>

        {/* Voice Changer Full Unclipped Overlay Sheet */}
        {isVoiceEffectsOpen && (
          <div className="absolute inset-0 z-50 bg-[#17212b]/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 flex flex-col animate-fade-in text-[#f5f5f5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
              <div className="flex items-center gap-2">
                <Wand2 size={18} className="text-purple-400" />
                <h3 className="font-semibold text-sm">Модуляция голоса в реальном времени</h3>
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
                onClick={handleToggleVoiceMonitor}
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
                  onClick={() => handleSelectVoiceEffect(eff.id)}
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

        {/* Toast notification */}
        {inviteToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-pop-in font-medium">
            <Check size={14} />
            <span>{inviteToast}</span>
          </div>
        )}

        {/* In-call Invite Modal */}
        {isInviteModalOpen && (
          <div className="absolute inset-0 z-50 bg-[#17212b]/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 flex flex-col animate-fade-in text-[#f5f5f5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#242f3d]">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-[#5288c1]" />
                <h3 className="font-semibold text-sm">Пригласить в звонок</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1.5 rounded-lg text-[#7f91a4] hover:text-white hover:bg-[#242f3d] transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-3">
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Поиск по имени или логину..."
                className="w-full bg-[#0e1621] px-3.5 py-2 rounded-xl border border-[#242f3d] focus:border-[#5288c1] outline-none text-xs text-white placeholder-[#7f91a4]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar min-h-0">
              {availableUsersToInvite.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#7f91a4]">
                  Контакты не найдены
                </div>
              ) : (
                availableUsersToInvite.map((u) => {
                  const isInvited = invitedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#0e1621]/60 hover:bg-[#0e1621] border border-white/5 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={getAvatarUrl(u.avatar, u.name)}
                          onError={(e) => handleAvatarError(e, u.name)}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10"
                        />
                        <div className="truncate text-left">
                          <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                            {u.name}
                            {isUserVerified(u) && <TelegramVerifiedBadge size={12} />}
                          </p>
                          <p className="text-[10px] text-[#7f91a4] truncate">@{u.username}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isInvited}
                        onClick={() => handleInviteUser(u)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                          isInvited
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-[#2481cc] hover:bg-[#1e70b3] text-white shadow-sm'
                        }`}
                      >
                        {isInvited ? (
                          <>
                            <Check size={12} />
                            <span>Отправлено</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={12} />
                            <span>Позвать</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* PC Screen / Application Window Picker Modal */}
      <ScreenSharePickerModal
        isOpen={isScreenPickerOpen}
        sources={desktopSources}
        onSelectSource={handleSelectDesktopSource}
        onClose={() => setIsScreenPickerOpen(false)}
      />

      {/* Watch Together Synchronized Cinema Modal */}
      <WatchTogetherModal
        isOpen={isWatchTogetherOpen}
        socket={socket}
        chatId={chat?.id || 'direct_call'}
        currentUserId={currentUser?.id || ''}
        onClose={() => setIsWatchTogetherOpen(false)}
      />
    </div>
  );
};
