import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getQuote, formatQuote, POPULAR_TICKERS } from '../services/stockApi.js';
import styles from './PortfolioPage.module.css';

export default function PortfolioPage() {
  const { portfolio, addToPortfolio, removeFromPortfolio, updateShares } = useApp();
  const navigate = useNavigate();
  const tickers  = Object.keys(portfolio);

  // Live quotes for held stocks
  const [quotes,  setQuotes]  = useState({});
  const [loading, setLoading] = useState(false);

  // Add-stock form
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [addSymbol,    setAddSymbol]    = useState('');
  const [addShares,    setAddShares]    = useState(1);
  const [addError,     setAddError]     = useState('');

  // Edit shares inline
  const [editingSymbol, setEditingSymbol] = useState(null);
  const [editShares,    setEditShares]    = useState(1);

  // fetch quotes for held tickers
  useEffect(() => {
    if (tickers.length === 0) return;
    let cancelled = false;
    setLoading(true);

    async function fetchAll() {
      const results = await Promise.allSettled(
        tickers.map((sym) => getQuote(sym))
      );
      if (cancelled) return;
      const map = {};
      tickers.forEach((sym, i) => {
        if (results[i].status === 'fulfilled') {
          map[sym] = formatQuote(results[i].value);
        }
      });
      setQuotes(map);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [tickers.join(',')]);    // eslint-disable-line react-hooks/exhaustive-deps

  // total portfolio value
  const totalValue = tickers.reduce((sum, sym) => {
    const q = quotes[sym];
    return sum + (q ? q.price * portfolio[sym].shares : 0);
  }, 0);

  // handlers
  const handleAdd = async () => {
    setAddError('');
    const sym = addSymbol.trim().toUpperCase();
    if (!sym) { setAddError('Please enter a ticker symbol.'); return; }
    if (addShares < 1) { setAddError('Shares must be at least 1.'); return; }

    try {
      const raw = await getQuote(sym);
      if (!raw || !raw['05. price']) {
        setAddError(`Symbol "${sym}" not found. Check the ticker and try again.`);
        return;
      }
      addToPortfolio(sym, addShares);
      setShowAddForm(false);
      setAddSymbol('');
      setAddShares(1);
    } catch {
      setAddError('Failed to look up symbol. Check your API key.');
    }
  };

  const startEdit = (symbol) => {
    setEditingSymbol(symbol);
    setEditShares(portfolio[symbol].shares);
  };

  const confirmEdit = () => {
    updateShares(editingSymbol, editShares);
    setEditingSymbol(null);
  };

  return (
    <main className="page-container">
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Portfolio</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm((v) => !v)}
          aria-expanded={showAddForm}
        >
          {showAddForm ? '✕ Cancel' : '+ Add Stock'}
        </button>
      </div>

      {tickers.length > 0 && (
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Value</span>
            <span className={styles.summaryValue}>
              ${totalValue.toFixed(2)}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Holdings</span>
            <span className={styles.summaryValue}>{tickers.length} stocks</span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Total Shares</span>
            <span className={styles.summaryValue}>
              {tickers.reduce((s, sym) => s + portfolio[sym].shares, 0)}
            </span>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className={styles.addForm}>
          <h3 className={styles.addTitle}>Add a stock to your portfolio</h3>
          <div className={styles.addRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="sym-input" className={styles.label}>
                Ticker symbol
              </label>
              <input
                id="sym-input"
                type="text"
                className={styles.input}
                value={addSymbol}
                onChange={(e) =>
                  setAddSymbol(e.target.value.toUpperCase())
                }
                placeholder="e.g. AAPL"
                list="popular-tickers"
                maxLength={10}
              />
              <datalist id="popular-tickers">
                {POPULAR_TICKERS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="shares-input" className={styles.label}>
                Shares
              </label>
              <input
                id="shares-input"
                type="number"
                min="1"
                className={styles.input}
                value={addShares}
                onChange={(e) =>
                  setAddShares(Math.max(1, parseInt(e.target.value) || 1))
                }
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ alignSelf: 'flex-end' }}
              onClick={handleAdd}
            >
              Add
            </button>
          </div>
          {addError && <p className={styles.addError}>{addError}</p>}
        </div>
      )}

      {tickers.length === 0 ? (
        <div className={styles.empty}>
          <p>Your portfolio is empty.</p>
          <p>
            Click <strong>+ Add Stock</strong> above, or visit a{' '}
            <Link to="/">stock's detail page</Link> and add it from there.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          {loading && (
            <p className={styles.notice}>Refreshing prices…</p>
          )}

          {/* Header row */}
          <div className={styles.tableRow}>
            {['Symbol', 'Price', 'Change %', 'Shares', 'Value', 'P/L Day', ''].map(
              (h) => (
                <span key={h} className={`${styles.cell} ${styles.headerCell}`}>
                  {h}
                </span>
              )
            )}
          </div>

          {tickers.map((symbol) => {
            const q      = quotes[symbol];
            const shares = portfolio[symbol].shares;
            const value  = q ? q.price * shares : null;
            const plDay  = q ? q.change * shares : null;
            const isPos  = q ? q.change >= 0 : null;

            return (
              <div
                key={symbol}
                className={styles.tableRow}
                onClick={() => navigate(`/stock/${symbol}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === 'Enter' && navigate(`/stock/${symbol}`)
                }
                aria-label={`View ${symbol} details`}
              >
                {/* Symbol */}
                <span className={`${styles.cell} ${styles.symCell}`}>
                  {symbol}
                </span>

                {/* Price */}
                <span className={`${styles.cell} ${styles.mono}`}>
                  {q ? `$${q.price.toFixed(2)}` : '—'}
                </span>

                {/* Change % */}
                <span
                  className={`${styles.cell} ${styles.mono} ${
                    isPos === null ? '' : isPos ? styles.pos : styles.neg
                  }`}
                >
                  {q
                    ? `${isPos ? '+' : ''}${q.changePct.toFixed(2)}%`
                    : '—'}
                </span>

                {/* Shares (inline edit) */}
                <span className={styles.cell} onClick={(e) => e.stopPropagation()}>
                  {editingSymbol === symbol ? (
                    <span className={styles.editRow}>
                      <input
                        type="number"
                        min="0"
                        value={editShares}
                        onChange={(e) =>
                          setEditShares(parseInt(e.target.value) || 0)
                        }
                        className={styles.editInput}
                        autoFocus
                      />
                      <button
                        className="btn"
                        style={{ padding: '3px 8px', fontSize: 12 }}
                        onClick={confirmEdit}
                      >
                        ✓
                      </button>
                    </span>
                  ) : (
                    <span
                      className={styles.editableShares}
                      onClick={() => startEdit(symbol)}
                      title="Click to edit shares"
                    >
                      {shares} ✎
                    </span>
                  )}
                </span>

                {/* Value */}
                <span className={`${styles.cell} ${styles.mono}`}>
                  {value != null ? `$${value.toFixed(2)}` : '—'}
                </span>

                {/* P/L for the day */}
                <span
                  className={`${styles.cell} ${styles.mono} ${
                    plDay === null
                      ? ''
                      : plDay >= 0
                      ? styles.pos
                      : styles.neg
                  }`}
                >
                  {plDay != null
                    ? `${plDay >= 0 ? '+' : ''}$${plDay.toFixed(2)}`
                    : '—'}
                </span>

                {/* Remove */}
                <span
                  className={styles.cell}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => removeFromPortfolio(symbol)}
                    aria-label={`Remove ${symbol} from portfolio`}
                  >
                    Remove
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
