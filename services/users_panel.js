/**
 * Juggo TV Studio - Painel de Gestão de Usuários (/users)
 * Design System: Linear / Netflix Dark Mode Glassmorphism
 * - CRUD Completo de Usuários
 * - Gestão de Expiração e Atalhos de Renovação
 * - Monitoramento de Tela Ativa em Tempo Real (Limite de 1 Tela)
 */

const userManager = require('./user_manager');

function renderUsersPanel(currentUser) {
    const users = userManager.getAllUsers();
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.computedStatus === 'active').length;
    const onlineScreens = users.reduce((acc, u) => acc + (u.activeScreens || 0), 0);
    const expiredUsers = users.filter(u => u.computedStatus === 'expired').length;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Juggo TV Studio - Gestão de Usuários</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #080a10;
            --bg-surface: #0f1320;
            --bg-card: rgba(22, 28, 45, 0.65);
            --border-glass: rgba(255, 255, 255, 0.08);
            --border-focus: #3b82f6;
            --primary: #3b82f6;
            --primary-glow: rgba(59, 130, 246, 0.35);
            --accent: #10b981;
            --accent-glow: rgba(16, 185, 129, 0.3);
            --danger: #ef4444;
            --warning: #f59e0b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-dim: #64748b;
        }

        * { margin:0; padding:0; box-sizing:border-box; font-family:'Outfit', sans-serif; }
        body { background: var(--bg-deep); color: var(--text-main); min-height: 100vh; display: flex; flex-direction: column; overflow-x: hidden; }

        /* Topbar */
        .topbar {
            height: 64px;
            background: rgba(10, 14, 24, 0.85);
            backdrop-filter: blur(20px);
            border-bottom: 1px solid var(--border-glass);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 32px;
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
            text-decoration: none;
            color: #fff;
        }
        .brand-badge {
            background: linear-gradient(135deg, #ef4444, #f97316);
            color: #fff;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .topbar-links {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .nav-link {
            color: var(--text-muted);
            text-decoration: none;
            font-size: 13.5px;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        .nav-link:hover, .nav-link.active {
            color: #fff;
            background: rgba(255, 255, 255, 0.08);
        }

        /* Container */
        .container {
            max-width: 1360px;
            width: 100%;
            margin: 0 auto;
            padding: 32px 24px;
            flex: 1;
        }

        /* Hero Metrics */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 18px;
            margin-bottom: 32px;
        }
        .metric-card {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 20px 24px;
            backdrop-filter: blur(16px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            transition: transform 0.2s, border-color 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
            border-color: rgba(255, 255, 255, 0.18);
        }
        .metric-info h4 {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--text-muted);
            margin-bottom: 6px;
        }
        .metric-info .val {
            font-size: 32px;
            font-weight: 800;
            color: #fff;
            line-height: 1;
        }
        .metric-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            background: rgba(255, 255, 255, 0.05);
        }

        /* Action Bar */
        .action-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 24px;
        }
        .search-box {
            display: flex;
            align-items: center;
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 12px;
            padding: 10px 16px;
            gap: 10px;
            min-width: 320px;
        }
        .search-box input {
            background: transparent;
            border: none;
            outline: none;
            color: #fff;
            font-size: 14px;
            width: 100%;
        }
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #fff;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 16px var(--primary-glow);
            transition: all 0.2s;
        }
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
        }

        /* Table Card */
        .table-card {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 18px;
            overflow: hidden;
            box-shadow: 0 12px 35px rgba(0,0,0,0.35);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }
        th {
            background: rgba(10, 14, 24, 0.4);
            padding: 16px 20px;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.6px;
            text-transform: uppercase;
            border-bottom: 1px solid var(--border-glass);
        }
        td {
            padding: 16px 20px;
            font-size: 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            vertical-align: middle;
        }
        tr:hover td {
            background: rgba(255, 255, 255, 0.02);
        }

        /* Badges */
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11.5px;
            font-weight: 700;
            letter-spacing: 0.3px;
        }
        .badge-active { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-expired { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .badge-blocked { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
        .badge-online { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }

        .pulse-online {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
            animation: pulse-dot 1.8s infinite;
        }
        @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.85); }
        }

        /* Action Buttons */
        .btn-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-action {
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid var(--border-glass);
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-main);
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-action:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.25);
        }
        .btn-renew { color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
        .btn-renew:hover { background: rgba(16, 185, 129, 0.2); }
        .btn-kick { color: #f59e0b; border-color: rgba(245, 158, 11, 0.3); }
        .btn-kick:hover { background: rgba(245, 158, 11, 0.2); }
        .btn-delete { color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
        .btn-delete:hover { background: rgba(239, 68, 68, 0.2); }

        /* Modal */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(12px);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 100;
            padding: 20px;
        }
        .modal {
            background: #101422;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            width: 100%;
            max-width: 520px;
            padding: 28px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            animation: modalIn 0.25s ease-out;
        }
        @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 22px;
        }
        .modal-header h3 { font-size: 18px; font-weight: 800; color: #fff; }
        .modal-close {
            background: transparent;
            border: none;
            color: var(--text-muted);
            font-size: 20px;
            cursor: pointer;
        }
        .form-group {
            margin-bottom: 16px;
        }
        .form-group label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            color: var(--text-muted);
            margin-bottom: 8px;
        }
        .form-control {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-glass);
            border-radius: 10px;
            padding: 10px 14px;
            color: #fff;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        .form-control:focus {
            border-color: var(--primary);
            box-shadow: 0 0 10px var(--primary-glow);
        }
        .quick-days {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        .btn-quick {
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid var(--border-glass);
            color: #fff;
            cursor: pointer;
        }
        .btn-quick:hover { background: var(--primary); }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 24px;
        }
        .btn-secondary {
            background: transparent;
            border: 1px solid var(--border-glass);
            color: var(--text-muted);
            padding: 10px 18px;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
        }
    </style>
