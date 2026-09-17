const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts', 'steam-assets');
const specifications = [
  { name: 'header', width: 920, height: 430, art: { width: 896, left: 80, top: -70 }, logo: { left: 54, top: 100, width: 410, size: 105, subtitle: 36, gap: 16 }, emblem: true },
  { name: 'small', width: 462, height: 174, art: { width: 485, left: 132, top: -71 }, logo: { left: 19, top: 7, width: 326, size: 99, subtitle: 29, gap: 1 }, emblem: false },
  { name: 'main', width: 1232, height: 706, art: { width: 1280, left: 34, top: -41 }, logo: { left: 68, top: 207, width: 494, size: 135, subtitle: 46, gap: 26 }, emblem: true },
  { name: 'vertical', width: 748, height: 896, art: { width: 1376, left: -542, top: 108 }, logo: { left: 64, top: 45, width: 620, size: 140, subtitle: 49, gap: 12 }, emblem: false }
];

function markup(specification, art, font) {
  const { name, width, height, logo } = specification;
  const image = specification.art;
  const vertical = name === 'vertical', small = name === 'small';
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
  @font-face{font-family:OrangewoodTitle;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400;font-display:block}
  *{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:#0b242b}
  .capsule{position:relative;width:100%;height:100%;isolation:isolate;overflow:hidden;background:linear-gradient(#0b262c,#173b33)}
  .art{position:absolute;width:${image.width}px;height:${image.width * .625}px;max-width:none;left:${image.left}px;top:${image.top}px;filter:saturate(1.08) brightness(1.07)}
  .shade{position:absolute;inset:0;background:${vertical ? 'linear-gradient(180deg,#0b252be6 0%,#0b252b9e 24%,transparent 41%,transparent 76%,#09242099 100%)' : small ? 'linear-gradient(90deg,#0c2729f7 0%,#0c2729df 55%,#0c27292e 86%,#0a262929 100%)' : 'linear-gradient(90deg,#0b242cd9 0%,#0b252bba 29%,#0d292824 58%,transparent 80%),linear-gradient(0deg,#08252042,transparent 30%)'}}
  .vignette{position:absolute;inset:0;box-shadow:inset 0 0 ${small ? 35 : 110}px #061d2444;pointer-events:none}
  .logo{position:absolute;left:${logo.left}px;top:${logo.top}px;width:${logo.width}px;text-align:center;color:#fff0c8;font-family:OrangewoodTitle,sans-serif}
  h1{font-size:${logo.size}px;line-height:1.14;letter-spacing:${small ? -3 : 3}px;font-weight:900;margin:0;white-space:nowrap;text-shadow:0 3px 0 #806844,0 7px 22px #041c26a6;transform:rotate(-2deg)}
  .subtitle{display:flex;align-items:center;justify-content:center;gap:${small ? 8 : 18}px;margin-top:${logo.gap}px;color:#eabd74;font-size:${logo.subtitle}px;font-weight:700;line-height:1.3;letter-spacing:${small ? 5 : 9}px;text-indent:${small ? 5 : 9}px;text-shadow:0 2px 8px #041c26;white-space:nowrap}
  .subtitle:before,.subtitle:after{content:'';width:${small ? 16 : 34}px;height:1px;background:linear-gradient(90deg,transparent,#d8b77e)}.subtitle:after{transform:rotate(180deg)}
  .emblem{position:absolute;left:calc(50% - 22px);top:${name === 'header' ? -62 : -83}px;width:44px;height:56px;opacity:.93;filter:drop-shadow(0 0 10px #c0d29635)}
  .frame{position:absolute;inset:${small ? 5 : 16}px;border:1px solid #e4ca8b24;pointer-events:none;clip-path:polygon(0 0,16% 0,16% 1%,84% 1%,84% 0,100% 0,100% 17%,99.8% 17%,99.8% 83%,100% 83%,100% 100%,84% 100%,84% 99.8%,16% 99.8%,16% 100%,0 100%,0 83%,.2% 83%,.2% 17%,0 17%)}
  </style><div class="capsule"><img class="art" alt="" src="data:image/svg+xml;base64,${art}"><div class="shade"></div><div class="vignette"></div><div class="logo">
  ${specification.emblem ? '<svg class="emblem" viewBox="0 0 44 56" fill="none" aria-hidden="true"><path d="M22 54C9 43 9 24 22 12C35 24 35 43 22 54Z" stroke="#d6c88c" stroke-width="1.5"/><path d="M22 46V20M22 31L15 26M22 38L29 30" stroke="#d6c88c"/><path d="M23 14C24 4 33 1 41 2C36 11 30 14 23 14Z" fill="#c5cf94"/><circle cx="22" cy="54" r="1.5" fill="#f6d994"/></svg>' : ''}
  <h1>甜橙谷</h1><div class="subtitle">黑潮纪事</div></div><div class="frame"></div></div></html>`;
}

(async () => {
  const [scene, font] = await Promise.all([fs.readFile(path.join(root, 'resources/scenes/frontier.svg')), fs.readFile(path.join(root, 'resources/vendor/noto-sans-sc.woff2'))]);
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
  const records = [];
  try {
    for (const specification of specifications) {
      const page = await browser.newPage({ viewport: { width: specification.width, height: specification.height }, deviceScaleFactor: 1 });
      // All input is embedded from the repository; no network or remote fonts.
      await page.route('http://**/*', route => route.abort());
      await page.route('https://**/*', route => route.abort());
      await page.setContent(markup(specification, scene.toString('base64'), font.toString('base64')));
      await page.evaluate(async () => {
        await document.fonts.load('900 100px OrangewoodTitle', '甜橙谷黑潮纪事');
        await document.fonts.ready;
        await Promise.all([...document.images].map(image => image.decode()));
      });
      const valid = await page.evaluate(() => {
        const heading = document.querySelector('h1').getBoundingClientRect();
        const subtitle = document.querySelector('.subtitle').getBoundingClientRect();
        return document.fonts.check('900 100px OrangewoodTitle', '甜橙谷黑潮纪事') && heading.left >= 0 && heading.right <= innerWidth && heading.top >= 0 && subtitle.bottom <= innerHeight;
      });
      if (!valid) throw new Error(`${specification.name}: title layout or local font validation failed`);
      const filename = `${specification.name}-capsule-${specification.width}x${specification.height}.png`;
      const bytes = await page.screenshot({ path: path.join(output, filename), type: 'png', animations: 'disabled' });
      if (bytes.readUInt32BE(16) !== specification.width || bytes.readUInt32BE(20) !== specification.height) throw new Error(`${filename}: wrong PNG dimensions`);
      records.push({ ...specification, filename, sha256: createHash('sha256').update(bytes).digest('hex') });
      await page.close();
    }
  } finally { await browser.close(); }
  const rows = records.map(record => `| ${record.name} | ${record.width} × ${record.height} | [${record.filename}](${record.filename}) |`).join('\n');
  await fs.writeFile(path.join(output, 'README.md'), `# Steam 商店胶囊候选\n\n游戏标题：甜橙谷 · 黑潮纪事。以下为四种本地候选图，尚未上传或通过 Steam 审核。Steam 发行账户尚未建立。\n\n| 用途 | 像素尺寸 | PNG 文件 |\n| --- | --- | --- |\n${rows}\n\n仅使用仓库原创场景 \`resources/scenes/frontier.svg\` 与本地 Noto Sans SC 字体（许可：\`resources/vendor/noto-LICENSE\`）；没有下载图片，也未使用五张角色图。画面文字仅包含游戏标题。\n\n尺寸依据 [Steamworks 标准商店图形资产文档](https://partner.steamgames.com/doc/store/assets/standard)，2026-09-17 核对。小胶囊使用独立的大字构图；上传前仍须在实际商店预览检查缩图可读性。\n\n重建：Node.js 22.12+，设置 \`PLAYWRIGHT_MODULE\` 与 \`CHROMIUM_EXECUTABLE\`（或 \`PLAYWRIGHT_BROWSERS_PATH\`），运行 \`node scripts/build-store-assets.js\`。字体和 SVG 从磁盘嵌入后以 Chromium 栅格化，不依赖在线字体。\n\n源图 SHA-256：\`${createHash('sha256').update(scene).digest('hex')}\`。\n`);
  console.log(JSON.stringify(records.map(({ name, width, height, filename, sha256 }) => ({ name, width, height, filename, sha256 })), null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
