/**
 * Juggo TV - Central Poliesportiva (Futebol, Basquete, Vôlei, NFL)
 * - Dados ao vivo da ESPN:
 *   - ⚽ Futebol: Brasileirão Série A, Champions League, Premier League, La Liga, Serie A, Libertadores
 *   - 🏀 Basquete: NBA (Conferências Leste e Oeste) e NCAA Basquete
 *   - 🏐 Vôlei: Torneios e Ligas Internacionais
 *   - 🏈 Futebol Americano: NFL
 * - Tabelas de classificação em tempo real com escudos e estatísticas
 * - Jogos com vinculação direta aos canais de transmissão do Juggo TV (ESPN, SporTV, Premiere, etc.)
 */

const https = require('https');
const zlib = require('zlib');

const LEAGUES = [
    // Futebol
    { id: 'bra.1', sport: 'soccer', name: 'Brasileirão Série A', category: 'Futebol', flag: '🇧🇷', defaultChannel: 'Premiere 1' },
    { id: 'uefa.champions', sport: 'soccer', name: 'Champions League', category: 'Futebol', flag: '🏆', defaultChannel: 'TNT' },
    { id: 'eng.1', sport: 'soccer', name: 'Premier League', category: 'Futebol', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', defaultChannel: 'ESPN' },
    { id: 'esp.1', sport: 'soccer', name: 'La Liga', category: 'Futebol', flag: '🇪🇸', defaultChannel: 'ESPN' },
    { id: 'ita.1', sport: 'soccer', name: 'Serie A Italiana', category: 'Futebol', flag: '🇮🇹', defaultChannel: 'ESPN 2' },
    { id: 'conmebol.libertadores', sport: 'soccer', name: 'Libertadores', category: 'Futebol', flag: '🌎', defaultChannel: 'ESPN / SporTV' },

    // Basquete
    { id: 'nba', sport: 'basketball', name: 'NBA (Basquete)', category: 'Basquete', flag: '🏀', defaultChannel: 'ESPN 2 / SporTV 2' },
    { id: 'mens-college-basketball', sport: 'basketball', name: 'NCAA Basquete', category: 'Basquete', flag: '🏀', defaultChannel: 'ESPN 3' },

    // Vôlei
    { id: 'mens-college-volleyball', sport: 'volleyball', name: 'Vôlei Internacional', category: 'Vôlei', flag: '🏐', defaultChannel: 'SporTV 2' },

    // Futebol Americano
    { id: 'nfl', sport: 'football', name: 'NFL (Futebol Americano)', category: 'Futebol Americano', flag: '🏈', defaultChannel: 'ESPN 2' }
];

const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

function fetchJson(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept-Encoding': 'gzip, deflate' }, timeout: 8000 }, (res) => {
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
    const sportType = leagueInfo.sport || 'soccer';
    const standingsUrl = `https://site.api.espn.com/apis/v2/sports/${sportType}/${leagueId}/standings`;
    const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportType}/${leagueId}/scoreboard`;

    const [standingsRaw, scoreboardRaw] = await Promise.all([
        fetchJson(standingsUrl),
        fetchJson(scoreboardUrl)
    ]);

    // Parse Standings (Compatível com Futebol, NBA, Vôlei e NFL)
    const standings = [];
    try {
        let entries = [];
        if (standingsRaw?.children && standingsRaw.children.length > 0) {
            standingsRaw.children.forEach(group => {
                const confName = group.name ? ` (${group.name})` : '';
                (group.standings?.entries || []).forEach(e => {
                    e._conf = confName;
                    entries.push(e);
                });
            });
        }

        entries.forEach((e, idx) => {
            const team = e.team || {};
            const stats = {};
            (e.stats || []).forEach(s => { stats[s.name] = s.displayValue || s.value; });

            const pts = stats.points || stats.W || stats.wins || '0';
            const played = stats.gamesPlayed || stats.GP || (parseInt(stats.wins || 0) + parseInt(stats.losses || 0)).toString();
            const won = stats.wins || stats.W || '0';
            const diff = stats.pointDifferential || stats.DIFF || stats.PCT || '0';

            standings.push({
                position: idx + 1,
                teamName: (team.displayName || team.name || 'Equipe') + (e._conf || ''),
                shortName: team.shortDisplayName || team.abbreviation || team.name,
                logo: team.logos?.[0]?.href || 'https://a.espncdn.com/i/teamlogos/default-team-logo.png',
                points: pts,
                played: played,
                won: won,
                gd: diff
            });
        });
    } catch (e) {
        console.error(`[SportsHub] Erro parse standings ${leagueId}:`, e.message);
    }

    // Parse Matches - Coleta a rodada completa (hoje + próximas datas do calendário)
    const matches = [];
    try {
        let allEvents = scoreboardRaw?.events ? [...scoreboardRaw.events] : [];

        // Se houver calendário de rodada, puxar as próximas 4 datas com jogos para completar a rodada
        if (scoreboardRaw?.leagues?.[0]?.calendar && scoreboardRaw.leagues[0].calendar.length > 0) {
            const cal = scoreboardRaw.leagues[0].calendar;
            const now = new Date();

            const extractDateStrings = (items) => {
                const dates = [];
                if (!Array.isArray(items)) return dates;
                for (const item of items) {
                    if (typeof item === 'string') {
                        dates.push(item);
                    } else if (item && typeof item === 'object') {
                        if (typeof item.startDate === 'string') dates.push(item.startDate);
                        else if (typeof item.date === 'string') dates.push(item.date);
                        if (Array.isArray(item.entries)) dates.push(...extractDateStrings(item.entries));
                    }
                }
                return dates;
            };

            const rawDates = extractDateStrings(cal);
            const futureDates = rawDates
                .filter(d => typeof d === 'string' && d.length >= 10)
                .map(d => d.slice(0, 10).replace(/-/g, ''))
                .filter((d, idx, arr) => arr.indexOf(d) === idx)
                .filter(d => {
                    const dDate = new Date(d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8));
                    return dDate >= new Date(now.getTime() - 24 * 3600 * 1000);
                })
                .slice(0, 4);

            const extraResults = await Promise.all(futureDates.map(dateStr => fetchJson(`${scoreboardUrl}?dates=${dateStr}`)));
            extraResults.forEach(r => {
                if (r?.events) {
                    r.events.forEach(ev => {
                        if (!allEvents.some(existing => existing.id === ev.id)) {
                            allEvents.push(ev);
                        }
                    });
                }
            });
        }

        allEvents.forEach(e => {
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
                homeLogo: home?.team?.logo || 'https://a.espncdn.com/i/teamlogos/default-team-logo.png',
                homeScore: home?.score || '',
                awayTeam: away?.team?.displayName || 'Fora',
                awayLogo: away?.team?.logo || 'https://a.espncdn.com/i/teamlogos/default-team-logo.png',
                awayScore: away?.score || '',
                date: dateStr,
                time: timeStr,
                status: comp.status?.type?.shortDetail || 'Agendado',
                isLive: comp.status?.type?.state === 'in',
                broadcaster: broadcaster
            });
        });
    } catch (e) {
        console.error(`[SportsHub] Erro parse matches ${leagueId}:`, e.message);
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

function clearCache() {
    cache.clear();
}

async function preloadAll() {
    console.log('[SportsHub] Pré-carregando ligas poliesportivas em segundo plano...');
    for (const league of LEAGUES) {
        try {
            await getLeagueData(league.id);
        } catch (e) {}
    }
    console.log('[SportsHub] Todas as ligas foram pré-carregadas com sucesso!');
}

function getAvailableLeagues() {
    return LEAGUES;
}

module.exports = {
    getAvailableLeagues,
    getLeagueData,
    clearCache,
    preloadAll
};
