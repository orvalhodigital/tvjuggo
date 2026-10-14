const http = require('http');
const https = require('https');

const accounts = [
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

function checkAccount(acc) {
    return new Promise(resolve => {
        const urlStr = `${acc.host}/player_api.php?username=${encodeURIComponent(acc.user)}&password=${encodeURIComponent(acc.pass)}`;
        try {
            const parsed = new URL(urlStr);
            const client = parsed.protocol === 'https:' ? https : http;
            const req = client.get({
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                headers: {
                    'User-Agent': 'IPTVSmartersPro/1.1.1 (Android/9)',
                    'Accept': '*/*'
                },
                timeout: 7000
            }, res => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return resolve({ ...acc, online: true, redirect: res.headers.location });
                }
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        const ui = json.user_info || {};
                        const si = json.server_info || {};
                        const expFormatted = ui.exp_date ? new Date(parseInt(ui.exp_date, 10) * 1000).toISOString().split('T')[0] : 'N/A';
                        resolve({
                            ...acc,
                            online: true,
                            auth: ui.auth === 1,
                            status: ui.status || 'unknown',
                            expDate: expFormatted,
                            maxCons: ui.max_connections || '1',
                            activeCons: ui.active_cons || '0',
                            serverUrl: si.url || parsed.hostname,
                            serverPort: si.port || parsed.port || '80',
                            serverTime: si.time_now || ''
                        });
                    } catch (e) {
                        resolve({ ...acc, online: res.statusCode === 200, status: `HTTP ${res.statusCode} (Not JSON)`, sample: body.substring(0, 100) });
                    }
                });
            });
            req.on('error', err => resolve({ ...acc, online: false, error: err.message }));
            req.on('timeout', () => { req.destroy(); resolve({ ...acc, online: false, error: 'Timeout (7s)' }); });
        } catch (err) {
            resolve({ ...acc, online: false, error: err.message });
        }
    });
}

(async () => {
    console.log(`Testando ${accounts.length} contas IPTV...`);
    const results = [];
    for (const acc of accounts) {
        process.stdout.write(`Testando ${acc.host} (${acc.user})... `);
        const res = await checkAccount(acc);
        console.log(res.online ? (res.auth ? `✅ ATIVO (${res.status}, Exp: ${res.expDate}, Max: ${res.maxCons})` : `⚠️ Resposta sem auth: ${res.status}`) : `❌ Off: ${res.error}`);
        results.push(res);
    }

    const actives = results.filter(r => r.auth && r.status === 'Active');
    console.log(`\n=======================================================`);
    console.log(`RESUMO: ${actives.length} de ${accounts.length} contas ATIVAS encontradas!`);
    console.log(`=======================================================`);
    actives.forEach(a => {
        console.log(`- ${a.host} | User: ${a.user} | Exp: ${a.expDate} | Conexões: ${a.activeCons}/${a.maxCons}`);
    });
})();
