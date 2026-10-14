const fs = require('fs');

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'canal';
}

const canaisContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = canaisContent.split('\n');
const channelQualities = JSON.parse(fs.readFileSync('channel_qualities.json', 'utf8'));

const channels = [];
const seenSlugs = new Map();
let currentExt = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
        currentExt = line;
    } else if (line.startsWith('http') && currentExt) {
        const nameMatch = currentExt.match(/,([^\r\n]+)$/);
        const channelName = nameMatch ? nameMatch[1].trim() : 'Canal Sem Nome';
        const groupMatch = currentExt.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1].trim() : 'Outros';
        const logoMatch = currentExt.match(/tvg-logo="([^"]+)"/);
        const logo = logoMatch ? logoMatch[1].trim() : 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';
        const idMatch = currentExt.match(/tvg-id="([^"]+)"/);
        const tvgId = idMatch ? idMatch[1].trim() : '';

        const slug = slugify(channelName);
        let uniqueSlug = slug;
        let counter = 2;
        while (seenSlugs.has(uniqueSlug) && seenSlugs.get(uniqueSlug) !== channelName) {
            uniqueSlug = `${slug}-${counter++}`;
        }
        seenSlugs.set(uniqueSlug, channelName);

        const qualitiesMap = channelQualities[uniqueSlug] || null;
        const availableQualities = qualitiesMap ? Object.keys(qualitiesMap) : ['HD'];

        let highestResolution = 'HD';
        if (availableQualities.includes('4K')) highestResolution = '4K';
        else if (availableQualities.includes('FHD')) highestResolution = 'FHD';
        else if (availableQualities.includes('HD')) highestResolution = 'HD';
        else if (availableQualities.includes('SD')) highestResolution = 'SD';
        else if (channelName.includes('@SD') || tvgId.includes('@SD')) highestResolution = 'SD';

        channels.push({
            id: uniqueSlug,
            name: channelName,
            group: group,
            logo: logo,
            tvgId: tvgId,
            highestResolution: highestResolution,
            qualities: qualitiesMap || { HD: line },
            streamUrl: line
        });

        currentExt = null;
    }
}

console.log('Channels indexed:', channels.length);
const resCounts = { '4K': 0, 'FHD': 0, 'HD': 0, 'SD': 0 };
channels.forEach(c => {
    resCounts[c.highestResolution] = (resCounts[c.highestResolution] || 0) + 1;
});
console.log('Highest Resolution breakdown across all 312 channels:', resCounts);

fs.writeFileSync('channels.json', JSON.stringify(channels, null, 2), 'utf8');
console.log('channels.json generated successfully!');
