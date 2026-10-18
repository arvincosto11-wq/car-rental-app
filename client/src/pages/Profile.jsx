import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import Skeleton from '../components/Skeleton';
import PasswordInput from '../components/PasswordInput';
import OtpInput from '../components/OtpInput';
import usePageTitle from '../hooks/usePageTitle';
import useResendCooldown from '../hooks/useResendCooldown';
import api from '../api';

// My Profile, as a settings page: a sidebar saying who you are and what
// there is to change, and one panel at a time beside it. The three things
// this page does — your details, your licence date, your password — used to
// be three cards stacked down one column, so somebody who came only to
// change their password had to scroll past everything else to reach it.
const EditPencilIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 3.5l4 4L8 20H4v-4z" />
  </svg>
);

// A licence card: portrait on the left, lines of text on the right.
const LicenceCardIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="11" r="2" />
    <path d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4" />
    <line x1="14" y1="10" x2="18" y2="10" />
    <line x1="14" y1="13.5" x2="17" y2="13.5" />
  </svg>
);

const MIN_AGE_YEARS = 18;
const maxBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d.toISOString().split('T')[0];
};

// The same 30 days the renewal reminder uses (server/utils/expiryNotify.js),
// so the dot in the menu and the email somebody gets agree with each other.
const LICENCE_SOON_DAYS = 30;

// Whole days from today to that date, counted midnight to midnight so a
// licence expiring tomorrow doesn't read as "in 0 days" late in the evening.
const daysUntil = (date) => {
  const then = new Date(date).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((then - today) / 86400000);
};

// First + last initials (e.g. "John Doe" -> "JD"), not just one letter.
const initialsOf = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
};

