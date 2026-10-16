/**
 * Juggo TV Studio - Reprodutor Web Estilo Netflix & Central de Eventos Especiais
 * Design System: Netflix Dark Cinema & Spotify Immersive Glassmorphism
 * - Hero Billboard com Destaque do Jogo Principal
 * - Trilhos Horizontais de Conteúdo (Jogos do Dia, Canais Ao Vivo, VOD, Próximos Jogos)
 * - Match Center com Estatísticas ao vivo: Posse de Bola, Escanteios, Gráfico de Pressão de Ataque, Classificação
 * - Opção de Tela Cheia / Modo Teatro / Modo Split com Estatísticas
 * - Escudos Oficiais dos Clubes e Formato Padronizado de Transmissão
 * - Controle de 1 Tela por Usuário integrado com Heartbeat
 */

function renderNetflixWebTVApp(host, appName = 'Juggo TV Studio') {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${appName} - Cinema, TV & Match Center</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <style>
        :root {
            --bg-cinema: #06080e;
            --bg-card: rgba(18, 24, 38, 0.55);
            --bg-glass: rgba(10, 14, 26, 0.75);
            --border-glass: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(255, 255, 255, 0.22);
            --primary: #e50914; /* Netflix Red */
            --primary-glow: rgba(229, 9, 20, 0.4);
            --accent: #10b981;  /* Stadium Green */
            --accent-glow: rgba(16, 185, 129, 0.35);
            --blue: #3b82f6;
            --gold: #f59e0b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
        }

        * { margin:0; padding:0; box-sizing:border-box; font-family:'Outfit', 'Inter', sans-serif; user-select:none; }
        html, body {
            width: 100vw;
            min-height: 100vh;
            background: var(--bg-cinema);
            color: var(--text-main);
            overflow-x: hidden;
            scroll-behavior: smooth;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.18); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.35); }

        /* Top Navigation Bar */
        .netflix-navbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 68px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 40px;
            background: linear-gradient(180deg, rgba(6, 8, 14, 0.95) 0%, rgba(6, 8, 14, 0.7) 70%, transparent 100%);
            backdrop-filter: blur(20px);
            z-index: 100;
            transition: background 0.3s ease;
        }
        .nav-left {
            display: flex;
            align-items: center;
            gap: 36px;
        }
        .nav-brand {
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
            background: var(--primary);
            color: #fff;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.6px;
            text-transform: uppercase;
        }
        .nav-links {
            display: flex;
            align-items: center;
            gap: 22px;
        }
        .nav-item {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            transition: color 0.2s;
            cursor: pointer;
        }
        .nav-item:hover, .nav-item.active {
            color: #fff;
        }

        .nav-right {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .search-pill {
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 7px 16px;
            gap: 8px;
            transition: all 0.2s;
        }
        .search-pill:focus-within {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.3);
            box-shadow: 0 0 14px rgba(255, 255, 255, 0.1);
        }
        .search-pill input {
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-size: 13.5px;
            width: 180px;
            transition: width 0.2s;
        }
        .search-pill input:focus {
            width: 240px;
        }
        .user-status-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
        }
        .pulse-live {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--accent);
            box-shadow: 0 0 8px var(--accent);
            animation: pulse-dot-anim 1.8s infinite;
        }
        @keyframes pulse-dot-anim {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(0.8); opacity: 0.4; }
        }

        /* Hero Billboard (Destaque do Jogo Principal) */
        .hero-billboard {
            position: relative;
            width: 100%;
            height: 68vh;
            min-height: 480px;
            display: flex;
            align-items: center;
            padding: 0 60px;
            background: radial-gradient(circle at 75% 30%, rgba(37, 99, 235, 0.25) 0%, transparent 60%),
                        radial-gradient(circle at 20% 80%, rgba(229, 9, 20, 0.2) 0%, transparent 50%),
                        linear-gradient(180deg, rgba(6, 8, 14, 0.2) 0%, var(--bg-cinema) 98%);
            margin-top: 60px;
            border-bottom: 1px solid var(--border-glass);
            overflow: hidden;
        }
        .billboard-content {
            max-width: 680px;
            z-index: 10;
        }
        .billboard-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(229, 9, 20, 0.2);
            border: 1px solid rgba(229, 9, 20, 0.4);
            color: #ff4d4f;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            margin-bottom: 16px;
        }
        .billboard-match-vs {
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 18px;
        }
        .team-box {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .team-box img {
            width: 54px;
            height: 54px;
            object-fit: contain;
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.6));
        }
        .team-name {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #fff;
        }
        .vs-pill {
            font-size: 16px;
            font-weight: 900;
            color: var(--text-dim);
            background: rgba(255, 255, 255, 0.06);
            padding: 4px 12px;
            border-radius: 12px;
        }
        .billboard-meta {
            font-size: 16px;
            color: var(--text-muted);
            margin-bottom: 24px;
            line-height: 1.5;
        }
        .billboard-meta strong {
            color: #fff;
        }
        .billboard-buttons {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .btn-billboard-play {
            background: #fff;
            color: #000;
            border: none;
            padding: 14px 28px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 800;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 20px rgba(255, 255, 255, 0.25);
        }
        .btn-billboard-play:hover {
            transform: scale(1.05);
            background: #f1f5f9;
        }
        .btn-billboard-stats {
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 14px 24px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(12px);
            transition: all 0.2s;
        }
        .btn-billboard-stats:hover {
            background: rgba(255, 255, 255, 0.22);
            transform: translateY(-2px);
        }

        /* Tray Sections (Netflix Carousels) */
        .content-container {
            padding: 24px 60px 80px 60px;
            position: relative;
            z-index: 20;
        }
        .section-tray {
            margin-bottom: 48px;
        }
        .tray-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 18px;
        }
        .tray-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.3px;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .tray-scroll-wrapper {
            position: relative;
        }
        .tray-row {
            display: flex;
            gap: 18px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            padding: 8px 4px 18px 4px;
        }

        /* Match Card Especial */
        .match-card {
            flex: 0 0 340px;
            scroll-snap-align: start;
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 18px;
            padding: 20px;
            backdrop-filter: blur(16px);
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .match-card:hover {
            transform: translateY(-6px) scale(1.02);
            border-color: var(--border-hover);
            box-shadow: 0 14px 35px rgba(0,0,0,0.5), 0 0 20px var(--primary-glow);
        }
        .match-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
            font-size: 11.5px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
        }
        .match-card-teams {
            display: flex;
            align-items: center;
            justify-content: space-around;
            margin-bottom: 16px;
        }
        .team-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            text-align: center;
            max-width: 120px;
        }
        .team-col img {
            width: 48px;
            height: 48px;
            object-fit: contain;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
        }
        .team-col span {
            font-size: 13px;
            font-weight: 700;
            color: #fff;
            line-height: 1.2;
        }
        .match-score-pill {
            font-size: 18px;
            font-weight: 900;
            color: #fff;
            background: rgba(255, 255, 255, 0.08);
            padding: 6px 14px;
            border-radius: 10px;
        }
        .match-card-footer {
            border-top: 1px solid var(--border-glass);
            padding-top: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .broadcaster-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 700;
            color: #60a5fa;
        }
        .btn-card-stats {
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: #fff;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s;
        }
        .btn-card-stats:hover {
            background: var(--primary);
        }

        /* Channel Card (TV Ao Vivo) */
        .channel-card {
            flex: 0 0 210px;
            scroll-snap-align: start;
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 16px;
            backdrop-filter: blur(14px);
            cursor: pointer;
            transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            text-align: center;
            position: relative;
        }
        .channel-card:hover {
            transform: translateY(-5px);
            border-color: rgba(59, 130, 246, 0.5);
            box-shadow: 0 10px 25px rgba(0,0,0,0.4), 0 0 18px rgba(59, 130, 246, 0.25);
        }
        .channel-logo-container {
            width: 100%;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
        }
        .channel-logo-container img {
            max-width: 80%;
            max-height: 70px;
            object-fit: contain;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
        }
        .channel-card h4 {
            font-size: 13.5px;
            font-weight: 700;
            color: #fff;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .channel-badges {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
        .badge-res {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-muted);
            font-size: 10px;
            font-weight: 800;
            padding: 2px 6px;
            border-radius: 4px;
        }

        /* Floating Video Player Modal / Studio Mode */
        .player-modal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.94);
            backdrop-filter: blur(24px);
            z-index: 500;
            display: none;
            flex-direction: column;
        }
        .player-modal.active {
            display: flex;
        }
        .player-topbar {
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 32px;
            background: rgba(10, 14, 26, 0.8);
            border-bottom: 1px solid var(--border-glass);
        }
        .player-info {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .player-info img {
            height: 32px;
            max-width: 80px;
            object-fit: contain;
        }
        .player-info h3 {
            font-size: 16px;
            font-weight: 800;
            color: #fff;
        }
        .player-actions {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .btn-player-action {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-glass);
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
        .btn-player-action:hover {
            background: rgba(255, 255, 255, 0.18);
        }
        .player-body {
            flex: 1;
            display: flex;
            overflow: hidden;
            position: relative;
        }
        .video-wrapper {
            flex: 1;
            background: #000;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #webVideo {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        /* Match Center Side Drawer (Estatísticas ao Vivo & Gráfico de Pressão) */
        .match-center-drawer {
            width: 380px;
            background: #0b0f19;
            border-left: 1px solid var(--border-glass);
            display: none;
            flex-direction: column;
            overflow-y: auto;
            padding: 24px;
            animation: slideInRight 0.25s ease-out;
        }
        .match-center-drawer.open {
            display: flex;
        }
        @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
        .drawer-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-glass);
        }
        .drawer-header h3 {
            font-size: 16px;
            font-weight: 800;
            color: #fff;
        }

        /* Pressure / Momentum Graph */
        .momentum-box {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border-glass);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 20px;
        }
        .momentum-title {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: var(--text-muted);
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
        }
        .pressure-bar-container {
            height: 14px;
            border-radius: 8px;
            background: #334155;
            overflow: hidden;
            display: flex;
            margin-bottom: 8px;
        }
        .pressure-home {
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            height: 100%;
            transition: width 0.5s ease;
        }
        .pressure-away {
            background: linear-gradient(90deg, #f87171, #ef4444);
            height: 100%;
            transition: width 0.5s ease;
        }
        .pressure-labels {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            font-weight: 700;
            color: #fff;
        }

        /* Stats Comparison Grid */
        .stats-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        }
        .stat-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
        }
        .stat-val {
            font-size: 14px;
            font-weight: 800;
            color: #fff;
            width: 40px;
        }
        .stat-val.right { text-align: right; }
        .stat-label {
            color: var(--text-muted);
            text-align: center;
            flex: 1;
            font-size: 12px;
        }

        /* Standings Mini Table */
        .standings-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .standings-table th {
            text-align: left;
            padding: 6px 4px;
            color: var(--text-dim);
            font-size: 11px;
            text-transform: uppercase;
        }
        .standings-table td {
            padding: 8px 4px;
            border-top: 1px solid rgba(255, 255, 255, 0.04);
            color: #fff;
        }
    </style>
