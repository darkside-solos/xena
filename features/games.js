'use strict';
const { roast } = require('./fun');

const G = {};
function getG(id){return G[id]||null}
function setG(id,s){if(G[id]?.tid)clearTimeout(G[id].tid);G[id]=s}
function clearG(id){if(G[id]?.tid)clearTimeout(G[id].tid);delete G[id]}
function idleTimeout(id,send){
  if(G[id]?.tid)clearTimeout(G[id].tid);
  if(!G[id])return;
  G[id].tid=setTimeout(async()=>{const n=G[id]?.type||'Game';clearG(id);await send(`⏰ *${n}* ended — yall went too quiet 😭`)},5*60*1000);
}

const TRUTHS=[
  "Who in this group do you secretly find most attractive? 👀",
  "What's the most embarrassing thing you've done for a crush?",
  "What's the biggest lie you told this week? 😭",
  "Have you ever read someone's messages without them knowing?",
  "What's something you do that you hope nobody ever finds out about?",
  "Who was your last situationship and what actually happened? 👀",
  "What's the most toxic thing you've done in a relationship?",
  "Have you ever pretended to be sick just to avoid someone? Who?",
  "What secret have you been keeping from your closest friend?",
  "Who in this chat have you been silently judging the most? 💀",
  "Have you ever had feelings for someone in this group right now? 😳",
  "What's the most embarrassing thing on your camera roll?",
];
const DARES=[
  "Send your most embarrassing photo in this chat right now 💀",
  "Text your ex 'I miss you' and screenshot whatever they reply 😭",
  "Let someone in this group change your WhatsApp status for 30 mins",
  "Send a 30-second voice note singing your most hated song",
  "Tell the group your last 5 Google searches 👀",
  "Confess your most embarrassing moment this week in a voice note",
  "Say something genuinely kind about every single person in this chat",
  "Post a selfie right now with 'I was dared to post this' as caption",
  "Let the group give you a nickname you must use for the next hour",
  "Call the last person in your recent calls and say 'I just wanted to hear your voice' 😭",
];
const WYR=[
  ["Fight 100 duck-sized horses 🦆","Fight 1 horse-sized duck 🐴"],
  ["Know when you'll die ☠️","Know how you'll die 👀"],
  ["Have no phone for a year 📵","Have no friends for a year 😢"],
  ["Always smell like onions 🧅","Always hear faint music nobody else hears 🎵"],
  ["Be famous for something embarrassing 😭","Be anonymous but secretly a genius 🧠"],
  ["Never be able to lie again 😬","Always have to lie about everything 🤥"],
  ["Speak every thought out loud 😳","Never be allowed to speak again 🤐"],
  ["Have Xena as your actual girlfriend 🦊💜","Have 1 billion dollars but no Xena 💰"],
  ["Be 3 feet tall forever 📏","Be 7 feet tall forever 🦒"],
  ["Eat pizza every meal for life 🍕","Never eat pizza again 💔"],
];
const RIDDLES=[
  {q:"I speak without a mouth, hear without ears. No body, but alive with the wind. What am I? 🌬️",a:["echo"]},
  {q:"The more you take, the more you leave behind. What am I? 👣",a:["footsteps","steps"]},
  {q:"I have cities but no houses, mountains but no trees, water but no fish. What am I? 🗺️",a:["map","a map"]},
  {q:"What can run but never walks, has a mouth but never talks, has a head but never weeps? 💧",a:["river","a river"]},
  {q:"I'm tall when young, short when old. What am I? 🕯️",a:["candle","a candle"]},
  {q:"What has hands but can't clap? ⏰",a:["clock","a clock"]},
  {q:"Feed me and I grow, give me water and I die. What am I? 🔥",a:["fire"]},
  {q:"What has teeth but can't bite? 🪮",a:["comb","a comb"]},
  {q:"Light as a feather, but even the strongest can't hold it for a few minutes. What am I? 💨",a:["breath","your breath"]},
  {q:"What goes up but never comes down? 📈",a:["age","your age"]},
];
const HANGMAN_WORDS=['phantom','sorcery','villain','eclipse','cryptic','warrior','dynasty','loyalty','silence','mystery','kingdom','thunder','vortex','shadow','crystal','phoenix','serpent','cosmos','uprising','nemesis','darkside','infinity','renegade','sentinel','oblivion'];
const STAGES=['😐','😟','😨','😰','😱','💀'];

