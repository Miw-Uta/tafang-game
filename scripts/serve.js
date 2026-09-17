const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const root = path.resolve(__dirname,'..',args.includes('--dist')?'dist':'.');
const port = Number(args.find(arg=>/^\d+$/.test(arg)) || 4175);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if (!file.startsWith(root+path.sep) || pathname.split('/').some(part=>part.startsWith('.'))) { res.writeHead(403).end(); return; }
  fs.stat(file,(error,stat)=>{
    if(error || !stat.isFile()) {res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return;}
    fs.createReadStream(file).pipe(res);
  });
}).listen(port,'0.0.0.0',()=>console.log(`Orangewood ready at http://localhost:${port} (${root})`));
