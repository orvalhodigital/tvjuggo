const fs = require('fs');
const path = require('path');

// 1. Carregar Canais de TV.m3u8
const canaisTvContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const canaisLines = canaisTvContent.split('\n');

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'canal';
}

const myChannels = [];
let curExt = null;
for (let i = 0; i < canaisLines.length; i++) {
    const line = canaisLines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
        curExt = line;
    } else if (!line.startsWith('#') && curExt) {
        const nameMatch = curExt.match(/tvg-name="([^"]+)"/) || curExt.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Canal';
        const groupMatch = curExt.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1].trim() : 'Outros';
        const logoMatch = curExt.match(/tvg-logo="([^"]+)"/);
        const logo = logoMatch ? logoMatch[1].trim() : '';
        const idMatch = curExt.match(/tvg-id="([^"]+)"/);
        const tvgId = idMatch ? idMatch[1].trim() : '';

        myChannels.push({
            name,
            group,
            logo,
            tvgId,
            url: line,
            slug: slugify(name)
        });
        curExt = null;
    }
}
console.log('Total de canais em Canais de TV.m3u8:', myChannels.length);

// 2. Carregar Lista 02 (com 4K, FHD, HD, SD)
const lista02Path = 'C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u';
const lista02Content = fs.readFileSync(lista02Path, 'utf8');
const l2Lines = lista02Content.split('\n');

function normalizeNameForMatch(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado)\b/gi, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function detectQuality(name) {
    const u = name.toUpperCase();
    if (u.includes('4K') || u.includes('UHD')) return '4K';
    if (u.includes('FHD')) return 'FHD';
    if (u.includes('HD') && !u.includes('FHD')) return 'HD';
    if (u.includes('SD')) return 'SD';
    return 'HD';
}

// Mapear candidatos por nome normalizado
const candidates = new Map();
let cExt = null;
for (let i = 0; i < l2Lines.length; i++) {
    const line = l2Lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
        cExt = line;
    } else if (!line.startsWith('#') && cExt) {
        const nameMatch = cExt.match(/tvg-name="([^"]+)"/) || cExt.match(/,([^\r\n]+)$/);
        const rawName = nameMatch ? nameMatch[1].trim() : '';
        const norm = normalizeNameForMatch(rawName);
        const q = detectQuality(rawName);
        
        if (norm) {
            if (!candidates.has(norm)) candidates.set(norm, {});
            const qObj = candidates.get(norm);
            // Guarda url para essa qualidade se ainda não tiver
            if (!qObj[q]) {
                qObj[q] = line;
            }
        }
        cExt = null;
    }
}
console.log('Total de canais únicos normalizados em lista02:', candidates.size);

// 3. Tentar cruzar
let matchedWithMulti = 0;
let matchedAny = 0;
const sampleMatches = [];

myChannels.forEach(ch => {
    const norm = normalizeNameForMatch(ch.name);
    let match = candidates.get(norm);

    // Tentativas com variações comuns (ex: premiereclubes -> premiereclubes, sportv -> sportv1)
    if (!match) {
        if (norm === 'sportv') match = candidates.get('sportv1');
        else if (norm === 'sportv2') match = candidates.get('sportv2');
        else if (norm === 'sportv3') match = candidates.get('sportv3');
        else if (norm.startsWith('espn')) match = candidates.get(norm);
    }

    if (match) {
        matchedAny++;
        const qCount = Object.keys(match).length;
        if (qCount > 1) {
            matchedWithMulti++;
            if (sampleMatches.length < 20) {
                sampleMatches.push({ name: ch.name, norm, qualities: Object.keys(match) });
            }
        }
    }
});

console.log(`Canais combinados: ${matchedAny} de ${myChannels.length}`);
console.log(`Canais com múltiplas qualidades (4K/FHD/HD/SD): ${matchedWithMulti}`);
console.log('Exemplos de canais combinados com múltiplas resoluções:', sampleMatches);
