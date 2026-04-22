'use strict';

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { chat, describeImage } = require('./chatbot');
const { handleCommand } = require('./commands');
const { handleGame } = require('./games');
const { saveDeleted } = require('./antidelete');
const { addInteraction, getName } = require('./personality');

const CREATOR_TG_ID = '8167202570';
const CREATOR_WA = '233530729233';
const CREATOR_NAME = 'Darkside';

let botInstance = null;
let tgMemory = {};

function getMemory(id){ if(!tgMemory[id]) tgMemory[id]=[]; return tgMemory[id]; }
function addMemory(id,role,content){
  if(!tgMemory[id]) tgMemory[id]=[];
  tgMemory[id].push({role,content});
  if(tgMemory[id].length>20) tgMemory[id]=tgMemory[id].slice(-20);
}

function isOwner(userId,config){
  return String(userId)===String(config.TELEGRAM_OWNER_ID)||String(userId)===CREATOR_TG_ID;
}
function shouldRespond(msg,botUsername){
  const text=msg.text||msg.caption||'';
  const isGroup=msg.chat.type==='group'||msg.chat.type==='supergroup';
  if(!isGroup)return true;
  return text.toLowerCase().includes('xena')||text.includes(`@${botUsername}`)||!!msg.reply_to_message?.from?.username?.includes(botUsername);
}
function cleanText(text,botUsername){
  return text.replace(/xena\s*/gi,'').replace(new RegExp(`@${botUsername}\\s*`,'gi'),'').trim();
}

