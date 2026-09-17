const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const asar=require('@electron/asar');
const root=path.resolve(__dirname,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const version=require('../package.json').version;
const results=[];
for(const platform of ['win','linux']){
  const report=JSON.parse(fs.readFileSync(path.join(root,'release',`Orangewood-${version}-${platform}-x64.build.json`)));
  const archive=path.join(root,'release',platform==='win'?'win-unpacked':'linux-unpacked','resources','app.asar');
  const files=asar.listPackage(archive);
  assert.ok(!files.some(file=>/^\/node_modules\/|\/tests\/|\/\.git\//.test(file)));
  const metadata=JSON.parse(asar.extractFile(archive,'package.json'));
  assert.equal(metadata.version,version);
  for(const [file,hash]of Object.entries(report.content.hashes)){
    const bytes=asar.extractFile(archive,'dist/'+file);
    assert.equal(digest(bytes).slice(0,12),hash,`${platform} packaged ${file}`);
    assert.equal(digest(fs.readFileSync(path.join(root,file))).slice(0,12),hash,`${platform} latest ${file}`);
  }
  assert.equal(asar.extractFile(archive,'dist/index.html').toString(),fs.readFileSync(path.join(root,'dist/index.html'),'utf8'));
  for(const file of ['desktop/main.cjs','desktop/preload.cjs','desktop/security.cjs','desktop/portable-save.cjs'])assert.equal(digest(asar.extractFile(archive,file)),digest(fs.readFileSync(path.join(root,file))));
  assert.equal(digest(fs.readFileSync(path.join(root,'release',report.archive.file))),report.archive.sha256);
  results.push({platform,version,asarEntries:files.length,runtimeDependencyFiles:0,sourceFilesVerified:Object.keys(report.content.hashes).length,archive:report.archive,nativeBuild:report.nativeBuild});
}
fs.writeFileSync(path.join(root,'artifacts/final-qa/package-content.json'),JSON.stringify({generatedAt:new Date().toISOString(),results},null,2)+'\n');
console.log('Both desktop archives match all current runtime sources, host code and archive SHA-256; no development dependencies.');
