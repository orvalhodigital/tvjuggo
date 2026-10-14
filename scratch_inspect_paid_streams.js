const http = require('http');

async function testUrl(targetUrl) {
  console.log('\n=============================================');
  console.log('TESTANDO:', targetUrl);
  return new Promise(resolve => {
    try {
      const u = new URL(targetUrl);
      const req = http.get({
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Origin': 'http://localhost:3000',
          'Referer': 'http://localhost:3000/'
        }
      }, res => {
        console.log('STATUS:', res.statusCode);
        console.log('HEADERS:', res.headers);
        let data = '';
        res.on('data', c => { if (data.length < 1000) data += c; });
        res.on('end', () => {
          console.log('PREVIEW BODY:');
          console.log(data.slice(0, 500));
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });
      req.on('error', e => {
        console.log('ERRO:', e.message);
        resolve(null);
      });
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    } catch(e) {
      console.log('EXC:', e.message);
      resolve(null);
    }
  });
}

(async () => {
  // Teste 1: Canal de 64.31.23.207 (Telecine Premium HD)
  const r1 = await testUrl('http://64.31.23.207:80/59471019/60849037/324157.m3u8');
  
  // Teste 2: Canal de topdnstop.lat (Premiere Clubes HD)
  const r2 = await testUrl('http://topdnstop.lat:80/jajaita/123456/236244.m3u8');

  // Teste 3: Canal corruptx.org (Premiere 1 .ts)
  const r3 = await testUrl('http://corruptx.org:80/3llohwk4g9/kwf099q30o/9037.ts');
})();
