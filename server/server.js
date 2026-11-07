import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import zlib from 'zlib';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import ffmpegPath from 'ffmpeg-static';
import pkgWavefile from 'wavefile';

const { WaveFile } = pkgWavefile;

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
const VOLUME_DIR = process.env.DB_DIR || (fs.existsSync('/data') ? '/data' : null);
const PERSISTENT_DB_FILE = process.env.DB_PATH || (VOLUME_DIR ? path.join(VOLUME_DIR, 'data.json') : null);
const DB_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = VOLUME_DIR ? path.join(VOLUME_DIR, 'uploads') : path.join(__dirname, 'uploads');
const LEGACY_UPLOADS_DIR = path.join(__dirname, 'uploads');
const CLIENT_DIST = path.join(__dirname, '../client/dist');
const REMOTE_SNAPSHOT_URL =
  process.env.REMOTE_DB_SNAPSHOT_URL ||
  'https://raw.githubusercontent.com/Whysay-music/PRITONN/db-state/db-snapshot.enc';
const SNAPSHOT_KEY = crypto
  .createHash('sha256')
  .update(process.env.DB_SYNC_SECRET || 'pritonn-v5-persistent-cloud-vault-2026')
  .digest();

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(LEGACY_UPLOADS_DIR)) {
  fs.mkdirSync(LEGACY_UPLOADS_DIR, { recursive: true });
}

// Multer storage with safe extension inference for mobile & blob uploads
const MIME_EXT_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/webm': '.webm',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.aac',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext && file.mimetype) {
      const baseMime = file.mimetype.split(';')[0].trim().toLowerCase();
      ext = MIME_EXT_MAP[baseMime] || '';
    }
    cb(null, `${uniqueSuffix}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');

  // Auto-restore small media (avatars, voice messages) from mediaStore or legacy uploads if container restarted
  try {
    const cleanName = path.basename(decodeURIComponent(req.path || ''));
    if (cleanName && cleanName !== '.' && cleanName !== '..') {
      const targetPath = path.join(UPLOADS_DIR, cleanName);
      if (!fs.existsSync(targetPath)) {
        const legacyPath = path.join(LEGACY_UPLOADS_DIR, cleanName);
        if (LEGACY_UPLOADS_DIR !== UPLOADS_DIR && fs.existsSync(legacyPath)) {
          fs.copyFileSync(legacyPath, targetPath);
        } else if (typeof db !== 'undefined' && db?.mediaStore?.[cleanName]?.b64) {
          fs.writeFileSync(targetPath, Buffer.from(db.mediaStore[cleanName].b64, 'base64'));
        }
      }
    }
  } catch {}

  next();
}, express.static(UPLOADS_DIR), express.static(LEGACY_UPLOADS_DIR));

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
    messages: [],
    calls: [],
    deletedIds: [],
    mediaStore: {}
  };
}

function encryptSnapshot(dataObj) {
  const iv = crypto.randomBytes(16);
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(dataObj), 'utf8'));
  const cipher = crypto.createCipheriv('aes-256-cbc', SNAPSHOT_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('base64')}`;
}

function decryptSnapshot(payloadStr) {
  if (!payloadStr || typeof payloadStr !== 'string') return null;
  const trimmed = payloadStr.trim();
  if (!trimmed.includes(':')) return null;
  const [ivHex, encB64] = trimmed.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', SNAPSHOT_KEY, iv);
  const decryptedBuf = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  let jsonStr;
  try {
    jsonStr = zlib.gunzipSync(decryptedBuf).toString('utf8');
  } catch {
    jsonStr = decryptedBuf.toString('utf8');
  }
  return JSON.parse(jsonStr);
}

function restoreMediaStoreFiles(dataObj) {
  if (!dataObj?.mediaStore || typeof dataObj.mediaStore !== 'object') return;
  for (const [filename, entry] of Object.entries(dataObj.mediaStore)) {
    try {
      if (!entry?.b64) continue;
      const safeName = path.basename(filename);
      const destPath = path.join(UPLOADS_DIR, safeName);
      if (!fs.existsSync(destPath)) {
        fs.writeFileSync(destPath, Buffer.from(entry.b64, 'base64'));
      }
    } catch {}
  }
}

