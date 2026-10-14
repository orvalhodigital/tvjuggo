const fs = require('fs');
const path = require('path');

const canaisContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const canaisLines = canaisContent.split('\n');

const lista02Path = 'C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u';
const lista02Content = fs.readFileSync(lista02Path, 'utf8');
const l2Lines = lista02Content.split('\n');

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'canal';
}

function normalizeKey(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function detectQuality(rawName) {
    const u = rawName.toUpperCase();
    if (u.includes('4K') || u.includes('UHD')) return '4K';
    if (u.includes('FHD') || u.includes('1080P')) return 'FHD';
    if (u.includes('HD') && !u.includes('FHD')) return 'HD';
    if (u.includes('SD') || u.includes('576P') || u.includes('480P')) return 'SD';
    return 'HD';
}

// 1. Indexar Lista 02
const l2Index = new Map();
let currentExt = null;
for (let i = 0; i < l2Lines.length; i++) {
    const line = l2Lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
        currentExt = line;
    } else if (!line.startsWith('#') && currentExt) {
        const nameMatch = currentExt.match(/tvg-name="([^"]+)"/) || currentExt.match(/,([^\r\n]+)$/);
        const rawName = nameMatch ? nameMatch[1].trim() : '';
        const cleanName = rawName.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado|1080p|720p)\b/gi, '');
        const normKey = normalizeKey(cleanName);
        const q = detectQuality(rawName);

        if (normKey) {
            if (!l2Index.has(normKey)) l2Index.set(normKey, {});
            const qMap = l2Index.get(normKey);
            if (!qMap[q]) qMap[q] = line;
        }
        currentExt = null;
    }
}

// Aliases detalhados
const aliasMap = {
    'sportv': 'sportv1',
    'sportv1': 'sportv1',
    'sportv2': 'sportv2',
    'sportv3': 'sportv3',
    'sportv4': 'sportv4',
    'espn': 'espn1',
    'espn1': 'espn1',
    'espn2': 'espn2',
    'espn3': 'espn3',
    'espn4': 'espn4',
    'espn5': 'espn5',
    'espn6': 'espn6',
    'premiereclubes': 'premiereclubes',
    'premiere2': 'premiere2',
    'premiere3': 'premiere3',
    'premiere4': 'premiere4',
    'premiere5': 'premiere5',
    'premiere6': 'premiere6',
    'premiere7': 'premiere7',
    'premiere8': 'premiere8',
    'combate': 'combate',
    'bandsports': 'bandsports',
    'redetv': 'redetv',
    'globo': 'globosp',
    'globosp': 'globosp',
    'globorj': 'globorj',
    'globonews': 'globonews',
    'sbt': 'sbtsp',
    'sbtsp': 'sbtsp',
    'band': 'bandsp',
    'bandsp': 'bandsp',
    'record': 'recordsp',
    'recordsp': 'recordsp',
    'cnnbrasil': 'cnnbrasil',
    'jovempannews': 'jovempannews',
    'telecinepremium': 'telecinepremium',
    'telecineaction': 'telecineaction',
    'telecinepipoca': 'telecinepipoca',
    'telecinecult': 'telecinecult',
    'telecinefun': 'telecinefun',
    'telecinetouch': 'telecinetouch',
    'hbo': 'hbo',
    'hbo2': 'hbo2',
    'hboplus': 'hboplus',
    'hbofamily': 'hbofamily',
    'hbosignature': 'hbosignature',
    'hbomundi': 'hbomundi',
    'discoverychannel': 'discoverychannel',
    'discoveryturbo': 'discoveryturbo',
    'discoveryhh': 'discoveryhh',
    'animalplanet': 'animalplanet',
    'historychannel': 'historychannel',
    'history': 'historychannel',
    'history2': 'history2',
    'nationalgeographic': 'nationalgeographic',
    'natgeo': 'nationalgeographic',
    'megapix': 'megapix',
    'tnt': 'tnt',
    'tntseries': 'tntseries',
    'tntnovelas': 'tntnovelas',
    'space': 'space',
    'warnerchannel': 'warnerchannel',
    'warner': 'warnerchannel',
    'axn': 'axn',
    'sony': 'sony',
    'sonycanaldasony': 'sony',
    'universalchannel': 'universalchannel',
    'universal': 'universalchannel',
    'paramountnetwork': 'paramountnetwork',
    'paramount': 'paramountnetwork',
    'viva': 'viva',
    'multishow': 'multishow',
    'gnt': 'gnt',
    'cartoonnetwork': 'cartoonnetwork',
    'disneychannel': 'disneychannel',
    'nickelodeon': 'nickelodeon',
    'nickjr': 'nickjr',
    'discoverykids': 'discoverykids'
};

