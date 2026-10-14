const fs = require('fs');

const content = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = content.split('\n');

const missingTvgId = [];

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        const idMatch = ext.match(/tvg-id="([^"]*)"/);
        const tvgId = idMatch ? idMatch[1].trim() : '';
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        const groupMatch = ext.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1].trim() : '';

        if (!tvgId) {
            missingTvgId.push({ index: i, name, group, ext });
        }
    }
}

console.log('Total de canais sem tvg-id:', missingTvgId.length);
missingTvgId.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.group}] "${c.name}"`);
});
