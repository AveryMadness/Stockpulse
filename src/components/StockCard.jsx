import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { formatQuote } from '../services/stockApi.js';
import styles from './StockCard.module.css';

export default function StockCard({ symbol, quote, history = [], companyName }) {
  const navigate = useNavigate();
  const formatted = formatQuote(quote);

  if (!formatted) return null;

  const isPositive = formatted.change >= 0;
  const changeClass = isPositive ? styles.positive : styles.negative;

  const sparkData = history.slice(-14).map((d) => ({ close: d.close }));

  return (
    <div
      className={styles.card}
      onClick={() => navigate(`/stock/${symbol}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/stock/${symbol}`)}
      aria-label={`View details for ${symbol}`}
    >
      <div className={styles.header}>
        <div>
          <span className={styles.symbol}>{symbol}</span>
          {companyName && (
            <span className={styles.name}>{companyName}</span>
          )}
        </div>
        <div className={styles.priceBlock}>
          <span className={styles.price}>${formatted.price.toFixed(2)}</span>
          <span className={changeClass}>
            {isPositive ? '+' : ''}
            {formatted.change.toFixed(2)} (
            {isPositive ? '+' : ''}
            {formatted.changePct.toFixed(2)}%)
          </span>
        </div>
      </div>

      {sparkData.length > 1 && (
        <div className={styles.sparkline}>
          <ResponsiveContainer width="100%" height={48}>
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`sg-${symbol}`} x1="0" y1="0" x2="0" y2="1">
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
              <Area
                type="monotone"
                dataKey="close"
                stroke={isPositive ? '#3fb950' : '#f85149'}
                strokeWidth={1.5}
                fill={`url(#sg-${symbol})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
