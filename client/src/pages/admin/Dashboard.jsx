import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { GOLD, GOLD_DARK, ON_GOLD, GOLD_TINT, GOLD_TINT_DARK, goldInk } from '../../theme';
import Skeleton from '../../components/Skeleton';
import RevenueTrendChart from '../../components/RevenueTrendChart';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';

const MONTH_DAY = { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' };
const MONTH_DAY_YEAR = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' };

// ₱38.2k rather than ₱38,200 over a bar, and ₱20k on the axis. One decimal
// only when there is one to show, so a round ₱20,000 does not read ₱20.0k.
const compactPeso = (n) => (n >= 1000
  ? `₱${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  : `₱${Math.round(n)}`);

const Stroke = ({ children, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const KeyGlyph = () => <Stroke><circle cx="8" cy="12" r="3.4" /><path d="M11.4 12H21l-2 2.2M16.6 12v2.6" /></Stroke>;
const ReturnGlyph = () => <Stroke><path d="M3 12a9 9 0 1 0 3-6.7" /><polyline points="3 4 3 9 8 9" /></Stroke>;
const VanGlyph = () => <Stroke><path d="M3 16V8a1.6 1.6 0 0 1 1.6-1.6h8.8V16" /><path d="M13.4 10H17l3 3.2V16" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="16.5" cy="17" r="1.6" /></Stroke>;
const ClipboardGlyph = () => <Stroke><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9z" /><path d="M9 11h6M9 15h4" /></Stroke>;
const WarnGlyph = () => <Stroke size={16}><path d="M12 3.5 2.8 19.5h18.4z" /><line x1="12" y1="9.5" x2="12" y2="14" /><line x1="12" y1="16.6" x2="12" y2="16.7" /></Stroke>;

// A booking made before pickup times existed sits at midnight and means a
// whole day, so it is never drawn at 12am — it is said in words instead.
const timeText = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const whenText = (d, hasTime) => (hasTime === false
  ? new Date(d).toLocaleDateString('en-US', MONTH_DAY)
  : `${new Date(d).toLocaleDateString('en-US', MONTH_DAY)}, ${timeText(d)}`);

const Dashboard = () => {
  usePageTitle('Admin Dashboard');
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [recentBookings, setRecentBookings] = useState([]);
  const [topRatedCars, setTopRatedCars] = useState([]);
  const [revenue, setRevenue] = useState({ week: 0, month: 0, all: 0 });
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [periodDates, setPeriodDates] = useState({ weekStart: '', today: '', monthStart: '' });
  const [loading, setLoading] = useState(true);
  // Today's schedule, the money and the vehicle states — see
  // server/routes/adminStats.js. Null until it lands, so the page can tell
  // "nothing today" from "not asked yet".
  const [today, setToday] = useState(null);
  // Moves the now-line. A minute is as precise as a day's timeline needs.
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return navigate('/login');
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // One small request instead of every booking in the system. The
      // counting, the six-month trend and the top-rated list are all worked
      // out server-side now — see routes/adminStats.js.
      const [{ data }, todayRes] = await Promise.all([
        api.get('/admin/dashboard'),
        // Its own request: the dashboard figures are aggregates over
        // everything, this one is about named bookings on one day.
        api.get('/admin/today').catch(() => null),
      ]);
      if (todayRes) setToday(todayRes.data);
      setRecentBookings(data.recentBookings);
      setTopRatedCars(data.topRatedCars);
      setRevenue(data.revenue);
      setMonthlyTrend(data.monthlyTrend);
      // Spelled out under the figure, so nobody has to guess whether "this
      // month" means the last 30 days or the calendar month.
      setPeriodDates({
        weekStart: new Date(data.periods.weekStart).toLocaleDateString('en-US', MONTH_DAY),
        today: new Date(data.periods.today).toLocaleDateString('en-US', MONTH_DAY_YEAR),
        monthStart: new Date(data.periods.monthStart).toLocaleDateString('en-US', MONTH_DAY_YEAR),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const periodCaption = {
    week: `Confirmed bookings created in the last 7 days · ${periodDates.weekStart} – ${periodDates.today}`,
    month: `Confirmed bookings created since ${periodDates.monthStart}`,
    all: 'Every confirmed booking to date',
  }[revenuePeriod];

  const trendAverage = monthlyTrend.length
    ? monthlyTrend.reduce((sum, m) => sum + m.value, 0) / monthlyTrend.length
    : 0;
  const trendHasValues = monthlyTrend.some((m) => m.value > 0);

  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const rowLine = isDark ? '#303132' : '#eef0f2';
  const thumbBg = isDark ? '#3a3b3c' : '#f1f2f4';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';

  const badgeTone = {
    pending: [isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', isDark ? '#fbbf24' : '#92400e', isDark ? 'rgba(217,119,6,0.35)' : '#fde68a'],
    confirmed: [isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', isDark ? '#86efac' : '#065f46', isDark ? 'rgba(22,163,74,0.35)' : '#a7f3d0'],
    completed: [isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe', isDark ? '#93c5fd' : '#1e40af', isDark ? 'rgba(37,99,235,0.4)' : '#bfdbfe'],
    cancelled: [isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2', isDark ? '#f87171' : '#b91c1c', isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'],
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: text, marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: text2, marginBottom: '24px' },
    stack: { display: 'flex', flexDirection: 'column', gap: '16px' },
    card: { background: isDark ? '#242526' : '#fff', border: `1px solid ${line}`, borderRadius: '12px' },

    revenueCard: { padding: '22px', display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: '36px' },
    boxTitle: { fontSize: '15px', fontWeight: '600', color: text, marginBottom: '4px' },
    boxSubtitle: { fontSize: '12px', color: text2 },
    periodToggleRow: {
      display: 'flex', gap: '4px', padding: '3px', borderRadius: '20px',
      border: `1px solid ${line}`, background: isDark ? '#1e1f20' : '#f8f9fa',
      marginTop: '18px', alignSelf: 'flex-start',
    },
    periodBtn: (active) => ({
      padding: '6px 13px', borderRadius: '20px', border: 'none',
      fontSize: '12px', fontWeight: '600', cursor: 'pointer',
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : text2,
    }),
    revenueNum: {
      fontSize: '40px', fontWeight: '700', letterSpacing: '-0.015em', lineHeight: 1,
      color: goldInk(isDark), marginTop: '22px', fontVariantNumeric: 'tabular-nums',
    },
    revenueCaption: { fontSize: '12px', lineHeight: 1.5, color: text2, marginTop: '10px' },
    // Pinned to the bottom of the column so it reads as a footnote to the
    // whole card rather than another line of the caption.
    revenueFootnote: { marginTop: 'auto', paddingTop: '18px', fontSize: '11px', lineHeight: 1.5, color: text3 },
    chartCol: {
      display: 'flex', flexDirection: 'column', gap: '12px',
      paddingLeft: '36px', borderLeft: `1px solid ${rowLine}`, minWidth: 0,
    },
    chartHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' },
    chartLabel: { fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase', color: text2 },
    chartMeta: { display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: text3 },
    chartAvg: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: text2 },
    chartAvgDash: { display: 'block', width: '18px', borderTop: `1.5px dashed ${text3}` },

    twoCol: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', alignItems: 'stretch' },
    listCard: { padding: '22px', display: 'flex', flexDirection: 'column' },
    smallHead: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '12px', marginBottom: '10px',
    },
    viewAll: { fontSize: '12px', fontWeight: '700', textDecoration: 'none', color: goldInk(isDark), whiteSpace: 'nowrap' },
    // Never red: a quiet month is information, not a warning.
    changeChip: {
      alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px',
      marginTop: '10px', padding: '4px 10px', borderRadius: '20px',
      fontSize: '12px', fontWeight: '700',
      background: isDark ? '#303132' : '#f1f2f4',
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    bookingRow: (last) => ({
      display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr) auto 86px',
      alignItems: 'center', gap: '12px', padding: '11px 0',
      borderBottom: `1px solid ${last ? 'transparent' : rowLine}`,
    }),
    bookingIcon: { width: '30px', height: '30px', background: thumbBg, borderRadius: '6px', flexShrink: 0, overflow: 'hidden' },
    bookingName: { fontSize: '13px', fontWeight: '500', color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    bookingDate: { fontSize: '11px', color: text3 },
    bookingPrice: { fontSize: '13px', fontWeight: '600', color: text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    // Four states, not two. This used to be `confirmed ? green : amber`, so
    // a cancelled booking wore the same badge as one waiting for review.
    badge: (status) => {
      const [bg, fg, bd] = badgeTone[status] || badgeTone.pending;
      return {
        justifySelf: 'end', fontSize: '11px', fontWeight: '600', padding: '3px 10px',
        borderRadius: '20px', background: bg, color: fg, border: `1px solid ${bd}`,
        textTransform: 'capitalize', whiteSpace: 'nowrap',
      };
    },
    topRatedRow: (last) => ({
      display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto',
      alignItems: 'center', gap: '12px', padding: '10px 0',
      borderBottom: `1px solid ${last ? 'transparent' : rowLine}`,
    }),
    topRatedThumb: { width: '44px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: thumbBg, flexShrink: 0 },
    topRatedScore: { minWidth: '100px', fontSize: '12px', color: text3, fontVariantNumeric: 'tabular-nums' },
    topRatedAvg: { fontWeight: '700', color: text },
    // A drawn box rather than a line of grey text, so an empty card still
    // has the shape of the thing that will fill it.
    emptyBox: {
      flex: 1, display: 'grid', placeItems: 'center', minHeight: '200px',
      border: `1px dashed ${line}`, borderRadius: '10px', marginTop: '6px',
      fontSize: '13px', color: text2,
    },
    skelChart: {
      height: '250px', display: 'flex', alignItems: 'flex-end', gap: '36px',
      padding: '0 24px 34px 60px', borderLeft: `1px solid ${rowLine}`,
    },
  
    // ── Today, money, vehicles, waiting (design 1a) ───────────────────
    cardHead: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '14px', marginBottom: '14px',
    },
    h2: { fontSize: '16.5px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: 0 },
    cardSub: { fontSize: '12.5px', color: isDark ? '#8a8d91' : '#6b7280', margin: '3px 0 0' },
    headBtn: {
      display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap',
      minHeight: '36px', padding: '0 14px', borderRadius: '10px', textDecoration: 'none',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e5e8'}`,
      color: isDark ? '#e4e6eb' : '#374151', fontSize: '12.5px', fontWeight: '700',
    },
    todayCard: { padding: '22px 24px' },
    moneyCard: { padding: '22px 24px' },

    overdueRow: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', marginBottom: '12px' },
    overdueLabel: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: isDark ? '#f87171' : '#b91c1c', paddingTop: '11px',
    },
    overdueBox: {
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 13px', borderRadius: '11px',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#991b1b', fontSize: '12.5px', lineHeight: 1.5,
    },
    overdueIcon: { display: 'flex', marginTop: '1px', flexShrink: 0 },
    overdueLink: {
      marginLeft: 'auto', whiteSpace: 'nowrap', fontWeight: '700', textDecoration: 'none',
      color: isDark ? '#fca5a5' : '#991b1b',
    },

    axisRow: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', marginTop: '6px' },
    axis: { display: 'flex', justifyContent: 'space-between' },
    axisTick: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af' },
    laneRow: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', alignItems: 'start', marginTop: '6px' },
    laneLabel: {
      display: 'flex', alignItems: 'center', gap: '7px', paddingTop: '10px',
      fontSize: '12.5px', fontWeight: '700', color: isDark ? '#b0b3b8' : '#4b5563',
    },
    laneTrack: {
      position: 'relative', height: '96px', borderRadius: '10px',
      background: isDark ? '#1e1f20' : '#f8f9fa',
      border: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    hourLine: (left) => ({
      position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: '1px',
      background: isDark ? '#303132' : '#eef0f2',
    }),
    nowLine: (left) => ({
      position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: '2px',
      background: isDark ? GOLD_DARK : GOLD,
    }),
    nowLegend: { fontSize: '11px', color: isDark ? GOLD_DARK : goldInk(isDark), margin: '8px 0 0 134px' },
    chip: (tone, left, dropped) => {
      const tones = {
        gold: {
          bg: isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6',
          line: isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a',
          fg: isDark ? GOLD_DARK : goldInk(isDark),
        },
        blue: {
          bg: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe',
          line: isDark ? 'rgba(37,99,235,0.4)' : '#bfdbfe',
          fg: isDark ? '#93c5fd' : '#1e40af',
        },
        green: {
          bg: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5',
          line: isDark ? 'rgba(22,163,74,0.4)' : '#a7f3d0',
          fg: isDark ? '#86efac' : '#065f46',
        },
        neutral: {
          bg: isDark ? '#303132' : '#f1f2f4',
          line: isDark ? '#3a3b3c' : '#e3e5e8',
          fg: isDark ? '#b0b3b8' : '#4b5563',
        },
      };
      const t = tones[tone];
      const fromRight = left > 66;
      return {
        position: 'absolute',
        ...(fromRight ? { right: `${Math.max(0, 100 - left)}%` } : { left: `${left}%` }),
        top: dropped ? '38px' : '8px',
        width: '168px', maxWidth: 'calc(100% - 8px)', padding: '7px 10px', borderRadius: '9px',
        background: t.bg, border: `1px solid ${t.line}`, color: t.fg,
        textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '1px', overflow: 'hidden',
      };
    },
    chipTime: { fontSize: '11px', fontWeight: '800' },
    chipWho: {
      fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    chipDetail: {
      fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      color: isDark ? '#8a8d91' : '#6b7280',
    },
    emptyLine: { fontSize: '13px', color: isDark ? '#8a8d91' : '#6b7280', margin: '6px 0 0' },

    moneyGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' },
    moneyBlock: {
      padding: '16px', borderRadius: '13px',
      background: isDark ? '#1e1f20' : '#f8f9fa',
      border: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    moneyLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#6b7280',
    },
    moneyNum: {
      fontSize: '24px', fontWeight: '800', marginTop: '6px',
      color: isDark ? '#e4e6eb' : '#1a1a1a', fontVariantNumeric: 'tabular-nums',
    },
    moneyCount: { fontSize: '11.5px', color: isDark ? '#8a8d91' : '#6b7280', marginTop: '2px' },
    moneyRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      paddingTop: '9px', marginTop: '9px', borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    moneyRowMain: { minWidth: 0 },
    moneyRowTop: {
      display: 'block', fontSize: '12.5px', fontWeight: '700',
      color: isDark ? '#e4e6eb' : '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    moneyRowSub: { display: 'block', fontSize: '11px', color: isDark ? '#8a8d91' : '#6b7280' },
    moneyRowAmount: {
      fontSize: '13px', fontWeight: '800', whiteSpace: 'nowrap',
      color: isDark ? '#e4e6eb' : '#1a1a1a', fontVariantNumeric: 'tabular-nums',
    },
    moreLink: {
      display: 'inline-block', marginTop: '10px', fontSize: '12px', fontWeight: '700',
      textDecoration: 'none', color: goldInk(isDark),
    },
    moneyNote: { fontSize: '11px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#9ca3af', margin: '10px 0 0' },

    twoColWide: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' },
    vehicleBar: { display: 'flex', gap: '3px', margin: '4px 0 14px' },
    barSeg: (fill, n) => ({ flex: n, height: '14px', borderRadius: '4px', background: fill }),
    legendRow: {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', textDecoration: 'none',
      borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    legendSwatch: (fill) => ({ width: '11px', height: '11px', borderRadius: '3px', background: fill, flexShrink: 0 }),
    legendText: { minWidth: 0, flex: 1 },
    legendLabel: { display: 'block', fontSize: '13.5px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    legendNames: {
      display: 'block', fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    legendCount: {
      fontSize: '17px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a', fontVariantNumeric: 'tabular-nums',
    },

    waitGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0 18px' },
    waitRow: {
      display: 'flex', alignItems: 'center', gap: '10px', minHeight: '42px', textDecoration: 'none',
      borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    waitLabel: (any) => ({
      flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: any ? '700' : '500',
      color: any ? (isDark ? '#e4e6eb' : '#1a1a1a') : (isDark ? '#8a8d91' : '#6b7280'),
    }),
    // Zero is calm: no fill, no colour, nothing asking to be looked at.
    waitPill: (any) => ({
      minWidth: '22px', padding: '2px 8px', borderRadius: '20px', textAlign: 'center',
      fontSize: '11.5px', fontWeight: '800',
      background: any ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: any ? ON_GOLD : (isDark ? '#8a8d91' : '#9ca3af'),
    }),
    waitChevron: { fontSize: '14px', color: isDark ? '#8a8d91' : '#9ca3af' },
  };

  const thumb = (src) => (src
    ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : null);

  // ── today, worked out for the timeline ──────────────────────────────
  const schedule = today?.schedule || { pickups: [], returns: [], deliveries: [], inspections: [] };
  const overdue = today?.overdue || [];

  const lanes = [
    { key: 'pickups', label: 'Pickups', tone: 'gold', icon: <KeyGlyph />, items: schedule.pickups },
    { key: 'returns', label: 'Returns', tone: 'blue', icon: <ReturnGlyph />, items: schedule.returns },
    { key: 'deliveries', label: 'Deliveries', tone: 'green', icon: <VanGlyph />, items: schedule.deliveries },
    { key: 'inspections', label: 'Inspections', tone: 'neutral', icon: <ClipboardGlyph />, items: schedule.inspections },
  ];

  const daySummary = lanes
    .filter((l) => l.items.length)
    .map((l) => `${l.items.length} ${l.items.length === 1 ? l.label.replace(/s$/, '').toLowerCase() : l.label.toLowerCase()}`)
    .join(' · ') || 'Nothing scheduled';

  // 7am to 7pm unless something falls outside it, in which case the axis
  // stretches rather than quietly dropping the booking off its end.
  const timed = lanes.flatMap((l) => l.items.filter((i) => i.hasTime !== false).map((i) => new Date(i.at).getHours()));
  const firstHour = Math.min(7, ...timed);
  const lastHour = Math.max(19, ...timed);
  const span = Math.max(1, lastHour - firstHour);
  const hours = Array.from({ length: span + 1 }, (unused, i) => firstHour + i);
  const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;

  const pctFor = (d) => {
    const at = new Date(d);
    return ((at.getHours() + at.getMinutes() / 60) - firstHour) / span * 100;
  };
  // Past about two thirds of the day a 168px chip hung off the end of its
  // track, so from there it is hung from its right edge instead and grows
  // backwards into the afternoon it belongs to.
  const chipLeft = (item) => (item.hasTime === false ? 0 : Math.max(0, Math.min(100, pctFor(item.at))));
  // Two chips within about two hours of each other would sit on top of one
  // another, so the later one drops a row.
  const crowded = (items, i) => i > 0 && Math.abs(pctFor(items[i].at) - pctFor(items[i - 1].at)) < (2 / span) * 100;
  const nowPct = (() => {
    const p = pctFor(clock);
    return p >= 0 && p <= 100 ? p : null;
  })();
  const dayCount = (at) => {
    const n = Math.max(1, Math.ceil((clock - new Date(at)) / 86400000));
    return `${n} day${n === 1 ? '' : 's'}`;
  };

  const detailFor = (key, item) => {
    if (key === 'inspections') return item.note || 'Inspection';
    if (key === 'deliveries') {
      return `${item.leg} · ${item.place?.label || 'No address'}${item.place?.km ? ` · ${item.place.km} km` : ''}`;
    }
    if (item.bookingType === 'with-driver') return `With driver${item.driver ? ` · ${item.driver}` : ' · none assigned'}`;
    return item.place ? `Self-drive · ${item.place.label}` : 'Self-drive · collects at the base';
  };

  const allEvents = lanes.flatMap((l) => l.items.map((i) => ({ ...i, key: l.key, label: l.label.replace(/s$/, '') })))
    .sort((a, b) => new Date(a.at) - new Date(b.at));

  // ── money ───────────────────────────────────────────────────────────
  const money = today?.money || {
    dueAtCollection: { rows: [], total: 0 }, charges: { rows: [], total: 0 }, gcash: { rows: [], total: 0 },
  };
  const moneyBlocks = [
    {
      label: 'Balance due at collection',
      ...money.dueAtCollection,
      sub: (r) => `${r.vehicle} · ${whenText(r.at, r.hasTime)}`,
      note: 'Only deposit bookings appear. Anyone who paid in full owes nothing.',
    },
    {
      label: 'Charges not settled',
      ...money.charges,
      sub: (r) => `${r.client}${r.days ? ` · ${r.days} day${r.days === 1 ? '' : 's'} late` : ''}`,
      note: 'Late fees are one day\'s rental per day late.',
    },
    {
      label: 'GCash to confirm',
      ...money.gcash,
      sub: (r) => `Deposit · ${r.vehicle}`,
      note: 'Paid through GCash and not yet confirmed at our end.',
    },
  ];

  // ── vehicles ────────────────────────────────────────────────────────
  const v = today?.vehicles || { out: [], free: [], hidden: [], offRoad: [], expired: [] };
  const vehicleGroups = [
    { key: 'out', label: 'Out on rent', items: v.out, fill: isDark ? GOLD_DARK : GOLD },
    { key: 'free', label: 'Free to book', items: v.free, fill: isDark ? '#22c55e' : '#16a34a' },
    { key: 'hidden', label: 'Hidden', items: v.hidden, fill: isDark ? '#6b7280' : '#9ca3af' },
    { key: 'offRoad', label: 'Off the road', items: v.offRoad, fill: isDark ? '#f59e0b' : '#d97706' },
    { key: 'expired', label: 'Registration expired', items: v.expired, fill: isDark ? '#ef4444' : '#dc2626' },
  ];
  const vehicleTotal = vehicleGroups.reduce((n, g) => n + g.items.length, 0);

  // Against the same stretch of the period before — comparing a half-done
  // month with all of last month says business has collapsed, every month,
  // until the 28th. All Time has nothing to compare against.
  const change = (() => {
    const c = today?.compare;
    if (!c || revenuePeriod === 'all') return null;
    if (revenuePeriod === 'week') {
      return c.week?.pct === null || c.week?.pct === undefined
        ? null
        : { pct: c.week.pct, label: 'the 7 days before' };
    }
    if (c.month?.pct === null || c.month?.pct === undefined) return null;
    const from = new Date(c.month.from).toLocaleDateString('en-US', MONTH_DAY);
    const to = new Date(c.month.to).toLocaleDateString('en-US', MONTH_DAY);
    return { pct: c.month.pct, label: `${from}–${to} (₱${(c.month.previous || 0).toLocaleString()})` };
  })();

  // ── waiting ─────────────────────────────────────────────────────────
  const w = today?.waiting || {};
  const waitingRows = [
    { label: 'Bookings to review', n: w.bookingsToReview || 0, to: '/admin/manage-bookings' },
    { label: 'Refund requests', n: w.refunds || 0, to: '/admin/manage-bookings' },
    { label: 'Reschedule requests', n: w.reschedules || 0, to: '/admin/manage-bookings' },
    { label: 'With-driver trips, no driver', n: w.needsDriver || 0, to: '/admin/manage-bookings' },
    { label: 'Consignment applications', n: w.consignments || 0, to: '/admin/manage-consignments' },
    { label: 'Inspection appointments', n: w.appointments || 0, to: '/admin/appointments' },
    { label: 'Availability requests', n: w.availability || 0, to: '/admin/availability-requests' },
    { label: 'Blocked-date requests', n: w.blockedDates || 0, to: '/admin/availability-requests' },
    { label: 'Registrations expiring', n: w.registrations || 0, to: '/admin/expiring-documents' },
  ];

  return (
    <AdminLayout activePage="Dashboard">
      <h1 style={s.title}>Admin Dashboard</h1>
      <p style={s.subtitle}>Monitor overall platform performance</p>
      {loading ? (
        <div style={s.stack}>
          <div style={{ ...s.card, ...s.todayCard }}>
            <Skeleton height="15px" width="22%" isDark={isDark} style={{ marginBottom: '14px' }} />
            {Array.from({ length: 4 }).map((unused, i) => (
              <Skeleton key={i} height="96px" isDark={isDark} style={{ marginBottom: '6px', borderRadius: '10px' }} />
            ))}
          </div>
          <div style={{ ...s.card, ...s.revenueCard }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton height="15px" width="40%" isDark={isDark} />
              <Skeleton height="12px" width="65%" isDark={isDark} />
              <Skeleton height="30px" width="100%" isDark={isDark} style={{ borderRadius: '20px', marginTop: '10px' }} />
              <Skeleton height="40px" width="70%" isDark={isDark} style={{ marginTop: '14px' }} />
              <Skeleton height="12px" width="90%" isDark={isDark} />
            </div>
            <div style={s.skelChart}>
              {[58, 72, 84, 96, 76, 100].map((h, i) => (
                <div key={i} style={{ flex: 1, maxWidth: '44px', height: `${h}%` }}>
                  <Skeleton height="100%" isDark={isDark} style={{ borderRadius: '6px 6px 0 0' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={s.twoCol}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ ...s.card, ...s.listCard }}>
                <Skeleton height="15px" width="36%" isDark={isDark} style={{ marginBottom: '14px' }} />
                {Array.from({ length: 5 }).map((__, j) => (
                  <Skeleton key={j} height="44px" isDark={isDark} style={{ marginBottom: '8px' }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={s.stack}>
          {/* ── What today needs ───────────────────────────────────── */}
          <section style={{ ...s.card, ...s.todayCard }} aria-labelledby="dash-today">
            <div style={s.cardHead}>
              <div>
                <h2 id="dash-today" style={s.h2}>Today</h2>
                <p style={s.cardSub}>{daySummary}</p>
              </div>
              <Link to="/admin/pickups" className="btn-like" style={s.headBtn}>
                Open Pickup Desk <span aria-hidden="true">→</span>
              </Link>
            </div>

            {overdue.map((o) => (
              <div key={o.id} style={s.overdueRow}>
                <span style={s.overdueLabel}>Overdue</span>
                <div style={s.overdueBox}>
                  <span style={s.overdueIcon}><WarnGlyph /></span>
                  <span>
                    <strong>{o.client}</strong> · {o.vehicle} — due back {whenText(o.at, o.hasTime)}.{' '}
                    <strong>{dayCount(o.at)} late</strong>
                    {o.lateFee > 0 && <> · late fee so far ₱{o.lateFee.toLocaleString()}</>}
                  </span>
                  <Link to="/admin/manage-bookings" style={s.overdueLink}>Open booking</Link>
                </div>
              </div>
            ))}

            {lanes.every((l) => l.items.length === 0) ? (
              <p style={s.emptyLine}>Nothing scheduled today.</p>
            ) : (
              <>
                <div style={s.axisRow}>
                  <span />
                  <div style={s.axis}>
                    {hours.map((h) => (
                      <span key={h} style={s.axisTick}>{hourLabel(h)}</span>
                    ))}
                  </div>
                </div>

                {lanes.map((lane) => (
                  <div key={lane.key} style={s.laneRow}>
                    <span style={s.laneLabel}>{lane.icon} {lane.label}</span>
                    <div style={s.laneTrack}>
                      {hours.map((h) => <span key={h} style={s.hourLine((h - firstHour) / span * 100)} />)}
                      {nowPct !== null && <span style={s.nowLine(nowPct)} aria-hidden="true" />}
                      {lane.items.map((item, i) => (
                        <Link
                          key={`${item.id}-${item.leg || ''}`}
                          to={lane.key === 'inspections' ? '/admin/appointments' : '/admin/manage-bookings'}
                          style={s.chip(lane.tone, chipLeft(item), i % 2 === 1 && crowded(lane.items, i))}
                          aria-label={`${lane.label.replace(/s$/, '')} ${whenText(item.at, item.hasTime)}, ${item.client || item.owner}, ${item.vehicle || 'inspection'}`}
                        >
                          <span style={s.chipTime}>{item.hasTime === false ? 'Time not set' : timeText(item.at)}</span>
                          <span style={s.chipWho}>{(item.client || item.owner)}{item.vehicle ? ` · ${item.vehicle}` : ''}</span>
                          <span style={s.chipDetail}>{detailFor(lane.key, item)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}

                {nowPct !== null && <p style={s.nowLegend}>Now, {timeText(clock)}</p>}
              </>
            )}

            {/* The same day in order, for anybody reading with a screen
                reader: a timeline is a picture of a sequence, and a picture
                is exactly what does not reach them. */}
            <ol className="sr-only">
              {allEvents.map((e) => (
                <li key={`${e.key}-${e.id}`}>
                  {e.label} {whenText(e.at, e.hasTime)} — {e.client || e.owner}{e.vehicle ? `, ${e.vehicle}` : ''}
                </li>
              ))}
            </ol>
          </section>

          {/* ── Money not yet collected ────────────────────────────── */}
          <section style={{ ...s.card, ...s.moneyCard }} aria-labelledby="dash-money">
            <div style={s.cardHead}>
              <div>
                <h2 id="dash-money" style={s.h2}>Money not yet collected</h2>
                <p style={s.cardSub}>Recorded in the system, not yet in hand.</p>
              </div>
            </div>
            <div style={s.moneyGrid}>
              {moneyBlocks.map((block) => (
                <div key={block.label} style={s.moneyBlock}>
                  <div style={s.moneyLabel}>{block.label}</div>
                  <div style={s.moneyNum}>₱{block.total.toLocaleString()}</div>
                  <div style={s.moneyCount}>
                    {block.rows.length === 0 ? 'Nothing outstanding' : `${block.rows.length} ${block.rows.length === 1 ? 'booking' : 'bookings'}`}
                  </div>
                  {block.rows.slice(0, 3).map((r) => (
                    <div key={`${r.id}-${r.kind || ''}`} style={s.moneyRow}>
                      <span style={s.moneyRowMain}>
                        <span style={s.moneyRowTop}>{r.kind ? `${r.kind} · ${r.vehicle}` : r.client}</span>
                        <span style={s.moneyRowSub}>{block.sub(r)}</span>
                      </span>
                      <span style={s.moneyRowAmount}>₱{r.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {block.rows.length > 3 && (
                    <Link to="/admin/manage-bookings" style={s.moreLink}>+{block.rows.length - 3} more →</Link>
                  )}
                  <p style={s.moneyNote}>{block.note}</p>
                </div>
              ))}
            </div>
          </section>

          <div style={s.twoColWide}>
            {/* ── Vehicles right now ──────────────────────────────── */}
            <section style={{ ...s.card, ...s.listCard }} aria-labelledby="dash-vehicles">
              <div style={s.cardHead}>
                <h2 id="dash-vehicles" style={s.h2}>Vehicles right now</h2>
                <span style={s.cardSub}>{vehicleTotal} vehicles</span>
              </div>
              <div
                style={s.vehicleBar}
                role="img"
                aria-label={vehicleGroups.filter((g) => g.items.length).map((g) => `${g.items.length} ${g.label}`).join(', ')}
              >
                {vehicleGroups.filter((g) => g.items.length).map((g) => (
                  <span key={g.key} style={s.barSeg(g.fill, g.items.length)} />
                ))}
              </div>
              {vehicleGroups.map((g) => (
                <Link key={g.key} to="/admin/manage-cars" style={s.legendRow}>
                  <span style={s.legendSwatch(g.fill)} />
                  <span style={s.legendText}>
                    <span style={s.legendLabel}>{g.label}</span>
                    <span style={s.legendNames}>
                      {g.items.length === 0
                        ? 'None'
                        : g.items.slice(0, 3).map((v) => v.name).join(', ')
                          + (g.items.length > 3 ? ` and ${g.items.length - 3} more` : '')}
                    </span>
                  </span>
                  <span style={s.legendCount}>{g.items.length}</span>
                </Link>
              ))}
            </section>

            {/* ── Waiting on a decision ───────────────────────────── */}
            <section style={{ ...s.card, ...s.listCard }} aria-labelledby="dash-waiting">
              <div style={s.cardHead}>
                <h2 id="dash-waiting" style={s.h2}>Waiting on a decision</h2>
                <span style={s.cardSub}>{waitingRows.filter((r) => r.n > 0).length} of {waitingRows.length} need you</span>
              </div>
              <div style={s.waitGrid}>
                {waitingRows.map((r) => (
                  <Link key={r.label} to={r.to} style={s.waitRow}>
                    <span style={s.waitLabel(r.n > 0)}>{r.label}</span>
                    <span style={s.waitPill(r.n > 0)}>{r.n}</span>
                    <span style={s.waitChevron} aria-hidden="true">›</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div style={{ ...s.card, ...s.revenueCard }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={s.boxTitle}>Revenue</div>
              <div style={s.boxSubtitle}>From confirmed bookings</div>
              <div style={s.periodToggleRow} role="group" aria-label="Revenue period">
                <button type="button" style={s.periodBtn(revenuePeriod === 'week')} aria-pressed={revenuePeriod === 'week'} onClick={() => setRevenuePeriod('week')}>This Week</button>
                <button type="button" style={s.periodBtn(revenuePeriod === 'month')} aria-pressed={revenuePeriod === 'month'} onClick={() => setRevenuePeriod('month')}>This Month</button>
                <button type="button" style={s.periodBtn(revenuePeriod === 'all')} aria-pressed={revenuePeriod === 'all'} onClick={() => setRevenuePeriod('all')}>All Time</button>
              </div>
              <div style={s.revenueNum}>₱{revenue[revenuePeriod].toLocaleString()}</div>
              {change && (
                <div style={s.changeChip}>
                  <span aria-hidden="true">{change.pct >= 0 ? '↑' : '↓'}</span>
                  {Math.abs(change.pct)}% vs {change.label}
                </div>
              )}
              <div style={s.revenueCaption}>{periodCaption}</div>
              <div style={s.revenueFootnote}>
                Pending and cancelled bookings are excluded. Amounts in ₱, dates in Philippine time.
              </div>
            </div>
            <div style={s.chartCol}>
              <div style={s.chartHead}>
                <span style={s.chartLabel}>Last 6 months</span>
                <span style={s.chartMeta}>
                  {trendHasValues && (
                    <span style={s.chartAvg}>
                      <span style={s.chartAvgDash} />
                      6-month avg {compactPeso(trendAverage)}
                    </span>
                  )}
                  Confirmed totals by booking date
                </span>
              </div>
              <RevenueTrendChart
                data={monthlyTrend}
                isDark={isDark}
                barColor={isDark ? GOLD_DARK : GOLD}
                barColorHover={isDark ? GOLD : GOLD_DARK}
                detailed
                formatCompact={compactPeso}
                currentLabel="to date"
                emptyMessage="No confirmed bookings in the last 6 months"
              />
            </div>
          </div>

          <div style={s.twoCol}>
            <div style={{ ...s.card, ...s.listCard }}>
              <div style={s.smallHead}>
                <div>
                  <div style={s.boxTitle}>Latest bookings</div>
                  <div style={s.boxSubtitle}>Newest first</div>
                </div>
                <Link to="/admin/manage-bookings" style={s.viewAll}>View all →</Link>
              </div>
              {recentBookings.length === 0 ? (
                <div style={s.emptyBox}>No bookings yet.</div>
              ) : recentBookings.map((b, i) => (
                <div key={b._id} style={s.bookingRow(i === recentBookings.length - 1)}>
                  <div style={s.bookingIcon}>{thumb(b.car?.image)}</div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={s.bookingName}>{b.car?.brand} {b.car?.model}</span>
                    <span style={s.bookingDate}>
                      {new Date(b.createdAt).toLocaleDateString('en-US', MONTH_DAY_YEAR)}
                    </span>
                  </div>
                  <span style={s.bookingPrice}>₱{b.totalPrice.toLocaleString()}</span>
                  <span style={s.badge(b.status)}>{b.status}</span>
                </div>
              ))}
            </div>

            <div style={{ ...s.card, ...s.listCard }}>
              <div style={s.smallHead}>
                <div>
                  <div style={s.boxTitle}>Best-reviewed vehicles</div>
                  <div style={s.boxSubtitle}>By rating, then number of reviews</div>
                </div>
                <Link to="/admin/manage-reviews" style={s.viewAll}>View all →</Link>
              </div>
              {topRatedCars.length === 0 ? (
                <div style={s.emptyBox}>No reviews yet.</div>
              ) : topRatedCars.map((car, i) => (
                <div key={car._id} style={s.topRatedRow(i === topRatedCars.length - 1)}>
                  <div style={s.topRatedThumb}>{thumb(car.image)}</div>
                  <span style={s.bookingName}>{car.brand} {car.model}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StarRating value={car.avgRating} size={13} readOnly />
                    <span style={s.topRatedScore}>
                      <strong style={s.topRatedAvg}>{car.avgRating.toFixed(1)}</strong>
                      {' '}({car.ratingCount} review{car.ratingCount === 1 ? '' : 's'})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Dashboard;
