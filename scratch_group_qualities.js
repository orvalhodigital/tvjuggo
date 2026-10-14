const fs = require('fs');
const content = fs.readFileSync('C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u', 'utf8');
const lines = content.split('\n');

function cleanChannelName(rawName) {
    let name = rawName
        .replace(/\[\d+H\]/gi, '')
        .replace(/\b(4K|FHD|HD|SD|H265|HEVC)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    return name;
}

function detectQuality(rawName) {
    const u = rawName.toUpperCase();
    if (u.includes('4K')) return '4K';
    if (u.includes('FHD')) return 'FHD';
    if (u.includes('HD') && !u.includes('FHD')) return 'HD';
    if (u.includes('SD')) return 'SD';
    return 'HD'; // default
}

const channelMap = new Map();

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const url = lines[i+1] ? lines[i+1].trim() : '';
        const ext = lines[i];
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const rawName = nameMatch ? nameMatch[1].trim() : 'Unknown';
        const cleanName = cleanChannelName(rawName);
        const quality = detectQuality(rawName);
        
        if (!channelMap.has(cleanName)) {
            channelMap.set(cleanName, {
                cleanName,
                qualities: {},
                sampleExt: ext
            });
        }
        channelMap.get(cleanName).qualities[quality] = url;
    }
}

console.log('Total unique grouped channels in lista02:', channelMap.size);

let multiQualityCount = 0;
const sampleMulti = [];
for (const [name, data] of channelMap.entries()) {
    const qKeys = Object.keys(data.qualities);
    if (qKeys.length > 1) {
        multiQualityCount++;
        if (sampleMulti.length < 25) {
            sampleMulti.push({ name, qualities: qKeys });
        }
    }
}

console.log('Channels with multiple resolutions in lista02:', multiQualityCount);
console.log('Sample channels with multiple qualities:', sampleMulti);
