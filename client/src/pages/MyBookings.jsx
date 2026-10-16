import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api';
import DriverAvatar from '../components/DriverAvatar';
import StarRating from '../components/StarRating';
import RatingModal from '../components/RatingModal';
import BookingConfirmationModal from '../components/BookingConfirmationModal';
import { SkeletonListCard } from '../components/Skeleton';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import AdjustOfferPanel from '../components/AdjustOfferPanel';
import ExtendBookingModal from '../components/ExtendBookingModal';
import { bookingAwaitingDecision } from '../utils/offerWindow';
import { formatMoment, formatHour, phDayStart, pickupHours, instantFrom, addDays } from '../utils/phTime';
import { toneOf, stepOf, moneyFor, moneySummary, sentenceFor, actionKeysFor, isLive } from '../utils/myBookings';
import { refundOutcome } from '../utils/refundPolicy';
import useModalA11y from '../hooks/useModalA11y';
import usePageTitle from '../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, GOLD_TINT, GOLD_TINT_DARK, goldInk } from '../theme';
import LAYERS from '../layers';
import ModalClose from '../components/ModalClose';
import { DoneGlyph, WarnGlyph } from '../components/Glyphs';
import { StarGlyph } from '../components/Glyphs';

// How long a change is worth pointing out. After a day it is history, and a
// list covered in badges says nothing at all.
const ACTIVITY_WINDOW_HOURS = 24;



// Position is decided by urgency now, so a change has to announce itself
// where it sits rather than by jumping the queue.
// Out past its return, right now. Mirrors the server's rule; this only
// decides what the client is shown on their own booking.
// Rows name the day only; the hour belongs in the drawer beside the rest.
const DATE_ONLY = { month: 'short', day: 'numeric', year: 'numeric' };
const DATE_SHORT = { weekday: 'short', month: 'short', day: 'numeric' };
const STEP_LABELS = ['Booked', 'Confirmed', 'Picked up', 'Returned'];
const OFFICE_PHONE = '0950-651-0479';
// Something short a client can quote on the phone, rather than the
// twenty-four characters the database knows it by.
const refOf = (b) => String(b._id || '').slice(-6).toUpperCase();

const peso = (n) => `₱${Math.round(Math.abs(n || 0)).toLocaleString('en-US')}`;

