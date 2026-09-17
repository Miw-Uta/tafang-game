const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const scripts = ['content-system.js','game-content.js','campaign-system.js','tactics-system.js','checkpoint-system.js','story-content.js','story-system.js','chronicles-system.js','world-renderer.js','guardian-renderer.js','boss-system.js','enemy-system.js','evolution-system.js','tower-system.js','synergy-system.js','game.js','campaign-save.js','campaign-ui.js','battle-camera.js','tactics-ui.js','boss-ui.js','premiere.js','experience.js'];
const styles = ['style.css','evolution.css','controls.css','app-layout.css','battle-redesign.css','launch-polish.css','campaign-ui.css','battle-camera.css','premiere.css','tactics.css','experience.css'];

(async () => {
  await fs.mkdir(output, { recursive: true });
  const hashes = {};
  for (const file of [...scripts, ...styles]) {
    const content = await fs.readFile(path.join(root, file));
    hashes[file] = createHash('sha256').update(content).digest('hex').slice(0,12);
    await fs.writeFile(path.join(output, file), content);
  }
  await fs.cp(path.join(root,'resources'), path.join(output,'resources'), { recursive:true });
  await fs.copyFile(path.join(root,'node_modules/@tweenjs/tween.js/dist/tween.umd.js'), path.join(output,'resources/vendor/tween.umd.js'));
  await fs.copyFile(path.join(root,'node_modules/@tweenjs/tween.js/LICENSE'), path.join(output,'resources/vendor/tween-LICENSE'));
  let html = await fs.readFile(path.join(root,'index.html'), 'utf8');
  html = html.replace('node_modules/@tweenjs/tween.js/dist/tween.umd.js?v=25.0.0','resources/vendor/tween.umd.js');
  for (const [file, hash] of Object.entries(hashes)) {
    html = html.replace(new RegExp(`(["'])${file.replaceAll('.','\\.')}(?:\\?[^"']*)?(["'])`, 'g'), `$1${file}?v=${hash}$2`);
  }
  await fs.writeFile(path.join(output,'index.html'), html);
  await fs.writeFile(path.join(output,'_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/index.html\n  Cache-Control: no-cache\n');
  await fs.writeFile(path.join(output,'release.json'), JSON.stringify({ game:'orangewood', levels:20, generatedAt:new Date().toISOString(), hashes },null,2));
  console.log(`Built ${scripts.length} scripts and ${styles.length} styles into ${output}. Runtime assets are self-contained.`);
})().catch(error => { console.error(error); process.exitCode=1; });
