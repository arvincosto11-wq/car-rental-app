import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { GOLD, GOLD_DARK, ON_GOLD, GOLD_TINT, GOLD_TINT_DARK, goldInk } from '../../theme';
import Skeleton from '../../components/Skeleton';
import RevenueTrendChart from '../../components/RevenueTrendChart';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';

const MONTH_DAY = { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' };
const MONTH_DAY_YEAR = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' };

// ₱38.2k rather than ₱38,200 over a bar, and ₱20k on the axis. One decimal
// only when there is one to show, so a round ₱20,000 does not read ₱20.0k.
const compactPeso = (n) => (n >= 1000
  ? `₱${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  : `₱${Math.round(n)}`);

const Dashboard = () => {
  usePageTitle('Admin Dashboard');
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalCars: 0, totalBookings: 0, pending: 0, confirmed: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [topRatedCars, setTopRatedCars] = useState([]);
  const [revenue, setRevenue] = useState({ week: 0, month: 0, all: 0 });
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [periodDates, setPeriodDates] = useState({ weekStart: '', today: '', monthStart: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') return navigate('/login');
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [carsRes, bookingsRes] = await Promise.all([
        api.get('/cars'),
        api.get('/bookings/all'),
      ]);
      const bookings = bookingsRes.data;
      const confirmed = bookings.filter((b) => b.status === 'confirmed');
      const pending = bookings.filter((b) => b.status === 'pending');

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const sumSince = (cutoff) => confirmed
        .filter((b) => new Date(b.createdAt) >= cutoff)
        .reduce((sum, b) => sum + b.totalPrice, 0);

      const months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('en-US', { month: 'short' }) };
      });
      const trend = months.map(({ year, month, label }) => ({
        label,
        value: confirmed
          .filter((b) => {
            const bd = new Date(b.createdAt);
            return bd.getFullYear() === year && bd.getMonth() === month;
          })
          .reduce((sum, b) => sum + b.totalPrice, 0),
      }));

      const rated = carsRes.data
        .filter((c) => c.ratingCount > 0)
        .sort((a, b) => b.avgRating - a.avgRating || b.ratingCount - a.ratingCount)
        .slice(0, 5);
      setStats({ totalCars: carsRes.data.length, totalBookings: bookings.length, pending: pending.length, confirmed: confirmed.length });
      setRecentBookings(bookings.slice(0, 5));
      setTopRatedCars(rated);
      setRevenue({
        week: sumSince(startOfWeek),
        month: sumSince(startOfMonth),
        all: confirmed.reduce((sum, b) => sum + b.totalPrice, 0),
      });
      setMonthlyTrend(trend);
      // Spelled out under the figure, so nobody has to guess whether "this
      // month" means the last 30 days or the calendar month.
      setPeriodDates({
        weekStart: startOfWeek.toLocaleDateString('en-US', MONTH_DAY),
        today: now.toLocaleDateString('en-US', MONTH_DAY_YEAR),
        monthStart: startOfMonth.toLocaleDateString('en-US', MONTH_DAY_YEAR),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const periodCaption = {
    week: `Confirmed bookings created in the last 7 days · ${periodDates.weekStart} – ${periodDates.today}`,
    month: `Confirmed bookings created since ${periodDates.monthStart}`,
    all: 'Every confirmed booking to date',
  }[revenuePeriod];

  const trendAverage = monthlyTrend.length
    ? monthlyTrend.reduce((sum, m) => sum + m.value, 0) / monthlyTrend.length
    : 0;
  const trendHasValues = monthlyTrend.some((m) => m.value > 0);

  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const rowLine = isDark ? '#303132' : '#eef0f2';
  const thumbBg = isDark ? '#3a3b3c' : '#f1f2f4';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';

  const badgeTone = {
    pending: [isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', isDark ? '#fbbf24' : '#92400e', isDark ? 'rgba(217,119,6,0.35)' : '#fde68a'],
    confirmed: [isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', isDark ? '#86efac' : '#065f46', isDark ? 'rgba(22,163,74,0.35)' : '#a7f3d0'],
    completed: [isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', isDark ? '#93c5fd' : '#1e40af', isDark ? 'rgba(37,99,235,0.4)' : '#bfdbfe'],
    cancelled: [isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2', isDark ? '#f87171' : '#b91c1c', isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'],
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: text, marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: text2, marginBottom: '24px' },
    stack: { display: 'flex', flexDirection: 'column', gap: '16px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px' },
    card: { background: isDark ? '#242526' : '#fff', border: `1px solid ${line}`, borderRadius: '12px' },
    statCard: {
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '6px',
      minHeight: '96px', boxSizing: 'border-box',
    },
    statLabel: { fontSize: '12px', color: text2 },
    statNum: { fontSize: '24px', fontWeight: '700', color: text, fontVariantNumeric: 'tabular-nums' },
    // The one card that is a job rather than a number. Gold only while there
    // is something waiting; at zero it is indistinguishable from the others,
    // because a standing gold panel stops meaning anything.
    pendingCard: {
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      border: `1px solid ${isDark ? GOLD_DARK : GOLD}`,
      borderRadius: '12px', padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      minHeight: '96px', boxSizing: 'border-box',
      textDecoration: 'none', color: goldInk(isDark),
    },
    pendingTop: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
      fontSize: '12px', fontWeight: '600', color: goldInk(isDark),
    },
    pendingDot: { width: '8px', height: '8px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, flexShrink: 0 },
    pendingBottom: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' },
    pendingNum: { fontSize: '24px', fontWeight: '700', color: goldInk(isDark), fontVariantNumeric: 'tabular-nums' },
    pendingWaiting: { fontSize: '12px', fontWeight: '600', color: goldInk(isDark) },
    pendingReview: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: goldInk(isDark) },

    revenueCard: { padding: '22px', display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: '36px' },
    boxTitle: { fontSize: '15px', fontWeight: '600', color: text, marginBottom: '4px' },
    boxSubtitle: { fontSize: '12px', color: text2 },
    periodToggleRow: {
      display: 'flex', gap: '4px', padding: '3px', borderRadius: '20px',
      border: `1px solid ${line}`, background: isDark ? '#1e1f20' : '#f8f9fa',
      marginTop: '18px', alignSelf: 'flex-start',
    },
    periodBtn: (active) => ({
      padding: '6px 13px', borderRadius: '20px', border: 'none',
      fontSize: '12px', fontWeight: '600', cursor: 'pointer',
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : text2,
    }),
    revenueNum: {
      fontSize: '40px', fontWeight: '700', letterSpacing: '-0.015em', lineHeight: 1,
      color: goldInk(isDark), marginTop: '22px', fontVariantNumeric: 'tabular-nums',
    },
    revenueCaption: { fontSize: '12px', lineHeight: 1.5, color: text2, marginTop: '10px' },
    // Pinned to the bottom of the column so it reads as a footnote to the
    // whole card rather than another line of the caption.
    revenueFootnote: { marginTop: 'auto', paddingTop: '18px', fontSize: '11px', lineHeight: 1.5, color: text3 },
    chartCol: {
      display: 'flex', flexDirection: 'column', gap: '12px',
      paddingLeft: '36px', borderLeft: `1px solid ${rowLine}`, minWidth: 0,
    },
    chartHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' },
    chartLabel: { fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', color: text2 },
    chartMeta: { display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: text3 },
    chartAvg: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: text2 },
    chartAvgDash: { display: 'block', width: '18px', borderTop: `1.5px dashed ${text3}` },

    twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', alignItems: 'stretch' },
    listCard: { padding: '22px', display: 'flex', flexDirection: 'column' },
    bookingRow: (last) => ({
      display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr) auto 86px',
      alignItems: 'center', gap: '12px', padding: '11px 0',
      borderBottom: `1px solid ${last ? 'transparent' : rowLine}`,
    }),
    bookingIcon: { width: '30px', height: '30px', background: thumbBg, borderRadius: '6px', flexShrink: 0, overflow: 'hidden' },
    bookingName: { fontSize: '13px', fontWeight: '500', color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    bookingDate: { fontSize: '11px', color: text3 },
    bookingPrice: { fontSize: '13px', fontWeight: '600', color: text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    // Four states, not two. This used to be `confirmed ? green : amber`, so
    // a cancelled booking wore the same badge as one waiting for review.
    badge: (status) => {
      const [bg, fg, bd] = badgeTone[status] || badgeTone.pending;
      return {
        justifySelf: 'end', fontSize: '11px', fontWeight: '600', padding: '3px 10px',
        borderRadius: '20px', background: bg, color: fg, border: `1px solid ${bd}`,
        textTransform: 'capitalize', whiteSpace: 'nowrap',
      };
    },
    topRatedRow: (last) => ({
      display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto',
      alignItems: 'center', gap: '12px', padding: '10px 0',
      borderBottom: `1px solid ${last ? 'transparent' : rowLine}`,
    }),
    topRatedThumb: { width: '44px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: thumbBg, flexShrink: 0 },
    topRatedScore: { minWidth: '100px', fontSize: '12px', color: text3, fontVariantNumeric: 'tabular-nums' },
    topRatedAvg: { fontWeight: '700', color: text },
    // A drawn box rather than a line of grey text, so an empty card still
    // has the shape of the thing that will fill it.
    emptyBox: {
      flex: 1, display: 'grid', placeItems: 'center', minHeight: '200px',
      border: `1px dashed ${line}`, borderRadius: '10px', marginTop: '6px',
      fontSize: '13px', color: text2,
    },
    skelChart: {
      height: '250px', display: 'flex', alignItems: 'flex-end', gap: '36px',
      padding: '0 24px 34px 60px', borderLeft: `1px solid ${rowLine}`,
    },
  };

  const thumb = (src) => (src
    ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : null);

  return (
    <AdminLayout activePage="Dashboard">
      <h1 style={s.title}>Admin Dashboard</h1>
      <p style={s.subtitle}>Monitor overall platform performance</p>
      {loading ? (
        <div style={s.stack}>
          <div style={s.statsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...s.card, ...s.statCard }}>
                <Skeleton height="12px" width="55%" isDark={isDark} />
                <Skeleton height="24px" width="35%" isDark={isDark} />
              </div>
            ))}
          </div>
          <div style={{ ...s.card, ...s.revenueCard }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton height="15px" width="40%" isDark={isDark} />
              <Skeleton height="12px" width="65%" isDark={isDark} />
              <Skeleton height="30px" width="100%" isDark={isDark} style={{ borderRadius: '20px', marginTop: '10px' }} />
              <Skeleton height="40px" width="70%" isDark={isDark} style={{ marginTop: '14px' }} />
              <Skeleton height="12px" width="90%" isDark={isDark} />
            </div>
            <div style={s.skelChart}>
              {[58, 72, 84, 96, 76, 100].map((h, i) => (
                <div key={i} style={{ flex: 1, maxWidth: '44px', height: `${h}%` }}>
                  <Skeleton height="100%" isDark={isDark} style={{ borderRadius: '6px 6px 0 0' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={s.twoCol}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ ...s.card, ...s.listCard }}>
                <Skeleton height="15px" width="36%" isDark={isDark} style={{ marginBottom: '14px' }} />
                {Array.from({ length: 5 }).map((__, j) => (
                  <Skeleton key={j} height="44px" isDark={isDark} style={{ marginBottom: '8px' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={s.stack}>
          <div style={s.statsRow}>
            <div style={{ ...s.card, ...s.statCard }}>
              <span style={s.statLabel}>Total Cars</span>
              <span style={s.statNum}>{stats.totalCars}</span>
            </div>
            <div style={{ ...s.card, ...s.statCard }}>
              <span style={s.statLabel}>Total Bookings</span>
              <span style={s.statNum}>{stats.totalBookings}</span>
            </div>
            {stats.pending > 0 ? (
              <Link to="/admin/manage-bookings" style={s.pendingCard}>
                <span style={s.pendingTop}>
                  Pending
                  <span style={s.pendingDot} />
                </span>
                <div style={s.pendingBottom}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={s.pendingNum}>{stats.pending}</span>
                    <span style={s.pendingWaiting}>awaiting review</span>
                  </span>
                  <span style={s.pendingReview}>
                    Review
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                  </span>
                </div>
              </Link>
            ) : (
              <div style={{ ...s.card, ...s.statCard }}>
                <span style={s.statLabel}>Pending</span>
                <span style={s.statNum}>{stats.pending}</span>
              </div>
            )}
            <div style={{ ...s.card, ...s.statCard }}>
              <span style={s.statLabel}>Confirmed</span>
              <span style={s.statNum}>{stats.confirmed}</span>
            </div>
          </div>

          <div style={{ ...s.card, ...s.revenueCard }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={s.boxTitle}>Revenue</div>
              <div style={s.boxSubtitle}>From confirmed bookings</div>
              <div style={s.periodToggleRow} role="group" aria-label="Revenue period">
                <button type="button" style={s.periodBtn(revenuePeriod === 'week')} aria-pressed={revenuePeriod === 'week'} onClick={() => setRevenuePeriod('week')}>This Week</button>
                <button type="button" style={s.periodBtn(revenuePeriod === 'month')} aria-pressed={revenuePeriod === 'month'} onClick={() => setRevenuePeriod('month')}>This Month</button>
                <button type="button" style={s.periodBtn(revenuePeriod === 'all')} aria-pressed={revenuePeriod === 'all'} onClick={() => setRevenuePeriod('all')}>All Time</button>
              </div>
              <div style={s.revenueNum}>₱{revenue[revenuePeriod].toLocaleString()}</div>
              <div style={s.revenueCaption}>{periodCaption}</div>
              <div style={s.revenueFootnote}>
                Pending and cancelled bookings are excluded. Amounts in ₱, dates in Philippine time.
              </div>
            </div>
            <div style={s.chartCol}>
              <div style={s.chartHead}>
                <span style={s.chartLabel}>Last 6 months</span>
                <span style={s.chartMeta}>
                  {trendHasValues && (
                    <span style={s.chartAvg}>
                      <span style={s.chartAvgDash} />
                      6-month avg {compactPeso(trendAverage)}
                    </span>
                  )}
                  Confirmed totals by booking date
                </span>
              </div>
              <RevenueTrendChart
                data={monthlyTrend}
                isDark={isDark}
                barColor={isDark ? GOLD_DARK : GOLD}
                barColorHover={isDark ? GOLD : GOLD_DARK}
                detailed
                formatCompact={compactPeso}
                currentLabel="to date"
                emptyMessage="No confirmed bookings in the last 6 months"
              />
            </div>
          </div>

          <div style={s.twoCol}>
            <div style={{ ...s.card, ...s.listCard }}>
              <div style={s.boxTitle}>Recent Bookings</div>
              <div style={{ ...s.boxSubtitle, marginBottom: '10px' }}>Latest customer bookings</div>
              {recentBookings.length === 0 ? (
                <div style={s.emptyBox}>No bookings yet.</div>
              ) : recentBookings.map((b, i) => (
                <div key={b._id} style={s.bookingRow(i === recentBookings.length - 1)}>
                  <div style={s.bookingIcon}>{thumb(b.car?.image)}</div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={s.bookingName}>{b.car?.brand} {b.car?.model}</span>
                    <span style={s.bookingDate}>
                      {new Date(b.createdAt).toLocaleDateString('en-US', MONTH_DAY_YEAR)}
                    </span>
                  </div>
                  <span style={s.bookingPrice}>₱{b.totalPrice.toLocaleString()}</span>
                  <span style={s.badge(b.status)}>{b.status}</span>
                </div>
              ))}
            </div>

            <div style={{ ...s.card, ...s.listCard }}>
              <div style={s.boxTitle}>Top Rated Cars</div>
              <div style={{ ...s.boxSubtitle, marginBottom: '10px' }}>Your best-reviewed vehicles</div>
              {topRatedCars.length === 0 ? (
                <div style={s.emptyBox}>No reviews yet.</div>
              ) : topRatedCars.map((car, i) => (
                <div key={car._id} style={s.topRatedRow(i === topRatedCars.length - 1)}>
                  <div style={s.topRatedThumb}>{thumb(car.image)}</div>
                  <span style={s.bookingName}>{car.brand} {car.model}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StarRating value={car.avgRating} size={13} readOnly />
                    <span style={s.topRatedScore}>
                      <strong style={s.topRatedAvg}>{car.avgRating.toFixed(1)}</strong>
                      {' '}({car.ratingCount} review{car.ratingCount === 1 ? '' : 's'})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Dashboard;
