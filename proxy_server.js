/**
 * IPTV Brasil 2026 - Web TV Player & VOD Cinema Localhost
 * - Suporta TV Ao Vivo (340 canais com logos verificadas, EPG e Qualidades 4K/FHD/HD/SD)
 * - Redundância Multi-Server (Plano C) com failover automático para servidores reservas
 * - Filmes (VOD Cinema) com capas HD de alta definição, sinopses em PT-BR, elenco, notas da crítica (IMDb/TMDb), ano de lançamento e agrupamento de Sagas/Franquias (Marvel, DC, Star Wars, Harry Potter, etc.)
 * - Streaming VOD com proxy nativo HTTP 206 Partial Content e Range header (filmes abrem na hora e permitem avançar/retroceder na barra de progresso)
 * - Busca inteligente em tempo real (título, atores principais, franquia, ano e gênero)
 * - Ordenação inteligente com padrão "Mais Novos Primeiro" (lançamentos)
 * - Modal cinematográfico com detalhes completos e elenco clicável
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch(e) {}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_NAME = process.env.APP_NAME || 'Juggo TV';
const SECURITY_TOKEN = process.env.SECURITY_TOKEN || '';
const STREAM_MODE = (process.env.STREAM_MODE || 'REDIRECT').toUpperCase();

const M3U_PATH = path.join(__dirname, 'Canais de TV.m3u8');
const QUALITIES_FILE = path.join(__dirname, 'channel_qualities.json');
const FILMES_FILE = path.join(__dirname, 'filmes.json');
const SERIES_FILE = path.join(__dirname, 'series.json');

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

// Carregamento de Filmes e Séries
let ALL_MOVIES = [];
let ALL_SERIES = [];

function loadMovies() {
    try {
        if (fs.existsSync(FILMES_FILE)) {
            ALL_MOVIES = JSON.parse(fs.readFileSync(FILMES_FILE, 'utf8'));
            console.log(`[VOD] Carregados ${ALL_MOVIES.length} filmes com capas e metadados completos.`);
        }
    } catch (e) {
        console.error('[VOD] Erro ao carregar filmes.json:', e.message);
    }
}

function loadSeries() {
    try {
        if (fs.existsSync(SERIES_FILE)) {
            ALL_SERIES = JSON.parse(fs.readFileSync(SERIES_FILE, 'utf8'));
            console.log(`[VOD] Carregadas ${ALL_SERIES.length} séries.`);
        }
    } catch (e) {
        console.error('[VOD] Erro ao carregar series.json:', e.message);
    }
}

loadMovies();
loadSeries();

fs.watchFile(FILMES_FILE, { interval: 2000 }, () => {
    console.log('[AutoReload] filmes.json foi modificado. Recarregando catálogo de filmes...');
    loadMovies();
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

// Handler de HLS para TV Ao Vivo com Fallback de Resolução + Redundância Multi-Server (Plano C)
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
    console.log(`[Plano C] Fallbacks primários falharam para "${channel.name}". Ativando servidores reservas...`);
    for (const backupHost of BACKUP_SERVERS) {
        for (const targetUrl of candidateUrls) {
            try {
                const u = new URL(targetUrl);
                if (u.host === backupHost) continue;
                u.host = backupHost;
                const backupUrl = u.toString();
                const backupResult = await fetchAndResolveM3u8(backupUrl);
                if (backupResult && backupResult.body) {
                    console.log(`[Plano C - Redundância Multi-Server] Canal "${channel.name}" recuperado com sucesso no servidor reserva: ${backupHost}!`);
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
    res.end(`Sinal indisponível para o canal: ${channel.name}`);
}

// Handler de Streaming de Filmes (VOD Proxy com Range 206 e Follow Redirects)
function handleVodStreamRequest(initialUrl, clientReq, clientRes) {
    function requestStream(currentUrl, depth) {
        if (depth > 8) {
            if (!clientRes.headersSent) {
                clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
                clientRes.end('Muitos redirecionamentos ao buscar o filme.');
            }
            return;
        }

        try {
            const parsed = new URL(currentUrl);
            const clientLib = parsed.protocol === 'https:' ? https : http;
            const headers = {
                'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
                'Accept': '*/*'
            };
            if (clientReq.headers.range) {
                headers['Range'] = clientReq.headers.range;
            }

            const upstreamReq = clientLib.get({
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                headers: headers,
                timeout: 25000
            }, upstreamRes => {
                if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
                    let next = upstreamRes.headers.location;
                    if (next.startsWith('/')) {
                        next = `${parsed.protocol}//${parsed.host}${next}`;
                    }
                    return requestStream(next, depth + 1);
                }

                const respHeaders = {
                    'Content-Type': upstreamRes.headers['content-type'] || 'video/mp4',
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Cache-Control': 'no-cache'
                };
                if (upstreamRes.headers['content-range']) {
                    respHeaders['Content-Range'] = upstreamRes.headers['content-range'];
                }
                if (upstreamRes.headers['content-length']) {
                    respHeaders['Content-Length'] = upstreamRes.headers['content-length'];
                }

                clientRes.writeHead(upstreamRes.statusCode, respHeaders);
                upstreamRes.pipe(clientRes);

                clientReq.on('close', () => {
                    upstreamReq.destroy();
                });
            });

            upstreamReq.on('error', err => {
                if (!clientRes.headersSent) {
                    clientRes.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
                    clientRes.end('Erro ao conectar ao servidor de streaming de filmes.');
                }
            });

            upstreamReq.on('timeout', () => {
                upstreamReq.destroy();
                if (!clientRes.headersSent) {
                    clientRes.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' });
                    clientRes.end('Tempo esgotado ao buscar o filme.');
                }
            });
        } catch (e) {
            if (!clientRes.headersSent) {
                clientRes.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                clientRes.end('Erro interno no proxy de vídeo.');
            }
        }
    }

    requestStream(initialUrl, 0);
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

    // 1. Web TV / Cinema App
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

    // 5. API de Filmes (Catálogo Enriquecido com TMDb)
    if (pathname === '/api/filmes' || pathname === '/filmes.json') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(ALL_MOVIES));
        return;
    }

    // 6. API de Séries
    if (pathname === '/api/series' || pathname === '/series.json') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(ALL_SERIES));
        return;
    }

    // 7. Proxy de Streaming VOD de Filmes
    if (pathname === '/vod/stream' || pathname.startsWith('/vod/stream/')) {
        let targetUrl = parsedUrl.searchParams.get('url');
        if (!targetUrl && pathname.startsWith('/vod/stream/')) {
            const movId = pathname.replace('/vod/stream/', '');
            const found = ALL_MOVIES.find(m => m.id === movId);
            if (found) targetUrl = found.url;
        }

        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('URL de vídeo não fornecida.');
            return;
        }

        handleVodStreamRequest(targetUrl, req, res);
        return;
    }

    // 8. Stream HLS de TV Ao Vivo
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_NAME} - Web TV Player & Cinema VOD</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        :root {
            --bg: #07090e;
            --surface: #101626;
            --surface-hover: #161e33;
            --surface-card: #131b2e;
            --border: rgba(255, 255, 255, 0.08);
            --primary: #2563eb;
            --primary-light: #60a5fa;
            --accent: #10b981;
            --gold: #f59e0b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --modal-bg: rgba(7, 9, 14, 0.95);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            background-image: radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.15) 0px, transparent 50%),
                              radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.09) 0px, transparent 50%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .container { max-width: 1440px; margin: 0 auto; padding: 0 24px; width: 100%; }

        nav {
            background: rgba(7, 9, 14, 0.92);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 100;
            padding: 12px 0;
        }
        .nav-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
        }
        .brand-logo {
            width: 38px;
            height: 38px;
            background: linear-gradient(135deg, #2563eb, #10b981);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
        }
        .brand-title {
            font-size: 20px;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }

        .nav-tabs {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.04);
            padding: 4px;
            border-radius: 12px;
            border: 1px solid var(--border);
        }
        .nav-tab-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 18px;
            border-radius: 8px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            font-size: 13.5px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .nav-tab-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
        .nav-tab-btn.active {
            background: var(--primary);
            color: #fff;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        .search-container {
            flex-grow: 1;
            max-width: 420px;
            position: relative;
        }
        .search-input {
            width: 100%;
            background: rgba(20, 28, 46, 0.85);
            border: 1px solid var(--border);
            color: #fff;
            padding: 10px 16px 10px 38px;
            border-radius: 10px;
            font-size: 13px;
            outline: none;
            transition: all 0.2s;
        }
        .search-input:focus {
            border-color: var(--primary-light);
            box-shadow: 0 0 16px rgba(37, 99, 235, 0.35);
        }
        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }

        /* Player Theater */
        .player-theater {
            margin: 20px 0;
            background: var(--surface);
            border-radius: 16px;
            border: 1px solid var(--border);
            overflow: hidden;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
        }
        .video-wrapper {
            position: relative;
            background: #000;
            aspect-ratio: 16 / 9;
            max-height: 560px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        video { width: 100%; height: 100%; object-fit: contain; }

        .now-playing-bar {
            padding: 14px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(15, 23, 42, 0.95);
            border-top: 1px solid var(--border);
            gap: 16px;
            flex-wrap: wrap;
        }
        .playing-info {
            display: flex;
            align-items: center;
            gap: 14px;
            max-width: 60%;
        }
        .playing-logo {
            width: 52px;
            height: 52px;
            object-fit: cover;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            padding: 2px;
            border: 1px solid var(--border);
            flex-shrink: 0;
        }
        .playing-title h2 { font-size: 17px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .playing-title span { font-size: 12px; color: var(--text-muted); display: block; margin-top: 2px; }

        .quality-selector {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.04);
            padding: 4px 10px;
            border-radius: 10px;
            border: 1px solid var(--border);
        }
        .quality-label { font-size: 11px; font-weight: 700; color: var(--text-muted); }
        .quality-pills { display: flex; gap: 4px; }
        .q-btn {
            background: transparent;
            border: 1px solid transparent;
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .q-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.08); }
        .q-btn.active {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary-light);
            box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);
        }
        .q-btn.active.btn-4k {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-color: #fbbf24;
            box-shadow: 0 0 14px rgba(245, 158, 11, 0.6);
        }

        .player-actions { display: flex; gap: 8px; }
        .btn-action {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border);
            color: #fff;
            padding: 7px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-action:hover { background: rgba(255, 255, 255, 0.16); }

        /* Barra de Controle de Filmes (Franquias, Filtros e Ordenação) */
        .vod-controls-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 16px;
            padding: 12px 16px;
            background: var(--surface);
            border-radius: 14px;
            border: 1px solid var(--border);
        }
        .vod-sort-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .vod-label { font-size: 12px; font-weight: 700; color: var(--text-muted); }
        .vod-select {
            background: #0b0f19;
            color: #fff;
            border: 1px solid var(--border);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            outline: none;
            cursor: pointer;
        }
        .vod-select:focus { border-color: var(--primary-light); }

        /* Franquias & Sagas Bar */
        .sagas-bar {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 6px;
            margin-bottom: 16px;
        }
        .saga-chip {
            padding: 6px 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-muted);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .saga-chip:hover { color: #fff; background: rgba(255, 255, 255, 0.09); border-color: rgba(255, 255, 255, 0.2); }
        .saga-chip.active {
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.3), rgba(16, 185, 129, 0.2));
            color: #fff;
            border-color: var(--primary);
            box-shadow: 0 0 12px rgba(37, 99, 235, 0.3);
        }

        /* Categorias de TV */
        .premiere-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            overflow-x: auto;
            margin-bottom: 16px;
            padding-bottom: 6px;
        }
        .premiere-label { font-size: 12px; font-weight: 800; color: #fbbf24; white-space: nowrap; }
        .premiere-btn {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            color: #fbbf24;
            font-size: 12px;
            font-weight: 700;
            padding: 5px 12px;
            border-radius: 8px;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        }
        .premiere-btn:hover { background: rgba(245, 158, 11, 0.25); border-color: #f59e0b; }

        .categories-nav {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            margin-bottom: 20px;
            padding-bottom: 6px;
        }
        .cat-pill {
            padding: 6px 14px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-muted);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
        }
        .cat-pill:hover { color: #fff; background: var(--surface-hover); }
        .cat-pill.active {
            background: rgba(37, 99, 235, 0.2);
            color: var(--primary-light);
            border-color: var(--primary);
        }

        /* Grade de Canais e Filmes */
        .channels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 12px;
            margin-bottom: 40px;
        }
        .channel-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 12px;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .channel-card:hover {
            background: var(--surface-hover);
            border-color: var(--primary-light);
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
        }
        .channel-card.active {
            background: rgba(37, 99, 235, 0.15);
            border-color: var(--primary);
            box-shadow: 0 0 16px rgba(37, 99, 235, 0.35);
        }
        .channel-card.match-card {
            grid-column: span 2;
            background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
            border: 1px solid rgba(16, 185, 129, 0.35);
            border-left: 4px solid #10b981;
            padding: 12px 14px;
        }
        .card-logo {
            width: 44px;
            height: 44px;
            border-radius: 8px;
            object-fit: contain;
            background: rgba(255, 255, 255, 0.04);
            padding: 4px;
            flex-shrink: 0;
        }
        .card-meta { overflow: hidden; flex: 1; }
        .card-meta h4 {
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .meta-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 4px;
        }
        .meta-row span {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 110px;
        }

        .card-res-badge {
            display: inline-block;
            font-size: 9px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 5px;
            letter-spacing: 0.3px;
        }
        .card-res-badge.badge-4k {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
        }
        .card-res-badge.badge-fhd {
            background: rgba(6, 182, 212, 0.2);
            color: #22d3ee;
            border: 1px solid rgba(6, 182, 212, 0.4);
        }
        .card-res-badge.badge-hd {
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            border: 1px solid rgba(99, 102, 241, 0.4);
        }
        .card-res-badge.badge-sd {
            background: rgba(148, 163, 184, 0.15);
            color: #cbd5e1;
            border: 1px solid rgba(148, 163, 184, 0.3);
        }

        /* GRADE DE FILMES CINEMA HD (PÔSTER VERTICAL 2:3) */
        .movies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 50px;
        }
        @media (max-width: 600px) {
            .movies-grid {
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 10px;
            }
        }
        .movie-card {
            background: var(--surface-card);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .movie-card:hover {
            transform: translateY(-5px) scale(1.02);
            border-color: var(--primary-light);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.7);
        }
        .movie-poster-wrap {
            position: relative;
            width: 100%;
            aspect-ratio: 2 / 3;
            background: #0f172a;
            overflow: hidden;
        }
        .movie-poster-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s;
        }
        .movie-card:hover .movie-poster-img {
            transform: scale(1.05);
        }
        .movie-badge-rating {
            position: absolute;
            top: 8px;
            left: 8px;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(245, 158, 11, 0.5);
            color: #fbbf24;
            font-size: 11px;
            font-weight: 800;
            padding: 3px 7px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 3px;
            z-index: 2;
        }
        .movie-badge-year {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            border: 1px solid var(--border);
            color: #fff;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 6px;
            border-radius: 6px;
            z-index: 2;
        }
        .movie-badge-saga {
            position: absolute;
            bottom: 8px;
            left: 8px;
            background: rgba(37, 99, 235, 0.85);
            backdrop-filter: blur(6px);
            color: #fff;
            font-size: 10px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 5px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            z-index: 2;
        }
        .movie-card-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            opacity: 0;
            transition: opacity 0.25s;
            z-index: 3;
            padding: 12px;
        }
        .movie-card:hover .movie-card-overlay {
            opacity: 1;
        }
        .btn-play-quick {
            background: var(--primary);
            color: #fff;
            border: none;
            padding: 9px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.6);
            transition: transform 0.15s;
            width: 100%;
        }
        .btn-play-quick:hover { transform: scale(1.04); background: #1d4ed8; }
        .btn-info-quick {
            background: rgba(255, 255, 255, 0.18);
            backdrop-filter: blur(8px);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 7px 14px;
            border-radius: 8px;
            font-size: 11.5px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
        }
        .btn-info-quick:hover { background: rgba(255, 255, 255, 0.28); }

        .movie-card-info {
            padding: 10px 12px 12px 12px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .movie-card-info h4 {
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 4px;
        }
        .movie-card-sub {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 4px;
        }
        .movie-card-cast {
            font-size: 10.5px;
            color: #94a3b8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 5px;
        }

        /* MODAL CINEMATOGRÁFICO DE DETALHES */
        .movie-modal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(12px);
            z-index: 1000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .movie-modal.open { display: flex; animation: fadeIn 0.25s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .movie-modal-dialog {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            max-width: 820px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        }
        .modal-close-btn {
            position: absolute;
            top: 16px;
            right: 16px;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            border: 1px solid var(--border);
            color: #fff;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            transition: all 0.2s;
        }
        .modal-close-btn:hover { background: #ef4444; border-color: #ef4444; }

        .modal-backdrop-header {
            position: relative;
            width: 100%;
            height: 240px;
            background-size: cover;
            background-position: center;
            border-top-left-radius: 20px;
            border-top-right-radius: 20px;
        }
        .modal-header-gradient {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(16, 22, 38, 0.2) 0%, rgba(16, 22, 38, 1) 100%);
        }
        .modal-body {
            padding: 0 28px 28px 28px;
            display: flex;
            gap: 24px;
            position: relative;
            margin-top: -80px;
        }
        @media (max-width: 650px) {
            .modal-body { flex-direction: column; align-items: center; text-align: center; margin-top: -50px; }
            .modal-backdrop-header { height: 160px; }
        }
        .modal-poster-col {
            flex-shrink: 0;
            width: 180px;
            z-index: 2;
        }
        .modal-poster-img {
            width: 100%;
            aspect-ratio: 2 / 3;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
            border: 2px solid var(--border);
            object-fit: cover;
        }
        .modal-details-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 2;
        }
        .modal-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .tag-pill {
            background: rgba(37, 99, 235, 0.2);
            color: var(--primary-light);
            border: 1px solid rgba(37, 99, 235, 0.4);
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 20px;
        }
        .tag-saga {
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.4));
            color: #fbbf24;
            border-color: #f59e0b;
        }
        .modal-title { font-size: 24px; font-weight: 800; color: #fff; line-height: 1.2; }
        .modal-sub { font-size: 12px; color: var(--text-muted); }
        .modal-meta-row {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 13px;
            color: #cbd5e1;
            flex-wrap: wrap;
        }
        .modal-synopsis h4 { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .modal-synopsis p { font-size: 13px; color: #94a3b8; line-height: 1.6; }
        .modal-cast-section h4 { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px; }
        .modal-cast-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .cast-chip {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 11.5px;
            color: #e2e8f0;
            cursor: pointer;
            transition: all 0.2s;
        }
        .cast-chip:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
        .modal-actions { margin-top: 10px; }
        .modal-btn-play {
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            border: none;
            color: #fff;
            padding: 12px 28px;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s;
        }
        .modal-btn-play:hover { transform: translateY(-2px); box-shadow: 0 8px 26px rgba(37, 99, 235, 0.7); }
    </style>
</head>
<body>
    <nav>
        <div class="container nav-inner">
            <div class="brand" onclick="window.scrollTo({top:0, behavior:'smooth'})">
                <div class="brand-logo">📺</div>
                <div class="brand-title">IPTV Brasil</div>
            </div>

            <!-- Menu Superior (TV, Filmes, Séries) -->
            <div class="nav-tabs">
                <button class="nav-tab-btn active" id="tabTv" onclick="switchNavTab('tv')">📺 TV Ao Vivo</button>
                <button class="nav-tab-btn" id="tabFilmes" onclick="switchNavTab('filmes')">🎬 Filmes Cinema</button>
                <button class="nav-tab-btn" id="tabSeries" onclick="switchNavTab('series')">🍿 Séries</button>
            </div>

            <div class="search-container">
                <span class="search-icon">🔍</span>
                <input type="text" id="searchInput" class="search-input" placeholder="Buscar canal, filme ou jogo..." oninput="handleSearch()">
            </div>
            <div id="counterBadge" style="font-size:12px; color:var(--text-muted); font-weight:700;">
                Canais
            </div>
        </div>
    </nav>

    <div class="container">
        <!-- Player Central de Cinema -->
        <div class="player-theater">
            <div class="video-wrapper">
                <video id="webVideo" controls autoplay playsinline></video>
            </div>
            <div class="now-playing-bar">
                <div class="playing-info">
                    <img id="playerLogo" class="playing-logo" src="http://logos.appscms.xyz/logos/2025/premiere.png" onerror="this.src='https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png'" alt="Logo">
                    <div class="playing-title">
                        <h2 id="playerTitle">Selecione um canal ou filme</h2>
                        <span id="playerCategory">Clique em qualquer item para reproduzir</span>
                    </div>
                </div>

                <!-- Seletor de Resolução no Player (4K, FHD, HD, SD) -->
                <div class="quality-selector" id="qualitySelector">
                    <span class="quality-label">Resolução:</span>
                    <div class="quality-pills" id="qualityPills">
                        <button class="q-btn active">HD</button>
                    </div>
                </div>

                <div class="player-actions">
                    <button class="btn-action" onclick="toggleFullscreen()" title="Tela Cheia">⛶ Tela Cheia</button>
                    <button class="btn-action" onclick="reloadCurrent()" title="Recarregar">🔄 Recarregar</button>
                </div>
            </div>
        </div>

        <!-- Atalhos Rápidos Premiere (Apenas na aba TV) -->
        <div class="premiere-bar" id="premiereBar">
            <div class="premiere-label">🔥 Premiere Rápido:</div>
            <button class="premiere-btn" onclick="playById('premiere-clubes')">Premiere Clubes</button>
            <button class="premiere-btn" onclick="playById('premiere-2')">Premiere 2</button>
            <button class="premiere-btn" onclick="playById('premiere-3')">Premiere 3</button>
            <button class="premiere-btn" onclick="playById('premiere-4')">Premiere 4</button>
            <button class="premiere-btn" onclick="playById('premiere-5')">Premiere 5</button>
            <button class="premiere-btn" onclick="playById('premiere-6')">Premiere 6</button>
            <button class="premiere-btn" onclick="playById('premiere-7')">Premiere 7</button>
            <button class="premiere-btn" onclick="playById('premiere-8')">Premiere 8</button>
        </div>

        <!-- Barra de Filtros e Ordenação de Filmes (Apenas na aba Filmes) -->
        <div class="vod-controls-bar" id="vodControlsBar" style="display: none;">
            <div class="vod-sort-group">
                <span class="vod-label">⚡ Franquia:</span>
                <select id="vodFranchiseSelect" class="vod-select" onchange="filterByFranchise(this.value)">
                    <option value="Todos">🌟 Todas as Franquias</option>
                    <option value="Marvel (MCU)">🦸 Marvel (MCU)</option>
                    <option value="DC Universe">🦇 DC Universe</option>
                    <option value="Velozes e Furiosos">🏎️ Velozes e Furiosos</option>
                    <option value="Harry Potter">⚡ Harry Potter</option>
                    <option value="Star Wars">⚔️ Star Wars</option>
                    <option value="Senhor dos Anéis">💍 Senhor dos Anéis</option>
                    <option value="Duna">🪐 Duna</option>
                    <option value="John Wick">🔫 John Wick</option>
                    <option value="Avatar">🌊 Avatar</option>
                    <option value="Animações">🎨 Animações</option>
                </select>
            </div>

            <div class="vod-sort-group">
                <span class="vod-label">🎭 Gênero:</span>
                <select id="vodGenreSelect" class="vod-select" onchange="filterByGenre(this.value)">
                    <option value="Todos">Todos os Gêneros</option>
                </select>
            </div>

            <div class="vod-sort-group">
                <span class="vod-label">🔽 Ordenar por:</span>
                <select id="vodSortSelect" class="vod-select" onchange="sortMovies(this.value)">
                    <option value="newest" selected>📅 Mais Novos Primeiro (Lançamentos)</option>
                    <option value="rating">⭐ Maior Nota da Crítica (Top Rated)</option>
                    <option value="az">🔤 Ordem Alfabética (A - Z)</option>
                    <option value="oldest">⏳ Mais Antigos</option>
                </select>
            </div>
        </div>

        <!-- Atalhos Rápidos de Franquias (Chips visuais) -->
        <div class="sagas-bar" id="sagasBar" style="display: none;"></div>

        <!-- Abas de Categorias -->
        <div class="categories-nav" id="categoryNav"></div>

        <!-- Grade de Conteúdo (Canais ou Filmes) -->
        <div id="contentContainer">
            <div class="channels-grid" id="channelsGrid"></div>
        </div>
    </div>

    <!-- Modal Cinematográfico de Detalhes do Filme -->
    <div id="movieModal" class="movie-modal" onclick="closeMovieModal(event)">
        <div class="movie-modal-dialog" onclick="event.stopPropagation()">
            <button class="modal-close-btn" onclick="closeMovieModal()">✕</button>
            <div class="modal-backdrop-header" id="modalBackdrop">
                <div class="modal-header-gradient"></div>
            </div>
            <div class="modal-body">
                <div class="modal-poster-col">
                    <img id="modalPoster" src="" alt="Poster" class="modal-poster-img" style="cursor: pointer;" title="Clique para assistir">
                    <button id="modalPlayBtnSide" class="modal-btn-play" style="width: 100%; margin-top: 12px; justify-content: center; font-size: 13px; padding: 10px 14px;">▶ Assistir Agora</button>
                </div>
                <div class="modal-details-col">
                    <div class="modal-tags" id="modalTags"></div>
                    <h2 id="modalTitle" class="modal-title"></h2>
                    <div id="modalOriginalTitle" class="modal-sub"></div>
                    <div class="modal-meta-row" id="modalMetaRow"></div>
                    <div class="modal-actions" style="margin: 4px 0 10px 0;">
                        <button id="modalPlayBtnTop" class="modal-btn-play">▶ Assistir Filme Agora</button>
                    </div>
                    <div class="modal-synopsis">
                        <h4>Sinopse:</h4>
                        <p id="modalOverview"></p>
                    </div>
                    <div class="modal-cast-section">
                        <h4>Elenco Principal:</h4>
                        <div class="modal-cast-chips" id="modalCastChips"></div>
                    </div>
                    <div class="modal-actions" style="margin-top: 14px;">
                        <button id="modalPlayBtn" class="modal-btn-play">▶ Assistir Filme Agora</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentNavTab = 'tv';
        let allChannels = [];
        let allMovies = [];
        let allSeries = [];

        let activeChannel = null;
        let activeQuality = 'HD';
        let activeMedia = null;
        let currentCategory = 'Todos';
        let currentFranchise = 'Todos';
        let currentSort = 'newest';
        let hlsPlayer = null;

        const SAGAS_LIST = [
            { id: 'Todos', name: '🌟 Todas' },
            { id: 'Marvel (MCU)', name: '🦸 Marvel MCU' },
            { id: 'DC Universe', name: '🦇 DC Universe' },
            { id: 'Velozes e Furiosos', name: '🏎️ Velozes & Furiosos' },
            { id: 'Harry Potter', name: '⚡ Harry Potter' },
            { id: 'Star Wars', name: '⚔️ Star Wars' },
            { id: 'Senhor dos Anéis', name: '💍 Senhor dos Anéis' },
            { id: 'Duna', name: '🪐 Duna' },
            { id: 'John Wick', name: '🔫 John Wick' },
            { id: 'Avatar', name: '🌊 Avatar' },
            { id: 'Animações', name: '🎨 Animações' }
        ];

        async function init() {
            try {
                const [cRes, mRes, sRes] = await Promise.all([
                    fetch('/api/channels').then(r => r.json()),
                    fetch('/api/filmes').then(r => r.json()).catch(() => []),
                    fetch('/api/series').then(r => r.json()).catch(() => [])
                ]);
                allChannels = cRes || [];
                allMovies = mRes || [];
                allSeries = sRes || [];

                populateGenreSelect();
                renderSagasBar();
                switchNavTab('tv');

                const defaultCh = allChannels.find(c => c.id === 'premiere-2') || allChannels[0];
                if (defaultCh) {
                    playChannel(defaultCh, 'HD');
                }
            } catch (e) {
                console.error('Erro na inicialização:', e);
            }
        }

        function populateGenreSelect() {
            const select = document.getElementById('vodGenreSelect');
            if (!select) return;
            const genresSet = new Set();
            allMovies.forEach(m => {
                if (m.genre) genresSet.add(m.genre);
                if (m.genres && Array.isArray(m.genres)) {
                    m.genres.forEach(g => genresSet.add(g));
                }
            });
            const sortedGenres = Array.from(genresSet).sort();
            select.innerHTML = '<option value="Todos">Todos os Gêneros</option>' +
                sortedGenres.map(g => '<option value="' + g + '">' + g + '</option>').join('');
        }

        function renderSagasBar() {
            const bar = document.getElementById('sagasBar');
            if (!bar) return;
            let html = '';
            SAGAS_LIST.forEach(s => {
                const active = (s.id === currentFranchise) ? ' active' : '';
                html += '<div class="saga-chip' + active + '" onclick="filterByFranchise(\\'' + s.id + '\\')">' + s.name + '</div>';
            });
            bar.innerHTML = html;
        }

        function switchNavTab(tab) {
            currentNavTab = tab;
            currentCategory = 'Todos';
            currentFranchise = 'Todos';
            document.getElementById('searchInput').value = '';

            document.getElementById('tabTv').classList.toggle('active', tab === 'tv');
            document.getElementById('tabFilmes').classList.toggle('active', tab === 'filmes');
            document.getElementById('tabSeries').classList.toggle('active', tab === 'series');

            document.getElementById('premiereBar').style.display = (tab === 'tv') ? 'flex' : 'none';
            document.getElementById('qualitySelector').style.display = (tab === 'tv') ? 'flex' : 'none';
            document.getElementById('vodControlsBar').style.display = (tab === 'filmes') ? 'flex' : 'none';
            document.getElementById('sagasBar').style.display = (tab === 'filmes') ? 'flex' : 'none';

            if (tab === 'tv') {
                document.getElementById('counterBadge').innerText = allChannels.length + ' Canais';
            } else if (tab === 'filmes') {
                document.getElementById('counterBadge').innerText = allMovies.length + ' Filmes';
                document.getElementById('searchInput').placeholder = 'Buscar por filme, ator (ex: Keanu Reeves, Tom Cruise), franquia ou ano...';
            } else if (tab === 'series') {
                document.getElementById('counterBadge').innerText = allSeries.length + ' Séries';
            }

            renderCategories();
            renderContent();
        }

        function filterByFranchise(franchise) {
            currentFranchise = franchise;
            const select = document.getElementById('vodFranchiseSelect');
            if (select) select.value = franchise;
            renderSagasBar();
            renderMovies();
        }

        function filterByGenre(genre) {
            currentCategory = genre;
            renderMovies();
        }

        function sortMovies(sortType) {
            currentSort = sortType;
            renderMovies();
        }

        function renderCategories() {
            const nav = document.getElementById('categoryNav');
            if (currentNavTab === 'filmes') {
                nav.innerHTML = '';
                return;
            }

            let cats = ['Todos'];
            if (currentNavTab === 'tv') {
                const set = new Set();
                allChannels.forEach(c => { if (c.group) set.add(c.group); });
                const arr = Array.from(set);
                const prio = [];
                if (arr.includes('⚽ Jogos do Dia')) prio.push('⚽ Jogos do Dia');
                if (arr.includes('📅 Jogos da Semana')) prio.push('📅 Jogos da Semana');
                const rest = arr.filter(x => x !== '⚽ Jogos do Dia' && x !== '📅 Jogos da Semana');
                cats = ['Todos', ...prio, ...rest];
            } else if (currentNavTab === 'series') {
                const set = new Set();
                allSeries.forEach(s => { if (s.genre) set.add(s.genre); });
                cats = ['Todos', ...Array.from(set)];
            }

            let html = '';
            cats.forEach(c => {
                const isActive = (c === currentCategory) ? ' active' : '';
                html += '<div class="cat-pill' + isActive + '" onclick="selectCategory(\\'' + escapeJs(c) + '\\')">' + c + '</div>';
            });
            nav.innerHTML = html;
        }

        function selectCategory(cat) {
            currentCategory = cat;
            renderCategories();
            renderContent();
        }

        function handleSearch() {
            renderContent();
        }

        function renderContent() {
            if (currentNavTab === 'tv') renderChannels();
            else if (currentNavTab === 'filmes') renderMovies();
            else if (currentNavTab === 'series') renderSeries();
        }

        function getResBadge(c) {
            const q = c.highestResolution || 'HD';
            if (q === '4K') return '<span class="card-res-badge badge-4k">4K</span>';
            if (q === 'FHD') return '<span class="card-res-badge badge-fhd">FHD</span>';
            if (q === 'HD') return '<span class="card-res-badge badge-hd">HD</span>';
            return '<span class="card-res-badge badge-sd">SD</span>';
        }

        function renderChannels() {
            const container = document.getElementById('contentContainer');
            container.innerHTML = '<div class="channels-grid" id="channelsGrid"></div>';
            const grid = document.getElementById('channelsGrid');
            const query = document.getElementById('searchInput').value.toLowerCase().trim();

            const filtered = allChannels.filter(c => {
                const matchCat = (currentCategory === 'Todos') || (c.group === currentCategory);
                const matchQuery = !query || c.name.toLowerCase().includes(query) || (c.group && c.group.toLowerCase().includes(query));
                return matchCat && matchQuery;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">Nenhum canal encontrado.</div>';
                return;
            }

            let html = '';
            filtered.forEach(c => {
                const logo = c.logo || 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';
                const isActive = (activeChannel && c.id === activeChannel.id) ? ' active' : '';
                const isMatch = (c.group === '⚽ Jogos do Dia' || c.group === '📅 Jogos da Semana' || c.name.startsWith('⚽'));
                const matchClass = isMatch ? ' match-card' : '';
                const badge = getResBadge(c);

                html += '<div class="channel-card' + matchClass + isActive + '" onclick="selectChannelById(\\'' + c.id + '\\')">' +
                    '<img class="card-logo" src="' + logo + '" onerror="this.src=\\'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png\\'" alt="Logo">' +
                    '<div class="card-meta">' +
                        '<h4>' + c.name + '</h4>' +
                        '<div class="meta-row"><span>' + (c.group || 'TV') + '</span>' + badge + '</div>' +
                    '</div>' +
                '</div>';
            });
            grid.innerHTML = html;
        }

        // Renderização dos Filmes com Capas HD, Filtros e Ordenação Inteligente
        function renderMovies() {
            const container = document.getElementById('contentContainer');
            container.innerHTML = '<div class="movies-grid" id="moviesGrid"></div>';
            const grid = document.getElementById('moviesGrid');
            const query = document.getElementById('searchInput').value.toLowerCase().trim();

            let filtered = allMovies.filter(m => {
                const matchFranchise = (currentFranchise === 'Todos') || (m.franchise === currentFranchise);
                const matchGenre = (currentCategory === 'Todos') || (m.genre === currentCategory) || (m.genres && m.genres.includes(currentCategory));
                
                let matchQuery = true;
                if (query) {
                    const titleMatch = m.title.toLowerCase().includes(query) || (m.originalTitle && m.originalTitle.toLowerCase().includes(query));
                    const castMatch = m.cast && m.cast.some(actor => actor.toLowerCase().includes(query));
                    const franchiseMatch = m.franchise && m.franchise.toLowerCase().includes(query);
                    const yearMatch = m.year && m.year.toString().includes(query);
                    const genreMatch = m.genre && m.genre.toLowerCase().includes(query);
                    matchQuery = titleMatch || castMatch || franchiseMatch || yearMatch || genreMatch;
                }
                return matchFranchise && matchGenre && matchQuery;
            });

            // Ordenação
            if (currentSort === 'newest') {
                filtered.sort((a, b) => {
                    const dA = a.releaseDate || (a.year + '-01-01');
                    const dB = b.releaseDate || (b.year + '-01-01');
                    if (dB !== dA) return dB.localeCompare(dA);
                    return (b.rating || 0) - (a.rating || 0);
                });
            } else if (currentSort === 'rating') {
                filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (currentSort === 'az') {
                filtered.sort((a, b) => a.title.localeCompare(b.title));
            } else if (currentSort === 'oldest') {
                filtered.sort((a, b) => {
                    const dA = a.releaseDate || (a.year + '-01-01');
                    const dB = b.releaseDate || (b.year + '-01-01');
                    return dA.localeCompare(dB);
                });
            }

            if (filtered.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #94a3b8; font-size: 15px;">Nenhum filme encontrado para os filtros selecionados.</div>';
                return;
            }

            let html = '';
            filtered.forEach(m => {
                const poster = m.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80';
                const ratingBadge = m.rating ? '<span class="movie-badge-rating">⭐ ' + m.rating + '</span>' : '';
                const yearBadge = m.year ? '<span class="movie-badge-year">' + m.year + '</span>' : '';
                const sagaBadge = m.franchise ? '<span class="movie-badge-saga">' + m.franchise + '</span>' : '';
                const castStr = (m.cast && m.cast.length > 0) ? '👤 ' + m.cast.slice(0, 2).join(', ') : '';

                html += '<div class="movie-card" onclick="openMovieModal(\\'' + m.id + '\\')">' +
                    '<div class="movie-poster-wrap">' +
                        '<img class="movie-poster-img" src="' + poster + '" loading="lazy" onerror="this.src=\\'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80\\'" alt="' + escapeJs(m.title) + '">' +
                        ratingBadge + yearBadge + sagaBadge +
                        '<div class="movie-card-overlay">' +
                            '<button class="btn-play-quick" onclick="event.stopPropagation(); playMovieById(\\'' + m.id + '\\')">▶ Assistir</button>' +
                            '<button class="btn-info-quick" onclick="event.stopPropagation(); openMovieModal(\\'' + m.id + '\\')">ℹ️ Detalhes</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="movie-card-info">' +
                        '<h4 title="' + escapeJs(m.title) + '">' + m.title + '</h4>' +
                        '<div class="movie-card-sub">' +
                            '<span>' + (m.genre || 'Filme') + '</span>' +
                            '<span>⏱ ' + (m.runtime || 115) + 'm</span>' +
                        '</div>' +
                        (castStr ? '<div class="movie-card-cast" title="' + escapeJs(castStr) + '">' + castStr + '</div>' : '') +
                    '</div>' +
                '</div>';
            });
            grid.innerHTML = html;
        }

        function renderSeries() {
            const container = document.getElementById('contentContainer');
            container.innerHTML = '<div class="movies-grid" id="seriesGrid"></div>';
            const grid = document.getElementById('seriesGrid');
            const query = document.getElementById('searchInput').value.toLowerCase().trim();

            const filtered = allSeries.filter(s => {
                const matchCat = (currentCategory === 'Todos') || (s.genre === currentCategory);
                const matchQuery = !query || s.title.toLowerCase().includes(query);
                return matchCat && matchQuery;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">Nenhuma série encontrada.</div>';
                return;
            }

            let html = '';
            filtered.forEach(s => {
                const count = s.episodes ? s.episodes.length : 0;
                html += '<div class="channel-card" onclick="alert(\\'Série: ' + escapeJs(s.title) + '\\')">' +
                    '<div class="card-logo" style="display:flex;align-items:center;justify-content:center;font-size:22px;">🍿</div>' +
                    '<div class="card-meta">' +
                        '<h4>' + s.title + '</h4>' +
                        '<div class="meta-row"><span>' + (s.genre || 'Série') + '</span><span class="card-res-badge badge-hd">' + count + ' eps</span></div>' +
                    '</div>' +
                '</div>';
            });
            grid.innerHTML = html;
        }

        // Modal de Detalhes Cinematográficos
        function openMovieModal(id) {
            const m = allMovies.find(item => item.id === id);
            if (!m) return;

            document.getElementById('modalTitle').innerText = m.title;
            document.getElementById('modalOriginalTitle').innerText = (m.originalTitle && m.originalTitle !== m.title) ? 'Título original: ' + m.originalTitle : '';
            document.getElementById('modalPoster').src = m.poster || '';
            document.getElementById('modalBackdrop').style.backgroundImage = 'url("' + (m.backdrop || m.poster) + '")';

            let tagsHtml = '';
            if (m.franchise) tagsHtml += '<span class="tag-pill tag-saga">⚡ ' + m.franchise + '</span>';
            (m.genres || [m.genre || 'Filme']).forEach(g => {
                tagsHtml += '<span class="tag-pill">' + g + '</span>';
            });
            document.getElementById('modalTags').innerHTML = tagsHtml;

            let metaHtml = '<span>📅 Ano: <strong>' + (m.year || '2024') + '</strong></span>' +
                           '<span>⭐ Nota Crítica: <strong>' + (m.rating || '7.5') + ' / 10</strong> (' + (m.voteCount || 1500) + ' votos)</span>' +
                           '<span>⏱ Duração: <strong>' + (m.runtime || 115) + ' min</strong></span>';
            document.getElementById('modalMetaRow').innerHTML = metaHtml;

            document.getElementById('modalOverview').innerText = m.overview || 'Sinopse não informada.';

            let castHtml = '';
            if (m.cast && m.cast.length > 0) {
                m.cast.forEach(actor => {
                    castHtml += '<span class="cast-chip" onclick="searchByActor(\\'' + escapeJs(actor) + '\\')">👤 ' + actor + '</span>';
                });
            } else {
                castHtml = '<span style="color:#94a3b8; font-size:12px;">Elenco principal não listado.</span>';
            }
            document.getElementById('modalCastChips').innerHTML = castHtml;

            const startPlay = function() {
                closeMovieModal();
                playMovieById(m.id);
            };
            const playBtn = document.getElementById('modalPlayBtn');
            const playBtnTop = document.getElementById('modalPlayBtnTop');
            const playBtnSide = document.getElementById('modalPlayBtnSide');
            const posterImg = document.getElementById('modalPoster');
            if (playBtn) playBtn.onclick = startPlay;
            if (playBtnTop) playBtnTop.onclick = startPlay;
            if (playBtnSide) playBtnSide.onclick = startPlay;
            if (posterImg) posterImg.onclick = startPlay;

            const dialog = document.querySelector('.movie-modal-dialog');
            if (dialog) dialog.scrollTop = 0;
            document.getElementById('movieModal').classList.add('open');
        }

        function closeMovieModal(e) {
            if (!e || e.target.id === 'movieModal' || e.target.classList.contains('modal-close-btn')) {
                document.getElementById('movieModal').classList.remove('open');
            }
        }

        function searchByActor(actor) {
            closeMovieModal();
            document.getElementById('searchInput').value = actor;
            renderMovies();
        }

        function selectChannelById(id) {
            const ch = allChannels.find(c => c.id === id);
            if (ch) playChannel(ch, 'HD');
        }

        function playById(id) {
            selectChannelById(id);
        }

        function playChannel(ch, quality = 'HD') {
            activeChannel = ch;
            activeQuality = quality;
            activeMedia = { type: 'channel', data: ch };

            document.getElementById('playerTitle').innerText = ch.name;
            document.getElementById('playerCategory').innerText = ch.group + ' • Resolução: ' + quality;
            document.getElementById('playerLogo').src = ch.logo || 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';

            renderQualitySelector(ch, quality);

            const streamUrl = ch.streamUrl + '?q=' + encodeURIComponent(quality);
            playStream(streamUrl, true);
            renderChannels();
        }

        function renderQualitySelector(ch, currentQ) {
            const container = document.getElementById('qualityPills');
            const available = ch.qualities || ['HD'];
            const order = ['4K', 'FHD', 'HD', 'SD'];
            const sorted = order.filter(q => available.includes(q));
            if (sorted.length === 0) sorted.push('HD');

            let html = '';
            sorted.forEach(q => {
                const isActive = (q === currentQ) ? ' active' : '';
                const is4k = (q === '4K') ? ' btn-4k' : '';
                html += '<button class="q-btn' + is4k + isActive + '" onclick="switchQuality(\\'' + q + '\\')">' + q + '</button>';
            });
            container.innerHTML = html;
        }

        function switchQuality(newQ) {
            if (activeChannel) playChannel(activeChannel, newQ);
        }

        // Tocar Filme via Proxy VOD Local com Range Seekable (HTTP 206)
        function playMovieById(id) {
            const m = allMovies.find(item => item.id === id);
            if (!m) return;
            activeMedia = { type: 'movie', data: m };

            document.getElementById('playerTitle').innerText = m.title;
            const castSnippet = m.cast && m.cast.length > 0 ? ' • ' + m.cast.slice(0, 2).join(', ') : '';
            document.getElementById('playerCategory').innerText = m.year + ' • ⭐ ' + m.rating + ' • ' + (m.franchise || m.genre) + castSnippet;
            document.getElementById('playerLogo').src = m.poster || 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';
            document.getElementById('qualityPills').innerHTML = '<button class="q-btn active">MP4 HD</button>';

            // URL do Proxy VOD que resolve redirecionamentos e entrega vídeo com seek/range
            const vodProxyUrl = '/vod/stream?url=' + encodeURIComponent(m.url);
            playStream(vodProxyUrl, false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        let stallWatchdog = null;

        function playStream(streamUrl, isHls) {
            const video = document.getElementById('webVideo');
            if (stallWatchdog) {
                clearTimeout(stallWatchdog);
                stallWatchdog = null;
            }
            if (hlsPlayer) {
                hlsPlayer.destroy();
                hlsPlayer = null;
            }
            video.pause();
            video.removeAttribute('src');
            video.load();

            if (isHls && Hls && Hls.isSupported()) {
                hlsPlayer = new Hls({
                    enableWorker: true,
                    lowLatencyMode: false,
                    backBufferLength: 60,
                    maxBufferLength: 30,
                    maxMaxBufferLength: 60,
                    maxBufferSize: 60 * 1000 * 1000,
                    manifestLoadingTimeOut: 15000,
                    manifestLoadingMaxRetry: 6,
                    manifestLoadingRetryDelay: 800,
                    fragLoadingTimeOut: 20000,
                    fragLoadingMaxRetry: 6,
                    fragLoadingRetryDelay: 1000
                });

                hlsPlayer.loadSource(streamUrl);
                hlsPlayer.attachMedia(video);

                hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                    video.play().catch(e => console.log('Autoplay:', e));
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
                                setTimeout(() => {
                                    if (activeChannel) playChannel(activeChannel, activeQuality);
                                }, 1500);
                                break;
                        }
                    }
                });
            } else {
                video.src = streamUrl;
                video.play().catch(e => console.log('Autoplay:', e));
            }
        }

        function reloadCurrent() {
            if (activeMedia) {
                if (activeMedia.type === 'channel') playChannel(activeMedia.data, activeQuality);
                else if (activeMedia.type === 'movie') playMovieById(activeMedia.data.id);
            }
        }

        function toggleFullscreen() {
            const video = document.getElementById('webVideo');
            if (!document.fullscreenElement) {
                if (video.requestFullscreen) video.requestFullscreen();
                else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
                else if (video.msRequestFullscreen) video.msRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
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
    console.log(` IPTV Brasil - Web TV Player & VOD Cinema Online!`);
    console.log(` Acesse no navegador: http://localhost:${PORT}`);
    console.log(`=======================================================`);
});