</head>
<body>

    <!-- Topbar -->
    <header class="netflix-navbar">
        <div class="nav-left">
            <a href="/" class="nav-brand">
                📺 ${appName} <span class="brand-badge">STUDIO</span>
            </a>
            <nav class="nav-links">
                <a href="#hero" class="nav-item active">Início</a>
                <a href="#jogos-dia" class="nav-item">⚽ Jogos do Dia</a>
                <a href="#canais-aovivo" class="nav-item">📺 TV Ao Vivo</a>
                <a href="#jogos-semana" class="nav-item">📅 Próximos Jogos</a>
                <a href="/users" class="nav-item" style="color:#60a5fa;">👥 Painel Usuários</a>
            </nav>
        </div>

        <div class="nav-right">
            <div class="search-pill">
                <span>🔍</span>
                <input type="text" id="mainSearch" placeholder="Buscar canal ou jogo..." onkeyup="onSearch(event)">
            </div>
            <div class="user-status-pill">
                <span class="pulse-live"></span>
                <span id="screenStatusLabel">1/1 Tela Conectada</span>
            </div>
        </div>
    </header>

    <!-- Hero Billboard (Destaque Principal) -->
    <section class="hero-billboard" id="hero">
        <div class="billboard-content">
            <div class="billboard-badge">
                <span class="pulse-live"></span> SUPER TRANSMISSÃO DE HOJE
            </div>

            <div class="billboard-match-vs" id="heroMatchVs">
                <div class="team-box">
                    <img id="heroHomeLogo" src="https://a.espncdn.com/i/teamlogos/default-team-logo.png" alt="Casa">
                    <span class="team-name" id="heroHomeName">Flamengo</span>
                </div>
                <span class="vs-pill">VS</span>
                <div class="team-box">
                    <img id="heroAwayLogo" src="https://a.espncdn.com/i/teamlogos/default-team-logo.png" alt="Fora">
                    <span class="team-name" id="heroAwayName">Fluminense</span>
                </div>
            </div>

            <p class="billboard-meta" id="heroMeta">
                🏆 <strong id="heroLeague">Brasileirão Série A</strong> &nbsp;|&nbsp;
                🕒 <span id="heroTime">Hoje às 21:30</span> &nbsp;|&nbsp;
                📺 Ao vivo em <strong id="heroChannel">Premiere Clubes</strong>
            </p>

            <div class="billboard-buttons">
                <button class="btn-billboard-play" onclick="playHeroMatch()">
                    <span>▶</span> Assistir Agora
                </button>
                <button class="btn-billboard-stats" onclick="openHeroStats()">
                    <span>📊</span> Match Center & Estatísticas
                </button>
            </div>
        </div>
    </section>

    <!-- Main Trays -->
    <main class="content-container">

        <!-- 1. Jogos do Dia Especial -->
        <section class="section-tray" id="jogos-dia">
            <div class="tray-header">
                <h3 class="tray-title">
                    <span>⚽</span> Jogos do Dia (Transmissões Especiais)
                </h3>
            </div>
            <div class="tray-scroll-wrapper">
                <div class="tray-row" id="todayMatchesRow">
                    <!-- Cards de jogos injetados via JS -->
                </div>
            </div>
        </section>

        <!-- 2. Canais de TV Ao Vivo -->
        <section class="section-tray" id="canais-aovivo">
            <div class="tray-header">
                <h3 class="tray-title">
                    <span>📺</span> Canais de TV Ao Vivo
                </h3>
            </div>
            <div class="tray-scroll-wrapper">
                <div class="tray-row" id="channelsRow">
                    <!-- Canais injetados via JS -->
                </div>
            </div>
        </section>

        <!-- 3. Agenda da Semana -->
        <section class="section-tray" id="jogos-semana">
            <div class="tray-header">
                <h3 class="tray-title">
                    <span>📅</span> Agenda Esportiva da Semana
                </h3>
            </div>
            <div class="tray-scroll-wrapper">
                <div class="tray-row" id="weekMatchesRow">
                    <!-- Próximos jogos injetados via JS -->
                </div>
            </div>
        </section>
    </main>

    <!-- Player Studio Modal (Com Match Center & Estatísticas) -->
    <div class="player-modal" id="playerModal">
        <div class="player-topbar">
            <div class="player-info">
                <img id="playerChannelLogo" src="" alt="Canal">
                <div>
                    <h3 id="playerTitle">Canal de TV</h3>
                    <span id="playerSubtitle" style="font-size:12px; color:var(--text-muted);">Ao Vivo</span>
                </div>
            </div>

            <div class="player-actions">
                <button class="btn-player-action" id="toggleStatsBtn" onclick="toggleMatchCenter()">
                    <span>📊</span> Match Center (Estatísticas)
                </button>
                <button class="btn-player-action" onclick="toggleFullscreen()">
                    <span>⛶</span> Tela Cheia
                </button>
                <button class="btn-player-action" style="background:#ef4444; border-color:#dc2626;" onclick="closePlayer()">
                    <span>✕</span> Sair do Player
                </button>
            </div>
        </div>

        <div class="player-body">
            <!-- Video Container -->
            <div class="video-wrapper">
                <video id="webVideo" controls autoplay playsinline></video>
            </div>

            <!-- Match Center Side Drawer -->
            <aside class="match-center-drawer" id="matchCenterDrawer">
                <div class="drawer-header">
                    <h3>⚡ Match Center Ao Vivo</h3>
                    <button style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;" onclick="toggleMatchCenter()">✕</button>
                </div>

                <!-- Gráfico de Pressão / Momentum -->
                <div class="momentum-box">
                    <div class="momentum-title">
                        <span>💥 Pressão de Ataque</span>
                        <span id="matchClock">Ao Vivo</span>
                    </div>
                    <div class="pressure-bar-container">
                        <div class="pressure-home" id="barHome" style="width: 58%;"></div>
                        <div class="pressure-away" id="barAway" style="width: 42%;"></div>
                    </div>
                    <div class="pressure-labels">
                        <span id="lblHomePress">58% Casa</span>
                        <span id="lblAwayPress">42% Fora</span>
                    </div>
                </div>

                <!-- Estatísticas de Jogo -->
                <div class="stats-grid">
                    <div class="stat-row">
                        <span class="stat-val" id="statHomePoss">55%</span>
                        <span class="stat-label">Posse de Bola</span>
                        <span class="stat-val right" id="statAwayPoss">45%</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-val" id="statHomeCorners">6</span>
                        <span class="stat-label">⛳ Escanteios</span>
                        <span class="stat-val right" id="statAwayCorners">3</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-val" id="statHomeShots">12</span>
                        <span class="stat-label">🎯 Finalizações</span>
                        <span class="stat-val right" id="statAwayShots">8</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-val" id="statHomeFouls">10</span>
                        <span class="stat-label">⚠️ Faltas Cometidas</span>
                        <span class="stat-val right" id="statAwayFouls">14</span>
                    </div>
                </div>

                <!-- Classificação em Tempo Real -->
                <h4 style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
                    🏆 Classificação do Torneio
                </h4>
                <table class="standings-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Time</th>
                            <th>J</th>
                            <th>SG</th>
                            <th>Pts</th>
                        </tr>
                    </thead>
                    <tbody id="standingsBody">
                        <!-- Injetado via JS -->
                    </tbody>
                </table>
            </aside>
        </div>
    </div>

    <script>
        let hls = null;
        let todayMatches = [];
        let allChannels = [];
        let activeMatch = null;
        let sessionToken = localStorage.getItem('juggo_session_token') || 'demo_token';
        let screenId = localStorage.getItem('juggo_screen_id') || ('scr_' + Math.random().toString(36).slice(2, 9));
        localStorage.setItem('juggo_screen_id', screenId);

        // Heartbeat para garantir o limite de 1 tela simultânea
        async function sendScreenHeartbeat() {
            try {
                const res = await fetch('/api/user/heartbeat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, screenId: screenId })
                });
                const data = await res.json();
                if (data.allowed === false) {
                    // Limite excedido ou bloqueado
                    document.getElementById('screenStatusLabel').innerText = 'Limite de 1 tela excedido!';
                    document.getElementById('screenStatusLabel').style.color = '#ef4444';
                    closePlayer();
                    alert(data.error || 'Acesso bloqueado por limite de tela simultânea.');
                }
            } catch(e) {}
        }
        setInterval(sendScreenHeartbeat, 25000);

        async function init() {
            await Promise.all([loadChannels(), loadMatches()]);
            setupHero();
            sendScreenHeartbeat();
        }

        async function loadChannels() {
            try {
                const res = await fetch('/api/channels');
                allChannels = await res.json();
                renderChannels(allChannels);
            } catch (e) {
                console.error('Erro ao carregar canais:', e);
            }
        }

        async function loadMatches() {
            try {
                const res = await fetch('/api/futebol/today-matches');
                const list = await res.json();
                todayMatches = list || [];
                renderMatches(todayMatches);
            } catch (e) {
                console.error('Erro ao carregar jogos:', e);
            }
        }

        function setupHero() {
            if (todayMatches.length > 0) {
                const topMatch = todayMatches[0];
                document.getElementById('heroHomeName').innerText = topMatch.homeTeam;
                document.getElementById('heroAwayName').innerText = topMatch.awayTeam;
                document.getElementById('heroHomeLogo').src = topMatch.homeLogo;
                document.getElementById('heroAwayLogo').src = topMatch.awayLogo;
                document.getElementById('heroLeague').innerText = topMatch.league || 'Destaque Ao Vivo';
                document.getElementById('heroTime').innerText = topMatch.fullDateStr + ' às ' + topMatch.timeStr;
                document.getElementById('heroChannel').innerText = topMatch.channelName || 'Transmissão Oficial';
                activeMatch = topMatch;
            }
        }

        function renderMatches(list) {
            const todayRow = document.getElementById('todayMatchesRow');
            const weekRow = document.getElementById('weekMatchesRow');
            todayRow.innerHTML = '';
            weekRow.innerHTML = '';

            const todayItems = list.filter(m => m.isToday);
            const weekItems = list.filter(m => !m.isToday);

            const buildCard = (m) => {
                return \`
                <div class="match-card" onclick="openMatchStream('\${m.id}')">
                    <div class="match-card-top">
                        <span>\${m.league || 'Futebol'}</span>
                        <span style="color:#60a5fa;">\${m.timeStr}</span>
                    </div>
                    <div class="match-card-teams">
                        <div class="team-col">
                            <img src="\${m.homeLogo}" alt="\${m.homeTeam}" onerror="this.src='https://a.espncdn.com/i/teamlogos/default-team-logo.png'">
                            <span>\${m.homeTeam}</span>
                        </div>
                        <div class="match-score-pill">
                            \${m.homeScore !== null ? m.homeScore + ' x ' + m.awayScore : 'VS'}
                        </div>
                        <div class="team-col">
                            <img src="\${m.awayLogo}" alt="\${m.awayTeam}" onerror="this.src='https://a.espncdn.com/i/teamlogos/default-team-logo.png'">
                            <span>\${m.awayTeam}</span>
                        </div>
                    </div>
                    <div class="match-card-footer">
                        <span class="broadcaster-tag">
                            🔴 \${m.channelName || 'Ao vivo'}
                        </span>
                        <button class="btn-card-stats" onclick="event.stopPropagation(); openMatchCenter('\${m.leagueCode || 'bra.1'}', '\${m.id}')">
                            📊 Estatísticas
                        </button>
                    </div>
                </div>
                \`;
            };

            todayRow.innerHTML = todayItems.map(buildCard).join('') || '<p style="color:var(--text-muted); padding:20px;">Nenhum jogo programado para hoje.</p>';
            weekRow.innerHTML = weekItems.map(buildCard).join('') || '<p style="color:var(--text-muted); padding:20px;">Nenhum jogo na agenda da semana.</p>';
        }

        function renderChannels(channels) {
            const row = document.getElementById('channelsRow');
            row.innerHTML = channels.map(c => \`
                <div class="channel-card" onclick="playChannelStream('\${c.id}', '\${c.name}', '\${c.logo}')">
                    <div class="channel-logo-container">
                        <img src="\${c.logo}" alt="\${c.name}" onerror="this.src='https://raw.githubusercontent.com/iptv-org/iptv/master/assets/images/logo.png'">
                    </div>
                    <h4>\${c.name}</h4>
                    <div class="channel-badges">
                        <span class="badge-res">\${c.highestResolution || 'HD'}</span>
                        <span style="font-size:11px; color:var(--text-dim);">\${c.group}</span>
                    </div>
                </div>
            \`).join('');
        }

        function openMatchStream(matchId) {
            const match = todayMatches.find(m => m.id === matchId);
            if (!match) return;
            activeMatch = match;

            document.getElementById('playerTitle').innerText = match.homeTeam + ' x ' + match.awayTeam;
            document.getElementById('playerSubtitle').innerText = 'Ao vivo em ' + match.channelName + ' (' + match.league + ')';
            document.getElementById('playerChannelLogo').src = match.logo;

            document.getElementById('playerModal').classList.add('active');
            playHlsUrl(match.streamUrl);

            // Carregar estatísticas do jogo
            loadLiveMatchStats(match.leagueCode || 'bra.1', match.id);
        }

        function playChannelStream(id, name, logo) {
            document.getElementById('playerTitle').innerText = name;
            document.getElementById('playerSubtitle').innerText = 'Transmissão Ao Vivo';
            document.getElementById('playerChannelLogo').src = logo;
            document.getElementById('playerModal').classList.add('active');
            document.getElementById('matchCenterDrawer').classList.remove('open');

            playHlsUrl('/stream/' + id + '.m3u8');
        }

        function playHeroMatch() {
            if (activeMatch) {
                openMatchStream(activeMatch.id);
            }
        }

        function openHeroStats() {
            if (activeMatch) {
                openMatchCenter(activeMatch.leagueCode || 'bra.1', activeMatch.id);
            }
        }

        function playHlsUrl(streamUrl) {
            const video = document.getElementById('webVideo');
            if (hls) {
                hls.destroy();
                hls = null;
            }

            if (Hls.isSupported()) {
                hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    maxBufferLength: 30,
                    liveSyncDurationCount: 3
                });
                hls.loadSource(streamUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(() => {});
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                hls.recoverMediaError();
                                break;
                            default:
                                hls.destroy();
                                break;
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = streamUrl;
                video.play().catch(() => {});
            }
        }

        async function loadLiveMatchStats(leagueCode, eventId) {
            try {
                const res = await fetch('/api/futebol/match/' + eventId + '/stats?league=' + encodeURIComponent(leagueCode));
                const data = await res.json();
                if (!data) return;

                // Atualizar gráfico de pressão
                const homePress = data.currentPressure?.home || data.possession?.home || 50;
                const awayPress = 100 - homePress;
                document.getElementById('barHome').style.width = homePress + '%';
                document.getElementById('barAway').style.width = awayPress + '%';
                document.getElementById('lblHomePress').innerText = homePress + '% ' + (data.homeTeam || 'Casa');
                document.getElementById('lblAwayPress').innerText = awayPress + '% ' + (data.awayTeam || 'Fora');
                document.getElementById('matchClock').innerText = data.clock || 'Ao Vivo';

                // Estatísticas
                document.getElementById('statHomePoss').innerText = (data.possession?.home || 50) + '%';
                document.getElementById('statAwayPoss').innerText = (data.possession?.away || 50) + '%';
                document.getElementById('statHomeCorners').innerText = data.corners?.home || 0;
                document.getElementById('statAwayCorners').innerText = data.corners?.away || 0;
                document.getElementById('statHomeShots').innerText = data.shots?.home || 0;
                document.getElementById('statAwayShots').innerText = data.shots?.away || 0;
                document.getElementById('statHomeFouls').innerText = data.fouls?.home || 0;
                document.getElementById('statAwayFouls').innerText = data.fouls?.away || 0;

                // Classificação
                const tbody = document.getElementById('standingsBody');
                if (data.standings && data.standings.length > 0) {
                    tbody.innerHTML = data.standings.map(s => \`
                        <tr>
                            <td><strong>\${s.position}º</strong></td>
                            <td>\${s.shortName || s.teamName}</td>
                            <td>\${s.played}</td>
                            <td>\${s.gd}</td>
                            <td><strong style="color:#60a5fa;">\${s.points}</strong></td>
                        </tr>
                    \`).join('');
                }
            } catch(e) {}
        }

        function openMatchCenter(leagueCode, eventId) {
            document.getElementById('playerModal').classList.add('active');
            document.getElementById('matchCenterDrawer').classList.add('open');
            loadLiveMatchStats(leagueCode, eventId);
        }

        function toggleMatchCenter() {
            const drawer = document.getElementById('matchCenterDrawer');
            drawer.classList.toggle('open');
        }

        function toggleFullscreen() {
            const modal = document.getElementById('playerModal');
            if (!document.fullscreenElement) {
                modal.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }

        function closePlayer() {
            const video = document.getElementById('webVideo');
            video.pause();
            if (hls) {
                hls.destroy();
                hls = null;
            }
            document.getElementById('playerModal').classList.remove('active');
        }

        function onSearch(e) {
            const q = e.target.value.toLowerCase();
            const filteredChannels = allChannels.filter(c => c.name.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
            renderChannels(filteredChannels);
        }

        init();
    </script>
</body>
</html>`;
}

module.exports = {
    renderNetflixWebTVApp
};
