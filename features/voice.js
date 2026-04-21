const axios = require('axios');
const config = require('../config');

async function textToVoice(text) {
  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}`,
    {
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.85,
        style: 0.5,
        use_speaker_boost: true
      }
    },
    {
      headers: {
        'xi-api-key': config.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer'
    }
  );
  return Buffer.from(response.data);
}

module.exports = { textToVoice };