/**
 * Juggo TV - Minerador Autônomo de Servidores no GitHub & Web
 * - Executa a cada 5 dias (ciclo programado) ou sob demanda via Painel Admin
 * - Varre repositórios públicos do GitHub e listas comunitárias atualizadas
 * - Extrai servidores ativos de streaming (m3u8, proxies, CDNs e Xtream hosts)
 * - Testa a saúde de cada novo servidor descoberto em paralelo (3s timeout)
 * - Adiciona automaticamente novos fallbacks em services/ppv_servers.json (Fallback 1, 2, 3, 4, 5, 6, 7...)
 * - Garante redundância máxima para o sistema NUNCA ficar sem sinal
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PPV_SERVERS_FILE = path.join(__dirname, 'ppv_servers.json');

// Fontes curadas e repositórios do GitHub com listas atualizadas
const GITHUB_SOURCES = [
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/br_sports.m3u',
    'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_brazil.m3u8',
    'https://raw.githubusercontent.com/LITUATUI/M3UPT/main/M3U/M3UPT.m3u',
    'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/pt.m3u'
];

let minerStatus = {
    state: 'idle', // 'idle', 'mining', 'testing'
    lastRun: null,
    nextRun: null,
    discoveredServers: [],
    lastLog: 'Minerador de servidores pronto para operação.'
};

function fetchText(urlStr, timeoutMs = 8000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(urlStr);
            const lib = parsed.protocol === 'https:' ? https : http;
            const req = lib.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    req.destroy();
                    return resolve(fetchText(res.headers.location, timeoutMs));
                }
                if (res.statusCode !== 200) {
                    req.destroy();
                    return resolve(null);
                }
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve(body));
            });
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.on('error', () => { req.destroy(); resolve(null); });
            req.setTimeout(timeoutMs);
        } catch (e) {
            resolve(null);
        }
    });
}

function testHostPing(hostStr, timeoutMs = 3000) {
    return new Promise((resolve) => {
        try {
            const [hostname, port] = hostStr.split(':');
            const req = http.request({
                method: 'HEAD',
                hostname: hostname,
                port: port || 80,
                path: '/',
                headers: { 'User-Agent': 'Mozilla/5.0' }
            }, (res) => {
                req.destroy();
                resolve(res.statusCode < 500);
            });
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.on('error', () => { req.destroy(); resolve(false); });
            req.setTimeout(timeoutMs);
            req.end();
        } catch (e) {
            resolve(false);
        }
    });
}

async function runMinerJob() {
    if (minerStatus.state === 'mining' || minerStatus.state === 'testing') {
        return minerStatus;
    }

    minerStatus.state = 'mining';
    minerStatus.lastLog = 'Iniciando varredura no GitHub e fontes comunitárias abertas...';
    console.log('[Minerador-GitHub] 🔍 Iniciando rastreamento de novos servidores...');

    const discoveredHosts = new Set();

    // 1. Baixar e analisar listas do GitHub
    for (const sourceUrl of GITHUB_SOURCES) {
        try {
            console.log(`[Minerador-GitHub] Consultando fonte: ${sourceUrl}`);
            const content = await fetchText(sourceUrl);
            if (!content) continue;

            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                    try {
                        const parsed = new URL(trimmed);
                        const h = parsed.host.toLowerCase();
                        if (h && 
                            !h.includes('github') && 
                            !h.includes('youtube') && 
                            !h.includes('google') && 
                            !h.includes('imgur') && 
                            !h.includes('raw.githubusercontent') &&
                            !h.includes('facebook') &&
                            !h.includes('twitter')) {
                            discoveredHosts.add(parsed.host);
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {
            console.error(`[Minerador-GitHub] Erro ao ler fonte ${sourceUrl}:`, e.message);
        }
    }

    console.log(`[Minerador-GitHub] 🎯 Extraídos ${discoveredHosts.size} hosts únicos.`);
    minerStatus.lastLog = `Encontrados ${discoveredHosts.size} servidores candidatos. Testando disponibilidade em paralelo...`;
    minerStatus.state = 'testing';

    // 2. Testar servidores candidatos em paralelo (lotes de 20 para rapidez sem travar)
    const hostArray = Array.from(discoveredHosts).slice(0, 40);
    const validServers = [];

    const batchSize = 15;
    for (let i = 0; i < hostArray.length; i += batchSize) {
        const batch = hostArray.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (host) => {
            const isAlive = await testHostPing(host, 3000);
            return isAlive ? host : null;
        }));
        results.filter(Boolean).forEach(h => validServers.push(h));
    }

    console.log(`[Minerador-GitHub] ⚡ Teste concluído: ${validServers.length} servidores responderam com sucesso.`);

    // 3. Atualizar ppv_servers.json com novos fallbacks
    try {
        let currentConfig = { 
            description: "Servidores de Consulta e Fallback para Canais PPV e Esportes da Juggo TV",
            updatedAt: new Date().toISOString(),
            servers: [] 
        };

        if (fs.existsSync(PPV_SERVERS_FILE)) {
            currentConfig = JSON.parse(fs.readFileSync(PPV_SERVERS_FILE, 'utf8'));
        }

        const existingHosts = new Set(currentConfig.servers.map(s => s.host));
        let addedCount = 0;

        validServers.forEach((vh) => {
            if (!existingHosts.has(vh)) {
                addedCount++;
                const newPriority = currentConfig.servers.length + 1;
                currentConfig.servers.push({
                    name: `Servidor Reserva GitHub #${newPriority}`,
                    host: vh,
                    priority: newPriority,
                    status: 'active',
                    types: ['Fallback Global', 'Multi-Server'],
                    discoveredAt: new Date().toLocaleDateString('pt-BR')
                });
                existingHosts.add(vh);
            }
        });

        currentConfig.updatedAt = new Date().toISOString();
        fs.writeFileSync(PPV_SERVERS_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');

        minerStatus.lastRun = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
        const nextDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        minerStatus.nextRun = nextDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
        minerStatus.discoveredServers = currentConfig.servers;
        minerStatus.state = 'idle';
        minerStatus.lastLog = `Varredura concluída! ${validServers.length} servidores ativos confirmados (+${addedCount} novos adicionados como Fallback). Total ativo: ${currentConfig.servers.length} servidores. Próxima consulta em 5 dias.`;

        console.log(`[Minerador-GitHub] ✅ Concluído: +${addedCount} novos servidores cadastrados. Total de fallbacks: ${currentConfig.servers.length}`);
    } catch (e) {
        minerStatus.state = 'idle';
        minerStatus.lastLog = `Erro ao salvar servidores descobertos: ${e.message}`;
        console.error('[Minerador-GitHub] Erro:', e.message);
    }

    return minerStatus;
}

function initMinerScheduler() {
    const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
    console.log('[Minerador-GitHub] ⏱️ Agendador ativado: Rastreamento automático a cada 5 dias.');

    // Executa a primeira varredura 2 minutos após o servidor inicializar
    setTimeout(() => {
        runMinerJob().catch(err => console.error('[Minerador-GitHub] Falha no job inicial:', err.message));
    }, 2 * 60 * 1000);

    // Ciclo de 5 dias contínuo
    setInterval(() => {
        runMinerJob().catch(err => console.error('[Minerador-GitHub] Falha no ciclo de 5 dias:', err.message));
    }, FIVE_DAYS);
}

function getMinerStatus() {
    return minerStatus;
}

module.exports = {
    initMinerScheduler,
    runMinerJob,
    getMinerStatus
};
