const fs = require('fs');
const http = require('http');
const https = require('https');

const content = fs.readFileSync('Canais de TV.m3u8', 'utf8');
const lines = content.split('\n');
console.log('Header linha 1:', lines[0]);

let total = 0;
let missingLogo = 0;
let missingTvgId = 0;
const list = [];

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        total++;
        const ext = lines[i];
        const m = ext.match(/tvg-logo="([^"]*)"/);
        const logo = m ? m[1].trim() : '';
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Canal ' + total;
        const idMatch = ext.match(/tvg-id="([^"]*)"/);
        const tvgId = idMatch ? idMatch[1].trim() : '';
        const groupMatch = ext.match(/group-title="([^"]+)"/);
        const group = groupMatch ? groupMatch[1].trim() : 'Outros';

        if (!logo) missingLogo++;
        if (!tvgId) missingTvgId++;

        list.push({ index: total, name, tvgId, logo, group });
    }
}

console.log(`Total de canais: ${total}`);
console.log(`Canais sem logo (tvg-logo vazia ou ausente): ${missingLogo}`);
console.log(`Canais sem tvg-id (para EPG): ${missingTvgId}`);

// Exemplos de canais sem logo
const noLogos = list.filter(c => !c.logo);
if (noLogos.length > 0) {
    console.log('\n--- Exemplos de canais sem logo ---');
    noLogos.slice(0, 15).forEach(c => console.log(`[#${c.index}] ${c.name} (${c.group})`));
}

// Analisar domínios das logos
const logoDomains = {};
list.forEach(c => {
    if (c.logo) {
        try {
            const u = new URL(c.logo);
            logoDomains[u.hostname] = (logoDomains[u.hostname] || 0) + 1;
        } catch (e) {
            logoDomains['INVALID_URL'] = (logoDomains['INVALID_URL'] || 0) + 1;
        }
    }
});
console.log('\n--- Domínios das Logos ---', JSON.stringify(logoDomains, null, 2));
