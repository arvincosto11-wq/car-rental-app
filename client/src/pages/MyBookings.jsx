import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import StarRating from '../components/StarRating';

const REFUND_REASONS = [
  'Change of travel plans – Trip was canceled, postponed, or dates changed.',
  'Personal reasons',
  'Flight cancellation or delay',
  'Booking error',
  'Mistake in booking information',
  'No longer needs the vehicle',
  'Other/unspecified reason',
];

const MyBookings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refundModalId, setRefundModalId] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingModalId, setRatingModalId] = useState(null);
  const [ratingForm, setRatingForm] = useState({ vehicleCondition: 0, serviceQuality: 0, cleanliness: 0, comment: '' });
  const [ratingError, setRatingError] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

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
    if (status === 'completed') return styles.badgeCompleted;
    return styles.badgePending;
  };

  const getRefundBadgeStyle = (refundStatus) => {
    if (refundStatus === 'requested') return styles.badgeRefundRequested;
    if (refundStatus === 'approved') return styles.badgeRefundApproved;
    if (refundStatus === 'declined') return styles.badgeRefundDeclined;
    return null;
  };

  const getRefundBadgeText = (refundStatus) => {
    if (refundStatus === 'requested') return 'Refund Requested';
    if (refundStatus === 'approved') return 'Refund Approved';
    if (refundStatus === 'declined') return 'Refund Declined';
    return '';
  };

  const openRefundModal = (bookingId) => {
    setRefundModalId(bookingId);
    setRefundReason('');
    setRefundError('');
  };

  const closeRefundModal = () => {
    setRefundModalId(null);
    setRefundReason('');
    setRefundError('');
  };

  const handleSubmitRefund = async () => {
    if (!refundReason) {
      setRefundError('Please select a reason for your refund request.');
      return;
    }
    setSubmitting(true);
    setRefundError('');
    try {
      const res = await api.post(`/bookings/${refundModalId}/refund`, { reason: refundReason });
      setBookings(bookings.map((b) =>
        b._id === refundModalId
          ? { ...b, refundStatus: res.data.refundStatus, refundReason: res.data.refundReason }
          : b
      ));
      closeRefundModal();
    } catch (err) {
      setRefundError(err.response?.data?.message || 'Failed to submit refund request');
    } finally {
      setSubmitting(false);
    }
  };

  const activeBooking = bookings.find((b) => b._id === refundModalId);
  const refundAmount = activeBooking ? Math.round(activeBooking.amountPaid * 0.5) : 0;

  const openRatingModal = (booking) => {
    setRatingModalId(booking._id);
    setRatingForm({
      vehicleCondition: booking.carRating?.vehicleCondition || 0,
      serviceQuality: booking.carRating?.serviceQuality || 0,
      cleanliness: booking.carRating?.cleanliness || 0,
      comment: booking.carRating?.comment || '',
    });
    setRatingError('');
  };

  const closeRatingModal = () => {
    setRatingModalId(null);
    setRatingError('');
  };

  const handleSubmitRating = async () => {
    const { vehicleCondition, serviceQuality, cleanliness, comment } = ratingForm;
    if (!vehicleCondition || !serviceQuality || !cleanliness) {
      setRatingError('Please rate all three categories.');
      return;
    }
    setRatingSubmitting(true);
    setRatingError('');
    try {
      const res = await api.post(`/bookings/${ratingModalId}/rate-car`, {
        vehicleCondition, serviceQuality, cleanliness, comment,
      });
      setBookings(bookings.map((b) => (b._id === ratingModalId ? res.data : b)));
      closeRatingModal();
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const ratingBooking = bookings.find((b) => b._id === ratingModalId);

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
                  {booking.refundStatus && booking.refundStatus !== 'none' && (
                    <span style={getRefundBadgeStyle(booking.refundStatus)}>
                      {getRefundBadgeText(booking.refundStatus)}
                    </span>
                  )}
                </div>
                <div style={styles.meta}>
                  📅 Rental Period: {new Date(booking.startDate).toLocaleDateString()} To {new Date(booking.endDate).toLocaleDateString()}
                </div>
                <div style={styles.carName}>
                  {booking.car?.brand} {booking.car?.model}
                  <span style={styles.carSub}>
                    {' '}· {booking.car?.year} · {booking.car?.category}
                  </span>
                </div>

                {(booking.status === 'pending' || booking.status === 'confirmed') &&
                  (!booking.refundStatus || booking.refundStatus === 'none') && (
                    <button style={styles.refundBtn} onClick={() => openRefundModal(booking._id)}>
                      Request Refund
                    </button>
                )}
                {(booking.refundStatus === 'requested' || booking.refundStatus === 'approved') && booking.refundReason && (
                  <p style={styles.refundNote}>Reason: {booking.refundReason}</p>
                )}
                {booking.status === 'completed' && (
                  booking.carRating?.ratedAt ? (
                    <div style={styles.ratingSummary}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StarRating value={booking.carRating.overall} size={14} readOnly />
                        <span style={styles.ratingScore}>{booking.carRating.overall.toFixed(1)}</span>
                        <button style={styles.editRatingBtn} onClick={() => openRatingModal(booking)}>Edit rating</button>
                      </div>
                    </div>
                  ) : (
                    <button style={styles.rateBtn} onClick={() => openRatingModal(booking)}>
                      Rate your experience
                    </button>
                  )
                )}
              </div>
              <div style={styles.priceCol}>
                <span style={styles.priceLabel}>Total Price</span>
                <span style={styles.price}>₱{booking.totalPrice}</span>
                <span style={styles.bookedOn}>
                  Booked on {new Date(booking.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {refundModalId && activeBooking && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Request a Refund</h2>

            <div style={styles.warningBox}>
              ⚠️ Refunds deduct 50% of the amount you paid as a processing fee.
              You paid ₱{activeBooking.amountPaid}, so you would receive approximately ₱{refundAmount} back if approved.
            </div>

            {refundError && <div style={styles.errorBox}>{refundError}</div>}

            <label style={styles.modalLabel}>Reason for refund</label>
            <select
              style={styles.modalSelect}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            >
              <option value="">Select a reason...</option>
              {REFUND_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>

            <div style={styles.modalActions}>
              <button style={styles.modalCancelBtn} onClick={closeRefundModal} disabled={submitting}>
                Cancel
              </button>
              <button style={styles.modalSubmitBtn} onClick={handleSubmitRefund} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingModalId && ratingBooking && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Rate Your Experience</h2>

            {ratingError && <div style={styles.errorBox}>{ratingError}</div>}

            {[
              { key: 'vehicleCondition', label: 'Vehicle Condition' },
              { key: 'serviceQuality', label: 'Service Quality' },
              { key: 'cleanliness', label: 'Cleanliness' },
            ].map(({ key, label }) => (
              <div key={key} style={{ marginBottom: '14px' }}>
                <label style={styles.modalLabel}>{label}</label>
                <StarRating
                  value={ratingForm[key]}
                  onChange={(n) => setRatingForm({ ...ratingForm, [key]: n })}
                  size={22}
                />
              </div>
            ))}

            <label style={styles.modalLabel}>Comment (optional)</label>
            <textarea
              style={styles.modalTextarea}
              rows={3}
              value={ratingForm.comment}
              onChange={(e) => setRatingForm({ ...ratingForm, comment: e.target.value })}
              placeholder="Tell us more about your experience..."
            />

            <div style={styles.modalActions}>
              <button style={styles.modalCancelBtn} onClick={closeRatingModal} disabled={ratingSubmitting}>
                Cancel
              </button>
              <button style={styles.modalSubmitBtn} onClick={handleSubmitRating} disabled={ratingSubmitting}>
                {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
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
  topRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' },
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
  badgeCompleted: {
    background: '#dbeafe',
    color: '#1e40af',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  badgeRefundRequested: {
    background: '#fef3c7',
    color: '#92400e',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  badgeRefundApproved: {
    background: '#dbeafe',
    color: '#1e40af',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  badgeRefundDeclined: {
    background: '#fee2e2',
    color: '#991b1b',
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '20px',
  },
  meta: { fontSize: '12px', color: '#6b7280', marginBottom: '4px' },
  carName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a', marginTop: '6px' },
  carSub: { fontWeight: '400', fontSize: '12px', color: '#6b7280' },
  refundBtn: {
    marginTop: '10px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '500',
    background: 'none',
    color: '#dc2626',
    border: '1px solid #dc2626',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  refundNote: { fontSize: '12px', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' },
  rateBtn: {
    marginTop: '10px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '500',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  ratingSummary: { marginTop: '10px' },
  ratingScore: { fontSize: '13px', fontWeight: '600', color: '#1a1a1a' },
  editRatingBtn: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
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
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalContent: {
    background: '#fff', borderRadius: '12px', padding: '24px',
    maxWidth: '440px', width: '90%',
  },
  modalTitle: { fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '14px' },
  warningBox: {
    background: '#fef3c7', color: '#92400e', fontSize: '13px',
    padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', lineHeight: '1.5',
  },
  errorBox: {
    background: '#fef2f2', color: '#dc2626', fontSize: '13px',
    padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
  },
  modalLabel: { display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px', fontWeight: '500' },
  modalSelect: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: '#1a1a1a',
  },
  modalTextarea: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
    borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: '#1a1a1a',
    fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
  },
  modalActions: { display: 'flex', gap: '10px' },
  modalCancelBtn: {
    flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151',
    border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
  },
  modalSubmitBtn: {
    flex: 1, padding: '10px', background: '#2563eb', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600',
  },
};

export default MyBookings;