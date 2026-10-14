const http = require('http');

const list = [
  'telecine-premium',
  'hbo',
  'premiere-clubes',
  'sportv',
  'espn',
  'combate',
  'discovery-channel',
  'warner-channel'
];

function checkChannel(id) {
  return new Promise(resolve => {
    const req = http.get('http://localhost:3000/stream/' + id + '.m3u8?q=HD', res => {
      let d = '';
      res.on('data', c => { if (d.length < 300) d += c; });
      res.on('end', () => {
        const hasExt = d.includes('#EXTM3U');
        console.log('[STATUS ' + res.statusCode + '] ' + id + ' => HLS válido: ' + hasExt + ' (' + d.length + ' bytes lidos)');
        resolve({ id, status: res.statusCode, valid: hasExt });
      });
    });
    req.on('error', e => {
      console.log('ERR ' + id + ': ' + e.message);
      resolve({ id, status: 'ERR' });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      console.log('TIMEOUT ' + id);
      resolve({ id, status: 'TIMEOUT' });
    });
  });
}

(async () => {
  console.log('Testando streams HLS dos canais pagos via proxy...');
  for (const id of list) {
    await checkChannel(id);
  }
})();
