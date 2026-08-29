import { useState } from 'react';
import { GOLD, GOLD_DARK } from '../theme';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const normalize = (d) => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd.getTime();
};

const buildGrid = (year, month) => {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
};

// Small month calendar showing which dates are already booked (red) vs free
// (green) for a car, plus the client's own currently-picked range (gold
// ring), if any. When onSelectDay is given, available/future days become
// clickable so the client can pick their pickup/return dates directly on
// the grid instead of separate date inputs.
const AvailabilityCalendar = ({ bookedRanges, selectedStart, selectedEnd, onSelectDay, isDark }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const today = normalize(new Date());

  const isBooked = (date) => {
    const t = normalize(date);
    return bookedRanges.some((r) => t >= normalize(r.startDate) && t <= normalize(r.endDate));
  };
  const isSelected = (date) => {
    const t = normalize(date);
    if (selectedStart && selectedEnd) return t >= normalize(selectedStart) && t <= normalize(selectedEnd);
    if (selectedStart) return t === normalize(selectedStart);
    return false;
  };
  const isPast = (date) => normalize(date) < today;

  const grid = buildGrid(cursor.getFullYear(), cursor.getMonth());

  const s = {
    wrap: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '14px' },
    navRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    navBtn: { background: 'none', border: 'none', fontSize: '16px', color: isDark ? '#94a3b8' : '#6b7280', cursor: 'pointer', padding: '2px 8px' },
    monthLabel: { fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' },
    weekday: { textAlign: 'center', fontSize: '10px', fontWeight: '700', color: isDark ? '#64748b' : '#9ca3af', padding: '2px 0' },
    day: (inMonth, booked, selected, past, clickable) => ({
      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', borderRadius: '6px', fontWeight: selected ? '700' : '500',
      opacity: inMonth ? (past ? 0.35 : 1) : 0.25,
      background: booked ? (isDark ? 'rgba(220,38,38,0.25)' : '#fee2e2') : (isDark ? 'rgba(22,163,74,0.18)' : '#dcfce7'),
      color: booked ? (isDark ? '#fca5a5' : '#991b1b') : (isDark ? '#86efac' : '#166534'),
      boxShadow: selected ? `inset 0 0 0 2px ${isDark ? GOLD_DARK : GOLD}` : 'none',
      border: 'none', font: 'inherit',
      cursor: clickable ? 'pointer' : 'default',
      pointerEvents: clickable ? 'auto' : 'none',
    }),
    legendRow: { display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    legendDot: (bg) => ({ width: '9px', height: '9px', borderRadius: '3px', background: bg, flexShrink: 0 }),
  };

  return (
    <div style={s.wrap}>
      <div style={s.navRow}>
        <button type="button" style={s.navBtn} aria-label="Previous month" onClick={() => setCursor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}>‹</button>
        <span style={s.monthLabel}>{MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}</span>
        <button type="button" style={s.navBtn} aria-label="Next month" onClick={() => setCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}>›</button>
      </div>
      <div style={s.grid}>
        {WEEKDAY_LABELS.map((wd, i) => <div key={i} style={s.weekday}>{wd}</div>)}
        {grid.map(({ date, inMonth }, i) => {
          const booked = isBooked(date);
          const past = isPast(date);
          const clickable = !!onSelectDay && inMonth && !past && !booked;
          return (
            <button
              key={i}
              type="button"
              style={s.day(inMonth, booked, isSelected(date), past, clickable)}
              title={date.toLocaleDateString()}
              aria-label={`${date.toLocaleDateString()}${booked ? ', booked' : clickable ? ', available' : ''}`}
              tabIndex={clickable ? 0 : -1}
              onClick={clickable ? () => onSelectDay(date) : undefined}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div style={s.legendRow}>
        <span style={s.legendItem}><span style={s.legendDot(isDark ? 'rgba(22,163,74,0.4)' : '#dcfce7')} />Available</span>
        <span style={s.legendItem}><span style={s.legendDot(isDark ? 'rgba(220,38,38,0.4)' : '#fee2e2')} />Booked</span>
        {selectedStart && selectedEnd && (
          <span style={s.legendItem}><span style={{ ...s.legendDot('transparent'), boxShadow: `inset 0 0 0 2px ${isDark ? GOLD_DARK : GOLD}` }} />Your dates</span>
        )}
      </div>
    </div>
  );
};

export default AvailabilityCalendar;
