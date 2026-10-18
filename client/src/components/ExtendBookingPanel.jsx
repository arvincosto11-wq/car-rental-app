import { useEffect, useState } from 'react';
import api from '../api';
import AvailabilityCalendar from './AvailabilityCalendar';
import { formatMoment, phYmd, instantFrom, phHour } from '../utils/phTime';
import { GOLD, GOLD_DARK, goldInk } from '../theme';

// Making a booking longer, and showing what that costs before a peso moves.
//
// The breakdown is the whole point of this screen. Extending can make a
// booking cheaper per day — by crossing a long-rental threshold — or dearer
// than the extra days alone, by pushing the return past a promo's last day.
// Either way the client sees why the number is what it is, in the same
// place they agree to pay it.

const toYmd = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

// The handoff draws this as a −/+ stepper and a single "+ ₱x". That
// would have dropped the calendar, the late-fee reduction and the choice
// between a deposit and the full amount, so the stepper is here as the
// quick way to add a day or two and everything else stays. It lives
// inside the booking now rather than over the page.
const ExtendBookingPanel = ({ booking, isDark, mb, onClose, onStarted }) => {
  const [limits, setLimits] = useState(null);
  const [ranges, setRanges] = useState([]);
  const [newEnd, setNewEnd] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Which way they want to pay for it. Only offered where it is a real
  // choice — see the server's quote.
  const [mode, setMode] = useState('deposit');

  const carId = booking.car?._id || booking.car;
  const hour = booking.hasPickupTime ? phHour(booking.startDate) : 0;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/bookings/${booking._id}/extension`),
      api.get(`/cars/${carId}/booked-dates`),
    ])
      .then(([limitRes, rangeRes]) => {
        if (cancelled) return;
        setLimits(limitRes.data);
        setRanges(rangeRes.data);
      })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not load this booking.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [booking._id, carId]);

  // Asked of the server rather than worked out here: the figures a client
  // agrees to have to be the ones that get charged, and there is only one
  // way to guarantee that.
  useEffect(() => {
    if (!newEnd) return undefined;
    let cancelled = false;
    api.get(`/bookings/${booking._id}/extension`, { params: { endDate: newEnd } })
      .then((res) => {
        if (cancelled) return;
        setError(res.data.quote?.error || '');
        // Tagged with the date it was asked for, so a slow answer for a
        // date the client has already moved on from can't be shown against
        // a different one.
        setQuote(res.data.quote?.error ? null : { ...res.data.quote, forDate: newEnd });
      })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.message || 'Could not price that date.'); });
    return () => { cancelled = true; };
  }, [newEnd, booking._id]);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/bookings/${booking._id}/extension`, { endDate: newEnd, mode: chosen });
      onStarted();
      window.location.href = res.data.checkoutUrl;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start that payment.');
      setBusy(false);
    }
  };

  const latest = limits?.latestEndDate ? phYmd(limits.latestEndDate) : '';
  // Whichever way of paying is actually available, defaulting to the
  // smaller ask when both are.
  const options = quote?.payment?.options || ['full'];
  const chosen = options.includes(mode) ? mode : options[0];
  const due = quote?.payment?.[chosen];
  const currentEnd = booking.endDate;

  // Days the client may choose: after the current return, up to whatever
  // the vehicle's own calendar allows.
  const selectableDay = (date) => {
    const ymd = toYmd(date);
    return ymd > phYmd(currentEnd) && (!latest || ymd <= latest);
  };

  // The stepper and the calendar are two ways to the same newEnd. The
  // stepper stops at a week, which covers nearly every extension; a
  // longer one is a tap on the calendar.
  const DAY = 24 * 60 * 60 * 1000;
  const dayAfter = (ymd, n) => toYmd(new Date(new Date(`${ymd}T00:00:00`).getTime() + n * DAY));
  const endYmd = phYmd(currentEnd);
  const extraDays = newEnd
    ? Math.round((new Date(`${newEnd}T00:00:00`) - new Date(`${endYmd}T00:00:00`)) / DAY)
    : 0;
  const roomToLatest = latest
    ? Math.round((new Date(`${latest}T00:00:00`) - new Date(`${endYmd}T00:00:00`)) / DAY)
    : 7;
  const maxStep = Math.max(1, Math.min(7, roomToLatest));
  // The upper bound only applies to stepping UP. Picking a longer
  // extension on the calendar than the stepper offers used to leave −
  // looking enabled and doing nothing, because every target it tried was
  // over the limit.
  const stepTo = (n) => {
    if (n < 1) return;
    if (n > extraDays && n > maxStep) return;
    setNewEnd(dayAfter(endYmd, n));
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    sub: { fontSize: '12.5px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 12px' },
    stepper: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    stepBtn: (on) => ({
      width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
      border: `1px solid ${isDark ? '#3a3b3c' : '#e3e1dc'}`,
      background: isDark ? '#242526' : '#fff',
      color: on ? (isDark ? '#e4e6eb' : '#1c1b19') : (isDark ? '#5a5b5d' : '#c4c0b8'),
      fontSize: '20px', fontFamily: 'inherit', cursor: on ? 'pointer' : 'not-allowed',
    }),
    stepDays: { fontSize: '18px', fontWeight: '750', color: isDark ? '#e4e6eb' : '#1c1b19', textAlign: 'center' },
    stepExtra: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#5f5c55', textAlign: 'center' },
    newReturn: { fontSize: '13px', color: isDark ? '#e4e6eb' : '#1c1b19', margin: 0 },
    current: {
      padding: '10px 12px', borderRadius: '9px', marginBottom: '14px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '12.5px', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    label: {
      display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em',
      textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af', margin: '0 0 8px',
    },
    limitNote: {
      fontSize: '11.5px', lineHeight: 1.5, marginTop: '10px',
      color: goldInk(isDark), fontWeight: '600',
    },
    error: {
      padding: '9px 11px', borderRadius: '8px', margin: '12px 0 0',
      fontSize: '12px', lineHeight: 1.45,
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    breakdown: {
      marginTop: '16px', padding: '14px 16px', borderRadius: '11px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    row: {
      display: 'flex', justifyContent: 'space-between', gap: '14px',
      fontSize: '12.5px', marginBottom: '7px', color: isDark ? '#b0b3b8' : '#4b5563',
    },
    lateBlock: {
      margin: '10px 0', padding: '10px 12px', borderRadius: '10px',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.3)' : '#fecaca'}`,
    },
    lateTitle: {
      fontSize: '12.5px', fontWeight: '800', marginBottom: '6px',
      color: isDark ? '#f87171' : '#991b1b',
    },
    lateStruck: { textDecoration: 'line-through', color: isDark ? '#8a8d91' : '#9ca3af' },
    lateNow: { fontWeight: '800', color: isDark ? '#f87171' : '#991b1b' },
    lateNote: { fontSize: '11px', marginTop: '6px', color: isDark ? '#b0b3b8' : '#6b7280' },
    rowStrong: {
      display: 'flex', justifyContent: 'space-between', gap: '14px',
      fontSize: '13.5px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a',
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, paddingTop: '9px', marginTop: '9px',
    },
    rowDue: {
      display: 'flex', justifyContent: 'space-between', gap: '14px',
      fontSize: '15px', fontWeight: '800', color: gold,
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, paddingTop: '9px', marginTop: '9px',
    },
    discount: { color: gold, fontWeight: '700' },
    note: {
      marginTop: '12px', padding: '9px 11px', borderRadius: '9px',
      fontSize: '11.5px', lineHeight: 1.5, fontWeight: '600',
    },
    noteGood: {
      background: isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.09)',
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.38)' : 'rgba(184,121,10,0.32)'}`,
      color: gold,
    },
    noteBad: {
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    modeRow: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
      margin: '12px 0 4px',
    },
    modeBtn: (active) => ({
      display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'left',
      padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${active ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : 'transparent',
      color: isDark ? '#b0b3b8' : '#4b5563',
      fontSize: '11.5px', fontWeight: '600', fontFamily: 'inherit', lineHeight: 1.35,
    }),
    modeAmount: (active) => ({
      fontSize: '14px', fontWeight: '800',
      color: active ? gold : (isDark ? '#e4e6eb' : '#1a1a1a'),
    }),
  };

  return (
    <div style={mb.panel}>
      <div style={mb.panelHead}>
        <span style={mb.panelTitle}>Keep it longer</span>
        <button type="button" style={mb.panelClose} aria-label="Close" onClick={onClose}>×</button>
      </div>
      <div>
        <p style={s.sub}>
          Pick how much longer. The pickup and return time stay as they are, and you
          only pay for the extra days.
        </p>

        <div style={s.stepper}>
          <button
            type="button"
            aria-label="Fewer days"
            style={s.stepBtn(extraDays > 1)}
            disabled={extraDays <= 1}
            onClick={() => stepTo(extraDays - 1)}
          >
            −
          </button>
          <div>
            <div style={s.stepDays}>
              {extraDays ? `${extraDays} more day${extraDays === 1 ? '' : 's'}` : 'No extra days yet'}
            </div>
            <div style={s.stepExtra}>
              {quote && quote.forDate === newEnd
                ? `+ ${peso(Math.max(0, quote.now.totalPrice - quote.was.totalPrice))}`
                : 'Pick a day to see the price'}
            </div>
          </div>
          <button
            type="button"
            aria-label="More days"
            style={s.stepBtn(extraDays < maxStep)}
            disabled={extraDays >= maxStep}
            onClick={() => stepTo(extraDays ? extraDays + 1 : 1)}
          >
            +
          </button>
        </div>

        {newEnd && (
          <p style={{ ...s.newReturn, margin: '10px 0 0' }}>
            New return: <strong>{formatMoment(instantFrom(newEnd, hour), booking.hasPickupTime)}</strong>
          </p>
        )}
        {quote?.lateDays > 0 && (
          <p style={{ ...s.sub, margin: '6px 0 0' }}>
            This also covers the time it&apos;s already been late.
          </p>
        )}
        <div style={{ height: '12px' }} />

        <div style={s.current}>
          Currently returning <strong>{formatMoment(currentEnd, booking.hasPickupTime)}</strong>
          {' · '}{booking.totalDays} day{booking.totalDays === 1 ? '' : 's'}
        </div>

        {loading ? (
          <p style={s.sub}>Checking how far this vehicle is free…</p>
        ) : (
          <>
            <span style={s.label}>New return date</span>
            <AvailabilityCalendar
              bookedRanges={ranges}
              selectedStart={phYmd(booking.startDate)}
              selectedEnd={newEnd || phYmd(currentEnd)}
              onSelectDay={(date) => { if (selectableDay(date)) setNewEnd(toYmd(date)); }}
              isDark={isDark}
            />
            {latest && limits?.latestIsAConflict && (
              <p style={s.limitNote}>
                This vehicle is free up to {formatMoment(instantFrom(latest, hour), booking.hasPickupTime)}.
                {' '}Someone else has it after that.
              </p>
            )}
          </>
        )}

        {error && <div style={s.error}>{error}</div>}

        {quote && quote.forDate === newEnd && (
          <div style={s.breakdown}>
            <div style={s.row}>
              <span>{quote.newTotalDays} days × {peso(quote.pricePerDay)}</span>
              <span>{peso(quote.now.subtotal)}</span>
            </div>
            {quote.now.discountAmount > 0 && (
              <div style={s.row}>
                <span style={s.discount}>{quote.now.promoLabel}</span>
                <span style={s.discount}>−{peso(quote.now.discountAmount)}</span>
              </div>
            )}
            <div style={s.rowStrong}>
              <span>New total</span>
              <span>{peso(quote.now.totalPrice)}</span>
            </div>
            <div style={s.row}>
              <span>Was</span>
              <span>{peso(quote.was.totalPrice)}</span>
            </div>

            {/* Shown whole, then reduced, then charged. A fine that quietly
                arrives at half price changes nobody's mind — and changing
                minds is the entire reason for reducing it. */}
            {quote.lateDays > 0 && (
              <div style={s.lateBlock}>
                <div style={s.lateTitle}>
                  You are {quote.lateDays} day{quote.lateDays === 1 ? '' : 's'} overdue
                </div>
                <div style={s.row}>
                  <span>Late fee owed</span>
                  <span style={s.lateStruck}>{peso(quote.lateFeeFull)}</span>
                </div>
                <div style={s.row}>
                  <span>Reduced for extending</span>
                  <span style={s.lateNow}>{peso(quote.lateFeeDue)}</span>
                </div>
                <div style={s.lateNote}>
                  Included below, so nothing is left outstanding once this is paid.
                </div>
              </div>
            )}
            {options.length > 1 && (
              <div style={s.modeRow} role="group" aria-label="How to pay">
                <button
                  type="button"
                  aria-pressed={chosen === 'deposit'}
                  style={s.modeBtn(chosen === 'deposit')}
                  onClick={() => setMode('deposit')}
                >
                  Pay a deposit now
                  <span style={s.modeAmount(chosen === 'deposit')}>{peso(quote.payment.deposit.dueNow)}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={chosen === 'full'}
                  style={s.modeBtn(chosen === 'full')}
                  onClick={() => setMode('full')}
                >
                  Pay the extra days in full
                  <span style={s.modeAmount(chosen === 'full')}>{peso(quote.payment.full.dueNow)}</span>
                </button>
              </div>
            )}

            <div style={s.rowDue}>
              <span>Pay now to extend</span>
              <span>{peso(due?.dueNow)}</span>
            </div>
            {!quote.collected && due?.balanceAtPickup > 0 && (
              <div style={{ ...s.row, marginTop: '9px', marginBottom: 0 }}>
                <span>Bring at pickup</span>
                <span>{peso(due.balanceAtPickup)}</span>
              </div>
            )}

            {quote.discountGained && (
              <div style={{ ...s.note, ...s.noteGood }}>
                Going to {quote.newTotalDays} days earns you the {quote.now.promoLabel} — it comes off
                the whole booking, so the extra days cost less than the daily rate.
              </div>
            )}
            {quote.discountLost && (
              <div style={{ ...s.note, ...s.noteBad }}>
                Returning this late means your {quote.was.promoLabel} no longer covers the booking,
                so the total rises by more than the extra days alone.
              </div>
            )}
            {quote.collected && (
              <div style={{ ...s.note, ...s.noteGood }}>
                The extra days are charged at the standard daily rate. The days you already
                booked keep the price you agreed.
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          style={{ ...mb.panelSubmit(!busy && !!quote && quote.forDate === newEnd), width: '100%', marginTop: '14px' }}
          onClick={pay}
          disabled={busy || !quote || quote.forDate !== newEnd}
        >
          {busy ? 'Opening GCash…' : (quote && quote.forDate === newEnd) ? `Pay ${peso(due?.dueNow)} with GCash` : 'Pick a day'}
        </button>
      </div>
    </div>
  );
};

export default ExtendBookingPanel;
