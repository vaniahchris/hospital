import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = 'public/value-family-hospital-logo.png';
const sizes = [192, 512];

fs.mkdirSync('public/icons', { recursive: true });

for (const size of sizes) {
  const out = path.join('public', 'icons', `icon-${size}.png`);
  await sharp(src)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(out);
  console.log('wrote', out);
}

for (const size of sizes) {
  const out = path.join('public', 'icons', `icon-maskable-${size}.png`);
  const padded = Math.round(size * 0.8);
  const buf = await sharp(src)
    .resize(padded, padded, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: buf, gravity: 'centre' }])
    .png()
    .toFile(out);
  console.log('wrote', out);
}
