/**
 * StockCard.test.jsx
 *
 * Tests for the StockCard reusable component.
 * Learning outcome: Write unit tests for React applications and components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StockCard from '../components/StockCard.jsx';

// Mock useNavigate so tests do not need a full router stack
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ResponsiveContainer uses ResizeObserver which jsdom does not implement.
// Pass fixed dimensions so AreaChart can render its SVG without ResizeObserver.
vi.mock('recharts', async () => {
  const { cloneElement } = await import('react');
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) =>
      cloneElement(children, { width: 300, height: 150 }),
  };
});

// Minimal Alpha Vantage Global Quote shape
const makeQuote = (price, change, changePct) => ({
  '01. symbol':           'TEST',
  '05. price':            String(price),
  '06. volume':           '1000000',
  '08. previous close':   String(price - change),
  '09. change':           String(change),
  '10. change percent':   `${changePct}%`,
  '07. latest trading day': '2024-01-15',
});

const renderCard = (quote, history = [], companyName = '') =>
  render(
    <MemoryRouter>
      <StockCard
        symbol="TEST"
        quote={quote}
        history={history}
        companyName={companyName}
      />
    </MemoryRouter>
  );

describe('StockCard', () => {
  it('renders the ticker symbol', () => {
    renderCard(makeQuote(150, 2, 1.35));
    expect(screen.getByText('TEST')).toBeInTheDocument();
  });

  it('renders the current price formatted to 2 decimal places', () => {
    renderCard(makeQuote(150.5, 2, 1.35));
    expect(screen.getByText('$150.50')).toBeInTheDocument();
  });

  it('shows a positive change with a + prefix', () => {
    renderCard(makeQuote(150, 2.5, 1.69));
    expect(screen.getByText(/\+2\.50/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.69%/)).toBeInTheDocument();
  });

  it('shows a negative change without a + prefix', () => {
    renderCard(makeQuote(148, -3, -1.99));
    expect(screen.getByText(/-3\.00/)).toBeInTheDocument();
    expect(screen.getByText(/-1\.99%/)).toBeInTheDocument();
  });

  it('renders the company name when provided', () => {
    renderCard(makeQuote(150, 1, 0.5), [], 'Test Corp Inc.');
    expect(screen.getByText('Test Corp Inc.')).toBeInTheDocument();
  });

  it('navigates to the stock detail page when clicked', () => {
    renderCard(makeQuote(150, 1, 0.5));
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/stock/TEST');
  });

  it('navigates when Enter key is pressed', () => {
    mockNavigate.mockClear();
    renderCard(makeQuote(150, 1, 0.5));
    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/stock/TEST');
  });

  it('returns null when no quote is provided', () => {
    const { container } = renderCard(null);
    expect(container.firstChild).toBeNull();
  });

  it('does not render a sparkline when history array is empty', () => {
    const { container } = renderCard(makeQuote(150, 1, 0.5), []);
    // recharts svg is absent when sparkData.length <= 1
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('renders a sparkline when history data is provided', () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      date:  `2024-01-${String(i + 1).padStart(2, '0')}`,
      close: 145 + i,
    }));
    const { container } = renderCard(makeQuote(158, 1, 0.5), history);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('has an accessible aria-label', () => {
    renderCard(makeQuote(150, 1, 0.5));
    expect(
      screen.getByRole('button', { name: /View details for TEST/i })
    ).toBeInTheDocument();
  });
});
