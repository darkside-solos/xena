const deletedMessages = {};

function saveDeleted(chatId, senderJid, msg) {
  if (!deletedMessages[chatId]) deletedMessages[chatId] = [];
  const body =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    (msg.audioMessage ? '[Audio]' : null) ||
    (msg.stickerMessage ? '[Sticker]' : null) ||
    msg.documentMessage?.fileName || '[Unknown]';
  const type = msg.imageMessage ? 'image' : msg.videoMessage ? 'video' :
    msg.audioMessage ? 'audio' : msg.stickerMessage ? 'sticker' : 'text';
  deletedMessages[chatId].push({
    sender: senderJid.split('@')[0], body, type, timestamp: Date.now()
  });
  if (deletedMessages[chatId].length > 50)
    deletedMessages[chatId] = deletedMessages[chatId].slice(-50);
}

function getDeleted(chatId, limit = 5) {
  return (deletedMessages[chatId] || []).slice(-limit);
}

module.exports = { saveDeleted, getDeleted };