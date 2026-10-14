const fs = require('fs');

// Carregar canais com problemas de Canais de TV.m3u8
const canaisContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = canaisContent.split('\n');

const brokenDomains = [
    'www.fontedecanais.gs',
    'www.fontedecanais.me',
    'www.fontedecanais.org',
    'www.fontedecanais.dev',
    'www.fontedecanais.tv',
    '97j91.xyz',
    'xvbroker.click'
];

const deadLogodownloadUrls = [
    'https://logodownload.org/wp-content/uploads/2017/04/axn-logo.png',
    'https://logodownload.org/wp-content/uploads/2019/04/canal-brasil-logo.png',
    'https://logodownload.org/wp-content/uploads/2020/03/cinemax-logo.png',
    'https://logodownload.org/wp-content/uploads/2017/04/megapix-logo.png',
    'https://logodownload.org/wp-content/uploads/2020/04/sony-channel-logo.png',
    'https://logodownload.org/wp-content/uploads/2017/04/space-logo.png',
    'https://logodownload.org/wp-content/uploads/2016/10/tnt-logo.png'
];

const needsFix = [];

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        const m = ext.match(/tvg-logo="([^"]*)"/);
        const logo = m ? m[1].trim() : '';
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : '';

        let isBroken = false;
        if (!logo) isBroken = true;
        else if (brokenDomains.some(d => logo.includes(d))) isBroken = true;
        else if (deadLogodownloadUrls.includes(logo)) isBroken = true;

        if (isBroken) {
            needsFix.push({ lineIndex: i, name, currentLogo: logo, ext });
        }
    }
}

console.log('Total de canais que precisam de correção de logo:', needsFix.length);
console.log('Exemplos:');
needsFix.slice(0, 25).forEach(c => console.log(`- ${c.name} [logo atual: ${c.currentLogo || 'NENHUMA'}]`));
