import useModalA11y from '../hooks/useModalA11y';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

// Shown when a customer comes back from GCash. It replaced a toast, which
// vanished after a few seconds — right when someone has just sent real money
// and most wants proof of what happened.
//
// Three states, because returning from GCash doesn't always mean paid:
//   paid      the payment came through
//   checking  GCash hasn't reported back yet (the callback can lag), so the
//             screen says so instead of claiming success early
//   cancelled they left GCash without paying; the booking is still saved
//
// The wording never says "confirmed": paying doesn't confirm a booking here,
// admin still has to. Claiming otherwise would be a lie the customer finds
// out about later.

const TickIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="5 12.5 10 17.5 19 7" />
  </svg>
);
const AlertIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><line x1="12" y1="7.5" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" />
  </svg>
);

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;
const dayWord = (n) => (n === 1 ? 'day' : 'days');
const longDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

const BookingConfirmationModal = ({ booking, status, isDark, onClose, onCheckAgain, onRetryPayment, retrying }) => {
  const modalRef = useModalA11y(onClose);
  if (!booking) return null;

  const paid = status === 'paid';
  const checking = status === 'checking';
  const balance = Math.max(0, (booking.totalPrice || 0) - (booking.amountPaid || 0));
  const dueNow = booking.paymentType === 'full' ? booking.totalPrice : Math.ceil((booking.totalPrice || 0) * 0.2);
  const gold = isDark ? GOLD_DARK : GOLD;
  const ok = isDark ? '#4ade80' : '#15803d';
  const warn = isDark ? '#fbbf24' : '#92400e';

  const copy = {
    paid: {
      headline: 'Your booking is on its way for approval!',
      blurb: `We've received your ${peso(booking.amountPaid)} payment. Our team is reviewing your booking now, `
        + "and you'll get a notification the moment it's confirmed.",
      primary: 'Got it',
      secondary: null,
    },
    checking: {
      headline: "We're confirming your payment…",
      blurb: "GCash hasn't reported back yet — this usually takes a few seconds. Your booking is saved either way, "
        + 'so nothing is lost.',
      primary: 'Check again',
      secondary: "I'll check later",
    },
    cancelled: {
      headline: 'Payment was not completed',
      blurb: 'You left GCash before paying, so nothing was charged. Your booking is still saved and holds these '
        + 'dates for now.',
      primary: `Pay ${peso(dueNow)} with GCash`,
      secondary: 'Not now',
    },
  }[status] || {};

  const s = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto',
    },
    shell: {
      width: '100%', maxWidth: '880px', outline: 'none',
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '24px', overflow: 'hidden', boxShadow: '0 30px 70px rgba(0,0,0,0.3)',
    },
    left: {
      background: isDark ? '#1c1d1e' : '#f6f7f9',
      borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      padding: '40px 32px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px',
    },
    seal: {
      width: '72px', height: '72px', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2.5px solid ${paid ? ok : checking ? gold : warn}`,
      color: paid ? ok : checking ? gold : warn,
      background: paid
        ? (isDark ? 'rgba(22,163,74,0.16)' : '#dcfce7')
        : checking
          ? (isDark ? GOLD_TINT_DARK : GOLD_TINT)
          : (isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7'),
    },
    spinner: {
      width: '28px', height: '28px', borderRadius: '50%',
      border: `3px solid ${isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)'}`,
      borderTopColor: gold,
    },
    headline: { margin: 0, fontSize: '21px', fontWeight: '800', letterSpacing: '-0.01em', lineHeight: 1.25, maxWidth: '15ch', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    blurb: { margin: 0, fontSize: '13px', lineHeight: 1.6, color: isDark ? '#8a8d91' : '#9ca3af', maxWidth: '34ch' },
    btns: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '260px', marginTop: '10px' },
    primaryBtn: {
      padding: '12px 18px', borderRadius: '14px', border: 'none', cursor: 'pointer',
      fontSize: '13.5px', fontWeight: '800', background: gold, color: ON_GOLD,
      boxShadow: `0 6px 18px ${isDark ? 'rgba(232,161,0,0.3)' : 'rgba(184,121,10,0.28)'}`,
    },
    ghostBtn: {
      padding: '12px 18px', borderRadius: '14px', border: '1px solid transparent', cursor: 'pointer',
      fontSize: '13.5px', fontWeight: '800', background: 'none', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    right: { position: 'relative', padding: '32px', minWidth: 0 },
    close: {
      position: 'absolute', top: '18px', right: '18px', width: '30px', height: '30px', borderRadius: '50%',
      border: 'none', cursor: 'pointer', fontSize: '13px',
      background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#8a8d91' : '#9ca3af',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    title: { margin: '0 0 22px', fontSize: '18px', fontWeight: '800', letterSpacing: '-0.01em', paddingRight: '36px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    pairKey: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af' },
    pairVal: { fontSize: '14px', fontWeight: '700', marginTop: '1px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    rule: { height: '1px', background: isDark ? '#303132' : '#eef0f2', margin: '20px 0' },
    line: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px',
      fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '11px',
    },
    num: { fontVariantNumeric: 'tabular-nums', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    grand: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' },
    grandKey: { fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    grandVal: { fontSize: '26px', fontWeight: '900', letterSpacing: '-0.02em', color: gold, fontVariantNumeric: 'tabular-nums' },
    ref: { marginTop: '18px', fontSize: '11px', fontFamily: 'ui-monospace, Consolas, monospace', wordBreak: 'break-all', color: isDark ? '#8a8d91' : '#9ca3af' },
  };

  const onPrimary = () => {
    if (checking) return onCheckAgain();
    if (status === 'cancelled') return onRetryPayment();
    return onClose();
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div
        ref={modalRef}
        tabIndex={-1}
        style={s.shell}
        className="booking-confirm-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-confirm-title"
      >
        <div className="booking-confirm-left" style={s.left}>
          <div className="booking-confirm-seal" style={s.seal}>
            {checking
              ? <span className="booking-confirm-spin" style={s.spinner} />
              : paid ? <TickIcon /> : <AlertIcon />}
          </div>
          <h2 id="booking-confirm-title" style={s.headline}>{copy.headline}</h2>
          <p style={s.blurb}>{copy.blurb}</p>
          <div style={s.btns}>
            <button type="button" style={s.primaryBtn} onClick={onPrimary} disabled={retrying}>
              {retrying ? 'Redirecting…' : copy.primary}
            </button>
            {copy.secondary && (
              <button type="button" className="text-link-btn" style={s.ghostBtn} onClick={onClose}>
                {copy.secondary}
              </button>
            )}
          </div>
        </div>

        <div style={s.right}>
          <button type="button" className="icon-toggle-btn" style={s.close} onClick={onClose} aria-label="Close">✕</button>
          <h3 style={s.title}>Booking Summary</h3>

          <div style={{ marginBottom: '14px' }}>
            <div style={s.pairKey}>Vehicle</div>
            <div style={s.pairVal}>
              {booking.car?.brand} {booking.car?.model} · {booking.car?.year} · {booking.car?.category}
            </div>
          </div>
          <div>
            <div style={s.pairKey}>Booking type</div>
            <div style={s.pairVal}>{booking.bookingType === 'self-drive' ? 'Self Drive' : 'With Driver'}</div>
          </div>

          <div style={s.rule} />

          <div style={s.line}><span>Pickup</span><span style={s.num}>{longDate(booking.startDate)}</span></div>
          <div style={s.line}><span>Return</span><span style={s.num}>{longDate(booking.endDate)}</span></div>
          <div style={{ ...s.line, color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '800' }}>
            <span>Duration</span><span style={s.num}>{booking.totalDays} {dayWord(booking.totalDays)}</span>
          </div>

          <div style={s.rule} />

          <div style={s.line}>
            <span>{booking.totalDays} {dayWord(booking.totalDays)} × {peso(booking.car?.pricePerDay)}</span>
            <span style={s.num}>{peso(booking.subtotal || booking.totalPrice)}</span>
          </div>
          {booking.discountAmount > 0 && (
            // Gold, not red: red is for money lost (refunds, cancellations),
            // and a discount is money saved.
            <div style={{ ...s.line, color: gold, fontWeight: '700' }}>
              <span>{booking.promoLabel || 'Discount'}</span>
              <span style={{ ...s.num, color: gold }}>−{peso(booking.discountAmount)}</span>
            </div>
          )}
          <div style={{ ...s.line, color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '800' }}>
            <span>Total</span><span style={s.num}>{peso(booking.totalPrice)}</span>
          </div>
          {paid && booking.amountPaid > 0 && (
            <div style={{ ...s.line, color: ok, fontWeight: '700' }}>
              <span>Paid with GCash</span>
              <span style={{ ...s.num, color: ok }}>{peso(booking.amountPaid)}</span>
            </div>
          )}

          <div style={s.rule} />

          <div style={s.grand}>
            <span style={s.grandKey}>
              {!paid ? 'Due now' : balance > 0 ? 'Bring at pickup' : 'Paid in full'}
            </span>
            <span style={s.grandVal}>{peso(!paid ? dueNow : balance > 0 ? balance : booking.totalPrice)}</span>
          </div>

          <div style={s.ref}>
            {booking.paymongoPaymentId
              ? `Reference: ${booking.paymongoPaymentId}`
              : checking
                ? 'Awaiting confirmation from GCash'
                : 'No payment received yet'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmationModal;
