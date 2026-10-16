/**
 * Atualizador Inteligente de Jogos do Dia e da Semana - Juggo TV Studio
 * - Roteamento realista de emissoras de TV no Brasil (UEFA -> TNT/Space/MAX/CazéTV; Premier/La Liga -> ESPN; Brasileirão -> Premiere/SporTV)
 * - Mapeamento inteligente de canais múltiplos por horário para evitar repetição de streams
 * - Formato Padronizado: "{Time Casa} x {Time Fora} - {Data} às {Horário} (Ao vivo em {Canal})"
 * - Extração de escudos oficiais dos clubes em alta definição e IDs de partidas para estatísticas ao vivo
 * - Exportação paralela para Canais de TV.m3u8 e jogos_info.json (para o Match Center da Web TV)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const playlistPath = path.join(__dirname, 'Canais de TV.m3u8');
const gamesJsonPath = path.join(__dirname, 'jogos_info.json');

console.log('=== ⚽ ATUALIZADOR INTELIGENTE DE TRANSMISSÕES ESPORTIVAS ===');

// Catálogo de Streams Oficiais e Canais Verificados do Nosso Sistema
const BROADCASTERS = {
  // TNT & Warner / MAX (Champions League & Especiais)
  tnt: { name: 'TNT', url: 'http://topdnstop.lat:80/jajaita/123456/235789.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/tnt.png' },
  space: { name: 'Space', url: 'http://topdnstop.lat:80/jajaita/123456/235816.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/space.png' },
  max1: { name: 'MAX 1', url: 'http://topdnstop.lat:80/jajaita/123456/1740921.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/hbomax.png' },
  max2: { name: 'MAX 2', url: 'http://topdnstop.lat:80/jajaita/123456/1740922.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/hbomax.png' },
  max3: { name: 'MAX 3', url: 'http://topdnstop.lat:80/jajaita/123456/1740924.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/hbomax.png' },
  max5: { name: 'MAX 5', url: 'http://topdnstop.lat:80/jajaita/123456/1740923.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/hbomax.png' },
  max6: { name: 'MAX 6', url: 'http://topdnstop.lat:80/jajaita/123456/1740926.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/hbomax.png' },

  // CazéTV & YouTube/Twitch (Europa League, Conference, Bundesliga, Ligue 1)
  cazetv1: { name: 'CazéTV', url: 'http://topdnstop.lat:80/jajaita/123456/1773445.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/cazetv.png' },
  cazetv2: { name: 'CazéTV 2', url: 'http://topdnstop.lat:80/jajaita/123456/1773449.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/cazetv.png' },
  cazetv3: { name: 'CazéTV 3', url: 'http://topdnstop.lat:80/jajaita/123456/1773453.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/cazetv.png' },
  cazetv4: { name: 'CazéTV 4', url: 'http://topdnstop.lat:80/jajaita/123456/1773457.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/cazetv.png' },

  // ESPN (Premier League, La Liga, Serie A, Libertadores, Copas Europeias)
  espn: { name: 'ESPN', url: 'http://topdnstop.lat:80/jajaita/123456/437920.m3u8', logo: '/logos/espn.png' },
  espn2: { name: 'ESPN 2', url: 'http://topdnstop.lat:80/jajaita/123456/437926.m3u8', logo: '/logos/espn2.png' },
  espn3: { name: 'ESPN 3', url: 'http://topdnstop.lat:80/jajaita/123456/437932.m3u8', logo: '/logos/espn3.png' },
  espn4: { name: 'ESPN 4', url: 'http://topdnstop.lat:80/jajaita/123456/437938.m3u8', logo: '/logos/espn4.png' },
  espn5: { name: 'ESPN 5', url: 'http://topdnstop.lat:80/jajaita/123456/437944.m3u8', logo: '/logos/espn5.png' },
  espn6: { name: 'ESPN 6', url: 'http://topdnstop.lat:80/jajaita/123456/437950.m3u8', logo: '/logos/espn6.png' },

  // SporTV (Nations League, Brasileirão, Eliminatórias, Copa do Brasil)
  sportv: { name: 'SporTV', url: 'http://topdnstop.lat:80/jajaita/123456/236286.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/sportv.png' },
  sportv2: { name: 'SporTV 2', url: 'http://topdnstop.lat:80/jajaita/123456/236292.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/sportv.png' },
  sportv3: { name: 'SporTV 3', url: 'http://topdnstop.lat:80/jajaita/123456/236298.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/sportv.png' },

  // Premiere (EXCLUSIVO Futebol Brasileiro - Série A, Série B, Copa do Brasil)
  premiere1: { name: 'Premiere Clubes', url: 'http://topdnstop.lat:80/live/jajaita/123456/236242.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere2: { name: 'Premiere 2', url: 'http://topdnstop.lat:80/live/jajaita/123456/236248.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere3: { name: 'Premiere 3', url: 'http://topdnstop.lat:80/live/jajaita/123456/236254.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere4: { name: 'Premiere 4', url: 'http://topdnstop.lat:80/live/jajaita/123456/236260.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere5: { name: 'Premiere 5', url: 'http://topdnstop.lat:80/live/jajaita/123456/236266.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere6: { name: 'Premiere 6', url: 'http://topdnstop.lat:80/live/jajaita/123456/236272.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere7: { name: 'Premiere 7', url: 'http://topdnstop.lat:80/live/jajaita/123456/236278.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },
  premiere8: { name: 'Premiere 8', url: 'http://topdnstop.lat:80/live/jajaita/123456/1741638.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/premiere.png' },

  // Paramount+ (Libertadores, Sul-Americana, Copas Internacionais)
  paramount1: { name: 'Paramount+ 1', url: 'http://topdnstop.lat:80/jajaita/123456/233137.m3u8', logo: 'https://logos.appscms.xyz/logos/2025/Paramount.png' },
  paramount2: { name: 'Paramount+ 2', url: 'http://topdnstop.lat:80/jajaita/123456/231169.m3u8', logo: 'https://logos.appscms.xyz/logos/2025/Paramount.png' },
  paramount3: { name: 'Paramount+ 3', url: 'http://topdnstop.lat:80/jajaita/123456/1770966.m3u8', logo: 'https://logos.appscms.xyz/logos/2025/Paramount.png' },
  paramount4: { name: 'Paramount+ 4', url: 'http://topdnstop.lat:80/jajaita/123456/1770967.m3u8', logo: 'https://logos.appscms.xyz/logos/2025/Paramount.png' },

  // Prime Video
  prime1: { name: 'Prime Video 1', url: 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/292698.m3u8', logo: 'https://i.imgur.com/PMptSP3.png' },
  prime2: { name: 'Prime Video 2', url: 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/121180.m3u8', logo: 'https://i.imgur.com/PMptSP3.png' },

  // DAZN & Canal GOAT
  dazn1: { name: 'DAZN 1', url: 'http://topdnstop.lat:80/jajaita/123456/234497.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/dazn.png' },
  dazn2: { name: 'DAZN 2', url: 'http://topdnstop.lat:80/jajaita/123456/234499.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/dazn.png' },
  goat1: { name: 'Canal GOAT', url: 'http://topdnstop.lat:80/jajaita/123456/1774549.m3u8', logo: 'http://logos.appscms.xyz/logos/2025/canalgoat.png' },

  // TV Aberta (Globo)
  globo: { name: 'TV Globo', url: 'http://topdnstop.lat:80/jajaita/123456/234262.m3u8', logo: '/logos/globo.png' }
};

// Pools de Emissoras por Categoria / Torneio
const BROADCAST_POOLS = {
  uefa_champions: ['tnt', 'space', 'max1', 'max2', 'max3', 'max5', 'max6'],
  uefa_europa: ['cazetv1', 'cazetv2', 'cazetv3', 'cazetv4', 'espn4', 'espn5'],
  uefa_nations: ['sportv', 'sportv2', 'sportv3', 'espn', 'espn2'],
  premier_league: ['espn', 'espn2', 'espn3', 'espn4', 'espn5'],
  la_liga: ['espn', 'espn2', 'espn3', 'espn4'],
  serie_a_italiana: ['espn2', 'espn3', 'espn4', 'espn'],
  bundesliga: ['cazetv1', 'cazetv2', 'goat1', 'sportv2'],
  ligue_1: ['cazetv1', 'cazetv2', 'cazetv3', 'espn3'],
  portugal: ['espn4', 'espn2'],
  libertadores: ['espn', 'espn2', 'paramount1', 'paramount2', 'sportv', 'globo'],
  sul_americana: ['espn', 'paramount1', 'paramount2', 'paramount3'],
  brasileirao_serie_a: ['premiere1', 'premiere2', 'premiere3', 'premiere4', 'premiere5', 'premiere6', 'sportv', 'prime1', 'globo'],
  brasileirao_serie_b: ['premiere1', 'premiere2', 'premiere3', 'premiere4', 'premiere5', 'premiere6', 'premiere7', 'premiere8', 'sportv'],
  copa_do_brasil: ['sportv', 'premiere1', 'premiere2', 'prime1', 'globo'],
  dazn_pool: ['dazn1', 'dazn2']
};

// Ligas suportadas pela API ESPN
const leagues = [
  // Brasil
  { code: 'bra.1', name: 'Brasileirão Série A', pool: 'brasileirao_serie_a' },
  { code: 'bra.2', name: 'Brasileirão Série B', pool: 'brasileirao_serie_b' },
  { code: 'bra.3', name: 'Brasileirão Série C', pool: 'dazn_pool' },
  { code: 'bra.copa_do_brasil', name: 'Copa do Brasil', pool: 'copa_do_brasil' },
  // Europa & Copas UEFA
  { code: 'uefa.champions', name: 'Champions League', pool: 'uefa_champions' },
  { code: 'uefa.europa', name: 'Europa League', pool: 'uefa_europa' },
  { code: 'uefa.europa.conf', name: 'Conference League', pool: 'uefa_europa' },
  { code: 'uefa.nations', name: 'UEFA Nations League', pool: 'uefa_nations' },
  // Ligas Nacionais
  { code: 'eng.1', name: 'Premier League', pool: 'premier_league' },
  { code: 'eng.2', name: 'Championship', pool: 'premier_league' },
  { code: 'eng.fa', name: 'Copa da Inglaterra', pool: 'premier_league' },
  { code: 'esp.1', name: 'La Liga', pool: 'la_liga' },
  { code: 'esp.copa_del_rey', name: 'Copa do Rei', pool: 'la_liga' },
  { code: 'ita.1', name: 'Serie A Italiana', pool: 'serie_a_italiana' },
  { code: 'ita.coppa_italia', name: 'Copa da Itália', pool: 'serie_a_italiana' },
  { code: 'ger.1', name: 'Bundesliga', pool: 'bundesliga' },
  { code: 'fra.1', name: 'Ligue 1', pool: 'ligue_1' },
  { code: 'por.1', name: 'Liga Portugal', pool: 'portugal' },
  // Conmebol & Amistosos
  { code: 'conmebol.libertadores', name: 'Libertadores', pool: 'libertadores' },
  { code: 'conmebol.sudamericana', name: 'Sul-Americana', pool: 'sul_americana' },
  { code: 'fifa.worldq.conmebol', name: 'Eliminatórias CONMEBOL', pool: 'brasileirao_serie_a' },
  { code: 'fifa.worldq.uefa', name: 'Eliminatórias UEFA', pool: 'uefa_nations' },
  { code: 'fifa.friendly', name: 'Amistoso Internacional', pool: 'uefa_nations' }
];

function fetchScoreboard(league) {
  return new Promise((resolve) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.code}/scoreboard`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate' } }, res => {
      if (res.statusCode !== 200) return resolve({ league, events: [] });
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

// Contador por pool para distribuir jogos simultâneos sem repetição
const poolCounters = {};

function resolveBroadcaster(league, rawBroadcasts) {
  const poolKey = league.pool || 'espn';
  const pool = BROADCAST_POOLS[poolKey] || BROADCAST_POOLS.premier_league;

  // Analisar se a transmissão já especifica uma emissora brasileira conhecida
  const rawText = (rawBroadcasts || []).join(' ').toLowerCase();

  if (rawText.includes('tnt')) return BROADCASTERS.tnt;
  if (rawText.includes('space')) return BROADCASTERS.space;
  if (rawText.includes('max') || rawText.includes('hbo')) return BROADCASTERS.max1;
  if (rawText.includes('caze') || rawText.includes('cazé')) return BROADCASTERS.cazetv1;
  if (rawText.includes('paramount')) return BROADCASTERS.paramount1;
  if (rawText.includes('prime')) return BROADCASTERS.prime1;
  if (rawText.includes('dazn')) return BROADCASTERS.dazn1;
  if (rawText.includes('goat')) return BROADCASTERS.goat1;

  if (rawText.includes('espn 2') || rawText.includes('espn2')) return BROADCASTERS.espn2;
  if (rawText.includes('espn 3') || rawText.includes('espn3')) return BROADCASTERS.espn3;
  if (rawText.includes('espn 4') || rawText.includes('espn4')) return BROADCASTERS.espn4;
  if (rawText.includes('espn')) return BROADCASTERS.espn;

  if (rawText.includes('sportv 2') || rawText.includes('sportv2')) return BROADCASTERS.sportv2;
  if (rawText.includes('sportv 3') || rawText.includes('sportv3')) return BROADCASTERS.sportv3;
  if (rawText.includes('sportv')) return BROADCASTERS.sportv;

  if (rawText.includes('premiere')) {
    // Premiere apenas se for liga brasileira
    if (poolKey.startsWith('brasileirao') || poolKey === 'copa_do_brasil') {
      const idx = (poolCounters[poolKey] || 0) % 8;
      poolCounters[poolKey] = (poolCounters[poolKey] || 0) + 1;
      const premKeys = ['premiere1', 'premiere2', 'premiere3', 'premiere4', 'premiere5', 'premiere6', 'premiere7', 'premiere8'];
      return BROADCASTERS[premKeys[idx]];
    }
  }

  // Rotação inteligente dentro do pool correto da competição
  if (!poolCounters[poolKey]) poolCounters[poolKey] = 0;
  const broadcasterKey = pool[poolCounters[poolKey] % pool.length];
  poolCounters[poolKey]++;

  return BROADCASTERS[broadcasterKey] || BROADCASTERS.espn;
}

async function updateMatches() {
  console.log('Buscando partidas em todas as ligas e copas na API ESPN...');
  const results = await Promise.all(leagues.map(fetchScoreboard));

  let fixedChannels = [];
  let header = '#EXTM3U url-tvg="https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz,https://epg.pw/xmltv/epg_BR.xml.gz"';

  if (fs.existsSync(playlistPath)) {
    const content = fs.readFileSync(playlistPath, 'utf8');
    const lines = content.split('\n');
    if (lines[0].startsWith('#EXTM3U')) header = lines[0];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l || l.startsWith('#EXTM3U')) continue;
      if (l.startsWith('#EXTINF:')) {
        const nextUrl = lines[i + 1] ? lines[i + 1].trim() : '';
        // Pular jogos antigos
        if (l.includes('group-title="⚽ Jogos do Dia"') || l.includes('group-title="📅 Jogos da Semana"')) {
          i++;
          continue;
        }
        fixedChannels.push({ ext: l, url: nextUrl });
        i++;
      }
    }
  }

  const now = new Date();
  const getBrazilDateParts = (d) => {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(d);
    return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
  };

  const todayStr = getBrazilDateParts(now);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const tomorrowStr = getBrazilDateParts(tomorrow);
  const endOfWeekStr = getBrazilDateParts(endOfWeek);

  console.log(`Hoje em Brasília: ${todayStr}`);
  console.log(`Semana em Brasília: ${tomorrowStr} até ${endOfWeekStr}`);

  const matchesToday = [];
  const matchesWeek = [];
  const richMatchesInfo = [];

  results.forEach(({ league, events }) => {
    events.forEach(e => {
      const eventDate = new Date(e.date);
      const eventDateStr = getBrazilDateParts(eventDate);

      const isToday = (eventDateStr === todayStr);
      const isWeek = (eventDateStr >= tomorrowStr && eventDateStr <= endOfWeekStr);

      if (!isToday && !isWeek) return;

      const comp = e.competitions && e.competitions[0];
      if (!comp) return;

      const homeComp = comp.competitors.find(c => c.homeAway === 'home');
      const awayComp = comp.competitors.find(c => c.homeAway === 'away');
      const home = homeComp ? homeComp.team.displayName : 'Casa';
      const away = awayComp ? awayComp.team.displayName : 'Fora';

      const homeLogo = homeComp?.team?.logo || homeComp?.team?.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/default-team-logo.png';
      const awayLogo = awayComp?.team?.logo || awayComp?.team?.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/default-team-logo.png';

      // Coletar nomes das emissoras da API
      const rawBroadcasts = [];
      if (comp.broadcasts && comp.broadcasts.length > 0) {
        comp.broadcasts.forEach(b => {
          if (b.names) rawBroadcasts.push(...b.names);
        });
      }

      // Roteamento inteligente de emissora
      const broadcaster = resolveBroadcaster(league, rawBroadcasts);

      // Data e Hora formatadas
      const timeStr = eventDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const fullDateStr = eventDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

      // Formato solicitado pelo usuário:
      // Flamengo x Fluminense - 15/08/2026 às 21h30 (Ao vivo em Premiere 1)
      const formattedTitle = `${home} x ${away} - ${fullDateStr} às ${timeStr} (Ao vivo em ${broadcaster.name})`;

      const entry = {
        id: e.id || `${home}-${away}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        homeTeam: home,
        awayTeam: away,
        homeLogo: homeLogo,
        awayLogo: awayLogo,
        homeScore: homeComp?.score || null,
        awayScore: awayComp?.score || null,
        statusState: comp.status?.type?.state || 'pre', // pre, in, post
        statusDetail: comp.status?.type?.shortDetail || comp.status?.type?.description || `${timeStr}`,
        clock: comp.status?.displayClock || null,
        title: formattedTitle,
        shortTitle: `${home} x ${away}`,
        fullDateStr: fullDateStr,
        timeStr: timeStr,
        league: league.name,
        leagueCode: league.code,
        channelName: broadcaster.name,
        logo: broadcaster.logo,
        streamUrl: broadcaster.url,
        isToday: isToday,
        date: eventDate
      };

      richMatchesInfo.push(entry);

      if (isToday) {
        matchesToday.push(entry);
      } else {
        matchesWeek.push(entry);
      }
    });
  });

  matchesToday.sort((a, b) => a.date - b.date);
  matchesWeek.sort((a, b) => a.date - b.date);
  richMatchesInfo.sort((a, b) => a.date - b.date);

  console.log(`\nJogos mapeados com sucesso:`);
  console.log(`- ⚽ Jogos do Dia (Hoje): ${matchesToday.length}`);
  console.log(`- 📅 Jogos da Semana: ${matchesWeek.length}`);

  // Gravar arquivo Canais de TV.m3u8
  let newM3U = header + '\n';

  matchesToday.forEach(m => {
    newM3U += `#EXTINF:-1 tvg-id="FutebolAoVivo.br" tvg-name="${m.title}" tvg-logo="${m.logo}" group-title="⚽ Jogos do Dia",${m.title}\n${m.streamUrl}\n`;
  });

  matchesWeek.forEach(m => {
    newM3U += `#EXTINF:-1 tvg-id="FutebolAoVivo.br" tvg-name="${m.title}" tvg-logo="${m.logo}" group-title="📅 Jogos da Semana",${m.title}\n${m.streamUrl}\n`;
  });

  fixedChannels.forEach(c => {
    newM3U += `${c.ext}\n${c.url}\n`;
  });

  fs.writeFileSync(playlistPath, newM3U, 'utf8');
  console.log(`✅ "Canais de TV.m3u8" regravado com sucesso!`);

  // Salvar jogos_info.json para alimentar o Match Center com escudos e estatísticas
  fs.writeFileSync(gamesJsonPath, JSON.stringify(richMatchesInfo, null, 2), 'utf8');
  console.log(`✅ "jogos_info.json" gerado para o Match Center e Web Studio!`);
}

updateMatches();
