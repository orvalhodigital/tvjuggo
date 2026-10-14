const fs = require('fs');
const path = require('path');

// 1. Atualizar Canais de TV.m3u8
const m3uPath = path.join(__dirname, 'Canais de TV.m3u8');
let m3uContent = fs.readFileSync(m3uPath, 'utf8');

// Canais abertos aprimorados com Globo SP, Globo RJ, Globo ES, Record SP, Record RJ
const oldAbertosRegex = /#EXTINF:-1 tvg-id="TVGazetaVitoria\.br" tvg-name="Globo ES"[\s\S]*?#EXTINF:-1 tvg-id="RecordTVRio\.br" tvg-name="Record RJ"[^\n]*\n[^\n]+\n/;

const newAbertos = `#EXTINF:-1 tvg-id="TVGloboSaoPaulo.br" tvg-name="Globo SP" tvg-logo="/logos/globo.png" group-title="Canais Abertos",Globo SP
http://topdnstop.lat:80/jajaita/123456/234262.m3u8
#EXTINF:-1 tvg-id="TVGloboRiodeJaneiro.br" tvg-name="Globo RJ" tvg-logo="/logos/globo.png" group-title="Canais Abertos",Globo RJ
http://topdnstop.lat:80/jajaita/123456/234244.m3u8
#EXTINF:-1 tvg-id="TVGazetaVitoria.br" tvg-name="Globo ES" tvg-logo="/logos/globo.png" group-title="Canais Abertos",Globo ES
http://topdnstop.lat:80/jajaita/123456/1601661.m3u8
#EXTINF:-1 tvg-id="RecordTVSaoPaulo.br" tvg-name="Record SP" tvg-logo="/logos/record.png" group-title="Canais Abertos",Record SP
http://topdnstop.lat:80/jajaita/123456/235932.m3u8
#EXTINF:-1 tvg-id="RecordTVRio.br" tvg-name="Record RJ" tvg-logo="/logos/record.png" group-title="Canais Abertos",Record RJ
http://topdnstop.lat:80/jajaita/123456/235899.m3u8
`;

if (oldAbertosRegex.test(m3uContent)) {
  m3uContent = m3uContent.replace(oldAbertosRegex, newAbertos);
  console.log('✅ Substituídos Globo e Record em Canais Abertos no M3U8.');
} else {
  console.log('⚠️ Padrão regex de Canais Abertos não casou exatamente, aplicando substituição manual por linhas.');
  const lines = m3uContent.split('\n');
  const newLines = [];
  let skipped = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('tvg-name="Globo ES"') && l.includes('group-title="Canais Abertos"')) {
      newLines.push(newAbertos.trim());
      i += 3; // pular Globo ES url, Record RJ extinf e url
      skipped = true;
    } else {
      newLines.push(l);
    }
  }
  if (skipped) m3uContent = newLines.join('\n');
}

// 2. Corrigir logos da ESPN em Canais de TV.m3u8
const espnReplacements = [
  { match: /tvg-name="ESPN"\s+tvg-logo="[^"]+"/, replace: 'tvg-name="ESPN" tvg-logo="/logos/espn.png"' },
  { match: /tvg-name="ESPN 2"\s+tvg-logo="[^"]+"/, replace: 'tvg-name="ESPN 2" tvg-logo="/logos/espn2.png"' },
  { match: /tvg-name="ESPN 3"\s+tvg-logo="[^"]+"/, replace: 'tvg-name="ESPN 3" tvg-logo="/logos/espn3.png"' },
  { match: /tvg-name="ESPN 4"\s+tvg-logo="[^"]+"/, replace: 'tvg-name="ESPN 4" tvg-logo="/logos/espn4.png"' },
  { match: /tvg-name="ESPN 5"\s+tvg-logo="[^"]+"/, replace: 'tvg-name="ESPN 5" tvg-logo="/logos/espn5.png"' },
  { match: /tvg-name="ESPN 6"\s+tvg-logo="[^"]+"/, replace: 'tvg-name="ESPN 6" tvg-logo="/logos/espn6.png"' }
];

espnReplacements.forEach(r => {
  m3uContent = m3uContent.replace(r.match, r.replace);
});
console.log('✅ Logos da ESPN corrigidas no M3U8.');

fs.writeFileSync(m3uPath, m3uContent, 'utf8');

// 3. Atualizar channel_qualities.json
const qualPath = path.join(__dirname, 'channel_qualities.json');
let qualities = {};
if (fs.existsSync(qualPath)) {
  qualities = JSON.parse(fs.readFileSync(qualPath, 'utf8'));
}

// Corrigir Globo e Record
qualities['globo-sp'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/234261.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/234262.m3u8',
  SD: 'http://topdnstop.lat:80/jajaita/123456/234263.m3u8'
};
qualities['globo-rj'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/234243.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/234244.m3u8',
  SD: 'http://topdnstop.lat:80/jajaita/123456/234245.m3u8'
};
qualities['globo-es'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/1601660.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/1601661.m3u8',
  SD: 'http://topdnstop.lat:80/jajaita/123456/1601662.m3u8'
};
qualities['globo'] = qualities['globo-sp'];

qualities['record-sp'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/235933.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/235932.m3u8'
};
qualities['record-rj'] = {
  FHD: 'http://topdnstop.lat:80/jajaita/123456/235900.m3u8',
  HD: 'http://topdnstop.lat:80/jajaita/123456/235899.m3u8'
};
qualities['record'] = qualities['record-sp'];

// Limpar entradas de jogos que herdaram acidentalmente 437970 / 437972
for (const k in qualities) {
  if (k.includes('fluminense') || k.includes('boca-juniors') || k.includes('coventry') || k.includes('levante')) {
    delete qualities[k];
  }
}

fs.writeFileSync(qualPath, JSON.stringify(qualities, null, 2), 'utf8');
console.log('✅ channel_qualities.json corrigido e salvo com sucesso!');
