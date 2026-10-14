/**
 * Juggo TV - Painel de Administração & Agendador Autônomo
 * - Autenticação simples (neto / neto)
 * - Central de controle com URLs para Smart TV (M3U com Token)
 * - Atualizador e Agendador de Jogos do Dia com ESPN
 * - Monitoramento em tempo real de Canais, Filmes, Séries e VPS
 * - Alternador dinâmico de Modo de Stream (REDIRECT vs PROXY)
 */

const { exec } = require('child_process');
const os = require('os');
const path = require('path');

let lastGamesUpdateTimestamp = null;
let lastUpdateOutput = 'Nenhuma execução recente.';
let isUpdating = false;

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m`;
}

function isAuthenticated(req) {
    const cookieHeader = req.headers.cookie || '';
    return cookieHeader.includes('juggo_admin_session=neto_authenticated');
}

function handleAdminRoutes(req, res, context) {
    const { pathname, parsedUrl, clientHost, channels, ALL_MOVIES, ALL_SERIES, activeStats, BACKUP_SERVERS } = context;

    // 1. Rota de Login POST
    if (pathname === '/admin/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                let user = '', pass = '';
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                    const data = JSON.parse(body);
                    user = data.username;
                    pass = data.password;
                } else {
                    const params = new URLSearchParams(body);
                    user = params.get('username');
                    pass = params.get('password');
                }

                if (user === 'neto' && pass === 'neto') {
                    res.writeHead(302, {
                        'Set-Cookie': 'juggo_admin_session=neto_authenticated; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax',
                        'Location': '/admin'
                    });
                    res.end();
                } else {
                    res.writeHead(302, {
                        'Location': '/admin?error=invalid_credentials'
                    });
                    res.end();
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Erro ao processar login.');
            }
        });
        return true;
    }

    // 2. Rota de Logout
    if (pathname === '/admin/logout') {
        res.writeHead(302, {
            'Set-Cookie': 'juggo_admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
            'Location': '/admin'
        });
        res.end();
        return true;
    }

    // 3. Rota Principal /admin
    if (pathname === '/admin' || pathname === '/painel') {
        if (!isAuthenticated(req)) {
            const hasError = parsedUrl.searchParams.get('error') === 'invalid_credentials';
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderAdminLogin(hasError));
            return true;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderAdminDashboard(context));
        return true;
    }

    // 4. API de Status do Painel
    if (pathname === '/api/admin/status') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autorizado' }));
            return true;
        }

        let gamesTodayCount = 0;
        let gamesWeekCount = 0;
        for (const [_, ch] of channels.entries()) {
            if (ch.group.includes('Jogos do Dia')) gamesTodayCount++;
            else if (ch.group.includes('Jogos da Semana')) gamesWeekCount++;
        }

        const freeMem = os.freemem();
        const totalMem = os.totalmem();
        const usedMem = totalMem - freeMem;

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            appName: context.APP_NAME || 'Juggo TV',
            uptime: formatUptime(process.uptime()),
            totalChannels: channels.size,
            gamesToday: gamesTodayCount,
            gamesWeek: gamesWeekCount,
            totalMovies: ALL_MOVIES.length,
            totalSeries: ALL_SERIES.length,
            memoryUsed: formatBytes(usedMem),
            memoryTotal: formatBytes(totalMem),
            memoryPercent: Math.round((usedMem / totalMem) * 100),
            streamMode: context.STREAM_MODE,
            securityToken: context.SECURITY_TOKEN,
            playlistUrl: `http://${clientHost}/playlist.m3u?token=${context.SECURITY_TOKEN}`,
            isUpdating: isUpdating,
            lastGamesUpdate: lastGamesUpdateTimestamp || 'Pendente / Ao Iniciar',
            lastUpdateOutput: lastUpdateOutput,
            backupServers: BACKUP_SERVERS
        }));
        return true;
    }

    // 5. API de Acionamento Manual de Jogos do Dia
    if (pathname === '/api/admin/update-games' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autorizado' }));
            return true;
        }

        if (isUpdating) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Já existe uma atualização em andamento.' }));
            return true;
        }

        isUpdating = true;
        const scriptPath = path.join(__dirname, 'atualizar_jogos_do_dia.js');

        exec(`node "${scriptPath}"`, { cwd: __dirname }, (error, stdout, stderr) => {
            isUpdating = false;
            if (error) {
                lastUpdateOutput = `Erro: ${error.message}\n${stderr}`;
                console.error('[Admin] Erro ao atualizar jogos:', error.message);
            } else {
                lastGamesUpdateTimestamp = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
                lastUpdateOutput = stdout || 'Atualização concluída com sucesso!';
                console.log('[Admin] Jogos atualizados via painel administrativo.');
                if (typeof context.loadChannels === 'function') context.loadChannels();
            }
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Processo de mineração e atualização iniciado!' }));
        return true;
    }

    // 6. API para Alternar Modo de Streaming (REDIRECT vs PROXY)
    if (pathname === '/api/admin/toggle-mode' && req.method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autorizado' }));
            return true;
        }

        context.STREAM_MODE = context.STREAM_MODE === 'REDIRECT' ? 'PROXY' : 'REDIRECT';
        process.env.STREAM_MODE = context.STREAM_MODE;

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, newMode: context.STREAM_MODE }));
        return true;
    }

    return false;
}

