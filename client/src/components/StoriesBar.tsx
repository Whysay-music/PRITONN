import React from 'react';
import { Plus } from 'lucide-react';
import { Story, User } from '../types';
import { getAvatarUrl, handleAvatarError } from '../utils/avatar';

interface StoriesBarProps {
  stories: Story[];
  currentUser: User;
  onSelectStory: (story: Story) => void;
  onCreateStory: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({
  stories,
  currentUser,
  onSelectStory,
  onCreateStory,
}) => {
  return (
    <div className="flex items-center gap-3 px-3 py-2 overflow-x-auto border-b border-[var(--tg-border)] scrollbar-none select-none">
      {/* Create story / My story */}
      <div
        onClick={onCreateStory}
        className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
      >
        <div className="relative w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-cyan-500 to-blue-600 hover:scale-105 transition-transform">
          <img
            src={getAvatarUrl(currentUser.avatar, currentUser.name)}
            onError={(e) => handleAvatarError(e, currentUser.name)}
            alt="My avatar"
            className="w-full h-full object-cover rounded-full border-2 border-[var(--tg-sidebar)]"
          />
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-[var(--tg-sidebar)] text-white">
            <Plus size={10} strokeWidth={3} />
          </div>
        </div>
        <span className="text-[11px] text-[var(--tg-text-muted)] mt-1 truncate max-w-[58px]">
          Ваша история
        </span>
      </div>

      {/* Stories from others */}
      {stories.map((story) => {
        const user = story.user;
        if (!user) return null;
        return (
          <div
            key={story.id}
            onClick={() => onSelectStory(story)}
            className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 hover:scale-105 transition-transform">
              <img
                src={getAvatarUrl(user.avatar, user.name)}
                onError={(e) => handleAvatarError(e, user.name)}
                alt={user.name}
                className="w-full h-full object-cover rounded-full border-2 border-[var(--tg-sidebar)]"
              />
            </div>
            <span className="text-[11px] text-[var(--tg-text)] mt-1 truncate max-w-[58px] text-center font-medium">
              {user.name.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
};
