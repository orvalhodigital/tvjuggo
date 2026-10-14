const fs = require('fs');
const path = require('path');

const m3uPath = path.join(__dirname, 'Canais de TV.m3u8');
const l2Path = 'C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u';
const qualPath = path.join(__dirname, 'channel_qualities.json');

const m3uContent = fs.readFileSync(m3uPath, 'utf8');
const m3uLines = m3uContent.split('\n');

const l2Content = fs.readFileSync(l2Path, 'utf8');
const l2Lines = l2Content.split('\n');

function slugify(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'canal';
}

function normalizeKey(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function detectQuality(rawName) {
    const u = rawName.toUpperCase();
    if (u.includes('4K') || u.includes('UHD')) return '4K';
    if (u.includes('FHD') || u.includes('1080P')) return 'FHD';
    if (u.includes('HD') && !u.includes('FHD')) return 'HD';
    if (u.includes('SD') || u.includes('576P') || u.includes('480P')) return 'SD';
    return 'HD';
}

// 1. Indexar Lista02 (topdnstop.lat)
const l2Database = new Map();
let currentExt = null;
for (let i = 0; i < l2Lines.length; i++) {
    const line = l2Lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
        currentExt = line;
    } else if (!line.startsWith('#') && line.startsWith('http') && currentExt) {
        const nameMatch = currentExt.match(/tvg-name="([^"]+)"/) || currentExt.match(/,([^\r\n]+)$/);
        const rawName = nameMatch ? nameMatch[1].trim() : '';
        const cleanName = rawName.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado|1080p|720p)\b/gi, '');
        const norm = normalizeKey(cleanName);
        const q = detectQuality(rawName);

        if (norm) {
            if (!l2Database.has(norm)) l2Database.set(norm, {});
            const qMap = l2Database.get(norm);
            if (!qMap[q]) qMap[q] = line;
        }
        currentExt = null;
    }
}

console.log(`Indexados ${l2Database.size} canais distintos de lista02.`);

// Mapeamento manual de aliases para garantir casamento 100% perfeito dos canais pagos
const aliasMap = {
    // Esportes & Premiere
    'premiere': 'premiereclubes',
    'premiereclubes': 'premiereclubes',
    'premiere2': 'premiere2',
    'premiere3': 'premiere3',
    'premiere4': 'premiere4',
    'premiere5': 'premiere5',
    'premiere6': 'premiere6',
    'premiere7': 'premiere7',
    'premiere8': 'premiere8',
    'sportv': 'sportv1',
    'sportv1': 'sportv1',
    'sportv2': 'sportv2',
    'sportv3': 'sportv3',
    'espn': 'espn1',
    'espn1': 'espn1',
    'espn2': 'espn2',
    'espn3': 'espn3',
    'espn4': 'espn4',
    'espn5': 'espn5',
    'espn6': 'espn6',
    'combate': 'combate',
    'bandsports': 'bandsports',
    // Telecine
    'telecinepremium': 'telecinepremium',
    'telecineaction': 'telecineaction',
    'telecinepipoca': 'telecinepipoca',
    'telecinecult': 'telecinecult',
    'telecinefun': 'telecinefun',
    'telecinetouch': 'telecinetouch',
    // HBO
    'hbo': 'hbo',
    'hbo2': 'hbo2',
    'hboplus': 'hboplus',
    'hbopop': 'hbopop',
    'hbofamily': 'hbofamily',
    'hbosignature': 'hbosignature',
    'hbomundi': 'hbomundi',
    'hboxtreme': 'hboxtreme',
    // Filmes & Séries
    'megapix': 'megapix',
    'space': 'space',
    'tnt': 'tnt',
    'tntnovelas': 'tntnovelas',
    'tntseries': 'tntseries',
    'warnerchannel': 'warnerchannel',
    'warner': 'warnerchannel',
    'universalchannel': 'universalchannel',
    'universal': 'universalchannel',
    'universalreality': 'universalreality',
    'studiouniversal': 'studiouniversal',
    'axn': 'axn',
    'sonychannel': 'canalsony',
    'sony': 'canalsony',
    'canalsony': 'canalsony',
    'cinemax': 'cinemax',
    'lifetime': 'lifetime',
    'tcm': 'tcm',
    'ae': 'ae',
    // Documentários
    'discoverychannel': 'discoverychannel',
    'discovery': 'discoverychannel',
    'discoveryhh': 'discoveryhh',
    'discoveryid': 'discoveryid',
    'discoverykids': 'discoverykids',
    'discoveryscience': 'discoveryscience',
    'discoverytheater': 'discoverytheater',
    'discoveryturbo': 'discoveryturbo',
    'animalplanet': 'animalplanet',
    'history': 'history',
    'h2': 'h2',
    // Infantis
    'cartoonnetwork': 'cartoonnetwork',
    'cartoonito': 'cartoonito',
    'gloob': 'gloob',
    'gloobinho': 'gloobinho',
    'tooncast': 'tooncast',
    'tvratimbum': 'tvratimbum',
    // Variedades & Notícias
    'canaloff': 'canaloff',
    'off': 'canaloff',
    'modoviagem': 'modoviagem',
    'multishow': 'multishow',
    'gnt': 'gnt',
    'viva': 'viva',
    'foodnetwork': 'foodnetwork',
    'tlc': 'tlc',
    'adultswim': 'adultswim',
    'woohoo': 'woohoo',
    'redbulltv': 'redbulltv',
    'cnnbrasil': 'cnnbrasil',
    'globonews': 'globonews',
    'jovempannews': 'jovempannews',
    'bandnews': 'bandnews',
    'recordnews': 'recordnews',
    'sbtnews': 'sbtnews'
};

