const axios = require('axios');

async function wikipedia(query) {
  const res = await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(query));
  return res.data.extract || 'No result found.';
}

async function weather(city) {
  const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=3`);
  return res.data;
}

async function dictionary(word) {
  const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  const data = res.data[0];
  const meaning = data.meanings[0];
  return `📖 *${data.word}*\n\n*${meaning.partOfSpeech}*\n${meaning.definitions[0].definition}\n\n_Example: ${meaning.definitions[0].example || 'N/A'}_`;
}

async function translate(text, targetLang = 'en') {
  const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`);
  return res.data.responseData.translatedText;
}

async function currency(amount, from, to) {
  const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
  const rate = res.data.rates[to.toUpperCase()];
  if (!rate) return `❌ Unknown currency: ${to}`;
  return `💱 ${amount} ${from.toUpperCase()} = *${(amount * rate).toFixed(2)} ${to.toUpperCase()}*`;
}

async function ipLookup(ip) {
  const res = await axios.get(`http://ip-api.com/json/${ip}`);
  const d = res.data;
  return `🌐 *IP: ${ip}*\n\nCountry: ${d.country}\nCity: ${d.city}\nISP: ${d.isp}\nTimezone: ${d.timezone}`;
}

async function news() {
  const res = await axios.get('https://gnews.io/api/v4/top-headlines?lang=en&max=5&token=free');
  if (!res.data.articles?.length) return '❌ Could not fetch news.';
  return res.data.articles.map((a, i) => `${i+1}. *${a.title}*\n${a.url}`).join('\n\n');
}

module.exports = { wikipedia, weather, dictionary, translate, currency, ipLookup, news };