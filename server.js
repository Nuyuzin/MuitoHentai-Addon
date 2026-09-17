const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;
const SITE = 'https://www.muitohentai.com';
const PREFIX = 'muito:';
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
};

const manifest = {
  id: 'org.muitohentai.addon',
  version: '1.0.0',
  name: 'MuitoHentai',
  description: 'Catálogo do MuitoHentai com séries, episódios separados e os players Principal e Alternativo.',
  logo: `${SITE}/arquivos/logo-muitohentai.png`,
  resources: ['catalog', 'meta', 'stream'],
  types: ['series'],
  idPrefixes: [PREFIX],
  catalogs: [
    { type: 'series', id: 'muito_latest', name: 'MuitoHentai - Lançamentos', extra: [{ name: 'skip', isRequired: false }, { name: 'search', isRequired: false }] },
    { type: 'series', id: 'muito_all', name: 'MuitoHentai - Todos', extra: [{ name: 'skip', isRequired: false }, { name: 'search', isRequired: false }] },
    { type: 'series', id: 'muito_uncensored', name: 'MuitoHentai - Sem Censura', extra: [{ name: 'skip', isRequired: false }] },
    { type: 'series', id: 'muito_harem', name: 'MuitoHentai - Harem', extra: [{ name: 'skip', isRequired: false }] },
    { type: 'series', id: 'muito_romance', name: 'MuitoHentai - Romance', extra: [{ name: 'skip', isRequired: false }] },
    { type: 'series', id: 'muito_fantasy', name: 'MuitoHentai - Fantasia', extra: [{ name: 'skip', isRequired: false }] },
    { type: 'series', id: 'muito_action', name: 'MuitoHentai - Ação', extra: [{ name: 'skip', isRequired: false }] }
  ]
};

function absolute(url) {
  if (!url) return '';
  return new URL(url, SITE).href;
}
function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
function idSlug(id) { return id.replace(/^muito:/, '').replace(/\.json$/, ''); }
function pageNumber(skip) { return Math.floor((Number(skip) || 0) / 20) + 1; }
async function getHtml(url) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.html;
  const response = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
  cache.set(url, { html: response.data, expires: Date.now() + CACHE_TTL });
  return response.data;
}
function posterFrom(card, $) {
  const img = card.find('img').first();
  return absolute(img.attr('data-src') || img.attr('src') || img.attr('data-lazy-src'));
}
function addMeta(items, slug, name, poster) {
  if (!slug || !name || items.some(x => x.id === PREFIX + slug)) return;
  items.push({ id: PREFIX + slug, type: 'series', name: clean(name), poster: poster || undefined, posterShape: 'poster' });
}
function seriesSlugFromEpisode(href) {
  const base = href.split('/').filter(Boolean).pop() || '';
  return base.replace(/-epis[oó]dio-\d+[-\w]*$/i, '').replace(/-episode-\d+[-\w]*$/i, '');
}
function parseCatalog(html, mode) {
  const $ = cheerio.load(html);
  const items = [];
  $('article.item, .item.se, .item.tvshows').each((_, el) => {
    const card = $(el);
    const info = card.find('a[href*="/info/"]').first();
    const ep = card.find('a[href*="/episodios/"]').first();
    const href = info.attr('href') || ep.attr('href');
    if (!href) return;
    let slug, name;
    if (info.attr('href')) {
      slug = info.attr('href').split('/').filter(Boolean).pop();
      name = clean(card.find('h3 a').first().text() || card.find('h3').text() || card.find('.serie').text() || info.attr('title') || info.attr('alt'));
    } else {
      slug = seriesSlugFromEpisode(ep.attr('href'));
      name = clean(card.find('.serie, .b, h3').first().text()) || clean(ep.text()).replace(/\s+epis[oó]dio\s+\d+.*$/i, '');
    }
    addMeta(items, slug, name, posterFrom(card, $));
  });
  // Fallback for unusual layouts: use info links directly.
  if (!items.length) {
    $('a[href*="/info/"]').each((_, el) => {
      const a = $(el); const href = a.attr('href');
      const slug = href.split('/').filter(Boolean).pop();
      const card = a.closest('article, .item, .poster');
      addMeta(items, slug, a.attr('title') || a.text(), posterFrom(card, $));
    });
  }
  return items.slice(0, 100);
}
function routeFor(catalog, page) {
  const p = page > 1 ? `${page}/` : '';
  return {
    muito_latest: `/ultimos-episodios-adicionados/${p}`,
    muito_all: `/hentai/${p}`,
    muito_uncensored: `/genero/hentai-sem-censura/${p}`,
    muito_harem: `/genero/harem/${p}`,
    muito_romance: `/genero/romance/${p}`,
    muito_fantasy: `/genero/fantasia/${p}`,
    muito_action: `/genero/acao/${p}`
  }[catalog] || `/hentai/${p}`;
}

