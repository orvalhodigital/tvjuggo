const fs = require('fs');

const l2 = fs.readFileSync('C:/Users/otimi/.gemini/antigravity-ide/brain/c17c9841-361d-4f2d-a6cf-b2c957ff859b/scratch/oneplay_lista02.m3u', 'utf8');
const lines = l2.split('\n');

const logoDomains = {};
const channelLogos = new Map();

for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
        const ext = lines[i];
        const m = ext.match(/tvg-logo="([^"]+)"/);
        const nameMatch = ext.match(/tvg-name="([^"]+)"/) || ext.match(/,([^\r\n]+)$/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        if (m) {
            const logo = m[1];
            try {
                const u = new URL(logo);
                logoDomains[u.hostname] = (logoDomains[u.hostname] || 0) + 1;
            } catch(e) {}
            if (name) channelLogos.set(name, logo);
        }
    }
}

console.log('Logo domains in oneplay_lista02:', logoDomains);
console.log('Total unique channels with logo in lista02:', channelLogos.size);
for (const [name, logo] of Array.from(channelLogos.entries()).slice(0, 15)) {
    console.log(`- ${name} -> ${logo}`);
}
