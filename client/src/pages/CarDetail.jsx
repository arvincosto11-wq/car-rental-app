import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';
import useModalA11y from '../hooks/useModalA11y';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import api from '../api';

const CarDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentType, setPaymentType] = useState('downpayment');
  const [bookingType, setBookingType] = useState('with-driver');
  const [profile, setProfile] = useState(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showRefundNotice, setShowRefundNotice] = useState(false);
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const termsModalRef = useModalA11y(() => setShowTerms(false), showTerms);
  const refundNoticeModalRef = useModalA11y(() => setShowRefundNotice(false), showRefundNotice);

  useEffect(() => {
    const fetchCar = async () => {
      try {
        const res = await api.get(`/cars/${id}`);
        setCar(res.data);
        const supported = res.data.availableBookingTypes?.length ? res.data.availableBookingTypes : ['self-drive', 'with-driver'];
        setBookingType(supported.includes('with-driver') ? 'with-driver' : supported[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCar();
  }, [id]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await api.get(`/cars/${id}/reviews`);
        setReviews(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [id]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        setProfile(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, [user]);

  const hasValidLicense = !!(
    profile?.licenseNumber &&
    profile?.licenseExpiry &&
    new Date(profile.licenseExpiry) >= new Date()
  );
  const supportedBookingTypes = car?.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'];
  const needsLicenseInput = bookingType === 'self-drive' && !hasValidLicense;

  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    : 0;

  const totalPrice = totalDays > 0 ? totalDays * car?.pricePerDay : 0;
  const downPayment = Math.ceil(totalPrice * 0.20);
  const amountToPay = paymentType === 'downpayment' ? downPayment : totalPrice;

  const openRefundNotice = () => {
    if (!user) return navigate('/login');
    if (!startDate || !endDate) return setError('Please select pickup and return dates');
    if (totalDays <= 0) return setError('Return date must be after pickup date');
    if (!agreedToTerms) return setError('Please agree to the Terms and Conditions');
    if (car.isAvailable === false) return setError('This car is no longer available.');
    if (needsLicenseInput) {
      if (!licenseNumber.trim() || !licenseExpiry) {
        return setError("Please provide your driver's license details to book self-drive.");
      }
      if (new Date(licenseExpiry) < new Date()) {
        return setError('That license expiry date has already passed. Please enter a valid, unexpired license.');
      }
    }
    setError('');
    setShowRefundNotice(true);
  };

  const confirmBooking = async () => {
    setBooking(true);
    setError('');
    try {
      await api.post('/bookings', {
        carId: id,
        startDate,
        endDate,
        paymentType,
        amountPaid: amountToPay,
        totalPrice,
        bookingType,
        ...(needsLicenseInput ? { licenseNumber, licenseExpiry } : {}),
      });
                  setShowRefundNotice(false);
      if (paymentType === 'full') {
        setSuccess(`Booking confirmed! Your full payment of ₱${amountToPay.toLocaleString()} has been received.`);
      } else {
        setSuccess(`Booking confirmed! You paid ₱${amountToPay.toLocaleString()} (20% downpayment) now. Remaining ₱${(totalPrice - downPayment).toLocaleString()} due upon pickup.`);
      }
      setTimeout(() => navigate('/my-bookings'), 2000);
    } catch (err) {
      setShowRefundNotice(false);
      setError(err.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '1100px', margin: '0 auto', padding: '24px 32px' },
    backBtn: { background: 'none', border: 'none', color: isDark ? '#94a3b8' : '#6b7280', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', padding: 0 },
    layout: { gap: '32px' },
    imgWrap: { width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', marginBottom: '16px' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#64748b' : '#9ca3af' },
    carName: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    carSub: { fontSize: '15px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    metaGrid: { gap: '12px', marginBottom: '20px' },
    metaItem: { background: isDark ? '#1e293b' : '#f9fafb', padding: '12px', borderRadius: '8px', textAlign: 'center', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    metaLabel: { display: 'block', fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '4px' },
    metaValue: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    description: { fontSize: '14px', color: isDark ? '#94a3b8' : '#4b5563', lineHeight: '1.6' },
    reviewsSection: { marginTop: '40px', maxWidth: '760px' },
    reviewsTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    reviewsSubtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '18px' },
    reviewCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px' },
    reviewHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
    reviewAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    reviewerName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    reviewDate: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    reviewComment: { fontSize: '13px', color: isDark ? '#cbd5e1' : '#374151', lineHeight: '1.5', marginTop: '8px' },
    reviewEmpty: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' },
    reviewFilterRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
    reviewFilterBtn: (active) => ({
      padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
      border: active ? 'none' : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#94a3b8' : '#6b7280'),
      cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    reviewPhotoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px', marginTop: '10px', maxWidth: '360px' },
    reviewPhoto: { width: '100%', height: '64px', objectFit: 'cover', borderRadius: '8px' },
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
      border: `2px solid ${active ? (isDark ? GOLD_DARK : GOLD) : isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.15)' : '#faedc7') : 'transparent',
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#94a3b8' : '#6b7280'),
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: active ? '600' : '400',
      textAlign: 'center',
    }),
    priceBreakdown: { background: isDark ? '#0f172a' : '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '14px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    licenseBox: { background: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff', border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`, borderRadius: '8px', padding: '12px', marginBottom: '14px' },
    licenseNote: { fontSize: '12px', color: isDark ? '#93c5fd' : '#1e40af', marginBottom: '10px', marginTop: 0 },
    fieldHint: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px' },
    breakdownRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    breakdownTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', borderTop: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, paddingTop: '8px', marginTop: '8px' },
    termsRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    termsLink: { color: isDark ? GOLD_DARK : GOLD, cursor: 'pointer', textDecoration: 'underline' },
    success: { background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#16a34a', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' },
    bookBtn: { width: '100%', padding: '12px', background: agreedToTerms ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#334155' : '#d1d5db'), color: agreedToTerms ? ON_GOLD : '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: agreedToTerms ? 'pointer' : 'not-allowed' },
    noCC: { textAlign: 'center', fontSize: '12px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '8px' },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '16px' },
    modalText: { fontSize: '13px', color: isDark ? '#94a3b8' : '#4b5563', lineHeight: '1.8' },
    closeBtn: { marginTop: '16px', padding: '10px 24px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
    refundNoticeActions: { display: 'flex', gap: '10px', marginTop: '20px' },
    refundNoticeCancel: { flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    refundNoticeConfirm: { flex: 1, padding: '10px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  if (loading) return (
    <div style={s.page}>
      <div className="car-detail-layout" style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px', display: 'grid', gap: '32px' }}>
        <div>
          <Skeleton height="360px" radius="12px" isDark={isDark} style={{ marginBottom: '16px' }} />
          <Skeleton height="24px" width="60%" isDark={isDark} style={{ marginBottom: '10px' }} />
          <Skeleton height="14px" width="40%" isDark={isDark} />
        </div>
        <div>
          <Skeleton height="220px" radius="12px" isDark={isDark} />
        </div>
      </div>
    </div>
  );
  if (!car) return <div style={s.page}><p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#94a3b8' : '#6b7280' }}>Car not found.</p></div>;

  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === 'with-comments') return !!r.comment;
    if (reviewFilter === 'with-photos') return r.photos && r.photos.length > 0;
    if (['5', '4', '3', '2', '1'].includes(reviewFilter)) return Math.round(r.overall) === Number(reviewFilter);
    return true;
  });

  return (
    <div style={s.page}>
      {/* Terms Modal */}
      {showTerms && (
        <div style={s.modal}>
          <div style={s.modalContent} ref={termsModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
            <h2 id="terms-modal-title" style={s.modalTitle}>Terms and Conditions</h2>
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

      {/* Refund Notice Modal */}
      {showRefundNotice && (
        <div style={s.modal}>
          <div style={s.modalContent} ref={refundNoticeModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="refund-notice-title">
            <h2 id="refund-notice-title" style={s.modalTitle}>Before You Confirm</h2>
            <div style={s.modalText}>
              <p>⚠️ <strong>Refund Policy:</strong> If you need to cancel this booking later, refunds deduct 50% of the amount you paid as a processing fee.</p>
              <p style={{ marginTop: '10px' }}>
                For example, if you pay ₱{amountToPay.toLocaleString()} now, you would receive approximately ₱{Math.round(amountToPay * 0.5).toLocaleString()} back if your refund request is later approved.
              </p>
            </div>
            <div style={s.refundNoticeActions}>
              <button style={s.refundNoticeCancel} onClick={() => setShowRefundNotice(false)} disabled={booking}>
                Cancel
              </button>
              <button style={s.refundNoticeConfirm} onClick={confirmBooking} disabled={booking}>
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={s.container}>
        <button style={s.backBtn} onClick={() => navigate('/cars')}>
          ← Back to all cars
        </button>

        <div className="car-detail-layout" style={s.layout}>
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
            {car.ratingCount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '-8px' }}>
                <StarRating value={car.avgRating} size={16} readOnly />
                <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' }}>
                  {car.avgRating.toFixed(1)}
                </span>
                <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' }}>
                  ({car.ratingCount} review{car.ratingCount === 1 ? '' : 's'})
                </span>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '-8px', marginBottom: '16px' }}>
                No reviews yet
              </p>
            )}

            <div className="meta-grid-4" style={s.metaGrid}>
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

            {car.isAvailable === false && (
              <div style={s.error}>This car is currently booked and unavailable. Check back later or browse other cars.
              </div>)}
            {success && <div style={s.success}>{success}</div>}
            {error && <div style={s.error}>{error}</div>}

            <div style={s.field}>
              <label style={s.label} htmlFor="cd-start-date">Pickup Date</label>
              <input id="cd-start-date" style={s.input} type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} />
            </div>

            <div style={s.field}>
              <label style={s.label} htmlFor="cd-end-date">Return Date</label>
              <input id="cd-end-date" style={s.input} type="date" value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate} />
            </div>

            {/* Booking Type */}
            {totalDays > 0 && (
              <>
                <label style={s.label} id="cd-booking-type-label">Booking Type</label>
                {supportedBookingTypes.length > 1 ? (
                  <div role="group" aria-labelledby="cd-booking-type-label" style={s.paymentOptions}>
                    {supportedBookingTypes.includes('with-driver') && (
                      <button
                        style={s.paymentBtn(bookingType === 'with-driver')}
                        onClick={() => setBookingType('with-driver')}
                      >
                        With Driver
                      </button>
                    )}
                    {supportedBookingTypes.includes('self-drive') && (
                      <button
                        style={s.paymentBtn(bookingType === 'self-drive')}
                        onClick={() => setBookingType('self-drive')}
                      >
                        Self Drive
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={s.fieldHint}>
                    This vehicle is available for {supportedBookingTypes[0] === 'self-drive' ? 'Self Drive' : 'With Driver'} only.
                  </p>
                )}

                {needsLicenseInput && (
                  <div style={s.licenseBox}>
                    <p style={s.licenseNote}>
                      Self-drive requires a valid driver's license on file. Add yours below to continue.
                    </p>
                    <div style={s.field}>
                      <label style={s.label} htmlFor="cd-license-number">Driver's License Number</label>
                      <input id="cd-license-number" style={s.input} type="text" placeholder="e.g. N03-12-123456"
                        value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label} htmlFor="cd-license-expiry">License Expiry Date</label>
                      <input id="cd-license-expiry" style={s.input} type="date" value={licenseExpiry}
                        onChange={(e) => setLicenseExpiry(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Payment Options */}
            {totalDays > 0 && (
              <>
                <label style={s.label} id="cd-payment-option-label">Payment Option</label>
                <div role="group" aria-labelledby="cd-payment-option-label" style={s.paymentOptions}>
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
                id="cd-agree-terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0 }}
              />
              <span>
                <label htmlFor="cd-agree-terms">I agree to the</label>{' '}
                <button type="button" style={{ ...s.termsLink, background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => setShowTerms(true)}>
                  Terms and Conditions
                </button>
              </span>
            </div>

            <button
              style={s.bookBtn}
              onClick={openRefundNotice}
              disabled={booking || !agreedToTerms || car.isAvailable === false}
            >
              {booking ? 'Booking...' : `Book Now — Pay ₱${amountToPay > 0 ? amountToPay.toLocaleString() : car.pricePerDay.toLocaleString()}`}
            </button>
                        <p style={s.noCC}>
              {paymentType === 'full' ? 'Full payment due now' : 'Remaining balance due upon vehicle pickup'} · Cash or GCash accepted
            </p>
          </div>
        </div>

        <div style={s.reviewsSection}>
          <h2 style={s.reviewsTitle}>Reviews</h2>
          <p style={s.reviewsSubtitle}>
            {car.ratingCount > 0
              ? `${car.avgRating.toFixed(1)} average from ${car.ratingCount} review${car.ratingCount === 1 ? '' : 's'}`
              : 'What renters are saying about this vehicle.'}
          </p>

          {!reviewsLoading && reviews.length > 0 && (
            <div style={s.reviewFilterRow} role="group" aria-label="Filter reviews">
              {[
                { key: 'all', label: `All (${reviews.length})` },
                { key: '5', label: `5★ (${reviews.filter((r) => Math.round(r.overall) === 5).length})` },
                { key: '4', label: `4★ (${reviews.filter((r) => Math.round(r.overall) === 4).length})` },
                { key: '3', label: `3★ (${reviews.filter((r) => Math.round(r.overall) === 3).length})` },
                { key: '2', label: `2★ (${reviews.filter((r) => Math.round(r.overall) === 2).length})` },
                { key: '1', label: `1★ (${reviews.filter((r) => Math.round(r.overall) === 1).length})` },
                { key: 'with-comments', label: `With Comments (${reviews.filter((r) => r.comment).length})` },
                { key: 'with-photos', label: `With Photos (${reviews.filter((r) => r.photos?.length).length})` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  style={s.reviewFilterBtn(reviewFilter === f.key)}
                  onClick={() => setReviewFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {reviewsLoading ? (
            <Skeleton height="80px" radius="12px" isDark={isDark} />
          ) : reviews.length === 0 ? (
            <p style={s.reviewEmpty}>No reviews yet — be the first to rent and rate this vehicle.</p>
          ) : filteredReviews.length === 0 ? (
            <p style={s.reviewEmpty}>No reviews match this filter.</p>
          ) : (
            filteredReviews.map((r) => (
              <div key={r._id} style={s.reviewCard}>
                <div style={s.reviewHeader}>
                  <span style={s.reviewAvatar}>{r.reviewerName.charAt(0)}</span>
                  <div>
                    <div style={s.reviewerName}>{r.reviewerName}</div>
                    <div style={s.reviewDate}>{new Date(r.ratedAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <StarRating value={r.overall} size={14} readOnly />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' }}>{r.overall.toFixed(1)}</span>
                  </div>
                </div>
                {r.comment && <p style={s.reviewComment}>{r.comment}</p>}
                {r.photos?.length > 0 && (
                  <div style={s.reviewPhotoGrid}>
                    {r.photos.map((p, i) => (
                      <img key={i} src={p.url} alt={`Review photo ${i + 1}`} style={s.reviewPhoto} />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CarDetail;