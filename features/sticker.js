const { exec } = require('child_process');
const fs = require('fs');

async function imageToSticker(imageBuffer) {
  const tmpIn = `/tmp/xena_in_${Date.now()}.jpg`;
  const tmpOut = `/tmp/xena_out_${Date.now()}.webp`;
  fs.writeFileSync(tmpIn, imageBuffer);
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -i ${tmpIn} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0" ${tmpOut}`, (err) => {
      fs.unlinkSync(tmpIn);
      if (err) return reject(new Error('Sticker failed'));
      const buf = fs.readFileSync(tmpOut);
      fs.unlinkSync(tmpOut);
      resolve(buf);
    });
  });
}

module.exports = { imageToSticker };