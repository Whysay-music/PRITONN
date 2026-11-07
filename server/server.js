import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 4000;
const DB_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const CLIENT_DIST = path.join(__dirname, '../client/dist');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

// Clean initial data: zero default chats, zero messages
function getDefaultData() {
  return {
    users: [
      {
        id: "user_d87e67f0-759c-438f-a68b-fc0e80bd32bf",
        name: "Whysay",
        username: "Admin",
        password: "tixiy228",
        phone: "+4324234234234",
        avatar: "http://localhost:4000/uploads/1793986661494-400834245.jpg",
        bio: "Владелец PRITONN",
        online: true,
        lastSeen: "в сети",
        verified: true,
        blockedUserIds: [],
        isPremium: true,
        emojiStatus: "⚡"
      }
    ],
    stories: [],
    chats: [],
    messages: []
  };
}

function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      let content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      const parsed = JSON.parse(content);
      return parsed;
    }
  } catch (err) {
    console.error('Error reading DB, re-seeding:', err);
  }
  const defaultData = getDefaultData();
  saveData(defaultData);
  return defaultData;
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

// Helper to format last seen date & time
function formatLastSeen(timestamp) {
  if (!timestamp) return 'был(а) недавно';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return 'был(а) только что';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `был(а) ${mins} мин. назад`;
  }
  const date = new Date(timestamp);
  const nowDate = new Date();
  const isToday = date.toDateString() === nowDate.toDateString();
  const yesterday = new Date(nowDate);
  yesterday.setDate(nowDate.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `был(а) сегодня в ${timeStr}`;
  if (isYesterday) return `был(а) вчера в ${timeStr}`;
  return `был(а) ${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} в ${timeStr}`;
}

let db = loadData();

// Active user sockets tracking
const userSockets = new Map(); // userId -> Set<socketId>
const socketToUser = new Map(); // socketId -> userId
const voiceRoomScreenShares = new Map(); // chatId -> Map(sharerId -> { sharerId, sharerName })

// Reset online status on server startup
if (db.users) {
  let changed = false;

  // Ensure Admin account always exists with password tixiy228
  let admin = db.users.find((u) => u.username?.toLowerCase() === 'admin');
  if (!admin) {
    admin = {
      id: "user_d87e67f0-759c-438f-a68b-fc0e80bd32bf",
      name: "Whysay",
      username: "Admin",
      password: "tixiy228",
      phone: "+4324234234234",
      avatar: "http://localhost:4000/uploads/1793986661494-400834245.jpg",
      bio: "Владелец PRITONN",
      online: true,
      lastSeen: "в сети",
      verified: true,
      blockedUserIds: [],
      isPremium: true,
      emojiStatus: "⚡"
    };
    db.users.unshift(admin);
    changed = true;
  } else {
    admin.password = "tixiy228";
    admin.verified = true;
    admin.isPremium = true;
    changed = true;
  }

  // Ensure AI Assistant bot exists
  let bot = db.users.find((u) => u.id === 'user_bot' || u.username === 'ai_assistant');
  if (!bot) {
    bot = {
      id: 'user_bot',
      name: 'AI Assistant',
      username: 'ai_assistant',
      password: '',
      phone: '',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
      bio: 'Официальный Telegram Бот • Mini Apps, Игры и помощь',
      verified: false,
      online: true,
      lastSeen: 'бот',
      isBot: true,
    };
    db.users.push(bot);
    changed = true;
  } else {
    if (bot.verified) {
      bot.verified = false;
      changed = true;
    }
  }

  // Strictly enforce: ONLY user with username 'admin' has verified checkmark!
  db.users.forEach((u, i) => {
    const isTargetAdmin = u.username?.toLowerCase() === 'admin';
    if (u.verified !== isTargetAdmin) {
      u.verified = isTargetAdmin;
      changed = true;
    }
    if (!u.isBot) {
      u.online = false;
      if (!u.lastSeenTimestamp) {
        u.lastSeenTimestamp = Date.now() - (15 + i * 15) * 60 * 1000;
      }
      u.lastSeen = formatLastSeen(u.lastSeenTimestamp);
    }
    changed = true;
  });

  // Remove verified badge from all chats/channels (only @Admin user is verified)
  if (db.chats) {
    db.chats.forEach(c => {
      if (c.verified) {
        c.verified = false;
        changed = true;
      }
    });
  }
  // Seed sample calls for demo history if none
  if (!db.calls || db.calls.length === 0) {
    const admin = db.users.find(u => u.username?.toLowerCase() === 'admin');
    const alice = db.users.find(u => u.username === 'alice1');
    const bob = db.users.find(u => u.username === 'bob1');
    const charlie = db.users.find(u => u.username === 'charlie1');

    if (admin && alice) {
      db.calls = [
        {
          id: 'call_1',
          callerId: alice.id,
          receiverId: admin.id,
          status: 'completed',
          duration: 154, // 2 мин 34 сек
          isVideo: false,
          timestamp: Date.now() - 48 * 60 * 1000
        },
        {
          id: 'call_2',
          callerId: admin.id,
          receiverId: bob ? bob.id : alice.id,
          status: 'completed',
          duration: 320, // 5 мин 20 сек
          isVideo: false,
          timestamp: Date.now() - 3 * 3600 * 1000
        },
        {
          id: 'call_3',
          callerId: charlie ? charlie.id : alice.id,
          receiverId: admin.id,
          status: 'missed',
          duration: 0,
          isVideo: false,
          timestamp: Date.now() - 22 * 3600 * 1000
        },
        {
          id: 'call_4',
          callerId: alice.id,
          receiverId: admin.id,
          status: 'completed',
          duration: 75,
          isVideo: false,
          timestamp: Date.now() - 44 * 3600 * 1000
        }
      ];
      changed = true;
    }
  }

  if (changed) saveData(db);
}

