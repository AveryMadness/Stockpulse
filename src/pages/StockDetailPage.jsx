import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import NewsCard from '../components/NewsCard.jsx';
import { useApp } from '../context/AppContext.jsx';
import {
  getQuote,
  getHistoricalData,
  getNews,
  formatQuote,
} from '../services/stockApi.js';
import socketService from '../services/socketService.js';
import styles from './StockDetailPage.module.css';

export default function StockDetailPage() {
  const { symbol } = useParams();
  const upperSymbol = symbol.toUpperCase();
  const {
    username,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    portfolio,
    addToPortfolio,
    removeFromPortfolio,
  } = useApp();

  // Stock data
  const [quote,   setQuote]   = useState(null);
  const [history, setHistory] = useState([]);
  const [news,    setNews]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Portfolio modal
  const [showModal, setShowModal] = useState(false);
  const [shares,    setShares]    = useState(1);

  // Chat
  const [messages,  setMessages]  = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [userCount, setUserCount] = useState(1);
  const chatEndRef = useRef(null);

  const formatted    = formatQuote(quote);
  const inWatchlist  = isInWatchlist(upperSymbol);
  const inPortfolio  = !!portfolio[upperSymbol];
  const isPositive   = formatted ? formatted.change >= 0 : true;

  // load stock data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [q, h, n] = await Promise.all([
          getQuote(upperSymbol),
          getHistoricalData(upperSymbol),
          getNews(upperSymbol),
        ]);
        if (cancelled) return;
        setQuote(q);
        setHistory(h);
        setNews(n);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [upperSymbol]);

  // chat socket
  useEffect(() => {
    const roomId = `stock-${upperSymbol}`;
    socketService.connect();
    socketService.joinRoom(roomId, username);

    const offHistory = socketService.onRoomHistory((msgs) => setMessages(msgs));
    const offMsg     = socketService.onMessage((msg) =>
      setMessages((prev) => [...prev, msg])
    );
    const offJoined  = socketService.onUserJoined(({ userCount: c }) =>
      setUserCount(c)
    );
    const offLeft    = socketService.onUserLeft(({ userCount: c }) =>
      setUserCount(c)
    );

    return () => {
      socketService.leaveRoom(roomId, username);
      offHistory();
      offMsg();
      offJoined();
      offLeft();
    };
  }, [upperSymbol, username]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // handlers
  const handleWatchlist = () => {
    inWatchlist
      ? removeFromWatchlist(upperSymbol)
      : addToWatchlist(upperSymbol);
  };

  const handleAddToPortfolio = () => {
    addToPortfolio(upperSymbol, shares);
    setShowModal(false);
    setShares(1);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const msg = {
      username,
      text,
      type: 'text',
      timestamp: new Date().toISOString(),
    };
    socketService.sendMessage(`stock-${upperSymbol}`, msg);
    setChatInput('');
  };

  // custom tooltip for the price chart
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipDate}>{label}</div>
        <div className={styles.tooltipPrice}>
          ${payload[0].value.toFixed(2)}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <main className="page-container">
        <p className={styles.notice}>Loading {upperSymbol}…</p>
      </main>
    );
  }

  if (error || !formatted) {
    return (
      <main className="page-container">
        <p className={styles.error}>
          Failed to load {upperSymbol}: {error}. Check your API key.
        </p>
        <Link to="/" className="btn" style={{ marginTop: 12 }}>← Back</Link>
      </main>
    );
  }

  return (
    <main className="page-container">
      <nav className={styles.breadcrumb} aria-label="breadcrumb">
        <Link to="/">Home</Link>
        <span>›</span>
        <span>{upperSymbol}</span>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.symbol}>{upperSymbol}</h1>
          <p className={styles.price}>
            ${formatted.price.toFixed(2)}
            <span
              className={
                isPositive ? styles.changePos : styles.changeNeg
              }
            >
              {isPositive ? '+' : ''}
              {formatted.change.toFixed(2)} ({isPositive ? '+' : ''}
              {formatted.changePct.toFixed(2)}%)
            </span>
          </p>
          <p className={styles.meta}>
            Volume: {Number(formatted.volume).toLocaleString()} ·
            Prev. close: ${formatted.prevClose.toFixed(2)} ·
            {formatted.latestDay}
          </p>
        </div>

        <div className={styles.actions}>
          <button
            className={`btn ${inWatchlist ? styles.watchlisted : ''}`}
            onClick={handleWatchlist}
            aria-pressed={inWatchlist}
          >
            {inWatchlist ? '★ Watchlisted' : '☆ Add to Watchlist'}
          </button>

          {inPortfolio ? (
            <button
              className="btn btn-danger"
              onClick={() => removeFromPortfolio(upperSymbol)}
            >
              Remove from Portfolio
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
            >
              + Add to Portfolio
            </button>
          )}
        </div>
      </header>

      <div className={styles.layout}>
        <div>
          {/* Historical price chart */}
          <section className="card" aria-labelledby="chart-heading">
            <h2 id="chart-heading" className={styles.sectionTitle}>
              Historical Performance (30 Days)
            </h2>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={history}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={isPositive ? '#3fb950' : '#f85149'}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={isPositive ? '#3fb950' : '#f85149'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#30363d"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#8b949e', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: '#8b949e', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                    domain={['auto', 'auto']}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={isPositive ? '#3fb950' : '#f85149'}
                    strokeWidth={2}
                    fill="url(#priceGrad)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className={styles.notice}>No historical data available.</p>
            )}
          </section>

          {/* Related news */}
          <section
            aria-labelledby="news-heading"
            style={{ marginTop: 20 }}
          >
            <h2 id="news-heading" className={styles.sectionTitle}>
              Related News
            </h2>
            {news.length === 0 ? (
              <p className={styles.notice}>No news found for {upperSymbol}.</p>
            ) : (
              <div className={styles.newsList}>
                {news.map((article, i) => (
                  <NewsCard
                    key={article.url || i}
                    article={article}
                    priority={article.isBreaking}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <section className={styles.chatBox} aria-labelledby="chat-heading">
            <h2 id="chat-heading" className={styles.chatTitle}>
              #{upperSymbol} Chat
              <span className={styles.userCount}>{userCount} online</span>
            </h2>

            {/* Message list */}
            <div className={styles.messages} role="log" aria-live="polite">
              {messages.length === 0 && (
                <p className={styles.chatEmpty}>
                  No messages yet. Start the conversation!
                </p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={msg.id || i}
                  className={
                    msg.username === username
                      ? `${styles.message} ${styles.messageSelf}`
                      : styles.message
                  }
                >
                  <span className={styles.msgUser}>{msg.username}</span>
                  <span className={styles.msgText}>{msg.text}</span>
                  <span className={styles.msgTime}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className={styles.chatForm}>
              <input
                type="text"
                className={styles.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Message #${upperSymbol}…`}
                aria-label="Chat message"
                maxLength={500}
              />
              <button type="submit" className="btn btn-primary">
                Send
              </button>
            </form>
          </section>
        </aside>
      </div>

      {showModal && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className={styles.modal}>
            <h3 id="modal-title" className={styles.modalTitle}>
              Add {upperSymbol} to Portfolio
            </h3>
            <label className={styles.modalLabel} htmlFor="shares-input">
              Number of shares
            </label>
            <input
              id="shares-input"
              type="number"
              min="1"
              value={shares}
              onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
              className={styles.modalInput}
            />
            {formatted && (
              <p className={styles.modalCost}>
                Estimated value:{' '}
                <strong>${(formatted.price * shares).toFixed(2)}</strong>
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                className="btn"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddToPortfolio}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
