const http = require('http');

http.get('http://localhost:3000', res => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    const lines = html.split('\n');
    lines.forEach((l, i) => {
      if (l.includes("onclick=\"selectCategory") || l.includes("onclick=\"selectChannelById")) {
        console.log(i + ': ' + l);
      }
    });
  });
});
