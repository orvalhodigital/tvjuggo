/**
 * Juggo TV - Servidor Autônomo de IPTV, Futebol Hub & Painel Administrativo
 * - Layout Inteligente Estilo Smart TV (Menus em overlay translúcido na frente do canal)
 * - Navegação Fluida por Teclado (Setas Direita/Esquerda/Cima/Baixo) e Mouse
 * - Auto-hide dos Menus em 7 segundos para experiência de TV imersiva
 * - Memória de Canal: Lembra o último canal assistido e abre automaticamente nele
 * - Buffer Anti-Travamento HLS de alta tolerância (60s buffer + liveSyncDurationCount 5)
 * - Módulo Exclusivo Futebol Hub: Classificações ao vivo e jogos com sintonização em 1 clique
 * - Redundância Multi-Server (Plano C) e Modo REDIRECT 302 para zero consumo de banda na GCP
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch(e) {}

const { handleAdminRoutes, initAutonomousSchedulers } = require('./admin_panel');
const footballHub = require('./services/football_hub');
const channelHealth = require('./services/channel_health');
const aiScheduler = require('./services/ai_scheduler');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_NAME = process.env.APP_NAME || 'Juggo TV';
const SECURITY_TOKEN = process.env.SECURITY_TOKEN || '';
let STREAM_MODE = (process.env.STREAM_MODE || 'REDIRECT').toUpperCase();

const M3U_PATH = path.join(__dirname, 'Canais de TV.m3u8');
const QUALITIES_FILE = path.join(__dirname, 'channel_qualities.json');

const channels = new Map();
const activeStats = new Map();

// Redundância Multi-Server (Plano C - Servidores Reservas)
const BACKUP_SERVERS = ['185.245.80.148:80', 'corruptx.org', 'dbonline.tech-cdn.top:80'];

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'canal';
}

// Carregamento dinâmico de qualidades (4K, FHD, HD, SD)
let CHANNEL_QUALITIES = {};
function loadQualities() {
    try {
        if (fs.existsSync(QUALITIES_FILE)) {
            CHANNEL_QUALITIES = JSON.parse(fs.readFileSync(QUALITIES_FILE, 'utf8'));
            console.log(`[Qualidades] Carregadas 4K/FHD/HD/SD para ${Object.keys(CHANNEL_QUALITIES).length} canais.`);
        }
    } catch (err) {
        console.error('[Qualidades] Erro ao carregar channel_qualities.json:', err.message);
    }
}
loadQualities();

fs.watchFile(QUALITIES_FILE, { interval: 1500 }, () => {
    console.log('[AutoReload] channel_qualities.json foi modificado. Recarregando qualidades...');
    loadQualities();
    loadChannels();
});

// Carregar Canais do arquivo M3U8
function loadChannels() {
    channels.clear();
    if (!fs.existsSync(M3U_PATH)) {
        console.error('Arquivo Canais de TV.m3u8 não encontrado!');
        return;
    }

    const content = fs.readFileSync(M3U_PATH, 'utf8');
    const lines = content.split('\n');

    let currentExt = null;
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
            currentExt = line;
        } else if (line.startsWith('http') && currentExt) {
            const rawUrl = line;
            const nameMatch = currentExt.match(/,([^\r\n]+)$/);
            const channelName = nameMatch ? nameMatch[1].trim() : 'Canal Sem Nome';

            const groupMatch = currentExt.match(/group-title="([^"]+)"/);
            const group = groupMatch ? groupMatch[1].trim() : 'Outros';

            const logoMatch = currentExt.match(/tvg-logo="([^"]+)"/);
            const logo = logoMatch ? logoMatch[1].trim() : 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';

            const idMatch = currentExt.match(/tvg-id="([^"]+)"/);
            const tvgId = idMatch ? idMatch[1].trim() : '';

            let slug = slugify(channelName);
            let uniqueSlug = slug;
            let counter = 2;
            while (channels.has(uniqueSlug) && channels.get(uniqueSlug).name !== channelName) {
                uniqueSlug = `${slug}-${counter++}`;
            }

            if (!channels.has(uniqueSlug)) {
                channels.set(uniqueSlug, {
                    id: uniqueSlug,
                    name: channelName,
                    group: group,
                    logo: logo,
                    tvgId: tvgId,
                    rawExt: currentExt,
                    urls: [rawUrl],
                    qualities: CHANNEL_QUALITIES[uniqueSlug] || null
                });
                count++;
            } else {
                const existing = channels.get(uniqueSlug);
                if (!existing.urls.includes(rawUrl)) {
                    existing.urls.push(rawUrl);
                }
            }
            currentExt = null;
        }
    }

    console.log(`[Canais] Carregados ${channels.size} canais em .m3u8.`);
}

fs.watchFile(M3U_PATH, { interval: 1500 }, () => {
    console.log('[AutoReload] Canais de TV.m3u8 foi modificado. Recarregando canais...');
    loadChannels();
});

function fetchAndResolveM3u8(initialUrl) {
    return new Promise(resolve => {
        function get(currentUrl, depth) {
            if (depth > 6) return resolve(null);
            try {
                const parsed = new URL(currentUrl);
                const clientLib = parsed.protocol === 'https:' ? https : http;
                const req = clientLib.get({
                    hostname: parsed.hostname,
                    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                    path: parsed.pathname + parsed.search,
                    headers: {
                        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
                        'Accept': '*/*'
                    },
                    timeout: 8000
                }, res => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        let next = res.headers.location;
                        if (next.startsWith('/')) {
                            next = `${parsed.protocol}//${parsed.host}${next}`;
                        }
                        return get(next, depth + 1);
                    }
                    if (res.statusCode !== 200) {
                        return resolve(null);
                    }

                    const contentType = res.headers['content-type'] || '';
                    if (contentType.includes('video/mp2t') || currentUrl.includes('.ts')) {
                        const hlsWrap = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:10.000,\n${currentUrl}\n`;
                        return resolve({ body: hlsWrap, finalUrl: currentUrl });
                    }

                    let body = '';
                    res.on('data', c => {
                        body += c;
                        if (body.length > 500000 && !body.includes('#EXTM3U')) {
                            req.destroy();
                            const hlsWrap = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:10.000,\n${currentUrl}\n`;
                            return resolve({ body: hlsWrap, finalUrl: currentUrl });
                        }
                    });

                    res.on('end', () => {
                        if (body.includes('#EXTM3U')) {
                            const baseUrl = new URL(currentUrl);
                            const lines = body.split('\n');
                            const resolvedLines = lines.map(line => {
                                const trimmed = line.trim();
                                if (!trimmed || trimmed.startsWith('#')) return line;
                                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
                                if (trimmed.startsWith('/')) {
                                    return `${baseUrl.protocol}//${baseUrl.host}${trimmed}`;
                                }
                                const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
                                return `${baseUrl.protocol}//${baseUrl.host}${basePath}${trimmed}`;
                            });
                            resolve({ body: resolvedLines.join('\n'), finalUrl: currentUrl });
                        } else {
                            const hlsWrap = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:12\n#EXT-X-MEDIA-SEQUENCE:1\n#EXTINF:10.000,\n${currentUrl}\n`;
                            resolve({ body: hlsWrap, finalUrl: currentUrl });
                        }
                    });
                });
                req.on('error', () => resolve(null));
                req.on('timeout', () => { req.destroy(); resolve(null); });
            } catch (e) {
                resolve(null);
            }
        }
        get(initialUrl, 0);
    });
}