const finalQualities = {};
let countWithMultiple = 0;

let cExt2 = null;
for (let i = 0; i < canaisLines.length; i++) {
    const line = canaisLines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
        cExt2 = line;
    } else if (!line.startsWith('#') && cExt2) {
        const nameMatch = cExt2.match(/tvg-name="([^"]+)"/) || cExt2.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Canal';
        const slug = slugify(name);
        const norm = normalizeKey(name.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado|1080p|720p)\b/gi, ''));

        let matchedData = null;
        if (aliasMap[norm] && l2Index.has(aliasMap[norm])) {
            matchedData = l2Index.get(aliasMap[norm]);
        } else if (l2Index.has(norm)) {
            matchedData = l2Index.get(norm);
        }

        const qualitiesObj = {};
        if (matchedData) {
            if (matchedData['4K']) qualitiesObj['4K'] = matchedData['4K'];
            if (matchedData['FHD']) qualitiesObj['FHD'] = matchedData['FHD'];
            if (matchedData['HD']) qualitiesObj['HD'] = matchedData['HD'];
            if (matchedData['SD']) qualitiesObj['SD'] = matchedData['SD'];
        }

        // Padrão obrigatório: ter sempre HD definido
        if (!qualitiesObj['HD']) {
            qualitiesObj['HD'] = line;
        }

        // Se tem mais de uma qualidade
        if (Object.keys(qualitiesObj).length > 1) {
            countWithMultiple++;
            finalQualities[slug] = qualitiesObj;
        }
        cExt2 = null;
    }
}

// Adições especiais manuais prioritárias (garantia total para canais VIP)
if (!finalQualities['premiere-clubes']) finalQualities['premiere-clubes'] = {};
finalQualities['premiere-clubes']['4K'] = 'http://topdnstop.lat:80/jajaita/123456/809143.m3u8';
finalQualities['premiere-clubes']['FHD'] = 'http://topdnstop.lat:80/jajaita/123456/236242.m3u8';
finalQualities['premiere-clubes']['HD'] = 'http://topdnstop.lat:80/jajaita/123456/236244.m3u8';
finalQualities['premiere-clubes']['SD'] = 'http://topdnstop.lat:80/jajaita/123456/236246.m3u8';

if (!finalQualities['sportv']) finalQualities['sportv'] = {};
finalQualities['sportv']['4K'] = 'http://topdnstop.lat:80/jajaita/123456/809250.m3u8';
finalQualities['sportv']['FHD'] = 'http://topdnstop.lat:80/jajaita/123456/236284.m3u8';
finalQualities['sportv']['HD'] = 'http://topdnstop.lat:80/jajaita/123456/236286.m3u8';
finalQualities['sportv']['SD'] = 'http://topdnstop.lat:80/jajaita/123456/236288.m3u8';

if (!finalQualities['espn']) finalQualities['espn'] = {};
finalQualities['espn']['4K'] = 'http://topdnstop.lat:80/jajaita/123456/231459.m3u8';
finalQualities['espn']['FHD'] = 'http://topdnstop.lat:80/jajaita/123456/437918.m3u8';
finalQualities['espn']['HD'] = 'http://topdnstop.lat:80/jajaita/123456/437920.m3u8';
finalQualities['espn']['SD'] = 'http://topdnstop.lat:80/jajaita/123456/437922.m3u8';

console.log(`Total de canais com resoluções múltiplas (4K, FHD, HD, SD): ${Object.keys(finalQualities).length}`);
fs.writeFileSync('channel_qualities.json', JSON.stringify(finalQualities, null, 2), 'utf8');
console.log('Salvo em channel_qualities.json com sucesso!');
