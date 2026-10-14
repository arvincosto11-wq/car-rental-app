import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import BackButton from '../../components/BackButton';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk} from '../../theme';
import api from '../../api';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Cancelled is neutral and struck through, never red: red on this page
// means something needs doing, and a booking called off last month does
// not. The edge colour is the 3px rule down the left of a chip.
const STATUS_ORDER = ['pending', 'confirmed', 'completed', 'cancelled'];

const normalize = (d) => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd.getTime();
};

const sameDate = (a, b) => normalize(a) === normalize(b);

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

const CHIP_LIMIT = 2;

const BookingsCalendar = () => {
  usePageTitle('Bookings Calendar');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/bookings/all');
        setBookings(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  // What MOVES on a day, rather than what is merely out on it. A vehicle
  // sitting with a client all week is not a thing anybody does something
  // about; the mornings it leaves and comes back are. Whether a given
  // vehicle is free on a date is still answered on its own calendar, in
  // Block Dates.
  const pickupsOn = (day) => bookings
    .filter((b) => sameDate(b.startDate, day))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const returnsOn = (day) => bookings
    .filter((b) => sameDate(b.endDate, day))
    .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

  const hourLabel = (b, which) => {
    if (!b.hasPickupTime) return 'all day';
    const d = new Date(which === 'end' ? b.endDate : b.startDate);
    const h = d.getHours();
    return `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  };

  // The panel always has a day: the one picked, or today, or the first of
  // the month being looked at. An empty panel beside a full month is a
  // question nobody asked.
  const panelDay = selectedDay
    || (cursor.getMonth() === new Date().getMonth() && cursor.getFullYear() === new Date().getFullYear()
      ? new Date()
      : new Date(cursor));
  const panelOut = pickupsOn(panelDay);
  const panelBack = returnsOn(panelDay);

  const grid = buildGrid(cursor.getFullYear(), cursor.getMonth());
  const today = new Date();

  const goToMonth = (offset) => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  const goToToday = () => {
    const d = new Date();
    d.setDate(1);
    setCursor(d);
  };

  const card = isDark ? '#242526' : '#ffffff';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const divider = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const ink = goldInk(isDark);

  const s = {
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginTop: '10px', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '18px' },
    navRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
    navBtn: { padding: '7px 12px', fontSize: '13px', fontWeight: '600', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a', cursor: 'pointer' },
    todayBtn: { padding: '7px 14px', fontSize: '12px', fontWeight: '700', border: 'none', borderRadius: '8px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer' },
    monthLabel: { fontSize: '17px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', minWidth: '160px' },
    legendRow: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    legendDot: (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }),
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: isDark ? '#3a3b3c' : '#e5e7eb', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '10px', overflow: 'hidden' },
    weekdayCell: { background: isDark ? '#242526' : '#f9fafb', padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: isDark ? '#b0b3b8' : '#6b7280', textTransform: 'uppercase' },
    dayCell: (inMonth, isToday) => ({
      background: isDark ? '#242526' : '#fff', minHeight: '92px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px',
      opacity: inMonth ? 1 : 0.4,
      boxShadow: isToday ? `inset 0 0 0 2px ${isDark ? GOLD_DARK : GOLD}` : 'none',
    }),
    dayNum: (isToday) => ({ fontSize: '12px', fontWeight: isToday ? '800' : '600', color: isDark ? '#e4e6eb' : '#1a1a1a' }),
    chip: (color) => ({
      fontSize: '10px', padding: '2px 6px', borderRadius: '4px', borderLeft: `3px solid ${color}`,
      background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#e2e8f0' : '#374151',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
    }),
    moreBtn: { fontSize: '10px', background: 'none', border: 'none', color: goldInk(isDark), cursor: 'pointer', fontWeight: '700', textAlign: 'left', padding: 0 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '80vh', overflow: 'auto' },
    modalTitle: { fontSize: '17px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '14px' },
    bookingRow: { padding: '10px 0', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}` },
    bookingTop: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' },
    bookingCar: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    statusBadge: (color) => ({ fontSize: '10px', fontWeight: '700', color: '#fff', background: color, padding: '2px 8px', borderRadius: '20px', textTransform: 'capitalize' }),
    bookingMeta: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    closeBtn: { marginTop: '16px', width: '100%', padding: '10px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  
    // ── Month beside a day (design 1a) ────────────────────────────────
    split: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '18px', alignItems: 'start' },
    dayTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' },
    backCount: { fontSize: '10.5px', color: text3 },
    tone: (status) => ({
      pending: { bg: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', fg: isDark ? '#fbbf24' : '#92400e', edge: isDark ? '#f59e0b' : '#d97706' },
      confirmed: { bg: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', fg: isDark ? '#86efac' : '#065f46', edge: isDark ? '#22c55e' : '#16a34a' },
      completed: { bg: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', fg: isDark ? '#93c5fd' : '#1e40af', edge: isDark ? '#3b82f6' : '#2563eb' },
      cancelled: { bg: isDark ? '#303132' : '#f1f2f4', fg: text2, edge: isDark ? '#6b7280' : '#9ca3af' },
    }[status] || { bg: isDark ? '#303132' : '#f1f2f4', fg: text2, edge: '#9ca3af' }),
    legendSwatch: (status) => ({
      width: '12px', height: '12px', borderRadius: '3px', display: 'inline-block',
      background: s.tone(status).bg,
      borderLeft: `3px solid ${s.tone(status).edge}`,
    }),
    pill: (status) => ({
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap',
      background: s.tone(status).bg, color: s.tone(status).fg,
      textDecoration: status === 'cancelled' ? 'line-through' : 'none',
    }),

    panel: {
      position: 'sticky', top: '20px',
      background: card, border: `1px solid ${line}`, borderRadius: '16px', padding: '18px 20px',
    },
    panelTitle: { fontSize: '17px', fontWeight: '800', color: text, margin: 0 },
    panelSummary: { fontSize: '12.5px', color: text3, margin: '4px 0 16px' },
    group: { marginBottom: '16px' },
    groupLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: text3, marginBottom: '6px',
    },
    groupEmpty: { fontSize: '12.5px', color: text3, margin: 0 },
    panelRow: {
      display: 'grid', gridTemplateColumns: '58px minmax(0, 1fr) auto', gap: '10px', alignItems: 'center',
      width: '100%', padding: '8px 0', background: 'transparent', border: 'none',
      borderTop: `1px solid ${divider}`, textAlign: 'left', cursor: 'pointer',
    },
    panelTime: { fontSize: '12.5px', fontWeight: '800', color: text },
    panelClient: { display: 'block', fontSize: '13px', fontWeight: '700', color: text },
    panelMeta: {
      display: 'block', fontSize: '11.5px', color: text3,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    panelLink: {
      border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
      font: 'inherit', fontSize: '12.5px', fontWeight: '700', color: ink,
    },
  };

  return (
    <AdminLayout activePage="Manage Bookings">
      <BackButton text="Back to Manage Bookings" onClick={() => navigate('/admin/manage-bookings')} />
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Bookings Calendar</h1>
          <p style={s.subtitle}>What goes out and what comes back, day by day. Read-only — bookings are handled in Manage Bookings.</p>
        </div>
      </div>

      {loading ? (
        <Skeleton height="500px" radius="12px" isDark={isDark} />
      ) : (
        <>
          <div style={s.navRow}>
            <button style={s.navBtn} onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
            <span style={s.monthLabel}>{MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}</span>
            <button style={s.navBtn} onClick={() => goToMonth(1)} aria-label="Next month">›</button>
            <button style={s.todayBtn} onClick={goToToday}>Today</button>
          </div>

          <div style={s.legendRow}>
            {STATUS_ORDER.map((status) => (
              <span key={status} style={s.legendItem}>
                <span style={s.legendSwatch(status)} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            ))}
          </div>

          <div style={s.split}>
          <div style={s.grid}>
            {WEEKDAY_LABELS.map((wd) => (
              <div key={wd} style={s.weekdayCell}>{wd}</div>
            ))}
            {grid.map(({ date, inMonth }, i) => {
              const out = pickupsOn(date);
              const back = returnsOn(date);
              const isToday = sameDate(date, today);
              const isSelected = selectedDay && sameDate(date, selectedDay);
              return (
                <button
                  key={i}
                  type="button"
                  style={s.dayCell(inMonth, isToday, isSelected)}
                  aria-pressed={!!isSelected}
                  aria-label={`${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${out.length} pickup${out.length === 1 ? '' : 's'}, ${back.length} return${back.length === 1 ? '' : 's'}`}
                  onClick={() => setSelectedDay(date)}
                >
                  <span style={s.dayTop}>
                    <span style={s.dayNum(isToday)}>{date.getDate()}</span>
                    {back.length > 0 && <span style={s.backCount}>{back.length} back</span>}
                  </span>
                  {out.slice(0, CHIP_LIMIT).map((b) => (
                    <span
                      key={b._id}
                      style={s.chip(b.status)}
                      title={`${b.car?.brand} ${b.car?.model} · ${b.user?.name} · ${b.status}`}
                    >
                      {hourLabel(b)} · {b.car?.model}
                    </span>
                  ))}
                  {out.length > CHIP_LIMIT && (
                    <span style={s.moreBtn}>+{out.length - CHIP_LIMIT} more</span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={s.panel} aria-live="polite">
            <h2 style={s.panelTitle}>
              {panelDay.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })}
              {sameDate(panelDay, today) ? ' · Today' : ''}
            </h2>
            <p style={s.panelSummary}>
              {panelOut.length} going out · {panelBack.length} coming back
            </p>

            {[['Pickups', panelOut, 'start'], ['Returns', panelBack, 'end']].map(([label, list, which]) => (
              <div key={label} style={s.group}>
                <div style={s.groupLabel}>{label} · {list.length}</div>
                {list.length === 0 ? (
                  <p style={s.groupEmpty}>None</p>
                ) : list.map((b) => (
                  <button
                    key={b._id}
                    type="button"
                    style={s.panelRow}
                    onClick={() => navigate('/admin/manage-bookings')}
                  >
                    <span style={s.panelTime}>{hourLabel(b, which)}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={s.panelClient}>{b.user?.name || 'Unknown'}</span>
                      <span style={s.panelMeta}>
                        {b.car?.brand} {b.car?.model} · {b.totalDays} day{b.totalDays === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span style={s.pill(b.status)}>{b.status}</span>
                  </button>
                ))}
              </div>
            ))}

            <button type="button" style={s.panelLink} onClick={() => navigate('/admin/manage-bookings')}>
              Open these in Manage Bookings →
            </button>
          </div>
          </div>
        </>
      )}

    </AdminLayout>
  );
};

export default BookingsCalendar;
