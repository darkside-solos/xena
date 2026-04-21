'use strict';
const express = require('express');
const fs = require('fs');
const app = express();

// ── Top-level requires (safe, fail fast at boot) ─────────────────────
let startXena, stopTelegramBot, startTelegramBot, getBotInstance;
try {
  ({ startXena } = require('./xena'));
} catch (e) { console.warn('⚠️ ./xena not loaded:', e.message); }
try {
  ({ stopTelegramBot, startTelegramBot, getBotInstance } = require('./features/telegram-bot'));
} catch (e) { console.warn('⚠️ ./features/telegram-bot not loaded:', e.message); }

app.use(express.json());

// ── CORS — allow your subdomain AND render preview URL ───────────────
const ALLOWED_ORIGINS = [
  'https://xena.ai.xhyphertech.com',
  /\.onrender\.com$/,  // allows any *.onrender.com during dev
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
const RUNTIME_PATH = './database/runtime.json';
const CREATOR = { tgId: '8167202570', waNumber: '233530729233', name: 'Darkside' };

function loadRuntime() {
  try {
    if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true });
    if (!fs.existsSync(RUNTIME_PATH)) return {};
    return JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
  } catch (_) { return {}; }
}

function saveRuntime(data) {
  if (!fs.existsSync('./database')) fs.mkdirSync('./database', { recursive: true });
  data.CREATOR_TG_ID = CREATOR.tgId;
  data.CREATOR_WA = CREATOR.waNumber;
  data.CREATOR_NAME = CREATOR.name;
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2));
}

// ── /pair ─────────────────────────────────────────────────────────────
app.post('/pair', async (req, res) => {
  const { phone, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  if (!startXena) return res.status(500).json({ error: 'Xena module not available' });
  try {
    await startXena(phone);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ /pair error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── /deploy-telegram ──────────────────────────────────────────────────
app.post('/deploy-telegram', async (req, res) => {
  const { telegramToken, ownerId, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!telegramToken || !ownerId) return res.status(400).json({ error: 'Token and owner ID required' });
  if (!stopTelegramBot || !startTelegramBot) return res.status(500).json({ error: 'Telegram module not available' });
  try {
    const runtime = loadRuntime();
    runtime.TELEGRAM_BOT_TOKEN = telegramToken;
    runtime.TELEGRAM_OWNER_ID = String(ownerId);
    saveRuntime(runtime);

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
    console.error('❌ /deploy-telegram error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── /status ───────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({ status: 'online', bot: 'Xena AI', creator: CREATOR.name });
});

// ── Boot ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
module.exports = { loadRuntime };
