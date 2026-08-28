import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import Skeleton from '../../components/Skeleton';
import RevenueTrendChart from '../../components/RevenueTrendChart';
import api from '../../api';

const Dashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalCars: 0, totalBookings: 0, pending: 0, confirmed: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [topRatedCars, setTopRatedCars] = useState([]);
  const [revenue, setRevenue] = useState({ week: 0, month: 0, all: 0 });
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  const [monthlyTrend, setMonthlyTrend] = useState([]);
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    statsRow: { gap: '14px', marginBottom: '24px' },
    statCard: { background: isDark ? '#1e293b' : '#f3f4f6', borderRadius: '10px', padding: '16px', border: `1px solid ${isDark ? '#334155' : 'transparent'}` },
    statLabel: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '24px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    grid: { gap: '16px' },
    box: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    boxTitle: { fontSize: '15px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    boxSubtitle: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px' },
    bookingRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` },
    bookingIcon: { width: '30px', height: '30px', background: isDark ? '#334155' : '#f3f4f6', borderRadius: '6px', flexShrink: 0, overflow: 'hidden' },
    bookingName: { fontSize: '13px', fontWeight: '500', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    bookingDate: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    bookingPrice: { marginLeft: 'auto', fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    badgeConfirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    badgePending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    revenueNum: { fontSize: '32px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD, marginTop: '16px' },
    periodToggleRow: { display: 'flex', gap: '8px', marginTop: '4px' },
    trendWrap: { marginTop: '20px' },
    trendLabel: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px', fontWeight: '500' },
    periodBtn: (active) => ({
      padding: '6px 14px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
      border: active ? 'none' : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#94a3b8' : '#6b7280'),
      cursor: 'pointer',
    }),
    topRatedRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` },
    topRatedThumb: { width: '44px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
  };

  return (
    <AdminLayout activePage="Dashboard">
      <h1 style={s.title}>Admin Dashboard</h1>
      <p style={s.subtitle}>Monitor overall platform performance</p>
      {loading ? (
        <>
          <div className="responsive-grid-4" style={s.statsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={s.statCard}>
                <Skeleton height="12px" width="60%" isDark={isDark} style={{ marginBottom: '10px' }} />
                <Skeleton height="24px" width="40%" isDark={isDark} />
              </div>
            ))}
          </div>
          <div className="responsive-row-2" style={s.grid}>
            <div style={s.box}>
              <Skeleton height="15px" width="50%" isDark={isDark} style={{ marginBottom: '14px' }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height="40px" isDark={isDark} style={{ marginBottom: '8px' }} />
              ))}
            </div>
            <div style={s.box}>
              <Skeleton height="15px" width="50%" isDark={isDark} style={{ marginBottom: '14px' }} />
              <Skeleton height="32px" width="60%" isDark={isDark} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="responsive-grid-4" style={s.statsRow}>
            <div style={s.statCard}><div style={s.statLabel}>Total Cars</div><div style={s.statNum}>{stats.totalCars}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Total Bookings</div><div style={s.statNum}>{stats.totalBookings}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Pending</div><div style={s.statNum}>{stats.pending}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Confirmed</div><div style={s.statNum}>{stats.confirmed}</div></div>
          </div>
          <div className="responsive-row-2" style={s.grid}>
            <div style={s.box}>
              <div style={s.boxTitle}>Recent Bookings</div>
              <div style={s.boxSubtitle}>Latest customer bookings</div>
              {recentBookings.length === 0 ? (
                <p style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: '13px' }}>No bookings yet.</p>
              ) : recentBookings.map((b) => (
                <div key={b._id} style={s.bookingRow}>
                  <div style={s.bookingIcon}>
                    {b.car?.image && <img src={b.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div>
                    <div style={s.bookingName}>{b.car?.brand} {b.car?.model}</div>
                    <div style={s.bookingDate}>{new Date(b.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={s.bookingPrice}>₱{b.totalPrice}</div>
                  <span style={b.status === 'confirmed' ? s.badgeConfirmed : s.badgePending}>{b.status}</span>
                </div>
              ))}
            </div>
            <div style={s.box}>
              <div style={s.boxTitle}>Revenue</div>
              <div style={s.boxSubtitle}>From confirmed bookings</div>
              <div style={s.periodToggleRow}>
                <button type="button" style={s.periodBtn(revenuePeriod === 'week')} onClick={() => setRevenuePeriod('week')}>This Week</button>
                <button type="button" style={s.periodBtn(revenuePeriod === 'month')} onClick={() => setRevenuePeriod('month')}>This Month</button>
                <button type="button" style={s.periodBtn(revenuePeriod === 'all')} onClick={() => setRevenuePeriod('all')}>All Time</button>
              </div>
              <div style={s.revenueNum}>₱{revenue[revenuePeriod].toLocaleString()}</div>
              <div style={s.trendWrap}>
                <div style={s.trendLabel}>Last 6 months</div>
                <RevenueTrendChart
                  data={monthlyTrend}
                  isDark={isDark}
                  barColor={isDark ? GOLD_DARK : GOLD}
                  barColorHover={isDark ? GOLD : GOLD_DARK}
                />
              </div>
            </div>
          </div>
          <div style={{ ...s.box, marginTop: '16px' }}>
            <div style={s.boxTitle}>Top Rated Cars</div>
            <div style={s.boxSubtitle}>Your best-reviewed vehicles</div>
            {topRatedCars.length === 0 ? (
              <p style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: '13px' }}>No reviews yet.</p>
            ) : topRatedCars.map((car) => (
              <div key={car._id} style={s.topRatedRow}>
                <div style={s.topRatedThumb}>
                  {car.image && <img src={car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={s.bookingName}>{car.brand} {car.model}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <StarRating value={car.avgRating} size={13} readOnly />
                    <span style={s.bookingDate}>{car.avgRating.toFixed(1)} ({car.ratingCount} review{car.ratingCount === 1 ? '' : 's'})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default Dashboard;