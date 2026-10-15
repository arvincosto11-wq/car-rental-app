import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import Skeleton from '../../components/Skeleton';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { formatPhDate } from '../../utils/phTime';
import api from '../../api';
import {
  RANGES, RANGE_LABELS, rangeFor, moneyOverTime, extraCharges, cancellations,
  vehicleStates, vehicleEarnings, demand, clients, operations,
  DOW, TRIP_BUCKETS,
} from '../../utils/analytics';

// The eight things somebody opens this page to find out. The rail asks
// them in those words and answers each one before it is clicked, so the
// page is readable without opening anything.
const QUESTIONS = [
  ['money', 'Is money coming in?'],
  ['extras', 'What’s charged beyond the rental?'],
  ['cancel', 'How many bookings fall through?'],
  ['states', 'What state are the vehicles in?'],
  ['vehicles', 'Which vehicles earn nothing?'],
  ['demand', 'When, how early, how long?'],
  ['clients', 'Who comes back?'],
  ['ops', 'What’s costing us a day’s rental?'],
];

const KICKERS = {
  money: '01 · Money over time',
  extras: '02 · Money beyond the rental',
  cancel: '03 · Cancellations',
  states: '04 · Vehicle states',
  vehicles: '05 · Earnings by vehicle',
  demand: '06 · Demand',
  clients: '07 · Clients',
  ops: '08 · What it costs us',
};

// The rail speaks in sentences, so it needs the whole word: "Fris are
// busiest" is a chart label pretending to be English.
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "same day ahead" is not a thing anybody says.
const leadPhrase = (i) => [
  'on the day of pickup', '1 to 2 days ahead', '3 to 7 days ahead',
  '8 to 14 days ahead', '2 to 4 weeks ahead', 'over a month ahead',
][i] || 'ahead';

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;
const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="12" height="11" rx="1.5" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
  </svg>
);

const TickIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M5.5 8.2l1.7 1.7 3.3-3.6" />
  </svg>
);

