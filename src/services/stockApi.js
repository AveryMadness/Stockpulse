const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY  = import.meta.env.VITE_FINNHUB_KEY || '';

export const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN',
  'TSLA', 'NVDA', 'META',  'JPM',
];

const _cache = new Map();
const CACHE_TTL_MS = 60_000;

async function cachedFetch(url) {
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  _cache.set(url, { data, ts: Date.now() });
  return data;
}

function qs(params) {
  return new URLSearchParams({ ...params, token: API_KEY }).toString();
}

export async function searchStocks(query) {
  if (!query) return [];
  const data = await cachedFetch(`${BASE_URL}/search?${qs({ q: query })}`);

  // Normalize to the shape SearchBar expects: { '1. symbol', '2. name', '3. type', '4. region' }
  return (data.result || []).slice(0, 6).map((r) => ({
    '1. symbol': r.symbol,
    '2. name':   r.description,
    '3. type':   r.type,
    '4. region': r.displaySymbol,
  }));
}

export async function getQuote(symbol) {
  const data = await cachedFetch(`${BASE_URL}/quote?${qs({ symbol })}`);

  if (!data || data.c === 0) return null;

  // Return an object shaped like Alpha Vantage's "Global Quote" so formatQuote() works unchanged.
  return {
    '01. symbol':             symbol,
    '05. price':              String(data.c),
    '06. volume':             '—',
    '08. previous close':     String(data.pc),
    '09. change':             String(data.d),
    '10. change percent':     String(data.dp),
    '07. latest trading day': new Date(data.t * 1000).toISOString().slice(0, 10),
  };
}

// Finnhub's free tier does not include /stock/candle, so we simulate 30 days from the current quote.
export async function getHistoricalData(symbol) {
  const quote = await getQuote(symbol);
  const currentPrice = quote ? parseFloat(quote['05. price']) : 100;

  const days = 30;
  const result = [];
  let price = currentPrice * (1 - (Math.random() * 0.15));

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = price * (Math.random() * 0.04 - 0.018);
    const open   = price;
    const close  = Math.max(price + change, 0.01);
    const high   = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low    = Math.min(open, close) * (1 - Math.random() * 0.01);

    result.push({
      date:   date.toISOString().slice(0, 10),
      open:   parseFloat(open.toFixed(2)),
      high:   parseFloat(high.toFixed(2)),
      low:    parseFloat(low.toFixed(2)),
      close:  parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 50_000_000 + 5_000_000),
    });

    price = close;
  }

  return result;
}

export async function getNews(symbol) {
  const to   = todayStr();
  const from = daysAgoStr(7);

  const data = await cachedFetch(
    `${BASE_URL}/company-news?${qs({ symbol, from, to })}`
  );

  return (Array.isArray(data) ? data : [])
    .slice(0, 10)
    .map(normaliseFinnhubArticle);
}

export async function getMarketNews() {
  const data = await cachedFetch(
    `${BASE_URL}/news?${qs({ category: 'general' })}`
  );

  const TWO_HOURS   = 2 * 60 * 60 * 1000;
  const urgentWords = /breaking|alert|crash|surge|plunge|halt|emergency/i;

  return (Array.isArray(data) ? data : [])
    .slice(0, 20)
    .map((article) => {
      const norm        = normaliseFinnhubArticle(article);
      const publishedMs = article.datetime * 1000;
      norm.isBreaking   =
        Date.now() - publishedMs < TWO_HOURS && urgentWords.test(norm.title);
      return norm;
    });
}

export async function getPopularStocks() {
  const results = await Promise.allSettled(
    POPULAR_TICKERS.map((sym) => getQuote(sym))
  );
  return POPULAR_TICKERS.map((symbol, i) => ({
    symbol,
    quote: results[i].status === 'fulfilled' ? results[i].value : null,
  })).filter((s) => s.quote && s.quote['05. price']);
}

export function formatQuote(quote) {
  if (!quote) return null;
  const price  = parseFloat(quote['05. price']  || 0);
  const change = parseFloat(quote['09. change'] || 0);
  // Finnhub dp is a plain number; Alpha Vantage sent "1.23%" so we strip the % here
  const rawPct    = quote['10. change percent'] || '0';
  const changePct = parseFloat(String(rawPct).replace('%', ''));
  return {
    symbol:    quote['01. symbol'],
    price,
    change,
    changePct,
    volume:    quote['06. volume'],
    prevClose: parseFloat(quote['08. previous close'] || 0),
    latestDay: quote['07. latest trading day'],
  };
}

function normaliseFinnhubArticle(article) {
  const d   = new Date(article.datetime * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const time_published =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  return {
    title:        article.headline,
    url:          article.url,
    source:       article.source,
    summary:      article.summary,
    banner_image: article.image || null,
    time_published,
    isBreaking:   false,
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
