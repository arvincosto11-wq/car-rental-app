import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const MyBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const getStatusStyle = (status) => {
    if (status === 'confirmed') return styles.badgeConfirmed;
    if (status === 'cancelled') return styles.badgeCancelled;
    return styles.badgePending;
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>My Bookings</h1>
      <p style={styles.subtitle}>View and manage your all car bookings</p>

      {loading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : bookings.length === 0 ? (
        <div style={styles.empty}>
          <p>No bookings yet.</p>
          <button style={styles.browseBtn} onClick={() => navigate('/cars')}>
            Browse Cars
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {bookings.map((booking, index) => (
            <div key={booking._id} style={styles.card}>
              <div style={styles.imgWrap}>
                {booking.car?.image ? (
                  <img src={booking.car.image} alt="" style={styles.img} />
                ) : (
                  <div style={styles.noImg}>No Image</div>
                )}
              </div>
              <div style={styles.info}>
                <div style={styles.topRow}>
                  <span style={styles.bookingNum}>Booking #{index + 1}</span>
                  <span style={getStatusStyle(booking.status)}>
                    {booking.status}
                  </span>
                </div>
                <div style={styles.meta}>
                  📅 Rental Period: {new Date(booking.startDate).toLocaleDateString()} To {new Date(booking.endDate).toLocaleDateString()}
                </div>
                <div style={styles.meta}>
                  📍 Pick-up Location: {booking.location}
                </div>
                <div style={styles.carName}>
                  {booking.car?.brand} {booking.car?.model}
                  <span style={styles.carSub}>
                    {' '}· {booking.car?.year} · {booking.car?.category} · {booking.car?.location}
                  </span>
                </div>
              </div>
              <div style={styles.priceCol}>
                <span style={styles.priceLabel}>Total Price</span>
                <span style={styles.price}>${booking.totalPrice}</span>
                <span style={styles.bookedOn}>
                  Booked on {new Date(booking.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
  title: { fontSize: '28px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', marginBottom: '24px' },
  empty: { textAlign: 'center', padding: '48px', color: '#6b7280' },
  browseBtn: {
    marginTop: '16px',
    padding: '10px 24px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '16px' },
  card: {
    display: 'flex',
    gap: '16px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '16px',
    alignItems: 'center',
  },
  imgWrap: {
    width: '100px',
    height: '70px',
    borderRadius: '8px',
    overflow: 'hidden',
    background: '#f3f4f6',
    flexShrink: 0,
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  noImg: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#9ca3af',
  },
  info: { flex: 1 },
  topRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  bookingNum: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  badgePending: {
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  badgeConfirmed: {
    background: '#d1fae5',
    color: '#065f46',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  badgeCancelled: {
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  meta: { fontSize: '12px', color: '#6b7280', marginBottom: '4px' },
  carName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginTop: '6px' },
  carSub: { fontWeight: '400', fontSize: '12px', color: '#6b7280' },
  priceCol: {
    textAlign: 'right',
    minWidth: '100px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  priceLabel: { fontSize: '11px', color: '#6b7280' },
  price: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a' },
  bookedOn: { fontSize: '11px', color: '#9ca3af', marginTop: '4px' },
};

export default MyBookings;