// Auto bot reply generator with interactive inline keyboards
function generateBotReply(prompt) {
  const p = (prompt || '').trim().toLowerCase();
  if (p === '/start' || p.includes('привет') || p.includes('здравствуй')) {
    return {
      text: '🚀 Привет! Я официальный ИИ-ассистент Telegram.\n\nЯ умею:\n• Отвечать на любые вопросы\n• Запускать мини-игры и интерактивные кубики\n• Открывать Telegram Mini Apps\n\nВыбери действие ниже или просто напиши мне сообщение!',
      inlineKeyboard: [
        [
          { text: '🎲 Бросить кубик', action: 'send_dice', data: '🎲' },
          { text: '🎯 Дартс', action: 'send_dice', data: '🎯' }
        ],
        [
          { text: '🎮 Открыть Mini App', action: 'open_mini_app' },
          { text: '⭐ Получить Premium', action: 'open_premium' }
        ],
        [
          { text: '💡 Список команд', action: 'bot_cmd', data: '/help' }
        ]
      ]
    };
  }
  if (p === '/help') {
    return {
      text: '📋 Доступные команды и возможности:\n• /joke — Смешная шутка\n• /fact — Интересный факт о Telegram\n• /stars — Баланс Telegram Stars\n• /game — Запустить Telegram Mini App\n\nИли просто напиши мне любой вопрос обычным текстом!',
      inlineKeyboard: [
        [
          { text: '😂 Шутка', action: 'bot_cmd', data: '/joke' },
          { text: '💡 Факт', action: 'bot_cmd', data: '/fact' }
        ],
        [
          { text: '🎮 Запустить Mini App', action: 'open_mini_app' }
        ]
      ]
    };
  }
  if (p === '/joke') {
    const jokes = [
      '— Почему программисты любят тёмную тему в Telegram?\n— Потому что свет притягивает баги! 🐛',
      'В мире есть 10 типов людей: те, кто понимают двоичный код, и те, кто пользуются Telegram.',
      '«Работает на моём компьютере!» — кандидат на главную эпитафию разработчика. 💻'
    ];
    return {
      text: jokes[Math.floor(Math.random() * jokes.length)],
      inlineKeyboard: [
        [{ text: '🔄 Ещё шутку', action: 'bot_cmd', data: '/joke' }, { text: '🎲 Бросить кубик', action: 'send_dice', data: '🎲' }]
      ]
    };
  }
  if (p === '/fact') {
    const facts = [
      '💡 Первый запуск Telegram состоялся 14 августа 2013 года.',
      '💡 Протокол MTProto обеспечивает мгновенную доставку сообщений и сквозное шифрование звонков.',
      '💡 В Telegram более 950 миллионов активных пользователей по всему миру!'
    ];
    return {
      text: facts[Math.floor(Math.random() * facts.length)],
      inlineKeyboard: [
        [{ text: '💡 Ещё факт', action: 'bot_cmd', data: '/fact' }]
      ]
    };
  }
  if (p === '/stars') {
    return {
      text: '⭐ Ваш баланс: 250 Telegram Stars!\nВы можете использовать Звёзды для поддержки каналов и покупки цифровых товаров в Mini Apps.',
      inlineKeyboard: [
        [{ text: '⭐ Получить больше звёзд', action: 'open_premium' }]
      ]
    };
  }
  if (p === '/game') {
    return {
      text: '🎮 Telegram Mini App «Telegram Arcade & Clicker» готово к запуску! Нажми кнопку ниже, чтобы начать играть:',
      inlineKeyboard: [
        [{ text: '🚀 Играть в Mini App', action: 'open_mini_app' }]
      ]
    };
  }
  if (p.includes('как дела')) {
    return {
      text: 'Работаю на 100% мощности процессора! 🚀 Серверы летают, сообщения доставляются мгновенно, звонки в качестве HD.',
      inlineKeyboard: [
        [{ text: '🎲 Сыграть в кости', action: 'send_dice', data: '🎲' }]
      ]
    };
  }
  return {
    text: `🤖 Отличный вопрос! Я обработал твоё сообщение: «${prompt}». Всё функционирует стабильно и быстро. Чем ещё могу помочь?`,
    inlineKeyboard: [
      [
        { text: '🎲 Бросить кубик', action: 'send_dice', data: '🎲' },
        { text: '🎮 Mini App', action: 'open_mini_app' }
      ]
    ]
  };
}

// --- AUTH API ---

// Upload avatar / file endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const fileUrl = `http://localhost:4000/uploads/${req.file.filename}`;
  res.json({
    url: fileUrl,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Register new user (Starts with 0 chats!)
app.post('/api/auth/register', (req, res) => {
  const { name, username, password, phone, avatar, bio } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Пожалуйста, введите ваше имя' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Пожалуйста, укажите логин' });
  }
  if (!password || password.trim().length < 4) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа' });
  }

  const cleanUsername = username.replace('@', '').trim().toLowerCase();
  const existing = db.users.find(u => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    return res.status(400).json({ error: 'Пользователь с логином @' + cleanUsername + ' уже существует' });
  }

  const avatarStyles = ['adventurer', 'lorelei', 'micah', 'personas', 'notionists', 'avataaars'];
  const hash = cleanUsername.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const style = avatarStyles[hash % avatarStyles.length];
  const defaultAvatar = `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanUsername}`;

  const newUser = {
    id: 'user_' + uuidv4(),
    name: name.trim(),
    username: cleanUsername,
    password: password.trim(),
    phone: phone ? phone.trim() : '',
    avatar: avatar || defaultAvatar,
    bio: bio ? bio.trim() : 'Пользователь PRITONN',
    verified: false,
    online: true,
    lastSeen: 'в сети'
  };

  db.users.push(newUser);

  // Upon registration, create ONLY Saved Messages ("Избранное") chat and delete/skip all other chats!
  const savedChat = {
    id: 'chat_saved_' + newUser.id,
    type: 'saved',
    name: 'Избранное',
    avatar: '/telegram-saved.svg',
    members: [newUser.id],
    pinned: true,
    createdAt: Date.now(),
    unreadCount: 0
  };
  db.chats.push(savedChat);
  saveData(db);

  const { password: _, ...userSafe } = newUser;
  io.emit('user_registered', userSafe);
  res.status(201).json(userSafe);
});

