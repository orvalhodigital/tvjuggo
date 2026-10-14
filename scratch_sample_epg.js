const https = require('https');
const zlib = require('zlib');

https.get('https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz', res => {
    const gunzip = zlib.createGunzip();
    res.pipe(gunzip);
    let xml = '';
    gunzip.on('data', chunk => {
        xml += chunk;
        if (xml.length > 200000) {
            gunzip.destroy();
            const channelMatches = xml.match(/<channel id="([^"]+)">[\s\S]*?<\/channel>/g) || [];
            console.log('Channels encontrados na amostra do EPG:', channelMatches.length);
            channelMatches.slice(0, 25).forEach(c => {
                const idMatch = c.match(/id="([^"]+)"/);
                const nameMatch = c.match(/<display-name[^>]*>([^<]+)<\/display-name>/);
                const iconMatch = c.match(/<icon src="([^"]+)"/);
                console.log(`- tvg-id: "${idMatch ? idMatch[1] : ''}" | Nome: "${nameMatch ? nameMatch[1] : ''}" | Icon: ${iconMatch ? iconMatch[1] : 'sem icon'}`);
            });
        }
    });
}).on('error', err => console.error(err));
