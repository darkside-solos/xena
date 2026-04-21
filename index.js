'use strict';
const config = require('./config');
const fs = require('fs');

// ── Load runtime config from website deploy ──────────────────────────
function loadRuntimeConfig() {
  try {
    if (!fs.existsSync('./database/runtime.json')) return {};
    return JSON.parse(fs.readFileSync('./database/runtime.json'));
  } catch (_) { return {}; }
}

const runtime = loadRuntimeConfig();

// Merge base config + runtime config — creator ALWAYS locked
const mergedConfig = {
  ...config,
  ...runtime,
  CREATOR_TG_ID: '8167202570',
  CREATOR_WA: '233530729233',
  CREATOR_NAME: 'Darkside',
};

// Make mergedConfig globally accessible
global.mergedConfig = mergedConfig;

// ── Start server (must be first) ─────────────────────────────────────
require('./server');

// ── Start WhatsApp bot ───────────────────────────────────────────────
const { startXena } = require('./xena');
startXena();

// ── Start Telegram bot if token exists ───────────────────────────────
const { startTelegramBot } = require('./features/telegram-bot');
if (mergedConfig.TELEGRAM_BOT_TOKEN &&
    mergedConfig.TELEGRAM_BOT_TOKEN !== '8674929427:AAEZeBmIHvLIvkmZJgVJ3eeVhZg89bQDJ9c') {
  startTelegramBot(mergedConfig);
  console.log('📲 Telegram bot started');
} else {
  console.log('⚠️ No Telegram token — deploy via website to activate');
}

// ── Birthday checker — only ONE place, here ──────────────────────────
setInterval(async () => {
  const hour = new Date().getHours();
  if (hour !== 8) return;
  try {
    const { checkBirthdays } = require('./features/personality');
    const birthdays = checkBirthdays();
    for (const b of birthdays) {
      // WhatsApp birthday wish
      if (global.activeSession) {
        await global.activeSession.sendMessage(b.jid, {
          text: `🎂 *Happy Birthday ${b.name}!* 🎉\nWishing you an amazing day! 💜 ~ Xena`
        }).catch(() => {});
      }
      // Telegram birthday wish
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