// Login with Login & Password
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Введите ваш логин или телефон' });
  }
  if (!password || !password.trim()) {
    return res.status(400).json({ error: 'Введите ваш пароль' });
  }

  const q = username.trim().replace('@', '').toLowerCase();
  const user = db.users.find(u => 
    u.username.toLowerCase() === q || 
    (u.phone && u.phone.replace(/[^0-9]/g, '') === q.replace(/[^0-9]/g, ''))
  );

  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  if (user.password && user.password !== password.trim()) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  user.online = true;
  user.lastSeen = 'в сети';
  saveData(db);

  const { password: _, ...userSafe } = user;
  res.json(userSafe);
});

// Current user profile
app.get('/api/me', (req, res) => {
  const currentUserId = req.query.userId;
  if (!currentUserId) {
    return res.status(400).json({ error: 'No userId provided' });
  }
  const user = db.users.find(u => u.id === currentUserId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { password: _, ...userSafe } = user;
  res.json(userSafe);
});

app.put('/api/me', (req, res) => {
  const currentUserId = req.body.id;
  const index = db.users.findIndex(u => u.id === currentUserId);
  if (index !== -1) {
    const updated = { ...db.users[index], ...req.body };
    // Strictly enforce: ONLY user with username 'admin' has verified checkmark!
    updated.verified = updated.username?.toLowerCase() === 'admin';
    db.users[index] = updated;
    saveData(db);
    const { password: _, ...userSafe } = db.users[index];
    io.emit('user_updated', userSafe);
    res.json(userSafe);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// All users (for contact search & group invites)
app.get('/api/users', (req, res) => {
  const safeUsers = db.users.map(({ password, ...u }) => ({
    ...u,
    lastSeen: u.online ? 'в сети' : formatLastSeen(u.lastSeenTimestamp)
  }));
  res.json(safeUsers);
});

// Stories
app.get('/api/stories', (req, res) => {
  const populated = db.stories.map(s => {
    const user = db.users.find(u => u.id === s.userId);
    return { ...s, user: user ? (({ password, ...u }) => u)(user) : undefined };
  });
  res.json(populated);
});

app.post('/api/stories', (req, res) => {
  const { userId, mediaUrl, caption } = req.body;
  const newStory = {
    id: 'story_' + uuidv4(),
    userId,
    mediaUrl,
    caption: caption || '',
    timestamp: Date.now(),
    views: 1
  };
  db.stories.unshift(newStory);
  saveData(db);

  const user = db.users.find(u => u.id === newStory.userId);
  const populated = {
    ...newStory,
    user: user ? (({ password, ...u }) => u)(user) : undefined
  };
  io.emit('new_story', populated);
  res.status(201).json(populated);
});

// --- CHATS API (STRICT ISOLATION) ---

// Get chats strictly belonging to this user
app.get('/api/chats', (req, res) => {
  const currentUserId = req.query.userId;
  if (!currentUserId) {
    return res.json([]);
  }

  // Strict isolation: User only sees chats where they are an explicit member!
  const userChats = db.chats.filter(c => Array.isArray(c.members) && c.members.includes(currentUserId));

  // Ensure user has Saved Messages ("Избранное") chat
  const hasSavedChat = userChats.some(c => c.type === 'saved' || c.id === `chat_saved_${currentUserId}`);
  if (!hasSavedChat && currentUserId !== 'user_bot') {
    const savedChat = {
      id: `chat_saved_${currentUserId}`,
      type: 'saved',
      name: 'Избранное',
      avatar: '/telegram-saved.svg',
      members: [currentUserId],
      pinned: true,
      createdAt: Date.now(),
      unreadCount: 0
    };
    db.chats.push(savedChat);
    userChats.push(savedChat);
    saveData(db);
  }

  const chatsWithLastMessage = userChats.map(chat => {
    const chatMsgs = db.messages.filter(m => m.chatId === chat.id);
    const lastMessage = chatMsgs.length > 0 ? chatMsgs[chatMsgs.length - 1] : null;
    const unreadCount = chatMsgs.filter(m => m.senderId !== currentUserId && m.status !== 'read').length;

    let displayName = chat.name;
    let displayAvatar = chat.avatar;
    let targetUser = null;

    if (chat.type === 'direct') {
      const otherUserId = chat.members.find(id => id !== currentUserId) || chat.targetUserId;
      if (otherUserId) {
        const found = db.users.find(u => u.id === otherUserId);
        if (found) {
          displayName = found.name;
          displayAvatar = found.avatar;
          targetUser = {
            ...found,
            lastSeen: found.online ? 'в сети' : formatLastSeen(found.lastSeenTimestamp)
          };
        }
      }
    }

    return {
      ...chat,
      displayName,
      displayAvatar,
      targetUser: targetUser ? (({ password, ...u }) => u)(targetUser) : null,
      lastMessage,
      unreadCount
    };
  });

  // Sort by pinned, then last message timestamp
  chatsWithLastMessage.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const timeA = a.lastMessage ? a.lastMessage.timestamp : 0;
    const timeB = b.lastMessage ? b.lastMessage.timestamp : 0;
    return timeB - timeA;
  });

  res.json(chatsWithLastMessage);
});

// Create Personal Saved Messages (Избранное) on demand
app.post('/api/chats/saved', (req, res) => {
  const { currentUserId } = req.body;
  if (!currentUserId) {
    return res.status(400).json({ error: 'Missing currentUserId' });
  }

  let savedChat = db.chats.find(c => c.type === 'saved' && c.members.includes(currentUserId));
  if (!savedChat) {
    savedChat = {
      id: `chat_saved_${currentUserId}`,
      type: 'saved',
      name: 'Избранное',
      avatar: '/telegram-saved.svg',
      description: 'Ваше персональное облачное хранилище',
      pinnedMessageId: null,
      members: [currentUserId],
      isPinned: true
    };
    db.chats.unshift(savedChat);
    saveData(db);
    io.emit('new_chat', savedChat);
  }
  res.json(savedChat);
});

// Create Direct 1-on-1 Chat with another user
app.post('/api/chats/direct', (req, res) => {
  const { currentUserId, targetUserId } = req.body;
  if (!currentUserId || !targetUserId) {
    return res.status(400).json({ error: 'Missing currentUserId or targetUserId' });
  }

  const populateDirectChat = (chat, userId) => {
    const otherId = chat.members.find(id => id !== userId) || chat.targetUserId;
    const found = otherId ? db.users.find(u => u.id === otherId) : null;
    return {
      ...chat,
      displayName: found ? found.name : 'Пользователь',
      displayAvatar: found ? found.avatar : null,
      targetUser: found ? (({ password, ...u }) => u)(found) : null
    };
  };

  let existing = db.chats.find(c => 
    c.type === 'direct' && 
    c.members.includes(currentUserId) && 
    c.members.includes(targetUserId)
  );

  if (existing) {
    return res.json(populateDirectChat(existing, currentUserId));
  }

  const newChat = {
    id: 'chat_dm_' + uuidv4(),
    type: 'direct',
    targetUserId,
    members: [currentUserId, targetUserId],
    createdAt: Date.now(),
    isPinned: false
  };

  db.chats.push(newChat);
  saveData(db);
  io.emit('new_chat', newChat);
  res.status(201).json(populateDirectChat(newChat, currentUserId));
});

// Create new Group or Channel with invited friends/members
app.post('/api/chats', (req, res) => {
  const { type, name, description, username, avatar, currentUserId, memberIds } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Укажите название чата' });
  }

  // Members list: Creator + explicitly invited members
  const invited = Array.isArray(memberIds) ? memberIds : [];
  const members = Array.from(new Set([currentUserId, ...invited])).filter(Boolean);

  const newChat = {
    id: 'chat_' + uuidv4(),
    type: type || 'group',
    name: name.trim(),
    description: description ? description.trim() : '',
    username: username ? username.trim() : '',
    avatar: avatar || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
    creatorId: currentUserId,
    members,
    membersCount: members.length,
    subscribersCount: type === 'channel' ? members.length : undefined,
    isPinned: false
  };

  db.chats.unshift(newChat);
  saveData(db);
  io.emit('new_chat', newChat);
  res.status(201).json(newChat);
});

// Invite friends to an existing chat
app.post('/api/chats/:chatId/invite', (req, res) => {
  const { chatId } = req.params;
  const { currentUserId, targetUserIds } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }
  if (!chat.members.includes(currentUserId)) {
    return res.status(403).json({ error: 'Только участники могут приглашать друзей' });
  }

  const toAdd = Array.isArray(targetUserIds) ? targetUserIds : [];
  let added = false;
  toAdd.forEach(uid => {
    if (!chat.members.includes(uid)) {
      chat.members.push(uid);
      added = true;
    }
  });

  if (added) {
    chat.membersCount = chat.members.length;
    if (chat.type === 'channel') {
      chat.subscribersCount = chat.members.length;
    }
    saveData(db);
    io.emit('chat_updated', chat);
    io.emit('new_chat', chat);
  }

  res.json(chat);
});

