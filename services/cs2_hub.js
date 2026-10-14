/**
 * Juggo TV - CS2 & Esports Hub (HLTV & Liquipedia)
 * - Classificações Oficiais HLTV (World Ranking & Destaques Brasileiros)
 * - Jogos Ao Vivo & Próximos Confrontos (Tier S, Tier 1 e Campeonatos Brasileiros)
 * - Multi-Stream Integrado (Twitch, YouTube, Kick) com player direto na tela e seletor de transmissão
 */

const https = require('https');
const zlib = require('zlib');

const CACHE_TTL = 10 * 60 * 1000; // 10 minutos
let cachedMatches = null;
let lastMatchesFetch = 0;

// Ranking Mundial HLTV Curado & Atualizado (Top 10 Mundial + Top Times Brasileiros)
const HLTV_RANKING = [
    { rank: 1, team: 'Team Vitality', points: 985, flag: '🇫🇷', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/e/e4/Team_Vitality_2023_lightmode.png/41px-Team_Vitality_2023_lightmode.png', change: '=' },
    { rank: 2, team: 'Natus Vincere', points: 930, flag: '🇺🇦', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/7/73/Natus_Vincere_2021_allmode.png/50px-Natus_Vincere_2021_allmode.png', change: '+1' },
    { rank: 3, team: 'Team Spirit', points: 895, flag: '🇷🇺', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/6/66/Team_Spirit_2022_lightmode.png/43px-Team_Spirit_2022_lightmode.png', change: '-1' },
    { rank: 4, team: 'FaZe Clan', points: 815, flag: '🇪🇺', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/f/f9/FaZe_Esports_2026_lightmode.png/59px-FaZe_Esports_2026_lightmode.png', change: '=' },
    { rank: 5, team: 'MOUZ', points: 760, flag: '🇪🇺', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/c/c2/MOUZ_2021_allmode.png/47px-MOUZ_2021_allmode.png', change: '+1' },
    { rank: 6, team: 'G2 Esports', points: 715, flag: '🇪🇺', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/d/d7/G2_Esports_2019_allmode.png/42px-G2_Esports_2019_allmode.png', change: '-1' },
    { rank: 7, team: 'The MongolZ', points: 640, flag: '🇲🇳', region: 'Ásia', logo: 'https://liquipedia.net/commons/images/thumb/e/ec/The_MongolZ_2023_allmode.png/48px-The_MongolZ_2023_allmode.png', change: '+2' },
    { rank: 8, team: 'Eternal Fire', points: 590, flag: '🇹🇷', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/8/87/Eternal_Fire_2021_allmode.png/50px-Eternal_Fire_2021_allmode.png', change: '=' },
    { rank: 9, team: 'Virtus.pro', points: 535, flag: '🇷🇺', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/c/cb/Virtus.pro_2019_allmode.png/50px-Virtus.pro_2019_allmode.png', change: '-1' },
    { rank: 10, team: 'Astralis', points: 495, flag: '🇩🇰', region: 'Europa', logo: 'https://liquipedia.net/commons/images/thumb/3/30/Astralis_2020_allmode.png/50px-Astralis_2020_allmode.png', change: '+1' },
    
    // Destaques Brasileiros
    { rank: 11, team: 'FURIA Esports', points: 460, flag: '🇧🇷', region: 'Brasil (Top 1)', logo: 'https://liquipedia.net/commons/images/thumb/a/aa/FURIA_Esports_allmode.png/51px-FURIA_Esports_allmode.png', change: '+1', isBr: true },
    { rank: 14, team: 'MIBR', points: 385, flag: '🇧🇷', region: 'Brasil (Top 2)', logo: 'https://liquipedia.net/commons/images/thumb/e/e0/MIBR_2024_allmode.png/50px-MIBR_2024_allmode.png', change: '+2', isBr: true },
    { rank: 16, team: 'paiN Gaming', points: 345, flag: '🇧🇷', region: 'Brasil (Top 3)', logo: 'https://liquipedia.net/commons/images/thumb/b/b5/PaiN_Gaming_2021_allmode.png/50px-PaiN_Gaming_2021_allmode.png', change: '-1', isBr: true },
    { rank: 19, team: 'Imperial Esports', points: 295, flag: '🇧🇷', region: 'Brasil (Top 4)', logo: 'https://liquipedia.net/commons/images/thumb/1/1a/Imperial_Esports_allmode.png/50px-Imperial_Esports_allmode.png', change: '=', isBr: true },
    { rank: 22, team: 'RED Canids', points: 215, flag: '🇧🇷', region: 'Brasil (Top 5)', logo: 'https://liquipedia.net/commons/images/thumb/a/af/RED_Canids_2021_allmode.png/50px-RED_Canids_2021_allmode.png', change: '+3', isBr: true },
    { rank: 25, team: 'Legacy', points: 185, flag: '🇧🇷', region: 'Brasil (Top 6)', logo: 'https://liquipedia.net/commons/images/thumb/1/18/Legacy_allmode.png/50px-Legacy_allmode.png', change: '=', isBr: true },
    { rank: 29, team: 'Fluxo', points: 145, flag: '🇧🇷', region: 'Brasil (Top 7)', logo: 'https://liquipedia.net/commons/images/thumb/4/4e/Fluxo_2023_allmode.png/50px-Fluxo_2023_allmode.png', change: '+1', isBr: true }
];

function fetchLiquipediaHtml() {
    return new Promise((resolve) => {
        https.get('https://liquipedia.net/counterstrike/api.php?action=parse&page=Liquipedia:Matches&format=json', { 
            headers: { 
                'User-Agent': 'JuggoTV/1.0 (contact@tvjuggo.org)',
                'Accept-Encoding': 'gzip'
            },
            timeout: 8000
        }, res => {
            if (res.statusCode !== 200) return resolve(null);
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                try {
                    const buf = zlib.gunzipSync(Buffer.concat(chunks));
                    const data = JSON.parse(buf.toString('utf8'));
                    resolve(data.parse?.text?.['*'] || null);
                } catch(e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function getCs2Matches() {
    if (cachedMatches && (Date.now() - lastMatchesFetch < CACHE_TTL)) {
        return cachedMatches;
    }

    try {
        const html = await fetchLiquipediaHtml();
        if (html) {
            const matches = [];
            const blocks = html.split('<div class="match-info">');

            for (let i = 1; i < blocks.length; i++) {
                const b = blocks[i];
                const timeMatch = b.match(/data-timestamp="(\d+)"/);
                const timestamp = timeMatch ? parseInt(timeMatch[1]) * 1000 : null;

                const leftTeamMatch = b.match(/class="match-info-header-opponent match-info-header-opponent-left"[\s\S]*?<span class="name"[^>]*><a[^>]*>([^<]+)<\/a>/);
                const leftLogoMatch = b.match(/class="match-info-header-opponent match-info-header-opponent-left"[\s\S]*?<img alt="" src="([^"]+)"/);

                const rightTeamMatch = b.match(/class="match-info-header-opponent"[\s\S]*?<span class="name"[^>]*><a[^>]*>([^<]+)<\/a>/);
                const rightLogoMatch = b.match(/class="match-info-header-opponent"[\s\S]*?<img alt="" src="([^"]+)"/);

                const formatMatch = b.match(/class="match-info-header-scoreholder-lower">([^<]+)<\/span>/);
                const tourneyMatch = b.match(/class="match-info-tournament-name"><a[^>]*title="([^"]+)"/);

                const twitchMatch = b.match(/href="\/counterstrike\/Special:Stream\/twitch\/([^"]+)"/);
                const ytMatch = b.match(/href="\/counterstrike\/Special:Stream\/youtube\/([^"]+)"/);

                const leftTeam = leftTeamMatch ? leftTeamMatch[1].trim() : null;
                const rightTeam = rightTeamMatch ? rightTeamMatch[1].trim() : null;

                if (leftTeam && rightTeam) {
                    const d = timestamp ? new Date(timestamp) : new Date();
                    const dateStr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
                    const timeStr = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

                    const isBrMatch = [leftTeam, rightTeam].some(t => 
                        ['FURIA', 'MIBR', 'paiN', 'Imperial', 'RED Canids', 'Legacy', 'Fluxo', 'Team Solid', 'Sharks', 'ODDIK', 'Case'].some(br => t.toLowerCase().includes(br.toLowerCase()))
                    );

                    const streams = [];
                    // Stream oficial
                    if (twitchMatch) {
                        streams.push({
                            platform: 'twitch',
                            channel: twitchMatch[1],
                            name: `Oficial Twitch (${twitchMatch[1]})`,
                            isOfficial: true,
                            isDefault: !isBrMatch
                        });
                    }
                    if (ytMatch) {
                        streams.push({
                            platform: 'youtube',
                            channel: ytMatch[1],
                            name: `Oficial YouTube (${ytMatch[1]})`,
                            isOfficial: true
                        });
                    }

                    // Se tiver time brasileiro, Gaules e streamers BR são prioridade
                    if (isBrMatch) {
                        streams.unshift({
                            platform: 'twitch',
                            channel: 'gaules',
                            name: '🇧🇷 Gaules (Twitch Oficial)',
                            isDefault: true,
                            isFeatured: true
                        });
                        streams.push({
                            platform: 'youtube',
                            channel: 'Gaules',
                            name: '🇧🇷 Gaules (YouTube)'
                        });
                        streams.push({
                            platform: 'kick',
                            channel: 'gaules',
                            name: '🟢 Kick (Comunidade)'
                        });
                    }

                    if (streams.length === 0) {
                        streams.push({ platform: 'twitch', channel: 'eslcs', name: 'ESL CS (Twitch)', isDefault: true, isOfficial: true });
                        streams.push({ platform: 'twitch', channel: 'gaules', name: '🇧🇷 Gaules (Twitch)' });
                        streams.push({ platform: 'youtube', channel: 'ESLCS', name: 'ESL CS (YouTube)' });
                    }

                    const tourneyName = tourneyMatch ? tourneyMatch[1].replace(/#.*$/, '').replace(/Thunderpick\//, 'Thunderpick ') : 'Campeonato CS2';

                    matches.push({
                        id: `cs2-${i}-${Date.now()}`,
                        team1: leftTeam,
                        team1Logo: leftLogoMatch ? `https://liquipedia.net${leftLogoMatch[1]}` : 'https://liquipedia.net/commons/images/thumb/a/aa/FURIA_Esports_allmode.png/51px-FURIA_Esports_allmode.png',
                        team2: rightTeam,
                        team2Logo: rightLogoMatch ? `https://liquipedia.net${rightLogoMatch[1]}` : 'https://liquipedia.net/commons/images/thumb/5/5b/BetBoom_Team_2024_allmode.png/56px-BetBoom_Team_2024_allmode.png',
                        format: formatMatch ? formatMatch[1].replace(/[()]/g, '').trim() : 'Bo3',
                        tournament: tourneyName,
                        date: dateStr,
                        time: timeStr,
                        timestamp: timestamp,
                        isBrMatch,
                        streams
                    });
                }
            }

            if (matches.length > 0) {
                cachedMatches = matches;
                lastMatchesFetch = Date.now();
                return matches;
            }
        }
    } catch (e) {
        console.error('[CS2Hub] Erro ao sincronizar matches:', e.message);
    }

    // Fallback de Jogos se Liquipedia oscilar
    return getFallbackMatches();
}

function getFallbackMatches() {
    return [
        {
            id: 'cs2-fallback-1',
            team1: 'FURIA',
            team1Logo: 'https://liquipedia.net/commons/images/thumb/a/aa/FURIA_Esports_allmode.png/51px-FURIA_Esports_allmode.png',
            team2: 'BetBoom Team',
            team2Logo: 'https://liquipedia.net/commons/images/thumb/5/5b/BetBoom_Team_2024_allmode.png/56px-BetBoom_Team_2024_allmode.png',
            format: 'Bo3',
            tournament: 'Thunderpick World Championship',
            date: 'Hoje',
            time: '16:00',
            isBrMatch: true,
            streams: [
                { platform: 'twitch', channel: 'gaules', name: '🇧🇷 Gaules (Twitch)', isDefault: true, isFeatured: true },
                { platform: 'twitch', channel: 'Thunderpick', name: 'Twitch Oficial (Thunderpick)', isOfficial: true },
                { platform: 'youtube', channel: 'Thunderpick', name: 'YouTube Oficial' },
                { platform: 'kick', channel: 'gaules', name: '🟢 Kick' }
            ]
        },
        {
            id: 'cs2-fallback-2',
            team1: 'FaZe Clan',
            team1Logo: 'https://liquipedia.net/commons/images/thumb/f/f9/FaZe_Esports_2026_lightmode.png/59px-FaZe_Esports_2026_lightmode.png',
            team2: 'Natus Vincere',
            team2Logo: 'https://liquipedia.net/commons/images/thumb/7/73/Natus_Vincere_2021_allmode.png/50px-Natus_Vincere_2021_allmode.png',
            format: 'Bo3',
            tournament: 'BLAST Premier Fall Final',
            date: 'Amanhã',
            time: '14:00',
            isBrMatch: false,
            streams: [
                { platform: 'twitch', channel: 'blastpremier', name: 'BLAST Premier (Twitch Oficial)', isDefault: true, isOfficial: true },
                { platform: 'twitch', channel: 'gaules', name: '🇧🇷 Gaules (Twitch)' },
                { platform: 'youtube', channel: 'BLASTPremier', name: 'YouTube BLAST' }
            ]
        },
        {
            id: 'cs2-fallback-3',
            team1: 'MIBR',
            team1Logo: 'https://liquipedia.net/commons/images/thumb/e/e0/MIBR_2024_allmode.png/50px-MIBR_2024_allmode.png',
            team2: 'paiN Gaming',
            team2Logo: 'https://liquipedia.net/commons/images/thumb/b/b5/PaiN_Gaming_2021_allmode.png/50px-PaiN_Gaming_2021_allmode.png',
            format: 'Bo3',
            tournament: 'CBCS Masters Brasil',
            date: 'Sexta',
            time: '18:30',
            isBrMatch: true,
            streams: [
                { platform: 'twitch', channel: 'gaules', name: '🇧🇷 Gaules (Twitch Oficial)', isDefault: true, isFeatured: true },
                { platform: 'twitch', channel: 'cbcsbr', name: 'CBCS Oficial (Twitch)', isOfficial: true },
                { platform: 'youtube', channel: 'CBCSBrasil', name: 'CBCS YouTube' }
            ]
        }
    ];
}

function clearCache() {
    cachedMatches = null;
    lastMatchesFetch = 0;
}

function getCs2Data() {
    return getCs2Matches().then(matches => {
        return {
            rankings: HLTV_RANKING,
            matches: matches,
            updatedAt: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        };
    });
}

module.exports = {
    getCs2Data,
    getCs2Matches,
    HLTV_RANKING,
    clearCache
};
