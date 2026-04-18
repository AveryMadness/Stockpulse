import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getQuote, formatQuote } from '../services/stockApi.js';
import styles from './WatchlistPage.module.css';

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist } = useApp();
  const navigate = useNavigate();

  // Map of symbol → formatted quote
  const [quotes,  setQuotes]  = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch quotes whenever the watchlist changes
  useEffect(() => {
    if (watchlist.length === 0) return;
    let cancelled = false;
    setLoading(true);

    async function fetchAll() {
      const results = await Promise.allSettled(
        watchlist.map((sym) => getQuote(sym))
      );
      if (cancelled) return;

      const map = {};
      watchlist.forEach((sym, i) => {
        if (results[i].status === 'fulfilled') {
          map[sym] = formatQuote(results[i].value);
        }
      });
      setQuotes(map);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [watchlist]);

  if (watchlist.length === 0) {
    return (
      <main className="page-container">
        <h1 className={styles.pageTitle}>Watchlist</h1>
        <div className={styles.empty}>
          <p>Your watchlist is empty.</p>
          <p>
            Browse <Link to="/">popular stocks</Link> and click "Add to
            Watchlist" on any stock's detail page.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <h1 className={styles.pageTitle}>
        Watchlist
        <span className={styles.count}>{watchlist.length} stocks</span>
      </h1>

      {loading && <p className={styles.notice}>Refreshing prices…</p>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div className={styles.row} style={{ borderTop: 'none' }}>
          <span className={`${styles.cell} ${styles.headerCell}`}>Symbol</span>
          <span className={`${styles.cell} ${styles.headerCell} ${styles.right}`}>Price</span>
          <span className={`${styles.cell} ${styles.headerCell} ${styles.right}`}>Change</span>
          <span className={`${styles.cell} ${styles.headerCell} ${styles.right}`}>Change %</span>
          <span className={`${styles.cell} ${styles.headerCell} ${styles.right}`}>Volume</span>
          <span className={`${styles.cell} ${styles.headerCell}`}></span>
        </div>

        {watchlist.map((symbol) => {
          const q = quotes[symbol];
          const isPos = q ? q.change >= 0 : null;

          return (
            <div
              key={symbol}
              className={styles.row}
              onClick={() => navigate(`/stock/${symbol}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) =>
                e.key === 'Enter' && navigate(`/stock/${symbol}`)
              }
              aria-label={`View ${symbol} details`}
            >
              {/* Symbol */}
              <span className={`${styles.cell} ${styles.symbol}`}>
                {symbol}
              </span>

              {/* Price */}
              <span className={`${styles.cell} ${styles.right} ${styles.mono}`}>
                {q ? `$${q.price.toFixed(2)}` : '—'}
              </span>

              {/* Change */}
              <span
                className={`${styles.cell} ${styles.right} ${styles.mono} ${
                  isPos === null ? '' : isPos ? styles.pos : styles.neg
                }`}
              >
                {q
                  ? `${isPos ? '+' : ''}${q.change.toFixed(2)}`
                  : '—'}
              </span>

              {/* Change % */}
              <span
                className={`${styles.cell} ${styles.right} ${styles.mono} ${
                  isPos === null ? '' : isPos ? styles.pos : styles.neg
                }`}
              >
                {q
                  ? `${isPos ? '+' : ''}${q.changePct.toFixed(2)}%`
                  : '—'}
              </span>

              {/* Volume */}
              <span
                className={`${styles.cell} ${styles.right} ${styles.mono} ${styles.muted}`}
              >
                {q ? Number(q.volume).toLocaleString() : '—'}
              </span>

              {/* Remove button */}
              <span className={`${styles.cell} ${styles.right}`}>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWatchlist(symbol);
                  }}
                  aria-label={`Remove ${symbol} from watchlist`}
                >
                  Remove
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
