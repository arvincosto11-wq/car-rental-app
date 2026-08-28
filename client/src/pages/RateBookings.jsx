import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import RatingModal from '../components/RatingModal';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

const RateBookings = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalId, setRatingModalId] = useState(null);

  useEffect(() => {
    if (!user) return navigate('/login');
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
    fetchBookings();
  }, [user]);

  const unrated = bookings.filter((b) => b.status === 'completed' && !b.carRating?.ratedAt);
  const ratingBooking = bookings.find((b) => b._id === ratingModalId);

  const handleRatingSubmitted = (carRating) => {
    setBookings(bookings.map((b) => (b._id === ratingModalId ? { ...b, carRating } : b)));
    setRatingModalId(null);
  };

  const styles = {
    container: { maxWidth: '700px', margin: '0 auto', padding: '32px' },
    backLink: { fontSize: '13px', color: isDark ? GOLD_DARK : GOLD, textDecoration: 'none', fontWeight: '500' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginTop: '10px', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    list: { display: 'flex', flexDirection: 'column', gap: '14px' },
    card: {
      display: 'flex', gap: '14px', alignItems: 'center',
      background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '14px 16px',
    },
    imgWrap: { width: '90px', height: '64px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    info: { flex: 1 },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    carSub: { fontWeight: '400', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    meta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '4px' },
    rateBtn: {
      padding: '8px 16px', fontSize: '12px', fontWeight: '600',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '6px', cursor: 'pointer',
      flexShrink: 0,
    },
  };

  return (
    <div style={styles.container}>
      <Link to="/my-bookings" style={styles.backLink}>← Back to My Bookings</Link>
      <h1 style={styles.title}>Rate My Bookings</h1>
      <p style={styles.subtitle}>Completed bookings you haven't rated yet.</p>

      {loading ? (
        <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
      ) : unrated.length === 0 ? (
        <div style={styles.empty}>
          <p>🎉 You're all caught up — nothing left to rate.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {unrated.map((booking) => (
            <div key={booking._id} className="booking-card" style={styles.card}>
              <div style={styles.imgWrap}>
                {booking.car?.image ? (
                  <img src={booking.car.image} alt="" style={styles.img} />
                ) : (
                  <div style={styles.noImg}>No Image</div>
                )}
              </div>
              <div style={styles.info}>
                <div style={styles.carName}>
                  {booking.car?.brand} {booking.car?.model}
                  <span style={styles.carSub}> · {booking.car?.year} · {booking.car?.category}</span>
                </div>
                <div style={styles.meta}>
                  📅 {new Date(booking.startDate).toLocaleDateString()} To {new Date(booking.endDate).toLocaleDateString()}
                </div>
              </div>
              <button style={styles.rateBtn} onClick={() => setRatingModalId(booking._id)}>
                Rate your experience
              </button>
            </div>
          ))}
        </div>
      )}

      {ratingModalId && ratingBooking && (
        <RatingModal
          booking={ratingBooking}
          isDark={isDark}
          onClose={() => setRatingModalId(null)}
          onSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
};

export default RateBookings;
