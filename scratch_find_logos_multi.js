const fs = require('fs');

const files = ['CanaisBR04.m3u8', 'scratch/streams_br.m3u', 'scratch/free_tv_br.m3u'];
const found = {};

files.forEach(f => {
    if (fs.existsSync(f)) {
        const s = fs.readFileSync(f, 'utf8');
        const lines = s.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXTINF:')) {
                const ext = lines[i];
                const name = ext.split(',')[1] ? ext.split(',')[1].trim() : '';
                const m = ext.match(/tvg-logo="([^"]+)"/);
                if (m && m[1].startsWith('http') && !found[name]) {
                    found[name] = m[1];
                }
            }
        }
    }
});

console.log('Total unique channel logos found in lists:', Object.keys(found).length);
const sample = Object.entries(found).slice(0, 20);
sample.forEach(([k, v]) => console.log(`- ${k} -> ${v}`));
