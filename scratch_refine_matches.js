const fs = require('fs');

const canaisTvContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const canaisLines = canaisTvContent.split('\n');

const lista02Path = 'C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u';
const lista02Content = fs.readFileSync(lista02Path, 'utf8');
const l2Lines = lista02Content.split('\n');

function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function detectQuality(name) {
    const u = name.toUpperCase();
    if (u.includes('4K') || u.includes('UHD')) return '4K';
    if (u.includes('FHD')) return 'FHD';
    if (u.includes('HD') && !u.includes('FHD')) return 'HD';
    if (u.includes('SD')) return 'SD';
    return 'HD';
}

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
        const norm = normalize(rawName.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado|1080p|720p)\b/gi, ''));
        const q = detectQuality(rawName);
        
        if (norm) {
            if (!candidates.has(norm)) candidates.set(norm, {});
            const qObj = candidates.get(norm);
            if (!qObj[q]) qObj[q] = line;
        }
        cExt = null;
    }
}

// Aliases for matching
const aliases = {
    'globosp': ['globosp', 'globo', 'redeglobo'],
    'globorj': ['globorj', 'globo'],
    'globo': ['globosp', 'globo', 'redeglobo'],
    'sbt': ['sbtsp', 'sbt'],
    'sbtsp': ['sbtsp', 'sbt'],
    'band': ['bandsp', 'band', 'bandeirantes'],
    'bandsp': ['bandsp', 'band', 'bandeirantes'],
    'record': ['recordsp', 'record', 'rederecord'],
    'recordsp': ['recordsp', 'record', 'rederecord'],
    'redetv': ['redetv', 'redetvsp'],
    'sportv': ['sportv1', 'sportv'],
    'sportv1': ['sportv1', 'sportv'],
    'sportv2': ['sportv2'],
    'sportv3': ['sportv3'],
    'sportv4': ['sportv4'],
    'espn': ['espn', 'espn1', 'espnbrasil'],
    'premiereclubes': ['premiereclubes', 'premierefc'],
    'tnt': ['tnt', 'tntbrasil'],
    'telecinepremium': ['telecinepremium'],
    'telecineaction': ['telecineaction'],
    'telecinepipoca': ['telecinepipoca'],
    'telecinecult': ['telecinecult'],
    'telecinetouch': ['telecinetouch'],
    'telecinefun': ['telecinefun'],
    'hbo': ['hbo'],
    'hbo2': ['hbo2'],
    'hboplus': ['hboplus'],
    'hbofamily': ['hbofamily'],
    'hbosignature': ['hbosignature']
};

let matchedWithMulti = 0;
const results = [];

let myExt = null;
for (let i = 0; i < canaisLines.length; i++) {
    const line = canaisLines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
        myExt = line;
    } else if (!line.startsWith('#') && myExt) {
        const nameMatch = myExt.match(/tvg-name="([^"]+)"/) || myExt.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Canal';
        const norm = normalize(name.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado|1080p|720p)\b/gi, ''));
        
        let foundQualities = null;
        if (candidates.has(norm)) {
            foundQualities = candidates.get(norm);
        } else if (aliases[norm]) {
            for (const alias of aliases[norm]) {
                if (candidates.has(alias)) {
                    foundQualities = candidates.get(alias);
                    break;
                }
            }
        }

        if (foundQualities && Object.keys(foundQualities).length > 1) {
            matchedWithMulti++;
            results.push({ name, norm, qualities: Object.keys(foundQualities) });
        }
        myExt = null;
    }
}

console.log(`Canais mapeados com múltiplas resoluções: ${matchedWithMulti}`);
console.log('Primeiros 30 canais mapeados:');
results.slice(0, 30).forEach(r => console.log(`- ${r.name}: [${r.qualities.join(', ')}]`));
