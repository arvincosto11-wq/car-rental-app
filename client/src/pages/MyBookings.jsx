import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api';
import StarRating from '../components/StarRating';
import RatingModal from '../components/RatingModal';
import BookingConfirmationModal from '../components/BookingConfirmationModal';
import { SkeletonListCard } from '../components/Skeleton';
import Pagination from '../components/Pagination';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import AdjustOfferPanel from '../components/AdjustOfferPanel';
import ExtendBookingModal from '../components/ExtendBookingModal';
import { paginate } from '../utils/paginate';
import { bookingAwaitingDecision } from '../utils/offerWindow';
import { formatMoment, formatHour, phDayStart, pickupHours, instantFrom, addDays } from '../utils/phTime';
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
  const { toast, confirm } = useUIFeedback();
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
  // The hour they asked for on the new dates. The one actually used is
  // worked out below, so a choice that stops working when the day changes
  // corrects itself rather than going stale.
  const [reschedulePreferredHour, setReschedulePreferredHour] = useState(null);
  // Captured when the modal opens rather than read while rendering, which
  // would make the output depend on exactly when the render happened. The
  // modal is never open long enough for the difference to matter.
  const [rescheduleOpenedAt, setRescheduleOpenedAt] = useState(0);
  // Which booking came back from GCash, and how it went. Replaces the toast
  // that used to carry this — see BookingConfirmationModal.
  const [confirmation, setConfirmation] = useState(null);
  const [offerBusyId, setOfferBusyId] = useState('');
  const [withdrawingId, setWithdrawingId] = useState('');
  const [extendBookingId, setExtendBookingId] = useState(null);

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
  // Asks the server what actually happened, rather than trusting the
  // redirect: someone can land on ?gcash=success having abandoned the
  // payment, and the callback can also lag a few seconds behind them.
  const checkGcashStatus = async (bookingId, redirectSaidCancelled) => {
    try {
      const res = await api.get(`/payments/gcash/status/${bookingId}`);
      const status = res.data.payment === 'paid'
        ? 'paid'
        : redirectSaidCancelled ? 'cancelled' : 'checking';
      const fresh = await api.get('/bookings/my');
      setBookings(fresh.data);
      setConfirmation({ bookingId, status });
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) return;
    const gcashResult = searchParams.get('gcash');
    const bookingId = searchParams.get('bookingId');
    if (!gcashResult || !bookingId) return;
    // Cleared straight away so a refresh doesn't re-run this.
    setSearchParams({}, { replace: true });
    checkGcashStatus(bookingId, gcashResult === 'cancelled');
  }, [user, searchParams]);

  // Withdrawing a request the client made themselves. The refund one is
  // confirmed first, because the amount was locked in when they asked and
  // is recalculated from scratch if they ask again — so withdrawing can
  // genuinely cost them money, and finding that out afterwards would feel
  // like a trap.
  const withdrawRequest = async (booking, kind) => {
    if (kind === 'refund') {
      const ok = await confirm(
        `You'll keep this booking and the ₱${(booking.refundAmount || 0).toLocaleString()} refund request is cancelled. `
        + 'If you ask for a refund again later, the amount is worked out from scratch and may be lower.',
        { confirmLabel: 'Yes, keep my booking', cancelLabel: 'Leave the request' }
      );
      if (!ok) return;
    }

    setWithdrawingId(booking._id);
    try {
      await api.delete(`/bookings/${booking._id}/${kind}`);
      toast.success(kind === 'refund'
        ? 'Refund request withdrawn. Your booking stands.'
        : 'Reschedule request withdrawn. Your original dates stand.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Could not withdraw that request.');
    } finally {
      await refreshBookings();
      setWithdrawingId('');
    }
  };

  const refreshBookings = async () => {
    try {
      const res = await api.get('/bookings/my');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // The client's answer to an offer of alternative dates. Refetches
  // afterwards, including on failure: "those dates have just been taken" is
  // a real answer, and the card has to show what's actually left.
  //
  // The one reply that isn't an outcome is a price rise — the dates are
  // free, they just cost more than what this client agreed to. That comes
  // back for the panel to put to them, and nothing has changed yet, so the
  // card is deliberately left exactly as it is.
  const handleOfferDecision = async (booking, decision, payload = {}) => {
    // Paying the difference is the one answer that leaves the site. The
    // dates stay exactly as they are until the money lands, so backing out
    // on PayMongo's page costs this client nothing.
    if (decision === 'topup') {
      setOfferBusyId(booking._id);
      try {
        const res = await api.post(`/bookings/${booking._id}/adjust/top-up`, payload);
        window.location.href = res.data.checkoutUrl;
        return { ok: true };
      } catch (err) {
        console.error(err);
        toast.error(err.response?.data?.message || 'Could not start that payment.');
        await refreshBookings();
        return { ok: false };
      } finally {
        setOfferBusyId('');
      }
    }

    setOfferBusyId(booking._id);
    try {
      await api.put(`/bookings/${booking._id}/adjust`, { decision, ...payload });
      toast.success(decision === 'accept'
        ? 'Your booking has been moved to the new dates.'
        : 'Your booking has been cancelled and your refund is on its way.');
      await refreshBookings();
      return { ok: true };
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsPriceConfirmation) return data;
      console.error(err);
      toast.error(data?.message || 'Could not update this booking.');
      await refreshBookings();
      return { ok: false };
    } finally {
      setOfferBusyId('');
    }
  };

  // Back from paying for extra days. Asks the server what really happened
  // rather than trusting the redirect, and also picks up a payment that
  // finished with the tab already closed.
  const extendChecked = useRef(new Set());
  useEffect(() => {
    const fromRedirect = searchParams.get('extend') && searchParams.get('bookingId');
    const paying = bookings.find((b) => b.pendingExtension?.checkoutSessionId
      && !extendChecked.current.has(b._id));
    const id = fromRedirect ? searchParams.get('bookingId') : paying?._id;
    if (!user || !id || extendChecked.current.has(id)) return;
    extendChecked.current.add(id);
    if (fromRedirect) setSearchParams({}, { replace: true });
    (async () => {
      try {
        await api.put(`/bookings/${id}/extension/confirm`);
        toast.success('Payment received — your booking now runs to the new date.');
      } catch (err) {
        if (fromRedirect) toast.info(err.response?.data?.message || 'That payment was not completed.');
        else console.error(err);
      }
      await refreshBookings();
    })();
  }, [user, searchParams, bookings]);

  // Back from paying the difference on a booking being moved. Asks the
  // server what actually happened rather than trusting the redirect, the
  // same as the booking payment itself.
  useEffect(() => {
    if (!user) return;
    const topupResult = searchParams.get('topup');
    const topupBookingId = searchParams.get('bookingId');
    if (!topupResult || !topupBookingId) return;
    setSearchParams({}, { replace: true });
    (async () => {
      try {
        await api.put(`/bookings/${topupBookingId}/adjust/top-up/confirm`);
        toast.success('Payment received — your booking has been moved to the new dates.');
      } catch (err) {
        toast.info(err.response?.data?.message || 'That payment was not completed, so your booking is unchanged.');
      }
      await refreshBookings();
    })();
  }, [user, searchParams]);

  // A top-up can finish without the client ever landing back here — they
  // close the GCash tab, or the redirect drops. Anything still marked as
  // paying gets reconciled on the next visit instead, so money that was
  // taken can't sit unrecorded against a booking that never moved. The
  // seen-set stops it retrying in a loop when the answer doesn't change.
  const topUpChecked = useRef(new Set());
  useEffect(() => {
    const paying = bookings.find((b) => b.adjustOffer?.topUp?.checkoutSessionId
      && !topUpChecked.current.has(b._id));
    if (!paying) return;
    topUpChecked.current.add(paying._id);
    (async () => {
      try {
        await api.put(`/bookings/${paying._id}/adjust/top-up/confirm`);
        toast.success('Payment received — your booking has been moved to the new dates.');
      } catch (err) {
        // Quiet on purpose: this is a background tidy-up, and an
        // unfinished payment is not something to interrupt anyone about.
        console.error(err);
      }
      await refreshBookings();
    })();
  }, [bookings]);

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
    setReschedulePreferredHour(null);
    setRescheduleOpenedAt(Date.now());
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
    setReschedulePreferredHour(null);
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
      const res = await api.post(`/bookings/${rescheduleModalId}/reschedule`, {
        newStartDate, newEndDate, pickupHour: rescheduleHour,
      });
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

  // What the vehicle is really unavailable for. The server sends each
  // booking's span with its turnaround already added, so the hours offered
  // here are the hours it will actually accept.
  const rescheduleBusy = bookedRangesForReschedule.map((r) => (r.busyStart && r.busyEnd
    ? { start: new Date(r.busyStart).getTime(), end: new Date(r.busyEnd).getTime() }
    : { start: phDayStart(r.startDate).getTime(), end: phDayStart(r.endDate).getTime() }));

  // Every hour the trip could run from if it started on the chosen day.
  // Checked across the whole range, not just the moment of pickup.
  const rescheduleHours = newStartDate && rescheduleBooking?.hasPickupTime
    ? pickupHours().filter((h) => {
      const from = instantFrom(newStartDate, h).getTime();
      const to = addDays(instantFrom(newStartDate, h), rescheduleBooking.totalDays).getTime();
      if (from <= rescheduleOpenedAt) return false;
      return !rescheduleBusy.some((b) => from < b.end && to > b.start);
    })
    : [];

  // What they asked for while it still works, otherwise the earliest that
  // does. Null on a booking with no pickup time, which keeps its old form.
  const rescheduleHour = rescheduleBooking?.hasPickupTime
    ? (rescheduleHours.includes(reschedulePreferredHour)
      ? reschedulePreferredHour
      : (rescheduleHours.length ? rescheduleHours[0] : null))
    : null;

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
    // Spans columns 2 and 3: buttons on the left, savings line on the right.
    // Keeping the savings line out of column 3 matters — that column is
    // auto-sized, so a long line in it widens the price column and squeezes
    // the trip panel.
    actionsCell: {
      gridColumn: '2 / -1', gridRow: '2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '16px', flexWrap: 'wrap',
    },
    // Centred rather than top-aligned: the pickup box is the taller of the
    // two, and level text either side of it reads as one panel.
    detailsRow: {
      display: 'flex', gap: '18px', flexWrap: 'nowrap', alignItems: 'center',
      justifyContent: 'space-between',
    },
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
    info: {
      flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere',
      background: isDark ? '#38393b' : '#ffffff',
      border: `1px solid ${isDark ? '#454647' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '14px 16px',
    },
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
      flex: '1 1 260px', minWidth: 0, maxWidth: '340px',
      fontSize: '12px', lineHeight: '1.5', padding: '14px 16px', borderRadius: '12px',
      background: isDark ? '#38393b' : '#ffffff',
      border: `1px solid ${isDark ? '#454647' : '#e5e7eb'}`,
    },
    pickupLine: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: isDark ? '#86efac' : '#166534', fontWeight: '700' },
    returnLine: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: isDark ? '#b0b3b8' : '#6b7280', fontWeight: '700', marginTop: '6px' },
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
    rescheduleTimeBlock: { marginTop: '14px' },
    rescheduleTimeLabel: {
      display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em',
      textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px',
    },
    rescheduleTimeRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    rescheduleTimeChip: (active, open) => ({
      padding: '6px 11px', borderRadius: '999px',
      border: `1px solid ${active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#e4e6eb' : '#1a1a1a'),
      fontSize: '11.5px', fontWeight: active ? '800' : '600', fontFamily: 'inherit',
      cursor: open ? 'pointer' : 'not-allowed',
      opacity: open ? 1 : 0.32,
      textDecoration: open ? 'none' : 'line-through',
    }),
    rescheduleNoHours: {
      fontSize: '11.5px', lineHeight: 1.5, margin: 0,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    badgeActionNeeded: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(232,161,0,0.18)' : '#fef3c7',
      color: isDark ? GOLD_DARK : '#92400e',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.45)' : '#fcd34d'}`,
    },
    badgeReschedulePending: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e',
      border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
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
      color: isDark ? GOLD_DARK : GOLD,
      // Stays on the right even on a card that has no action buttons.
      marginLeft: 'auto',
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
                    {bookingAwaitingDecision(booking) && (
                      <span style={styles.badgeActionNeeded}>Action Needed</span>
                    )}
                  </div>

                  <div className="booking-trip-row" style={styles.detailsRow}>
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
                          <PinLineIcon /> Pickup: {formatMoment(booking.startDate, booking.hasPickupTime)}
                        </div>
                        <div style={styles.returnLine}>
                          <ReturnLineIcon /> Return: {formatMoment(booking.endDate, booking.hasPickupTime)}
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
                    {booking.payment === 'paid' && booking.amountPaid < booking.totalPrice && booking.status !== 'cancelled' && (
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

                <div className="grid-cell" style={styles.actionsCell}>
                {(booking.status === 'pending' || booking.status === 'confirmed') &&
                  !bookingAwaitingDecision(booking) &&
                  (!booking.refundStatus || booking.refundStatus === 'none') && (
                      <div style={styles.actionsIndent}>
                        <button className="btn-ghost-rose" style={styles.refundBtn} onClick={() => openRefundModal(booking._id)}>
                          <ReturnLineIcon /> Request Refund
                        </button>
                        {booking.rescheduleRequest?.status !== 'pending' && (
                          <button className="btn-ghost-amber" style={styles.rescheduleBtn} onClick={() => openRescheduleModal(booking)}>
                            <CalendarPlusIcon /> Reschedule
                          </button>
                        )}
                        {/* Only while there is still a booking to lengthen — a
                            trip whose return has passed is overdue, which is
                            somebody else's conversation. */}
                        {booking.payment === 'paid' && new Date(booking.endDate) > new Date() && (
                          <button className="btn-ghost-amber" style={styles.rescheduleBtn} onClick={() => setExtendBookingId(booking._id)}>
                            <CalendarPlusIcon /> Keep it longer
                          </button>
                        )}
                      </div>
                )}
                {(booking.refundStatus === 'requested' || booking.rescheduleRequest?.status === 'pending')
                  && booking.status !== 'cancelled' && (
                    <div style={styles.actionsIndent}>
                      {booking.refundStatus === 'requested' && (
                        <button
                          className="btn-ghost-amber"
                          style={styles.rescheduleBtn}
                          disabled={withdrawingId === booking._id}
                          onClick={() => withdrawRequest(booking, 'refund')}
                        >
                          <ReturnLineIcon /> Cancel refund request
                        </button>
                      )}
                      {booking.rescheduleRequest?.status === 'pending' && (
                        <button
                          className="btn-ghost-amber"
                          style={styles.rescheduleBtn}
                          disabled={withdrawingId === booking._id}
                          onClick={() => withdrawRequest(booking, 'reschedule')}
                        >
                          <CalendarPlusIcon /> Cancel reschedule request
                        </button>
                      )}
                    </div>
                )}
                {(booking.status === 'pending' || booking.status === 'confirmed') &&
                  booking.payment !== 'paid' &&
                  booking.refundStatus !== 'requested' && (
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
                )}
                {booking.status === 'completed' && (
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
                )}
                {booking.discountAmount > 0 && (
                  <span style={styles.promoSaved}>
                    <span>{booking.promoLabel || 'Promo'} · saved ₱{booking.discountAmount.toLocaleString()}</span>
                    <span style={styles.promoSavedWas}>₱{booking.subtotal.toLocaleString()}</span>
                  </span>
                )}
                </div>
              </div>

              {bookingAwaitingDecision(booking) && (
                <AdjustOfferPanel
                  booking={booking}
                  isDark={isDark}
                  busy={offerBusyId === booking._id}
                  onDecide={(decision, payload) => handleOfferDecision(booking, decision, payload)}
                />
              )}

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

      {extendBookingId && bookings.find((b) => b._id === extendBookingId) && (
        <ExtendBookingModal
          booking={bookings.find((b) => b._id === extendBookingId)}
          isDark={isDark}
          onClose={() => setExtendBookingId(null)}
          onStarted={() => setExtendBookingId(null)}
        />
      )}

      {confirmation && (
        <BookingConfirmationModal
          booking={bookings.find((b) => b._id === confirmation.bookingId)}
          status={confirmation.status}
          isDark={isDark}
          retrying={retryingPaymentId === confirmation.bookingId}
          onClose={() => setConfirmation(null)}
          onCheckAgain={() => checkGcashStatus(confirmation.bookingId, false)}
          onRetryPayment={() => handleRetryPayment(confirmation.bookingId)}
        />
      )}

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
              {rescheduleBooking.hasPickupTime && ' You can change the pickup time too.'}
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

            {newStartDate && rescheduleBooking.hasPickupTime && (
              <div style={styles.rescheduleTimeBlock}>
                <span style={styles.rescheduleTimeLabel}>Pickup time on that day</span>
                {rescheduleHours.length === 0 ? (
                  <p style={styles.rescheduleNoHours}>
                    There is no pickup time left on that day. Try another one.
                  </p>
                ) : (
                  <div style={styles.rescheduleTimeRow} role="group" aria-label="Pickup time">
                    {pickupHours().map((h) => {
                      const open = rescheduleHours.includes(h);
                      return (
                        <button
                          key={h}
                          type="button"
                          aria-pressed={rescheduleHour === h}
                          disabled={!open}
                          style={styles.rescheduleTimeChip(rescheduleHour === h, open)}
                          title={open ? undefined : 'Not available that day — the vehicle is out, or being returned and checked.'}
                          onClick={() => setReschedulePreferredHour(h)}
                        >
                          {formatHour(h)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {newStartDate && newEndDate && (
              <p style={styles.rescheduleSelectedNote}>
                Selected: {new Date(newStartDate).toLocaleDateString()} → {new Date(newEndDate).toLocaleDateString()}
                {rescheduleHour !== null && `, ${formatHour(rescheduleHour)} both ends`}
              </p>
            )}

            <div style={styles.modalActions}>
              <button style={styles.modalCancelBtn} onClick={closeRescheduleModal} disabled={rescheduleSubmitting}>
                Cancel
              </button>
              <button
                style={styles.modalSubmitBtn}
                onClick={handleSubmitReschedule}
                disabled={rescheduleSubmitting || !newStartDate
                  || (rescheduleBooking.hasPickupTime && rescheduleHour === null)}
              >
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