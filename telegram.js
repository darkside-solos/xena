'use strict';
const { handleCommand } = require('./features/commands');
const { handleGame, detectTrigger } = require('./features/games');
const TelegramBot = require('node-telegram-bot-api');

let bot = null;

function initTelegram(onPairRequest, onRestart, onStatus) {
  // ── BYPASS — read from global mergedConfig, not static config ────
  const cfg = global.mergedConfig || {};
  const token = cfg.TELEGRAM_BOT_TOKEN;
  const ownerId = String(cfg.TELEGRAM_OWNER_ID || '');

  // No token = skip silently, no crash, no 404 spam
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
    console.log('⏳ Telegram panel skipped — no token yet');
    return null;
  }

  bot = new TelegramBot(token, { polling: true });

  function isOwner(msg) { return String(msg.from.id) === ownerId; }
  function send(text) {
    bot.sendMessage(ownerId, text, { parse_mode: 'Markdown' }).catch(() => {});
  }

  bot.onText(/\/start/, (msg) => {
    if (!isOwner(msg)) return;
    send(`👋 *Xena Control Panel*\n\n/pair 2348012345678 — Connect WhatsApp\n/status — Check online\n/restart — Reconnect\n/logs — Recent activity`);
  });

  bot.onText(/\/pair(?:\s+(\d+))?/, async (msg, match) => {
    if (!isOwner(msg)) return;
    const phone = match[1]?.replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      return send(`📱 Usage: /pair 2348012345678\n_Full number with country code, no +_`);
    }
    send(`⏳ Starting socket for *${phone}*...`);
    try {
      await onPairRequest(phone);
    } catch (err) {
      send(`❌ Failed: ${err.message}`);
    }
  });

  bot.onText(/\/status/, (msg) => {
    if (!isOwner(msg)) return;
    onStatus((s) => send(`📊 *Status:* ${s}`));
  });

  bot.onText(/\/restart/, (msg) => {
    if (!isOwner(msg)) return;
    send('🔄 Restarting...');
    onRestart();
  });

  bot.onText(/\/logs/, (msg) => {
    if (!isOwner(msg)) return;
    const logs = global.xenaLogs || ['No logs yet.'];
    send(`📋 *Logs:*\n\n${logs.slice(-10).join('\n')}`);
  });

  // ── Kill on invalid token — no infinite loop ──────────────────────
  bot.on('polling_error', (err) => {
    if (err.message.includes('404') || err.message.includes('ETELEGRAM')) {
      console.log('❌ telegram.js: Invalid token — stopping panel');
      try { bot.stopPolling(); bot = null; } catch (_) {}
      return;
    }
    console.log(`TG panel error: ${err.message}`);
  });

  console.log('📲 Telegram panel active');
  return bot;
}

function notify(text) {
  if (!bot) return;
  const ownerId = global.mergedConfig?.TELEGRAM_OWNER_ID;
  if (!ownerId) return;
  bot.sendMessage(ownerId, text, { parse_mode: 'Markdown' }).catch(() => {});
}

module.exports = { initTelegram, notify };