// Messages in a chat (Protected: only members can read)
app.get('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.query.userId;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  // Strict privacy check
  if (!chat.members.includes(currentUserId)) {
    return res.status(403).json({ error: 'Доступ запрещен: вы не состоите в этом чате' });
  }

  // Mark unread as read
  let hasUpdated = false;
  db.messages.forEach(m => {
    if (m.chatId === chatId && m.senderId !== currentUserId && m.status !== 'read') {
      m.status = 'read';
      hasUpdated = true;
    }
  });
  if (hasUpdated) {
    saveData(db);
    io.emit('messages_read', { chatId, readerId: currentUserId });
  }

  const chatMsgs = db.messages.filter(m => 
    m.chatId === chatId && 
    (!m.deletedFor || !m.deletedFor.includes(currentUserId))
  );
  res.json(chatMsgs);
});

// Send message (Protected: only members can post)
app.post('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const { senderId, text, mediaUrl, mediaType, isVoice, voiceDuration, replyToId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  if (!chat.members.includes(senderId)) {
    return res.status(403).json({ error: 'Доступ запрещен: вы не состоите в этом чате' });
  }

  // Check if blocked
  if (chat.type === 'direct') {
    const otherUserId = chat.members.find(id => id !== senderId) || chat.targetUserId;
    if (otherUserId) {
      const otherUser = db.users.find(u => u.id === otherUserId);
      if (otherUser && otherUser.blockedUserIds && otherUser.blockedUserIds.includes(senderId)) {
        return res.status(403).json({ error: 'Пользователь заблокировал вас. Отправка сообщений недоступна.' });
      }
      const senderUser = db.users.find(u => u.id === senderId);
      if (senderUser && senderUser.blockedUserIds && senderUser.blockedUserIds.includes(otherUserId)) {
        return res.status(403).json({ error: 'Вы заблокировали этого пользователя. Разблокируйте, чтобы отправлять сообщения.' });
      }
    }
  }

  let replyTo = null;
  if (replyToId) {
    const parent = db.messages.find(m => m.id === replyToId);
    if (parent) {
      const sender = db.users.find(u => u.id === parent.senderId);
      replyTo = {
        id: parent.id,
        senderName: sender ? sender.name : 'Пользователь',
        text: parent.text || (parent.isVoice ? 'Голосовое сообщение' : 'Медиафайл')
      };
    }
  }

  const trimmed = (text || '').trim();
  let isDice = !!req.body.isDice;
  let diceType = req.body.diceType || null;
  let diceValue = req.body.diceValue || null;

  if (trimmed === '🎲') {
    isDice = true;
    diceType = 'dice';
    diceValue = Math.floor(Math.random() * 6) + 1;
  } else if (trimmed === '🎯') {
    isDice = true;
    diceType = 'dart';
    diceValue = Math.floor(Math.random() * 6) + 1;
  } else if (trimmed === '🏀') {
    isDice = true;
    diceType = 'basket';
    diceValue = Math.random() > 0.4 ? 1 : 0;
  } else if (trimmed === '⚽') {
    isDice = true;
    diceType = 'football';
    diceValue = Math.random() > 0.4 ? 1 : 0;
  } else if (trimmed === '🎰') {
    isDice = true;
    diceType = 'casino';
    diceValue = Math.floor(Math.random() * 64) + 1;
  }

  const newMessage = {
    id: 'msg_' + uuidv4(),
    chatId,
    senderId,
    text: text || '',
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    fileName: req.body.fileName || null,
    fileSize: req.body.fileSize || null,
    isVoice: !!isVoice,
    voiceDuration: voiceDuration || null,
    audioDuration: req.body.audioDuration || null,
    videoDuration: req.body.videoDuration || null,
    replyTo,
    timestamp: Date.now(),
    status: 'sent',
    reactions: {},
    isRoundVideo: !!req.body.isRoundVideo,
    isEdited: false,
    poll: req.body.poll || null,
    forwardFrom: req.body.forwardFrom || null,
    isSilent: !!req.body.isSilent,
    isSpoiler: !!req.body.isSpoiler,
    isDice,
    diceType,
    diceValue,
    burnTimer: req.body.burnTimer ? Number(req.body.burnTimer) : null,
    inlineKeyboard: req.body.inlineKeyboard || null,
  };

  db.messages.push(newMessage);
  saveData(db);

  io.emit('new_message', newMessage);

  // If chat is with the AI bot
  if (chat.type === 'bot' || chat.id.startsWith('chat_bot') || chat.targetUserId === 'user_bot') {
    setTimeout(() => {
      const botReply = generateBotReply(text);
      const botMessage = {
        id: 'msg_' + uuidv4(),
        chatId,
        senderId: 'user_bot',
        text: botReply.text,
        inlineKeyboard: botReply.inlineKeyboard || null,
        timestamp: Date.now(),
        status: 'read',
        reactions: {}
      };
      db.messages.push(botMessage);
      saveData(db);
      io.emit('new_message', botMessage);
    }, 600);
  }

  res.status(201).json(newMessage);
});

