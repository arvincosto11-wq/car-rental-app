import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';
import FavoriteButton from '../components/FavoriteButton';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import BookingSteps from '../components/BookingSteps';
import FlowButton from '../components/FlowButton';
import BackButton from '../components/BackButton';
import PromoConfetti from '../components/PromoConfetti';
import PromoBadge from '../components/PromoBadge';
import useLongRentalRules from '../hooks/useLongRentalRules';
import { bestLongRentalRule, longRentalDiscountOn, rulesForCar } from '../utils/longRental';
import useModalA11y from '../hooks/useModalA11y';
import usePageTitle from '../hooks/usePageTitle';
import useFavorites from '../hooks/useFavorites';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';
import { isPromoVisible, promoOffer, promoDateRange, promoCoversRange, promoDiscountOn } from '../utils/promo';
import api from '../api';

// Booking-modal icons — hand-drawn inline SVG, like the rest of the site.
const ModalIcon = ({ children, size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    {children}
  </svg>
);
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

const STEP_HEADINGS = {
  1: { title: 'Select Dates', sub: 'Tap a pickup date, then a return date.' },
  2: { title: 'Type & Payment', sub: 'Choose how you drive and how you pay.' },
  3: { title: 'Final Confirmation', sub: 'Check everything, then pay.' },
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
  const [bookedRanges, setBookedRanges] = useState([]);
  // Pre-filled from the homepage/Cars search box, if the visitor came from there.
  const [startDate, setStartDate] = useState(searchParams.get('pickup') || '');
  const [endDate, setEndDate] = useState(searchParams.get('return') || '');
  usePageTitle(car ? `${car.brand} ${car.model}` : 'Vehicle');
  const [paymentType, setPaymentType] = useState('downpayment');
  const [bookingType, setBookingType] = useState('with-driver');
  const [profile, setProfile] = useState(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showRefundNotice, setShowRefundNotice] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const BOOKING_STEPS = [
    { label: 'Select Dates', desc: 'Choose your pickup and return dates' },
    { label: 'Type & Payment', desc: 'Choose how you drive and pay' },
    { label: 'Confirmation', desc: 'Check everything, then pay' },
  ];

  const termsModalRef = useModalA11y(() => setShowTerms(false), showTerms);
  const refundNoticeModalRef = useModalA11y(() => setShowRefundNotice(false), showRefundNotice);
  const bookingModalRef = useModalA11y(() => setShowBookingModal(false), showBookingModal);

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
  }, [user]);

  // Self-drive is only bookable once admin has verified the client's ID —
  // having a license number/expiry and an uploaded ID photo on file isn't
  // enough on its own, since either could be fabricated. All three are
  // managed from Profile, not inline in this wizard.
  const isSelfDriveEligible = !!profile?.idVerified;
  const supportedBookingTypes = car?.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'];
  const selfDriveBlocked = bookingType === 'self-drive' && !isSelfDriveEligible;

  const totalDays = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
    : 0;

  // Mirrors computeBookingPrice on the server. The server recomputes all of
  // this at booking time and its answer is the one that counts — this is
  // only so the customer sees the right number before committing.
  const subtotal = totalDays > 0 ? totalDays * car?.pricePerDay : 0;
  const promoApplies = promoCoversRange(car?.promo, startDate, endDate);
  const promoAmount = promoApplies ? promoDiscountOn(car.promo, subtotal) : 0;
  // A trip can qualify for the date promo and a long-rental discount at once.
  // They never stack — the bigger one wins, same rule as computeBookingPrice.
  const longRentalRule = car ? bestLongRentalRule(longRentalRules, car._id, totalDays) : null;
  const longRentalAmount = longRentalDiscountOn(longRentalRule, subtotal);
  const usingLongRental = longRentalAmount > promoAmount;
  const discountAmount = Math.max(promoAmount, longRentalAmount);
  // The shortest-trip rule, for the "Book 7+ days, save 10%" line.
  const firstLongRentalRule = car ? rulesForCar(longRentalRules, car._id)[0] : null;
  const totalPrice = subtotal - discountAmount;
  const downPayment = Math.ceil(totalPrice * 0.20);

  // Fire the burst on the transition INTO qualifying, not on every render
  // while it still qualifies — otherwise changing the payment type or
  // re-rendering for any other reason would set it off again.
  useEffect(() => {
    if (discountAmount > 0) setPromoCelebrated(Date.now());
  }, [discountAmount, car?._id]);
  const amountToPay = paymentType === 'downpayment' ? downPayment : totalPrice;

  const overlapsBookedDates = (start, end) => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return bookedRanges.some((r) => s < new Date(r.endDate).getTime() && e > new Date(r.startDate).getTime());
  };

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
      setError('That range includes a booked date. Please choose a different range.');
      return;
    }
    setEndDate(clicked);
  };

  const goToStep = (n) => {
    setError('');
    setStep(n);
  };

  const goToDatesNext = () => {
    if (!user) return navigate('/login');
    if (!startDate || !endDate) return setError('Please select pickup and return dates');
    if (totalDays <= 0) return setError('Return date must be after pickup date');
    if (car.isAvailable === false) return setError('This vehicle is no longer listed for booking.');
    if (overlapsBookedDates(startDate, endDate)) {
      return setError('This vehicle is already booked for some of your selected dates. Check the calendar above and pick different dates.');
    }
    setError('');
    setStep(2);
  };

  const goToConfirmNext = () => {
    if (selfDriveBlocked) {
      return setError("Self-drive isn't available on your account yet — see the notice above for what's needed.");
    }
    setError('');
    setStep(3);
  };

  const openRefundNotice = () => {
    if (!agreedToTerms) return setError('Please agree to the Terms and Conditions');
    setError('');
    setShowRefundNotice(true);
  };

  const openBookingModal = () => {
    if (!user) return navigate('/login');
    setError('');
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
        paymentType,
        amountPaid: amountToPay,
        totalPrice,
        bookingType,
        paymentMethod: 'gcash',
      });

      const { data } = await api.post('/payments/gcash/checkout-session', { bookingId: res.data._id });
      window.location.href = data.checkoutUrl;
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
    licenseBox: { background: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff', border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`, borderRadius: '8px', padding: '12px', marginBottom: '14px' },
    licenseNote: { fontSize: '12px', color: isDark ? '#93c5fd' : '#1e40af', marginBottom: '10px', marginTop: 0 },
    fieldHint: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '14px' },
    promoBadge: { marginBottom: '10px' },
    longRentalNote: {
      display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px',
      fontSize: '12px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD,
    },
    promoNudge: {
      marginTop: '10px', fontSize: '12px', fontWeight: '600',
      color: isDark ? GOLD_DARK : GOLD,
    },
    breakdownRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '6px' },
    breakdownTotal: { display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, paddingTop: '8px', marginTop: '8px' },
    termsRow: { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    termsLink: { color: isDark ? GOLD_DARK : GOLD, cursor: 'pointer', textDecoration: 'underline' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' },
    noCC: { textAlign: 'center', fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '8px' },
    // ---- booking modal shell: sidebar + content, its own scroll ----
    bookShell: {
      width: '100%', maxWidth: '900px', maxHeight: '88vh', outline: 'none',
      display: 'grid', gridTemplateColumns: '264px minmax(0, 1fr)',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '24px', overflow: 'hidden',
      boxShadow: '0 30px 70px rgba(0,0,0,0.28)',
    },
    bookSide: {
      background: isDark ? '#1c1d1e' : '#f6f7f9',
      borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      padding: '26px 22px', overflowY: 'auto',
    },
    bookSideTitle: { margin: 0, fontSize: '17px', fontWeight: '800', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    bookSideCar: { margin: '3px 0 24px', fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af' },
    sidePromo: {
      marginTop: '26px', padding: '14px', borderRadius: '14px',
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)'}`,
    },
    sidePromoHead: {
      display: 'flex', alignItems: 'center', gap: '7px',
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : GOLD,
    },
    sidePromoText: { margin: '6px 0 0', fontSize: '12px', lineHeight: 1.5, color: isDark ? '#b0b3b8' : '#4b5563' },
    bookMain: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 },
    bookHead: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px',
      padding: '24px 26px 18px', borderBottom: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    bookHeadTitle: { margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    bookHeadSub: { margin: '3px 0 0', fontSize: '12.5px', color: isDark ? '#8a8d91' : '#9ca3af' },
    bookCloseBtn: {
      width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%', border: 'none', cursor: 'pointer',
      background: isDark ? '#18191a' : '#f3f4f6', color: isDark ? '#b0b3b8' : '#4b5563', fontSize: '14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
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
      color: isDark ? GOLD_DARK : GOLD,
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
    choiceAmount: (active) => ({ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.01em', color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#e4e6eb' : '#1a1a1a') }),
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
              <p>Refund amount depends on how long ago you made the booking, not your pickup date: cancel within 12 hours of booking for a full refund, within 12 to 24 hours for a 50% refund, or after 24 hours for no refund.</p>
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
              <p>The renter is liable for any damage to the vehicle during the rental period. Urban Wheels Car Rental reserves the right to charge for repairs.</p>
              <br/>
              <p><strong>7. Payment</strong></p>
              <p>Your downpayment or full payment is collected online via GCash (through PayMongo) at the time of booking. If you chose the 20% downpayment option, the remaining balance must be settled in cash or GCash upon vehicle pickup.</p>
              <br/>
              <p><strong>8. Late Returns</strong></p>
              <p>Late returns will be charged an additional fee equivalent to one day's rental rate per day of delay.</p>
              <br/>
              <p><strong>9. Rescheduling</strong></p>
              <p>Instead of cancelling, you may request to move a pending or confirmed booking to different dates at no extra fee, as long as the new dates keep the same trip length and are approved by an admin. See My Bookings to request a reschedule.</p>
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
      {showRefundNotice && (
        <motion.div style={{ ...s.modal, zIndex: 1001 }} {...backdropMotion}>
          <motion.div style={s.modalContent} {...modalMotion} ref={refundNoticeModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="refund-notice-title">
            <h2 id="refund-notice-title" style={s.modalTitle}>Before You Confirm</h2>
            <div style={s.modalText}>
              <p>⚠️ <strong>Refund Policy:</strong> Cancellations made within 12 hours of booking are eligible for a full refund. Cancellations made 12–24 hours after booking are eligible for a 50% refund. No refund is issued after 24 hours.</p>
              <p style={{ marginTop: '10px' }}>
                Since you are booking now, cancelling within the next 12 hours will entitle you to a full refund of ₱{amountToPay.toLocaleString()}.
              </p>
              <p style={{ marginTop: '10px' }}>
                ⛽ <strong>Fuel Policy:</strong> Please return the vehicle with the same fuel level it had at pickup, or the difference will be charged to you.
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
            {/* Sidebar: where you are in the flow, and this vehicle's own
                discount if it has one. Collapses above the content on
                narrow screens (see .booking-modal-shell in index.css). */}
            <aside className="booking-modal-side" style={s.bookSide}>
              <h2 id="booking-modal-title" style={s.bookSideTitle}>Book Vehicle</h2>
              <div style={s.bookSideCar}>{car.brand} {car.model} · {car.year}</div>

              <BookingSteps steps={BOOKING_STEPS} currentStep={step} onStepClick={goToStep} isDark={isDark} />

              {(firstLongRentalRule || isPromoVisible(car.promo)) && (
                <div className="booking-modal-promo" style={s.sidePromo}>
                  <div style={s.sidePromoHead}>
                    <SparkIcon /> {firstLongRentalRule ? 'Long-rental discount' : car.promo.label}
                  </div>
                  <p style={s.sidePromoText}>
                    {firstLongRentalRule
                      ? <>Book <strong>{firstLongRentalRule.minDays}+ days</strong> on this vehicle and save <strong>{firstLongRentalRule.percent}%</strong> automatically.</>
                      : <>Save <strong>{promoOffer(car.promo)}</strong> on trips inside <strong>{promoDateRange(car.promo)}</strong>.</>}
                  </p>
                </div>
              )}
            </aside>

            <section style={s.bookMain}>
              <div style={s.bookHead}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={s.bookHeadTitle}>{STEP_HEADINGS[step].title}</h3>
                  <p style={s.bookHeadSub}>{STEP_HEADINGS[step].sub}</p>
                </div>
                <button type="button" className="icon-toggle-btn" aria-label="Close" style={s.bookCloseBtn} onClick={() => setShowBookingModal(false)}>✕</button>
              </div>

              <div style={s.bookBody}>
                {error && <div style={s.error}>{error}</div>}

                <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    {(startDate || endDate) && (
                      <div style={s.selectedPill}>
                        <span style={s.pillLeft}>
                          <span style={s.pillIcon}><CalendarIcon /></span>
                          <span style={{ minWidth: 0 }}>
                            <span style={s.pillLabel}>Selected dates</span>
                            <span style={s.pillValue}>
                              {startDate && endDate
                                ? `${new Date(startDate).toLocaleDateString()} → ${new Date(endDate).toLocaleDateString()} · ${totalDays} ${dayWord(totalDays)}`
                                : `${new Date(startDate).toLocaleDateString()} → pick your return date`}
                            </span>
                          </span>
                        </span>
                        <button type="button" style={s.pillAction} onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</button>
                      </div>
                    )}

                    <AvailabilityCalendar
                      bookedRanges={bookedRanges}
                      selectedStart={startDate}
                      selectedEnd={endDate}
                      onSelectDay={handleSelectDay}
                      isDark={isDark}
                      promo={isPromoVisible(car.promo) ? car.promo : null}
                    />
                    {isPromoVisible(car.promo) && startDate && endDate && !promoApplies && !usingLongRental && (
                      <p style={s.promoNudge}>
                        Pick dates within {promoDateRange(car.promo)} to save {promoOffer(car.promo)}.
                        The whole rental has to fall inside the promo.
                      </p>
                    )}
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
                            {new Date(startDate).toLocaleDateString()} → {new Date(endDate).toLocaleDateString()} · {totalDays} {dayWord(totalDays)}
                          </span>
                        </span>
                      </span>
                      <button type="button" style={s.pillAction} onClick={() => goToStep(1)}>Edit</button>
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

                    {supportedBookingTypes.includes('self-drive') && (
                      <p style={s.noteRow}>
                        <InfoIcon />
                        <span>
                          Self drive needs a <strong style={s.noteStrong}>valid ID and driver&apos;s licence</strong>, verified by our
                          team beforehand — manage these in your{' '}
                          <Link to="/profile" style={{ color: isDark ? GOLD_DARK : GOLD, fontWeight: '700' }}>Profile</Link>.
                        </span>
                      </p>
                    )}

                    {selfDriveBlocked && (
                      <div style={s.licenseBox}>
                        <p style={s.licenseNote}>
                          {!profile?.validIdImage
                            ? "Self-drive isn't available yet — please add your driver's license and upload a photo of a valid ID in your Profile, then wait for our team to verify it."
                            : "Your ID is uploaded and pending verification by our team. You'll be able to book self-drive once it's approved."}
                        </p>
                        <Link to="/profile" style={s.licenseLink}>Go to Profile</Link>
                      </div>
                    )}

                    <div style={{ ...s.sectionLabel, marginTop: '20px' }} id="cd-payment-option-label">Payment option</div>
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
                      <div style={s.breakdownRow}>
                        <span>{totalDays} {dayWord(totalDays)} × ₱{car.pricePerDay.toLocaleString()}</span>
                        <span>₱{subtotal.toLocaleString()}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div style={{ ...s.breakdownRow, color: isDark ? GOLD_DARK : GOLD, fontWeight: '700' }}>
                          <span>
                            {usingLongRental
                              ? `Long-rental discount (${longRentalRule.minDays}+ days, ${longRentalRule.percent}% off)`
                              : `${car.promo.label} (${promoOffer(car.promo)})`}
                          </span>
                          <span>−₱{discountAmount.toLocaleString()}</span>
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
                    </div>

                    <p style={s.noteRow}>
                      <span style={s.gcashBadge}><span style={s.gcashDot} /> GCash via PayMongo</span>
                      <span>You&apos;ll be redirected to complete the payment after confirming.</span>
                    </p>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
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
                            <span style={s.summarySub}>{bookingType === 'self-drive' ? 'You drive it yourself' : 'We provide the driver'}</span>
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
                        <strong style={{ color: isDark ? GOLD_DARK : GOLD }}>₱{amountToPay.toLocaleString()}</strong> with GCash.
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
                          <button type="button" style={{ ...s.termsLink, background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => setShowTerms(true)}>
                            Terms and Conditions
                          </button>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

              <div style={s.bookFoot}>
                {step === 1 && (
                  <>
                    <span>
                      <span style={s.footKey}>Duration</span>
                      <span style={s.footValue}>{totalDays > 0 ? `${totalDays} ${dayWord(totalDays)}` : '—'}</span>
                    </span>
                    <span style={{ marginLeft: '18px' }}>
                      <span style={s.footKey}>Estimated price</span>
                      <span style={{ ...s.footValue, color: isDark ? GOLD_DARK : GOLD }}>
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
                    <button style={s.backStepBtn} onClick={() => goToStep(1)}>Back</button>
                    <span style={s.footPush}>
                      <button style={s.nextBtn} onClick={goToConfirmNext}>Continue →</button>
                    </span>
                  </>
                )}
                {step === 3 && (
                  <>
                    <button style={s.backStepBtn} onClick={() => goToStep(2)} disabled={booking}>Back</button>
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
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <div style={s.container}>
        <BackButton text="Back to all cars" onClick={() => navigate('/cars')} />

        <div className="car-detail-layout" style={s.layout}>
          {/* Left */}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <h1 style={s.carName}>{car.brand} {car.model}</h1>
              <FavoriteButton
                carId={car._id}
                canFavorite={canFavorite}
                isFavorite={isFavorite(car._id)}
                onToggle={toggleFavorite}
                size={38}
                style={{ background: isDark ? '#242526' : '#f3f4f6', color: isFavorite(car._id) ? '#ef4444' : (isDark ? '#b0b3b8' : '#6b7280'), flexShrink: 0 }}
              />
            </div>
            <p style={s.carSub}>{car.category} · {car.year}</p>
            {car.ratingCount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '-8px' }}>
                <StarRating value={car.avgRating} size={16} readOnly />
                <span style={{ fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' }}>
                  {car.avgRating.toFixed(1)}
                </span>
                <span style={{ fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280' }}>
                  ({car.ratingCount} review{car.ratingCount === 1 ? '' : 's'})
                </span>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '-8px', marginBottom: '16px' }}>
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
            <PromoBadge promo={car.promo} isDark={isDark} style={s.promoBadge} />
            <div style={s.priceRow}>
              <span style={s.price}>₱{car.pricePerDay.toLocaleString()}</span>
              <span style={s.perDay}>per day</span>
            </div>
            {firstLongRentalRule && (
              <div style={s.longRentalNote}>
                Book {firstLongRentalRule.minDays}+ days, save {firstLongRentalRule.percent}%
                {rulesForCar(longRentalRules, car._id).length > 1 && ' — more for longer trips'}
              </div>
            )}

            {car.isAvailable === false && (
              <div style={s.error}>This vehicle isn't currently listed for booking. Check back later or browse other cars.
              </div>)}

            {car.isAvailable !== false && (
              <>
                <p style={s.fieldHint}>Pick your dates, choose a booking type, and confirm — takes about a minute.</p>
                <FlowButton text="Book Now" onClick={openBookingModal} style={{ width: '100%' }} />
                <p style={s.noCC}>Paid securely via GCash</p>
              </>
            )}
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