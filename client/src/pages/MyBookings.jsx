import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import StarRating from '../components/StarRating';
import RatingModal from '../components/RatingModal';
import { SkeletonListCard } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { paginate } from '../utils/paginate';
import useModalA11y from '../hooks/useModalA11y';
import usePageTitle from '../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

const PAGE_SIZE = 10;

// Mirrors getRefundPercentage in server/routes/bookings.js — this is only
// a preview shown before submitting; the server locks in the real amount
// at request time.
const getRefundPercentage = (startDate, now = new Date()) => {
  const hoursUntilPickup = (new Date(startDate).getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilPickup >= 48) return 100;
  if (hoursUntilPickup >= 24) return 50;
  return 0;
};

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day in timezones ahead of UTC, like PH).
const toDateValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const overlapsBooked = (start, end, ranges) => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return ranges.some((r) => s < new Date(r.endDate).getTime() && e > new Date(r.startDate).getTime());
};

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
  usePageTitle('My Bookings');
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [refundModalId, setRefundModalId] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingModalId, setRatingModalId] = useState(null);
  const [rescheduleModalId, setRescheduleModalId] = useState(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [bookedRangesForReschedule, setBookedRangesForReschedule] = useState([]);

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

  const openRescheduleModal = (booking) => {
    setRescheduleModalId(booking._id);
    setNewStartDate('');
    setNewEndDate('');
    setRescheduleError('');
    setBookedRangesForReschedule([]);
    api.get(`/cars/${booking.car._id}/booked-dates`)
      .then((res) => setBookedRangesForReschedule(res.data))
      .catch((err) => console.error(err));
  };

  const closeRescheduleModal = () => {
    setRescheduleModalId(null);
    setRescheduleError('');
  };

  const handleSelectRescheduleDay = (date) => {
    setRescheduleError('');
    const start = toDateValue(date);
    const end = new Date(date);
    end.setDate(end.getDate() + rescheduleBooking.totalDays);
    setNewStartDate(start);
    setNewEndDate(toDateValue(end));
  };

  const handleSubmitReschedule = async () => {
    if (!newStartDate || !newEndDate) {
      setRescheduleError('Tap a date on the calendar to pick your new pickup date.');
      return;
    }
    if (overlapsBooked(newStartDate, newEndDate, bookedRangesForReschedule)) {
      setRescheduleError('That range includes a date this vehicle is already booked for. Please pick a different start day.');
      return;
    }
    setRescheduleSubmitting(true);
    setRescheduleError('');
    try {
      const res = await api.post(`/bookings/${rescheduleModalId}/reschedule`, { newStartDate, newEndDate });
      setBookings(bookings.map((b) => (b._id === rescheduleModalId ? { ...b, rescheduleRequest: res.data.rescheduleRequest } : b)));
      closeRescheduleModal();
    } catch (err) {
      setRescheduleError(err.response?.data?.message || 'Failed to submit reschedule request');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const rescheduleBooking = bookings.find((b) => b._id === rescheduleModalId);
  const rescheduleModalRef = useModalA11y(closeRescheduleModal, !!(rescheduleModalId && rescheduleBooking));

  const activeBooking = bookings.find((b) => b._id === refundModalId);
  const refundPercentage = activeBooking ? getRefundPercentage(activeBooking.startDate) : 0;
  const refundAmount = activeBooking ? Math.round(activeBooking.amountPaid * (refundPercentage / 100)) : 0;
  const refundModalRef = useModalA11y(closeRefundModal, !!(refundModalId && activeBooking));

  const openRatingModal = (booking) => setRatingModalId(booking._id);
  const closeRatingModal = () => setRatingModalId(null);
  const handleRatingSubmitted = (carRating) => {
    setBookings(bookings.map((b) => (b._id === ratingModalId ? { ...b, carRating } : b)));
    closeRatingModal();
  };

  const ratingBooking = bookings.find((b) => b._id === ratingModalId);

  const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const confirmedCount = bookings.filter((b) => b.status === 'confirmed').length;
  const unratedCount = bookings.filter((b) => b.status === 'completed' && !b.carRating?.ratedAt).length;

  const totalPages = Math.max(1, Math.ceil(bookings.length / PAGE_SIZE));
  const pageBookings = paginate(bookings, page, PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const styles = {
    container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    rateBookingsBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    rateBookingsBadge: {
      background: 'rgba(0,0,0,0.2)', color: ON_GOLD, fontSize: '11px', fontWeight: '700',
      borderRadius: '20px', padding: '1px 8px', minWidth: '18px', textAlign: 'center',
    },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    statLabel: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '26px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    browseBtn: {
      marginTop: '16px',
      padding: '10px 24px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      cursor: 'pointer',
    },
    list: { display: 'flex', flexDirection: 'column', gap: '16px' },
    card: {
      display: 'flex',
      gap: '16px',
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px',
      padding: '16px',
      alignItems: 'center',
    },
    imgWrap: {
      width: '100px',
      height: '70px',
      borderRadius: '8px',
      overflow: 'hidden',
      background: isDark ? '#334155' : '#f3f4f6',
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
      color: isDark ? '#64748b' : '#9ca3af',
    },
    info: { flex: 1 },
    topRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' },
    bookingNum: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
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
    meta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '4px' },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginTop: '6px' },
    carSub: { fontWeight: '400', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    refundBtn: {
      flex: '1 1 130px',
      textAlign: 'center',
      padding: '6px 14px',
      fontSize: '12px',
      fontWeight: '500',
      background: 'none',
      color: isDark ? '#f87171' : '#dc2626',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`,
      borderRadius: '6px',
      cursor: 'pointer',
    },
    refundNote: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '8px', fontStyle: 'italic' },
    actionsRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
    rescheduleBtn: {
      flex: '1 1 130px',
      textAlign: 'center',
      padding: '6px 14px',
      fontSize: '12px',
      fontWeight: '500',
      background: 'none',
      color: isDark ? GOLD_DARK : GOLD,
      border: `1px solid ${isDark ? GOLD_DARK : GOLD}`,
      borderRadius: '6px',
      cursor: 'pointer',
    },
    bookAgainBtn: {
      padding: '6px 14px',
      fontSize: '12px',
      fontWeight: '600',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
    },
    badgeReschedulePending: {
      background: '#fef3c7',
      color: '#92400e',
      fontSize: '11px',
      padding: '2px 10px',
      borderRadius: '20px',
    },
    badgeRescheduleApproved: {
      background: '#d1fae5',
      color: '#065f46',
      fontSize: '11px',
      padding: '2px 10px',
      borderRadius: '20px',
    },
    badgeRescheduleDeclined: {
      background: '#fee2e2',
      color: '#991b1b',
      fontSize: '11px',
      padding: '2px 10px',
      borderRadius: '20px',
    },
    modalSub: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px', lineHeight: '1.5' },
    field: { marginBottom: '14px' },
    rescheduleSelectedNote: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '-6px', marginBottom: '14px' },
    ratingSummary: { marginTop: '10px' },
    ratingScore: { fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    editRatingBtn: {
      background: 'none',
      border: 'none',
      color: isDark ? GOLD_DARK : GOLD,
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
    priceLabel: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    price: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    bookedOn: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modalContent: {
      background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px',
      maxWidth: '440px', width: '90%',
    },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '14px' },
    warningBox: {
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e', fontSize: '13px',
      padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', lineHeight: '1.5',
    },
    errorBox: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', fontSize: '13px',
      padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
    },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalSelect: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#f1f5f9' : '#1a1a1a',
      background: isDark ? '#0f172a' : '#fff',
    },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: {
      flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151',
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
    },
    modalSubmitBtn: {
      flex: 1, padding: '10px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>My Bookings</h1>
          <p style={styles.subtitle}>View and manage your all car bookings</p>
        </div>
        {!loading && unratedCount > 0 && (
          <button style={styles.rateBookingsBtn} onClick={() => navigate('/my-bookings/rate')}>
            ⭐ Rate My Bookings
            <span style={styles.rateBookingsBadge}>{unratedCount}</span>
          </button>
        )}
      </div>

      {!loading && bookings.length > 0 && (
        <div className="responsive-row-3" style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Bookings</div>
            <div style={styles.statNum}>{bookings.length}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Confirmed</div>
            <div style={styles.statNum}>{confirmedCount}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Total Spent</div>
            <div style={styles.statNum}>₱{totalSpent}</div>
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonListCard isDark={isDark} />
      ) : bookings.length === 0 ? (
        <div style={styles.empty}>
          <p>No bookings yet.</p>
          <button style={styles.browseBtn} onClick={() => navigate('/cars')}>
            Browse Cars
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {pageBookings.map((booking, i) => (
            <div key={booking._id} className="booking-card" style={styles.card}>
              <div style={styles.imgWrap}>
                {booking.car?.image ? (
                  <img src={booking.car.image} alt="" style={styles.img} />
                ) : (
                  <div style={styles.noImg}>No Image</div>
                )}
              </div>
              <div style={styles.info}>
                <div style={styles.topRow}>
                  <span style={styles.bookingNum}>Booking #{(page - 1) * PAGE_SIZE + i + 1}</span>
                  <span style={getStatusStyle(booking.status)}>
                    {booking.status}
                  </span>
                  {booking.refundStatus && booking.refundStatus !== 'none' && (
                    <span style={getRefundBadgeStyle(booking.refundStatus)}>
                      {getRefundBadgeText(booking.refundStatus)}
                    </span>
                  )}
                  {booking.rescheduleRequest?.status === 'pending' && (
                    <span style={styles.badgeReschedulePending}>Reschedule Requested</span>
                  )}
                  {booking.rescheduleRequest?.status === 'declined' && (
                    <span style={styles.badgeRescheduleDeclined}>Reschedule Declined</span>
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
                    <div style={styles.actionsRow}>
                      <button style={styles.refundBtn} onClick={() => openRefundModal(booking._id)}>
                        Request Refund
                      </button>
                      {booking.rescheduleRequest?.status !== 'pending' && (
                        <button style={styles.rescheduleBtn} onClick={() => openRescheduleModal(booking)}>
                          Reschedule
                        </button>
                      )}
                    </div>
                )}
                {(booking.refundStatus === 'requested' || booking.refundStatus === 'approved') && (
                  <p style={styles.refundNote}>
                    {booking.refundStatus === 'requested' ? 'Pending refund' : 'Refund'}: ₱{booking.refundAmount?.toLocaleString() ?? 0}
                    {booking.refundReason ? ` — Reason: ${booking.refundReason}` : ''}
                  </p>
                )}
                {booking.rescheduleRequest?.status === 'declined' && booking.rescheduleRequest.adminNotes && (
                  <p style={styles.refundNote}>Reschedule declined: {booking.rescheduleRequest.adminNotes}</p>
                )}
                {booking.status === 'completed' && (
                  <div style={styles.actionsRow}>
                    <button style={styles.bookAgainBtn} onClick={() => navigate(`/cars/${booking.car._id}?book=true`)}>
                      Book Again
                    </button>
                  </div>
                )}
                {booking.status === 'completed' && booking.carRating?.ratedAt && (
                  <div style={styles.ratingSummary}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StarRating value={booking.carRating.overall} size={14} readOnly />
                      <span style={styles.ratingScore}>{booking.carRating.overall.toFixed(1)}</span>
                      <button style={styles.editRatingBtn} onClick={() => openRatingModal(booking)}>Edit rating</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="booking-card-price" style={styles.priceCol}>
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isDark={isDark} />

      {refundModalId && activeBooking && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} ref={refundModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="refund-modal-title">
            <h2 id="refund-modal-title" style={styles.modalTitle}>Request a Refund</h2>

            <div style={styles.warningBox}>
              {refundPercentage === 100 ? (
                <>✅ Your pickup date is 48+ hours away, so this qualifies for a <strong>full refund</strong>.</>
              ) : refundPercentage === 50 ? (
                <>⚠️ Your pickup date is within 48 hours, so this qualifies for a <strong>50% refund</strong> only.</>
              ) : (
                <>⚠️ Your pickup date is within 24 hours (or has already passed), so this booking is <strong>not eligible for a refund</strong>.</>
              )}
              {' '}You paid ₱{activeBooking.amountPaid}, so you would receive approximately ₱{refundAmount} back if approved.
            </div>

            {refundError && <div style={styles.errorBox}>{refundError}</div>}

            <label style={styles.modalLabel} htmlFor="refund-reason">Reason for refund</label>
            <select
              id="refund-reason"
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

      {rescheduleModalId && rescheduleBooking && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: '480px' }} ref={rescheduleModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="reschedule-modal-title">
            <h2 id="reschedule-modal-title" style={styles.modalTitle}>Request a Reschedule</h2>
            <p style={styles.modalSub}>
              Move this {rescheduleBooking.totalDays}-day trip to different dates. No fee — but it needs admin approval,
              and the new dates must total the same {rescheduleBooking.totalDays} day{rescheduleBooking.totalDays === 1 ? '' : 's'}.
              Tap a start date below — the return date is set for you automatically.
            </p>

            {rescheduleError && <div style={styles.errorBox}>{rescheduleError}</div>}

            <div style={styles.field}>
              <AvailabilityCalendar
                bookedRanges={bookedRangesForReschedule}
                selectedStart={newStartDate}
                selectedEnd={newEndDate}
                onSelectDay={handleSelectRescheduleDay}
                isDark={isDark}
              />
            </div>

            {newStartDate && newEndDate && (
              <p style={styles.rescheduleSelectedNote}>
                Selected: {new Date(newStartDate).toLocaleDateString()} → {new Date(newEndDate).toLocaleDateString()}
              </p>
            )}

            <div style={styles.modalActions}>
              <button style={styles.modalCancelBtn} onClick={closeRescheduleModal} disabled={rescheduleSubmitting}>
                Cancel
              </button>
              <button style={styles.modalSubmitBtn} onClick={handleSubmitReschedule} disabled={rescheduleSubmitting || !newStartDate}>
                {rescheduleSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ratingModalId && ratingBooking && (
        <RatingModal
          booking={ratingBooking}
          isDark={isDark}
          onClose={closeRatingModal}
          onSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
};


export default MyBookings;