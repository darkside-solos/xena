'use strict';
const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://xena.ai.xhyphertech.com');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const SECRET = 'darkxboobs';
const RUNTIME_PATH = './database/runtime.json';
const CREATOR = { tgId: '8167202570', waNumber: '233530729233', name: 'Darkside' };

function loadRuntime() {
  try {
    if (!fs.existsSync('./database')) fs.mkdirSync('./database');
    if (!fs.existsSync(RUNTIME_PATH)) return {};
    return JSON.parse(fs.readFileSync(RUNTIME_PATH));
  } catch (_) { return {}; }
}

function saveRuntime(data) {
  if (!fs.existsSync('./database')) fs.mkdirSync('./database');
  data.CREATOR_TG_ID = CREATOR.tgId;
  data.CREATOR_WA = CREATOR.waNumber;
  data.CREATOR_NAME = CREATOR.name;
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(data, null, 2));
}

// ── /pair endpoint ───────────────────────────────────────────────────
app.post('/pair', async (req, res) => {
  const { phone, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!phone) return res.json({ error: 'Phone required' });
  try {
    const { startXena } = require('./xena');
    await startXena(phone);
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── /deploy-telegram endpoint ────────────────────────────────────────
app.post('/deploy-telegram', async (req, res) => {
  const { telegramToken, ownerId, secret } = req.body;
  if (secret !== SECRET) return res.status(403).json({ error: 'Unauthorized' });
  if (!telegramToken || !ownerId) return res.json({ error: 'Token and owner ID required' });
  try {
    const runtime = loadRuntime();
    runtime.TELEGRAM_BOT_TOKEN = telegramToken;
    runtime.TELEGRAM_OWNER_ID = String(ownerId);
    saveRuntime(runtime);

    // Update global config and restart telegram bot
    const { stopTelegramBot, startTelegramBot } = require('./features/telegram-bot');
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
      global.tgBotInstance = require('./features/telegram-bot').getBotInstance();
    }, 2000);

    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// ── /status endpoint ─────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({ status: 'online', bot: 'Xena AI', creator: CREATOR.name });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
module.exports = { loadRuntime };