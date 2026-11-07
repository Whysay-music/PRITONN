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
  starsBalance?: number;
  gifts?: Array<{
    id: string;
    giftId: string;
    title: string;
    icon: string;
    fromUserId: string;
    fromUserName: string;
    timestamp: number;
    message?: string;
  }>;
  listeningTrack?: {
    title: string;
    artist?: string;
    isPlaying: boolean;
  } | null;
  bannerUrl?: string;
  badges?: string[];
  pritonnCoins?: number;
  customStickers?: string[];
  isVideoAvatar?: boolean;
}

export interface Story {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  caption: string;
  timestamp: number;
  views: number;
  viewers?: Array<{ userId: string; userName: string; timestamp: number }>;
  likes?: string[];
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
  admins?: string[];
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
  isForum?: boolean;
  topics?: Array<{
    id: string;
    name: string;
    icon?: string;
    color?: string;
    createdAt: number;
  }>;
  isTyping?: boolean;
  typingUser?: string;
  liveStream?: {
    isLive: boolean;
    hostId: string;
    hostName: string;
    title?: string;
    startedAt: number;
    viewersCount?: number;
  } | null;
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
  mediaType?: 'image' | 'video' | 'file' | 'audio' | 'voice' | null;
  fileName?: string | null;
  fileSize?: string | null;
  isVoice?: boolean;
  voiceDuration?: number;
  audioDuration?: number;
  videoDuration?: number;
  replyTo?: ReplyInfo | null;
  timestamp: number;
  status?: 'sent' | 'read';
  readAt?: number;
  readBy?: Array<{ userId: string; timestamp: number; userName?: string }>;
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
  targetLang?: string;
  scheduledFor?: number;
  isViewOnce?: boolean;
  viewOnceBurned?: boolean;
  viewTimer?: number;
  topicId?: string;
}