// 2. Atualizar Canais de TV.m3u8 substituindo URLs de 64.31.23.207
let updatedM3U = [];
let replacedInM3u = 0;

let currentExtinf = null;
for (let i = 0; i < m3uLines.length; i++) {
    const line = m3uLines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
        updatedM3U.push(line);
        continue;
    }

    if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
    } else if (!line.startsWith('#') && currentExtinf) {
        let streamUrl = line;

        // Se for canal pago com URL de 64.31.23.207 ou se temos fonte muito melhor em topdnstop.lat
        const nameMatch = currentExtinf.match(/tvg-name="([^"]+)"/) || currentExtinf.match(/,([^\r\n]+)$/);
        const rawName = nameMatch ? nameMatch[1].trim() : '';
        const norm = normalizeKey(rawName.replace(/\b(4k|uhd|fhd|hd|sd|hevc|h265|leg|legendado|dub|dublado)\b/gi, ''));
        const targetKey = aliasMap[norm] || norm;

        // Não alterar os cards de jogos dinâmicos
        const isMatchGame = currentExtinf.includes('⚽');

        if (!isMatchGame && l2Database.has(targetKey)) {
            const qMap = l2Database.get(targetKey);
            // Escolhe a melhor URL estável (HD ou FHD)
            const bestUrl = qMap['HD'] || qMap['FHD'] || qMap['4K'] || qMap['SD'];
            if (bestUrl && (streamUrl.includes('64.31.23.207') || streamUrl.includes('corruptx.org') || !streamUrl.includes('topdnstop.lat'))) {
                streamUrl = bestUrl;
                replacedInM3u++;
            }
        }

        updatedM3U.push(currentExtinf);
        updatedM3U.push(streamUrl);
        currentExtinf = null;
    }
}

fs.writeFileSync(m3uPath, updatedM3U.join('\n') + '\n', 'utf8');
console.log(`✅ Canais de TV.m3u8 atualizado: ${replacedInM3u} URLs migradas para streams de alta estabilidade!`);

// 3. Atualizar channel_qualities.json com todas as qualidades ativas
let qualities = {};
if (fs.existsSync(qualPath)) {
    qualities = JSON.parse(fs.readFileSync(qualPath, 'utf8'));
}

for (const [normKey, qMap] of l2Database.entries()) {
    // Achar slug
    const slug = slugify(normKey);
    if (!qualities[slug]) qualities[slug] = {};
    if (qMap['4K']) qualities[slug]['4K'] = qMap['4K'];
    if (qMap['FHD']) qualities[slug]['FHD'] = qMap['FHD'];
    if (qMap['HD']) qualities[slug]['HD'] = qMap['HD'];
    if (qMap['SD']) qualities[slug]['SD'] = qMap['SD'];
}

// Aliases de canais comuns
for (const [alias, realKey] of Object.entries(aliasMap)) {
    if (l2Database.has(realKey)) {
        const qMap = l2Database.get(realKey);
        const slug = slugify(alias);
        qualities[slug] = {};
        if (qMap['4K']) qualities[slug]['4K'] = qMap['4K'];
        if (qMap['FHD']) qualities[slug]['FHD'] = qMap['FHD'];
        if (qMap['HD']) qualities[slug]['HD'] = qMap['HD'];
        if (qMap['SD']) qualities[slug]['SD'] = qMap['SD'];
    }
}

// Garantir Globo e Record sem erros
qualities['globo-sp'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/234261.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/234262.m3u8',
  SD: 'http://topdnstop.lat:80/jajaita/123456/234263.m3u8'
};
qualities['globo-rj'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/234243.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/234244.m3u8',
  SD: 'http://topdnstop.lat:80/jajaita/123456/234245.m3u8'
};
qualities['globo-es'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/1601660.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/1601661.m3u8',
  SD: 'http://topdnstop.lat:80/jajaita/123456/1601662.m3u8'
};
qualities['globo'] = qualities['globo-sp'];

qualities['record-sp'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/235933.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/235932.m3u8'
};
qualities['record-rj'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/235900.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/235899.m3u8'
};
qualities['record'] = qualities['record-sp'];

// Remover qualquer canal "e-entertainment" atribuído erroneamente
delete qualities['e'];
delete qualities['e-hd'];

fs.writeFileSync(qualPath, JSON.stringify(qualities, null, 2), 'utf8');
console.log(`✅ channel_qualities.json salvo com sucesso! Total: ${Object.keys(qualities).length} canais com qualidades.`);