function log(msg){
  const entry=`[TG ${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(entry);
  if(global.xenaLogs){ global.xenaLogs.push(entry); if(global.xenaLogs.length>50) global.xenaLogs.shift(); }
}

async function sendTyping(bot,chatId){ await bot.sendChatAction(chatId,'typing').catch(()=>{}); }

async function reply(bot,msg,text){
  try{ await bot.sendMessage(msg.chat.id,text,{reply_to_message_id:msg.message_id,parse_mode:'Markdown'}); }
  catch(e){ await bot.sendMessage(msg.chat.id,text,{reply_to_message_id:msg.message_id}).catch(()=>{}); }
}

function startTelegramBot(config){
  if(botInstance){ try{ botInstance.stopPolling(); }catch(_){} }
  const token=config.TELEGRAM_BOT_TOKEN;
  if(!token||token==='YOUR_TELEGRAM_BOT_TOKEN'){ log('⚠️ No Telegram token. Skipping.'); return null; }

  const bot=new TelegramBot(token,{polling:true});
  botInstance=bot;
  global.tgBotInstance=bot;

  let botUsername='';
  bot.getMe().then(me=>{ botUsername=me.username; log(`✅ Telegram @${botUsername} online!`); }).catch(e=>log(`TG getMe error: ${e.message}`));

  bot.onText(/\/start/,async(msg)=>{
    const name=msg.from.first_name||'there';
    await bot.sendMessage(msg.chat.id,
      `👋 *Hey ${name}! I'm Xena* 🦊\n\nThe most powerful AI bot you've ever met.\n\nJust talk to me naturally — no commands needed!\n\nSome things I can do:\n🎨 generate image • 🎵 generate music\n🎙️ voice • 🌤️ weather • 📚 wiki\n😂 joke • 🔥 roast • 💘 ship\n🎮 group games • 👁️ antidelete\n\n_Created by ${CREATOR_NAME}_`,
      {parse_mode:'Markdown'}
    );
  });

  bot.onText(/\/creator/,async(msg)=>{
    await bot.sendMessage(msg.chat.id,
      `👑 *My Creator*\n\n*Name:* ${CREATOR_NAME}\n*WhatsApp:* +${CREATOR_WA}\n\n_Xena was built from scratch by ${CREATOR_NAME}._`,
      {parse_mode:'Markdown'}
    );
  });

  // Photo handler
  bot.on('photo',async(msg)=>{
    if(!shouldRespond(msg,botUsername))return;
    const chatId=msg.chat.id;
    try{
      await sendTyping(bot,chatId);
      const photoId=msg.photo[msg.photo.length-1].file_id;
      const fileLink=await bot.getFileLink(photoId);
      const res=await axios.get(fileLink,{responseType:'arraybuffer'});
      const base64=Buffer.from(res.data).toString('base64');
      const caption=msg.caption||'';
      if(/rate|compliment|how do i look|am i pretty/i.test(caption)){
        const r=await (require('./fun')).complimentPhoto();
        await reply(bot,msg,`😍 ${r}`);
      }else{
        const r=await describeImage(base64,'image/jpeg');
        await reply(bot,msg,r);
      }
    }catch(e){ await reply(bot,msg,'❌ Could not read image.'); }
  });

  // Message handler
  bot.on('message',async(msg)=>{
    if(!msg.text)return;
    if(!shouldRespond(msg,botUsername))return;

    const chatId=String(msg.chat.id);
    const userId=String(msg.from.id);
    const userJid=`${userId}@telegram`;
    const senderName=getName(userJid)||msg.from.first_name||userId;
    const body=msg.text.trim();

    saveDeleted(chatId,userJid,{conversation:body});
    addInteraction(userJid);

    const quotedText=msg.reply_to_message?.text||null;
    const cleanBody=cleanText(body,botUsername);

    // Owner secret code
    if(body.toLowerCase()==='xena123'){
      await reply(bot,msg,`Dark! 🦊💜 It's really you! My creator. I'd recognize you anywhere. What do you need boss?`);
      return;
    }

    log(`📩 [${isOwner(userId,config)?'OWNER':senderName}]: ${cleanBody}`);

    try{
      await sendTyping(bot,chatId);

      // ── 1. Games ──
      const gameHandled=await handleGame(
        chatId,userJid,senderName,cleanBody,
        async(text)=>bot.sendMessage(msg.chat.id,text,{parse_mode:'Markdown'}),
        async(question,options)=>bot.sendPoll(msg.chat.id,question,options,{is_anonymous:false})
      );
      if(gameHandled)return;

      // ── 2. Commands ──
      const cmd=await handleCommand(
        cleanBody,chatId,userJid,isOwner(userId,config),quotedText,'tg',
        async(cid,m)=>bot.sendMessage(msg.chat.id,`⏰ *Reminder:* ${m}`,{parse_mode:'Markdown'})
      );
      if(cmd){
        if(cmd.thinking) await reply(bot,msg,cmd.thinking);
        if(cmd.type==='text') await reply(bot,msg,cmd.content);
        else if(cmd.type==='image') await bot.sendPhoto(msg.chat.id,cmd.content,{reply_to_message_id:msg.message_id,caption:cmd.caption||''});
        else if(cmd.type==='audio'&&cmd.isVoice) await bot.sendVoice(msg.chat.id,cmd.content,{reply_to_message_id:msg.message_id});
        else if(cmd.type==='audio') await bot.sendAudio(msg.chat.id,cmd.content,{reply_to_message_id:msg.message_id});
        else if(cmd.type==='video') await bot.sendVideo(msg.chat.id,cmd.content,{reply_to_message_id:msg.message_id,caption:cmd.caption||''});
        return;
      }

      // ── 3. Creator questions ──
      if(/who (made|created|built) you|your creator/i.test(body.toLowerCase())){
        await reply(bot,msg,`Darkside 💜 my creator, my guy, built me from scratch. absolute legend honestly`);
        return;
      }

      // ── 4. AI Chat ──
      const memory=getMemory(chatId);
      addMemory(chatId,'user',cleanBody);
      const aiReply=await chat(memory,userJid,isOwner(userId,config),quotedText);
      addMemory(chatId,'assistant',aiReply);
      await reply(bot,msg,aiReply);

    }catch(err){
      log(`TG Error: ${err.message}`);
      await reply(bot,msg,`⚠️ Error: ${err.message}`).catch(()=>{});
    }
  });

  bot.on('edited_message',(msg)=>{
    if(msg.text) saveDeleted(String(msg.chat.id),`${msg.from.id}@telegram`,{conversation:`[EDITED] ${msg.text}`});
  });

  bot.on('polling_error',(err)=>{
    log(`TG polling error: ${err.message}`);
    setTimeout(()=>{ try{bot.startPolling();}catch(_){} },5000);
  });

  log(`🤖 Telegram bot started`);
  return bot;
}

function stopTelegramBot(){
  if(botInstance){ try{botInstance.stopPolling();botInstance=null;global.tgBotInstance=null;}catch(_){} }
}

function getBotInstance(){ return botInstance; }

module.exports={startTelegramBot,stopTelegramBot,getBotInstance};