// Agendador autônomo em background
function initAutonomousScheduler(context) {
    const hours = parseInt(process.env.JOGOS_UPDATE_INTERVAL_HOURS) || 4;
    const intervalMs = hours * 60 * 60 * 1000;

    console.log(`[Autônomo] Agendador de Jogos ativado (Intervalo: a cada ${hours} horas).`);

    // Primeira execução 30 segundos após o servidor subir
    setTimeout(() => {
        execGamesUpdate(context);
    }, 30 * 1000);

    // Execução recorrente
    setInterval(() => {
        execGamesUpdate(context);
    }, intervalMs);
}

function execGamesUpdate(context) {
    if (isUpdating) return;
    isUpdating = true;
    console.log('[Autônomo] Sincronizando tabela de Jogos do Dia com ESPN...');
    const scriptPath = path.join(__dirname, 'atualizar_jogos_do_dia.js');

    exec(`node "${scriptPath}"`, { cwd: __dirname }, (error, stdout, stderr) => {
        isUpdating = false;
        if (error) {
            lastUpdateOutput = `Erro no agendador: ${error.message}`;
            console.error('[Autônomo] Falha na sincronização:', error.message);
        } else {
            lastGamesUpdateTimestamp = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
            lastUpdateOutput = stdout || 'Sincronizado automaticamente com sucesso!';
            console.log('[Autônomo] Jogos do Dia atualizados com sucesso e recarregados em memória!');
            if (typeof context.loadChannels === 'function') context.loadChannels();
        }
    });
}