// Handler de HLS para TV Ao Vivo com Redirecionamento 302 + Redundância Multi-Server (Plano C)
async function handleHlsRequest(channel, req, res, queryQuality) {
    let candidateUrls = [];

    if (channel.qualities) {
        const q = (queryQuality || 'HD').toUpperCase();
        if (channel.qualities[q]) candidateUrls.push(channel.qualities[q]);
        if (q !== 'HD' && channel.qualities['HD']) candidateUrls.push(channel.qualities['HD']);
        if (q !== 'FHD' && channel.qualities['FHD']) candidateUrls.push(channel.qualities['FHD']);
        if (q !== 'SD' && channel.qualities['SD']) candidateUrls.push(channel.qualities['SD']);
        if (q !== '4K' && channel.qualities['4K']) candidateUrls.push(channel.qualities['4K']);
    } else {
        candidateUrls = channel.urls.slice();
    }

    channel.urls.forEach(u => {
        if (!candidateUrls.includes(u)) candidateUrls.push(u);
        if (u.endsWith('.ts')) {
            const asM3u = u.replace(/\.ts$/i, '.m3u8');
            if (!candidateUrls.includes(asM3u)) candidateUrls.unshift(asM3u);
        }
    });

    // 1. Tentar resoluções do servidor primário
    for (let i = 0; i < candidateUrls.length; i++) {
        const targetUrl = candidateUrls[i];
        const hlsResult = await fetchAndResolveM3u8(targetUrl);
        if (hlsResult && hlsResult.body) {
            activeStats.set(channel.id, {
                id: channel.id,
                name: channel.name,
                group: channel.group,
                quality: queryQuality || 'HD',
                lastSeen: Date.now()
            });

            if (STREAM_MODE === 'REDIRECT' && hlsResult.finalUrl) {
                res.writeHead(302, {
                    'Location': hlsResult.finalUrl,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end();
                return;
            }

            res.writeHead(200, {
                'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(hlsResult.body);
            return;
        }
    }

    // 2. PLANO C: REDUNDÂNCIA MULTI-SERVER (FAILOVER)
    console.log(`[Plano C] Servidor primário falhou para "${channel.name}". Ativando servidores reservas...`);
    for (const backupHost of BACKUP_SERVERS) {
        for (const targetUrl of candidateUrls) {
            try {
                const u = new URL(targetUrl);
                if (u.host === backupHost) continue;
                u.host = backupHost;
                const backupUrl = u.toString();
                const backupResult = await fetchAndResolveM3u8(backupUrl);
                if (backupResult && backupResult.body) {
                    console.log(`[Plano C] Canal "${channel.name}" recuperado no servidor reserva: ${backupHost}!`);
                    activeStats.set(channel.id, {
                        id: channel.id,
                        name: channel.name,
                        group: channel.group,
                        quality: (queryQuality || 'HD') + ' (Reserva)',
                        lastSeen: Date.now()
                    });

                    if (STREAM_MODE === 'REDIRECT' && backupResult.finalUrl) {
                        res.writeHead(302, {
                            'Location': backupResult.finalUrl,
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end();
                        return;
                    }

                    res.writeHead(200, {
                        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Cache-Control': 'no-cache, no-store, must-revalidate'
                    });
                    res.end(backupResult.body);
                    return;
                }
            } catch (err) {}
        }
    }

    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Canal temporariamente fora do ar em todos os servidores.');
}

// Servidor HTTP Principal
const server = http.createServer((req, res) => {
    const clientHost = req.headers.host || `localhost:${PORT}`;
    const parsedUrl = new URL(req.url, `http://${clientHost}`);
    const pathname = parsedUrl.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS'
        });
        res.end();
        return;
    }

    // 0. Painel de Administração & Área de Membros (/admin)
    const adminHandled = handleAdminRoutes(req, res, {
        pathname,
        parsedUrl,
        clientHost,
        channels,
        activeStats,
        BACKUP_SERVERS,
        APP_NAME,
        SECURITY_TOKEN,
        STREAM_MODE,
        loadChannels
    });
    if (adminHandled) return;

    // Logos locais
    if (pathname.startsWith('/logos/')) {
        const logoName = path.basename(pathname);
        const logoPath = path.join(__dirname, 'logos', logoName);
        if (fs.existsSync(logoPath)) {
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(logoPath).pipe(res);
            return;
        }
    }

    // 1. Web TV App (Layout IPTV Smart TV Moderno)
    if (pathname === '/' || pathname === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderWebTVApp(clientHost));
        return;
    }

    // 2. Guia de Programação EPG
    if (pathname === '/epg.xml' || pathname === '/epg.xml.gz' || pathname === '/epg') {
        const epgUrl = 'https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz';
        https.get(epgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, epgRes => {
            res.writeHead(200, {
                'Content-Type': 'application/x-gzip',
                'Content-Disposition': 'inline; filename="epg.xml.gz"',
                'Access-Control-Allow-Origin': '*'
            });
            epgRes.pipe(res);
        }).on('error', err => {
            res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Erro ao sincronizar EPG.');
        });
        return;
    }

    // 3. Playlist Dinâmica M3U8 (Juggo TV)
    if (pathname === '/playlist.m3u' || pathname === '/playlist.m3u8' || pathname === '/canais.m3u8') {
        if (SECURITY_TOKEN) {
            const token = parsedUrl.searchParams.get('token');
            if (token !== SECURITY_TOKEN) {
                res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Acesso negado: Token de seguranca invalido ou ausente.');
                return;
            }
        }

        res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Content-Disposition': 'inline; filename="playlist.m3u8"',
            'Access-Control-Allow-Origin': '*'
        });

        const tokenQuery = SECURITY_TOKEN ? `?token=${encodeURIComponent(SECURITY_TOKEN)}` : '';
        let m3u = `#EXTM3U name="${APP_NAME}" url-tvg="http://${clientHost}/epg.xml,https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz,https://epg.pw/xmltv/epg_BR.xml.gz"\n\n`;
        for (const [id, ch] of channels.entries()) {
            const streamUrl = `http://${clientHost}/stream/${id}.m3u8${tokenQuery}`;
            m3u += `${ch.rawExt}\n${streamUrl}\n`;
        }
        res.end(m3u);
        return;
    }

    // 4. API de Canais
    if (pathname === '/api/channels') {
        const list = [];
        for (const [id, ch] of channels.entries()) {
            const qList = ch.qualities ? Object.keys(ch.qualities) : ['HD'];
            let highest = 'HD';
            if (qList.includes('4K')) highest = '4K';
            else if (qList.includes('FHD')) highest = 'FHD';
            else if (qList.includes('HD')) highest = 'HD';
            else if (qList.includes('SD')) highest = 'SD';
            else if (ch.name.includes('@SD') || (ch.tvgId && ch.tvgId.includes('@SD'))) highest = 'SD';

            list.push({
                id: ch.id,
                name: ch.name,
                group: ch.group,
                logo: ch.logo,
                tvgId: ch.tvgId,
                highestResolution: highest,
                qualities: qList,
                defaultQuality: 'HD',
                streamUrl: `http://${clientHost}/stream/${id}.m3u8`
            });
        }
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(list));
        return;
    }

    // 5. API do Futebol Hub (Ligas e Classificações em tempo real)
    if (pathname === '/api/futebol/leagues') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(footballHub.getAvailableLeagues()));
        return;
    }

    if (pathname.startsWith('/api/futebol/league/')) {
        const leagueId = pathname.replace('/api/futebol/league/', '').trim();
        footballHub.getLeagueData(leagueId).then(data => {
            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(data || { error: 'Liga não encontrada' }));
        });
        return;
    }

    // 6. Stream HLS de TV Ao Vivo
    if (pathname.startsWith('/stream/')) {
        let channelId = pathname.replace('/stream/', '').replace(/\.(m3u8|ts)$/i, '');
        let channel = channels.get(channelId);

        if (!channel) {
            loadChannels();
            channel = channels.get(channelId);
        }

        if (!channel) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Canal não encontrado: "${channelId}"`);
            return;
        }

        const queryQuality = parsedUrl.searchParams.get('q') || 'HD';
        handleHlsRequest(channel, req, res, queryQuality);
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada.');
});

function renderWebTVApp(host) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${APP_NAME} - Reprodutor Smart TV</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        :root {
            --bg-glass: rgba(13, 17, 28, 0.82);
            --bg-card: rgba(22, 28, 45, 0.75);
            --bg-card-active: rgba(37, 99, 235, 0.35);
            --border-glass: rgba(255, 255, 255, 0.1);
            --primary: #2563eb;
            --accent: #10b981;
            --gold: #f59e0b;
            --danger: #ef4444;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; user-select: none; }
        html, body { width: 100vw; height: 100vh; overflow: hidden; background: #000; color: var(--text-main); }

        /* Video Player Edge-to-Edge */
        #videoContainer {
            position: absolute;
            inset: 0;
            width: 100vw;
            height: 100vh;
            background: #000;
            z-index: 1;
        }
        #webVideo {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
        }

        /* Overlay Layer */
        #tvOverlay {
            position: absolute;
            inset: 0;
            z-index: 10;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            pointer-events: auto;
            opacity: 1;
            transition: opacity 0.4s ease;
            background: linear-gradient(180deg, rgba(7, 9, 14, 0.75) 0%, rgba(7, 9, 14, 0.1) 40%, rgba(7, 9, 14, 0.85) 100%);
        }
        #tvOverlay.hidden {
            opacity: 0;
            pointer-events: none;
        }

        /* Top Header Info */
        .tv-top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 40px;
        }
        .channel-watermark {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .channel-watermark img {
            height: 44px;
            max-width: 120px;
            object-fit: contain;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.6));
        }
        .widget-clock {
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            background: rgba(16, 22, 38, 0.6);
            backdrop-filter: blur(12px);
            padding: 8px 20px;
            border-radius: 30px;
            border: 1px solid var(--border-glass);
        }

        /* Center Main Menu HUD */
        .tv-main-hud {
            display: flex;
            height: 65vh;
            padding: 0 40px;
            gap: 20px;
            align-items: center;
        }

        /* Leftmost Rail */
        .rail-nav {
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 16px 12px;
        }
        .rail-btn {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: var(--text-muted);
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .rail-btn:hover, .rail-btn.active {
            background: var(--primary);
            color: #fff;
            box-shadow: 0 0 16px rgba(37, 99, 235, 0.5);
            transform: scale(1.08);
        }

        /* Category Column */
        .category-col {
            width: 250px;
            height: 100%;
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 20px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            overflow-y: auto;
        }
        .col-title {
            font-size: 15px;
            font-weight: 800;
            color: #fff;
            letter-spacing: 0.5px;
            padding: 0 12px 10px 12px;
            border-bottom: 1px solid var(--border-glass);
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
        }
        .cat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 14px;
            cursor: pointer;
            transition: all 0.2s;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 14px;
        }
        .cat-item:hover, .cat-item.active {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            transform: translateX(4px);
        }
        .cat-item.active {
            background: linear-gradient(90deg, rgba(37, 99, 235, 0.4), rgba(37, 99, 235, 0.1));
            border-left: 3px solid var(--primary);
        }
        .cat-icon { font-size: 18px; }

        /* Channels Column */
        .channels-col {
            width: 380px;
            height: 100%;
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 20px 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            overflow-y: auto;
        }
        .channel-card {
            display: flex;
            align-items: center;
            gap: 16px;
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 12px 16px;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
        }
        .channel-card:hover, .channel-card.focused {
            border-color: rgba(255, 255, 255, 0.3);
            background: rgba(30, 41, 69, 0.85);
            transform: scale(1.02);
        }
        .channel-card.active {
            background: var(--bg-card-active);
            border-color: var(--primary);
            box-shadow: 0 0 20px rgba(37, 99, 235, 0.3);
        }
        .channel-card.active::before {
            content: '';
            position: absolute;
            left: 0;
            top: 20%;
            height: 60%;
            width: 4px;
            background: #fff;
            border-radius: 0 4px 4px 0;
            box-shadow: 0 0 8px #fff;
        }
        .ch-logo-box {
            width: 56px;
            height: 56px;
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px;
            flex-shrink: 0;
        }
        .ch-logo-box img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .ch-details { flex: 1; overflow: hidden; }
        .ch-name { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ch-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
        .ch-badges { display: flex; gap: 6px; margin-top: 6px; }
        .badge {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            color: #cbd5e1;
        }
        .badge.hd { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
        .badge.live { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }

        /* Right Panel: Now Playing & EPG Details */
        .now-playing-panel {
            flex: 1;
            height: 100%;
            background: var(--bg-glass);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 32px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .np-label { font-size: 13px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .np-title { font-size: 28px; font-weight: 900; color: #fff; margin: 8px 0; line-height: 1.2; }
        .np-desc { font-size: 14px; color: #cbd5e1; line-height: 1.6; max-height: 120px; overflow-y: auto; }
        .np-progress-box { margin-top: 20px; }
        .progress-bar { width: 100%; height: 6px; background: rgba(255, 255, 255, 0.15); border-radius: 10px; overflow: hidden; }
        .progress-fill { width: 45%; height: 100%; background: var(--primary); border-radius: 10px; }
        .progress-times { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-top: 6px; }

        /* Bottom Player Bar (Photo 2) */
        .bottom-player-bar {
            background: rgba(10, 14, 24, 0.85);
            backdrop-filter: blur(20px);
            border-top: 1px solid var(--border-glass);
            padding: 16px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .bot-left { display: flex; align-items: center; gap: 16px; }
        .live-tag {
            background: var(--danger);
            color: #fff;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.5px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .bot-program { font-size: 16px; font-weight: 800; color: #fff; }
        .bot-channel { font-size: 13px; color: var(--text-muted); }

        .bot-center { display: flex; align-items: center; gap: 20px; }
        .media-btn {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-glass);
            color: #fff;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .media-btn:hover { background: rgba(255, 255, 255, 0.2); transform: scale(1.08); }
        .media-btn.play-pause {
            width: 54px;
            height: 54px;
            background: var(--primary);
            box-shadow: 0 0 16px rgba(37, 99, 235, 0.4);
        }

        .bot-right { display: flex; align-items: center; gap: 14px; }
        .action-icon {
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 20px;
            cursor: pointer;
            transition: color 0.2s;
        }
        .action-icon:hover { color: #fff; }

        /* FUTEBOL HUB MODAL */
        #futebolModal {
            position: absolute;
            inset: 30px 40px;
            background: rgba(13, 17, 28, 0.94);
            backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 24px;
            z-index: 50;
            display: none;
            flex-direction: column;
            padding: 28px;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
        }
        .fut-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .fut-tabs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; }
        .fut-tab {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-glass);
            color: var(--text-muted);
            padding: 8px 18px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }
        .fut-tab:hover, .fut-tab.active { background: var(--primary); color: #fff; }
        .fut-content { display: grid; grid-template-columns: 1fr 1.1fr; gap: 24px; flex: 1; overflow: hidden; }
        .fut-standings { background: rgba(10, 15, 26, 0.7); border-radius: 16px; padding: 16px; overflow-y: auto; }
        .standings-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
        .standings-table th { padding: 8px 10px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; }
        .standings-table td { padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.05); }
        .team-cell { display: flex; align-items: center; gap: 10px; font-weight: 700; }
        .team-logo { width: 22px; height: 22px; object-fit: contain; }
        .pos-badge { width: 20px; font-weight: 800; font-size: 12px; }

        .fut-matches { background: rgba(10, 15, 26, 0.7); border-radius: 16px; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .match-card {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            border-radius: 14px;
            padding: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        }
        .match-card:hover { background: rgba(37, 99, 235, 0.15); border-color: var(--primary); transform: translateY(-2px); }
        .match-teams { display: flex; flex-direction: column; gap: 6px; }
        .match-team { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
        .btn-tune {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-tune:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); }

        /* Loading Spinner */
        #loader {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 20;
            display: none;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 16px;
        }
        .spinner {
            width: 48px;
            height: 48px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <!-- Video Player Background -->
    <div id="videoContainer">
        <video id="webVideo" playsinline></video>
    </div>

    <!-- Spinner Loader -->
    <div id="loader">
        <div class="spinner"></div>
        <div style="font-weight: 700; font-size: 16px; color: #fff;" id="loaderText">Sintonizando canal...</div>
    </div>

    <!-- TV HUD Overlay -->
    <div id="tvOverlay">
        <!-- Top Bar -->
        <div class="tv-top-bar">
            <div class="channel-watermark">
                <img id="topChannelLogo" src="https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png" alt="Logo">
                <div>
                    <div style="font-size: 18px; font-weight: 800;" id="topChannelName">Juggo TV</div>
                    <div style="font-size: 13px; color: var(--accent); font-weight: 700;">🟢 Transmissão Ao Vivo</div>
                </div>
            </div>

            <div class="widget-clock">
                <span>☀️ 29°C</span>
                <span id="liveClock">14:45</span>
                <a href="/admin" target="_blank" style="text-decoration: none; font-size: 16px; color: #94a3b8;" title="Painel de Controle">⚙️</a>
            </div>
        </div>

        <!-- Center HUD -->
        <div class="tv-main-hud">
            <!-- Leftmost Rail -->
            <div class="rail-nav">
                <button class="rail-btn active" id="railTvBtn" onclick="openTvView()" title="Canais Ao Vivo">📺</button>
                <button class="rail-btn" id="railFutBtn" onclick="toggleFutebolHub()" title="Futebol & Classificações">⚽</button>
                <button class="rail-btn" onclick="toggleFavorites()" title="Favoritos">⭐</button>
                <button class="rail-btn" onclick="focusSearch()" title="Buscar">🔍</button>
            </div>

            <!-- Coluna 1: Categorias -->
            <div class="category-col" id="categoryCol">
                <div class="col-title">
                    <span>CATEGORIAS</span>
                    <span id="catTotalBadge" style="font-size: 12px; color: var(--primary-light);">...</span>
                </div>
                <div id="categoriesList">Carregando...</div>
            </div>

            <!-- Coluna 2: Canais -->
            <div class="channels-col" id="channelsCol">
                <div class="col-title">
                    <span id="selectedCategoryTitle">CANAIS</span>
                    <span id="channelCountBadge" style="font-size: 12px; color: var(--text-muted);">0</span>
                </div>
                <div id="channelCardsList">Selecione uma categoria</div>
            </div>

            <!-- Coluna 3: Now Playing / EPG -->
            <div class="now-playing-panel" id="nowPlayingPanel">
                <div>
                    <div class="np-label">NO AR AGORA</div>
                    <div class="np-title" id="epgTitle">Programação Ao Vivo</div>
                    <div class="np-desc" id="epgDesc">Assista aos melhores canais em alta definição com guia atualizado e fallbacks automáticos da Juggo TV.</div>
                </div>

                <div class="np-progress-box">
                    <div class="progress-bar">
                        <div class="progress-fill" id="epgProgressFill"></div>
                    </div>
                    <div class="progress-times">
                        <span id="epgStartTime">Ao Vivo</span>
                        <span id="epgQualityBadge" style="color: var(--accent); font-weight: 700;">Full HD 1080p</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Player Controls Bar (Photo 2) -->
        <div class="bottom-player-bar">
            <div class="bot-left">
                <span class="live-tag">LIVE</span>
                <div>
                    <div class="bot-program" id="botProgramTitle">Transmissão em Direto</div>
                    <div class="bot-channel" id="botChannelName">Canal Sintonizado</div>
                </div>
            </div>

            <div class="bot-center">
                <button class="media-btn" onclick="prevChannel()" title="Canal Anterior">⏮</button>
                <button class="media-btn play-pause" id="btnPlayPause" onclick="togglePlay()" title="Play / Pause">⏸</button>
                <button class="media-btn" onclick="nextChannel()" title="Próximo Canal">⏭</button>
                <button class="media-btn" onclick="hideOverlayNow()" title="Ocultar Menus">⌄</button>
            </div>

            <div class="bot-right">
                <button class="action-icon" onclick="reloadCurrentStream()" title="Recarregar Canal">↻</button>
                <button class="action-icon" onclick="toggleFavoriteCurrent()" id="btnFavCurrent" title="Favoritar">⭐</button>
                <button class="action-icon" onclick="toggleFullscreen()" title="Tela Cheia">⛶</button>
            </div>
        </div>
    </div>

    <!-- MODAL FUTEBOL HUB (Classificações e Jogos da Rodada) -->
    <div id="futebolModal">
        <div class="fut-header">
            <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 26px;">⚽</span>
                <div>
                    <h2 style="font-size: 22px; font-weight: 900;">Futebol Hub - Classificações & Jogos</h2>
                    <p style="font-size: 13px; color: var(--text-muted);">Clique em qualquer partida para sintonizar a transmissão instantaneamente.</p>
                </div>
            </div>
            <button onclick="toggleFutebolHub()" style="background: rgba(255,255,255,0.1); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 18px; cursor: pointer;">✕</button>
        </div>

        <div class="fut-tabs" id="futebolTabs">
            <!-- Tabs carregadas via JS -->
        </div>

        <div class="fut-content">
            <!-- Tabela de Classificação -->
            <div class="fut-standings">
                <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 12px; color: #fff;">📊 Tabela de Classificação</h3>
                <table class="standings-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Clube</th>
                            <th>PTS</th>
                            <th>J</th>
                            <th>V</th>
                            <th>SG</th>
                        </tr>
                    </thead>
                    <tbody id="standingsBody">
                        <tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">Carregando tabela...</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Jogos da Rodada -->
            <div class="fut-matches">
                <h3 style="font-size: 15px; font-weight: 800; margin-bottom: 12px; color: #fff;">⚽ Jogos da Rodada</h3>
                <div id="matchesContainer">Carregando partidas...</div>
            </div>
        </div>
    </div>

    <script>
        let allChannels = [];
        let categories = [];
        let activeCategory = '⚽ Jogos do Dia';
        let activeChannel = null;
        let activeIndex = 0;
        let hlsPlayer = null;
        let overlayTimer = null;
        let favorites = JSON.parse(localStorage.getItem('juggo_favorites') || '[]');

        // Inicialização
        async function init() {
            startClock();
            resetOverlayTimer();
            setupEventListeners();

            try {
                const res = await fetch('/api/channels');
                allChannels = await res.json();
                buildCategories();
                renderCategories();

                // Recuperar último canal assistido da memória
                const lastId = localStorage.getItem('juggo_last_channel_id');
                const lastCh = allChannels.find(c => c.id === lastId);

                if (lastCh) {
                    activeCategory = lastCh.group;
                    renderChannels(activeCategory);
                    playChannel(lastCh);
                } else if (allChannels.length > 0) {
                    renderChannels(categories[0] || 'Todos');
                    playChannel(allChannels[0]);
                }
            } catch (e) {
                console.error('Erro ao inicializar canais:', e);
            }
        }

        // Categorias Dinâmicas
        function buildCategories() {
            const catSet = new Set();
            allChannels.forEach(c => {
                if (c.group) catSet.add(c.group);
            });
            categories = Array.from(catSet);
            // Ordenar destacando Jogos do Dia no topo
            categories.sort((a, b) => {
                if (a.includes('Jogos do Dia')) return -1;
                if (b.includes('Jogos do Dia')) return 1;
                return a.localeCompare(b);
            });
        }

        function renderCategories() {
            const container = document.getElementById('categoriesList');
            document.getElementById('catTotalBadge').innerText = categories.length;

            let html = '';
            categories.forEach(cat => {
                const isActive = (cat === activeCategory) ? ' active' : '';
                const count = allChannels.filter(c => c.group === cat).length;
                let icon = '📺';
                if (cat.includes('Jogos') || cat.includes('Esporte')) icon = '⚽';
                else if (cat.includes('Aberto')) icon = '🇧🇷';
                else if (cat.includes('Filme') || cat.includes('Série')) icon = '🎬';
                else if (cat.includes('Notícia')) icon = '📰';
                else if (cat.includes('Infantil') || cat.includes('Kids')) icon = '👶';
                else if (cat.includes('Doc') || cat.includes('Variedade')) icon = '🦁';

                html += '<div class="cat-item' + isActive + '" onclick="selectCategory(\\'' + escapeJs(cat) + '\\')">' +
                    '<span class="cat-icon">' + icon + '</span>' +
                    '<span style="flex:1; overflow:hidden; text-overflow:ellipsis;">' + cat + '</span>' +
                    '<span style="font-size:11px; opacity:0.6;">' + count + '</span>' +
                    '</div>';
            });
            container.innerHTML = html;
        }

        function selectCategory(cat) {
            activeCategory = cat;
            renderCategories();
            renderChannels(cat);
            resetOverlayTimer();
        }

        function renderChannels(cat) {
            const container = document.getElementById('channelCardsList');
            document.getElementById('selectedCategoryTitle').innerText = cat.toUpperCase();
            
            const filtered = allChannels.filter(c => c.group === cat);
            document.getElementById('channelCountBadge').innerText = filtered.length;

            if (filtered.length === 0) {
                container.innerHTML = '<div style="color:var(--text-muted); padding:20px;">Nenhum canal nesta categoria.</div>';
                return;
            }

            let html = '';
            filtered.forEach((ch, idx) => {
                const isActive = (activeChannel && activeChannel.id === ch.id) ? ' active' : '';
                const isFav = favorites.includes(ch.id);

                html += '<div class="channel-card' + isActive + '" id="card_' + ch.id + '" onclick="playChannelById(\\'' + ch.id + '\\')">' +
                    '<div class="ch-logo-box"><img src="' + ch.logo + '" onerror="this.src=\\'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png\\'"></div>' +
                    '<div class="ch-details">' +
                        '<div class="ch-name">' + ch.name + '</div>' +
                        '<div class="ch-sub">' + (ch.group || 'Geral') + '</div>' +
                        '<div class="ch-badges">' +
                            '<span class="badge hd">' + ch.highestResolution + '</span>' +
                            (ch.name.includes('⚽') || cat.includes('Jogos') ? '<span class="badge live">LIVE</span>' : '') +
                        '</div>' +
                    '</div>' +
                    '<button onclick="event.stopPropagation(); toggleFavorite(\\'' + ch.id + '\\')" style="background:none; border:none; color:' + (isFav ? '#f59e0b' : '#64748b') + '; font-size:16px; cursor:pointer;">' + (isFav ? '★' : '☆') + '</button>' +
                    '</div>';
            });
            container.innerHTML = html;
        }

        function playChannelById(id) {
            const ch = allChannels.find(c => c.id === id);
            if (ch) playChannel(ch);
        }

        // Tocar Canal com Buffer Anti-Travamento (60 Segundos)
        function playChannel(ch) {
            activeChannel = ch;
            localStorage.setItem('juggo_last_channel_id', ch.id);

            // Atualizar UI
            document.getElementById('topChannelName').innerText = ch.name;
            document.getElementById('topChannelLogo').src = ch.logo;
            document.getElementById('botProgramTitle').innerText = ch.name;
            document.getElementById('botChannelName').innerText = ch.group;
            document.getElementById('epgTitle').innerText = ch.name;
            document.getElementById('epgDesc').innerText = 'Transmitindo agora em ' + ch.highestResolution + '. Qualidade balanceada com estabilidade máxima.';

            renderChannels(activeCategory);
            showLoader(true, 'Sintonizando ' + ch.name + '...');

            const video = document.getElementById('webVideo');
            if (hlsPlayer) {
                hlsPlayer.destroy();
                hlsPlayer = null;
            }
            video.pause();
            video.removeAttribute('src');
            video.load();

            const streamUrl = ch.streamUrl;

            // Configuração Ultra-Robusta do Hls.js para Evitar Travamentos
            if (Hls && Hls.isSupported()) {
                hlsPlayer = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false, // Modo padrão estável (evita engasgos de internet)
                    backBufferLength: 90,
                    maxBufferLength: 60, // 60 segundos de buffer tolerante
                    maxMaxBufferLength: 120,
                    maxBufferSize: 80 * 1024 * 1024,
                    manifestLoadingTimeOut: 20000,
                    manifestLoadingMaxRetry: 6,
                    manifestLoadingRetryDelay: 1000,
                    fragLoadingTimeOut: 30000,
                    fragLoadingMaxRetry: 6,
                    fragLoadingRetryDelay: 1000,
                    liveSyncDurationCount: 5, // 5 segmentos atrás para fluxo estável
                    liveMaxLatencyDurationCount: 10,
                    highBufferWatchdogPeriod: 3
                });

                hlsPlayer.loadSource(streamUrl);
                hlsPlayer.attachMedia(video);

                hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                    video.play().catch(e => console.log('Autoplay:', e));
                    showLoader(false);
                });

                hlsPlayer.on(Hls.Events.ERROR, function(event, data) {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hlsPlayer.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hlsPlayer.recoverMediaError();
                                break;
                            default:
                                hlsPlayer.destroy();
                                setTimeout(() => { if (activeChannel) playChannel(activeChannel); }, 2000);
                                break;
                        }
                    }
                });
            } else {
                video.src = streamUrl;
                video.play().catch(e => console.log('Autoplay:', e));
                showLoader(false);
            }

            resetOverlayTimer();
        }

        // Temporizador de 7 Segundos para Auto-Hide do HUD
        function resetOverlayTimer() {
            const overlay = document.getElementById('tvOverlay');
            overlay.classList.remove('hidden');

            if (overlayTimer) clearTimeout(overlayTimer);
            overlayTimer = setTimeout(() => {
                overlay.classList.add('hidden');
            }, 7000);
        }

        function hideOverlayNow() {
            document.getElementById('tvOverlay').classList.add('hidden');
        }

        function showLoader(show, text) {
            const l = document.getElementById('loader');
            if (text) document.getElementById('loaderText').innerText = text;
            l.style.display = show ? 'flex' : 'none';
        }

        function togglePlay() {
            const v = document.getElementById('webVideo');
            const btn = document.getElementById('btnPlayPause');
            if (v.paused) {
                v.play();
                btn.innerText = '⏸';
            } else {
                v.pause();
                btn.innerText = '▶';
            }
            resetOverlayTimer();
        }

        function nextChannel() {
            const filtered = allChannels.filter(c => c.group === activeCategory);
            const curIdx = filtered.findIndex(c => c.id === activeChannel?.id);
            const nextIdx = (curIdx + 1) % filtered.length;
            playChannel(filtered[nextIdx]);
        }

        function prevChannel() {
            const filtered = allChannels.filter(c => c.group === activeCategory);
            const curIdx = filtered.findIndex(c => c.id === activeChannel?.id);
            const prevIdx = (curIdx - 1 + filtered.length) % filtered.length;
            playChannel(filtered[prevIdx]);
        }

        function reloadCurrentStream() {
            if (activeChannel) playChannel(activeChannel);
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }

        function toggleFavorite(id) {
            if (favorites.includes(id)) {
                favorites = favorites.filter(f => f !== id);
            } else {
                favorites.push(id);
            }
            localStorage.setItem('juggo_favorites', JSON.stringify(favorites));
            renderChannels(activeCategory);
        }

        function toggleFavoriteCurrent() {
            if (activeChannel) toggleFavorite(activeChannel.id);
        }

        function toggleFavorites() {
            const favChannels = allChannels.filter(c => favorites.includes(c.id));
            if (favChannels.length === 0) {
                alert('Você ainda não adicionou nenhum canal aos favoritos! Clique na estrelinha de qualquer canal.');
                return;
            }
            selectCategory('Favoritos');
        }

        function focusSearch() {
            const q = prompt('Digite o nome do canal ou jogo:');
            if (!q) return;
            const found = allChannels.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
            if (found.length > 0) {
                playChannel(found[0]);
            } else {
                alert('Nenhum canal encontrado com "' + q + '"');
            }
        }

        // Navegação Completa pelo Teclado (Setas Direita / Esquerda / Cima / Baixo)
        function setupEventListeners() {
            window.addEventListener('mousemove', resetOverlayTimer);
            window.addEventListener('click', resetOverlayTimer);
            window.addEventListener('touchstart', resetOverlayTimer);

            window.addEventListener('keydown', (e) => {
                resetOverlayTimer();

                if (e.key === 'ArrowRight') {
                    // Direita: Foco na lista de canais
                    const firstCard = document.querySelector('.channel-card');
                    if (firstCard) firstCard.focus();
                } else if (e.key === 'ArrowLeft') {
                    // Esquerda: Foco nas categorias
                    const firstCat = document.querySelector('.cat-item');
                    if (firstCat) firstCat.focus();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    nextChannel();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    prevChannel();
                } else if (e.key === ' ' || e.key === 'Enter') {
                    togglePlay();
                } else if (e.key === 'f' || e.key === 'F') {
                    toggleFullscreen();
                }
            });
        }

        function startClock() {
            function update() {
                const now = new Date();
                document.getElementById('liveClock').innerText = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
            }
            update();
            setInterval(update, 10000);
        }

        // ==========================================
        // FUTEBOL HUB (Tabelas de Classificação & Jogos)
        // ==========================================
        let futebolLeagues = [];
        let currentLeagueId = 'bra.1';

        async function toggleFutebolHub() {
            const modal = document.getElementById('futebolModal');
            if (modal.style.display === 'flex') {
                modal.style.display = 'none';
                resetOverlayTimer();
            } else {
                modal.style.display = 'flex';
                if (futebolLeagues.length === 0) {
                    await loadFutebolLeagues();
                }
                loadLeagueStandings(currentLeagueId);
            }
        }

        async function loadFutebolLeagues() {
            try {
                const res = await fetch('/api/futebol/leagues');
                futebolLeagues = await res.json();
                const container = document.getElementById('futebolTabs');
                let html = '';
                futebolLeagues.forEach(l => {
                    const active = (l.id === currentLeagueId) ? ' active' : '';
                    html += '<button class="fut-tab' + active + '" onclick="switchLeague(\\'' + l.id + '\\')">' + l.flag + ' ' + l.name + '</button>';
                });
                container.innerHTML = html;
            } catch (e) {
                console.error('Erro ao carregar ligas:', e);
            }
        }

        function switchLeague(id) {
            currentLeagueId = id;
            loadFutebolLeagues();
            loadLeagueStandings(id);
        }

        async function loadLeagueStandings(id) {
            const sBody = document.getElementById('standingsBody');
            const mContainer = document.getElementById('matchesContainer');
            sBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">Carregando tabela ao vivo...</td></tr>';
            mContainer.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">Carregando partidas...</div>';

            try {
                const res = await fetch('/api/futebol/league/' + id);
                const data = await res.json();

                // 1. Tabela
                if (data.standings && data.standings.length > 0) {
                    let sHtml = '';
                    data.standings.forEach(team => {
                        let zoneColor = '#64748b';
                        if (team.position <= 4) zoneColor = '#10b981'; // G4
                        else if (team.position >= 17) zoneColor = '#ef4444'; // Z4

                        sHtml += '<tr>' +
                            '<td><span class="pos-badge" style="color:' + zoneColor + '">' + team.position + '</span></td>' +
                            '<td><div class="team-cell"><img class="team-logo" src="' + team.logo + '"><span>' + team.shortName + '</span></div></td>' +
                            '<td style="font-weight:800; color:#fff;">' + team.points + '</td>' +
                            '<td>' + team.played + '</td>' +
                            '<td>' + team.won + '</td>' +
                            '<td>' + team.gd + '</td>' +
                            '</tr>';
                    });
                    sBody.innerHTML = sHtml;
                } else {
                    sBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Tabela em atualização pela liga.</td></tr>';
                }

                // 2. Partidas
                if (data.matches && data.matches.length > 0) {
                    let mHtml = '';
                    data.matches.forEach(m => {
                        mHtml += '<div class="match-card">' +
                            '<div class="match-teams">' +
                                '<div class="match-team"><img src="' + m.homeLogo + '" style="width:20px; height:20px; object-fit:contain;"><span>' + m.homeTeam + '</span><span style="font-weight:900; margin-left:auto;">' + m.homeScore + '</span></div>' +
                                '<div class="match-team"><img src="' + m.awayLogo + '" style="width:20px; height:20px; object-fit:contain;"><span>' + m.awayTeam + '</span><span style="font-weight:900; margin-left:auto;">' + m.awayScore + '</span></div>' +
                                '<div style="font-size:12px; color:var(--text-muted); margin-top:4px;">🕒 ' + m.date + ' às ' + m.time + ' • ' + m.broadcaster + '</div>' +
                            '</div>' +
                            '<button class="btn-tune" onclick="tuneMatchChannel(\\'' + escapeJs(m.broadcaster) + '\\')">▶ Assistir</button>' +
                            '</div>';
                    });
                    mContainer.innerHTML = mHtml;
                } else {
                    mContainer.innerHTML = '<div style="color:var(--text-muted); padding:20px;">Nenhuma partida agendada para os próximos dias nesta liga.</div>';
                }
            } catch (e) {
                sBody.innerHTML = '<tr><td colspan="6" style="color:var(--danger); text-align:center;">Erro ao sincronizar dados.</td></tr>';
            }
        }

        function tuneMatchChannel(broadcasterName) {
            toggleFutebolHub(); // Fecha modal
            const clean = broadcasterName.toLowerCase();
            let targetChannel = allChannels.find(c => {
                const name = c.name.toLowerCase();
                if (clean.includes('premiere') && name.includes('premiere')) return true;
                if (clean.includes('sportv') && name.includes('sportv')) return true;
                if (clean.includes('espn') && name.includes('espn')) return true;
                if (clean.includes('tnt') && name.includes('tnt')) return true;
                if (clean.includes('space') && name.includes('space')) return true;
                if (clean.includes('cazé') && name.includes('cazé')) return true;
                return false;
            });

            if (targetChannel) {
                playChannel(targetChannel);
            } else if (allChannels.length > 0) {
                playChannel(allChannels[0]);
            }
        }

        function escapeJs(str) {
            return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        }

        init();
    </script>
</body>
</html>`;
}

loadChannels();

server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(` ⚡ ${APP_NAME} - Reprodutor Smart TV & Futebol Hub Online!`);
    console.log(` 📺 Web TV:      http://localhost:${PORT}/`);
    console.log(` 🔒 Painel Admin: http://localhost:${PORT}/admin (login: neto)`);
    console.log(` 📡 Lista M3U:   http://localhost:${PORT}/playlist.m3u?token=${SECURITY_TOKEN}`);
    console.log(`=======================================================`);

    // Iniciar agendadores autônomos (Jogos a cada 4h, Saúde dos canais a cada 4h, IA profunda a cada 48h)
    initAutonomousSchedulers({ channels, loadChannels });
});
