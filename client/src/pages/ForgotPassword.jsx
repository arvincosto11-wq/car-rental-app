import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import PasswordInput from '../components/PasswordInput';
import OtpInput from '../components/OtpInput';
import usePageTitle from '../hooks/usePageTitle';
import useResendCooldown from '../hooks/useResendCooldown';
import api from '../api';

const ForgotPassword = () => {
  usePageTitle('Forgot Password');
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendCooldown, startResendCooldown] = useResendCooldown();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setNotice(res.data.message);
      startResendCooldown();
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setNotice(res.data.message);
      startResendCooldown();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!code.trim()) {
      setError('Please enter the code sent to your email.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-email-code', { email, code: code.trim() });
      await api.post('/auth/reset-password', { email, newPassword });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? '#18191a' : '#f9fafb', padding: '40px 16px',
    },
    card: {
      background: isDark ? '#242526' : '#fff', padding: '40px', borderRadius: '12px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, width: '100%', maxWidth: '400px',
    },
    title: { fontSize: '24px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '24px' },
    error: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626',
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
    },
    notice: {
      background: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', color: isDark ? '#93c5fd' : '#1e40af',
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
    },
    field: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    btn: {
      width: '100%', padding: '11px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '8px',
    },
    footer: { textAlign: 'center', fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '20px' },
    footerLink: { color: isDark ? GOLD_DARK : GOLD, textDecoration: 'none', fontWeight: '500' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{step === 'email' ? 'Forgot password?' : 'Reset password'}</h1>
        <p style={styles.subtitle}>
          {step === 'email'
            ? "Enter your account's email and we'll send you a code to reset your password."
            : `Enter the code sent to ${email} and choose a new password.`}
        </p>

        {notice && <div style={styles.notice}>{notice}</div>}
        {error && <div style={styles.error}>{error}</div>}

        {step === 'email' ? (
          <form onSubmit={handleSendCode}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="fp-email">Email</label>
              <input id="fp-email" style={styles.input} type="email" placeholder="Enter your email"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Sending code...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="fp-code">Verification Code</label>
              <OtpInput value={code} onChange={setCode} isDark={isDark} />
            </div>
            <button type="button" className="text-link-btn" style={{ background: 'none', border: 'none', padding: 0, marginBottom: '16px', font: 'inherit', color: isDark ? GOLD_DARK : GOLD, cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
              onClick={handleResendCode} disabled={loading || resendCooldown > 0}>
              {loading ? 'Resending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get it? Resend code"}
            </button>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="fp-new-password">New Password</label>
              <PasswordInput id="fp-new-password" style={styles.input} isDark={isDark} minLength={8}
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="fp-confirm-password">Confirm New Password</label>
              <PasswordInput id="fp-confirm-password" style={styles.input} isDark={isDark} minLength={8}
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <p style={styles.footer}>
          Remembered it? <Link to="/login" style={styles.footerLink}>Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
