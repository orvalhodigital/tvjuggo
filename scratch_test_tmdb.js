const https = require('https');

// Testando busca de metadados e posters no TMDB (usando endpoints públicos ou scraping limpo)
async function searchMovieTmdb(query, year) {
  const apiKey = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Chave pública amplamente usada em projetos open source e players (Kodi/Stremio)
  const encoded = encodeURIComponent(query);
  let url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=pt-BR&query=${encoded}&include_adult=false`;
  if (year) url += `&year=${year}`;

  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.results && json.results.length > 0) {
            const m = json.results[0];
            resolve({
              title: m.title || m.original_title,
              originalTitle: m.original_title,
              overview: m.overview || 'Sinopse não disponível.',
              releaseDate: m.release_date,
              year: m.release_date ? m.release_date.substring(0, 4) : '',
              rating: m.vote_average ? m.vote_average.toFixed(1) : 'N/A',
              votes: m.vote_count,
              poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
              backdrop: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : null,
              tmdbId: m.id
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

(async () => {
  const testTitles = [
    'Deadpool & Wolverine',
    'Duna: Parte 2',
    'Oppenheimer',
    'Vingadores: Ultimato',
    'Batman',
    'Velozes e Furiosos 10'
  ];

  for (const t of testTitles) {
    const res = await searchMovieTmdb(t);
    console.log('\n---', t, '---');
    console.log(res);
  }
})();
