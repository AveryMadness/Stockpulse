/**
 * stockApi.js
 *
 * All calls to the Finnhub REST API.
 * Docs: https://finnhub.io/docs/api
 *
 * Required env variable: VITE_FINNHUB_KEY
 *   Get a free key at https://finnhub.io (no credit card required)
 *
 * Free tier: 60 requests / minute, 1 year of historical data.
 * Responses are cached for 60 seconds to reduce API usage.
 */

const BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY  = import.meta.env.VITE_FINNHUB_KEY || '';

// Tickers shown on the landing page
export const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN',
  'TSLA', 'NVDA', 'META',  'JPM',
];

// ---------- Simple in-memory cache ----------
const _cache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

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

// ---------- Public API ----------

/**
 * searchStocks - symbol search.
 * @param {string} query
 * @returns {Array}  Finnhub result objects shaped like Alpha Vantage bestMatches
 *                   so the SearchBar component needs no changes.
 */
export async function searchStocks(query) {
  if (!query) return [];
  const data = await cachedFetch(`${BASE_URL}/search?${qs({ q: query })}`);

  // Normalise to the same shape the SearchBar already expects:
  // { '1. symbol', '2. name', '3. type', '4. region' }
  return (data.result || []).slice(0, 6).map((r) => ({
    '1. symbol': r.symbol,
    '2. name':   r.description,
    '3. type':   r.type,
    '4. region': r.displaySymbol,
  }));
}

/**
 * getQuote - current price and change for one symbol.
 * @param {string} symbol
 * @returns {Object|null}  Normalised into the same shape formatQuote() expects.
 */
export async function getQuote(symbol) {
  // Finnhub: GET /quote  → { c, d, dp, h, l, o, pc, t }
  const data = await cachedFetch(`${BASE_URL}/quote?${qs({ symbol })}`);

  if (!data || data.c === 0) return null;

  // Return an object shaped like Alpha Vantage's "Global Quote" so
  // formatQuote() and every page component work without changes.
  return {
    '01. symbol':            symbol,
    '05. price':             String(data.c),   // current price
    '06. volume':            '—',              // not in /quote; use candle for volume
    '08. previous close':    String(data.pc),  // previous close
    '09. change':            String(data.d),   // change
    '10. change percent':    String(data.dp),  // change %  (plain number, not "X%")
    '07. latest trading day': new Date(data.t * 1000).toISOString().slice(0, 10),
  };
}

/**
 * getHistoricalData - /stock/candle is not available on Finnhub's free tier.
 * We simulate 30 days of plausible price history from the current quote
 * so the chart renders correctly for demo purposes.
 *
 * @param {string} symbol
 * @returns {Array<{date, open, high, low, close, volume}>}
 */
export async function getHistoricalData(symbol) {
  const quote = await getQuote(symbol);
  const currentPrice = quote ? parseFloat(quote['05. price']) : 100;

  const days = 30;
  const result = [];
  let price = currentPrice * (1 - (Math.random() * 0.15)); // start ~15% lower

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = price * (Math.random() * 0.04 - 0.018); // ±2% daily
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

/**
 * getNews - news articles for a specific stock symbol.
 * Finnhub: GET /company-news?symbol=AAPL&from=YYYY-MM-DD&to=YYYY-MM-DD
 * @param {string} symbol
 * @returns {Array}  up to 10 articles normalised to the shape NewsCard expects
 */
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

/**
 * getMarketNews - general market news (no ticker filter).
 * Breaking news: articles published within the last 2 hours containing
 * urgent keywords are flagged with isBreaking = true.
 * @returns {Array}
 */
export async function getMarketNews() {
  const data = await cachedFetch(
    `${BASE_URL}/news?${qs({ category: 'general' })}`
  );

  const TWO_HOURS    = 2 * 60 * 60 * 1000;
  const urgentWords  = /breaking|alert|crash|surge|plunge|halt|emergency/i;

  return (Array.isArray(data) ? data : [])
    .slice(0, 20)
    .map((article) => {
      const norm       = normaliseFinnhubArticle(article);
      const publishedMs = article.datetime * 1000;
      norm.isBreaking  =
        Date.now() - publishedMs < TWO_HOURS && urgentWords.test(norm.title);
      return norm;
    });
}

/**
 * getPopularStocks - quotes for all POPULAR_TICKERS.
 * @returns {Array<{symbol, quote}>}
 */
export async function getPopularStocks() {
  const results = await Promise.allSettled(
    POPULAR_TICKERS.map((sym) => getQuote(sym))
  );
  return POPULAR_TICKERS.map((symbol, i) => ({
    symbol,
    quote: results[i].status === 'fulfilled' ? results[i].value : null,
  })).filter((s) => s.quote && s.quote['05. price']);
}

// ---------- Helpers ----------

/**
 * formatQuote - unchanged from the Alpha Vantage version.
 * Works identically because getQuote() returns the same shape.
 * @param {Object} quote
 * @returns {Object}
 */
export function formatQuote(quote) {
  if (!quote) return null;
  const price     = parseFloat(quote['05. price']  || 0);
  const change    = parseFloat(quote['09. change'] || 0);
  // Finnhub dp is already a plain number; Alpha Vantage sent "1.23%"
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

/**
 * normaliseFinnhubArticle - converts a Finnhub news object into the shape
 * that NewsCard already uses (matching the Alpha Vantage feed shape).
 *
 * Finnhub article keys: { id, category, datetime, headline, image,
 *                         related, source, summary, url }
 */
function normaliseFinnhubArticle(article) {
  // Convert Unix timestamp to Alpha Vantage-style string "20240115T143000"
  const d    = new Date(article.datetime * 1000);
  const pad  = (n) => String(n).padStart(2, '0');
  const time_published =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  return {
    title:          article.headline,
    url:            article.url,
    source:         article.source,
    summary:        article.summary,
    banner_image:   article.image || null,
    time_published,
    isBreaking:     false, // set by caller if needed
  };
}

/** todayStr - returns today's date as "YYYY-MM-DD" */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** daysAgoStr - returns a date N days ago as "YYYY-MM-DD" */
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}