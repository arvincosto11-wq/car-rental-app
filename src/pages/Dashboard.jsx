import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const Dashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/my');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const pending = bookings.filter((b) => b.status === 'pending').length;

  const getStatusStyle = (status) => {
    if (status === 'confirmed') return s.badgeConfirmed;
    if (status === 'cancelled') return s.badgeCancelled;
    return s.badgePending;
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
    header: { marginBottom: '24px' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    statLabel: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '26px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    sectionTitle: { fontSize: '18px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '16px' },
    card: { display: 'flex', gap: '16px', background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px', alignItems: 'center' },
    imgWrap: { width: '100px', height: '70px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    info: { flex: 1 },
    topRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
    bookingNum: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    meta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '4px' },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginTop: '6px' },
    carSub: { fontWeight: '400', fontSize: '12px', color: isDark ? '#64748b' : '#6b7280' },
    priceCol: { textAlign: 'right', minWidth: '100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    priceLabel: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    price: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    bookedOn: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    badgePending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    badgeConfirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    badgeCancelled: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    browseBtn: { marginTop: '16px', padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.header}>
          <h1 style={s.title}>My Dashboard</h1>
          <p style={s.subtitle}>Welcome back, {user?.name}! Here's your booking overview.</p>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Total Bookings</div>
            <div style={s.statNum}>{bookings.length}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Confirmed</div>
            <div style={s.statNum}>{confirmed}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Total Spent</div>
            <div style={s.statNum}>${totalSpent}</div>
          </div>
        </div>

        {/* Booking History */}
        <div style={s.sectionTitle}>Booking History</div>

        {loading ? (
          <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
        ) : bookings.length === 0 ? (
          <div style={s.empty}>
            <p>No bookings yet.</p>
            <button style={s.browseBtn} onClick={() => navigate('/cars')}>
              Browse Cars
            </button>
          </div>
        ) : (
          bookings.map((booking, index) => (
            <div key={booking._id} style={s.card}>
              <div style={s.imgWrap}>
                {booking.car?.image ? (
                  <img src={booking.car.image} alt="" style={s.img} />
                ) : (
                  <div style={s.noImg}>No Image</div>
                )}
              </div>
              <div style={s.info}>
                <div style={s.topRow}>
                  <span style={s.bookingNum}>Booking #{index + 1}</span>
                  <span style={getStatusStyle(booking.status)}>{booking.status}</span>
                </div>
                <div style={s.meta}>📅 {new Date(booking.startDate).toLocaleDateString()} → {new Date(booking.endDate).toLocaleDateString()}</div>
                <div style={s.meta}>📍 {booking.location}</div>
                <div style={s.carName}>
                  {booking.car?.brand} {booking.car?.model}
                  <span style={s.carSub}> · {booking.car?.year} · {booking.car?.category}</span>
                </div>
              </div>
              <div style={s.priceCol}>
                <span style={s.priceLabel}>Total Price</span>
                <span style={s.price}>${booking.totalPrice}</span>
                <span style={s.bookedOn}>Booked on {new Date(booking.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;