app.get('/manifest.json', (_, res) => res.json(manifest));
app.get('/catalog/:type/:catalog/:extra?.json', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const catalog = req.params.catalog;
  const extra = req.params.extra ? decodeURIComponent(req.params.extra.replace(/\.json$/, '')) : '';
  const props = Object.fromEntries(extra.split('&').filter(Boolean).map(x => { const [k, ...v] = x.split('='); return [k, decodeURIComponent(v.join('=') || '')]; }));
  const page = pageNumber(props.skip);
  let url = SITE + routeFor(catalog, page);
  if (props.search) url = SITE + '/buscar/' + encodeURIComponent(props.search).replace(/%20/g, '+') + '/';
  try {
    const metas = parseCatalog(await getHtml(url), catalog);
    res.json({ metas });
  } catch (err) {
    console.error('catalog', url, err.message);
    res.json({ metas: [] });
  }
});

app.get('/meta/:type/:id.json', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const slug = idSlug(req.params.id);
  try {
    const html = await getHtml(`${SITE}/info/${slug}/`);
    const $ = cheerio.load(html);
    const name = clean($('h1').first().text().replace(/\s*[-–—]\s*(epis[oó]dios?|temporadas?).*$/i, '')) || slug.replace(/-/g, ' ');
    const poster = absolute($('meta[property="og:image"]').attr('content') || $('.poster img').first().attr('src'));
    const description = clean($('meta[name="description"]').attr('content') || $('.desc, .description, .sbox h6').first().text());
    const videos = [];
    $('#episodes a[href*="/episodios/"], article.episodes a[href*="/episodios/"]').each((i, el) => {
      const a = $(el); const href = a.attr('href'); const epSlug = href.split('/').filter(Boolean).pop();
      const text = clean(a.text());
      const m = text.match(/epis[oó]dio\s*(\d+)/i) || epSlug.match(/epis[oó]dio-(\d+)/i);
      const ep = m ? Number(m[1]) : i + 1;
      const card = a.closest('article');
      videos.push({ id: `${PREFIX}${slug}:ep:${epSlug}`, title: `Episódio ${ep}`, season: 1, episode: ep, thumbnail: posterFrom(card, $) || poster, released: new Date().toISOString(), overview: text });
    });
    const unique = [...new Map(videos.map(v => [v.id, v])).values()].sort((a,b) => a.episode - b.episode);
    res.json({ meta: { id: PREFIX + slug, type: 'series', name, poster, posterShape: 'poster', description, videos: unique } });
  } catch (err) {
    console.error('meta', slug, err.message);
    res.status(404).json({ error: 'Título não encontrado' });
  }
});

// Proxy de mídia para o player alternativo. O endpoint original exige Referer
// e responde com redirect para um MP4; o proxy preserva Range para permitir
// seek e reprodução progressiva dentro do Stremio/Nuvio.
app.get('/media.mp4', async (req, res) => {
  const target = req.query.url;
  if (!target || !/^https:\/\/(?:www\.)?muitohentai\.com\/players\/p2\/p2\.php\?id=/.test(target)) {
    return res.status(400).send('URL de mídia inválida');
  }
  try {
    const headers = { ...HEADERS, Referer: `${SITE}/players/p2/` };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await axios.get(target, { headers, responseType: 'stream', timeout: 30000, maxRedirects: 5, validateStatus: s => s >= 200 && s < 400 });
    res.status(upstream.status);
    for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control']) {
      if (upstream.headers[key]) res.setHeader(key, upstream.headers[key]);
    }
    upstream.data.on('error', () => res.destroy());
    upstream.data.pipe(res);
  } catch (err) {
    console.error('media proxy', err.message);
    res.status(502).send('Não foi possível abrir a mídia do servidor alternativo');
  }
});

app.get('/stream/:type/:id.json', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const raw = req.params.id.replace(/\.json$/, '');
  const marker = ':ep:';
  const epSlug = raw.includes(marker) ? raw.split(marker).pop() : raw.split(':').pop();
  try {
    const $ = cheerio.load(await getHtml(`${SITE}/episodios/${epSlug}/`));
    const frames = $('iframe[src]').map((_, el) => absolute($(el).attr('src'))).get();
    const streams = [];
    if (frames[0]) streams.push({ name: 'Principal', title: 'Principal • Blogger (somente navegador)', externalUrl: frames[0] });
    if (frames[1]) streams.push({ name: 'Alternativo', title: 'Alternativo • MP4 direto', url: `${req.protocol}://${req.get('host')}/media.mp4?url=${encodeURIComponent(frames[1].replace('/players/p2/?padrao=', '/players/p2/p2.php?id='))}` });
    // Keeps a useful fallback if the source temporarily blocks the Render request.
    if (!streams.length) streams.push({ name: 'Site', title: 'Abrir no MuitoHentai', externalUrl: `${SITE}/episodios/${epSlug}/` });
    res.json({ streams });
  } catch (err) {
    console.error('stream', epSlug, err.message);
    res.json({ streams: [{ name: 'Site', title: 'Abrir no MuitoHentai', externalUrl: `${SITE}/episodios/${epSlug}/` }] });
  }
});

app.get('/', (_, res) => res.redirect('/manifest.json'));
app.listen(PORT, () => console.log(`MuitoHentai addon running on port ${PORT}`));
