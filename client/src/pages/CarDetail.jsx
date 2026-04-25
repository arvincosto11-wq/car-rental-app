import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const CarDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentType, setPaymentType] = useState('downpayment');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
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
  const downPayment = Math.ceil(totalPrice * 0.20);
  const amountToPay = paymentType === 'downpayment' ? downPayment : totalPrice;

  const handleBooking = async () => {
    if (!user) return navigate('/login');
    if (!startDate || !endDate) return setError('Please select pickup and return dates');
    if (totalDays <= 0) return setError('Return date must be after pickup date');
    if (!agreedToTerms) return setError('Please agree to the Terms and Conditions');

    setBooking(true);
    setError('');
    try {
      await api.post('/bookings', {
        carId: id,
        startDate,
        endDate,
        location: car.location,
        paymentType,
        amountPaid: amountToPay,
        totalPrice,
      });
      setSuccess(`Booking confirmed! You will pay ₱${amountToPay.toLocaleString()} ${paymentType === 'downpayment' ? '(20% downpayment)' : '(full payment)'} upon pickup.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '1100px', margin: '0 auto', padding: '24px 32px' },
    backBtn: { background: 'none', border: 'none', color: isDark ? '#94a3b8' : '#6b7280', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', padding: 0 },
    layout: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px' },
    imgWrap: { width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', marginBottom: '16px' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#64748b' : '#9ca3af' },
    carName: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    carSub: { fontSize: '15px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' },
    metaItem: { background: isDark ? '#1e293b' : '#f9fafb', padding: '12px', borderRadius: '8px', textAlign: 'center', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    metaLabel: { display: 'block', fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '4px' },
    metaValue: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    description: { fontSize: '14px', color: isDark ? '#94a3b8' : '#4b5563', lineHeight: '1.6' },
    bookingCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '20px', height: 'fit-content' },
    priceRow: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' },
    price: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    perDay: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280' },
    field: { marginBottom: '14px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    paymentOptions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' },
    paymentBtn: (active) => ({
      padding: '10px',
      borderRadius: '8px',
      border: `2px solid ${active ? '#2563eb' : isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? '#1e40af' : '#eff6ff') : 'transparent',
      color: active ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#94a3b8' : '#6b7280'),
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? '600' : '400',
      textAlign: 'center',
    }),
    priceBreakdown: { background: isDark ? '#0f172a' : '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '14px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    breakdownRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    breakdownTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', borderTop: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, paddingTop: '8px', marginTop: '8px' },
    termsRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    termsLink: { color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' },
    success: { background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#16a34a', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' },
    bookBtn: { width: '100%', padding: '12px', background: agreedToTerms ? '#2563eb' : (isDark ? '#334155' : '#d1d5db'), color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: agreedToTerms ? 'pointer' : 'not-allowed' },
    noCC: { textAlign: 'center', fontSize: '12px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '8px' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '16px' },
    modalText: { fontSize: '13px', color: isDark ? '#94a3b8' : '#4b5563', lineHeight: '1.8' },
    closeBtn: { marginTop: '16px', padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
  };

  if (loading) return <div style={s.page}><p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p></div>;
  if (!car) return <div style={s.page}><p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#94a3b8' : '#6b7280' }}>Car not found.</p></div>;

  return (
    <div style={s.page}>
      {/* Terms Modal */}
      {showTerms && (
        <div style={s.modal}>
          <div style={s.modalContent}>
            <h2 style={s.modalTitle}>Terms and Conditions</h2>
            <div style={s.modalText}>
              <p><strong>1. Booking Policy</strong></p>
              <p>A minimum of 20% downpayment is required to confirm your booking. The remaining balance must be paid upon vehicle pickup.</p>
              <br/>
              <p><strong>2. Cancellation Policy</strong></p>
              <p>Cancellations made 48 hours before pickup are eligible for a full refund. Cancellations made within 24 hours of pickup are non-refundable.</p>
              <br/>
              <p><strong>3. Vehicle Usage</strong></p>
              <p>The rented vehicle must be used only for lawful purposes. The renter is responsible for any traffic violations, fines, or damages incurred during the rental period.</p>
              <br/>
              <p><strong>4. Fuel Policy</strong></p>
              <p>The vehicle will be provided with a full tank. The renter must return it with the same fuel level or pay the difference.</p>
              <br/>
              <p><strong>5. Damage Policy</strong></p>
              <p>The renter is liable for any damage to the vehicle during the rental period. Urban Wheels Car Rental reserves the right to charge for repairs.</p>
              <br/>
              <p><strong>6. Payment</strong></p>
              <p>Accepted payment methods include cash, GCash, and credit/debit card. Full payment must be settled before the vehicle is released.</p>
              <br/>
              <p><strong>7. Late Returns</strong></p>
              <p>Late returns will be charged an additional fee equivalent to one day's rental rate per day of delay.</p>
            </div>
            <button style={s.closeBtn} onClick={() => setShowTerms(false)}>
              I Understand — Close
            </button>
          </div>
        </div>
      )}

      <div style={s.container}>
        <button style={s.backBtn} onClick={() => navigate('/cars')}>
          ← Back to all cars
        </button>

        <div style={s.layout}>
          {/* Left */}
          <div>
            <div style={s.imgWrap}>
              {car.image ? (
                <img src={car.image} alt={car.model} style={s.img} />
              ) : (
                <div style={s.noImg}>No Image</div>
              )}
            </div>
            <h1 style={s.carName}>{car.brand} {car.model}</h1>
            <p style={s.carSub}>{car.category} · {car.year}</p>

            <div style={s.metaGrid}>
              <div style={s.metaItem}>
                <span style={s.metaLabel}>Seats</span>
                <span style={s.metaValue}>{car.seats}</span>
              </div>
              <div style={s.metaItem}>
                <span style={s.metaLabel}>Fuel</span>
                <span style={s.metaValue}>{car.fuelType}</span>
              </div>
              <div style={s.metaItem}>
                <span style={s.metaLabel}>Transmission</span>
                <span style={s.metaValue}>{car.transmission}</span>
              </div>
              <div style={s.metaItem}>
                <span style={s.metaLabel}>Location</span>
                <span style={s.metaValue}>{car.location}</span>
              </div>
            </div>

            {car.description && (
              <p style={s.description}>{car.description}</p>
            )}
          </div>

          {/* Booking Card */}
          <div style={s.bookingCard}>
            <div style={s.priceRow}>
              <span style={s.price}>₱{car.pricePerDay.toLocaleString()}</span>
              <span style={s.perDay}>per day</span>
            </div>

            {success && <div style={s.success}>{success}</div>}
            {error && <div style={s.error}>{error}</div>}

            <div style={s.field}>
              <label style={s.label}>Pickup Date</label>
              <input style={s.input} type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Return Date</label>
              <input style={s.input} type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate} />
            </div>

            {/* Payment Options */}
            {totalDays > 0 && (
              <>
                <label style={s.label}>Payment Option</label>
                <div style={s.paymentOptions}>
                  <button
                    style={s.paymentBtn(paymentType === 'downpayment')}
                    onClick={() => setPaymentType('downpayment')}
                  >
                    20% Down
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>
                      ₱{downPayment.toLocaleString()}
                    </div>
                  </button>
                  <button
                    style={s.paymentBtn(paymentType === 'full')}
                    onClick={() => setPaymentType('full')}
                  >
                    Full Payment
                    <div style={{ fontSize: '12px', marginTop: '2px' }}>
                      ₱{totalPrice.toLocaleString()}
                    </div>
                  </button>
                </div>

                {/* Price Breakdown */}
                <div style={s.priceBreakdown}>
                  <div style={s.breakdownRow}>
                    <span>{totalDays} days × ₱{car.pricePerDay.toLocaleString()}</span>
                    <span>₱{totalPrice.toLocaleString()}</span>
                  </div>
                  {paymentType === 'downpayment' && (
                    <div style={s.breakdownRow}>
                      <span>Remaining balance</span>
                      <span>₱{(totalPrice - downPayment).toLocaleString()}</span>
                    </div>
                  )}
                  <div style={s.breakdownTotal}>
                    <span>{paymentType === 'downpayment' ? 'Due now (20%)' : 'Total due'}</span>
                    <span>₱{amountToPay.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}

            {/* Terms and Conditions */}
            <div style={s.termsRow}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0 }}
              />
              <span>
                I agree to the{' '}
                <span style={s.termsLink} onClick={() => setShowTerms(true)}>
                  Terms and Conditions
                </span>
              </span>
            </div>

            <button
              style={s.bookBtn}
              onClick={handleBooking}
              disabled={booking || !agreedToTerms}
            >
              {booking ? 'Booking...' : `Book Now — Pay ₱${amountToPay > 0 ? amountToPay.toLocaleString() : car.pricePerDay.toLocaleString()}`}
            </button>
            <p style={s.noCC}>Payment upon vehicle pickup · Cash or GCash accepted</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarDetail;