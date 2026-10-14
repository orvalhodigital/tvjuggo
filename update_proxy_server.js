const fs = require('fs');

const code = `/**
 * IPTV Brasil 2026 - Web TV Player & Servidor Local
 * - Suporta TV Ao Vivo (312 canais com logos verificadas e EPG)
 * - Navegação Superior: 📺 TV Ao Vivo | 🎬 Filmes | 🍿 Séries
 * - Badges de Resolução em todos os canais (4K, FHD, HD, SD)
 * - Padrão de reprodução: HD
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = '0.0.0.0';
const M3U_PATH = path.join(__dirname, 'Canais de TV.m3u8');

const channels = new Map();
const activeStats = new Map();

function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'canal';
}

// Carregamento dinâmico de qualidades (4K, FHD, HD, SD)
const QUALITIES_FILE = path.join(__dirname, 'channel_qualities.json');
let CHANNEL_QUALITIES = {};

try {
    if (fs.existsSync(QUALITIES_FILE)) {
        CHANNEL_QUALITIES = JSON.parse(fs.readFileSync(QUALITIES_FILE, 'utf8'));
        console.log(\`[Qualidades] Carregadas 4K/FHD/HD/SD para \${Object.keys(CHANNEL_QUALITIES).length} canais.\`);
    }
} catch (err) {
    console.error('[Qualidades] Erro ao carregar channel_qualities.json:', err.message);
}

// Carregamento de Filmes e Séries
let ALL_MOVIES = [];
let ALL_SERIES = [];
try {
    const fPath = path.join(__dirname, 'filmes.json');
    if (fs.existsSync(fPath)) ALL_MOVIES = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    const sPath = path.join(__dirname, 'series.json');
    if (fs.existsSync(sPath)) ALL_SERIES = JSON.parse(fs.readFileSync(sPath, 'utf8'));
    console.log(\`[VOD] Carregados \${ALL_MOVIES.length} filmes e \${ALL_SERIES.length} séries.\`);
} catch (e) {
    console.error('[VOD] Erro ao carregar filmes/series:', e.message);
}

// Carregar Canais do arquivo M3U8
function loadChannels() {
    channels.clear();
    if (!fs.existsSync(M3U_PATH)) {
        console.error('Arquivo Canais de TV.m3u8 não encontrado!');
        return;
    }

    const content = fs.readFileSync(M3U_PATH, 'utf8');
    const lines = content.split('\\n');

    let currentExt = null;
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF:')) {
            currentExt = line;
        } else if (line.startsWith('http') && currentExt) {
            const rawUrl = line;
            const nameMatch = currentExt.match(/,([^\\r\\n]+)$/);
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
                uniqueSlug = \`\${slug}-\${counter++}\`;
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

    console.log(\`[Canais] Carregados \${channels.size} canais em .m3u8.\`);
}

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
                            next = \`\${parsed.protocol}//\${parsed.host}\${next}\`;
                        }
                        return get(next, depth + 1);
                    }
                    if (res.statusCode !== 200) {
                        return resolve(null);
                    }
                    let body = '';
                    res.on('data', c => body += c);
                    res.on('end', () => {
                        if (body.includes('#EXTM3U')) {
                            const baseUrl = new URL(currentUrl);
                            const lines = body.split('\\n');
                            const resolvedLines = lines.map(line => {
                                const trimmed = line.trim();
                                if (!trimmed || trimmed.startsWith('#')) return line;
                                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return line;
                                if (trimmed.startsWith('/')) {
                                    return \`\${baseUrl.protocol}//\${baseUrl.host}\${trimmed}\`;
                                }
                                const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
                                return \`\${baseUrl.protocol}//\${baseUrl.host}\${basePath}\${trimmed}\`;
                            });
                            resolve({ body: resolvedLines.join('\\n'), finalUrl: currentUrl });
                        } else {
                            resolve(null);
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

async function handleHlsRequest(channel, req, res, queryQuality) {
    let candidateUrls = [];

    if (channel.qualities) {
        const q = (queryQuality || 'HD').toUpperCase();
        if (channel.qualities[q]) {
            candidateUrls.push(channel.qualities[q]);
        }
        if (q !== 'HD' && channel.qualities['HD']) candidateUrls.push(channel.qualities['HD']);
        if (q !== 'FHD' && channel.qualities['FHD']) candidateUrls.push(channel.qualities['FHD']);
        if (q !== 'SD' && channel.qualities['SD']) candidateUrls.push(channel.qualities['SD']);
        if (q !== '4K' && channel.qualities['4K']) candidateUrls.push(channel.qualities['4K']);
    } else {
        candidateUrls = channel.urls;
    }

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

    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(\`Sinal indisponível para o canal: \${channel.name}\`);
}

// Servidor HTTP
const server = http.createServer((req, res) => {
    const clientHost = req.headers.host || \`localhost:\${PORT}\`;
    const parsedUrl = new URL(req.url, \`http://\${clientHost}\`);
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

    // 1. Web TV App
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

    // 3. Playlist Dinâmica M3U8
    if (pathname === '/playlist.m3u' || pathname === '/playlist.m3u8' || pathname === '/canais.m3u8') {
        res.writeHead(200, {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Content-Disposition': 'inline; filename="playlist.m3u8"',
            'Access-Control-Allow-Origin': '*'
        });

        let m3u = \`#EXTM3U url-tvg="http://\${clientHost}/epg.xml,https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz,https://epg.pw/xmltv/epg_BR.xml.gz" x-tvg-url="http://\${clientHost}/epg.xml,https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz,https://epg.pw/xmltv/epg_BR.xml.gz"\\n\\n\`;
        for (const [id, ch] of channels.entries()) {
            const streamUrl = \`http://\${clientHost}/stream/\${id}.m3u8\`;
            m3u += \`\${ch.rawExt}\\n\${streamUrl}\\n\`;
        }
        res.end(m3u);
        return;
    }

    // 4. API de Canais com Maior Resolução
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
                streamUrl: \`http://\${clientHost}/stream/\${id}.m3u8\`
            });
        }
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(list));
        return;
    }

    // 5. API de Filmes
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

    // 7. Stream HLS: /stream/:channelId.m3u8?q=HD
    if (pathname.startsWith('/stream/')) {
        let channelId = pathname.replace('/stream/', '').replace(/\\.(m3u8|ts)$/i, '');
        const channel = channels.get(channelId);

        if (!channel) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(\`Canal não encontrado: "\${channelId}"\`);
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
    return \`<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPTV Brasil - Web TV Player</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        :root {
            --bg: #0b0f19;
            --surface: #141c2e;
            --surface-hover: #1b263e;
            --border: rgba(255, 255, 255, 0.08);
            --primary: #2563eb;
            --primary-light: #60a5fa;
            --accent: #10b981;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            background-image: radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.12) 0px, transparent 50%),
                              radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.08) 0px, transparent 50%);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .container { max-width: 1440px; margin: 0 auto; padding: 0 24px; width: 100%; }

        nav {
            background: rgba(11, 15, 25, 0.95);
            backdrop-filter: blur(16px);
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
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #2563eb, #10b981);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }
        .brand-title {
            font-size: 19px;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }

        /* Menu Superior de Navegação */
        .nav-tabs {
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px;
            border-radius: 12px;
            border: 1px solid var(--border);
        }
        .nav-tab-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 7px 16px;
            border-radius: 8px;
            border: none;
            background: transparent;
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .nav-tab-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.06); }
        .nav-tab-btn.active {
            background: var(--primary);
            color: #fff;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
        }

        .search-container {
            flex-grow: 1;
            max-width: 400px;
            position: relative;
        }
        .search-input {
            width: 100%;
            background: rgba(20, 28, 46, 0.9);
            border: 1px solid var(--border);
            color: #fff;
            padding: 9px 16px 9px 38px;
            border-radius: 10px;
            font-size: 13px;
            outline: none;
            transition: all 0.2s;
        }
        .search-input:focus {
            border-color: var(--primary-light);
            box-shadow: 0 0 16px rgba(37, 99, 235, 0.25);
        }
        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 14px;
        }

        .player-theater {
            margin: 20px 0;
            background: var(--surface);
            border-radius: 16px;
            border: 1px solid var(--border);
            overflow: hidden;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
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
            background: rgba(15, 23, 42, 0.9);
            border-top: 1px solid var(--border);
            gap: 16px;
            flex-wrap: wrap;
        }
        .playing-info {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .playing-logo {
            width: 48px;
            height: 48px;
            object-fit: contain;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.05);
            padding: 4px;
            border: 1px solid var(--border);
        }
        .playing-title h2 { font-size: 17px; font-weight: 700; color: #fff; }
        .playing-title span { font-size: 12px; color: var(--text-muted); }

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
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-action:hover { background: rgba(255, 255, 255, 0.15); }

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

        /* Painel de Episódios de Séries */
        .series-panel {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 20px;
            display: none;
        }
        .episodes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 8px;
            margin-top: 12px;
        }
        .ep-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 7px 10px;
            color: #fff;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s;
        }
        .ep-btn:hover { background: var(--primary); border-color: var(--primary); }

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

        /* Resolução Badges Universais (4K, FHD, HD, SD) */
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
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
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

        /* Cartões de Filmes e Séries */
        .movie-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
        }
        .movie-card:hover {
            background: var(--surface-hover);
            border-color: var(--primary-light);
            transform: translateY(-3px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .movie-poster-mock {
            width: 100%;
            aspect-ratio: 16 / 10;
            background: linear-gradient(135deg, #1e293b, #0f172a);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            position: relative;
        }
        .movie-play-overlay {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s;
            font-size: 32px;
            color: #fff;
        }
        .movie-card:hover .movie-play-overlay { opacity: 1; }
        .movie-meta { padding: 12px; }
        .movie-meta h4 {
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 4px;
        }
        .movie-genre { font-size: 11px; color: var(--text-muted); }
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
                <button class="nav-tab-btn" id="tabFilmes" onclick="switchNavTab('filmes')">🎬 Filmes</button>
                <button class="nav-tab-btn" id="tabSeries" onclick="switchNavTab('series')">🍿 Séries</button>
            </div>

            <div class="search-container">
                <span class="search-icon">🔍</span>
                <input type="text" id="searchInput" class="search-input" placeholder="Buscar canal, filme ou jogo..." oninput="handleSearch()">
            </div>
            <div id="counterBadge" style="font-size:12px; color:var(--text-muted); font-weight:700;">
                312 Canais
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
                        <h2 id="playerTitle">Selecione um canal</h2>
                        <span id="playerCategory">Clique em qualquer canal para assistir</span>
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
                    <button class="btn-action" onclick="toggleFullscreen()">⛶ Tela Cheia</button>
                    <button class="btn-action" onclick="reloadCurrent()">🔄 Recarregar</button>
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

        <!-- Painel de Episódios de Séries -->
        <div id="seriesPanel" class="series-panel">
            <h3 id="seriesPanelTitle" style="font-size: 15px; font-weight: 700; color: #fff;">Episódios da Série</h3>
            <div id="episodesGrid" class="episodes-grid"></div>
        </div>

        <!-- Abas de Categorias -->
        <div class="categories-nav" id="categoryNav"></div>

        <!-- Grade de Conteúdo -->
        <div class="channels-grid" id="channelsGrid"></div>
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
        let hlsPlayer = null;

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

                switchNavTab('tv');

                // Tocar Premiere 2 por padrão
                const defaultCh = allChannels.find(c => c.id === 'premiere-2') || allChannels[0];
                if (defaultCh) {
                    playChannel(defaultCh, 'HD');
                }
            } catch (e) {
                console.error('Erro na inicialização:', e);
            }
        }

        function switchNavTab(tab) {
            currentNavTab = tab;
            currentCategory = 'Todos';
            document.getElementById('searchInput').value = '';
            document.getElementById('seriesPanel').style.display = 'none';

            document.getElementById('tabTv').classList.toggle('active', tab === 'tv');
            document.getElementById('tabFilmes').classList.toggle('active', tab === 'filmes');
            document.getElementById('tabSeries').classList.toggle('active', tab === 'series');

            document.getElementById('premiereBar').style.display = (tab === 'tv') ? 'flex' : 'none';
            document.getElementById('qualitySelector').style.display = (tab === 'tv') ? 'flex' : 'none';

            if (tab === 'tv') {
                document.getElementById('counterBadge').innerText = allChannels.length + ' Canais';
            } else if (tab === 'filmes') {
                document.getElementById('counterBadge').innerText = allMovies.length + ' Filmes';
            } else if (tab === 'series') {
                document.getElementById('counterBadge').innerText = allSeries.length + ' Séries';
            }

            renderCategories();
            renderContent();
        }

        function renderCategories() {
            const nav = document.getElementById('categoryNav');
            let cats = ['Todos'];

            if (currentNavTab === 'tv') {
                const set = new Set();
                allChannels.forEach(c => { if (c.group) set.add(c.group); });
                cats = ['Todos', ...Array.from(set)];
            } else if (currentNavTab === 'filmes') {
                const set = new Set();
                allMovies.forEach(m => { if (m.genre) set.add(m.genre); });
                cats = ['Todos', ...Array.from(set)];
            } else if (currentNavTab === 'series') {
                const set = new Set();
                allSeries.forEach(s => { if (s.genre) set.add(s.genre); });
                cats = ['Todos', ...Array.from(set)];
            }

            let html = '';
            cats.forEach(c => {
                const isActive = (c === currentCategory) ? ' active' : '';
                html += '<div class=\"cat-pill' + isActive + '\" onclick=\"selectCategory(\\'' + escapeJs(c) + '\\')\">' + c + '</div>';
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
            const grid = document.getElementById('channelsGrid');
            const query = document.getElementById('searchInput').value.toLowerCase().trim();

            const filtered = allChannels.filter(c => {
                const matchCat = (currentCategory === 'Todos') || (c.group === currentCategory);
                const matchQuery = !query || c.name.toLowerCase().includes(query) || (c.group && c.group.toLowerCase().includes(query));
                return matchCat && matchQuery;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div style=\"grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;\">Nenhum canal encontrado.</div>';
                return;
            }

            let html = '';
            filtered.forEach(c => {
                const logo = c.logo || 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';
                const isActive = (activeChannel && c.id === activeChannel.id) ? ' active' : '';
                const badge = getResBadge(c);

                html += '<div class=\"channel-card' + isActive + '\" onclick=\"selectChannelById(\\'' + c.id + '\\')\">' +
                    '<img class=\"card-logo\" src=\"' + logo + '\" onerror=\"this.src=\\'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png\\'\" alt=\"Logo\">' +
                    '<div class=\"card-meta\">' +
                        '<h4>' + c.name + '</h4>' +
                        '<div class=\"meta-row\"><span>' + (c.group || 'TV') + '</span>' + badge + '</div>' +
                    '</div>' +
                '</div>';
            });
            grid.innerHTML = html;
        }

        function renderMovies() {
            const grid = document.getElementById('channelsGrid');
            const query = document.getElementById('searchInput').value.toLowerCase().trim();

            const filtered = allMovies.filter(m => {
                const matchCat = (currentCategory === 'Todos') || (m.genre === currentCategory);
                const matchQuery = !query || m.title.toLowerCase().includes(query);
                return matchCat && matchQuery;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div style=\"grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;\">Nenhum filme encontrado.</div>';
                return;
            }

            let html = '';
            filtered.forEach(m => {
                html += '<div class=\"movie-card\" onclick=\"playMovieById(\\'' + m.id + '\\')\">' +
                    '<div class=\"movie-poster-mock\">🎬<div class=\"movie-play-overlay\">▶</div></div>' +
                    '<div class=\"movie-meta\">' +
                        '<h4>' + m.title + '</h4>' +
                        '<div class=\"movie-genre\">' + (m.genre || 'Filme') + '</div>' +
                    '</div>' +
                '</div>';
            });
            grid.innerHTML = html;
        }

        function renderSeries() {
            const grid = document.getElementById('channelsGrid');
            const query = document.getElementById('searchInput').value.toLowerCase().trim();

            const filtered = allSeries.filter(s => {
                const matchCat = (currentCategory === 'Todos') || (s.genre === currentCategory);
                const matchQuery = !query || s.title.toLowerCase().includes(query);
                return matchCat && matchQuery;
            });

            if (filtered.length === 0) {
                grid.innerHTML = '<div style=\"grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;\">Nenhuma série encontrada.</div>';
                return;
            }

            let html = '';
            filtered.forEach(s => {
                const count = s.episodes ? s.episodes.length : 0;
                html += '<div class=\"movie-card\" onclick=\"openSeriesPanel(\\'' + s.id + '\\')\">' +
                    '<div class=\"movie-poster-mock\">🍿<div class=\"movie-play-overlay\">👁</div></div>' +
                    '<div class=\"movie-meta\">' +
                        '<h4>' + s.title + '</h4>' +
                        '<div class=\"movie-genre\">' + (s.genre || 'Série') + ' • ' + count + ' eps</div>' +
                    '</div>' +
                '</div>';
            });
            grid.innerHTML = html;
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
                html += '<button class=\"q-btn' + is4k + isActive + '\" onclick=\"switchQuality(\\'' + q + '\\')\">' + q + '</button>';
            });
            container.innerHTML = html;
        }

        function switchQuality(newQ) {
            if (activeChannel) playChannel(activeChannel, newQ);
        }

        function playMovieById(id) {
            const m = allMovies.find(item => item.id === id);
            if (!m) return;
            activeMedia = { type: 'movie', data: m };

            document.getElementById('playerTitle').innerText = m.title;
            document.getElementById('playerCategory').innerText = 'Filme • ' + (m.genre || 'VOD');
            document.getElementById('playerLogo').src = 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';
            document.getElementById('qualityPills').innerHTML = '<button class=\"q-btn active\">MP4</button>';

            playStream(m.url, false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function openSeriesPanel(id) {
            const s = allSeries.find(item => item.id === id);
            if (!s) return;

            document.getElementById('seriesPanelTitle').innerText = s.title + ' - Episódios disponíveis';
            let html = '';
            (s.episodes || []).forEach(ep => {
                html += '<button class=\"ep-btn\" onclick=\"playEpisode(\\'' + s.id + '\\', ' + ep.season + ', ' + ep.episode + ')\">' + ep.name + '</button>';
            });
            document.getElementById('episodesGrid').innerHTML = html;
            const panel = document.getElementById('seriesPanel');
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth' });
        }

        function playEpisode(seriesId, season, episode) {
            const s = allSeries.find(item => item.id === seriesId);
            if (!s) return;
            const ep = s.episodes.find(e => e.season === season && e.episode === episode);
            if (!ep) return;

            activeMedia = { type: 'episode', data: { s, ep } };

            document.getElementById('playerTitle').innerText = s.title + ' - ' + ep.name;
            document.getElementById('playerCategory').innerText = 'Série • ' + (s.genre || 'VOD');
            document.getElementById('playerLogo').src = 'https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png';
            document.getElementById('qualityPills').innerHTML = '<button class=\"q-btn active\">MP4</button>';

            playStream(ep.url, false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function playStream(streamUrl, isHls) {
            const video = document.getElementById('webVideo');
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
                    backBufferLength: 60
                });
                hlsPlayer.loadSource(streamUrl);
                hlsPlayer.attachMedia(video);
                hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                    video.play().catch(e => console.log('Autoplay:', e));
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
                else if (activeMedia.type === 'episode') playEpisode(activeMedia.data.s.id, activeMedia.data.ep.season, activeMedia.data.ep.episode);
            }
        }

        function toggleFullscreen() {
            const video = document.getElementById('webVideo');
            if (!document.fullscreenElement) {
                video.requestFullscreen().catch(err => alert(err.message));
            } else {
                document.exitFullscreen();
            }
        }

        function escapeJs(str) {
            return (str || '').replace(/'/g, "\\\\'");
        }

        init();
    </script>
</body>
</html>\`;
}

loadChannels();

server.listen(PORT, HOST, () => {
    console.log(\`=======================================================\`);
    console.log(\` IPTV Brasil - Web TV Player Online!\`);
    console.log(\` Acesse no navegador: http://localhost:\${PORT}\`);
    console.log(\`=======================================================\`);
});
`;

fs.writeFileSync('proxy_server.js', code, 'utf8');
console.log('proxy_server.js updated successfully!');
