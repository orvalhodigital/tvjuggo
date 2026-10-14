const http = require('http');

const testUrl = 'http://dbonline.tech-cdn.top:80/movie/ke-vin-0928392083/PZjF6XATTZ/124.mp4';

function fetchStream(url, depth = 0) {
  if (depth > 5) return console.log('Muitos redirects');
  const u = new URL(url);
  http.get(url, {
    headers: {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      'Range': 'bytes=0-1048576' // 1MB
    }
  }, res => {
    console.log(`[Depth ${depth}] Status: ${res.statusCode} from ${u.host}`);
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log(' -> Redirect to:', res.headers.location);
      fetchStream(res.headers.location, depth + 1);
    } else {
      console.log('Headers finais:', res.headers['content-type'], res.headers['content-range'], res.headers['content-length']);
      let bytes = 0;
      res.on('data', c => bytes += c.length);
      res.on('end', () => console.log('Sucesso! Baixados:', bytes, 'bytes de vídeo MP4!'));
    }
  }).on('error', e => console.log('Erro:', e.message));
}

fetchStream(testUrl);
