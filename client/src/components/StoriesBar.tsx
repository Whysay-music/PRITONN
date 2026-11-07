import React from 'react';
import { Plus } from 'lucide-react';
import { Story, User } from '../types';
import { getAvatarUrl, handleAvatarError, resolveMediaUrl } from '../utils/avatar';

interface StoriesBarProps {
  stories: Story[];
  currentUser: User;
  onOpenCreateStory?: () => void;
  onCreateStory?: () => void;
  onOpenStoryViewer?: (storyIndex: number) => void;
  onSelectStory?: (story: Story) => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  currentUser,
  onOpenCreateStory,
  onCreateStory,
  onOpenStoryViewer,
  onSelectStory,
}) => {
  const handleCreate = () => {
    if (onOpenCreateStory) onOpenCreateStory();
    else if (onCreateStory) onCreateStory();
  };

  const handleSelect = (idx: number, story: Story) => {
    if (onOpenStoryViewer) onOpenStoryViewer(idx);
    else if (onSelectStory) onSelectStory(story);
  };

  // Group stories by user to avoid duplicate avatar rings
  const userStoriesMap = new Map<string, { latestStory: Story; count: number; firstIndex: number }>();

  stories.forEach((s, idx) => {
    if (!userStoriesMap.has(s.userId)) {
      userStoriesMap.set(s.userId, { latestStory: s, count: 1, firstIndex: idx });
    } else {
      const entry = userStoriesMap.get(s.userId)!;
      entry.count += 1;
    }
  });

  const distinctUserStories = Array.from(userStoriesMap.entries());

  return (
    <div className="w-full bg-[var(--tg-sidebar)]/80 backdrop-blur-md border-b border-[var(--tg-border)] px-3 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar select-none z-10">
      {/* Current User Story Circle */}
      <div
        onClick={handleCreate}
        className="flex flex-col items-center gap-1 cursor-pointer group flex-shrink-0"
      >
        <div className="relative">
          <div className="w-13 h-13 rounded-full p-0.5 border-2 border-dashed border-[var(--tg-border-accent)]/60 group-hover:border-[var(--tg-border-accent)] transition-all">
            <img
              src={getAvatarUrl(currentUser.avatar, currentUser.name)}
              onError={(e) => handleAvatarError(e, currentUser.name)}
              alt="Ваша история"
              className="w-full h-full rounded-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[var(--tg-accent)] text-white flex items-center justify-center shadow-md ring-2 ring-[var(--tg-sidebar)]">
            <Plus size={11} strokeWidth={3} />
          </div>
        </div>
        <span className="text-[10px] text-[var(--tg-text-muted)] group-hover:text-[var(--tg-text)] truncate max-w-[60px] text-center font-medium">
          Ваша история
        </span>
      </div>

      {/* Friends Stories Rings */}
      {distinctUserStories.map(([uId, data]) => {
        const { latestStory, count, firstIndex } = data;
        const authorName = latestStory.userName || latestStory.user?.name || 'Пользователь';
        const authorAvatar = latestStory.userAvatar || latestStory.user?.avatar;
        const isMyOwn = uId === currentUser.id;

        return (
          <div
            key={uId}
            onClick={() => handleSelect(firstIndex, latestStory)}
            className="flex flex-col items-center gap-1 cursor-pointer group flex-shrink-0"
          >
            <div className="relative">
              {/* Gradient Glowing Ring */}
              <div className="w-13 h-13 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 via-rose-500 to-amber-500 shadow group-hover:shadow-[0_0_12px_rgba(244,63,94,0.45)] group-hover:scale-105 transition-all">
                <div className="w-full h-full rounded-full p-0.5 bg-[var(--tg-sidebar)]">
                  <img
                    src={latestStory.mediaType === 'image' && latestStory.mediaUrl ? resolveMediaUrl(latestStory.mediaUrl) : getAvatarUrl(authorAvatar, authorName)}
                    onError={(e) => handleAvatarError(e, authorName)}
                    alt={authorName}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>
              {latestStory.mediaType === 'image' && latestStory.mediaUrl && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full ring-2 ring-[var(--tg-sidebar)] overflow-hidden shadow">
                  <img
                    src={getAvatarUrl(authorAvatar, authorName)}
                    onError={(e) => handleAvatarError(e, authorName)}
                    alt={authorName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {count > 1 && (
                <span className="absolute -top-1 -right-1 px-1 bg-[var(--tg-accent)] text-white text-[9px] font-bold rounded-full border border-[var(--tg-sidebar)] shadow">
                  {count}
                </span>
              )}
            </div>
            <span className="text-[10px] text-[var(--tg-text)] font-medium truncate max-w-[62px] text-center">
              {isMyOwn ? 'Моя' : authorName.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
};
