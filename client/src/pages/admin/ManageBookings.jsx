import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import BackButton from '../../components/BackButton';
import StarRating from '../../components/StarRating';
import ClientRatingModal from '../../components/ClientRatingModal';
import BookingDetailsModal from '../../components/BookingDetailsModal';
import { SkeletonListCard } from '../../components/Skeleton';
import Pagination from '../../components/Pagination';
import StatusDropdown from '../../components/StatusDropdown';
import { paginate } from '../../utils/paginate';
import { hasClientScore, clientScoreLabel } from '../../utils/clientScore';
import { vehicleOutOfService } from '../../utils/blockedDates';
import { GOLD, GOLD_DARK, ON_GOLD, GOLD_TINT, GOLD_TINT_DARK, goldInk} from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import api from '../../api';
import { bookingAwaitingDecision, timeLeftLabel } from '../../utils/offerWindow';
import { formatMoment, phYmd } from '../../utils/phTime';
import { FUEL_STEPS, fuelLabel, fuelShortfallLabel } from '../../utils/fuel';
import ConditionPhotos from '../../components/ConditionPhotos';
import { licenceProblem } from '../../utils/documents';
import { RepeatGlyph } from '../../components/Glyphs';
import { StarGlyph } from '../../components/Glyphs';

const LOW_RATING_THRESHOLD = 3;
// How long after the pickup time a no-show can still be recorded. Mirrors
// the same rule on the server, which is the one that actually decides —
// this only keeps the button from being offered when it would be refused.
const NO_SHOW_WINDOW_HOURS = 24;
// How early a handover can be recorded, mirroring the server. Clients turn
// up before their hour and the counter shouldn't have to wait for the clock.
const EARLY_COLLECT_HOURS = 2;
const DASH_JS = '—';
const peso = (n) => `\u20b1${(n || 0).toLocaleString()}`;

// How long a change is worth pointing out. After a day it is history, and a
// list covered in badges says nothing at all.
const ACTIVITY_WINDOW_HOURS = 24;

const agoLabel = (at) => {
  const mins = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? 'an hour ago' : `${hrs} hours ago`;
};

// Position is decided by urgency now, so a change has to announce itself
// where it sits rather than by jumping the queue.
const freshActivity = (b) => {
  const at = b.lastActivity?.at;
  if (!at) return '';
  const hrs = (Date.now() - new Date(at).getTime()) / 3600000;
  if (hrs > ACTIVITY_WINDOW_HOURS || hrs < 0) return '';
  return `Updated ${agoLabel(at)}${b.lastActivity.what ? ` — ${b.lastActivity.what}` : ''}`;
};


// Papers that will not last the booking. Only worth saying while something
// can still be done about it, which means before the trip is over.
const docWarning = (b) => {
  if (!['pending', 'confirmed'].includes(b.status)) return '';
  const on = (d) => new Date(d).toLocaleDateString();
  const lic = licenceProblem(b.user, { bookingType: b.bookingType, endDate: b.endDate });
  // 'missing' is deliberately not reported here. This list only receives the
  // fields the bookings query populates, so an absent expiry date is just as
  // likely to mean "not loaded" as "not on file" — and accusing a client of
  // having no licence because of a stale deploy is worse than saying nothing.
  // The booking route has the whole user record and refuses it there.
  if (lic?.kind === 'expired') return `Licence expired ${on(lic.expiry)} — they cannot drive this.`;
  if (lic?.kind === 'expires_during') return `Licence expires ${on(lic.expiry)}, before this trip ends.`;
  return '';
};

// Confirmed covers three different situations @ booked for next month, due
// today, and gone. Only the last one means a vehicle is physically not here,
// which is the thing worth being able to see on its own.
const isOnTrip = (b) => b.status === 'confirmed' && !!b.collectedAt && !b.returnedAt;
// Out and past its return time. Mirrors isOverdue on the server, which is
// the one that actually decides — this only drives what admin is shown.
const isOverdue = (b) => isOnTrip(b) && new Date(b.endDate) < new Date();
// Out and due back before the day is over. The point of saying so is that
// it is still preventable, so it is a different colour and a different
// sentence from one that is already late.
const isDueBack = (b) => isOnTrip(b) && !isOverdue(b)
  && new Date(b.endDate) <= new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
// "Due back" means within the next 24 hours, not within today — a vehicle
// due at seven tomorrow morning is on that list, and calling it "today" on
// the evening of the 14th was simply untrue. One booking can name its own
// day; several share only the window.
const dueBackLabel = (list, now = new Date()) => {
  if (list.length !== 1) return 'in the next 24 hours';
  const day = phYmd(list[0].endDate);
  if (day === phYmd(now)) return 'today';
  if (day === phYmd(new Date(now.getTime() + 24 * 60 * 60 * 1000))) return 'tomorrow';
  return 'in the next 24 hours';
};
const daysOverdue = (b) => Math.max(1, Math.ceil((Date.now() - new Date(b.endDate).getTime()) / (24 * 60 * 60 * 1000)));
// Confirmed was one label over four situations, each wanting a different
// thing from you: nothing yet, check them in, nothing again, chase them.
// Splitting it is what lets a row show the one action that belongs to it
// instead of every action a booking can ever have.
const hoursTo = (d) => (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60);
const isAwaitingPickup = (b) => b.status === 'confirmed' && !b.collectedAt;
const isForPickup = (b) => isAwaitingPickup(b) && hoursTo(b.startDate) <= EARLY_COLLECT_HOURS;
const isUpcoming = (b) => isAwaitingPickup(b) && hoursTo(b.startDate) > EARLY_COLLECT_HOURS;
const PAGE_SIZE = 10;

// Mirrors refundAmountFor in server/utils/cancelBooking.js. The server
// recomputes it and its answer is what's actually refunded — this only
// exists so admin sees the figure before committing to it.
const refundPercentage = (createdAt, now = new Date()) => {
  const hours = (now.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours <= 12) return 100;
  if (hours <= 24) return 50;
  return 0;
};
const TERMS_NOT_MET_PERCENT = 50;
const previewRefund = (booking, reason) => {
  if (!booking || booking.payment !== 'paid' || !booking.amountPaid) return 0;
  if (reason === 'vehicle_unavailable') return booking.amountPaid;
  if (reason === 'client_requested') {
    return Math.round(booking.amountPaid * (refundPercentage(booking.createdAt) / 100));
  }
  if (reason === 'breakdown' || reason === 'breakdown_client' || reason === 'not_returned') {
    // Days paid for and not had. Same refund whoever broke it — we do not
    // keep money for days nobody used the vehicle — except the day it broke
    // on, which is a day of service only if they were the ones who ended it.
    const total = booking.totalDays || 1;
    const elapsed = (Date.now() - new Date(booking.startDate).getTime()) / 86400000;
    const chargesTheDay = reason === 'breakdown_client' || reason === 'not_returned';
    const raw = elapsed <= 0 ? 0 : (chargesTheDay ? Math.ceil(elapsed) : Math.floor(elapsed));
    const used = Math.min(total, Math.max(0, raw));
    const owedForUsed = Math.round((booking.totalPrice || 0) * (used / total));
    return Math.max(0, Math.min(booking.amountPaid, booking.amountPaid - owedForUsed));
  }
  if (reason === 'terms_not_met') {
    // Half back beforehand, nothing on the day itself — by then the vehicle
    // can no longer be let to anybody else, so the day is gone either way.
    const onTheDay = phYmd(new Date()) >= phYmd(booking.startDate);
    return onTheDay ? 0 : Math.round(booking.amountPaid * (TERMS_NOT_MET_PERCENT / 100));
  }
  return 0;
};

const ClockGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="8.5" />
    <polyline points="12 7.5 12 12 15 14" />
  </svg>
);

const CalendarGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" />
  </svg>
);

