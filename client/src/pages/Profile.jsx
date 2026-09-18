import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import Skeleton from '../components/Skeleton';
import PasswordInput from '../components/PasswordInput';
import OtpInput from '../components/OtpInput';
import ValidIdUpload from '../components/ValidIdUpload';
import LicensePhotoUpload from '../components/LicensePhotoUpload';
import usePageTitle from '../hooks/usePageTitle';
import useResendCooldown from '../hooks/useResendCooldown';
import { VALID_ID_TYPES } from '../data/validIdTypes';
import api from '../api';

// A real check-circle glyph, not a plain "✓" character — matches the
// hand-drawn inline-SVG icon convention used elsewhere on the site.
const CheckCircleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="8 12.5 10.8 15.3 16 9.5" />
  </svg>
);
const EditPencilIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// A reusable ID/license photo thumbnail with a "View Full Document" hover
// overlay — opens the full-size image in a new tab, no custom lightbox
// needed since we already have the real full-resolution URL.
const IdImageThumb = ({ src, alt, thumbStyle, overlayStyle }) => (
  <a href={src} target="_blank" rel="noreferrer" className="id-thumb-wrap" style={{ position: 'relative', display: 'block', width: '100%', maxWidth: '260px' }}>
    <img src={src} alt={alt} style={thumbStyle} />
    <span className="id-thumb-overlay" style={overlayStyle}>
      <EyeIcon /> View Full Document
    </span>
  </a>
);

const MIN_AGE_YEARS = 18;
const maxBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d.toISOString().split('T')[0];
};

