import { useEffect, useState } from 'react';
import api from '../api';
import AvailabilityCalendar from './AvailabilityCalendar';
import { timeLeftLabel, offerReasonText } from '../utils/offerWindow';
import { formatMoment, phHour, phYmd, instantFrom, addDays } from '../utils/phTime';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

// Shown on a booking whose dates can no longer be honoured, in place of
// simply telling the client it was cancelled. The choice is theirs: one of
// the dates we can actually do, a date of their own, or their money back.
// Doing nothing refunds them when the deadline passes, which is why the
// countdown is on the panel rather than buried in the notification that
// brought them here.

const deadlineFmt = (d) => new Date(d).toLocaleString('en-US', {
  timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

const ClockIcon = ({ color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
  </svg>
);

const AdjustOfferPanel = ({ booking, isDark, onDecide, busy }) => {
  const offer = booking.adjustOffer;
  // Re-renders once a minute so the countdown doesn't sit there stale while
  // someone reads the page and thinks about it.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // The calendar for choosing a date of their own, loaded only if they ask
  // for it — most people take one of the three and never open this.
  const [picking, setPicking] = useState(false);
  const [ranges, setRanges] = useState([]);
  const [customStart, setCustomStart] = useState('');
  // A price rise the client has been shown and not yet answered.
  const [priceCheck, setPriceCheck] = useState(null);

  const carId = booking.car?._id || booking.car;
  useEffect(() => {
    if (!picking || !carId) return undefined;
    let cancelled = false;
    api.get(`/cars/${carId}/booked-dates`)
      .then((res) => { if (!cancelled) setRanges(res.data); })
      .catch(() => { if (!cancelled) setRanges([]); });
    return () => { cancelled = true; };
  }, [picking, carId]);

  const gold = isDark ? GOLD_DARK : GOLD;
  const options = offer?.options || [];
  const refundable = booking.payment === 'paid' ? booking.amountPaid : 0;
  const anyCostsMore = options.some((o) => o.totalPrice > booking.totalPrice);

  // The trip keeps its length and its hour, so choosing a pickup day is all
  // it takes — the return follows from it.
  const hour = booking.hasPickupTime ? phHour(booking.startDate) : 0;
  const customEnd = customStart
    ? phYmd(addDays(instantFrom(customStart, hour), booking.totalDays))
    : '';

  const decide = async (decision, payload) => {
    const result = await onDecide(decision, payload);
    // The dates are free, they just cost more than what this client agreed
    // to. Nothing has moved yet — they answer, and then it does.
    if (result?.needsPriceConfirmation) setPriceCheck({ ...result, payload });
    else setPriceCheck(null);
  };

  const s = {
    panel: {
      margin: '14px 0 0', padding: '16px 18px', borderRadius: '12px',
      border: `1px solid ${gold}`,
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
    },
    head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
    title: { fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    countdown: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.02em',
      color: isDark ? GOLD_DARK : '#92400e',
    },
    reason: { fontSize: '12.5px', lineHeight: 1.5, color: isDark ? '#b0b3b8' : '#4b5563', margin: '6px 0 0' },
    promoWarn: {
      margin: '10px 0 0', padding: '9px 12px', borderRadius: '9px',
      fontSize: '11.5px', lineHeight: 1.45, fontWeight: '600',
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    listLabel: {
      display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.14em',
      textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#6b7280', margin: '14px 0 6px',
    },
    option: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      flexWrap: 'wrap', padding: '10px 12px', borderRadius: '9px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      background: isDark ? '#242526' : '#ffffff',
      marginBottom: '8px',
    },
    optionDates: { fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    optionPrice: { fontSize: '11.5px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
    optionPriceUp: { fontSize: '11.5px', fontWeight: '700', color: isDark ? '#fca5a5' : '#b91c1c', marginTop: '2px' },
    takeBtn: {
      padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: busy ? 'default' : 'pointer',
      background: gold, color: ON_GOLD, fontSize: '12px', fontWeight: '800', fontFamily: 'inherit',
      opacity: busy ? 0.6 : 1,
    },
    ownLink: {
      display: 'inline-block', marginTop: '2px', padding: 0, border: 'none', background: 'none',
      color: gold, fontSize: '12px', fontWeight: '700', cursor: 'pointer',
      textDecoration: 'underline', fontFamily: 'inherit',
    },
    pickWrap: { marginTop: '10px' },
    pickSummary: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      flexWrap: 'wrap', marginTop: '10px',
    },
    pickDates: { fontSize: '12.5px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    refundRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      flexWrap: 'wrap', marginTop: '12px',
      paddingTop: '12px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    refundBtn: {
      padding: '8px 16px', borderRadius: '8px', cursor: busy ? 'default' : 'pointer',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`, background: 'transparent',
      color: isDark ? '#f87171' : '#dc2626', fontSize: '12px', fontWeight: '800', fontFamily: 'inherit',
      opacity: busy ? 0.6 : 1,
    },
    foot: { fontSize: '11px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#6b7280', margin: '10px 0 0' },
    checkBox: {
      padding: '14px 16px', borderRadius: '10px',
      background: isDark ? '#242526' : '#ffffff',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`,
    },
    checkTitle: { fontSize: '13px', fontWeight: '800', color: isDark ? '#fca5a5' : '#b91c1c' },
    checkBody: { fontSize: '12px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#4b5563', margin: '6px 0 0' },
    checkRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' },
    backBtn: {
      padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, background: 'transparent',
      color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
    },
  };

  // Everything else is hidden while this is up: it's one question with two
  // real answers, and leaving the other buttons live invites answering it
  // twice.
  if (priceCheck) {
    return (
      <div style={s.panel} role="region" aria-label="These dates cost more">
        <div style={s.checkBox}>
          <div style={s.checkTitle}>These dates cost ₱{priceCheck.extra.toLocaleString()} more</div>
          <p style={s.checkBody}>
            {priceCheck.promoLabel
              ? `Your ${priceCheck.promoLabel} discount only covers the dates you originally booked, so it doesn't reach `
              : 'The discount on your booking doesn’t reach '}
            {formatMoment(priceCheck.startDate, booking.hasPickupTime)} → {formatMoment(priceCheck.endDate, booking.hasPickupTime)}.
            {' '}Your total goes from <strong>₱{priceCheck.wasTotal.toLocaleString()}</strong> to{' '}
            <strong>₱{priceCheck.newTotal.toLocaleString()}</strong>. The extra ₱{priceCheck.extra.toLocaleString()} is
            added to what you bring at pickup — nothing more is taken from your GCash now.
            {' '}If you would rather not, take the full refund instead.
          </p>
          <div style={s.checkRow}>
            <button
              type="button"
              style={s.takeBtn}
              disabled={busy}
              onClick={() => decide('accept', { ...priceCheck.payload, confirmPrice: true })}
            >
              Yes, keep my booking
            </button>
            <button type="button" style={s.refundBtn} disabled={busy} onClick={() => decide('refund')}>
              No — refund {refundable > 0 ? `₱${refundable.toLocaleString()}` : 'me'}
            </button>
            <button type="button" style={s.backBtn} disabled={busy} onClick={() => setPriceCheck(null)}>
              Back to the dates
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.panel} role="region" aria-label="This booking needs a decision">
      <div style={s.head}>
        <span style={s.title}>Your booking needs a decision</span>
        <span style={s.countdown}>
          <ClockIcon color={isDark ? GOLD_DARK : '#92400e'} />
          {timeLeftLabel(offer.deadline, now)}
        </span>
      </div>

      <p style={s.reason}>{offerReasonText(offer.reason, offer.cause)}</p>

      {anyCostsMore && (
        <p style={s.promoWarn}>
          Your {booking.promoLabel || 'discount'} only covers the dates you originally booked, so moving
          costs more. You will see the exact amount before anything changes, and you can still take a
          full refund instead.
        </p>
      )}

      {options.length > 0 && (
        <>
          <span style={s.listLabel}>
            Dates we can still do — same {booking.totalDays}-day trip
          </span>
          {options.map((option, i) => {
            const costsMore = option.totalPrice > booking.totalPrice;
            return (
              <div key={`${option.startDate}-${i}`} style={s.option}>
                <div>
                  <div style={s.optionDates}>
                    {formatMoment(option.startDate, booking.hasPickupTime)} → {formatMoment(option.endDate, booking.hasPickupTime)}
                  </div>
                  <div style={costsMore ? s.optionPriceUp : s.optionPrice}>
                    {costsMore
                      ? `₱${option.totalPrice.toLocaleString()} — ₱${(option.totalPrice - booking.totalPrice).toLocaleString()} more`
                      : `₱${option.totalPrice.toLocaleString()} — same price as your booking`}
                  </div>
                </div>
                <button
                  type="button"
                  style={s.takeBtn}
                  disabled={busy}
                  onClick={() => decide('accept', { optionIndex: i })}
                >
                  Take these dates
                </button>
              </div>
            );
          })}
        </>
      )}

      {!picking ? (
        <button type="button" style={s.ownLink} onClick={() => setPicking(true)}>
          None of these suit — let me pick my own dates
        </button>
      ) : (
        <div style={s.pickWrap}>
          <span style={s.listLabel}>Pick your pickup day — it stays a {booking.totalDays}-day trip</span>
          <AvailabilityCalendar
            bookedRanges={ranges}
            selectedStart={customStart}
            selectedEnd={customEnd}
            onSelectDay={(date) => {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              setCustomStart(`${y}-${m}-${d}`);
            }}
            isDark={isDark}
          />
          <div style={s.pickSummary}>
            <span style={s.pickDates}>
              {customStart
                ? `${formatMoment(instantFrom(customStart, hour), booking.hasPickupTime)} → ${formatMoment(instantFrom(customEnd, hour), booking.hasPickupTime)}`
                : 'Tap a day on the calendar above.'}
            </span>
            <span style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{ ...s.takeBtn, opacity: busy || !customStart ? 0.6 : 1 }}
                disabled={busy || !customStart}
                onClick={() => decide('accept', { startDate: customStart })}
              >
                Take these dates
              </button>
              <button
                type="button"
                style={s.backBtn}
                disabled={busy}
                onClick={() => { setPicking(false); setCustomStart(''); }}
              >
                Cancel
              </button>
            </span>
          </div>
        </div>
      )}

      <div style={s.refundRow}>
        <span style={s.reason}>
          {refundable > 0
            ? 'Or take your money back — no deductions, this one is on us.'
            : 'Or cancel this booking. Nothing was charged, so there is nothing to refund.'}
        </span>
        <button type="button" style={s.refundBtn} disabled={busy} onClick={() => decide('refund')}>
          {refundable > 0 ? `Refund ₱${refundable.toLocaleString()}` : 'Cancel my booking'}
        </button>
      </div>

      <p style={s.foot}>
        If we don&apos;t hear from you by {deadlineFmt(offer.deadline)}, your booking is cancelled
        {refundable > 0 ? ' and refunded in full automatically.' : ' automatically.'}
      </p>
    </div>
  );
};

export default AdjustOfferPanel;
