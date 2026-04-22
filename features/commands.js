'use strict';

const { generateImage } = require('./imageGen');
const { generateVideo, generateMusic, downloadFromLink } = require('./mediaGen');
const { textToVoice } = require('./voice');
const { setName, setBirthday, getCurrentMood, getMoodEmoji } = require('./personality');
const { getDeleted } = require('./antidelete');
const { wikipedia, weather, dictionary, translate, currency, ipLookup, news } = require('./search');
const { roast, joke, horoscope, motivation, rizz, ship, poem, dreamInterpret, debate, story, analyzePersonality, recipe, fixGrammar, summarize, write, complimentPhoto } = require('./fun');
const { generateQR, shortenURL, generatePassword, calculate, setReminder } = require('./utility');
const { generateXenachar } = require('./xenachar');

async function handleCommand(cleanBody,chatId,sender,isOwner,quotedText,platform,onReminder){
  const lower=cleanBody.toLowerCase();

  if(/^(voice|speak|say )/i.test(cleanBody)){
    const t=cleanBody.replace(/^(voice|speak|say)\s*/i,'').trim();
    const buf=await textToVoice(t);
    return{type:'audio',content:buf,isVoice:true,thinking:'🎙️ Recording...'};
  }
  if(/^(generate image|create image|draw )/i.test(cleanBody)){
    const p=cleanBody.replace(/^(generate image|create image|draw)\s*/i,'').trim();
    const buf=await generateImage(p);
    return{type:'image',content:buf,caption:`🎨 *Xena* | Done! ✨`,thinking:`🎨 Generating: _${p}_...`};
  }
  if(/^(generate music|make music|create music)/i.test(cleanBody)){
    const p=cleanBody.replace(/^(generate music|make music|create music)\s*/i,'').trim();
    const buf=await generateMusic(p);
    return{type:'audio',content:buf,isVoice:false,thinking:'🎵 Generating music...'};
  }
  if(/^(generate video|create video|make video)/i.test(cleanBody)){
    const p=cleanBody.replace(/^(generate video|create video|make video)\s*/i,'').trim();
    const buf=await generateVideo(p);
    return{type:'video',content:buf,caption:'🎬 *Xena* | Done!',thinking:'🎬 Generating... _(~2 mins)_'};
  }
  const urlMatch=cleanBody.match(/(https?:\/\/[^\s]+)/);
  if(urlMatch){
    const r=await downloadFromLink(urlMatch[1]);
    if(r.type==='video')return{type:'video',content:r.buffer,caption:'🎬 Done!',thinking:'⬇️ Downloading...'};
    return{type:'audio',content:r.buffer,isVoice:false,thinking:'⬇️ Downloading...'};
  }
  if(/xena (pic|photo|picture|selfie|send pic|your pic|show yourself)/i.test(lower)){
    const buf=await generateXenachar();
    return{type:'image',content:buf,caption:'💜 *That\'s me!* ~ Xena 🦊✨',thinking:'🎨 Generating my pic...'};
  }
  if(/^(antidelete|deleted|show deleted)/i.test(cleanBody)){
    const del=getDeleted(chatId);
    if(!del.length)return{type:'text',content:'🗑️ No deleted messages saved yet.'};
    const t=del.map((d,i)=>`${i+1}. *${d.sender}*\n${d.body}\n_${new Date(d.timestamp).toLocaleTimeString()}_`).join('\n\n');
    return{type:'text',content:`🗑️ *Deleted Messages:*\n\n${t}`};
  }
  if(/^wiki /i.test(cleanBody)){const q=cleanBody.replace(/^wiki\s*/i,'').trim();const r=await wikipedia(q);return{type:'text',content:`📚 *${q}*\n\n${r}`,thinking:'🔍 Searching...'};}
  if(/^weather /i.test(cleanBody)){const c=cleanBody.replace(/^weather\s*/i,'').trim();const r=await weather(c);return{type:'text',content:`🌤️ ${r}`};}
  if(/^(define|meaning) /i.test(cleanBody)){const w=cleanBody.replace(/^(define|meaning)\s*/i,'').trim();const r=await dictionary(w);return{type:'text',content:r};}
  if(/^translate /i.test(cleanBody)){const p=cleanBody.replace(/^translate\s*/i,'').trim().split(' ');const r=await translate(p.slice(1).join(' '),p[0]);return{type:'text',content:`🌐 *(${p[0]}):* ${r}`};}
  if(/^convert /i.test(cleanBody)){const p=cleanBody.replace(/^convert\s*/i,'').trim().split(' ');const r=await currency(p[0],p[1],p[2]);return{type:'text',content:r};}
  if(/^ip /i.test(cleanBody)){const ip=cleanBody.replace(/^ip\s*/i,'').trim();const r=await ipLookup(ip);return{type:'text',content:r};}
  if(/^news/i.test(cleanBody)){const r=await news();return{type:'text',content:`📰 *Latest News*\n\n${r}`,thinking:'📰 Fetching...'};}
  if(/^qr /i.test(cleanBody)){const t=cleanBody.replace(/^qr\s*/i,'').trim();const buf=await generateQR(t);return{type:'image',content:buf,caption:'📱 QR Code'};}
  if(/^shorten /i.test(cleanBody)){const url=cleanBody.replace(/^shorten\s*/i,'').trim();const r=await shortenURL(url);return{type:'text',content:`🔗 ${r}`};}
  if(/^password/i.test(cleanBody)){const len=parseInt(cleanBody.match(/\d+/)?.[0])||12;const pass=generatePassword(len);return{type:'text',content:`🔐 *Password:*\n\`${pass}\``};}
  if(/^calc /i.test(cleanBody)){const expr=cleanBody.replace(/^calc\s*/i,'').trim();return{type:'text',content:calculate(expr)};}
  if(/^remind /i.test(cleanBody)&&onReminder){
    const parts=cleanBody.replace(/^remind\s*/i,'').trim().split(' ');
    const r=setReminder(chatId,parts.slice(1).join(' '),parseInt(parts[0]),onReminder);
    return{type:'text',content:r};
  }
  if(/^roast /i.test(cleanBody)){const name=cleanBody.replace(/^roast\s*/i,'').trim();const r=await roast(name);return{type:'text',content:`🔥 ${r}`,thinking:'🔥 Cooking...'};}
  if(/^joke/i.test(cleanBody)){const r=await joke();return{type:'text',content:`😂 ${r}`};}
  if(/^horoscope /i.test(cleanBody)){const sign=cleanBody.replace(/^horoscope\s*/i,'').trim();const r=await horoscope(sign);return{type:'text',content:`⭐ *${sign}*\n\n${r}`};}
  if(/^(motivate|quote)/i.test(cleanBody)){const r=await motivation();return{type:'text',content:`💪 ${r}`};}
  if(/^rizz /i.test(cleanBody)){const name=cleanBody.replace(/^rizz\s*/i,'').trim();const r=await rizz(name);return{type:'text',content:`😏 ${r}`};}
  if(/^ship /i.test(cleanBody)){const p=cleanBody.replace(/^ship\s*/i,'').trim().split(' and ');if(p.length<2)return{type:'text',content:'❌ Format: ship [name1] and [name2]'};return{type:'text',content:ship(p[0].trim(),p[1].trim())};}
  if(/^poem /i.test(cleanBody)){const t=cleanBody.replace(/^poem\s*/i,'').trim();const r=await poem(t);return{type:'text',content:`📝\n\n${r}`};}
  if(/^dream /i.test(cleanBody)){const d=cleanBody.replace(/^dream\s*/i,'').trim();const r=await dreamInterpret(d);return{type:'text',content:`🌙 ${r}`};}
  if(/^debate /i.test(cleanBody)){const t=cleanBody.replace(/^debate\s*/i,'').trim();const r=await debate(t);return{type:'text',content:`⚡ *Debate*\n\n${r}`};}
  if(/^story /i.test(cleanBody)){const p=cleanBody.replace(/^story\s*/i,'').trim();const r=await story(p);return{type:'text',content:`📖\n\n${r}`,thinking:'📖 Writing...'};}
  if(/^analyze /i.test(cleanBody)){const t=cleanBody.replace(/^analyze\s*/i,'').trim();const r=await analyzePersonality(t);return{type:'text',content:`🧠 ${r}`};}
  if(/^recipe /i.test(cleanBody)){const ing=cleanBody.replace(/^recipe\s*/i,'').trim();const r=await recipe(ing);return{type:'text',content:`🍽️\n\n${r}`,thinking:'👩‍🍳 Finding recipe...'};}
  if(/^fix /i.test(cleanBody)){const t=cleanBody.replace(/^fix\s*/i,'').trim();const r=await fixGrammar(t);return{type:'text',content:`✅ ${r}`};}
  if(/^(summarize|tldr) /i.test(cleanBody)){const t=cleanBody.replace(/^(summarize|tldr)\s*/i,'').trim();const r=await summarize(t);return{type:'text',content:`📋\n\n${r}`};}
  if(/^write (essay|caption|email|letter|speech) /i.test(cleanBody)){
    const m=cleanBody.match(/^write (\w+) (.+)/i);
    if(m){const r=await write(m[1],m[2]);return{type:'text',content:r,thinking:`✍️ Writing ${m[1]}...`};}
  }
  if(/^(my name is|call me) /i.test(cleanBody)){const name=cleanBody.replace(/^(my name is|call me)\s*/i,'').trim();setName(sender,name);return{type:'text',content:`Got it! I'll call you *${name}* 😊`};}
  if(/^my birthday is /i.test(cleanBody)){const d=cleanBody.replace(/^my birthday is\s*/i,'').trim();setBirthday(sender,d);return{type:'text',content:`🎂 Noted! I'll wish you on *${d}* 🎉`};}
  if(/^(mood|how are you|your mood)/i.test(cleanBody)){const m=getCurrentMood();return{type:'text',content:`${getMoodEmoji(m)} Feeling *${m}* rn~ 💜`};}

  return null;
}

module.exports={handleCommand};
