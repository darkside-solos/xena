'use strict';
const config = require('./config');
const fs = require('fs');

// ── Persistent disk path ──────────────────────────────────────────────
const DB_PATH = '/opt/render/project/src/database';
const RUNTIME_PATH = `${DB_PATH}/runtime.json`;

function loadRuntimeConfig() {
  try {
    if (!fs.existsSync(DB_PATH)) fs.mkdirSync(DB_PATH, { recursive: true });
    if (!fs.existsSync(RUNTIME_PATH)) return {};
    return JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
  } catch (_) { return {}; }
}

const runtime = loadRuntimeConfig();

// Creator always locked — nothing from runtime can override this
const mergedConfig = {
  ...config,
  ...runtime,
  CREATOR_TG_ID: '8167202570',
  CREATOR_WA: '233530729233',
  CREATOR_NAME: 'Darkside',
};

global.mergedConfig = mergedConfig;

// ── Start server first ────────────────────────────────────────────────
require('./server');

// ── Start WhatsApp bot ────────────────────────────────────────────────
const { startXena } = require('./xena');
startXena();

// ── Telegram bot ──────────────────────────────────────────────────────
// BYPASS: Don't crash if no token. Bot only starts when:
//   1. User enters token on website and taps Deploy (/deploy-telegram)
//   2. OR token was already saved to disk from a previous deploy
const token = mergedConfig.TELEGRAM_BOT_TOKEN;
if (token && token !== 'YOUR_TELEGRAM_BOT_TOKEN') {
  try {
    const { startTelegramBot, getBotInstance } = require('./features/telegram-bot');
    startTelegramBot(mergedConfig);
    global.tgBotInstance = getBotInstance();
    console.log('📲 Telegram bot started from saved token');
  } catch (e) {
    console.error('❌ Telegram bot failed to start:', e.message);
  }
} else {
  console.log('⏳ No Telegram token found — server is live, waiting for website deploy');
}

// ── Birthday checker ──────────────────────────────────────────────────
setInterval(async () => {
  const hour = new Date().getHours();
  if (hour !== 8) return;
  try {
    const { checkBirthdays } = require('./features/personality');
    const birthdays = checkBirthdays();
    for (const b of birthdays) {
      if (global.activeSession) {
        await global.activeSession.sendMessage(b.jid, {
          text: `🎂 *Happy Birthday ${b.name}!* 🎉\nWishing you an amazing day! 💜 ~ Xena`
        }).catch(() => {});
      }
      if (global.tgBotInstance && b.tgChatId) {
        await global.tgBotInstance.sendMessage(b.tgChatId,
          `🎂 *Happy Birthday ${b.name}!* 🎉\nWishing you an amazing day! 💜 ~ Xena`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.error('Birthday checker error:', e.message);
  }
}, 60 * 60 * 1000);

console.log('🤖 Xena AI starting...');