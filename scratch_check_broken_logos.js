const http = require('http');
const https = require('https');
const fs = require('fs');

const content = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = content.split('\n');

const channelsWithLogos = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        const m = ext.match(/tvg-logo="([^"]*)"/);
        const logo = m ? m[1].trim() : '';
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Canal';
        if (logo) {
            channelsWithLogos.push({ name, logo });
        }
    }
}

async function checkLogo(item) {
    return new Promise(resolve => {
        try {
            const u = new URL(item.logo);
            const client = u.protocol === 'https:' ? https : http;
            const req = client.get(item.logo, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 5000
            }, res => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    resolve({ ...item, ok: true, status: res.statusCode });
                } else {
                    resolve({ ...item, ok: false, error: `HTTP ${res.statusCode}` });
                }
                res.resume();
            });
            req.on('error', err => resolve({ ...item, ok: false, error: err.message }));
            req.on('timeout', () => { req.destroy(); resolve({ ...item, ok: false, error: 'Timeout' }); });
        } catch (e) {
            resolve({ ...item, ok: false, error: e.message });
        }
    });
}

(async () => {
    console.log(`Testando conectividade de ${channelsWithLogos.length} logos...`);
    const results = [];
    const poolSize = 20;
    for (let i = 0; i < channelsWithLogos.length; i += poolSize) {
        const batch = channelsWithLogos.slice(i, i + poolSize);
        const batchRes = await Promise.all(batch.map(checkLogo));
        results.push(...batchRes);
        process.stdout.write(`Progresso: ${Math.min(i + poolSize, channelsWithLogos.length)} / ${channelsWithLogos.length}\r`);
    }

    const failed = results.filter(r => !r.ok);
    console.log(`\n\n--- RESULTADO TESTE DE LOGOS ---`);
    console.log(`Logos funcionando: ${results.length - failed.length}`);
    console.log(`Logos QUEBRADAS / FORA DO AR: ${failed.length}`);

    // Agrupar falhas por domínio / erro
    const failedByDomain = {};
    failed.forEach(f => {
        try {
            const h = new URL(f.logo).hostname;
            failedByDomain[h] = (failedByDomain[h] || 0) + 1;
        } catch(e) {}
    });
    console.log('\nLogos quebradas por domínio:', failedByDomain);

    console.log('\nExemplos de canais com logo quebrada:');
    failed.slice(0, 25).forEach(f => console.log(`- ${f.name} -> [${f.error}] ${f.logo}`));

    fs.writeFileSync('scratch/broken_logos.json', JSON.stringify(failed, null, 2));
})();
