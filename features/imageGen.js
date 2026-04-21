const Replicate = require('replicate');
const axios = require('axios');
const config = require('../config');
const replicate = new Replicate({ auth: config.REPLICATE_API_KEY });

async function generateImage(prompt) {
  const output = await replicate.run(config.IMAGE_MODEL, {
    input: {
      prompt,
      width: 1024,
      height: 1024,
      num_outputs: 1,
      apply_watermark: false,
    }
  });
  const url = Array.isArray(output) ? output[0] : output;
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

module.exports = { generateImage };