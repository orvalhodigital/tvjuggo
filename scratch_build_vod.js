const fs = require('fs');
const readline = require('readline');

async function buildVodCatalogs() {
  const rl = readline.createInterface({ input: fs.createReadStream('Filmes-Series.m3u8'), crlfDelay: Infinity });
  const movies = [];
  const seriesMap = new Map();
  let ext = '';
  
  const genres = ['Ação', 'Comédia', 'Drama', 'Ficção Científica', 'Terror', 'Animação', 'Aventura', 'Suspense', 'Romance'];

  for await (const line of rl) {
    if (line.startsWith('#EXTINF:')) ext = line;
    else if (line.startsWith('http')) {
      const rawTitle = ext.replace('#EXTINF:-1,', '').trim();
      if (!rawTitle) continue;

      if (line.includes('/movie/')) {
        if (movies.length < 500) {
          let genre = 'Filmes';
          if (/natal|amor|paixao|casamento/i.test(rawTitle)) genre = 'Romance';
          else if (/morte|terror|assombrado|sangue|demonio|diabo/i.test(rawTitle)) genre = 'Terror';
          else if (/corrida|luta|tiro|armadilha|armas|vinganca/i.test(rawTitle)) genre = 'Ação';
          else if (/magica|animad|desenho|crianca/i.test(rawTitle)) genre = 'Animação';
          else if (/misterio|segredo|engano/i.test(rawTitle)) genre = 'Suspense';
          else {
            genre = genres[movies.length % genres.length];
          }

          movies.push({
            id: 'mov-' + (movies.length + 1),
            title: rawTitle,
            genre: genre,
            url: line.trim()
          });
        }
      } else if (line.includes('/series/')) {
        const m = rawTitle.match(/^(.*?)\s+S(\d+)E(\d+)(.*)$/i);
        if (m) {
          const sName = m[1].trim();
          const season = parseInt(m[2], 10);
          const episode = parseInt(m[3], 10);

          if (!seriesMap.has(sName) && seriesMap.size < 60) {
            seriesMap.set(sName, {
              id: 'ser-' + (seriesMap.size + 1),
              title: sName,
              genre: genres[seriesMap.size % genres.length],
              episodes: []
            });
          }

          if (seriesMap.has(sName)) {
            const ser = seriesMap.get(sName);
            if (ser.episodes.length < 40) {
              ser.episodes.push({
                season: season,
                episode: episode,
                name: 'Temp ' + season + ' Ep ' + episode,
                url: line.trim()
              });
            }
          }
        }
      }
    }
  }

  const seriesList = Array.from(seriesMap.values());
  console.log('Total movies extracted:', movies.length);
  console.log('Total series extracted:', seriesList.length);

  fs.writeFileSync('filmes.json', JSON.stringify(movies, null, 2), 'utf8');
  fs.writeFileSync('series.json', JSON.stringify(seriesList, null, 2), 'utf8');
  console.log('filmes.json and series.json created successfully!');
}

buildVodCatalogs();
