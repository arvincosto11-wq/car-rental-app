import { penaltyState, waiveSummary } from '../utils/penalties';

// One charge, however it currently stands: owed, partly let off, waived, or
// settled. Three charges used to be three near-identical blocks of JSX in
// ManageBookings, which is three places for them to drift — and they had
// already drifted, since damage keeps its collected flag under a different
// field name than the other two.
//
// Nothing renders when there is no charge. A zero-peso debt is not news.
const PenaltyChip = ({ booking, kind, isDark, title, onCollect, onWaive, onUndoWaive }) => {
  const p = penaltyState(booking, kind);
  if (!p?.exists) return null;

  const peso = (n) => `₱${(n || 0).toLocaleString()}`;

  const s = {
    row: { display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
    settled: {
      fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px',
      background: isDark ? 'rgba(22,163,74,0.18)' : '#dcfce7', color: isDark ? '#4ade80' : '#15803d',
    },
    waived: {
      fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px',
      background: isDark ? '#3a3b3c' : '#e5e7eb', color: isDark ? '#b0b3b8' : '#6b7280',
      // The figure it was is kept visible, struck through, because "we
      // waived it" without saying what we waived tells nobody anything.
      textDecoration: 'none',
    },
    gross: { textDecoration: 'line-through', opacity: 0.7, marginRight: '4px' },
    collect: {
      fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer',
      border: `1px solid ${isDark ? '#5a4a1a' : '#f3d98b'}`,
      background: isDark ? 'rgba(232,161,0,0.12)' : '#fff7e6',
      color: isDark ? '#e8c463' : '#8a6d1a',
    },
    link: {
      fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer',
      border: 'none', background: 'transparent',
      color: isDark ? '#8a8d91' : '#6b7280', textDecoration: 'underline',
    },
  };

  if (p.settled) {
    return (
      <span style={s.row}>
        <span style={s.settled}>{peso(p.payable)} {p.noun} settled</span>
      </span>
    );
  }

  if (p.waivedFully) {
    return (
      <span style={s.row}>
        <span style={s.waived} title={p.waivedNote || undefined}>
          <span style={s.gross}>{peso(p.gross)}</span>
          {p.noun} {waiveSummary(p)}
        </span>
        {onUndoWaive && <button type="button" style={s.link} onClick={() => onUndoWaive(booking, kind)}>Undo</button>}
      </span>
    );
  }

  return (
    <span style={s.row}>
      <button type="button" style={s.collect} onClick={() => onCollect(booking, kind)} title={title}>
        Collect {peso(p.payable)} {p.noun}
      </button>
      {p.waivedPartly && (
        <span style={s.waived} title={p.waivedNote || undefined}>{waiveSummary(p)}</span>
      )}
      {p.waivedPartly
        ? onUndoWaive && <button type="button" style={s.link} onClick={() => onUndoWaive(booking, kind)}>Undo</button>
        : onWaive && <button type="button" style={s.link} onClick={() => onWaive(booking, kind)}>Waive</button>}
    </span>
  );
};

export default PenaltyChip;
