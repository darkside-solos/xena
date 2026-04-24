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

const { chat, describeImage } = require('./features/chatbot');
const { handleCommand } = require('./features/commands');
const { handleGame, detectTrigger } = require('./features/games');
const { saveDeleted, getDeleted } = require('./features/antidelete');
const { addInteraction, getName, checkBirthdays } = require('./features/personality');
const { imageToSticker } = require('./features/sticker');
const { initTelegram, notify } = require('./telegram');
const config = require('./config');
const telegramBot = require('./features/telegram-bot');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: config.GROQ_API_KEY });

// ── Globals ───────────────────────────────────────────────────────────
global.xenaLogs = [];
global.viewOnceStore = {};
global.activeSession = null;
const msgRetryCounterCache = new NodeCache();
let xenaStatus = '🔴 Offline';
let isLinked = false;

// ── Reconnect ─────────────────────────────────────────────────────────
const reconnectState = { attempts:0, timer:null, isRunning:false };
const BASE_DELAY_MS = 5_000, MAX_DELAY_MS = 60_000;
function getReconnectDelay(a){ return Math.min(BASE_DELAY_MS*Math.pow(2,a-1),MAX_DELAY_MS); }
function cancelReconnect(){
  if(reconnectState.timer){ clearTimeout(reconnectState.timer); reconnectState.timer=null; reconnectState.isRunning=false; }
}

