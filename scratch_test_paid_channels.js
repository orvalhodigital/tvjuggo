const http = require('http');
const fs = require('fs');

const l2Path = 'C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u';
const lines = fs.readFileSync(l2Path, 'utf8').split('\n');

const testChannels = [
  'TELECINE PREMIUM',
  'TELECINE ACTION',
  'HBO',
  'HBO 2',
  'SPORTV',
  'SPORTV 2',
  'SPORTV 3',
  'PREMIERE CLUBES',
  'PREMIERE 2',
  'PREMIERE 3',
  'ESPN',
  'ESPN 2',
  'ESPN 3',
  'DISCOVERY CHANNEL',
  'WARNER'
];

const found = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('#EXTINF:')) {
    const nextUrl = lines[i+1] ? lines[i+1].trim() : '';
    testChannels.forEach(tc => {
      const u = l.toUpperCase();
      if (u.includes(tc + ' HD') || u.includes(tc + ' FHD')) {
        found.push({ name: tc, ext: l, url: nextUrl });
      }
    });
  }
}

console.log('Encontrados em oneplay_lista02:', found.length);

function check(url) {
  return new Promise(resolve => {
    try {
      const u = new URL(url);
      const req = http.get(url, { headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' } }, res => {
        resolve({ status: res.statusCode, location: res.headers.location });
      });
      req.on('error', e => resolve({ status: 'ERR', error: e.message }));
      req.setTimeout(4000, () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
    } catch(e) { resolve({ status: 'EXC' }); }
  });
}

(async () => {
  const tested = new Set();
  for (const f of found) {
    if (tested.has(f.name)) continue;
    tested.add(f.name);
    const res = await check(f.url);
    console.log(`[${res.status}] ${f.name} => ${f.url}`);
    if (res.location) {
      // Test the redirected URL as well
      const red = await check(res.location);
      console.log(`   -> REDIRECT: [${red.status}] ${res.location.slice(0, 80)}...`);
    }
  }
})();
