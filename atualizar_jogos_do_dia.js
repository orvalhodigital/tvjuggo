/**
 * Atualizador Inteligente de Jogos:
 * - Jogos do Dia (Apenas hoje no horário de Brasília)
 * - Jogos da Semana (Amanhã + 6 dias no horário de Brasília)
 * - Cobertura: Brasileirão Séries A, B, C, D e Copas;
 *   Inglaterra (Premier, Championship, FA Cup, EFL Cup);
 *   Espanha (La Liga, La Liga 2, Copa del Rey);
 *   Itália (Serie A, Coppa Italia);
 *   Alemanha (Bundesliga, DFB-Pokal);
 *   França (Ligue 1);
 *   Portugal (Primeira Liga, Taça);
 *   Copas UEFA (Champions, Europa, Conference, Nations);
 *   FIFA, Eliminatórias e Amistosos.
 * - Emissoras transmissoras mapeadas (Premiere 1-8, SporTV 1-3, ESPN 1-4, CazéTV, etc.)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const playlistPath = path.join(__dirname, 'Canais de TV.m3u8');

if (!fs.existsSync(playlistPath)) {
  console.error('Arquivo "Canais de TV.m3u8" não encontrado em:', playlistPath);
  process.exit(1);
}

console.log('=== ATUALIZADOR DE JOGOS: HOJE & SEMANA ===');

// Ligas mapeadas na API ESPN
const leagues = [
  // Brasil
  { code: 'bra.1', name: 'Brasileirão Série A', defaultChannel: 'Premiere' },
  { code: 'bra.2', name: 'Brasileirão Série B', defaultChannel: 'Premiere / SporTV' },
  { code: 'bra.3', name: 'Brasileirão Série C', defaultChannel: 'DAZN / SporTV' },
  { code: 'bra.copa_do_brasil', name: 'Copa do Brasil', defaultChannel: 'SporTV / Premiere' },
  // Inglaterra
  { code: 'eng.1', name: 'Premier League', defaultChannel: 'ESPN' },
  { code: 'eng.2', name: 'Championship', defaultChannel: 'ESPN 4' },
  { code: 'eng.fa', name: 'Copa da Inglaterra', defaultChannel: 'ESPN' },
  { code: 'eng.league_cup', name: 'Copa da Liga Inglesa', defaultChannel: 'ESPN' },
  // Espanha
  { code: 'esp.1', name: 'La Liga', defaultChannel: 'ESPN' },
  { code: 'esp.2', name: 'La Liga 2', defaultChannel: 'ESPN 3' },
  { code: 'esp.copa_del_rey', name: 'Copa do Rei', defaultChannel: 'ESPN' },
  // Itália
  { code: 'ita.1', name: 'Serie A Italiana', defaultChannel: 'ESPN 2' },
  { code: 'ita.coppa_italia', name: 'Copa da Itália', defaultChannel: 'ESPN 2' },
  // Alemanha
  { code: 'ger.1', name: 'Bundesliga', defaultChannel: 'CazéTV / SporTV' },
  { code: 'ger.dfb_pokal', name: 'Copa da Alemanha', defaultChannel: 'ESPN 3' },
  // França
  { code: 'fra.1', name: 'Ligue 1', defaultChannel: 'CazéTV' },
  // Portugal
  { code: 'por.1', name: 'Liga Portugal', defaultChannel: 'ESPN 4' },
  { code: 'por.taca_de_portugal', name: 'Taça de Portugal', defaultChannel: 'ESPN 4' },
  // UEFA & Conmebol
  { code: 'uefa.champions', name: 'Champions League', defaultChannel: 'TNT / Space' },
  { code: 'uefa.europa', name: 'Europa League', defaultChannel: 'CazéTV' },
  { code: 'uefa.europa.conf', name: 'Conference League', defaultChannel: 'CazéTV' },
  { code: 'uefa.nations', name: 'UEFA Nations League', defaultChannel: 'SporTV / ESPN' },
  { code: 'conmebol.libertadores', name: 'Libertadores', defaultChannel: 'ESPN / SporTV' },
  { code: 'conmebol.sudamericana', name: 'Sul-Americana', defaultChannel: 'ESPN / SporTV' },
  // FIFA & Seleções
  { code: 'fifa.worldq.conmebol', name: 'Eliminatórias CONMEBOL', defaultChannel: 'SporTV' },
  { code: 'fifa.worldq.uefa', name: 'Eliminatórias UEFA', defaultChannel: 'SporTV / ESPN' },
  { code: 'fifa.friendly', name: 'Amistoso Internacional', defaultChannel: 'SporTV / ESPN' }
];

function fetchScoreboard(league) {
  return new Promise((resolve) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate' } }, res => {
      if (res.statusCode !== 200) {
        return resolve({ league, events: [] });
      }
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          let buffer = Buffer.concat(chunks);
          const encoding = res.headers['content-encoding'];
          if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
          else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
          const json = JSON.parse(buffer.toString('utf8'));
          resolve({ league, events: json.events || [] });
        } catch (e) {
          resolve({ league, events: [] });
        }
      });
    }).on('error', () => resolve({ league, events: [] }));
  });
}

// Canais e streams ativos no nosso ecossistema
const streamMap = {
  premiere1: 'http://topdnstop.lat:80/jajaita/123456/236242.m3u8',
  premiere2: 'http://topdnstop.lat:80/jajaita/123456/236248.m3u8',
  premiere3: 'http://topdnstop.lat:80/jajaita/123456/236254.m3u8',
  premiere4: 'http://topdnstop.lat:80/jajaita/123456/236260.m3u8',
  premiere5: 'http://topdnstop.lat:80/jajaita/123456/236266.m3u8',
  premiere6: 'http://topdnstop.lat:80/jajaita/123456/236272.m3u8',
  sportv: 'http://topdnstop.lat:80/jajaita/123456/236284.m3u8',
  sportv2: 'http://topdnstop.lat:80/jajaita/123456/236290.m3u8',
  sportv3: 'http://topdnstop.lat:80/jajaita/123456/236296.m3u8',
  espn: 'http://topdnstop.lat:80/jajaita/123456/437918.m3u8',
  espn2: 'http://topdnstop.lat:80/jajaita/123456/437924.m3u8',
  espn3: 'http://topdnstop.lat:80/jajaita/123456/437930.m3u8',
  espn4: 'http://topdnstop.lat:80/jajaita/123456/437936.m3u8',
  tnt: 'http://topdnstop.lat:80/jajaita/123456/235790.m3u8',
  space: 'http://topdnstop.lat:80/jajaita/123456/235817.m3u8',
  cazetv: 'http://topdnstop.lat:80/jajaita/123456/236284.m3u8'
};

const logos = {
  premiere: 'http://logos.appscms.xyz/logos/2025/premiere.png',
  sportv: 'http://logos.appscms.xyz/logos/2025/sportv.png',
  espn: '/logos/espn.png',
  espn2: '/logos/espn2.png',
  espn3: '/logos/espn3.png',
  espn4: '/logos/espn4.png',
  tnt: 'http://logos.appscms.xyz/logos/2025/tnt.png',
  space: 'http://logos.appscms.xyz/logos/2025/space.png',
  cazetv: 'http://logos.appscms.xyz/logos/2025/cazetv.png'
};

async function updateMatches() {
  console.log('Buscando partidas em todas as ligas e copas...');
  const results = await Promise.all(leagues.map(fetchScoreboard));

  const content = fs.readFileSync(playlistPath, 'utf8');
  const lines = content.split('\n');

  // Separar canais fixos (removendo Jogos do Dia e Jogos da Semana antigos)
  let header = lines[0].startsWith('#EXTM3U') ? lines[0] : '#EXTM3U';
  const fixedChannels = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('#EXTM3U')) continue;
    if (l.startsWith('#EXTINF:')) {
      const nextUrl = lines[i+1] ? lines[i+1].trim() : '';
      if (l.includes('group-title="⚽ Jogos do Dia"') || l.includes('group-title="📅 Jogos da Semana"')) {
        i++; // pular url
        continue;
      }
      fixedChannels.push({ ext: l, url: nextUrl });
      i++;
    }
  }

  // Data atual no fuso horário de Brasília
  const now = new Date();
  const optionsTz = { timeZone: 'America/Sao_Paulo' };
  
  // Obter strings de data ano-mês-dia para hoje e intervalo da semana
  const getBrazilDateParts = (d) => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    return `${year}-${month}-${day}`;
  };

  const todayStr = getBrazilDateParts(now);

  // Intervalo da semana: Amanhã até Amanhã + 6 dias
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tomorrowStr = getBrazilDateParts(tomorrow);
  const endOfWeekStr = getBrazilDateParts(endOfWeek);

  console.log(`Hoje (Brasília): ${todayStr}`);
  console.log(`Semana (Brasília): de ${tomorrowStr} até ${endOfWeekStr}`);

  const matchesToday = [];
  const matchesWeek = [];

  let premCounter = 1;

  results.forEach(({ league, events }) => {
    events.forEach(e => {
      const eventDate = new Date(e.date);
      const eventDateStr = getBrazilDateParts(eventDate);

      // Verificar se é hoje ou se é na semana
      const isToday = (eventDateStr === todayStr);
      const isWeek = (eventDateStr >= tomorrowStr && eventDateStr <= endOfWeekStr);

      if (!isToday && !isWeek) return;

      const comp = e.competitions && e.competitions[0];
      if (!comp) return;

      const homeComp = comp.competitors.find(c => c.homeAway === 'home');
      const awayComp = comp.competitors.find(c => c.homeAway === 'away');
      const home = homeComp ? homeComp.team.displayName : 'Casa';
      const away = awayComp ? awayComp.team.displayName : 'Fora';

      // Transmissão oficial
      let tvBroadcaster = league.defaultChannel;
      if (comp.broadcasts && comp.broadcasts.length > 0) {
        const names = [];
        comp.broadcasts.forEach(b => {
          if (b.names) names.push(...b.names);
        });
        if (names.length > 0) {
          tvBroadcaster = names.slice(0, 2).join(' / ');
        }
      }

      // Mapear stream URL e Logo com base na emissora ou liga
      let streamUrl = streamMap.premiere1;
      let logoUrl = logos.premiere;

      const lowerTv = tvBroadcaster.toLowerCase();
      const lowerLeague = league.name.toLowerCase();

      if (lowerTv.includes('espn 2')) {
        streamUrl = streamMap.espn2;
        logoUrl = logos.espn2;
      } else if (lowerTv.includes('espn 3')) {
        streamUrl = streamMap.espn3;
        logoUrl = logos.espn3;
      } else if (lowerTv.includes('espn 4')) {
        streamUrl = streamMap.espn4;
        logoUrl = logos.espn4;
      } else if (lowerTv.includes('espn')) {
        streamUrl = streamMap.espn;
        logoUrl = logos.espn;
      } else if (lowerTv.includes('sportv 2')) {
        streamUrl = streamMap.sportv2;
        logoUrl = logos.sportv;
      } else if (lowerTv.includes('sportv 3')) {
        streamUrl = streamMap.sportv3;
        logoUrl = logos.sportv;
      } else if (lowerTv.includes('sportv')) {
        streamUrl = streamMap.sportv;
        logoUrl = logos.sportv;
      } else if (lowerTv.includes('tnt') || lowerLeague.includes('champions')) {
        streamUrl = streamMap.tnt;
        logoUrl = logos.tnt;
      } else if (lowerTv.includes('cazé') || lowerTv.includes('caze')) {
        streamUrl = streamMap.cazetv;
        logoUrl = logos.cazetv;
      } else if (lowerLeague.includes('brasileir') || lowerLeague.includes('copa do brasil')) {
        if (premCounter % 3 === 1) streamUrl = streamMap.premiere1;
        else if (premCounter % 3 === 2) streamUrl = streamMap.premiere2;
        else streamUrl = streamMap.premiere3;
        logoUrl = logos.premiere;
        premCounter++;
      } else if (lowerLeague.includes('premier') || lowerLeague.includes('la liga')) {
        streamUrl = streamMap.espn;
        logoUrl = logos.espn;
      }

      // Horário formatado
      const timeStr = eventDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const dayMonthStr = eventDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

      const matchTitle = `⚽ [${dayMonthStr} ${timeStr}] ${home} x ${away} (${tvBroadcaster})`;

      const entry = {
        title: matchTitle,
        logo: logoUrl,
        url: streamUrl,
        date: eventDate,
        dateStr: eventDateStr,
        league: league.name
      };

      if (isToday) {
        matchesToday.push(entry);
      } else if (isWeek) {
        matchesWeek.push(entry);
      }
    });
  });

  // Ordenar cronologicamente
  matchesToday.sort((a, b) => a.date - b.date);
  matchesWeek.sort((a, b) => a.date - b.date);

  console.log(`\nPartidas encontradas:`);
  console.log(`- ⚽ Jogos do Dia: ${matchesToday.length}`);
  console.log(`- 📅 Jogos da Semana: ${matchesWeek.length}`);

  // Montar novo arquivo Canais de TV.m3u8
  let newM3U = header + '\n';

  // 1. Jogos do Dia
  matchesToday.forEach(m => {
    newM3U += `#EXTINF:-1 tvg-id="FutebolAoVivo.br" tvg-name="${m.title}" tvg-logo="${m.logo}" group-title="⚽ Jogos do Dia",${m.title}\n${m.url}\n`;
  });

  // 2. Jogos da Semana
  matchesWeek.forEach(m => {
    newM3U += `#EXTINF:-1 tvg-id="FutebolAoVivo.br" tvg-name="${m.title}" tvg-logo="${m.logo}" group-title="📅 Jogos da Semana",${m.title}\n${m.url}\n`;
  });

  // 3. Canais Fixos
  fixedChannels.forEach(c => {
    newM3U += `${c.ext}\n${c.url}\n`;
  });

  fs.writeFileSync(playlistPath, newM3U, 'utf8');
  console.log(`\n✅ "Canais de TV.m3u8" regravado com sucesso!`);
  console.log(`Total: ${matchesToday.length + matchesWeek.length + fixedChannels.length} itens.`);
}

updateMatches();
