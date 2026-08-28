import { useState, useEffect } from 'react';
import api from '../api';
import StarRating from './StarRating';

// Shared "rate this client" modal for admin, used by both the Manage
// Bookings table and the dedicated Rate Clients panel.
const ClientRatingModal = ({ booking, isDark, onClose, onSubmitted }) => {
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setValue(booking.clientRating?.rating || 0);
    setComment(booking.clientRating?.comment || '');
    setError('');
  }, [booking]);

  if (!booking) return null;

  const handleSubmit = async () => {
    if (!value) {
      setError('Please select a rating.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/bookings/${booking._id}/rate-client`, { rating: value, comment });
      onSubmitted(res.data.clientRating);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const s = {
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '14px' },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#f1f5f9' : '#1a1a1a', background: isDark ? '#0f172a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    errorBox: { background: '#fef2f2', color: '#dc2626', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  return (
    <div style={s.modalOverlay}>
      <div style={s.modalContent}>
        <h2 style={s.modalTitle}>Rate {booking.user?.name || 'Client'}</h2>

        {error && <div style={s.errorBox}>{error}</div>}

        <label style={s.modalLabel}>How did the client return the vehicle?</label>
        <div style={{ marginBottom: '18px' }}>
          <StarRating value={value} onChange={setValue} size={24} />
        </div>

        <label style={s.modalLabel}>Comment (optional)</label>
        <textarea
          style={s.modalTextarea}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="e.g. Returned the car clean and on time."
        />

        <div style={s.modalActions}>
          <button style={s.modalCancelBtn} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button style={s.modalSubmitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientRatingModal;
