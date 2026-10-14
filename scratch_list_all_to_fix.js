const fs = require('fs');

const canaisContent = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = canaisContent.split('\n');

const brokenDomains = [
    'www.fontedecanais.gs',
    'www.fontedecanais.me',
    'www.fontedecanais.org',
    'www.fontedecanais.dev',
    'www.fontedecanais.tv',
    '97j91.xyz',
    'xvbroker.click',
    'i0.wp.com',
    'storage.googleapis.com'
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

const channelsToFix = [];

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        const m = ext.match(/tvg-logo="([^"]*)"/);
        const logo = m ? m[1].trim() : '';
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        const groupMatch = ext.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1].trim() : '';

        let isBroken = false;
        if (!logo) isBroken = true;
        else if (brokenDomains.some(d => logo.includes(d))) isBroken = true;
        else if (deadLogodownloadUrls.includes(logo)) isBroken = true;

        if (isBroken) {
            channelsToFix.push({ index: i, name, group, currentLogo: logo });
        }
    }
}

console.log('Total de canais para corrigir logo:', channelsToFix.length);
channelsToFix.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.group}] "${c.name}" -> ${c.currentLogo ? c.currentLogo : '(VAZIO)'}`);
});
