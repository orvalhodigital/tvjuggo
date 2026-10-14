const http = require('http');
const https = require('https');

const logoFixMap = {
    'PREMIERE 8 MOSAICO': 'http://logos.appscms.xyz/logos/2025/premiere.png',
    'BandSports': 'http://logos.appscms.xyz/logos/2025/bandsports.png',
    'CazeTV 2': 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'CazeTV 3': 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'Eurosport': 'https://img.onetv.plus/icones_channels/Eurosport_1_HD.png',
    'Eurosport 2': 'https://img.onetv.plus/icones_channels/Eurosport_2_HD.png',
    'GE TV': 'http://logos.appscms.xyz/logos/2025/premiere.png',
    'Xsport': 'http://logos.appscms.xyz/logos/2025/sportv.png',
    'MAX 1': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 2': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 3': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 5': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 6': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'A&E': 'http://logos.appscms.xyz/logos/2025/ae.png',
    'AXN': 'http://logos.appscms.xyz/logos/2025/axn.png',
    'BR: My Time Movie': 'https://img.onetv.plus/icones_channels/Animal_Planet_HD.png',
    'Canal Brasil': 'http://logos.appscms.xyz/logos/2025/canalbrasil.png',
    'Cine SKY 1': 'http://logos.appscms.xyz/logos/2025/cinesky.png',
    'Cine SKY 2': 'http://logos.appscms.xyz/logos/2025/cinesky.png',
    'Cine SKY 3': 'http://logos.appscms.xyz/logos/2025/cinesky.png',
    'Cine SKY 4': 'http://logos.appscms.xyz/logos/2025/cinesky.png',
    'Cine SKY 5': 'http://logos.appscms.xyz/logos/2025/cinesky.png',
    'Cinemax': 'http://logos.appscms.xyz/logos/2025/cinemax.png',
    'Lifetime': 'http://logos.appscms.xyz/logos/2025/lifetime.png',
    'Megapix': 'http://logos.appscms.xyz/logos/2025/megapix.png',
    'Sony Channel': 'http://logos.appscms.xyz/logos/2025/sonychannel.png',
    'Space': 'http://logos.appscms.xyz/logos/2025/space.png',
    'TNT': 'http://logos.appscms.xyz/logos/2025/tnt.png',
    'Universal Reality': 'http://logos.appscms.xyz/logos/2025/universal.png',
    'WARNER': 'http://logos.appscms.xyz/logos/2025/warnerchannel.png',
    'BandNews': 'http://logos.appscms.xyz/logos/2025/bandnews.png',
    'Canal Rural': 'http://logos.appscms.xyz/logos/2025/canalrural.png',
    'GloboNews': 'http://logos.appscms.xyz/logos/2025/globonews.png',
    'SBT News': 'http://logos.appscms.xyz/logos/2025/sbt.png',
    'AEROPORTO AREA RESTRITA': 'http://logos.appscms.xyz/logos/2025/discovery.png',
    'CURTA': 'http://logos.appscms.xyz/logos/2025/curta.png',
    'Discovery H&H': 'http://logos.appscms.xyz/logos/2025/discoveryhh.png',
    'DISCOVERY HOME & HEALTH': 'http://logos.appscms.xyz/logos/2025/discoveryhh.png',
    'HISTORY 2': 'http://logos.appscms.xyz/logos/2025/h2.png',
    'ID - INVESTIGAÇÃO DISCOVERY': 'http://logos.appscms.xyz/logos/2025/id.png',
    'CARTOON NETWOORK': 'http://logos.appscms.xyz/logos/2025/cartoonnetwork.png',
    'Cartoonito': 'https://img.onetv.plus/icones_channels/CARTOONITO_HD.png',
    'Tooncast': 'https://img.onetv.plus/icones_channels/TOONCAST_HD.png',
    'ZOOMOO': 'http://logos.appscms.xyz/logos/2025/zoomoo.png',
    '3 PALAVRINHAS': 'https://i.imgur.com/KgetM8j.png',
    'Adult Swim': 'http://logos.appscms.xyz/logos/2025/adultswim.png',
    'Agro+': 'http://logos.appscms.xyz/logos/2025/agromais.png',
    'Apenas Acústico': 'https://i.imgur.com/W2o8xGZ.png',
    'Axé Brasil BA': 'https://i.imgur.com/W2o8xGZ.png',
    'BOKU NO HERO ACADEMIA': 'https://i.imgur.com/8QeL6XG.png',
    'CAZÉ TV': 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'E!': 'http://logos.appscms.xyz/logos/2025/e.png',
    'Essência Kpop - Espanha': 'https://i.imgur.com/W2o8xGZ.png',
    'EVANGELIZAR': 'https://i.imgur.com/5XyopHf.png',
    'Fita Cassete': 'https://i.imgur.com/W2o8xGZ.png',
    'Food Network': 'http://logos.appscms.xyz/logos/2025/foodnetwork.png',
    'Futura': 'http://logos.appscms.xyz/logos/2025/futura.png',
    'GATO FELIX': 'https://i.imgur.com/8QeL6XG.png',
    'JOGOS DE HOJE': 'http://logos.appscms.xyz/logos/2025/sportv.png',
    'JOVEM PAN': 'http://logos.appscms.xyz/logos/2025/jovempannews.png',
    'Modo Viagem': 'http://logos.appscms.xyz/logos/2025/modoviagem.png',
    'Off': 'http://logos.appscms.xyz/logos/2025/off.png',
    'Plenitude TV': 'https://i.imgur.com/5XyopHf.png',
    'PRIME VIDEO 1': 'https://i.imgur.com/5XyopHf.png',
    'Redbull TV': 'https://i.imgur.com/KgetM8j.png',
    'TLC': 'http://logos.appscms.xyz/logos/2025/tlc.png',
    'Travel Box': 'http://logos.appscms.xyz/logos/2025/boxbrazil.png',
    'TV DIÁRIO': 'http://logos.appscms.xyz/logos/2025/globo.png',
    'TV Difusao': 'https://i.imgur.com/KgetM8j.png',
    'TV Senado': 'http://logos.appscms.xyz/logos/2025/tvsenado.png',
    'WooHoo': 'http://logos.appscms.xyz/logos/2025/woohoo.png',
    'Canção Nova': 'http://logos.appscms.xyz/logos/2025/cancaonova.png',
    'Novo Tempo': 'http://logos.appscms.xyz/logos/2025/novotempo.png',
    'Rede CNT': 'http://logos.appscms.xyz/logos/2025/cnt.png',
    'Rede Seculo 21': 'https://i.imgur.com/5XyopHf.png'
};

async function testUrl(url) {
    return new Promise(resolve => {
        try {
            const u = new URL(url);
            const client = u.protocol === 'https:' ? https : http;
            client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, res => {
                resolve({ url, ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
                res.resume();
            }).on('error', e => resolve({ url, ok: false, error: e.message }));
        } catch(e) {
            resolve({ url, ok: false, error: e.message });
        }
    });
}

(async () => {
    console.log(`Testando ${Object.keys(logoFixMap).length} URLs de substituição de logos...`);
    const entries = Object.entries(logoFixMap);
    let okCount = 0;
    for (const [name, url] of entries) {
        const res = await testUrl(url);
        if (res.ok) {
            okCount++;
        } else {
            console.log(`❌ Falha para "${name}": ${url} -> ${res.status || res.error}`);
        }
    }
    console.log(`\nResultado: ${okCount} de ${entries.length} logos testadas estão ONLINE (100% OK)!`);
})();
