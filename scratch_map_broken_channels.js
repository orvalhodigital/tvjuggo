const fs = require('fs');

const m3uPath = 'Canais de TV.m3u8';
const l2Path = 'C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u';

const m3uLines = fs.readFileSync(m3uPath, 'utf8').split('\n');
const l2Lines = fs.readFileSync(l2Path, 'utf8').split('\n');

// Indexar Canais de 64.31.23.207
const brokenChannels = [];
for (let i = 0; i < m3uLines.length; i++) {
  const l = m3uLines[i];
  if (l.startsWith('#EXTINF:')) {
    const url = m3uLines[i+1] ? m3uLines[i+1].trim() : '';
    if (url.includes('64.31.23.207')) {
      const name = (l.match(/tvg-name="([^"]+)"/) || l.match(/,([^\r\n]+)$/) || [])[1];
      const group = (l.match(/group-title="([^"]+)"/) || [])[1];
      brokenChannels.push({ name: name ? name.trim() : '', group: group ? group.trim() : '', url, ext: l });
    }
  }
}

console.log('Total de canais quebrados em 64.31.23.207:', brokenChannels.length);

// Indexar lista02
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

const l2Map = new Map();
let currentExt = null;
for (let i = 0; i < l2Lines.length; i++) {
  const l = l2Lines[i].trim();
  if (l.startsWith('#EXTINF:')) {
    currentExt = l;
  } else if (!l.startsWith('#') && l.startsWith('http') && currentExt) {
    const nameMatch = currentExt.match(/tvg-name="([^"]+)"/) || currentExt.match(/,([^\r\n]+)$/);
    if (nameMatch) {
      const rawName = nameMatch[1].trim();
      const norm = normalize(rawName.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado)\b/gi, ''));
      if (!l2Map.has(norm)) l2Map.set(norm, []);
      l2Map.get(norm).push({ rawName, url: l, ext: currentExt });
    }
    currentExt = null;
  }
}

console.log('Categorias indexadas em lista02:', l2Map.size);

// Fazer match
let matchedCount = 0;
brokenChannels.forEach(b => {
  const norm = normalize(b.name.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado)\b/gi, ''));
  const found = l2Map.get(norm);
  if (found && found.length > 0) {
    matchedCount++;
    console.log(`MATCH: [${b.group}] "${b.name}" => "${found[0].rawName}" (${found[0].url})`);
  } else {
    // Busca parcial
    let partial = null;
    for (const [k, v] of l2Map.entries()) {
      if (k.includes(norm) || norm.includes(k)) {
        if (norm.length > 3 && k.length > 3) {
          partial = v[0];
          break;
        }
      }
    }
    if (partial) {
      matchedCount++;
      console.log(`PARTIAL MATCH: [${b.group}] "${b.name}" => "${partial.rawName}" (${partial.url})`);
    } else {
      console.log(`SEM MATCH: [${b.group}] "${b.name}" (norm: ${norm})`);
    }
  }
});

console.log(`\nTotal casados: ${matchedCount} de ${brokenChannels.length}`);
