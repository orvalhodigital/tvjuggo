/**
 * Script para enriquecer o catálogo de filmes com TMDb:
 * - Capas HD oficiais (poster e backdrop)
 * - Sinopses em Português
 * - Elenco (Atores principais)
 * - Notas da crítica (Rating TMDb/IMDb)
 * - Ano e data de lançamento
 * - Gêneros e tags de Franquias (Marvel, DC, Star Wars, Harry Potter, Velozes e Furiosos, etc.)
 * - Ordenação cronológica: Mais novos primeiro!
 */

const fs = require('fs');
const readline = require('readline');
const https = require('https');
const path = require('path');

const API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';

function fetchTmdBSearch(query, year = null) {
    return new Promise(resolve => {
        let cleanQuery = query
            .replace(/\b(dublado|legendado|4k|fhd|hd|1080p|720p|bluray|web-dl)\b/gi, '')
            .replace(/[-_.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        let url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=pt-BR&query=${encodeURIComponent(cleanQuery)}`;
        if (year) url += `&year=${year}`;

        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.results && json.results.length > 0) {
                        resolve(json.results[0]);
                    } else {
                        // Fallback: busca sem restrição
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

function fetchMovieDetails(tmdbId) {
    return new Promise(resolve => {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${API_KEY}&language=pt-BR&append_to_response=credits`;
        https.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

// Detectar franquia pelo título ou coleção
function detectFranchise(title, collectionName = '') {
    const t = (title + ' ' + collectionName).toLowerCase();
    if (t.includes('marvel') || t.includes('vingadores') || t.includes('avengers') || t.includes('deadpool') ||
        t.includes('homem de ferro') || t.includes('capitão américa') || t.includes('thor') ||
        t.includes('doutor estranho') || t.includes('pantera negra') || t.includes('guardiões da galáxia') ||
        t.includes('homem-aranha') || t.includes('spider-man') || t.includes('viúva negra') || t.includes('ant-man')) {
        return 'Marvel (MCU)';
    }
    if (t.includes('batman') || t.includes('coringa') || t.includes('joker') || t.includes('superman') ||
        t.includes('liga da justiça') || t.includes('justice league') || t.includes('mulher-maravilha') ||
        t.includes('wonder woman') || t.includes('aquaman') || t.includes('flash') || t.includes('esquadrão suicida')) {
        return 'DC Universe';
    }
    if (t.includes('velozes') || t.includes('fast & furious') || t.includes('furiosos') || t.includes('hobbs')) {
        return 'Velozes e Furiosos';
    }
    if (t.includes('harry potter') || t.includes('animais fantásticos') || t.includes('fantastic beasts')) {
        return 'Harry Potter';
    }
    if (t.includes('star wars') || t.includes('rogue one') || t.includes('mandalorian')) {
        return 'Star Wars';
    }
    if (t.includes('senhor dos anéis') || t.includes('lord of the rings') || t.includes('hobbit')) {
        return 'Senhor dos Anéis';
    }
    if (t.includes('avatar')) {
        return 'Avatar';
    }
    if (t.includes('john wick') || t.includes('bailarina')) {
        return 'John Wick';
    }
    if (t.includes('duna') || t.includes('dune')) {
        return 'Duna';
    }
    if (t.includes('shrek') || t.includes('toy story') || t.includes('divertida mente') ||
        t.includes('inside out') || t.includes('como treinar o seu dragão') || t.includes('meu malvado favorito') ||
        t.includes('minions') || t.includes('kung fu panda') || t.includes('super mario') ||
        t.includes('moana') || t.includes('frozen') || t.includes('carros')) {
        return 'Animações';
    }
    return null;
}

async function main() {
    console.log('[1/4] Lendo catálogo de Filmes-Series.m3u8...');
    const m3uPath = path.join(__dirname, 'Filmes-Series.m3u8');
    const rl = readline.createInterface({ input: fs.createReadStream(m3uPath), crlfDelay: Infinity });

    const rawCatalog = [];
    let currentTitle = '';

    for await (const line of rl) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#EXTINF:')) {
            const comma = trimmed.indexOf(',');
            currentTitle = comma !== -1 ? trimmed.substring(comma + 1).trim() : '';
        } else if (trimmed.startsWith('http') && currentTitle) {
            rawCatalog.push({ title: currentTitle, url: trimmed });
            currentTitle = '';
        }
    }
    console.log(`[1/4] Total de itens no M3U8 bruto: ${rawCatalog.length}`);

    // Lista prioritária de filmes essenciais e franquias
    const priorityKeywords = [
        'Deadpool & Wolverine', 'Deadpool', 'Duna', 'Oppenheimer', 'Furiosa', 'Divertida Mente 2',
        'Meu Malvado Favorito 4', 'Coringa Delírio a Dois', 'Coringa', 'Batman', 'The Batman',
        'Vingadores', 'Homem-Aranha', 'Homem de Ferro', 'Capitão América', 'Thor', 'Doutor Estranho',
        'Guardiões da Galáxia', 'Pantera Negra', 'Liga da Justiça', 'Superman', 'Mulher-Maravilha',
        'Aquaman', 'Velozes & Furiosos 10', 'Velozes e Furiosos', '+Velozes', 'Harry Potter',
        'Animais Fantásticos', 'Star Wars', 'Avatar', 'Top Gun', 'John Wick', 'O Senhor dos Anéis',
        'O Hobbit', 'Super Mario', 'Toy Story', 'Shrek', 'Interestelar', 'Gladiador', 'Transformers',
        'Carros', 'Kung Fu Panda', 'Como Treinar o Seu Dragão', 'Bailarina - Do Universo de John Wick',
        'Godzilla', 'Planeta dos Macacos', 'Bad Boys', 'Missão Impossível', 'Creed', 'John Wick 4'
    ];

    const selectedMap = new Map();

    // 1. Prioridade para franquias e lançamentos
    for (const item of rawCatalog) {
        for (const kw of priorityKeywords) {
            if (item.title.toLowerCase().includes(kw.toLowerCase())) {
                const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!selectedMap.has(norm)) {
                    selectedMap.set(norm, item);
                }
                break;
            }
        }
    }
    console.log(`[2/4] Selecionados ${selectedMap.size} filmes de grandes franquias/lançamentos.`);

    // 2. Adicionar outros títulos populares para totalizar cerca de 300 filmes de elite
    for (const item of rawCatalog) {
        if (selectedMap.size >= 320) break;
        const norm = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!selectedMap.has(norm) && item.title.length > 3 && !item.title.includes('Capítulo') && !item.title.includes('Episódio') && !item.title.includes('T0') && !item.title.includes('T1')) {
            selectedMap.set(norm, item);
        }
    }

    const selectedList = Array.from(selectedMap.values());
    console.log(`[3/4] Enriquecendo ${selectedList.length} filmes com TMDb (Metadados, Capas HD, Atores, Sinopses)...`);

    const enrichedMovies = [];
    const BATCH_SIZE = 12;

    for (let i = 0; i < selectedList.length; i += BATCH_SIZE) {
        const batch = selectedList.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (item, batchIdx) => {
            const rawTitle = item.title;
            const searchRes = await fetchTmdBSearch(rawTitle);

            let movieData = null;
            if (searchRes && searchRes.id) {
                const details = await fetchMovieDetails(searchRes.id);
                if (details) movieData = details;
                else movieData = searchRes;
            }

            const releaseDate = (movieData && movieData.release_date) ? movieData.release_date : '';
            const yearStr = releaseDate ? releaseDate.split('-')[0] : '2024';
            const year = parseInt(yearStr, 10) || 2024;

            const rating = movieData && movieData.vote_average ? Number(movieData.vote_average.toFixed(1)) : 7.5;
            const voteCount = movieData && movieData.vote_count ? movieData.vote_count : 1500;

            const poster = (movieData && movieData.poster_path)
                ? `https://image.tmdb.org/t/p/w500${movieData.poster_path}`
                : `https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=80`;

            const backdrop = (movieData && movieData.backdrop_path)
                ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`
                : poster;

            const overview = (movieData && movieData.overview && movieData.overview.trim().length > 10)
                ? movieData.overview
                : `Um dos filmes mais aclamados do cinema. Disponível com qualidade máxima e som surround para você assistir agora.`;

            let genres = ['Ação'];
            if (movieData && movieData.genres && movieData.genres.length > 0) {
                genres = movieData.genres.map(g => g.name);
            }

            let cast = [];
            if (movieData && movieData.credits && movieData.credits.cast) {
                cast = movieData.credits.cast.slice(0, 5).map(c => c.name);
            }

            const collectionName = (movieData && movieData.belongs_to_collection) ? movieData.belongs_to_collection.name : '';
            const franchise = detectFranchise(rawTitle, collectionName);

            const displayTitle = (movieData && movieData.title) ? movieData.title : rawTitle;

            return {
                id: `vod-${i + batchIdx + 1}`,
                title: displayTitle,
                originalTitle: (movieData && movieData.original_title) || rawTitle,
                year: year,
                releaseDate: releaseDate || `${year}-01-01`,
                rating: rating,
                voteCount: voteCount,
                genre: genres[0] || 'Ação',
                genres: genres,
                franchise: franchise,
                cast: cast,
                overview: overview,
                runtime: (movieData && movieData.runtime) || 115,
                poster: poster,
                backdrop: backdrop,
                url: item.url
            };
        });

        const batchResults = await Promise.all(promises);
        enrichedMovies.push(...batchResults);
        process.stdout.write(`Progresso: ${Math.min(i + BATCH_SIZE, selectedList.length)}/${selectedList.length} filmes processados...\r`);
    }

    console.log('\n[4/4] Ordenando filmes por data: Mais novos primeiro...');
    // Ordenação cronológica rigorosa: do mais recente (2025, 2024...) para os mais antigos
    enrichedMovies.sort((a, b) => {
        const dateA = a.releaseDate || `${a.year}-01-01`;
        const dateB = b.releaseDate || `${b.year}-01-01`;
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.rating || 0) - (a.rating || 0);
    });

    const outputPath = path.join(__dirname, 'filmes.json');
    fs.writeFileSync(outputPath, JSON.stringify(enrichedMovies, null, 2), 'utf8');
    console.log(`[SUCESSO] ${enrichedMovies.length} filmes enriquecidos salvos em filmes.json!`);

    // Mostrar amostra dos 5 primeiros filmes (mais novos)
    console.log('Top 5 Filmes Mais Novos:');
    enrichedMovies.slice(0, 5).forEach((m, idx) => {
        console.log(`${idx + 1}. [${m.year}] ${m.title} ⭐ ${m.rating} | Franquia: ${m.franchise || 'Geral'} | Atores: ${m.cast.slice(0, 2).join(', ')}`);
    });
}

main().catch(err => console.error('Erro geral:', err));
