const fs = require('fs');
const content = fs.readFileSync('C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u', 'utf8');
const lines = content.split('\n');

const sports = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        const url = lines[i+1] ? lines[i+1].trim() : '';
        const name = (ext.match(/tvg-name="([^"]+)"/) || [])[1] || ext.split(',')[1] || '';
        if (/premiere|sportv|espn|globo|sbt|band|record/i.test(name)) {
            sports.push({ name, url });
        }
    }
}

console.log('Total sports/open matches in lista02:', sports.length);
sports.slice(0, 40).forEach(s => console.log(s.name, '->', s.url));
