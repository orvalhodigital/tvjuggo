/**
 * Juggo TV - Futebol Hub: Classificações & Jogos em Tempo Real
 * - Dados ao vivo da ESPN (Brasileirão, Champions, Premier League, La Liga, Serie A, Libertadores)
 * - Tabela de classificação com escudos oficiais, pontos, vitórias, saldo de gols e zonas de tabela
 * - Jogos da rodada com vinculação direta aos canais de transmissão do Juggo TV
 */

const https = require('https');
const zlib = require('zlib');

const LEAGUES = [
    { id: 'bra.1', name: 'Brasileirão Série A', flag: '🇧🇷', defaultChannel: 'Premiere 1' },
    { id: 'uefa.champions', name: 'Champions League', flag: '🏆', defaultChannel: 'TNT' },
    { id: 'eng.1', name: 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', defaultChannel: 'ESPN' },
    { id: 'esp.1', name: 'La Liga', flag: '🇪🇸', defaultChannel: 'ESPN' },
    { id: 'ita.1', name: 'Serie A Italiana', flag: '🇮🇹', defaultChannel: 'ESPN 2' },
    { id: 'conmebol.libertadores', name: 'Libertadores', flag: '🌎', defaultChannel: 'ESPN / SporTV' }
];

const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate' }, timeout: 8000 }, (res) => {
            if (res.statusCode !== 200) return resolve(null);
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                try {
                    let buf = Buffer.concat(chunks);
                    const enc = res.headers['content-encoding'];
                    if (enc === 'gzip') buf = zlib.gunzipSync(buf);
                    else if (enc === 'deflate') buf = zlib.inflateSync(buf);
                    resolve(JSON.parse(buf.toString('utf8')));
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function getLeagueData(leagueId) {
    const cached = cache.get(leagueId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }

    const leagueInfo = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
    const standingsUrl = `https://site.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`;
    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard`;

    const [standingsRaw, scoreboardRaw] = await Promise.all([
        fetchJson(standingsUrl),
        fetchJson(scoreboardUrl)
    ]);

    // Parse Standings
    const standings = [];
    try {
        const entries = standingsRaw?.children?.[0]?.standings?.entries || [];
        entries.forEach((e, idx) => {
            const team = e.team || {};
            const stats = {};
            (e.stats || []).forEach(s => { stats[s.name] = s.displayValue || s.value; });

            standings.push({
                position: idx + 1,
                teamName: team.displayName || team.name || 'Clube',
                shortName: team.shortDisplayName || team.abbreviation || team.name,
                logo: team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo.png',
                points: stats.points || '0',
                played: stats.gamesPlayed || '0',
                won: stats.wins || '0',
                drawn: stats.ties || '0',
                lost: stats.losses || '0',
                gd: stats.pointDifferential || '0'
            });
        });
    } catch (e) {
        console.error(`[FutebolHub] Erro parse standings ${leagueId}:`, e.message);
    }

    // Parse Matches
    const matches = [];
    try {
        const events = scoreboardRaw?.events || [];
        events.forEach(e => {
            const comp = e.competitions?.[0];
            if (!comp) return;

            const home = comp.competitors?.find(c => c.homeAway === 'home');
            const away = comp.competitors?.find(c => c.homeAway === 'away');

            const eventDate = new Date(e.date);
            const timeStr = eventDate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
            const dateStr = eventDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });

            let broadcaster = leagueInfo.defaultChannel;
            if (comp.broadcasts && comp.broadcasts.length > 0) {
                const names = [];
                comp.broadcasts.forEach(b => { if (b.names) names.push(...b.names); });
                if (names.length > 0) broadcaster = names.slice(0, 2).join(' / ');
            }

            matches.push({
                id: e.id,
                title: e.name,
                homeTeam: home?.team?.displayName || 'Casa',
                homeLogo: home?.team?.logo || 'https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo.png',
                homeScore: home?.score || '',
                awayTeam: away?.team?.displayName || 'Fora',
                awayLogo: away?.team?.logo || 'https://a.espncdn.com/i/teamlogos/soccer/500/default-team-logo.png',
                awayScore: away?.score || '',
                date: dateStr,
                time: timeStr,
                status: comp.status?.type?.shortDetail || 'Agendado',
                isLive: comp.status?.type?.state === 'in',
                broadcaster: broadcaster
            });
        });
    } catch (e) {
        console.error(`[FutebolHub] Erro parse matches ${leagueId}:`, e.message);
    }

    const data = {
        league: leagueInfo,
        standings,
        matches,
        updatedAt: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    };

    cache.set(leagueId, { data, timestamp: Date.now() });
    return data;
}

function getAvailableLeagues() {
    return LEAGUES;
}

module.exports = {
    getAvailableLeagues,
    getLeagueData
};
