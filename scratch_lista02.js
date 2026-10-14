const fs = require('fs');
const content = fs.readFileSync('C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u', 'utf8');
const lines = content.split('\n');
console.log('Total lines in lista02:', lines.length);

const channels = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const url = lines[i+1] ? lines[i+1].trim() : '';
        channels.push({ ext: lines[i], url });
    }
}
console.log('Total channels in lista02:', channels.length);

const qualities = { '4K': 0, 'FHD': 0, 'HD': 0, 'SD': 0, 'other': 0 };
channels.forEach(c => {
    const n = c.ext.toUpperCase();
    if (n.includes('4K')) qualities['4K']++;
    else if (n.includes('FHD')) qualities['FHD']++;
    else if (n.includes('HD')) qualities['HD']++;
    else if (n.includes('SD')) qualities['SD']++;
    else qualities['other']++;
});
console.log('Qualities breakdown in lista02:', qualities);

// Print some channels
for (let i = 0; i < 20; i++) {
    const m = channels[i].ext.match(/tvg-name="([^"]+)"/) || channels[i].ext.match(/,([^\r\n]+)$/);
    console.log(m ? m[1] : 'Unknown', '->', channels[i].url);
}