const ManageBookings = () => {
  usePageTitle('Manage Bookings');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { toast, confirm } = useUIFeedback();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalId, setRatingModalId] = useState(null);
  const [detailsBookingId, setDetailsBookingId] = useState(null);
  // The row the panel is about. Null means "the first one in the list",
  // worked out below, so the panel is never empty while there are bookings.
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rescheduleOnly, setRescheduleOnly] = useState(false);
  const [page, setPage] = useState(1);

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

  // Every action used to end by downloading all 164 bookings again — a few
  // hundred kilobytes and a couple of seconds, to change one word on one
  // row. The server already hands back the booking it just updated, so the
  // row is patched from that and the screen answers immediately.
  const applyBooking = (updated) => {
    if (!updated?._id) return;
    setBookings((prev) => prev.map((b) => (b._id === updated._id ? { ...b, ...updated } : b)));
    // Something the server wants said about what just happened, rather
    // than a field of the booking — a with-driver booking accepted with
    // nobody free to drive it. It is not an error: the booking is on, and
    // this is a job to do before pickup day.
    if (updated.driverWarning) toast.info(updated.driverWarning);
  };

  // Some actions reach beyond the booking they were aimed at: confirming one
  // request cancels the rival requests for the same dates, cancelling frees
  // the vehicle, moving it changes another car's calendar. Those still need
  // the full list — but nobody has to WATCH it arrive. The row updates at
  // once and the rest catches up a moment later.
  const refreshQuietly = () => { fetchBookings(); };

  // Cancelling asks why first — the reason is what decides the refund, so it
  // can't be inferred after the fact. Everything else goes straight through.
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: 'vehicle_unavailable', note: '' });
  // Closing a booking is the only chance to read the gauge, so it stopped
  // being a yes/no confirm and became a short form.
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnForm, setReturnForm] = useState({ fuel: undefined, charge: '', photos: [], note: '', damage: '' });
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveOptions, setMoveOptions] = useState(null);
  const [moveBusy, setMoveBusy] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Other paid requests for the same vehicle whose dates overlap this one.
  // Nothing stops two clients requesting the same days — only a CONFIRMED
  // booking blocks anybody — so confirming one of them decides the race, and
  // admin should see that before it happens rather than after. Unpaid
  // requests are left out: they have no money at stake and this page never
  // shows them anyway.
  const competitorsFor = (booking) => bookings.filter((b) =>
    b._id !== booking._id
    && b.status === 'pending'
    && b.payment === 'paid'
    && String(b.car?._id || b.car) === String(booking.car?._id || booking.car)
    && !bookingAwaitingDecision(b)
    && new Date(b.startDate) < new Date(booking.endDate)
    && new Date(b.endDate) > new Date(booking.startDate));

  const tripDates = (b) => `${formatMoment(b.startDate, b.hasPickupTime, { month: 'numeric', day: 'numeric', year: 'numeric' })} – ${formatMoment(b.endDate, b.hasPickupTime, { month: 'numeric', day: 'numeric', year: 'numeric' })}`;

  const handleStatus = async (id, status) => {
    if (status === 'cancelled') {
      const booking = bookings.find((b) => b._id === id);
      setCancelTarget(booking || { _id: id });
      setCancelForm({ reason: 'vehicle_unavailable', note: '' });
      return;
    }

    if (status === 'confirmed') {
      const booking = bookings.find((b) => b._id === id);
      const rivals = booking ? competitorsFor(booking) : [];
      if (rivals.length) {
        const list = rivals
          .map((b) => `• ${b.user?.name || 'A client'} — ${tripDates(b)} (₱${(b.amountPaid || 0).toLocaleString()} paid)`)
          .join('\n');
        const ok = await confirm(
          `${rivals.length} other paid request${rivals.length === 1 ? '' : 's'} cover these dates:\n\n${list}\n\n`
          + 'Confirming this booking takes the vehicle off them. Each will be offered the nearest dates we can still do, '
          + 'or refunded in full if there is nothing to offer.',
          { confirmLabel: 'Yes, confirm this one', cancelLabel: 'Not yet' }
        );
        if (!ok) return;
      }
    }

    return applyStatus(id, { status });
  };

  const applyStatus = async (id, body) => {
    try {
      const res = await api.put(`/bookings/${id}`, body);
      if (res.data.autoRefunded) {
        toast.info(res.data.message);
      }
      // A status change is the one that touches other bookings, so the row
      // lands now and the list reconciles behind it.
      applyBooking(res.data.booking || res.data);
      refreshQuietly();
      refetchPendingCounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating this booking.');
    }
  };

  const submitCancel = async () => {
    // No read-back of the figure any more: nobody types it, the reason
    // decides it, and it is shown in the dialog before the button is
    // pressed. What still deserves one is keeping money back — so that is
    // what gets confirmed, in the words of the policy it comes from.
    const refund = previewRefund(cancelTarget, cancelForm.reason);
    const paid = cancelTarget?.amountPaid || 0;
    // Every reason that keeps money back should have to be meant. This one
    // refunds nothing once the booking is more than a day old, and went
    // through on a single click while the other two asked first — so one
    // slip down the reason list cancelled somebody's booking and returned
    // nothing, silently.
    if (cancelForm.reason === 'client_requested' && paid > 0 && refund < paid) {
      const ok = await confirm(
        refund > 0
          ? `This client paid ${peso(paid)} and will get ${peso(refund)} back under the refund policy, `
            + `measured by how much notice they are giving before pickup. Cancelling can't be undone.`
          : `Pickup is less than 24 hours away, so under the refund policy this client gets nothing `
            + `back of the ${peso(paid)} they paid. Cancelling can't be undone.`,
        { confirmLabel: 'Yes, cancel the booking', cancelLabel: 'Go back' }
      );
      if (!ok) return;
    }
    if (cancelForm.reason === 'terms_not_met' && paid > 0) {
      const ok = await confirm(
        refund > 0
          ? `This client paid ₱${paid.toLocaleString()} and will get ₱${refund.toLocaleString()} back — half, `
            + `because the booking conditions were not met. Cancelling can't be undone.`
          : `This is the pickup date, so under our terms this client gets nothing back of the `
            + `₱${paid.toLocaleString()} they paid. Cancelling can't be undone.`,
        { confirmLabel: 'Yes, cancel the booking', cancelLabel: 'Go back' }
      );
      if (!ok) return;
    }

    setCancelSubmitting(true);
    try {
      await applyStatus(cancelTarget._id, {
        status: 'cancelled',
        cancelReason: cancelForm.reason,
        cancelNote: cancelForm.note,
        damageCharge: cancelForm.damage,
      });
      setCancelTarget(null);
      toast.success('Booking cancelled. The client has been notified.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleCollectLateFee = async (booking) => {
    const ok = await confirm(
      `Confirm you have received the ${peso(booking.lateFee.amount)} late fee from this client, in cash or by GCash. `
      + `It covers ${booking.lateFee.days} day${booking.lateFee.days === 1 ? '' : 's'} at the vehicle's daily rate, `
      + 'as set out in the booking terms.',
      { confirmLabel: 'Received', cancelLabel: 'Not yet' }
    );
    if (!ok) return;
    try {
      const res = await api.put(`/bookings/${booking._id}/late-fee/collected`);
      applyBooking(res.data.booking || res.data);
      toast.success('Late fee recorded as settled.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong recording this late fee.');
    }
  };

  const handleCollectBalance = async (booking) => {
    const remaining = booking.totalPrice - booking.amountPaid;
    const ok = await confirm(
      `Confirm you've received the remaining ₱${remaining.toLocaleString()} from this client (cash or GCash at pickup).`,
      { confirmLabel: 'Yes, mark as received', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    try {
      const res = await api.put(`/bookings/${booking._id}/collect-balance`);
      applyBooking(res.data.booking || res.data);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong recording this balance.');
    }
  };

  const handleMarkReturned = async (booking) => {
    // Closing a booking the client is at GCash paying to extend. Their
    // payment is refunded rather than applied, which is right, but it is
    // better not to take their money and give it back inside a minute.
    if (booking.pendingExtension?.checkoutSessionId) {
      const ok = await confirm(
        'This client is part-way through paying to extend this booking. Completing it now cancels that '
        + 'extension and refunds what they pay. Give them a few minutes if they are still at the payment page.',
        { confirmLabel: 'Complete it anyway', cancelLabel: 'Wait' }
      );
      if (!ok) return;
    }
    const isEarly = new Date() < new Date(booking.endDate);
    if (isEarly) {
      const ok = await confirm(
        `The scheduled return date is ${new Date(booking.endDate).toLocaleDateString()}. Only confirm if the vehicle has actually been returned early.`,
        { confirmLabel: 'Yes, mark as returned', cancelLabel: 'Cancel' }
      );
      if (!ok) return;
    }
    setReturnTarget(booking);
    setReturnForm({ fuel: undefined, charge: '', photos: [], note: '', damage: '' });
  };

  const submitReturn = async () => {
    setReturnSubmitting(true);
    try {
      await applyStatus(returnTarget._id, {
        status: 'completed',
        fuelAtReturn: returnForm.fuel,
        fuelCharge: returnForm.charge,
        returnPhotos: returnForm.photos,
        returnNote: returnForm.note,
        damageCharge: returnForm.damage,
      });
      setReturnTarget(null);
      toast.success('Return recorded.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Settled on the phone, then recorded here. The list is what admin needs
  // in front of them while they are talking to somebody at a roadside.
  const openMove = async (booking) => {
    setMoveTarget(booking);
    setMoveOptions(null);
    try {
      const res = await api.get(`/bookings/${booking._id}/vehicle-options`);
      setMoveOptions(res.data.options || []);
    } catch (err) {
      console.error(err);
      setMoveOptions([]);
      toast.error(err.response?.data?.message || 'Could not load available vehicles.');
    }
  };

  const doMove = async (option) => {
    const ok = await confirm(
      `Move this booking onto the ${option.brand} ${option.model} for the remaining `
      + `${option.left} day${option.left === 1 ? '' : 's'}? `
      + (option.difference === 0
        ? 'The price does not change.'
        : option.difference > 0
          ? `The client would owe ${peso(option.difference)} more.`
          : `${peso(Math.abs(option.difference))} would be due back to them.`)
      + ' Settle the money with them directly.',
      { confirmLabel: 'Yes, move it', cancelLabel: 'Go back' }
    );
    if (!ok) return;
    setMoveBusy(option.id);
    try {
      const res = await api.put(`/bookings/${moveTarget._id}/move-vehicle`, { carId: option.id });
      setMoveTarget(null);
      applyBooking(res.data.booking || res.data);
      refreshQuietly();
      toast.success(`Moved to the ${option.brand} ${option.model}.`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong moving this booking.');
    } finally {
      setMoveBusy('');
    }
  };

  const handleCollectDamageCharge = async (booking) => {
    const ok = await confirm(
      `Confirm you have received the ${peso(booking.condition.damageCharge)} damage charge from this client, in cash or by GCash.`,
      { confirmLabel: 'Received', cancelLabel: 'Not yet' }
    );
    if (!ok) return;
    try {
      const res = await api.put(`/bookings/${booking._id}/damage-charge/collected`);
      applyBooking(res.data.booking || res.data);
      toast.success('Damage charge recorded as settled.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong recording this charge.');
    }
  };

  const handleCollectFuelCharge = async (booking) => {
    const ok = await confirm(
      `Confirm you have received the ${peso(booking.fuel.charge)} refuelling charge from this client, in cash or by GCash.`,
      { confirmLabel: 'Received', cancelLabel: 'Not yet' }
    );
    if (!ok) return;
    try {
      const res = await api.put(`/bookings/${booking._id}/fuel-charge/collected`);
      applyBooking(res.data.booking || res.data);
      toast.success('Refuelling charge recorded as settled.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong recording this charge.');
    }
  };

  const handleMarkNoShow = async (booking) => {
    const ok = await confirm(
      `Mark this booking as a no-show? This cancels it and forfeits the ₱${booking.amountPaid.toLocaleString()} already paid — this can't be undone.`,
      { confirmLabel: 'Yes, mark as no-show', cancelLabel: 'Cancel' }
    );
    if (!ok) return;
    try {
      const res = await api.put(`/bookings/${booking._id}/no-show`);
      applyBooking(res.data.booking || res.data);
      refreshQuietly();
      refetchPendingCounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong marking this as a no-show.');
    }
  };

  const handleRefundDecision = async (id, decision) => {
    try {
      const res = await api.put(`/bookings/${id}/refund`, { decision });
      applyBooking(res.data.booking || res.data);
      refreshQuietly();
      refetchPendingCounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating this refund.');
    }
  };

  const handleRescheduleDecision = async (id, decision) => {
    try {
      const res = await api.put(`/bookings/${id}/reschedule`, { decision });
      if (res.data.rescheduleRequest?.adminNotes?.startsWith('Automatically declined')) {
        toast.info(res.data.rescheduleRequest.adminNotes);
      }
      // An approved reschedule moves dates, which frees and claims days on
      // that vehicle's calendar, so the list catches up behind the row.
      applyBooking(res.data.booking || res.data);
      refreshQuietly();
      refetchPendingCounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating this reschedule request.');
    }
  };

  const openRatingModal = (booking) => setRatingModalId(booking._id);
  const closeRatingModal = () => setRatingModalId(null);
  const handleRatingSubmitted = async () => {
    await fetchBookings();
    closeRatingModal();
  };

  const ratingBooking = bookings.find((b) => b._id === ratingModalId);
  const detailsBooking = bookings.find((b) => b._id === detailsBookingId);

  // What stage a booking is at, in the same words the tabs use.
  const stageOf = (b) => {
    if (b.status === 'pending') return 'pending';
    if (b.status === 'completed') return 'completed';
    if (b.status === 'cancelled') return 'cancelled';
    if (isOverdue(b)) return 'overdue';
    if (isOnTrip(b)) return 'on_trip';
    if (isForPickup(b)) return 'for_pickup';
    return 'upcoming';
  };
  const STAGE_LABEL = {
    pending: 'Pending', upcoming: 'Upcoming', for_pickup: 'For pickup',
    on_trip: 'On trip', overdue: 'Overdue', completed: 'Completed', cancelled: 'Cancelled',
  };

  // What the four figures mean: what this booking is worth in the end, what
  // has come in, what is still to come in, and what went back out.
  const moneyStripFor = (b) => {
    const charges = (b.lateFee?.amount || 0) + (b.fuel?.charge || 0) + (b.condition?.damageCharge || 0);
    const settled = (b.lateFee?.collectedAt ? (b.lateFee?.amount || 0) : 0)
      + (b.fuel?.collectedAt ? (b.fuel?.charge || 0) : 0)
      + (b.condition?.damageCollectedAt ? (b.condition?.damageCharge || 0) : 0);
    const refunded = b.refundStatus === 'approved' ? (b.refundAmount || 0) : 0;
    const balance = b.status === 'cancelled' ? 0 : Math.max(0, (b.totalPrice || 0) - (b.amountPaid || 0));
    return [
      { label: 'Worth', amount: (b.totalPrice || 0) + charges, tone: 'plain' },
      { label: 'Paid', amount: (b.amountPaid || 0) + settled, tone: 'plain' },
      { label: 'To collect', amount: balance + (charges - settled), tone: 'gold' },
      { label: 'Refunded', amount: refunded, tone: 'plain' },
    ];
  };

  // What happened to this booking, from the times the system actually
  // recorded. There is no cancelledAt or confirmedAt on a booking, so those
  // steps carry no clock rather than borrowing `updatedAt`, which only says
  // when the row was last touched by anything at all.
  const stepsFor = (b) => {
    const steps = [{
      title: 'Booked',
      at: b.createdAt,
      detail: (b.amountPaid || 0) >= (b.totalPrice || 0)
        ? 'Paid in full'
        : `${Math.round(((b.amountPaid || 0) / (b.totalPrice || 1)) * 100)}% deposit paid`,
    }];

    if (b.collectedAt) {
      steps.push({
        title: 'Picked up',
        at: b.collectedAt,
        detail: b.fuel?.atPickup !== null && b.fuel?.atPickup !== undefined
          ? `Fuel ${fuelLabel(b.fuel.atPickup).toLowerCase()}`
          : 'No fuel level recorded',
        photos: b.condition?.atPickup?.photos || [],
      });
    }

    if (b.returnedAt) {
      steps.push({
        title: 'Returned',
        at: b.returnedAt,
        detail: b.fuel?.atReturn !== null && b.fuel?.atReturn !== undefined
          ? `Fuel ${fuelLabel(b.fuel.atReturn).toLowerCase()}`
          : 'No fuel level recorded',
        photos: b.condition?.atReturn?.photos || [],
        bad: (b.lateFee?.days || 0) > 0 || (b.condition?.damageCharge || 0) > 0,
      });
    } else if (isOverdue(b)) {
      steps.push({
        title: 'Still out',
        detail: `${daysOverdue(b)} day${daysOverdue(b) === 1 ? '' : 's'} past its return time`,
        bad: true,
      });
    }

    if (b.status === 'cancelled') {
      steps.push({
        title: 'Cancelled',
        detail: b.cancelNote || (b.cancelReason ? b.cancelReason.replace(/_/g, ' ') : 'No reason recorded'),
        bad: true,
      });
    }
    return steps;
  };

  const LEDGER_STATE = {
    settled: 'Settled',
    unsettled: 'Not settled',
    due: 'Due at pickup',
    refunded: 'Refunded',
  };

  // One line per thing the client owes or owed, with how it stands.
  const ledgerFor = (b) => {
    const rows = [];
    const paidInFull = (b.amountPaid || 0) >= (b.totalPrice || 0);
    rows.push({
      title: 'Rental',
      sub: paidInFull
        ? `paid in full${b.payment === 'gcash_pending' ? ', GCash pending' : ''}`
        : `${Math.round(((b.amountPaid || 0) / (b.totalPrice || 1)) * 100)}% deposit paid`,
      amount: b.totalPrice || 0,
      state: b.status === 'cancelled' && b.refundStatus === 'approved' ? 'refunded'
        : paidInFull ? 'settled' : 'due',
    });
    if ((b.lateFee?.amount || 0) > 0) {
      rows.push({
        title: 'Late fee',
        sub: `${b.lateFee.days} day${b.lateFee.days === 1 ? '' : 's'} · one day's rental per day late`,
        amount: b.lateFee.amount,
        state: b.lateFee.collectedAt ? 'settled' : 'unsettled',
      });
    }
    if ((b.fuel?.charge || 0) > 0) {
      const out = b.fuel?.atPickup !== null && b.fuel?.atPickup !== undefined ? fuelLabel(b.fuel.atPickup).toLowerCase() : null;
      const back = b.fuel?.atReturn !== null && b.fuel?.atReturn !== undefined ? fuelLabel(b.fuel.atReturn).toLowerCase() : null;
      rows.push({
        title: 'Refuelling',
        sub: out && back ? `went out ${out}, back at ${back}` : 'recorded at the counter',
        amount: b.fuel.charge,
        state: b.fuel.collectedAt ? 'settled' : 'unsettled',
      });
    }
    if ((b.condition?.damageCharge || 0) > 0) {
      rows.push({
        title: 'Damage',
        sub: b.condition?.atReturn?.note || 'recorded on return',
        amount: b.condition.damageCharge,
        state: b.condition.damageCollectedAt ? 'settled' : 'unsettled',
      });
    }
    return rows;
  };

  // One figure per row: what somebody would want to know about this booking
  // at a glance. Money still to come in beats money already settled.
  const moneyFor = (b) => {
    const unsettled = (!b.lateFee?.collectedAt ? (b.lateFee?.amount || 0) : 0)
      + (!b.fuel?.collectedAt ? (b.fuel?.charge || 0) : 0)
      + (!b.condition?.damageCollectedAt ? (b.condition?.damageCharge || 0) : 0);
    const balance = Math.max(0, (b.totalPrice || 0) - (b.amountPaid || 0));
    if (b.status === 'cancelled' && b.refundStatus === 'approved') {
      return { amount: b.refundAmount || 0, label: 'refunded', tone: 'muted' };
    }
    if (unsettled > 0) return { amount: unsettled, label: 'to collect', tone: isOverdue(b) ? 'red' : 'gold' };
    if (balance > 0 && b.status !== 'cancelled') return { amount: balance, label: 'due at pickup', tone: 'gold' };
    return { amount: b.totalPrice || 0, label: 'total', tone: 'plain' };
  };
  const unratedClientCount = bookings.filter((b) => b.status === 'completed' && !b.clientRating?.ratedAt).length;
  const pendingRescheduleCount = bookings.filter((b) => b.rescheduleRequest?.status === 'pending').length;

  // Unpaid bookings never show up here at all (see filteredBookings below),
  // so counts for the status tabs are scoped to paid bookings only —
  // otherwise "All" would include bookings nothing else on this page shows.
  const paidBookings = bookings.filter((b) => b.payment === 'paid');
  const overdueBookings = paidBookings.filter(isOverdue);
  // Worked out here rather than in the markup, so the modal reads as one
  // sentence and this stays above everything that uses it.
  const shortfallNow = returnTarget
    ? fuelShortfallLabel({ fuel: { atPickup: returnTarget.fuel?.atPickup, atReturn: returnForm.fuel } })
    : '';
  const dueBackBookings = paidBookings.filter(isDueBack);
  const dueBackWhen = dueBackLabel(dueBackBookings);
  // In the order a booking lives through them, so the row of tabs is the
  // journey rather than a bag of labels.
  const statusTabs = [
    { value: 'all', label: 'All', count: paidBookings.length },
    { value: 'pending', label: 'Pending', count: paidBookings.filter((b) => b.status === 'pending').length },
    { value: 'upcoming', label: 'Upcoming', count: paidBookings.filter(isUpcoming).length },
    { value: 'for_pickup', label: 'For Pickup', count: paidBookings.filter(isForPickup).length },
    { value: 'on_trip', label: 'On Trip', count: paidBookings.filter((b) => isOnTrip(b) && !isOverdue(b)).length },
    { value: 'overdue', label: 'Overdue', count: overdueBookings.length },
    { value: 'completed', label: 'Completed', count: paidBookings.filter((b) => b.status === 'completed').length },
    { value: 'cancelled', label: 'Cancelled', count: paidBookings.filter((b) => b.status === 'cancelled').length },
  ];

  const filteredBookings = bookings.filter((b) => {
    // Unpaid bookings (checkout never completed) aren't shown at all —
    // there's nothing for admin to do with one until it's actually paid.
    if (b.payment !== 'paid') return false;
    const stage = {
      upcoming: isUpcoming,
      for_pickup: isForPickup,
      // On Trip is the calm one: out, and not yet a problem. Overdue has
      // its own tab because it is the only one of these that needs you to
      // do something today.
      on_trip: (x) => isOnTrip(x) && !isOverdue(x),
      overdue: isOverdue,
    }[statusFilter];
    const matchStatus = statusFilter === 'all' ? true
      : stage ? stage(b)
        : b.status === statusFilter;
    const matchReschedule = !rescheduleOnly || b.rescheduleRequest?.status === 'pending';
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || b.user?.name?.toLowerCase().includes(q)
      || b.user?.email?.toLowerCase().includes(q)
      || `${b.car?.brand} ${b.car?.model}`.toLowerCase().includes(q)
      // The payment reference is what a client quotes when they ring up
      // about a charge, and it is printed on their own booking.
      || b.paymongoPaymentId?.toLowerCase().includes(q);
    return matchStatus && matchReschedule && matchSearch;
  });
  // Two clients racing for the same vehicle are one decision, so they are
  // shown together. The urgency sort has no reason to put them side by side
  // and pagination could otherwise split a pair across two pages.
  const groupedBookings = (() => {
    const out = [];
    const placed = new Set();
    for (const b of filteredBookings) {
      if (placed.has(b._id)) continue;
      out.push(b);
      placed.add(b._id);
      for (const rival of competitorsFor(b)) {
        if (placed.has(rival._id)) continue;
        if (!filteredBookings.some((f) => f._id === rival._id)) continue;
        out.push(rival);
        placed.add(rival._id);
      }
    }
    return out;
  })();
  const totalPages = Math.max(1, Math.ceil(groupedBookings.length / PAGE_SIZE));
  const pageBookings = paginate(groupedBookings, page, PAGE_SIZE);
  // Never an empty panel: if nothing is picked, or what was picked has
  // dropped off this tab, the panel follows the list.
  const selected = pageBookings.find((b) => b._id === selectedId) || pageBookings[0] || null;

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  // The shorthands the list and panel below lean on.
  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const divider = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';

  // The three shapes an action can take, from the handoff: a primary that
  // fills the row, outline secondaries beside it, and destructive ones in
  // red on a red border. Their sizes — 42px tall, radius 10 — and our
  // colours. The old keys below point at these, so every action is restyled
  // without touching a line of when it appears or what it does.
  const ACT_PRIMARY = {
    flex: '1 1 200px', minHeight: '42px', padding: '0 16px', borderRadius: '10px', border: 'none',
    background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    fontSize: '14px', fontWeight: '800', cursor: 'pointer',
  };
  const ACT_SECONDARY = {
    minHeight: '42px', padding: '0 14px', borderRadius: '10px', cursor: 'pointer',
    border: `1px solid ${line}`, background: card, color: text,
    fontSize: '13px', fontWeight: '700',
  };
  const ACT_DANGER = {
    ...ACT_SECONDARY,
    border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
    color: isDark ? '#f87171' : '#b91c1c',
  };

  const s = {
    // One line, not a panel: amber tint, a clock, and a quiet link.
    dueLine: {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px', borderRadius: '12px', marginBottom: '18px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7',
      fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    dueIcon: { display: 'flex', color: isDark ? '#fbbf24' : '#92400e' },
    dueText: { flex: 1, minWidth: 0 },
    dueLink: {
      border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
      font: 'inherit', fontSize: '13px', fontWeight: '800',
      color: isDark ? '#fbbf24' : '#92400e',
      textDecoration: 'underline', textUnderlineOffset: '3px',
    },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '24px' },
    rateClientsBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '9px 16px', background: '#7c3aed', color: '#fff',
      border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    rateClientsBadge: {
      background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: '11px', fontWeight: '700',
      borderRadius: '20px', padding: '1px 8px', minWidth: '18px', textAlign: 'center',
    },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#242526' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`, verticalAlign: 'middle' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    clientName: { fontWeight: '600', fontSize: '13px' },
    clientMeta: { fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280' },
    clientCell: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
    // The same circle Manage Clients uses, so a client looks like the same
    // person on both screens. Most have no photograph, so the initial is
    // the normal case rather than the fallback.
    avatar: (inRace) => ({
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: isDark ? '#3a3b3c' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: '700', color: goldInk(isDark),
      boxShadow: inRace
        ? `0 0 0 2px ${isDark ? '#242526' : '#fff'}, 0 0 0 4px ${isDark ? GOLD_DARK : GOLD}`
        : 'none',
    }),
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    // A tint and a bar down the left edge, so the rows in a race read as
    // one block rather than two bookings that happen to be adjacent. The
    // later request is tinted more faintly, which is the whole hierarchy.
    clashTd: (first) => ({
      background: isDark
        ? (first ? GOLD_TINT_DARK : 'rgba(232,161,0,0.07)')
        : (first ? GOLD_TINT : '#fdf6e3'),
    }),
    clashEdge: { boxShadow: `inset 4px 0 0 ${isDark ? GOLD_DARK : GOLD}` },
    clashBannerTd: {
      padding: '9px 16px', background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      boxShadow: `inset 4px 0 0 ${isDark ? GOLD_DARK : GOLD}`, border: 'none',
    },
    clashBanner: {
      display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap',
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : '#92400e',
    },
    clashDot: {
      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
      background: isDark ? GOLD_DARK : GOLD, animation: 'rr-pulse 2s ease-in-out infinite',
    },
    clashWhy: {
      fontWeight: '600', letterSpacing: 0, textTransform: 'none', fontSize: '12px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    rank: (first) => ({
      display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '5px',
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase',
      color: first ? (isDark ? GOLD_DARK : '#92400e') : (isDark ? '#8a8d91' : '#9ca3af'),
    }),
    carThumb: { width: '44px', height: '32px', background: isDark ? '#3a3b3c' : '#f3f4f6', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
    balanceNote: { fontSize: '11px', color: goldInk(isDark), marginTop: '4px', maxWidth: '160px' },
    promoNote: {
      fontSize: '11px', fontWeight: '700', color: goldInk(isDark),
      marginTop: '4px', maxWidth: '160px',
    },
    rentalLengthNote: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase',
      color: goldInk(isDark), marginTop: '4px',
    },
    confirmed: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', color: isDark ? '#86efac' : '#065f46',
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '3px 11px', borderRadius: '20px', border: isDark ? '1px solid rgba(22,163,74,0.35)' : 'none',
    },
    cancelled: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '3px 11px', borderRadius: '20px', border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    completed: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', color: isDark ? '#93c5fd' : '#1e40af',
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '3px 11px', borderRadius: '20px', border: isDark ? '1px solid rgba(37,99,235,0.35)' : 'none',
    },
    // A small solid dot before the label — matches the color of its own
    // badge, e.g. dotStyle('#16a34a') for the confirmed badge's dot.
    statusDot: (color) => ({ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }),
    // Solid only once the return is actually due. While the trip is still
    // running the expected action is none at all, and a gold button reads
    // as the next thing to do @ on a label that already sounds like a
    // statement of fact rather than something you are about to do.
    returnBtn: () => (ACT_PRIMARY),
    pickedUpBtn: ACT_PRIMARY,
    returnLabel: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', margin: '4px 0 7px',
    },
    fuelRow: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' },
    // `on` is what the admin has picked. `wentOut` is the level the vehicle
    // left with — the thing being compared against, so it is marked rather
    // than filled: a dashed gold outline, which still reads as separate
    // when the two happen to be the same chip.
    fuelChip: (on, wentOut) => ({
      padding: '5px 9px', fontSize: '11px', fontWeight: on || wentOut ? '800' : '500', borderRadius: '7px',
      cursor: 'pointer',
      border: on
        ? `1px solid ${isDark ? GOLD_DARK : GOLD}`
        : wentOut
          ? `1px dashed ${isDark ? GOLD_DARK : GOLD}`
          : `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      background: on ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: on ? ON_GOLD : wentOut ? goldInk(isDark) : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    fuelCaption: {
      fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', margin: '0 0 12px',
      display: 'flex', alignItems: 'center', gap: '6px',
    },
    fuelCaptionMark: {
      display: 'inline-block', width: '14px', height: '10px', borderRadius: '3px',
      border: `1px dashed ${isDark ? GOLD_DARK : GOLD}`, flexShrink: 0,
    },
    wentOutValue: { fontWeight: '800', color: goldInk(isDark) },
    returnOutRow: {
      margin: '4px 0 12px', padding: '10px 12px', borderRadius: '10px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    returnOutLabel: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', lineHeight: 1.5 },
    returnOutThumbs: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' },
    returnOutThumb: {
      width: '72px', height: '54px', objectFit: 'cover', borderRadius: '7px', cursor: 'zoom-in',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    returnShort: {
      fontSize: '12px', lineHeight: 1.5, fontWeight: '700', margin: '0 0 12px',
      padding: '8px 10px', borderRadius: '8px',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#991b1b',
    },
    feeBtn: ACT_SECONDARY,
    feeSettled: { fontSize: '11px', fontWeight: '700', color: isDark ? '#86efac' : '#065f46' },
    activityNote: {
      fontSize: '11px', fontWeight: '700', lineHeight: 1.4, marginTop: '4px',
      color: goldInk(isDark),
    },
    docWarn: {
      fontSize: '11px', fontWeight: '700', lineHeight: 1.4, marginTop: '4px', maxWidth: '190px',
      color: isDark ? '#f87171' : '#b91c1c',
    },
    overdueNote: { fontSize: '11px', fontWeight: '800', color: isDark ? '#f87171' : '#dc2626' },
    pickedUpNote: { fontSize: '11px', fontWeight: '700', color: isDark ? '#86efac' : '#065f46' },
    deskNote: {
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      marginBottom: '14px', padding: '12px 16px', borderRadius: '12px', fontSize: '13px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      color: isDark ? '#e4e6eb' : '#7c4a03',
    },
    deskBtn: {
      padding: '7px 14px', fontSize: '12px', fontWeight: '700', border: 'none', borderRadius: '8px',
      cursor: 'pointer', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    },
    outPanel: (late) => ({
      marginBottom: '18px', padding: '16px 18px', borderRadius: '14px',
      border: `1px solid ${late ? (isDark ? '#f87171' : '#dc2626') : (isDark ? GOLD_DARK : GOLD)}`,
      background: late
        ? (isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2')
        : (isDark ? GOLD_TINT_DARK : GOLD_TINT),
    }),
    outPanelTitle: {
      fontSize: '16px', fontWeight: '800', marginBottom: '10px',
      color: isDark ? '#e4e6eb' : '#111827',
    },
    outPanelList: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px' },
    outPanelItem: { fontSize: '13px', lineHeight: 1.5, color: isDark ? '#e4e6eb' : '#374151' },
    outPanelLate: { fontWeight: '800', color: isDark ? '#f87171' : '#dc2626' },
    outPanelFoot: {
      fontSize: '12px', lineHeight: 1.5, marginTop: '10px',
      color: isDark ? '#b0b3b8' : '#6b7280',
    },
    outPanelBtn: {
      marginTop: '12px', padding: '7px 14px', fontSize: '12px', fontWeight: '700',
      border: 'none', borderRadius: '8px', cursor: 'pointer',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    },
    moveBtn: ACT_SECONDARY,
    moveRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '10px 12px', borderRadius: '10px', marginBottom: '8px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    moveCar: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
    moveThumb: {
      width: '52px', height: '38px', objectFit: 'cover', borderRadius: '7px', flexShrink: 0,
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    moveName: { fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#111827' },
    moveDiff: (up) => ({
      fontSize: '11.5px', fontWeight: '700',
      color: up ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#86efac' : '#065f46'),
    }),
    cancelRowBtn: ACT_DANGER,
    noShowBtn: ACT_DANGER,
    acceptBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    declineBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    editRatingBtn: ACT_SECONDARY,
    detailsBtn: {
      padding: '5px 12px', fontSize: '12px', fontWeight: '500', borderRadius: '6px', cursor: 'pointer',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#374151',
    },
    lowRatingBadge: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      fontSize: '10px', padding: '1px 8px', borderRadius: '20px', marginLeft: '6px', fontWeight: '600',
      border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' },
    searchInput: {
      flex: '1 1 220px', padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', outline: 'none', background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    modalOverlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    },
    extendedNote: {
      fontSize: '10px', fontWeight: '700', lineHeight: 1.4, marginTop: '3px',
      color: isDark ? GOLD_DARK : '#92400e',
    },
    competingNote: {
      fontSize: '10px', fontWeight: '700', lineHeight: 1.45, marginTop: '5px', maxWidth: '200px',
      color: isDark ? GOLD_DARK : '#92400e',
    },
    awaitingBox: {
      display: 'inline-flex', flexDirection: 'column', gap: '3px', maxWidth: '200px',
      padding: '7px 10px', borderRadius: '8px',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.45)' : '#fcd34d'}`,
      background: isDark ? 'rgba(232,161,0,0.12)' : '#fffbeb',
    },
    awaitingTitle: { fontSize: '11px', fontWeight: '800', color: isDark ? GOLD_DARK : '#92400e' },
    awaitingSub: { fontSize: '10px', lineHeight: 1.4, color: isDark ? '#b0b3b8' : '#6b7280' },
    awaitingCancelBtn: ACT_DANGER,
    cancelCard: {
      width: '100%', maxWidth: '430px', background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '16px',
      padding: '24px', maxHeight: '88vh', overflowY: 'auto',
    },
    cancelTitle: { fontSize: '17px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    cancelUnderway: {
      fontSize: '12px', lineHeight: 1.5, fontWeight: '700', margin: '0 0 12px',
      padding: '8px 10px', borderRadius: '8px',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#991b1b',
    },
    cancelSub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '6px 0 16px' },
    cancelOption: {
      display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
      padding: '10px 12px', marginBottom: '8px', borderRadius: '10px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    cancelOptionHint: { display: 'block', fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    cancelInput: {
      width: '100%', padding: '9px 11px', marginTop: '8px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', fontFamily: 'inherit', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    cancelSummary: {
      marginTop: '14px', padding: '11px 13px', borderRadius: '10px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280',
    },
    cancelAmount: { fontSize: '16px', fontWeight: '800', color: goldInk(isDark) },
    cancelOfPaid: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af' },
    cancelConfirmBtn: {
      flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      fontSize: '13px', fontWeight: '700',
      background: isDark ? '#f87171' : '#dc2626', color: '#fff',
    },
    cancelBackBtn: {
      padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
    },
    statusTabRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%', marginBottom: '20px' },
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
    calendarBtn: {
      padding: '9px 16px', background: isDark ? '#242526' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', fontWeight: '600',
      cursor: 'pointer', whiteSpace: 'nowrap',
    },
    rescheduleFilterBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '9px 16px', background: isDark ? '#242526' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    rescheduleFilterBadge: {
      background: isDark ? '#3a3b3c' : '#e5e7eb', color: isDark ? '#e4e6eb' : '#374151',
      fontSize: '11px', fontWeight: '700', borderRadius: '20px', padding: '1px 8px', minWidth: '18px', textAlign: 'center',
    },
  
    // ── List beside detail (design 1c) ────────────────────────────────
    split: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 560px', gap: '18px', alignItems: 'start' },
    listCol: { minWidth: 0 },
    listCard: {
      background: card, border: `1px solid ${line}`, borderRadius: '14px', padding: '6px',
      display: 'flex', flexDirection: 'column', gap: '2px',
    },
    emptyList: { fontSize: '13px', color: text3, padding: '18px', margin: 0, textAlign: 'center' },
    row: (on) => ({
      display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) auto', gap: '12px', alignItems: 'center',
      padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%',
      background: on ? goldTint : 'transparent',
      border: `1px solid ${on ? goldLine : 'transparent'}`,
    }),
    rowThumb: {
      width: '56px', height: '40px', borderRadius: '7px', overflow: 'hidden', background: inset, display: 'block',
    },
    rowThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
    rowMain: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
    rowTop: { display: 'flex', gap: '5px', minWidth: 0, alignItems: 'baseline' },
    rowClient: { fontSize: '13.5px', fontWeight: '800', color: text, whiteSpace: 'nowrap' },
    rowCar: { fontSize: '13px', color: text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rowWhen: { fontSize: '12px', color: text3 },
    rowFlags: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '2px' },
    rowMoney: { textAlign: 'right', whiteSpace: 'nowrap' },
    rowAmount: (tone) => ({
      display: 'block', fontSize: '13px', fontWeight: '800', fontVariantNumeric: 'tabular-nums',
      color: tone === 'gold' ? ink : tone === 'red' ? (isDark ? '#f87171' : '#b91c1c') : tone === 'muted' ? text3 : text,
    }),
    rowMoneyLabel: { display: 'block', fontSize: '10.5px', color: text3 },

    pill: (stage) => {
      const map = {
        pending: { bg: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', fg: isDark ? '#fbbf24' : '#92400e', bd: 'transparent' },
        upcoming: { bg: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', fg: isDark ? '#86efac' : '#065f46', bd: 'transparent' },
        for_pickup: { bg: goldTint, fg: ink, bd: goldLine },
        on_trip: { bg: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', fg: isDark ? '#93c5fd' : '#1e40af', bd: 'transparent' },
        overdue: {
          bg: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
          fg: isDark ? '#f87171' : '#b91c1c',
          bd: isDark ? 'rgba(248,113,113,0.35)' : '#fecaca',
        },
        completed: { bg: isDark ? '#303132' : '#f1f2f4', fg: text, bd: 'transparent' },
        // A booking called off last month is not an alarm.
        cancelled: { bg: 'transparent', fg: text2, bd: line },
      };
      const t = map[stage] || map.completed;
      return {
        display: 'inline-block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.06em',
        textTransform: 'uppercase', padding: '3px 9px', borderRadius: '20px',
        background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      };
    },
    requestChip: {
      display: 'inline-block', fontSize: '10.5px', fontWeight: '700', padding: '3px 8px', borderRadius: '7px',
      background: goldTint, color: ink,
    },
    raceChip: {
      display: 'inline-block', fontSize: '10.5px', fontWeight: '700', padding: '3px 8px', borderRadius: '7px',
      background: isDark ? '#303132' : '#f1f2f4', color: text2,
    },
    lateFlag: {
      display: 'inline-block', fontSize: '10.5px', fontWeight: '800',
      color: isDark ? '#f87171' : '#b91c1c',
    },

    listFoot: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap',
      marginTop: '14px',
    },
    listCount: { fontSize: '12px', color: text3 },
    listCountStrong: { color: text, fontWeight: '700' },

    panel: {
      position: 'sticky', top: '20px', minWidth: 0,
      background: card, border: `1px solid ${line}`, borderRadius: '16px', overflow: 'hidden',
    },
    panelHead: {
      display: 'flex', gap: '14px', padding: '20px 22px', borderBottom: `1px solid ${divider}`, alignItems: 'flex-start',
    },
    panelThumb: {
      width: '84px', height: '58px', borderRadius: '9px', overflow: 'hidden', background: inset, flexShrink: 0, display: 'block',
    },
    panelTitle: { fontSize: '18px', fontWeight: '800', color: text, margin: 0, wordBreak: 'break-word' },
    panelEmail: { fontSize: '12.5px', color: text2, marginTop: '2px' },
    panelScore: {
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', color: text3, marginTop: '3px',
    },
    panelMeta: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', marginTop: '7px' },
    panelRef: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px', color: text3,
    },
    panelBody: { padding: '18px 22px 22px' },
    sectionLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: text3, marginBottom: '7px',
    },
    datesRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' },
    datesMain: { fontSize: '14.5px', fontWeight: '800', color: text },
    datesSub: { fontSize: '12.5px', color: text2, marginTop: '2px' },
    noteBox: {
      marginTop: '14px', padding: '10px 12px', borderRadius: '10px',
      background: isDark ? 'rgba(217,119,6,0.12)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e', fontSize: '12px', lineHeight: 1.5,
      display: 'flex', flexDirection: 'column', gap: '4px',
    },
    actionsWrap: { marginTop: '18px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' },
    moneyStrip: {
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      border: `1px solid ${line}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '14px',
    },
    moneyCell: { padding: '11px 12px', borderLeft: `1px solid ${divider}` },
    moneyCellLabel: { fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', color: text3 },
    // A figure of nothing is not news: it goes quiet rather than shouting a
    // zero in gold.
    moneyCellNum: (tone, amount) => ({
      fontSize: '15px', fontWeight: '800', marginTop: '4px', fontVariantNumeric: 'tabular-nums',
      color: amount === 0 ? text3 : tone === 'gold' ? ink : text,
    }),
    ledger: { display: 'flex', flexDirection: 'column' },
    ledgerRow: {
      display: 'grid', gridTemplateColumns: '1fr auto 104px', gap: '12px', alignItems: 'center',
      padding: '10px 0', borderTop: `1px solid ${divider}`,
    },
    ledgerTitle: { display: 'block', fontSize: '13px', fontWeight: '700', color: text },
    ledgerSub: { display: 'block', fontSize: '11.5px', color: text3, marginTop: '1px' },
    ledgerAmount: { fontSize: '13px', fontWeight: '800', color: text, fontVariantNumeric: 'tabular-nums' },
    ledgerTag: (state) => {
      const map = {
        settled: { bg: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', fg: isDark ? '#86efac' : '#065f46' },
        unsettled: { bg: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2', fg: isDark ? '#f87171' : '#b91c1c' },
        due: { bg: goldTint, fg: ink },
        refunded: { bg: isDark ? '#303132' : '#f1f2f4', fg: text2 },
      };
      const t = map[state];
      return {
        textAlign: 'center', fontSize: '10.5px', fontWeight: '800', padding: '4px 8px', borderRadius: '7px',
        background: t.bg, color: t.fg,
      };
    },
    timeline: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
    step: { display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr)', gap: '12px' },
    stepRail: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
    stepDot: (bad) => ({
      width: '12px', height: '12px', borderRadius: '50%', marginTop: '3px', flexShrink: 0,
      background: bad ? (isDark ? '#ef4444' : '#dc2626') : 'transparent',
      border: `2px solid ${bad ? (isDark ? '#ef4444' : '#dc2626') : (isDark ? GOLD_DARK : GOLD)}`,
    }),
    stepLine: { flex: 1, width: '2px', background: divider, marginTop: '3px' },
    stepHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' },
    stepTitle: (bad) => ({
      fontSize: '13px', fontWeight: '800',
      color: bad ? (isDark ? '#f87171' : '#b91c1c') : text,
    }),
    stepWhen: { fontSize: '11.5px', color: text3, whiteSpace: 'nowrap' },
    stepDetail: { display: 'block', fontSize: '12px', color: text2, marginTop: '2px' },
    stepPhotos: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '7px' },
    stepPhoto: {
      width: '46px', height: '34px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer',
      border: `1px solid ${line}`,
    },
    stepPhotoCount: { fontSize: '11px', fontWeight: '700', color: ink },
    requestCard: {
      marginTop: '16px', padding: '14px 16px', borderRadius: '12px',
      background: goldTint, border: `1px solid ${goldLine}`,
    },
    requestLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase', color: ink,
    },
    requestAsk: { fontSize: '14px', fontWeight: '800', color: text, marginTop: '5px' },
    requestWords: { fontSize: '12.5px', fontStyle: 'italic', color: text2, margin: '6px 0 0', lineHeight: 1.5 },
    requestBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' },
    goldBtn: {
      minHeight: '38px', padding: '0 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, fontSize: '12.5px', fontWeight: '800',
    },
    ghostBtn: {
      minHeight: '38px', padding: '0 16px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${line}`, background: 'transparent', color: text,
      fontSize: '12.5px', fontWeight: '700',
    },
  };

  // Says plainly that this request is in a race, and who got there first —
  // so treating people in the order they asked is the easy default rather
  // than something admin has to work out by reading dates.
  const raceFor = (booking) => {
    // Asked of the booking itself as well as its rivals. competitorsFor only
    // ever returns live requests, but it was never asked whether THIS one
    // was still live — so a cancelled booking kept its banding and the row
    // went on claiming two clients wanted dates it had already lost.
    if (booking.status !== 'pending' || booking.payment !== 'paid') return null;
    if (bookingAwaitingDecision(booking)) return null;
    const rivals = competitorsFor(booking);
    if (!rivals.length) return null;
    const earliest = [booking, ...rivals]
      .reduce((a, b) => (new Date(a.createdAt) <= new Date(b.createdAt) ? a : b));
    return { rivals, count: rivals.length + 1, askedFirst: earliest._id === booking._id };
  };

  // When somebody asked, so the ordering is a stated fact rather than
  // something admin has to take on trust.
  //
  // Not formatMoment: that renders whole hours, which is right for a pickup
  // time and wrong here. Two requests half a minute apart both printed
  // "10:00 PM", so the row claimed one asked first and then showed two
  // identical times — the one thing this label exists to let somebody check.
  const askedAt = (booking) => (booking.createdAt
    ? new Date(booking.createdAt).toLocaleString('en-US', {
      timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    : '');

  // Every action a booking can take, exactly as the table cell drew
  // them: the early-collect window, the no-show window, the adjust-offer
  // deadline and the rest. Lifted out whole rather than rewritten — the
  // rules in here took real thought and none of them are about layout.
  const actionsFor = (booking) => (
    <>
      {booking.refundStatus === 'requested' ? (
        <div>
          <span style={{ fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', fontStyle: 'italic' }}>
            Resolve refund request first
          </span>
        </div>
      ) : bookingAwaitingDecision(booking) ? (
        <div style={s.awaitingBox}>
          <span style={s.awaitingTitle}>Waiting on the client</span>
          <span style={s.awaitingSub}>
            {booking.adjustOffer.reason === 'booking_conflict'
              ? 'Lost these dates to a confirmed booking.'
              : 'These dates were blocked on the vehicle.'}
            {' '}Offered other dates or a full refund — {timeLeftLabel(booking.adjustOffer.deadline).toLowerCase()}.
            It refunds itself if they don&apos;t answer.
          </span>
          <button
            type="button"
            style={s.awaitingCancelBtn}
            onClick={() => handleStatus(booking._id, 'cancelled')}
            title="Settle it now instead of waiting for the deadline."
          >
            Cancel &amp; refund now
          </button>
        </div>
      ) : booking.status === 'confirmed' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* The panel states this above, in the same pill the list uses. */}
          {/* One sequence, in the order it happens at the
              counter: waiting, then handed over, then back. Until
              the keys are recorded as handed over there is
              nothing to return — and after they are, there is no
              longer any question of a no-show. */}
          {booking.collectedAt ? (
            <>
              <span style={isOverdue(booking) ? s.overdueNote : s.pickedUpNote}>
                {isOverdue(booking)
                  ? `${daysOverdue(booking)} day${daysOverdue(booking) === 1 ? '' : 's'} overdue`
                  : `Picked up ${formatMoment(booking.collectedAt, true, { month: 'numeric', day: 'numeric' })}`}
              </span>
              <button
                style={s.returnBtn(new Date() >= new Date(booking.endDate))}
                onClick={() => handleMarkReturned(booking)}
                title="Only needed for an early return — this completes automatically the day after the return date."
              >
                Mark as Returned
              </button>
            </>
          ) : new Date() >= new Date(new Date(booking.startDate).getTime() - EARLY_COLLECT_HOURS * 60 * 60 * 1000) ? (
            <>
              {/* Not a handover button any more. This row could
                  only ever show the documents as a list and take
                  one yes, while the Pickup Desk makes you tick
                  each one — two doors to the same act, held to
                  two different standards. A check that can be
                  skipped by clicking the easier button is not a
                  check. */}
              <button
                style={s.pickedUpBtn}
                onClick={() => navigate('/admin/pickups')}
                title="Check their documents at the Pickup Desk, then hand over the keys there."
              >
                Check in at desk
              </button>
              {/* Three days into a trip it is not a no-show,
                  whatever else it might be. */}
              {new Date() >= new Date(booking.startDate)
                && !booking.extensions?.length
                && new Date() <= new Date(new Date(booking.startDate).getTime() + NO_SHOW_WINDOW_HOURS * 60 * 60 * 1000) && (
                <button
                  style={s.noShowBtn}
                  onClick={() => handleMarkNoShow(booking)}
                  title="Vehicle was never picked up — cancels the booking and forfeits what was paid."
                >
                  No-Show
                </button>
              )}
            </>
          ) : (
            <span style={{ fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', fontStyle: 'italic' }}>
              Pickup {formatMoment(booking.startDate, booking.hasPickupTime, { month: 'numeric', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {/* Accepting a booking used to be one-way: the status
              dropdown with Cancelled on it only ever showed on
              pending rows, so a confirmed booking couldn't be
              cancelled from anywhere. That left "Terms not met"
              unreachable in the one situation it was written for,
              since nobody turns up at pickup for a booking that
              was never accepted. Quieter than No-Show on purpose
              — No-Show forfeits everything and shouldn't be the
              calmer-looking of the two. */}
          {/* Only when the vehicle is actually out of service:
              off the road, or inside an approved block such as
              repairs. Moving somebody off a working vehicle is
              not an everyday action, and a button offering it on
              every confirmed row invited exactly that. */}
          {vehicleOutOfService(booking) && (
            <button
              style={s.moveBtn}
              onClick={() => openMove(booking)}
              title="This vehicle is out of service. Put the booking on a different one, keeping its dates."
            >
              Move vehicle
            </button>
          )}
          <button
            style={s.cancelRowBtn}
            onClick={() => handleStatus(booking._id, 'cancelled')}
            title="Cancel this booking and refund by policy."
          >
            Cancel
          </button>
        </div>
      ) : booking.status === 'cancelled' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={s.cancelled}><span style={s.statusDot(isDark ? '#fca5a5' : '#991b1b')} />Cancelled</span>
          {/* A breakdown the client caused ends the booking and
              leaves a repair bill behind it. */}
          {booking.condition?.damageCharge > 0 && (
            booking.condition.damageCollectedAt ? (
              <span style={s.feeSettled}>{peso(booking.condition.damageCharge)} damage settled</span>
            ) : (
              <button style={s.feeBtn} onClick={() => handleCollectDamageCharge(booking)}>
                Collect {peso(booking.condition.damageCharge)} damage
              </button>
            )
          )}
        </div>
      ) : booking.status === 'completed' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={s.completed}><span style={s.statusDot(isDark ? '#93c5fd' : '#1e40af')} />Completed</span>
          {/* A booking that came back three days late used to be
              indistinguishable from one that came back on time
              the moment it completed. We had the record and
              showed it nowhere, so nobody could see who makes a
              habit of it — least of all the client. */}
          {booking.condition?.damageCharge > 0 && (
            booking.condition.damageCollectedAt ? (
              <span style={s.feeSettled}>{peso(booking.condition.damageCharge)} damage settled</span>
            ) : (
              <button
                style={s.feeBtn}
                onClick={() => handleCollectDamageCharge(booking)}
                title={booking.condition.atReturn?.note || 'Damage recorded at return.'}
              >
                Collect {peso(booking.condition.damageCharge)} damage
              </button>
            )
          )}
          {booking.fuel?.charge > 0 && (
            booking.fuel.collectedAt ? (
              <span style={s.feeSettled}>{peso(booking.fuel.charge)} refuelling settled</span>
            ) : (
              <button
                style={s.feeBtn}
                onClick={() => handleCollectFuelCharge(booking)}
                title={fuelShortfallLabel(booking)
                  ? `Came back ${fuelShortfallLabel(booking)} short of the level it went out with.`
                  : 'Refuelling charge recorded at return.'}
              >
                Collect {peso(booking.fuel.charge)} refuelling
              </button>
            )
          )}
          {booking.lateFee?.days > 0 && (
            <>
              <span style={s.overdueNote}>
                Returned {booking.lateFee.days} day{booking.lateFee.days === 1 ? '' : 's'} late
              </span>
              {booking.lateFee.collectedAt ? (
                <span style={s.feeSettled}>
                  {peso(booking.lateFee.amount)} late fee settled
                </span>
              ) : (
                <button
                  style={s.feeBtn}
                  onClick={() => handleCollectLateFee(booking)}
                  title="One day's rental rate per day of delay, per the booking terms."
                >
                  Collect {peso(booking.lateFee.amount)} late fee
                </button>
              )}
            </>
          )}
          {booking.clientRating?.ratedAt && (
            <>
              <StarRating value={booking.clientRating.rating} size={12} readOnly />
              <button className="text-link-btn" style={s.editRatingBtn} onClick={() => openRatingModal(booking)}>Edit rating</button>
            </>
          )}
        </div>
      ) : (
        <div>
          <StatusDropdown
            isDark={isDark}
            value={booking.status}
            onChange={(status) => handleStatus(booking._id, status)}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'confirmed', label: 'Confirmed', disabled: booking.payment !== 'paid', color: isDark ? '#34d399' : '#16a34a' },
              { value: 'cancelled', label: 'Cancelled', color: isDark ? '#f87171' : '#dc2626' },
            ]}
          />
          {booking.payment !== 'paid' && (
            <div style={{ fontSize: '10px', color: isDark ? '#b0b3b8' : '#6b7280', fontStyle: 'italic', marginTop: '4px' }}>
              Awaiting GCash payment
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <AdminLayout activePage="Manage Bookings">
      {!loading && rescheduleOnly && (
        <BackButton
          text="Back to All Bookings"
          onClick={() => { setRescheduleOnly(false); setPage(1); }}
        />
      )}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Manage Bookings</h1>
          <p style={s.subtitle}>Every booking from confirmation to the keys coming back.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={s.calendarBtn} onClick={() => navigate('/admin/bookings-calendar')}>
          <CalendarGlyph /> Calendar View
          </button>
          {!loading && !rescheduleOnly && pendingRescheduleCount > 0 && (
            <button
              type="button"
              style={s.rescheduleFilterBtn}
              onClick={() => { setRescheduleOnly(true); setPage(1); }}
            >
              <RepeatGlyph /> Pending Reschedules
              <span style={s.rescheduleFilterBadge}>{pendingRescheduleCount}</span>
            </button>
          )}
          {/* The way into the ratings, which used to vanish the moment the
              last client was rated — taking the only link to that page
              with it. It stays now, and says what it is when there is no
              work queued. */}
          {!loading && (
            <button style={s.rateClientsBtn} onClick={() => navigate('/admin/rate-clients')}>
              <StarGlyph /> {unratedClientCount > 0 ? 'Rate Clients' : 'Client Ratings'}
              {unratedClientCount > 0 && (
                <span style={s.rateClientsBadge}>{unratedClientCount}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Vehicles that are not here. Loud on purpose: everything else on
          this page is a record of something that already happened, and this
          is the one row that is still going wrong while you read it. */}
      {!loading && overdueBookings.length > 0 && (
        <div style={s.outPanel(true)}>
          <div style={s.outPanelTitle}>
            {overdueBookings.length} vehicle{overdueBookings.length === 1 ? '' : 's'} not returned
          </div>
          <ul style={s.outPanelList}>
            {overdueBookings.map((b) => (
              <li key={b._id} style={s.outPanelItem}>
                <strong>{b.car?.brand} {b.car?.model}</strong> {DASH_JS} {b.user?.name || 'a client'} {DASH_JS}{' '}
                <span style={s.outPanelLate}>
                  {daysOverdue(b)} day{daysOverdue(b) === 1 ? '' : 's'} overdue
                </span>
                , due {formatMoment(b.endDate, b.hasPickupTime)}
              </li>
            ))}
          </ul>
          <div style={s.outPanelFoot}>
            These dates stay blocked until the vehicle is marked returned, so nobody can book a car that
            is not here. The client is reminded once a day.
          </div>
          <button
            type="button"
            style={s.outPanelBtn}
            onClick={() => { setStatusFilter('overdue'); setPage(1); }}
          >
            Show these bookings
          </button>
        </div>
      )}

      {/* Due back today and still on time is not a problem, so it gets a
          line rather than a panel. Overdue keeps the loud one above: that
          is the only thing on this page still going wrong as you read it. */}
      {!loading && overdueBookings.length === 0 && dueBackBookings.length > 0 && (
        <div style={s.dueLine}>
          <span style={s.dueIcon}><ClockGlyph /></span>
          <span style={s.dueText}>
            <strong>
              {dueBackBookings.length} vehicle{dueBackBookings.length === 1 ? '' : 's'} due back {dueBackWhen}
            </strong>
            {' · '}
            {dueBackBookings[0].car?.brand} {dueBackBookings[0].car?.model}
            {' · '}
            {dueBackBookings[0].user?.name || 'a client'}
            {' · '}
            {/* formatMoment already puts the time on the end — handing it
                time options as well printed the hour twice. */}
            {formatMoment(dueBackBookings[0].endDate, dueBackBookings[0].hasPickupTime)}
            . Still on time.
          </span>
          <button
            type="button"
            className="text-link-btn"
            style={s.dueLink}
            onClick={() => { setStatusFilter('on_trip'); setPage(1); }}
          >
            Show {dueBackBookings.length === 1 ? 'it' : 'them'}
          </button>
        </div>
      )}

      {/* This list is for looking things up. Actually working the counter
          is a different job, and it now has a screen shaped for it. */}
      {statusFilter === 'for_pickup' && (
        <div style={s.deskNote}>
          Checking clients in? The <strong>Pickup Desk</strong> shows each one&apos;s documents beside what
          they should be carrying.
          <button type="button" style={s.deskBtn} onClick={() => navigate('/admin/pickups')}>
            Open Pickup Desk
          </button>
        </div>
      )}

      <div style={s.filterRow}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search by client, email, car or payment reference..."
          aria-label="Search bookings"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div style={s.statusTabRow} role="tablist" aria-label="Filter by status">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              style={s.statusTab(active)}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            >
              {tab.value === 'pending' && tab.count > 0 && <span className="pending-dot" style={s.statusTabDot} />}
              {tab.label}
              <span style={s.statusTabCount(active)}>({tab.count})</span>
            </button>
          );
        })}
      </div>

      <div style={s.split}>
        <div style={s.listCol}>
          <div style={s.listCard} role="listbox" aria-label="Bookings">
            {loading ? (
              <SkeletonListCard isDark={isDark} count={5} />
            ) : pageBookings.length === 0 ? (
              <p style={s.emptyList}>No bookings match.</p>
            ) : pageBookings.map((b) => {
              const stage = stageOf(b);
              const money = moneyFor(b);
              const race = raceFor(b);
              const on = selected?._id === b._id;
              return (
                <button
                  key={b._id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  style={s.row(on)}
                  onClick={() => setSelectedId(b._id)}
                >
                  <span style={s.rowThumb}>
                    {b.car?.image && <img src={b.car.image} alt="" style={s.rowThumbImg} />}
                  </span>

                  <span style={s.rowMain}>
                    <span style={s.rowTop}>
                      <strong style={s.rowClient}>{b.user?.name || 'Unknown'}</strong>
                      <span style={s.rowCar}>· {b.car?.brand} {b.car?.model}</span>
                    </span>
                    <span style={s.rowWhen}>
                      {formatMoment(b.startDate, b.hasPickupTime, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={s.rowFlags}>
                      <span style={s.pill(stage)}>{STAGE_LABEL[stage]}</span>
                      {b.refundStatus === 'requested' && <span style={s.requestChip}>Refund requested</span>}
                      {b.rescheduleRequest?.status === 'pending' && <span style={s.requestChip}>Reschedule requested</span>}
                      {/* Two clients asked for the same dates. Confirming one
                          bumps the other, so it belongs where somebody is
                          choosing between them. */}
                      {race && (
                        <span style={s.raceChip}>
                          {race.askedFirst ? 'Asked first' : 'Asked later'}
                          {askedAt(b) ? ` · ${askedAt(b)}` : ''}
                        </span>
                      )}
                      {isOverdue(b) && (
                        <span style={s.lateFlag}>
                          {daysOverdue(b)} day{daysOverdue(b) === 1 ? '' : 's'} late
                        </span>
                      )}
                      {b.lateFee?.days > 0 && b.status === 'completed' && (
                        <span style={s.lateFlag}>
                          Returned {b.lateFee.days} day{b.lateFee.days === 1 ? '' : 's'} late
                        </span>
                      )}
                    </span>
                  </span>

                  <span style={s.rowMoney}>
                    <span style={s.rowAmount(money.tone)}>₱{money.amount.toLocaleString()}</span>
                    <span style={s.rowMoneyLabel}>{money.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div style={s.listFoot}>
            <span style={s.listCount}>
              Showing <strong style={s.listCountStrong}>{pageBookings.length}</strong> of{' '}
              <strong style={s.listCountStrong}>{filteredBookings.length}</strong> booking{filteredBookings.length === 1 ? '' : 's'}
            </span>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isDark={isDark} />
          </div>
        </div>

        <div className="mb-panel" style={s.panel} role="region" aria-labelledby="mb-panel-title">
          {!selected ? (
            <p style={s.emptyList}>Nothing selected.</p>
          ) : (
            <>
              <div style={s.panelHead}>
                <span style={s.panelThumb}>
                  {selected.car?.image && <img src={selected.car.image} alt="" style={s.rowThumbImg} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h2 id="mb-panel-title" aria-live="polite" style={s.panelTitle}>
                    {selected.user?.name || 'Unknown'} · {selected.car?.brand} {selected.car?.model}
                  </h2>
                  <div style={s.panelEmail}>{selected.user?.email}</div>
                  {/* How this client has behaved on past rentals, where the
                      person deciding on the booking is already looking.
                      Admin only: the client never sees their own score. */}
                  <div style={s.panelScore}>
                    {hasClientScore(selected.user) && (
                      <StarRating value={selected.user.avgRating} size={11} readOnly />
                    )}
                    <span>{clientScoreLabel(selected.user)}</span>
                  </div>
                  <div style={s.panelMeta}>
                    <span style={s.pill(stageOf(selected))}>{STAGE_LABEL[stageOf(selected)]}</span>
                    {selected.paymongoPaymentId && (
                      <span style={s.panelRef}>{selected.paymongoPaymentId}</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={s.panelBody}>
                <div style={s.sectionLabel}>Dates</div>
                <div style={s.datesRow}>
                  <div>
                    <div style={s.datesMain}>
                      {formatMoment(selected.startDate, selected.hasPickupTime, { month: 'short', day: 'numeric' })}
                      {' → '}
                      {formatMoment(selected.endDate, selected.hasPickupTime, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div style={s.datesSub}>
                      {selected.totalDays} day{selected.totalDays === 1 ? '' : 's'}
                      {selected.bookingType === 'with-driver' ? ' · with driver' : ' · self-drive'}
                    </div>
                  </div>
                  {isOverdue(selected) && (
                    <span style={s.lateFlag}>
                      {daysOverdue(selected)} day{daysOverdue(selected) === 1 ? '' : 's'} late
                    </span>
                  )}
                </div>

                {/* Things worth knowing before accepting, which used to be
                    small grey lines in the client column. */}
                {(docWarning(selected) || freshActivity(selected)) && (
                  <div style={s.noteBox}>
                    {docWarning(selected) && <div>{docWarning(selected)}</div>}
                    {freshActivity(selected) && <div>{freshActivity(selected)}</div>}
                  </div>
                )}

                {/* The only things on this page that are somebody else's
                    question waiting on an answer, so they sit above the
                    actions rather than among them. */}
                {selected.refundStatus === 'requested' && (
                  <div style={s.requestCard}>
                    <div style={s.requestLabel}>Refund request</div>
                    <div style={s.requestAsk}>
                      ₱{(selected.refundAmount || 0).toLocaleString()} back to {selected.user?.name || 'the client'}
                    </div>
                    {selected.refundReason && <p style={s.requestWords}>&ldquo;{selected.refundReason}&rdquo;</p>}
                    <div style={s.requestBtns}>
                      <button type="button" style={s.goldBtn} onClick={() => handleRefundDecision(selected._id, 'approved')}>
                        Approve refund
                      </button>
                      <button type="button" style={s.ghostBtn} onClick={() => handleRefundDecision(selected._id, 'declined')}>
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                {selected.rescheduleRequest?.status === 'pending' && (
                  <div style={s.requestCard}>
                    <div style={s.requestLabel}>Reschedule request</div>
                    <div style={s.requestAsk}>
                      {formatMoment(selected.rescheduleRequest.newStartDate, selected.hasPickupTime, { month: 'short', day: 'numeric' })}
                      {' → '}
                      {formatMoment(selected.rescheduleRequest.newEndDate, selected.hasPickupTime, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {selected.rescheduleRequest.reason && (
                      <p style={s.requestWords}>&ldquo;{selected.rescheduleRequest.reason}&rdquo;</p>
                    )}
                    <div style={s.requestBtns}>
                      <button type="button" style={s.goldBtn} onClick={() => handleRescheduleDecision(selected._id, 'approved')}>
                        Approve new dates
                      </button>
                      <button type="button" style={s.ghostBtn} onClick={() => handleRescheduleDecision(selected._id, 'declined')}>
                        Decline
                      </button>
                    </div>
                  </div>
                )}

                <div style={s.actionsWrap}>{actionsFor(selected)}</div>

                {/* Four figures and then the lines behind them. The same
                    booking can owe a balance, a late fee, a refuelling and a
                    repair at once, and those used to be in three different
                    columns. */}
                <div style={{ ...s.sectionLabel, marginTop: '22px' }}>Money</div>
                <div style={s.moneyStrip}>
                  {moneyStripFor(selected).map((f) => (
                    <div key={f.label} style={s.moneyCell}>
                      <div style={s.moneyCellLabel}>{f.label}</div>
                      <div style={s.moneyCellNum(f.tone, f.amount)}>₱{f.amount.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div style={s.ledger}>
                  {ledgerFor(selected).map((row) => (
                    <div key={row.title} style={s.ledgerRow}>
                      <span style={{ minWidth: 0 }}>
                        <span style={s.ledgerTitle}>{row.title}</span>
                        {row.sub && <span style={s.ledgerSub}>{row.sub}</span>}
                      </span>
                      <span style={s.ledgerAmount}>₱{row.amount.toLocaleString()}</span>
                      <span style={s.ledgerTag(row.state)}>{LEDGER_STATE[row.state]}</span>
                    </div>
                  ))}
                </div>

                <div style={{ ...s.sectionLabel, marginTop: '22px' }}>What happened</div>
                <ol style={s.timeline}>
                  {stepsFor(selected).map((step, i, all) => (
                    <li key={step.title} style={s.step}>
                      <span style={s.stepRail}>
                        <span style={s.stepDot(step.bad)} />
                        {i < all.length - 1 && <span style={s.stepLine} />}
                      </span>
                      <span style={{ minWidth: 0, paddingBottom: i < all.length - 1 ? '16px' : 0 }}>
                        <span style={s.stepHead}>
                          <span style={s.stepTitle(step.bad)}>{step.title}</span>
                          {step.at && (
                            <span style={s.stepWhen}>
                              {formatMoment(step.at, true, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </span>
                        <span style={s.stepDetail}>{step.detail}</span>
                        {step.photos?.length > 0 && (
                          <span style={s.stepPhotos}>
                            {step.photos.slice(0, 4).map((url, n) => (
                              <img
                                key={url}
                                src={url}
                                alt={`${step.title} ${n + 1}`}
                                style={s.stepPhoto}
                                onClick={() => window.open(url, '_blank', 'noopener')}
                              />
                            ))}
                            <span style={s.stepPhotoCount}>
                              {step.photos.length} photo{step.photos.length === 1 ? '' : 's'}
                            </span>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>
      </div>

      {ratingModalId && ratingBooking && (
        <ClientRatingModal
          booking={ratingBooking}
          isDark={isDark}
          onClose={closeRatingModal}
          onSubmitted={handleRatingSubmitted}
        />
      )}

      {detailsBookingId && detailsBooking && (
        <BookingDetailsModal
          booking={detailsBooking}
          isDark={isDark}
          onClose={() => setDetailsBookingId(null)}
          onCollectBalance={handleCollectBalance}
          onAssigned={applyBooking}
        />
      )}
      {/* Closing a booking is the only moment anybody looks at the gauge,
          so it asks rather than assumes. Both fields are optional: a return
          nobody read is better recorded as unread than as full. */}
      {moveTarget && (
        <div style={s.modalOverlay} onClick={() => setMoveTarget(null)}>
          <div style={s.cancelCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="move-title">
            <div id="move-title" style={s.cancelTitle}>Move to another vehicle</div>
            <p style={s.cancelSub}>
              The client keeps their dates. Days they have already had stay charged at the rate they booked;
              the rest are priced at the new vehicle&apos;s. Settle any difference with them directly.
            </p>

            {moveOptions === null ? (
              <p style={s.cancelSub}>Looking for vehicles free for the rest of these dates...</p>
            ) : moveOptions.length === 0 ? (
              <p style={s.cancelSub}>
                Nothing is free for the rest of this booking. A refund is the only thing left to offer.
              </p>
            ) : (
              moveOptions.map((o) => (
                <div key={o.id} style={s.moveRow}>
                  <div style={s.moveCar}>
                    {o.image && <img src={o.image} alt="" style={s.moveThumb} />}
                    <div>
                      <div style={s.moveName}>{o.brand} {o.model}</div>
                      <div style={s.moveDiff(o.difference > 0)}>
                        {o.difference === 0
                          ? 'Same price'
                          : o.difference > 0
                            ? `${peso(o.difference)} more`
                            : `${peso(Math.abs(o.difference))} back to them`}
                      </div>
                    </div>
                  </div>
                  <button style={s.feeBtn} disabled={moveBusy === o.id} onClick={() => doMove(o)}>
                    {moveBusy === o.id ? 'Moving...' : 'Move here'}
                  </button>
                </div>
              ))
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button style={s.cancelBackBtn} onClick={() => setMoveTarget(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {returnTarget && (
        <div style={s.modalOverlay} onClick={() => !returnSubmitting && setReturnTarget(null)}>
          <div style={s.cancelCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="return-title">
            <div id="return-title" style={s.cancelTitle}>Record this return</div>
            <p style={s.cancelSub}>
              {returnTarget.fuel?.atPickup !== null && returnTarget.fuel?.atPickup !== undefined ? (
                <>
                  It went out at <span style={s.wentOutValue}>{fuelLabel(returnTarget.fuel.atPickup)}</span>.
                  {' '}Our terms ask for it back at the same level.
                </>
              ) : (
                'No fuel level was recorded when this vehicle went out, so there is nothing to compare against.'
              )}
            </p>

            <div style={s.returnLabel}>Fuel coming back</div>
            <div style={s.fuelRow}>
              {Array.from({ length: FUEL_STEPS + 1 }, (_, i) => i).map((i) => {
                const wentOut = returnTarget.fuel?.atPickup === i;
                return (
                  <button
                    key={i}
                    type="button"
                    style={s.fuelChip(returnForm.fuel === i, wentOut)}
                    aria-label={wentOut ? `${fuelLabel(i)} — the level it went out at` : undefined}
                    onClick={() => setReturnForm({ ...returnForm, fuel: i })}
                  >
                    {fuelLabel(i)}
                  </button>
                );
              })}
            </div>

            {returnTarget.fuel?.atPickup !== null && returnTarget.fuel?.atPickup !== undefined && (
              <p style={s.fuelCaption}>
                <span style={s.fuelCaptionMark} aria-hidden="true" />
                The level it went out at
              </p>
            )}

            {shortfallNow && (
              <p style={s.returnShort}>
                That is {shortfallNow} short of the level it went out with. Section 5 of the terms charges
                the difference — enter what putting it right actually costs.
              </p>
            )}

            <input
              style={s.cancelInput}
              type="text"
              inputMode="decimal"
              placeholder="Refuelling charge (optional)"
              value={returnForm.charge}
              onChange={(e) => setReturnForm({ ...returnForm, charge: e.target.value.replace(/[^0-9.]/g, '') })}
            />

            {/* The other half of the walkaround. What it went out looking
                like is a link away, so the comparison is one click rather
                than a memory. */}
            {returnTarget.condition?.atPickup?.photos?.length > 0 && (
              <div style={s.returnOutRow}>
                <span style={s.returnOutLabel}>
                  It went out with {returnTarget.condition.atPickup.photos.length} photo
                  {returnTarget.condition.atPickup.photos.length === 1 ? '' : 's'}
                  {returnTarget.condition.atPickup.note ? ` — "${returnTarget.condition.atPickup.note}"` : ''}
                </span>
                <div style={s.returnOutThumbs}>
                  {returnTarget.condition.atPickup.photos.map((url, i) => (
                    <img
                      key={url}
                      src={url}
                      alt={`Condition going out ${i + 1}`}
                      style={s.returnOutThumb}
                      onClick={() => window.open(url, '_blank', 'noopener')}
                    />
                  ))}
                </div>
              </div>
            )}

            <ConditionPhotos
              id={`return-cond-${returnTarget._id}`}
              label="Condition coming back"
              photos={returnForm.photos}
              onChange={(next) => setReturnForm({ ...returnForm, photos: next })}
              isDark={isDark}
              disabled={returnSubmitting}
            />

            <input
              style={s.cancelInput}
              type="text"
              placeholder="Anything new since it went out (optional)"
              value={returnForm.note}
              onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
            />
            <input
              style={s.cancelInput}
              type="text"
              inputMode="decimal"
              placeholder="Damage charge (optional)"
              value={returnForm.damage}
              onChange={(e) => setReturnForm({ ...returnForm, damage: e.target.value.replace(/[^0-9.]/g, '') })}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button style={s.cancelConfirmBtn} onClick={submitReturn} disabled={returnSubmitting}>
                {returnSubmitting ? 'Recording...' : 'Mark as returned'}
              </button>
              <button style={s.cancelBackBtn} onClick={() => setReturnTarget(null)} disabled={returnSubmitting}>
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div style={s.modalOverlay} onClick={() => !cancelSubmitting && setCancelTarget(null)}>
          <div style={s.cancelCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-title">
            <div id="cancel-title" style={s.cancelTitle}>Cancel this booking</div>
            <p style={s.cancelSub}>
              Why it&apos;s being cancelled decides what gets refunded, so the client
              is treated the same way every time.
            </p>
            {/* Cancelling a trip that is running is a different act from
                cancelling one that hasn't started, and the row it was
                clicked from doesn't say so once the dialog is open. */}
            {cancelTarget.pendingExtension?.checkoutSessionId && (
              <p style={s.cancelUnderway}>
                This client is part-way through paying to extend this booking. Cancelling now refunds
                whatever they pay, but give them a few minutes if they are still at the payment page.
              </p>
            )}
            {cancelTarget.collectedAt && (
              <p style={s.cancelUnderway}>
                This client picked the vehicle up on{' '}
                {formatMoment(cancelTarget.collectedAt, true, { month: 'numeric', day: 'numeric' })} and still has it.
                Cancelling frees the dates for other bookings, so arrange the return first.
              </p>
            )}

            <label style={s.cancelOption}>
              <input type="radio" name="cancel-reason" checked={cancelForm.reason === 'vehicle_unavailable'}
                onChange={() => setCancelForm({ ...cancelForm, reason: 'vehicle_unavailable' })} />
              <span>
                <strong>Vehicle unavailable</strong>
                <span style={s.cancelOptionHint}>Our fault — always a full refund.</span>
              </span>
            </label>
            <label style={s.cancelOption}>
              <input type="radio" name="cancel-reason" checked={cancelForm.reason === 'client_requested'}
                onChange={() => setCancelForm({ ...cancelForm, reason: 'client_requested' })} />
              <span>
                <strong>Client requested it</strong>
                <span style={s.cancelOptionHint}>Uses the normal refund policy, same as the app&apos;s own refund button.</span>
              </span>
            </label>
            {/* Only once somebody has the vehicle: nothing breaks down
                mid-trip on a trip that has not started. */}
            {cancelTarget.collectedAt && (
              <>
                <label style={s.cancelOption}>
                  <input type="radio" name="cancel-reason" checked={cancelForm.reason === 'breakdown'}
                    onChange={() => setCancelForm({ ...cancelForm, reason: 'breakdown' })} />
                  <span>
                    <strong>Vehicle broke down</strong>
                    <span style={s.cancelOptionHint}>
                      Mechanical failure, weather, another driver — not the client&apos;s doing. Refunds the days
                      they paid for and didn&apos;t get, including the day it broke.
                    </span>
                  </span>
                </label>
                <label style={s.cancelOption}>
                  <input type="radio" name="cancel-reason" checked={cancelForm.reason === 'breakdown_client'}
                    onChange={() => setCancelForm({ ...cancelForm, reason: 'breakdown_client' })} />
                  <span>
                    <strong>Client damaged the vehicle</strong>
                    <span style={s.cancelOptionHint}>
                      Same refund of unused days, but they had the day they ended it on — and the repair is
                      charged separately below.
                    </span>
                  </span>
                </label>
              </>
            )}

            {/* Last resort, and only once it is genuinely late. The client
                is told nothing about it: they get the plain cancellation
                wording, because accusing somebody of keeping a vehicle is
                not something to automate. */}
            {isOverdue(cancelTarget) && (
              <label style={s.cancelOption}>
                <input type="radio" name="cancel-reason" checked={cancelForm.reason === 'not_returned'}
                  onChange={() => setCancelForm({ ...cancelForm, reason: 'not_returned' })} />
                <span>
                  <strong>Vehicle not returned</strong>
                  <span style={s.cancelOptionHint}>
                    Never came back and couldn&apos;t be recovered. Closes the booking with nothing refunded,
                    since they had the whole trip. Recorded for you only — the client is not told this.
                  </span>
                </span>
              </label>
            )}

            {cancelForm.reason === 'breakdown_client' && (
              <input
                style={{ ...s.cancelInput, marginTop: '4px' }}
                type="text"
                inputMode="decimal"
                placeholder="Repair cost (optional, charged to the client)"
                value={cancelForm.damage || ''}
                onChange={(e) => setCancelForm({ ...cancelForm, damage: e.target.value.replace(/[^0-9.]/g, '') })}
              />
            )}

            {/* They produced their documents and drove away, so whatever
                has gone wrong since, it isn't this. */}
            {!cancelTarget.collectedAt && (
            <label style={s.cancelOption}>
              <input type="radio" name="cancel-reason" checked={cancelForm.reason === 'terms_not_met'}
                onChange={() => setCancelForm({ ...cancelForm, reason: 'terms_not_met' })} />
              <span>
                <strong>Terms not met</strong>
                <span style={s.cancelOptionHint}>
                  Missing IDs or proof of billing, no valid licence, not fit to drive. Half back before the
                  pickup date, nothing on the day itself — it&apos;s in the terms they agreed to.
                </span>
              </span>
            </label>
            )}

            <input style={s.cancelInput} type="text" placeholder="Note for the client (optional)"
              value={cancelForm.note} onChange={(e) => setCancelForm({ ...cancelForm, note: e.target.value })} />

            <div style={s.cancelSummary}>
              Refund to client:{' '}
              <strong style={s.cancelAmount}>
                ₱{previewRefund(cancelTarget, cancelForm.reason).toLocaleString()}
              </strong>
              {cancelTarget?.amountPaid > 0 && (
                <span style={s.cancelOfPaid}>
                  {' '}of ₱{cancelTarget.amountPaid.toLocaleString()} paid
                </span>
              )}
              {cancelTarget.payment !== 'paid' && <span style={s.cancelOptionHint}>This booking was never paid, so nothing is refunded.</span>}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button style={s.cancelConfirmBtn} onClick={submitCancel} disabled={cancelSubmitting}>
                {cancelSubmitting ? 'Cancelling...' : 'Cancel booking & refund'}
              </button>
              <button style={s.cancelBackBtn} onClick={() => setCancelTarget(null)} disabled={cancelSubmitting}>
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageBookings;