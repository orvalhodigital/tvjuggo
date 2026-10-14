const fs = require('fs');

const s = fs.readFileSync('CanaisBR01.m3u8', 'utf8');
const lines = s.split('\n');
const found = {};

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        if (/(universal|eurosport|jovem pan|travel box)/i.test(ext)) {
            const name = ext.split(',')[1] ? ext.split(',')[1].trim() : '';
            const m = ext.match(/tvg-logo="([^"]+)"/);
            if (m && !found[name]) {
                found[name] = m[1];
            }
        }
    }
}

console.log('Found logos in CanaisBR01:');
for (const [k, v] of Object.entries(found).slice(0, 20)) {
    console.log(`- ${k} -> ${v}`);
}
