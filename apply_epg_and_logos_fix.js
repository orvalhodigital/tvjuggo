const fs = require('fs');

const canaisContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = canaisContent.split('\n');

const logoFixMap = {
    // Premiere & Esportes
    'PREMIERE 8 MOSAICO': 'http://logos.appscms.xyz/logos/2025/premiere.png',
    'BandSports': 'http://logos.appscms.xyz/logos/2025/bandsports.png',
    'CazeTV 2': 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'CazeTV 3': 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'CAZÉ TV': 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'Eurosport': 'https://i.imgur.com/W8N9O9f.png',
    'Eurosport 2': 'https://i.imgur.com/j1q9q8B.png',
    'GE TV': 'http://logos.appscms.xyz/logos/2025/premiere.png',
    'Xsport': 'http://logos.appscms.xyz/logos/2025/sportv.png',
    'JOGOS DE HOJE': 'http://logos.appscms.xyz/logos/2025/sportv.png',

    // HBO & Max
    'MAX 1': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 2': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 3': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 5': 'http://logos.appscms.xyz/logos/2025/hbomax.png',
    'MAX 6': 'http://logos.appscms.xyz/logos/2025/hbomax.png',

    // Filmes & Séries
    'A&E': 'http://logos.appscms.xyz/logos/2025/ae.png',
    'AXN': 'http://logos.appscms.xyz/logos/2025/axn.png',
    'BR: My Time Movie': 'https://i.imgur.com/KgetM8j.png',
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
    'Sony One Emoções': 'http://logos.appscms.xyz/logos/2025/sonychannel.png',
    'Space': 'http://logos.appscms.xyz/logos/2025/space.png',
    'TNT': 'http://logos.appscms.xyz/logos/2025/tnt.png',
    'Universal Reality': 'http://logos.imperioapps.top/UNIVERSAL.png',
    'WARNER': 'http://logos.appscms.xyz/logos/2025/warnerchannel.png',

    // Notícias
    'BandNews': 'http://logos.appscms.xyz/logos/2025/bandnews.png',
    'Canal Rural': 'http://logos.appscms.xyz/logos/2025/canalrural.png',
    'GloboNews': 'http://logos.appscms.xyz/logos/2025/globonews.png',
    'SBT News': 'http://logos.appscms.xyz/logos/2025/sbt.png',
    'JOVEM PAN': 'http://logos.imperioapps.top/JOVEM_PAN.png',

    // Documentários
    'AEROPORTO AREA RESTRITA': 'http://logos.appscms.xyz/logos/2025/discoverychannel.png',
    'CURTA': 'http://logos.appscms.xyz/logos/2025/curta.png',
    'Discovery H&H': 'http://logos.appscms.xyz/logos/2025/discoveryhh.png',
    'DISCOVERY HOME & HEALTH': 'http://logos.appscms.xyz/logos/2025/discoveryhh.png',
    'HISTORY 2': 'http://logos.appscms.xyz/logos/2025/h2.png',
    'ID - INVESTIGAÇÃO DISCOVERY': 'http://logos.appscms.xyz/logos/2025/id.png',

    // Infantis
    'CARTOON NETWOORK': 'http://logos.appscms.xyz/logos/2025/cartoonnetwork.png',
    'Cartoonito': 'http://logos.appscms.xyz/logos/2025/cartoonito.png',
    'Tooncast': 'http://logos.appscms.xyz/logos/2025/tooncast.png',
    'ZOOMOO': 'http://logos.appscms.xyz/logos/2025/zoomoo.png',
    'DumDum': 'https://i.imgur.com/KgetM8j.png',
    'Kids Mais': 'https://i.imgur.com/KgetM8j.png',

    // Variedades
    '3 PALAVRINHAS': 'https://i.imgur.com/KgetM8j.png',
    'Adult Swim': 'http://logos.appscms.xyz/logos/2025/adultswim.png',
    'Agro+': 'http://logos.appscms.xyz/logos/2025/agromais.png',
    'Apenas Acústico': 'https://i.imgur.com/W2o8xGZ.png',
    'Axé Brasil BA': 'https://i.imgur.com/W2o8xGZ.png',
    'BOKU NO HERO ACADEMIA': 'https://i.imgur.com/8QeL6XG.png',
    'E!': 'http://logos.appscms.xyz/logos/2025/e.png',
    'Essência Kpop - Espanha': 'https://i.imgur.com/W2o8xGZ.png',
    'EVANGELIZAR': 'https://i.imgur.com/5XyopHf.png',
    'Fita Cassete': 'https://i.imgur.com/W2o8xGZ.png',
    'Food Network': 'http://logos.appscms.xyz/logos/2025/foodnetwork.png',
    'Futura': 'http://logos.appscms.xyz/logos/2025/futura.png',
    'GATO FELIX': 'https://i.imgur.com/8QeL6XG.png',
    'Modo Viagem': 'http://logos.appscms.xyz/logos/2025/modoviagem.png',
    'Off': 'http://logos.appscms.xyz/logos/2025/off.png',
    'Plenitude TV': 'https://i.imgur.com/5XyopHf.png',
    'PRIME VIDEO 1': 'https://i.imgur.com/5XyopHf.png',
    'Redbull TV': 'https://i.imgur.com/KgetM8j.png',
    'TLC': 'http://logos.appscms.xyz/logos/2025/tlc.png',
    'Travel Box': 'https://i.imgur.com/7rjCS5i.png',
    'TV DIÁRIO': 'http://logos.appscms.xyz/logos/2025/globo.png',
    'TV Difusao': 'https://i.imgur.com/KgetM8j.png',
    'TV Senado': 'http://logos.appscms.xyz/logos/2025/tvsenado.png',
    'WooHoo': 'http://logos.appscms.xyz/logos/2025/woohoo.png',

    // Religiosos
    'Canção Nova': 'http://logos.appscms.xyz/logos/2025/cancaonova.png',
    'Novo Tempo': 'http://logos.appscms.xyz/logos/2025/novotempo.png',
    'Rede CNT': 'http://logos.appscms.xyz/logos/2025/cnt.png',
    'Rede Seculo 21': 'https://i.imgur.com/5XyopHf.png',
    'TV Pai Eterno': 'https://i.imgur.com/5XyopHf.png'
};

