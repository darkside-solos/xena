'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const NodeCache = require('node-cache');

const { generateImage } = require('./features/imageGen');
const { generateVideo, generateMusic, downloadFromLink } = require('./features/mediaGen');
const { chat, describeImage } = require('./features/chatbot');
const { textToVoice } = require('./features/voice');
const { setName, getName, setBirthday, addInteraction, getCurrentMood, getMoodEmoji } = require('./features/personality');
const { saveDeleted, getDeleted } = require('./features/antidelete');
const { wikipedia, weather, dictionary, translate, currency, ipLookup, news } = require('./features/search');
const { roast, joke, horoscope, motivation, rizz, ship, poem, dreamInterpret, debate, story, analyzePersonality, recipe, fixGrammar, summarize, write, complimentPhoto } = require('./features/fun');
const { generateQR, shortenURL, generatePassword, calculate, setReminder } = require('./features/utility');
const { imageToSticker } = require('./features/sticker');
const { generateXenachar } = require('./features/xenachar');
const { initTelegram, notify } = require('./telegram');
const config = require('./config');

// ── Globals ───────────────────────────────────────────────────────────
global.xenaLogs = [];
global.viewOnceStore = {};
global.activeSession = null;
const msgRetryCounterCache = new NodeCache();
let xenaStatus = '🔴 Offline';
let isLinked = false;

// ── Reconnect ─────────────────────────────────────────────────────────
const reconnectState = { attempts: 0, timer: null, isRunning: false };
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;
function getReconnectDelay(a) { return Math.min(BASE_DELAY_MS * Math.pow(2, a - 1), MAX_DELAY_MS); }
function cancelReconnect() {
  if (reconnectState.timer) { clearTimeout(reconnectState.timer); reconnectState.timer = null; reconnectState.isRunning = false; }
}

// ── Browser rotation ──────────────────────────────────────────────────
const BROWSERS = [
  ['Ubuntu', 'Chrome', '20.0.04'],
  ['Windows', 'Chrome', '121.0.0'],
  ['macOS', 'Chrome', '120.0.0'],
  ['Windows', 'Edge', '121.0.0'],
  ['Ubuntu', 'Chrome', '119.0.0'],
];
let browserIndex = 0;
function getNextBrowser() { const b = BROWSERS[browserIndex % BROWSERS.length]; browserIndex++; return b; }

// ── Helpers ───────────────────────────────────────────────────────────
const delay = (ms) => new Promise(r => setTimeout(r, ms));
function normalizePhone(p) { return String(p || '').replace(/[^0-9]/g, ''); }
function log(msg) {
  const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(entry);
  global.xenaLogs.push(entry);
  if (global.xenaLogs.length > 50) global.xenaLogs.shift();
}

// ── Memory ────────────────────────────────────────────────────────────
const conversationMemory = {};
function getMemory(chatId) { if (!conversationMemory[chatId]) conversationMemory[chatId] = []; return conversationMemory[chatId]; }
function addMemory(chatId, role, content) {
  if (!conversationMemory[chatId]) conversationMemory[chatId] = [];
  conversationMemory[chatId].push({ role, content });
  if (conversationMemory[chatId].length > 20) conversationMemory[chatId] = conversationMemory[chatId].slice(-20);
}

function isOwner(sender) { return config.OWNER_NUMBERS.includes(sender.replace(/[^0-9]/g, '')); }
function shouldRespond(msg, botNumber) {
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const isGroup = msg.key.remoteJid.endsWith('@g.us');
  if (!isGroup) return true;
  if (mentionedJids.some(j => j.includes(botNumber))) return true;
  if (body.includes(`@${botNumber}`)) return true;
  if (body.toLowerCase().includes('xena')) return true;
  return false;
}

