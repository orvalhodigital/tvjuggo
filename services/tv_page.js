/**
 * Juggo TV Studio - Página Exclusiva de TV Ao Vivo (/tv)
 * Design System: Linear / Netflix Dark Cinema Grid
 * - Navegação por Categorias (Esportes, Abertos, Filmes, Séries, Notícias, etc.)
 * - Busca Dinâmica Instantânea
 * - Badges de Resolução Oficial (4K, FHD, HD, SD)
 * - Player HLS Flutuante com Tela Cheia e Controle de Volume/Resolução
 * - Controle de 1 Tela Simultânea com Heartbeat Ativo
 */

function renderDedicatedTVPage(host, appName = 'Juggo TV Studio', currentUser = {}) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${appName} - TV Ao Vivo & Canais</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        :root {
            --bg-deep: #07090e;
            --bg-surface: #0e121d;
            --bg-card: rgba(18, 24, 38, 0.65);
            --bg-card-hover: rgba(28, 38, 62, 0.85);
            --border-glass: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(59, 130, 246, 0.5);
            --primary: #3b82f6;
            --primary-glow: rgba(59, 130, 246, 0.35);
            --accent: #10b981;
            --danger: #ef4444;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
        }

        * { margin:0; padding:0; box-sizing:border-box; font-family:'Outfit', sans-serif; user-select:none; }
        body {
            background: var(--bg-deep);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.16); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

        /* Topbar */
        .topbar {
            height: 70px;
            background: rgba(10, 14, 24, 0.85);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-glass);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .topbar-left {
            display: flex;
            align-items: center;
            gap: 32px;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 22px;
            font-weight: 900;
            letter-spacing: -0.5px;
            text-decoration: none;
            color: #fff;
        }
        .brand-badge {
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: #fff;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .nav-links {
            display: flex;
            align-items: center;
            gap: 18px;
        }
        .nav-link {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .nav-link:hover, .nav-link.active {
            color: #fff;
            background: rgba(255, 255, 255, 0.08);
        }

        .topbar-right {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .user-status-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.35);
            font-size: 12px;
            font-weight: 700;
            color: #10b981;
        }
        .pulse-live {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
        }

        /* Hero Sub-header */
        .tv-header {
            padding: 32px 40px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
        }
        .tv-title-area h2 {
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -0.5px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .tv-title-area p {
            font-size: 14px;
            color: var(--text-muted);
        }
        .search-box {
            position: relative;
            width: 320px;
        }
        .search-box input {
            width: 100%;
            padding: 12px 18px 12px 42px;
            background: rgba(20, 26, 42, 0.85);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
        }
        .search-box input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-glow);
        }
        .search-box span {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 16px;
            color: var(--text-dim);
        }

        /* Categories Filter Bar */
        .categories-bar {
            padding: 0 40px 24px;
            display: flex;
            gap: 10px;
            overflow-x: auto;
            white-space: nowrap;
        }
        .cat-pill {
            padding: 8px 18px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-glass);
            color: var(--text-muted);
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
        }
        .cat-pill:hover, .cat-pill.active {
            background: var(--primary);
            border-color: var(--primary);
            color: #fff;
            box-shadow: 0 4px 14px var(--primary-glow);
        }

        /* Channels Grid */
        .channels-container {
            padding: 0 40px 60px;
            flex: 1;
        }
        .channels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            gap: 20px;
        }
        .channel-card {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 18px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            overflow: hidden;
        }
        .channel-card:hover {
            transform: translateY(-5px);
            background: var(--bg-card-hover);
            border-color: var(--border-hover);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5), 0 0 20px var(--primary-glow);
        }
        .channel-logo-wrapper {
            width: 80px;
            height: 80px;
            border-radius: 14px;
            background: rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px;
            margin-bottom: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .channel-logo-wrapper img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        .channel-card h4 {
            font-size: 14.5px;
            font-weight: 800;
            color: #fff;
            margin-bottom: 8px;
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .channel-card-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            margin-top: auto;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.04);
        }
        .badge-res {
            background: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.35);
            padding: 2px 7px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 800;
        }
        .badge-group {
            font-size: 11px;
            color: var(--text-dim);
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* Player Modal */
        .player-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(24px);
            z-index: 200;
            display: none;
            flex-direction: column;
        }
        .player-modal.active { display: flex; }
        .player-topbar {
            height: 64px;
            padding: 0 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: #080b12;
        }
        .player-channel-info {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .player-channel-info img {
            width: 36px;
            height: 36px;
            object-fit: contain;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.08);
            padding: 4px;
        }
        .player-channel-info h3 { font-size: 16px; font-weight: 800; }
        .player-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .btn-action {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #fff;
            padding: 8px 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .btn-action:hover { background: rgba(255, 255, 255, 0.16); }
        .player-viewport {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            position: relative;
        }
        .player-viewport video {
            width: 100%;
            height: 100%;
            max-height: calc(100vh - 64px);
            object-fit: contain;
        }
    </style>
</head>
<body>

    <!-- Topbar -->
    <header class="topbar">
        <div class="topbar-left">
            <a href="/" class="brand">
                📺 ${appName} <span class="brand-badge">TV</span>
            </a>
            <nav class="nav-links">
                <a href="/" class="nav-link">⚽ Jogos do Dia</a>
                <a href="/tv" class="nav-link active">📺 TV Ao Vivo</a>
                ${currentUser.role === 'admin' ? '<a href="/users" class="nav-link" style="color:#60a5fa; font-weight:700;">👥 Painel Usuários</a>' : ''}
            </nav>
        </div>

        <div class="topbar-right">
            <div class="user-status-pill" id="screenStatusPill">
                <span class="pulse-live"></span>
                <span id="screenStatusLabel">1/1 Tela Conectada</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:13px; font-weight:700; color:#cbd5e1;">👤 ${currentUser.name || currentUser.username || 'Usuário'}</span>
                <a href="/logout" style="padding:6px 12px; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; font-size:12px; font-weight:700; border-radius:8px; text-decoration:none;">Sair</a>
            </div>
        </div>
    </header>

    <!-- Sub-header -->
    <div class="tv-header">
        <div class="tv-title-area">
            <h2>📺 Grade de Canais Ao Vivo</h2>
            <p>Selecione um canal para assistir com alta resolução e estabilidade.</p>
        </div>
        <div class="search-box">
            <span>🔍</span>
            <input type="text" id="tvSearch" placeholder="Buscar canal por nome ou categoria..." onkeyup="filterChannels()">
        </div>
    </div>

    <!-- Category Pills -->
    <div class="categories-bar" id="categoryBar">
        <button class="cat-pill active" onclick="selectCategory('Todos')">🌐 Todos</button>
        <button class="cat-pill" onclick="selectCategory('Esportes')">⚽ Esportes & PPV</button>
        <button class="cat-pill" onclick="selectCategory('Abertos')">📡 Canais Abertos</button>
        <button class="cat-pill" onclick="selectCategory('Filmes')">🎬 Filmes & Séries</button>
        <button class="cat-pill" onclick="selectCategory('Notícias')">📰 Notícias</button>
        <button class="cat-pill" onclick="selectCategory('Infantil')">👶 Infantil</button>
        <button class="cat-pill" onclick="selectCategory('Documentários')">🦁 Documentários</button>
        <button class="cat-pill" onclick="selectCategory('Variedades')">⭐ Variedades</button>
    </div>

    <!-- Channels Grid -->
    <main class="channels-container">
        <div class="channels-grid" id="channelsGrid">
            <!-- Injetado dinamicamente via JS -->
        </div>
    </main>

    <!-- Player Modal -->
    <div class="player-modal" id="tvPlayerModal">
        <div class="player-topbar">
            <div class="player-channel-info">
                <img id="playerChannelLogo" src="" alt="Canal">
                <div>
                    <h3 id="playerChannelName">Nome do Canal</h3>
                    <span id="playerChannelMeta" style="font-size:12px; color:var(--text-muted);">Transmissão Ao Vivo</span>
                </div>
            </div>
            <div class="player-actions">
                <button class="btn-action" onclick="toggleFullscreen()">
                    <span>⛶</span> Tela Cheia
                </button>
                <button class="btn-action" style="background:#ef4444; border-color:#dc2626;" onclick="closeTvPlayer()">
                    <span>✕</span> Fechar
                </button>
            </div>
        </div>
        <div class="player-viewport">
            <video id="tvVideo" controls autoplay playsinline></video>
        </div>
    </div>

    <script>
        let allChannels = [];
        let activeCategory = 'Todos';
        let hls = null;
        let sessionToken = '${currentUser.token || ''}';
        let screenId = '${currentUser.screenId || ''}';

        // Heartbeat de tela única
        async function sendHeartbeat() {
            if (!sessionToken) return;
            try {
                const res = await fetch('/api/user/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, screenId: screenId })
                });
                const data = await res.json();
                const label = document.getElementById('screenStatusLabel');
                const pill = document.getElementById('screenStatusPill');
                if (data.allowed === false) {
                    label.innerText = 'Limite de tela excedido!';
                    label.style.color = '#ef4444';
                    pill.style.borderColor = 'rgba(239,68,68,0.4)';
                    pill.style.background = 'rgba(239,68,68,0.1)';
                    closeTvPlayer();
                    alert(data.error || 'Acesso bloqueado por limite de tela simultânea.');
                } else {
                    label.innerText = '1/1 Tela Conectada';
                    label.style.color = '#10b981';
                    pill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                    pill.style.background = 'rgba(16, 185, 129, 0.1)';
                }
            } catch(e) {}
        }
        setInterval(sendHeartbeat, 25000);

        async function init() {
            sendHeartbeat();
            try {
                const res = await fetch('/api/channels');
                allChannels = await res.json();
                renderGrid(allChannels);
            } catch (e) {
                console.error('Erro ao carregar canais:', e);
            }
        }

        function renderGrid(channels) {
            const grid = document.getElementById('channelsGrid');
            if (!channels || channels.length === 0) {
                grid.innerHTML = '<p style="color:var(--text-muted); padding:40px; grid-column:1/-1; text-align:center;">Nenhum canal encontrado.</p>';
                return;
            }

            grid.innerHTML = channels.map(c => \`
                <div class="channel-card" onclick="playChannel('\${c.id}', '\${c.name.replace(/'/g, "\\\\'")}', '\${c.logo}')">
                    <div class="channel-logo-wrapper">
                        <img src="\${c.logo}" alt="\${c.name}" onerror="this.src='https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png'">
                    </div>
                    <h4>\${c.name}</h4>
                    <div class="channel-card-footer">
                        <span class="badge-res">\${c.highestResolution || 'HD'}</span>
                        <span class="badge-group">\${c.group || 'Geral'}</span>
                    </div>
                </div>
            \`).join('');
        }

        function selectCategory(cat) {
            activeCategory = cat;
            document.querySelectorAll('.cat-pill').forEach(btn => {
                btn.classList.toggle('active', btn.innerText.includes(cat));
            });
            filterChannels();
        }

        function filterChannels() {
            const query = (document.getElementById('tvSearch').value || '').toLowerCase().trim();
            const filtered = allChannels.filter(c => {
                const matchesQuery = !query || c.name.toLowerCase().includes(query) || (c.group && c.group.toLowerCase().includes(query));
                if (!matchesQuery) return false;

                if (activeCategory === 'Todos') return true;
                const grp = (c.group || '').toLowerCase();
                const name = (c.name || '').toLowerCase();

                if (activeCategory === 'Esportes') return grp.includes('esporte') || grp.includes('premiere') || name.includes('espn') || name.includes('sportv');
                if (activeCategory === 'Abertos') return grp.includes('aberto') || name.includes('globo') || name.includes('sbt') || name.includes('record') || name.includes('band');
                if (activeCategory === 'Filmes') return grp.includes('filme') || grp.includes('serie') || grp.includes('telecine') || grp.includes('hbo');
                if (activeCategory === 'Notícias') return grp.includes('noticia') || name.includes('news') || name.includes('cnn') || name.includes('jovem pan');
                if (activeCategory === 'Infantil') return grp.includes('infantil') || grp.includes('kids') || name.includes('cartoon') || name.includes('disney');
                if (activeCategory === 'Documentários') return grp.includes('document') || name.includes('discovery') || name.includes('national');
                if (activeCategory === 'Variedades') return grp.includes('variedade') || grp.includes('entretenimento');

                return true;
            });
            renderGrid(filtered);
        }

        function playChannel(id, name, logo) {
            document.getElementById('playerChannelName').innerText = name;
            document.getElementById('playerChannelLogo').src = logo;
            document.getElementById('tvPlayerModal').classList.add('active');

            const video = document.getElementById('tvVideo');
            const streamUrl = '/stream/' + id + '.m3u8';

            if (hls) {
                hls.destroy();
                hls = null;
            }

            if (Hls.isSupported()) {
                hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 30, liveSyncDurationCount: 3 });
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = streamUrl;
                video.play().catch(() => {});
            }
        }

        function closeTvPlayer() {
            const video = document.getElementById('tvVideo');
            video.pause();
            if (hls) {
                hls.destroy();
                hls = null;
            }
            document.getElementById('tvPlayerModal').classList.remove('active');
        }

        function toggleFullscreen() {
            const modal = document.getElementById('tvPlayerModal');
            if (!document.fullscreenElement) modal.requestFullscreen().catch(() => {});
            else document.exitFullscreen().catch(() => {});
        }

        init();
    </script>
</body>
</html>`;
}

module.exports = {
    renderDedicatedTVPage
};