// React to message
app.post('/api/messages/:id/react', (req, res) => {
  const { id } = req.params;
  const { emoji, userId } = req.body;
  const uid = userId;

  const msg = db.messages.find(m => m.id === id);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  if (!msg.reactions) {
    msg.reactions = {};
  }

  if (!msg.reactions[emoji]) {
    msg.reactions[emoji] = [];
  }

  const existingIndex = msg.reactions[emoji].indexOf(uid);
  if (existingIndex !== -1) {
    msg.reactions[emoji].splice(existingIndex, 1);
    if (msg.reactions[emoji].length === 0) {
      delete msg.reactions[emoji];
    }
  } else {
    msg.reactions[emoji].push(uid);
  }

  saveData(db);
  io.emit('message_updated', msg);
  res.json(msg);
});

// Pin / Unpin message
app.post('/api/messages/:id/pin', (req, res) => {
  const { id } = req.params;
  const msg = db.messages.find(m => m.id === id);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const chat = db.chats.find(c => c.id === msg.chatId);
  if (chat) {
    chat.pinnedMessageId = chat.pinnedMessageId === id ? null : id;
    saveData(db);
    io.emit('chat_updated', chat);
    res.json({ pinnedMessageId: chat.pinnedMessageId });
  } else {
    res.status(404).json({ error: 'Chat not found' });
  }
});

// Edit chat (Name, Description, Avatar)
app.put('/api/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { name, description, avatar, currentUserId } = req.body;

  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  if (currentUserId && chat.members && !chat.members.includes(currentUserId)) {
    return res.status(403).json({ error: 'Access denied: not a member' });
  }

  if (name && name.trim()) {
    chat.name = name.trim();
    chat.displayName = chat.name;
  }
  if (description !== undefined) {
    chat.description = description.trim();
  }
  if (avatar) {
    chat.avatar = avatar;
    chat.displayAvatar = chat.avatar;
  }

  saveData(db);
  io.emit('chat_updated', chat);
  res.json(chat);
});

// Block user
app.post('/api/users/:targetUserId/block', (req, res) => {
  const { targetUserId } = req.params;
  const { currentUserId } = req.body;

  const user = db.users.find(u => u.id === currentUserId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!user.blockedUserIds) {
    user.blockedUserIds = [];
  }

  if (!user.blockedUserIds.includes(targetUserId)) {
    user.blockedUserIds.push(targetUserId);
    saveData(db);
  }

  const { password, ...safeUser } = user;
  io.emit('user_updated', safeUser);
  res.json({ success: true, blockedUserIds: user.blockedUserIds });
});

// Unblock user
app.post('/api/users/:targetUserId/unblock', (req, res) => {
  const { targetUserId } = req.params;
  const { currentUserId } = req.body;

  const user = db.users.find(u => u.id === currentUserId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!user.blockedUserIds) {
    user.blockedUserIds = [];
  }

  user.blockedUserIds = user.blockedUserIds.filter(id => id !== targetUserId);
  saveData(db);

  const { password, ...safeUser } = user;
  io.emit('user_updated', safeUser);
  res.json({ success: true, blockedUserIds: user.blockedUserIds });
});

