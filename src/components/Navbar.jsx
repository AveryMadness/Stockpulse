import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import styles from './Navbar.module.css';

export default function Navbar() {
  const location = useLocation();
  const { watchlist, portfolio } = useApp();

  const navLinks = [
    { to: '/',          label: 'Home'      },
    { to: '/watchlist', label: 'Watchlist', badge: watchlist.length },
    { to: '/portfolio', label: 'Portfolio', badge: Object.keys(portfolio).length },
    { to: '/chat',      label: 'Chat'      },
  ];

  return (
    <nav className={styles.navbar}>
      {/* Brand */}
      <Link to="/" className={styles.brand}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          aria-hidden="true"
        >
          <polyline
            points="2,16 7,10 11,13 16,6 20,9"
            stroke="#58a6ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        StockPulse
      </Link>

      {/* Nav links */}
      <ul className={styles.links}>
        {navLinks.map(({ to, label, badge }) => (
          <li key={to}>
            <Link
              to={to}
              className={
                location.pathname === to
                  ? `${styles.link} ${styles.linkActive}`
                  : styles.link
              }
            >
              {label}
              {badge > 0 && (
                <span className={styles.badge}>{badge}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