const Profile = () => {
  usePageTitle('My Profile');
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [validIdType, setValidIdType] = useState('');
  const [validIdImage, setValidIdImage] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState('');
  const [validIdBackImage, setValidIdBackImage] = useState(null);
  const [validIdBackPreview, setValidIdBackPreview] = useState('');
  const [validIdExpiry, setValidIdExpiry] = useState('');
  const [licenseImage, setLicenseImage] = useState(null);
  const [licensePreview, setLicensePreview] = useState('');
  const [licenseBackImage, setLicenseBackImage] = useState(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwStep, setPwStep] = useState('form');
  const [pwCode, setPwCode] = useState('');
  const [pwResendCooldown, startPwResendCooldown] = useResendCooldown();

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchProfile();
  }, [user]);

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
      birthDate: '', // only ever sent as a one-time backfill — see the birthdate field below, shown only when profile.birthDate is empty
      phone: profile.phone || '',
      address: profile.address || '',
      licenseNumber: profile.licenseNumber || '',
      licenseExpiry: profile.licenseExpiry ? profile.licenseExpiry.split('T')[0] : '',
      emergencyContactName: profile.emergencyContactName || '',
      emergencyContactNumber: profile.emergencyContactNumber || '',
    });
    setValidIdType(profile.validIdType || '');
    setValidIdImage(null);
    setValidIdPreview('');
    setValidIdBackImage(null);
    setValidIdBackPreview('');
    setValidIdExpiry(profile.validIdExpiry ? profile.validIdExpiry.split('T')[0] : '');
    setLicenseImage(null);
    setLicensePreview('');
    setLicenseBackImage(null);
    setLicenseBackPreview('');
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

  // Uploads and saves immediately on selection, independent of Edit
  // Profile/Save — a photo swap doesn't need the same review step as the
  // rest of the form (birthdate, ID docs, etc.).
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const uploaded = await uploadToImageKit(file);
      const res = await api.put('/auth/me', { image: uploaded.url, imageFileId: uploaded.fileId });
      setProfile(res.data);
      updateUser({ image: res.data.image });
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      // The driver's license IS the valid ID in this case — one physical
      // document, so its expiry only needs to be entered once (in the
      // License Expiry field) rather than twice.
      const isDriversLicense = validIdType === 'drivers_license';
      const payload = {
        ...form,
        validIdType,
        validIdExpiry: isDriversLicense ? (form.licenseExpiry || null) : (validIdExpiry || null),
      };
      if (validIdImage) {
        const uploaded = await uploadToImageKit(validIdImage);
        payload.validIdImage = uploaded.url;
        payload.validIdImageFileId = uploaded.fileId;
      }
      if (validIdBackImage) {
        const uploadedBack = await uploadToImageKit(validIdBackImage);
        payload.validIdImageBack = uploadedBack.url;
        payload.validIdImageBackFileId = uploadedBack.fileId;
      }
      if (licenseImage) {
        const uploadedLicense = await uploadToImageKit(licenseImage);
        payload.licenseImage = uploadedLicense.url;
        payload.licenseImageFileId = uploadedLicense.fileId;
      }
      if (licenseBackImage) {
        const uploadedLicenseBack = await uploadToImageKit(licenseBackImage);
        payload.licenseImageBack = uploadedLicenseBack.url;
        payload.licenseImageBackFileId = uploadedLicenseBack.fileId;
      }

      const wasVerified = profile.idVerified;
      const res = await api.put('/auth/me', payload);
      setProfile(res.data);
      setEditMode(false);
      setSaveSuccess(
        wasVerified && res.data.pendingIdSubmittedAt
          ? 'Your ID update was submitted for review. Your current verified ID stays active until it’s approved.'
          : 'Profile updated.'
      );
      setTimeout(() => setSaveSuccess(''), 5000);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Something went wrong saving your profile.');
    } finally {
      setSaving(false);
    }
  };

  // Step 1: validate the new password client-side and confirm the current
  // password is actually correct server-side, then send a code to the
  // account's own email — nothing changes yet.
  const handleRequestPasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password/send-code', { currentPassword: pwForm.currentPassword });
      startPwResendCooldown();
      setPwStep('verify');
    } catch (err) {
      setPwError(err.response?.data?.message || 'Something went wrong sending the verification code.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleResendPasswordCode = async () => {
    setPwError('');
    setPwSaving(true);
    try {
      await api.post('/auth/change-password/send-code', { currentPassword: pwForm.currentPassword });
      startPwResendCooldown();
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to resend the code.');
    } finally {
      setPwSaving(false);
    }
  };

  // Step 2: confirm the code, then actually change the password.
  const handleConfirmPasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    if (!pwCode.trim()) {
      setPwError('Please enter the code sent to your email.');
      return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/verify-email-code', { email: profile.email, code: pwCode.trim() });
      await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess('Password updated.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwCode('');
      setPwStep('form');
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err) {
      setPwError(err.response?.data?.message || 'Something went wrong changing your password.');
    } finally {
      setPwSaving(false);
    }
  };

  const cancelPasswordVerify = () => {
    setPwStep('form');
    setPwCode('');
    setPwError('');
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb' },
    container: { maxWidth: '760px', margin: '0 auto', padding: '32px' },
    title: {
      fontSize: 'clamp(26px, 3.4vw, 34px)', fontWeight: '900', letterSpacing: '-0.01em',
      textTransform: 'uppercase', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px',
    },
    subtitle: { fontSize: '14px', fontStyle: 'italic', color: isDark ? GOLD_DARK : GOLD, marginBottom: '24px' },
    profileCard: { background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '20px', padding: '24px' },
    sectionDivider: { border: 'none', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, margin: '20px 0' },
    profileHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' },
    sectionTitle: {
      fontSize: '15px', fontWeight: '800', letterSpacing: '0.02em', textTransform: 'uppercase',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    // Subdued outline, not a solid gold fill — gold stays reserved for
    // primary conversion CTAs (Reserve Now, Book Now); editing your own
    // settings is a lower-stakes secondary action.
    editBtn: {
      padding: '8px 18px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '999px',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#374151', cursor: 'pointer',
    },
    cancelBtn: { padding: '9px 18px', fontSize: '13px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', background: 'none', color: isDark ? '#e4e6eb' : '#374151', cursor: 'pointer', fontWeight: '500' },
    saveBtn: { padding: '9px 18px', fontSize: '13px', border: 'none', borderRadius: '8px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer', fontWeight: '600' },
    profileGrid: { gap: '14px' },
    profileItem: { background: isDark ? '#18191a' : '#f9fafb', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    // Muted slate-blue, not gold — gold is reserved for accents/CTAs
    // elsewhere on the site; these are just field labels.
    profileLabel: {
      display: 'block', fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase',
      color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px',
    },
    profileValue: { fontSize: '14px', color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '700' },
    // Dark mode uses a translucent tint + matching border (a "glowing
    // chip" look), matching the badge treatment already used on My
    // Bookings and Cars — the flat pastel fill read as washed-out on a
    // dark card.
    roleTag: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? '#3a3b3c' : '#e5e7eb', color: isDark ? '#e4e6eb' : '#374151',
    },
    // Translucent tint + border (same "glowing chip" language as the
    // other tags), not a solid fill — an earlier pass tried a solid green
    // here and that was a miss.
    verifiedTag: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: '20px',
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', color: isDark ? '#86efac' : '#065f46',
      border: `1px solid ${isDark ? 'rgba(22,163,74,0.4)' : '#86efac'}`,
    },
    unverifiedTag: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e',
      border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    expiredTag: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    idThumb: { width: '100%', maxWidth: '260px', height: '130px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, marginTop: '8px' },
    field: { marginBottom: '14px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    uploadHint: { fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280' },
    fieldError: { fontSize: '11px', color: isDark ? '#fca5a5' : '#dc2626', marginTop: '4px' },
    row: { gap: '12px' },
    upload: { position: 'relative', width: '100%', maxWidth: '280px', height: '130px', border: `2px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#18191a' : '#fff' },
    uploadPlaceholder: { textAlign: 'center', padding: '12px', fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280' },
    uploadPreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    formError: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    formSuccess: { background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#166534', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    avatarRow: { display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px' },
    // No overflow:hidden here — that lives on avatarWrap instead, so the
    // edit badge (a child of THIS element, not avatarWrap) can sit outside
    // the box's edge without getting clipped by the box's own rounded-
    // corner mask.
    avatarOuter: { position: 'relative', width: '96px', height: '96px', flexShrink: 0 },
    // Rounded square, not a circle — matches the corner radius used on
    // every other image/card on the site (booking thumbs, car photos)
    // rather than introducing a one-off circular shape. Dashed border when
    // empty (an "upload here" cue), solid once a real photo is set — see
    // the border override applied inline where this is used.
    avatarWrap: {
      position: 'relative', width: '100%', height: '100%', borderRadius: '18px',
      overflow: 'hidden', background: isDark ? '#18191a' : '#f3f4f6',
    },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    // Shown in place of the photo when none is set yet.
    avatarEmpty: {
      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '30px', fontWeight: '700', color: isDark ? '#8a6d1f' : '#a68a3f',
    },
    // Covers the whole avatar as the actual click target (bigger, easier to
    // hit than just the small pencil badge) — the pencil below is purely a
    // visual affordance layered on top, not a separate interactive element.
    avatarFileInput: { position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 },
    // Positioned relative to avatarOuter (not avatarWrap), so most of the
    // circle sits outside the box's edge instead of being clipped by
    // avatarWrap's overflow:hidden.
    avatarEditBadge: {
      position: 'absolute', bottom: '-10px', right: '-10px', width: '30px', height: '30px', borderRadius: '50%',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${isDark ? '#18191a' : '#f9fafb'}`, pointerEvents: 'none',
      boxShadow: isDark ? '0 0 14px rgba(232,161,0,0.65)' : '0 0 10px rgba(184,121,10,0.45)',
    },
    avatarMeta: { display: 'flex', flexDirection: 'column', gap: '4px' },
    avatarName: { fontSize: '19px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    avatarHint: { fontSize: '12.5px', color: isDark ? '#8a8d91' : '#6b7280' },
    avatarBadgeRow: { display: 'flex', gap: '8px', marginTop: '4px' },
    // Small colored bar before a card's heading — purely a visual accent to
    // tell the Account Details and Identity Verification cards apart at a
    // glance, no meaning attached to the specific color.
    sectionTitleRow: { display: 'flex', alignItems: 'center', gap: '10px' },
    accentBar: (color) => ({ width: '4px', height: '16px', borderRadius: '2px', background: color, flexShrink: 0 }),
    idThumbWrap: { marginTop: '8px' },
    idThumbOverlay: {
      position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '11px', fontWeight: '600',
      opacity: 0, transition: 'opacity 0.15s',
    },
    helpFooter: { textAlign: 'center', marginTop: '28px', fontSize: '13px', color: isDark ? '#8a8d91' : '#6b7280' },
    helpLink: { color: isDark ? GOLD_DARK : GOLD, fontWeight: '600', textDecoration: 'none' },
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  // First + last initials (e.g. "John Doe" -> "JD"), not just one letter.
  const initials = (name) => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <h1 style={s.title}>My Profile</h1>
        <p style={s.subtitle}>View and update your account information.</p>

        {profile && (
          <div style={s.avatarRow}>
            <div style={s.avatarOuter}>
              <div style={{
                ...s.avatarWrap,
                border: profile.image
                  ? `2px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`
                  : `2px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
              }}>
                {profile.image ? (
                  <img src={profile.image} alt="" style={s.avatarImg} />
                ) : (
                  <div style={s.avatarEmpty}>{initials(profile.name)}</div>
                )}
                <input
                  id="profile-avatar-input"
                  type="file"
                  accept="image/*"
                  style={s.avatarFileInput}
                  onChange={handleAvatarChange}
                  disabled={avatarUploading}
                  aria-label={profile.image ? 'Change profile photo' : 'Add profile photo'}
                />
              </div>
              <div style={s.avatarEditBadge}><EditPencilIcon /></div>
            </div>
            <div style={s.avatarMeta}>
              <span style={s.avatarName}>{profile.name}</span>
              {memberSince && <span style={s.avatarHint}>Member since {memberSince}</span>}
              <div style={s.avatarBadgeRow}>
                <span style={profile.idVerified ? s.verifiedTag : s.unverifiedTag}>
                  {profile.idVerified ? <><CheckCircleIcon /> ID Verified</> : 'Not Verified'}
                </span>
              </div>
              {avatarUploading && <span style={s.avatarHint}>Uploading photo...</span>}
            </div>
          </div>
        )}
        {avatarError && <div style={s.formError}>{avatarError}</div>}

        {saveSuccess && <div style={s.formSuccess}>{saveSuccess}</div>}

        <div style={s.profileCard}>
          <div style={s.profileHeaderRow}>
            <div style={s.sectionTitleRow}>
              <span style={s.accentBar('#8b5cf6')} />
              <div style={s.sectionTitle}>Account Details</div>
            </div>
            {!editMode && profile && (
              <button style={s.editBtn} onClick={startEdit}>Edit Profile</button>
            )}
          </div>

          {!profile ? (
            <div className="responsive-row-2" style={s.profileGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={s.profileItem}>
                  <Skeleton height="11px" width="40%" isDark={isDark} style={{ marginBottom: '8px' }} />
                  <Skeleton height="14px" width="70%" isDark={isDark} />
                </div>
              ))}
            </div>
          ) : !editMode ? (
            <>
              <div className="responsive-row-2" style={s.profileGrid}>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Full Name</span>
                  <span style={s.profileValue}>{profile.name}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Email</span>
                  <span style={s.profileValue}>{profile.email}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Account Type</span>
                  <span style={s.roleTag}>{profile.role}</span>
                </div>
                <div style={s.profileItem}>
                  <span style={s.profileLabel}>Birthdate</span>
                  <span style={s.profileValue}>
                    {profile.birthDate ? new Date(profile.birthDate).toLocaleDateString() : '—'}
                  </span>
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
                  {profile.licenseExpiry && new Date(profile.licenseExpiry) < new Date() && (
                    <div style={{ marginTop: '4px' }}><span style={s.expiredTag}>Expired</span></div>
                  )}
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
            </>
          ) : null}

          {editMode && (
            <form onSubmit={handleSave}>
              {saveError && <div style={s.formError}>{saveError}</div>}

              <div style={s.field}>
                <label style={s.label} htmlFor="profile-name">Full Name</label>
                <input id="profile-name" style={s.input} type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>

              {!profile.birthDate && (
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-birthdate">Birthdate</label>
                  <input id="profile-birthdate" style={s.input} type="date" max={maxBirthDate()}
                    value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                  <p style={s.uploadHint}>Your account doesn't have a birthdate on file yet — add it now. Must match your valid ID; you won't be able to change it once set.</p>
                </div>
              )}

              <div className="responsive-row-2" style={s.row}>
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-phone">Phone Number</label>
                  <input id="profile-phone" style={s.input} type="tel" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-address">Address</label>
                  <input id="profile-address" style={s.input} type="text" value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>

              <div className="responsive-row-2" style={s.row}>
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-license-number">License Number</label>
                  <input id="profile-license-number" style={s.input} type="text" value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
                </div>
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-license-expiry">License Expiry</label>
                  <input id="profile-license-expiry" style={s.input} type="date" value={form.licenseExpiry}
                    onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
                </div>
              </div>

              {validIdType === 'drivers_license' ? (
                <p style={s.uploadHint}>Your valid ID photos below already cover your license — no need to upload again.</p>
              ) : (
                <>
                  <p style={{ ...s.label, marginBottom: '2px' }}>License Photo (optional)</p>
                  <LicensePhotoUpload
                    styles={s}
                    idPrefix="profile-license"
                    frontPreview={licensePreview || profile.licenseImage}
                    onFrontChange={(f) => { setLicenseImage(f); setLicensePreview(URL.createObjectURL(f)); }}
                    backPreview={licenseBackPreview || profile.licenseImageBack}
                    onBackChange={(f) => { setLicenseBackImage(f); setLicenseBackPreview(URL.createObjectURL(f)); }}
                  />
                </>
              )}

              <div className="responsive-row-2" style={s.row}>
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-emergency-name">Emergency Contact Name</label>
                  <input id="profile-emergency-name" style={s.input} type="text" value={form.emergencyContactName}
                    onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
                </div>
                <div style={s.field}>
                  <label style={s.label} htmlFor="profile-emergency-number">Emergency Contact Number</label>
                  <input id="profile-emergency-number" style={s.input} type="tel" value={form.emergencyContactNumber}
                    onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })} />
                </div>
              </div>

              <p style={{ ...s.label, marginBottom: '2px' }}>Valid ID (leave as is, or update it)</p>
              {!validIdType && <p style={s.uploadHint}>Select your ID type to view or update it.</p>}
              {profile.pendingIdSubmittedAt && (
                <p style={{ ...s.uploadHint, color: isDark ? '#fcd34d' : '#92400e' }}>
                  You already have an ID update pending review — uploading here replaces that pending submission, not your currently verified ID.
                </p>
              )}
              <ValidIdUpload
                styles={s}
                idPrefix="profile-valid-id"
                idType={validIdType}
                onIdTypeChange={setValidIdType}
                frontPreview={validIdPreview || profile.validIdImage}
                onFrontChange={(f) => { setValidIdImage(f); setValidIdPreview(URL.createObjectURL(f)); }}
                backPreview={validIdBackPreview || profile.validIdImageBack}
                onBackChange={(f) => { setValidIdBackImage(f); setValidIdBackPreview(URL.createObjectURL(f)); }}
                expiry={validIdExpiry}
                onExpiryChange={setValidIdExpiry}
                hideExpiry={validIdType === 'drivers_license'}
              />
              {(validIdImage || validIdBackImage) && (
                <p style={s.uploadHint}>
                  {profile.idVerified
                    ? 'Uploading a new photo will be submitted for review — your current verified ID stays active until it’s approved.'
                    : 'Uploading a new photo will require admin re-verification.'}
                </p>
              )}

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

        {profile && (
          <div style={{ ...s.profileCard, marginTop: '20px' }}>
            <div style={s.profileHeaderRow}>
              <div style={s.sectionTitleRow}>
                <span style={s.accentBar('#3b82f6')} />
                <div style={s.sectionTitle}>Identity Verification</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {profile.validIdExpiry && (
                  <div style={{ textAlign: 'right' }}>
                    <span style={s.profileLabel}>Document Expiry</span>
                    <span style={{ ...s.profileValue, display: 'block', marginTop: '4px' }}>
                      {new Date(profile.validIdExpiry).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <span style={profile.idVerified ? s.verifiedTag : s.unverifiedTag}>
                  {profile.idVerified ? <><CheckCircleIcon /> ID Verified</> : 'Not Verified'}
                </span>
                {profile.validIdExpiry && new Date(profile.validIdExpiry) < new Date() && (
                  <span style={s.expiredTag}>Expired</span>
                )}
                {profile.pendingIdSubmittedAt && (
                  <span style={s.unverifiedTag}>Update Pending Review</span>
                )}
              </div>
            </div>

            {profile.validIdImage ? (
              <div style={s.idThumbWrap}>
                {profile.validIdType && (
                  <p style={{ ...s.uploadHint, marginBottom: '4px' }}>
                    {VALID_ID_TYPES.find((t) => t.value === profile.validIdType)?.label || profile.validIdType}
                  </p>
                )}
                <IdImageThumb src={profile.validIdImage} alt="Valid ID" thumbStyle={s.idThumb} overlayStyle={s.idThumbOverlay} />
              </div>
            ) : (
              <p style={s.uploadHint}>No valid ID on file yet — add one from Edit Profile above.</p>
            )}

            {profile.validIdExpiry && new Date(profile.validIdExpiry) < new Date() && (
              <p style={{ ...s.formError, marginTop: '10px', maxWidth: '360px' }}>
                Your ID has expired. Please upload an updated photo from Edit Profile above — you won't be able to book until it's renewed and re-verified.
              </p>
            )}
            {profile.pendingIdSubmittedAt && (
              <div style={{ marginTop: '12px' }}>
                <p style={s.uploadHint}>
                  Submitted {new Date(profile.pendingIdSubmittedAt).toLocaleDateString()}, awaiting admin review. Your ID above stays verified and active in the meantime.
                </p>
                <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {profile.pendingValidIdImage && <IdImageThumb src={profile.pendingValidIdImage} alt="Pending ID front" thumbStyle={s.idThumb} overlayStyle={s.idThumbOverlay} />}
                  {profile.pendingValidIdImageBack && <IdImageThumb src={profile.pendingValidIdImageBack} alt="Pending ID back" thumbStyle={s.idThumb} overlayStyle={s.idThumbOverlay} />}
                </div>
              </div>
            )}

            {(profile.licenseImage || profile.licenseImageBack) && (
              <div style={{ marginTop: '16px' }}>
                <span style={s.profileLabel}>License Photo</span>
                <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {profile.licenseImage && <IdImageThumb src={profile.licenseImage} alt="License front" thumbStyle={s.idThumb} overlayStyle={s.idThumbOverlay} />}
                  {profile.licenseImageBack && <IdImageThumb src={profile.licenseImageBack} alt="License back" thumbStyle={s.idThumb} overlayStyle={s.idThumbOverlay} />}
                </div>
              </div>
            )}
          </div>
        )}

        <p style={s.helpFooter}>
          Need help with your account? <Link to="/help" style={s.helpLink}>Contact our support team</Link>
        </p>

        <div style={{ ...s.profileCard, marginTop: '20px' }}>
          <div style={s.sectionTitle}>Change Password</div>
          <p style={s.subtitle}>Update the password you use to log in.</p>

          {pwSuccess && <div style={s.formSuccess}>{pwSuccess}</div>}
          {pwError && <div style={s.formError}>{pwError}</div>}

          {pwStep === 'form' ? (
            <form onSubmit={handleRequestPasswordChange}>
              <div style={s.field}>
                <label style={s.label} htmlFor="pw-current">Current Password</label>
                <PasswordInput id="pw-current" style={s.input} value={pwForm.currentPassword} isDark={isDark}
                  onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
              </div>
              <div className="responsive-row-2" style={s.row}>
                <div style={s.field}>
                  <label style={s.label} htmlFor="pw-new">New Password</label>
                  <PasswordInput id="pw-new" style={s.input} value={pwForm.newPassword} minLength={8} isDark={isDark}
                    onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
                </div>
                <div style={s.field}>
                  <label style={s.label} htmlFor="pw-confirm">Confirm New Password</label>
                  <PasswordInput id="pw-confirm" style={s.input} value={pwForm.confirmPassword} minLength={8} isDark={isDark}
                    onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
                </div>
              </div>
              <button type="submit" style={s.saveBtn} disabled={pwSaving}>
                {pwSaving ? 'Sending code...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirmPasswordChange}>
              <p style={{ ...s.subtitle, marginBottom: '12px' }}>
                We sent a 6-digit code to <strong>{profile.email}</strong>. Enter it below to finish changing your password.
              </p>
              <div style={s.field}>
                <label style={s.label} htmlFor="pw-code">Verification Code</label>
                <OtpInput value={pwCode} onChange={setPwCode} isDark={isDark} />
              </div>
              <button type="button" className="text-link-btn" style={{ background: 'none', border: 'none', padding: 0, marginBottom: '14px', font: 'inherit', color: isDark ? GOLD_DARK : GOLD, cursor: pwResendCooldown > 0 ? 'default' : 'pointer' }}
                onClick={handleResendPasswordCode} disabled={pwSaving || pwResendCooldown > 0}>
                {pwSaving ? 'Resending...' : pwResendCooldown > 0 ? `Resend code in ${pwResendCooldown}s` : "Didn't get it? Resend code"}
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={s.saveBtn} disabled={pwSaving}>
                  {pwSaving ? 'Updating...' : 'Confirm & Update Password'}
                </button>
                <button type="button" style={s.cancelBtn} onClick={cancelPasswordVerify} disabled={pwSaving}>
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
