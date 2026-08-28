import { useState, useEffect } from 'react';
import api from '../api';
import StarRating from './StarRating';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import useModalA11y from '../hooks/useModalA11y';

// Shared "rate your experience" modal, used by both the My Bookings list
// and the dedicated Rate My Bookings panel so the rating flow only lives
// in one place.
const uploadToImageKit = async (file) => {
  const authRes = await api.get('/imagekit/user-auth');
  const { token, expire, signature, publicKey } = authRes.data;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', file.name);
  formData.append('token', token);
  formData.append('expire', expire);
  formData.append('signature', signature);
  formData.append('publicKey', publicKey);
  const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
  const data = await uploadRes.json();
  return { url: data.url, fileId: data.fileId };
};

const RatingModal = ({ booking, isDark, onClose, onSubmitted }) => {
  const [form, setForm] = useState({ vehicleCondition: 0, serviceQuality: 0, cleanliness: 0, comment: '' });
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!booking) return;
    setForm({
      vehicleCondition: booking.carRating?.vehicleCondition || 0,
      serviceQuality: booking.carRating?.serviceQuality || 0,
      cleanliness: booking.carRating?.cleanliness || 0,
      comment: booking.carRating?.comment || '',
    });
    setPhotos((booking.carRating?.photos || []).map((p) => ({ id: p.url, url: p.url, fileId: p.fileId })));
    setError('');
  }, [booking]);

  const modalRef = useModalA11y(onClose);

  if (!booking) return null;

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files.map((file) => ({ id: URL.createObjectURL(file), file, preview: URL.createObjectURL(file) }))]);
  };

  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));

  const handleSubmit = async () => {
    const { vehicleCondition, serviceQuality, cleanliness, comment } = form;
    if (!vehicleCondition || !serviceQuality || !cleanliness) {
      setError('Please rate all three categories.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const uploadedPhotos = [];
      for (const p of photos) {
        if (p.file) {
          uploadedPhotos.push(await uploadToImageKit(p.file));
        } else {
          uploadedPhotos.push({ url: p.url, fileId: p.fileId });
        }
      }
      const res = await api.post(`/bookings/${booking._id}/rate-car`, {
        vehicleCondition, serviceQuality, cleanliness, comment, photos: uploadedPhotos,
      });
      onSubmitted(res.data.carRating);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const s = {
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modalContent: {
      background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px',
      maxWidth: '440px', width: '90%',
    },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '14px' },
    errorBox: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', fontSize: '13px',
      padding: '10px 14px', borderRadius: '8px', marginBottom: '14px',
    },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#f1f5f9' : '#1a1a1a',
      fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff',
    },
    photoUpload: {
      position: 'relative', width: '100%', height: '70px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      background: isDark ? '#0f172a' : '#fff', marginBottom: '10px',
    },
    photoUploadHint: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    photoFileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: '8px', marginBottom: '18px' },
    photoThumbWrap: { position: 'relative', width: '100%', height: '56px', borderRadius: '8px', overflow: 'hidden' },
    photoThumb: { width: '100%', height: '100%', objectFit: 'cover' },
    removePhotoBtn: {
      position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%',
      border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '12px', lineHeight: '18px', cursor: 'pointer', padding: 0,
    },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: {
      flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151',
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500',
    },
    modalSubmitBtn: {
      flex: 1, padding: '10px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600',
    },
  };

  return (
    <div style={s.modalOverlay}>
      <div style={s.modalContent} ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="rating-modal-title">
        <h2 id="rating-modal-title" style={s.modalTitle}>Rate Your Experience</h2>

        {error && <div style={s.errorBox}>{error}</div>}

        {[
          { key: 'vehicleCondition', label: 'Vehicle Condition' },
          { key: 'serviceQuality', label: 'Service Quality' },
          { key: 'cleanliness', label: 'Cleanliness' },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: '14px' }} role="group" aria-label={label}>
            <label style={s.modalLabel}>{label}</label>
            <StarRating
              value={form[key]}
              onChange={(n) => setForm({ ...form, [key]: n })}
              size={22}
            />
          </div>
        ))}

        <label style={s.modalLabel} htmlFor="rating-comment">Comment (optional)</label>
        <textarea
          id="rating-comment"
          style={s.modalTextarea}
          rows={3}
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder="Tell us more about your experience..."
        />

        <label style={s.modalLabel} htmlFor="rating-photos">Photos (optional)</label>
        <div style={s.photoUpload}>
          <span style={s.photoUploadHint}>📷 Click to add photos</span>
          <input id="rating-photos" type="file" accept="image/*" multiple style={s.photoFileInput} onChange={handlePhotosChange} />
        </div>
        {photos.length > 0 && (
          <div style={s.photoGrid}>
            {photos.map((p, i) => (
              <div key={p.id} style={s.photoThumbWrap}>
                <img src={p.preview || p.url} alt={`Review photo ${i + 1}`} style={s.photoThumb} />
                <button type="button" style={s.removePhotoBtn} onClick={() => removePhoto(p.id)} aria-label={`Remove photo ${i + 1}`}>×</button>
              </div>
            ))}
          </div>
        )}

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

export default RatingModal;
