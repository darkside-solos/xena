const Groq = require('groq-sdk');
const config = require('../config');
const groq = new Groq({ apiKey: config.GROQ_API_KEY });

async function askGroq(prompt) {
  const res = await groq.chat.completions.create({
    model: 'llama3-70b-8192', max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0].message.content;
}

async function roast(name) { return await askGroq(`Roast "${name}" in a funny savage WhatsApp style. Short and hilarious. No hate.`); }
async function joke() { return await askGroq('Tell me a funny short joke. Just the joke, nothing else.'); }
async function horoscope(sign) { return await askGroq(`Fun short daily horoscope for ${sign}. WhatsApp style, dramatic.`); }
async function motivation() { return await askGroq('Give a powerful motivational quote. Just quote and author.'); }
async function rizz(name) { return await askGroq(`Short smooth rizz pickup line for someone named ${name}.`); }
function ship(n1, n2) {
  const pct = Math.floor(Math.random() * 101);
  const v = pct > 80 ? '💍 Soulmates!' : pct > 60 ? '💕 Good match!' : pct > 40 ? '🤔 Maybe...' : pct > 20 ? '😬 Unlikely' : '💔 No way!';
  return `💘 *Ship Results*\n\n${n1} + ${n2}\n\n❤️ Compatibility: *${pct}%*\n${v}`;
}
async function poem(topic) { return await askGroq(`Write a short beautiful poem about ${topic}. 4-6 lines only.`); }
async function dreamInterpret(dream) { return await askGroq(`Interpret this dream fun and mysterious WhatsApp style: "${dream}". Keep short.`); }
async function debate(topic) { return await askGroq(`Argue strongly and convincingly for: "${topic}". Short WhatsApp style.`); }
async function story(prompt) { return await askGroq(`Write a short engaging story about: ${prompt}. Max 150 words.`); }
async function analyzePersonality(text) { return await askGroq(`Analyze personality of someone who says: "${text}". Fun WhatsApp style.`); }
async function recipe(ingredients) { return await askGroq(`Suggest a simple recipe using: ${ingredients}. Format nicely for WhatsApp.`); }
async function fixGrammar(text) { return await askGroq(`Fix the grammar of this text, return only corrected version: "${text}"`); }
async function summarize(text) { return await askGroq(`Summarize in 3-4 short bullet points for WhatsApp: "${text}"`); }
async function write(type, topic) { return await askGroq(`Write a ${type} about: ${topic}. Max 150 words, WhatsApp friendly.`); }
async function complimentPhoto() { return await askGroq('Give a sweet genuine compliment about someone\'s photo. Short and nice.'); }

module.exports = {
  roast, joke, horoscope, motivation, rizz, ship,
  poem, dreamInterpret, debate, story, analyzePersonality,
  recipe, fixGrammar, summarize, write, complimentPhoto
};