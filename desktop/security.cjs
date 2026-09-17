const path = require('node:path');

const ORIGIN = 'orangewood://game';
const START_URL = `${ORIGIN}/index.html`;
const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";

function isGamePage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'orangewood:' && url.hostname === 'game' && !url.port && !url.username && !url.password && url.pathname === '/index.html';
  } catch { return false; }
}

function resolveAsset(root, value) {
  const url = new URL(value);
  if (url.protocol !== 'orangewood:' || url.hostname !== 'game' || url.port || url.username || url.password) throw new Error('Unsupported asset origin');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid asset path');
  const candidate = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const relative = path.relative(path.resolve(root), candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Asset escapes application');
  return candidate;
}

module.exports = { ORIGIN, START_URL, CONTENT_SECURITY_POLICY, isGamePage, resolveAsset };