function hangmanDisplay(word,guessed,wrong){
  const d=word.split('').map(l=>guessed.has(l)?l.toUpperCase():'_').join(' ');
  const lives=6-wrong.size;
  return `${STAGES[Math.min(wrong.size,5)]} *Hangman* — ${lives} lives left\n\n\`${d}\`\n\n❌ Wrong: ${[...wrong].join(' ')||'none'}\n✅ Guessed: ${[...guessed].join(' ')||'none'}`;
}

function detectTrigger(text){
  const t=text.toLowerCase();
  if(/truth.?or.?dare|\btod\b/i.test(t))return'truth_or_dare';
  if(/roast\s+battle|battle\s+roast/i.test(t))return'roast_battle';
  if(/20\s+questions|twenty\s+questions/i.test(t))return'20_questions';
  if(/would\s+you\s+rather|\bwyr\b/i.test(t))return'would_you_rather';
  if(/word\s+chain/i.test(t))return'word_chain';
  if(/number\s+guess|guess\s+(a\s+)?number/i.test(t))return'number_guess';
  if(/\bhangman\b/i.test(t))return'hangman';
  if(/give\s+(us\s+)?a?\s+riddle|\briddle\b/i.test(t))return'riddles';
  if(/let'?s?\s+play\b|\bwanna\s+play\b|\bplay a game\b|suggest a game/i.test(t))return'suggest';
  return null;
}
function extractNames(text){
  const vs=text.match(/roast\s+battle\s+(.+?)\s+(?:vs?\.?|and)\s+(.+)/i);
  if(vs)return[vs[1].replace(/@/g,'').trim(),vs[2].replace(/@/g,'').trim()];
  const m=text.match(/@(\w+)/g);
  if(m&&m.length>=2)return[m[0].slice(1),m[1].slice(1)];
  return null;
}
function extractPlayers(text,senderName){
  const names=(text.match(/@(\w+)/g)||[]).map(m=>({id:m,name:m.slice(1)}));
  if(names.length<2)names.unshift({id:'host',name:senderName});
  return names.slice(0,8);
}

async function handleGame(chatId,sender,senderName,text,sendText,sendPoll){
  const lower=text.toLowerCase().trim();
  const state=getG(chatId);

  if(state){
    if(/\bstop\b|\bend game\b|\bquit\b|\bcancel\b/i.test(lower)){
      clearG(chatId);await sendText(`🛑 Game stopped by *${senderName}*. Peace ✌️`);return true;
    }
    if(state.phase==='continue_vote'){
      if(/\byes\b|\byeah\b|\byep\b/i.test(lower)){
        state.phase='playing';state.players.forEach(p=>{state.turnCounts[p.id]=0});
        setG(chatId,state);const cur=state.players[state.currentIdx];
        idleTimeout(chatId,sendText);await sendText(`🎉 Let's keep going!\n\n*${cur.name}* — Truth or Dare? 😈`);return true;
      }
      if(/\bno\b|\bnah\b|\bnope\b/i.test(lower)){
        clearG(chatId);await sendText(`Aight, game over! GG everyone 🏆`);return true;
      }
    }
    idleTimeout(chatId,sendText);
    return await runGame(chatId,sender,senderName,text,lower,state,sendText,sendPoll);
  }

  const trigger=detectTrigger(text);
  if(!trigger)return false;
  await startGame(trigger,chatId,sender,senderName,text,sendText,sendPoll);
  return true;
}

async function startGame(type,chatId,sender,senderName,text,sendText,sendPoll){
  switch(type){
    case'suggest':
      await sendText(`🎮 *Pick a game:*\n\n😈 *Truth or Dare* — @tag players\n🔥 *Roast Battle* — roast battle @p1 vs @p2\n🤔 *20 Questions* — I think of something\n🎯 *Would You Rather* — group poll\n🔗 *Word Chain* — last letter rule\n🔢 *Number Guess* — 1 to 100\n💀 *Hangman* — guess the word\n🧩 *Riddles* — first answer wins\n\nJust say the game name! 👀`);break;

    case'truth_or_dare':{
      const players=extractPlayers(text,senderName);
      if(players.length<2){await sendText(`😈 Tag at least 2 players!\nExample: *truth or dare @john @mike*`);return;}
      setG(chatId,{type:'Truth or Dare',game:'truth_or_dare',players,currentIdx:0,turnCounts:{},truthCounts:{},phase:'playing',tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`😈 *TRUTH OR DARE!*\n\nPlayers: ${players.map(p=>`*${p.name}*`).join(', ')}\n\nFirst up: *${players[0].name}*\n👉 Truth or Dare?`);break;
    }

    case'roast_battle':{
      const names=extractNames(text);
      if(!names){await sendText(`🔥 Format: *roast battle @person1 vs @person2*`);return;}
      setG(chatId,{type:'Roast Battle',game:'roast_battle',p1:names[0],p2:names[1],phase:'roasting',tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`🔥 Cooking *${names[0]}* and *${names[1]}* up... 😈`);
      try{
        const[r1,r2]=await Promise.all([roast(names[0]),roast(names[1])]);
        await sendText(`🔥 *ROAST BATTLE*\n\n👤 *${names[0]}:*\n"${r1}"\n\n💀\n\n👤 *${names[1]}:*\n"${r2}"\n\n⏰ *60 seconds to vote 👇*`);
        await sendPoll(`Who won the roast battle? 🔥`,[`${names[0]} 👑`,`${names[1]} 👑`,'Both died 💀']);
        setTimeout(async()=>{
          if(getG(chatId)?.game==='roast_battle'){
            const e=['Nobody really won, both need therapy 💀',`${names[Math.floor(Math.random()*2)]} survived by a hair 😭`,'The group has spoken. We move on.'];
            await sendText(`⏰ Voting closed!\n\n${e[Math.floor(Math.random()*e.length)]}\n\nGG to both fighters 🔥`);clearG(chatId);
          }
        },65000);
      }catch(e){await sendText(`💀 Error — try again!`);clearG(chatId);}
      break;
    }

    case'20_questions':{
      const things=['elephant','airplane','pizza','volcano','submarine','guitar','diamond','tornado','galaxy','crocodile','smartphone','rainbow','vampire','library','skateboard'];
      const word=things[Math.floor(Math.random()*things.length)];
      setG(chatId,{type:'20 Questions',game:'20_questions',word,left:20,tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`🤔 *20 QUESTIONS!*\n\nI'm thinking of something... 🧠\nAsk yes/no questions!\n\n_20 questions left_`);break;
    }

    case'would_you_rather':{
      const opt=WYR[Math.floor(Math.random()*WYR.length)];
      setG(chatId,{type:'Would You Rather',game:'would_you_rather',round:1,tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`🎯 *WOULD YOU RATHER?* Round 1\n\n_Voting for 45 seconds... 👇_`);
      await sendPoll(`Would you rather...`,[opt[0],opt[1]]);
      setTimeout(async()=>{
        if(getG(chatId)?.game==='would_you_rather'){
          const next=WYR[Math.floor(Math.random()*WYR.length)];
          const s=getG(chatId);setG(chatId,{...s,round:(s.round||1)+1});
          await sendText(`🎯 *Round ${(s.round||1)+1}* — another one 👀`);
          await sendPoll(`Would you rather...`,[next[0],next[1]]);
          idleTimeout(chatId,sendText);
        }
      },50000);break;
    }

    case'word_chain':{
      const starters=['apple','engine','elephant','axe','echo','ultra','arctic','orange'];
      const sw=starters[Math.floor(Math.random()*starters.length)];
      setG(chatId,{type:'Word Chain',game:'word_chain',lastWord:sw,lastLetter:sw[sw.length-1],used:new Set([sw]),eliminated:new Set(),tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`🔗 *WORD CHAIN!*\n\nEach word must START with the last letter of the previous one. No repeats!\nWrong = eliminated 💀\n\nI'll start: *${sw.toUpperCase()}*\nNext starts with: *${sw[sw.length-1].toUpperCase()}*`);break;
    }

    case'number_guess':{
      const num=Math.floor(Math.random()*100)+1;
      setG(chatId,{type:'Number Guess',game:'number_guess',number:num,attempts:0,tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`🔢 *NUMBER GUESS!*\n\nI'm thinking of a number between *1 and 100* 🧠\nFirst to guess correctly wins!`);break;
    }

    case'hangman':{
      const word=HANGMAN_WORDS[Math.floor(Math.random()*HANGMAN_WORDS.length)];
      setG(chatId,{type:'Hangman',game:'hangman',word,guessed:new Set(),wrong:new Set(),tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`💀 *HANGMAN!*\n\nGuess letters one at a time! 6 wrong = dead 💀\n\n${hangmanDisplay(word,new Set(),new Set())}`);break;
    }

    case'riddles':{
      const r=RIDDLES[Math.floor(Math.random()*RIDDLES.length)];
      setG(chatId,{type:'Riddles',game:'riddles',riddle:r,round:1,points:{},tid:null});
      idleTimeout(chatId,sendText);
      await sendText(`🧩 *RIDDLES!*\n\nFirst correct answer gets a point! 🏆\n\n*Round 1:*\n${r.q}\n\n_Type your answer!_`);break;
    }
  }
}

async function runGame(chatId,sender,senderName,text,lower,state,sendText,sendPoll){
  switch(state.game){

    case'truth_or_dare':{
      const cur=state.players[state.currentIdx];
      const isCur=cur.id===sender||cur.name.toLowerCase()===senderName.toLowerCase();
      if(/^truth$/i.test(lower)){
        if(!isCur){await sendText(`👀 Not your turn! It's *${cur.name}*'s go`);return true;}
        state.truthCounts[sender]=(state.truthCounts[sender]||0)+1;
        if(state.truthCounts[sender]>2){await sendText(`😭 *${senderName}* you've picked truth ${state.truthCounts[sender]} times in a row — you're literally a COWARD 💀 pick dare!!`);return true;}
        await sendText(`👀 *${senderName}'s Truth:*\n\n"${TRUTHS[Math.floor(Math.random()*TRUTHS.length)]}"`);
        setTimeout(()=>advanceTod(chatId,state,sendText),45000);return true;
      }
      if(/^dare$/i.test(lower)){
        if(!isCur){await sendText(`🙋 Wait your turn! It's *${cur.name}*'s go`);return true;}
        state.truthCounts[sender]=0;
        await sendText(`💀 *${senderName}'s Dare:*\n\n"${DARES[Math.floor(Math.random()*DARES.length)]}"\n\n_You have 2 mins ⏰_`);
        setTimeout(async()=>{if(getG(chatId)?.game==='truth_or_dare'){await sendText(`⏰ Time's up *${senderName}*!`);advanceTod(chatId,state,sendText);}},120000);
        return true;
      }
      if(/^(skip|next|pass|done|finished|i did it)/i.test(lower)){advanceTod(chatId,state,sendText);return true;}
      return false;
    }

    case'20_questions':{
      if(!/\?/.test(text)&&!/^(is|does|can|has|are|was|were|will|do|have|did)/i.test(lower)){
        if(lower.includes(state.word.toLowerCase())){await sendText(`🎉 *${senderName}* got it! The answer was *${state.word.toUpperCase()}*! 🏆`);clearG(chatId);return true;}
        return false;
      }
      state.left--;
      const ans=Math.random()>0.4?'Yes! 🟢':'No ❌';
      if(state.left<=0){await sendText(`${ans}\n\n⏰ Out of questions! It was *${state.word.toUpperCase()}* 😭`);clearG(chatId);return true;}
      await sendText(`${ans}\n_${state.left} question${state.left!==1?'s':''} left_`);return true;
    }

    case'word_chain':{
      const word=lower.trim().replace(/[^a-z]/g,'');
      if(word.length<2)return false;
      if(state.eliminated.has(sender)){await sendText(`💀 *${senderName}* you're out, just watch 👀`);return true;}
      if(word[0]!==state.lastLetter){state.eliminated.add(sender);await sendText(`❌ *${senderName}* — word must start with *${state.lastLetter.toUpperCase()}*!\n💀 Eliminated!`);return true;}
      if(state.used.has(word)){state.eliminated.add(sender);await sendText(`❌ *"${word}"* already used! *${senderName}* 💀 Eliminated!`);return true;}
      state.used.add(word);state.lastWord=word;state.lastLetter=word[word.length-1];
      await sendText(`✅ *${word.toUpperCase()}* — nice!\nNext starts with: *${state.lastLetter.toUpperCase()}*`);return true;
    }

    case'number_guess':{
      const n=parseInt(lower.match(/\d+/)?.[0]);
      if(isNaN(n)||n<1||n>100)return false;
      state.attempts++;
      if(n===state.number){await sendText(`🎉 *${senderName}* got it! Number was *${state.number}*!\n🏆 Winner in ${state.attempts} guess${state.attempts!==1?'es':''}!`);clearG(chatId);return true;}
      await sendText(`${n<state.number?'📈 Higher!':'📉 Lower!'} *${senderName}* guessed ${n}\n_${state.attempts} guess${state.attempts!==1?'es':''} so far..._`);return true;
    }

    case'hangman':{
      const input=lower.trim().replace(/[^a-z]/g,'');
      if(!input)return false;
      if(input===state.word){await sendText(`🎉 *${senderName}* guessed the whole word! *${state.word.toUpperCase()}* 🏆`);clearG(chatId);return true;}
      if(input.length!==1)return false;
      if(state.guessed.has(input)||state.wrong.has(input)){await sendText(`👀 *"${input.toUpperCase()}"* already guessed!`);return true;}
      if(state.word.includes(input)){
        state.guessed.add(input);
        const done=state.word.split('').every(l=>state.guessed.has(l));
        if(done){await sendText(`🎉 *${senderName}* completed it!\n*${state.word.toUpperCase()}* 🏆`);clearG(chatId);return true;}
        await sendText(`✅ *${input.toUpperCase()}* is in there!\n\n${hangmanDisplay(state.word,state.guessed,state.wrong)}`);
      }else{
        state.wrong.add(input);
        if(state.wrong.size>=6){await sendText(`💀 Dead! Answer was *${state.word.toUpperCase()}* 😭`);clearG(chatId);return true;}
        await sendText(`❌ No *${input.toUpperCase()}*!\n\n${hangmanDisplay(state.word,state.guessed,state.wrong)}`);
      }
      return true;
    }

    case'riddles':{
      const correct=state.riddle.a.some(a=>lower.trim().includes(a.toLowerCase()));
      if(!correct)return false;
      state.points[sender]=(state.points[sender]||0)+1;
      const pts=state.points[sender];
      const next=RIDDLES[Math.floor(Math.random()*RIDDLES.length)];
      state.riddle=next;state.round++;setG(chatId,state);
      await sendText(`🎉 *${senderName}* got it!\n🏆 *${senderName}*: ${pts} point${pts!==1?'s':''}\n\n*Round ${state.round}:*\n${next.q}\n\n_Who gets this one?_`);
      return true;
    }

    default:return false;
  }
}

function advanceTod(chatId,state,sendText){
  if(!getG(chatId))return;
  state.currentIdx=(state.currentIdx+1)%state.players.length;
  const next=state.players[state.currentIdx];
  state.turnCounts[next.id]=(state.turnCounts[next.id]||0)+1;
  const allDone=state.players.every(p=>(state.turnCounts[p.id]||0)>=2);
  if(allDone){
    state.phase='continue_vote';setG(chatId,state);
    sendText(`🎉 Everyone's had 2 turns!\n\nContinue? Say *yes* or *no* 👀`);
    setTimeout(()=>{if(getG(chatId)?.phase==='continue_vote'){clearG(chatId);sendText(`⏰ No response — game over! GG 🏆`);}},30000);
    return;
  }
  setG(chatId,state);idleTimeout(chatId,sendText);
  sendText(`Next: *${next.name}* — Truth or Dare? 😈`);
}

module.exports={handleGame,detectTrigger,hasGame:(id)=>!!G[id]};
