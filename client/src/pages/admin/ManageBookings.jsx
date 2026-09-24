import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import BackButton from '../../components/BackButton';
import StarRating from '../../components/StarRating';
import ClientRatingModal from '../../components/ClientRatingModal';
import BookingDetailsModal from '../../components/BookingDetailsModal';
import { SkeletonTableRows } from '../../components/Skeleton';
import Pagination from '../../components/Pagination';
import StatusDropdown from '../../components/StatusDropdown';
import { paginate } from '../../utils/paginate';
import { GOLD, GOLD_DARK, ON_GOLD, GOLD_TINT, GOLD_TINT_DARK } from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import api from '../../api';
import { bookingAwaitingDecision, timeLeftLabel } from '../../utils/offerWindow';
import { formatMoment, phYmd } from '../../utils/phTime';
import { FUEL_STEPS, fuelLabel, fuelShortfallLabel } from '../../utils/fuel';
import ConditionPhotos from '../../components/ConditionPhotos';
import { licenceProblem, idProblem } from '../../utils/documents';

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
  const id = idProblem(b.user, { endDate: b.endDate });
  if (id?.kind === 'expired') return `Their ID expired ${on(id.expiry)}.`;
  if (id?.kind === 'expires_during') return `Their ID expires ${on(id.expiry)}, before this trip ends.`;
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
  if (reason === 'terms_not_met') {
    // Half back beforehand, nothing on the day itself — by then the vehicle
    // can no longer be let to anybody else, so the day is gone either way.
    const onTheDay = phYmd(new Date()) >= phYmd(booking.startDate);
    return onTheDay ? 0 : Math.round(booking.amountPaid * (TERMS_NOT_MET_PERCENT / 100));
  }
  return 0;
};

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

  // Cancelling asks why first — the reason is what decides the refund, so it
  // can't be inferred after the fact. Everything else goes straight through.
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelForm, setCancelForm] = useState({ reason: 'vehicle_unavailable', note: '' });
  // Closing a booking is the only chance to read the gauge, so it stopped
  // being a yes/no confirm and became a short form.
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnForm, setReturnForm] = useState({ fuel: undefined, charge: '', photos: [], note: '', damage: '' });
  const [returnSubmitting, setReturnSubmitting] = useState(false);
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
      await fetchBookings();
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
            + `measured from when they booked. Cancelling can't be undone.`
          : `This booking is more than 24 hours old, so under the refund policy this client gets nothing `
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
      await api.put(`/bookings/${booking._id}/late-fee/collected`);
      await fetchBookings();
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
      await api.put(`/bookings/${booking._id}/collect-balance`);
      await fetchBookings();
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

  const handleCollectDamageCharge = async (booking) => {
    const ok = await confirm(
      `Confirm you have received the ${peso(booking.condition.damageCharge)} damage charge from this client, in cash or by GCash.`,
      { confirmLabel: 'Received', cancelLabel: 'Not yet' }
    );
    if (!ok) return;
    try {
      await api.put(`/bookings/${booking._id}/damage-charge/collected`);
      await fetchBookings();
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
      await api.put(`/bookings/${booking._id}/fuel-charge/collected`);
      await fetchBookings();
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
      await api.put(`/bookings/${booking._id}/no-show`);
      await fetchBookings();
      refetchPendingCounts();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong marking this as a no-show.');
    }
  };

  const handleRefundDecision = async (id, decision) => {
    try {
      await api.put(`/bookings/${id}/refund`, { decision });
      await fetchBookings();
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
      await fetchBookings();
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
      || `${b.car?.brand} ${b.car?.model}`.toLowerCase().includes(q);
    return matchStatus && matchReschedule && matchSearch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const pageBookings = paginate(filteredBookings, page, PAGE_SIZE);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const s = {
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
    carThumb: { width: '44px', height: '32px', background: isDark ? '#3a3b3c' : '#f3f4f6', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
    balanceNote: { fontSize: '11px', color: isDark ? GOLD_DARK : GOLD, marginTop: '4px', maxWidth: '160px' },
    promoNote: {
      fontSize: '11px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD,
      marginTop: '4px', maxWidth: '160px',
    },
    rentalLengthNote: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : GOLD, marginTop: '4px',
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
    returnBtn: (due) => ({
      padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500',
      border: due ? 'none' : `1px solid ${isDark ? GOLD_DARK : GOLD}`,
      background: due ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: due ? ON_GOLD : (isDark ? GOLD_DARK : GOLD),
    }),
    pickedUpBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer', fontWeight: '700' },
    returnLabel: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', margin: '4px 0 7px',
    },
    fuelRow: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' },
    fuelChip: (on) => ({
      padding: '5px 9px', fontSize: '11px', fontWeight: on ? '800' : '500', borderRadius: '7px',
      cursor: 'pointer',
      border: `1px solid ${on ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: on ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: on ? ON_GOLD : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
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
    feeBtn: {
      padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer',
      border: `1px solid ${isDark ? GOLD_DARK : GOLD}`, background: 'transparent', color: isDark ? GOLD_DARK : GOLD,
    },
    feeSettled: { fontSize: '11px', fontWeight: '700', color: isDark ? '#86efac' : '#065f46' },
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
    cancelRowBtn: {
      padding: '4px 10px', fontSize: '11px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`, background: 'transparent',
      color: isDark ? '#f87171' : '#dc2626',
    },
    noShowBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    acceptBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    declineBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    editRatingBtn: { background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
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
    awaitingCancelBtn: {
      alignSelf: 'flex-start', marginTop: '2px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`, background: 'transparent',
      color: isDark ? '#f87171' : '#dc2626', fontSize: '10px', fontWeight: '700',
    },
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
    cancelAmount: { fontSize: '16px', fontWeight: '800', color: isDark ? GOLD_DARK : GOLD },
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
  };

  // Says plainly that this request is in a race, and who got there first —
  // so treating people in the order they asked is the easy default rather
  // than something admin has to work out by reading dates.
  const renderCompetingNote = (booking) => {
    const rivals = competitorsFor(booking);
    if (!rivals.length) return null;
    const earliest = [booking, ...rivals]
      .reduce((a, b) => (new Date(a.createdAt) <= new Date(b.createdAt) ? a : b));
    const thisOneAskedFirst = earliest._id === booking._id;
    return (
      <div style={s.competingNote}>
        {rivals.length + 1} clients want these dates ·{' '}
        {thisOneAskedFirst ? 'this one asked first' : `${earliest.user?.name || 'another client'} asked first`}
      </div>
    );
  };

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
          <p style={s.subtitle}>Track all customer bookings and manage booking statuses.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={s.calendarBtn} onClick={() => navigate('/admin/bookings-calendar')}>
            📅 Calendar View
          </button>
          {!loading && !rescheduleOnly && pendingRescheduleCount > 0 && (
            <button
              type="button"
              style={s.rescheduleFilterBtn}
              onClick={() => { setRescheduleOnly(true); setPage(1); }}
            >
              🔄 Pending Reschedules
              <span style={s.rescheduleFilterBadge}>{pendingRescheduleCount}</span>
            </button>
          )}
          {!loading && unratedClientCount > 0 && (
            <button style={s.rateClientsBtn} onClick={() => navigate('/admin/rate-clients')}>
              ⭐ Rate Clients
              <span style={s.rateClientsBadge}>{unratedClientCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* Vehicles that are not here. Loud on purpose: everything else on
          this page is a record of something that already happened, and this
          is the one row that is still going wrong while you read it. */}
      {!loading && (overdueBookings.length > 0 || dueBackBookings.length > 0) && (
        <div style={s.outPanel(overdueBookings.length > 0)}>
          <div style={s.outPanelTitle}>
            {overdueBookings.length > 0
              ? `${overdueBookings.length} vehicle${overdueBookings.length === 1 ? '' : 's'} not returned`
              : `${dueBackBookings.length} vehicle${dueBackBookings.length === 1 ? '' : 's'} due back`}
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
            {dueBackBookings.map((b) => (
              <li key={b._id} style={s.outPanelItem}>
                <strong>{b.car?.brand} {b.car?.model}</strong> {DASH_JS} {b.user?.name || 'a client'} {DASH_JS}{' '}
                due back {formatMoment(b.endDate, b.hasPickupTime)}
              </li>
            ))}
          </ul>
          <div style={s.outPanelFoot}>
            {overdueBookings.length > 0
              ? 'These dates stay blocked until the vehicle is marked returned, so nobody can book a car that is not here. The client is reminded once a day.'
              : 'Still on time. Mark each one returned when it comes back.'}
          </div>
          <button
            type="button"
            style={s.outPanelBtn}
            onClick={() => { setStatusFilter(overdueBookings.length > 0 ? 'overdue' : 'on_trip'); setPage(1); }}
          >
            Show these bookings
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
          placeholder="Search by client, email, or car..."
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

      <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Client</th>
              <th style={s.th}>Car</th>
              <th style={s.th}>Date Range</th>
              <th style={s.th}>Total</th>
              <th style={s.th}>Requests</th>
              <th style={s.th}>Actions</th>
              <th style={s.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonTableRows isDark={isDark} columns={7} /> : filteredBookings.length === 0 ? (
              <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280' }}>No bookings match.</td></tr>
            ) : pageBookings.map((booking) => (
              <tr key={booking._id}>
                <td style={s.td}>
                  <div style={s.clientName}>
                    {booking.user?.name || 'Unknown'}
                    {booking.user?.ratingCount > 0 && booking.user.avgRating < LOW_RATING_THRESHOLD && (
                      <span style={s.lowRatingBadge} title={`Avg rating: ${booking.user.avgRating.toFixed(1)} from ${booking.user.ratingCount} booking(s)`}>
                        ⚠ Low Rating
                      </span>
                    )}
                  </div>
                  <div style={s.clientMeta}>{booking.user?.email}</div>
                  <div style={s.clientMeta}>ID: {booking.user?._id?.slice(-6) || '—'}</div>
                  {/* Asked before you accept, while it can still be fixed.
                      A licence that runs out mid-trip is fine on the day
                      they booked and useless on the day they drive. */}
                  {docWarning(booking) && (
                    <div style={s.docWarn}>{docWarning(booking)}</div>
                  )}
                  {booking.user?.ratingCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <StarRating value={booking.user.avgRating} size={11} readOnly />
                      <span style={s.clientMeta}>{booking.user.avgRating.toFixed(1)} ({booking.user.ratingCount})</span>
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  <div style={s.carCell}>
                    <div style={s.carThumb}>
                      {booking.car?.image && <img src={booking.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div>
                      <span>{booking.car?.brand} {booking.car?.model}</span>
                      {booking.carRating?.ratedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }} title={booking.carRating.comment || ''}>
                          <StarRating value={booking.carRating.overall} size={11} readOnly />
                          <span style={s.clientMeta}>{booking.carRating.overall.toFixed(1)} client review</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={s.td}>
                  {formatMoment(booking.startDate, booking.hasPickupTime, { month: 'numeric', day: 'numeric', year: 'numeric' })} to {formatMoment(booking.endDate, booking.hasPickupTime, { month: 'numeric', day: 'numeric', year: 'numeric' })}
                  {booking.extensions?.length > 0 && (
                    <div style={s.extendedNote}>
                      Extended from {formatMoment(booking.extensions[0].previousEndDate, booking.hasPickupTime, { month: 'numeric', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {booking.totalDays && (
                    <div style={s.rentalLengthNote}>
                      {booking.totalDays} DAY{booking.totalDays === 1 ? '' : 'S'} RENTAL
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  ₱{booking.totalPrice}
                  {booking.discountAmount > 0 && (
                    <div style={s.promoNote}>
                      {booking.promoLabel || 'Promo'} · −₱{booking.discountAmount.toLocaleString()}
                    </div>
                  )}
                  {booking.paymentType === 'downpayment' && booking.amountPaid < booking.totalPrice && (
                    <div style={s.balanceNote}>
                      ₱{booking.amountPaid.toLocaleString()} paid · ₱{(booking.totalPrice - booking.amountPaid).toLocaleString()} due at pickup
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  {booking.refundStatus === 'requested' && (
                    <div style={{ marginBottom: booking.rescheduleRequest?.status === 'pending' ? '10px' : 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '2px' }}>
                        Refund: ₱{booking.refundAmount?.toLocaleString() ?? 0}
                      </div>
                      <div style={{ fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '6px', maxWidth: '160px' }}>
                        {booking.refundReason}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.acceptBtn} onClick={() => handleRefundDecision(booking._id, 'approved')}>Accept</button>
                        <button style={s.declineBtn} onClick={() => handleRefundDecision(booking._id, 'declined')}>Decline</button>
                      </div>
                    </div>
                  )}
                  {booking.rescheduleRequest?.status === 'pending' && !bookingAwaitingDecision(booking) && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '2px' }}>
                        Reschedule request
                      </div>
                      <div style={{ fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '6px', maxWidth: '160px' }}>
                        New: {new Date(booking.rescheduleRequest.newStartDate).toLocaleDateString()} to {new Date(booking.rescheduleRequest.newEndDate).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.acceptBtn} onClick={() => handleRescheduleDecision(booking._id, 'approved')}>Accept</button>
                        <button style={s.declineBtn} onClick={() => handleRescheduleDecision(booking._id, 'declined')}>Decline</button>
                      </div>
                    </div>
                  )}
                  {booking.refundStatus !== 'requested'
                    && (booking.rescheduleRequest?.status !== 'pending' || bookingAwaitingDecision(booking)) && (
                    <span style={{ color: isDark ? '#8a8d91' : '#9ca3af', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={s.td}>
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
                      <span style={s.confirmed}><span style={s.statusDot(isDark ? '#86efac' : '#065f46')} />Confirmed</span>
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
                      <button
                        style={s.cancelRowBtn}
                        onClick={() => handleStatus(booking._id, 'cancelled')}
                        title="Cancel this booking and refund by policy."
                      >
                        Cancel
                      </button>
                    </div>
                  ) : booking.status === 'cancelled' ? (
                    <span style={s.cancelled}><span style={s.statusDot(isDark ? '#fca5a5' : '#991b1b')} />Cancelled</span>
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
                          <button style={s.editRatingBtn} onClick={() => openRatingModal(booking)}>Edit rating</button>
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
                      {renderCompetingNote(booking)}
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  <button type="button" style={s.detailsBtn} onClick={() => setDetailsBookingId(booking._id)}>
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isDark={isDark} />

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
        />
      )}
      {/* Closing a booking is the only moment anybody looks at the gauge,
          so it asks rather than assumes. Both fields are optional: a return
          nobody read is better recorded as unread than as full. */}
      {returnTarget && (
        <div style={s.modalOverlay} onClick={() => !returnSubmitting && setReturnTarget(null)}>
          <div style={s.cancelCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="return-title">
            <div id="return-title" style={s.cancelTitle}>Record this return</div>
            <p style={s.cancelSub}>
              {returnTarget.fuel?.atPickup !== null && returnTarget.fuel?.atPickup !== undefined
                ? `It went out at ${fuelLabel(returnTarget.fuel.atPickup)}. Our terms ask for it back at the same level.`
                : 'No fuel level was recorded when this vehicle went out, so there is nothing to compare against.'}
            </p>

            <div style={s.returnLabel}>Fuel coming back</div>
            <div style={s.fuelRow}>
              {Array.from({ length: FUEL_STEPS + 1 }, (_, i) => i).map((i) => (
                <button
                  key={i}
                  type="button"
                  style={s.fuelChip(returnForm.fuel === i)}
                  onClick={() => setReturnForm({ ...returnForm, fuel: i })}
                >
                  {fuelLabel(i)}
                </button>
              ))}
            </div>

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