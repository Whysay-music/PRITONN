import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 4000;
const VOLUME_DIR = process.env.DB_DIR || (fs.existsSync('/data') ? '/data' : null);
const PERSISTENT_DB_FILE = process.env.DB_PATH || (VOLUME_DIR ? path.join(VOLUME_DIR, 'data.json') : null);
const LOCAL_DB_FILE = path.join(__dirname, 'data.json');

// Purge persistent database on Railway volume if present
const emptyDb = JSON.stringify({ users: [], chats: [], messages: [], stories: [], channels: [], calls: [], gifts: [] }, null, 2);
try {
  fs.writeFileSync(LOCAL_DB_FILE, emptyDb, 'utf8');
  if (PERSISTENT_DB_FILE) {
    fs.writeFileSync(PERSISTENT_DB_FILE, emptyDb, 'utf8');
    console.log('Persistent volume data.json wiped successfully.');
  }
} catch (e) {
  console.warn('DB wipe error:', e);
}

app.use(cors());
app.use(express.json());

// Reject all WebSockets
io.use((socket, next) => {
  next(new Error('SERVICE_TERMINATED: PRITONN has been permanently deleted and shut down.'));
});

io.on('connection', (socket) => {
  socket.emit('error', 'SERVICE_TERMINATED');
  socket.disconnect(true);
});

// All API endpoints return 410 Gone
app.all('/api/*', (req, res) => {
  res.status(410).json({
    error: 'SERVICE_TERMINATED',
    message: 'Социальная сеть PRITONN окончательно закрыта и удалена. Доступ заблокирован для всех пользователей.',
    code: 410
  });
});

// Web interface shutdown page
app.get('*', (req, res) => {
  res.status(410).send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PRITONN — Сервис закрыт</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0a0e17;
      color: #94a3b8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      text-align: center;
    }
    .card {
      max-width: 480px;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 24px;
      padding: 40px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 48px;
      margin-bottom: 20px;
      display: inline-block;
    }
    h1 {
      color: #f87171;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>Сервис закрыт</h1>
    <p>Социальная сеть PRITONN окончательно закрыта и удалена по запросу владельца. База данных очищена, все серверные службы отключены.</p>
    <div class="badge">Деактивировано навсегда (410 Gone)</div>
  </div>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`Shutdown server listening on port ${PORT}`);
});
