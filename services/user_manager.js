/**
 * Juggo TV - Gerenciador Autônomo de Usuários & Controle de Telas Simultâneas
 * - Armazenamento persistente em users.json
 * - Credenciais Padrão Master: Login 'admin' / Senha 'neto'
 * - CRUD Completo de Usuários com data de expiração customizável
 * - Controle estrito de 1 Tela por Usuário (bloqueio de telas simultâneas & heartbeat)
 * - Atalhos de Renovação (+30 dias, +90 dias, +1 ano) e Kick de Sessão
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'users.json');

// Memória de sessões ativas em RAM: { token: { userId, username, screenId, lastSeen, ip, userAgent } }
const activeSessions = new Map();
const SCREEN_TIMEOUT_MS = 45 * 1000; // 45 segundos sem heartbeat libera a tela

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            if (Array.isArray(data)) return data;
        }
    } catch (e) {
        console.error('[UserManager] Erro ao carregar users.json:', e.message);
    }

    // Inicialização do Administrador Master padrão
    const defaultAdmin = [{
        id: 'usr_admin',
        username: 'admin',
        password: 'neto',
        name: 'Administrador Master',
        role: 'admin',
        status: 'active',
        maxScreens: 1,
        expiresAt: null, // Administrador nunca expira
        createdAt: new Date().toISOString(),
        notes: 'Conta mestre de administração'
    }];

    saveUsers(defaultAdmin);
    return defaultAdmin;
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[UserManager] Erro ao salvar users.json:', e.message);
        return false;
    }
}

// Limpeza de sessões inativas (expiradas após 45 segundos sem ping)
function cleanupStaleSessions() {
    const now = Date.now();
    for (const [token, session] of activeSessions.entries()) {
        if (now - session.lastSeen > SCREEN_TIMEOUT_MS) {
            activeSessions.delete(token);
        }
    }
}
setInterval(cleanupStaleSessions, 15000);

function getAllUsers() {
    cleanupStaleSessions();
    const users = loadUsers();
    const now = new Date();

    return users.map(u => {
        // Calcular sessões ativas desta conta
        const userSessions = [];
        for (const [token, session] of activeSessions.entries()) {
            if (session.userId === u.id) {
                userSessions.push({
                    screenId: session.screenId,
                    ip: session.ip,
                    lastSeen: session.lastSeen
                });
            }
        }

        // Checar se está expirado
        let isExpired = false;
        let daysLeft = null;
        if (u.expiresAt) {
            const expDate = new Date(u.expiresAt);
            const diffTime = expDate - now;
            daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffTime < 0) isExpired = true;
        }

        let computedStatus = u.status || 'active';
        if (isExpired && computedStatus !== 'blocked') {
            computedStatus = 'expired';
        }

        return {
            ...u,
            computedStatus,
            daysLeft,
            activeScreens: userSessions.length,
            isOnline: userSessions.length > 0
        };
    });
}

function getUserById(id) {
    const users = loadUsers();
    return users.find(u => u.id === id) || null;
}

function getUserByUsername(username) {
    const users = loadUsers();
    return users.find(u => u.username.toLowerCase() === (username || '').toLowerCase()) || null;
}

function createUser({ username, password, name, expiresAt, status, maxScreens, notes }) {
    if (!username || !password) {
        throw new Error('Usuário e senha são obrigatórios.');
    }

    const cleanUsername = username.trim().toLowerCase();
    const users = loadUsers();

    if (users.some(u => u.username.toLowerCase() === cleanUsername)) {
        throw new Error(`O usuário "${cleanUsername}" já existe no sistema.`);
    }

    const newUser = {
        id: 'usr_' + crypto.randomBytes(6).toString('hex'),
        username: cleanUsername,
        password: password.trim(),
        name: (name || cleanUsername).trim(),
        role: 'user',
        status: status || 'active',
        maxScreens: parseInt(maxScreens) || 1, // Padrão estrito de 1 tela por usuário
        expiresAt: expiresAt || null,
        createdAt: new Date().toISOString(),
        notes: (notes || '').trim()
    };

    users.push(newUser);
    saveUsers(users);
    return newUser;
}

function updateUser(id, updates) {
    const users = loadUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Usuário não encontrado.');

    // Não permitir alterar username do admin master para vazio
    if (id === 'usr_admin' && updates.username && updates.username !== 'admin') {
        updates.username = 'admin';
    }

    if (updates.username) {
        const cleanUsername = updates.username.trim().toLowerCase();
        const clash = users.find(u => u.id !== id && u.username.toLowerCase() === cleanUsername);
        if (clash) throw new Error(`O usuário "${cleanUsername}" já está em uso.`);
        updates.username = cleanUsername;
    }

    if (updates.password) updates.password = updates.password.trim();
    if (updates.name) updates.name = updates.name.trim();
    if (updates.maxScreens !== undefined) updates.maxScreens = parseInt(updates.maxScreens) || 1;

    users[idx] = {
        ...users[idx],
        ...updates,
        id // preservar id
    };

    saveUsers(users);
    return users[idx];
}

function deleteUser(id) {
    if (id === 'usr_admin') {
        throw new Error('A conta mestre do administrador não pode ser excluída.');
    }

    const users = loadUsers();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length === users.length) throw new Error('Usuário não encontrado.');

    kickUserSession(id);
    saveUsers(filtered);
    return true;
}

// Renovar acesso (+30 dias, +90 dias, etc.)
function renewUser(id, days = 30) {
    const users = loadUsers();
    const u = users.find(u => u.id === id);
    if (!u) throw new Error('Usuário não encontrado.');

    const now = new Date();
    let baseDate = now;

    // Se a data atual for menor que o vencimento, soma a partir do vencimento futuro
    if (u.expiresAt) {
        const exp = new Date(u.expiresAt);
        if (exp > now) baseDate = exp;
    }

    const newExp = new Date(baseDate.getTime() + (days * 24 * 60 * 60 * 1000));
    u.expiresAt = newExp.toISOString().split('T')[0]; // Salvar formato YYYY-MM-DD
    if (u.status === 'expired') u.status = 'active';

    saveUsers(users);
    return u;
}

// Derrubar sessão ativa (Kick de Tela)
function kickUserSession(id) {
    let kicked = 0;
    for (const [token, session] of activeSessions.entries()) {
        if (session.userId === id) {
            activeSessions.delete(token);
            kicked++;
        }
    }
    return kicked;
}

// Autenticar cliente ou admin
function authenticate(username, password) {
    cleanupStaleSessions();
    const user = getUserByUsername(username);

    if (!user || user.password !== password) {
        return { success: false, error: 'Usuário ou senha incorretos.' };
    }

    if (user.status === 'blocked') {
        return { success: false, error: 'Acesso bloqueado pelo administrador.' };
    }

    if (user.expiresAt) {
        const expDate = new Date(user.expiresAt + 'T23:59:59');
        if (new Date() > expDate) {
            return { success: false, error: 'Seu acesso expirou. Entre em contato para renovar.' };
        }
    }

    // Gerar token de sessão criptografado
    const token = crypto.randomBytes(24).toString('hex');
    const screenId = 'scr_' + crypto.randomBytes(4).toString('hex');

    activeSessions.set(token, {
        userId: user.id,
        username: user.username,
        screenId,
        lastSeen: Date.now(),
        ip: null,
        userAgent: null
    });

    return {
        success: true,
        token,
        screenId,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            expiresAt: user.expiresAt,
            maxScreens: user.maxScreens || 1
        }
    };
}

// Registro e Validação de Tela Ativa (Garante limite de 1 tela)
function registerScreenHeartbeat(token, screenId, clientIp, userAgent) {
    cleanupStaleSessions();

    const users = loadUsers();
    // Procurar a sessão existente
    let session = activeSessions.get(token);

    if (!session) {
        return { allowed: false, error: 'Sessão inválida ou expirada. Faça login novamente.' };
    }

    const user = users.find(u => u.id === session.userId);
    if (!user) {
        activeSessions.delete(token);
        return { allowed: false, error: 'Usuário não existe.' };
    }

    if (user.status === 'blocked') {
        activeSessions.delete(token);
        return { allowed: false, error: 'Acesso bloqueado.' };
    }

    if (user.expiresAt) {
        const expDate = new Date(user.expiresAt + 'T23:59:59');
        if (new Date() > expDate) {
            activeSessions.delete(token);
            return { allowed: false, error: 'Acesso expirado.' };
        }
    }

    // Verificar quantas telas diferentes este usuário está usando (outras sessões ativas)
    // Administrador tem tolerância para múltiplas abas de teste
    const maxScreens = user.role === 'admin' ? 10 : (user.maxScreens || 1);
    const userOtherActiveSessions = [];
    for (const [tok, sess] of activeSessions.entries()) {
        if (sess.userId === user.id && tok !== token) {
            userOtherActiveSessions.push(sess);
        }
    }

    // Se o usuário já está usando todas as telas permitidas em outros dispositivos
    if (userOtherActiveSessions.length >= maxScreens) {
        activeSessions.delete(token);
        return {
            allowed: false,
            error: `Limite de ${maxScreens} tela(s) simultânea(s) atingido! Feche a outra tela para assistir aqui.`
        };
    }

    // Atualizar ping da sessão
    session.lastSeen = Date.now();
    session.ip = clientIp;
    session.userAgent = userAgent;
    if (screenId) session.screenId = screenId;

    return {
        allowed: true,
        username: user.username,
        name: user.name,
        role: user.role,
        expiresAt: user.expiresAt
    };
}

function getSession(token) {
    cleanupStaleSessions();
    return activeSessions.get(token) || null;
}

function destroySession(token) {
    return activeSessions.delete(token);
}

module.exports = {
    getAllUsers,
    getUserById,
    getUserByUsername,
    createUser,
    updateUser,
    deleteUser,
    renewUser,
    kickUserSession,
    authenticate,
    registerScreenHeartbeat,
    getSession,
    destroySession
};