// Additive union-merge so registered users, chats, messages, and voice/avatar files NEVER disappear on redeploy!
function mergeDatabases(baseDb, incomingDb) {
  if (!incomingDb || typeof incomingDb !== 'object') return baseDb;

  const deletedIds = Array.from(
    new Set([...(baseDb.deletedIds || []), ...(incomingDb.deletedIds || [])])
  ).slice(-3000);
  const deletedSet = new Set(deletedIds);

  // 1. Union-merge registered users (NEVER delete registered users!)
  const mergedUsers = [...(baseDb.users || [])];
  for (const incUser of incomingDb.users || []) {
    if (!incUser || (!incUser.id && !incUser.username)) continue;
    const cleanIncUsername = (incUser.username || '').toLowerCase();
    const idx = mergedUsers.findIndex(
      (u) =>
        u.id === incUser.id ||
        (cleanIncUsername && (u.username || '').toLowerCase() === cleanIncUsername)
    );
    if (idx === -1) {
      mergedUsers.push({ ...incUser });
    } else {
      const existing = mergedUsers[idx];
      const mergedBlocked = Array.from(
        new Set([...(existing.blockedUserIds || []), ...(incUser.blockedUserIds || [])])
      );
      const existingFolders = existing.customFolders || [];
      const incFolders = incUser.customFolders || [];
      const folderMap = new Map();
      [...existingFolders, ...incFolders].forEach((f) => {
        if (f?.id) folderMap.set(f.id, f);
      });
      const preferIncomingAvatar =
        incUser.avatar &&
        (!existing.avatar ||
          (existing.avatar.includes('dicebear.com') && !incUser.avatar.includes('dicebear.com')));

      mergedUsers[idx] = {
        ...incUser,
        ...existing,
        id: existing.id || incUser.id,
        password: existing.password || incUser.password || '',
        phone: existing.phone || incUser.phone || '',
        bio: existing.bio || incUser.bio || 'Пользователь PRITONN',
        avatar: preferIncomingAvatar ? incUser.avatar : existing.avatar || incUser.avatar,
        isPremium: existing.isPremium !== undefined ? existing.isPremium : incUser.isPremium,
        emojiStatus: existing.emojiStatus || incUser.emojiStatus,
        blockedUserIds: mergedBlocked,
        customFolders: folderMap.size > 0 ? Array.from(folderMap.values()) : existing.customFolders,
      };
    }
  }

  // 2. Union-merge chats
  const chatMap = new Map();
  for (const c of [...(incomingDb.chats || []), ...(baseDb.chats || [])]) {
    if (!c?.id || deletedSet.has(c.id)) continue;
    const prev = chatMap.get(c.id);
    if (!prev) {
      chatMap.set(c.id, { ...c });
    } else {
      const members = Array.from(new Set([...(prev.members || []), ...(c.members || [])]));
      chatMap.set(c.id, {
        ...prev,
        ...c,
        members,
        wallpaper: c.wallpaper || prev.wallpaper,
        pinnedMessageId: c.pinnedMessageId !== undefined ? c.pinnedMessageId : prev.pinnedMessageId,
      });
    }
  }

  // Ensure every non-bot user has their personal Saved Messages chat
  for (const u of mergedUsers) {
    if (!u?.id || u.isBot || u.id === 'user_bot') continue;
    const savedId = `chat_saved_${u.id}`;
    const hasSaved = Array.from(chatMap.values()).some(
      (c) => c.type === 'saved' && Array.isArray(c.members) && c.members.includes(u.id)
    );
    if (!hasSaved && !deletedSet.has(savedId)) {
      chatMap.set(savedId, {
        id: savedId,
        type: 'saved',
        name: 'Избранное',
        avatar: '/telegram-saved.svg',
        members: [u.id],
        isPinned: true,
        createdAt: Date.now(),
        unreadCount: 0,
      });
    }
  }

  // 3. Union-merge messages chronologically
  const msgMap = new Map();
  for (const m of [...(incomingDb.messages || []), ...(baseDb.messages || [])]) {
    if (!m?.id || deletedSet.has(m.id) || deletedSet.has(m.chatId)) continue;
    const prev = msgMap.get(m.id);
    if (!prev) {
      msgMap.set(m.id, { ...m });
    } else {
      msgMap.set(m.id, {
        ...prev,
        ...m,
        text: m.isEdited ? m.text : prev.isEdited ? prev.text : m.text || prev.text,
        isEdited: !!(m.isEdited || prev.isEdited),
        transcribedText: m.transcribedText || prev.transcribedText || null,
        reactions: Object.keys(m.reactions || {}).length > 0 ? m.reactions : prev.reactions || {},
        deletedFor: Array.from(new Set([...(prev.deletedFor || []), ...(m.deletedFor || [])])),
      });
    }
  }
  const mergedMessages = Array.from(msgMap.values()).sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
  );

  // 4. Union-merge stories & calls
  const storyMap = new Map();
  for (const s of [...(incomingDb.stories || []), ...(baseDb.stories || [])]) {
    if (s?.id && !deletedSet.has(s.id)) storyMap.set(s.id, s);
  }
  const mergedStories = Array.from(storyMap.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );

  const callMap = new Map();
  for (const cl of [...(incomingDb.calls || []), ...(baseDb.calls || [])]) {
    if (cl?.id) callMap.set(cl.id, cl);
  }
  const mergedCalls = Array.from(callMap.values()).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
  );

  // 5. Union-merge small uploaded media blobs (avatars & voice messages <= 750KB, cap 80 most recent)
  const combinedMedia = {
    ...(incomingDb.mediaStore || {}),
    ...(baseDb.mediaStore || {}),
  };
  const sortedMediaKeys = Object.keys(combinedMedia).sort(
    (ka, kb) => (combinedMedia[kb]?.ts || 0) - (combinedMedia[ka]?.ts || 0)
  );
  const prunedMediaStore = {};
  for (const k of sortedMediaKeys.slice(0, 80)) {
    if (combinedMedia[k]?.b64) prunedMediaStore[k] = combinedMedia[k];
  }

  baseDb.users = mergedUsers;
  baseDb.chats = Array.from(chatMap.values());
  baseDb.messages = mergedMessages;
  baseDb.stories = mergedStories;
  baseDb.calls = mergedCalls;
  baseDb.deletedIds = deletedIds;
  baseDb.mediaStore = prunedMediaStore;

  restoreMediaStoreFiles(baseDb);
  return baseDb;
}

function readJsonFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf-8');
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`Error reading DB file ${filePath}:`, err);
  }
  return null;
}

function loadData() {
  const gitSeedData = readJsonFileSafe(DB_FILE);
  const volumeData = PERSISTENT_DB_FILE ? readJsonFileSafe(PERSISTENT_DB_FILE) : null;

  let loaded = gitSeedData || volumeData;
  if (!loaded) {
    loaded = getDefaultData();
  } else if (gitSeedData && volumeData) {
    loaded = mergeDatabases(volumeData, gitSeedData);
  }

  if (!loaded.deletedIds) loaded.deletedIds = [];
  if (!loaded.mediaStore) loaded.mediaStore = {};

  // Seed mediaStore with existing small files in UPLOADS_DIR / LEGACY_UPLOADS_DIR so avatars & voice notes persist
  try {
    for (const dir of [LEGACY_UPLOADS_DIR, UPLOADS_DIR]) {
      if (!fs.existsSync(dir)) continue;
      for (const fname of fs.readdirSync(dir)) {
        const fpath = path.join(dir, fname);
        const st = fs.statSync(fpath);
        if (st.isFile() && st.size > 0 && st.size <= 750 * 1024 && !loaded.mediaStore[fname]) {
          const ext = path.extname(fname).toLowerCase();
          const mime =
            Object.entries(MIME_EXT_MAP).find(([, e]) => e === ext)?.[0] || 'application/octet-stream';
          loaded.mediaStore[fname] = {
            mime,
            b64: fs.readFileSync(fpath).toString('base64'),
            ts: st.mtimeMs || Date.now(),
          };
        }
      }
    }
  } catch {}

  restoreMediaStoreFiles(loaded);
  saveData(loaded);
  return loaded;
}

