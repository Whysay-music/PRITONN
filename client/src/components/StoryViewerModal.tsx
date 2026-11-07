import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Eye, ChevronLeft, ChevronRight, Send, Trash2 } from 'lucide-react';
import { Story, User } from '../types';
import { getAvatarUrl, handleAvatarError, resolveMediaUrl } from '../utils/avatar';
import { API_BASE_URL } from '../config';

interface StoryViewerModalProps {
  isOpen: boolean;
  stories: Story[];
  initialIndex?: number;
  currentUser: User;
  onClose: () => void;
  onSendDirectMessage?: (targetUserId: string, text: string) => void;
  onDeleteStory?: (storyId: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  stories,
  initialIndex = 0,
  currentUser,
  onClose,
  onSendDirectMessage,
  onDeleteStory,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [likesMap, setLikesMap] = useState<Record<string, string[]>>({});

  const currentStory = stories[currentIndex];
  const STORY_DURATION = 6000; // 6 seconds per story

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex, isOpen]);

  // Mark story as viewed by current user
  useEffect(() => {
    if (!isOpen || !currentStory || !currentUser) return;

    fetch(`${API_BASE_URL}/api/stories/${currentStory.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        userName: currentUser.name,
      }),
    }).catch(() => {});
  }, [currentStory?.id, currentUser?.id, isOpen]);

  // Story progress timer
  useEffect(() => {
    if (!isOpen || isPaused || showViewersModal) return;

    const intervalTime = 50;
    const step = (intervalTime / STORY_DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((idx) => idx + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, isOpen, showViewersModal, stories.length, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, stories.length]);

  if (!isOpen || !currentStory) return null;

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const currentLikes = likesMap[currentStory.id] || currentStory.likes || [];
  const isLikedByMe = currentLikes.includes(currentUser.id);

  const handleToggleLike = async () => {
    const updated = isLikedByMe
      ? currentLikes.filter((id) => id !== currentUser.id)
      : [...currentLikes, currentUser.id];

    setLikesMap((prev) => ({ ...prev, [currentStory.id]: updated }));

    try {
      await fetch(`${API_BASE_URL}/api/stories/${currentStory.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    } catch (err) {
      console.warn('Like story error:', err);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !onSendDirectMessage) return;
    onSendDirectMessage(
      currentStory.userId,
      `📷 Ответ на историю: ${replyText.trim()}`
    );
    setReplyText('');
    alert('Ответ отправлен в личные сообщения!');
  };

  const authorName = currentStory.userName || currentStory.user?.name || 'Пользователь';
  const authorAvatar = currentStory.userAvatar || currentStory.user?.avatar;
  const isAuthor = currentStory.userId === currentUser.id;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center select-none animate-in fade-in duration-200">
      {/* Background click to close */}
      <div className="absolute inset-0 z-0" onClick={onClose} />

      {/* Main Story Container */}
      <div
        className="relative z-10 w-full max-w-sm sm:max-w-md h-[92vh] max-h-[820px] bg-[#111] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Top Progress Bars */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5">
          {stories.map((s, idx) => {
            let fill = 0;
            if (idx < currentIndex) fill = 100;
            else if (idx === currentIndex) fill = progress;

            return (
              <div
                key={s.id || idx}
                className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${fill}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Author Header */}
        <div className="absolute top-6 inset-x-4 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2.5">
            <img
              src={getAvatarUrl(authorAvatar, authorName)}
              onError={(e) => handleAvatarError(e, authorName)}
              alt={authorName}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-white/60 shadow"
            />
            <div className="flex flex-col">
              <span className="font-bold text-xs leading-tight">{authorName}</span>
              <span className="text-[10px] text-white/70">
                {new Date(currentStory.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isAuthor && onDeleteStory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Удалить эту историю?')) {
                    onDeleteStory(currentStory.id);
                    onClose();
                  }
                }}
                className="p-2 rounded-full hover:bg-white/20 text-white/80 hover:text-rose-400 transition cursor-pointer"
                title="Удалить историю"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
          {currentStory.mediaType === 'video' ? (
            <video
              src={resolveMediaUrl(currentStory.mediaUrl)}
              autoPlay
              loop
              playsInline
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <img
              src={resolveMediaUrl(currentStory.mediaUrl)}
              alt="Story"
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          )}

          {/* Left/Right Tap Navigation */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
          />
          <div
            className="absolute inset-y-0 right-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
          />
        </div>

        {/* Story Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-16 inset-x-4 z-30 p-3 bg-black/60 backdrop-blur-md rounded-2xl text-white text-xs leading-relaxed max-h-24 overflow-y-auto no-scrollbar border border-white/10 shadow-lg">
            {currentStory.caption}
          </div>
        )}

        {/* Bottom Interactive Bar */}
        <div className="absolute bottom-3 inset-x-4 z-30 flex items-center gap-2">
          {!isAuthor ? (
            <>
              <div className="flex-1 flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5 shadow-md">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                  placeholder="Ответить на историю..."
                  className="w-full bg-transparent text-xs text-white placeholder-white/60 outline-none"
                />
                {replyText.trim() && (
                  <button
                    type="button"
                    onClick={handleSendReply}
                    className="p-1 text-sky-400 hover:text-white transition cursor-pointer"
                  >
                    <Send size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleToggleLike}
                className={`p-2.5 rounded-full backdrop-blur-md border transition cursor-pointer active:scale-125 ${
                  isLikedByMe
                    ? 'bg-rose-600/90 border-rose-500 text-white shadow-lg shadow-rose-600/50'
                    : 'bg-black/50 border-white/20 text-white hover:bg-black/70'
                }`}
                title="Понравилось"
              >
                <Heart size={18} fill={isLikedByMe ? 'currentColor' : 'none'} />
              </button>
            </>
          ) : (
            /* Author stats: views list */
            <div className="w-full flex items-center justify-between bg-black/50 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2 text-white text-xs shadow-md">
              <button
                type="button"
                onClick={() => setShowViewersModal(true)}
                className="flex items-center gap-1.5 hover:text-sky-300 transition cursor-pointer font-medium"
              >
                <Eye size={16} />
                <span>{currentStory.views || currentStory.viewers?.length || 1} просмотров</span>
              </button>
              <div className="flex items-center gap-1 text-rose-400 font-bold">
                <Heart size={15} fill="currentColor" />
                <span>{currentLikes.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prev / Next desktop arrow buttons */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={handlePrev}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition cursor-pointer backdrop-blur-md"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {currentIndex < stories.length - 1 && (
        <button
          type="button"
          onClick={handleNext}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition cursor-pointer backdrop-blur-md"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Viewers modal */}
      {showViewersModal && (
        <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[var(--tg-sidebar)] rounded-2xl border border-[var(--tg-card-border)] p-4 text-[var(--tg-text)] shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--tg-card-border)]">
              <h4 className="font-bold text-sm flex items-center gap-1.5">
                <Eye size={16} />
                <span>Просмотрели историю</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowViewersModal(false)}
                className="p-1 rounded-full hover:bg-[var(--tg-surface-hover)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 no-scrollbar text-xs">
              {(currentStory.viewers && currentStory.viewers.length > 0
                ? currentStory.viewers
                : [{ userId: currentUser.id, userName: currentUser.name, timestamp: Date.now() }]
              ).map((v, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="font-medium truncate max-w-[150px]">{v.userName}</span>
                  <span className="text-[10px] text-[var(--tg-text-muted)]">
                    {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