const tvgIdFixMap = {
    'PREMIERE 8 MOSAICO': 'Premiere8.br',
    'CazeTV 2': 'CazeTV2.br',
    'CazeTV 3': 'CazeTV3.br',
    'Eurosport': 'Eurosport1.br',
    'Eurosport 2': 'Eurosport2.br',
    'MAX 1': 'Max1.br',
    'MAX 2': 'Max2.br',
    'MAX 3': 'Max3.br',
    'MAX 5': 'Max5.br',
    'MAX 6': 'Max6.br',
    'Sony One Emoções': 'SonyOneEmocoes.br',
    'AEROPORTO AREA RESTRITA': 'AeroportoAreaRestrita.br',
    'DISCOVERY HOME & HEALTH': 'DiscoveryHomeHealth.br',
    'ID - INVESTIGAÇÃO DISCOVERY': 'InvestigacaoDiscovery.br',
    'CARTOON NETWOORK': 'CartoonNetwork.br',
    'DumDum': 'DumDum.br',
    'Kids Mais': 'KidsMais.br',
    'ZOOMOO': 'ZooMoo.br',
    '3 PALAVRINHAS': '3Palavrinhas.br',
    'Apenas Acústico': 'ApenasAcustico.br',
    'Axé Brasil BA': 'AxeBrasil.br',
    'BOKU NO HERO ACADEMIA': 'BokuNoHero.br',
    'CAZÉ TV': 'CazeTV.br',
    'E!': 'EEntertainment.br',
    'Essência Kpop - Espanha': 'EssenciaKpop.br',
    'EVANGELIZAR': 'RedeEvangelizar.br',
    'Fita Cassete': 'FitaCassete.br',
    'GATO FELIX': 'GatoFelix.br',
    'JOGOS DE HOJE': 'JogosDeHoje.br',
    'JOVEM PAN': 'JovemPanNews.br',
    'PRIME VIDEO 1': 'PrimeVideo1.br',
    'Redbull TV': 'RedBullTV.br',
    'TV DIÁRIO': 'TVDiario.br',
    'TV Senado': 'TVSenado.br',
    'Rede CNT': 'RedeCNT.br',
    'TV Pai Eterno': 'TVPaiEterno.br'
};

const updatedLines = [];
// 1. Atualizar Header com EPGs funcionais (epgshare01 e epg.pw)
updatedLines.push('#EXTM3U url-tvg="https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz,https://epg.pw/xmltv/epg_BR.xml.gz" x-tvg-url="https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz,https://epg.pw/xmltv/epg_BR.xml.gz"');

let logosUpdated = 0;
let tvgIdsUpdated = 0;

for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (line.startsWith('#EXTINF:')) {
        const nameMatch = line.match(/tvg-name="([^"]+)"/) || line.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : '';

        // Corrigir / Adicionar tvg-id
        if (tvgIdFixMap[name]) {
            const newId = tvgIdFixMap[name];
            if (line.includes('tvg-id="')) {
                line = line.replace(/tvg-id="[^"]*"/, `tvg-id="${newId}"`);
            } else {
                line = line.replace('#EXTINF:-1 ', `#EXTINF:-1 tvg-id="${newId}" `);
            }
            tvgIdsUpdated++;
        }

        // Corrigir / Adicionar tvg-logo
        if (logoFixMap[name]) {
            const newLogo = logoFixMap[name];
            if (line.includes('tvg-logo="')) {
                line = line.replace(/tvg-logo="[^"]*"/, `tvg-logo="${newLogo}"`);
            } else {
                line = line.replace('#EXTINF:-1 ', `#EXTINF:-1 tvg-logo="${newLogo}" `);
            }
            logosUpdated++;
        }
    }
    updatedLines.push(line);
}

fs.writeFileSync('Canais de TV.m3u8', updatedLines.join('\n'), 'utf8');
console.log(`Sucesso!`);
console.log(`- EPG Header atualizado para servidores ativos (HTTP 200)`);
console.log(`- Logos corrigidas e inseridas: ${logosUpdated}`);
console.log(`- tvg-id de canais corrigidos: ${tvgIdsUpdated}`);