function saveData(data) {
  try {
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(DB_FILE, serialized, 'utf-8');
    if (PERSISTENT_DB_FILE && PERSISTENT_DB_FILE !== DB_FILE) {
      const dir = path.dirname(PERSISTENT_DB_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(PERSISTENT_DB_FILE, serialized, 'utf-8');
    }
  } catch (err) {
    console.error('Error writing DB:', err);
  }
}

function recordDeletedId(id) {
  if (!id) return;
  if (!Array.isArray(db.deletedIds)) db.deletedIds = [];
  if (!db.deletedIds.includes(id)) {
    db.deletedIds.push(id);
    if (db.deletedIds.length > 3000) {
      db.deletedIds = db.deletedIds.slice(-3000);
    }
  }
}

async function restoreRemoteSnapshotAndMerge() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${REMOTE_SNAPSHOT_URL}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timeout);
    if (!res.ok) return;
    const text = await res.text();
    const remoteDb = decryptSnapshot(text);
    if (remoteDb && Array.isArray(remoteDb.users)) {
      const beforeUsers = (db.users || []).length;
      const beforeMsgs = (db.messages || []).length;
      mergeDatabases(db, remoteDb);
      // Enforce strict verified badge rule after merge
      db.users.forEach((u) => {
        u.verified = u.username?.toLowerCase() === 'admin';
      });
      saveData(db);
      console.log(
        `[DB Persistence] Restored & merged cloud snapshot: users ${beforeUsers}->${db.users.length}, messages ${beforeMsgs}->${db.messages.length}`
      );
    }
  } catch (err) {
    console.log('[DB Persistence] Remote snapshot skipped or not yet initialized:', err?.message || err);
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
restoreRemoteSnapshotAndMerge();

// Active user sockets tracking
const userSockets = new Map(); // userId -> Set<socketId>
const socketToUser = new Map(); // socketId -> userId
const voiceRoomScreenShares = new Map(); // chatId -> Map(sharerId -> { sharerId, sharerName })
const recentRecordedCalls = new Map(); // sortedPairKey -> timestamp
const activeGroupVoiceChats = new Map(); // chatId -> { startedAt, initiatorId, participants: Set<userId> }

function registerUserSocket(socket, userId) {
  if (!socket || !userId || typeof userId !== 'string') return;
  socketToUser.set(socket.id, userId);
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  const user = db.users.find((u) => u.id === userId);
  if (user && !user.online) {
    user.online = true;
    user.lastSeen = 'в сети';
    user.lastSeenTimestamp = null;
    saveData(db);
    io.emit('user_status_changed', {
      userId,
      online: true,
      lastSeen: 'в сети',
      lastSeenTimestamp: null,
    });
  }
}

// Cross-version real-time delivery: delivers to registered sockets AND (if a member reconnected
// on an older app version without re-emitting user_online) also to unidentified sockets.
// All PRITONN clients strictly filter new_message / new_chat by members.includes(myId).
function emitToMembers(memberIds, event, payload) {
  const uniqueMembers = Array.from(new Set((memberIds || []).filter(Boolean)));
  const deliveredSockets = new Set();
  let hasUnmappedMember = false;

  for (const memberId of uniqueMembers) {
    const sockets = userSockets.get(memberId);
    if (sockets && sockets.size > 0) {
      sockets.forEach((sId) => {
        if (!deliveredSockets.has(sId)) {
          deliveredSockets.add(sId);
          io.to(sId).emit(event, payload);
        }
      });
    } else if (memberId !== 'user_bot') {
      hasUnmappedMember = true;
    }
  }

  if (hasUnmappedMember) {
    for (const [sId] of io.sockets.sockets) {
      if (!socketToUser.has(sId) && !deliveredSockets.has(sId)) {
        io.to(sId).emit(event, payload);
      }
    }
  }
}

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

  // Remove verified badge and any legacy shared drafts from all chats/channels
  if (db.chats) {
    db.chats.forEach(c => {
      if (c.verified) {
        c.verified = false;
        changed = true;
      }
      if ('draft' in c) {
        delete c.draft;
        changed = true;
      }
    });
  }
  if (!db.calls) {
    db.calls = [];
    changed = true;
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
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Ошибка загрузки файла' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    let originalName = req.file.originalname || req.file.filename;
    try {
      // Fix Mojibake for Cyrillic filenames uploaded via multipart/form-data
      if (/[\u0080-\u00ff]/.test(originalName) && !/[а-яёА-ЯЁ]/.test(originalName)) {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      }
    } catch {}

    // Persist small media files (<= 750 KB: avatars, Opus voice notes, stickers) inside mediaStore
    // so they survive container updates & redeployments automatically!
    try {
      if (req.file.size > 0 && req.file.size <= 750 * 1024 && fs.existsSync(req.file.path)) {
        if (!db.mediaStore) db.mediaStore = {};
        db.mediaStore[req.file.filename] = {
          mime: req.file.mimetype || 'application/octet-stream',
          b64: fs.readFileSync(req.file.path).toString('base64'),
          ts: Date.now(),
        };
        const keys = Object.keys(db.mediaStore);
        if (keys.length > 80) {
          keys
            .sort((a, b) => (db.mediaStore[b]?.ts || 0) - (db.mediaStore[a]?.ts || 0))
            .slice(80)
            .forEach((oldKey) => delete db.mediaStore[oldKey]);
        }
        saveData(db);
      }
    } catch {}

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      url: fileUrl,
      filename: originalName,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
  });
});

// Encrypted DB Snapshot endpoint for GitHub Actions db-state persistence sync
app.get('/api/internal/db-snapshot', (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(encryptSnapshot(db));
  } catch (err) {
    console.error('Snapshot export error:', err);
    res.status(500).json({ error: 'Snapshot failed' });
  }
});

