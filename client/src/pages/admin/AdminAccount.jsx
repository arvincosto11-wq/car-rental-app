import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import BackButton from '../../components/BackButton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { useAuth } from '../../context/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';

// The admin's own account, which had no screen at all until now — the
// sidebar went straight from the last operations page to Logout.
//
// That mattered more than it sounds. Changing a password needs a code sent
// by email, so an admin whose address was never a real mailbox could not
// change their own password, could not use Forgot Password, and had no way
// to correct the address either. The account was simply stuck. Changing the
// email is therefore the first thing here, not an afterthought: it is what
// unlocks everything else.

const RESEND_SECONDS = 60;

const AdminAccount = () => {
  usePageTitle('Account Settings');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // Both flows are two steps: prove who you are, then prove you can receive
  // mail at the address the code went to.
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
      .then((res) => setEmail(res.data.email || ''))
      .catch(() => setEmail(user?.email || ''))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // A mailbox nobody owns can't receive anything, so every recovery route
  // out of this account is closed until it's corrected. Worth saying on the
  // screen rather than leaving someone to discover it at the worst moment.
  // Matched on the whole name before the @, not a prefix: admin@gmail.com
  // is a placeholder, admin.rentaride@gmail.com is somebody's real mailbox
  // and warning about it would just train people to ignore this.
  const looksUnreachable = /^(admin|administrator|test|sample|example|user|demo)@/i.test(email);

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
      setEmail(res.data.email);
      setEmailForm({ currentPassword: '', newEmail: '' });
      setEmailCode('');
      setEmailStep('form');
      toast.success('Email updated. Sign in with the new address from now on.');
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Could not change the email.');
    } finally {
      setEmailBusy(false);
    }
  };

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
      setPwStep('form');
      toast.success('Password updated.');
    } catch (err) {
      setPwError(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setPwBusy(false);
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    head: { marginBottom: '22px' },
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: 0 },
    sub: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '4px 0 0' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', maxWidth: '900px' },
    card: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '14px', padding: '20px',
    },
    cardTitle: { fontSize: '15px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: 0 },
    cardSub: { fontSize: '12px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#6b7280', margin: '5px 0 16px' },
    current: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      padding: '10px 12px', borderRadius: '9px', marginBottom: '14px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '600',
    },
    currentLabel: { fontSize: '10px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af' },
    warn: {
      padding: '10px 12px', borderRadius: '9px', marginBottom: '14px',
      fontSize: '11.5px', lineHeight: 1.5, fontWeight: '600',
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '5px' },
    input: {
      width: '100%', padding: '9px 11px', marginBottom: '12px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', fontFamily: 'inherit', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    codeInput: { letterSpacing: '0.35em', fontSize: '17px', fontWeight: '700', textAlign: 'center' },
    error: {
      padding: '9px 11px', borderRadius: '8px', marginBottom: '12px',
      fontSize: '12px', lineHeight: 1.45,
      background: isDark ? 'rgba(220,38,38,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#b91c1c',
    },
    sentTo: { fontSize: '12px', lineHeight: 1.5, color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '12px' },
    row: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' },
    primary: {
      padding: '9px 18px', borderRadius: '8px', border: 'none',
      background: gold, color: ON_GOLD, fontSize: '13px', fontWeight: '700',
      fontFamily: 'inherit', cursor: 'pointer',
    },
    ghost: {
      padding: '9px 14px', borderRadius: '8px', background: 'transparent',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      color: isDark ? '#b0b3b8' : '#4b5563', fontSize: '13px', fontWeight: '600',
      fontFamily: 'inherit', cursor: 'pointer',
    },
    link: {
      background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
      color: gold, fontSize: '12px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline',
    },
    linkOff: {
      background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
      color: isDark ? '#6b7280' : '#9ca3af', fontSize: '12px', fontWeight: '600', cursor: 'default',
    },
  };

  return (
    <AdminLayout activePage="Account Settings">
      <BackButton />
      <div style={s.head}>
        <h1 style={s.title}>Account Settings</h1>
        <p style={s.sub}>Your own sign-in details. Nobody else&apos;s account is managed here.</p>
      </div>

      <div style={s.grid}>
        <div style={s.card}>
          <h2 style={s.cardTitle}>Email address</h2>
          <p style={s.cardSub}>
            This is what you sign in with, and where every verification and password-reset code is sent.
            The code below goes to the <strong>new</strong> address, because the only thing worth proving
            is that you can actually receive mail there.
          </p>

          <div style={s.current}>
            <span style={s.currentLabel}>Currently</span>
            <span>{loading ? '…' : email}</span>
          </div>

          {looksUnreachable && (
            <div style={s.warn}>
              This address does not look like a mailbox you own. If it is not real, no code can reach you —
              which means you cannot change your password and Forgot Password cannot work either.
              Change it to a real address before anything else.
            </div>
          )}

          {emailError && <div style={s.error}>{emailError}</div>}

          {emailStep === 'form' ? (
            <form onSubmit={sendEmailCode}>
              <label style={s.label} htmlFor="aa-new-email">New email address</label>
              <input
                id="aa-new-email" style={s.input} type="email" autoComplete="email"
                placeholder="you@example.com"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                required
              />
              <label style={s.label} htmlFor="aa-email-pw">Your current password</label>
              <input
                id="aa-email-pw" style={s.input} type="password" autoComplete="current-password"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                required
              />
              <button type="submit" style={s.primary} disabled={emailBusy}>
                {emailBusy ? 'Sending…' : 'Send code to the new address'}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmEmail}>
              <p style={s.sentTo}>
                We sent a 6-digit code to <strong>{emailForm.newEmail}</strong>. Enter it to switch over.
              </p>
              <label style={s.label} htmlFor="aa-email-code">Verification code</label>
              <input
                id="aa-email-code" style={{ ...s.input, ...s.codeInput }} inputMode="numeric" maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                required
              />
              <div style={s.row}>
                <button type="submit" style={s.primary} disabled={emailBusy}>
                  {emailBusy ? 'Checking…' : 'Change my email'}
                </button>
                <button type="button" style={s.ghost} onClick={() => { setEmailStep('form'); setEmailCode(''); setEmailError(''); }}>
                  Back
                </button>
                <button
                  type="button"
                  style={cooldown > 0 ? s.linkOff : s.link}
                  disabled={cooldown > 0 || emailBusy}
                  onClick={() => sendEmailCode()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={s.card}>
          <h2 style={s.cardTitle}>Password</h2>
          <p style={s.cardSub}>
            At least 8 characters. A code goes to the address above to confirm it is really you,
            so make sure that address is one you can read first.
          </p>

          {pwError && <div style={s.error}>{pwError}</div>}

          {pwStep === 'form' ? (
            <form onSubmit={sendPasswordCode}>
              <label style={s.label} htmlFor="aa-cur-pw">Current password</label>
              <input
                id="aa-cur-pw" style={s.input} type="password" autoComplete="current-password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                required
              />
              <label style={s.label} htmlFor="aa-new-pw">New password</label>
              <input
                id="aa-new-pw" style={s.input} type="password" autoComplete="new-password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                required
              />
              <label style={s.label} htmlFor="aa-confirm-pw">Confirm new password</label>
              <input
                id="aa-confirm-pw" style={s.input} type="password" autoComplete="new-password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                required
              />
              <button type="submit" style={s.primary} disabled={pwBusy}>
                {pwBusy ? 'Sending…' : 'Send confirmation code'}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmPassword}>
              <p style={s.sentTo}>
                We sent a 6-digit code to <strong>{email}</strong>.
              </p>
              <label style={s.label} htmlFor="aa-pw-code">Verification code</label>
              <input
                id="aa-pw-code" style={{ ...s.input, ...s.codeInput }} inputMode="numeric" maxLength={6}
                value={pwCode}
                onChange={(e) => setPwCode(e.target.value.replace(/\D/g, ''))}
                required
              />
              <div style={s.row}>
                <button type="submit" style={s.primary} disabled={pwBusy}>
                  {pwBusy ? 'Checking…' : 'Change my password'}
                </button>
                <button type="button" style={s.ghost} onClick={() => { setPwStep('form'); setPwCode(''); setPwError(''); }}>
                  Back
                </button>
                <button
                  type="button"
                  style={cooldown > 0 ? s.linkOff : s.link}
                  disabled={cooldown > 0 || pwBusy}
                  onClick={() => sendPasswordCode()}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAccount;