const Profile = () => {
  usePageTitle('My Profile');
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [section, setSection] = useState('details');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [openedWith, setOpenedWith] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  // Chosen, uploaded, and waiting for Save.
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [avatarError, setAvatarError] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwStep, setPwStep] = useState('form');
  const [pwCode, setPwCode] = useState('');
  const [pwResendCooldown, startPwResendCooldown] = useResendCooldown();

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchProfile();
  }, [user]);

  const startEdit = () => {
    const opening = {
      name: profile.name || '',
      birthDate: '', // only ever sent as a one-time backfill — see the birthdate field below, shown only when profile.birthDate is empty
      phone: profile.phone || '',
      address: profile.address || '',
      licenseExpiry: profile.licenseExpiry ? profile.licenseExpiry.split('T')[0] : '',
      emergencyContactName: profile.emergencyContactName || '',
      emergencyContactNumber: profile.emergencyContactNumber || '',
    };
    setForm(opening);
    // Kept so "Save changes" can tell whether anything has actually been
    // typed. Pressing Save with nothing changed used to send the same
    // values back and report success, which reads as though something
    // happened when nothing did.
    setOpenedWith(opening);
    setSaveError('');
    setSaveSuccess('');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setSaveError('');
    setPendingPhoto(null);
  };

  // `isPrivate` for identity documents only. A private file refuses a plain
  // link and serves only a signed one — which is what every screen that
  // shows these now asks for. Car photographs and avatars go up as before.
  const uploadToImageKit = async (file, { isPrivate = false } = {}) => {
    const authRes = await api.get('/imagekit/user-auth');
    const { token, expire, signature, publicKey } = authRes.data;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', file.name);
    formData.append('token', token);
    formData.append('expire', expire);
    formData.append('signature', signature);
    formData.append('publicKey', publicKey);
    if (isPrivate) formData.append('isPrivateFile', 'true');
    const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
    const data = await uploadRes.json();
    return { url: data.url, fileId: data.fileId };
  };

  // A picked photo is held, not published. It used to save the moment it
  // was chosen, which meant the one field on this page that everybody else
  // can see was also the one field nobody could take back: a wrong picture
  // was already public before the page finished reacting.
  //
  // Picking one now opens editing if it is not already open, so Save and
  // Cancel are on the screen, and the new picture shows as a preview until
  // Save is pressed.
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      const uploaded = await uploadToImageKit(file);
      if (!editMode) startEdit();
      setPendingPhoto({ image: uploaded.url, imageFileId: uploaded.fileId });
      setSaveSuccess('');
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
      // Dates go up with everything else now. There is no document on file
      // for anybody else to read them off, so the person they belong to is
      // the only one who can say what they are.
      const payload = { ...form, ...(pendingPhoto || {}) };
      const res = await api.put('/auth/me', payload);
      setProfile(res.data);
      if (pendingPhoto) {
        // The navbar reads the cached login, so it would otherwise keep
        // the old picture until the next sign-in.
        updateUser({ image: res.data.image });
        setPendingPhoto(null);
      }
      setEditMode(false);
      setSaveSuccess('Profile updated.');
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

  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';
  const red = isDark ? '#fca5a5' : '#b91c1c';
  const redTint = isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2';
  const redLine = isDark ? 'rgba(220,38,38,0.4)' : '#fecaca';
  const border = isDark ? '#3a3b3c' : '#e5e7eb';
  const divider = isDark ? '#303132' : '#eef0f2';
  const card = isDark ? '#242526' : '#ffffff';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const page = isDark ? '#18191a' : '#f4f5f6';

  // Has anything actually been typed since Edit profile was pressed?
  // Compared field by field against what the form opened with, so leaving
  // a field alone — or typing into it and putting it back — counts as no
  // change.
  const changed = !!pendingPhoto || Object.keys(openedWith).some(
    (key) => (form[key] ?? '') !== (openedWith[key] ?? ''),
  );

  const s = {
    page: { minHeight: '100vh', background: page },
    main: {
      maxWidth: '1100px', margin: '0 auto', padding: '40px clamp(16px, 3vw, 32px) 72px',
      display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start',
    },
    sidebar: { flex: '0 1 260px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 },

    identity: { display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 },
    avatarOuter: { position: 'relative', width: '64px', height: '64px', flexShrink: 0 },
    avatarWrap: {
      width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: goldTint,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
    avatarInitials: { fontSize: '22px', fontWeight: '800', color: ink },
    // Over the bottom-right of the circle, ringed in the page colour so it
    // reads as its own control rather than part of the photograph.
    avatarBadge: {
      position: 'absolute', bottom: '-2px', right: '-2px', width: '26px', height: '26px',
      borderRadius: '50%', background: gold, color: ON_GOLD,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: `2px solid ${page}`, cursor: avatarUploading ? 'default' : 'pointer',
    },
    identityMeta: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
    identityName: { fontSize: '17px', fontWeight: '800', color: text, wordBreak: 'break-word' },
    identityHint: { fontSize: '12.5px', color: text3 },

    // The padding and the gap are what keep this from looking crumpled: at
    // 6px with the buttons stacked edge to edge, the active block ran into
    // the card's own rounded corner and sat flush against the next label.
    menuCard: {
      background: card, border: `1px solid ${border}`, borderRadius: '14px', padding: '8px',
      display: 'flex', flexDirection: 'column', gap: '4px',
    },
    menuBtn: (on) => ({
      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
      minHeight: '44px', padding: '0 14px', borderRadius: '10px', border: 'none',
      fontSize: '14px', fontWeight: on ? '800' : '500', textAlign: 'left', cursor: 'pointer',
      // Left unset when inactive rather than set to transparent, so the
      // hover tint in index.css has something to win against — an inline
      // background would beat the stylesheet and nothing would happen.
      background: on ? goldTint : undefined, color: on ? ink : text,
    }),
    // marginLeft: auto is what holds it against the right edge. Nothing
    // else may set an inline start margin here — that wins over the auto
    // and drops the dot back beside the label.
    menuDot: {
      width: '8px', height: '8px', borderRadius: '50%', background: gold,
      marginLeft: 'auto', flexShrink: 0,
    },

    help: { fontSize: '12.5px', lineHeight: 1.5, color: text3, margin: 0 },
    helpLink: { color: ink, fontWeight: '700', textDecoration: 'none' },

    panel: {
      flex: '1 1 520px', minWidth: 0, background: card,
      border: `1px solid ${border}`, borderRadius: '18px', padding: 'clamp(20px, 3vw, 32px)',
      display: 'flex', flexDirection: 'column', gap: '22px',
    },
    panelHead: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between' },
    h1: { fontSize: '22px', fontWeight: '800', color: text, margin: 0 },
    lead: { fontSize: '13.5px', color: text3, margin: '4px 0 0', maxWidth: '54ch', lineHeight: 1.5 },
    headActions: { display: 'flex', gap: '8px', flexShrink: 0 },
    btn: {
      minHeight: '38px', padding: '0 16px', borderRadius: '10px', border: `1px solid ${border}`,
      background: 'transparent', color: text, fontSize: '13px', fontWeight: '800', cursor: 'pointer',
    },
    btnGold: {
      minHeight: '38px', padding: '0 16px', borderRadius: '10px', border: 'none',
      background: gold, color: ON_GOLD, fontSize: '13px', fontWeight: '800', cursor: 'pointer',
    },
    // Asleep until something has been typed, so the button says whether
    // there is anything to save rather than waiting to be pressed.
    btnGoldOff: {
      minHeight: '38px', padding: '0 16px', borderRadius: '10px', border: 'none',
      background: isDark ? '#303132' : '#e5e7eb',
      color: isDark ? '#6b6e72' : '#9ca3af',
      fontSize: '13px', fontWeight: '800', cursor: 'default',
    },
    group: { display: 'flex', flexDirection: 'column' },
    groupLabel: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase',
      color: text3, marginBottom: '2px',
    },
    row: { gap: '20px', padding: '12px 0', borderTop: `1px solid ${divider}`, alignItems: 'center' },
    rowLabel: { fontSize: '13.5px', color: text2 },
    rowValue: { fontSize: '14.5px', fontWeight: '600', color: text, minWidth: 0, wordBreak: 'break-word' },
    input: {
      width: '100%', minHeight: '38px', padding: '8px 12px', borderRadius: '9px',
      border: `1px solid ${border}`, background: inset, color: text,
      fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    },
    roleTag: {
      display: 'inline-block', fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em',
      textTransform: 'uppercase', padding: '3px 11px', borderRadius: '20px',
      background: isDark ? '#3a3b3c' : '#e5e7eb', color: isDark ? '#e4e6eb' : '#374151',
    },
    hint: { fontSize: '12px', color: text3, margin: '6px 0 0', lineHeight: 1.5 },

    statusCard: (tone) => ({
      display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center',
      padding: '18px', borderRadius: '14px',
      background: tone === 'bad' ? redTint : tone === 'soon' ? goldTint : inset,
      border: `1px solid ${tone === 'bad' ? redLine : tone === 'soon' ? goldLine : border}`,
    }),
    statusTile: (tone) => ({
      width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: tone === 'bad' ? redTint : goldTint,
      color: tone === 'bad' ? red : ink,
      border: `1px solid ${tone === 'bad' ? redLine : goldLine}`,
    }),
    statusBody: { flex: '1 1 200px', minWidth: 0 },
    statusLabel: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase', color: text3,
    },
    statusValue: { fontSize: '18px', fontWeight: '800', color: text, marginTop: '2px' },
    statusNote: (tone) => ({ fontSize: '13px', fontWeight: '700', color: tone === 'bad' ? red : ink, marginTop: '4px' }),

    pwForm: { maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '14px' },
    label: { display: 'block', fontSize: '13px', fontWeight: '600', color: text2, marginBottom: '6px' },
    pwInput: {
      width: '100%', minHeight: '44px', padding: '10px 12px', borderRadius: '9px',
      border: `1px solid ${border}`, background: inset, color: text,
      fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    },
    pwSubmit: {
      minHeight: '44px', padding: '0 20px', borderRadius: '10px', border: 'none',
      background: gold, color: ON_GOLD, fontSize: '14px', fontWeight: '800', cursor: 'pointer',
    },
    formError: { background: redTint, color: red, padding: '10px 14px', borderRadius: '9px', fontSize: '13px' },
    formSuccess: {
      background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#166534',
      padding: '10px 14px', borderRadius: '9px', fontSize: '13px',
    },
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : '';

  // Who is on screen while the profile request is still out. The name,
  // photo and role were all cached at login, so the sidebar can be right
  // from the first frame instead of filling in a second later — the menu
  // used to come back one item short until the role arrived.
  const shown = profile || user || null;

  // A licence only matters to somebody who books self-drive. Consignors and
  // admins never have one on file — the renewal reminder already skips them
  // (server/utils/expiryNotify.js), so the section would be an empty card.
  const wantsLicence = shown?.role === 'user';
  const licenceLeft = profile?.licenseExpiry ? daysUntil(profile.licenseExpiry) : null;
  const licenceExpired = licenceLeft !== null && licenceLeft < 0;
  const licenceSoon = licenceLeft !== null && licenceLeft >= 0 && licenceLeft <= LICENCE_SOON_DAYS;
  const licenceTone = licenceExpired ? 'bad' : licenceSoon ? 'soon' : 'calm';
  const licenceFlag = wantsLicence && (licenceExpired || licenceSoon);

  // Worked out rather than stored, so nobody can be left looking at a
  // section that isn't in their menu.
  const active = section === 'licence' && !wantsLicence ? 'details' : section;

  const menu = [
    { key: 'details', label: 'Account details' },
    ...(wantsLicence ? [{ key: 'licence', label: 'Your licence' }] : []),
    { key: 'password', label: 'Password' },
  ];

  const countdown = () => {
    if (licenceExpired) return 'It has run out — renew it before your next self-drive booking.';
    if (licenceLeft === 0) return "That's today — renew it to keep booking self-drive.";
    if (licenceLeft === 1) return "That's tomorrow — renew it to keep booking self-drive.";
    return `That's in ${licenceLeft} days — renew it to keep booking self-drive.`;
  };

  // A plain function rather than a component: these rows exist only inside
  // this one panel, and each needs the style objects built above.
  const detailRow = (label, value, input) => (
    <div className="profile-row" style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <div style={s.rowValue}>{editMode && input ? input : value}</div>
    </div>
  );

  const detailsPanel = (
    <form style={s.panel} onSubmit={handleSave}>
      <div style={s.panelHead}>
        <div style={{ minWidth: 0 }}>
          <h1 style={s.h1}>Account details</h1>
          <p style={s.lead}>View and update your account information.</p>
        </div>
        {profile && (
          <div style={s.headActions}>
            {editMode ? (
              <>
                <button type="button" style={s.btn} onClick={cancelEdit} disabled={saving}>Cancel</button>
                <button
                  type="submit"
                  style={changed ? s.btnGold : s.btnGoldOff}
                  disabled={saving || !changed}
                  title={changed ? undefined : 'Nothing has changed yet.'}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </>
            ) : (
              <button type="button" style={s.btn} onClick={startEdit}>Edit profile</button>
            )}
          </div>
        )}
      </div>

      {saveSuccess && <div style={s.formSuccess}>{saveSuccess}</div>}
      {saveError && <div style={s.formError}>{saveError}</div>}

      {!profile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '20px' }}>
              <Skeleton height="14px" width="140px" isDark={isDark} />
              <Skeleton height="14px" width="60%" isDark={isDark} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={s.group}>
            <div style={s.groupLabel}>Personal</div>
            {detailRow(
              'Full name',
              profile.name,
              <input
                style={s.input} type="text" aria-label="Full name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required
              />,
            )}
            {detailRow(
              'Birthdate',
              profile.birthDate ? new Date(profile.birthDate).toLocaleDateString() : '—',
              // Filled in once and then fixed. It has to match the ID shown
              // at the counter, so it is not somebody's to change afterwards.
              profile.birthDate ? null : (
                <div>
                  <input
                    style={s.input} type="date" max={maxBirthDate()} aria-label="Birthdate"
                    value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                  <p style={s.hint}>
                    Your account doesn&apos;t have a birthdate on file yet — add it now. Must match your
                    valid ID; you won&apos;t be able to change it once set.
                  </p>
                </div>
              ),
            )}
            {detailRow('Account type', <span style={s.roleTag}>{profile.role}</span>, null)}
          </div>

          <div style={s.group}>
            <div style={s.groupLabel}>Contact</div>
            {detailRow('Email', profile.email, null)}
            {detailRow(
              'Phone',
              profile.phone || '—',
              <input
                style={s.input} type="tel" aria-label="Phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />,
            )}
            {detailRow(
              'Address',
              profile.address || '—',
              <input
                style={s.input} type="text" aria-label="Address" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />,
            )}
          </div>

          <div style={s.group}>
            <div style={s.groupLabel}>Emergency contact</div>
            {detailRow(
              'Name',
              profile.emergencyContactName || '—',
              <input
                style={s.input} type="text" aria-label="Emergency contact name" value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
              />,
            )}
            {detailRow(
              'Number',
              profile.emergencyContactNumber || '—',
              <input
                style={s.input} type="tel" aria-label="Emergency contact number" value={form.emergencyContactNumber}
                onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })}
              />,
            )}
          </div>

          {/* The licence date is read in its own section, but it is still
              changed here, with everything else, on the one save. There is
              no separate editor for it. */}
          {wantsLicence && editMode && (
            <div style={s.group}>
              <div style={s.groupLabel}>Licence</div>
              {detailRow(
                'Expiry date',
                null,
                <input
                  style={s.input} type="date" aria-label="Licence expiry date" value={form.licenseExpiry || ''}
                  onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                />,
              )}
            </div>
          )}
        </>
      )}
    </form>
  );

  const licencePanel = (
    <div style={s.panel}>
      <div>
        <h1 style={s.h1}>Your licence</h1>
        <p style={s.lead}>
          We hold no copies of any document. This is kept so we can remind you before it runs out, and
          so self-drive bookings can check it covers the whole trip.
        </p>
      </div>

      <div style={s.statusCard(licenceTone)}>
        <span style={s.statusTile(licenceTone)}><LicenceCardIcon /></span>
        <div style={s.statusBody}>
          <div style={s.statusLabel}>Driver&apos;s licence</div>
          <div style={s.statusValue}>
            {!profile?.licenseExpiry
              ? 'Not set'
              : `${licenceExpired ? 'Expired' : 'Expires'} ${new Date(profile.licenseExpiry).toLocaleDateString()}`}
          </div>
          {profile?.licenseExpiry && licenceTone !== 'calm' && (
            <div style={s.statusNote(licenceTone)}>{countdown()}</div>
          )}
        </div>
      </div>

      <p style={s.hint}>
        To change this date, open <strong>Account details</strong> and choose Edit profile.
      </p>
    </div>
  );

  const passwordPanel = (
    <div style={s.panel}>
      <div>
        <h1 style={s.h1}>Change password</h1>
        <p style={s.lead}>Update the password you use to log in.</p>
      </div>

      {pwSuccess && <div style={s.formSuccess}>{pwSuccess}</div>}
      {pwError && <div style={s.formError}>{pwError}</div>}

      {pwStep === 'form' ? (
        <form style={s.pwForm} onSubmit={handleRequestPasswordChange}>
          <div>
            <label style={s.label} htmlFor="pw-current">Current password</label>
            <PasswordInput id="pw-current" style={s.pwInput} value={pwForm.currentPassword} isDark={isDark}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
          </div>
          <div>
            <label style={s.label} htmlFor="pw-new">New password</label>
            <PasswordInput id="pw-new" style={s.pwInput} value={pwForm.newPassword} minLength={8} isDark={isDark}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
          </div>
          <div>
            <label style={s.label} htmlFor="pw-confirm">Confirm new password</label>
            <PasswordInput id="pw-confirm" style={s.pwInput} value={pwForm.confirmPassword} minLength={8} isDark={isDark}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required />
          </div>
          <div>
            <button type="submit" style={s.pwSubmit} disabled={pwSaving}>
              {pwSaving ? 'Sending code...' : 'Continue'}
            </button>
          </div>
        </form>
      ) : (
        <form style={s.pwForm} onSubmit={handleConfirmPasswordChange}>
          <p style={{ ...s.lead, margin: 0 }}>
            We sent a 6-digit code to <strong>{profile?.email}</strong>. Enter it below to finish changing your password.
          </p>
          <div>
            <label style={s.label} htmlFor="pw-code">Verification code</label>
            <OtpInput value={pwCode} onChange={setPwCode} isDark={isDark} />
          </div>
          <div>
            <button
              type="button"
              className="text-link-btn"
              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: ink, cursor: pwResendCooldown > 0 ? 'default' : 'pointer' }}
              onClick={handleResendPasswordCode}
              disabled={pwSaving || pwResendCooldown > 0}
            >
              {pwSaving ? 'Resending...' : pwResendCooldown > 0 ? `Resend code in ${pwResendCooldown}s` : "Didn't get it? Resend code"}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="submit" style={s.pwSubmit} disabled={pwSaving}>
              {pwSaving ? 'Updating...' : 'Confirm & Update Password'}
            </button>
            <button type="button" style={{ ...s.btn, minHeight: '44px' }} onClick={cancelPasswordVerify} disabled={pwSaving}>
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div style={s.page}>
      <main style={s.main}>
        <div className="profile-sidebar" style={s.sidebar}>
          <div style={s.identity}>
            <div className="profile-avatar-outer" style={s.avatarOuter}>
              <div style={s.avatarWrap}>
                {(pendingPhoto?.image || shown?.image)
                  ? <img src={pendingPhoto?.image || shown.image} alt="" style={s.avatarImg} />
                  : <span style={s.avatarInitials}>{initialsOf(shown?.name)}</span>}
              </div>
              <label htmlFor="profile-avatar-input" className="profile-avatar-badge" style={s.avatarBadge}>
                <EditPencilIcon size={12} />
                <span className="sr-only">{shown?.image ? 'Change profile photo' : 'Add profile photo'}</span>
              </label>
              <input
                id="profile-avatar-input"
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
              />
            </div>
            <div style={s.identityMeta}>
              <span style={s.identityName}>{shown?.name || ''}</span>
              {avatarUploading ? (
                <span style={s.identityHint}>Uploading photo...</span>
              ) : pendingPhoto ? (
                <span style={s.identityHint}>New photo — press Save changes to use it</span>
              ) : memberSince ? (
                <span style={s.identityHint}>Member since {memberSince}</span>
              ) : (
                // The join date is the one thing here the cached login
                // doesn't know, so it waits rather than leaving a gap that
                // pushes the menu down when it arrives.
                <Skeleton height="12.5px" width="140px" isDark={isDark} />
              )}
            </div>
          </div>

          {avatarError && <div style={s.formError}>{avatarError}</div>}

          <nav style={s.menuCard} aria-label="Profile sections">
            {menu.map((m) => (
              <button
                key={m.key}
                type="button"
                className="profile-menu-btn"
                style={s.menuBtn(active === m.key)}
                aria-current={active === m.key ? 'page' : undefined}
                onClick={() => setSection(m.key)}
              >
                {m.label}
                {m.key === 'licence' && licenceFlag && (
                  <>
                    <span style={s.menuDot} aria-hidden="true" />
                    <span className="sr-only">— expires soon</span>
                  </>
                )}
              </button>
            ))}
          </nav>

          <p style={s.help}>
            Need help with your account? <Link to="/help" style={s.helpLink}>Contact our support team</Link>
          </p>
        </div>

        {active === 'details' && detailsPanel}
        {active === 'licence' && licencePanel}
        {active === 'password' && passwordPanel}
      </main>
    </div>
  );
};

export default Profile;