// Edit message
app.put('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const msg = db.messages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  msg.text = text;
  msg.isEdited = true;
  saveData(db);
  io.emit('message_edited', msg);
  res.json(msg);
});

// Vote in poll
app.post('/api/messages/:id/vote', (req, res) => {
  const { id } = req.params;
  const { optionId, userId } = req.body;
  const msg = db.messages.find(m => m.id === id);
  if (!msg || !msg.poll) return res.status(404).json({ error: 'Poll not found' });

  msg.poll.options.forEach(opt => {
    if (opt.id === optionId) {
      if (!opt.votes.includes(userId)) {
        opt.votes.push(userId);
      } else {
        opt.votes = opt.votes.filter(u => u !== userId);
      }
    } else if (!msg.poll.multipleAnswers) {
      opt.votes = opt.votes.filter(u => u !== userId);
    }
  });

  saveData(db);
  io.emit('message_updated', msg);
  res.json(msg);
});

// Delete chat (for current user OR for everyone)
app.delete('/api/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  const forEveryone = req.query.forEveryone === 'true' || req.body?.forEveryone === true;
  const currentUserId = req.query.userId || req.body?.userId;

  const chatIndex = db.chats.findIndex(c => c.id === chatId);
  if (chatIndex === -1) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const chat = db.chats[chatIndex];

  if (forEveryone || chat.creatorId === currentUserId || chat.type === 'saved') {
    db.chats.splice(chatIndex, 1);
    db.messages = db.messages.filter(m => m.chatId !== chatId);
    saveData(db);
    io.emit('chat_deleted', { chatId, forEveryone: true });
    return res.json({ success: true, chatId, forEveryone: true });
  } else {
    if (chat.members && currentUserId) {
      chat.members = chat.members.filter(id => id !== currentUserId);
      chat.membersCount = chat.members.length;
      if (chat.members.length === 0) {
        db.chats.splice(chatIndex, 1);
        db.messages = db.messages.filter(m => m.chatId !== chatId);
      }
      saveData(db);
    }
    io.emit('chat_deleted', { chatId, forEveryone: false, userId: currentUserId });
    return res.json({ success: true, chatId, forEveryone: false });
  }
});

// Delete message (only for me OR for everyone)
app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  const forEveryone = req.query.forEveryone === 'true' || req.body?.forEveryone === true;
  const currentUserId = req.query.userId || req.body?.userId;

  const index = db.messages.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Message not found' });
  }

  const msg = db.messages[index];

  if (forEveryone) {
    // Delete for all users in the chat
    const deleted = db.messages.splice(index, 1)[0];
    saveData(db);
    io.emit('message_deleted', { id, chatId: deleted.chatId, forEveryone: true });
    res.json({ success: true, id, forEveryone: true });
  } else {
    // Delete only for current user
    if (!msg.deletedFor) {
      msg.deletedFor = [];
    }
    if (currentUserId && !msg.deletedFor.includes(currentUserId)) {
      msg.deletedFor.push(currentUserId);
    }
    saveData(db);
    io.emit('message_deleted_for_user', { id, chatId: msg.chatId, userId: currentUserId });
    res.json({ success: true, id, forEveryone: false });
  }
});

// Toggle Pin Chat
app.put('/api/chats/:chatId/pin', (req, res) => {
  const { chatId } = req.params;
  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  chat.isPinned = !chat.isPinned;
  saveData(db);
  io.emit('chat_updated', chat);
  res.json(chat);
});

// Toggle Archive Chat
app.put('/api/chats/:chatId/archive', (req, res) => {
  const { chatId } = req.params;
  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  chat.isArchived = !chat.isArchived;
  saveData(db);
  io.emit('chat_updated', chat);
  res.json(chat);
});

// Save Chat Draft
app.put('/api/chats/:chatId/draft', (req, res) => {
  const { chatId } = req.params;
  const { draft } = req.body;
  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  chat.draft = draft || null;
  saveData(db);
  io.emit('chat_updated', chat);
  res.json(chat);
});

// Transcribe Voice Message
app.post('/api/messages/:id/transcribe', (req, res) => {
  const { id } = req.params;
  const msg = db.messages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  const transcriptions = [
    '«Привет! Слушай, я только что проверил интерфейс, всё работает просто идеально! Звонки отличные, все эффекты на месте.»',
    '«Договорились, давай тогда через полчаса созвонимся прямо тут через аудиозвонок в Telegram, протестируем микрофон.»',
    '«Да, я посмотрел новый дизайн — точная копия Telegram Desktop! Всё летает и анимации плавные.»'
  ];

  msg.transcribedText = transcriptions[Math.floor(Math.random() * transcriptions.length)];
  saveData(db);
  io.emit('message_updated', msg);
  res.json(msg);
});

// Burn on read / self-destruct
app.post('/api/messages/:id/burn', (req, res) => {
  const { id } = req.params;
  const idx = db.messages.findIndex(m => m.id === id);
  if (idx !== -1) {
    const deleted = db.messages.splice(idx, 1)[0];
    saveData(db);
    io.emit('message_deleted', { id, chatId: deleted.chatId, forEveryone: true });
    return res.json({ success: true, id });
  }
  res.json({ success: false });
});

// User Premium & Emoji Status
app.put('/api/users/:userId/premium', (req, res) => {
  const { userId } = req.params;
  const { isPremium, emojiStatus } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (isPremium !== undefined) user.isPremium = isPremium;
  if (emojiStatus !== undefined) user.emojiStatus = emojiStatus;
  saveData(db);
  io.emit('user_updated', user);
  res.json(user);
});

// Custom Folders
app.post('/api/users/:userId/folders', (req, res) => {
  const { userId } = req.params;
  const { name, icon, chatIds } = req.body;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!user.customFolders) user.customFolders = [];
  const newFolder = {
    id: 'fld_' + uuidv4(),
    name: name || 'Новая папка',
    icon: icon || '📁',
    chatIds: chatIds || []
  };
  user.customFolders.push(newFolder);
  saveData(db);
  io.emit('user_updated', user);
  res.json(newFolder);
});

