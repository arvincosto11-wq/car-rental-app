import { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/AdminLayout';
import BackButton from '../../components/BackButton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { useAuth } from '../../context/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';
import Skeleton from '../../components/Skeleton';
import PasswordInput from '../../components/PasswordInput';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';

// The admin's own account, which had no screen at all until recently — the
// sidebar went straight from the last operations page to Logout.
//
// That mattered more than it sounds. Changing a password needs a code sent
// by email, so an admin whose address was never a real mailbox could not
// change their own password, could not use Forgot Password, and had no way
// to correct the address either. The account was simply stuck. Changing the
// email is therefore here, not an afterthought: it is what unlocks
// everything else.
//
// The page is now in two halves: who you are, which anybody can change
// freely, and how you sign in, which costs a code every time.

const RESEND_SECONDS = 60;

// "Admin" → A. "Maria Santos" → MS. The first and last words only, so a
// middle name does not produce three letters in a circle built for two.
const initialsOf = (name) => {
  const words = String(name || 'Admin').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'A';
  const first = words[0][0] || '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
};

const prettyDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '');

const UploadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" />
  </svg>
);
const TickIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5l5 2v4c0 3.2-2.2 5.6-5 7-2.8-1.4-5-3.8-5-7v-4z" />
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1.5" y="3" width="13" height="10" rx="1.5" /><path d="M2 4l6 5 6-5" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
  </svg>
);

// The rail says where you are without anybody counting forms. Declared out
// here rather than inside the page: a component built during a render is a
// new component every time, and loses whatever state it held.
const StepRail = ({ step, labels, s }) => {
  const order = ['form', 'verify', 'done'];
  const at = order.indexOf(step);
  return (
    <ol aria-label="Steps" style={s.steps}>
      {labels.map((label, i) => {
        const state = i < at ? 'done' : (i === at ? 'current' : 'upcoming');
        return (
          <li key={label} style={s.step(state)}>
            <span style={s.stepDot(state)}>{state === 'done' ? <TickIcon /> : i + 1}</span>
            {label}
            {i < labels.length - 1 && <span style={s.stepJoin} />}
          </li>
        );
      })}
    </ol>
  );
};