// Out, and due back within the day. Amber rather than red: nothing has gone
// wrong yet, and the point of saying it now is that it still hasn't.
const DUE_SOON_HOURS = 24;



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
const StarLineIcon = (props) => <LineIcon {...props}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></LineIcon>;

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day in timezones ahead of UTC, like PH).
const toDateValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  // Which live booking is in the ticket, which half of history is in
  // view, and which years are open.
  const [focusId, setFocusId] = useState(null);
  const [histTab, setHistTab] = useState('trips');
  const [openYears, setOpenYears] = useState({});
  // Read once rather than on every render: a booking's tone depends on
  // the time, and calling the clock mid-render is not a pure thing to do.
  const [now] = useState(() => new Date());
  // The one panel open inside a booking, what it has collected so far,
  // and what the client was told once it was sent.
  const [panel, setPanel] = useState(null);
  const [panelReason, setPanelReason] = useState('');
  const [panelNote, setPanelNote] = useState('');
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [sentFor, setSentFor] = useState({});
  const [openRows, setOpenRows] = useState({});
  const [showAllYears, setShowAllYears] = useState({});
  // Which booking's full record is open. Everything the card used to show
  // lives in there now, so the list can stay one line per booking.

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
        window.location.assign(res.data.checkoutUrl);
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







  // Re-attempts GCash payment for a booking that already exists but never
  // completed payment (abandoned/cancelled checkout) — same endpoint the
  // original booking flow uses, just re-run for the same booking instead
  // of creating a new one.
  const handleRetryPayment = async (bookingId) => {
    setRetryingPaymentId(bookingId);
    try {
      const { data } = await api.post('/payments/gcash/checkout-session', { bookingId });
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start the GCash payment. Please try again.');
      setRetryingPaymentId(null);
    }
  };

  const openRescheduleModal = (booking) => {
    setRescheduleModalId(booking._id);
    setReschedulePreferredHour(null);
    setRescheduleOpenedAt(() => Date.now());
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
    // No day-level check here any more. It predated pickup times and
    // compared whole days, so it called a day "already booked" when only
    // part of it was — refusing a client who had correctly picked one of
    // the hours still free on it. The hour list below the calendar is the
    // real answer now, and the server checks it again regardless.
    const ok = await confirm(
      'Send these dates to our team to approve? Your booking stays on its current dates until they do, '
      + 'and you can only have one request open at a time.',
      { confirmLabel: 'Send request', cancelLabel: 'Go back' }
    );
    if (!ok) return;
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


  const openRatingModal = (booking) => setRatingModalId(booking._id);
  const closeRatingModal = () => setRatingModalId(null);
  const handleRatingSubmitted = (carRating) => {
    setBookings(bookings.map((b) => (b._id === ratingModalId ? { ...b, carRating } : b)));
    closeRatingModal();
  };

  const ratingBooking = bookings.find((b) => b._id === ratingModalId);

  // Why this booking wants the client, in one line, or null. First match
  // wins: what is urgent outranks what is merely unfinished, and a settled
  // booking says nothing at all rather than repeating its own status.
  //
  // Derived, never stored — every input is already on the booking.

  // Still counted, because the header still offers to rate them.
  const unratedCount = bookings.filter((b) => b.status === 'completed' && !b.carRating?.ratedAt).length;

  // ── the page, as a customer reads it ─────────────────────────────
  //
  // Live first, settled below. A booking is in exactly one of them: the
  // old page put the same booking in an "Action needed" strip AND in the
  // list underneath, wording it differently in each.
  const TONE_ORDER = { red: 0, amber: 1, ok: 2, wait: 3, done: 4 };

  const described = bookings.map((b) => {
    const actions = actionKeysFor(b, now);
    // A request already with the office can be taken back, which is the
    // one action the rules file does not know about: it is about the
    // request, not the booking.
    if (b.refundStatus === 'requested') actions.unshift('withdrawRefund');
    if (b.rescheduleRequest?.status === 'pending') actions.unshift('withdrawDates');
    return {
      ...b,
      toneKey: toneOf(b, now),
      step: stepOf(b),
      sentence: sentenceFor(b, now),
      money: moneyFor(b),
      actions,
    };
  });

  const liveBookings = described
    .filter((b) => isLive(b, now))
    .sort((a, bb) => TONE_ORDER[a.toneKey] - TONE_ORDER[bb.toneKey]
      || new Date(a.startDate) - new Date(bb.startDate));

  const ticket = liveBookings.find((b) => b._id === focusId) || liveBookings[0] || null;
  const alsoGoingOn = liveBookings.filter((b) => b._id !== ticket?._id);

  const settled = described.filter((b) => !isLive(b, now));
  const historyCounts = {
    trips: settled.filter((b) => b.status === 'completed').length,
    cancelled: settled.filter((b) => b.status === 'cancelled').length,
  };

  // Cancelled bookings live behind their own chip. One client has 25 of
  // them against 11 trips, and mixed together the trips disappear.
  const historyRows = settled
    .filter((b) => (histTab === 'trips' ? b.status === 'completed' : b.status === 'cancelled'))
    .sort((a, bb) => new Date(bb.startDate) - new Date(a.startDate));

  const historyYears = (() => {
    const years = [];
    for (const b of historyRows) {
      const year = String(new Date(b.startDate).getFullYear());
      let group = years.find((y) => y.year === year);
      if (!group) {
        group = { year, rows: [], trips: 0, cancelled: 0, spent: 0, back: 0 };
        years.push(group);
      }
      group.rows.push(b);
    }
    // The totals count everything that year, not just the chip in view,
    // so the headline does not change when the chip does.
    for (const group of years) {
      const all = settled.filter((b) => String(new Date(b.startDate).getFullYear()) === group.year);
      group.trips = all.filter((b) => b.status === 'completed').length;
      group.cancelled = all.filter((b) => b.status === 'cancelled').length;
      group.spent = all.filter((b) => b.status === 'completed').reduce((sum, b) => sum + (b.money.paid || 0), 0);
      group.back = all.reduce((sum, b) => sum + (b.money.back || 0), 0);
    }
    years.forEach((group, i) => { group.latest = i === 0; });
    return years;
  })();

  const openPanel = (bookingId, key) => {
    // Only one at a time, and opening the one already open closes it.
    if (panel?.bookingId === bookingId && panel?.key === key) return setPanel(null);
    setPanelReason('');
    setPanelNote('');
    setPanelError('');
    return setPanel({ bookingId, key });
  };

  const sendRefundRequest = async (booking) => {
    if (!panelReason) return;
    setPanelBusy(true);
    setPanelError('');
    try {
      const reason = panelNote.trim() ? `${panelReason} — ${panelNote.trim()}` : panelReason;
      const res = await api.post(`/bookings/${booking._id}/refund`, { reason });
      setBookings((list) => list.map((b) => (b._id === booking._id
        ? { ...b, refundStatus: res.data.refundStatus, refundReason: res.data.refundReason }
        : b)));
      setPanel(null);
      setSentFor((sent) => ({
        ...sent,
        [booking._id]: 'Request sent. The office will decide and tell you how much comes back.',
      }));
    } catch (err) {
      setPanelError(err.response?.data?.message || 'Could not send that request.');
    } finally {
      setPanelBusy(false);
    }
  };

  // Asking for a refund, inside the booking it belongs to. The policy
  // line stays: what comes back depends on how close the pickup is, and
  // a client deciding whether to ask needs that before they ask, not
  // after.
  const refundPanel = (booking) => {
    const outcome = refundOutcome(booking, now);
    const back = Math.round(((booking.amountPaid || 0) * (outcome.percent || 0)) / 100);
    return (
      <div style={mb.panel}>
        <div style={mb.panelHead}>
          <span style={mb.panelTitle}>Ask for a refund</span>
          <button type="button" style={mb.panelClose} aria-label="Close" onClick={() => setPanel(null)}>×</button>
        </div>

        <p style={mb.panelNote}>
          Asking doesn&apos;t cancel anything yet — the office looks at it and decides.
          {outcome.basis === 'full' && ' Your pickup is more than 3 days away, so this qualifies for a full refund.'}
          {outcome.basis === 'half' && ' Your pickup is less than 3 days away, so this qualifies for half back.'}
          {outcome.basis === 'none' && ' Your pickup is less than 24 hours away, so nothing is due back.'}
          {booking.amountPaid > 0 && outcome.percent > 0 && ` You paid ${peso(booking.amountPaid)}, so about ${peso(back)} would come back.`}
        </p>

        <div style={mb.chipRow}>
          {REFUND_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              style={mb.reasonChip(panelReason === reason)}
              aria-pressed={panelReason === reason}
              onClick={() => setPanelReason(reason)}
            >
              {reason}
            </button>
          ))}
        </div>

        <textarea
          style={mb.panelTextarea}
          rows={2}
          value={panelNote}
          placeholder="Anything the office should know? (optional)"
          onChange={(e) => setPanelNote(e.target.value)}
        />

        {panelError && <div style={mb.panelError}>{panelError}</div>}

        <button
          type="button"
          style={mb.panelSubmit(!!panelReason && !panelBusy)}
          disabled={!panelReason || panelBusy}
          onClick={() => sendRefundRequest(booking)}
        >
          {panelBusy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    );
  };

  const panelFor = (booking) => {
    if (panel?.bookingId !== booking._id) return null;
    if (panel.key === 'refund') return refundPanel(booking);
    return null;
  };

  const sentBanner = (booking) => (sentFor[booking._id] ? (
    <div style={mb.sentBand}>{sentFor[booking._id]}</div>
  ) : null);

  // Forty rows under one year is a scroll, not a list. The rest are one
  // button away, and everything is already loaded — there is nothing to
  // fetch.
  const ROWS_PER_YEAR = 6;
  const shownRows = (group) => (showAllYears[group.year] ? group.rows : group.rows.slice(0, ROWS_PER_YEAR));

  const ACTION_LABELS = {
    withdrawRefund: 'Keep my booking',
    withdrawDates: 'Cancel the date change',
    refund: 'Ask for a refund',
    rate: 'Rate this trip',
    dates: 'Change dates',
    offer: 'Choose',
    pay: 'Finish payment',
    longer: 'Keep it longer',
    call: 'Call the office',
  };
  // Gold is spent only where something has gone wrong or needs doing.
  const isPrimaryAction = (key, tone) => ['longer', 'pay', 'offer', 'rate'].includes(key)
    && (tone === 'red' || tone === 'amber');

  // Step one keeps the flows exactly as they are: the buttons are new,
  // what they open is not. They move inside the booking in step two.
  const runAction = (key, booking) => {
    if (key === 'refund') return openPanel(booking._id, 'refund');
    if (key === 'rate') return openRatingModal(booking);
    if (key === 'dates') return openRescheduleModal(booking);
    if (key === 'longer') return setExtendBookingId(booking._id);
    if (key === 'pay') return handleRetryPayment(booking._id);
    if (key === 'call') return window.open(`tel:${OFFICE_PHONE}`);
    if (key === 'withdrawRefund') return withdrawRequest(booking, 'refund');
    if (key === 'withdrawDates') return withdrawRequest(booking, 'reschedule');
    // An offer is answered in the panel the booking already carries.
    return setFocusId(booking._id);
  };

  // ── the look, from the handoff's own tokens ──────────────────────
  const mb = (() => {
    const c = isDark
      ? {
        page: '#18191a', card: '#242526', sunk: '#1f2021', border: '#3a3b3c',
        text: '#e4e6eb', muted: '#b0b3b8', faint: '#8d9095',
        gold: '#e8a100', goldText: '#17130e', goldSoft: '#3a2f17', goldInk: '#f2b93b',
        red: '#f07067', redSoft: '#3d2321', redInk: '#ff8f86',
        green: '#5cc58a', greenSoft: '#1e3227',
        wait: '#a9b4c2', waitSoft: '#2c2f33', bar: '#333436',
      }
      : {
        page: '#f3f2ef', card: '#ffffff', sunk: '#f6f5f2', border: '#e3e1dc',
        text: '#1c1b19', muted: '#5f5c55', faint: '#8a867e',
        gold: '#b8790a', goldText: '#17130e', goldSoft: '#fbf1dc', goldInk: '#875800',
        red: '#c0352b', redSoft: '#fdecea', redInk: '#a12a21',
        green: '#2f7d4f', greenSoft: '#e6f3eb',
        wait: '#5b6676', waitSoft: '#eef0f3', bar: '#ebe9e4',
      };

    const tone = {
      red: { c: c.red, bg: c.redSoft, ink: c.redInk },
      amber: { c: c.gold, bg: c.goldSoft, ink: c.goldInk },
      ok: { c: c.green, bg: c.greenSoft, ink: c.green },
      wait: { c: c.wait, bg: c.waitSoft, ink: c.text },
      done: { c: c.faint, bg: c.sunk, ink: c.muted },
    };
    const T = (key) => tone[key] || tone.done;

    return {
      c,
      // Two columns on a desktop, one on a phone — the class is in
      // index.css, where the media query lives.
      // One column on a phone, two from 1024px — the ticket on the left,
      // staying in view while history scrolls beside it. The class holds
      // the media query; index.css is where ours live.
      wrap: { maxWidth: '1320px', display: 'grid', gap: '48px', alignItems: 'start' },
      column: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' },
      stickyColumn: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' },

      ticket: { background: c.card, border: `1px solid ${c.border}`, borderRadius: '20px', overflow: 'hidden' },
      ticketHead: (t) => ({ background: T(t).bg, padding: '16px 18px 14px' }),
      eyebrow: (t) => ({
        fontSize: '12px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: T(t).ink,
      }),
      sentence: (t) => ({ margin: '4px 0 0', fontSize: '21px', fontWeight: '800', lineHeight: 1.25, color: T(t).ink, textWrap: 'pretty' }),
      ticketBody: { padding: '14px 18px 4px', display: 'flex', flexDirection: 'column', gap: '12px' },
      whenLine: { fontSize: '13px', color: c.muted },

      // Four steps and their labels do not fit across a phone, so the row
      // wraps rather than running off the edge of the card.
      steps: {
        display: 'flex', alignItems: 'center', gap: '6px 8px', flexWrap: 'wrap',
        listStyle: 'none', margin: 0, padding: 0,
      },
      step: { display: 'flex', alignItems: 'center', gap: '6px' },
      stepDot: (reached, t) => ({
        width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
        background: reached ? T(t).c : c.bar,
      }),
      stepLabel: (current) => ({
        fontSize: '11px', fontWeight: current ? '700' : '500',
        color: current ? c.text : c.faint, whiteSpace: 'nowrap',
      }),
      stepLine: (reached, t) => ({ width: '18px', height: '2px', background: reached ? T(t).c : c.bar }),

      // The ticket tears here: status above, money below.
      tearWrap: { position: 'relative', margin: '14px 0 0', height: '2px' },
      tear: { borderTop: `2px dashed ${c.border}`, margin: '0 11px' },
      // Bitten out of the card in the page's own colour, so the ticket
      // reads as something you tear along.
      notch: (side) => ({
        position: 'absolute', top: '-11px', [side]: '-11px',
        width: '22px', height: '22px', borderRadius: '50%', background: c.page,
      }),
      receipt: { padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' },
      receiptRow: { display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '14px', color: c.text },
      receiptLabel: { color: c.muted, whiteSpace: 'nowrap' },
      leader: { flex: 1, borderBottom: `1px dotted ${c.border}`, transform: 'translateY(-4px)' },
      receiptAmount: (kind) => ({
        fontWeight: '600', whiteSpace: 'nowrap',
        color: kind === 'off' ? c.green : kind === 'fee' ? c.goldInk : c.text,
      }),
      owedRow: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        background: c.goldSoft, borderRadius: '10px', padding: '10px 12px',
      },
      owedLabel: { fontSize: '13.5px', fontWeight: '700', color: c.goldInk },
      owedAmount: { fontSize: '16px', fontWeight: '800', color: c.goldInk },

      actions: { display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '0 18px 18px' },
      actionBtn: (primary) => ({
        flex: '1 1 auto', minHeight: '48px', padding: '0 16px', borderRadius: '12px',
        border: `1px solid ${primary ? c.gold : c.border}`,
        background: primary ? c.gold : 'transparent',
        color: primary ? c.goldText : c.text,
        fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
      }),
      // A tap target on a phone, not a mouse target.
      smallBtn: (primary) => ({
        minHeight: '44px', padding: '0 14px', borderRadius: '10px',
        border: `1px solid ${primary ? c.gold : c.border}`,
        background: primary ? c.gold : 'transparent',
        color: primary ? c.goldText : c.text,
        fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
      }),

      alsoCard: { background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', overflow: 'hidden' },
      alsoTitle: { margin: 0, padding: '14px 16px 8px', fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase', color: c.faint },
      alsoRow: {
        width: '100%', minHeight: '60px', display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderTop: `1px solid ${c.border}`, background: 'transparent',
        border: 'none', borderBottom: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      },
      toneDot: (t) => ({ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: T(t).c }),
      alsoSentence: (t) => ({ display: 'block', fontSize: '14px', fontWeight: '650', color: T(t).ink }),
      alsoMeta: { display: 'block', fontSize: '12px', color: c.faint, marginTop: '2px' },
      chevron: { color: c.faint, fontSize: '18px', flexShrink: 0 },

      historyHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
      historyTitle: { margin: 0, fontSize: '20px', fontWeight: '800', color: c.text },
      chips: { display: 'flex', gap: '8px' },
      chip: (on) => ({
        minHeight: '36px', padding: '0 14px', borderRadius: '999px',
        border: `1px solid ${on ? c.text : c.border}`,
        background: on ? c.text : 'transparent',
        color: on ? c.card : c.muted,
        fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
      }),
      historyEmpty: { fontSize: '14px', color: c.muted, margin: '4px 0' },

      yearCard: { background: c.card, border: `1px solid ${c.border}`, borderRadius: '16px', overflow: 'hidden' },
      yearHead: {
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px',
        background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      },
      year: { fontSize: '22px', fontWeight: '800', color: c.text },
      yearSpend: { display: 'block', fontSize: '15px', fontWeight: '700', color: c.text },
      yearCount: { fontSize: '13px', fontWeight: '500', color: c.muted },
      yearNote: { display: 'block', fontSize: '12px', color: c.faint, marginTop: '2px' },

      histBlock: { borderTop: `1px solid ${c.border}` },
      histRow: {
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '12px 16px', background: 'transparent', border: 'none',
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      },
      histOpen: {
        display: 'flex', flexDirection: 'column', gap: '10px',
        padding: '0 16px 16px', marginTop: '-2px',
      },
      showAll: {
        width: '100%', minHeight: '48px', padding: '0 16px',
        background: 'transparent', border: 'none', borderTop: `1px solid ${c.border}`,
        color: c.goldInk, fontSize: '13.5px', fontWeight: '700',
        cursor: 'pointer', fontFamily: 'inherit',
      },
      histCar: { display: 'block', fontSize: '14px', fontWeight: '650', color: c.text },

      // Asking for something happens inside the booking, not over the
      // page: on a phone a full-screen form hides what you were looking at.
      panel: {
        width: '100%', margin: '0 0 2px', padding: '14px', borderRadius: '14px',
        background: c.sunk, border: `1px solid ${c.border}`,
        display: 'flex', flexDirection: 'column', gap: '12px',
      },
      panelHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
      panelTitle: { fontSize: '15px', fontWeight: '700', color: c.text },
      panelClose: {
        width: '44px', height: '44px', margin: '-10px -10px -10px 0', border: 'none',
        background: 'transparent', color: c.muted, fontSize: '22px', lineHeight: 1,
        cursor: 'pointer', fontFamily: 'inherit',
      },
      panelNote: { margin: 0, fontSize: '13px', lineHeight: 1.45, color: c.muted },
      chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
      reasonChip: (on) => ({
        minHeight: '40px', padding: '0 14px', borderRadius: '999px',
        border: `1px solid ${on ? c.gold : c.border}`,
        background: on ? c.goldSoft : 'transparent',
        color: on ? c.goldInk : c.text,
        fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
        textAlign: 'left',
      }),
      panelTextarea: {
        width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
        border: `1px solid ${c.border}`, background: c.card, color: c.text,
        fontSize: '13.5px', fontFamily: 'inherit', resize: 'vertical',
      },
      panelError: {
        padding: '9px 11px', borderRadius: '9px', fontSize: '13px',
        background: c.redSoft, color: c.redInk,
      },
      panelSubmit: (ready) => ({
        minHeight: '48px', padding: '0 18px', borderRadius: '12px', border: 'none',
        background: ready ? c.gold : c.bar, color: ready ? c.goldText : c.faint,
        fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
        cursor: ready ? 'pointer' : 'not-allowed',
      }),
      sentBand: {
        width: '100%', margin: '0', padding: '12px 14px', borderRadius: '12px',
        background: c.greenSoft, color: c.green, fontSize: '13.5px', fontWeight: '600', lineHeight: 1.45,
      },
      histAmount: (back) => ({ fontSize: '14px', fontWeight: '700', color: back ? c.green : c.text, whiteSpace: 'nowrap' }),
    };
  })();

  const styles = {
    container: { maxWidth: '1100px', margin: '0 auto', padding: '32px' },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: {
      fontSize: 'clamp(26px, 3.4vw, 36px)', fontWeight: '900', letterSpacing: '-0.01em',
      textTransform: 'uppercase', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px',
    },
    subtitle: { fontSize: '14px', fontStyle: 'italic', color: goldInk(isDark), marginBottom: '24px' },
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

    // One line per booking. The detail it used to carry is a click away, so
    // twenty-six bookings fit on a screen instead of three.
    rowList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    row: (faded) => ({
      display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left',
      padding: '13px 16px', borderRadius: '14px', cursor: 'pointer',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      opacity: faded ? 0.72 : 1,
    }),
    rowThumb: {
      width: '54px', height: '42px', borderRadius: '9px', flexShrink: 0, overflow: 'hidden',
      background: isDark
        ? 'radial-gradient(120% 82% at 50% 10%, #2c2d30 0%, #141517 100%)'
        : 'radial-gradient(120% 82% at 50% 10%, #f3f4f6 0%, #e2e4e8 100%)',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
      display: 'grid', placeItems: 'center',
    },
    rowThumbImg: { width: '100%', height: '100%', objectFit: 'contain' },
    rowThumbEmpty: { fontSize: '14px', color: isDark ? '#8a8d91' : '#6b7280' },
    rowMain: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 },
    rowTitle: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    rowCar: { fontSize: '14px', fontWeight: '800' },
    rowBadge: (status) => {
      const [bg, fg, bd] = {
        pending: [isDark ? '#303132' : '#f1f2f4', isDark ? '#b0b3b8' : '#4b5563', isDark ? '#3a3b3c' : '#e3e5e8'],
        confirmed: [isDark ? GOLD_TINT_DARK : GOLD_TINT, isDark ? GOLD_DARK : '#7c4a03', isDark ? 'rgba(232,161,0,0.42)' : '#edd693'],
        completed: [isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', isDark ? '#93c5fd' : '#1e40af', isDark ? 'rgba(37,99,235,0.4)' : '#bfdbfe'],
        cancelled: [isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2', isDark ? '#f87171' : '#b91c1c', isDark ? 'rgba(248,113,113,0.38)' : '#fecaca'],
      }[status] || [isDark ? '#303132' : '#f1f2f4', isDark ? '#b0b3b8' : '#4b5563', isDark ? '#3a3b3c' : '#e3e5e8'];
      return {
        fontSize: '9.5px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: '999px', background: bg, color: fg, border: `1px solid ${bd}`,
      };
    },
    rowDates: { fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280', fontVariantNumeric: 'tabular-nums' },
    // The one line saying why this booking wants them. Colour carries the
    // same meaning it does everywhere else: red owes or is late, gold needs
    // a decision, blue is only telling them something.
    rowNote: (tone) => ({
      display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px',
      fontSize: '12px', fontWeight: '700',
      color: tone === 'red' ? (isDark ? '#f87171' : '#b91c1c')
        : tone === 'gold' ? (isDark ? GOLD_DARK : '#7c4a03')
          : tone === 'blue' ? (isDark ? '#93c5fd' : '#1e40af')
            : (isDark ? '#b0b3b8' : '#4b5563'),
    }),
    rowDot: (tone) => ({
      width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
      background: tone === 'red' ? (isDark ? '#f87171' : '#b91c1c')
        : tone === 'gold' ? (isDark ? GOLD_DARK : GOLD)
          : tone === 'blue' ? (isDark ? '#93c5fd' : '#1e40af')
            : (isDark ? '#8a8d91' : '#9ca3af'),
    }),
    rowTotal: { fontSize: '15px', fontWeight: '800', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },

    // Above the tabs and outside the filter on purpose: a vehicle three days
    // overdue must not be reachable only by first choosing the right tab.
    attnWrap: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' },
    attnHeadRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' },
    attnCount: { fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280' },
    attnGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' },
    // Four kinds of urgency, four borders. Overdue is the only one that gets
    // red — the rest want an answer, not an apology.
    attnCard: (tone) => ({
      display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px', borderRadius: '18px',
      background: tone === 'red' ? (isDark ? 'rgba(248,113,113,0.10)' : '#fef2f2')
        : tone === 'muted' ? (isDark ? '#242526' : '#fff')
          : (isDark ? GOLD_TINT_DARK : GOLD_TINT),
      border: `1px solid ${tone === 'red' ? (isDark ? 'rgba(248,113,113,0.45)' : '#fecaca')
        : tone === 'muted' ? (isDark ? '#3a3b3c' : '#e3e5e8')
          : (isDark ? 'rgba(232,161,0,0.45)' : '#edd693')}`,
    }),
    attnTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    // A pill rather than bare text: it is the first thing read on the card
    // and it has to say which of the four this is at a glance.
    attnKicker: (tone) => ({
      display: 'inline-block', padding: '4px 11px', borderRadius: '999px',
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      background: tone === 'solid' ? (isDark ? GOLD_DARK : GOLD)
        : tone === 'red' ? (isDark ? 'rgba(248,113,113,0.16)' : '#fee2e2')
          : tone === 'muted' ? (isDark ? '#3a3b3c' : '#f1f2f4')
            : (isDark ? 'rgba(232,161,0,0.18)' : '#faedc7'),
      color: tone === 'solid' ? ON_GOLD
        : tone === 'red' ? (isDark ? '#f87171' : '#b91c1c')
          : tone === 'muted' ? (isDark ? '#b0b3b8' : '#4b5563')
            : (isDark ? GOLD_DARK : '#7c4a03'),
      border: tone === 'red' ? `1px solid ${isDark ? 'rgba(248,113,113,0.4)' : '#fecaca'}` : 'none',
    }),
    attnNum: { fontSize: '12px', fontWeight: '700', color: isDark ? '#8a8d91' : '#9ca3af' },
    attnHead: (tone) => ({
      fontSize: '20px', fontWeight: '800', lineHeight: 1.15,
      color: tone === 'red' ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#e4e6eb' : '#1a1a1a'),
    }),
    attnCar: { fontSize: '12.5px', fontWeight: '700', color: isDark ? '#b0b3b8' : '#4b5563', marginTop: '-4px' },
    attnBody: { fontSize: '12.5px', lineHeight: 1.55, color: isDark ? '#8a8d91' : '#6b7280', margin: 0 },
    attnActions: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' },

    // A panel rather than a page: the list stays where it was, so closing it
    // returns them to the same place in the same scroll position.
    drawerScrim: {
      position: 'fixed', inset: 0, zIndex: LAYERS.drawerScrim,
      background: isDark ? 'rgba(12,12,13,0.66)' : 'rgba(24,25,26,0.45)',
    },
    drawer: {
      position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: LAYERS.drawer,
      width: 'min(620px, 100vw)', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: '18px',
      background: isDark ? '#242526' : '#fff',
      borderLeft: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
      padding: '28px',
      boxSizing: 'border-box',
    },
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
      display: 'flex', gap: '18px', flexWrap: 'nowrap', alignItems: 'flex-start',
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
      display: 'flex', flexDirection: 'column', gap: '7px',
    },
    topRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    bookingNum: { fontSize: '17px', fontWeight: '800', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.02em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
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
    // Full width beneath the heading rather than a narrow column beside it,
    // and its lines laid out across the panel instead of down one edge.
    pickupPanel: {
      minWidth: 0,
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: '10px 24px',
      fontSize: '12px', lineHeight: '1.5', padding: '16px 18px', borderRadius: '14px',
      background: isDark ? '#1e1f20' : '#f8f9fa',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
    },
    pickupLine: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: isDark ? '#86efac' : '#166534', fontWeight: '700' },
    returnLine: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: isDark ? '#b0b3b8' : '#6b7280', fontWeight: '700', marginTop: '6px' },
    driverNote: { marginTop: '8px', fontStyle: 'italic', fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', gridColumn: '1 / -1',
    },
    // actionsIndent sits in topSection's own grid now (see actionsCell),
    // so it's exactly as wide as the details row above it — no separate
    // grid, no guessed indent number.
    actionsIndent: {
      display: 'flex', gap: '10px', flexWrap: 'wrap',
      paddingTop: '14px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    // Same shape as the card's own actions, so the strip does not introduce
    // a third kind of button to the page.
    // Sentence case and square-ish on purpose: uppercase with letter-spacing
    // made these wide enough to wrap onto two lines inside a 240px card.
    primaryBtn: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px',
      fontSize: '13px', fontWeight: '800',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    ghostBtn: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px',
      fontSize: '13px', fontWeight: '700',
      background: 'transparent', color: isDark ? '#e4e6eb' : '#1a1a1a',
      border: `1px solid ${isDark ? '#4a4b4c' : '#d1d5db'}`, borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
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
      color: goldInk(isDark),
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
    activityNote: {
      fontSize: '11.5px', fontWeight: '700', lineHeight: 1.4, marginTop: '10px',
      color: goldInk(isDark),
    },
    tripRecord: {
      display: 'flex', flexDirection: 'column', gap: '4px',
      margin: '10px 0 0', padding: '10px 12px', borderRadius: '10px',
      fontSize: '12px', lineHeight: 1.5,
      background: isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb',
      color: isDark ? '#b0b3b8' : '#6b7280',
      border: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    tripPhotosRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' },
    tripPhoto: {
      width: '58px', height: '44px', objectFit: 'cover', borderRadius: '6px', cursor: 'zoom-in',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    dueSoonBanner: {
      margin: '10px 0 0', padding: '11px 13px', borderRadius: '10px',
      fontSize: '12.5px', fontWeight: '700', lineHeight: 1.5,
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      color: isDark ? '#e4e6eb' : '#7c4a03',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.35)' : 'rgba(184,121,10,0.3)'}`,
    },
    overdueBanner: {
      margin: '10px 0 0', padding: '11px 13px', borderRadius: '10px',
      fontSize: '12.5px', fontWeight: '700', lineHeight: 1.5,
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#991b1b',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
    },
    chargeNote: (settled) => ({
      margin: '10px 0 0', padding: '9px 12px', borderRadius: '10px',
      fontSize: '12px', fontWeight: '600', lineHeight: 1.5,
      background: settled
        ? (isDark ? 'rgba(255,255,255,0.04)' : '#f9fafb')
        : (isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2'),
      color: settled ? (isDark ? '#b0b3b8' : '#6b7280') : (isDark ? '#f87171' : '#991b1b'),
      border: `1px solid ${settled ? (isDark ? '#3a3b3c' : '#f3f4f6') : (isDark ? 'rgba(248,113,113,0.3)' : '#fecaca')}`,
    }),
    lateFeeNote: {
      margin: '10px 0 0', padding: '10px 12px', borderRadius: '10px',
      fontSize: '12px', fontWeight: '600', lineHeight: 1.5,
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#991b1b',
    },
    extendedNote: {
      fontSize: '11px', fontWeight: '700', lineHeight: 1.4, marginTop: '4px',
      color: goldInk(isDark), gridColumn: '1 / -1',
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
      color: goldInk(isDark),
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)'}`,
      borderRadius: '999px',
      cursor: 'pointer',
    },
    priceCol: {
      textAlign: 'right',
      minWidth: 0,
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
      color: goldInk(isDark),
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
      color: goldInk(isDark),
    },
    balanceDue: {
      fontSize: '10px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '3px',
    },
    bookedOn: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '8px' },
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: LAYERS.modal,
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


  // The whole of the old booking card, unchanged. It used to be the list
  // item; it is now what the drawer shows. A row can therefore stay a row,
  // and not one of these states had to be rewritten to move them.
  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>My Bookings</h1>
          <p style={styles.subtitle}>View and manage all your car rental bookings in one place.</p>
        </div>
        {!loading && unratedCount > 0 && (
          <button style={styles.rateBookingsBtn} onClick={() => navigate('/my-bookings/rate')}>
            <StarGlyph /> Rate My Bookings
            <span style={styles.rateBookingsBadge}>{unratedCount}</span>
          </button>
        )}
      </div>

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
        <div className="mb-grid" style={mb.wrap}>
          {/* ── what is going on now ─────────────────────────────── */}
          {liveBookings.length > 0 && (
            <div className="mb-live" style={mb.stickyColumn}>
              {ticket && (
                <article style={mb.ticket}>
                  <div style={mb.ticketHead(ticket.toneKey)}>
                    <div style={mb.eyebrow(ticket.toneKey)}>
                      {ticket.car?.brand} {ticket.car?.model} · #{refOf(ticket)}
                    </div>
                    <h2 style={mb.sentence(ticket.toneKey)}>{ticket.sentence}</h2>
                  </div>

                  <div style={mb.ticketBody}>
                    <div style={mb.whenLine}>
                      {formatMoment(ticket.startDate, ticket.hasPickupTime, DATE_SHORT)}
                      {' → '}
                      {formatMoment(ticket.endDate, ticket.hasPickupTime, DATE_SHORT)}
                    </div>

                    <ol style={mb.steps}>
                      {STEP_LABELS.map((label, i) => (
                        <li key={label} style={mb.step}>
                          <span style={mb.stepDot(i <= ticket.step, ticket.toneKey)} />
                          <span style={mb.stepLabel(i === ticket.step)}>{label}</span>
                          {i < STEP_LABELS.length - 1 && (
                            <span style={mb.stepLine(i < ticket.step, ticket.toneKey)} />
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div style={mb.tearWrap}>
                    <span style={mb.notch('left')} />
                    <div style={mb.tear} />
                    <span style={mb.notch('right')} />
                  </div>

                  <div style={mb.receipt}>
                    {ticket.money.lines.map((line) => (
                      <div key={line.label} style={mb.receiptRow}>
                        <span style={mb.receiptLabel}>{line.label}</span>
                        <span style={mb.leader} />
                        <span style={mb.receiptAmount(line.kind)}>
                          {line.amount < 0 ? '− ' : line.kind === 'fee' ? '+ ' : ''}
                          {peso(line.amount)}
                        </span>
                      </div>
                    ))}
                    <div style={{ ...mb.receiptRow, fontWeight: '700' }}>
                      <span style={mb.receiptLabel}>You&apos;ve paid</span>
                      <span style={mb.leader} />
                      <span style={mb.receiptAmount()}>{peso(ticket.money.paid)}</span>
                    </div>
                    {ticket.money.owe > 0 && (
                      <div style={mb.owedRow}>
                        <span style={mb.owedLabel}>Still to pay {ticket.money.oweWhen}</span>
                        <span style={mb.owedAmount}>{peso(ticket.money.owe)}</span>
                      </div>
                    )}
                    {ticket.money.back > 0 && (
                      <div style={mb.receiptRow}>
                        <span style={mb.receiptLabel}>Came back</span>
                        <span style={mb.leader} />
                        <span style={{ ...mb.receiptAmount(), color: mb.c.green }}>{peso(ticket.money.back)}</span>
                      </div>
                    )}
                  </div>

                  {bookingAwaitingDecision(ticket) && (
                    <div style={{ padding: '0 18px 4px' }}>
                      <AdjustOfferPanel
                        booking={ticket}
                        isDark={isDark}
                        busy={offerBusyId === ticket._id}
                        onDecide={(decision, payload) => handleOfferDecision(ticket, decision, payload)}
                      />
                    </div>
                  )}

                  <div style={{ padding: '0 18px 16px' }}>
                    {panelFor(ticket)}
                    {sentBanner(ticket)}
                  </div>

                  {ticket.actions.length > 0 && !bookingAwaitingDecision(ticket) && !sentFor[ticket._id] && (
                    <div style={mb.actions}>
                      {ticket.actions.map((key) => (
                        <button
                          key={key}
                          type="button"
                          style={mb.actionBtn(isPrimaryAction(key, ticket.toneKey))}
                          disabled={withdrawingId === ticket._id}
                          onClick={() => runAction(key, ticket)}
                        >
                          {ACTION_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              )}

              {/* The rest of what is live, one line each. */}
              {alsoGoingOn.length > 0 && (
                <section style={mb.alsoCard}>
                  <h3 style={mb.alsoTitle}>Also going on</h3>
                  {alsoGoingOn.map((b) => (
                    <button
                      key={b._id}
                      type="button"
                      style={mb.alsoRow}
                      onClick={() => setFocusId(b._id)}
                    >
                      <span style={mb.toneDot(b.toneKey)} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={mb.alsoSentence(b.toneKey)}>{b.sentence}</span>
                        <span style={mb.alsoMeta}>
                          {b.car?.brand} {b.car?.model} · {moneySummary(b.money)}
                        </span>
                      </span>
                      <span style={mb.chevron}>›</span>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}

          {/* ── what already happened ────────────────────────────── */}
          <div style={mb.column}>
            <div style={mb.historyHead}>
              <h2 style={mb.historyTitle}>History</h2>
              <div style={mb.chips}>
                {[['trips', 'Trips', historyCounts.trips], ['cancelled', 'Cancelled', historyCounts.cancelled]].map(
                  ([key, label, count]) => (
                    <button
                      key={key}
                      type="button"
                      style={mb.chip(histTab === key)}
                      aria-pressed={histTab === key}
                      onClick={() => setHistTab(key)}
                    >
                      {label} {count}
                    </button>
                  ),
                )}
              </div>
            </div>

            {historyYears.length === 0 ? (
              <p style={mb.historyEmpty}>
                {histTab === 'trips'
                  ? 'No finished trips yet.'
                  : 'Nothing cancelled — every booking you made went ahead.'}
              </p>
            ) : (
              historyYears.map((group) => {
                const open = openYears[group.year] ?? group.latest;
                return (
                  <section key={group.year} style={mb.yearCard}>
                    <button
                      type="button"
                      style={mb.yearHead}
                      aria-expanded={open}
                      onClick={() => setOpenYears((y) => ({ ...y, [group.year]: !open }))}
                    >
                      <span style={mb.year}>{group.year}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={mb.yearSpend}>
                          {peso(group.spent)} <span style={mb.yearCount}>on {group.trips} trip{group.trips === 1 ? '' : 's'}</span>
                        </span>
                        <span style={mb.yearNote}>
                          {group.cancelled > 0 && `${group.cancelled} cancelled`}
                          {group.cancelled > 0 && group.back > 0 && ' · '}
                          {group.back > 0 && <span style={{ color: mb.c.green }}>{peso(group.back)} came back</span>}
                        </span>
                      </span>
                      <span style={mb.chevron}>{open ? '⌄' : '›'}</span>
                    </button>

                    {open && shownRows(group).map((b) => {
                      const expanded = !!openRows[b._id] || panel?.bookingId === b._id || !!sentFor[b._id];
                      return (
                        <div key={b._id} style={mb.histBlock}>
                          {/* A row is a line until you ask for more: forty
                              rows each carrying their own buttons is a wall
                              of gold, and the ones that need doing stop
                              standing out. */}
                          <button
                            type="button"
                            style={mb.histRow}
                            aria-expanded={expanded}
                            onClick={() => setOpenRows((r) => ({ ...r, [b._id]: !expanded }))}
                          >
                            <span style={mb.toneDot(b.toneKey)} />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={mb.histCar}>{b.car?.brand} {b.car?.model}</span>
                              <span style={mb.alsoSentence(b.toneKey)}>{b.sentence}</span>
                              <span style={mb.alsoMeta}>
                                {formatMoment(b.startDate, false, DATE_SHORT)} → {formatMoment(b.endDate, false, DATE_SHORT)}
                              </span>
                            </span>
                            <span style={mb.histAmount(b.money.back > 0)}>
                              {b.money.back > 0 ? `+${peso(b.money.back)}` : peso(b.money.paid || b.money.cost)}
                            </span>
                            <span style={{ ...mb.chevron, transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
                          </button>

                          {expanded && (
                            <div style={mb.histOpen}>
                              {b.money.lines.map((line) => (
                                <div key={line.label} style={mb.receiptRow}>
                                  <span style={mb.receiptLabel}>{line.label}</span>
                                  <span style={mb.leader} />
                                  <span style={mb.receiptAmount(line.kind)}>
                                    {line.amount < 0 ? '− ' : line.kind === 'fee' ? '+ ' : ''}
                                    {peso(line.amount)}
                                  </span>
                                </div>
                              ))}
                              <div style={{ ...mb.receiptRow, fontWeight: '700' }}>
                                <span style={mb.receiptLabel}>You paid</span>
                                <span style={mb.leader} />
                                <span style={mb.receiptAmount()}>{peso(b.money.paid)}</span>
                              </div>
                              {b.money.back > 0 && (
                                <div style={mb.receiptRow}>
                                  <span style={mb.receiptLabel}>Came back</span>
                                  <span style={mb.leader} />
                                  <span style={{ ...mb.receiptAmount(), color: mb.c.green }}>{peso(b.money.back)}</span>
                                </div>
                              )}

                              {panelFor(b)}
                              {sentBanner(b)}

                              {b.actions.length > 0 && !sentFor[b._id] && !panelFor(b) && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {b.actions.map((key) => (
                                    <button
                                      key={key}
                                      type="button"
                                      style={mb.smallBtn(isPrimaryAction(key, b.toneKey))}
                                      disabled={withdrawingId === b._id}
                                      onClick={() => runAction(key, b)}
                                    >
                                      {ACTION_LABELS[key]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {open && group.rows.length > shownRows(group).length && (
                      <button
                        type="button"
                        style={mb.showAll}
                        onClick={() => setShowAllYears((y) => ({ ...y, [group.year]: true }))}
                      >
                        Show all {group.rows.length} {histTab === 'trips' ? 'trips' : 'cancellations'} from {group.year}
                      </button>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}

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