'use strict';
const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());
const path = require('path');

// Add this BEFORE your routes
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at root
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

// ── Persistent disk path ──────────────────────────────────────────────
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

// Owner code detection
if (text.toLowerCase() === 'xena123') {
  appendMsg('user', text);
  appendMsg('assistant', "Dark! 🦊💜 It's really you! My creator. I'd recognize you anywhere. What do you need boss?");
  aiLoading = false;
  document.getElementById('aiSend').disabled = false;
  return;
}

const res = await fetch(`${AUTO_SERVER}/xena-chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: aiHistory, secret: SECRET })
});
const data = await res.json();
removeTyping();
if (data.error) throw new Error(data.error);
const reply = data.reply || "Try again!";

// ── /pair ─────────────────────────────────────────────────────────────
// Uses pairXena — does NOT double-boot or re-init Telegram
app.post('/pair', async (req, res) => {
  const { phone, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const { pairXena } = require('./xena');
    await pairXena(phone);
    res.json({ success: true, message: 'Pairing started — check Telegram for code' });
  } catch (e) {
    console.error('❌ /pair error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── /deploy-telegram ──────────────────────────────────────────────────
// Called from website when user enters token and taps Deploy
// Saves token to persistent disk — bot starts immediately, survives redeploys
app.post('/deploy-telegram', async (req, res) => {
  const { telegramToken, ownerId, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!telegramToken || !ownerId) return res.status(400).json({ error: 'Token and owner ID required' });

  try {
    // Save to persistent disk
    const runtime = loadRuntime();
    runtime.TELEGRAM_BOT_TOKEN = telegramToken;
    runtime.TELEGRAM_OWNER_ID = String(ownerId);
    saveRuntime(runtime);

    // Merge with base config
    const config = require('./config');
    const mergedConfig = {
      ...config,
      ...runtime,
      CREATOR_TG_ID: CREATOR.tgId,
      CREATOR_WA: CREATOR.waNumber,
      CREATOR_NAME: CREATOR.name,
    };
    global.mergedConfig = mergedConfig;

    // Stop old bot instance if running, start fresh with new token
    const { stopTelegramBot, startTelegramBot, getBotInstance } = require('./features/telegram-bot');
    stopTelegramBot();
    setTimeout(() => {
      startTelegramBot(mergedConfig);
      global.tgBotInstance = getBotInstance();
      console.log('📲 Telegram bot deployed via website');
    }, 2000);

    res.json({ success: true, message: 'Telegram bot deployed successfully!' });
  } catch (e) {
    console.error('❌ /deploy-telegram error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── /deploy-whatsapp ──────────────────────────────────────────────────
// Called from website when user enters phone and taps Deploy WhatsApp
app.post('/deploy-whatsapp', async (req, res) => {
  const { phone, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  try {
    const { pairXena } = require('./xena');
    await pairXena(phone);
    res.json({ success: true, message: 'WhatsApp pairing started — check Telegram for code' });
  } catch (e) {
    console.error('❌ /deploy-whatsapp error:', e.message);
    res.status(500).json({ error: e.message });
  }
});
// ── /xena-chat endpoint ──────────────────────────────────────────────
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
  const runtime = loadRuntime();
  res.json({
    status: 'online',
    bot: 'Xena AI',
    creator: CREATOR.name,
    telegramDeployed: !!runtime.TELEGRAM_BOT_TOKEN,
    whatsappLinked: !!global.activeSession,
  });
});

// ── /logs ─────────────────────────────────────────────────────────────
// Optional — lets your website show live Xena logs
app.get('/logs', (req, res) => {
  const { secret } = req.query;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  res.json({ logs: global.xenaLogs || [] });
});

// ── Boot ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Xena server running on port ${PORT}`));
module.exports = { loadRuntime, saveRuntime };
