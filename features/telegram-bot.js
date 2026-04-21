'use strict';

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const { generateImage } = require('./imageGen');
const { generateVideo, generateMusic, downloadFromLink } = require('./mediaGen');
const { chat, describeImage } = require('./chatbot');
const { textToVoice } = require('./voice');
const { setName, getName, setBirthday, checkBirthdays, getCurrentMood, getMoodEmoji, addInteraction, isRelationship } = require('./personality');
const { saveDeleted, getDeleted } = require('./antidelete');
const { wikipedia, weather, dictionary, translate, currency, ipLookup, news } = require('./search');
const { roast, joke, horoscope, motivation, rizz, ship, poem, dreamInterpret, debate, story, analyzePersonality, recipe, fixGrammar, summarize, write, complimentPhoto } = require('./fun');
const { generateQR, shortenURL, generatePassword, calculate, setReminder } = require('./utility');
const { generateXenachar } = require('./xenachar');

// ── Config ────────────────────────────────────────────────────────────
const CREATOR_TG_ID = '8167202570';
const CREATOR_WA = '233530729233';
const CREATOR_NAME = 'Darkside';

let botInstance = null;
let tgMemory = {};
let tgViewOnceStore = {};

// ── Memory ────────────────────────────────────────────────────────────
function getMemory(chatId) {
  if (!tgMemory[chatId]) tgMemory[chatId] = [];
  return tgMemory[chatId];
}
function addMemory(chatId, role, content) {
  if (!tgMemory[chatId]) tgMemory[chatId] = [];
  tgMemory[chatId].push({ role, content });
  if (tgMemory[chatId].length > 20)
    tgMemory[chatId] = tgMemory[chatId].slice(-20);
}

// ── Helpers ───────────────────────────────────────────────────────────
function isOwner(userId, config) {
  return String(userId) === String(config.TELEGRAM_OWNER_ID) ||
         String(userId) === CREATOR_TG_ID;
}

function isCreator(userId) {
  return String(userId) === CREATOR_TG_ID;
}

function shouldRespond(msg, botUsername) {
  const text = msg.text || msg.caption || '';
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const isDM = msg.chat.type === 'private';

  if (isDM) return true;
  if (isGroup) {
    // Respond if tagged, replied to, or xena mentioned
    const isMentioned = text.toLowerCase().includes('xena') ||
      text.includes(`@${botUsername}`);
    const isReply = msg.reply_to_message?.from?.username === botUsername;
    return isMentioned || isReply;
  }
  return false;
}

function cleanText(text, botUsername) {
  return text
    .replace(/xena\s*/gi, '')
    .replace(new RegExp(`@${botUsername}\\s*`, 'gi'), '')
    .trim();
}