const AdminAccount = () => {
  usePageTitle('Account Settings');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const { user, updateUser } = useAuth();

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── who you are ─────────────────────────────────────────────────────
  const [profile, setProfile] = useState({ name: '', phone: '', image: '', imageFileId: '' });
  const [savedProfile, setSavedProfile] = useState({ name: '', phone: '', image: '', imageFileId: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const fileInput = useRef(null);

  // ── how you sign in ─────────────────────────────────────────────────
  const [openRow, setOpenRow] = useState(null);
  const [emailForm, setEmailForm] = useState({ currentPassword: '', newEmail: '' });
  const [emailStep, setEmailStep] = useState('form');
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwStep, setPwStep] = useState('form');
  const [pwCode, setPwCode] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        setAccount(res.data);
        const next = {
          name: res.data.name || '',
          phone: res.data.phone || '',
          image: res.data.image || '',
          imageFileId: res.data.imageFileId || '',
        };
        setProfile(next);
        setSavedProfile(next);
      })
      .catch(() => setAccount({ email: user?.email || '', name: user?.name || '' }))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const email = account?.email || '';

  // A mailbox nobody owns can't receive anything, so every recovery route
  // out of this account is closed until it's corrected. Worth saying on the
  // screen rather than leaving someone to discover it at the worst moment.
  const looksUnreachable = /^(admin|administrator|test|sample|example|user|demo)@/i.test(email);

  const dirty = profile.name !== savedProfile.name
    || profile.phone !== savedProfile.phone
    || profile.image !== savedProfile.image;

  // ── the photo ───────────────────────────────────────────────────────
  //
  // Up to the same place vehicle photographs go. Held in state until Save,
  // so a photo picked and then discarded never becomes the avatar.
  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const authRes = await api.get('/imagekit/user-auth');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('publicKey', authRes.data.publicKey);
      formData.append('signature', authRes.data.signature);
      formData.append('expire', authRes.data.expire);
      formData.append('token', authRes.data.token);
      const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
        method: 'POST', body: formData,
      });
      const data = await uploadRes.json();
      if (!data.url) throw new Error('upload failed');
      setProfile((p) => ({ ...p, image: data.url, imageFileId: data.fileId || '' }));
      setJustSaved(false);
    } catch (err) {
      console.error(err);
      toast.error('Could not upload that photo. Try another one.');
    } finally {
      event.target.value = '';
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/me', {
        name: profile.name.trim() || savedProfile.name,
        phone: profile.phone.trim(),
        image: profile.image,
        imageFileId: profile.imageFileId,
      });
      const next = {
        name: res.data.name || '',
        phone: res.data.phone || '',
        image: res.data.image || '',
        imageFileId: res.data.imageFileId || '',
      };
      setProfile(next);
      setSavedProfile(next);
      setAccount((a) => ({ ...a, ...next }));
      // The sidebar and the top bar read the cached login, so they would
      // otherwise keep the old name until somebody signed in again.
      updateUser({ name: next.name, image: next.image });
      setJustSaved(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const discardProfile = () => {
    setProfile(savedProfile);
    setJustSaved(false);
  };

  // ── email ───────────────────────────────────────────────────────────
  const sendEmailCode = async (e) => {
    if (e) e.preventDefault();
    setEmailError('');
    setEmailBusy(true);
    try {
      await api.post('/auth/change-email/send-code', emailForm);
      setCooldown(RESEND_SECONDS);
      setEmailStep('verify');
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Could not send the code.');
    } finally {
      setEmailBusy(false);
    }
  };

  const confirmEmail = async (e) => {
    e.preventDefault();
    setEmailError('');
    if (!emailCode.trim()) return setEmailError('Enter the code sent to the new address.');
    setEmailBusy(true);
    try {
      const target = emailForm.newEmail.trim().toLowerCase();
      await api.post('/auth/verify-email-code', { email: target, code: emailCode.trim() });
      const res = await api.put('/auth/change-email', emailForm);
      setAccount((a) => ({ ...a, email: res.data.email }));
      setEmailForm({ currentPassword: '', newEmail: '' });
      setEmailCode('');
      setEmailStep('done');
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Could not change the email.');
    } finally {
      setEmailBusy(false);
    }
  };

  // ── password ────────────────────────────────────────────────────────
  const sendPasswordCode = async (e) => {
    if (e) e.preventDefault();
    setPwError('');
    if (pwForm.newPassword.length < 8) return setPwError('New password must be at least 8 characters.');
    if (pwForm.newPassword !== pwForm.confirmPassword) return setPwError('The two new passwords do not match.');
    setPwBusy(true);
    try {
      await api.post('/auth/change-password/send-code', { currentPassword: pwForm.currentPassword });
      setCooldown(RESEND_SECONDS);
      setPwStep('verify');
    } catch (err) {
      setPwError(err.response?.data?.message || 'Could not send the code.');
    } finally {
      setPwBusy(false);
    }
  };

  const confirmPassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (!pwCode.trim()) return setPwError('Enter the code sent to your email.');
    setPwBusy(true);
    try {
      await api.post('/auth/verify-email-code', { email, code: pwCode.trim() });
      await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwCode('');
      setAccount((a) => ({ ...a, passwordChangedAt: new Date().toISOString() }));
      setPwStep('done');
    } catch (err) {
      setPwError(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setPwBusy(false);
    }
  };

  const closeRow = (which) => {
    setOpenRow(null);
    if (which === 'email') { setEmailStep('form'); setEmailError(''); setEmailCode(''); }
    else { setPwStep('form'); setPwError(''); setPwCode(''); }
  };

  // ── colours ─────────────────────────────────────────────────────────
  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const field = isDark ? '#1e1f20' : '#ffffff';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const line2 = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';
  const chip = isDark ? '#303132' : '#f1f2f4';
  const green = isDark ? '#4ade80' : '#15803d';
  const greenBg = isDark ? 'rgba(34,197,94,0.14)' : '#dcfce7';
  const disabled = isDark ? '#303132' : '#e5e7eb';
  const disabledInk = isDark ? '#6b6e72' : '#9ca3af';

  const s = {
    main: { maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' },
    title: { margin: 0, fontSize: '26px', fontWeight: '700', color: text },
    sub: { margin: '6px 0 0', fontSize: '14px', color: text2 },

    card: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px',
      padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px',
    },
    profileRow: { display: 'flex', gap: '28px', alignItems: 'flex-start' },
    avatarCol: { width: '120px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
    // The normal state is no photo at all, so the initials have to look
    // chosen rather than like a placeholder waiting to be filled.
    initials: {
      width: '104px', height: '104px', flexShrink: 0, borderRadius: '50%',
      background: gold, color: ON_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '38px', fontWeight: '800', letterSpacing: '0.02em',
      boxShadow: `0 0 0 4px ${card}, 0 0 0 5px ${goldLine}`,
    },
    photo: {
      width: '104px', height: '104px', flexShrink: 0, borderRadius: '50%',
      objectFit: 'cover', border: `1px solid ${line}`,
    },
    photoActions: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
    outlineBtn: {
      display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px',
      border: `1px solid ${line}`, background: card, color: text,
      fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
    },
    removeBtn: {
      padding: '4px 8px', border: 'none', background: 'none', fontFamily: 'inherit',
      fontSize: '13px', fontWeight: '600', color: text2, cursor: 'pointer',
      textDecoration: 'underline', textUnderlineOffset: '3px',
    },
    photoHint: { fontSize: '12px', color: text3, textAlign: 'center', lineHeight: 1.4 },

    profileBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' },
    h2: { margin: 0, fontSize: '17px', fontWeight: '700', color: text },
    cardSub: { fontSize: '13px', color: text3 },
    fields: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' },
    label: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', fontWeight: '600', color: text2 },
    input: {
      height: '42px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${line}`,
      background: field, fontSize: '14px', fontWeight: '400', color: text,
      boxSizing: 'border-box', fontFamily: 'inherit',
    },
    helper: { fontSize: '12px', fontWeight: '400', color: text3 },
    saveRow: { display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '4px', flexWrap: 'wrap' },
    primary: {
      padding: '10px 20px', borderRadius: '8px', border: 'none',
      background: gold, color: ON_GOLD, fontSize: '14px', fontWeight: '700',
      cursor: 'pointer', fontFamily: 'inherit',
    },
    primaryOff: {
      padding: '10px 20px', borderRadius: '8px', border: 'none',
      background: disabled, color: disabledInk, fontSize: '14px', fontWeight: '700',
      cursor: 'default', fontFamily: 'inherit',
    },
    discard: {
      padding: '10px 6px', border: 'none', background: 'none', fontFamily: 'inherit',
      fontSize: '14px', fontWeight: '600', color: text2, cursor: 'pointer',
    },
    savedNote: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: green },

    identity: {
      display: 'flex', alignItems: 'center', gap: '8px 14px', flexWrap: 'wrap',
      padding: '0 4px', fontSize: '13px', color: text3,
    },
    identityRole: { display: 'flex', alignItems: 'center', gap: '6px', color: text2, fontWeight: '600' },

    credRow: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px',
      padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0,
    },
    credHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' },
    credLeft: { display: 'flex', gap: '12px', alignItems: 'flex-start', minWidth: 0 },
    credIcon: {
      width: '36px', height: '36px', flexShrink: 0, borderRadius: '9px',
      background: chip, color: text2, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    credTitle: { margin: 0, fontSize: '16px', fontWeight: '700', color: text },
    credValue: { fontSize: '14px', fontWeight: '600', color: text, overflowWrap: 'anywhere' },
    credMeta: { fontSize: '12px', color: text3 },

    steps: { display: 'flex', alignItems: 'center', gap: '8px', margin: 0, padding: 0, listStyle: 'none', fontSize: '12px', fontWeight: '700', flexWrap: 'wrap' },
    step: (state) => ({
      display: 'flex', alignItems: 'center', gap: '8px',
      color: state === 'upcoming' ? text3 : text,
    }),
    stepDot: (state) => ({
      width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', boxSizing: 'border-box',
      background: state === 'done' ? gold : (state === 'current' ? goldTint : 'transparent'),
      color: state === 'done' ? ON_GOLD : (state === 'current' ? ink : text3),
      border: `1px solid ${state === 'upcoming' ? line : gold}`,
    }),
    stepJoin: { width: '28px', height: '1px', background: line },

    help: { margin: 0, fontSize: '13px', lineHeight: 1.5, color: text2, textWrap: 'pretty' },
    sendRow: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
    sendNote: { fontSize: '12px', color: text3 },

    codePanel: {
      display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px',
      borderRadius: '10px', background: inset, border: `1px solid ${line2}`,
    },
    codeIntro: { fontSize: '14px', lineHeight: 1.5, color: text },
    codeInput: {
      width: '200px', height: '48px', padding: '0 14px', borderRadius: '8px',
      border: `1px solid ${line}`, background: field, fontSize: '22px', fontWeight: '700',
      letterSpacing: '0.4em', fontVariantNumeric: 'tabular-nums', color: text,
      boxSizing: 'border-box', fontFamily: 'inherit',
    },
    codeBtns: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
    back: { padding: '6px 2px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', color: text2, cursor: 'pointer' },
    resend: { padding: '6px 2px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', color: ink, cursor: 'pointer' },
    resendOff: { padding: '6px 2px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', color: text3, cursor: 'default' },

    done: {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderRadius: '10px',
      background: greenBg, color: green, fontSize: '14px', fontWeight: '600',
    },
    closeBtn: { marginLeft: 'auto', padding: '4px 8px', border: 'none', background: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: '600', color: text2, cursor: 'pointer' },

    error: {
      padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', lineHeight: 1.45,
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    warn: {
      padding: '10px 12px', borderRadius: '9px', fontSize: '12.5px', lineHeight: 1.5, fontWeight: '600',
      background: isDark ? 'rgba(217,119,6,0.16)' : '#fef3c7',
      color: isDark ? '#fbbf24' : '#92400e',
    },
  };

  return (
    <AdminLayout activePage="Account Settings">
      <BackButton />
      <div style={s.main}>
        <div>
          <h1 style={s.title}>Account Settings</h1>
          <p style={s.sub}>Who you are in the admin, and how you sign in.</p>
        </div>

        {loading ? (
          /* The server sleeps between visits, so the first load after a
             quiet spell can take several seconds. Showing the heading over
             an empty page made that look like a page that had failed. The
             shapes are the ones about to arrive: a round photo, two fields,
             then the two rows for signing in. */
          <>
            <section style={s.card}>
              <div style={s.profileRow}>
                <div style={s.avatarCol}>
                  <Skeleton width="104px" height="104px" radius="50%" isDark={isDark} />
                  <Skeleton width="120px" height="32px" radius="8px" isDark={isDark} />
                </div>
                <div style={s.profileBody}>
                  <Skeleton width="90px" height="18px" isDark={isDark} />
                  <Skeleton width="280px" height="13px" isDark={isDark} />
                  <div style={s.fields}>
                    <Skeleton height="42px" radius="8px" isDark={isDark} />
                    <Skeleton height="42px" radius="8px" isDark={isDark} />
                  </div>
                </div>
              </div>
            </section>
            <Skeleton width="320px" height="13px" isDark={isDark} style={{ margin: '0 4px' }} />
            <Skeleton height="104px" radius="12px" isDark={isDark} />
            <Skeleton height="104px" radius="12px" isDark={isDark} />
          </>
        ) : (
          <>
            {/* ── who you are ─────────────────────────────────────── */}
            <section style={s.card}>
              <div style={s.profileRow}>
                <div style={s.avatarCol}>
                  {profile.image
                    ? <img src={profile.image} alt="" style={s.photo} />
                    : <span style={s.initials}>{initialsOf(profile.name)}</span>}

                  <div style={s.photoActions}>
                    <button type="button" style={s.outlineBtn} onClick={() => fileInput.current?.click()}>
                      <UploadIcon />
                      {profile.image ? 'Replace photo' : 'Upload photo'}
                    </button>
                    <input
                      ref={fileInput}
                      id="aa-photo"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={pickPhoto}
                    />
                    {profile.image ? (
                      <button
                        type="button"
                        className="text-link-btn"
                        style={s.removeBtn}
                        onClick={() => { setProfile((p) => ({ ...p, image: '', imageFileId: '' })); setJustSaved(false); }}
                      >
                        Remove
                      </button>
                    ) : (
                      <span style={s.photoHint}>Square image,<br />shown as a circle</span>
                    )}
                  </div>
                </div>

                <div style={s.profileBody}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <h2 style={s.h2}>Profile</h2>
                    <span style={s.cardSub}>Shown in the sidebar and the top bar. No code needed to change these.</span>
                  </div>

                  <div style={s.fields}>
                    <label style={s.label} htmlFor="aa-name">
                      Name
                      <input
                        id="aa-name"
                        style={s.input}
                        value={profile.name}
                        placeholder="Your name"
                        onChange={(e) => { setProfile((p) => ({ ...p, name: e.target.value })); setJustSaved(false); }}
                      />
                      <span style={s.helper}>Appears as &ldquo;Welcome, {savedProfile.name || 'Admin'}&rdquo;</span>
                    </label>
                    <label style={s.label} htmlFor="aa-phone">
                      Phone number
                      <input
                        id="aa-phone"
                        style={s.input}
                        value={profile.phone}
                        placeholder="09XX XXX XXXX"
                        inputMode="tel"
                        onChange={(e) => { setProfile((p) => ({ ...p, phone: e.target.value })); setJustSaved(false); }}
                      />
                      <span style={s.helper}>Optional</span>
                    </label>
                  </div>

                  <div style={s.saveRow}>
                    {dirty ? (
                      <>
                        <button type="button" style={s.primary} disabled={savingProfile} onClick={saveProfile}>
                          {savingProfile ? 'Saving…' : 'Save profile'}
                        </button>
                        <button type="button" className="text-link-btn" style={s.discard} onClick={discardProfile}>
                          Discard
                        </button>
                      </>
                    ) : (
                      <button type="button" style={s.primaryOff} disabled>Save profile</button>
                    )}
                    {justSaved && !dirty && (
                      <span style={s.savedNote}><TickIcon />Saved. The sidebar and top bar now show it.</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ── who this account is ─────────────────────────────── */}
            <div style={s.identity}>
              <span style={s.identityRole}><ShieldIcon />Administrator</span>
              <span>{email}</span>
              {account?.createdAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Account created {prettyDate(account.createdAt)}</span>
                </>
              )}
            </div>

            {looksUnreachable && (
              <div style={s.warn}>
                This address looks like a placeholder rather than a mailbox somebody reads.
                Every code — including the one for forgotten passwords — is sent there, so
                correcting it below is worth doing before anything else.
              </div>
            )}

            {/* ── how you sign in ─────────────────────────────────── */}
            <section style={s.credRow}>
              <div style={s.credHead}>
                <div style={s.credLeft}>
                  <span style={s.credIcon}><MailIcon /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <h2 style={s.credTitle}>Email address</h2>
                    <span style={s.credValue}>{email}</span>
                    <span style={s.credMeta}>You sign in with this. Every code is sent here.</span>
                  </div>
                </div>
                <button
                  type="button"
                  style={s.outlineBtn}
                  onClick={() => (openRow === 'email' ? closeRow('email') : setOpenRow('email'))}
                >
                  {openRow === 'email' ? 'Cancel' : 'Change'}
                </button>
              </div>

              {openRow === 'email' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <StepRail step={emailStep} labels={['New address', 'Code from the new address', 'Done']} s={s} />
                  {emailError && <div style={s.error}>{emailError}</div>}

                  {emailStep === 'form' && (
                    <form onSubmit={sendEmailCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <p style={s.help}>
                        The code goes to the new address, to prove you can actually receive mail there.
                      </p>
                      <label style={s.label} htmlFor="aa-new-email">
                        New email address
                        <input
                          id="aa-new-email" style={s.input} type="email" required
                          value={emailForm.newEmail}
                          onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                        />
                      </label>
                      <label style={s.label} htmlFor="aa-email-pw">
                        Your current password
                        <PasswordInput
                          id="aa-email-pw" style={s.input} isDark={isDark} required
                          value={emailForm.currentPassword}
                          onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                        />
                      </label>
                      <div style={s.sendRow}>
                        <button type="submit" style={s.primary} disabled={emailBusy}>
                          {emailBusy ? 'Sending…' : 'Send code to the new address'}
                        </button>
                      </div>
                    </form>
                  )}

                  {emailStep === 'verify' && (
                    <form onSubmit={confirmEmail} style={s.codePanel}>
                      <span style={s.codeIntro}>
                        We sent a code to <strong>{emailForm.newEmail}</strong>. Type it below to finish.
                      </span>
                      <label style={s.label} htmlFor="aa-email-code">
                        Code
                        <input
                          id="aa-email-code" style={s.codeInput} inputMode="numeric" maxLength={6}
                          placeholder="••••••" value={emailCode}
                          onChange={(e) => setEmailCode(e.target.value)}
                        />
                      </label>
                      <div style={s.codeBtns}>
                        <button type="submit" style={s.primary} disabled={emailBusy}>
                          {emailBusy ? 'Changing…' : 'Change email'}
                        </button>
                        <button type="button" className="text-link-btn" style={s.back} onClick={() => setEmailStep('form')}>
                          Back
                        </button>
                        <button
                          type="button"
                          className="text-link-btn"
                          style={cooldown > 0 ? s.resendOff : s.resend}
                          disabled={cooldown > 0 || emailBusy}
                          onClick={() => sendEmailCode()}
                        >
                          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                        </button>
                      </div>
                    </form>
                  )}

                  {emailStep === 'done' && (
                    <div style={s.done}>
                      <TickIcon />
                      Email changed. Sign in with the new address from now on.
                      <button type="button" className="text-link-btn" style={s.closeBtn} onClick={() => closeRow('email')}>
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section style={s.credRow}>
              <div style={s.credHead}>
                <div style={s.credLeft}>
                  <span style={s.credIcon}><LockIcon /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                    <h2 style={s.credTitle}>Password</h2>
                    <span style={s.credValue}>••••••••••</span>
                    {account?.passwordChangedAt && (
                      <span style={s.credMeta}>Last changed {prettyDate(account.passwordChangedAt)}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  style={s.outlineBtn}
                  onClick={() => (openRow === 'password' ? closeRow('password') : setOpenRow('password'))}
                >
                  {openRow === 'password' ? 'Cancel' : 'Change'}
                </button>
              </div>

              {openRow === 'password' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <StepRail step={pwStep} labels={['New password', 'Code from your email', 'Done']} s={s} />
                  {pwError && <div style={s.error}>{pwError}</div>}

                  {pwStep === 'form' && (
                    <form onSubmit={sendPasswordCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <p style={s.help}>
                        At least 8 characters. A code then goes to your email address to confirm it is really you.
                      </p>
                      <label style={s.label} htmlFor="aa-cur-pw">
                        Current password
                        <PasswordInput
                          id="aa-cur-pw" style={s.input} isDark={isDark} required
                          value={pwForm.currentPassword}
                          onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                        />
                      </label>
                      <label style={s.label} htmlFor="aa-new-pw">
                        New password
                        <PasswordInput
                          id="aa-new-pw" style={s.input} isDark={isDark} required
                          value={pwForm.newPassword}
                          onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                        />
                      </label>
                      <label style={s.label} htmlFor="aa-confirm-pw">
                        Confirm new password
                        <PasswordInput
                          id="aa-confirm-pw" style={s.input} isDark={isDark} required
                          value={pwForm.confirmPassword}
                          onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                        />
                      </label>
                      <div style={s.sendRow}>
                        <button type="submit" style={s.primary} disabled={pwBusy}>
                          {pwBusy ? 'Sending…' : 'Send confirmation code'}
                        </button>
                        <span style={s.sendNote}>Goes to {email}</span>
                      </div>
                    </form>
                  )}

                  {pwStep === 'verify' && (
                    <form onSubmit={confirmPassword} style={s.codePanel}>
                      <span style={s.codeIntro}>
                        We sent a code to <strong>{email}</strong>. Type it below to finish.
                      </span>
                      <label style={s.label} htmlFor="aa-pw-code">
                        Code
                        <input
                          id="aa-pw-code" style={s.codeInput} inputMode="numeric" maxLength={6}
                          placeholder="••••••" value={pwCode}
                          onChange={(e) => setPwCode(e.target.value)}
                        />
                      </label>
                      <div style={s.codeBtns}>
                        <button type="submit" style={s.primary} disabled={pwBusy}>
                          {pwBusy ? 'Changing…' : 'Change password'}
                        </button>
                        <button type="button" className="text-link-btn" style={s.back} onClick={() => setPwStep('form')}>
                          Back
                        </button>
                        <button
                          type="button"
                          className="text-link-btn"
                          style={cooldown > 0 ? s.resendOff : s.resend}
                          disabled={cooldown > 0 || pwBusy}
                          onClick={() => sendPasswordCode()}
                        >
                          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
                        </button>
                      </div>
                    </form>
                  )}

                  {pwStep === 'done' && (
                    <div style={s.done}>
                      <TickIcon />
                      Password changed.
                      <button type="button" className="text-link-btn" style={s.closeBtn} onClick={() => closeRow('password')}>
                        Close
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAccount;
