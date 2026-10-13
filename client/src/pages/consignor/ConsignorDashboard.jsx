import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk} from '../../theme';
import { useNotifications } from '../../context/NotificationContext';
import Skeleton, { SkeletonListCard, SkeletonTableRows } from '../../components/Skeleton';
import PromoBadge from '../../components/PromoBadge';
import BlockDatesPanel, { upcomingBlockCount } from '../../components/BlockDatesPanel';
import { ownerEarningFor, adminCoveredFor, isPromoVisible } from '../../utils/promo';
import useModalA11y from '../../hooks/useModalA11y';
import usePageTitle from '../../hooks/usePageTitle';
import BookInspection from './BookInspection';
import api from '../../api';
import { formatMoment } from '../../utils/phTime';
import { fuelLabel } from '../../utils/fuel';




// Out on the road right now, and whether it should have been back by now.
// Mirrors the server's own rule; this only decides what the owner is shown.
const isOut = (b) => b.status === 'confirmed' && !!b.collectedAt && !b.returnedAt;
const overdueNow = (b) => isOut(b) && new Date(b.endDate) < new Date();
const daysOverdue = (b) => Math.max(1, Math.ceil((Date.now() - new Date(b.endDate).getTime()) / (24 * 60 * 60 * 1000)));

// Drawn, not emoji: the system font renders those in its own colours,
// which is how the old footer ended up with red and pink icons on gold.
const MenuIcon = ({ children }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const OverviewIcon = () => <MenuIcon><rect x="3" y="3" width="7" height="8" rx="1.6" /><rect x="14" y="3" width="7" height="5" rx="1.6" /><rect x="3" y="14" width="7" height="7" rx="1.6" /><rect x="14" y="11" width="7" height="10" rx="1.6" /></MenuIcon>;
const HistoryIcon = () => <MenuIcon><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></MenuIcon>;
const CalendarOffIcon = () => <MenuIcon><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="8" y1="2.5" x2="8" y2="6.5" /><line x1="16" y1="2.5" x2="16" y2="6.5" /><line x1="9.5" y1="15" x2="14.5" y2="15" /></MenuIcon>;
const PinIcon = () => <MenuIcon><path d="M12 21s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></MenuIcon>;
const WarnIcon = () => <MenuIcon><path d="M12 3.5 2.8 19.5h18.4z" /><line x1="12" y1="9.5" x2="12" y2="14" /><line x1="12" y1="16.6" x2="12" y2="16.7" /></MenuIcon>;

// Bookings fall under the month they start in, newest month first, so the
// list reads the way somebody remembers their own year.
const MONTH_LABEL = (d) => new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();
const groupByMonth = (list) => {
  const groups = [];
  list.forEach((b) => {
    const key = MONTH_LABEL(b.startDate);
    const found = groups.find((g) => g.key === key);
    if (found) found.items.push(b);
    else groups.push({ key, items: [b] });
  });
  return groups;
};

const formatPayment = (payment) => {
  if (payment === 'gcash_pending') return 'GCash pending';
  if (payment === 'paid') return 'Paid';
  return 'Unpaid';
};

const ConsignorDashboard = () => {
  usePageTitle('My Vehicles');
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { notifications, markReadByLinkPrefix } = useNotifications();
  const navigate = useNavigate();
  const [consignments, setConsignments] = useState([]);
  const [blockPanelCarId, setBlockPanelCarId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [requestModalCarId, setRequestModalCarId] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [earningsPeriod, setEarningsPeriod] = useState('month');
  // Which panel is open, and which vehicle it is about. Both are about
  // looking rather than doing, so neither survives a reload.
  const [section, setSection] = useState('overview');
  const [selectedCarId, setSelectedCarId] = useState(null);
  // Which half of the consignor journey they are on. Worked out from whether
  // they own a listed vehicle rather than stored as a flag — see
  // routes/appointments.js. Null while it is still being asked.
  const [stage, setStage] = useState(null);
  // Their own account, for the one thing the dashboard cannot work out from
  // vehicles and bookings: whether their contract is on hold.
  const [account, setAccount] = useState(null);
  const requestModalRef = useModalA11y(() => setRequestModalCarId(null), !!requestModalCarId);

  const loadAccount = () => api.get('/auth/me')
    .then(({ data }) => setAccount(data))
    // A dashboard that will not load because it could not read one flag is
    // worse than a dashboard that does not know about the flag.
    .catch(() => setAccount(null));

  const loadStage = () => api.get('/appointments/stage')
    .then((res) => setStage(res.data))
    // A failed check must not lock somebody out of a dashboard they have
    // earned. Treated as "already a consignor", which the page below then
    // renders from the vehicles it actually finds.
    .catch(() => setStage({ stage: 'consignor' }));

  useEffect(() => {
    if (!user) return navigate('/login');
    loadStage();
    loadAccount();
    fetchConsignments();
    fetchBookings();
  }, [user]);

  // Same fix as My Bookings: the nav badge is unread-notification-based and
  // only cleared when the client opened the bell and clicked each one, so
  // it stayed lit even after they'd already come here and seen the update.
  useEffect(() => {
    markReadByLinkPrefix('/consignor');
  }, [notifications]);

  const fetchConsignments = async () => {
    try {
      const res = await api.get('/consignments/my');
      setConsignments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/owner');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBookingsLoading(false);
    }
  };

  // Both directions now need admin sign-off — bringing a vehicle back into
  // public listings is reviewed the same way as taking it down, so this
  // always opens the request modal instead of flipping isAvailable directly.
  const handleToggleAvailability = (car) => {
    setRequestModalCarId(car._id);
    setRequestReason('');
    setRequestError('');
  };

  const closeRequestModal = () => {
    setRequestModalCarId(null);
    setRequestError('');
  };

  const handleSubmitRequest = async () => {
    setRequestSubmitting(true);
    setRequestError('');
    try {
      await api.put(`/cars/${requestModalCarId}/toggle`, { reason: requestReason });
      await fetchConsignments();
      closeRequestModal();
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Something went wrong submitting this request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const approvedCount = consignments.filter((c) => c.status === 'approved').length;
  const pendingCount = consignments.filter((c) => c.status === 'pending').length;

  const earnedBookings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sumEarningsSince = (cutoff) => earnedBookings
    .filter((b) => new Date(b.createdAt) >= cutoff)
    .reduce((sum, b) => sum + ownerEarningFor(b), 0);
  const earnings = {
    week: sumEarningsSince(startOfWeek),
    month: sumEarningsSince(startOfMonth),
    all: earnedBookings.reduce((sum, b) => sum + ownerEarningFor(b), 0),
  };

  // Same period window as the toggle above, broken down per vehicle so an
  // owner with multiple cars can see which one is actually earning.
  const periodCutoff = earningsPeriod === 'week' ? startOfWeek : earningsPeriod === 'month' ? startOfMonth : null;
  const periodBookings = periodCutoff ? earnedBookings.filter((b) => new Date(b.createdAt) >= periodCutoff) : earnedBookings;
  const perCarMap = {};
  periodBookings.forEach((b) => {
    const carId = b.car?._id;
    if (!carId) return;
    if (!perCarMap[carId]) perCarMap[carId] = { car: b.car, total: 0, count: 0 };
    perCarMap[carId].total += ownerEarningFor(b);
    perCarMap[carId].count += 1;
  });
  const perCarEarnings = Object.values(perCarMap).sort((a, b) => b.total - a.total);
  const maxCarEarning = perCarEarnings[0]?.total || 0;

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const divider = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';

  // One pill for every state on the page. Cancelled is deliberately neutral:
  // red means a warning everywhere else here, and a booking somebody called
  // off weeks ago is not one.
  const TONES = {
    green: { bg: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', fg: isDark ? '#86efac' : '#065f46' },
    amber: { bg: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', fg: isDark ? '#fbbf24' : '#92400e' },
    blue: { bg: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', fg: isDark ? '#93c5fd' : '#1e40af' },
    red: { bg: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2', fg: isDark ? '#f87171' : '#b91c1c' },
    neutral: { bg: isDark ? '#303132' : '#f1f2f4', fg: isDark ? '#b0b3b8' : '#4b5563' },
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb' },
    container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
    holdBox: {
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.35)' : '#fca5a5'}`,
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      borderRadius: '12px', padding: '18px 20px', marginBottom: '20px',
    },
    holdTitle: { fontSize: '15px', fontWeight: '700', color: isDark ? '#fca5a5' : '#991b1b', marginBottom: '8px' },
    holdReason: {
      fontSize: '14px', lineHeight: 1.6, margin: '0 0 10px',
      color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '600',
    },
    holdNote: { fontSize: '13px', lineHeight: 1.6, margin: '0 0 8px', color: isDark ? '#b0b3b8' : '#4b5563' },
    holdStrong: { color: isDark ? '#e4e6eb' : '#1a1a1a' },
    perCarList: { marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    perCarEmpty: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af' },
    perCarRow: { marginBottom: '12px' },
    perCarTop: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px', gap: '10px' },
    perCarName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    perCarCount: { fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280', marginLeft: '6px', fontWeight: '400' },
    perCarAmount: { fontSize: '13px', fontWeight: '700', color: goldInk(isDark), whiteSpace: 'nowrap' },
    perCarBarTrack: { height: '6px', borderRadius: '4px', background: isDark ? '#3a3b3c' : '#f3f4f6', overflow: 'hidden' },
    perCarBarFill: (pct) => ({ height: '100%', width: `${pct}%`, borderRadius: '4px', background: isDark ? GOLD_DARK : GOLD }),
    periodToggleRow: { display: 'flex', gap: '8px' },
    periodBtn: (active) => ({
      padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
      border: active ? 'none' : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#b0b3b8' : '#6b7280'),
      cursor: 'pointer',
    }),
    empty: { textAlign: 'center', padding: '48px 16px', color: isDark ? '#b0b3b8' : '#6b7280' },
    promoSection: { marginTop: '14px' },
    promoNote: {
      fontSize: '11px', fontWeight: '600', marginTop: '6px',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    tripPhotos: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' },
    tripPhoto: {
      width: '52px', height: '40px', objectFit: 'cover', borderRadius: '6px', cursor: 'zoom-in',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '100%' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '6px' },
    modalSub: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '14px', lineHeight: '1.5' },
    errorBox: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#e4e6eb' : '#1a1a1a', background: isDark ? '#18191a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  
    // ── Sidebar and panel (design 2a) ──────────────────────────────────
    main: {
      maxWidth: '1240px', margin: '0 auto', padding: '36px 32px 72px',
      display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start',
    },
    sidebar: { flex: '0 0 270px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 },
    identity: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 },
    avatar: {
      width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: goldTint, border: `1px solid ${goldLine}`,
      fontSize: '20px', fontWeight: '800', color: ink,
    },
    identityName: { fontSize: '16px', fontWeight: '800', color: text, wordBreak: 'break-word' },
    identitySub: { fontSize: '12.5px', color: text3, marginTop: '2px' },

    menuCard: {
      background: card, border: `1px solid ${line}`, borderRadius: '14px', padding: '6px',
      display: 'flex', flexDirection: 'column', gap: '4px',
    },
    menuBtn: (on) => ({
      display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
      minHeight: '42px', padding: '0 12px', borderRadius: '10px', border: 'none',
      fontSize: '14px', fontWeight: on ? '800' : '500', textAlign: 'left', cursor: 'pointer',
      textDecoration: 'none',
      background: on ? goldTint : 'transparent',
      color: on ? ink : text,
    }),
    menuCount: {
      marginLeft: 'auto', fontSize: '11.5px', fontWeight: '800',
      fontVariantNumeric: 'tabular-nums', color: text3,
    },
    menuArrow: { marginLeft: 'auto', fontSize: '13px', color: text3 },

    sideLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: text3, marginBottom: '8px',
    },
    vehicleList: { display: 'flex', flexDirection: 'column', gap: '6px' },
    vehicleRow: (on) => ({
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
      padding: '7px', borderRadius: '11px', cursor: 'pointer', textAlign: 'left',
      background: card,
      border: on ? `1.5px solid ${goldLine}` : `1px solid ${line}`,
    }),
    vehicleThumb: {
      width: '56px', height: '40px', borderRadius: '7px', overflow: 'hidden', flexShrink: 0,
      background: inset, display: 'block',
    },
    vehicleThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
    vehicleName: { display: 'block', fontSize: '12.5px', fontWeight: '700', color: text },
    vehicleState: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: text3, marginTop: '2px' },
    dot: (ok) => ({
      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
      background: ok ? (isDark ? '#86efac' : '#16a34a') : (isDark ? '#8a8d91' : '#9ca3af'),
    }),

    sideHelp: { fontSize: '12.5px', lineHeight: 1.5, color: text3, margin: 0 },
    sideHelpLink: { color: ink, fontWeight: '700', textDecoration: 'none' },

    panel: {
      flex: '1 1 520px', minWidth: 0, background: card, border: `1px solid ${line}`,
      borderRadius: '18px', padding: 'clamp(20px, 3vw, 30px)',
      display: 'flex', flexDirection: 'column', gap: '24px',
    },
    h1: { fontSize: '22px', fontWeight: '800', color: text, margin: 0 },
    lead: { fontSize: '13.5px', lineHeight: 1.5, color: text3, margin: '4px 0 0', maxWidth: '62ch' },

    overviewGrid: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px', alignItems: 'start' },
    countCol: { display: 'flex', flexDirection: 'column', gap: '16px' },
    inset: { background: inset, border: `1px solid ${line}`, borderRadius: '14px', padding: '18px' },
    boxLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: text3, marginBottom: '10px',
    },
    countNum: { fontSize: '28px', fontWeight: '800', color: text, lineHeight: 1 },
    earningsRow: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '10px', margin: '14px 0 4px' },
    earningsNum: { fontSize: '36px', fontWeight: '800', color: ink, lineHeight: 1 },
    earningsNote: { fontSize: '12px', color: text3 },

    pill: (tone) => ({
      display: 'inline-block', fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.05em',
      textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px',
      background: TONES[tone].bg, color: TONES[tone].fg,
    }),
    chip: (tone) => ({
      display: 'inline-block', fontSize: '11.5px', fontWeight: '700', marginTop: '6px', marginRight: '6px',
      padding: '3px 9px', borderRadius: '7px',
      background: TONES[tone].bg, color: TONES[tone].fg,
    }),

    vehicleBlock: {
      display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '18px',
      padding: '16px', borderRadius: '14px', border: `1px solid ${line}`, alignItems: 'start',
    },
    vehiclePhoto: {
      aspectRatio: '4 / 3', borderRadius: '11px', overflow: 'hidden', background: inset,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    vehiclePhotoImg: { width: '100%', height: '100%', objectFit: 'cover' },
    vehicleInfo: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: '7px' },
    pillRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    vehicleTitle: { fontSize: '17px', fontWeight: '800', color: text },
    vehicleSpecs: { fontSize: '12.5px', color: text2 },
    vehicleActions: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' },
    outlineBtn: {
      minHeight: '38px', padding: '0 16px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${line}`, background: 'transparent', color: text,
      fontSize: '12.5px', fontWeight: '700',
    },
    goldBtn: {
      alignSelf: 'flex-start', minHeight: '40px', padding: '0 18px', borderRadius: '10px',
      border: 'none', background: gold, color: ON_GOLD, fontSize: '13px', fontWeight: '800', cursor: 'pointer',
    },
    addBtn: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '44px', borderRadius: '11px', border: 'none', textDecoration: 'none',
      background: gold, color: ON_GOLD, fontSize: '13.5px', fontWeight: '800', cursor: 'pointer',
    },
    noteBox: {
      display: 'flex', gap: '9px', padding: '10px 12px', borderRadius: '10px',
      background: TONES.red.bg, border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
      color: TONES.red.fg, fontSize: '12.5px', lineHeight: 1.5,
    },
    noteIcon: { display: 'flex', flexShrink: 0, marginTop: '1px' },

    recentList: { display: 'flex', flexDirection: 'column' },
    recentRow: {
      display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', alignItems: 'center',
      padding: '11px 0', borderTop: `1px solid ${divider}`, fontSize: '13px', color: text,
    },
    recentClient: { fontWeight: '700', minWidth: 0 },
    recentDates: { fontSize: '12px', color: text3, whiteSpace: 'nowrap' },
    recentTotal: { fontWeight: '800', fontVariantNumeric: 'tabular-nums' },
    seeAll: {
      background: 'none', border: 'none', padding: '10px 0 0', font: 'inherit',
      fontSize: '12.5px', fontWeight: '700', color: ink, cursor: 'pointer',
    },

    monthLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: text3, margin: '4px 0 8px',
    },
    histList: { display: 'flex', flexDirection: 'column' },
    histRow: {
      display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: '14px',
      padding: '14px 0', borderTop: `1px solid ${divider}`, alignItems: 'start',
    },
    dateTile: {
      width: '52px', padding: '6px 0', borderRadius: '10px', textAlign: 'center',
      background: inset, border: `1px solid ${line}`,
    },
    dateTileMon: {
      display: 'block', fontSize: '9.5px', fontWeight: '800', letterSpacing: '0.08em', color: text3,
    },
    dateTileDay: { display: 'block', fontSize: '17px', fontWeight: '800', color: text, lineHeight: 1.1 },
    histTop: { display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' },
    histClient: { fontSize: '14px', fontWeight: '800', color: text },
    histSub: { fontSize: '12.5px', color: text2, marginTop: '3px' },
    histHandover: { fontSize: '12px', color: text3, marginTop: '4px', lineHeight: 1.5 },
    histRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', textAlign: 'right' },
    histTotal: { fontSize: '15px', fontWeight: '800', color: text, fontVariantNumeric: 'tabular-nums' },
    histPay: { fontSize: '11.5px', color: text3 },
    histCovered: { fontSize: '11px', color: ink, maxWidth: '200px' },

    blockedList: { display: 'flex', flexDirection: 'column' },
    blockedRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '12px 0', borderTop: `1px solid ${divider}`, fontSize: '13px', color: text,
    },
    blockedNote: { display: 'block', fontSize: '11.5px', color: text3, marginTop: '2px' },
    emptyDashed: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      padding: '34px 20px', borderRadius: '14px', textAlign: 'center',
      border: `1px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
    },
    emptyIcon: { color: text3, display: 'flex' },
    emptyTitle: { fontSize: '14px', fontWeight: '800', color: text },
    emptyNote: { fontSize: '12.5px', color: text3, margin: 0 },
  };

  // Which stage somebody is on is not known until the server says, and
  // until then NEITHER page is the right one to draw. Falling through to
  // the dashboard meant an applicant watched a stranger's empty dashboard
  // assemble itself — vehicle counts, earnings, booking table — and then
  // get replaced the moment the answer arrived.
  if (!stage) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <Skeleton height="120px" radius="14px" isDark={isDark} />
          <div style={{ height: '18px' }} />
          <Skeleton height="320px" radius="14px" isDark={isDark} />
        </div>
      </div>
    );
  }

  const onHold = !!account?.suspension?.at;

  // Stage one: no vehicle has passed its check yet, so there is no dashboard
  // to show. Not the real one in an empty state — that would be a room full
  // of things that are not theirs.
  //
  // Somebody on hold is told so even here. It can happen to an applicant
  // who has never had a vehicle listed, and being invited to book a visit
  // that the server will refuse is worse than being told why.
  if (stage.stage === 'applicant') {
    return <BookInspection stage={stage} onBooked={loadStage} suspension={onHold ? account.suspension : null} />;
  }

  // One vehicle or several: the sidebar lists them, and picking one scopes
  // what the panel is about. With a single listing this changes nothing,
  // which is the common case.
  const approved = consignments.filter((c) => c.status === 'approved' && c.linkedCar);
  const selected = approved.find((c) => c.linkedCar._id === selectedCarId) || approved[0] || null;
  const scopedBookings = selected && approved.length > 1
    ? bookings.filter((b) => b.car?._id === selected.linkedCar._id)
    : bookings;
  const blockedCount = selected ? upcomingBlockCount(selected.linkedCar.blockedDates) : 0;

  const menu = [
    { key: 'overview', label: 'Overview', icon: <OverviewIcon /> },
    { key: 'history', label: 'Booking history', icon: <HistoryIcon />, count: scopedBookings.length },
    { key: 'blocked', label: 'Blocked dates', icon: <CalendarOffIcon />, count: blockedCount },
  ];

  const statusPill = (status) => s.pill(
    status === 'confirmed' ? 'green'
      : status === 'completed' ? 'blue'
        : status === 'pending' ? 'amber'
          : 'neutral',
  );

  const bookingRow = (b) => (
    <div key={b._id} style={s.histRow}>
      <div style={s.dateTile}>
        <span style={s.dateTileMon}>{new Date(b.startDate).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span>
        <span style={s.dateTileDay}>{new Date(b.startDate).getDate()}</span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={s.histTop}>
          <span style={s.histClient}>{b.user?.name || 'Unknown'}</span>
          <span style={statusPill(b.status)}>{b.status}</span>
        </div>
        <div style={s.histSub}>
          {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()} · {b.car?.brand} {b.car?.model}
        </div>

        {/* What actually happened to their vehicle. It is their asset: it
            went out, it came back, and the person who owns it used to be
            the only one told nothing. */}
        <div style={s.histHandover}>
          {b.collectedAt ? (
            <>
              Out {formatMoment(b.collectedAt, true, { month: 'short', day: 'numeric' })}
              {b.fuel?.atPickup !== null && b.fuel?.atPickup !== undefined ? ` · fuel ${fuelLabel(b.fuel.atPickup).toLowerCase()}` : ''}
              {b.returnedAt
                ? ` · Back ${formatMoment(b.returnedAt, true, { month: 'short', day: 'numeric' })}`
                  + (b.fuel?.atReturn !== null && b.fuel?.atReturn !== undefined ? ` · fuel ${fuelLabel(b.fuel.atReturn).toLowerCase()}` : '')
                : ''}
            </>
          ) : 'No handover recorded'}
        </div>

        {isOut(b) && (
          <span style={overdueNow(b) ? s.chip('red') : s.chip('blue')}>
            {overdueNow(b)
              ? `Still out · ${daysOverdue(b)} day${daysOverdue(b) === 1 ? '' : 's'} past its return`
              : 'Currently out with the client'}
          </span>
        )}
        {b.lateFee?.days > 0 && (
          <span style={s.chip('red')}>Came back {b.lateFee.days} day{b.lateFee.days === 1 ? '' : 's'} late</span>
        )}
        {b.condition?.damageCharge > 0 && (
          <span style={s.chip('red')}>
            Damage recorded on return{b.condition.atReturn?.note ? `: ${b.condition.atReturn.note}` : ''}
          </span>
        )}
        {(b.condition?.atPickup?.photos?.length > 0 || b.condition?.atReturn?.photos?.length > 0) && (
          <div style={s.tripPhotos}>
            {[...(b.condition.atPickup?.photos || []), ...(b.condition.atReturn?.photos || [])].map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`Vehicle condition ${i + 1}`}
                style={s.tripPhoto}
                onClick={() => window.open(url, '_blank', 'noopener')}
              />
            ))}
          </div>
        )}
      </div>

      <div style={s.histRight}>
        <span style={s.histTotal}>₱{ownerEarningFor(b).toLocaleString()}</span>
        <span style={s.histPay}>{formatPayment(b.payment)}</span>
        {adminCoveredFor(b) > 0 && (
          <span style={s.histCovered}>{b.promoLabel || 'Promo'} · ₱{adminCoveredFor(b).toLocaleString()} covered by admin</span>
        )}
        {b.refundStatus === 'requested' && <span style={s.chip('blue')}>Refund requested · ₱{b.refundAmount?.toLocaleString() ?? 0}</span>}
        {b.refundStatus === 'approved' && <span style={s.chip('blue')}>Refund approved · ₱{b.refundAmount?.toLocaleString() ?? 0}</span>}
        {b.refundStatus === 'declined' && <span style={s.chip('neutral')}>Refund declined</span>}
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <main style={s.main}>
        <div className="consignor-sidebar" style={s.sidebar}>
          <div style={s.identity}>
            <div style={s.avatar}>{(user?.name || '?').trim().charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={s.identityName}>{user?.name}</div>
              <div style={s.identitySub}>
                {approved.length} vehicle{approved.length === 1 ? '' : 's'} listed
              </div>
            </div>
          </div>

          <nav style={s.menuCard} aria-label="My Vehicles sections">
            {menu.map((m) => (
              <button
                key={m.key}
                type="button"
                className="consignor-menu-btn"
                style={s.menuBtn(section === m.key)}
                aria-current={section === m.key ? 'page' : undefined}
                onClick={() => setSection(m.key)}
              >
                {m.icon}
                {m.label}
                {m.count > 0 && <span style={s.menuCount}>{m.count}</span>}
              </button>
            ))}
            {/* A page of its own, not a panel — it is a live map. */}
            <Link to="/consignor/gps-tracking" className="consignor-menu-btn" style={s.menuBtn(false)}>
              <PinIcon />
              GPS Tracking
              <span style={s.menuArrow} aria-hidden="true">↗</span>
            </Link>
          </nav>

          {approved.length > 0 && (
            <div>
              <div style={s.sideLabel}>Your vehicles</div>
              <div style={s.vehicleList}>
                {approved.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    style={s.vehicleRow(selected?._id === c._id)}
                    onClick={() => setSelectedCarId(c.linkedCar._id)}
                  >
                    <span style={s.vehicleThumb}>
                      {c.linkedCar.image && <img src={c.linkedCar.image} alt="" style={s.vehicleThumbImg} />}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={s.vehicleName}>{c.brand} {c.model}</span>
                      <span style={s.vehicleState}>
                        <span style={s.dot(c.linkedCar.isAvailable)} />
                        {c.linkedCar.isAvailable ? 'Available' : 'Hidden'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!onHold && (
            <Link className="btn-like" to="/consignor/add-vehicle" style={s.addBtn}>
              + Book another inspection
            </Link>
          )}

          <p style={s.sideHelp}>
            Questions about your listing? <Link to="/help" style={s.sideHelpLink}>Contact our team</Link>
          </p>
        </div>

        <div style={s.panel}>
          {/* Said here rather than at the door. Somebody locked out assumes
              the site is broken, tries again, and rings to ask why. Somebody
              who can sign in and read this knows what happened, what it means
              for the bookings they already have, and who to call. */}
          {onHold && (
            <div style={s.holdBox}>
              <div style={s.holdTitle}>Your contract is on hold</div>
              <p style={s.holdReason}>{account.suspension.reason}</p>
              <p style={s.holdNote}>
                Your vehicles have been taken off the site, so nobody new can book them. Bookings already
                made will go ahead as normal, and you can see them below. Nothing has been deleted.
              </p>
              <p style={s.holdNote}>
                To sort this out, please call us on <strong style={s.holdStrong}>0950-651-0479</strong> or
                reply to the email we sent you.
              </p>
            </div>
          )}

          {section === 'overview' && (
            <>
              <div>
                <h1 style={s.h1}>Overview</h1>
                <p style={s.lead}>Track the status of your consignment applications.</p>
              </div>

              <div style={s.overviewGrid}>
                <div style={s.inset}>
                  <div style={s.boxLabel}>Earnings</div>
                  <div style={s.periodToggleRow} role="tablist" aria-label="Earnings period">
                    {[['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        role="tab"
                        aria-selected={earningsPeriod === k}
                        style={s.periodBtn(earningsPeriod === k)}
                        onClick={() => setEarningsPeriod(k)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div style={s.earningsRow}>
                    <span style={s.earningsNum}>₱{earnings[earningsPeriod].toLocaleString()}</span>
                    <span style={s.earningsNote}>
                      {perCarEarnings.reduce((n, e) => n + e.count, 0)} booking
                      {perCarEarnings.reduce((n, e) => n + e.count, 0) === 1 ? '' : 's'} · confirmed &amp; completed
                    </span>
                  </div>

                  <div style={s.perCarList}>
                    {perCarEarnings.length === 0 ? (
                      <p style={s.perCarEmpty}>No earnings from any vehicle in this period yet.</p>
                    ) : (
                      perCarEarnings.map(({ car, total, count }) => (
                        <div key={car._id} style={s.perCarRow}>
                          <div style={s.perCarTop}>
                            <span style={s.perCarName}>
                              {car.brand} {car.model}
                              <span style={s.perCarCount}>{count} booking{count === 1 ? '' : 's'}</span>
                            </span>
                            <span style={s.perCarAmount}>₱{total.toLocaleString()}</span>
                          </div>
                          <div style={s.perCarBarTrack}>
                            <div style={s.perCarBarFill(maxCarEarning > 0 ? (total / maxCarEarning) * 100 : 0)} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={s.countCol}>
                  <div style={s.inset}>
                    <div style={s.boxLabel}>Listed &amp; approved</div>
                    <div style={s.countNum}>{approvedCount}</div>
                  </div>
                  <div style={s.inset}>
                    <div style={s.boxLabel}>Pending review</div>
                    <div style={s.countNum}>{pendingCount}</div>
                  </div>
                </div>
              </div>

              {loading ? (
                <SkeletonListCard isDark={isDark} />
              ) : consignments.length === 0 ? (
                <div style={s.empty}>
                  <p>You haven&apos;t submitted any vehicles yet.</p>
                  <Link className="btn-like" to="/consignor/add-vehicle" style={s.addBtn}>Book an inspection</Link>
                </div>
              ) : (
                consignments
                  .filter((c) => (approved.length > 1 && selected ? c._id === selected._id || c.status !== 'approved' : true))
                  .map((c) => (
                    <div key={c._id} style={s.vehicleBlock}>
                      <div style={s.vehiclePhoto}>
                        {(c.linkedCar?.image || c.vehiclePhotos?.[0]?.url) && (
                          <img src={c.linkedCar?.image || c.vehiclePhotos[0].url} alt="" style={s.vehiclePhotoImg} />
                        )}
                      </div>

                      <div style={s.vehicleInfo}>
                        <div style={s.pillRow}>
                          <span style={s.pill(c.status === 'approved' ? 'green' : c.status === 'pending' ? 'amber' : 'neutral')}>
                            {c.status}
                          </span>
                          {c.status === 'approved' && c.linkedCar && (
                            <span style={s.pill(c.linkedCar.isAvailable ? 'green' : 'neutral')}>
                              {c.linkedCar.isAvailable ? 'Available for booking' : 'Hidden from listings'}
                            </span>
                          )}
                          {c.linkedCar?.availabilityRequest?.status === 'pending' && (
                            <span style={s.pill('amber')}>Pending admin approval</span>
                          )}
                        </div>
                        <div style={s.vehicleTitle}>{c.brand} {c.model} {c.year}</div>
                        <div style={s.vehicleSpecs}>
                          {c.plateNumber} · {c.category} · {c.transmission} · Suggested ₱{c.suggestedPricePerDay}/day
                        </div>

                        {c.status === 'declined' && c.adminNotes && (
                          <div style={s.noteBox}>
                            <span style={s.noteIcon}><WarnIcon /></span>
                            <span>Reason: {c.adminNotes}</span>
                          </div>
                        )}

                        {c.linkedCar?.availabilityRequest?.status === 'declined' && (
                          <div style={s.noteBox}>
                            <span style={s.noteIcon}><WarnIcon /></span>
                            <span>
                              Your request to mark this vehicle{' '}
                              {c.linkedCar.availabilityRequest.type === 'available' ? 'available' : 'unavailable'} was declined
                              {c.linkedCar.availabilityRequest.adminNotes
                                ? <> · <strong>Admin&apos;s note:</strong> &ldquo;{c.linkedCar.availabilityRequest.adminNotes}&rdquo;</>
                                : '.'}
                            </span>
                          </div>
                        )}

                        {isPromoVisible(c.linkedCar?.promo) && (
                          <div style={s.promoSection}>
                            <PromoBadge promo={c.linkedCar.promo} isDark={isDark} compact />
                            <p style={s.promoNote}>
                              Admin is running this promo. It doesn&apos;t reduce what you earn —
                              your payout stays at the full price and admin covers the discount.
                            </p>
                          </div>
                        )}
                      </div>

                      {c.status === 'approved' && c.linkedCar && !onHold && (
                        <div style={s.vehicleActions}>
                          {c.linkedCar.availabilityRequest?.status !== 'pending' && (
                            <button type="button" style={s.outlineBtn} onClick={() => handleToggleAvailability(c.linkedCar)}>
                              {c.linkedCar.isAvailable ? 'Mark unavailable' : 'Mark available'}
                            </button>
                          )}
                          <button
                            type="button"
                            style={s.outlineBtn}
                            onClick={() => { setSelectedCarId(c.linkedCar._id); setSection('blocked'); }}
                          >
                            Block dates
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              )}

              {scopedBookings.length > 0 && (
                <div>
                  <div style={s.boxLabel}>Recent bookings</div>
                  <div style={s.recentList}>
                    {scopedBookings.slice(0, 3).map((b) => (
                      <div key={b._id} style={s.recentRow}>
                        <span style={s.recentClient}>{b.user?.name || 'Unknown'}</span>
                        <span style={s.recentDates}>
                          {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                        </span>
                        <span style={s.recentTotal}>₱{ownerEarningFor(b).toLocaleString()}</span>
                        <span style={statusPill(b.status)}>{b.status}</span>
                      </div>
                    ))}
                  </div>
                  {scopedBookings.length > 3 && (
                    <button type="button" className="text-link-btn" style={s.seeAll} onClick={() => setSection('history')}>
                      See all {scopedBookings.length} →
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {section === 'history' && (
            <>
              <div>
                <h1 style={s.h1}>Booking history</h1>
                <p style={s.lead}>
                  Bookings for your listed vehicles. Approving or declining is handled by our admin team.
                </p>
              </div>

              {bookingsLoading ? (
                <SkeletonListCard isDark={isDark} count={3} />
              ) : scopedBookings.length === 0 ? (
                <div style={s.empty}><p>No bookings yet for your vehicles.</p></div>
              ) : (
                groupByMonth(scopedBookings).map((group) => (
                  <div key={group.key}>
                    <div style={s.monthLabel}>{group.key}</div>
                    <div style={s.histList}>{group.items.map(bookingRow)}</div>
                  </div>
                ))
              )}
            </>
          )}

          {section === 'blocked' && (
            <>
              <div>
                <h1 style={s.h1}>Blocked dates</h1>
                <p style={s.lead}>
                  Block off dates this vehicle can&apos;t be booked, e.g. maintenance or personal use.
                </p>
              </div>

              {!selected ? (
                <div style={s.empty}><p>No listed vehicle yet.</p></div>
              ) : blockedCount === 0 ? (
                <div style={s.emptyDashed}>
                  <span style={s.emptyIcon}><CalendarOffIcon /></span>
                  <div style={s.emptyTitle}>No blocked dates on {selected.brand} {selected.model}</div>
                  <p style={s.emptyNote}>Requests take effect once our admin approves them.</p>
                  {!onHold && (
                    <button
                      type="button"
                      style={{ ...s.goldBtn, alignSelf: 'center', marginTop: '4px' }}
                      onClick={() => setBlockPanelCarId(selected.linkedCar._id)}
                    >
                      Block dates
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={s.blockedList}>
                    {(selected.linkedCar.blockedDates || [])
                      .filter((b) => new Date(b.endDate) >= new Date(new Date().toDateString()))
                      .map((b) => (
                        <div key={b._id} style={s.blockedRow}>
                          <span>
                            {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                            {b.note && <span style={s.blockedNote}>{b.note}</span>}
                          </span>
                          {b.status === 'pending' && <span style={s.pill('amber')}>Pending approval</span>}
                          {b.status === 'declined' && <span style={s.pill('neutral')}>Declined</span>}
                        </div>
                      ))}
                  </div>
                  {!onHold && (
                    <button type="button" style={s.goldBtn} onClick={() => setBlockPanelCarId(selected.linkedCar._id)}>
                      Block more dates
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {requestModalCarId && (() => {
        const targetCar = consignments.find((c) => c.linkedCar?._id === requestModalCarId)?.linkedCar;
        const goingAvailable = targetCar && !targetCar.isAvailable;
        return (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} ref={requestModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
            <h2 id="request-modal-title" style={s.modalTitle}>
              Request to Mark {goingAvailable ? 'Available' : 'Unavailable'}
            </h2>
            <p style={s.modalSub}>
              {goingAvailable
                ? 'This vehicle will stay hidden from listings until an admin reviews and approves your request.'
                : 'This vehicle will stay bookable until an admin reviews and approves your request.'}
            </p>

            {requestError && <div style={s.errorBox}>{requestError}</div>}

            <label style={s.modalLabel} htmlFor="request-reason">Reason (optional)</label>
            <textarea
              id="request-reason"
              style={s.modalTextarea}
              rows={3}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="e.g. Vehicle needs maintenance, taking it off the platform, etc."
            />

            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={closeRequestModal} disabled={requestSubmitting}>
                Cancel
              </button>
              <button style={s.modalSubmitBtn} onClick={handleSubmitRequest} disabled={requestSubmitting}>
                {requestSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {blockPanelCarId && (() => {
        // Read from the live list, so a new range shows the moment it's saved.
        const car = consignments.find((c) => c.linkedCar?._id === blockPanelCarId)?.linkedCar;
        return car ? (
          <BlockDatesPanel
            car={car}
            role="consignor"
            isDark={isDark}
            onClose={() => setBlockPanelCarId(null)}
            onCarUpdated={(updated) => setConsignments((prev) => prev.map((c) => (
              c.linkedCar?._id === updated._id ? { ...c, linkedCar: updated } : c
            )))}
          />
        ) : null;
      })()}
    </div>
  );
};

export default ConsignorDashboard;
