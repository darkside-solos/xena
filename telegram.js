const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

let bot = null;

function initTelegram(onPairRequest, onRestart, onStatus) {
  bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
  const ownerId = String(config.TELEGRAM_OWNER_ID);

  function isOwner(msg) { return String(msg.from.id) === ownerId; }
  function send(text) { bot.sendMessage(ownerId, text, { parse_mode: 'Markdown' }); }

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

  console.log('📲 Telegram panel active');
  return bot;
}

function notify(text) {
  if (!bot) return;
  bot.sendMessage(config.TELEGRAM_OWNER_ID, text, { parse_mode: 'Markdown' }).catch(() => {});
}

module.exports = { initTelegram, notify };