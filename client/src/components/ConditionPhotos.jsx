import { useState } from 'react';
import api from '../api';
import { GOLD, GOLD_DARK } from '../theme';

// The walkaround, at either end of a rental.
//
// Section 4 of the terms makes the renter liable for damage during the
// rental period, which was unarguable in principle and unprovable in
// practice: nothing recorded what the vehicle looked like when it left, so
// "it was already like that" was a claim nobody could answer. A handful of
// photos taken before the keys go over settles it in advance, which is
// better than settling it afterwards.
//
// Used by the Pickup Desk and by the return form, so the two ends of a
// booking are recorded the same way and neither grows its own version.

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
  if (!data.url) throw new Error(data.message || 'Upload failed');
  return data.url;
};

const ConditionPhotos = ({ id, label, photos, onChange, isDark, disabled }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    // Clearing it means picking the same file twice in a row still fires.
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const urls = [];
      for (const file of files) urls.push(await uploadToImageKit(file));
      onChange([...photos, ...urls]);
    } catch (err) {
      console.error(err);
      // Named rather than shrugged at: these are evidence, and somebody
      // needs to know they did not land before the vehicle leaves.
      setError('Those photos did not upload. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const s = {
    label: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', margin: '12px 0 7px',
    },
    drop: {
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '12px', borderRadius: '10px', cursor: disabled || busy ? 'default' : 'pointer',
      border: `1px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '12px',
      opacity: disabled ? 0.5 : 1,
    },
    input: {
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      opacity: 0, cursor: 'pointer',
    },
    grid: { display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '8px' },
    thumbWrap: { position: 'relative', width: '86px', height: '64px' },
    thumb: {
      width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, cursor: 'zoom-in',
    },
    remove: {
      position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px',
      borderRadius: '50%', border: 'none', cursor: 'pointer', lineHeight: 1,
      background: isDark ? '#f87171' : '#dc2626', color: '#fff', fontSize: '13px', fontWeight: '700',
    },
    error: { fontSize: '11px', fontWeight: '700', color: isDark ? '#f87171' : '#dc2626', marginTop: '6px' },
    count: { fontSize: '11px', color: isDark ? GOLD_DARK : GOLD, fontWeight: '700', marginTop: '6px' },
  };

  return (
    <div>
      <div style={s.label}>{label}</div>
      <div style={s.drop}>
        {busy ? 'Uploading…' : '📷 Add photos of the vehicle'}
        <input
          id={id}
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || busy}
          style={s.input}
          onChange={addFiles}
          aria-label={label}
        />
      </div>
      {error && <div style={s.error}>{error}</div>}
      {photos.length > 0 && (
        <>
          <div style={s.grid}>
            {photos.map((url, i) => (
              <div key={url} style={s.thumbWrap}>
                <img
                  src={url}
                  alt={`${label} ${i + 1}`}
                  style={s.thumb}
                  onClick={() => window.open(url, '_blank', 'noopener')}
                />
                <button
                  type="button"
                  style={s.remove}
                  onClick={() => onChange(photos.filter((p) => p !== url))}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div style={s.count}>{photos.length} photo{photos.length === 1 ? '' : 's'} recorded</div>
        </>
      )}
    </div>
  );
};

export default ConditionPhotos;
