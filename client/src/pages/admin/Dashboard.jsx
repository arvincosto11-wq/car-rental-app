import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

const Dashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalCars: 0, totalBookings: 0, pending: 0, confirmed: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') return navigate('/admin/login');
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
      const monthlyRevenue = confirmed.reduce((sum, b) => sum + b.totalPrice, 0);
      setStats({ totalCars: carsRes.data.length, totalBookings: bookings.length, pending: pending.length, confirmed: confirmed.length });
      setRecentBookings(bookings.slice(0, 5));
      setRevenue(monthlyRevenue);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' },
    statCard: { background: isDark ? '#1e293b' : '#f3f4f6', borderRadius: '10px', padding: '16px', border: `1px solid ${isDark ? '#334155' : 'transparent'}` },
    statLabel: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '24px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
    box: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    boxTitle: { fontSize: '15px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    boxSubtitle: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px' },
    bookingRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` },
    bookingIcon: { width: '30px', height: '30px', background: isDark ? '#1e40af' : '#eff6ff', borderRadius: '6px', flexShrink: 0 },
    bookingName: { fontSize: '13px', fontWeight: '500', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    bookingDate: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    bookingPrice: { marginLeft: 'auto', fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    badgeConfirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    badgePending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    revenueNum: { fontSize: '32px', fontWeight: '700', color: '#2563eb', marginTop: '16px' },
  };

  return (
    <AdminLayout activePage="Dashboard">
      <h1 style={s.title}>Admin Dashboard</h1>
      <p style={s.subtitle}>Monitor overall platform performance</p>
      {loading ? (
        <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
      ) : (
        <>
          <div style={s.statsRow}>
            <div style={s.statCard}><div style={s.statLabel}>Total Cars</div><div style={s.statNum}>{stats.totalCars}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Total Bookings</div><div style={s.statNum}>{stats.totalBookings}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Pending</div><div style={s.statNum}>{stats.pending}</div></div>
            <div style={s.statCard}><div style={s.statLabel}>Confirmed</div><div style={s.statNum}>{stats.confirmed}</div></div>
          </div>
          <div style={s.grid}>
            <div style={s.box}>
              <div style={s.boxTitle}>Recent Bookings</div>
              <div style={s.boxSubtitle}>Latest customer bookings</div>
              {recentBookings.length === 0 ? (
                <p style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: '13px' }}>No bookings yet.</p>
              ) : recentBookings.map((b) => (
                <div key={b._id} style={s.bookingRow}>
                  <div style={s.bookingIcon}></div>
                  <div>
                    <div style={s.bookingName}>{b.car?.brand} {b.car?.model}</div>
                    <div style={s.bookingDate}>{new Date(b.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={s.bookingPrice}>${b.totalPrice}</div>
                  <span style={b.status === 'confirmed' ? s.badgeConfirmed : s.badgePending}>{b.status}</span>
                </div>
              ))}
            </div>
            <div style={s.box}>
              <div style={s.boxTitle}>Monthly Revenue</div>
              <div style={s.boxSubtitle}>Revenue for current month</div>
              <div style={s.revenueNum}>${revenue}</div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default Dashboard;