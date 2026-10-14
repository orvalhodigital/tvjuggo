const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'logos');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const list = [
  { name: 'espn.png', url: 'http://logos.appscms.xyz/logos/2025/espn.png' },
  { name: 'espn2.png', url: 'http://logos.appscms.xyz/logos/2025/espn2.png' },
  { name: 'espn3.png', url: 'http://logos.appscms.xyz/logos/2025/espn3.png' },
  { name: 'espn4.png', url: 'http://logos.appscms.xyz/logos/2025/espn4.png' },
  { name: 'espn5.png', url: 'http://logos.appscms.xyz/logos/2025/espn5.png' },
  { name: 'espn6.png', url: 'http://logos.appscms.xyz/logos/2025/espn6.png' },
  { name: 'globo.png', url: 'http://logos.appscms.xyz/logos/2025/globo.png' },
  { name: 'record.png', url: 'http://logos.appscms.xyz/logos/2025/record.png' }
];

function download(item) {
  return new Promise((resolve) => {
    const dest = path.join(dir, item.name);
    const mod = item.url.startsWith('https') ? https : http;
    const req = mod.get(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 200) {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          const sz = fs.statSync(dest).size;
          console.log(`Downloaded ${item.name} (${sz} bytes)`);
          resolve(true);
        });
      } else {
        console.log(`Failed ${item.name}: ${res.statusCode}`);
        resolve(false);
      }
    });
    req.on('error', (e) => {
      console.log(`Error ${item.name}: ${e.message}`);
      resolve(false);
    });
  });
}

(async () => {
  for (const item of list) {
    await download(item);
  }
})();
