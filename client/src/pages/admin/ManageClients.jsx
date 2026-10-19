import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonListCard } from '../../components/Skeleton';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { latenessLabel, hoursLate } from '../../utils/lateness';
import api from '../../api';
import { useUIFeedback } from '../../context/UIFeedbackContext';

// The two kinds of people on the other side of a booking: clients, who rent
// vehicles, and owners, who put their own vehicles on the site.
//
// This used to be one table with two tabs, where the same columns meant
// different things depending on which tab you were on, and somebody's whole
// rental history lived in a 600px modal. A renter and a vehicle owner have
// almost nothing in common; they are two lists now, each carrying the facts
// that actually belong to it.

const CLIENT_REASONS = [
  'Returned vehicles late repeatedly',
  'Damaged a vehicle',
  'Unpaid charges',
  'False or invalid documents',
  'Other',
];
const OWNER_REASONS = [
  'Registration papers not renewed',
  'Vehicle condition needs checking',
  'Owner asked to pause',
  'Other',
];

const initialsOf = (name) => {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return ((words[0][0] || '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
};

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// Our own month names rather than the browser's: en-GB says "Sept", and
// every other date in the admin says "Sep".
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const day = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};

// "12 – 13 Oct" when a trip stays inside one month, "30 Sep – 1 Oct" when
// it does not. The month is said once where once is enough.
const dateRange = (startIso, endIso) => {
  const a = new Date(startIso);
  const b = new Date(endIso);
  const left = a.getMonth() === b.getMonth() ? `${a.getDate()}` : `${a.getDate()} ${MON[a.getMonth()]}`;
  const year = b.getFullYear() !== new Date().getFullYear() ? ` ${b.getFullYear()}` : '';
  return `${left} – ${b.getDate()} ${MON[b.getMonth()]}${year}`;
};

const monthKey = (iso) => {
  const d = new Date(iso);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${MONTHS[d.getMonth()]}${year}`;
};

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
  </svg>
);
const ChevronIcon = ({ open }) => (
  <svg
    width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}
  >
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);
const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);
const BanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" /><path d="M3.8 3.8l8.4 8.4" />
  </svg>
);

const ManageClients = () => {
  usePageTitle('Manage Clients');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();

  const [clients, setClients] = useState([]);
  const [owners, setOwners] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  // null means "follow the selection" — the group holding the selected
  // person opens, the other stays shut.
  const [openClients, setOpenClients] = useState(null);
  const [openOwners, setOpenOwners] = useState(null);

  const [step, setStep] = useState(false);
  // So the header's Block button can bring the reason form into view.
  const accountRef = useRef(null);
  const profileRef = useRef(null);

  // Scrolls the profile pane only. scrollIntoView walks every scrollable
  // ancestor, so it took the whole admin page with it — the sidebar and
  // the client list slid away and the form landed half off the bottom.
  const showAccount = () => {
    const pane = profileRef.current;
    const target = accountRef.current;
    if (!pane || !target) return;
    const offset = target.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    pane.scrollTo({ top: pane.scrollTop + offset - 16, behavior: 'smooth' });
  };
  const [reason, setReason] = useState('');
  const [otherText, setOtherText] = useState('');
  const [working, setWorking] = useState(false);

  const fetchData = async () => {
    try {
      const [clientsRes, ownersRes, bookingsRes, carsRes] = await Promise.all([
        api.get('/users'),
        api.get('/users', { params: { role: 'consignor' } }),
        api.get('/bookings/all'),
        api.get('/cars'),
      ]);
      setClients(clientsRes.data);
      setOwners(ownersRes.data);
      setBookings(bookingsRes.data);
      setCars(carsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── what we know about each person ──────────────────────────────────
  const bookingsOf = (userId) => bookings.filter((b) => String(b.user?._id) === String(userId));
  const vehiclesOf = (ownerId) => cars.filter((c) => String(c.owner?._id || c.owner) === String(ownerId));

  const lateness = (b) => {
    if (!b.returnedAt) return 0;
    return hoursLate(b.endDate, b.returnedAt);
  };

  const clientFacts = (c) => {
    const mine = bookingsOf(c._id);
    const finished = mine.filter((b) => b.status === 'completed');
    const late = finished.filter((b) => lateness(b) > 0);
    const lastLate = late.reduce((d, b) => (!d || new Date(b.returnedAt) > new Date(d) ? b.returnedAt : d), null);
    return { all: mine, finished, late, lastLate };
  };

  const ownerFacts = (o) => {
    const mine = vehiclesOf(o._id);
    const ids = new Set(mine.map((c) => String(c._id)));
    const rentals = bookings.filter((b) => ids.has(String(b.car?._id)));
    return {
      vehicles: mine,
      listed: mine.filter((c) => c.isAvailable !== false && !c.archived),
      rentals,
      finished: rentals.filter((b) => b.status === 'completed'),
    };
  };

  // ── the rail ────────────────────────────────────────────────────────
  const matches = (p) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${p.name || ''} ${p.email || ''}`.toLowerCase().includes(needle);
  };

  const clientRows = clients.filter(matches).filter((c) => {
    if (clientFilter === 'blocked') return c.isBlocked;
    if (clientFilter === 'never') return bookingsOf(c._id).length === 0;
    if (clientFilter === 'late') return clientFacts(c).late.length > 0;
    return true;
  });

  const ownerRows = owners.filter(matches).filter((o) => {
    if (ownerFilter === 'hold') return !!o.suspension?.at;
    if (ownerFilter === 'nolist') return ownerFacts(o).listed.length === 0;
    return true;
  });

  const clientLine = (c) => {
    if (c.isBlocked) return { text: 'Blocked', tone: 'red' };
    const { all, finished, late } = clientFacts(c);
    if (!all.length) return { text: 'Never booked', tone: 'quiet' };
    if (!finished.length) {
      return { text: `${all.length} booking${all.length === 1 ? '' : 's'}, none finished`, tone: 'quiet' };
    }
    const trips = `${finished.length} trip${finished.length === 1 ? '' : 's'}`;
    return { text: late.length ? `${trips} · ${late.length} late` : `${trips} · never late`, tone: 'quiet' };
  };

  const ownerLine = (o) => {
    if (o.suspension?.at) return { text: 'Contract on hold', tone: 'plain' };
    const { vehicles, listed } = ownerFacts(o);
    if (!vehicles.length) return { text: 'No vehicles yet', tone: 'quiet' };
    return {
      text: `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} · ${listed.length} listed`,
      tone: 'quiet',
    };
  };

  const selected = [...clients, ...owners].find((p) => String(p._id) === String(selectedId))
    || clientRows[0] || ownerRows[0] || null;
  const isClient = selected ? clients.some((c) => String(c._id) === String(selected._id)) : false;

  const searching = !!q.trim();
  const clientsOpen = searching || (openClients ?? (isClient || !selected));
  const ownersOpen = searching || (openOwners ?? (!!selected && !isClient));

  // ── blocking and holding ────────────────────────────────────────────
  const reasons = isClient ? CLIENT_REASONS : OWNER_REASONS;
  const finalReason = reason === 'Other' ? otherText.trim() : reason;
  const reasonReady = reason && (reason !== 'Other' || otherText.trim().length >= 3);

  const closeStep = () => { setStep(false); setReason(''); setOtherText(''); };

  const applyBlock = async () => {
    setWorking(true);
    try {
      await api.put(`/users/${selected._id}/block`, { blocked: true, reason: finalReason });
      await fetchData();
      closeStep();
      toast.success(`${selected.name} is blocked. You can unblock them from this page any time.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not block this client.');
    } finally {
      setWorking(false);
    }
  };

  const liftBlock = async () => {
    setWorking(true);
    try {
      await api.put(`/users/${selected._id}/block`, { blocked: false });
      await fetchData();
      toast.success(`${selected.name} can book again.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not unblock this client.');
    } finally {
      setWorking(false);
    }
  };

  const applyHold = async () => {
    setWorking(true);
    try {
      await api.put(`/users/${selected._id}/suspend`, { suspended: true, reason: finalReason });
      await fetchData();
      closeStep();
      toast.success(`${selected.name}'s contract is on hold. Their vehicles are off the site.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not put this contract on hold.');
    } finally {
      setWorking(false);
    }
  };

  const liftHold = async () => {
    setWorking(true);
    try {
      await api.put(`/users/${selected._id}/suspend`, { suspended: false });
      await fetchData();
      toast.success(`${selected.name}'s vehicles are back on the site.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not lift this hold.');
    } finally {
      setWorking(false);
    }
  };

  const pickPerson = (id) => { setSelectedId(id); closeStep(); };

  // ── colours ─────────────────────────────────────────────────────────
  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const line2 = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';
  const chip = isDark ? '#303132' : '#f1f2f4';
  const red = isDark ? '#f87171' : '#b91c1c';
  const redBg = isDark ? 'rgba(248,113,113,0.10)' : '#fef2f2';
  const redLine = isDark ? 'rgba(248,113,113,0.45)' : '#f3b4b4';
  const redSolid = isDark ? '#dc2626' : '#c62828';

  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lean = (e) => {
    if (reduced) return;
    const box = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const k = (Math.min(1, length / 40) * 3) / length;
    e.currentTarget.style.transform = `translate(${(dx * k).toFixed(2)}px, ${(dy * k).toFixed(2)}px)`;
  };
  const unlean = (e) => { e.currentTarget.style.transform = ''; };

  const s = {
    title: { margin: 0, fontSize: '26px', fontWeight: '700', color: text },
    lead: { margin: '6px 0 20px', fontSize: '14px', lineHeight: 1.5, color: text2, maxWidth: '760px' },
    // The design is a page that fills the screen with two panes scrolling
    // on their own. Letting the whole page scroll instead took the rail
    // away with it, and a client with 101 bookings ran for metres.
    body: {
      display: 'flex', gap: '20px', alignItems: 'stretch',
      height: 'calc(100vh - 215px)', minHeight: '440px',
    },

    rail: {
      width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0,
      background: card, border: `1px solid ${line}`, borderRadius: '12px', overflow: 'hidden',
    },
    searchWrap: { padding: '12px', borderBottom: `1px solid ${line}` },
    searchBox: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '38px',
      border: `1px solid ${line}`, borderRadius: '8px', background: inset, color: text3,
    },
    searchInput: {
      flex: 1, border: 'none', background: 'transparent', outline: 'none',
      fontSize: '13px', color: text, fontFamily: 'inherit', minWidth: 0,
    },
    list: { flex: 1, minHeight: 0, overflow: 'auto', padding: '8px 8px 12px', display: 'flex', flexDirection: 'column', gap: '4px' },
    groupBtn: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px',
      border: 'none', borderRadius: '8px', background: 'transparent',
      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: text,
    },
    groupLabel: { fontSize: '13px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', color: text },
    groupCount: { marginLeft: 'auto', fontSize: '12px', color: text3 },
    chips: { display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '0 8px 6px' },
    chipBtn: (on) => ({
      display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px',
      border: `1px solid ${on ? goldLine : line}`, background: on ? goldTint : card,
      color: on ? ink : text2, fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
    }),
    personRow: (on) => ({
      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
      border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      background: on ? goldTint : 'transparent',
      boxShadow: on ? `0 0 0 1px ${goldLine}` : 'none',
      color: text,
    }),
    avatarSm: {
      width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%',
      background: gold, color: ON_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: '700',
    },
    photoSm: { width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%', objectFit: 'cover' },
    rowName: { fontSize: '14px', fontWeight: '600', color: text },
    rowFact: (tone) => ({
      fontSize: '12px', color: tone === 'red' ? red : (tone === 'plain' ? text : text3),
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }),
    divider: { height: '1px', margin: '6px 8px', background: line },
    railEmpty: { padding: '8px 8px 12px', fontSize: '13px', lineHeight: 1.5, color: text3 },

    profile: {
      flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto',
      background: card, border: `1px solid ${line}`, borderRadius: '12px', paddingBottom: '8px',
    },
    // The design is drawn on a 1260px canvas. Left to itself on a wide
    // monitor the history spreads its four columns across the whole
    // screen, with a date floating a foot away from the vehicle it
    // belongs to.
    profileInner: { maxWidth: '1100px' },
    pHead: { display: 'flex', gap: '20px', padding: '28px 32px 0', alignItems: 'flex-start' },
    avatarLg: {
      width: '72px', height: '72px', flexShrink: 0, borderRadius: '50%',
      background: gold, color: ON_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '26px', fontWeight: '800',
    },
    photoLg: { width: '72px', height: '72px', flexShrink: 0, borderRadius: '50%', objectFit: 'cover' },
    eyebrow: { fontSize: '12px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase', color: ink },
    pName: { margin: '2px 0 4px', fontSize: '26px', fontWeight: '700', color: text },
    pContact: { fontSize: '14px', color: text2, overflowWrap: 'anywhere' },
    headStatus: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
    statusChip: (kind) => ({
      padding: '5px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap',
      border: `1px solid ${kind === 'blocked' ? redLine : (kind === 'hold' ? text3 : line)}`,
      background: kind === 'blocked' ? redBg : 'transparent',
      color: kind === 'blocked' ? red : (kind === 'hold' ? text : text2),
    }),
    standing: { margin: '20px 32px 0', fontSize: '20px', fontWeight: '600', lineHeight: 1.45, color: text, maxWidth: '720px' },

    facts: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', margin: '20px 32px 0' },
    fact: { background: inset, border: `1px solid ${line}`, borderRadius: '10px', padding: '14px 16px' },
    factLabel: { fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: text3 },
    factValue: (quiet) => ({ fontSize: '24px', fontWeight: '700', color: quiet ? text3 : text, margin: '4px 0 2px' }),
    factSub: { fontSize: '13px', color: text2 },
    privateChip: {
      display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '8px',
      padding: '2px 7px', borderRadius: '6px', background: chip, border: `1px solid ${line}`,
      fontSize: '11px', fontWeight: '700', color: text3,
    },

    section: { margin: '26px 32px 0' },
    h3: { margin: '0 0 12px', fontSize: '15px', fontWeight: '700', color: text },
    vehicleGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' },
    vehicleCard: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      border: `1px solid ${line}`, borderRadius: '10px', padding: '12px 14px',
    },
    vehicleName: { fontSize: '15px', fontWeight: '600', color: text },
    vehicleMeta: { fontSize: '12px', color: text3 },
    vehicleState: (listed) => ({ fontSize: '12px', fontWeight: '700', color: listed ? ink : text3, whiteSpace: 'nowrap' }),

    histHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' },
    histCount: { fontSize: '13px', color: text3 },
    monthRow: {
      display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: '16px',
      padding: '12px 0', borderTop: `1px solid ${line2}`,
    },
    monthLabel: { fontSize: '13px', fontWeight: '700', color: text2, paddingTop: '9px' },
    monthList: { borderLeft: `2px solid ${line}`, paddingLeft: '16px', display: 'flex', flexDirection: 'column' },
    histItem: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) 160px minmax(0, 1fr)',
      gap: '12px', alignItems: 'center', padding: '8px 0', fontSize: '13px', color: text,
    },
    histWho: { fontSize: '12px', color: text3 },
    histDates: { fontSize: '13px', color: text2, whiteSpace: 'nowrap' },
    pill: (kind) => ({
      justifySelf: 'start', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
      background: kind === 'finished' ? chip : (kind === 'upcoming' ? goldTint : 'transparent'),
      border: `1px solid ${kind === 'finished' ? chip : (kind === 'upcoming' ? goldLine : (kind === 'late' ? text3 : line))}`,
      color: kind === 'finished' ? text2 : (kind === 'upcoming' ? ink : (kind === 'late' ? text : text3)),
    }),
    refund: (strong) => ({ fontSize: '13px', color: strong ? text : text3 }),
    histEmpty: { fontSize: '13.5px', lineHeight: 1.6, color: text3, maxWidth: '620px' },

    account: { margin: '24px 32px 32px', paddingTop: '20px', borderTop: `1px solid ${line}`, maxWidth: '560px' },
    accountRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    accountWhat: { fontSize: '14px', fontWeight: '700', color: text },
    accountWhy: { fontSize: '13px', color: text2, marginTop: '2px' },
    outlineBtn: {
      padding: '9px 14px', borderRadius: '8px', border: `1px solid ${line}`, background: card,
      color: text2, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    },
    goldOutline: {
      padding: '9px 14px', borderRadius: '8px', border: `1px solid ${goldLine}`, background: goldTint,
      color: ink, fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
    },
    stepBox: { marginTop: '14px', background: inset, border: `1px solid ${line}`, borderRadius: '10px', padding: '18px' },
    stepTitle: { fontSize: '15px', fontWeight: '700', color: text, marginBottom: '12px' },
    radioRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer', fontSize: '13.5px', color: text },
    ring: (on) => ({
      width: '16px', height: '16px', flexShrink: 0, borderRadius: '50%', boxSizing: 'border-box',
      border: `1px solid ${on ? gold : line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }),
    dot: { width: '6px', height: '6px', borderRadius: '50%', background: gold },
    otherInput: {
      width: '100%', height: '38px', padding: '0 12px', marginTop: '6px', boxSizing: 'border-box',
      border: `1px solid ${line}`, borderRadius: '8px', background: card, color: text,
      fontSize: '13px', fontFamily: 'inherit',
    },
    consequence: { fontSize: '13px', lineHeight: 1.5, color: text2, margin: '12px 0 0' },
    stepBtns: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' },
    danger: (ready) => ({
      padding: '10px 16px', borderRadius: '8px', border: 'none', background: redSolid, color: '#fff',
      fontSize: '13.5px', fontWeight: '700', fontFamily: 'inherit',
      opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed',
    }),
    goldBtn: (ready) => ({
      padding: '10px 16px', borderRadius: '8px', border: 'none', background: gold, color: ON_GOLD,
      fontSize: '13.5px', fontWeight: '700', fontFamily: 'inherit',
      opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'not-allowed',
    }),
    stoppedBox: (blocked) => ({
      background: blocked ? redBg : chip, border: `1px solid ${blocked ? redLine : line}`,
      borderRadius: '10px', padding: '14px 16px', marginBottom: '12px',
    }),
    stoppedWhen: (blocked) => ({
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '14px', fontWeight: '700', color: blocked ? red : text,
    }),
    stoppedWhy: { fontSize: '13px', color: text2, marginTop: '6px' },
    none: { padding: '80px 32px', textAlign: 'center', fontSize: '14px', color: text2 },
  };

  // ── drawing a person ────────────────────────────────────────────────
  const avatarOf = (person, big) => (person.image
    ? <img src={person.image} alt="" style={big ? s.photoLg : s.photoSm} />
    : <span style={big ? s.avatarLg : s.avatarSm}>{initialsOf(person.name)}</span>);

  const personRow = (person, fact) => (
    <button
      key={person._id}
      type="button"
      style={s.personRow(String(person._id) === String(selected?._id))}
      aria-current={String(person._id) === String(selected?._id)}
      aria-label={`${person.name}. ${fact.text}`}
      onClick={() => pickPerson(person._id)}
      onMouseMove={lean}
      onMouseLeave={unlean}
    >
      {avatarOf(person)}
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
        <span style={s.rowName}>{person.name}</span>
        <span style={s.rowFact(fact.tone)}>{fact.text}</span>
      </span>
    </button>
  );

  // ── the history, grouped by month ───────────────────────────────────
  const historyFor = (list, withClient) => {
    const sorted = [...list].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    const months = [];
    for (const b of sorted) {
      const key = monthKey(b.startDate);
      const group = months.find((m) => m.key === key) || { key, items: [] };
      if (!months.includes(group)) months.push(group);
      group.items.push(b);
    }
    return months.map((m) => ({ ...m, withClient }));
  };

  const statusOf = (b) => {
    if (b.status === 'cancelled') return { kind: 'cancelled', label: 'Cancelled' };
    if (b.status === 'completed') {
      const hours = lateness(b);
      if (hours > 0) return { kind: 'late', label: latenessLabel(hours, b.lateFee?.days) };
      return { kind: 'finished', label: 'Finished' };
    }
    return { kind: 'upcoming', label: 'Upcoming' };
  };

  const refundOf = (b) => {
    if (b.refundStatus === 'approved') return { text: `Refunded ${peso(b.refundAmount)}`, strong: true };
    if (b.refundStatus === 'declined') return { text: 'Refund declined', strong: true };
    if (b.status === 'cancelled') return { text: 'No refund due', strong: false };
    if (b.status === 'completed') return { text: 'No refund due', strong: false };
    return { text: 'Paid, not started', strong: false };
  };

  return (
    <AdminLayout activePage="Manage Clients">
      <h1 style={s.title}>Manage Clients</h1>
      <p style={s.lead}>
        Clients rent your vehicles. Vehicle owners list theirs with you.
        Pick a person to see their history and standing.
      </p>

      {loading ? (
        <SkeletonListCard isDark={isDark} count={3} />
      ) : (
        <div style={s.body}>
          <nav aria-label="People" style={s.rail}>
            <div style={s.searchWrap}>
              <label style={s.searchBox} htmlFor="mc-search">
                <SearchIcon />
                <input
                  id="mc-search"
                  style={s.searchInput}
                  value={q}
                  placeholder="Search by name or email"
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
            </div>

            <div style={s.list}>
              <button
                type="button"
                className="list-row-btn"
                style={s.groupBtn}
                aria-expanded={clientsOpen}
                onClick={() => setOpenClients(!clientsOpen)}
              >
                <ChevronIcon open={clientsOpen} />
                <span style={s.groupLabel}>Clients</span>
                <span style={s.groupCount}>{clients.length}</span>
              </button>

              {clientsOpen && (
                <>
                  <div style={s.chips}>
                    {[['all', 'All', clients.length],
                      ['blocked', 'Blocked', clients.filter((c) => c.isBlocked).length],
                      ['never', 'Never booked', clients.filter((c) => bookingsOf(c._id).length === 0).length],
                      ['late', 'Late returns', clients.filter((c) => clientFacts(c).late.length > 0).length],
                    ].map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        className="list-row-btn"
                        style={s.chipBtn(clientFilter === key)}
                        aria-pressed={clientFilter === key}
                        onClick={() => setClientFilter(key)}
                      >
                        {label} <strong>{count}</strong>
                      </button>
                    ))}
                  </div>
                  {clientRows.length === 0 ? (
                    <div style={s.railEmpty}>
                      {q.trim() ? `No client matches “${q.trim()}”.`
                        : clientFilter === 'blocked' ? 'No blocked clients. Everyone here can book.'
                          : clientFilter === 'never' ? 'Everyone here has booked at least once.'
                            : 'No late returns on record.'}
                    </div>
                  ) : clientRows.map((c) => personRow(c, clientLine(c)))}
                </>
              )}

              <div style={s.divider} />

              <button
                type="button"
                className="list-row-btn"
                style={s.groupBtn}
                aria-expanded={ownersOpen}
                onClick={() => setOpenOwners(!ownersOpen)}
              >
                <ChevronIcon open={ownersOpen} />
                <span style={s.groupLabel}>Vehicle owners</span>
                <span style={s.groupCount}>{owners.length}</span>
              </button>

              {ownersOpen && (
                <>
                  <div style={s.chips}>
                    {[['all', 'All', owners.length],
                      ['hold', 'Contract on hold', owners.filter((o) => o.suspension?.at).length],
                      ['nolist', 'No vehicles listed', owners.filter((o) => ownerFacts(o).listed.length === 0).length],
                    ].map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        className="list-row-btn"
                        style={s.chipBtn(ownerFilter === key)}
                        aria-pressed={ownerFilter === key}
                        onClick={() => setOwnerFilter(key)}
                      >
                        {label} <strong>{count}</strong>
                      </button>
                    ))}
                  </div>
                  {ownerRows.length === 0 ? (
                    <div style={s.railEmpty}>
                      {q.trim() ? `No owner matches “${q.trim()}”.`
                        : ownerFilter === 'hold' ? 'No contracts on hold.'
                          : 'Every owner has a vehicle listed.'}
                    </div>
                  ) : ownerRows.map((o) => personRow(o, ownerLine(o)))}
                </>
              )}
            </div>
          </nav>

          <article style={s.profile} ref={profileRef}>
            {!selected ? (
              <div style={s.none}>Nobody to show. Clear the search or pick another filter.</div>
            ) : (
              <div style={s.profileInner}>
                {isClient ? clientProfile(selected) : ownerProfile(selected)}
              </div>
            )}
          </article>
        </div>
      )}
    </AdminLayout>
  );

  // ── the two profiles ────────────────────────────────────────────────
  // `action` is optional: a client's standing can be changed from here,
  // a vehicle owner's cannot.
  function head(person, role, chipKind, chipText, action) {
    return (
      <div style={s.pHead}>
        {avatarOf(person, true)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.eyebrow}>{role}</div>
          <h2 style={s.pName}>{person.name}</h2>
          <div style={s.pContact}>
            {[person.email, person.phone, person.createdAt && `joined ${day(person.createdAt)}`]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
        <div style={s.headStatus}>
          <span style={s.statusChip(chipKind)}>{chipText}</span>
          {action}
        </div>
      </div>
    );
  }

  function fact({ label, value, sub, quiet, children }) {
    return (
      <div style={s.fact}>
        <div style={s.factLabel}>{label}</div>
        <div style={s.factValue(quiet)}>{value}</div>
        <div style={s.factSub}>{sub}</div>
        {children}
      </div>
    );
  }

  function history({ months, emptyText, title, count }) {
    return (
      <div style={s.section}>
        <div style={s.histHead}>
          <h3 style={s.h3}>{title}</h3>
          {count > 0 && <span style={s.histCount}>{plural(count, 'booking')}</span>}
        </div>
        {months.length === 0 ? (
          <p style={s.histEmpty}>{emptyText}</p>
        ) : months.map((m) => (
          <div key={m.key} style={s.monthRow}>
            <div style={s.monthLabel}>{m.key}</div>
            <div style={s.monthList}>
              {m.items.map((b) => {
                const state = statusOf(b);
                const money = refundOf(b);
                return (
                  <div key={b._id} style={s.histItem}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: '600' }}>{b.car?.brand} {b.car?.model}</span>
                      {m.withClient && <span style={{ ...s.histWho, display: 'block' }}>Rented by {b.user?.name || 'someone'}</span>}
                    </span>
                    <span style={s.histDates}>{dateRange(b.startDate, b.endDate)}</span>
                    <span style={s.pill(state.kind)}>{state.label}</span>
                    <span style={s.refund(money.strong)}>{money.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function reasonStep({ title, onConfirm, confirmLabel, danger, consequence }) {
    return (
      <div style={s.stepBox}>
        <div style={s.stepTitle}>{title}</div>
        {reasons.map((r) => (
          <label key={r} style={s.radioRow}>
            <input
              type="radio"
              name="mc-reason"
              className="sr-only"
              checked={reason === r}
              onChange={() => setReason(r)}
            />
            <span style={s.ring(reason === r)}>{reason === r && <span style={s.dot} />}</span>
            {r}
          </label>
        ))}
        {reason === 'Other' && (
          <input
            style={s.otherInput}
            value={otherText}
            placeholder="Say why in a few words"
            onChange={(e) => setOtherText(e.target.value)}
          />
        )}
        <p style={s.consequence}>{consequence}</p>
        <div style={s.stepBtns}>
          <button type="button" style={s.outlineBtn} onClick={closeStep}>Cancel</button>
          <button
            type="button"
            style={danger ? s.danger(reasonReady && !working) : s.goldBtn(reasonReady && !working)}
            disabled={!reasonReady || working}
            onClick={onConfirm}
          >
            {working ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    );
  }

  function clientProfile(person) {
    const { all, finished, late, lastLate } = clientFacts(person);
    const rated = (person.ratingCount || 0) > 0;

    const cancelled = all.filter((b) => b.status === 'cancelled');
    const standing = !all.length
      ? `Hasn't booked yet. Joined ${day(person.createdAt)}.`
      : !finished.length
        ? `${all.length === 1 ? 'One booking' : plural(all.length, 'booking')}, ${cancelled.length === all.length
          ? (all.length === 1 ? 'cancelled' : 'all cancelled')
          : 'none finished yet'}. No finished trips so far.`
        : `Finished ${finished.length} of ${plural(all.length, 'booking')}. ${late.length
          ? `Returned late ${late.length} time${late.length === 1 ? '' : 's'}, most recently on ${day(lastLate)}.`
          : 'Every trip came back on time.'}`;

    return (
      <>
        {head(
          person,
          'Client',
          person.isBlocked ? 'blocked' : 'plain',
          person.isBlocked ? 'Blocked' : 'Can book',
          person.isBlocked ? (
            <button type="button" style={s.goldOutline} disabled={working} onClick={liftBlock}>Unblock</button>
          ) : (
            // Blocking asks why first, and that form belongs next to the
            // sentence saying what blocking does — so this opens it and
            // takes you there, rather than moving the form up here and
            // leaving the explanation behind.
            <button
              type="button"
              style={s.outlineBtn}
              onClick={() => { setStep(true); showAccount(); }}
            >
              Block this client ›
            </button>
          ),
        )}
        <p style={s.standing}>{standing}</p>

        <div style={s.facts}>
          {fact({
            label: 'Trips finished',
            value: finished.length || 'None',
            quiet: !finished.length,
            sub: all.length ? `of ${plural(all.length, 'booking')}` : "Hasn't booked yet",
          })}
          {fact({
            label: 'Late returns',
            // "Never" is a different answer from "None": one means they
            // brought everything back on time, the other that there is
            // nothing to judge them on yet.
            value: !finished.length ? 'None' : (late.length || 'Never'),
            quiet: !late.length,
            sub: !finished.length ? 'No finished trips to judge'
              : late.length ? `Last on ${day(lastLate)}` : 'Every trip back on time',
          })}
          {fact({
            label: 'Rating',
            value: rated ? (person.avgRating || 0).toFixed(1) : 'None',
            quiet: !rated,
            sub: rated ? `out of 5, from ${person.ratingCount} rental${person.ratingCount === 1 ? '' : 's'}` : 'Not rated yet',
            children: <span style={s.privateChip}><LockIcon />Private · admin only</span>,
          })}
        </div>

        {history({
          title: 'Rental history',
          count: all.length,
          months: historyFor(all, false),
          emptyText: `No bookings yet. ${person.name} joined on ${day(person.createdAt)} and hasn't rented a vehicle.`,
        })}

        <div style={s.account} ref={accountRef}>
          <h3 style={s.h3}>Account</h3>
          {person.isBlocked ? (
            // No Unblock button here any more: it sits beside the chip it
            // changes, at the top. This says what the block means.
            <div style={s.stoppedBox(true)}>
              <div style={s.stoppedWhen(true)}><BanIcon />Blocked since {day(person.blockedAt) || 'earlier'}</div>
              {person.blockReason && <div style={s.stoppedWhy}>Reason: {person.blockReason}</div>}
              <div style={s.stoppedWhy}>
                They can&apos;t make new bookings until you unblock them. Bookings they already have still go ahead.
              </div>
            </div>
          ) : step ? (
            reasonStep({
              title: `Why block ${person.name}?`,
              confirmLabel: `Block ${person.name}`,
              danger: true,
              onConfirm: applyBlock,
              consequence: "They won't be able to make new bookings until you unblock them. Bookings they already have still go ahead. The reason is kept with the block.",
            })
          ) : (
            <div style={s.accountRow}>
              <div>
                <div style={s.accountWhat}>Can book</div>
                <div style={s.accountWhy}>Not blocked. New bookings are allowed.</div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  function ownerProfile(person) {
    const { vehicles, listed, rentals, finished } = ownerFacts(person);
    const onHold = !!person.suspension?.at;

    const standing = !vehicles.length
      ? `No vehicles with us yet. Joined ${day(person.createdAt)}.`
      : `${vehicles.length === 1 ? 'One vehicle' : plural(vehicles.length, 'vehicle')} with us, `
        + `${onHold ? 'off the site while the contract is on hold' : `${listed.length} listed`}. `
        + (finished.length ? `${plural(finished.length, 'finished trip')} so far.` : 'No rentals yet.');

    return (
      <>
        {head(person, 'Vehicle owner', onHold ? 'hold' : 'plain', onHold ? 'Contract on hold' : 'Contract active')}
        <p style={s.standing}>{standing}</p>

        <div style={s.facts}>
          {fact({
            label: 'Vehicles with us',
            value: vehicles.length || 'None',
            quiet: !vehicles.length,
            sub: vehicles.length ? (vehicles.length === 1 ? 'One vehicle on contract' : 'On contract') : "Hasn't added one yet",
          })}
          {fact({
            label: 'Listed now',
            value: listed.length,
            quiet: !listed.length,
            sub: onHold ? 'Off the site while on hold'
              : !vehicles.length ? 'Nothing to list'
                : listed.length === vehicles.length ? 'All bookable' : `${vehicles.length - listed.length} not listed`,
          })}
          {fact({
            label: 'Trips on them',
            value: finished.length || 'None',
            quiet: !finished.length,
            sub: finished.length ? 'Finished rentals' : 'No rentals yet',
          })}
        </div>

        {vehicles.length > 0 && (
          <div style={s.section}>
            <h3 style={s.h3}>Their vehicles</h3>
            <div style={s.vehicleGrid}>
              {vehicles.map((v) => {
                const trips = rentals.filter((b) => String(b.car?._id) === String(v._id) && b.status === 'completed').length;
                const isListed = v.isAvailable !== false && !v.archived;
                return (
                  <div key={v._id} style={s.vehicleCard}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ ...s.vehicleName, display: 'block' }}>{v.brand} {v.model}</span>
                      <span style={s.vehicleMeta}>{v.plateNumber || 'No plate'} · {trips} trip{trips === 1 ? '' : 's'}</span>
                    </span>
                    <span style={s.vehicleState(isListed)}>
                      {onHold ? 'Off the site' : (isListed ? 'Listed' : 'Not listed')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {history({
          title: 'Rentals of their vehicles',
          count: rentals.length,
          months: historyFor(rentals, true),
          emptyText: vehicles.length
            ? 'Nobody has rented their vehicles yet.'
            : `No vehicles with us yet, so no rentals. ${person.name} joined on ${day(person.createdAt)}.`,
        })}

        <div style={s.account}>
          <h3 style={s.h3}>Contract</h3>
          {onHold ? (
            <>
              <div style={s.stoppedBox(false)}>
                <div style={s.stoppedWhen(false)}>On hold since {day(person.suspension.at)}</div>
                {person.suspension.reason && <div style={s.stoppedWhy}>Reason: {person.suspension.reason}</div>}
                <div style={s.stoppedWhy}>
                  Their vehicles are off the site until you lift the hold. Bookings already made still go ahead.
                </div>
              </div>
              <button type="button" style={s.goldOutline} disabled={working} onClick={liftHold}>Lift hold</button>
            </>
          ) : step ? (
            reasonStep({
              title: `Why put ${person.name}'s contract on hold?`,
              confirmLabel: 'Put on hold',
              onConfirm: applyHold,
              consequence: 'Their vehicles come off the site until you lift the hold. Bookings already made still go ahead.',
            })
          ) : (
            <div style={s.accountRow}>
              <div>
                <div style={s.accountWhat}>Contract active</div>
                <div style={s.accountWhy}>Their listed vehicles can be booked.</div>
              </div>
              <button type="button" style={s.outlineBtn} onClick={() => setStep(true)}>Put contract on hold ›</button>
            </div>
          )}
        </div>
      </>
    );
  }
};

export default ManageClients;
