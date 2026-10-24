import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { busySpansFrom, dayState } from '../utils/bookingWindow';

// The fortnight beside the photo on a vehicle page: what is free, and a
// range you can pick without opening anything.
//
// It writes into the same two dates the booking dialog uses, through the
// same handler, so the two can never disagree — picking here and opening
// the dialog lands on step one with these days already chosen, which is
// the whole point of it.
//
// Three day states, not the two the design drew. A vehicle coming back at
// noon is free again from 2 PM, and a strip that knows only free and
// booked would show that day plain and promise a morning we cannot give.
// Same colours as the calendar inside the dialog: there are two calendars
// on this page and they should mean the same things.
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHOWN = 14;

const midnight = (d) => { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const peso = (n) => `₱${Math.round(n).toLocaleString()}`;

const AvailabilityStrip = ({
  bookedRanges, startDate, endDate, onSelectDay, onBook, isDark, message,
  pricePerDay, days, discount, total, longRentalRule, nextFree,
}) => {
  const gold = isDark ? GOLD_DARK : GOLD;
  const border = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#6b7280';

  const today = midnight(new Date());
  const spans = busySpansFrom(bookedRanges);
  const cells = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const date = addDays(today, i);
    const info = dayState(spans, date);
    return { date, ...info };
  });

  const asTime = (v) => (v ? midnight(new Date(v)).getTime() : null);
  const from = asTime(startDate);
  const to = asTime(endDate);
  const inRange = (d) => {
    const t = midnight(d).getTime();
    if (from && to) return t >= from && t <= to;
    return t === from;
  };
  const isEnd = (d) => {
    const t = midnight(d).getTime();
    return t === from || t === to;
  };

  const anyPart = cells.some((c) => c.state === 'part');
  const saved = discount > 0 ? discount : 0;

  const s = {
    card: {
      padding: '18px', borderRadius: '16px', border: `1px solid ${border}`,
      background: isDark ? '#242526' : '#fff',
      display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0,
    },
    head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' },
    title: { fontWeight: '750', fontSize: '16px', color: text },
    span: { fontSize: '13px', color: text2 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px', textAlign: 'center' },
    dow: { fontSize: '11px', fontWeight: '650', color: text2, paddingBottom: '2px' },
    cell: (c) => {
      const picked = inRange(c.date);
      const end = isEnd(c.date);
      const busy = c.state === 'busy';
      return {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '1px', minHeight: '52px', padding: '6px 2px',
        borderRadius: '12px', border: `1px solid ${picked ? 'transparent' : border}`,
        // The ends of the range are solid gold; the days between are a tint
        // of it, so a range reads as one block rather than two markers.
        background: end
          ? gold
          : picked
            ? (isDark ? 'rgba(232,161,0,0.26)' : 'rgba(184,121,10,0.18)')
            : busy
              ? (isDark ? 'rgba(220,38,38,0.25)' : '#fee2e2')
              : c.state === 'part'
                ? (isDark
                  ? 'linear-gradient(135deg, rgba(220,38,38,0.25) 0 48%, rgba(22,163,74,0.18) 52% 100%)'
                  : 'linear-gradient(135deg, #fee2e2 0 48%, #dcfce7 52% 100%)')
                : (isDark ? 'rgba(22,163,74,0.18)' : '#dcfce7'),
        color: end
          ? ON_GOLD
          : busy
            ? (isDark ? '#fca5a5' : '#991b1b')
            : (isDark ? '#86efac' : '#166534'),
        textDecoration: busy ? 'line-through' : 'none',
        cursor: busy ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
      };
    },
    mon: { fontSize: '11px', opacity: 0.75 },
    num: { fontSize: '18px', fontWeight: '700', lineHeight: 1.1 },
    legend: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12px', color: text2 },
    key: { display: 'flex', alignItems: 'center', gap: '6px' },
    sw: (bg) => ({ width: '12px', height: '12px', borderRadius: '4px', background: bg, flexShrink: 0 }),
    sum: {
      marginTop: 'auto', padding: '12px 14px', borderRadius: '10px',
      background: isDark ? '#1e1f20' : '#f6f7f8',
      fontSize: '13px', display: 'flex', gap: '12px', alignItems: 'center',
    },
    sumLeft: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
    sumHead: { fontWeight: '700', color: text },
    sumSub: { color: text2 },
    savings: { fontWeight: '650', color: goldInk(isDark) },
    total: { fontSize: '22px', fontWeight: '800', color: text, whiteSpace: 'nowrap' },
    warn: {
      padding: '10px 12px', borderRadius: '10px', fontSize: '12.5px', fontWeight: '600',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2',
      color: isDark ? '#fca5a5' : '#dc2626',
    },
    cta: (ready) => ({
      minHeight: '48px', borderRadius: '12px', border: 'none',
      background: ready ? gold : (isDark ? '#3a3b3c' : '#e5e7eb'),
      color: ready ? ON_GOLD : text2,
      fontFamily: 'inherit', fontSize: '15px', fontWeight: '700',
      cursor: ready ? 'pointer' : 'not-allowed',
    }),
  };

  const ready = !!(startDate && endDate && days > 0);
  const label = (d) => `${MON[d.getMonth()]} ${d.getDate()}`;

  return (
    <div style={s.card}>
      <div style={s.head}>
        <span style={s.title}>Availability</span>
        <span style={s.span}>{label(cells[0].date)} – {label(cells[cells.length - 1].date)}</span>
      </div>

      <div style={s.grid}>
        {cells.slice(0, 7).map((c, i) => (
          <div key={`dow-${i}`} style={s.dow} aria-hidden="true">{WD[c.date.getDay()]}</div>
        ))}
        {cells.map((c) => {
          const busy = c.state === 'busy';
          const note = c.state === 'part' ? `, ${c.label}` : busy ? ', booked' : ', free';
          return (
            <button
              key={c.date.toISOString()}
              type="button"
              disabled={busy}
              style={s.cell(c)}
              title={`${c.date.toLocaleDateString()}${note}`}
              aria-label={`${c.date.toLocaleDateString()}${note}`}
              aria-pressed={inRange(c.date)}
              onClick={() => onSelectDay(c.date)}
            >
              <span style={s.mon}>{MON[c.date.getMonth()]}</span>
              <span style={s.num}>{c.date.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div style={s.legend}>
        <span style={s.key}><span style={s.sw(isDark ? 'rgba(22,163,74,0.4)' : '#dcfce7')} />Free</span>
        <span style={s.key}><span style={s.sw(isDark ? 'rgba(220,38,38,0.4)' : '#fee2e2')} />Booked</span>
        {anyPart && (
          <span style={s.key}>
            <span style={s.sw(isDark
              ? 'linear-gradient(135deg, rgba(220,38,38,0.45) 0 48%, rgba(22,163,74,0.4) 52% 100%)'
              : 'linear-gradient(135deg, #fecaca 0 48%, #bbf7d0 52% 100%)')}
            />
            Part of the day
          </span>
        )}
        <span style={s.key}><span style={s.sw(gold)} />Your days</span>
      </div>

      {/* Why a range was refused. handleSelectDay will not set an end date
          it cannot honour, so without this the second tap would simply do
          nothing and leave somebody tapping it again. */}
      {message && <div style={s.warn}>{message}</div>}

      <div style={s.sum}>
        <span style={s.sumLeft}>
          <span style={s.sumHead}>
            {ready
              ? `${label(new Date(startDate))} → ${label(new Date(endDate))} · ${days} day${days === 1 ? '' : 's'}`
              : startDate ? 'Now pick the day you bring it back' : 'Pick your days'}
          </span>
          <span style={s.sumSub}>
            {/* Before anything is picked, the useful line is not the rate —
                that is already in the header — but the first hour somebody
                could actually collect it, which a fortnight of red does
                not answer on a busy vehicle. */}
            {ready
              ? `${days} × ${peso(pricePerDay)}`
              : (nextFree ? `Next free: ${nextFree}` : `${peso(pricePerDay)} a day`)}
          </span>
          {ready && saved > 0 && (
            <span style={s.savings}>
              {longRentalRule ? `${longRentalRule.minDays}+ days: you save ` : 'You save '}{peso(saved)}
            </span>
          )}
        </span>
        {/* Nothing, not zero. A total of ₱0 reads like the answer to a
            question nobody has asked yet. */}
        {ready && <span style={s.total}>{peso(total)}</span>}
      </div>

      <button type="button" style={s.cta(ready)} disabled={!ready} onClick={onBook}>
        Book these dates
      </button>
    </div>
  );
};

export default AvailabilityStrip;
