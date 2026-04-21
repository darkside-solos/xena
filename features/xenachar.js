const Replicate = require('replicate');
const axios = require('axios');
const config = require('../config');
const replicate = new Replicate({ auth: config.REPLICATE_API_KEY });

const PROMPTS = [
  'anime sexy girl, big tits, boobs and ass, short blue hair, red hairband bow, red crop top, blue pleated skirt, red thigh highs, choker, cute face, blushing, sitting pose, white background, high quality anime art, detailed',
  'anime sexy girl, big tits, boobs and ass, short dark blue hair, hair clip, red sweater crop top, blue mini skirt, red stockings, choker necklace, shy expression, looking up, anime style, detailed',
  'anime sexy girl, big tits, boobs and ass, blue hair, red ribbon, casual red outfit, blue skirt, thigh highs, standing pose, cute smile, anime waifu, high quality, detailed',
  'anime sexy girl, big tits and boobs, short blue hair with red bow, red long sleeve top, blue pleated skirt, red knee socks, choker, leaning on wall, soft expression, anime art style',
  'anime sexy girl, big tits, boobs and ass, dark blue short hair, red hairband, crop top red shirt, blue button skirt, red striped thigh highs, cute blush, sitting on chair, anime illustration',
];

async function generateXenachar() {
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  const output = await replicate.run(config.IMAGE_MODEL, {
    input: {
      prompt,
      negative_prompt: 'photo, 3d, ugly, bad anatomy, blurry, low quality',
      width: 768, height: 1024, num_outputs: 1,
      guidance_scale: 7.5, num_inference_steps: 40,
    }
  });
  const url = Array.isArray(output) ? output[0] : output;
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

module.exports = { generateXenachar };