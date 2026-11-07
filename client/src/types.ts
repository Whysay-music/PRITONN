export interface CustomFolder {
  id: string;
  name: string;
  icon: string;
  chatIds?: string[];
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio?: string;
  phone?: string;
  verified?: boolean;
  online?: boolean;
  lastSeen?: string;
  lastSeenTimestamp?: number | null;
  isBot?: boolean;
  blockedUserIds?: string[];
  isPremium?: boolean;
  emojiStatus?: string;
  customFolders?: CustomFolder[];
  appLockPin?: string;
  appLockEnabled?: boolean;
}

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  caption: string;
  timestamp: number;
  views: number;
  user?: User;
}

export interface Chat {
  id: string;
  type: 'saved' | 'direct' | 'group' | 'channel' | 'bot';
  name: string;
  displayName?: string | null;
  avatar: string | null;
  displayAvatar?: string | null;
  description?: string;
  username?: string;
  pinnedMessageId?: string | null;
  members?: string[];
  subscribersCount?: number;
  membersCount?: number;
  verified?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  isSecret?: boolean;
  draft?: string;
  targetUserId?: string;
  creatorId?: string;
  targetUser?: User | null;
  lastMessage?: Message | null;
  unreadCount?: number;
  wallpaper?: string;
}

export interface ReplyInfo {
  id: string;
  senderName: string;
  text: string;
}

export interface InlineKeyboardButton {
  text: string;
  action: string;
  url?: string;
  data?: string;
  diceType?: string;
  cmd?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  type?: 'text' | 'call' | string;
  callData?: {
    callerId: string;
    receiverId: string;
    duration: number;
    status: 'completed' | 'missed' | 'rejected' | 'cancelled';
    isVideo?: boolean;
  };
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'file' | 'audio' | null;
  fileName?: string | null;
  fileSize?: string | null;
  isVoice?: boolean;
  voiceDuration?: number;
  audioDuration?: number;
  videoDuration?: number;
  replyTo?: ReplyInfo | null;
  timestamp: number;
  status?: 'sent' | 'read';
  views?: string;
  reactions?: Record<string, string[]>; // emoji -> [userIds]
  deletedFor?: string[];
  isRoundVideo?: boolean;
  isEdited?: boolean;
  poll?: any;
  forwardFrom?: { name: string; username?: string };
  isSilent?: boolean;
  isSpoiler?: boolean;
  isDice?: boolean;
  diceType?: 'dice' | 'dart' | 'basket' | 'football' | 'casino';
  diceValue?: number;
  inlineKeyboard?: InlineKeyboardButton[][];
  burnTimer?: number;
  burnedAt?: number;
  transcribedText?: string;
  isTranscribing?: boolean;
  isSticker?: boolean;
  stickerUrl?: string;
  isGif?: boolean;
  gifUrl?: string;
  gameData?: any;
  translatedText?: string;
  scheduledFor?: number;
}
