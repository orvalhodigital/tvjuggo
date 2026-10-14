const fs = require('fs');

const m3uPath = 'Canais de TV.m3u8';
const lines = fs.readFileSync(m3uPath, 'utf8').split('\n');

const paidKeywords = [
  'TELECINE', 'HBO', 'SPORTV', 'PREMIERE', 'ESPN', 'COMBATE',
  'DISCOVERY', 'WARNER', 'SONY', 'UNIVERSAL', 'PARAMOUNT', 'AXN',
  'MEGAPIX', 'TNT', 'SPACE', 'BANDSPORTS'
];

const paidInPlaylist = [];

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('#EXTINF:')) {
    const url = lines[i+1] ? lines[i+1].trim() : '';
    const u = l.toUpperCase();
    // Excluir jogos individuais da agenda para focar nos canais lineares
    if (!u.includes('⚽')) {
      for (const kw of paidKeywords) {
        if (u.includes(kw)) {
          const name = (l.match(/tvg-name="([^"]+)"/) || l.match(/,([^\r\n]+)$/) || [])[1];
          const group = (l.match(/group-title="([^"]+)"/) || [])[1];
          paidInPlaylist.push({ name, group, url, line: i + 1 });
          break;
        }
      }
    }
  }
}

console.log('Total de canais pagos lineares em Canais de TV.m3u8:', paidInPlaylist.length);

const hostCounts = {};
paidInPlaylist.forEach(c => {
  try {
    const h = new URL(c.url).host;
    hostCounts[h] = (hostCounts[h] || 0) + 1;
  } catch(e) {
    hostCounts['INVALID'] = (hostCounts['INVALID'] || 0) + 1;
  }
});

console.log('\nDistribuição de Hosts nos Canais Pagos Lineares:');
console.log(hostCounts);

console.log('\nExemplos de Canais Pagos e suas URLs atuais:');
paidInPlaylist.slice(0, 25).forEach(c => {
  console.log(`- [${c.group}] ${c.name} => ${c.url}`);
});
