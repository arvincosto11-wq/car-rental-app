import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import LAYERS from '../layers';
import useModalA11y from '../hooks/useModalA11y';
import { RatingFormFields } from './RatingForm';
import { useRatingForm } from '../utils/ratingForm';

// The rating as a dialog, for the Rate My Bookings page, where there is
// no booking on screen to put it inside. My Bookings opens the same form
// inline instead — see ratePanel there. Both share RatingForm, so the
// three scores, the photos and the driver can't drift apart.
const RatingModal = ({ booking, isDark, onClose, onSubmitted }) => {
  const r = useRatingForm(booking);
  const modalRef = useModalA11y(onClose);

  if (!booking) return null;

  const s = {
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: LAYERS.modal,
    },
    modalContent: {
      background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px',
      maxWidth: '440px', width: '90%', maxHeight: '90vh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: 0 },
    errorBox: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626',
      fontSize: '13px', padding: '10px 14px', borderRadius: '8px',
    },
    modalActions: { display: 'flex', gap: '10px', marginTop: '2px' },
    modalCancelBtn: {
      flex: 1, minHeight: '44px', background: isDark ? '#3a3b3c' : '#f3f4f6',
      color: isDark ? '#e4e6eb' : '#374151',
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
    },
    modalSubmitBtn: {
      flex: 1, minHeight: '44px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600',
    },
  };

  return (
    <div style={s.modalOverlay}>
      <div style={s.modalContent} ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="rating-modal-title">
        <h2 id="rating-modal-title" style={s.modalTitle}>Rate your trip</h2>

        {r.error && <div style={s.errorBox}>{r.error}</div>}

        <RatingFormFields
          r={r}
          booking={booking}
          isDark={isDark}
          surface={isDark ? '#18191a' : '#fff'}
        />

        <div style={s.modalActions}>
          <button type="button" style={s.modalCancelBtn} onClick={onClose} disabled={r.submitting}>
            Cancel
          </button>
          <button type="button" style={s.modalSubmitBtn} onClick={() => r.submit(onSubmitted)} disabled={r.submitting}>
            {r.submitting ? 'Sending…' : 'Send rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RatingModal;
