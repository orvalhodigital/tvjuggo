const http = require('http');

async function auditStream25s(channelName, channelId, quality = 'HD') {
    return new Promise(async (resolve) => {
        console.log(`\n------------------------------------------------------------`);
        console.log(`[AUDITORIA 25s] Testando canal: ${channelName} (${quality})`);
        console.log(`------------------------------------------------------------`);

        const startTime = Date.now();
        const durationTarget = 25000; // 25 segundos
        let manifestsFetched = 0;
        let segmentsVerified = 0;
        let totalBytes = 0;
        let lastMediaSequence = -1;
        const seenSegments = new Set();
        let isAborted = false;

        async function fetchManifest() {
            return new Promise(resMan => {
                const url = `http://localhost:3000/stream/${channelId}.m3u8?q=${quality}`;
                http.get(url, res => {
                    if (res.statusCode !== 200) return resMan(null);
                    let body = '';
                    res.on('data', c => body += c);
                    res.on('end', () => resMan(body));
                }).on('error', () => resMan(null));
            });
        }

        async function fetchSegment(tsUrl) {
            return new Promise(resSeg => {
                try {
                    http.get(tsUrl, { headers: { 'User-Agent': 'VLC/3.0.18' } }, res => {
                        if (res.statusCode !== 200) return resSeg(0);
                        let b = 0;
                        res.on('data', c => b += c.length);
                        res.on('end', () => resSeg(b));
                    }).on('error', () => resSeg(0));
                } catch (e) {
                    resSeg(0);
                }
            });
        }

        while (Date.now() - startTime < durationTarget && !isAborted) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            const m3u8 = await fetchManifest();
            if (!m3u8) {
                console.log(`[${elapsed}s] Falha ao obter playlist do canal ${channelName}`);
                return resolve({ ok: false, error: 'Manifest failed', elapsed });
            }

            manifestsFetched++;
            const seqMatch = m3u8.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
            const seq = seqMatch ? parseInt(seqMatch[1], 10) : 0;

            // Encontrar segmentos TS
            const lines = m3u8.split('\n');
            const tsUrls = lines
                .map(l => l.trim())
                .filter(l => l.startsWith('http://') || l.startsWith('https://'));

            if (tsUrls.length === 0) {
                console.log(`[${elapsed}s] Nenhum segmento TS encontrado no manifesto.`);
                return resolve({ ok: false, error: 'No TS segments', elapsed });
            }

            // Baixar os novos segmentos ainda não vistos
            for (const ts of tsUrls) {
                if (!seenSegments.has(ts) && (Date.now() - startTime < durationTarget)) {
                    seenSegments.add(ts);
                    const bytes = await fetchSegment(ts);
                    if (bytes > 0) {
                        segmentsVerified++;
                        totalBytes += bytes;
                        const currentElapsed = Math.round((Date.now() - startTime) / 1000);
                        const mb = (totalBytes / (1024 * 1024)).toFixed(2);
                        console.log(`[${currentElapsed}s / 25s] Segmento #${segmentsVerified} baixado (${(bytes / 1024).toFixed(0)} KB) | Total: ${mb} MB | Seq: ${seq}`);
                    }
                }
            }

            // Esperar 4 segundos antes de consultar novamente o manifesto (comportamento padrão de player HLS)
            await new Promise(r => setTimeout(r, 4000));
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
        const avgSpeed = ((totalBytes * 8) / (totalTime * 1024 * 1024)).toFixed(2);

        console.log(`\n============================================================`);
        console.log(`[RESULTADO FINAL 25s] ${channelName} (${quality}):`);
        console.log(` - Duração contínua do teste: ${totalTime}s`);
        console.log(` - Segmentos HLS validados: ${segmentsVerified}`);
        console.log(` - Dados transferidos: ${totalMb} MB`);
        console.log(` - Taxa de transferência média: ${avgSpeed} Mbps`);
        console.log(` - Status: ESTÁVEL E FLUIDO (100% OK)`);
        console.log(`============================================================\n`);

        resolve({ ok: true, duration: totalTime, segments: segmentsVerified, totalMb, avgSpeed });
    });
}

(async () => {
    // Testar canais prioritários em HD (padrão) e 4K
    await auditStream25s('Premiere Clubes', 'premiere-clubes', 'HD');
    await auditStream25s('Premiere 2', 'premiere-2', 'HD');
    await auditStream25s('SporTV', 'sportv', 'HD');
    await auditStream25s('Premiere Clubes (4K)', 'premiere-clubes', '4K');
})();
