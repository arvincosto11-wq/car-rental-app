import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { useNotifications } from '../context/NotificationContext';
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

// Small stat-card icons — same hand-drawn inline-SVG approach used
// elsewhere on the site rather than pulling in an icon library.
const StatIcon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const BookingsIcon = () => <StatIcon><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="13" x2="12" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></StatIcon>;
const ConfirmedIcon = () => <StatIcon><path d="M12 3l2.3 2.3 3.2-.4.4 3.2L20 10l-2.1 2.5.4 3.2-3.2.4L12 18.4l-2.3-2.3-3.2.4-.4-3.2L4 10.5l2.1-2.4-.4-3.2 3.2-.4L12 3z" /><polyline points="9 11 11 13 15 9" /></StatIcon>;
const SpentIcon = () => <StatIcon><circle cx="12" cy="12" r="9" /><path d="M9 8h4a2 2 0 1 1 0 4H9h4a2 2 0 1 1 0 4H9" /><line x1="9" y1="6" x2="9" y2="18" /></StatIcon>;

// Small inline icons used inline with text on each booking card.
const LineIcon = ({ children, size = 13, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color }}>
    {children}
  </svg>
);
const CarLineIcon = (props) => <LineIcon {...props}><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></LineIcon>;
const CalendarLineIcon = (props) => <LineIcon {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></LineIcon>;
const PinLineIcon = (props) => <LineIcon {...props}><path d="M12 21s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></LineIcon>;
const ReturnLineIcon = (props) => <LineIcon {...props}><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" /></LineIcon>;
const TagLineIcon = (props) => <LineIcon {...props}><path d="M20.6 12.6L12.6 20.6a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1 0-2.8L11.4 3.4A2 2 0 0 1 12.8 3H19a2 2 0 0 1 2 2v6.2a2 2 0 0 1-.4 1.4z" /><circle cx="16" cy="8" r="1.3" /></LineIcon>;
// Action-button icons. stroke="currentColor" (from LineIcon) means each
// one picks up its own button's color — no per-icon color rules needed.
const CalendarPlusIcon = (props) => <LineIcon {...props}><rect x="3" y="4" width="18" height="17" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="12" y1="13" x2="12" y2="17" /><line x1="10" y1="15" x2="14" y2="15" /></LineIcon>;
const RepeatIcon = (props) => <LineIcon {...props}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></LineIcon>;
const PencilIcon = (props) => <LineIcon {...props}><path d="M17 3l4 4-11 11H6v-4z" /><line x1="14" y1="6" x2="18" y2="10" /></LineIcon>;

// Mirrors getRefundPercentage in server/routes/bookings.js (based on time
// since the booking was made, not the pickup date) — this is only a preview
// shown before submitting; the server locks in the real amount at request time.
const getRefundPercentage = (createdAt, now = new Date()) => {
  const hoursSinceBooking = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceBooking <= 12) return 100;
  if (hoursSinceBooking <= 24) return 50;
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
  const { toast } = useUIFeedback();
  const { notifications, markReadByLinkPrefix } = useNotifications();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [refundModalId, setRefundModalId] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retryingPaymentId, setRetryingPaymentId] = useState(null);
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

  // The nav badge is driven by unread notifications, which only clear when
  // the client opens the bell and clicks each one — so it stayed lit even
  // after they'd already come here and seen the update. Landing on this
  // page is itself "seeing it", so clear anything pointing here the moment
  // notifications are loaded (and again whenever a new one comes in).
  useEffect(() => {
    markReadByLinkPrefix('/my-bookings');
  }, [notifications]);

  // Landed back here from the PayMongo GCash redirect — check the real
  // payment status right away instead of waiting on the webhook, then drop
  // the query params so a page refresh doesn't re-trigger this.
  useEffect(() => {
    if (!user) return;
    const gcashResult = searchParams.get('gcash');
    const bookingId = searchParams.get('bookingId');
    if (!gcashResult || !bookingId) return;

    const checkStatus = async () => {
      try {
        const res = await api.get(`/payments/gcash/status/${bookingId}`);
        if (res.data.payment === 'paid') {
          toast.success('GCash payment received! Your booking is awaiting admin confirmation.');
        } else if (gcashResult === 'cancelled') {
          toast.info('GCash payment cancelled. Your booking is still saved as pending — request a refund below if you no longer want it, or contact us to complete payment.');
        } else {
          toast.error("We couldn't confirm the GCash payment yet. Please check back shortly.");
        }
        const res2 = await api.get('/bookings/my');
        setBookings(res2.data);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchParams({}, { replace: true });
      }
    };
    checkStatus();
  }, [user, searchParams]);

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

  // Re-attempts GCash payment for a booking that already exists but never
  // completed payment (abandoned/cancelled checkout) — same endpoint the
  // original booking flow uses, just re-run for the same booking instead
  // of creating a new one.
  const handleRetryPayment = async (bookingId) => {
    setRetryingPaymentId(bookingId);
    try {
      const { data } = await api.post('/payments/gcash/checkout-session', { bookingId });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start the GCash payment. Please try again.');
      setRetryingPaymentId(null);
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
  const refundPercentage = activeBooking ? getRefundPercentage(activeBooking.createdAt) : 0;
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

  // "Upcoming" here is the same underlying 'confirmed' status Manage Bookings
  // uses — just relabeled for how a client actually thinks about a booking
  // that's been accepted and is waiting on pickup.
  const statusTabs = [
    { value: 'all', label: 'All', count: bookings.length },
    { value: 'pending', label: 'Pending', count: bookings.filter((b) => b.status === 'pending').length },
    { value: 'confirmed', label: 'Upcoming', count: bookings.filter((b) => b.status === 'confirmed').length },
    { value: 'completed', label: 'Completed', count: bookings.filter((b) => b.status === 'completed').length },
    { value: 'cancelled', label: 'Cancelled', count: bookings.filter((b) => b.status === 'cancelled').length },
  ];
  const filteredBookings = statusFilter === 'all' ? bookings : bookings.filter((b) => b.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const pageBookings = paginate(filteredBookings, page, PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const styles = {
    container: { maxWidth: '1100px', margin: '0 auto', padding: '32px' },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: {
      fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: '900', letterSpacing: '-0.01em',
      textTransform: 'uppercase', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px',
    },
    subtitle: { fontSize: '14px', fontStyle: 'italic', color: isDark ? GOLD_DARK : GOLD, marginBottom: '24px' },
    rateBookingsBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    rateBookingsBadge: {
      background: 'rgba(0,0,0,0.2)', color: ON_GOLD, fontSize: '11px', fontWeight: '700',
      borderRadius: '20px', padding: '1px 8px', minWidth: '18px', textAlign: 'center',
    },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: {
      display: 'flex', alignItems: 'center', gap: '14px',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '14px', padding: '18px',
    },
    statIconBadge: (bg, color) => ({
      width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
      background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    statLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '4px' },
    statNum: { fontSize: '26px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    statusTabRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' },
    statusTab: (active) => ({
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '8px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: '600',
      border: active ? 'none' : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#242526' : '#fff'),
      color: active ? ON_GOLD : (isDark ? '#e4e6eb' : '#374151'),
      cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    statusTabCount: (active) => ({
      fontSize: '12px', fontWeight: '600', opacity: active ? 0.85 : 0.6,
    }),
    statusTabDot: { width: '7px', height: '7px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#b0b3b8' : '#6b7280' },
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
      flexDirection: 'column',
      gap: '20px',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '32px',
      padding: '40px',
    },
    // One shared 3-column grid (image | details | price) for the whole top
    // portion of the card, INCLUDING the action buttons row — not two
    // separate grids with a matching template, because two independent
    // grids don't actually compute the same column widths when one has
    // content in column 3 and the other doesn't (auto/1fr tracks size off
    // real content, not just the template string). One grid guarantees the
    // divider (row 2, column 2) is exactly as wide as the details above it
    // (row 1, column 2), no guessing.
    topSection: {
      display: 'grid', gridTemplateColumns: '170px minmax(0,1fr) auto', columnGap: '34px', rowGap: '12px',
    },
    imgWrapCell: { gridColumn: '1', gridRow: '1 / span 2' },
    middleCol: { gridColumn: '2', gridRow: '1', display: 'flex', flexDirection: 'column', minWidth: 0 },
    priceColCell: { gridColumn: '3', gridRow: '1' },
    actionsCell: { gridColumn: '2', gridRow: '2' },
    // Column 3 of the row the action buttons sit in, so the savings line
    // ends up level with them instead of stacked under the total.
    savedCell: {
      gridColumn: '3', gridRow: '2',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    },
    detailsRow: { display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' },
    // Ambient glow color follows the booking's own status — confirmed
    // (upcoming) is the one that actually needs attention, so it gets the
    // most prominent glow; cancelled fades into the background since
    // there's nothing left to do with it. Hover state (see .booking-card
    // in index.css) overrides this with a warm gold glow + lift regardless
    // of status, as the "this is interactive" cue.
    cardGlow: (status) => {
      // Confirmed/pending (the two "still active, needs attention" states)
      // carry a faint gold wash across the card, not just the border glow.
      const goldWash = isDark
        ? 'linear-gradient(180deg, rgba(232,161,0,0.07), transparent 45%), #242526'
        : 'linear-gradient(180deg, rgba(184,121,10,0.06), transparent 45%), #fff';
      if (status === 'confirmed') {
        return {
          background: goldWash,
          boxShadow: isDark ? '0 0 0 1px rgba(22,163,74,0.35), 0 8px 28px rgba(22,163,74,0.18)' : '0 8px 24px rgba(22,163,74,0.12)',
        };
      }
      if (status === 'completed') {
        return { boxShadow: isDark ? '0 0 0 1px rgba(37,99,235,0.25), 0 6px 20px rgba(37,99,235,0.1)' : '0 6px 18px rgba(37,99,235,0.08)' };
      }
      if (status === 'cancelled') {
        // Recedes until you actually look at it — .booking-card-cancelled in
        // index.css clears the grayscale/opacity on hover.
        return { opacity: 0.7, filter: 'grayscale(0.5)', boxShadow: isDark ? '0 0 0 1px rgba(220,38,38,0.2)' : 'none' };
      }
      return {
        background: goldWash,
        boxShadow: isDark ? '0 0 0 1px rgba(217,119,6,0.25), 0 6px 18px rgba(217,119,6,0.1)' : '0 6px 16px rgba(217,119,6,0.08)',
      };
    },
    // A "dark room" stage instead of a flat cropped thumbnail — the real
    // photo floats on a radial-gradient backdrop with a drop-shadow
    // (object-fit: contain, not cover, so the whole car shows rather than
    // cropping to fill the box).
    imgWrap: {
      width: '170px',
      height: '150px',
      borderRadius: '20px',
      overflow: 'hidden',
      background: isDark
        ? 'radial-gradient(120% 82% at 50% 10%, #2a2b2f 0%, #101215 100%)'
        : 'radial-gradient(120% 82% at 50% 10%, #eef0f2 0%, #e5e7eb 100%)',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    img: {
      width: '100%', height: '100%', objectFit: 'contain', padding: '14px',
      filter: `drop-shadow(0 14px 18px rgba(0,0,0,${isDark ? '0.45' : '0.22'}))`,
    },
    noImg: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    info: { flex: '0 1 auto', minWidth: 0 },
    topRow: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' },
    bookingNum: { fontSize: '19px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    // Every badge below shares this shape/type treatment — only the color
    // trio (bg/text/border) changes per status. Dark mode uses a
    // translucent tint + matching border (a "glowing chip" look) instead
    // of the light-mode pastel fill, which read as washed-out and
    // low-contrast against a dark card. Self-contained (not built by
    // merging a shared base at each call site) since some of these are
    // used directly, not just through getStatusStyle/getRefundBadgeStyle.
    badgePending: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e',
      border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    badgeConfirmed: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5',
      color: isDark ? '#86efac' : '#065f46',
      border: isDark ? '1px solid rgba(22,163,74,0.35)' : 'none',
    },
    badgeCancelled: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2',
      color: isDark ? '#fca5a5' : '#991b1b',
      border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    badgeCompleted: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe',
      color: isDark ? '#93c5fd' : '#1e40af',
      border: isDark ? '1px solid rgba(37,99,235,0.35)' : 'none',
    },
    badgeRefundRequested: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e',
      border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    badgeRefundApproved: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe',
      color: isDark ? '#93c5fd' : '#1e40af',
      border: isDark ? '1px solid rgba(37,99,235,0.35)' : 'none',
    },
    badgeRefundDeclined: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2',
      color: isDark ? '#fca5a5' : '#991b1b',
      border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    // display:flex + gap keeps an icon and its text vertically centered and
    // evenly spaced regardless of which icon precedes it.
    lineWithIcon: { display: 'flex', alignItems: 'center', gap: '6px' },
    // Hierarchy (dimmest to brightest, per the reference): date < car model <
    // booking number. Date renders first (below the booking #), car model
    // second — reversed from a plain "most important first" instinct because
    // that's the order and weighting the reference actually uses.
    meta: { fontSize: '12px', fontWeight: '600', color: isDark ? '#9ca3af' : '#6b7280', marginTop: '6px' },
    carName: {
      fontSize: '13px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      color: isDark ? '#cbd0d6' : '#4b5563', marginTop: '6px',
    },
    carSub: { fontWeight: '700', textTransform: 'uppercase' },
    // Ghost (outlined) and solid action buttons share one type treatment:
    // uppercase, 700 weight, wide tracking. Their hover "glow" is a
    // full-saturation ring (box-shadow) added OUTSIDE the translucent
    // border by .btn-ghost-*/.btn-solid-gold in index.css — the border
    // itself never changes, so nothing shifts on hover.
    refundBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '11px 24px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      background: 'transparent',
      color: isDark ? '#f87171' : '#dc2626',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.45)' : 'rgba(220,38,38,0.45)'}`,
      borderRadius: '999px',
      cursor: 'pointer',
    },
    // A labeled callout box, color keyed to the refund's own outcome —
    // green reads as "resolved in your favor" even though the status
    // badge above it stays blue (a fixed part of the badge color
    // language); amber while still pending; red if declined.
    refundNoteBox: (refundStatus) => {
      const tint = refundStatus === 'declined' ? { c: '220,38,38', light: '#fef2f2', border: '#fecaca' }
        : refundStatus === 'requested' ? { c: '217,119,6', light: '#fffbeb', border: '#fde68a' }
        : { c: '22,163,74', light: '#f0fdf4', border: '#bbf7d0' };
      return {
        fontSize: '12px', lineHeight: '1.6', padding: '10px 14px', borderRadius: '10px',
        background: isDark ? `rgba(${tint.c},0.1)` : tint.light,
        border: `1px solid ${isDark ? `rgba(${tint.c},0.3)` : tint.border}`,
        color: isDark ? '#b0b3b8' : '#4b5563',
      };
    },
    refundNoteLabel: (refundStatus) => {
      const color = refundStatus === 'declined' ? (isDark ? '#fca5a5' : '#991b1b')
        : refundStatus === 'requested' ? (isDark ? '#fbbf24' : '#92400e')
        : (isDark ? '#86efac' : '#166534');
      return { fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.03em', color };
    },
    refNote: {
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '10.5px', fontFamily: 'monospace', letterSpacing: '0.02em',
      color: isDark ? '#6b7280' : '#9ca3af',
    },
    plainNote: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', fontStyle: 'italic' },
    // A separate info panel (not tinted green overall — only the pickup
    // line's text is green, return line's text is neutral gray) so it
    // reads as its own box within the card rather than a colored alert.
    // Sits inside detailsRow now, alongside the date/model text, so it
    // naturally starts at the same Y — no marginTop hack needed.
    pickupPanel: {
      flex: '0 1 300px', minWidth: '200px', maxWidth: '300px', margin: '0 auto',
      fontSize: '12px', lineHeight: '1.5', padding: '14px 16px', borderRadius: '12px',
      background: isDark ? '#303132' : '#f8fafc',
      border: `1px solid ${isDark ? '#454647' : '#e5e7eb'}`,
    },
    pickupLine: { display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#86efac' : '#166534', fontWeight: '700' },
    returnLine: { display: 'flex', alignItems: 'center', gap: '6px', color: isDark ? '#b0b3b8' : '#6b7280', fontWeight: '700', marginTop: '6px' },
    driverNote: { marginTop: '8px', fontStyle: 'italic', fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af' },
    // actionsIndent sits in topSection's own grid now (see actionsCell),
    // so it's exactly as wide as the details row above it — no separate
    // grid, no guessed indent number.
    actionsIndent: {
      display: 'flex', gap: '10px', flexWrap: 'wrap',
      paddingTop: '14px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    rescheduleBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '11px 24px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      background: 'transparent',
      color: isDark ? GOLD_DARK : GOLD,
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)'}`,
      borderRadius: '999px',
      cursor: 'pointer',
    },
    bookAgainBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '9px',
      padding: '11px 22px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '999px',
      cursor: 'pointer',
    },
    badgeReschedulePending: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e',
      border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    badgeRescheduleApproved: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5',
      color: isDark ? '#86efac' : '#065f46',
      border: isDark ? '1px solid rgba(22,163,74,0.35)' : 'none',
    },
    badgeRescheduleDeclined: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2',
      color: isDark ? '#fca5a5' : '#991b1b',
      border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    modalSub: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '14px', lineHeight: '1.5' },
    field: { marginBottom: '14px' },
    rescheduleSelectedNote: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '-6px', marginBottom: '14px' },
    ratingSummary: { display: 'flex', alignItems: 'center', gap: '8px' },
    ratingScore: { fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    editRatingBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '11px 24px',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      background: 'transparent',
      color: isDark ? GOLD_DARK : GOLD,
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)'}`,
      borderRadius: '999px',
      cursor: 'pointer',
    },
    priceCol: {
      textAlign: 'right',
      minWidth: '140px',
      flex: '0 0 auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    },
    // Mirrors pickupPanel's marginTop: "Total Price" stays at the top,
    // level with "BOOKING #N", while the actual amount/payment/booked-on
    // sit lower, level with the date/model and pickup-panel content.
    priceDetails: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '38px' },
    priceLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af' },
    price: { fontSize: '30px', fontWeight: '900', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    // Reads off the booking's own stored fields, never the car's current
    // promo — this line has to keep saying what was actually agreed.
    promoSaved: {
      display: 'inline-flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap',
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : GOLD, marginTop: '2px',
    },
    promoSavedWas: {
      fontSize: '11px', fontWeight: '500', letterSpacing: '0.02em', textTransform: 'none',
      color: isDark ? '#8a8d91' : '#9ca3af', textDecoration: 'line-through',
    },
    // A distinct box — lighter than the card in dark mode (a "raised" panel
    // reads better against a near-black card than a darker recessed one) —
    // rather than a loose pill + text line, so paid/remaining reads as one
    // self-contained payment summary separate from the total price above it.
    // Warm gold tint (not the neutral gray used for the pickup panel) so
    // this reads distinctly as a payment callout, not just another box.
    paymentPanel: {
      marginTop: '10px', padding: '7px 10px', borderRadius: '10px',
      background: isDark ? 'rgba(232,161,0,0.12)' : '#fffbeb',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.3)' : '#fde68a'}`,
      textAlign: 'right',
    },
    paidAmount: {
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.03em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : GOLD,
    },
    balanceDue: {
      fontSize: '10px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '3px',
    },
    bookedOn: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '8px' },
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modalContent: {
      background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px',
      maxWidth: '440px', width: '90%',
    },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '14px' },
    warningBox: {
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e', fontSize: '13px',
      padding: '12px 14px', borderRadius: '8px', marginBottom: '14px', lineHeight: '1.5',
    },
    errorBox: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', fontSize: '13px',
      padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
    },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalSelect: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#e4e6eb' : '#1a1a1a',
      background: isDark ? '#18191a' : '#fff',
    },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: {
      flex: 1, padding: '10px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
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
          <p style={styles.subtitle}>View and manage all your car rental bookings in one place.</p>
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
            <div style={styles.statIconBadge(isDark ? 'rgba(232,161,0,0.15)' : '#faedc7', isDark ? GOLD_DARK : GOLD)}><BookingsIcon /></div>
            <div>
              <div style={styles.statLabel}>Total Bookings</div>
              <div style={styles.statNum}>{bookings.length}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIconBadge(isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7', '#16a34a')}><ConfirmedIcon /></div>
            <div>
              <div style={styles.statLabel}>Confirmed</div>
              <div style={styles.statNum}>{confirmedCount}</div>
            </div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIconBadge(isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', '#2563eb')}><SpentIcon /></div>
            <div>
              <div style={styles.statLabel}>Total Spent</div>
              <div style={styles.statNum}>₱{totalSpent.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <div style={styles.statusTabRow} role="tablist" aria-label="Filter by status">
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                style={styles.statusTab(active)}
                onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              >
                {tab.value === 'pending' && tab.count > 0 && <span className="pending-dot" style={styles.statusTabDot} />}
                {tab.label}
                <span style={styles.statusTabCount(active)}>({tab.count})</span>
              </button>
            );
          })}
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
      ) : filteredBookings.length === 0 ? (
        <div style={styles.empty}>
          <p>No {statusTabs.find((t) => t.value === statusFilter)?.label.toLowerCase()} bookings.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {pageBookings.map((booking, i) => (
            <div
              key={booking._id}
              className={`booking-card${booking.status === 'cancelled' ? ' booking-card-cancelled' : ''}`}
              style={{ ...styles.card, ...styles.cardGlow(booking.status) }}
            >
              <div className="booking-grid" style={styles.topSection}>
                <div className="grid-cell" style={{ ...styles.imgWrap, ...styles.imgWrapCell }}>
                  {booking.car?.image ? (
                    <img src={booking.car.image} alt="" style={styles.img} />
                  ) : (
                    <div style={styles.noImg}>No Image</div>
                  )}
                </div>

                <div className="grid-cell" style={styles.middleCol}>
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
                    {booking.payment === 'gcash_pending' && booking.status !== 'cancelled' && (
                      <span style={styles.badgeRefundRequested}>GCash Pending</span>
                    )}
                  </div>

                  <div style={styles.detailsRow}>
                    <div style={styles.info}>
                      <div style={{ ...styles.lineWithIcon, ...styles.meta }}>
                        <CalendarLineIcon color={isDark ? GOLD_DARK : GOLD} />
                        {new Date(booking.startDate).toLocaleDateString()} To {new Date(booking.endDate).toLocaleDateString()}
                      </div>
                      <div style={{ ...styles.lineWithIcon, ...styles.carName }}>
                        <CarLineIcon color={isDark ? GOLD_DARK : GOLD} />
                        <span style={styles.carSub}>
                          {booking.car?.brand} {booking.car?.model} · {booking.car?.year} · {booking.car?.category}
                        </span>
                      </div>
                    </div>

                    {(booking.status === 'confirmed' || booking.status === 'pending') && (
                      <div style={styles.pickupPanel}>
                        <div style={styles.pickupLine}>
                          <PinLineIcon /> Pickup: {new Date(booking.startDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={styles.returnLine}>
                          <ReturnLineIcon /> Return: {new Date(booking.endDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={styles.driverNote}>
                          {booking.bookingType === 'self-drive'
                            ? "Bring a valid ID and your driver's license to pick up the vehicle."
                            : 'Your driver will meet you at the pickup location.'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="booking-card-price grid-cell" style={{ ...styles.priceCol, ...styles.priceColCell }}>
                  <span style={styles.priceLabel}>Total Price</span>
                  <div style={styles.priceDetails}>
                    <span style={styles.price}>₱{booking.totalPrice.toLocaleString()}</span>
                    {booking.paymentType === 'downpayment' && booking.payment === 'paid' && booking.amountPaid < booking.totalPrice && booking.status !== 'cancelled' && (
                      <div style={styles.paymentPanel}>
                        <div style={styles.paidAmount}>₱{booking.amountPaid.toLocaleString()} Paid</div>
                        <div style={styles.balanceDue}>
                          Bring ₱{(booking.totalPrice - booking.amountPaid).toLocaleString()} at pickup
                        </div>
                      </div>
                    )}
                    <span style={styles.bookedOn}>
                      Booked on {new Date(booking.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {booking.discountAmount > 0 && (
                  <div className="grid-cell" style={styles.savedCell}>
                    <span style={styles.promoSaved}>
                      <span>{booking.promoLabel || 'Promo'} · saved ₱{booking.discountAmount.toLocaleString()}</span>
                      <span style={styles.promoSavedWas}>₱{booking.subtotal.toLocaleString()}</span>
                    </span>
                  </div>
                )}

                {(booking.status === 'pending' || booking.status === 'confirmed') &&
                  (!booking.refundStatus || booking.refundStatus === 'none') && (
                    <div className="grid-cell" style={styles.actionsCell}>
                      <div style={styles.actionsIndent}>
                        <button className="btn-ghost-rose" style={styles.refundBtn} onClick={() => openRefundModal(booking._id)}>
                          <ReturnLineIcon /> Request Refund
                        </button>
                        {booking.rescheduleRequest?.status !== 'pending' && (
                          <button className="btn-ghost-amber" style={styles.rescheduleBtn} onClick={() => openRescheduleModal(booking)}>
                            <CalendarPlusIcon /> Reschedule
                          </button>
                        )}
                      </div>
                    </div>
                )}
                {(booking.status === 'pending' || booking.status === 'confirmed') &&
                  booking.payment !== 'paid' &&
                  booking.refundStatus !== 'requested' && (
                    <div className="grid-cell" style={styles.actionsCell}>
                      <div style={styles.actionsIndent}>
                        <button
                          className="btn-solid-gold"
                          style={styles.bookAgainBtn}
                          onClick={() => handleRetryPayment(booking._id)}
                          disabled={retryingPaymentId === booking._id}
                        >
                          {retryingPaymentId === booking._id ? 'Redirecting...' : 'Retry GCash Payment'}
                        </button>
                      </div>
                    </div>
                )}
                {booking.status === 'completed' && (
                  <div className="grid-cell" style={styles.actionsCell}>
                    <div style={{ ...styles.actionsIndent, alignItems: 'center' }}>
                      <button className="btn-solid-gold" style={styles.bookAgainBtn} onClick={() => navigate(`/cars/${booking.car._id}?book=true`)}>
                        <RepeatIcon /> Book Again
                      </button>
                      {booking.carRating?.ratedAt && (
                        <>
                          <button className="btn-ghost-amber" style={styles.editRatingBtn} onClick={() => openRatingModal(booking)}>
                            <PencilIcon /> Edit Rating
                          </button>
                          <div style={styles.ratingSummary}>
                            <StarRating value={booking.carRating.overall} size={14} readOnly />
                            <span style={styles.ratingScore}>{booking.carRating.overall.toFixed(1)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(booking.refundStatus === 'requested' || booking.refundStatus === 'approved' || booking.refundStatus === 'declined') && (
                <div style={styles.refundNoteBox(booking.refundStatus)}>
                  <span style={styles.refundNoteLabel(booking.refundStatus)}>
                    {booking.refundStatus === 'requested' ? 'Refund Requested: ' : booking.refundStatus === 'approved' ? 'Refund Confirmed: ' : 'Refund Declined: '}
                  </span>
                  ₱{booking.refundAmount?.toLocaleString() ?? 0}
                  {booking.refundReason ? ` — Reason: ${booking.refundReason}` : ''}
                  {booking.paymongoRefundId ? ` — Ref: ${booking.paymongoRefundId}` : ''}
                </div>
              )}
              {booking.rescheduleRequest?.status === 'declined' && booking.rescheduleRequest.adminNotes && (
                <p style={styles.plainNote}>Reschedule declined: {booking.rescheduleRequest.adminNotes}</p>
              )}
              {booking.payment === 'paid' && booking.paymongoPaymentId && (
                <div style={styles.refNote}><TagLineIcon size={11} /> REF: {booking.paymongoPaymentId}</div>
              )}
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
                <>✅ You booked less than 12 hours ago, so this qualifies for a <strong>full refund</strong>.</>
              ) : refundPercentage === 50 ? (
                <>⚠️ It's been 12–24 hours since you booked, so this qualifies for a <strong>50% refund</strong> only.</>
              ) : (
                <>⚠️ It's been more than 24 hours since you booked, so this booking is <strong>not eligible for a refund</strong>.</>
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