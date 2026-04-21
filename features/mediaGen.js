const Replicate = require('replicate');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const replicate = new Replicate({ auth: config.REPLICATE_API_KEY });

async function generateMusic(prompt) {
  const output = await replicate.run(config.MUSIC_MODEL, {
    input: { prompt, model_version: 'stereo-large', output_format: 'mp3', duration: 30 }
  });
  const url = typeof output === 'string' ? output : output[0];
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

async function generateVideo(prompt) {
  const output = await replicate.run(config.VIDEO_MODEL, {
    input: { prompt, num_frames: 24, num_inference_steps: 50, width: 1024, height: 576 }
  });
  const url = typeof output === 'string' ? output : output[0];
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

function downloadFromLink(url) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join('/tmp', `xena_${Date.now()}`);
    const isAudio = url.includes('spotify') || url.includes('soundcloud');
    const cmd = isAudio
      ? `yt-dlp -x --audio-format mp3 -o "${tmpFile}.%(ext)s" "${url}"`
      : `yt-dlp -f "best[filesize<50M]/best" -o "${tmpFile}.%(ext)s" "${url}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject(new Error('Download failed'));
      const files = fs.readdirSync('/tmp').filter(f => f.startsWith(path.basename(tmpFile)));
      if (!files.length) return reject(new Error('No file downloaded'));
      const filePath = path.join('/tmp', files[0]);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      fs.unlinkSync(filePath);
      const type = ['.mp3', '.m4a', '.ogg', '.wav'].includes(ext) ? 'audio' : 'video';
      resolve({ buffer, type });
    });
  });
}

module.exports = { generateMusic, generateVideo, downloadFromLink };