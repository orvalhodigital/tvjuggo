/**
 * Juggo TV - Agente Autônomo de Inteligência Artificial (Gemini AI)
 * - Responsável pela curadoria dos Canais PPV e busca de transmissões nos servidores alternativos
 * - Cronograma de Descanso da IA: Executa uma análise profunda a cada 48 horas (2 dias)
 *   para os próximos 10 dias de eventos e jogos, descansando nos intervalos para economizar recursos.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const EPG_AI_CACHE_FILE = path.join(__dirname, '..', 'epg_ai_cache.json');
const PPV_SERVERS_FILE = path.join(__dirname, 'ppv_servers.json');

let aiStatus = {
    state: 'idle', // 'idle' (descansando), 'analyzing' (trabalhando), 'ready'
    lastRun: null,
    nextRun: null,
    eventsMappedCount: 0,
    upcomingSchedule: [],
    lastLog: 'IA inicializada em modo de prontidão.'
};

// Carregar cache anterior
try {
    if (fs.existsSync(EPG_AI_CACHE_FILE)) {
        const cached = JSON.parse(fs.readFileSync(EPG_AI_CACHE_FILE, 'utf8'));
        aiStatus.lastRun = cached.lastRun || null;
        aiStatus.upcomingSchedule = cached.upcomingSchedule || [];
        aiStatus.eventsMappedCount = aiStatus.upcomingSchedule.length;
    }
} catch (e) {
    console.error('[IA-Agent] Erro ao carregar epg_ai_cache.json:', e.message);
}

function getPpvServers() {
    try {
        if (fs.existsSync(PPV_SERVERS_FILE)) {
            return JSON.parse(fs.readFileSync(PPV_SERVERS_FILE, 'utf8')).servers || [];
        }
    } catch (e) {}
    return [];
}

async function callGeminiApi(promptText) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'sua_chave_gemini_aqui') {
        throw new Error('Chave GEMINI_API_KEY não configurada no .env');
    }

    const payload = JSON.stringify({
        contents: [{
            parts: [{ text: promptText }]
        }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048
        }
    });

    const candidateModels = [
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-2.5-pro',
        'gemini-pro-latest'
    ];

    let lastError = null;
    for (const modelName of candidateModels) {
        try {
            const result = await new Promise((resolve, reject) => {
                const options = {
                    hostname: 'generativelanguage.googleapis.com',
                    port: 443,
                    path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload)
                    },
                    timeout: 20000
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.candidates && json.candidates[0] && json.candidates[0].content) {
                                const answer = json.candidates[0].content.parts[0].text;
                                resolve(answer);
                            } else if (json.error) {
                                reject(new Error(`[${modelName}] ${json.error.message || 'Erro Gemini'}`));
                            } else {
                                reject(new Error(`[${modelName}] Resposta vazia da IA`));
                            }
                        } catch (e) {
                            reject(e);
                        }
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error(`Timeout ao consultar ${modelName}`));
                });

                req.on('error', reject);
                req.write(payload);
                req.end();
            });

            if (result) return result;
        } catch (err) {
            lastError = err;
            console.log(`[IA-Agent] Modelo ${modelName} indisponível (${err.message}). Tentando próximo...`);
        }
    }

    throw lastError || new Error('Nenhum modelo Gemini respondeu no momento.');
}

// Execução da análise profunda dos próximos 10 dias
async function runAiDeepAnalysis() {
    if (aiStatus.state === 'analyzing') return aiStatus;

    aiStatus.state = 'analyzing';
    aiStatus.lastLog = 'Iniciando análise dos próximos 10 dias com IA e servidores de consulta...';
    console.log('[IA-Agent] 🧠 IA ativada: Analisando grade esportiva e PPVs dos próximos 10 dias...');

    const servers = getPpvServers();

    const prompt = `Você é o curador autônomo da Juggo TV. 
Gere um JSON com os principais eventos esportivos e PPV de futebol (Brasileirão, Champions League, Premier League, La Liga, Libertadores, Copa do Brasil e UFC) para os próximos 10 dias.
Para cada evento retorne estritamente um array JSON de objetos com:
- "date": string "YYYY-MM-DD"
- "time": string "HH:MM" (horário de Brasília)
- "title": "Time A x Time B" ou "Evento de Luta"
- "competition": Nome da liga/torneio
- "suggestedChannel": Nome do canal oficial provável (Ex: "Premiere 1", "SporTV", "ESPN", "TNT", "Space", "CazéTV")
- "category": "Futebol" ou "Luta / PPV" ou "Esportes"
Retorne APENAS o bloco JSON válido sem markdown ou explicações.`;

    try {
        const rawResponse = await callGeminiApi(prompt);
        let cleaned = rawResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const schedule = JSON.parse(cleaned);

        if (Array.isArray(schedule)) {
            aiStatus.upcomingSchedule = schedule;
            aiStatus.eventsMappedCount = schedule.length;
            aiStatus.lastRun = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
            
            // Programar próximo ciclo para daqui a 48 horas (2 dias de descanso)
            const nextDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
            aiStatus.nextRun = nextDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília)';
            aiStatus.state = 'idle';
            aiStatus.lastLog = `Sucesso! ${schedule.length} eventos mapeados para os próximos 10 dias. IA entrou em ciclo de descanso (48h).`;

            fs.writeFileSync(EPG_AI_CACHE_FILE, JSON.stringify({
                lastRun: aiStatus.lastRun,
                nextRun: aiStatus.nextRun,
                upcomingSchedule: schedule
            }, null, 2), 'utf8');

            console.log(`[IA-Agent] ✅ Análise concluída: ${schedule.length} eventos mapeados com sucesso! Próxima análise em 48h.`);
        }
    } catch (err) {
        aiStatus.state = 'idle';
        aiStatus.lastLog = `Falha na análise: ${err.message}. Entrando em repouso programado.`;
        console.error('[IA-Agent] ⚠️ Aviso na análise da IA:', err.message);
    }

    return aiStatus;
}

// Iniciar agendador com ciclo de 48 horas (2 dias de descanso)
function initAiScheduler() {
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
    console.log('[IA-Agent] ⏱️ Agendador da IA configurado: Ciclo de trabalho a cada 48 horas.');

    // Executa 3 minutos após inicializar
    setTimeout(() => {
        runAiDeepAnalysis();
    }, 3 * 60 * 1000);

    // Ciclo de descanso de 48 horas
    setInterval(() => {
        runAiDeepAnalysis();
    }, FORTY_EIGHT_HOURS);
}

function getAiStatus() {
    return aiStatus;
}

module.exports = {
    initAiScheduler,
    runAiDeepAnalysis,
    getAiStatus
};
