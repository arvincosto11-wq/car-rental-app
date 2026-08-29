import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import RevenueTrendChart from '../../components/RevenueTrendChart';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import api from '../../api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COUNTED_STATUSES = ['confirmed', 'completed'];

const Analytics = () => {
  usePageTitle('Analytics');
  const { isDark } = useTheme();
  const [cars, setCars] = useState([]);
  const [archivedCars, setArchivedCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [carsRes, archivedRes, bookingsRes] = await Promise.all([
          api.get('/cars'),
          api.get('/cars/archived'),
          api.get('/bookings/all'),
        ]);
        setCars(carsRes.data);
        setArchivedCars(archivedRes.data);
        setBookings(bookingsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const countedBookings = bookings.filter((b) => COUNTED_STATUSES.includes(b.status));

  const currentlyRented = cars.filter((c) => c.isAvailable === false).length;
  const currentlyAvailable = cars.length - currentlyRented;

  const topCarsMap = new Map();
  countedBookings.forEach((b) => {
    if (!b.car?._id) return;
    const key = b.car._id;
    const entry = topCarsMap.get(key) || { car: b.car, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += b.totalPrice || 0;
    topCarsMap.set(key, entry);
  });
  const topCars = [...topCarsMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const maxTopCarCount = Math.max(...topCars.map((t) => t.count), 1);

  const dayCounts = DAY_LABELS.map((label) => ({ label, value: 0 }));
  countedBookings.forEach((b) => {
    const day = new Date(b.startDate).getDay();
    dayCounts[day].value += 1;
  });

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' },
    statCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px' },
    statLabel: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '24px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    grid: { gap: '16px', marginBottom: '16px' },
    box: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    boxTitle: { fontSize: '15px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    boxSubtitle: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px' },
    empty: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' },
    topCarRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` },
    topCarRank: { width: '20px', fontSize: '13px', fontWeight: '700', color: isDark ? '#64748b' : '#9ca3af', flexShrink: 0 },
    topCarThumb: { width: '44px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    topCarInfo: { flex: 1, minWidth: 0 },
    topCarName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    topCarMeta: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    barTrack: { height: '6px', borderRadius: '3px', background: isDark ? '#334155' : '#f3f4f6', marginTop: '4px', overflow: 'hidden' },
    barFill: (pct) => ({ height: '100%', width: `${pct}%`, background: isDark ? GOLD_DARK : GOLD, borderRadius: '3px' }),
  };

  return (
    <AdminLayout activePage="Analytics">
      <h1 style={s.title}>Analytics</h1>
      <p style={s.subtitle}>Fleet snapshot, top vehicles, and demand patterns beyond revenue.</p>

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
          <Skeleton height="180px" radius="12px" isDark={isDark} />
        </>
      ) : (
        <>
          <div className="responsive-grid-4" style={s.statsRow}>
            <div style={s.statCard}><div style={s.statLabel}>Total Vehicles</div><div style={s.statNum}>{cars.length}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Currently Rented</div><div style={s.statNum}>{currentlyRented}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Currently Available</div><div style={s.statNum}>{currentlyAvailable}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Archived</div><div style={s.statNum}>{archivedCars.length}</div></div>
          </div>

          <div className="responsive-row-2" style={s.grid}>
            <div style={s.box}>
              <div style={s.boxTitle}>Top 5 Vehicles</div>
              <div style={s.boxSubtitle}>By number of confirmed/completed bookings</div>
              {topCars.length === 0 ? (
                <p style={s.empty}>No confirmed bookings yet.</p>
              ) : (
                topCars.map((t, i) => (
                  <div key={t.car._id} style={s.topCarRow}>
                    <span style={s.topCarRank}>{i + 1}</span>
                    <div style={s.topCarThumb}>
                      {t.car.image && <img src={t.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={s.topCarInfo}>
                      <div style={s.topCarName}>{t.car.brand} {t.car.model}</div>
                      <div style={s.topCarMeta}>{t.count} booking{t.count === 1 ? '' : 's'} · ₱{t.revenue.toLocaleString()} earned</div>
                      <div style={s.barTrack}><div style={s.barFill((t.count / maxTopCarCount) * 100)} /></div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={s.box}>
              <div style={s.boxTitle}>Busiest Day of the Week</div>
              <div style={s.boxSubtitle}>Pickup day for confirmed/completed bookings</div>
              {countedBookings.length === 0 ? (
                <p style={s.empty}>No confirmed bookings yet.</p>
              ) : (
                <RevenueTrendChart
                  data={dayCounts}
                  isDark={isDark}
                  barColor={isDark ? GOLD_DARK : GOLD}
                  barColorHover={isDark ? GOLD : GOLD_DARK}
                  formatValue={(v) => `${v} booking${v === 1 ? '' : 's'}`}
                  title="Bookings by day of the week"
                />
              )}
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default Analytics;
