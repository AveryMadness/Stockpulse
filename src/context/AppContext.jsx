import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [watchlist, setWatchlist] = useState([]);
  const [portfolio, setPortfolio] = useState({});
  // Guest username; replace with real auth in production
  const [username] = useState('Guest_' + Math.floor(Math.random() * 9000 + 1000));

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

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};

export default AppContext;