// ── Main WhatsApp connection ──────────────────────────────────────────
async function startXena(phoneToLink = null) {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  isLinked = !!state.creds.registered;

  let version;
  try { const v = await fetchLatestBaileysVersion(); version = v.version; }
  catch (_) { version = [2, 3000, 1017531287]; }

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
    },
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: getNextBrowser(),
    msgRetryCounterCache,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 25_000,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 30_000,
    retryRequestDelayMs: 250,
    emitOwnEvents: false,
    getMessage: async (_key) => ({ conversation: '' }),
  });

  sock._isClosed = false;
  sock.ev.on('creds.update', saveCreds);

  // ── Pairing ──────────────────────────────────────────────────────
  if (!isLinked && phoneToLink) {
    let codeSent = false;
    const pairingPhone = normalizePhone(phoneToLink);
    sock.ev.on('connection.update', async (update) => {
      const { connection } = update;
      if (state.creds.registered || codeSent) return;
      if (connection !== 'connecting') return;
      try {
        codeSent = true;
        await delay(4000);
        const code = await sock.requestPairingCode(pairingPhone);
        const formatted = (code || '').match(/.{1,4}/g)?.join('-') || code;
        log(`Code: ${formatted}`);
        notify(
          `✅ *Pairing Code:*\n\n\`${formatted}\`\n\n` +
          `1. Open WhatsApp\n2. Tap ⋮ → *Linked Devices*\n` +
          `3. Tap *Link with phone number*\n4. Enter: \`${formatted}\`\n\n_Expires in 60 seconds_`
        );
      } catch (e) {
        codeSent = false;
        notify(`❌ Failed: ${e.message}\nTry /pair again.`);
        log(`Pair error: ${e.message}`);
      }
    });
  } else if (!isLinked) {
    log('⏳ Waiting for /pair...');
    notify('👋 *Xena ready!*\n\nSend /pair 2348012345678');
  }

  // ── Connection events ────────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      sock._isClosed = true;
      if (global.activeSession === sock) global.activeSession = null;
      xenaStatus = '🔴 Offline';
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      log(`Connection closed. Code: ${code}`);
      if (code === DisconnectReason.loggedOut) {
        if (fs.existsSync('./auth_info')) fs.rmSync('./auth_info', { recursive: true });
        isLinked = false;
        notify('🔴 *Xena logged out.*\n\nSend /pair to reconnect.');
        reconnectState.isRunning = false;
        return;
      }
      if (!isLinked) { log('Not linked. Waiting...'); return; }
      reconnectState.attempts++;
      const retryDelay = getReconnectDelay(reconnectState.attempts);
      if (reconnectState.attempts <= 3) notify(`⚠️ *Disconnected*\nReconnecting in ${retryDelay/1000}s...`);
      cancelReconnect();
      reconnectState.isRunning = false;
      reconnectState.timer = setTimeout(async () => {
        reconnectState.timer = null;
        try { await startXena(); } catch (e) { log(`Reconnect error: ${e.message}`); reconnectState.isRunning = false; }
      }, retryDelay);
    } else if (connection === 'open') {
      sock._isClosed = false;
      isLinked = true;
      global.activeSession = sock;
      reconnectState.attempts = 0;
      reconnectState.isRunning = false;
      cancelReconnect();
      xenaStatus = `🟢 Online as ${sock.user?.id?.split(':')[0]}`;
      log(`✅ Xena online: ${sock.user?.id}`);
      notify(`✅ *Xena is online!*\n\`${sock.user?.id?.split(':')[0]}\` 🔥`);
    } else if (connection === 'connecting') {
      xenaStatus = '🟡 Connecting...';
    }
  });

  // ── Messages ─────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    if (sock._isClosed || sock !== global.activeSession) return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      const chatId = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const senderNum = sender.replace(/[^0-9]/g, '');
      const botNumber = sock.user?.id?.split(':')[0] || '';

      if (msg.message) saveDeleted(chatId, sender, msg.message);
      addInteraction(sender);

      // ViewOnce
      const viewOnceMsg =
        msg.message?.viewOnceMessage?.message ||
        msg.message?.viewOnceMessageV2?.message ||
        msg.message?.viewOnceMessageV2Extension?.message;
      if (viewOnceMsg?.imageMessage || viewOnceMsg?.videoMessage) {
        try {
          const buf = await downloadMediaMessage(
            { ...msg, message: viewOnceMsg }, 'buffer', {},
            { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
          );
          global.viewOnceStore[chatId] = { buffer: buf, type: viewOnceMsg.imageMessage ? 'image' : 'video', from: senderNum, timestamp: Date.now() };
        } catch (e) { log(`ViewOnce error: ${e.message}`); }
        continue;
      }

      // Image recognition
      const imageMsg = msg.message?.imageMessage;
      if (imageMsg && !imageMsg.viewOnce) {
        if (!shouldRespond(msg, botNumber)) continue;
        try {
          await sock.sendPresenceUpdate('composing', chatId);
          const imgBuf = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          const caption = imageMsg.caption || '';
          if (/rate|compliment|how do i look|am i pretty/i.test(caption)) {
            const r = await complimentPhoto();
            await sock.sendMessage(chatId, { text: `😍 ${r}` }, { quoted: msg });
          } else {
            const r = await describeImage(imgBuf.toString('base64'), imageMsg.mimetype || 'image/jpeg');
            await sock.sendMessage(chatId, { text: r }, { quoted: msg });
          }
        } catch (e) { await sock.sendMessage(chatId, { text: '❌ Could not read image.' }, { quoted: msg }); }
        continue;
      }

      const body = (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || ''
      ).trim();
      if (!body || !shouldRespond(msg, botNumber)) continue;

      const lower = body.toLowerCase();
      const cleanBody = body.replace(/xena\s*/i, '').replace(/@\d+\s*/g, '').trim();
      const quotedText = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || null;

      log(`📩 [${isOwner(senderNum) ? 'OWNER' : getName(sender) || senderNum}]: ${cleanBody}`);

      try {
        await sock.sendPresenceUpdate('composing', chatId);

        if (/viewonce|view once|reveal/i.test(lower)) {
          const stored = global.viewOnceStore[chatId];
          if (stored) {
            await sock.sendMessage(chatId, { [stored.type === 'image' ? 'image' : 'video']: stored.buffer, caption: `👁️ *Xena* | ViewOnce revealed 🔓` }, { quoted: msg });
          } else { await sock.sendMessage(chatId, { text: '❌ No viewonce found.' }, { quoted: msg }); }
          continue;
        }
        if (/^(voice|speak|say )/i.test(cleanBody)) {
          const text = cleanBody.replace(/^(voice|speak|say)\s*/i, '').trim();
          await sock.sendMessage(chatId, { text: `🎙️ *Xena* | Recording...` }, { quoted: msg });
          const buf = await textToVoice(text);
          await sock.sendMessage(chatId, { audio: buf, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
          continue;
        }
        if (/^(generate image|create image|draw )/i.test(cleanBody)) {
          const prompt = cleanBody.replace(/^(generate image|create image|draw)\s*/i, '').trim();
          await sock.sendMessage(chatId, { text: `🎨 Generating: _${prompt}_...` }, { quoted: msg });
          const buf = await generateImage(prompt);
          await sock.sendMessage(chatId, { image: buf, caption: `🎨 *Xena* | Done!` }, { quoted: msg });
          continue;
        }
        if (/^(generate music|make music|create music)/i.test(cleanBody)) {
          const prompt = cleanBody.replace(/^(generate music|make music|create music)\s*/i, '').trim();
          await sock.sendMessage(chatId, { text: `🎵 Generating: _${prompt}_...` }, { quoted: msg });
          const buf = await generateMusic(prompt);
          await sock.sendMessage(chatId, { audio: buf, mimetype: 'audio/mp4', ptt: false }, { quoted: msg });
          continue;
        }
        if (/^(generate video|create video|make video)/i.test(cleanBody)) {
          const prompt = cleanBody.replace(/^(generate video|create video|make video)\s*/i, '').trim();
          await sock.sendMessage(chatId, { text: `🎬 Generating... _(~2 mins)_` }, { quoted: msg });
          const buf = await generateVideo(prompt);
          await sock.sendMessage(chatId, { video: buf, caption: `🎬 *Xena* | Done!` }, { quoted: msg });
          continue;
        }
        const urlMatch = cleanBody.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          await sock.sendMessage(chatId, { text: `⬇️ Downloading...` }, { quoted: msg });
          const result = await downloadFromLink(urlMatch[1]);
          if (result.type === 'video') { await sock.sendMessage(chatId, { video: result.buffer, caption: `🎬 Done!` }, { quoted: msg }); }
          else { await sock.sendMessage(chatId, { audio: result.buffer, mimetype: 'audio/mp4' }, { quoted: msg }); }
          continue;
        }
        if (/xena (pic|photo|picture|selfie|send pic|your pic|show yourself)/i.test(lower)) {
          await sock.sendMessage(chatId, { text: `🎨 Generating my pic... 📸` }, { quoted: msg });
          const buf = await generateXenachar();
          await sock.sendMessage(chatId, { image: buf, caption: `💜 *That's me!* ~ Xena 🦊✨` }, { quoted: msg });
          continue;
        }
        if (/^sticker/i.test(cleanBody)) {
          const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const hasImg = quoted?.imageMessage || msg.message?.imageMessage;
          if (!hasImg) { await sock.sendMessage(chatId, { text: '❌ Send or quote an image with "sticker"' }, { quoted: msg }); continue; }
          await sock.sendMessage(chatId, { text: '🎭 Making sticker...' }, { quoted: msg });
          const imgBuf = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
          const stickerBuf = await imageToSticker(imgBuf);
          await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: msg });
          continue;
        }
        if (/^(antidelete|deleted|show deleted)/i.test(cleanBody)) {
          const del = getDeleted(chatId);
          if (!del.length) { await sock.sendMessage(chatId, { text: '🗑️ No deleted messages found.' }, { quoted: msg }); continue; }
          const text = del.map((d, i) => `${i+1}. *${d.sender}* [${d.type}]\n${d.body}\n_${new Date(d.timestamp).toLocaleTimeString()}_`).join('\n\n');
          await sock.sendMessage(chatId, { text: `🗑️ *Deleted Messages:*\n\n${text}` }, { quoted: msg });
          continue;
        }
        if (/^wiki /i.test(cleanBody)) { const q = cleanBody.replace(/^wiki\s*/i,'').trim(); await sock.sendMessage(chatId,{text:'🔍 Searching...'},{ quoted: msg }); const r = await wikipedia(q); await sock.sendMessage(chatId,{text:`📚 *${q}*\n\n${r}`},{ quoted: msg }); continue; }
        if (/^weather /i.test(cleanBody)) { const city = cleanBody.replace(/^weather\s*/i,'').trim(); const r = await weather(city); await sock.sendMessage(chatId,{text:`🌤️ ${r}`},{ quoted: msg }); continue; }
        if (/^(define|meaning) /i.test(cleanBody)) { const word = cleanBody.replace(/^(define|meaning)\s*/i,'').trim(); const r = await dictionary(word); await sock.sendMessage(chatId,{text:r},{ quoted: msg }); continue; }
        if (/^translate /i.test(cleanBody)) { const parts = cleanBody.replace(/^translate\s*/i,'').trim().split(' '); const r = await translate(parts.slice(1).join(' '), parts[0]); await sock.sendMessage(chatId,{text:`🌐 *(${parts[0]}):* ${r}`},{ quoted: msg }); continue; }
        if (/^convert /i.test(cleanBody)) { const p = cleanBody.replace(/^convert\s*/i,'').trim().split(' '); const r = await currency(p[0],p[1],p[2]); await sock.sendMessage(chatId,{text:r},{ quoted: msg }); continue; }
        if (/^ip /i.test(cleanBody)) { const ip = cleanBody.replace(/^ip\s*/i,'').trim(); const r = await ipLookup(ip); await sock.sendMessage(chatId,{text:r},{ quoted: msg }); continue; }
        if (/^news/i.test(cleanBody)) { await sock.sendMessage(chatId,{text:'📰 Fetching...'},{ quoted: msg }); const r = await news(); await sock.sendMessage(chatId,{text:`📰 *News*\n\n${r}`},{ quoted: msg }); continue; }
        if (/^qr /i.test(cleanBody)) { const text = cleanBody.replace(/^qr\s*/i,'').trim(); const buf = await generateQR(text); await sock.sendMessage(chatId,{image:buf,caption:'📱 QR Code'},{ quoted: msg }); continue; }
        if (/^shorten /i.test(cleanBody)) { const url = cleanBody.replace(/^shorten\s*/i,'').trim(); const r = await shortenURL(url); await sock.sendMessage(chatId,{text:`🔗 ${r}`},{ quoted: msg }); continue; }
        if (/^password/i.test(cleanBody)) { const len = parseInt(cleanBody.match(/\d+/)?.[0])||12; const pass = generatePassword(len); await sock.sendMessage(chatId,{text:`🔐 *Password:*\n\`${pass}\``},{ quoted: msg }); continue; }
        if (/^calc /i.test(cleanBody)) { const expr = cleanBody.replace(/^calc\s*/i,'').trim(); await sock.sendMessage(chatId,{text:calculate(expr)},{ quoted: msg }); continue; }
        if (/^remind /i.test(cleanBody)) { const parts = cleanBody.replace(/^remind\s*/i,'').trim().split(' '); const r = setReminder(chatId,parts.slice(1).join(' '),parseInt(parts[0]),async(cid,m)=>{ await sock.sendMessage(cid,{text:`⏰ *Reminder:* ${m}`}); }); await sock.sendMessage(chatId,{text:r},{ quoted: msg }); continue; }
        if (/^roast /i.test(cleanBody)) { const name = cleanBody.replace(/^roast\s*/i,'').trim(); await sock.sendMessage(chatId,{text:'🔥 Cooking...'},{ quoted: msg }); const r = await roast(name); await sock.sendMessage(chatId,{text:`🔥 ${r}`},{ quoted: msg }); continue; }
        if (/^joke/i.test(cleanBody)) { const r = await joke(); await sock.sendMessage(chatId,{text:`😂 ${r}`},{ quoted: msg }); continue; }
        if (/^horoscope /i.test(cleanBody)) { const sign = cleanBody.replace(/^horoscope\s*/i,'').trim(); const r = await horoscope(sign); await sock.sendMessage(chatId,{text:`⭐ *${sign}*\n\n${r}`},{ quoted: msg }); continue; }
        if (/^(motivate|quote)/i.test(cleanBody)) { const r = await motivation(); await sock.sendMessage(chatId,{text:`💪 ${r}`},{ quoted: msg }); continue; }
        if (/^rizz /i.test(cleanBody)) { const name = cleanBody.replace(/^rizz\s*/i,'').trim(); const r = await rizz(name); await sock.sendMessage(chatId,{text:`😏 ${r}`},{ quoted: msg }); continue; }
        if (/^ship /i.test(cleanBody)) { const parts = cleanBody.replace(/^ship\s*/i,'').trim().split(' and '); if(parts.length<2){await sock.sendMessage(chatId,{text:'❌ Format: ship [n1] and [n2]'},{ quoted: msg });continue;} await sock.sendMessage(chatId,{text:ship(parts[0].trim(),parts[1].trim())},{ quoted: msg }); continue; }
        if (/^poem /i.test(cleanBody)) { const topic = cleanBody.replace(/^poem\s*/i,'').trim(); const r = await poem(topic); await sock.sendMessage(chatId,{text:`📝\n\n${r}`},{ quoted: msg }); continue; }
        if (/^dream /i.test(cleanBody)) { const dream = cleanBody.replace(/^dream\s*/i,'').trim(); const r = await dreamInterpret(dream); await sock.sendMessage(chatId,{text:`🌙 ${r}`},{ quoted: msg }); continue; }
        if (/^debate /i.test(cleanBody)) { const topic = cleanBody.replace(/^debate\s*/i,'').trim(); const r = await debate(topic); await sock.sendMessage(chatId,{text:`⚡ *Debate*\n\n${r}`},{ quoted: msg }); continue; }
        if (/^story /i.test(cleanBody)) { const prompt = cleanBody.replace(/^story\s*/i,'').trim(); await sock.sendMessage(chatId,{text:'📖 Writing...'},{ quoted: msg }); const r = await story(prompt); await sock.sendMessage(chatId,{text:`📖\n\n${r}`},{ quoted: msg }); continue; }
        if (/^analyze /i.test(cleanBody)) { const text = cleanBody.replace(/^analyze\s*/i,'').trim(); const r = await analyzePersonality(text); await sock.sendMessage(chatId,{text:`🧠 ${r}`},{ quoted: msg }); continue; }
        if (/^recipe /i.test(cleanBody)) { const ing = cleanBody.replace(/^recipe\s*/i,'').trim(); await sock.sendMessage(chatId,{text:'👩‍🍳 Finding recipe...'},{ quoted: msg }); const r = await recipe(ing); await sock.sendMessage(chatId,{text:`🍽️\n\n${r}`},{ quoted: msg }); continue; }
        if (/^fix /i.test(cleanBody)) { const text = cleanBody.replace(/^fix\s*/i,'').trim(); const r = await fixGrammar(text); await sock.sendMessage(chatId,{text:`✅ ${r}`},{ quoted: msg }); continue; }
        if (/^(summarize|tldr) /i.test(cleanBody)) { const text = cleanBody.replace(/^(summarize|tldr)\s*/i,'').trim(); const r = await summarize(text); await sock.sendMessage(chatId,{text:`📋\n\n${r}`},{ quoted: msg }); continue; }
        if (/^write (essay|caption|email|letter|speech) /i.test(cleanBody)) { const match = cleanBody.match(/^write (\w+) (.+)/i); if(match){await sock.sendMessage(chatId,{text:`✍️ Writing ${match[1]}...`},{ quoted: msg }); const r = await write(match[1],match[2]); await sock.sendMessage(chatId,{text:r},{ quoted: msg });} continue; }
        if (/^(my name is|call me) /i.test(cleanBody)) { const name = cleanBody.replace(/^(my name is|call me)\s*/i,'').trim(); setName(sender,name); await sock.sendMessage(chatId,{text:`Got it! I'll call you *${name}* 😊`},{ quoted: msg }); continue; }
        if (/^my birthday is /i.test(cleanBody)) { const date = cleanBody.replace(/^my birthday is\s*/i,'').trim(); setBirthday(sender,date); await sock.sendMessage(chatId,{text:`🎂 Got it! I'll wish you on *${date}* 🎉`},{ quoted: msg }); continue; }
        if (/^(mood|how are you|your mood)/i.test(cleanBody)) { const mood = getCurrentMood(); await sock.sendMessage(chatId,{text:`${getMoodEmoji(mood)} Feeling *${mood}* rn~ 💜`},{ quoted: msg }); continue; }

        // ── AI Chat — catches everything else ──
        const memory = getMemory(chatId);
        addMemory(chatId, 'user', cleanBody);
        const aiReply = await chat(memory, sender, isOwner(senderNum), quotedText);
        addMemory(chatId, 'assistant', aiReply);
        await sock.sendMessage(chatId, { text: aiReply }, { quoted: msg });

      } catch (err) {
        log(`Error: ${err.message}`);
        await sock.sendMessage(chatId, { text: `⚠️ Error: ${err.message}` }, { quoted: msg });
      }
    }
  });
}

// ── Bootstrap — only starts WA + Telegram control panel ──────────────
async function bootstrap() {
  initTelegram(
    async (phone) => await startXena(phone),
    () => { cancelReconnect(); notify('🔄 Restarting...'); setTimeout(() => startXena(), 1000); },
    (cb) => cb(xenaStatus)
  );
  await startXena();
}

module.exports = { startXena: bootstrap };