</head>
<body>

    <!-- Topbar -->
    <header class="topbar">
        <a href="/" class="brand">
            📺 JUGGO TV <span class="brand-badge">Studio</span>
        </a>
        <nav class="topbar-links">
            <a href="/" class="nav-link">🎬 Web Player Smart TV</a>
            <a href="/admin" class="nav-link">⚙️ Auditoria M3U</a>
            <a href="/users" class="nav-link active">👥 Gestão de Usuários</a>
            <a href="/admin/logout" class="nav-link" style="color:#ef4444;">🚪 Sair</a>
        </nav>
    </header>

    <div class="container">
        <!-- Hero Metrics -->
        <section class="metrics-grid">
            <div class="metric-card">
                <div class="metric-info">
                    <h4>Total de Clientes</h4>
                    <div class="val">${totalUsers}</div>
                </div>
                <div class="metric-icon">👥</div>
            </div>

            <div class="metric-card">
                <div class="metric-info">
                    <h4>Assinaturas Ativas</h4>
                    <div class="val" style="color:#34d399;">${activeUsers}</div>
                </div>
                <div class="metric-icon" style="color:#34d399;">✅</div>
            </div>

            <div class="metric-card">
                <div class="metric-info">
                    <h4>Telas Online Agora</h4>
                    <div class="val" style="color:#60a5fa;">${onlineScreens}</div>
                </div>
                <div class="metric-icon" style="color:#60a5fa;">📺</div>
            </div>

            <div class="metric-card">
                <div class="metric-info">
                    <h4>Vencidos / Expirados</h4>
                    <div class="val" style="color:#f87171;">${expiredUsers}</div>
                </div>
                <div class="metric-icon" style="color:#f87171;">⚠️</div>
            </div>
        </section>

        <!-- Action Bar -->
        <div class="action-bar">
            <div class="search-box">
                <span>🔍</span>
                <input type="text" id="userSearch" placeholder="Buscar por usuário, nome ou observação..." onkeyup="filterUsers()">
            </div>
            <button class="btn-primary" onclick="openCreateModal()">
                <span>➕</span> Criar Novo Usuário
            </button>
        </div>

        <!-- Table Card -->
        <div class="table-card">
            <table>
                <thead>
                    <tr>
                        <th>Usuário</th>
                        <th>Nome / Obs</th>
                        <th>Status</th>
                        <th>Telas (Limite: 1)</th>
                        <th>Vencimento</th>
                        <th style="text-align: right;">Ações</th>
                    </tr>
                </thead>
                <tbody id="userTableBody">
                    ${users.map(u => {
                        let statusHtml = '';
                        if (u.computedStatus === 'active') {
                            const daysText = u.daysLeft !== null ? `(${u.daysLeft}d restantes)` : '(Permanente)';
                            statusHtml = `<span class="badge badge-active">Ativo ${daysText}</span>`;
                        } else if (u.computedStatus === 'expired') {
                            statusHtml = `<span class="badge badge-expired">Vencido (${Math.abs(u.daysLeft || 0)}d atrás)</span>`;
                        } else {
                            statusHtml = `<span class="badge badge-blocked">Bloqueado</span>`;
                        }

                        const screenHtml = u.isOnline
                            ? `<span class="badge badge-online"><span class="pulse-online"></span> 1/1 Conectado</span>`
                            : `<span style="color:var(--text-dim); font-size:12px;">0/1 Desconectado</span>`;

                        const expFormatted = u.expiresAt ? u.expiresAt.split('-').reverse().join('/') : 'Vitalício';

                        return `
                        <tr id="row_${u.id}">
                            <td>
                                <strong style="color:#fff; font-size:14.5px;">${u.username}</strong>
                                ${u.role === 'admin' ? '<span style="font-size:10px; background:#f59e0b; color:#000; padding:1px 5px; border-radius:4px; font-weight:800; margin-left:6px;">MASTER</span>' : ''}
                            </td>
                            <td style="color:var(--text-muted);">${u.name || '-'}</td>
                            <td>${statusHtml}</td>
                            <td>${screenHtml}</td>
                            <td><strong>${expFormatted}</strong></td>
                            <td style="text-align: right;">
                                <div class="btn-group" style="justify-content: flex-end;">
                                    <button class="btn-action btn-renew" onclick="renewUser('${u.id}', 30)" title="Renovar +30 dias">⚡ +30d</button>
                                    ${u.isOnline ? `<button class="btn-action btn-kick" onclick="kickUser('${u.id}')" title="Derrubar tela ativa">🛑 Desconectar</button>` : ''}
                                    <button class="btn-action" onclick="openEditModal('${u.id}', '${u.username}', '${u.name || ''}', '${u.expiresAt || ''}', '${u.status}')">✏️</button>
                                    ${u.id !== 'usr_admin' ? `<button class="btn-action btn-delete" onclick="deleteUser('${u.id}', '${u.username}')">🗑️</button>` : ''}
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Modal de Criar / Editar Usuário -->
    <div class="modal-overlay" id="userModal">
        <div class="modal">
            <div class="modal-header">
                <h3 id="modalTitle">Cadastrar Novo Usuário</h3>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <form id="userForm" onsubmit="saveUser(event)">
                <input type="hidden" id="editUserId">

                <div class="form-group">
                    <label>Nome do Usuário (Login)</label>
                    <input type="text" id="modalUsername" class="form-control" placeholder="ex: cliente_silva" required>
                </div>

                <div class="form-group">
                    <label>Senha de Acesso</label>
                    <input type="text" id="modalPassword" class="form-control" placeholder="Digite a senha" required>
                </div>

                <div class="form-group">
                    <label>Nome Completo / Contato</label>
                    <input type="text" id="modalName" class="form-control" placeholder="ex: João da Silva (WhatsApp)">
                </div>

                <div class="form-group">
                    <label>Data de Vencimento do Acesso</label>
                    <input type="date" id="modalExpiresAt" class="form-control">
                    <div class="quick-days">
                        <button type="button" class="btn-quick" onclick="setExpirationDays(30)">+30 Dias</button>
                        <button type="button" class="btn-quick" onclick="setExpirationDays(60)">+60 Dias</button>
                        <button type="button" class="btn-quick" onclick="setExpirationDays(90)">+90 Dias</button>
                        <button type="button" class="btn-quick" onclick="setExpirationDays(365)">+1 Ano</button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Status</label>
                    <select id="modalStatus" class="form-control">
                        <option value="active">Ativo</option>
                        <option value="blocked">Bloqueado</option>
                    </select>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn-primary" id="modalSubmitBtn">Salvar Usuário</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        function setExpirationDays(days) {
            const d = new Date();
            d.setDate(d.getDate() + days);
            document.getElementById('modalExpiresAt').value = d.toISOString().split('T')[0];
        }

        function openCreateModal() {
            document.getElementById('modalTitle').innerText = 'Cadastrar Novo Usuário';
            document.getElementById('editUserId').value = '';
            document.getElementById('modalUsername').value = '';
            document.getElementById('modalPassword').value = Math.floor(100000 + Math.random() * 900000); // Gerar senha numérica de 6 dígitos
            document.getElementById('modalName').value = '';
            document.getElementById('modalStatus').value = 'active';
            setExpirationDays(30);
            document.getElementById('userModal').style.display = 'flex';
        }

        function openEditModal(id, username, name, expiresAt, status) {
            document.getElementById('modalTitle').innerText = 'Editar Usuário: ' + username;
            document.getElementById('editUserId').value = id;
            document.getElementById('modalUsername').value = username;
            document.getElementById('modalPassword').value = '';
            document.getElementById('modalPassword').placeholder = 'Deixe em branco para manter a senha atual';
            document.getElementById('modalPassword').required = false;
            document.getElementById('modalName').value = name;
            document.getElementById('modalExpiresAt').value = expiresAt || '';
            document.getElementById('modalStatus').value = status || 'active';
            document.getElementById('userModal').style.display = 'flex';
        }

        function closeModal() {
            document.getElementById('userModal').style.display = 'none';
        }

        async function saveUser(e) {
            e.preventDefault();
            const id = document.getElementById('editUserId').value;
            const payload = {
                username: document.getElementById('modalUsername').value,
                name: document.getElementById('modalName').value,
                expiresAt: document.getElementById('modalExpiresAt').value || null,
                status: document.getElementById('modalStatus').value,
                maxScreens: 1
            };

            const password = document.getElementById('modalPassword').value;
            if (password) payload.password = password;

            const url = id ? '/api/users/' + id : '/api/users';
            const method = id ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.error) {
                    alert('Erro: ' + data.error);
                } else {
                    location.reload();
                }
            } catch (err) {
                alert('Erro ao salvar usuário: ' + err.message);
            }
        }

        async function renewUser(id, days) {
            if (!confirm('Deseja renovar este usuário por mais ' + days + ' dias?')) return;
            try {
                const res = await fetch('/api/users/' + id + '/renew', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ days })
                });
                const data = await res.json();
                if (data.error) alert(data.error);
                else location.reload();
            } catch (err) {
                alert('Erro ao renovar: ' + err.message);
            }
        }

        async function kickUser(id) {
            if (!confirm('Deseja desconectar a tela ativa deste usuário agora?')) return;
            try {
                const res = await fetch('/api/users/' + id + '/kick', { method: 'POST' });
                const data = await res.json();
                alert(data.message || 'Sessão desconectada com sucesso.');
                location.reload();
            } catch (err) {
                alert('Erro ao derrubar sessão: ' + err.message);
            }
        }

        async function deleteUser(id, username) {
            if (!confirm('ATENÇÃO: Tem certeza que deseja excluir o usuário "' + username + '"?')) return;
            try {
                const res = await fetch('/api/users/' + id, { method: 'DELETE' });
                const data = await res.json();
                if (data.error) alert(data.error);
                else location.reload();
            } catch (err) {
                alert('Erro ao excluir: ' + err.message);
            }
        }

        function filterUsers() {
            const q = document.getElementById('userSearch').value.toLowerCase();
            const rows = document.querySelectorAll('#userTableBody tr');
            rows.forEach(r => {
                const text = r.innerText.toLowerCase();
                r.style.display = text.includes(q) ? '' : 'none';
            });
        }
    </script>
</body>
</html>`;
}

module.exports = {
    renderUsersPanel
};
