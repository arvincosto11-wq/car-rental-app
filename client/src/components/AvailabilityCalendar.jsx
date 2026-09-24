import { useState } from 'react';
import { GOLD, GOLD_DARK } from '../theme';
import { instantFrom, phDayStart, phYmd, pickupHours, formatHour, CLOSE_HOUR } from '../utils/phTime';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const normalize = (d) => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd.getTime();
};

// Grid days are built in local time; promo dates arrive as UTC midnight.
// Comparing the two as YYYY-MM-DD strings sidesteps the timezone drift that
// would otherwise light up the wrong day in PH — ISO dates sort correctly as
// plain text, so >= and <= do the right thing here.
const ymdLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ymdUTC = (d) => new Date(d).toISOString().slice(0, 10);

const buildGrid = (year, month) => {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
};

// Small month calendar showing which dates are already booked (red) vs free
// (green) for a car, plus the client's own currently-picked range (gold
// ring), if any. When onSelectDay is given, available/future days become
// clickable so the client can pick their pickup/return dates directly on
// the grid instead of separate date inputs.
const AvailabilityCalendar = ({ bookedRanges, selectedStart, selectedEnd, onSelectDay, isDark, promo, selectableWhenBooked = false }) => {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const today = normalize(new Date());

  // What a range really occupies. `busyStart`/`busyEnd` come from the server
  // with each booking's turnaround already added; ranges that arrive without
  // them (the admin promo and blocked-date pickers) are whole calendar days
  // in Legazpi, snapped the same way the server snaps them.
  const spanOf = (r) => (r.busyStart && r.busyEnd
    ? { start: new Date(r.busyStart).getTime(), end: new Date(r.busyEnd).getTime() }
    : { start: phDayStart(r.startDate).getTime(), end: phDayStart(r.endDate).getTime() });

  const spans = bookedRanges.map(spanOf);
  const takenAt = (instant) => spans.some((sp) => instant >= sp.start && instant < sp.end);

  // A day is no longer simply free or booked. A vehicle coming back at
  // 7:00 AM is free again from 9:00 AM, and losing that whole day is real
  // money — so every hour the client could actually choose is tested, and
  // the day reports which of them are still open.
  const dayInfo = (date) => {
    const ymd = phYmd(date);
    const free = pickupHours().filter((h) => !takenAt(instantFrom(ymd, h).getTime()));
    if (!free.length) return { state: 'busy', free };
    if (free.length === pickupHours().length) return { state: 'free', free };
    const from = free[0];
    const until = free[free.length - 1];
    return {
      state: 'part',
      free,
      // "From" when the free hours run to closing (the usual changeover
      // day), "until" when the vehicle goes out partway through instead.
      label: until === CLOSE_HOUR
        ? `available ${formatHour(from)} onwards`
        : `available until ${formatHour(until)}`,
    };
  };
  const isSelected = (date) => {
    const t = normalize(date);
    if (selectedStart && selectedEnd) return t >= normalize(selectedStart) && t <= normalize(selectedEnd);
    if (selectedStart) return t === normalize(selectedStart);
    return false;
  };
  const isPast = (date) => normalize(date) < today;

  // Gold replaces green on an available promo day; a booked one stays red
  // and is flagged with the bar instead. See the day style below.
  const promoActive = !!(promo && promo.startDate && promo.endDate && promo.value > 0);
  const promoSummary = promoActive
    ? `${promo.label} · ${promo.type === 'amount' ? `₱${Number(promo.value).toLocaleString()} off` : `${promo.value}% off`}`
    : '';
  const isPromoDay = (date) => {
    if (!promoActive) return false;
    const day = ymdLocal(date);
    return day >= ymdUTC(promo.startDate) && day <= ymdUTC(promo.endDate);
  };

  const grid = buildGrid(cursor.getFullYear(), cursor.getMonth());

  const partDays = grid.filter((c) => c.inMonth && !isPast(c.date) && dayInfo(c.date).state === 'part');
  const hasPartDay = partDays.length > 0;
  // Spells out the hours for the day the client has actually picked; falls
  // back to naming the split days in view, so the diagonal is never the only
  // explanation of itself.
  const pickedPart = selectedStart && partDays.find((c) => normalize(c.date) === normalize(selectedStart));
  const partNote = pickedPart
    ? `${pickedPart.date.toLocaleDateString()} — ${dayInfo(pickedPart.date).label}.`
    : hasPartDay
      ? `${partDays.length === 1 ? 'One day is' : `${partDays.length} days are`} only part-free this month — the split days. Tap one to see its hours.`
      : '';

  const s = {
    wrap: { background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '12px', padding: '14px' },
    navRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' },
    navBtn: { background: 'none', border: 'none', fontSize: '16px', color: isDark ? '#b0b3b8' : '#6b7280', cursor: 'pointer', padding: '2px 8px' },
    monthLabel: { fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' },
    weekday: { textAlign: 'center', fontSize: '10px', fontWeight: '700', color: isDark ? '#8a8d91' : '#9ca3af', padding: '2px 0' },
    day: (inMonth, booked, selected, past, clickable, onPromo, part) => ({
      position: 'relative',
      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', borderRadius: '6px',
      fontWeight: selected || onPromo ? '700' : '500',
      // Faded to show they belong to another month, but not so faint that a
      // day you can actually take reads as disabled.
      opacity: past ? 0.35 : inMonth ? 1 : 0.55,
      // Gold REPLACES green on a promo day, because both mean the same thing
      // — you can book this — so nothing is lost by swapping one for the
      // other. Red always wins: a booked day stays red and gets the gold bar
      // instead, since losing "you can't have this" would be a real loss.
      // A part-booked day is split down the diagonal: taken above the line,
      // free below it. Deliberately the same two colours rather than a
      // fourth one — it reads as "partly", and nothing new has to be learnt.
      background: booked
        ? (isDark ? 'rgba(220,38,38,0.25)' : '#fee2e2')
        : part
          ? (isDark
            ? 'linear-gradient(135deg, rgba(220,38,38,0.25) 0 48%, rgba(22,163,74,0.18) 52% 100%)'
            : 'linear-gradient(135deg, #fee2e2 0 48%, #dcfce7 52% 100%)')
          : onPromo
            ? (isDark ? 'rgba(232,161,0,0.26)' : '#fdf0cf')
            : (isDark ? 'rgba(22,163,74,0.18)' : '#dcfce7'),
      color: booked
        ? (isDark ? '#fca5a5' : '#991b1b')
        : onPromo && !part
          ? (isDark ? '#ffcf63' : '#8a5a06')
          : (isDark ? '#86efac' : '#166534'),
      // Tints, not full saturation, so the gold selection ring still reads
      // on top of a gold cell.
      boxShadow: selected ? `inset 0 0 0 2px ${isDark ? GOLD_DARK : GOLD}` : 'none',
      border: 'none', font: 'inherit',
      cursor: clickable ? 'pointer' : 'default',
      pointerEvents: clickable ? 'auto' : 'none',
    }),
    legendRow: { display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' },
    legendItem: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280' },
    legendDot: (bg) => ({ width: '9px', height: '9px', borderRadius: '3px', background: bg, flexShrink: 0 }),
    // Runs the full width of the cell and sits flush on its bottom edge, so
    // consecutive promo days read as one gold band under the range rather
    // than a row of unrelated ticks. The availability fill and the selection
    // ring are untouched — this is a third channel, not a replacement.
    promoBar: {
      // Inset by the 2px selection ring rather than bleeding to the edge —
      // at full bleed the bar cut straight through the bottom of the ring on
      // any day that was both selected and on promo.
      position: 'absolute', left: '3px', right: '3px', bottom: '3px', height: '3.5px',
      borderRadius: '2px',
      background: isDark
        ? `linear-gradient(90deg, ${GOLD_DARK}, #ffc44d, ${GOLD_DARK})`
        : `linear-gradient(90deg, ${GOLD}, #e8a100, ${GOLD})`,
      boxShadow: `0 0 7px ${isDark ? 'rgba(232,161,0,0.75)' : 'rgba(184,121,10,0.55)'}`,
      pointerEvents: 'none',
    },
    promoSpark: {
      position: 'absolute', top: '2px', right: '2px',
      width: '8px', height: '8px', opacity: 0.9, pointerEvents: 'none',
      color: isDark ? '#ffcf63' : '#b8790a',
    },
    legendPart: {
      width: '9px', height: '9px', borderRadius: '3px', flexShrink: 0,
      background: isDark
        ? 'linear-gradient(135deg, rgba(220,38,38,0.45) 0 48%, rgba(22,163,74,0.4) 52% 100%)'
        : 'linear-gradient(135deg, #fecaca 0 48%, #bbf7d0 52% 100%)',
    },
    partNote: {
      display: 'flex', alignItems: 'center', gap: '7px',
      marginTop: '10px', padding: '8px 11px', borderRadius: '9px',
      fontSize: '11px', fontWeight: '700', lineHeight: 1.35,
      background: isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.09)',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.38)' : 'rgba(184,121,10,0.32)'}`,
      color: isDark ? GOLD_DARK : GOLD,
    },
    legendBar: {
      width: '9px', height: '9px', borderRadius: '3px', flexShrink: 0,
      background: isDark ? 'rgba(232,161,0,0.45)' : '#fdf0cf',
      boxShadow: `inset 0 0 0 1px ${isDark ? 'rgba(232,161,0,0.7)' : 'rgba(184,121,10,0.45)'}`,
    },
    promoNote: {
      display: 'flex', alignItems: 'center', gap: '7px',
      marginTop: '10px', padding: '8px 11px', borderRadius: '9px',
      fontSize: '11px', fontWeight: '700', lineHeight: 1.35,
      background: isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.09)',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.38)' : 'rgba(184,121,10,0.32)'}`,
      color: isDark ? GOLD_DARK : GOLD,
    },
    promoNoteIcon: { flexShrink: 0 },
  };

  return (
    <div style={s.wrap}>
      <div style={s.navRow}>
        <button type="button" style={s.navBtn} aria-label="Previous month" onClick={() => setCursor((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}>‹</button>
        <span style={s.monthLabel}>{MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}</span>
        <button type="button" style={s.navBtn} aria-label="Next month" onClick={() => setCursor((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}>›</button>
      </div>
      <div style={s.grid}>
        {WEEKDAY_LABELS.map((wd, i) => <div key={i} style={s.weekday}>{wd}</div>)}
        {grid.map(({ date, inMonth }, i) => {
          const info = dayInfo(date);
          const booked = info.state === 'busy';
          const part = info.state === 'part';
          const past = isPast(date);
          const promoDay = isPromoDay(date);
          // Booked days stay red but become pickable when the caller allows it
          // (admin choosing promo dates — overlapping bookings warn rather
          // than block, so the calendar must not block either).
          // The days either side of the month are drawn, and they used to be
          // the only free days on the grid nobody could take. A trip from the
          // 30th to the 1st meant pressing Next first, for no reason a client
          // could see — the day was right there, in the same week row.
          const clickable = !!onSelectDay && !past && (selectableWhenBooked || !booked);
          // Never colour alone: the hours are in the tooltip and the label
          // a screen reader reads out, and spelled out under the grid for
          // whichever day is picked.
          const partText = part ? ` — ${info.label}` : '';
          return (
            <button
              key={i}
              type="button"
              style={s.day(inMonth, booked, isSelected(date), past, clickable, promoDay, part)}
              title={`${date.toLocaleDateString()}${partText}${promoDay ? ` — ${promoSummary}` : ''}`}
              aria-label={
                `${date.toLocaleDateString()}` +
                `${booked ? ', booked' : part ? `, ${info.label}` : clickable ? ', available' : ''}` +
                `${promoDay ? `, on promo, ${promoSummary}` : ''}`
              }
              tabIndex={clickable ? 0 : -1}
              onClick={clickable ? () => {
                onSelectDay(date);
                // Follow theselection into its own month, so a day picked off the
                // edge does not vanish the moment it is chosen.
                if (!inMonth) setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
              } : undefined}
            >
              {date.getDate()}
              {promoDay && (
                <svg viewBox="0 0 24 24" fill="currentColor" style={s.promoSpark} aria-hidden="true">
                  <path d="M12 2l2.2 6.2L20.5 10l-6.3 1.8L12 18l-2.2-6.2L3.5 10l6.3-1.8z" />
                </svg>
              )}
              {/* A booked promo day keeps its red fill, so it needs the bar
                  to show it's inside the window at all. */}
              {promoDay && booked && <span style={s.promoBar} />}
            </button>
          );
        })}
      </div>
      <div style={s.legendRow}>
        <span style={s.legendItem}><span style={s.legendDot(isDark ? 'rgba(22,163,74,0.4)' : '#dcfce7')} />Available</span>
        <span style={s.legendItem}><span style={s.legendDot(isDark ? 'rgba(220,38,38,0.4)' : '#fee2e2')} />Booked</span>
        {hasPartDay && <span style={s.legendItem}><span style={s.legendPart} />Part of the day</span>}
        {selectedStart && selectedEnd && (
          <span style={s.legendItem}><span style={{ ...s.legendDot('transparent'), boxShadow: `inset 0 0 0 2px ${isDark ? GOLD_DARK : GOLD}` }} />Your dates</span>
        )}
        {promoActive && (
          <span style={s.legendItem}>
            <span style={s.legendBar} />
            On promo
          </span>
        )}
      </div>
      {partNote && (
        <div style={s.partNote}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={s.promoNoteIcon}>
            <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
          </svg>
          <span>{partNote}</span>
        </div>
      )}
      {promoActive && (
        <div style={s.promoNote}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={s.promoNoteIcon} aria-hidden="true">
            <path d="M12 2l2.2 6.2L20.5 10l-6.3 1.8L12 18l-2.2-6.2L3.5 10l6.3-1.8z" />
          </svg>
          <span>{promoSummary} — book within the gold dates to save.</span>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
