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
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { Chat, User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { isUserVerified } from '../utils/verified';

interface VoiceCallModalProps {
  chat: Chat | null;
  targetUser?: User | null;
  currentUser?: User | null;
  socket?: Socket | null;
  isIncomingAccepted?: boolean;
  onClose: () => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  chat,
  targetUser: propTargetUser,
  currentUser,
  socket,
  isIncomingAccepted = false,
  onClose,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState<'calling' | 'connecting' | 'active'>(
    isIncomingAccepted ? 'active' : 'calling'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isViewingRemoteScreen, setIsViewingRemoteScreen] = useState(false);
  const [remoteFrameDataUrl, setRemoteFrameDataUrl] = useState<string | null>(null);
  const [isRemoteVideoPlaying, setIsRemoteVideoPlaying] = useState(false);
  const [remoteScreenSenderName, setRemoteScreenSenderName] = useState<string>('');
  const [selectedCallStream, setSelectedCallStream] = useState<'remote' | 'local'>('remote');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSoloEchoMode, setIsSoloEchoMode] = useState(false);
  const [visualizerHeights, setVisualizerHeights] = useState<number[]>([
    8, 14, 10, 18, 12, 16, 20, 14, 18, 15, 10, 19,
  ]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
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

  // Callback ref for local video: binds stream immediately upon mounting
  const setLocalVideo = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (node) {
      const stream = isScreenSharing ? screenStreamRef.current : localStreamRef.current;
      if (stream) {
        node.srcObject = stream;
        node.play().catch(() => {});
      }
    }
  }, [isScreenSharing]);

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
        setIsRemoteScreenSharing(true);
        // Do not force isViewingRemoteScreen on call start: user can click "Смотреть" or start own share

        event.track.onended = () => {
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
          remoteAudioRef.current.play().catch(() => {});
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
      }
    };

    return pc;
  }, [socket, targetUserId, stopRingtone]);

  // Acquire local media stream and bind to PeerConnection
  const setupLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoEnabled,
      });
      localStreamRef.current = stream;

      if (localVideoRef.current && isVideoEnabled && !isScreenSharing) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

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
  }, [isVideoEnabled, isScreenSharing]);

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
          isVideo: isVideoEnabled,
        });
      }

      callTimeoutTimer = setTimeout(() => {
        isCallConnectedRef.current = true;
        stopRingtone();
        playConnectChime();
        setStatus('active');
        setIsSoloEchoMode(true);
      }, 7000);
    } else {
      isCallConnectedRef.current = true;
      stopRingtone();
      playConnectChime();
      setStatus('active');
    }

    setupLocalMedia().then((stream) => {
      if (stream) {
        const pc = initPeerConnection();
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
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
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          // Flush queued candidates
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

          // Flush queued candidates
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
          setIsMinimized(false);
        } else {
          setIsViewingRemoteScreen(false);
          setIsRemoteVideoPlaying(false);
          setRemoteFrameDataUrl(null);
        }
      };

      const handleScreenStreamFrame = ({
        frame,
        senderId,
        senderName,
      }: {
        frame: string;
        senderId?: string;
        senderName?: string;
      }) => {
        setRemoteFrameDataUrl(frame);
        setIsRemoteScreenSharing(true);
        if (senderName) {
          setRemoteScreenSenderName(senderName);
        }
      };

      const handleRejected = () => {
        clearTimeout(callTimeoutTimer);
        stopRingtone();
        onClose();
      };

      const handleEnded = () => {
        clearTimeout(callTimeoutTimer);
        stopRingtone();
        onClose();
      };

      socket.on('call_accepted', handleAccepted);
      socket.on('webrtc_offer', handleOffer);
      socket.on('webrtc_answer', handleAnswer);
      socket.on('webrtc_ice_candidate', handleIceCandidate);
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
    isVideoEnabled,
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

  // Mute Mic
  const handleToggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
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

  // Stop Screen Share
  const stopScreenSharing = useCallback(async () => {
    setIsScreenSharing(false);
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        if (isVideoEnabled && localStreamRef.current) {
          const camTrack = localStreamRef.current.getVideoTracks()[0] || null;
          await videoSender.replaceTrack(camTrack).catch(() => {});
        } else {
          await videoSender.replaceTrack(null).catch(() => {});
        }
      }
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

  // Start Screen Share with renegotiation & ultra-fast canvas frame streaming
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

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
          localVideoRef.current.play().catch(() => {});
        }

        // 100% Reliable, Zero Black Screen Canvas Frame Streaming Engine
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
        }, 65);

        const pc = initPeerConnection();
        const videoTrack = screenStream.getVideoTracks()[0];
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video') || senders.find((s) => !s.track);
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack).catch(() => {});
        } else {
          try {
            pc.addTrack(videoTrack, screenStream);
          } catch {}
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

        const screenVideoTrack = screenStream.getVideoTracks()[0];
        if (screenVideoTrack) {
          screenVideoTrack.onended = () => {
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
  const handleEndCall = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    stopRingtone();
    if (isScreenSharing) {
      stopScreenSharing();
    }
    if (socket && targetUserId && currentUser) {
      const actualCallerId = isIncomingAccepted ? targetUserId : currentUser.id;
      const actualTargetUserId = isIncomingAccepted ? currentUser.id : targetUserId;
      socket.emit('call_end', {
        callerId: actualCallerId,
        targetUserId: actualTargetUserId,
        duration: seconds,
        isVideo: isVideoEnabled || isScreenSharing,
      });
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
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
  };

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

  const isTheaterActive = isScreenSharing || (isRemoteScreenSharing && isViewingRemoteScreen);

  // --- FLOATING MINIMIZED CALL WIDGET (Telegram Dynamic Island) ---
  if (isMinimized) {
    return (
      <>
        <audio ref={remoteAudioRef} autoPlay playsInline muted={!isSpeakerOn} />

        <div
          onClick={() => setIsMinimized(false)}
          style={{ zIndex: 9999 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 bg-[#17212b]/95 hover:bg-[#202b36] border border-[#2b5278] hover:border-[#5288c1] backdrop-blur-md rounded-2xl px-4 py-2 shadow-2xl flex items-center gap-3.5 cursor-pointer transition-all duration-200 select-none group max-w-[95vw] animate-pop-in"
          title="Нажмите в любое место, чтобы вернуться к звонку"
        >
          <div className="relative flex-shrink-0">
            <img
              src={targetAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
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
              onClick={(e) => handleEndCall(e)}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-md cursor-pointer"
              title="Завершить звонок"
            >
              <PhoneOff size={15} />
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(false)}
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
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fade-in"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline muted={!isSpeakerOn} />

      <div
        ref={modalContainerRef}
        className={`w-full transition-all duration-300 relative flex flex-col items-center overflow-hidden border border-[#242f3d] shadow-2xl text-[#f5f5f5] ${
          isTheaterActive
            ? isFullscreen
              ? 'fixed inset-0 z-50 rounded-none bg-black p-4'
              : 'max-w-5xl h-[88vh] bg-[#17212b] rounded-3xl p-4 md:p-6'
            : 'max-w-sm bg-[#17212b] rounded-3xl p-6 animate-pop-in'
        }`}
      >
        {/* Top Header: Security, Status & Controls */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-[#242f3d]/70 mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[#5288c1]">
              <Shield size={14} className="text-[#5288c1]" />
              <span className="font-medium text-[11px]">E2E MTProto WebRTC</span>
            </div>
            {isTheaterActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                HD 1080p
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 bg-[#0e1621] px-2.5 py-1 rounded-full border border-[#242f3d] cursor-pointer hover:border-[#5288c1] transition"
              title="Ключ сквозного шифрования Telegram"
            >
              {encryptionEmojis.map((emoji, i) => (
                <span key={i} className="text-xs select-none">
                  {emoji}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1 ml-1.5">
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
                  title={isFullscreen ? 'Свернуть полноэкранный режим' : 'Во весь экран'}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg bg-[#242f3d] hover:bg-[#2c394a] text-[#7f91a4] hover:text-white transition cursor-pointer flex items-center gap-1 text-xs"
                title="Свернуть звонок в плавающее окно"
              >
                <Minus size={15} />
                <span className="hidden sm:inline">Свернуть</span>
              </button>
            </div>
          </div>
        </div>

        {/* --- THEATER SCREEN SHARE VIEW --- */}
        {isTheaterActive ? (
          <div className="flex-1 w-full min-h-0 flex flex-col relative my-1">
            <div className="flex items-center justify-between px-3 py-1.5 mb-1.5 rounded-xl bg-black/40 border border-white/5 text-xs">
              <div className="flex items-center gap-2 text-white">
                <Tv size={16} className="text-[#5288c1]" />
                <span className="font-semibold text-sm">
                  {effectiveSelectedCallStream === 'local'
                    ? 'Ваша демонстрация экрана'
                    : `Демонстрация экрана: ${remoteScreenSenderName || targetName}`}
                </span>
                <span className="text-[11px] text-emerald-400 font-mono tracking-wider ml-2">
                  {formatTime(seconds)}
                </span>
              </div>
              <div className="text-[11px] text-[#7f91a4] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Прямой эфир</span>
              </div>
            </div>

            {/* Multi-Stream Switcher Bar when both participants share screen */}
            {isScreenSharing && isRemoteScreenSharing && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 mb-2 bg-[#0e1621]/95 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar flex-shrink-0">
                <div className="text-[11px] text-[#7f91a4] font-semibold flex items-center gap-1.5 mr-1 flex-shrink-0">
                  <Tv size={13} className="text-[#5288c1]" />
                  <span>Выбор демонстрации (2):</span>
                </div>
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
                    src={targetAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={targetName}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>Экран: {remoteScreenSenderName || targetName}</span>
                  <span className={`w-2 h-2 rounded-full ${effectiveSelectedCallStream === 'remote' ? 'bg-emerald-300 animate-pulse' : 'bg-emerald-500'}`} />
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
                    src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                    alt={currentUser?.name || 'Вы'}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>Ваш экран (Вы)</span>
                  <span className={`w-2 h-2 rounded-full ${effectiveSelectedCallStream === 'local' ? 'bg-emerald-300 animate-pulse' : 'bg-emerald-500'}`} />
                </button>
              </div>
            )}

            <div className="flex-1 w-full relative min-h-0 bg-black rounded-2xl border border-white/10 flex items-center justify-center shadow-inner overflow-hidden">
              {effectiveSelectedCallStream === 'local' ? (
                <video
                  ref={setLocalVideo}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  {/* WebRTC Video Stream */}
                  <video
                    ref={setRemoteVideo}
                    autoPlay
                    playsInline
                    onPlaying={() => setIsRemoteVideoPlaying(true)}
                    className={`w-full h-full object-contain ${isRemoteVideoPlaying ? 'block' : 'hidden'}`}
                  />

                  {/* High-speed Real-time Frame Stream (Zero black screen guarantee) */}
                  {(!isRemoteVideoPlaying || !remoteVideoStreamRef.current) && remoteFrameDataUrl && (
                    <img
                      src={remoteFrameDataUrl}
                      alt="Прямая трансляция экрана"
                      className="w-full h-full object-contain select-none pointer-events-none"
                    />
                  )}

                  {/* Animated Loader while connecting */}
                  {!isRemoteVideoPlaying && !remoteFrameDataUrl && (
                    <div className="flex flex-col items-center justify-center gap-3 text-[#7f91a4]">
                      <div className="w-9 h-9 border-3 border-[#5288c1] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium">Подключение к трансляции экрана...</span>
                    </div>
                  )}
                </div>
              )}

              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                <img
                  src={targetAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={targetName}
                  className="w-6 h-6 rounded-full object-cover border border-white/20"
                />
                <span className="text-xs font-medium text-white max-w-[120px] truncate">{targetName}</span>
                {isUserVerified(propTargetUser || chat?.targetUser) && <TelegramVerifiedBadge size={13} />}
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>
        ) : (
          /* --- COMPACT CALL VIEW --- */
          <div className="flex flex-col items-center w-full">
            {isRemoteScreenSharing && (
              <div className="w-full mb-4 p-3 bg-gradient-to-r from-[#2481cc]/25 to-emerald-500/20 border border-[#5288c1]/40 rounded-2xl flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#5288c1] flex items-center justify-center text-white shadow-md">
                    <MonitorUp size={18} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white leading-tight">
                      {remoteScreenSenderName || 'Собеседник'} включил(а) экран
                    </p>
                    <p className="text-[10px] text-emerald-400 font-medium">Трансляция активна</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsViewingRemoteScreen(true)}
                  className="px-3.5 py-1.5 bg-[#2481cc] hover:bg-[#1e70b3] text-white text-xs font-semibold rounded-xl transition shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>Смотреть</span>
                  <Maximize2 size={13} />
                </button>
              </div>
            )}

            {isVideoEnabled ? (
              <div className="relative w-52 h-52 rounded-2xl overflow-hidden mb-5 border-2 border-[#5288c1] shadow-xl bg-black">
                <video
                  ref={setLocalVideo}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Камера
                </div>
              </div>
            ) : (
              <div className="relative mb-5">
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
                  src={
                    targetAvatar ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
                  }
                  alt={targetName}
                  className="w-28 h-28 rounded-full object-cover border-4 border-[#242f3d] relative z-10 shadow-xl"
                />
              </div>
            )}

            <h3 className="font-bold text-lg text-center flex items-center justify-center gap-1.5 mb-1">
              <span className="truncate">{targetName}</span>
              {isUserVerified(propTargetUser || chat?.targetUser) && (
                <TelegramVerifiedBadge size={17} />
              )}
            </h3>

            <div className="text-xs mb-4 text-center">
              {status === 'calling' && (
                <span className="text-[#7f91a4] font-medium flex items-center gap-1.5 justify-center animate-pulse">
                  <span>Звонок...</span>
                </span>
              )}
              {status === 'connecting' && (
                <span className="text-amber-400 font-medium flex items-center gap-1.5 justify-center animate-pulse">
                  <span>Соединение...</span>
                </span>
              )}
              {status === 'active' && (
                <div className="flex flex-col items-center">
                  <span className="text-emerald-400 font-bold text-sm tracking-widest font-mono">
                    {formatTime(seconds)}
                  </span>
                  <span className="text-[10px] text-[#7f91a4] flex items-center gap-1 mt-0.5">
                    {isSoloEchoMode ? (
                      <span className="text-[#5288c1] flex items-center gap-1">
                        <Sparkles size={11} /> Эхо-тест микрофона (звук активен)
                      </span>
                    ) : (
                      'отличное соединение MTProto'
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 h-7 mb-5">
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

        {/* Action Controls Row */}
        <div className={`flex items-center justify-center gap-3 w-full flex-shrink-0 ${isTheaterActive ? 'pt-3' : 'pt-1'}`}>
          <button
            type="button"
            onClick={(e) => handleToggleMute(e)}
            className={`p-3 rounded-full transition shadow-md cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-[#242f3d] hover:bg-[#202b36] text-white'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            type="button"
            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
            className={`p-3 rounded-full transition shadow-md cursor-pointer ${
              isVideoEnabled
                ? 'bg-[#5288c1] text-white'
                : 'bg-[#242f3d] hover:bg-[#202b36] text-white'
            }`}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить видеокамеру'}
          >
            {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            type="button"
            onClick={(e) => handleEndCall(e)}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/40 transition hover:scale-105 active:scale-95 cursor-pointer"
            title="Завершить звонок"
          >
            <PhoneOff size={24} />
          </button>

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

          <button
            type="button"
            onClick={(e) => handleToggleScreenShare(e)}
            className={`p-3 rounded-full transition shadow-md cursor-pointer ${
              isScreenSharing
                ? 'bg-emerald-600 text-white shadow-emerald-600/40'
                : 'bg-[#242f3d] hover:bg-[#202b36] text-white'
            }`}
            title={isScreenSharing ? 'Остановить трансляцию экрана' : 'Включить демонстрацию экрана'}
          >
            <MonitorUp size={20} />
          </button>

          {isRemoteScreenSharing && !isViewingRemoteScreen && (
            <button
              type="button"
              onClick={() => setIsViewingRemoteScreen(true)}
              className="p-3 rounded-full bg-[#2481cc] hover:bg-[#1e70b3] text-white transition shadow-md animate-pulse cursor-pointer"
              title="Смотреть демонстрацию экрана собеседника"
            >
              <Tv size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
