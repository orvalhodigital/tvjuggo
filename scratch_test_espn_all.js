const https = require('https');
const zlib = require('zlib');

const leagues = [
  // Brasil
  { code: 'bra.1', name: 'Brasileirão Série A' },
  { code: 'bra.2', name: 'Brasileirão Série B' },
  { code: 'bra.copa_do_brasil', name: 'Copa do Brasil' },
  // Inglaterra
  { code: 'eng.1', name: 'Premier League' },
  { code: 'eng.2', name: 'Championship' },
  { code: 'eng.fa', name: 'Copa da Inglaterra' },
  { code: 'eng.league_cup', name: 'Copa da Liga Inglesa' },
  // Espanha
  { code: 'esp.1', name: 'La Liga' },
  { code: 'esp.2', name: 'La Liga 2' },
  { code: 'esp.copa_del_rey', name: 'Copa do Rei' },
  // Itália
  { code: 'ita.1', name: 'Serie A Italiana' },
  { code: 'ita.coppa_italia', name: 'Copa da Itália' },
  // Alemanha
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'ger.dfb_pokal', name: 'Copa da Alemanha' },
  // França
  { code: 'fra.1', name: 'Ligue 1' },
  // Portugal
  { code: 'por.1', name: 'Liga Portugal' },
  { code: 'por.taca_de_portugal', name: 'Taça de Portugal' },
  // UEFA & Conmebol
  { code: 'uefa.champions', name: 'Champions League' },
  { code: 'uefa.europa', name: 'Europa League' },
  { code: 'uefa.europa.conf', name: 'Conference League' },
  { code: 'uefa.nations', name: 'UEFA Nations League' },
  { code: 'conmebol.libertadores', name: 'Libertadores' },
  { code: 'conmebol.sudamericana', name: 'Sul-Americana' },
  // FIFA & Seleções
  { code: 'fifa.worldq.conmebol', name: 'Eliminatórias CONMEBOL' },
  { code: 'fifa.worldq.uefa', name: 'Eliminatórias UEFA' },
  { code: 'fifa.friendly', name: 'Amistosos Internacionais' }
];

function fetchScoreboard(code) {
  return new Promise((resolve) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate' } }, res => {
      if (res.statusCode !== 200) {
        return resolve([]);
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
          resolve(json.events || []);
        } catch(e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

(async () => {
  let totalEvents = 0;
  for (const l of leagues) {
    const events = await fetchScoreboard(l.code);
    if (events.length > 0) {
      console.log(`[${l.name}] ${events.length} jogos encontrados`);
      totalEvents += events.length;
      events.slice(0, 3).forEach(e => {
        const d = new Date(e.date);
        const home = e.competitions[0].competitors.find(c => c.homeAway === 'home')?.team?.displayName || 'Casa';
        const away = e.competitions[0].competitors.find(c => c.homeAway === 'away')?.team?.displayName || 'Fora';
        const broadcasts = (e.competitions[0].broadcasts || []).map(b => (b.names || []).join('/'));
        console.log(`  -> ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}: ${home} x ${away} (TV: ${broadcasts.join(', ') || 'N/D'})`);
      });
    }
  }
  console.log(`\nTotal geral de eventos: ${totalEvents}`);
})();
