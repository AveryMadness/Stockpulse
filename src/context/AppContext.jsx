import { createContext, useContext, useState, useCallback } from 'react';

/**
 * AppContext
 *
 * Provides global state for:
 *   - watchlist  : array of ticker symbols the user is watching
 *   - portfolio  : map of symbol → { shares: number }
 *   - username   : display name used in chat rooms
 */
const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  // ---------- state ----------
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState({});
  // Simple guest username; in production this comes from auth
  const [username] = useState('Guest_' + Math.floor(Math.random() * 9000 + 1000));

  // ---------- watchlist helpers ----------

  const addToWatchlist = useCallback((symbol) => {
    setWatchlist((prev) =>
      prev.includes(symbol) ? prev : [...prev, symbol]
    );
  }, []);

  const removeFromWatchlist = useCallback((symbol) => {
    setWatchlist((prev) => prev.filter((s) => s !== symbol));
  }, []);

  const isInWatchlist = useCallback(
    (symbol) => watchlist.includes(symbol),
    [watchlist]
  );

  // ---------- portfolio helpers ----------

  const addToPortfolio = useCallback((symbol, shares) => {
    setPortfolio((prev) => ({
      ...prev,
      [symbol]: { shares: (prev[symbol]?.shares || 0) + shares },
    }));
  }, []);

  const removeFromPortfolio = useCallback((symbol) => {
    setPortfolio((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  }, []);

  const updateShares = useCallback((symbol, shares) => {
    if (shares <= 0) {
      removeFromPortfolio(symbol);
    } else {
      setPortfolio((prev) => ({ ...prev, [symbol]: { shares } }));
    }
  }, [removeFromPortfolio]);

  // ---------- context value ----------

  return (
    <AppContext.Provider
      value={{
        watchlist,
        portfolio,
        username,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        addToPortfolio,
        removeFromPortfolio,
        updateShares,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

/**
 * useApp - hook to consume AppContext.
 * Throws if used outside <AppProvider>.
 */
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};

export default AppContext;
