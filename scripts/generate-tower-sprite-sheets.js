const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'resources', 'images');
const outputDir = path.join(root, 'resources', 'sprites');
const size = 320;
const sourceSize = 2048;
const sprites = {
  metal: { source: '0ae53cf4663b8107ae8a7c9b3e7cab3f_compress.jpg', arms: [{ box: [405, 1190, 380, 520] }, { box: [1263, 1190, 380, 520] }] },
  fire: { source: '8e22172144b15eb6a4c980c2cf259668_compress.jpg', arms: [{ box: [300, 1350, 435, 490] }, { box: [1313, 1350, 435, 490] }] },
  earth: { source: 'c3ca7698a30472f1273ed06dba370d05_compress.jpg', arms: [{ box: [180, 1100, 510, 550] }, { box: [1358, 1100, 510, 550] }] },
  water: { source: 'c4faebe510acff099972adee3129e744_compress.jpg', arms: [{ box: [190, 1060, 510, 555] }, { box: [1348, 1060, 510, 555] }] },
  wood: { source: 'ece6ef6f59ccc5e989c3497755a6bef6_compress.jpg', arms: [{ box: [255, 1170, 480, 520] }, { box: [1313, 1170, 480, 520] }] }
};
const frames = [
  { left: 0, right: 0, x: 0, y: 0, scale: 1 },
  { left: -18, right: 18, x: 0, y: 0, scale: 1 },
  { left: -46, right: 42, x: 0, y: 0, scale: 1 },
  { left: -78, right: 72, x: 0, y: 0, scale: 1 },
  { left: -30, right: 27, x: 0, y: 0, scale: 1 },
  { left: 0, right: 0, x: 0, y: 0, scale: 1 }
];

function transparency(buffer) {
  for (let index = 0; index < buffer.length; index += 4) {
    const whiteness = Math.min(buffer[index], buffer[index + 1], buffer[index + 2]);
    buffer[index + 3] = whiteness > 238 ? Math.max(0, 255 - (whiteness - 238) * 15) : 255;
  }
  return buffer;
}

function polygonMask(points, blend) {
  const pathData = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ') + 'Z';
  return { input: Buffer.from(`<svg width="${sourceSize}" height="${sourceSize}"><path d="${pathData}" fill="white"/></svg>`), blend };
}

async function makeSource(file) {
  const { data, info } = await sharp(file).resize(sourceSize, sourceSize).raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    rgba[j] = data[i]; rgba[j + 1] = data[i + 1]; rgba[j + 2] = data[i + 2]; rgba[j + 3] = 255;
  }
  return sharp(transparency(rgba), { raw: { width: info.width, height: info.height, channels: 4 } }).png();
}

async function createSheet(key, definition) {
  const source = await (await makeSource(path.join(sourceDir, definition.source))).png().toBuffer();
  const armMasks = definition.arms.map(({ box }) => {
    const [left, top, width, height] = box;
    return { points: [[left, top], [left + width, top], [left + width, top + height], [left, top + height]], box };
  });
  const base = await sharp(source).composite(armMasks.map(mask => polygonMask(mask.points, 'dest-out'))).png().toBuffer();
  const arms = await Promise.all(armMasks.map(async mask => {
    const [left, top, width, height] = mask.box;
    const layer = await sharp(source).extract({ left, top, width, height }).resize(Math.round(width * size / sourceSize), Math.round(height * size / sourceSize)).png().toBuffer({ resolveWithObject: true });
    return { image: layer.data, width: layer.info.width, height: layer.info.height, x: Math.round(left * size / sourceSize), y: Math.round(top * size / sourceSize) };
  }));
  const sheet = [];
  for (const frame of frames) {
    const body = await sharp(base).resize(size, size).png().toBuffer();
    const composites = [{ input: body, left: frame.x, top: frame.y }];
    for (let index = 0; index < arms.length; index += 1) {
      const arm = arms[index];
      const angle = index === 0 ? frame.left : frame.right;
      const rotated = sharp(arm.image).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
      const { data, info } = await rotated.png().toBuffer({ resolveWithObject: true });
      composites.push({ input: data, left: Math.round(arm.x + arm.width / 2 - info.width / 2 + frame.x), top: Math.round(arm.y + arm.height / 2 - info.height / 2 + frame.y) });
    }
    const frameImage = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toBuffer();
    sheet.push({ input: frameImage, left: sheet.length * size, top: 0 });
  }
  await sharp({ create: { width: size * frames.length, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(sheet).png().toFile(path.join(outputDir, `${key}-attack.png`));
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [key, definition] of Object.entries(sprites)) await createSheet(key, definition);
  console.log(`Generated ${Object.keys(sprites).length} tower attack sprite sheets in ${outputDir}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
