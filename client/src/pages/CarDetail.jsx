import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';
import FavoriteButton from '../components/FavoriteButton';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import TripPanel from '../components/TripPanel';
import AvailabilityStrip from '../components/AvailabilityStrip';
import FlowButton from '../components/FlowButton';
import BackButton from '../components/BackButton';
import PromoConfetti from '../components/PromoConfetti';
import PromoBadge from '../components/PromoBadge';
import useLongRentalRules from '../hooks/useLongRentalRules';
import { bestLongRentalRule, rulesForCar } from '../utils/longRental';
import { instantFrom, pickupHours, formatHour, formatPhDate, formatMoment, SHORT_NOTICE_HOURS } from '../utils/phTime';
import DriverAvatar from '../components/DriverAvatar';
import { ratingLabel } from '../utils/drivers';
import RefundNoticeLine from '../components/RefundNoticeLine';
import PlacePicker from '../components/PlacePicker';
import { registrationLapsed } from '../utils/registration';
import { isOverdue } from '../utils/overdue';
import { hoursLate, overdueLabel } from '../utils/lateness';
import useModalA11y from '../hooks/useModalA11y';
import usePageTitle from '../hooks/usePageTitle';
import useFavorites from '../hooks/useFavorites';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD, goldInk} from '../theme';
import { isPromoVisible, promoOffer, promoDateRange, promoCoversRange } from '../utils/promo';
import { quoteBooking } from '../utils/bookingQuote';
import {
  busySpansFrom, freeHoursFor, rangeIsBlocked, nextFreeLabel, blockedFromMessage,
} from '../utils/bookingWindow';
import api from '../api';
import { licenceProblem, licenceMessage } from '../utils/documents';
import ModalClose from '../components/ModalClose';
import { FuelGlyph } from '../components/Glyphs';

// Booking-modal icons — hand-drawn inline SVG, like the rest of the site.
const ModalIcon = ({ children, size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    {children}
  </svg>
);
const BackArrowIcon = () => <ModalIcon><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></ModalIcon>;
const CalendarIcon = () => <ModalIcon><rect x="3" y="4" width="18" height="17" rx="3" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></ModalIcon>;
const ClockIcon = () => <ModalIcon><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></ModalIcon>;
const CardIcon = () => <ModalIcon><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><line x1="2.5" y1="10.5" x2="21.5" y2="10.5" /></ModalIcon>;
const CarIcon = () => <ModalIcon><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></ModalIcon>;
const InfoIcon = () => <ModalIcon size={14}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></ModalIcon>;
const WheelIcon = () => <ModalIcon size={22}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.2" /><path d="M12 3v5.8M3.2 13.2l5.6-1M20.8 13.2l-5.6-1" /></ModalIcon>;
const DriverIcon = () => <ModalIcon size={22}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" /><path d="M16.5 12.5h4M18.5 10.5v4" /></ModalIcon>;
const SparkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M12 2l2.2 6.2L20.5 10l-6.3 1.8L12 18l-2.2-6.2L3.5 10l6.3-1.8z" />
  </svg>
);

// "1 day", not "1 days".
const dayWord = (n) => (n === 1 ? 'day' : 'days');

// Five steps rather than three. The old middle step asked for the booking
// type, the driver, both handover places and the payment option on one
// screen, which is four unrelated decisions and a map under one heading.
// Splitting them means each screen asks one question, and the one that can
// refuse a booking — a place we don't drive to — does it with the map still
// on screen to change.
// Counted from the headings, so adding a step cannot leave the header
// saying "Step 3 of 5" while the progress bar draws six segments.
const BOOKING_STEP_COUNT = 5;

const STEP_HEADINGS = {
  1: { title: 'When do you need it?', sub: 'Tap a pickup date, then a return date, then choose your pickup time.' },
  2: { title: 'Who drives?', sub: 'One of our drivers, or you.' },
  3: { title: 'Where shall we hand it over?', sub: 'Collect it from us, or we bring it to you.' },
  4: { title: 'How would you like to pay?', sub: 'Pay the deposit now, or all of it.' },
  5: { title: 'Check it over', sub: 'Change anything that isn\u2019t right, then pay.' },
};

const CarDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [promoCelebrated, setPromoCelebrated] = useState(0);
  const [searchParams] = useSearchParams();
  const { canFavorite, isFavorite, toggleFavorite } = useFavorites();
  const longRentalRules = useLongRentalRules();
  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState('all');
  // The page leads with what people wrote, and keeps the full rated list —
  // filters and all — behind "See all". The quotes are what somebody
  // reads; the breakdown is what they go looking for afterwards.
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [bookedRanges, setBookedRanges] = useState([]);
  // Pre-filled from the homepage/Cars search box, if the visitor came from there.
  const [startDate, setStartDate] = useState(searchParams.get('pickup') || '');
  const [endDate, setEndDate] = useState(searchParams.get('return') || '');
  // The hour the client asked for. The hour actually used is derived from
  // it below, so a choice that stops being available when the dates move —
  // or when someone else books — corrects itself instead of going stale.
  const [preferredHour, setPreferredHour] = useState(null);
  // Which pickup hours are still in the future depends on the clock, and
  // reading the clock while rendering makes the output depend on exactly
  // when the render happened. Held in state and ticked once a minute so a
  // slot that passes while someone is deciding drops away on its own.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  usePageTitle(car ? `${car.brand} ${car.model}` : 'Vehicle');
  const [paymentType, setPaymentType] = useState('downpayment');
  const [bookingType, setBookingType] = useState('with-driver');
  // Who they asked for, or null for "whoever you send". Null is a real
  // answer here rather than an unfinished form — see utils/drivers.js.
  const [askedFor, setAskedFor] = useState(null);
  // Which question is on screen, not what was chosen. 'any' or 'pick', or
  // null until somebody says — see the derived `mode` below, which is what
  // anything renders from.
  const [driverMode, setDriverMode] = useState(null);
  // { key, list } rather than a bare list, so the page can tell a list that
  // belongs to the dates on screen from one fetched for the dates before
  // them. That is what says "checking" without a second state to keep in
  // step, and it means nothing has to be cleared when the dates move.
  const [driverData, setDriverData] = useState(null);
  const [profile, setProfile] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showRefundNotice, setShowRefundNotice] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  // The furthest step they have reached, which is not the same as the one
  // they are on. The summaries in the step list key off this: jumping back
  // to change the driver should not blank out the payment they already
  // chose, because they did still choose it.
  const [maxStep, setMaxStep] = useState(1);
  // Where the vehicle is handed over and taken back. Null means our own
  // base, which is the ordinary booking and costs nothing.
  const [pickupPlace, setPickupPlace] = useState(null);
  const [returnPlace, setReturnPlace] = useState(null);
  // Most people hand back where they collected, so that is the default and
  // the second map only appears for the people who don't.
  const [returnSame, setReturnSame] = useState(true);
  const [deliverySettings, setDeliverySettings] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  // Phone only: the footer carries the two figures that matter and this
  // opens the rest. On a narrow screen the breakdown would otherwise sit
  // below the fold on every step, where nobody scrolls back to find it.
  const [showMoneySheet, setShowMoneySheet] = useState(false);
  // A booking of their own on THIS vehicle that has not finished. Someone
  // adding days to a trip they already have should extend it rather than
  // start a second one: extending keeps it as one trip, and a long-rental
  // discount is worked out on the whole length.
  const [ownBooking, setOwnBooking] = useState(null);
  const [showExtendHint, setShowExtendHint] = useState(false);
  // A vehicle of ours they still have, past its return time — on any car,
  // not just this one. The server refuses the booking either way; saying so
  // here means they find out before choosing dates and a booking type
  // rather than at the moment they go to pay.
  const [overdueBooking, setOverdueBooking] = useState(null);
  // The step list doubles as the running summary of the booking: each step
  // shows what it is for until it has an answer, and the answer afterwards.
  // Reading back a choice is what makes the step list worth looking at —
  // "Pickup & return: Our office" answers the question somebody is about to
  // scroll back two screens to check. Completed steps are already clickable
  // (see BookingSteps), so the summary is also the way back to it.
  //
  // Held until after the choices are derived, further down this component.
  const bookingStepsFor = (choices) => [
    { label: 'Dates', summary: choices.dates },
    { label: 'Driving', summary: choices.driving },
    { label: 'Pickup & return', summary: choices.place },
    { label: 'Payment', summary: choices.payment },
    { label: 'Check and pay', summary: choices.review },
  ];

  const termsModalRef = useModalA11y(() => setShowTerms(false), showTerms);
  const refundNoticeModalRef = useModalA11y(() => setShowRefundNotice(false), showRefundNotice);
  const bookingModalRef = useModalA11y(() => setShowBookingModal(false), showBookingModal);
  const extendHintModalRef = useModalA11y(() => setShowExtendHint(false), showExtendHint);

  useEffect(() => {
    setActivePhotoIndex(0);
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

  // "Book Again" from My Bookings links here with ?book=true — open the
  // wizard straight away instead of making them find the Book Now button.
  useEffect(() => {
    if (car && user && car.isAvailable !== false && searchParams.get('book') === 'true') {
      setShowBookingModal(true);
    }
  }, [car]);

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
    const fetchBookedDates = async () => {
      try {
        const res = await api.get(`/cars/${id}/booked-dates`);
        setBookedRanges(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBookedDates();
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

    const fetchOwnBooking = async () => {
      try {
        const res = await api.get('/bookings/my');
        const mine = (res.data || []).find((b) => String(b.car?._id || b.car) === String(id)
          && ['pending', 'confirmed'].includes(b.status)
          && !b.returnedAt);
        setOwnBooking(mine || null);
        setOverdueBooking((res.data || []).find(isOverdue) || null);
      } catch (err) {
        // Only used to offer a better route, so failing quietly is right:
        // the client can still book exactly as they could before.
        console.error(err);
      }
    };
    fetchOwnBooking();
  }, [user, id]);

  // Self-drive is only bookable once admin has verified the client's ID —
  // having a license number/expiry and an uploaded ID photo on file isn't
  // enough on its own, since either could be fabricated. All three are
  // managed from Profile, not inline in this wizard.
  // Self-drive used to wait on an admin having approved an ID photo. There
  // is no photo now, so what it actually needs is a licence on file that
  // outlasts the trip — which licenceProblem below already decides.
  const isSelfDriveEligible = !!profile?.licenseExpiry;
  const supportedBookingTypes = car?.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'];
  const selfDriveBlocked = bookingType === 'self-drive' && !isSelfDriveEligible;
  // Asked here rather than at the counter. A licence that runs out mid-trip
  // is fine today and useless on the day it matters, and nobody can renew
  // one while a client stands at the desk waiting for keys.
  const licenceIssue = endDate
    ? licenceProblem(profile, { bookingType, endDate: new Date(endDate) })
    : null;

  // What this trip costs. The ladder itself lives in utils/bookingQuote.js,
  // copied verbatim from the server, so the figure shown here is the figure
  // the server will charge. It used to be written out again in this file —
  // two homes for every money rule, and tests on only one of them.
  const effectiveReturnPlace = returnSame ? pickupPlace : returnPlace;
  const quote = quoteBooking({
    car,
    start: startDate,
    end: endDate,
    pickupPoint: pickupPlace,
    returnPoint: effectiveReturnPlace,
    settings: deliverySettings,
    longRentalRules,
    paymentType,
  });
  const {
    totalDays, subtotal, discountAmount,
    delivery, deliveryFee, totalPrice, depositDue: downPayment, amountToPay,
  } = quote;
  const deliveryBlocked = !delivery.ok;
  const usingLongRental = quote.discountKind === 'longRental';

  // Display only, all three: whether to show the promo badge, which rule
  // won for "7+ days, 10% off", and the shortest rule there is for the
  // "book 7+ days and save" nudge on a trip that doesn't qualify yet.
  const promoApplies = promoCoversRange(car?.promo, startDate, endDate);
  const longRentalRule = car ? bestLongRentalRule(longRentalRules, car._id, totalDays) : null;
  const firstLongRentalRule = car ? rulesForCar(longRentalRules, car._id)[0] : null;

  // The rates and the base pin, so the quote can be shown while choosing
  // rather than only after submitting. The server recomputes the fee from
  // the coordinates regardless — this is for the customer's eyes.
  useEffect(() => {
    api.get('/settings/delivery')
      .then((res) => setDeliverySettings(res.data))
      .catch(() => setDeliverySettings(null));
  }, []);

  // Fire the burst on the transition INTO qualifying, not on every render
  // while it still qualifies — otherwise changing the payment type or
  // re-rendering for any other reason would set it off again.
  useEffect(() => {
    if (discountAmount > 0) setPromoCelebrated(Date.now());
  }, [discountAmount, car?._id]);

  // What the vehicle is really unavailable for, and which hours a whole trip
  // could run from. Both answers come from utils/bookingWindow.js, shared
  // verbatim with the server: the server sends each booking's span with its
  // turnaround already added, so the hours offered here are the hours it
  // will actually accept.
  //
  // These used to be written out here, and the calendar below normalised the
  // very same ranges with its own copy of the same four lines.
  const busySpans = busySpansFrom(bookedRanges);
  const hoursFor = (start, end) => freeHoursFor(busySpans, start, end);
  const overlapsBookedDates = (start, end) => rangeIsBlocked(busySpans, start, end);

  // Why these dates don't work, in words the client can act on. An empty
  // list of pickup times is technically true and no use at all: they can see
  // nothing is offered but not which end to move.
  const blockedReason = (start, end) => blockedFromMessage(busySpans, start, end);

  // The first moment somebody could actually collect this vehicle, for the
  // booking card. Worth saying before any dates are picked: on a vehicle
  // that is out for the next fortnight it saves hunting through the
  // calendar for the first day that isn't red.
  const nextFree = nextFreeLabel(busySpans, new Date());

  // Hours already gone today drop off the list — you can't collect a vehicle
  // at 7:00 AM when it's nine in the morning.
  const availableHours = hoursFor(startDate, endDate)
    .filter((h) => instantFrom(startDate, h).getTime() > now);

  // The hour the booking will actually use: what they asked for while it
  // still works, otherwise the earliest one that does.
  const pickupHour = availableHours.includes(preferredHour)
    ? preferredHour
    : (availableHours.length ? availableHours[0] : null);

  // Booking a pickup that is nearly upon us isn't refused — every booking
  // needs confirming anyway — but saying so beats a surprise later.
  // Appended wherever the range is shown, so the hour follows the dates
  // around the whole flow instead of appearing only at the last step.
  const atTime = pickupHour === null ? '' : ` at ${formatHour(pickupHour)}`;

  // The exact moment this booking would start, which is what the refund
  // bands are measured from. Null until both a day and a workable hour exist.
  const pickupAt = pickupHour !== null && startDate ? instantFrom(startDate, pickupHour) : null;

  // --- who is free to drive -----------------------------------------------
  //
  // The answer is about the dates, so it is asked again whenever they move,
  // and the dates are what the answer is filed under. Self-drive asks
  // nobody: there is no driver to send.
  const driverKey = bookingType === 'with-driver' && startDate && endDate
    ? `${startDate}|${endDate}|${pickupHour ?? 0}`
    : null;

  useEffect(() => {
    if (!user || !driverKey) return undefined;
    const [start, end, hour] = driverKey.split('|');
    let cancelled = false;
    api.get('/drivers/available', {
      params: {
        start: instantFrom(start, Number(hour)).toISOString(),
        end: instantFrom(end, Number(hour)).toISOString(),
      },
    })
      .then(({ data }) => { if (!cancelled) setDriverData({ key: driverKey, list: data || [] }); })
      // A list of names is a convenience, never the thing standing between
      // somebody and a booking: if this fails they simply leave it to us.
      .catch(() => { if (!cancelled) setDriverData({ key: driverKey, list: [] }); });
    return () => { cancelled = true; };
  }, [user, driverKey]);

  // null while the answer belongs to older dates than the ones on screen.
  const drivers = driverData && driverData.key === driverKey ? driverData.list : null;
  // Somebody asked for by name who has since gone off the list is the same
  // as nobody asked for. Derived rather than cleared, so moving the dates
  // back and forth does not silently forget who they wanted.
  const driverId = drivers?.some((d) => d._id === askedFor) ? askedFor : null;
  // Derived rather than stored, so the switch cannot say "Request someone"
  // while nobody is requested: with nobody free there is only one honest
  // answer, and otherwise an existing choice puts it on the right side.
  const driverMode_ = (drivers || []).length === 0 ? 'any' : (driverMode || (driverId ? 'pick' : 'any'));

  const shortNotice = pickupAt && pickupAt.getTime() - now < SHORT_NOTICE_HOURS * 60 * 60 * 1000;

  // Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
  // the wrong day in timezones ahead of UTC, like PH).
  const toDateValue = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSelectDay = (date) => {
    setError('');
    const clicked = toDateValue(date);

    if (!startDate || (startDate && endDate)) {
      setStartDate(clicked);
      setEndDate('');
      return;
    }

    if (new Date(clicked).getTime() === new Date(startDate).getTime()) {
      setStartDate('');
      setEndDate('');
      return;
    }
    if (new Date(clicked) < new Date(startDate)) {
      setStartDate(clicked);
      return;
    }
    if (overlapsBookedDates(startDate, clicked)) {
      setError(blockedReason(startDate, clicked));
      return;
    }
    setEndDate(clicked);
  };

  // What the dates step says at the top, in all three of its states. The
  // box is always there: before anything is picked it is the only thing
  // telling somebody what to do, and a calendar on its own does not say
  // "tap twice".
  //
  // Dates are written "Tue, Oct 27" throughout, which is the house style
  // and what the flow was drawn with. This used to print 10/26/2026.
  const dateHeadline = () => {
    const DAY = { weekday: 'short', month: 'short', day: 'numeric' };
    if (!startDate) {
      return {
        head: 'No dates yet',
        sub: 'Tap a day to start, then tap a second day for the return.',
      };
    }
    const out = formatPhDate(instantFrom(startDate, pickupHour ?? 7), DAY);
    if (!endDate) {
      return { head: `Out ${out}`, sub: 'Now tap the day you\u2019ll bring it back.' };
    }
    const back = formatPhDate(instantFrom(endDate, pickupHour ?? 7), DAY);
    return {
      head: `${out} \u2192 ${back}`,
      sub: `${totalDays} ${dayWord(totalDays)} \u00b7 `
        + (pickupHour === null ? 'pick a collection time' : `collect at ${formatHour(pickupHour)}`),
    };
  };

  // The price breakdown. Rendered in two places now — inside the payment
  // step, and inside the phone footer's drawer — so it is written once
  // rather than twice with wording that drifts apart.
  const renderPriceLines = () => (
    <>
      <div style={s.breakdownRow}>
        <span>{totalDays} {dayWord(totalDays)} × ₱{car.pricePerDay.toLocaleString()}</span>
        <span>₱{subtotal.toLocaleString()}</span>
      </div>
      {discountAmount > 0 && (
        <div style={{ ...s.breakdownRow, color: goldInk(isDark), fontWeight: '700' }}>
          <span>
            {usingLongRental
              ? `Long-rental discount (${longRentalRule.minDays}+ days, ${longRentalRule.percent}% off)`
              : `${car.promo.label} (${promoOffer(car.promo)})`}
          </span>
          <span>−₱{discountAmount.toLocaleString()}</span>
        </div>
      )}
      {delivery.pickup.fee > 0 && (
        <div style={s.breakdownRow}>
          <span>Delivery to you ({delivery.pickup.km} km)</span>
          <span>₱{delivery.pickup.fee.toLocaleString()}</span>
        </div>
      )}
      {delivery.return.fee > 0 && (
        <div style={s.breakdownRow}>
          <span>Collection from you ({delivery.return.km} km)</span>
          <span>₱{delivery.return.fee.toLocaleString()}</span>
        </div>
      )}
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
    </>
  );

  // What each step has been answered with, or '' while it hasn't been.
  // Every line is built from the same values the steps themselves use, so
  // the summary cannot say something the screen behind it doesn't.
  const stepSummaries = () => {
    const dates = startDate && endDate && pickupHour !== null
      ? `${formatPhDate(instantFrom(startDate, pickupHour), { month: 'short', day: 'numeric' })} \u2192 `
        + `${formatPhDate(instantFrom(endDate, pickupHour), { month: 'short', day: 'numeric' })}`
        + ` \u00b7 ${totalDays} ${dayWord(totalDays)} \u00b7 ${formatHour(pickupHour)}`
      : '';

    // Guarded the same way as the handover below: bookingType starts at
    // 'with-driver', so without this the list claimed they had chosen a
    // driver before they had seen the question.
    let driving = '';
    if (maxStep > 2) {
      if (bookingType === 'self-drive') {
        driving = 'Self-drive';
      } else {
        const chosen = driverId ? (drivers || []).find((d) => d._id === driverId) : null;
        driving = chosen ? `With ${chosen.name}` : 'With a driver we assign';
      }
    }

    // Only once they have been past the handover step: before that, "our
    // office" is a default nobody has agreed to yet, and showing it as a
    // choice they made would be putting words in their mouth.
    let place = '';
    if (maxStep > 3) {
      const out = pickupPlace ? (pickupPlace.label || 'A place on the map') : 'Our office';
      const back = returnSame
        ? 'back to the same place'
        : `back to ${returnPlace ? (returnPlace.label || 'a place on the map') : 'somewhere else'}`;
      place = `${out} \u00b7 ${back}`;
    }

    const payment = maxStep > 4
      ? (paymentType === 'downpayment'
        ? `20% now \u00b7 \u20b1${downPayment.toLocaleString()}, rest at pickup`
        : `In full \u00b7 \u20b1${totalPrice.toLocaleString()}`)
      : '';

    const review = agreedToTerms ? 'Terms agreed' : '';

    return { dates, driving, place, payment, review };
  };

  const goToStep = (n) => {
    setError('');
    setStep(n);
  };

  // Forward only. Going back deliberately leaves maxStep where it was.
  const advanceTo = (n) => {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  };

  const goToDatesNext = () => {
    if (!user) return navigate('/login');
    if (!startDate || !endDate) return setError('Please select pickup and return dates');
    if (totalDays <= 0) return setError('Return date must be after pickup date');
    if (car.isAvailable === false) return setError('This vehicle is no longer listed for booking.');
    if (overlapsBookedDates(startDate, endDate)) {
      return setError(blockedReason(startDate, endDate));
    }
    if (pickupHour === null) {
      return setError('Please choose a pickup time.');
    }
    setError('');
    advanceTo(2);
  };

  // Leaving the driving step. The licence is judged here because choosing
  // self-drive is what makes it matter — and because this is the last screen
  // where changing the answer is still cheap.
  const goToPlaceNext = () => {
    if (licenceIssue) {
      return setError(licenceMessage(licenceIssue));
    }
    if (selfDriveBlocked) {
      return setError("Self-drive isn't available on your account yet — see the notice above for what's needed.");
    }
    setError('');
    advanceTo(3);
  };

  // Leaving the handover step. Nothing to validate: a place we don't serve
  // dims the button below, and PlacePicker has already said why on the map.
  const goToPaymentNext = () => {
    setError('');
    advanceTo(4);
  };

  const goToReviewNext = () => {
    setError('');
    advanceTo(5);
  };

  const openRefundNotice = () => {
    if (!agreedToTerms) return setError('Please agree to the Terms and Conditions');
    setError('');
    setShowRefundNotice(true);
  };

  // "Book these dates" on the availability strip. The strip writes into
  // the same two dates the wizard reads, so there is nothing to carry
  // across — opening it lands on step one with these days already picked
  // and a collection time suggested.
  const bookTheseDates = () => {
    setStep(1);
    openBookingModal();
  };

  const openBookingModal = () => {
    if (!user) return navigate('/login');
    setError('');
    // Said once, and never a wall: booking these dates separately may be
    // exactly what they meant.
    // Nothing to gain from opening the wizard: the booking would be refused
    // at the end of it.
    if (overdueBooking) return;
    if (ownBooking && !showExtendHint) {
      setShowExtendHint(true);
      return;
    }
    setShowBookingModal(true);
  };

  const confirmBooking = async () => {
    setBooking(true);
    setError('');
    try {
      const res = await api.post('/bookings', {
        carId: id,
        startDate,
        endDate,
        pickupHour,
        paymentType,
        amountPaid: amountToPay,
        totalPrice,
        bookingType,
        // Null means "whoever you send", which the office fills in later.
        driver: bookingType === 'with-driver' ? driverId : null,
        // Coordinates and the client's own words for the place. The fee is
        // deliberately not sent: the server works it out, and a fee that
        // arrived from a browser is a request to be charged less.
        pickupPlace,
        returnPlace: effectiveReturnPlace,
        paymentMethod: 'gcash',
      });

      const { data } = await api.post('/payments/gcash/checkout-session', { bookingId: res.data._id });
      // assign(), not an href assignment — the same redirect, written the way
      // MyBookings does it, which the compiler can see is a call and not a
      // write to something outside the component.
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      setShowRefundNotice(false);
      setError(err.response?.data?.message || 'Booking failed');
      setBooking(false);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb' },
    container: { maxWidth: '1100px', margin: '0 auto', padding: '24px 32px' },
    layout: { gap: '32px' },
    imgWrap: { width: '100%', height: '300px', borderRadius: '12px', overflow: 'hidden', background: isDark ? '#3a3b3c' : '#f3f4f6', marginBottom: '16px' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#8a8d91' : '#9ca3af' },
    thumbRow: { display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' },
    thumbBtn: (active) => ({
      flexShrink: 0, width: '64px', height: '48px', borderRadius: '8px', overflow: 'hidden', padding: 0, cursor: 'pointer',
      border: `2px solid ${active ? (isDark ? GOLD_DARK : GOLD) : 'transparent'}`,
      opacity: active ? 1 : 0.7,
    }),
    thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    carName: { fontSize: '28px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    carSub: { fontSize: '15px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
    metaGrid: { gap: '12px', marginBottom: '20px' },
    metaItem: { background: isDark ? '#242526' : '#f9fafb', padding: '12px', borderRadius: '8px', textAlign: 'center', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    metaLabel: { display: 'block', fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '4px' },
    metaValue: { fontSize: '14px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    description: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#4b5563', lineHeight: '1.6' },
    reviewsSection: { marginTop: '40px', maxWidth: '760px' },
    reviewsTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    reviewsSubtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '18px' },
    reviewCard: { background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px' },
    reviewHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
    reviewAvatar: { width: '30px', height: '30px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    reviewerName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    reviewDate: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af' },
    reviewComment: { fontSize: '13px', color: isDark ? '#cbd5e1' : '#374151', lineHeight: '1.5', marginTop: '8px' },
    reviewEmpty: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280' },
    // Quiet, because it is context rather than an instruction: the gold is
    // on the date itself and the rest sits back.
    crumbs: {
      display: 'flex', gap: '8px', fontSize: '13px', alignItems: 'center',
      color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '14px',
    },
    crumbLink: { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px' },
    crumbNow: { color: isDark ? '#e4e6eb' : '#1a1a1a' },
    // One row, ending in the way in. Wraps rather than squashing, because
    // the price and the button are the two things that must stay legible.
    vehicleHead: {
      display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end',
      paddingBottom: '20px', marginBottom: '20px',
      borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    carNameMeta: { fontWeight: '500', fontSize: '21px', color: isDark ? '#b0b3b8' : '#6b7280' },
    headFacts: {
      display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center',
      fontSize: '13.5px', color: isDark ? '#b0b3b8' : '#6b7280',
    },
    headRating: { display: 'flex', alignItems: 'center', gap: '6px' },
    headPrice: { textAlign: 'right', minWidth: 0 },
    headBook: {
      minHeight: '50px', padding: '0 28px', borderRadius: '12px', border: 'none',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      font: 'inherit', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
    },
    // The photo takes the room; the fortnight sits beside it.
    vehicleMain: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)',
      gap: '20px', alignItems: 'start',
    },
    notesRow: {
      display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '20px', margin: '24px 0 8px',
    },
    note: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 },
    // Hidden until the breakpoint turns it on, the same way round as the
    // dialog's own phone pieces — an inline display would beat the query.
    pinnedBar: {
      display: 'none', position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
      alignItems: 'center', gap: '12px', padding: '10px 16px',
      background: isDark ? '#242526' : '#fff',
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      boxShadow: '0 -6px 20px rgba(0,0,0,0.12)',
    },
    pinnedPrice: { fontSize: '20px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    noteHead: { fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    noteBody: { margin: 0, fontSize: '13.5px', lineHeight: 1.5, color: isDark ? '#b0b3b8' : '#6b7280', textWrap: 'pretty' },
    nextFreeLine: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '9px 11px', borderRadius: '10px',
      background: isDark ? '#3a3b3c' : '#f3f4f6',
      color: isDark ? '#b0b3b8' : '#4b5563',
      fontSize: '12.5px', lineHeight: 1.4,
    },
    reviewsHead: { display: 'flex', flexWrap: 'wrap', gap: '10px 16px', alignItems: 'center', marginBottom: '16px' },
    reviewsScore: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    reviewsSpread: { fontSize: '13.5px', color: isDark ? '#b0b3b8' : '#6b7280' },
    // auto-fit, not a fixed two: a vehicle with one written review should
    // show one full-width card, not one half-width card beside a hole.
    // It also collapses to a single column on a phone without a rule.
    quoteGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '16px' },
    quote: {
      margin: 0, padding: '22px', borderRadius: '16px',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      display: 'flex', flexDirection: 'column', gap: '14px',
    },
    quoteText: {
      margin: 0, fontSize: '16.5px', lineHeight: 1.5, textWrap: 'pretty',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    quoteBy: {
      display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
      fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: 'auto',
    },
    seeAll: {
      alignSelf: 'flex-start', marginTop: '16px', padding: 0, border: 'none',
      background: 'none', font: 'inherit', fontWeight: '650',
      color: goldInk(isDark), cursor: 'pointer',
    },
    reviewFilterRow: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
    reviewFilterBtn: (active) => ({
      padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
      border: active ? 'none' : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#b0b3b8' : '#6b7280'),
      cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    reviewPhotoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px', marginTop: '10px', maxWidth: '360px' },
    reviewPhoto: { width: '100%', height: '64px', objectFit: 'cover', borderRadius: '8px' },
    bookingCard: { background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '12px', padding: '20px', height: 'fit-content' },
    priceRow: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' },
    price: { fontSize: '28px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    perDay: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280' },
    priceBreakdown: { background: isDark ? '#18191a' : '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '14px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    offRoadBox: {
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
      borderRadius: '8px', padding: '12px', marginBottom: '14px',
    },
    offRoadNote: {
      fontSize: '12.5px', lineHeight: 1.55, fontWeight: '700', margin: 0,
      color: isDark ? '#f87171' : '#991b1b',
    },
    licenseBox: { background: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff', border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`, borderRadius: '8px', padding: '12px', marginBottom: '14px' },
    licenseNote: { fontSize: '12px', color: isDark ? '#93c5fd' : '#1e40af', marginBottom: '10px', marginTop: 0 },
    fieldHint: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '14px' },
    promoBadge: { marginBottom: '10px' },
    longRentalNote: {
      display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px',
      fontSize: '12px', fontWeight: '700', color: goldInk(isDark),
    },
    // Always on screen on the dates step, in all three of its states.
    dateHeadBox: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
      padding: '12px 14px', borderRadius: '10px', marginBottom: '14px',
      background: isDark ? '#1e1f20' : '#f6f7f8',
    },
    dateHeadLine: { fontSize: '16px', fontWeight: '650', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    dateHeadSub: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '1px' },
    // Two columns that become one on their own: the flex-basis decides
    // when, so there is no breakpoint to keep in step with the dialog's.
    dateSplit: { display: 'flex', flexWrap: 'wrap', gap: '20px 28px', alignItems: 'flex-start' },
    dateCalCol: { flex: '1 1 300px', minWidth: 0 },
    dateSideCol: { flex: '1 1 170px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' },
    promoNudge: {
      marginTop: '10px', fontSize: '12px', fontWeight: '600',
      color: goldInk(isDark),
    },
    longRentalNudge: {
      display: 'flex', alignItems: 'center', gap: '8px',
      marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
      fontSize: '12.5px', fontWeight: '600',
      background: isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.09)',
      color: goldInk(isDark),
    },
    timeBlock: { marginTop: '18px' },
    timeRow: { display: 'flex', flexWrap: 'wrap', gap: '7px' },
    timeChip: (active, open) => ({
      padding: '8px 13px', borderRadius: '999px',
      border: `1px solid ${active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#e4e6eb' : '#1a1a1a'),
      fontSize: '12.5px', fontWeight: active ? '800' : '600', fontFamily: 'inherit',
      cursor: open ? 'pointer' : 'not-allowed',
      opacity: open ? 1 : 0.32,
      textDecoration: open ? 'none' : 'line-through',
    }),
    timeNote: { marginTop: '10px', fontSize: '11.5px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#9ca3af' },
    timeWarn: {
      marginTop: '10px', padding: '9px 12px', borderRadius: '9px',
      fontSize: '11.5px', lineHeight: 1.45, fontWeight: '600',
      background: isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.09)',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.38)' : 'rgba(184,121,10,0.32)'}`,
      color: goldInk(isDark),
    },
    breakdownRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '6px' },
    breakdownTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, paddingTop: '8px', marginTop: '8px' },
    termsRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    termsLink: { color: goldInk(isDark), cursor: 'pointer', textDecoration: 'underline' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' },
    noCC: { textAlign: 'center', fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '8px' },
    // ---- booking modal shell: sidebar + content, its own scroll ----
    bookShell: {
      // 1040 x 680, the size the flow was drawn at. Capped by the viewport
      // so it still fits a short laptop screen.
      width: '100%', maxWidth: '1040px', height: '680px', maxHeight: '88vh', outline: 'none',
      // The trip panel sits on the RIGHT, after the step it describes —
      // reading order as well as layout. It was on the left, which put a
      // summary of your answers before the question.
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px',
      // Without this the single grid row is sized to its content and simply
      // overflows the shell's max height, which the shell then clips — so
      // the body had nothing left to scroll inside and anything past the
      // fold was unreachable. minmax(0, 1fr) lets the row shrink to the
      // shell instead, which is what hands the overflow to bookBody.
      gridTemplateRows: 'minmax(0, 1fr)',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '24px', overflow: 'hidden',
      boxShadow: '0 30px 70px rgba(0,0,0,0.28)',
    },
    bookSide: {
      background: isDark ? '#1e1f20' : '#f6f7f8',
      borderLeft: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      padding: '22px 18px', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: '16px',
    },
    // Step N of 5, above the question. The step list says the same thing,
    // but it is on the other side of the dialog and this is the line
    // somebody reads while deciding whether they have time for this.
    bookStepOf: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    bookBars: { display: 'flex', gap: '4px', padding: '0 26px 12px' },
    bookBar: (state) => ({
      height: '4px', flex: 1, borderRadius: '999px',
      background: state === 'todo'
        ? (isDark ? '#3a3b3c' : '#e5e7eb')
        : (isDark ? GOLD_DARK : GOLD),
      opacity: state === 'now' ? 0.5 : 1,
    }),
    bookMain: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
    bookHead: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
      padding: '24px 26px 18px', borderBottom: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    bookHeadTitle: { margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    bookHeadSub: { margin: '3px 0 0', fontSize: '12.5px', color: isDark ? '#8a8d91' : '#9ca3af' },
    // The body scrolls, so the footer's action stays reachable without
    // scrolling the whole dialog.
    bookBody: { padding: '22px 26px', overflowY: 'auto', flex: 1, minHeight: 0 },
    bookFoot: {
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      padding: '16px 26px', borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
      background: isDark ? '#18191a' : '#f9fafb',
    },
    footKey: { display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af' },
    footValue: { display: 'block', fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    footPush: { marginLeft: 'auto', display: 'flex', gap: '10px' },
    // Phone only (see .book-back-top in index.css). A 44px target, which is
    // the smallest thing a thumb finds reliably.
    backTopBtn: {
      width: '44px', height: '44px', flexShrink: 0, marginLeft: '-10px',
      borderRadius: '999px', border: 'none', background: 'transparent',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      // Hidden by default; .book-back-top turns it on below the breakpoint.
      // An inline `display: grid` here would beat the media query and leave
      // the arrow showing on desktop beside the footer's own Back button.
      display: 'none', placeItems: 'center', cursor: 'pointer', padding: 0,
    },
    moneyMini: { display: 'none', flexDirection: 'column', minWidth: 0, flex: 1 },
    moneyMiniLine: { fontSize: '13px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    moneyMiniToggle: {
      alignSelf: 'flex-start', minHeight: '28px', padding: 0, border: 'none',
      background: 'none', color: goldInk(isDark), fontSize: '12.5px', fontWeight: '700',
      cursor: 'pointer', textAlign: 'left',
    },
    moneySheet: {
      display: 'none',
      padding: '14px 26px', borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
      background: isDark ? '#1e1f20' : '#f6f7f8',
    },
    // ---- pieces shared by the steps ----
    selectedPill: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '12px 14px', borderRadius: '14px', marginBottom: '18px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    pillLeft: { display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 },
    pillIcon: {
      width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT, color: isDark ? GOLD_DARK : GOLD,
    },
    pillLabel: { display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af' },
    pillValue: { display: 'block', fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    pillAction: {
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
      fontSize: '12px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase',
      color: goldInk(isDark),
    },
    sectionLabel: {
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.16em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '10px',
    },
    choiceGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
    choiceCard: (active) => ({
      display: 'grid', justifyItems: 'center', gap: '7px', padding: '16px', borderRadius: '16px',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
      border: `1px solid ${active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#2f3031' : '#fff'),
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      boxShadow: active ? `0 0 0 1px ${isDark ? GOLD_DARK : GOLD}` : 'none',
    }),
    choiceTitle: (active) => ({ fontSize: '13.5px', fontWeight: '700', color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#e4e6eb' : '#1a1a1a') }),
    choiceSub: { fontSize: '11.5px', color: isDark ? '#8a8d91' : '#9ca3af' },
    // --- the driver block ------------------------------------------------
    driverSwitch: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '4px',
      borderRadius: '12px', marginBottom: '12px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
      background: isDark ? '#1e1f20' : '#f8f9fa',
    },
    driverSwitchBtn: (on, off) => ({
      height: '38px', borderRadius: '9px', border: 'none', fontFamily: 'inherit',
      fontSize: '13px', fontWeight: '700',
      cursor: off ? 'not-allowed' : 'pointer',
      opacity: off ? 0.5 : 1,
      background: on ? (isDark ? '#242526' : '#fff') : 'transparent',
      color: on ? (isDark ? '#e4e6eb' : '#1a1a1a') : (isDark ? '#8a8d91' : '#6b7280'),
    }),
    driverAnyRow: {
      display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 16px',
      borderRadius: '12px', marginBottom: '14px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
    },
    faceStack: { display: 'flex', flexShrink: 0 },
    // Overlapped, so a row of faces reads as "these people" rather than as
    // a list somebody has to count.
    faceWrap: (i) => ({
      display: 'flex', borderRadius: '50%',
      marginLeft: i === 0 ? 0 : '-9px',
      boxShadow: `0 0 0 2px ${isDark ? '#242526' : '#fff'}`,
    }),
    faceSkeleton: {
      width: '34px', height: '34px', borderRadius: '50%', display: 'block',
      background: isDark ? '#3a3b3c' : '#e5e7eb',
    },
    driverAnyText: { fontSize: '12.5px', lineHeight: 1.55, margin: 0, color: isDark ? '#b0b3b8' : '#4b5563' },
    driverGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: '10px',
    },
    driverCard: (on) => ({
      position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      padding: '18px 10px 14px', borderRadius: '14px', textAlign: 'center', cursor: 'pointer',
      fontFamily: 'inherit',
      border: `1px solid ${on ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e3e5e8')}`,
      background: on ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : 'transparent',
    }),
    driverCheck: {
      position: 'absolute', top: '8px', right: '8px', width: '20px', height: '20px',
      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? GOLD_DARK : GOLD,
    },
    driverCardName: { fontSize: '13px', fontWeight: '700', lineHeight: 1.25, color: isDark ? '#e4e6eb' : '#1a1a1a' },
    driverCardRating: {
      display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px',
      color: isDark ? '#8a8d91' : '#6b7280',
    },
    driverCardScore: { color: isDark ? '#e4e6eb' : '#1a1a1a' },
    // A driver in their first week has not been judged badly, and an empty
    // row of stars says they have.
    newDriverPill: {
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: '99px',
      background: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe',
      color: isDark ? '#93c5fd' : '#1e40af',
    },
    choiceAmount: (active) => ({ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.01em', color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#e4e6eb' : '#1a1a1a') }),
    sameRow: {
      display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px',
      fontSize: '13px', color: isDark ? '#b0b3b8' : '#4b5563', cursor: 'pointer',
    },
    noteRow: {
      display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap',
      fontSize: '11.5px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '12px',
    },
    noteStrong: { color: isDark ? '#b0b3b8' : '#4b5563' },
    licenseLink: {
      display: 'inline-block', marginTop: '8px', padding: '8px 14px', borderRadius: '10px',
      textDecoration: 'none', fontSize: '13px', fontWeight: '700',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    },
    gcashBadge: {
      display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px',
      background: isDark ? '#18191a' : '#f3f4f6',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    // GCash's own blue, as a dot rather than their logo — we don't have the
    // brand asset and it isn't ours to use.
    gcashDot: { width: '7px', height: '7px', borderRadius: '50%', background: '#0075f6', flexShrink: 0 },
    summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
    summaryBox: {
      padding: '14px', borderRadius: '14px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    summaryKey: { display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af' },
    summaryValue: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' },
    summaryThumb: { width: '42px', height: '32px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 },
    summaryMain: { display: 'block', fontSize: '13.5px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    summarySub: { display: 'block', fontSize: '11.5px', color: isDark ? '#8a8d91' : '#9ca3af' },
    payPanel: {
      marginTop: '14px', padding: '16px', borderRadius: '16px', textAlign: 'center',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    payPanelText: { margin: '10px 0 0', fontSize: '12.5px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#4b5563' },
    nextBtn: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      padding: '12px 20px', border: 'none', borderRadius: '14px', cursor: 'pointer',
      fontSize: '13.5px', fontWeight: '800',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      boxShadow: `0 6px 18px ${isDark ? 'rgba(232,161,0,0.30)' : 'rgba(184,121,10,0.28)'}`,
    },
    backStepBtn: {
      padding: '12px 20px', borderRadius: '14px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '800',
      background: isDark ? '#2f3031' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
    },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '80vh', overflow: 'auto' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '16px' },
    modalText: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#4b5563', lineHeight: '1.8' },
    // Tighter than the paragraphs around it: the 1.8 that gives prose room
    // to breathe leaves three short lines floating apart.
    closeBtn: { marginTop: '16px', padding: '10px 24px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
    refundNoticeActions: { display: 'flex', gap: '10px', marginTop: '20px' },
    refundNoticeCancel: { flex: 1, padding: '10px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
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
  if (!car) return <div style={s.page}><p style={{ textAlign: 'center', padding: '40px', color: isDark ? '#b0b3b8' : '#6b7280' }}>Car not found.</p></div>;

  // Cars added before multi-photo support just have the single `image`
  // field — fall back to that as a one-item gallery.
  const galleryPhotos = car.photos?.length ? car.photos : (car.image ? [{ url: car.image }] : []);
  const activePhoto = galleryPhotos[activePhotoIndex] || galleryPhotos[0];

  // Only the ones somebody actually wrote something in. A wall of bare
  // five-star rows says less than two sentences from a real trip.
  const commentedReviews = reviews.filter((r) => r.comment && r.comment.trim());

  const filteredReviews = reviews.filter((r) => {
    if (reviewFilter === 'with-comments') return !!r.comment;
    if (reviewFilter === 'with-photos') return r.photos && r.photos.length > 0;
    if (['5', '4', '3', '2', '1'].includes(reviewFilter)) return Math.round(r.overall) === Number(reviewFilter);
    return true;
  });

  const backdropMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  };
  const modalMotion = {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 10 },
    transition: { duration: 0.18, ease: 'easeOut' },
  };

  return (
    <div style={s.page}>
      {/* Terms Modal — can open on top of the Booking Modal (step 3's Terms
          link), so it needs a higher z-index to actually sit above it. */}
      <AnimatePresence>
      {showTerms && (
        <motion.div style={{ ...s.modal, zIndex: 1001 }} {...backdropMotion}>
          <motion.div style={s.modalContent} {...modalMotion} ref={termsModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
            <h2 id="terms-modal-title" style={s.modalTitle}>Terms and Conditions</h2>
            <div style={s.modalText}>
              <p><strong>1. Booking Policy</strong></p>
              <p>A minimum of 20% downpayment is required to confirm your booking. The remaining balance must be paid upon vehicle pickup.</p>
              <br/>
              <p><strong>2. Cancellation Policy</strong></p>
              <p>What you get back depends on how much notice you give. Cancel 3 or more days before pickup and you get everything back; 1 to 3 days before, half; under 24 hours before, nothing. If you booked the wrong date or the wrong vehicle, cancelling within an hour of booking returns everything, as long as pickup is still more than 2 hours away.</p>
              <br/>
              <p><strong>3. No-Show Policy</strong></p>
              <p>If you do not pick up the vehicle for a confirmed booking, it will be cancelled and whatever amount you already paid (downpayment or full payment) is forfeited as a no-show fee — no refund. Use the reschedule option below if your plans change instead of simply not showing up.</p>
              <br/>
              <p><strong>4. Vehicle Usage</strong></p>
              <p>The rented vehicle must be used only for lawful purposes. The renter is responsible for any traffic violations, fines, or damages incurred during the rental period.</p>
              <br/>
              <p><strong>5. Fuel Policy</strong></p>
              <p>The vehicle must be returned with the same fuel level it had at pickup. If it is returned with less fuel, the difference will be charged to the renter.</p>
              <br/>
              <p><strong>6. Damage Policy</strong></p>
              <p>The renter is liable for any damage to the vehicle during the rental period. Rent-A-Ride Albay reserves the right to charge for repairs.</p>
              <br/>
              <p><strong>7. Payment</strong></p>
              <p>Your downpayment or full payment is collected online via GCash (through PayMongo) at the time of booking. If you chose the 20% downpayment option, the remaining balance must be settled in cash or GCash upon vehicle pickup.</p>
              <br/>
              <p><strong>8. Late Returns</strong></p>
              <p>Late returns will be charged an additional fee equivalent to one day's rental rate per day of delay.</p>
              <br/>
              <p><strong>9. Rescheduling</strong></p>
              <p>Instead of cancelling, you may request to move a pending or confirmed booking to different dates at no extra fee, as long as the new dates keep the same trip length and are approved by an admin. See My Bookings to request a reschedule.</p>
              <br/>
              <p><strong>10. What to Bring at Pickup</strong></p>
              <p>Before we release the vehicle, you must present two valid IDs and a proof of billing address in your name, plus your driver's licence if you booked self-drive. The names on all of them must match the name on the booking. Your reservation deposit is the payment you already made online.</p>
              <br/>
              <p><strong>11. If These Terms Are Not Met</strong></p>
              <p>These terms go both ways. If you cannot meet them — missing or expired documents, an ID that isn't yours, or you are not in a fit state to drive — we may cancel your booking. If we cancel in advance, half of what you paid is refunded. If you are turned away at pickup, there is no refund, because the vehicle can no longer be rented to anyone else that day.</p>
            </div>
            <button style={s.closeBtn} onClick={() => setShowTerms(false)}>
              I Understand — Close
            </button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Refund Notice Modal — opens from step 3 of the Booking Modal, so it
          needs a higher z-index to sit above it instead of behind it. */}
      <AnimatePresence>
      {showExtendHint && (
        <motion.div style={{ ...s.modal, zIndex: 1001 }} {...backdropMotion}>
          <motion.div style={s.modalContent} {...modalMotion} ref={extendHintModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="extend-hint-title">
            <h2 id="extend-hint-title" style={s.modalTitle}>You already have this vehicle booked</h2>
            <div style={s.modalText}>
              <p>
                Your booking for {formatMoment(ownBooking.startDate, ownBooking.hasPickupTime, { month: 'long', day: 'numeric' })}
                {' '}to {formatMoment(ownBooking.endDate, ownBooking.hasPickupTime, { month: 'long', day: 'numeric' })} has not finished yet.
              </p>
              <p style={{ marginTop: '10px' }}>
                To add days to it, use <strong>Keep It Longer</strong> in My Bookings. That keeps everything
                as one trip, and a longer trip may reach a long-rental discount &mdash; which a second
                separate booking would not.
              </p>
            </div>
            <div style={s.refundNoticeActions}>
              <button style={s.refundNoticeCancel} onClick={() => { setShowExtendHint(false); setShowBookingModal(true); }}>
                Book separate dates
              </button>
              <button style={s.refundNoticeConfirm} onClick={() => navigate('/my-bookings')}>
                Keep It Longer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showRefundNotice && (
        <motion.div style={{ ...s.modal, zIndex: 1001 }} {...backdropMotion}>
          <motion.div style={s.modalContent} {...modalMotion} ref={refundNoticeModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="refund-notice-title">
            <h2 id="refund-notice-title" style={s.modalTitle}>Before You Confirm</h2>
            <div style={s.modalText}>
              <RefundNoticeLine pickupAt={pickupAt} amount={amountToPay} />
              <p style={{ marginTop: '10px' }}>
                <FuelGlyph /> <strong>Fuel Policy:</strong> Please return the vehicle with the same fuel level it had at pickup, or the difference will be charged to you.
              </p>
              {/* The one thing on this screen the client can act on, so it
                  earns its place beside the two policies. Leads with what to
                  bring rather than what it costs — the instruction is what
                  stops the penalty ever applying. */}
              <p style={{ marginTop: '10px' }}>
                &#129526; <strong>At Pickup:</strong> Bring two valid IDs and a proof of billing address in your name
                {bookingType === 'self-drive' ? ", plus your driver's licence" : ''}. Without them we can&apos;t release
                the vehicle, and a cancellation on your pickup date is not refunded.
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Booking Modal — hidden while Terms or the Refund Notice is stacked on
          top of it, since they're a different size and would otherwise show
          both panels' edges overlapping instead of one clean dialog. */}
      <AnimatePresence>
      {showBookingModal && !showTerms && !showRefundNotice && (
        <motion.div style={s.modal} {...backdropMotion}>
          <motion.div
            className="booking-modal-shell"
            style={s.bookShell}
            {...modalMotion}
            ref={bookingModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-modal-title"
          >
            <section style={s.bookMain}>
              <div style={s.bookHead}>
                {/* Phone only. On a narrow screen Back belongs where the
                    thumb already is and where every other app puts it,
                    not at the bottom beside the action that goes forward. */}
                {step > 1 && (
                  <button
                    type="button"
                    className="book-back-top icon-toggle-btn"
                    style={s.backTopBtn}
                    aria-label="Back"
                    onClick={() => goToStep(step - 1)}
                    disabled={booking}
                  >
                    <BackArrowIcon />
                  </button>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={s.bookStepOf}>Step {step} of {BOOKING_STEP_COUNT}</div>
                  <h3 id="booking-modal-title" style={s.bookHeadTitle}>{STEP_HEADINGS[step].title}</h3>
                  <p style={s.bookHeadSub}>{STEP_HEADINGS[step].sub}</p>
                </div>
                <ModalClose onClose={() => setShowBookingModal(false)} isDark={isDark} floating={false} />
              </div>

              {/* One segment per step: filled for the ones behind you, half
                  for the one you are on. The only thing on a phone that
                  says how far along this is, since the panel is hidden. */}
              <div className="book-bars" style={s.bookBars} aria-hidden="true">
                {Array.from({ length: BOOKING_STEP_COUNT }, (_, i) => (
                  <span
                    key={i}
                    style={s.bookBar(i + 1 < step ? 'done' : i + 1 === step ? 'now' : 'todo')}
                  />
                ))}
              </div>

              <div style={s.bookBody}>
                {error && <div style={s.error}>{error}</div>}

                {/* First thing in the panel, because it was second thing in
                    step two — behind a date picker the client can never get
                    past on a vehicle with no free dates. The notice existed
                    and was unreachable, which is the same as not existing
                    while looking like it is handled. */}
                {car?.offRoad?.since && (
                  <div style={s.offRoadBox}>
                    <p style={s.offRoadNote}>
                      {car.offRoad.reason === 'unavailable'
                        ? 'This vehicle is no longer available for booking. Please choose another vehicle.'
                        : "This vehicle is off the road for repairs and isn't taking bookings at the moment. "
                          + 'Please choose another vehicle, or check back later.'}
                    </p>
                  </div>
                )}

                {/* Same box on purpose: to whoever is reading, an expired
                    registration and a vehicle off the road are the same
                    fact — this car cannot go out. Why is our business. */}
                {!car?.offRoad?.since && registrationLapsed(car) && (
                  <div style={s.offRoadBox}>
                    <p style={s.offRoadNote}>
                      This vehicle is off the road while its registration is renewed, so it
                      isn&apos;t taking bookings at the moment. Please choose another vehicle,
                      or check back later.
                    </p>
                  </div>
                )}

                <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={s.dateHeadBox}>
                      <div style={{ minWidth: 0 }}>
                        <div style={s.dateHeadLine}>{dateHeadline().head}</div>
                        <div style={s.dateHeadSub}>{dateHeadline().sub}</div>
                      </div>
                      {(startDate || endDate) && (
                        <button
                          type="button"
                          className="text-link-btn"
                          style={s.pillAction}
                          onClick={() => { setStartDate(''); setEndDate(''); }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Calendar beside the times, not above them. Stacked,
                        the times sat below the fold on the very screen that
                        needs them, and the dialog is 740px wide here. They
                        wrap to one column on their own when it isn't. */}
                    <div style={s.dateSplit}>
                      <div style={s.dateCalCol}>
                        <AvailabilityCalendar
                          bookedRanges={bookedRanges}
                          selectedStart={startDate}
                          selectedEnd={endDate}
                          onSelectDay={handleSelectDay}
                          isDark={isDark}
                          promo={isPromoVisible(car.promo) ? car.promo : null}
                        />
                      </div>

                      <div style={s.dateSideCol}>
                      <div style={s.timeBlock}>
                        <div style={s.sectionLabel} id="cd-pickup-time-label">Pickup time</div>
                        {/* Always on screen, so the column has a shape
                            before there are any times to put in it and
                            somebody can see what the second half of this
                            step is going to ask for. */}
                        {!startDate || !endDate ? (
                          <p style={s.timeNote}>
                            {startDate
                              ? 'Pick your return day to see the times that work.'
                              : 'Pick your dates first.'}
                          </p>
                        ) : availableHours.length === 0 ? (
                          <p style={s.timeNote}>
                            There is no pickup time left that fits these dates. Please choose a different range.
                          </p>
                        ) : (
                          <>
                            <div role="group" aria-labelledby="cd-pickup-time-label" style={s.timeRow}>
                              {pickupHours().map((h) => {
                                const open = availableHours.includes(h);
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    aria-pressed={pickupHour === h}
                                    disabled={!open}
                                    style={s.timeChip(pickupHour === h, open)}
                                    title={open ? undefined : 'Not available for these dates — the vehicle is out, or being returned and checked.'}
                                    onClick={() => setPreferredHour(h)}
                                  >
                                    {formatHour(h)}
                                  </button>
                                );
                              })}
                            </div>
                            {pickupHour !== null && (
                              <p style={s.timeNote}>
                                You bring it back at the same time:{' '}
                                <strong style={{ color: isDark ? '#e4e6eb' : '#1a1a1a' }}>
                                  {formatHour(pickupHour)} on {formatPhDate(instantFrom(endDate, pickupHour))}
                                </strong>.
                              </p>
                            )}
                            {shortNotice && (
                              <p style={s.timeWarn}>
                                This pickup is very soon — we may not be able to confirm it in time.
                              </p>
                            )}
                          </>
                        )}
                      </div>

                    {isPromoVisible(car.promo) && startDate && endDate && !promoApplies && !usingLongRental && (
                      <p style={s.promoNudge}>
                        Pick dates within {promoDateRange(car.promo)} to save {promoOffer(car.promo)}.
                        The whole rental has to fall inside the promo.
                      </p>
                    )}

                    {/* The discount note the side panel used to carry. It
                        belongs here instead: this is the only screen where
                        "add two more days" is still something you can do
                        something about. */}
                    {firstLongRentalRule && totalDays > 0 && !usingLongRental && totalDays < firstLongRentalRule.minDays && (
                      <p style={s.longRentalNudge}>
                        <SparkIcon />
                        <span>
                          Add {firstLongRentalRule.minDays - totalDays} more{' '}
                          {dayWord(firstLongRentalRule.minDays - totalDays)} to save{' '}
                          {firstLongRentalRule.percent}%.
                        </span>
                      </p>
                    )}
                    {usingLongRental && (
                      <p style={s.longRentalNudge}>
                        <SparkIcon />
                        <span>
                          {longRentalRule.percent}% off for {longRentalRule.minDays}+ days — you save
                          {' '}₱{discountAmount.toLocaleString()}.
                        </span>
                      </p>
                    )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={s.selectedPill}>
                      <span style={s.pillLeft}>
                        <span style={s.pillIcon}><CalendarIcon /></span>
                        <span style={{ minWidth: 0 }}>
                          <span style={s.pillLabel}>Selected dates</span>
                          <span style={s.pillValue}>
                            {new Date(startDate).toLocaleDateString()} → {new Date(endDate).toLocaleDateString()}{atTime} · {totalDays} {dayWord(totalDays)}
                          </span>
                        </span>
                      </span>
                      <button type="button" className="text-link-btn" style={s.pillAction} onClick={() => goToStep(1)}>Edit</button>
                    </div>

                    <div style={s.sectionLabel} id="cd-booking-type-label">Booking type</div>
                    {supportedBookingTypes.length > 1 ? (
                      <div role="group" aria-labelledby="cd-booking-type-label" style={s.choiceGrid}>
                        {supportedBookingTypes.includes('with-driver') && (
                          <button
                            type="button"
                            aria-pressed={bookingType === 'with-driver'}
                            style={s.choiceCard(bookingType === 'with-driver')}
                            onClick={() => setBookingType('with-driver')}
                          >
                            <WheelIcon />
                            <span style={s.choiceTitle(bookingType === 'with-driver')}>With Driver</span>
                            <span style={s.choiceSub}>We provide the driver</span>
                          </button>
                        )}
                        {supportedBookingTypes.includes('self-drive') && (
                          <button
                            type="button"
                            aria-pressed={bookingType === 'self-drive'}
                            style={s.choiceCard(bookingType === 'self-drive')}
                            onClick={() => setBookingType('self-drive')}
                          >
                            <DriverIcon />
                            <span style={s.choiceTitle(bookingType === 'self-drive')}>Self Drive</span>
                            <span style={s.choiceSub}>You drive it yourself</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <p style={s.fieldHint}>
                        This vehicle is available for {supportedBookingTypes[0] === 'self-drive' ? 'Self Drive' : 'With Driver'} only.
                      </p>
                    )}

                    {/* Who drives.
                        One question at a time. Most people do not mind who
                        comes, and making them read a row of strangers'
                        names before they can book is a decision the form
                        does not need. So the first question is whether they
                        care; only somebody who says yes is shown the names.
                        Either way the office knows what was asked for.
                        A driver costs nothing extra: the company pays
                        them, so nothing here touches the breakdown. */}
                    {bookingType === 'with-driver' && (
                      <>
                        {/* The booking-type cards have no bottom margin of
                            their own, so this label sat flush against them
                            and read as part of the card below. */}
                        <div style={{ ...s.sectionLabel, marginTop: '18px' }} id="cd-driver-label">Driver</div>

                        {/* Shown while checking too, so the block does not
                            change height when the answer lands. */}
                        <div role="group" aria-labelledby="cd-driver-label" style={s.driverSwitch}>
                          <button
                            type="button"
                            aria-pressed={driverMode_ === 'any'}
                            style={s.driverSwitchBtn(driverMode_ === 'any')}
                            onClick={() => { setDriverMode('any'); setAskedFor(null); }}
                          >
                            Any available driver
                          </button>
                          <button
                            type="button"
                            aria-pressed={driverMode_ === 'pick'}
                            disabled={drivers !== null && drivers.length === 0}
                            style={s.driverSwitchBtn(driverMode_ === 'pick', drivers !== null && drivers.length === 0)}
                            onClick={() => {
                              setDriverMode('pick');
                              // Never leave "Request someone" chosen with
                              // nobody requested.
                              if (!driverId && drivers?.length) setAskedFor(drivers[0]._id);
                            }}
                          >
                            {drivers !== null && drivers.length === 0 ? 'Request someone \u00b7 none free' : 'Request someone'}
                          </button>
                        </div>

                        {driverMode_ === 'any' ? (
                          <div style={s.driverAnyRow}>
                            <div style={s.faceStack}>
                              {drivers === null ? (
                                <span style={s.faceSkeleton} />
                              ) : (
                                drivers.slice(0, 5).map((d, i) => (
                                  <span key={d._id} style={s.faceWrap(i)}>
                                    <DriverAvatar driver={d} isDark={isDark} size={34} />
                                  </span>
                                ))
                              )}
                            </div>
                            <p style={s.driverAnyText}>
                              {drivers === null
                                ? 'Checking who is free on your dates\u2026'
                                : drivers.length === 0
                                  ? 'Nobody is free to be requested for these dates, so we will assign a driver for you before pickup.'
                                  : `${drivers.length} driver${drivers.length === 1 ? ' is' : 's are'} free on your dates. We\u2019ll pick one and tell you who is coming before pickup.`}
                            </p>
                          </div>
                        ) : (
                          <>
                            <div role="radiogroup" aria-labelledby="cd-driver-label" style={s.driverGrid}>
                              {(drivers || []).map((d) => (
                                <button
                                  key={d._id}
                                  type="button"
                                  role="radio"
                                  aria-checked={driverId === d._id}
                                  style={s.driverCard(driverId === d._id)}
                                  onClick={() => setAskedFor(d._id)}
                                >
                                  {driverId === d._id && (
                                    <span style={s.driverCheck}>
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ON_GOLD} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                    </span>
                                  )}
                                  <DriverAvatar driver={d} isDark={isDark} size={54} />
                                  <span style={s.driverCardName}>{d.name}</span>
                                  {d.ratingCount > 0 ? (
                                    <span style={s.driverCardRating}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill={isDark ? GOLD_DARK : GOLD} aria-hidden="true">
                                        <polygon points="12 2 15.1 8.6 22 9.5 17 14.4 18.3 21.5 12 18.1 5.7 21.5 7 14.4 2 9.5 8.9 8.6" />
                                      </svg>
                                      <strong style={s.driverCardScore}>{(d.avgRating || 0).toFixed(1)}</strong>
                                      {` \u00b7 ${d.ratingCount} trip${d.ratingCount === 1 ? '' : 's'}`}
                                    </span>
                                  ) : (
                                    <span style={s.newDriverPill}>New driver</span>
                                  )}
                                </button>
                              ))}
                            </div>
                            {/* Only a confirmed booking holds a driver \u2014 see
                                utils/drivers.js \u2014 so a request is a request
                                until then, and saying otherwise would be a
                                promise the rota does not keep. */}
                            <p style={s.fieldHint}>
                              Your request is held once we confirm the booking. If they&apos;re taken by then,
                              we&apos;ll send someone else and tell you before pickup.
                            </p>
                          </>
                        )}
                      </>
                    )}

                    {/* This used to promise that a valid ID and licence were
                        "verified by our team beforehand". Nothing verifies
                        anything: the gate is isSelfDriveEligible, which asks
                        only whether a licence expiry is on file, and the ID
                        fields were deliberately removed from the system. The
                        real check is two IDs at the counter, so that is what
                        it now says. */}
                    {supportedBookingTypes.includes('self-drive') && (
                      <p style={s.noteRow}>
                        <InfoIcon />
                        <span>
                          For self-drive we need your <strong style={s.noteStrong}>licence expiry date</strong> in your{' '}
                          <Link to="/profile" style={{ color: goldInk(isDark), fontWeight: '700' }}>Profile</Link>,
                          so we can check it covers your trip. Bring the licence itself, plus two valid IDs,
                          when you collect.
                        </span>
                      </p>
                    )}

                    {licenceIssue && (
                      <div style={s.licenseBox}>
                        <p style={s.licenseNote}>{licenceMessage(licenceIssue)}</p>
                        <Link to="/profile" style={s.licenseLink}>Go to Profile</Link>
                      </div>
                    )}

                    {/* Moved up from below the maps. It is an answer about
                        the licence, so it belongs beside the choice that
                        needs one rather than three sections later. */}
                    {selfDriveBlocked && (
                      <div style={s.licenseBox}>
                        <p style={s.licenseNote}>
                          Self-drive needs your driver&apos;s licence expiry on file. Add it in your Profile,
                          and bring the licence itself to the pickup — we check it there.
                        </p>
                        <Link to="/profile" style={s.licenseLink}>Go to Profile</Link>
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    {deliverySettings?.enabled ? (
                      <>
                        <div style={s.sectionLabel} id="cd-pickup-place-label">Pickup</div>
                        <PlacePicker
                          label="Where to collect the vehicle"
                          describedBy="cd-pickup-quote"
                          value={pickupPlace}
                          onChange={setPickupPlace}
                          settings={deliverySettings}
                          isDark={isDark}
                        />

                        <div style={s.sectionLabel}>Return</div>
                        <label style={s.sameRow}>
                          <input
                            type="checkbox"
                            checked={returnSame}
                            onChange={(e) => setReturnSame(e.target.checked)}
                          />
                          <span>Bring it back to the same place</span>
                        </label>
                        {!returnSame && (
                          <PlacePicker
                            label="Where to hand the vehicle back"
                            describedBy="cd-return-quote"
                            value={returnPlace}
                            onChange={setReturnPlace}
                            settings={deliverySettings}
                            isDark={isDark}
                          />
                        )}
                      </>
                    ) : (
                      <p style={s.fieldHint}>
                        {deliverySettings
                          ? `We\u2019re handing over at ${deliverySettings.base?.label || 'our office'} at the moment, so there\u2019s nothing to choose here.`
                          : 'Checking where we can hand over\u2026'}
                      </p>
                    )}
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={s.sectionLabel} id="cd-payment-option-label">Payment option</div>
                    <div role="group" aria-labelledby="cd-payment-option-label" style={s.choiceGrid}>
                      <button
                        type="button"
                        aria-pressed={paymentType === 'downpayment'}
                        style={s.choiceCard(paymentType === 'downpayment')}
                        onClick={() => setPaymentType('downpayment')}
                      >
                        <span style={s.choiceSub}>20% Downpayment</span>
                        <span style={s.choiceAmount(paymentType === 'downpayment')}>₱{downPayment.toLocaleString()}</span>
                        <span style={s.choiceSub}>Balance on pickup</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={paymentType === 'full'}
                        style={s.choiceCard(paymentType === 'full')}
                        onClick={() => setPaymentType('full')}
                      >
                        <span style={s.choiceSub}>Full payment</span>
                        <span style={s.choiceAmount(paymentType === 'full')}>₱{totalPrice.toLocaleString()}</span>
                        <span style={s.choiceSub}>Nothing due at pickup</span>
                      </button>
                    </div>

                    <div style={{ ...s.priceBreakdown, position: 'relative' }}>
                      <PromoConfetti fireKey={promoCelebrated} isDark={isDark} />
                      {renderPriceLines()}
                    </div>

                    <p style={s.noteRow}>
                      <span style={s.gcashBadge}><span style={s.gcashDot} /> GCash via PayMongo</span>
                      <span>You&apos;ll be redirected to complete the payment after confirming.</span>
                    </p>
                  </motion.div>
                )}

                {step === 5 && (
                  <motion.div key="step5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    {deliveryFee > 0 && (
                      <div style={s.selectedPill}>
                        <span style={s.pillLeft}>
                          <span style={{ minWidth: 0 }}>
                            <span style={s.pillLabel}>Handover</span>
                            <span style={s.pillValue}>
                              {pickupPlace?.label || 'Pinned on the map'}
                              {!returnSame && ` → ${effectiveReturnPlace?.label || 'pinned on the map'}`}
                              {' · '}₱{deliveryFee.toLocaleString()}
                            </span>
                          </span>
                        </span>
                        <button type="button" className="text-link-btn" style={s.pillAction} onClick={() => goToStep(2)}>Edit</button>
                      </div>
                    )}
                    <div className="booking-summary-grid" style={s.summaryGrid}>
                      <div style={s.summaryBox}>
                        <span style={s.summaryKey}>Vehicle</span>
                        <span style={s.summaryValue}>
                          {car.image
                            ? <img src={car.image} alt="" style={s.summaryThumb} />
                            : <span style={s.pillIcon}><CarIcon /></span>}
                          <span style={{ minWidth: 0 }}>
                            <span style={s.summaryMain}>{car.brand} {car.model}</span>
                            <span style={s.summarySub}>{car.year} · {car.category}</span>
                          </span>
                        </span>
                      </div>
                      <div style={s.summaryBox}>
                        <span style={s.summaryKey}>Duration</span>
                        <span style={s.summaryValue}>
                          <span style={s.pillIcon}><ClockIcon /></span>
                          <span style={{ minWidth: 0 }}>
                            <span style={s.summaryMain}>{totalDays} {dayWord(totalDays)}</span>
                            <span style={s.summarySub}>
                              {new Date(startDate).toLocaleDateString()} → {new Date(endDate).toLocaleDateString()}
                              {pickupHour !== null && `, ${formatHour(pickupHour)} both ends`}
                            </span>
                          </span>
                        </span>
                      </div>
                      <div style={s.summaryBox}>
                        <span style={s.summaryKey}>Booking type</span>
                        <span style={s.summaryValue}>
                          <span style={s.pillIcon}>{bookingType === 'self-drive' ? <DriverIcon /> : <WheelIcon />}</span>
                          <span style={{ minWidth: 0 }}>
                            <span style={s.summaryMain}>{bookingType === 'self-drive' ? 'Self Drive' : 'With Driver'}</span>
                            <span style={s.summarySub}>
                              {bookingType === 'self-drive'
                                ? 'You drive it yourself'
                                : (() => {
                                  const chosen = (drivers || []).find((d) => d._id === driverId);
                                  return chosen
                                    ? `${chosen.name} · ${ratingLabel(chosen)}`
                                    : 'We will tell you who is driving before pickup';
                                })()}
                            </span>
                          </span>
                        </span>
                      </div>
                      <div style={s.summaryBox}>
                        <span style={s.summaryKey}>Payment</span>
                        <span style={s.summaryValue}>
                          <span style={s.pillIcon}><CardIcon /></span>
                          <span style={{ minWidth: 0 }}>
                            <span style={s.summaryMain}>{paymentType === 'downpayment' ? '20% Downpayment' : 'Full payment'}</span>
                            <span style={s.summarySub}>
                              {paymentType === 'downpayment'
                                ? `₱${amountToPay.toLocaleString()} now · ₱${(totalPrice - downPayment).toLocaleString()} on pickup`
                                : 'Nothing due at pickup'}
                            </span>
                          </span>
                        </span>
                      </div>
                    </div>

                    <div style={s.payPanel}>
                      <span style={s.gcashBadge}><span style={s.gcashDot} /> GCash via PayMongo</span>
                      <p style={s.payPanelText}>
                        You&apos;ll be redirected to PayMongo to pay{' '}
                        <strong style={{ color: goldInk(isDark) }}>₱{amountToPay.toLocaleString()}</strong> with GCash.
                        Payment is handled by PayMongo — your GCash details never reach us.
                      </p>
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
                          <button type="button" className="text-link-btn" style={{ ...s.termsLink, background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => setShowTerms(true)}>
                            Terms and Conditions
                          </button>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

              {/* Phone only: the drawer the footer's toggle opens. */}
              {showMoneySheet && totalDays > 0 && (
                <div className="book-money-sheet" style={s.moneySheet}>{renderPriceLines()}</div>
              )}

              <div style={s.bookFoot}>
                {/* Phone only, and first in the row so it takes the space
                    the desktop figures leave behind. */}
                <span className="book-money-mini" style={s.moneyMini}>
                  <span style={s.moneyMiniLine}>
                    {totalDays > 0
                      ? `₱${totalPrice.toLocaleString()} total · ₱${amountToPay.toLocaleString()} now`
                      : 'Pick your dates to see the price.'}
                  </span>
                  {totalDays > 0 && (
                    <button
                      type="button"
                      className="text-link-btn"
                      style={s.moneyMiniToggle}
                      aria-expanded={showMoneySheet}
                      onClick={() => setShowMoneySheet((v) => !v)}
                    >
                      {showMoneySheet ? 'Hide breakdown' : 'See breakdown'}
                    </button>
                  )}
                </span>

                {step === 1 && (
                  <>
                    <span className="book-foot-info">
                      <span style={s.footKey}>Duration</span>
                      <span style={s.footValue}>{totalDays > 0 ? `${totalDays} ${dayWord(totalDays)}` : '—'}</span>
                    </span>
                    <span className="book-foot-info" style={{ marginLeft: '18px' }}>
                      <span style={s.footKey}>Estimated price</span>
                      <span style={{ ...s.footValue, color: goldInk(isDark) }}>
                        {totalDays > 0 ? `₱${totalPrice.toLocaleString()}` : '—'}
                      </span>
                    </span>
                    <span style={s.footPush}>
                      <button style={s.nextBtn} onClick={goToDatesNext} disabled={car.isAvailable === false}>
                        Continue →
                      </button>
                    </span>
                  </>
                )}
                {step === 2 && (
                  <>
                    <button className="book-back-foot" style={s.backStepBtn} onClick={() => goToStep(1)}>Back</button>
                    <span style={s.footPush}>
                      <button style={s.nextBtn} onClick={goToPlaceNext}>
                        Continue →
                      </button>
                    </span>
                  </>
                )}
                {step === 3 && (
                  <>
                    <button className="book-back-foot" style={s.backStepBtn} onClick={() => goToStep(2)}>Back</button>
                    <span className="book-foot-info">
                      <span style={s.footKey}>Delivery</span>
                      <span style={s.footValue}>
                        {deliveryBlocked ? 'Too far' : deliveryFee > 0 ? `₱${deliveryFee.toLocaleString()}` : 'None'}
                      </span>
                    </span>
                    <span style={s.footPush}>
                      {/* A place we don't serve stops the booking here, where
                          the map is still on screen to change it — not at
                          the payment screen, and certainly not after. It has
                          to LOOK stopped too: a full-strength gold button
                          that silently does nothing reads as a broken site
                          rather than as an answer. */}
                      <button
                        style={deliveryBlocked
                          ? { ...s.nextBtn, opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' }
                          : s.nextBtn}
                        onClick={goToPaymentNext}
                        disabled={deliveryBlocked}
                      >
                        Continue →
                      </button>
                    </span>
                  </>
                )}
                {step === 4 && (
                  <>
                    <button className="book-back-foot" style={s.backStepBtn} onClick={() => goToStep(3)}>Back</button>
                    <span className="book-foot-info">
                      <span style={s.footKey}>{paymentType === 'downpayment' ? 'Due now (20%)' : 'Total due'}</span>
                      <span style={{ ...s.footValue, color: goldInk(isDark) }}>₱{amountToPay.toLocaleString()}</span>
                    </span>
                    <span style={s.footPush}>
                      <button style={s.nextBtn} onClick={goToReviewNext}>
                        Continue →
                      </button>
                    </span>
                  </>
                )}
                {step === 5 && (
                  <>
                    <button className="book-back-foot" style={s.backStepBtn} onClick={() => goToStep(4)} disabled={booking}>Back</button>
                    <span style={s.footPush}>
                      <button
                        style={s.nextBtn}
                        onClick={openRefundNotice}
                        disabled={booking || !agreedToTerms || car.isAvailable === false}
                      >
                        <CardIcon />
                        {booking ? 'Redirecting to GCash...' : `Continue to GCash — Pay ₱${amountToPay.toLocaleString()}`}
                      </button>
                    </span>
                  </>
                )}
              </div>
            </section>

            {/* Your trip: the vehicle, the choices so far, and the price.
                Hidden on a phone (see .booking-modal-side in index.css),
                where the footer carries the money instead. */}
            <aside className="booking-modal-side" style={s.bookSide} aria-label="Your trip">
              <TripPanel
                steps={bookingStepsFor(stepSummaries())}
                currentStep={step}
                onStepClick={goToStep}
                isDark={isDark}
                vehicleName={`${car.brand} ${car.model}`}
                vehicleMeta={`${car.year} · ${car.category} · ₱${car.pricePerDay.toLocaleString()} a day`}
                money={totalDays > 0 ? renderPriceLines() : null}
              />
            </aside>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="car-detail-page" style={s.container}>
        <BackButton text="Back to all cars" onClick={() => navigate('/cars')} />

        {/* Where this vehicle sits, so the way back is a place and not just
            a button. */}
        <nav style={s.crumbs} aria-label="Breadcrumb">
          <Link to="/cars" style={s.crumbLink}>Vehicles</Link>
          <span aria-hidden="true">/</span>
          <Link to={`/cars?category=${encodeURIComponent(car.category || '')}`} style={s.crumbLink}>{car.category}</Link>
          <span aria-hidden="true">/</span>
          <span style={s.crumbNow}>{car.brand} {car.model}</span>
        </nav>

        {/* Everything needed to decide, on one line: what it is, how it
            rates, what it costs, and the way in. */}
        <div className="vehicle-head" style={s.vehicleHead}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h1 style={s.carName}>
              {car.brand} {car.model} <span style={s.carNameMeta}>{car.category} · {car.year}</span>
            </h1>
            <div style={s.headFacts}>
              {car.ratingCount > 0 ? (
                <span style={s.headRating}>
                  <StarRating value={car.avgRating} size={15} readOnly />
                  <strong style={{ color: isDark ? '#e4e6eb' : '#1a1a1a' }}>{car.avgRating.toFixed(1)}</strong>
                  <span>·</span>
                  <a href="#reviews" style={s.crumbLink}>{car.ratingCount} review{car.ratingCount === 1 ? '' : 's'}</a>
                </span>
              ) : (
                <span>No reviews yet</span>
              )}
              <span>{car.seats} seats · {car.fuelType} · {car.transmission}</span>
            </div>
          </div>

          <div className="vehicle-head-price" style={s.headPrice}>
            <div>
              <span style={s.price}>₱{car.pricePerDay.toLocaleString()}</span>
              <span style={s.perDay}> a day</span>
            </div>
            {firstLongRentalRule && (
              <div style={s.longRentalNote}>
                ₱{Math.round(car.pricePerDay * (1 - firstLongRentalRule.percent / 100)).toLocaleString()} a day
                {' '}when you book {firstLongRentalRule.minDays}+
              </div>
            )}
          </div>

          <FavoriteButton
            carId={car._id}
            canFavorite={canFavorite}
            isFavorite={isFavorite(car._id)}
            onToggle={toggleFavorite}
            size={44}
            style={{ background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '12px', color: isFavorite(car._id) ? '#ef4444' : (isDark ? '#b0b3b8' : '#6b7280'), flexShrink: 0 }}
          />

          {car.isAvailable !== false && !overdueBooking && (
            <button type="button" className="vehicle-head-book" style={s.headBook} onClick={openBookingModal}>Book now</button>
          )}
        </div>

        {car.isAvailable === false && (
          <div style={s.error}>This vehicle isn&apos;t currently listed for booking. Check back later or browse other cars.</div>
        )}

        {car.isAvailable !== false && overdueBooking && (
          <div style={s.offRoadBox}>
            <p style={s.offRoadNote}>
              {overdueBooking.car?.brand
                ? `Your ${overdueBooking.car.brand} ${overdueBooking.car.model}`
                : 'A vehicle you booked'} is {overdueLabel(hoursLate(overdueBooking.endDate, new Date()), overdueBooking.lateFee?.days).toLowerCase()} and hasn&apos;t been returned yet,
              so you can&apos;t book another vehicle until it&apos;s back.
            </p>
            <p style={{ ...s.offRoadNote, fontWeight: '500', marginTop: '8px' }}>
              Need it for longer? Use <strong>Keep It Longer</strong> on that booking instead.
            </p>
            <Link to="/my-bookings" style={s.licenseLink}>Go to My Bookings</Link>
          </div>
        )}

        <div className="vehicle-main" style={s.vehicleMain}>
          <div>
            <div style={s.imgWrap}>
              {activePhoto ? (
                <img src={activePhoto.url} alt={car.model} style={s.img} />
              ) : (
                <div style={s.noImg}>No Image</div>
              )}
            </div>
            {galleryPhotos.length > 1 && (
              <div style={s.thumbRow}>
                {galleryPhotos.map((photo, i) => (
                  <button
                    key={photo.fileId || photo.url || i}
                    type="button"
                    style={s.thumbBtn(i === activePhotoIndex)}
                    onClick={() => setActivePhotoIndex(i)}
                    aria-label={`View photo ${i + 1}`}
                    aria-current={i === activePhotoIndex}
                  >
                    <img src={photo.url} alt="" style={s.thumbImg} />
                  </button>
                ))}
              </div>
            )}
            <PromoBadge promo={car.promo} isDark={isDark} style={s.promoBadge} />
            {car.description && (
              <p style={s.description}>{car.description}</p>
            )}
          </div>

          <AvailabilityStrip
            bookedRanges={bookedRanges}
            startDate={startDate}
            endDate={endDate}
            onSelectDay={handleSelectDay}
            onBook={bookTheseDates}
            isDark={isDark}
            message={error}
            pricePerDay={car.pricePerDay}
            days={totalDays}
            discount={discountAmount}
            total={totalPrice}
            longRentalRule={longRentalRule || firstLongRentalRule}
            nextFree={car.isAvailable !== false ? nextFree : ''}
          />
        </div>

        {/* The three things people ask before they start, answered where
            they are asked rather than two screens into the wizard. */}
        <div className="vehicle-notes" style={s.notesRow}>
          <div style={s.note}>
            <div style={s.noteHead}>With a driver, or self-drive</div>
            <p style={s.noteBody}>
              Self-drive needs your licence expiry date in your{' '}
              <Link to="/profile" style={s.crumbLink}>Profile</Link>, so we can check it covers your
              trip. Bring the licence itself, plus two valid IDs, when you collect.
            </p>
          </div>
          <div style={s.note}>
            <div style={s.noteHead}>Pickup or delivery</div>
            <p style={s.noteBody}>
              Collect at our {deliverySettings?.base?.label || 'Salugan'} office, or have it brought to
              you{deliverySettings?.enabled ? ` for ₱${deliverySettings.ratePerKm || 25} a kilometre by road` : ''}.
            </p>
          </div>
          <div style={s.note}>
            <div style={s.noteHead}>Pay by GCash</div>
            <p style={s.noteBody}>
              20% to reserve, or pay in full. Our office confirms every booking.
            </p>
          </div>
        </div>

        {/* Phone only. The price and the way in follow you down the page,
            so neither is ever something you have to scroll back up for. */}
        {car.isAvailable !== false && !overdueBooking && (
          <div className="vehicle-pinned" style={s.pinnedBar}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <span style={s.pinnedPrice}>₱{car.pricePerDay.toLocaleString()}</span>
                <span style={s.perDay}> a day</span>
              </div>
              {firstLongRentalRule && (
                <div style={s.longRentalNote}>
                  {firstLongRentalRule.minDays}+ days: ₱{Math.round(car.pricePerDay * (1 - firstLongRentalRule.percent / 100)).toLocaleString()} a day
                </div>
              )}
            </div>
            <button type="button" style={s.headBook} onClick={openBookingModal}>Book now</button>
          </div>
        )}

        <div id="reviews" style={s.reviewsSection}>
          <div style={s.reviewsHead}>
            <h2 style={s.reviewsTitle}>What renters say</h2>
            {car.ratingCount > 0 && (
              <div style={s.reviewsScore}>
                <span style={{ color: isDark ? GOLD_DARK : GOLD, fontSize: '18px' }}>★</span>
                <strong style={{ fontSize: '18px' }}>{car.avgRating.toFixed(1)}</strong>
                <span style={s.reviewsSpread}>
                  {/* The spread, not just the average: "4.7" says nothing
                      about whether one person had a bad time. */}
                  {[5, 4, 3, 2, 1]
                    .map((n) => ({ n, c: reviews.filter((r) => Math.round(r.overall) === n).length }))
                    .filter((x) => x.c > 0)
                    .map((x) => `${x.c} ${x.n}-star`)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>

          {reviewsLoading ? null : commentedReviews.length > 0 ? (
            <div className="review-quotes" style={s.quoteGrid}>
              {(showAllReviews ? commentedReviews : commentedReviews.slice(0, 4)).map((r) => (
                <figure key={r._id || r.createdAt} style={s.quote}>
                  <blockquote style={s.quoteText}>&ldquo;{r.comment}&rdquo;</blockquote>
                  <figcaption style={s.quoteBy}>
                    <span style={{ color: isDark ? GOLD_DARK : GOLD }}>
                      {'★'.repeat(Math.round(r.overall))}
                    </span>
                    <strong style={{ color: isDark ? '#e4e6eb' : '#1a1a1a' }}>{r.userName || 'Renter'}</strong>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p style={s.reviewEmpty}>
              {reviews.length > 0
                ? 'No written reviews yet — the ratings are below.'
                : 'No reviews yet — be the first to rent and rate this vehicle.'}
            </p>
          )}

          {!reviewsLoading && reviews.length > 0 && !showAllReviews && (
            <button type="button" className="text-link-btn" style={s.seeAll} onClick={() => setShowAllReviews(true)}>
              See all {reviews.length} rating{reviews.length === 1 ? '' : 's'}
            </button>
          )}

          {!reviewsLoading && reviews.length > 0 && showAllReviews && (
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
          ) : !showAllReviews ? null : filteredReviews.length === 0 ? (
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
                    <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' }}>{r.overall.toFixed(1)}</span>
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