// ── Helpers ───────────────────────────────────────────────────────────
const delay=(ms)=>new Promise(r=>setTimeout(r,ms));
function normalizePhone(p){ return String(p||'').replace(/[^0-9]/g,''); }
function log(msg){
  const entry=`[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(entry); global.xenaLogs.push(entry);
  if(global.xenaLogs.length>50) global.xenaLogs.shift();
}

// ── Memory ────────────────────────────────────────────────────────────
const conversationMemory={};
function getMemory(id){ if(!conversationMemory[id]) conversationMemory[id]=[]; return conversationMemory[id]; }
function addMemory(id,role,content){
  if(!conversationMemory[id]) conversationMemory[id]=[];
  conversationMemory[id].push({role,content});
  if(conversationMemory[id].length>20) conversationMemory[id]=conversationMemory[id].slice(-20);
}

function isOwner(sender){ return config.OWNER_NUMBERS.includes(sender.replace(/[^0-9]/g,'')); }
function shouldRespond(msg,botNumber){
  const body=msg.message?.conversation||msg.message?.extendedTextMessage?.text||'';
  const mentionedJids=msg.message?.extendedTextMessage?.contextInfo?.mentionedJid||[];
  const isGroup=msg.key.remoteJid.endsWith('@g.us');
  if(!isGroup)return true;
  if(mentionedJids.some(j=>j.includes(botNumber)))return true;
  if(body.includes(`@${botNumber}`))return true;
  if(body.toLowerCase().includes('xena'))return true;
  return false;
}

// ── Main WhatsApp ─────────────────────────────────────────────────────


  // ── Pairing ──────────────────────────────────────────────────────
async function startXena() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  isLinked = !!state.creds.registered;

  let version;
  try { const v = await fetchLatestBaileysVersion(); version = v.version; }
  catch (_) { version = [2, 3000, 1017531287]; }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // No pairing logic here — handled by server.js /pair endpoint

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => startXena(), 5000);
      } else {
        if (fs.existsSync('./auth_info')) fs.rmSync('./auth_info', { recursive: true });
        notify('🔴 *Xena logged out.*\n\nVisit the website to reconnect.');
      }
    } else if (connection === 'open') {
      isLinked = true;
      global.activeSession = sock;
      log(`✅ Xena online: ${sock.user?.id}`);
      notify(`✅ *Xena is online!*\n\`${sock.user?.id?.split(':')[0]}\` 🔥`);
    }
  });

  // messages handler stays same...

  // ── Messages ─────────────────────────────────────────────────────
  sock.ev.on('messages.upsert',async({messages,type})=>{
    if(type!=='notify')return;
    if(sock._isClosed||sock!==global.activeSession)return;

    for(const msg of messages){
      if(msg.key.fromMe)continue;
      const chatId=msg.key.remoteJid;
      const sender=msg.key.participant||msg.key.remoteJid;
      const senderNum=sender.replace(/[^0-9]/g,'');
      const botNumber=sock.user?.id?.split(':')[0]||'';

      if(msg.message) saveDeleted(chatId,sender,msg.message);
      addInteraction(sender);

      // ViewOnce capture
      const viewOnceMsg=msg.message?.viewOnceMessage?.message||msg.message?.viewOnceMessageV2?.message||msg.message?.viewOnceMessageV2Extension?.message;
      if(viewOnceMsg?.imageMessage||viewOnceMsg?.videoMessage){
        try{
          const buf=await downloadMediaMessage({...msg,message:viewOnceMsg},'buffer',{},{logger:pino({level:'silent'}),reuploadRequest:sock.updateMediaMessage});
          global.viewOnceStore[chatId]={buffer:buf,type:viewOnceMsg.imageMessage?'image':'video',from:senderNum,timestamp:Date.now()};
        }catch(e){ log(`ViewOnce error: ${e.message}`); }
        continue;
      }

      // ViewOnce reveal
      const body=(msg.message?.conversation||msg.message?.extendedTextMessage?.text||msg.message?.imageMessage?.caption||msg.message?.videoMessage?.caption||'').trim();
      if(/viewonce|view once|reveal/i.test(body)&&shouldRespond(msg,botNumber)){
        const stored=global.viewOnceStore[chatId];
        if(stored){ await sock.sendMessage(chatId,{[stored.type==='image'?'image':'video']:stored.buffer,caption:`👁️ *Xena* | ViewOnce revealed 🔓`},{quoted:msg}); }
        else{ await sock.sendMessage(chatId,{text:'❌ No viewonce found.'},{ quoted:msg}); }
        continue;
      }

      // Image recognition
      const imageMsg=msg.message?.imageMessage;
      if(imageMsg&&!imageMsg.viewOnce){
        if(!shouldRespond(msg,botNumber))continue;
        try{
          await sock.sendPresenceUpdate('composing',chatId);
          const imgBuf=await downloadMediaMessage(msg,'buffer',{},{logger:pino({level:'silent'}),reuploadRequest:sock.updateMediaMessage});
          const caption=imageMsg.caption||'';
          if(/rate|compliment|how do i look|am i pretty/i.test(caption)){
            const r=await (require('./features/fun')).complimentPhoto();
            await sock.sendMessage(chatId,{text:`😍 ${r}`},{quoted:msg});
          }else{
            const r=await describeImage(imgBuf.toString('base64'),imageMsg.mimetype||'image/jpeg');
            await sock.sendMessage(chatId,{text:r},{quoted:msg});
          }
        }catch(e){ await sock.sendMessage(chatId,{text:'❌ Could not read image.'},{quoted:msg}); }
        continue;
      }

      if(!body||!shouldRespond(msg,botNumber))continue;
      const senderName=getName(sender)||senderNum;
      const cleanBody=body.replace(/xena\s*/i,'').replace(/@\d+\s*/g,'').trim();
      const quotedText=msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation||msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text||null;

      log(`📩 [${isOwner(senderNum)?'OWNER':senderName}]: ${cleanBody}`);

      try{
        await sock.sendPresenceUpdate('composing',chatId);

        // ── 1. Sticker (WA only) ──
        if(/^sticker/i.test(cleanBody)){
          const quoted=msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const hasImg=quoted?.imageMessage||msg.message?.imageMessage;
          if(!hasImg){ await sock.sendMessage(chatId,{text:'❌ Send or quote an image with "sticker"'},{quoted:msg}); continue; }
          const imgBuf=await downloadMediaMessage(msg,'buffer',{},{logger:pino({level:'silent'}),reuploadRequest:sock.updateMediaMessage});
          const stickerBuf=await imageToSticker(imgBuf);
          await sock.sendMessage(chatId,{sticker:stickerBuf},{quoted:msg});
          continue;
        }

        // ── 2. Games ──
        const gameHandled=await handleGame(
          chatId,sender,senderName,cleanBody,
          async(text)=>sock.sendMessage(chatId,{text}),
          async(question,options)=>sock.sendMessage(chatId,{poll:{name:question,values:options,selectableCount:1}})
        );
        if(gameHandled)continue;

        // ── 3. Commands ──
        const cmd=await handleCommand(
          cleanBody,chatId,sender,isOwner(senderNum),quotedText,'wa',
          async(cid,m)=>sock.sendMessage(cid,{text:`⏰ *Reminder:* ${m}`})
        );
        if(cmd){
          if(cmd.thinking) await sock.sendMessage(chatId,{text:cmd.thinking},{quoted:msg});
          if(cmd.type==='text') await sock.sendMessage(chatId,{text:cmd.content},{quoted:msg});
          else if(cmd.type==='image') await sock.sendMessage(chatId,{image:cmd.content,caption:cmd.caption||''},{quoted:msg});
          else if(cmd.type==='audio') await sock.sendMessage(chatId,{audio:cmd.content,mimetype:'audio/mpeg',ptt:cmd.isVoice},{quoted:msg});
          else if(cmd.type==='video') await sock.sendMessage(chatId,{video:cmd.content,caption:cmd.caption||''},{quoted:msg});
          continue;
        }

        // ── 4. AI Chat ──
        const memory=getMemory(chatId);
        addMemory(chatId,'user',cleanBody);
        const aiReply=await chat(memory,sender,isOwner(senderNum),quotedText);
        addMemory(chatId,'assistant',aiReply);
        await sock.sendMessage(chatId,{text:aiReply},{quoted:msg});

      }catch(err){
        log(`Error: ${err.message}`);
        await sock.sendMessage(chatId,{text:`⚠️ Error: ${err.message}`},{quoted:msg});
      }
    }
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────
async function bootstrap(){
  initTelegram(
    async(phone)=>await startXena(phone),
    ()=>{ cancelReconnect(); notify('🔄 Restarting...'); setTimeout(()=>startXena(),1000); },
    (cb)=>cb(xenaStatus)
  );
  await startXena();
}

module.exports={startXena:bootstrap};
