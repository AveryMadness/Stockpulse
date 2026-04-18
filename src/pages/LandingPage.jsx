import { useEffect, useState } from 'react';
import SearchBar from '../components/SearchBar.jsx';
import StockCard from '../components/StockCard.jsx';
import NewsCard from '../components/NewsCard.jsx';
import {
  getPopularStocks,
  getHistoricalData,
  getMarketNews,
  formatQuote,
} from '../services/stockApi.js';
import styles from './LandingPage.module.css';

export default function LandingPage() {
  const [stocks,  setStocks]  = useState([]);   // [{ symbol, quote }]
  const [history, setHistory] = useState({});   // { AAPL: [...], ... }
  const [news,    setNews]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch popular stock quotes and market news in parallel
        const [popularData, newsData] = await Promise.all([
          getPopularStocks(),
          getMarketNews(),
        ]);

        if (cancelled) return;
        setStocks(popularData);

        // Sort news: breaking articles first, then by recency
        const sorted = [...newsData].sort((a, b) => {
          if (a.isBreaking && !b.isBreaking) return -1;
          if (!a.isBreaking && b.isBreaking) return 1;
          return 0;
        });
        setNews(sorted);

        // Fetch historical sparkline data for each stock (sequentially to
        // avoid hitting rate limits on the free Alpha Vantage tier)
        const histMap = {};
        for (const { symbol } of popularData) {
          try {
            histMap[symbol] = await getHistoricalData(symbol);
          } catch {
            histMap[symbol] = [];
          }
          if (cancelled) return;
          setHistory((prev) => ({ ...prev, [symbol]: histMap[symbol] }));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="page-container">
      <header className={styles.hero}>
        <div className={styles.logoMark} aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <polyline
              points="3,26 10,16 16,21 24,10 33,15"
              stroke="#58a6ff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <h1 className={styles.appName}>StockPulse</h1>
        <p className={styles.tagline}>
          Track stocks, follow the news, chat with other investors.
        </p>

        <div className={styles.searchWrap}>
          <SearchBar />
        </div>
      </header>

      <div className={styles.layout}>
        <section aria-labelledby="popular-heading">
          <h2 id="popular-heading" className={styles.sectionTitle}>
            Popular Stocks
          </h2>

          {loading && (
            <p className={styles.notice}>Loading stocks…</p>
          )}
          {error && (
            <p className={styles.error}>
              Failed to load stocks: {error}. Check your API key in .env.
            </p>
          )}

          {!loading && !error && stocks.length === 0 && (
            <p className={styles.notice}>
              No data returned. The Alpha Vantage free tier allows 25 requests/day.
            </p>
          )}

          <div className={styles.stockGrid}>
            {stocks.map(({ symbol, quote }) => (
              <StockCard
                key={symbol}
                symbol={symbol}
                quote={quote}
                history={history[symbol] || []}
              />
            ))}
          </div>
        </section>

        <aside aria-labelledby="news-heading">
          <h2 id="news-heading" className={styles.sectionTitle}>
            Market News
          </h2>

          {loading && <p className={styles.notice}>Loading news…</p>}

          {!loading && news.length === 0 && (
            <p className={styles.notice}>No news available.</p>
          )}

          <div className={styles.newsList}>
            {news.map((article, i) => (
              <NewsCard
                key={article.url || i}
                article={article}
                priority={article.isBreaking}
              />
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
