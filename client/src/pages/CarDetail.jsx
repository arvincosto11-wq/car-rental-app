import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const CarDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const res = await api.get(`/cars/${id}`);
        setCar(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    : 0;

  const totalPrice = totalDays > 0 ? totalDays * car?.pricePerDay : 0;

  const handleBooking = async () => {
    if (!user) return navigate('/login');
    if (!startDate || !endDate) return setError('Please select dates');
    if (totalDays <= 0) return setError('Return date must be after pickup date');

    setBooking(true);
    setError('');
    try {
      await api.post('/bookings', {
        carId: id,
        startDate,
        endDate,
        location: car.location,
      });
      setSuccess('Booking confirmed! Check My Bookings.');
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '40px' }}>Loading...</p>;
  if (!car) return <p style={{ textAlign: 'center', padding: '40px' }}>Car not found.</p>;

  return (
    <div style={styles.container}>
      <button style={styles.backBtn} onClick={() => navigate('/cars')}>
        ← Back to all cars
      </button>

      <div style={styles.layout}>
        <div style={styles.left}>
          <div style={styles.imgWrap}>
            {car.image ? (
              <img src={car.image} alt={car.model} style={styles.img} />
            ) : (
              <div style={styles.noImg}>No Image</div>
            )}
          </div>
          <h1 style={styles.carName}>{car.brand} {car.model}</h1>
          <p style={styles.carSub}>{car.category} · {car.year}</p>

          <div style={styles.metaGrid}>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Seats</span>
              <span style={styles.metaValue}>{car.seats}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Fuel Type</span>
              <span style={styles.metaValue}>{car.fuelType}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Transmission</span>
              <span style={styles.metaValue}>{car.transmission}</span>
            </div>
            <div style={styles.metaItem}>
              <span style={styles.metaLabel}>Location</span>
              <span style={styles.metaValue}>{car.location}</span>
            </div>
          </div>

          {car.description && (
            <p style={styles.description}>{car.description}</p>
          )}
        </div>

        <div style={styles.bookingCard}>
          <div style={styles.priceRow}>
            <span style={styles.price}>${car.pricePerDay}</span>
            <span style={styles.perDay}>per day</span>
          </div>

          {success && <div style={styles.success}>{success}</div>}
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Pickup Date</label>
            <input
              style={styles.input}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Return Date</label>
            <input
              style={styles.input}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>

          {totalDays > 0 && (
            <div style={styles.totalRow}>
              <span>{totalDays} days × ${car.pricePerDay}</span>
              <span style={styles.totalPrice}>${totalPrice}</span>
            </div>
          )}

          <button
            style={styles.bookBtn}
            onClick={handleBooking}
            disabled={booking}
          >
            {booking ? 'Booking...' : 'Book Now'}
          </button>
          <p style={styles.noCC}>No credit card required to reserve</p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { maxWidth: '1100px', margin: '0 auto', padding: '24px 32px' },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '20px',
    padding: 0,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gap: '32px',
  },
  left: {},
  imgWrap: {
    width: '100%',
    height: '300px',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#f3f4f6',
    marginBottom: '16px',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  noImg: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
  },
  carName: { fontSize: '28px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' },
  carSub: { fontSize: '15px', color: '#6b7280', marginBottom: '20px' },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '20px',
  },
  metaItem: {
    background: '#f9fafb',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'center',
  },
  metaLabel: { display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px' },
  metaValue: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  description: { fontSize: '14px', color: '#4b5563', lineHeight: '1.6' },
  bookingCard: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    height: 'fit-content',
  },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '20px' },
  price: { fontSize: '32px', fontWeight: '700', color: '#1a1a1a' },
  perDay: { fontSize: '14px', color: '#6b7280' },
  success: {
    background: '#f0fdf4',
    color: '#16a34a',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  field: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px', fontWeight: '500' },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderTop: '1px solid #e5e7eb',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '14px',
    fontSize: '14px',
    color: '#4b5563',
  },
  totalPrice: { fontWeight: '700', fontSize: '18px', color: '#1a1a1a' },
  bookBtn: {
    width: '100%',
    padding: '12px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  noCC: { textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '8px' },
};

export default CarDetail;