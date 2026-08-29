import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import useModalA11y from '../../hooks/useModalA11y';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import api from '../../api';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const STATUS_COLORS = {
  pending: '#f59e0b',
  confirmed: '#16a34a',
  completed: '#2563eb',
  cancelled: '#dc2626',
};

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

  const dayModalRef = useModalA11y(() => setSelectedDay(null), !!selectedDay);

  const bookingsForDay = (day) => {
    const target = normalize(day);
    return bookings.filter((b) => target >= normalize(b.startDate) && target <= normalize(b.endDate));
  };

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

  const s = {
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    backLink: { fontSize: '13px', color: isDark ? GOLD_DARK : GOLD, textDecoration: 'none', fontWeight: '500' },
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginTop: '10px', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '18px' },
    navRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' },
    navBtn: { padding: '7px 12px', fontSize: '13px', fontWeight: '600', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#1a1a1a', cursor: 'pointer' },
    todayBtn: { padding: '7px 14px', fontSize: '12px', fontWeight: '700', border: 'none', borderRadius: '8px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer' },
    monthLabel: { fontSize: '17px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', minWidth: '160px' },
    legendRow: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    legendDot: (color) => ({ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }),
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: isDark ? '#334155' : '#e5e7eb', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '10px', overflow: 'hidden' },
    weekdayCell: { background: isDark ? '#1e293b' : '#f9fafb', padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: isDark ? '#94a3b8' : '#6b7280', textTransform: 'uppercase' },
    dayCell: (inMonth, isToday) => ({
      background: isDark ? '#1e293b' : '#fff', minHeight: '92px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px',
      opacity: inMonth ? 1 : 0.4,
      boxShadow: isToday ? `inset 0 0 0 2px ${isDark ? GOLD_DARK : GOLD}` : 'none',
    }),
    dayNum: (isToday) => ({ fontSize: '12px', fontWeight: isToday ? '800' : '600', color: isDark ? '#f1f5f9' : '#1a1a1a' }),
    chip: (color) => ({
      fontSize: '10px', padding: '2px 6px', borderRadius: '4px', borderLeft: `3px solid ${color}`,
      background: isDark ? '#0f172a' : '#f9fafb', color: isDark ? '#e2e8f0' : '#374151',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
    }),
    moreBtn: { fontSize: '10px', background: 'none', border: 'none', color: isDark ? GOLD_DARK : GOLD, cursor: 'pointer', fontWeight: '700', textAlign: 'left', padding: 0 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '100%', maxHeight: '80vh', overflow: 'auto' },
    modalTitle: { fontSize: '17px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '14px' },
    bookingRow: { padding: '10px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` },
    bookingTop: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' },
    bookingCar: { fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    statusBadge: (color) => ({ fontSize: '10px', fontWeight: '700', color: '#fff', background: color, padding: '2px 8px', borderRadius: '20px', textTransform: 'capitalize' }),
    bookingMeta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    closeBtn: { marginTop: '16px', width: '100%', padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  };

  return (
    <AdminLayout activePage="Manage Bookings">
      <Link to="/admin/manage-bookings" style={s.backLink}>← Back to Manage Bookings</Link>
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Bookings Calendar</h1>
          <p style={s.subtitle}>Visual overview of pickup dates. Read-only — manage bookings from the table.</p>
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
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <span key={status} style={s.legendItem}>
                <span style={s.legendDot(color)} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            ))}
          </div>

          <div style={s.grid}>
            {WEEKDAY_LABELS.map((wd) => (
              <div key={wd} style={s.weekdayCell}>{wd}</div>
            ))}
            {grid.map(({ date, inMonth }, i) => {
              const dayBookings = bookingsForDay(date);
              const isToday = sameDate(date, today);
              return (
                <div key={i} style={s.dayCell(inMonth, isToday)}>
                  <span style={s.dayNum(isToday)}>{date.getDate()}</span>
                  {dayBookings.slice(0, CHIP_LIMIT).map((b) => (
                    <span
                      key={b._id}
                      style={s.chip(STATUS_COLORS[b.status] || '#9ca3af')}
                      title={`${b.car?.brand} ${b.car?.model} · ${b.user?.name} · ${b.status}`}
                      onClick={() => setSelectedDay(date)}
                    >
                      {b.car?.brand} {b.car?.model}
                    </span>
                  ))}
                  {dayBookings.length > CHIP_LIMIT && (
                    <button style={s.moreBtn} onClick={() => setSelectedDay(date)}>
                      +{dayBookings.length - CHIP_LIMIT} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedDay && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} ref={dayModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="day-modal-title">
            <h2 id="day-modal-title" style={s.modalTitle}>
              {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
            {bookingsForDay(selectedDay).map((b) => (
              <div key={b._id} style={s.bookingRow}>
                <div style={s.bookingTop}>
                  <span style={s.bookingCar}>{b.car?.brand} {b.car?.model}</span>
                  <span style={s.statusBadge(STATUS_COLORS[b.status] || '#9ca3af')}>{b.status}</span>
                </div>
                <div style={s.bookingMeta}>{b.user?.name} · {new Date(b.startDate).toLocaleDateString()} to {new Date(b.endDate).toLocaleDateString()} · ₱{b.totalPrice?.toLocaleString()}</div>
              </div>
            ))}
            <button style={s.closeBtn} onClick={() => setSelectedDay(null)}>Close</button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default BookingsCalendar;