app.delete('/api/users/:userId/folders/:folderId', (req, res) => {
  const { userId, folderId } = req.params;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.customFolders) {
    user.customFolders = user.customFolders.filter(f => f.id !== folderId);
    saveData(db);
    io.emit('user_updated', user);
  }
  res.json({ success: true, folderId });
});

// --- CALLS HISTORY API ---
app.get('/api/users/:userId/calls', (req, res) => {
  const { userId } = req.params;
  const calls = (db.calls || []).filter(c => c.callerId === userId || c.receiverId === userId);
  const populated = calls.map(c => {
    const otherId = c.callerId === userId ? c.receiverId : c.callerId;
    const otherUser = db.users.find(u => u.id === otherId);
    const isCaller = c.callerId === userId;
    return {
      ...c,
      direction: isCaller ? 'outgoing' : (c.status === 'missed' ? 'missed' : 'incoming'),
      otherUser: otherUser ? {
        id: otherUser.id,
        name: otherUser.name,
        username: otherUser.username,
        avatar: otherUser.avatar,
        online: otherUser.online,
        verified: otherUser.username?.toLowerCase() === 'admin',
        isPremium: otherUser.isPremium,
        emojiStatus: otherUser.emojiStatus,
      } : null
    };
  });
  populated.sort((a, b) => b.timestamp - a.timestamp);
  res.json(populated);
});

app.post('/api/calls', (req, res) => {
  const { callerId, receiverId, duration = 0, status = 'completed', isVideo = false } = req.body;
  if (!callerId || !receiverId) return res.status(400).json({ error: 'Missing ids' });
  const newCall = {
    id: 'call_' + uuidv4(),
    callerId,
    receiverId,
    duration: Number(duration),
    status,
    isVideo: !!isVideo,
    timestamp: Date.now()
  };
  db.calls = db.calls || [];
  db.calls.unshift(newCall);
  saveData(db);
  io.emit('call_recorded', newCall);
  res.status(201).json(newCall);
});

app.delete('/api/users/:userId/calls', (req, res) => {
  const { userId } = req.params;
  db.calls = (db.calls || []).filter(c => c.callerId !== userId && c.receiverId !== userId);
  saveData(db);
  res.json({ success: true });
});

