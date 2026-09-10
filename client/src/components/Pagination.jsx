import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

// Always includes page 1 and the last page, plus a window around the
// current page, collapsing any gaps into a single '...' entry — e.g. for
// page 7 of 20: [1, '...', 6, 7, 8, '...', 20].
const getPageNumbers = (current, total) => {
  const delta = 1;
  const range = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
      range.push(i);
    }
  }
  const withDots = [];
  let prev;
  for (const i of range) {
    if (prev !== undefined) {
      if (i - prev === 2) withDots.push(prev + 1);
      else if (i - prev !== 1) withDots.push('...');
    }
    withDots.push(i);
    prev = i;
  }
  return withDots;
};

// Numbered pagination (jump to any page directly) shared across admin
// tables and My Bookings — replaces the old plain "Page X of Y" control,
// same props so every existing usage picks this up automatically.
const Pagination = ({ page, totalPages, onPageChange, isDark }) => {
  if (totalPages <= 1) return null;

  const s = {
    row: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '18px', flexWrap: 'wrap' },
    arrowBtn: (disabled) => ({
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '34px', height: '34px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#242526' : '#fff',
      color: disabled ? (isDark ? '#4e4f50' : '#9ca3af') : (isDark ? '#e4e6eb' : '#374151'),
      opacity: disabled ? 0.6 : 1,
    }),
    pageBtn: (active) => ({
      minWidth: '34px', height: '34px', padding: '0 6px', fontSize: '13px', fontWeight: '600',
      borderRadius: '8px', cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
      border: active ? 'none' : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#242526' : '#fff'),
      color: active ? ON_GOLD : (isDark ? '#e4e6eb' : '#374151'),
    }),
    dots: { minWidth: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af' },
  };

  return (
    <div style={s.row} role="navigation" aria-label="Pagination">
      <button
        type="button"
        style={s.arrowBtn(page <= 1)}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        ‹
      </button>
      {getPageNumbers(page, totalPages).map((entry, i) =>
        entry === '...' ? (
          <span key={`dots-${i}`} style={s.dots}>…</span>
        ) : (
          <button
            key={entry}
            type="button"
            style={s.pageBtn(entry === page)}
            aria-current={entry === page ? 'page' : undefined}
            onClick={() => onPageChange(entry)}
          >
            {entry}
          </button>
        )
      )}
      <button
        type="button"
        style={s.arrowBtn(page >= totalPages)}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
};

export default Pagination;
