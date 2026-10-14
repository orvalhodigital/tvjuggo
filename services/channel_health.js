/**
 * Juggo TV - Serviço de Verificação de Saúde dos Canais (Health Check)
 * - Testa a disponibilidade dos streams a cada 4 horas
 * - Identifica canais que não estão funcionando (offline / erro HTTP)
 * - Salva relatório detalhado em broken_channels.json para o Painel Admin
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BROKEN_CHANNELS_FILE = path.join(__dirname, '..', 'broken_channels.json');

let isHealthChecking = false;
let lastCheckTimestamp = null;
let healthReport = {
    lastCheck: null,
    totalChannels: 0,
    onlineCount: 0,
    brokenCount: 0,
    brokenChannels: [],
    inProgress: false,
    progressPercent: 0
};

// Carregar relatório salvo anteriormente
try {
    if (fs.existsSync(BROKEN_CHANNELS_FILE)) {
        healthReport = JSON.parse(fs.readFileSync(BROKEN_CHANNELS_FILE, 'utf8'));
        lastCheckTimestamp = healthReport.lastCheck;
    }
} catch (e) {
    console.error('[HealthCheck] Erro ao ler broken_channels.json:', e.message);
}

function testStreamAvailability(streamUrl, timeoutMs = 5000) {
    return new Promise((resolve) => {
        try {
            const parsed = new URL(streamUrl);
            const lib = parsed.protocol === 'https:' ? https : http;
            
            const req = lib.request({
                method: 'GET',
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                headers: {
                    'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
                    'Range': 'bytes=0-1024'
                },
                timeout: timeoutMs
            }, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    req.destroy();
                    resolve({ online: true, statusCode: res.statusCode });
                } else {
                    req.destroy();
                    resolve({ online: false, error: `HTTP ${res.statusCode}` });
                }
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ online: false, error: 'Tempo esgotado (Timeout)' });
            });

            req.on('error', (err) => {
                resolve({ online: false, error: err.code || err.message });
            });

            req.end();
        } catch (e) {
            resolve({ online: false, error: 'URL inválida' });
        }
    });
}

async function runHealthCheck(channelsMap) {
    if (isHealthChecking) return healthReport;
    isHealthChecking = true;
    healthReport.inProgress = true;
    healthReport.progressPercent = 0;

    console.log(`[HealthCheck] Iniciando auditoria de saúde em ${channelsMap.size} canais...`);
    const channelList = Array.from(channelsMap.values());
    const brokenList = [];
    let onlineCount = 0;

    const BATCH_SIZE = 8;
    for (let i = 0; i < channelList.length; i += BATCH_SIZE) {
        const batch = channelList.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (ch) => {
            const targetUrl = (ch.qualities && (ch.qualities['HD'] || ch.qualities['FHD'] || ch.qualities['SD'])) || (ch.urls && ch.urls[0]);
            if (!targetUrl) {
                brokenList.push({
                    id: ch.id,
                    name: ch.name,
                    group: ch.group,
                    logo: ch.logo,
                    url: 'Sem URL',
                    error: 'Nenhum fluxo configurado',
                    checkedAt: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                });
                return;
            }

            const result = await testStreamAvailability(targetUrl);
            if (result.online) {
                onlineCount++;
            } else {
                brokenList.push({
                    id: ch.id,
                    name: ch.name,
                    group: ch.group,
                    logo: ch.logo,
                    url: targetUrl,
                    error: result.error,
                    checkedAt: new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                });
            }
        }));

        healthReport.progressPercent = Math.round(((i + batch.length) / channelList.length) * 100);
    }

    lastCheckTimestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
    healthReport = {
        lastCheck: lastCheckTimestamp,
        totalChannels: channelList.length,
        onlineCount: onlineCount,
        brokenCount: brokenList.length,
        brokenChannels: brokenList,
        inProgress: false,
        progressPercent: 100
    };

    isHealthChecking = false;

    try {
        fs.writeFileSync(BROKEN_CHANNELS_FILE, JSON.stringify(healthReport, null, 2), 'utf8');
        console.log(`[HealthCheck] Auditoria concluída: ${onlineCount} Online | ${brokenList.length} Canais com falhas.`);
    } catch (e) {
        console.error('[HealthCheck] Erro ao salvar broken_channels.json:', e.message);
    }

    return healthReport;
}

function getHealthReport() {
    return healthReport;
}

// Iniciar agendador para rodar a cada 4 horas
function initHealthCheckScheduler(channelsMap) {
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    console.log('[HealthCheck] Agendador automático ativado: Verificação a cada 4 horas.');

    // Executa a primeira checagem 2 minutos após o servidor subir
    setTimeout(() => {
        runHealthCheck(channelsMap);
    }, 2 * 60 * 1000);

    // Executa recorrentemente a cada 4 horas
    setInterval(() => {
        runHealthCheck(channelsMap);
    }, FOUR_HOURS);
}

module.exports = {
    runHealthCheck,
    getHealthReport,
    initHealthCheckScheduler
};
