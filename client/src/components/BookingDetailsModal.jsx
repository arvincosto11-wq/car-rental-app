import useModalA11y from '../hooks/useModalA11y';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

// Everything about a booking that's reference material rather than
// something admin needs to scan or act on every time — payment/refund
// reference IDs, resolved refund/reschedule history, booking metadata.
// Pulled out of Manage Bookings' table into this dialog so the table
// itself only shows what's actionable or glanceable at a row level.
// "Mark Balance Received" lives here too, not in the row — with several
// downpayment bookings on screen at once it was the same gold button
// repeated down the whole Actions column, which read as noisier than the
// stuff we'd just moved out.
const BookingDetailsModal = ({ booking, isDark, onClose, onCollectBalance }) => {
  const modalRef = useModalA11y(onClose);
  if (!booking) return null;

  const s = {
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '460px', width: '100%', maxHeight: '85vh', overflowY: 'auto' },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    modalSubtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
    closeBtn: { background: 'none', border: 'none', fontSize: '20px', lineHeight: 1, color: isDark ? '#b0b3b8' : '#6b7280', cursor: 'pointer', padding: '2px' },
    section: { marginBottom: '18px' },
    sectionTitle: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px' },
    row: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '5px 0', fontSize: '13px', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}` },
    label: { color: isDark ? '#b0b3b8' : '#6b7280', flexShrink: 0 },
    value: { color: isDark ? '#e4e6eb' : '#1a1a1a', textAlign: 'right', wordBreak: 'break-word' },
    mono: { fontFamily: 'monospace', fontSize: '11px' },
    collectBtn: {
      display: 'block', width: '100%', marginTop: '10px', padding: '8px 12px', fontSize: '13px', border: 'none', borderRadius: '8px',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer', fontWeight: '600',
    },
  };

  const Row = ({ label, value, mono }) => (
    <div style={s.row}>
      <span style={s.label}>{label}</span>
      <span style={{ ...s.value, ...(mono ? s.mono : {}) }}>{value}</span>
    </div>
  );

  const remaining = booking.totalPrice - booking.amountPaid;

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div
        style={s.modalContent}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-details-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={s.headerRow}>
          <div>
            <h2 id="booking-details-modal-title" style={s.modalTitle}>Booking Details</h2>
            <p style={s.modalSubtitle}>{booking.user?.name || 'Unknown'} · {booking.car?.brand} {booking.car?.model}</p>
          </div>
          <button type="button" className="icon-toggle-btn" style={s.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div style={s.section}>
          <div style={s.sectionTitle}>Payment</div>
          <Row label="Type" value={booking.paymentType === 'downpayment' ? '20% Downpayment' : 'Full payment'} />
          <Row label="Total price" value={`₱${booking.totalPrice.toLocaleString()}`} />
          <Row label="Paid so far" value={`₱${booking.amountPaid.toLocaleString()}`} />
          {remaining > 0 && <Row label="Remaining balance" value={`₱${remaining.toLocaleString()}`} />}
          {booking.paymongoPaymentId && <Row label="Payment reference" value={booking.paymongoPaymentId} mono />}
          {remaining > 0 && booking.status !== 'cancelled' && (
            <button type="button" style={s.collectBtn} onClick={() => onCollectBalance(booking)}>
              Mark Balance Received
            </button>
          )}
        </div>

        {booking.refundStatus !== 'none' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Refund</div>
            <Row label="Status" value={booking.refundStatus} />
            <Row label="Amount" value={`₱${(booking.refundAmount ?? 0).toLocaleString()}`} />
            {booking.refundReason && <Row label="Reason" value={booking.refundReason} />}
            {booking.paymongoRefundId && <Row label="Refund reference" value={booking.paymongoRefundId} mono />}
          </div>
        )}

        {booking.rescheduleRequest?.status !== 'none' && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Reschedule</div>
            <Row label="Status" value={booking.rescheduleRequest.status} />
            {booking.rescheduleRequest.newStartDate && (
              <Row
                label="Requested dates"
                value={`${new Date(booking.rescheduleRequest.newStartDate).toLocaleDateString()} to ${new Date(booking.rescheduleRequest.newEndDate).toLocaleDateString()}`}
              />
            )}
            {booking.rescheduleRequest.reason && <Row label="Reason" value={booking.rescheduleRequest.reason} />}
            {booking.rescheduleRequest.adminNotes && <Row label="Admin notes" value={booking.rescheduleRequest.adminNotes} />}
          </div>
        )}

        <div style={s.section}>
          <div style={s.sectionTitle}>Booking Info</div>
          <Row label="Booking type" value={booking.bookingType === 'self-drive' ? 'Self drive' : 'With driver'} />
          <Row label="Booking ID" value={booking._id} mono />
          <Row label="Requested on" value={new Date(booking.createdAt).toLocaleString()} />
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;
