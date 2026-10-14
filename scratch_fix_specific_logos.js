const fs = require('fs');
const readline = require('readline');

async function searchLogos() {
  const sources = ['CanaisBR01.m3u8', 'CanaisBR02.m3u8', 'CanaisBR03.m3u8'];
  for (const src of sources) {
    if (!fs.existsSync(src)) continue;
    const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity });
    for await (const line of rl) {
      if (/Eurosport|ge TV|Globo.*Esporte/i.test(line)) {
        const m = line.match(/tvg-logo="([^"]+)"/);
        if (m) {
          const chName = line.split(',')[1] || '';
          console.log(src, chName.trim(), '->', m[1]);
        }
      }
    }
  }
}
searchLogos();
