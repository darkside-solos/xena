const axios = require('axios');
const QRCode = require('qrcode');

async function generateQR(text) {
  return await QRCode.toBuffer(text, { type: 'png', width: 512 });
}

async function shortenURL(url) {
  const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
  return res.data;
}

function generatePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < length; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

function calculate(expr) {
  try {
    if (!/^[0-9+\-*/().\s%]+$/.test(expr)) return '❌ Invalid expression';
    const result = Function('"use strict"; return (' + expr + ')')();
    return `🧮 *${expr} = ${result}*`;
  } catch (e) { return '❌ Could not calculate.'; }
}

function setReminder(chatId, message, minutes, callback) {
  setTimeout(() => callback(chatId, message), minutes * 60 * 1000);
  return `⏰ Reminder set for *${minutes}* minute(s)!`;
}

module.exports = { generateQR, shortenURL, generatePassword, calculate, setReminder };