// Seamless Account Vault Auto-Restore (ensures logged-in users stay registered across updates)
app.post('/api/auth/sync-account', (req, res) => {
  const { id, name, username, password, phone, avatar, bio, isPremium, emojiStatus, customFolders } =
    req.body || {};

  const cleanUsername = (username || '').replace('@', '').trim().toLowerCase();
  if (!cleanUsername || !name) {
    return res.status(400).json({ error: 'Missing account fields' });
  }

  let user = db.users.find((u) => (id && u.id === id) || u.username.toLowerCase() === cleanUsername);

  if (!user) {
    const avatarStyles = ['adventurer', 'lorelei', 'micah', 'personas', 'notionists', 'avataaars'];
    const hash = cleanUsername.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const style = avatarStyles[hash % avatarStyles.length];
    const defaultAvatar = `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanUsername}`;

    user = {
      id: id && String(id).startsWith('user_') ? String(id) : 'user_' + uuidv4(),
      name: String(name).trim(),
      username: cleanUsername,
      password: password ? String(password).trim() : '',
      phone: phone ? String(phone).trim() : '',
      avatar: avatar || defaultAvatar,
      bio: bio ? String(bio).trim() : 'Пользователь PRITONN',
      verified: cleanUsername === 'admin',
      online: true,
      lastSeen: 'в сети',
      isPremium: !!isPremium,
      emojiStatus: emojiStatus || undefined,
      customFolders: Array.isArray(customFolders) ? customFolders : [],
    };
    db.users.push(user);

    const savedChatId = `chat_saved_${user.id}`;
    if (!db.chats.some((c) => c.id === savedChatId || (c.type === 'saved' && c.members?.includes(user.id)))) {
      db.chats.push({
        id: savedChatId,
        type: 'saved',
        name: 'Избранное',
        avatar: '/telegram-saved.svg',
        members: [user.id],
        isPinned: true,
        createdAt: Date.now(),
        unreadCount: 0,
      });
    }
    saveData(db);
    const { password: _, ...safeCreated } = user;
    io.emit('user_registered', safeCreated);
    return res.json(safeCreated);
  }

  // User already exists: verify identity matches id or password
  if (user.id !== id && user.password && password && user.password !== String(password).trim()) {
    return res.status(409).json({ error: 'Account conflict' });
  }

  if (!user.password && password) {
    user.password = String(password).trim();
  }
  user.online = true;
  user.lastSeen = 'в сети';
  saveData(db);

  const { password: _, ...safeExisting } = user;
  return res.json(safeExisting);
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

    const { draft: _legacyDraft, ...cleanChat } = chat;
    return {
      ...cleanChat,
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
    const { draft: _legacyDraft, ...cleanChat } = chat;
    return {
      ...cleanChat,
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

  // Emit personalized direct chat to each participant (and fallback for older reconnected clients)
  [currentUserId, targetUserId].forEach((memberId) => {
    const populatedForMember = populateDirectChat(newChat, memberId);
    const sockets = userSockets.get(memberId);
    if (sockets && sockets.size > 0) {
      sockets.forEach((sId) => io.to(sId).emit('new_chat', populatedForMember));
    }
  });
  emitToMembers([currentUserId, targetUserId], 'new_chat', newChat);

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
  const now = Date.now();
  const readerUser = db.users.find(u => u.id === currentUserId);
  const readerName = readerUser ? readerUser.name : 'Собеседник';
  const readMsgIds = [];

  db.messages.forEach(m => {
    if (m.chatId === chatId && m.senderId !== currentUserId && m.status !== 'read') {
      m.status = 'read';
      m.readAt = m.readAt || now;
      m.readBy = m.readBy || [];
      if (!m.readBy.some(r => r.userId === currentUserId)) {
        m.readBy.push({ userId: currentUserId, userName: readerName, timestamp: now });
      }
      readMsgIds.push(m.id);
      hasUpdated = true;
    }
  });
  if (hasUpdated) {
    saveData(db);
    io.emit('messages_read', { chatId, readerId: currentUserId, readerName, readAt: now, messageIds: readMsgIds });
  }

  const chatMsgs = db.messages.filter(m => 
    m.chatId === chatId && 
    (!m.deletedFor || !m.deletedFor.includes(currentUserId))
  );
  res.json(chatMsgs);
});

// Send message (Protected: only members can post; compatible across all old & new versions)
app.post('/api/chats/:chatId/messages', (req, res) => {
  const { chatId } = req.params;
  const { senderId, text, mediaUrl, mediaType, isVoice, voiceDuration, replyToId, targetUserId } = req.body;

  let chat = db.chats.find(c => c.id === chatId);
  if (!chat && senderId) {
    if (chatId === `chat_saved_${senderId}`) {
      chat = {
        id: chatId,
        type: 'saved',
        name: 'Избранное',
        avatar: '/telegram-saved.svg',
        members: [senderId],
        isPinned: true,
        createdAt: Date.now(),
        unreadCount: 0,
      };
      db.chats.push(chat);
      saveData(db);
    } else if (targetUserId) {
      chat = db.chats.find(
        (c) =>
          c.type === 'direct' &&
          Array.isArray(c.members) &&
          c.members.includes(senderId) &&
          c.members.includes(targetUserId)
      );
      if (!chat) {
        chat = {
          id: chatId.startsWith('chat_dm_') ? chatId : 'chat_dm_' + uuidv4(),
          type: 'direct',
          targetUserId,
          members: [senderId, targetUserId],
          createdAt: Date.now(),
          isPinned: false,
        };
        db.chats.push(chat);
        saveData(db);
        emitToMembers([senderId, targetUserId], 'new_chat', chat);
      }
    }
  }

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
    chatId: chat.id,
    senderId,
    text: text || '',
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
    fileName: req.body.fileName || null,
    fileSize: req.body.fileSize || null,
    isVoice: !!isVoice,
    voiceDuration: voiceDuration || null,
    transcribedText: req.body.transcribedText || null,
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
    isSticker: !!req.body.isSticker,
    stickerUrl: req.body.stickerUrl || null,
    isGif: !!req.body.isGif,
    gifUrl: req.body.gifUrl || null,
    gameData: req.body.gameData || null,
    members: Array.isArray(chat.members) ? chat.members : [],
  };

  db.messages.push(newMessage);
  chat.lastMessage = newMessage;
  saveData(db);

  // Send message strictly to members of this chat across ALL app versions
  const recipients = Array.isArray(chat.members) && chat.members.length > 0 ? chat.members : [senderId];
  emitToMembers(recipients, 'new_message', newMessage);

  // If chat is with the AI bot
  if (chat.type === 'bot' || chat.id.startsWith('chat_bot') || chat.targetUserId === 'user_bot') {
    setTimeout(() => {
      const botReply = generateBotReply(text);
      const botMessage = {
        id: 'msg_' + uuidv4(),
        chatId: chat.id,
        senderId: 'user_bot',
        text: botReply.text,
        inlineKeyboard: botReply.inlineKeyboard || null,
        members: Array.isArray(chat.members) ? chat.members : [senderId],
        timestamp: Date.now(),
        status: 'read',
        reactions: {}
      };
      db.messages.push(botMessage);
      saveData(db);
      emitToMembers(recipients, 'new_message', botMessage);
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

// Edit chat (Name, Description, Avatar, Wallpaper)
app.put('/api/chats/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { name, description, avatar, wallpaper, currentUserId } = req.body;

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
  if (wallpaper !== undefined) {
    chat.wallpaper = wallpaper;
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
    recordDeletedId(chatId);
    db.messages.filter(m => m.chatId === chatId).forEach(m => recordDeletedId(m.id));
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
        recordDeletedId(chatId);
        db.messages.filter(m => m.chatId === chatId).forEach(m => recordDeletedId(m.id));
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
    recordDeletedId(id);
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

// Global Message Search across user's chats
app.get('/api/messages/search', (req, res) => {
  const { q, userId } = req.query;
  if (!q || !userId) return res.json([]);
  const query = q.toLowerCase().trim();

  // Strict isolation: only search in chats where user is member
  const userChatIds = new Set(
    db.chats.filter(c => Array.isArray(c.members) && c.members.includes(userId)).map(c => c.id)
  );

  const matched = (db.messages || [])
    .filter(m => userChatIds.has(m.chatId) && m.text && m.text.toLowerCase().includes(query))
    .slice(-40)
    .reverse();

  res.json(matched);
});

// Drafts are strictly per-user local on device — NEVER store drafts on shared chat objects!
const handleSaveChatDraft = (req, res) => {
  const { chatId } = req.params;
  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if ('draft' in chat) {
    delete chat.draft;
    saveData(db);
  }
  res.json({ ok: true, chatId });
};
app.put('/api/chats/:chatId/draft', handleSaveChatDraft);
app.post('/api/chats/:chatId/draft', handleSaveChatDraft);

// --- ZERO-OOM SERVER-SIDE WHISPER LARGE-V3 SPEECH-TO-TEXT ENGINE (Russian ASR) ---
const WHISPER_GPU_ENDPOINTS = [
  { base: 'https://hf-audio-whisper-large-v3.hf.space', endpoint: '/transcribe' },
  { base: 'https://openai-whisper.hf.space', endpoint: '/predict' },
];

async function callWhisperGradioGpu(wavBuffer, base, endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const fd = new FormData();
    fd.append('files', new Blob([wavBuffer], { type: 'audio/wav' }), 'voice.wav');

    const upRes = await fetch(`${base}/gradio_api/upload`, {
      method: 'POST',
      body: fd,
      signal: controller.signal,
    });
    if (!upRes.ok) {
      throw new Error(`Upload ${upRes.status}`);
    }
    const uploaded = await upRes.json();
    const remotePath = Array.isArray(uploaded) ? uploaded[0] : null;
    if (!remotePath) {
      throw new Error('Empty Gradio upload path');
    }

    const callRes = await fetch(`${base}/gradio_api/call${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{ path: remotePath, meta: { _type: 'gradio.FileData' } }, 'transcribe'],
      }),
      signal: controller.signal,
    });
    if (!callRes.ok) {
      throw new Error(`Call ${callRes.status}`);
    }
    const { event_id } = await callRes.json();
    if (!event_id) {
      throw new Error('Missing event_id');
    }

    const sseRes = await fetch(`${base}/gradio_api/call${endpoint}/${event_id}`, {
      signal: controller.signal,
    });
    if (!sseRes.ok) {
      throw new Error(`SSE ${sseRes.status}`);
    }
    const sseText = await sseRes.text();
    const lines = sseText.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('event: complete')) {
        const dataLine = lines.slice(i + 1).find((l) => l.startsWith('data:'));
        if (dataLine) {
          const parsed = JSON.parse(dataLine.slice(5).trim());
          if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
            return parsed[0].trim();
          }
        }
      }
      if (lines[i].startsWith('event: error')) {
        throw new Error('Gradio worker returned error');
      }
    }
    throw new Error('No complete event in SSE stream');
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAudioBufferForTranscription(mediaUrl) {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('Аудиозапись не найдена');
  }
  const trimmed = mediaUrl.trim();

  // 1. Base64 data: URI
  if (trimmed.startsWith('data:')) {
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx !== -1) {
      return {
        buffer: Buffer.from(trimmed.slice(commaIdx + 1), 'base64'),
        ext: '.webm',
      };
    }
  }

  // 2. Local /uploads/... path or full URL pointing to /uploads/...
  const uploadsMatch = trimmed.match(/\/uploads\/([^?#]+)/);
  if (uploadsMatch && uploadsMatch[1]) {
    const fname = path.basename(decodeURIComponent(uploadsMatch[1]));
    const primaryPath = path.join(UPLOADS_DIR, fname);
    const legacyPath = path.join(LEGACY_UPLOADS_DIR, fname);
    if (fs.existsSync(primaryPath)) {
      return { buffer: fs.readFileSync(primaryPath), ext: path.extname(fname) || '.webm' };
    }
    if (fs.existsSync(legacyPath)) {
      return { buffer: fs.readFileSync(legacyPath), ext: path.extname(fname) || '.webm' };
    }
    if (db?.mediaStore?.[fname]?.b64) {
      const buf = Buffer.from(db.mediaStore[fname].b64, 'base64');
      try {
        fs.writeFileSync(primaryPath, buf);
      } catch {}
      return { buffer: buf, ext: path.extname(fname) || '.webm' };
    }
  }

  // 3. Remote HTTP(S) URL fallback
  if (/^https?:\/\//i.test(trimmed)) {
    const resp = await fetch(trimmed);
    if (!resp.ok) {
      throw new Error(`Не удалось скачать аудиофайл (${resp.status})`);
    }
    const arrBuf = await resp.arrayBuffer();
    const urlPath = new URL(trimmed).pathname;
    return { buffer: Buffer.from(arrBuf), ext: path.extname(urlPath) || '.webm' };
  }

  throw new Error('Файл голосового сообщения недоступен на сервере');
}

function decodeAudioBufferTo16kWav(audioBuffer, extHint = '.webm') {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
      return reject(new Error('Декодер аудио (ffmpeg) не найден на сервере'));
    }
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safeExt = extHint && /^\.[a-z0-9]{1,5}$/i.test(extHint) ? extHint : '.webm';
    const inTmp = path.join(os.tmpdir(), `pritonn_asr_in_${uid}${safeExt}`);
    const outTmp = path.join(os.tmpdir(), `pritonn_asr_out_${uid}.wav`);

    const cleanup = () => {
      try { if (fs.existsSync(inTmp)) fs.unlinkSync(inTmp); } catch {}
      try { if (fs.existsSync(outTmp)) fs.unlinkSync(outTmp); } catch {}
    };

    try {
      fs.writeFileSync(inTmp, audioBuffer);
    } catch (e) {
      cleanup();
      return reject(e);
    }

    const ff = spawn(ffmpegPath, [
      '-y',
      '-i',
      inTmp,
      '-af',
      'highpass=f=70,dynaudnorm',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-f',
      'wav',
      outTmp,
    ]);

    let stderrText = '';
    ff.stderr.on('data', (chunk) => {
      stderrText += chunk.toString();
    });

    ff.on('error', (err) => {
      cleanup();
      reject(err);
    });

    ff.on('close', (code) => {
      try {
        if (code !== 0 || !fs.existsSync(outTmp)) {
          cleanup();
          return reject(new Error(`Ошибка декодирования звука (${code}): ${stderrText.slice(-160)}`));
        }
        const wavBuf = fs.readFileSync(outTmp);
        const wav = new WaveFile(wavBuf);
        wav.toBitDepth('32f');
        wav.toSampleRate(16000);
        let samples = wav.getSamples();
        if (Array.isArray(samples)) {
          samples = samples[0];
        }
        const float32 = samples instanceof Float32Array ? samples : Float32Array.from(samples);
        cleanup();
        resolve({ wavBuffer: wavBuf, pcm16k: float32 });
      } catch (parseErr) {
        cleanup();
        reject(parseErr);
      }
    });
  });
}

async function transcribeMediaOnServer(mediaUrl) {
  const { buffer, ext } = await resolveAudioBufferForTranscription(mediaUrl);
  if (!buffer || buffer.length < 64) {
    return '[Аудиозапись пуста]';
  }
  const { wavBuffer, pcm16k } = await decodeAudioBufferTo16kWav(buffer, ext);
  if (!pcm16k || pcm16k.length < 800) {
    return '[Тишина — запись слишком короткая]';
  }

  let sumSq = 0;
  for (let i = 0; i < pcm16k.length; i++) {
    sumSq += pcm16k[i] * pcm16k[i];
  }
  const rms = Math.sqrt(sumSq / Math.max(1, pcm16k.length));
  if (rms < 0.0006) {
    return '[Тишина — речь на записи не обнаружена]';
  }

  let rawText = '';
  let lastErr = null;
  for (const node of WHISPER_GPU_ENDPOINTS) {
    try {
      rawText = await callWhisperGradioGpu(wavBuffer, node.base, node.endpoint);
      if (rawText) break;
    } catch (err) {
      lastErr = err;
      console.warn(`[ASR] Failover from ${node.base}:`, err?.message || err);
    }
  }

  if (!rawText && lastErr) {
    throw new Error('Сервис распознавания речи временно перегружен, попробуйте через пару секунд');
  }

  const cleaned = rawText
    .replace(/^\s*\[.*?\]\s*$/g, '')
    .replace(/^\s*\(.*?\)\s*$/g, '')
    .replace(/Редактор субтитров.*$/i, '')
    .replace(/Субтитры сделал.*$/i, '')
    .replace(/Субтитры создавал.*$/i, '')
    .replace(/Продолжение следует\.{0,3}$/i, '')
    .trim();

  return cleaned || '[Речь не распознана]';
}

// Standalone server speech-to-text endpoint for direct audio URLs
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioUrl } = req.body || {};
    if (!audioUrl) {
      return res.status(400).json({ error: 'Не указан audioUrl' });
    }
    const text = await transcribeMediaOnServer(audioUrl);
    res.json({ text });
  } catch (err) {
    console.error('[ASR] /api/transcribe-audio error:', err);
    res.status(500).json({ error: err?.message || 'Ошибка серверного распознавания речи' });
  }
});

// Save or Perform Real Server-Side Speech-to-Text Transcription on Voice/Audio Message
app.post('/api/messages/:id/transcribe', async (req, res) => {
  const { id } = req.params;
  const { transcribedText, useServer, force, audioUrl } = req.body || {};
  const msg = db.messages.find(m => m.id === id);

  // If message isn't found in DB (e.g. local/unsaved), still transcribe if audioUrl was supplied
  if (!msg) {
    if (audioUrl) {
      try {
        const text = await transcribeMediaOnServer(audioUrl);
        return res.json({ id, transcribedText: text });
      } catch (err) {
        return res.status(500).json({ error: err?.message || 'Ошибка распознавания речи' });
      }
    }
    return res.status(404).json({ error: 'Message not found' });
  }

  try {
    if (!useServer && typeof transcribedText === 'string' && transcribedText.trim()) {
      msg.transcribedText = transcribedText.trim();
    } else if (msg.transcribedText && !force) {
      return res.json(msg);
    } else {
      const targetMedia = msg.mediaUrl || audioUrl;
      if (!targetMedia) {
        return res.status(400).json({ error: 'У этого сообщения нет аудиозаписи' });
      }
      const recognized = await transcribeMediaOnServer(targetMedia);
      msg.transcribedText = recognized;
    }

    if (msg.transcribedText && !msg.transcribedText.startsWith('[')) {
      saveData(db);
      const chat = db.chats.find(c => c.id === msg.chatId);
      const recipients = chat && Array.isArray(chat.members) && chat.members.length > 0 ? chat.members : null;
      if (recipients) {
        emitToMembers(recipients, 'message_updated', msg);
      } else {
        io.emit('message_updated', msg);
      }
    }
    res.json(msg);
  } catch (err) {
    console.error('[ASR] Message transcription error:', err);
    res.status(500).json({ error: err?.message || 'Ошибка распознавания речи на сервере' });
  }
});

// App Version & In-App Updater Metadata Endpoint
app.get('/api/app-version', (req, res) => {
  let pkgVersion = '5.16.0';
  try {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    if (rootPkg && rootPkg.version) pkgVersion = rootPkg.version;
  } catch {}
  res.json({
    version: pkgVersion,
    releaseNotes: 'PRITONN v' + pkgVersion + ' — Виртуальные подарки и Telegram Stars, секретные фото (1 просмотр), музыкальный статус «Слушает сейчас», совместный просмотр видео (Watch Together), AI шумоподавление и фон камеры, темы/форумы в группах, быстрые шаблоны ответов и переводчик сообщений.',
    apkUrl: `https://github.com/Whysay-music/PRITONN/releases/download/v${pkgVersion}/PRITONN_v${pkgVersion}.apk`,
    winSetupUrl: `https://github.com/Whysay-music/PRITONN/releases/download/v${pkgVersion}/PRITONN_Setup_${pkgVersion}.exe`,
    releasePageUrl: 'https://github.com/Whysay-music/PRITONN/releases/latest',
  });
});

// Burn on read / self-destruct / view-once
app.post('/api/messages/:id/burn', (req, res) => {
  const { id } = req.params;
  const idx = db.messages.findIndex(m => m.id === id);
  if (idx !== -1) {
    recordDeletedId(id);
    const deleted = db.messages.splice(idx, 1)[0];
    saveData(db);
    io.emit('message_deleted', { id, chatId: deleted.chatId, forEveryone: true });
    return res.json({ success: true, id });
  }
  res.json({ success: false });
});

// Send virtual gift endpoint
app.post('/api/users/:userId/gifts', (req, res) => {
  const { userId } = req.params;
  const { fromUserId, gift, message } = req.body;
  const targetUser = db.users.find(u => u.id === userId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const sender = db.users.find(u => u.id === fromUserId);
  const senderName = sender ? sender.name : 'Пользователь';

  const newGift = {
    id: 'gift_' + uuidv4(),
    giftId: gift?.id || 'gift_custom',
    title: gift?.title || 'Подарок',
    icon: gift?.icon || '🎁',
    fromUserId: fromUserId || '',
    fromUserName: senderName,
    timestamp: Date.now(),
    message: message || '',
  };

  targetUser.gifts = targetUser.gifts || [];
  targetUser.gifts.unshift(newGift);

  if (sender && sender.starsBalance !== undefined && gift?.price) {
    sender.starsBalance = Math.max(0, sender.starsBalance - gift.price);
  }

  saveData(db);
  io.emit('gift_received', { targetUserId: userId, gift: newGift });
  res.json({ success: true, gift: newGift, user: targetUser });
});

// Create topic in group chat (Forum Topics)
app.post('/api/chats/:chatId/topics', (req, res) => {
  const { chatId } = req.params;
  const { name, icon, color } = req.body;
  const chat = db.chats.find(c => c.id === chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  chat.isForum = true;
  chat.topics = chat.topics || [
    { id: 'topic_general', name: 'Общий', icon: '💬', color: '#5288c1', createdAt: Date.now() }
  ];

  const newTopic = {
    id: 'topic_' + uuidv4(),
    name: name || 'Новая тема',
    icon: icon || '💡',
    color: color || '#38bdf8',
    createdAt: Date.now()
  };

  chat.topics.push(newTopic);
  saveData(db);
  io.emit('topic_created', { chatId, topic: newTopic });
  res.json({ success: true, topic: newTopic, chat });
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
  // Auto-register userId from Socket.IO handshake query (guarantees seamless reconnects across deploys)
  const queryUserId = socket.handshake?.query?.userId;
  if (typeof queryUserId === 'string' && queryUserId.trim().startsWith('user_')) {
    registerUserSocket(socket, queryUserId.trim());
  }

  socket.on('user_online', ({ userId } = {}) => {
    if (!userId) return;
    registerUserSocket(socket, userId);
  });

  socket.on('mark_read', ({ chatId, userId }) => {
    if (!chatId || !userId) return;
    let hasUpdated = false;
    const now = Date.now();
    const readerUser = db.users.find(u => u.id === userId);
    const readerName = readerUser ? readerUser.name : 'Собеседник';
    const readMsgIds = [];

    db.messages.forEach(m => {
      if (m.chatId === chatId && m.senderId !== userId && m.status !== 'read') {
        m.status = 'read';
        m.readAt = m.readAt || now;
        m.readBy = m.readBy || [];
        if (!m.readBy.some(r => r.userId === userId)) {
          m.readBy.push({ userId, userName: readerName, timestamp: now });
        }
        readMsgIds.push(m.id);
        hasUpdated = true;
      }
    });
    if (hasUpdated) {
      saveData(db);
      io.emit('messages_read', { chatId, readerId: userId, readerName, readAt: now, messageIds: readMsgIds });
    }
  });

  socket.on('user_listening', ({ userId, trackTitle, artist, isPlaying } = {}) => {
    if (!userId) return;
    const user = db.users.find((u) => u.id === userId);
    if (user) {
      user.listeningTrack = isPlaying
        ? { title: trackTitle || 'Трек', artist: artist || '', isPlaying: true }
        : null;
      io.emit('user_listening_updated', { userId, listeningTrack: user.listeningTrack });
    }
  });

  socket.on('watch_together_sync', (payload) => {
    if (!payload?.chatId) return;
    socket.to(`voice_room_${payload.chatId}`).emit('watch_together_sync', payload);
    socket.broadcast.emit('watch_together_sync', payload);
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

  // Debounce & record call event message in 1-on-1 direct chat timeline (global across sockets)
  function recordCallMessage({ callerId, receiverId, chatId: explicitChatId, duration = 0, status = 'completed', isVideo = false }) {
    if (!callerId || !receiverId) return null;
    const key = [callerId, receiverId].sort().join(':');
    const now = Date.now();
    const prevTime = recentRecordedCalls.get(key) || 0;
    if (now - prevTime < 3000) {
      return null;
    }
    recentRecordedCalls.set(key, now);

    let directChat = explicitChatId
      ? db.chats.find(c => c.id === explicitChatId)
      : null;

    if (!directChat) {
      directChat = db.chats.find(c =>
        c.type === 'direct' &&
        c.members &&
        c.members.includes(callerId) &&
        c.members.includes(receiverId)
      );
    }

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
    const summaryText = dur > 0
      ? (isVideo ? '📹 Видеозвонок завершён' : '📞 Звонок завершён')
      : status === 'rejected'
      ? '📞 Звонок отклонён'
      : '📞 Звонок завершён (без ответа)';

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
      text: summaryText,
      timestamp: Date.now(),
      status: 'read',
      members: Array.isArray(directChat.members) ? directChat.members : [callerId, receiverId]
    };

    db.messages = db.messages || [];
    db.messages.push(callMsg);
    directChat.lastMessage = callMsg;
    saveData(db);

    const recipients = Array.isArray(directChat.members) && directChat.members.length > 0 ? directChat.members : [callerId, receiverId];
    emitToMembers(recipients, 'new_message', callMsg);
    return callMsg;
  }

  function finishGroupVoiceChatIfEmpty(chatId, fallbackUserId) {
    if (!chatId) return;
    const session = activeGroupVoiceChats.get(chatId);
    if (!session) return;

    const room = io.sockets.adapter.rooms.get(`voice_room_${chatId}`);
    const remainingSockets = room ? room.size : 0;
    if (remainingSockets === 0 || session.participants.size === 0) {
      activeGroupVoiceChats.delete(chatId);
      const chat = db.chats.find(c => c.id === chatId);
      if (!chat) return;

      const durationSec = Math.max(1, Math.round((Date.now() - (session.startedAt || Date.now())) / 1000));
      const endMsg = {
        id: 'msg_' + uuidv4(),
        chatId,
        senderId: fallbackUserId || session.initiatorId || chat.creatorId || (chat.members && chat.members[0]) || 'system',
        text: '📞 Голосовой звонок завершён',
        type: 'voice_chat_end',
        callData: {
          callerId: session.initiatorId || fallbackUserId || '',
          receiverId: chatId,
          duration: durationSec,
          status: 'completed',
          isVideo: false
        },
        timestamp: Date.now(),
        status: 'read',
        members: chat.members || []
      };

      db.messages = db.messages || [];
      db.messages.push(endMsg);
      chat.lastMessage = endMsg;
      saveData(db);

      emitToMembers(chat.members || [], 'new_message', endMsg);
    }
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

  const handleCallEndEvent = ({ callerId, targetUserId, chatId, duration = 0, status: explicitStatus, isVideo = false }) => {
    if (callerId && targetUserId) {
      const dur = Number(duration) || 0;
      const status = explicitStatus || (dur > 0 ? 'completed' : 'cancelled');
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
        chatId,
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
  };

  socket.on('call_end', handleCallEndEvent);
  socket.on('end_call', handleCallEndEvent);

  // Camera Video Signaling & Zero-Black-Screen Fallback Relay
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

  socket.on('call_camera_frame', ({ targetUserId, frame, senderId }) => {
    if (targetUserId) {
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach((sId) => {
          io.to(sId).emit('call_camera_frame', { frame, senderId });
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

  // Group Voice Chat Signaling (Invitations, Joining, Ending & Screen Share)
  socket.on('voice_chat_start', ({ chatId, chatName, initiatorId, initiatorName }) => {
    socket.join(`voice_room_${chatId}`);
    if (chatId) {
      let session = activeGroupVoiceChats.get(chatId);
      const isNewSession = !session;
      if (!session) {
        session = {
          startedAt: Date.now(),
          initiatorId,
          participants: new Set()
        };
        activeGroupVoiceChats.set(chatId, session);
      }
      if (initiatorId) {
        session.participants.add(initiatorId);
      }

      const chat = db.chats.find(c => c.id === chatId);
      if (chat && isNewSession) {
        // Prevent duplicate spam messages within 15 seconds
        const recentCallMsg = (db.messages || []).find(m => m.chatId === chatId && m.type === 'voice_chat_start' && (Date.now() - m.timestamp < 15000));
        if (!recentCallMsg) {
          const newMsg = {
            id: 'msg_' + uuidv4(),
            chatId,
            senderId: initiatorId,
            text: '🎙️ Голосовой звонок начался',
            type: 'voice_chat_start',
            timestamp: Date.now(),
            members: chat.members
          };
          if (!db.messages) db.messages = [];
          db.messages.push(newMsg);
          chat.lastMessage = newMsg;
          saveData(db);

          // Send message to all group members so button appears in chat
          (chat.members || []).forEach(memberId => {
            const mSockets = userSockets.get(memberId);
            if (mSockets) {
              mSockets.forEach(sId => io.to(sId).emit('new_message', newMsg));
            }
          });
        }
      }
      io.to(`voice_room_${chatId}`).emit('voice_chat_started', { chatId, initiatorId, initiatorName });
    }
  });

  socket.on('voice_chat_join', ({ chatId, user }) => {
    socket.join(`voice_room_${chatId}`);
    if (chatId && user?.id) {
      let session = activeGroupVoiceChats.get(chatId);
      if (!session) {
        session = { startedAt: Date.now(), initiatorId: user.id, participants: new Set() };
        activeGroupVoiceChats.set(chatId, session);
      }
      session.participants.add(user.id);
    }
    io.to(`voice_room_${chatId}`).emit('voice_chat_user_joined', { chatId, user });
  });

  socket.on('voice_chat_leave', ({ chatId, userId }) => {
    socket.leave(`voice_room_${chatId}`);
    if (chatId && userId) {
      const session = activeGroupVoiceChats.get(chatId);
      if (session) {
        session.participants.delete(userId);
      }
      const roomShares = voiceRoomScreenShares.get(chatId);
      if (roomShares && roomShares.has(userId)) {
        roomShares.delete(userId);
        const activeShares = Array.from(roomShares.values());
        io.emit('voice_chat_screen_share_status', {
          chatId,
          isSharing: false,
          sharerId: userId,
          activeShares,
        });
      }
    }
    io.to(`voice_room_${chatId}`).emit('voice_chat_user_left', { chatId, userId });
    finishGroupVoiceChatIfEmpty(chatId, userId);
  });

  socket.on('voice_chat_end', ({ chatId, userId }) => {
    if (!chatId) return;
    socket.leave(`voice_room_${chatId}`);
    const session = activeGroupVoiceChats.get(chatId);
    if (session) {
      session.participants.clear();
    }
    if (voiceRoomScreenShares.has(chatId)) {
      voiceRoomScreenShares.delete(chatId);
      io.emit('voice_chat_screen_share_status', {
        chatId,
        isSharing: false,
        sharerId: userId || '',
        activeShares: [],
      });
    }
    io.to(`voice_room_${chatId}`).emit('voice_chat_ended', { chatId });
    finishGroupVoiceChatIfEmpty(chatId, userId);
  });

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

  socket.on('game_move', ({ messageId, chatId, board, winner, gameData }) => {
    const msg = (db.messages || []).find(m => m.id === messageId);
    if (msg) {
      if (gameData) {
        msg.gameData = gameData;
      } else {
        if (!msg.gameData) msg.gameData = { type: 'tictactoe', board, turn: 'X' };
        msg.gameData.board = board;
        msg.gameData.winner = winner;
      }
      saveData(db);
    }
    const payload = { messageId, board, winner, gameData: msg?.gameData || gameData };
    const chat = (db.chats || []).find(c => c.id === chatId);
    if (chat && Array.isArray(chat.members)) {
      chat.members.forEach(mId => {
        const s = userSockets.get(mId);
        if (s) s.forEach(sId => io.to(sId).emit('game_move', payload));
      });
    } else {
      io.emit('game_move', payload);
    }
  });

  socket.on('disconnect', () => {
    const userId = socketToUser.get(socket.id);
    if (userId) {
      activeGroupVoiceChats.forEach((session, cId) => {
        if (session.participants.has(userId)) {
          session.participants.delete(userId);
          io.to(`voice_room_${cId}`).emit('voice_chat_user_left', { chatId: cId, userId });
          finishGroupVoiceChatIfEmpty(cId, userId);
        }
      });
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
