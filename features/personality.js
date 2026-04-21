const fs = require('fs');
const DB_PATH = './database/users.json';

function loadDB() {
  if (!fs.existsSync('./database')) fs.mkdirSync('./database');
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}');
  return JSON.parse(fs.readFileSync(DB_PATH));
}
function saveDB(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
function getUser(jid) {
  const db = loadDB();
  const id = jid.split('@')[0];
  if (!db[id]) db[id] = { name: null, birthday: null, relationship: false, interactions: 0 };
  return { db, id, user: db[id] };
}

function setName(jid, name) {
  const { db, id, user } = getUser(jid);
  user.name = name; db[id] = user; saveDB(db);
}
function getName(jid) { return getUser(jid).user.name; }

function setBirthday(jid, date) {
  const { db, id, user } = getUser(jid);
  user.birthday = date; db[id] = user; saveDB(db);
}
function checkBirthdays() {
  const db = loadDB();
  const today = new Date();
  const mmdd = `${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const birthdays = [];
  for (const [id, user] of Object.entries(db)) {
    if (user.birthday === mmdd) birthdays.push({ jid: id+'@s.whatsapp.net', name: user.name || id });
  }
  return birthdays;
}

function setRelationship(jid, val) {
  const { db, id, user } = getUser(jid);
  user.relationship = val; db[id] = user; saveDB(db);
}
function isRelationship(jid) { return getUser(jid).user.relationship === true; }

function addInteraction(jid) {
  const { db, id, user } = getUser(jid);
  user.interactions = (user.interactions || 0) + 1; db[id] = user; saveDB(db);
}
function getInteractions(jid) { return getUser(jid).user.interactions || 0; }

function getCurrentMood() {
  const h = new Date().getHours();
  if (h < 6) return 'mysterious';
  if (h < 10) return 'chill';
  if (h < 14) return 'happy';
  if (h < 18) return 'sassy';
  if (h < 22) return 'hyper';
  return 'unbothered';
}
function getMoodEmoji(mood) {
  return { happy:'😊', sassy:'😏', chill:'😌', mysterious:'🌙', hyper:'⚡', unbothered:'💅' }[mood] || '💜';
}

module.exports = {
  setName, getName, setBirthday, checkBirthdays,
  setRelationship, isRelationship,
  addInteraction, getInteractions,
  getCurrentMood, getMoodEmoji,
};