import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStocks } from '../services/stockApi.js';
import styles from './SearchBar.module.css';

export default function SearchBar() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const navigate  = useNavigate();
  const timerRef  = useRef(null);
  const wrapRef   = useRef(null);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const matches = await searchStocks(query);
        setResults(matches.slice(0, 6));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (symbol) => {
    setQuery('');
    setOpen(false);
    navigate(`/stock/${symbol}`);
  };

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <div className={styles.inputRow}>
        {/* Search icon */}
        <svg
          className={styles.icon}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <input
          type="text"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stocks by name or ticker…"
          aria-label="Search stocks"
          aria-autocomplete="list"
          aria-expanded={open}
        />

        {loading && <span className={styles.spinner} aria-label="Loading" />}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul className={styles.dropdown} role="listbox">
          {results.map((match) => {
            const symbol = match['1. symbol'];
            const name   = match['2. name'];
            const type   = match['3. type'];
            const region = match['4. region'];
            return (
              <li
                key={symbol}
                role="option"
                className={styles.option}
                onClick={() => handleSelect(symbol)}
                onKeyDown={(e) => e.key === 'Enter' && handleSelect(symbol)}
                tabIndex={0}
              >
                <div className={styles.optionLeft}>
                  <span className={styles.optionSymbol}>{symbol}</span>
                  <span className={styles.optionName}>{name}</span>
                </div>
                <span className={styles.optionMeta}>{type} · {region}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
