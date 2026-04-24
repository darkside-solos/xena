'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Railway-safe paths
const DB_PATH = path.join(__dirname, 'database');
const SESSIONS_PATH = path.join(__dirname, 'sessions');
const RUNTIME_PATH = path.join(DB_PATH, 'runtime.json');

// Ensure folders exist
function ensureDirs() {
  [DB_PATH, SESSIONS_PATH].forEach(p => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}
ensureDirs();

// ── ROOT ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── CORS ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://xena.ai.xhyphertech.com',
  /\.railway\.app$/,
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGINS.some(o =>
    typeof o === 'string' ? o === origin : o.test(origin || '')
  );
  if (allowed) res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── CONFIG ───────────────────────────────────────
const SECRET = process.env.SECRET || 'darkside_xena_2025';

const CREATOR = {
  tgId: '8167202570',
  waNumber: '233530729233',
  name: 'Darkside'
};

// ── DB FUNCTIONS ─────────────────────────────────
function loadRuntime() {
  try {
    if (!fs.existsSync(RUNTIME_PATH)) return {};
    return JSON.parse(fs.readFileSync(RUNTIME_PATH));
  } catch {
    return {};
  }
}

function saveRuntime(data) {
  data.CREATOR = CREATOR;
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2));
}

// ── MULTI USER PAIR ──────────────────────────────
app.post('/pair', async (req, res) => {
  const { phone, userId, secret } = req.body;

  if (secret !== SECRET)
    return res.status(403).json({ error: 'Unauthorized' });

  if (!phone || !userId)
    return res.json({ error: 'Phone + userId required' });

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      fetchLatestBaileysVersion
    } = require('@whiskeysockets/baileys');

    const pino = require('pino');

    // ✅ Separate session per user
    const sessionDir = path.join(SESSIONS_PATH, userId);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    let responded = false;

    sock.ev.on('connection.update', async ({ connection }) => {

      if (connection === 'connecting' && !responded) {
        try {
          await new Promise(r => setTimeout(r, 3000));

          const code = await sock.requestPairingCode(
            phone.replace(/[^0-9]/g, '')
          );

          const formatted =
            code?.match(/.{1,4}/g)?.join('-') || code;

          responded = true;
          res.json({ success: true, code: formatted });

        } catch (e) {
          if (!responded) {
            responded = true;
            res.json({ error: e.message });
          }
        }
      }

      if (connection === 'open') {
        console.log(`✅ User ${userId} paired`);
        sock.end();

        const { startXena } = require('./xena');
        setTimeout(() => startXena(), 1000);
      }
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── TELEGRAM DEPLOY ──────────────────────────────
app.post('/deploy-telegram', async (req, res) => {
  const { telegramToken, ownerId, secret } = req.body;

  if (secret !== SECRET)
    return res.status(403).json({ error: 'Unauthorized' });

  try {
    const runtime = loadRuntime();

    runtime.TELEGRAM_BOT_TOKEN = telegramToken;
    runtime.TELEGRAM_OWNER_ID = String(ownerId);

    saveRuntime(runtime);

    const {
      stopTelegramBot,
      startTelegramBot,
      getBotInstance
    } = require('./features/telegram-bot');

    stopTelegramBot();

    setTimeout(() => {
      startTelegramBot(runtime);
      global.tgBotInstance = getBotInstance();
    }, 2000);

    res.json({ success: true });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── CHAT ─────────────────────────────────────────
app.post('/xena-chat', async (req, res) => {
  const { messages, secret } = req.body;

  if (secret !== SECRET)
    return res.status(403).json({ error: 'Unauthorized' });

  try {
    const { chat } = require('./features/chatbot');
    const reply = await chat(messages, 'web-user');

    res.json({ reply });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── STATUS ───────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({ status: 'online', platform: 'railway' });
});

// ── START SERVER ────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Xena running on Railway port ${PORT}`);
});
