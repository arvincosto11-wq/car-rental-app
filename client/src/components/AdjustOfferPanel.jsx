import { useEffect, useState } from 'react';
import { timeLeftLabel, offerReasonText } from '../utils/offerWindow';
import { formatMoment } from '../utils/phTime';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

// Shown on a booking whose dates can no longer be honoured, in place of
// simply telling the client it was cancelled. The choice is theirs: one of
// the dates we can actually do, or their money back. Doing nothing refunds
// them when the deadline passes, which is why the countdown is on the panel
// rather than buried in the notification that brought them here.

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

  const gold = isDark ? GOLD_DARK : GOLD;
  const options = offer?.options || [];
  const refundable = booking.payment === 'paid' ? booking.amountPaid : 0;

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
      background: gold, color: ON_GOLD, fontSize: '12px', fontWeight: '800',
      opacity: busy ? 0.6 : 1,
    },
    refundRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      flexWrap: 'wrap', marginTop: '12px',
      paddingTop: '12px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    refundBtn: {
      padding: '8px 16px', borderRadius: '8px', cursor: busy ? 'default' : 'pointer',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`, background: 'transparent',
      color: isDark ? '#f87171' : '#dc2626', fontSize: '12px', fontWeight: '800',
      opacity: busy ? 0.6 : 1,
    },
    foot: { fontSize: '11px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#6b7280', margin: '10px 0 0' },
  };

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

      {options.length > 0 && (
        <>
          <span style={s.listLabel}>
            Dates we can still do — same {booking.totalDays}-day trip
          </span>
          {options.map((option, i) => {
            // The only way an alternative costs more is a date-window promo
            // that doesn't reach the new dates. Said plainly and up front,
            // because finding out afterwards is how people lose trust.
            const costsMore = option.totalPrice > booking.totalPrice;
            return (
              <div key={`${option.startDate}-${i}`} style={s.option}>
                <div>
                  <div style={s.optionDates}>
                    {formatMoment(option.startDate, booking.hasPickupTime)} → {formatMoment(option.endDate, booking.hasPickupTime)}
                  </div>
                  <div style={costsMore ? s.optionPriceUp : s.optionPrice}>
                    {costsMore
                      ? `₱${option.totalPrice.toLocaleString()} — ₱${(option.totalPrice - booking.totalPrice).toLocaleString()} more, as ${booking.promoLabel || 'your promo'} doesn't cover these dates`
                      : `₱${option.totalPrice.toLocaleString()} — same price as your booking`}
                  </div>
                </div>
                <button
                  type="button"
                  style={s.takeBtn}
                  disabled={busy}
                  onClick={() => onDecide('accept', i)}
                >
                  Take these dates
                </button>
              </div>
            );
          })}
        </>
      )}

      <div style={s.refundRow}>
        <span style={s.reason}>
          {refundable > 0
            ? 'Or take your money back — no deductions, this one is on us.'
            : 'Or cancel this booking. Nothing was charged, so there is nothing to refund.'}
        </span>
        <button type="button" style={s.refundBtn} disabled={busy} onClick={() => onDecide('refund')}>
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
