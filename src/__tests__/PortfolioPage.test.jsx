/**
 * PortfolioPage.test.jsx
 *
 * Tests for the PortfolioPage component and portfolio context behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import PortfolioPage from '../pages/PortfolioPage.jsx';
import { AppProvider } from '../context/AppContext.jsx';
import * as AppCtx from '../context/AppContext.jsx';

// Offline mock for stock API
vi.mock('../services/stockApi.js', () => ({
  POPULAR_TICKERS: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM'],
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

// Seeder component to pre-populate the portfolio via useEffect
// (calling setState during another component's render causes act() warnings)
function PortfolioSeeder({ holdings }) {
  const { addToPortfolio } = AppCtx.useApp();
  React.useEffect(() => {
    holdings.forEach(({ symbol, shares }) => addToPortfolio(symbol, shares));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function renderWithPortfolio(holdings = []) {
  return render(
    <MemoryRouter>
      <AppProvider>
        {holdings.length > 0 && <PortfolioSeeder holdings={holdings} />}
        <PortfolioPage />
      </AppProvider>
    </MemoryRouter>
  );
}

describe('PortfolioPage - empty state', () => {
  it('shows an empty state message when portfolio is empty', () => {
    renderWithPortfolio([]);
    expect(screen.getByText(/portfolio is empty/i)).toBeInTheDocument();
  });

  it('shows a link to browse stock detail pages', () => {
    renderWithPortfolio([]);
    expect(
      screen.getByRole('link', { name: /stock's detail page/i })
    ).toBeInTheDocument();
  });
});

describe('PortfolioPage - with holdings', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('shows the Holdings count in the summary row', async () => {
    renderWithPortfolio([
      { symbol: 'AAPL', shares: 10 },
      { symbol: 'MSFT', shares: 5 },
    ]);
    await waitFor(() =>
      expect(screen.getByText('2 stocks')).toBeInTheDocument()
    );
  });

  it('displays the total number of shares', async () => {
    renderWithPortfolio([
      { symbol: 'AAPL', shares: 10 },
      { symbol: 'MSFT', shares: 5 },
    ]);
    await waitFor(() =>
      expect(screen.getByText('15')).toBeInTheDocument()
    );
  });

  it('renders a row for each holding', async () => {
    renderWithPortfolio([{ symbol: 'AAPL', shares: 7 }]);
    await waitFor(() =>
      expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)
    );
  });

  it('shows a Remove button for each holding', async () => {
    renderWithPortfolio([{ symbol: 'AAPL', shares: 10 }]);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /remove aapl/i })
      ).toBeInTheDocument()
    );
  });

  it('removes a stock from the portfolio when Remove is clicked', async () => {
    renderWithPortfolio([{ symbol: 'AAPL', shares: 10 }]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /remove aapl/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /remove aapl/i }));
    await waitFor(() =>
      expect(screen.getByText(/portfolio is empty/i)).toBeInTheDocument()
    );
  });

  it('navigates to stock detail page when a row is clicked', async () => {
    renderWithPortfolio([{ symbol: 'AAPL', shares: 5 }]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /view aapl details/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: /view aapl details/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/stock/AAPL');
  });

  it('shows the Add Stock button', () => {
    renderWithPortfolio([]);
    expect(
      screen.getByRole('button', { name: /\+ add stock/i })
    ).toBeInTheDocument();
  });

  it('toggles the add stock form when the button is clicked', () => {
    renderWithPortfolio([]);
    const addBtn = screen.getByRole('button', { name: /\+ add stock/i });
    fireEvent.click(addBtn);
    expect(screen.getByLabelText(/ticker symbol/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/shares/i)).toBeInTheDocument();
  });
});

describe('PortfolioPage - AppContext portfolio logic', () => {
  // Returns a ref whose .current always reflects the latest context value.
  // Returning ctx directly would be stale after act() triggers a re-render.
  function getCtxRef() {
    const ref = { current: null };
    function Capture() {
      ref.current = AppCtx.useApp();
      return null;
    }
    render(
      <MemoryRouter>
        <AppProvider>
          <Capture />
        </AppProvider>
      </MemoryRouter>
    );
    return ref;
  }

  it('addToPortfolio adds a new holding', async () => {
    const ctx = getCtxRef();
    await act(async () => { ctx.current.addToPortfolio('NVDA', 3); });
    expect(ctx.current.portfolio['NVDA'].shares).toBe(3);
  });

  it('addToPortfolio accumulates shares for the same symbol', async () => {
    const ctx = getCtxRef();
    await act(async () => { ctx.current.addToPortfolio('NVDA', 3); });
    await act(async () => { ctx.current.addToPortfolio('NVDA', 2); });
    expect(ctx.current.portfolio['NVDA'].shares).toBe(5);
  });

  it('removeFromPortfolio deletes a holding', async () => {
    const ctx = getCtxRef();
    await act(async () => { ctx.current.addToPortfolio('TSLA', 10); });
    await act(async () => { ctx.current.removeFromPortfolio('TSLA'); });
    expect(ctx.current.portfolio['TSLA']).toBeUndefined();
  });

  it('updateShares sets shares to a new value', async () => {
    const ctx = getCtxRef();
    await act(async () => { ctx.current.addToPortfolio('AAPL', 10); });
    await act(async () => { ctx.current.updateShares('AAPL', 20); });
    expect(ctx.current.portfolio['AAPL'].shares).toBe(20);
  });

  it('updateShares with 0 removes the holding', async () => {
    const ctx = getCtxRef();
    await act(async () => { ctx.current.addToPortfolio('AAPL', 10); });
    await act(async () => { ctx.current.updateShares('AAPL', 0); });
    expect(ctx.current.portfolio['AAPL']).toBeUndefined();
  });
});