// Socket.io connection
io.on('connection', (socket) => {
  socket.on('user_online', ({ userId }) => {
    if (!userId) return;
    socketToUser.set(socket.id, userId);
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.online = true;
      user.lastSeen = 'в сети';
      user.lastSeenTimestamp = null;
      saveData(db);

      io.emit('user_status_changed', {
        userId,
        online: true,
        lastSeen: 'в сети',
        lastSeenTimestamp: null
      });
    }
  });

  socket.on('user_offline', ({ userId }) => {
    if (!userId) return;
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        const user = db.users.find(u => u.id === userId);
        if (user) {
          const now = Date.now();
          user.online = false;
          user.lastSeenTimestamp = now;
          user.lastSeen = 'был(а) только что';
          saveData(db);

          io.emit('user_status_changed', {
            userId,
            online: false,
            lastSeen: 'был(а) только что',
            lastSeenTimestamp: now
          });
        }
      }
    }
  });

  // Real-time call signaling
  socket.on('call_user', ({ callerId, callerName, callerAvatar, callerVerified, targetUserId, chatId, isVideo }) => {
    const targetSockets = userSockets.get(targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      targetSockets.forEach((sId) => {
        io.to(sId).emit('incoming_call', {
          callerId,
          callerName,
          callerAvatar,
          callerVerified,
          chatId,
          isVideo,
        });
      });
    }
  });

  socket.on('call_accept', ({ callerId, targetUserId }) => {
    const callerSockets = userSockets.get(callerId);
    if (callerSockets) {
      callerSockets.forEach((sId) => {
        io.to(sId).emit('call_accepted', { targetUserId });
      });
    }
  });

  // Debounce & record call event message in 1-on-1 direct chat timeline
  let lastRecordedCallKey = '';
  let lastRecordedCallTime = 0;

  function recordCallMessage({ callerId, receiverId, duration = 0, status = 'completed', isVideo = false }) {
    if (!callerId || !receiverId) return null;
    const key = [callerId, receiverId].sort().join(':');
    const now = Date.now();
    if (key === lastRecordedCallKey && (now - lastRecordedCallTime < 2500)) {
      return null;
    }
    lastRecordedCallKey = key;
    lastRecordedCallTime = now;

    let directChat = db.chats.find(c =>
      c.type === 'direct' &&
      c.members &&
      c.members.includes(callerId) &&
      c.members.includes(receiverId)
    );

    if (!directChat) {
      directChat = {
        id: 'chat_dm_' + uuidv4(),
        type: 'direct',
        targetUserId: receiverId,
        members: [callerId, receiverId],
        createdAt: Date.now(),
        isPinned: false
      };
      db.chats.push(directChat);
      io.emit('new_chat', directChat);
    }

    const dur = Number(duration) || 0;
    const callMsg = {
      id: 'msg_' + uuidv4(),
      chatId: directChat.id,
      senderId: callerId,
      type: 'call',
      callData: {
        callerId,
        receiverId,
        duration: dur,
        status, // 'completed' | 'missed' | 'rejected' | 'cancelled'
        isVideo: !!isVideo,
      },
      text: '',
      timestamp: Date.now(),
      status: 'read'
    };

    db.messages = db.messages || [];
    db.messages.push(callMsg);
    saveData(db);
    io.emit('new_message', callMsg);
    return callMsg;
  }

  socket.on('call_reject', ({ callerId, targetUserId }) => {
    if (callerId && targetUserId) {
      const record = {
        id: 'call_' + uuidv4(),
        callerId,
        receiverId: targetUserId,
        duration: 0,
        status: 'missed',
        isVideo: false,
        timestamp: Date.now()
      };
      db.calls = db.calls || [];
      db.calls.unshift(record);
      saveData(db);
      io.emit('call_recorded', record);

      recordCallMessage({
        callerId,
        receiverId: targetUserId,
        duration: 0,
        status: 'rejected',
        isVideo: false
      });
    }
    const callerSockets = userSockets.get(callerId);
    if (callerSockets) {
      callerSockets.forEach((sId) => {
        io.to(sId).emit('call_rejected', { targetUserId });
      });
    }
  });

  socket.on('call_end', ({ callerId, targetUserId, duration = 0, isVideo = false }) => {
    if (callerId && targetUserId) {
      const dur = Number(duration) || 0;
      const status = dur > 0 ? 'completed' : 'cancelled';
      const record = {
        id: 'call_' + uuidv4(),
        callerId,
        receiverId: targetUserId,
        duration: dur,
        status,
        isVideo: !!isVideo,
        timestamp: Date.now()
      };
      db.calls = db.calls || [];
      db.calls.unshift(record);
      saveData(db);
      io.emit('call_recorded', record);

      recordCallMessage({
        callerId,
        receiverId: targetUserId,
        duration: dur,
        status,
        isVideo: !!isVideo
      });
    }
    if (targetUserId) {
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((sId) => io.to(sId).emit('call_ended'));
      }
    }
    if (callerId) {
      const callerSockets = userSockets.get(callerId);
      if (callerSockets) {
        callerSockets.forEach((sId) => io.to(sId).emit('call_ended'));
      }
    }
  });

  // Camera Video Signaling
  socket.on('call_camera_status', ({ callerId, callerName, targetUserId, isVideo }) => {
    if (targetUserId) {
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('call_camera_status', { callerId, callerName, isVideo });
        });
      }
    }
  });

  // Screen Sharing Signaling
  socket.on('call_screen_share', ({ callerId, callerName, targetUserId, isSharing }) => {
    if (targetUserId) {
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('call_screen_share_status', { callerId, callerName, isSharing });
        });
      }
    }
  });

  // Real-time Screen Frame Relay (Guarantees zero black screen fallback across all networks)
  socket.on('screen_stream_frame', ({ targetUserId, frame, senderId, senderName }) => {
    if (targetUserId) {
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('screen_stream_frame', { frame, senderId, senderName });
        });
      }
    }
  });

  // WebRTC P2P Real Audio/Video Signaling
  socket.on('webrtc_offer', ({ targetUserId, sdp }) => {
    const targetSockets = userSockets.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach((sId) => {
        io.to(sId).emit('webrtc_offer', { senderId: socketToUser.get(socket.id), sdp });
      });
    }
  });

  socket.on('webrtc_answer', ({ targetUserId, sdp }) => {
    const targetSockets = userSockets.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach((sId) => {
        io.to(sId).emit('webrtc_answer', { senderId: socketToUser.get(socket.id), sdp });
      });
    }
  });

  socket.on('webrtc_ice_candidate', ({ targetUserId, candidate }) => {
    const targetSockets = userSockets.get(targetUserId);
    if (targetSockets) {
      targetSockets.forEach((sId) => {
        io.to(sId).emit('webrtc_ice_candidate', { senderId: socketToUser.get(socket.id), candidate });
      });
    }
  });

  // Group Voice Chat Signaling (Invitations & Screen Share)
  socket.on('voice_chat_invite', ({ chatId, chatName, inviterName, inviterId, targetUserId }) => {
    if (targetUserId) {
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('voice_chat_invitation', {
            chatId,
            chatName,
            inviterName,
            inviterId,
          });
        });
      }
    }
  });

  socket.on('voice_chat_screen_share', ({ chatId, isSharing, sharerName, sharerId }) => {
    if (chatId) {
      if (!voiceRoomScreenShares.has(chatId)) {
        voiceRoomScreenShares.set(chatId, new Map());
      }
      const roomShares = voiceRoomScreenShares.get(chatId);
      if (isSharing && sharerId) {
        roomShares.set(sharerId, { sharerId, sharerName });
      } else if (sharerId) {
        roomShares.delete(sharerId);
      }
      const activeShares = Array.from(roomShares.values());
      io.emit('voice_chat_screen_share_status', { chatId, isSharing, sharerName, sharerId, activeShares });
    }
  });

  socket.on('voice_chat_screen_frame', ({ chatId, frame, sharerId, sharerName }) => {
    socket.broadcast.emit('voice_chat_screen_frame', { chatId, frame, sharerId, sharerName });
  });

  socket.on('voice_chat_get_shares', ({ chatId }) => {
    const roomShares = voiceRoomScreenShares.get(chatId);
    const activeShares = roomShares ? Array.from(roomShares.values()) : [];
    socket.emit('voice_chat_shares_list', { chatId, activeShares });
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('user_typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.broadcast.emit('user_stop_typing', data);
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      voiceRoomScreenShares.forEach((roomShares, cId) => {
        if (roomShares.has(userId)) {
          roomShares.delete(userId);
          const activeShares = Array.from(roomShares.values());
          io.emit('voice_chat_screen_share_status', { chatId: cId, isSharing: false, sharerId: userId, activeShares });
        }
      });
      socketToUser.delete(socket.id);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
          const user = db.users.find(u => u.id === userId);
          if (user) {
            const now = Date.now();
            user.online = false;
            user.lastSeenTimestamp = now;
            user.lastSeen = 'был(а) только что';
            saveData(db);

            io.emit('user_status_changed', {
              userId,
              online: false,
              lastSeen: 'был(а) только что',
              lastSeenTimestamp: now
            });
          }
        }
      }
    }
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Telegram API running. Please build client or run Vite dev server.');
  }
});

server.listen(PORT, () => {
  console.log(`Telegram Backend server running on http://localhost:${PORT}`);
});
