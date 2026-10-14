const fs = require('fs');
const path = require('path');

const m3uPath = path.join(__dirname, 'Canais de TV.m3u8');
const lines = fs.readFileSync(m3uPath, 'utf8').split('\n');

const manualDirectReplacements = {
  'DAZN 1': 'http://topdnstop.lat:80/jajaita/123456/234497.m3u8',
  'DAZN 2': 'http://topdnstop.lat:80/jajaita/123456/234499.m3u8',
  'DAZN 3': 'http://topdnstop.lat:80/jajaita/123456/234501.m3u8',
  'DAZN 4': 'http://topdnstop.lat:80/jajaita/123456/234503.m3u8',
  'Canal Goat 1': 'http://topdnstop.lat:80/jajaita/123456/1774549.m3u8',
  'Canal Goat 2': 'http://topdnstop.lat:80/jajaita/123456/1774553.m3u8',
  'Canal Goat 3': 'http://topdnstop.lat:80/jajaita/123456/1774557.m3u8',
  'Apple TV MLS 1': 'http://topdnstop.lat:80/jajaita/123456/1605475.m3u8',
  'Apple TV MLS 2': 'http://topdnstop.lat:80/jajaita/123456/1605474.m3u8',
  'Paramount+ 1': 'http://topdnstop.lat:80/jajaita/123456/233137.m3u8',
  'Paramount+ 2': 'http://topdnstop.lat:80/jajaita/123456/231169.m3u8',
  'Paramount+ 3': 'http://topdnstop.lat:80/jajaita/123456/1770966.m3u8',
  'Paramount+ 4': 'http://topdnstop.lat:80/jajaita/123456/1770967.m3u8',
  'Paramount+ 5': 'http://topdnstop.lat:80/jajaita/123456/233137.m3u8',
  'Paramount+ 6': 'http://topdnstop.lat:80/jajaita/123456/231169.m3u8',
  'TVE Bahia Esportes': 'http://topdnstop.lat:80/jajaita/123456/1773693.m3u8',
  'Xsport': 'http://topdnstop.lat:80/jajaita/123456/828933.m3u8',
  'Canal Rural': 'http://topdnstop.lat:80/jajaita/123456/1770178.m3u8',
  'Futura': 'http://topdnstop.lat:80/jajaita/123456/1773696.m3u8',
  'Rede CNT': 'http://topdnstop.lat:80/jajaita/123456/1601663.m3u8',
  'Agro+': 'http://topdnstop.lat:80/jajaita/123456/674103.m3u8',
  'Travel Box': 'http://topdnstop.lat:80/jajaita/123456/676765.m3u8',
  'GE TV': 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/9111.m3u8'
};

const newLines = [];
let removedDeadCount = 0;
let replacedCount = 0;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!l) continue;

  if (l.startsWith('#EXTM3U')) {
    newLines.push(l);
    continue;
  }

  if (l.startsWith('#EXTINF:')) {
    const url = lines[i+1] ? lines[i+1].trim() : '';
    const nameMatch = l.match(/tvg-name="([^"]+)"/) || l.match(/,([^\r\n]+)$/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    if (manualDirectReplacements[name]) {
      newLines.push(l);
      newLines.push(manualDirectReplacements[name]);
      replacedCount++;
      i++;
      continue;
    }

    // Se ainda for 64.31.23.207 e não temos fonte (ex: Cine SKY morto ou canal fantasma)
    if (url.includes('64.31.23.207')) {
      console.log(`Removendo canal morto sem fonte: ${name} (${url})`);
      removedDeadCount++;
      i++; // pula a url também
      continue;
    }

    newLines.push(l);
    newLines.push(url);
    i++;
  }
}

fs.writeFileSync(m3uPath, newLines.join('\n') + '\n', 'utf8');
console.log(`\nFinalizado: ${replacedCount} canais substituídos por streams ativos e ${removedDeadCount} canais fantasmas removidos.`);
