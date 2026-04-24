'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── CORS ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://xena.ai.xhyphertech.com',
  /\.onrender\.com$/,
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

const SECRET = 'darkside_xena_2025';
const CREATOR = { tgId: '8167202570', waNumber: '233530729233', name: 'Darkside' };

const DB_PATH = '/opt/render/project/src/database';
const RUNTIME_PATH = `${DB_PATH}/runtime.json`;

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
}
function loadRuntime() {
  try {
    ensureDb();
    if (!fs.existsSync(RUNTIME_PATH)) return {};
    return JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
  } catch (_) { return {}; }
}
function saveRuntime(data) {
  ensureDb();
  data.CREATOR_TG_ID = CREATOR.tgId;
  data.CREATOR_WA = CREATOR.waNumber;
  data.CREATOR_NAME = CREATOR.name;
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2));
}

// ── /pair ─────────────────────────────────────────────────────────────
app.post('/pair', async (req, res) => {
  const { phone, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!phone) return res.json({ error: 'Phone required' });

  try {
    const {
      default: makeWASocket,
      useMultiFileAuthState,
      fetchLatestBaileysVersion,
      DisconnectReason,
    } = require('@whiskeysockets/baileys');
    const pino = require('pino');

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Wait for socket to connect then request code
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);

      sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'connecting') {
          try {
            // Wait a bit for handshake
            await new Promise(r => setTimeout(r, 3000));
            const code = await sock.requestPairingCode(phone.replace(/[^0-9]/g, ''));
            const formatted = (code || '').match(/.{1,4}/g)?.join('-') || code;
            clearTimeout(timeout);
            resolve(formatted);
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        }

        if (connection === 'open') {
          // Paired successfully — hand off to main bot
          sock.end();
          const { startXena } = require('./xena');
          setTimeout(() => startXena(), 1000);
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code !== DisconnectReason.loggedOut) {
            // Session saved — restart main bot
            const { startXena } = require('./xena');
            setTimeout(() => startXena(), 1000);
          }
        }
      });
    }).then(formatted => {
      res.json({ success: true, code: formatted });
    }).catch(e => {
      res.json({ error: e.message });
    });

  } catch (e) {
    res.json({ error: e.message });
  }
});

// SELF PING BY DARK
const https = require('https');
const SELF_URL = process.env.RENDER_EXTERNAL_URL || '';
if (SELF_URL) {
  setInterval(() => {
    https.get(`${SELF_URL}/status`, () => {
      console.log('🏓 Self-ping');
    }).on('error', () => {});
  }, 4 * 60 * 1000);
}

// ── /deploy-telegram ──────────────────────────────────────────────────
app.post('/deploy-telegram', async (req, res) => {
  const { telegramToken, ownerId, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!telegramToken || !ownerId) return res.json({ error: 'Token and owner ID required' });
  try {
    const runtime = loadRuntime();
    runtime.TELEGRAM_BOT_TOKEN = telegramToken;
    runtime.TELEGRAM_OWNER_ID = String(ownerId);
    saveRuntime(runtime);

    const { stopTelegramBot, startTelegramBot, getBotInstance } = require('./features/telegram-bot');
    const config = require('./config');
    const mergedConfig = {
      ...config, ...runtime,
      CREATOR_TG_ID: CREATOR.tgId,
      CREATOR_WA: CREATOR.waNumber,
      CREATOR_NAME: CREATOR.name,
    };
    global.mergedConfig = mergedConfig;
    stopTelegramBot();
    setTimeout(() => {
      startTelegramBot(mergedConfig);
      global.tgBotInstance = getBotInstance();
    }, 2000);

    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── /xena-chat ────────────────────────────────────────────────────────
app.post('/xena-chat', async (req, res) => {
  const { messages, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!messages || !Array.isArray(messages)) return res.json({ error: 'Messages required' });
  try {
    const { chat } = require('./features/chatbot');
    const reply = await chat(messages, 'website@user', false, null);
    res.json({ reply });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── /status ───────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({ status: 'online', bot: 'Xena AI', creator: CREATOR.name });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Xena server on port ${PORT}`));
module.exports = { loadRuntime };
