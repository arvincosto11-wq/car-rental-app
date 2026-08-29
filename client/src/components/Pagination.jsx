import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

// Simple prev/next pagination control shared across admin tables.
const Pagination = ({ page, totalPages, onPageChange, isDark }) => {
  if (totalPages <= 1) return null;

  const s = {
    row: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '18px' },
    btn: (disabled) => ({
      padding: '7px 16px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: disabled ? (isDark ? '#1e293b' : '#f9fafb') : (isDark ? GOLD_DARK : GOLD),
      color: disabled ? (isDark ? '#475569' : '#9ca3af') : ON_GOLD,
      opacity: disabled ? 0.6 : 1,
    }),
    label: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', fontVariantNumeric: 'tabular-nums' },
  };

  return (
    <div style={s.row}>
      <button type="button" style={s.btn(page <= 1)} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ‹ Prev
      </button>
      <span style={s.label}>Page {page} of {totalPages}</span>
      <button type="button" style={s.btn(page >= totalPages)} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next ›
      </button>
    </div>
  );
};

export default Pagination;
