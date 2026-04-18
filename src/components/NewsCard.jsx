import styles from './NewsCard.module.css';

/**
 * NewsCard - displays a single news article.
 *
 * Props:
 *   article    {Object}  Alpha Vantage feed item (or any object with the
 *                        same shape: title, source, url, time_published, isBreaking)
 *   priority   {boolean} When true, renders an elevated "breaking" style
 */
export default function NewsCard({ article, priority = false }) {
  if (!article) return null;

  const {
    title,
    url,
    source,
    time_published,
    isBreaking,
    summary,
    banner_image,
  } = article;

  // Format the date string (Alpha Vantage format: "20240115T143000")
  const formattedDate = formatAlphaDate(time_published);

  const cardClass = [
    styles.card,
    (isBreaking || priority) ? styles.breaking : '',
  ].join(' ');

  return (
    <article className={cardClass}>
      {/* Banner image (if available) */}
      {banner_image && (
        <img
          src={banner_image}
          alt=""
          className={styles.image}
          loading="lazy"
        />
      )}

      <div className={styles.body}>
        {/* Meta row */}
        <div className={styles.meta}>
          {(isBreaking || priority) && (
            <span className="badge-breaking">Breaking</span>
          )}
          <span className={styles.source}>{source}</span>
          <span className={styles.dot}>·</span>
          <time className={styles.time}>{formattedDate}</time>
        </div>

        {/* Title */}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.title}
        >
          {title}
        </a>

        {/* Summary excerpt */}
        {summary && (
          <p className={styles.summary}>{truncate(summary, 160)}</p>
        )}
      </div>
    </article>
  );
}

// ---------- helpers ----------

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen).trimEnd() + '…';
}

function formatAlphaDate(str = '') {
  if (!str) return '';
  // "20240115T143000" → "Jan 15, 2024 · 2:30 PM"
  try {
    const y = str.slice(0, 4), mo = str.slice(4, 6), d = str.slice(6, 8);
    const h = str.slice(9, 11), m = str.slice(11, 13);
    const date = new Date(`${y}-${mo}-${d}T${h}:${m}:00`);
    return date.toLocaleString('en-US', {
      month:  'short',
      day:    'numeric',
      year:   'numeric',
      hour:   'numeric',
      minute: '2-digit',
    });
  } catch {
    return str;
  }
}
