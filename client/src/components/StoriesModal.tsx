import React, { useState, useEffect } from 'react';
import { X, Heart, Send, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Story, User } from '../types';
import { TelegramVerifiedBadge } from './TelegramVerifiedBadge';
import { isUserVerified } from '../utils/verified';

interface StoriesModalProps {
  story: Story | null;
  stories: Story[];
  currentUser: User;
  onClose: () => void;
  onSelectStory: (story: Story) => void;
}

export const StoriesModal: React.FC<StoriesModalProps> = ({
  story,
  stories,
  currentUser: _currentUser,
  onClose,
  onSelectStory,
}) => {
  const [progress, setProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [replyText, setReplyText] = useState('');

  const currentIndex = stories.findIndex((s) => s.id === story?.id);

  // Story progress timer (5 seconds)
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // auto advance
          if (currentIndex < stories.length - 1) {
            onSelectStory(stories[currentIndex + 1]);
          } else {
            onClose();
          }
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [story, currentIndex, stories, onSelectStory, onClose]);

  if (!story || !story.user) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      onSelectStory(stories[currentIndex - 1]);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < stories.length - 1) {
      onSelectStory(stories[currentIndex + 1]);
    } else {
      onClose();
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    alert(`Ответ на историю отправлен: "${replyText}"`);
    setReplyText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center select-none animate-fade-in">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition z-50"
      >
        <X size={24} />
      </button>

      {/* Prev / Next buttons */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrev}
          className="absolute left-6 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition hidden md:block"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {currentIndex < stories.length - 1 && (
        <button
          onClick={handleNext}
          className="absolute right-6 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition hidden md:block"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Story Card */}
      <div className="relative w-full max-w-sm h-[90vh] max-h-[750px] bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
        {/* Progress bar */}
        <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5">
          {stories.map((s, idx) => (
            <div
              key={s.id}
              className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width:
                    idx < currentIndex
                      ? '100%'
                      : idx === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* User header */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2.5">
            <img
              src={story.user.avatar}
              alt={story.user.name}
              className="w-9 h-9 rounded-full object-cover border border-white/40"
            />
            <div>
              <div className="text-sm font-semibold leading-tight flex items-center gap-1">
                {story.user.name}
                {isUserVerified(story.user) && (
                  <TelegramVerifiedBadge size={13} />
                )}
              </div>
              <div className="text-[11px] text-white/75">
                {new Date(story.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs bg-black/40 backdrop-blur-md px-2 py-1 rounded-full text-white/90">
            <Eye size={12} />
            <span>{story.views}</span>
          </div>
        </div>

        {/* Media */}
        <div className="flex-1 w-full h-full relative">
          <img
            src={story.mediaUrl}
            alt="Story media"
            className="w-full h-full object-cover"
          />
          {/* Touch zones */}
          <div
            onClick={handlePrev}
            className="absolute left-0 top-0 w-1/3 h-full cursor-pointer"
          />
          <div
            onClick={handleNext}
            className="absolute right-0 top-0 w-2/3 h-full cursor-pointer"
          />
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-20 left-4 right-4 z-30 bg-black/50 backdrop-blur-md p-3 rounded-xl text-white text-sm">
            {story.caption}
          </div>
        )}

        {/* Story reply footer */}
        <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center gap-2">
          <form
            onSubmit={handleSendReply}
            className="flex-1 flex items-center bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20"
          >
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Ответить на историю..."
              className="bg-transparent text-white placeholder-white/60 text-xs flex-1 outline-none px-2"
            />
            {replyText.trim() && (
              <button type="submit" className="text-blue-400 hover:text-blue-300">
                <Send size={15} />
              </button>
            )}
          </form>
          <button
            onClick={() => setLiked(!liked)}
            className={`p-2.5 rounded-full backdrop-blur-md transition ${
              liked
                ? 'bg-rose-600/90 text-white scale-110'
                : 'bg-black/50 text-white/80 hover:text-white'
            }`}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </div>
  );
};
