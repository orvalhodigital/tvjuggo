const fs = require('fs');
const http = require('http');
const https = require('https');

const lines = fs.readFileSync('Canais de TV.m3u8', 'utf8').split('\n');

const channels = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('#EXTINF:')) {
    const url = lines[i+1] ? lines[i+1].trim() : '';
    const nameMatch = lines[i].match(/tvg-name="([^"]+)"/) || lines[i].match(/,([^\r\n]+)$/);
    const groupMatch = lines[i].match(/group-title="([^"]+)"/);
    channels.push({
      name: nameMatch ? nameMatch[1].trim() : 'Canal',
      group: groupMatch ? groupMatch[1].trim() : 'Geral',
      url
    });
  }
}

console.log('Total de canais na playlist:', channels.length);

function testChannel(c) {
  return new Promise(resolve => {
    try {
      const u = new URL(c.url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: { 'User-Agent': 'VLC/3.0.18' }
      }, res => {
        resolve({ ...c, status: res.statusCode });
      });
      req.on('error', e => resolve({ ...c, status: 'ERR: ' + e.message }));
      req.setTimeout(4000, () => {
        req.destroy();
        resolve({ ...c, status: 'TIMEOUT' });
      });
    } catch(e) {
      resolve({ ...c, status: 'EXC: ' + e.message });
    }
  });
}

(async () => {
  console.log('Testando canais de grupos principais...');
  // Pegar canais representativos de cada categoria
  const groups = ['⚽ Jogos do Dia', 'Canais Abertos', 'Premiere', 'Sport TV', 'ESPN', 'Telecine', 'HBO & Max', 'Filmes & Séries', 'Notícias', 'Documentários'];
  
  for (const g of groups) {
    const sample = channels.filter(c => c.group === g).slice(0, 3);
    for (const c of sample) {
      const r = await testChannel(c);
      console.log(`[${r.status}] [${r.group}] ${r.name}`);
    }
  }
})();
