import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import ClientRatingModal from '../../components/ClientRatingModal';
import { SkeletonListCard } from '../../components/Skeleton';
import api from '../../api';

const RateClients = () => {
  const { isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalId, setRatingModalId] = useState(null);

  useEffect(() => { fetchBookings(); }, []);

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

  const unrated = bookings.filter((b) => b.status === 'completed' && !b.clientRating?.ratedAt);
  const ratingBooking = bookings.find((b) => b._id === ratingModalId);

  const handleRatingSubmitted = async () => {
    await fetchBookings();
    setRatingModalId(null);
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    list: { display: 'flex', flexDirection: 'column', gap: '14px' },
    card: {
      display: 'flex', gap: '14px', alignItems: 'center',
      background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '14px 16px',
    },
    imgWrap: { width: '80px', height: '58px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    info: { flex: 1, minWidth: 0 },
    clientName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    clientMeta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    carMeta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '4px' },
    rateBtn: {
      padding: '8px 16px', fontSize: '12px', fontWeight: '600',
      background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer',
      flexShrink: 0,
    },
  };

  return (
    <AdminLayout activePage="Manage Bookings">
      <h1 style={s.title}>Rate Clients</h1>
      <p style={s.subtitle}>Completed bookings where the client hasn't been rated yet.</p>

      {loading ? (
        <SkeletonListCard isDark={isDark} />
      ) : unrated.length === 0 ? (
        <div style={s.empty}>
          <p>🎉 All returned bookings have been rated.</p>
        </div>
      ) : (
        <div style={s.list}>
          {unrated.map((booking) => (
            <div key={booking._id} className="booking-card" style={s.card}>
              <div style={s.imgWrap}>
                {booking.car?.image ? (
                  <img src={booking.car.image} alt="" style={s.img} />
                ) : (
                  <div style={s.noImg}>No Image</div>
                )}
              </div>
              <div style={s.info}>
                <div style={s.clientName}>{booking.user?.name || 'Unknown'}</div>
                <div style={s.clientMeta}>{booking.user?.email}</div>
                <div style={s.carMeta}>
                  {booking.car?.brand} {booking.car?.model} · {new Date(booking.startDate).toLocaleDateString()} to {new Date(booking.endDate).toLocaleDateString()}
                </div>
              </div>
              <button style={s.rateBtn} onClick={() => setRatingModalId(booking._id)}>
                Rate Client
              </button>
            </div>
          ))}
        </div>
      )}

      {ratingModalId && ratingBooking && (
        <ClientRatingModal
          booking={ratingBooking}
          isDark={isDark}
          onClose={() => setRatingModalId(null)}
          onSubmitted={handleRatingSubmitted}
        />
      )}
    </AdminLayout>
  );
};

export default RateClients;
