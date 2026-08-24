import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

const Dashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [validIdImage, setValidIdImage] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchBookings();
    fetchProfile();
  }, [user]);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/my');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = () => {
    setForm({
      name: profile.name || '',
      phone: profile.phone || '',
      address: profile.address || '',
      licenseNumber: profile.licenseNumber || '',
      licenseExpiry: profile.licenseExpiry ? profile.licenseExpiry.split('T')[0] : '',
      emergencyContactName: profile.emergencyContactName || '',
      emergencyContactNumber: profile.emergencyContactNumber || '',
    });
    setValidIdImage(null);
    setValidIdPreview('');
    setSaveError('');
    setSaveSuccess('');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaveError('');
  };

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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      const payload = { ...form };
      if (validIdImage) {
        const uploaded = await uploadToImageKit(validIdImage);
        payload.validIdImage = uploaded.url;
        payload.validIdImageFileId = uploaded.fileId;
      }
      const res = await api.put('/auth/me', payload);
      setProfile(res.data);
      setEditMode(false);
      setSaveSuccess('Profile updated.');
      setTimeout(() => setSaveSuccess(''), 3000);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Something went wrong saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const pending = bookings.filter((b) => b.status === 'pending').length;

  const getStatusStyle = (status) => {
    if (status === 'confirmed') return s.badgeConfirmed;
    if (status === 'cancelled') return s.badgeCancelled;
    return s.badgePending;
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    statLabel: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '26px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    sectionTitle: { fontSize: '18px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '16px' },
    card: { display: 'flex', gap: '16px', background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px', alignItems: 'center' },
    imgWrap: { width: '100px', height: '70px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af' },
    info: { flex: 1 },
    topRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
    bookingNum: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    meta: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '4px' },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginTop: '6px' },
    carSub: { fontWeight: '400', fontSize: '12px', color: isDark ? '#64748b' : '#6b7280' },
    priceCol: { textAlign: 'right', minWidth: '100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    priceLabel: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    price: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    bookedOn: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    badgePending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    badgeConfirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    badgeCancelled: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    browseBtn: { marginTop: '16px', padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
    profileCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '20px', marginBottom: '28px' },
    profileHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
    editBtn: { padding: '7px 16px', fontSize: '13px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer', fontWeight: '500' },
    cancelBtn: { padding: '9px 18px', fontSize: '13px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', background: 'none', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer', fontWeight: '500' },
    saveBtn: { padding: '9px 18px', fontSize: '13px', border: 'none', borderRadius: '8px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: '600' },
    profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' },
    profileItem: { background: isDark ? '#0f172a' : '#f9fafb', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    profileLabel: { display: 'block', fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '3px' },
    profileValue: { fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', fontWeight: '500' },
    verifiedTag: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    unverifiedTag: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    idThumb: { width: '100%', maxWidth: '220px', height: '110px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, marginTop: '8px' },
    field: { marginBottom: '14px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    upload: { position: 'relative', width: '100%', maxWidth: '260px', height: '120px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
    uploadPlaceholder: { textAlign: 'center', padding: '12px', fontSize: '12px', color: isDark ? '#64748b' : '#6b7280' },
    uploadPreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    formError: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    formSuccess: { background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>My Dashboard</h1>
        <p style={s.subtitle}>Welcome back, {user?.name}! Here's your booking overview.</p>

        {saveSuccess && <div style={s.formSuccess}>{saveSuccess}</div>}

        <div style={s.profileCard}>
          <div style={s.profileHeaderRow}>
            <div style={s.sectionTitle}>My Profile</div>
            {!editMode && profile && (
              <button style={s.editBtn} onClick={startEdit}>Edit Profile</button>
            )}
          </div>

          {!profile ? (
            <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
          ) : !editMode ? (
            <>
              <div style={s.profileGrid}>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Full Name</span>
                  <span style={s.profileValue}>{profile.name}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Email</span>
                  <span style={s.profileValue}>{profile.email}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Phone</span>
                  <span style={s.profileValue}>{profile.phone || '—'}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Address</span>
                  <span style={s.profileValue}>{profile.address || '—'}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>License Number</span>
                  <span style={s.profileValue}>{profile.licenseNumber || '—'}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>License Expiry</span>
                  <span style={s.profileValue}>
                    {profile.licenseExpiry ? new Date(profile.licenseExpiry).toLocaleDateString() : '—'}
                  </span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Emergency Contact</span>
                  <span style={s.profileValue}>{profile.emergencyContactName || '—'}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Emergency Contact Number</span>
                  <span style={s.profileValue}>{profile.emergencyContactNumber || '—'}</span>
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <span style={s.profileLabel}>Valid ID</span>
                <div style={{ marginTop: '6px' }}>
                  <span style={profile.idVerified ? s.verifiedTag : s.unverifiedTag}>
                    {profile.idVerified ? 'ID Verified' : 'Not Verified'}
                  </span>
                </div>
                {profile.validIdImage && (
                  <img src={profile.validIdImage} alt="Valid ID" style={s.idThumb} />
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSave}>
              {saveError && <div style={s.formError}>{saveError}</div>}

              <div style={s.field}>
                <label style={s.label}>Full Name</label>
                <input style={s.input} type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>

              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Phone Number</label>
                  <input style={s.input} type="tel" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Address</label>
                  <input style={s.input} type="text" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>

              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>License Number</label>
                  <input style={s.input} type="text" value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>License Expiry</label>
                  <input style={s.input} type="date" value={form.licenseExpiry}
                    onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
                </div>
              </div>

              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Emergency Contact Name</label>
                  <input style={s.input} type="text" value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Emergency Contact Number</label>
                  <input style={s.input} type="tel" value={form.emergencyContactNumber}
                    onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })} />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Valid ID (leave as is, or upload a new photo)</label>
                <div style={s.upload}>
                  {validIdPreview ? (
                    <img src={validIdPreview} alt="New ID preview" style={s.uploadPreview} />
                  ) : profile.validIdImage ? (
                    <img src={profile.validIdImage} alt="Current ID" style={s.uploadPreview} />
                  ) : (
                    <div style={s.uploadPlaceholder}>Click to upload a photo of your ID</div>
                  )}
                  <input type="file" accept="image/*" style={s.fileInput}
                    onChange={(e) => { const f = e.target.files[0]; if (f) { setValidIdImage(f); setValidIdPreview(URL.createObjectURL(f)); } }} />
                </div>
                {validIdImage && (
                  <p style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '6px' }}>
                    Uploading a new ID will require admin re-verification.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button type="submit" style={s.saveBtn} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" style={s.cancelBtn} onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Total Bookings</div>
            <div style={s.statNum}>{bookings.length}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Confirmed</div>
            <div style={s.statNum}>{confirmed}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Total Spent</div>
            <div style={s.statNum}>${totalSpent}</div>
          </div>
        </div>

        <div style={s.sectionTitle}>Booking History</div>

        {loading ? (
          <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
        ) : bookings.length === 0 ? (
          <div style={s.empty}>
            <p>No bookings yet.</p>
            <button style={s.browseBtn} onClick={() => navigate('/cars')}>Browse Cars</button>
          </div>
        ) : (
          bookings.map((booking, index) => (
            <div key={booking._id} style={s.card}>
              <div style={s.imgWrap}>
                {booking.car?.image ? (
                  <img src={booking.car.image} alt="" style={s.img} />
                ) : (
                  <div style={s.noImg}>No Image</div>
                )}
              </div>
              <div style={s.info}>
                <div style={s.topRow}>
                  <span style={s.bookingNum}>Booking #{index + 1}</span>
                  <span style={getStatusStyle(booking.status)}>{booking.status}</span>
                </div>
                <div style={s.meta}>📅 {new Date(booking.startDate).toLocaleDateString()} → {new Date(booking.endDate).toLocaleDateString()}</div>
                <div style={s.meta}>📍 {booking.location}</div>
                <div style={s.carName}>
                  {booking.car?.brand} {booking.car?.model}
                  <span style={s.carSub}> · {booking.car?.year} · {booking.car?.category}</span>
                </div>
              </div>
              <div style={s.priceCol}>
                <span style={s.priceLabel}>Total Price</span>
                <span style={s.price}>${booking.totalPrice}</span>
                <span style={s.bookedOn}>Booked on {new Date(booking.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Dashboard;