function log(msg) {
  const entry = `[TG ${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(entry);
  if (global.xenaLogs) {
    global.xenaLogs.push(entry);
    if (global.xenaLogs.length > 50) global.xenaLogs.shift();
  }
}

// ── Send helpers ──────────────────────────────────────────────────────
async function reply(bot, msg, text) {
  try {
    await bot.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id,
      parse_mode: 'Markdown'
    });
  } catch (e) {
    // Fallback without markdown if it fails
    await bot.sendMessage(msg.chat.id, text, {
      reply_to_message_id: msg.message_id
    }).catch(() => {});
  }
}

async function replyPhoto(bot, msg, buffer, caption) {
  await bot.sendPhoto(msg.chat.id, buffer, {
    reply_to_message_id: msg.message_id,
    caption: caption || '',
    parse_mode: 'Markdown'
  });
}

async function replyAudio(bot, msg, buffer, isVoice = false) {
  if (isVoice) {
    await bot.sendVoice(msg.chat.id, buffer, {
      reply_to_message_id: msg.message_id
    });
  } else {
    await bot.sendAudio(msg.chat.id, buffer, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function replyVideo(bot, msg, buffer, caption) {
  await bot.sendVideo(msg.chat.id, buffer, {
    reply_to_message_id: msg.message_id,
    caption: caption || ''
  });
}

async function replySticker(bot, msg, buffer) {
  await bot.sendSticker(msg.chat.id, buffer, {
    reply_to_message_id: msg.message_id
  });
}

// ── Typing indicator ──────────────────────────────────────────────────
async function sendTyping(bot, chatId) {
  await bot.sendChatAction(chatId, 'typing').catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN TELEGRAM BOT HANDLER
// ═══════════════════════════════════════════════════════════════════════
function startTelegramBot(config) {
  if (botInstance) {
    try { botInstance.stopPolling(); } catch (_) {}
  }

  const token = config.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN') {
    log('⚠️ No Telegram bot token configured. Skipping Telegram bot.');
    return null;
  }

  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  let botUsername = '';
  bot.getMe().then(me => {
    botUsername = me.username;
    log(`✅ Telegram bot @${botUsername} is online!`);
  }).catch(e => log(`TG getMe error: ${e.message}`));

  // ── /start command ──────────────────────────────────────────────────
  bot.onText(/\/start/, async (msg) => {
    const name = msg.from.first_name || 'there';
    await bot.sendMessage(msg.chat.id,
      `👋 *Hey ${name}! I'm Xena* 🦊\n\n` +
      `I'm the most powerful AI bot you've ever met.\n\n` +
      `*What I can do:*\n` +
      `🎨 \`generate image [prompt]\`\n` +
      `🎵 \`generate music [desc]\`\n` +
      `🎬 \`generate video [prompt]\`\n` +
      `🎙️ \`voice [text]\` — I'll speak!\n` +
      `📸 \`xena pic\` — See my anime form\n` +
      `🔍 \`wiki [topic]\` — Wikipedia\n` +
      `🌤️ \`weather [city]\`\n` +
      `😂 \`joke\` \`roast [name]\` \`rizz [name]\`\n` +
      `💘 \`ship [n1] and [n2]\`\n` +
      `📝 \`poem\` \`story\` \`debate\` \`write\`\n` +
      `🔧 \`calc\` \`qr\` \`password\` \`remind\`\n` +
      `🗑️ \`antidelete\` — See deleted msgs\n\n` +
      `_Created by ${CREATOR_NAME} • Just talk to me naturally!_`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── /creator command ────────────────────────────────────────────────
  bot.onText(/\/creator/, async (msg) => {
    await bot.sendMessage(msg.chat.id,
      `👑 *My Creator*\n\n` +
      `*Name:* ${CREATOR_NAME}\n` +
      `*WhatsApp:* +${CREATOR_WA}\n` +
      `*Role:* Developer of Xena AI\n\n` +
      `_Xena was built with passion and code by ${CREATOR_NAME}._`,
      { parse_mode: 'Markdown' }
    );
  });

  // ── Handle photo messages ───────────────────────────────────────────
  bot.on('photo', async (msg) => {
    if (!shouldRespond(msg, botUsername)) return;
    const chatId = msg.chat.id;
    const caption = msg.caption || '';

    try {
      await sendTyping(bot, chatId);

      // Get highest quality photo
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      const fileLink = await bot.getFileLink(photoId);
      const axios = require('axios');
      const res = await axios.get(fileLink, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(res.data).toString('base64');

      // If asking to rate/compliment
      if (/rate|compliment|how do i look|am i pretty/i.test(caption)) {
        const r = await complimentPhoto();
        await reply(bot, msg, `😍 ${r}`);
      } else {
        const r = await describeImage(base64, 'image/jpeg');
        await reply(bot, msg, r);
      }
    } catch (e) {
      log(`TG photo error: ${e.message}`);
      await reply(bot, msg, '❌ Could not read image.');
    }
  });

  // ── Handle all text messages ────────────────────────────────────────
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    if (!shouldRespond(msg, botUsername)) return;

    const chatId = msg.chat.id;
    const userId = String(msg.from.id);
    const userJid = `${userId}@telegram`;
    const body = msg.text.trim();
    const lower = body.toLowerCase();
    const cleanBody = cleanText(body, botUsername);

    // Save for anti-delete
    saveDeleted(String(chatId), userJid, { conversation: body });
    addInteraction(userJid);

    // Get quoted context
    const quotedText = msg.reply_to_message?.text || null;

    // Get saved name
    const userName = getName(userJid) || msg.from.first_name;
    log(`📩 [${isOwner(userId, config) ? 'OWNER' : userName}] ${cleanBody}`);

    try {
      await sendTyping(bot, chatId);

      // ── ViewOnce reveal ──
      if (/viewonce|view once|reveal/i.test(lower)) {
        const stored = tgViewOnceStore[chatId];
        if (stored) {
          await replyPhoto(bot, msg, stored.buffer, `👁️ *Xena* | Revealed 🔓`);
        } else {
          await reply(bot, msg, '❌ No viewonce found.');
        }
        return;
      }

      // ── Voice ──
      if (/^(voice|speak|say )/i.test(cleanBody)) {
        const text = cleanBody.replace(/^(voice|speak|say)\s*/i, '').trim();
        await reply(bot, msg, `🎙️ *Xena* | Recording...`);
        const buf = await textToVoice(text);
        await replyAudio(bot, msg, buf, true);
        return;
      }

      // ── Generate Image ──
      if (/^(generate image|create image|draw )/i.test(cleanBody)) {
        const prompt = cleanBody.replace(/^(generate image|create image|draw)\s*/i, '').trim();
        await reply(bot, msg, `🎨 Generating: _${prompt}_...`);
        const buf = await generateImage(prompt);
        await replyPhoto(bot, msg, buf, `🎨 *Xena* | Done!\n_${prompt}_`);
        return;
      }

      // ── Generate Music ──
      if (/^(generate music|make music|create music)/i.test(cleanBody)) {
        const prompt = cleanBody.replace(/^(generate music|make music|create music)\s*/i, '').trim();
        await reply(bot, msg, `🎵 Generating music: _${prompt}_...`);
        const buf = await generateMusic(prompt);
        await replyAudio(bot, msg, buf, false);
        return;
      }

      // ── Generate Video ──
      if (/^(generate video|create video|make video)/i.test(cleanBody)) {
        const prompt = cleanBody.replace(/^(generate video|create video|make video)\s*/i, '').trim();
        await reply(bot, msg, `🎬 Generating... _(~2 mins)_`);
        const buf = await generateVideo(prompt);
        await replyVideo(bot, msg, buf, `🎬 *Xena* | Done!`);
        return;
      }

      // ── Download from link ──
      const urlMatch = cleanBody.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        await reply(bot, msg, `⬇️ Downloading...`);
        const result = await downloadFromLink(urlMatch[1]);
        if (result.type === 'video') {
          await replyVideo(bot, msg, result.buffer, `🎬 Done!`);
        } else {
          await replyAudio(bot, msg, result.buffer, false);
        }
        return;
      }

      // ── Xena pic ──
      if (/xena (pic|photo|picture|selfie|send pic|your pic|show yourself)/i.test(lower)) {
        await reply(bot, msg, `🎨 Generating my pic... 📸`);
        const buf = await generateXenachar();
        await replyPhoto(bot, msg, buf, `💜 *That's me!* ~ Xena 🦊✨`);
        return;
      }

      // ── Anti-delete ──
      if (/^(antidelete|deleted|show deleted)/i.test(cleanBody)) {
        const del = getDeleted(String(chatId));
        if (!del.length) { await reply(bot, msg, '🗑️ No deleted messages found.'); return; }
        const text = del.map((d, i) =>
          `${i+1}. *${d.sender}* [${d.type}]\n${d.body}\n_${new Date(d.timestamp).toLocaleTimeString()}_`
        ).join('\n\n');
        await reply(bot, msg, `🗑️ *Deleted Messages:*\n\n${text}`);
        return;
      }

      // ── Wikipedia ──
      if (/^wiki /i.test(cleanBody)) {
        const q = cleanBody.replace(/^wiki\s*/i, '').trim();
        await reply(bot, msg, '🔍 Searching...');
        const r = await wikipedia(q);
        await reply(bot, msg, `📚 *${q}*\n\n${r}`);
        return;
      }

      // ── Weather ──
      if (/^weather /i.test(cleanBody)) {
        const city = cleanBody.replace(/^weather\s*/i, '').trim();
        const r = await weather(city);
        await reply(bot, msg, `🌤️ ${r}`);
        return;
      }

      // ── Dictionary ──
      if (/^(define|meaning) /i.test(cleanBody)) {
        const word = cleanBody.replace(/^(define|meaning)\s*/i, '').trim();
        const r = await dictionary(word);
        await reply(bot, msg, r);
        return;
      }

      // ── Translate ──
      if (/^translate /i.test(cleanBody)) {
        const parts = cleanBody.replace(/^translate\s*/i, '').trim().split(' ');
        const lang = parts[0]; const text = parts.slice(1).join(' ');
        const r = await translate(text, lang);
        await reply(bot, msg, `🌐 *(${lang}):* ${r}`);
        return;
      }

      // ── Currency ──
      if (/^convert /i.test(cleanBody)) {
        const parts = cleanBody.replace(/^convert\s*/i, '').trim().split(' ');
        const r = await currency(parts[0], parts[1], parts[2]);
        await reply(bot, msg, r);
        return;
      }

      // ── IP Lookup ──
      if (/^ip /i.test(cleanBody)) {
        const ip = cleanBody.replace(/^ip\s*/i, '').trim();
        const r = await ipLookup(ip);
        await reply(bot, msg, r);
        return;
      }

      // ── News ──
      if (/^news/i.test(cleanBody)) {
        await reply(bot, msg, '📰 Fetching news...');
        const r = await news();
        await reply(bot, msg, `📰 *Latest News*\n\n${r}`);
        return;
      }

      // ── QR Code ──
      if (/^qr /i.test(cleanBody)) {
        const text = cleanBody.replace(/^qr\s*/i, '').trim();
        const buf = await generateQR(text);
        await replyPhoto(bot, msg, buf, `📱 QR Code`);
        return;
      }

      // ── Shorten URL ──
      if (/^shorten /i.test(cleanBody)) {
        const url = cleanBody.replace(/^shorten\s*/i, '').trim();
        const r = await shortenURL(url);
        await reply(bot, msg, `🔗 ${r}`);
        return;
      }

      // ── Password ──
      if (/^password/i.test(cleanBody)) {
        const len = parseInt(cleanBody.match(/\d+/)?.[0]) || 12;
        const pass = generatePassword(len);
        await reply(bot, msg, `🔐 *Password:*\n\`${pass}\``);
        return;
      }

      // ── Calculator ──
      if (/^calc /i.test(cleanBody)) {
        const expr = cleanBody.replace(/^calc\s*/i, '').trim();
        await reply(bot, msg, calculate(expr));
        return;
      }

      // ── Reminder ──
      if (/^remind /i.test(cleanBody)) {
        const parts = cleanBody.replace(/^remind\s*/i, '').trim().split(' ');
        const minutes = parseInt(parts[0]);
        const message = parts.slice(1).join(' ');
        const r = setReminder(String(chatId), message, minutes, async (cid, m) => {
          await bot.sendMessage(cid, `⏰ *Reminder:* ${m}`, { parse_mode: 'Markdown' });
        });
        await reply(bot, msg, r);
        return;
      }

      // ── Roast ──
      if (/^roast /i.test(cleanBody)) {
        const name = cleanBody.replace(/^roast\s*/i, '').trim();
        await reply(bot, msg, '🔥 Cooking...');
        const r = await roast(name);
        await reply(bot, msg, `🔥 ${r}`);
        return;
      }

      // ── Joke ──
      if (/^joke/i.test(cleanBody)) {
        const r = await joke();
        await reply(bot, msg, `😂 ${r}`);
        return;
      }

      // ── Horoscope ──
      if (/^horoscope /i.test(cleanBody)) {
        const sign = cleanBody.replace(/^horoscope\s*/i, '').trim();
        const r = await horoscope(sign);
        await reply(bot, msg, `⭐ *${sign}*\n\n${r}`);
        return;
      }

      // ── Motivation ──
      if (/^(motivate|quote)/i.test(cleanBody)) {
        const r = await motivation();
        await reply(bot, msg, `💪 ${r}`);
        return;
      }

      // ── Rizz ──
      if (/^rizz /i.test(cleanBody)) {
        const name = cleanBody.replace(/^rizz\s*/i, '').trim();
        const r = await rizz(name);
        await reply(bot, msg, `😏 ${r}`);
        return;
      }

      // ── Ship ──
      if (/^ship /i.test(cleanBody)) {
        const parts = cleanBody.replace(/^ship\s*/i, '').trim().split(' and ');
        if (parts.length < 2) { await reply(bot, msg, '❌ Format: ship [name1] and [name2]'); return; }
        await reply(bot, msg, ship(parts[0].trim(), parts[1].trim()));
        return;
      }

      // ── Poem ──
      if (/^poem /i.test(cleanBody)) {
        const topic = cleanBody.replace(/^poem\s*/i, '').trim();
        const r = await poem(topic);
        await reply(bot, msg, `📝\n\n${r}`);
        return;
      }

      // ── Dream ──
      if (/^dream /i.test(cleanBody)) {
        const dream = cleanBody.replace(/^dream\s*/i, '').trim();
        const r = await dreamInterpret(dream);
        await reply(bot, msg, `🌙 ${r}`);
        return;
      }

      // ── Debate ──
      if (/^debate /i.test(cleanBody)) {
        const topic = cleanBody.replace(/^debate\s*/i, '').trim();
        const r = await debate(topic);
        await reply(bot, msg, `⚡ *Debate*\n\n${r}`);
        return;
      }

      // ── Story ──
      if (/^story /i.test(cleanBody)) {
        const prompt = cleanBody.replace(/^story\s*/i, '').trim();
        await reply(bot, msg, '📖 Writing...');
        const r = await story(prompt);
        await reply(bot, msg, `📖\n\n${r}`);
        return;
      }

      // ── Analyze ──
      if (/^analyze /i.test(cleanBody)) {
        const text = cleanBody.replace(/^analyze\s*/i, '').trim();
        const r = await analyzePersonality(text);
        await reply(bot, msg, `🧠 ${r}`);
        return;
      }

      // ── Recipe ──
      if (/^recipe /i.test(cleanBody)) {
        const ingredients = cleanBody.replace(/^recipe\s*/i, '').trim();
        await reply(bot, msg, '👩‍🍳 Finding recipe...');
        const r = await recipe(ingredients);
        await reply(bot, msg, `🍽️\n\n${r}`);
        return;
      }

      // ── Fix Grammar ──
      if (/^fix /i.test(cleanBody)) {
        const text = cleanBody.replace(/^fix\s*/i, '').trim();
        const r = await fixGrammar(text);
        await reply(bot, msg, `✅ ${r}`);
        return;
      }

      // ── Summarize ──
      if (/^(summarize|tldr) /i.test(cleanBody)) {
        const text = cleanBody.replace(/^(summarize|tldr)\s*/i, '').trim();
        const r = await summarize(text);
        await reply(bot, msg, `📋\n\n${r}`);
        return;
      }

      // ── Write ──
      if (/^write (essay|caption|email|letter|speech) /i.test(cleanBody)) {
        const match = cleanBody.match(/^write (\w+) (.+)/i);
        if (match) {
          await reply(bot, msg, `✍️ Writing ${match[1]}...`);
          const r = await write(match[1], match[2]);
          await reply(bot, msg, r);
        }
        return;
      }

      // ── My name is ──
      if (/^(my name is|call me) /i.test(cleanBody)) {
        const name = cleanBody.replace(/^(my name is|call me)\s*/i, '').trim();
        setName(userJid, name);
        await reply(bot, msg, `Got it! I'll call you *${name}* 😊`);
        return;
      }

      // ── Birthday ──
      if (/^my birthday is /i.test(cleanBody)) {
        const date = cleanBody.replace(/^my birthday is\s*/i, '').trim();
        setBirthday(userJid, date);
        await reply(bot, msg, `🎂 Got it! I'll wish you on *${date}* 🎉`);
        return;
      }

      // ── Mood ──
      if (/^(mood|how are you|your mood)/i.test(cleanBody)) {
        const mood = getCurrentMood();
        const emoji = getMoodEmoji(mood);
        await reply(bot, msg, `${emoji} Feeling *${mood}* rn~ 💜`);
        return;
      }

      // ── Who made you / creator questions ──
      if (/who (made|created|built) you|your creator|who is darkside/i.test(lower)) {
        await reply(bot, msg,
          `💜 I was created by *${CREATOR_NAME}*!\n\n` +
          `WhatsApp: +${CREATOR_WA}\n\n` +
          `_He built me from scratch with passion and code 🔥_`
        );
        return;
      }

      // ── AI Chat — catches everything else ──
      const memory = getMemory(String(chatId));
      addMemory(String(chatId), 'user', cleanBody);
      const aiReply = await chat(memory, userJid, isOwner(userId, config), quotedText);
      addMemory(String(chatId), 'assistant', aiReply);
      await reply(bot, msg, aiReply);

    } catch (err) {
      log(`TG Error: ${err.message}`);
      await reply(bot, msg, `⚠️ Error: ${err.message}`).catch(() => {});
    }
  });

  // ── Handle deleted messages ─────────────────────────────────────────
  bot.on('edited_message', (msg) => {
    // Track edits as potential delete indicators
    if (msg.text) {
      saveDeleted(String(msg.chat.id), `${msg.from.id}@telegram`, {
        conversation: `[EDITED] ${msg.text}`
      });
    }
  });

  // ── Poll errors ─────────────────────────────────────────────────────
  bot.on('polling_error', (err) => {
    log(`TG polling error: ${err.message}`);
    // Auto restart polling after 5 seconds
    setTimeout(() => {
      try { bot.startPolling(); } catch (_) {}
    }, 5000);
  });

  log(`🤖 Telegram bot started with token: ${token.slice(0,10)}...`);
  return bot;
}

function stopTelegramBot() {
  if (botInstance) {
    try { botInstance.stopPolling(); botInstance = null; }
    catch (_) {}
  }
}

module.exports = { startTelegramBot, stopTelegramBot };