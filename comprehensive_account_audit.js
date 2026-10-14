const http = require('http');
const https = require('https');
const dns = require('dns').promises;

// Usar DNS públicos para garantir resolução
dns.setServers(['8.8.8.8', '1.1.1.1']);

const userAccounts = [
    { host: 'http://jctv.drivecar.click', user: '353397841', pass: '143888952' },
    { host: 'http://jctv.drivecar.click', user: '511596523', pass: '597862230' },
    { host: 'http://qfq23d.cc', user: 'Ednardo64', pass: 'Ferreiro184' },
    { host: 'http://qfq23d.cc', user: 'FpPR2', pass: 'X66Fgm' },
    { host: 'http://qfq23d.cc', user: 'paulocasabela43', pass: '91ZaaA' },
    { host: 'http://qfq23d.cc', user: 'edineymoraes', pass: 'Dgn2201' },
    { host: 'http://qfq23d.cc', user: 'Lucas9063', pass: 'H8zq6KaJL' },
    { host: 'http://qfq23d.cc', user: 'Leila_quarto_7021', pass: '1Udj5F' },
    { host: 'http://qfq23d.cc', user: '11197383Jo', pass: '32560531Jo' },
    { host: 'http://qfq23d.cc', user: 'Renato386', pass: 'Confeitaria1' },
    { host: 'http://qfq23d.cc', user: 'Leo838503', pass: 'Albanita873' },
    { host: 'http://qfq23d.cc', user: 'Sala55padaria', pass: '383Mviviane' },
    { host: 'http://qfq23d.cc', user: 'Frahel88', pass: 'Tntfox4593' },
    { host: 'http://qfq23d.cc', user: 'Dadan2378', pass: '48121620aA@' },
    { host: 'http://qfq23d.cc', user: 'Ana83624', pass: 'Leticia4653' },
    { host: 'http://qfq23d.cc', user: 'diegocavalcante', pass: 'r56fBG' },
    { host: 'http://qfq23d.cc', user: 'vB4yzmSY', pass: '8syQ1X' },
    { host: 'http://qfq23d.cc', user: 'dWnrFTFD', pass: 'Q8T8bb' },
    { host: 'http://qfq23d.cc', user: 'devania', pass: '534ZXYrnx' },
    { host: 'http://qfq23d.cc', user: '027pardalPP', pass: '568Tscort' },
    { host: 'http://qfq23d.cc', user: 'Nettob02', pass: 'Barros19' },
    { host: 'http://dns.akira.best', user: '5522898366541', pass: '22898366541' },
    { host: 'http://dns.akira.best', user: 'testejorge', pass: 'jorge112233' },
    { host: 'http://dns.akira.best', user: 'talita73728uei', pass: '73738talita828' },
    { host: 'http://firetop1.site', user: '927711461', pass: '446692361' }
];

const freshSnippetAccounts = [
    { host: 'http://ch.chevette.xyz', user: 'joao9130', pass: '8391307847aoj' },
    { host: 'http://smrtsfg.us', user: '799542388', pass: '5789512459' },
    { host: 'http://maisonxp.click:80', user: 'Nonobte', pass: 'No10' },
    { host: 'http://otrasbx.com:8080', user: 'TGjyyD', pass: 'xkMtJU' },
    { host: 'http://serie.crepusculo.shop:80', user: 'anapaulacs', pass: '334455aaBBcc' },
    { host: 'http://a.mx51.online', user: 'mbYmNyTGfU', pass: 'aGFDrgEQMm' },
    { host: 'http://newemma.xyz:8080', user: '988334583tv', pass: '5x9563a' },
    { host: 'http://d.plmv.site', user: 'anapaulacs', pass: '334455aaBBcc' },
    { host: 'http://rede.tvno.site:8080', user: 'anadepina', pass: 'Gdt23g' },
    { host: 'http://a.mx51.online', user: 'anapaulacs', pass: '334455aaBBcc' }
];

async function testXtream(acc) {
    return new Promise(async resolve => {
        const parsed = new URL(acc.host);
        // Tentar resolver DNS primeiro
        let ip = null;
        try {
            const ips = await dns.resolve4(parsed.hostname);
            ip = ips[0];
        } catch (e) {
            return resolve({ ...acc, online: false, error: `DNS offline (${e.code})` });
        }

        const pathStr = `/player_api.php?username=${encodeURIComponent(acc.user)}&password=${encodeURIComponent(acc.pass)}`;
        const client = parsed.protocol === 'https:' ? https : http;
        const port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);

        const req = client.get({
            hostname: ip,
            port: port,
            path: pathStr,
            headers: {
                'Host': parsed.host,
                'User-Agent': 'IPTVSmartersPro/1.1.1 (Android/9)',
                'Accept': '*/*'
            },
            timeout: 6000
        }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve({ ...acc, online: true, status: `Redirect 302 -> ${res.headers.location}` });
            }
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    const ui = json.user_info || {};
                    const si = json.server_info || {};
                    const expFormatted = ui.exp_date ? new Date(parseInt(ui.exp_date, 10) * 1000).toISOString().split('T')[0] : 'Vitalício/Desconhecido';
                    resolve({
                        ...acc,
                        online: true,
                        auth: ui.auth === 1,
                        status: ui.status || 'Active',
                        expDate: expFormatted,
                        maxCons: ui.max_connections || '1',
                        activeCons: ui.active_cons || '0',
                        serverUrl: si.url || parsed.hostname
                    });
                } catch (e) {
                    if (body.includes('#EXTM3U')) {
                        resolve({ ...acc, online: true, auth: true, status: 'Active (M3U Plain)', expDate: 'N/A' });
                    } else {
                        resolve({ ...acc, online: true, auth: false, status: `HTTP ${res.statusCode} (Não-JSON)`, sample: body.substring(0, 80) });
                    }
                }
            });
        });

        req.on('error', err => resolve({ ...acc, online: false, error: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ...acc, online: false, error: 'Timeout (6s)' }); });
    });
}

(async () => {
    console.log('=== PARTE 1: ANALISANDO CONTAS ENVIADAS PELO USUÁRIO ===');
    for (const acc of userAccounts) {
        const res = await testXtream(acc);
        const icon = res.online ? (res.auth ? '✅' : '⚠️') : '❌';
        console.log(`${icon} [${res.host}] User: ${res.user} -> ${res.online ? (res.auth ? `ATIVO | Status: ${res.status} | Exp: ${res.expDate} | Max: ${res.maxCons}` : `Sem Auth: ${res.status}`) : `OFFLINE: ${res.error}`}`);
    }

    console.log('\n=== PARTE 2: ANALISANDO CONTAS ATIVAS DO GERADOR HAMSTER ATUAL ===');
    for (const acc of freshSnippetAccounts) {
        const res = await testXtream(acc);
        const icon = res.online ? (res.auth ? '✅' : '⚠️') : '❌';
        console.log(`${icon} [${res.host}] User: ${res.user} -> ${res.online ? (res.auth ? `ATIVO | Status: ${res.status} | Exp: ${res.expDate} | Max: ${res.maxCons}` : `Sem Auth: ${res.status}`) : `OFFLINE: ${res.error}`}`);
    }
})();
