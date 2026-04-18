/**
 * WatchlistPage.test.jsx
 *
 * Tests for the WatchlistPage component and watchlist context behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import WatchlistPage from '../pages/WatchlistPage.jsx';
import { AppProvider } from '../context/AppContext.jsx';
import * as AppCtx from '../context/AppContext.jsx';

// Mock the stock API so tests run offline
vi.mock('../services/stockApi.js', () => ({
  getQuote: vi.fn().mockResolvedValue({
    '01. symbol':           'AAPL',
    '05. price':            '189.43',
    '06. volume':           '52300000',
    '08. previous close':   '188.20',
    '09. change':           '1.23',
    '10. change percent':   '0.65%',
    '07. latest trading day': '2024-01-15',
  }),
  formatQuote: (q) => {
    if (!q) return null;
    return {
      symbol:    q['01. symbol'],
      price:     parseFloat(q['05. price']),
      change:    parseFloat(q['09. change']),
      changePct: parseFloat(q['10. change percent']),
      volume:    q['06. volume'],
      prevClose: parseFloat(q['08. previous close']),
      latestDay: q['07. latest trading day'],
    };
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Helper: render WatchlistPage with a pre-seeded watchlist
function renderWithWatchlist(initialSymbols = []) {
  // Wrap with a custom provider that seeds the watchlist
  const Wrapper = ({ children }) => {
    // We'll use the real AppProvider but also call addToWatchlist in a child
    return (
      <MemoryRouter>
        <AppProvider>
          <WatchlistSeeder symbols={initialSymbols} />
          {children}
        </AppProvider>
      </MemoryRouter>
    );
  };

  // Small helper component that seeds the watchlist via context
  function WatchlistSeeder({ symbols }) {
    const { addToWatchlist } = AppCtx.useApp();
    React.useEffect(() => {
      symbols.forEach((s) => addToWatchlist(s));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return null;
  }

  return render(<WatchlistPage />, { wrapper: Wrapper });
}

describe('WatchlistPage - empty state', () => {
  it('shows an empty state message when watchlist is empty', () => {
    renderWithWatchlist([]);
    expect(screen.getByText(/watchlist is empty/i)).toBeInTheDocument();
  });

  it('shows a link to browse popular stocks in the empty state', () => {
    renderWithWatchlist([]);
    expect(
      screen.getByRole('link', { name: /popular stocks/i })
    ).toBeInTheDocument();
  });
});

describe('WatchlistPage - with stocks', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('displays the page title with stock count', async () => {
    renderWithWatchlist(['AAPL', 'MSFT']);
    await waitFor(() =>
      expect(screen.getByText('Watchlist')).toBeInTheDocument()
    );
    expect(screen.getByText('2 stocks')).toBeInTheDocument();
  });

  it('renders a row for each symbol in the watchlist', async () => {
    renderWithWatchlist(['AAPL', 'MSFT']);
    await waitFor(() =>
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    );
    expect(screen.getAllByText('MSFT').length).toBeGreaterThan(0);
  });

  it('shows a Remove button for each stock', async () => {
    renderWithWatchlist(['AAPL']);
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: /remove aapl/i }).length
      ).toBeGreaterThan(0)
    );
  });

  it('removes a stock when Remove is clicked', async () => {
    renderWithWatchlist(['AAPL']);
    await waitFor(() =>
      expect(screen.queryAllByText('AAPL').length).toBeGreaterThan(0)
    );
    const removeBtn = screen.getByRole('button', { name: /remove aapl/i });
    fireEvent.click(removeBtn);
    await waitFor(() =>
      expect(screen.getByText(/watchlist is empty/i)).toBeInTheDocument()
    );
  });

  it('navigates to the stock detail page when a row is clicked', async () => {
    renderWithWatchlist(['AAPL']);
    await waitFor(() =>
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    );
    const row = screen.getByRole('button', { name: /View AAPL/i });
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/stock/AAPL');
  });

  it('shows a loading notice while quotes are being fetched', async () => {
    renderWithWatchlist(['AAPL']);
    expect(screen.getByText(/refreshing prices/i)).toBeInTheDocument();
    // Drain the mocked promise so no state update escapes the test
    await waitFor(() =>
      expect(screen.queryByText(/refreshing prices/i)).not.toBeInTheDocument()
    );
  });
});

describe('WatchlistPage - AppContext integration', () => {
  it('isInWatchlist returns true for a symbol that was added', async () => {
    let contextRef;
    function Capture() {
      contextRef = AppCtx.useApp();
      return null;
    }
    render(
      <MemoryRouter>
        <AppProvider>
          <Capture />
        </AppProvider>
      </MemoryRouter>
    );
    await act(async () => { contextRef.addToWatchlist('NVDA'); });
    expect(contextRef.isInWatchlist('NVDA')).toBe(true);
  });

  it('isInWatchlist returns false after the symbol is removed', async () => {
    let contextRef;
    function Capture() {
      contextRef = AppCtx.useApp();
      return null;
    }
    render(
      <MemoryRouter>
        <AppProvider>
          <Capture />
        </AppProvider>
      </MemoryRouter>
    );
    await act(async () => { contextRef.addToWatchlist('NVDA'); });
    await act(async () => { contextRef.removeFromWatchlist('NVDA'); });
    expect(contextRef.isInWatchlist('NVDA')).toBe(false);
  });

  it('does not add duplicates to the watchlist', async () => {
    let contextRef;
    function Capture() {
      contextRef = AppCtx.useApp();
      return null;
    }
    render(
      <MemoryRouter>
        <AppProvider>
          <Capture />
        </AppProvider>
      </MemoryRouter>
    );
    await act(async () => { contextRef.addToWatchlist('TSLA'); });
    await act(async () => { contextRef.addToWatchlist('TSLA'); });
    expect(contextRef.watchlist.filter((s) => s === 'TSLA').length).toBe(1);
  });
});