function renderAdminLogin(hasError) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Juggo TV - Área de Membros</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body {
            background: radial-gradient(circle at 50% 20%, #151d33 0%, #080b12 100%);
            color: #f8fafc;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-card {
            background: rgba(19, 27, 46, 0.75);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 40px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(37, 99, 235, 0.15);
            text-align: center;
        }
        .logo-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            color: white;
            padding: 8px 20px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 20px;
            box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
        }
        h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; color: #ffffff; }
        p { color: #94a3b8; font-size: 14px; margin-bottom: 30px; }
        .form-group { text-align: left; margin-bottom: 20px; }
        label { display: block; font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px; }
        input {
            width: 100%;
            padding: 14px 18px;
            background: rgba(10, 15, 29, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            color: #ffffff;
            font-size: 15px;
            outline: none;
            transition: all 0.2s;
        }
        input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
        .btn-submit {
            width: 100%;
            padding: 14px;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: 10px;
            box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
        }
        .btn-submit:hover { transform: translateY(-2px); box-shadow: 0 14px 25px -5px rgba(37, 99, 235, 0.6); }
        .error-alert {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 12px;
            border-radius: 10px;
            font-size: 13px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="login-card">
        <div class="logo-badge">⚡ JUGGO TV CLOUD</div>
        <h1>Área de Membros</h1>
        <p>Acesse o painel para gerenciar a lista e os jogos.</p>

        ${hasError ? `<div class="error-alert">Login ou senha incorretos. Tente novamente.</div>` : ''}

        <form action="/admin/login" method="POST">
            <div class="form-group">
                <label for="username">Usuário</label>
                <input type="text" id="username" name="username" placeholder="Digite seu login" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Senha</label>
                <input type="password" id="password" name="password" placeholder="Digite sua senha" required>
            </div>
            <button type="submit" class="btn-submit">Entrar no Painel</button>
        </form>
    </div>
</body>
</html>`;
}

function renderAdminDashboard(context) {
    const { clientHost, SECURITY_TOKEN, STREAM_MODE, APP_NAME } = context;
    const playlistUrl = `http://${clientHost}/playlist.m3u?token=${SECURITY_TOKEN}`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Administração - ${APP_NAME}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #07090e;
            --surface: #101626;
            --surface-card: #131b2e;
            --border: rgba(255, 255, 255, 0.08);
            --primary: #2563eb;
            --primary-light: #60a5fa;
            --accent: #10b981;
            --gold: #f59e0b;
            --danger: #ef4444;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Outfit', sans-serif; }
        body { background: var(--bg); color: var(--text-main); min-height: 100vh; padding-bottom: 60px; }
        
        .header {
            background: rgba(16, 22, 38, 0.85);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid var(--border);
            padding: 18px 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .header-brand { display: flex; align-items: center; gap: 14px; }
        .logo-tag {
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            color: white;
            font-weight: 800;
            font-size: 13px;
            padding: 5px 14px;
            border-radius: 8px;
            letter-spacing: 0.5px;
        }
        .header-title { font-size: 20px; font-weight: 800; }
        .header-actions { display: flex; align-items: center; gap: 16px; }
        .btn-link {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            transition: color 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .btn-link:hover { color: #fff; }
        .btn-logout {
            background: rgba(239, 68, 68, 0.15);
            color: #fca5a5;
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 8px 18px;
            border-radius: 10px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.2s;
        }
        .btn-logout:hover { background: #ef4444; color: #fff; }

        .container { max-width: 1240px; margin: 32px auto; padding: 0 24px; }

        /* Top Hero URL Box */
        .url-banner {
            background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(124, 58, 237, 0.15));
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 20px;
            padding: 28px;
            margin-bottom: 32px;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
            position: relative;
            overflow: hidden;
        }
        .url-banner::after {
            content: '';
            position: absolute;
            top: -50%;
            right: -10%;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, transparent 70%);
            pointer-events: none;
        }
        .url-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .url-title { font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .badge-live {
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent);
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .badge-live::before {
            content: '';
            width: 8px;
            height: 8px;
            background: var(--accent);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--accent);
        }
        .url-input-group {
            display: flex;
            gap: 12px;
            align-items: center;
            background: rgba(10, 15, 29, 0.85);
            padding: 8px 12px 8px 20px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .url-text {
            flex: 1;
            font-family: monospace;
            font-size: 15px;
            color: #93c5fd;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .btn-copy {
            background: var(--primary);
            color: white;
            border: none;
            padding: 12px 22px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 8px 16px rgba(37, 99, 235, 0.3);
        }
        .btn-copy:hover { background: #1d4ed8; transform: translateY(-2px); }
        .url-hint { font-size: 13px; color: var(--text-muted); margin-top: 10px; }

        /* Bento Grid */
        .bento-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 24px;
            margin-bottom: 32px;
        }
        .card {
            background: var(--surface-card);
            border: 1px solid var(--border);
            border-radius: 18px;
            padding: 24px;
            transition: transform 0.2s, border-color 0.2s;
        }
        .card:hover { border-color: rgba(255, 255, 255, 0.18); transform: translateY(-3px); }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .card-title { font-size: 14px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .card-icon { font-size: 20px; }
        .card-value { font-size: 32px; font-weight: 900; color: #fff; margin-bottom: 4px; }
        .card-desc { font-size: 13px; color: var(--text-muted); }

        /* Action Sections */
        .actions-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }
        @media (max-width: 860px) { .actions-grid { grid-template-columns: 1fr; } }

        .action-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 28px;
        }
        .action-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .action-title { font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
        
        .btn-action {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.4);
            margin-top: 16px;
        }
        .btn-action:hover { transform: translateY(-2px); box-shadow: 0 14px 25px -5px rgba(16, 185, 129, 0.6); }
        .btn-action:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .toggle-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(10, 15, 29, 0.6);
            border: 1px solid var(--border);
            padding: 16px 20px;
            border-radius: 12px;
            margin-top: 16px;
        }
        .toggle-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 10px 18px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .toggle-btn:hover { background: #1d4ed8; }

        .log-box {
            background: #090d16;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            font-family: monospace;
            font-size: 13px;
            color: #a5f3fc;
            max-height: 180px;
            overflow-y: auto;
            white-space: pre-wrap;
            margin-top: 16px;
        }

        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: #10b981;
            color: white;
            padding: 14px 24px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
            display: none;
            z-index: 100;
            animation: fadeIn 0.3s;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <header class="header">
        <div class="header-brand">
            <span class="logo-tag">JUGGO TV</span>
            <span class="header-title">Painel de Membros & Controle</span>
        </div>
        <div class="header-actions">
            <a href="/" target="_blank" class="btn-link">📺 Abrir Web TV</a>
            <a href="/admin/logout" class="btn-logout">Sair</a>
        </div>
    </header>

    <main class="container">
        <!-- URL Banner da Smart TV -->
        <div class="url-banner">
            <div class="url-header">
                <div class="url-title">📡 Link M3U Oficial para Smart TV & Players</div>
                <div class="badge-live">Servidor Online</div>
            </div>
            <div class="url-input-group">
                <div class="url-text" id="playlistUrlText">${playlistUrl}</div>
                <button class="btn-copy" onclick="copyPlaylistUrl()">📋 Copiar Link</button>
            </div>
            <div class="url-hint">
                👉 Cole esta URL diretamente no <b>IPTV Smarters, TiviMate, SS IPTV, Smart IPTV</b> ou no navegador da sua TV.
            </div>
        </div>

        <!-- Estatísticas Gerais -->
        <div class="bento-grid">
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Canais Ao Vivo</span>
                    <span class="card-icon">📺</span>
                </div>
                <div class="card-value" id="statChannels">${context.channels.size}</div>
                <div class="card-desc">Com EPG e Logos HD oficiais</div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">Jogos Hoje & Semana</span>
                    <span class="card-icon">⚽</span>
                </div>
                <div class="card-value" id="statGames">...</div>
                <div class="card-desc">Sincronizados via ESPN API</div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">Catálogo VOD</span>
                    <span class="card-icon">🎬</span>
                </div>
                <div class="card-value">${context.ALL_MOVIES.length}</div>
                <div class="card-desc">${context.ALL_SERIES.length} séries adicionadas</div>
            </div>

            <div class="card">
                <div class="card-header">
                    <span class="card-title">Uptime & Memória</span>
                    <span class="card-icon">⚡</span>
                </div>
                <div class="card-value" id="statMem">...</div>
                <div class="card-desc" id="statUptime">Uptime da VPS</div>
            </div>
        </div>

        <!-- Seções de Ação -->
        <div class="actions-grid">
            <!-- 1. Gestão de Jogos -->
            <div class="action-card">
                <div class="action-card-header">
                    <div class="action-title">⚽ Jogos do Dia (ESPN)</div>
                    <span style="font-size: 13px; color: var(--text-muted);" id="lastUpdateLabel">Última sync: Carregando...</span>
                </div>
                <p style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">
                    O agendador roda sozinho em segundo plano a cada 4 horas. Você também pode forçar a sincronização instantânea agora.
                </p>

                <button class="btn-action" id="btnUpdateGames" onclick="triggerUpdateGames()">
                    <span>⚡ Atualizar Jogos do Dia Agora</span>
                </button>

                <div class="log-box" id="gamesLogBox">Aguardando comando...</div>
            </div>

            <!-- 2. Estratégia de Rede GCP -->
            <div class="action-card">
                <div class="action-card-header">
                    <div class="action-title">🛡️ Estratégia de Rede & VPS</div>
                </div>
                <p style="font-size: 14px; color: var(--text-muted); line-height: 1.5;">
                    O modo <b>REDIRECT (HTTP 302)</b> poupa 100% da sua cota de saída na Google Cloud Platform Always Free.
                </p>

                <div class="toggle-box">
                    <div>
                        <div style="font-weight: 700; font-size: 15px;" id="modeText">Modo Atual: ${STREAM_MODE}</div>
                        <div style="font-size: 13px; color: var(--text-muted);">
                            ${STREAM_MODE === 'REDIRECT' ? 'Gasto de banda da VPS: 0 MB (Grátis)' : 'Túnel direto (Gasta dados da VPS)'}
                        </div>
                    </div>
                    <button class="toggle-btn" onclick="toggleStreamMode()">Alternar Modo</button>
                </div>

                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border);">
                    <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">SERVIDORES RESERVAS (PLANO C):</div>
                    <div style="font-size: 13px; color: #94a3b8; font-family: monospace;">
                        ${context.BACKUP_SERVERS.join(' • ')}
                    </div>
                </div>
            </div>
        </div>
    </main>

    <div class="toast" id="toast">Link copiado para a área de transferência!</div>

    <script>
        function copyPlaylistUrl() {
            const url = document.getElementById('playlistUrlText').innerText;
            navigator.clipboard.writeText(url).then(() => {
                showToast('Link da lista copiado! Cole na sua Smart TV.');
            });
        }

        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerText = msg;
            t.style.display = 'block';
            setTimeout(() => { t.style.display = 'none'; }, 3500);
        }

        function refreshStatus() {
            fetch('/api/admin/status')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('statChannels').innerText = data.totalChannels;
                    document.getElementById('statGames').innerText = data.gamesToday + ' hoje / ' + data.gamesWeek + ' sem.';
                    document.getElementById('statMem').innerText = data.memoryUsed;
                    document.getElementById('statUptime').innerText = 'Ativo há ' + data.uptime + ' (' + data.memoryPercent + '% RAM)';
                    document.getElementById('lastUpdateLabel').innerText = 'Última sync: ' + data.lastGamesUpdate;
                    document.getElementById('gamesLogBox').innerText = data.lastUpdateOutput;
                    document.getElementById('modeText').innerText = 'Modo Atual: ' + data.streamMode;
                    
                    const btn = document.getElementById('btnUpdateGames');
                    if (data.isUpdating) {
                        btn.disabled = true;
                        btn.innerText = '⏳ Sincronizando partidas com a ESPN...';
                    } else {
                        btn.disabled = false;
                        btn.innerText = '⚡ Atualizar Jogos do Dia Agora';
                    }
                })
                .catch(e => console.log('Erro ao atualizar status:', e));
        }

        function triggerUpdateGames() {
            const btn = document.getElementById('btnUpdateGames');
            btn.disabled = true;
            btn.innerText = '⏳ Conectando aos servidores da ESPN...';

            fetch('/api/admin/update-games', { method: 'POST' })
                .then(r => r.json())
                .then(res => {
                    showToast(res.message);
                    setTimeout(refreshStatus, 2000);
                })
                .catch(() => {
                    showToast('Erro ao disparar atualização.');
                    btn.disabled = false;
                });
        }

        function toggleStreamMode() {
            fetch('/api/admin/toggle-mode', { method: 'POST' })
                .then(r => r.json())
                .then(res => {
                    showToast('Modo alterado para: ' + res.newMode);
                    refreshStatus();
                });
        }

        setInterval(refreshStatus, 4000);
        refreshStatus();
    </script>
</body>
</html>`;
}

module.exports = {
    handleAdminRoutes,
    initAutonomousScheduler
};
