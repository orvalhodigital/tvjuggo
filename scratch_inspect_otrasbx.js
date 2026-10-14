const http = require('http');
const fs = require('fs');

async function getLiveStreams() {
    return new Promise(resolve => {
        http.get({
            hostname: '172.67.186.137',
            port: 8080,
            path: '/player_api.php?username=TGjyyD&password=xkMtJU&action=get_live_streams',
            headers: {
                'Host': 'otrasbx.com',
                'User-Agent': 'IPTVSmartersPro/1.1.1'
            },
            timeout: 15000
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const streams = JSON.parse(data);
                    console.log('Total de canais ao vivo (Live Streams):', streams.length);
                    const premiere = streams.filter(s => /premiere/i.test(s.name));
                    console.log('Canais Premiere encontrados:', premiere.length);
                    premiere.slice(0, 15).forEach(p => console.log(`- [${p.stream_id}] ${p.name}`));
                    
                    const sportv = streams.filter(s => /sportv/i.test(s.name));
                    console.log('\nCanais SporTV encontrados:', sportv.length);
                    sportv.slice(0, 10).forEach(s => console.log(`- [${s.stream_id}] ${s.name}`));

                    const espn = streams.filter(s => /espn/i.test(s.name));
                    console.log('\nCanais ESPN encontrados:', espn.length);
                    espn.slice(0, 10).forEach(e => console.log(`- [${e.stream_id}] ${e.name}`));

                    // Salvar amostra
                    fs.writeFileSync('scratch/otrasbx_premiere.json', JSON.stringify(premiere, null, 2));
                    resolve(streams);
                } catch(e) {
                    console.log('Erro ao parsear JSON:', e.message, data.substring(0, 200));
                    resolve([]);
                }
            });
        }).on('error', err => {
            console.error('Erro na requisição:', err.message);
            resolve([]);
        });
    });
}

getLiveStreams();