const Analytics = () => {
  usePageTitle('Analytics');
  const { isDark } = useTheme();
  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('three');
  const [question, setQuestion] = useState('money');
  const [now] = useState(() => new Date());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [carsRes, bookingsRes, rulesRes] = await Promise.all([
          api.get('/cars'),
          api.get('/bookings/all'),
          api.get('/long-rental-discounts'),
        ]);
        setCars(carsRes.data);
        setBookings(bookingsRes.data);
        setRules(rulesRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── colours ─────────────────────────────────────────────────────────
  const page = isDark ? '#18191a' : '#f4f5f6';
  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const line2 = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const chip = isDark ? '#303132' : '#f1f2f4';
  const neutral = isDark ? '#6b7280' : '#9ca3af';
  const amber = isDark ? '#fbbf24' : '#92400e';
  const amberBg = isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7';
  // Money promised but not yet in hand is drawn as gold hatching: the same
  // colour as money collected, visibly not solid.
  const hatch = isDark
    ? 'repeating-linear-gradient(135deg, rgba(232,161,0,0.38) 0 4px, rgba(232,161,0,0.1) 4px 8px)'
    : 'repeating-linear-gradient(135deg, #f3dfa8 0 4px, #fbf1d6 4px 8px)';

  // ── the figures ─────────────────────────────────────────────────────
  const earliest = useMemo(() => bookings.reduce(
    (min, b) => (!min || new Date(b.createdAt) < new Date(min) ? b.createdAt : min), null,
  ), [bookings]);

  const r = useMemo(() => rangeFor(range, now, earliest), [range, now, earliest]);
  // The shortest rule the office has set is where longer-rental discounts
  // begin. No rules, no striped bars.
  const discountFrom = rules.length ? Math.min(...rules.map((x) => x.minDays)) : null;

  const money = useMemo(() => moneyOverTime(bookings, r), [bookings, r]);
  const extras = useMemo(() => extraCharges(bookings, r), [bookings, r]);
  const fell = useMemo(() => cancellations(bookings, r), [bookings, r]);
  const states = useMemo(() => vehicleStates(cars, bookings, now), [cars, bookings, now]);
  const earnings = useMemo(() => vehicleEarnings(cars, bookings, r, now), [cars, bookings, r, now]);
  const shape = useMemo(() => demand(bookings, r, discountFrom), [bookings, r, discountFrom]);
  const who = useMemo(() => clients(bookings, r), [bookings, r]);
  const ops = useMemo(() => operations(bookings, r, now), [bookings, r, now]);

  const busiestDay = shape.byDay.indexOf(Math.max(...shape.byDay));
  const commonLead = shape.byLead.indexOf(Math.max(...shape.byLead));

  // Every headline is a sentence, so the rail answers its own question.
  const headlines = {
    money: money.revenue
      ? `${peso(money.revenue)} in rental, ${peso(money.due)} still to come in`
      : 'No rental revenue in this range',
    extras: extras.total
      ? `${peso(extras.total)} in extra charges, ${peso(extras.unsettled)} not yet settled`
      : 'No extra charges in this range',
    cancel: fell.made
      ? `${fell.cancelled} of ${fell.made} bookings were cancelled (${pct(fell.cancelled, fell.made)})`
      : 'No bookings were made in this range',
    states: `${states.out.length} out with clients, ${states.unlisted.length + states.offRoad.length + states.expired.length} can’t be booked right now`,
    vehicles: earnings.idle
      ? `${earnings.idle} of ${cars.length} vehicles earned nothing`
      : 'Every vehicle earned something',
    demand: shape.total
      ? `${DAYS_FULL[busiestDay]}s are busiest; most book ${leadPhrase(commonLead)}`
      : 'No pickups in this range',
    clients: who.booked
      ? `${plural(who.booked, 'client')} booked, ${who.returning} came back`
      : 'No clients booked in this range',
    ops: ops.late
      ? `${plural(ops.late, 'late return')} and ${plural(ops.extensions, 'extension')}`
      : `No late returns, ${plural(ops.extensions, 'extension')}`,
  };

  const spanLabel = r.start
    ? `${formatPhDate(r.start, { day: 'numeric', month: 'short' })} – ${formatPhDate(now, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `Everything up to ${formatPhDate(now, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const s = {
    head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' },
    title: { margin: 0, fontSize: '26px', fontWeight: '700', color: text },
    subtitle: { margin: '6px 0 0', fontSize: '14px', color: text2 },
    rangeGroup: { display: 'flex', gap: '4px', padding: '4px', background: card, border: `1px solid ${line}`, borderRadius: '10px' },
    rangeBtn: (on) => ({
      border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '7px',
      font: 'inherit', fontSize: '13px', fontWeight: '600',
      background: on ? gold : 'transparent', color: on ? ON_GOLD : text2,
    }),
    meta: {
      display: 'flex', alignItems: 'center', gap: '10px 18px', flexWrap: 'wrap',
      fontSize: '13px', color: text2, margin: '20px 0',
    },
    metaSpan: { display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: text },
    metaQuiet: { color: text3 },

    wrap: { display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '20px', alignItems: 'start' },
    rail: {
      display: 'flex', flexDirection: 'column', gap: '4px', background: card,
      border: `1px solid ${line}`, borderRadius: '12px', padding: '8px', position: 'sticky', top: '16px',
    },
    railBtn: (on) => ({
      textAlign: 'left', cursor: 'pointer', font: 'inherit', padding: '12px 14px', borderRadius: '8px',
      border: `1px solid ${on ? (isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a') : 'transparent'}`,
      background: on ? (isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6') : 'transparent',
      display: 'flex', flexDirection: 'column', gap: '4px',
    }),
    railQ: { fontSize: '14px', fontWeight: '600', color: text },
    railA: { fontSize: '12px', lineHeight: 1.4, color: text3 },

    panel: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px', padding: '32px',
      minHeight: '560px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0,
    },
    kicker: { fontSize: '11px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase', color: ink },
    headline: { margin: 0, fontSize: '26px', fontWeight: '700', lineHeight: 1.25, color: text, textWrap: 'pretty' },
    counts: { margin: 0, fontSize: '13px', lineHeight: 1.5, color: text3, textWrap: 'pretty' },
    body: { display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 },

    figures: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
    figure: { display: 'flex', flexDirection: 'column', gap: '2px' },
    figureLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: text3 },
    figureNum: { fontSize: '24px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: text },
    swatch: (fill, dashed) => ({
      width: '10px', height: '10px', borderRadius: '2px', background: fill,
      border: dashed ? `1px dashed ${gold}` : 'none', boxSizing: 'border-box',
    }),

    columns: { display: 'flex', alignItems: 'flex-end', gap: '14px', minHeight: '210px' },
    column: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 },
    columnStack: { display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', maxWidth: '72px' },
    columnLabel: { fontSize: '12px', color: text3, whiteSpace: 'nowrap' },
    columnValue: { fontSize: '12px', fontWeight: '600', color: text2, fontVariantNumeric: 'tabular-nums' },

    splitRow: { display: 'flex', flexDirection: 'column', gap: '8px' },
    splitHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' },
    splitName: { fontSize: '14px', fontWeight: '600', color: text },
    splitDesc: { fontSize: '12px', color: text3 },
    splitTotal: { fontSize: '15px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: text },
    splitBar: { display: 'flex', gap: '2px', height: '12px' },
    legend: { display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: text2 },
    legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },

    emptyRow: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px',
      border: `1px dashed ${line}`, borderRadius: '8px', fontSize: '13px', color: text3,
    },
    note: { margin: 0, fontSize: '13px', lineHeight: 1.5, color: text2, textWrap: 'pretty' },

    tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' },
    tile: { background: inset, borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '2px' },
    tileLabel: { fontSize: '12px', color: text3 },
    tileNum: (tone) => ({ fontSize: '22px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: tone === 'amber' ? amber : text }),
    tileSub: { fontSize: '12px', lineHeight: 1.4, color: text2 },

    stateRow: { display: 'grid', gridTemplateColumns: '150px 40px minmax(0, 1fr)', gap: '12px', alignItems: 'baseline', padding: '8px 0', borderTop: `1px solid ${line2}` },
    stateName: { fontSize: '13px', fontWeight: '600', color: text },
    stateNum: { fontSize: '18px', fontWeight: '700', fontVariantNumeric: 'tabular-nums', color: text, textAlign: 'right' },
    stateWho: { fontSize: '12px', color: text3 },
    segmentBar: { display: 'flex', gap: '2px', height: '14px' },

    tableHead: {
      display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 56px minmax(0,1.6fr) 100px 96px', gap: '12px',
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: text3, paddingBottom: '8px', borderBottom: `1px solid ${line2}`,
    },
    tableRow: {
      display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) 56px minmax(0,1.6fr) 100px 96px', gap: '12px',
      alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${line2}`, fontSize: '13px', color: text,
    },
    vehName: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
    consignorChip: {
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: '5px', background: chip, color: text3, whiteSpace: 'nowrap',
    },
    reasonChip: (bad) => ({
      fontSize: '11.5px', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap',
      background: bad ? amberBg : chip, color: bad ? amber : text3,
    }),
    track: { flex: 1, height: '8px', borderRadius: '4px', background: chip, overflow: 'hidden' },
    fill: (width, colour) => ({ display: 'block', width, height: '100%', background: colour, borderRadius: '4px' }),
    right: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
    chips: { display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: text2 },

    chartRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '22px' },
    chartTitle: { fontSize: '13px', fontWeight: '700', color: text, marginBottom: '10px' },
    bars: { display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px' },
    barCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0 },
    barLabel: { fontSize: '11px', color: text3, whiteSpace: 'nowrap' },
    barValue: { fontSize: '11px', fontWeight: '600', color: text2, fontVariantNumeric: 'tabular-nums' },
    amberLine: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px',
      background: amberBg, color: amber, borderRadius: '8px', fontSize: '13px', fontWeight: '600',
    },
    privateChip: {
      display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700',
      padding: '3px 8px', borderRadius: '6px', background: chip, color: text3,
    },
  };

  // ── small drawing helpers ───────────────────────────────────────────
  const Empty = ({ children }) => (
    <div style={s.emptyRow}><TickIcon />{children}</div>
  );

  // A bar split into parts that each carry their own fill. Used wherever
  // one total divides into two or three states.
  const Split = ({ parts }) => {
    const total = parts.reduce((sum, p) => sum + p.value, 0);
    if (total <= 0) return null;
    return (
      <div style={s.splitBar}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <div
            key={p.label}
            style={{
              width: `${(p.value / total) * 100}%`,
              background: p.fill,
              border: p.dashed ? `1px dashed ${gold}` : 'none',
              borderRadius: '3px',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>
    );
  };

  const Legend = ({ parts }) => (
    <div style={s.legend}>
      {parts.map((p) => (
        <span key={p.label} style={s.legendItem}>
          <span style={s.swatch(p.fill, p.dashed)} />
          <strong style={{ color: text, fontVariantNumeric: 'tabular-nums' }}>{p.display ?? p.value}</strong>
          {p.label}
        </span>
      ))}
    </div>
  );

  // The tallest bar is solid; the rest are outlined, so the shape reads
  // before any number does.
  const BarChart = ({ title, values, labels, note, hatchFrom = null }) => {
    const max = Math.max(1, ...values);
    return (
      <div>
        <div style={s.chartTitle}>{title}</div>
        <div style={s.bars}>
          {values.map((n, i) => (
            <div key={labels[i]} style={s.barCol}>
              <span style={s.barValue}>{n || ''}</span>
              <div
                style={{
                  width: '100%',
                  height: `${(n / max) * 86}px`,
                  minHeight: n > 0 ? '3px' : '0',
                  borderRadius: '4px 4px 0 0',
                  background: hatchFrom !== null && i >= hatchFrom
                    ? hatch
                    : (n === max ? gold : 'transparent'),
                  border: hatchFrom !== null && i >= hatchFrom
                    ? `1px dashed ${gold}`
                    : (n === max ? 'none' : `1px solid ${gold}`),
                  boxSizing: 'border-box',
                }}
              />
              <span style={s.barLabel}>{labels[i]}</span>
            </div>
          ))}
        </div>
        <p style={{ ...s.note, marginTop: '10px' }}>{note}</p>
      </div>
    );
  };

  // ── the eight panels ────────────────────────────────────────────────
  const panels = {
    money: () => (
      <>
        <p style={s.counts}>
          Rental charges on confirmed and completed bookings, by pickup date.
          Still to come is the balance nobody has paid yet.
        </p>
        <div style={s.body}>
          <div style={s.figures}>
            <div style={s.figure}>
              <span style={s.figureLabel}>Rental revenue</span>
              <span style={s.figureNum}>{peso(money.revenue)}</span>
            </div>
            <div style={s.figure}>
              <span style={s.figureLabel}><span style={s.swatch(gold)} />Collected</span>
              <span style={s.figureNum}>{peso(money.collected)}</span>
            </div>
            <div style={s.figure}>
              <span style={s.figureLabel}><span style={s.swatch(hatch, true)} />Still to come</span>
              <span style={s.figureNum}>{peso(money.due)}</span>
            </div>
          </div>

          {money.columns.length === 0 ? (
            <Empty>No pickups in this range, so nothing was earned.</Empty>
          ) : (
            <>
              <div style={s.columns}>
                {money.columns.map((c) => {
                  const max = Math.max(...money.columns.map((x) => x.revenue), 1);
                  const collected = Math.round(((c.revenue - c.due) / max) * 170);
                  const due = Math.round((c.due / max) * 170);
                  return (
                    <div key={c.key} style={s.column}>
                      <span style={s.columnValue}>{peso(c.revenue)}</span>
                      <div style={s.columnStack}>
                        {due > 0 && (
                          <div style={{ height: `${due}px`, background: hatch, border: `1px dashed ${gold}`, borderRadius: '4px 4px 0 0', boxSizing: 'border-box' }} />
                        )}
                        <div style={{ height: `${collected}px`, background: gold, borderRadius: due > 0 ? 0 : '4px 4px 0 0' }} />
                      </div>
                      <span style={s.columnLabel}>{columnLabel(c.key)}</span>
                    </div>
                  );
                })}
              </div>
              <p style={s.note}>{money.byWeek ? 'By week of pickup' : 'By month of pickup'}</p>
            </>
          )}
        </div>
      </>
    ),

    extras: () => (
      <>
        <p style={s.counts}>Charged at return, on top of the rental. Settled means paid.</p>
        <div style={s.body}>
          <div style={s.figures}>
            <div style={s.figure}>
              <span style={s.figureLabel}><span style={s.swatch(gold)} />Settled</span>
              <span style={s.figureNum}>{peso(extras.settled)}</span>
            </div>
            <div style={s.figure}>
              <span style={s.figureLabel}><span style={s.swatch(hatch, true)} />Unsettled</span>
              <span style={s.figureNum}>{peso(extras.unsettled)}</span>
            </div>
          </div>

          {extras.rows.map((row) => (
            <div key={row.key} style={s.splitRow}>
              <div style={s.splitHead}>
                <span style={{ minWidth: 0 }}>
                  <span style={s.splitName}>{row.label}</span>
                  <span style={{ ...s.splitDesc, display: 'block' }}>{chargeDesc(row.key)}</span>
                </span>
                <span style={s.splitTotal}>{peso(row.total)}</span>
              </div>
              {row.total > 0 ? (
                <>
                  <Split parts={[
                    { label: 'settled', value: row.settled, fill: gold },
                    { label: 'unsettled', value: row.unsettled, fill: hatch, dashed: true },
                  ]} />
                  <span style={s.splitDesc}>
                    {peso(row.settled)} settled · {peso(row.unsettled)} still owed
                  </span>
                </>
              ) : (
                <Empty>No {row.label.toLowerCase()} charged in this range.</Empty>
              )}
            </div>
          ))}

          <p style={s.note}>
            {extras.total
              ? `Rental ${peso(money.revenue)} plus extras ${peso(extras.total)}: extras add ${pct(extras.total, money.revenue)} on top of the rental.`
              : 'Nothing was charged on top of the rental in this range.'}
          </p>
        </div>
      </>
    ),

    cancel: () => (
      <>
        <p style={s.counts}>
          Counted by the day the booking was taken, and the only panel that
          includes cancelled bookings.
        </p>
        <div style={s.body}>
          {fell.made === 0 ? (
            <Empty>No bookings were taken in this range.</Empty>
          ) : (
            <>
              <div style={s.splitRow}>
                <div style={s.splitHead}>
                  <span style={s.splitName}>Every booking taken</span>
                  <span style={s.splitTotal}>{fell.made}</span>
                </div>
                <Split parts={[
                  { label: 'kept', value: fell.kept, fill: gold },
                  { label: 'cancelled', value: fell.cancelled, fill: neutral },
                ]} />
                <Legend parts={[
                  { label: 'kept', value: fell.kept, fill: gold },
                  { label: 'cancelled', value: fell.cancelled, fill: neutral },
                ]} />
              </div>

              <div style={s.splitRow}>
                <div style={s.splitHead}>
                  <span style={s.splitName}>Of those cancelled, what happened to the money</span>
                  <span style={s.splitTotal}>{fell.cancelled}</span>
                </div>
                {fell.cancelled === 0 ? (
                  <Empty>Nothing was cancelled in this range.</Empty>
                ) : (
                  <>
                    <Split parts={[
                      { label: 'refunded', value: fell.refunded, fill: gold },
                      { label: 'kept', value: fell.notRefunded, fill: hatch, dashed: true },
                      { label: 'nothing paid', value: fell.nothingPaid, fill: neutral },
                    ]} />
                    <Legend parts={[
                      { label: 'refunded', value: fell.refunded, fill: gold },
                      { label: 'money kept', value: fell.notRefunded, fill: hatch, dashed: true },
                      { label: 'never paid for', value: fell.nothingPaid, fill: neutral },
                    ]} />
                  </>
                )}
              </div>

              <p style={s.note}>
                {pct(fell.cancelled, fell.made)} of bookings taken in this range were called off.
                Whether a booking was called off before or after the office confirmed it is not
                recorded, so that split is not shown rather than guessed at.
              </p>
            </>
          )}
        </div>
      </>
    ),

    states: () => {
      const rows = [
        { label: 'Out with a client', names: states.out, fill: gold },
        { label: 'Free to book', names: states.free, fill: isDark ? '#4b4f54' : '#d1d5db' },
        { label: 'Not listed', names: states.unlisted, fill: neutral },
        { label: 'Off the road', names: states.offRoad, fill: isDark ? '#f59e0b' : '#d97706' },
        { label: 'Papers expired', names: states.expired, fill: isDark ? '#f87171' : '#dc2626' },
      ];
      return (
        <>
          <p style={s.counts}>
            Right now, whatever the range above says. Every vehicle appears once.
          </p>
          <div style={s.body}>
            <div style={s.segmentBar}>
              {rows.flatMap((row) => row.names.map((v) => (
                <div key={v.id} style={{ flex: 1, background: row.fill, borderRadius: '3px' }} title={`${v.name} · ${row.label}`} />
              )))}
            </div>
            <div>
              {rows.map((row) => (
                <div key={row.label} style={s.stateRow}>
                  <span style={s.stateName}>
                    <span style={{ ...s.swatch(row.fill), display: 'inline-block', marginRight: '8px' }} />
                    {row.label}
                  </span>
                  <span style={s.stateNum}>{row.names.length}</span>
                  <span style={s.stateWho}>{row.names.map((v) => v.name).join(' · ') || '—'}</span>
                </div>
              ))}
            </div>
            {states.overdue.length > 0 && (
              <div style={s.amberLine}>
                {plural(states.overdue.length, 'vehicle')} overdue:{' '}
                {states.overdue.map((o) => `${o.name} · due ${formatPhDate(o.due, { day: 'numeric', month: 'short' })}`).join(' · ')}
              </div>
            )}
          </div>
        </>
      );
    },

    vehicles: () => (
      <>
        <p style={s.counts}>
          Every vehicle, by what it earned in this range. Days out counts only
          the part of each trip inside the range.
        </p>
        <div style={s.body}>
          <div style={s.chips}>
            <span style={s.consignorChip}>{earnings.earning} earned</span>
            <span style={s.consignorChip}>{earnings.idle} earned nothing</span>
            <span style={s.consignorChip}>{earnings.share}% of available days out</span>
          </div>

          <div>
            <div style={s.tableHead}>
              <span>Vehicle</span>
              <span style={s.right}>Trips</span>
              <span>Days out of available</span>
              <span style={s.right}>Earned</span>
              <span style={s.right}>Per day</span>
            </div>
            {earnings.rows.map((v) => (
              <div key={v.id} style={s.tableRow}>
                <span style={s.vehName}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                  {v.consignor && <span style={s.consignorChip}>Consignor</span>}
                </span>
                <span style={s.right}>{v.trips}</span>
                {v.earned === 0 ? (
                  <span style={s.reasonChip(v.reason === 'Off the road' || v.reason === 'Papers expired')}>{v.reason}</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={s.track}><span style={s.fill(`${Math.min(100, v.share)}%`, gold)} /></span>
                    <span style={{ flexShrink: 0, fontSize: '12px', color: text2, fontVariantNumeric: 'tabular-nums' }}>
                      {v.daysOut} of {v.daysAvailable} days · {v.share}%
                    </span>
                  </span>
                )}
                <span style={{ ...s.right, fontWeight: '700' }}>{peso(v.earned)}</span>
                <span style={{ ...s.right, color: text2 }}>{peso(v.perDay)}</span>
              </div>
            ))}
          </div>

          <p style={s.note}>
            Days a vehicle was off the road or out of papers are left out of days available.
            {earnings.assumed > 0
              ? ` Switching a listing off leaves no date behind, so days hidden still count as available — ${plural(earnings.assumed, 'vehicle')} affected.`
              : ''}
          </p>
        </div>
      </>
    ),

    demand: () => (
      <>
        <p style={s.counts}>Confirmed and completed bookings, by Philippine time.</p>
        <div style={s.body}>
          {shape.total === 0 ? (
            <Empty>No pickups in this range.</Empty>
          ) : (
            <div style={s.chartRow}>
              <BarChart
                title="Pickup day"
                values={shape.byDay}
                labels={DOW}
                note={`${DAYS_FULL[busiestDay]}s are busiest: ${shape.byDay[busiestDay]} of ${shape.total} pickups.`}
              />
              <BarChart
                title="How far ahead people book"
                values={shape.byLead}
                labels={['Same day', '1–2 d', '3–7 d', '8–14 d', '15–30 d', '30+ d']}
                note={`Most book ${leadPhrase(commonLead)}. ${shape.byLead[0]} booked on the day of pickup.`}
              />
              <BarChart
                title="Trip length"
                values={shape.byTrip}
                labels={['1 day', '2 days', '3–6 d', '7–13 d', '14+ d']}
                hatchFrom={discountFrom ? TRIP_BUCKETS.findIndex((t) => t.startsWith('7')) : null}
                note={discountFrom
                  ? (shape.long
                    ? `${shape.long} of ${shape.total} trips (${pct(shape.long, shape.total)}) ran ${discountFrom} days or more, the striped bars, where the longer-rental discount applies.`
                    : `No trip in this range ran ${discountFrom} days or more, so no longer-rental discount was used.`)
                  : 'No longer-rental discount rules are set, so no trip length is marked.'}
              />
            </div>
          )}
        </div>
      </>
    ),

    clients: () => (
      <>
        <p style={s.counts}>
          People with a confirmed or completed booking. Came back counts anyone
          who has booked more than once, whenever that was.
        </p>
        <div style={s.body}>
          <div style={s.tiles}>
            <div style={s.tile}>
              <span style={s.tileLabel}>Booked</span>
              <span style={s.tileNum()}>{who.booked}</span>
              <span style={s.tileSub}>clients</span>
            </div>
            <div style={s.tile}>
              <span style={s.tileLabel}>Came back</span>
              <span style={s.tileNum()}>{who.returning}</span>
              <span style={s.tileSub}>{pct(who.returning, who.booked)} booked more than once</span>
            </div>
            <div style={s.tile}>
              <span style={s.tileLabel}>First booking</span>
              <span style={s.tileNum()}>{who.first}</span>
              <span style={s.tileSub}>{who.first ? 'new in this range' : 'none new in this range'}</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={s.chartTitle}>How the office rates them</span>
              <span style={s.privateChip}>Private · admin only</span>
            </div>
            {who.booked === 0 ? (
              <Empty>No clients booked in this range.</Empty>
            ) : (
              [...who.stars.map((n, i) => ({ label: `${5 - i} stars`, n, fill: gold })),
                { label: 'Not rated yet', n: who.unrated, fill: neutral }].map((row) => {
                const max = Math.max(1, ...who.stars, who.unrated);
                return (
                  <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 28px', gap: '10px', alignItems: 'center', padding: '3px 0', fontSize: '12px', color: text3 }}>
                    <span>{row.label}</span>
                    <span style={s.track}><span style={s.fill(`${(row.n / max) * 100}%`, row.fill)} /></span>
                    <span style={{ ...s.right, color: text2 }}>{row.n}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </>
    ),

    ops: () => (
      <>
        <p style={s.counts}>
          The things that cost a day of rental, and the extras people asked for.
        </p>
        <div style={s.body}>
          <div style={s.tiles}>
            <div style={s.tile}>
              <span style={s.tileLabel}>Late returns</span>
              <span style={s.tileNum()}>{ops.late}</span>
              <span style={s.tileSub}>{ops.late ? `${peso(ops.lateFees)} in late fees` : 'None in this range'}</span>
            </div>
            <div style={s.tile}>
              <span style={s.tileLabel}>Extensions</span>
              <span style={s.tileNum()}>{ops.extensions}</span>
              <span style={s.tileSub}>{ops.extensions ? 'trips extended before the due date' : 'None in this range'}</span>
            </div>
            <div style={s.tile}>
              <span style={s.tileLabel}>Overdue now</span>
              <span style={s.tileNum('amber')}>{ops.overdue}</span>
              <span style={s.tileSub}>
                {ops.overdue
                  ? states.overdue.map((o) => o.name).join(' · ')
                  : 'Everything out is still within its dates'}
              </span>
            </div>
          </div>

          <div style={s.splitRow}>
            <span style={s.chartTitle}>Extras taken</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${line2}`, borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: text2 }}>With a driver</span>
              <strong style={{ fontVariantNumeric: 'tabular-nums', color: text }}>{plural(ops.withDriver, 'booking')}</strong>
            </div>
            {ops.delivered === 0 ? (
              <Empty>No deliveries in this range. The option is offered, but nobody chose it.</Empty>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: `1px solid ${line2}`, borderRadius: '8px', fontSize: '13px' }}>
                <span style={{ color: text2 }}>Delivered or collected from an address</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums', color: text }}>{plural(ops.delivered, 'booking')}</strong>
              </div>
            )}
          </div>
        </div>
      </>
    ),
  };

  return (
    <AdminLayout activePage="Analytics">
      <div style={{ background: page }}>
        <div style={s.head}>
          <div>
            <h1 style={s.title}>Analytics</h1>
            <p style={s.subtitle}>
              How the business is doing over weeks and months. For today&apos;s pickups and returns, see Dashboard.
            </p>
          </div>
          <div role="group" aria-label="Date range" style={s.rangeGroup}>
            {RANGES.map((key) => (
              <button
                key={key}
                type="button"
                className="compact-btn"
                aria-pressed={range === key}
                style={s.rangeBtn(range === key)}
                onClick={() => setRange(key)}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div style={s.meta}>
          <span style={s.metaSpan}><CalendarIcon />{spanLabel}</span>
          <span>As of {formatPhDate(now, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span style={s.metaQuiet}>
            Counts confirmed and completed bookings. Cancelled bookings appear only under Cancellations.
          </span>
        </div>

        {loading ? (
          <div style={s.wrap}>
            <Skeleton height="420px" radius="12px" isDark={isDark} />
            <Skeleton height="560px" radius="12px" isDark={isDark} />
          </div>
        ) : (
          <div style={s.wrap}>
            <nav aria-label="Questions" style={s.rail}>
              {QUESTIONS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="list-row-btn"
                  aria-current={question === key}
                  style={s.railBtn(question === key)}
                  onClick={() => setQuestion(key)}
                >
                  <span style={s.railQ}>{label}</span>
                  <span style={s.railA}>{headlines[key]}</span>
                </button>
              ))}
            </nav>

            <section style={s.panel} aria-live="polite">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <span style={s.kicker}>{KICKERS[question]}</span>
                <h2 style={s.headline}>{headlines[question]}</h2>
              </div>
              {panels[question]()}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

// "2026-10" or "2026-10-w2" as somebody would say it out loud.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const columnLabel = (key) => {
  const month = MONTHS[Number(key.slice(5, 7)) - 1];
  const week = key.includes('-w') ? key.slice(key.indexOf('-w') + 2) : null;
  return week ? `${month} wk ${week}` : month;
};

const chargeDesc = (key) => ({
  late: "One day's rental for every day late",
  fuel: 'Returned with less fuel than it went out with',
  damage: 'Charged after the vehicle was looked over',
}[key] || '');

export default Analytics;
