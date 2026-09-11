import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import PasswordInput from '../components/PasswordInput';
import LoginRouteCanvas from '../components/LoginRouteCanvas';
import usePageTitle from '../hooks/usePageTitle';
import api from '../api';

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const Login = () => {
  usePageTitle('Login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.user, res.data.token);
      const role = res.data.user.role;
      navigate(role === 'admin' ? '/admin' : role === 'consignor' ? '/consignor' : '/my-bookings');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDark ? '#18191a' : '#f9fafb',
      padding: '40px 16px',
    },
    card: {
      display: 'flex',
      width: '100%',
      maxWidth: '900px',
      borderRadius: '20px',
      overflow: 'hidden',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.08)',
    },
    panel: {
      position: 'relative',
      width: '44%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: isDark
        ? 'linear-gradient(160deg, #242526 0%, #18191a 100%)'
        : `linear-gradient(160deg, #faedc7 0%, #fff 100%)`,
      borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    panelContent: { position: 'relative', zIndex: 1, textAlign: 'center' },
    logoImg: {
      width: '72px', height: '72px', borderRadius: '50%', marginBottom: '20px',
      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.14)',
    },
    panelTitle: { fontSize: '26px', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '10px' },
    panelSubtitle: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280', maxWidth: '250px', margin: '0 auto', lineHeight: '1.6' },
    formSide: {
      flex: 1, minWidth: 0, padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
      background: isDark ? '#242526' : '#fff',
    },
    title: {
      fontSize: '24px',
      fontWeight: '600',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      marginBottom: '4px',
    },
    subtitle: {
      fontSize: '14px',
      color: isDark ? '#b0b3b8' : '#6b7280',
      marginBottom: '24px',
    },
    error: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2',
      color: isDark ? '#fca5a5' : '#dc2626',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px',
    },
    field: { marginBottom: '16px' },
    label: {
      display: 'block',
      fontSize: '13px',
      color: isDark ? '#b0b3b8' : '#374151',
      marginBottom: '6px',
      fontWeight: '500',
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box',
      background: isDark ? '#18191a' : '#fff',
      color: isDark ? '#e4e6eb' : '#111827',
    },
    btn: {
      width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      padding: '11px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      marginTop: '8px',
    },
    footer: {
      textAlign: 'center',
      fontSize: '13px',
      color: isDark ? '#b0b3b8' : '#6b7280',
      marginTop: '20px',
    },
    footerLink: {
      color: isDark ? GOLD_DARK : GOLD,
      textDecoration: 'none',
      fontWeight: '500',
    },
  };

  return (
    <div style={styles.container}>
      <div className="login-card" style={styles.card}>
        <div className="login-map-panel" style={styles.panel}>
          <LoginRouteCanvas dotColor={isDark ? GOLD_DARK : GOLD} lineColor={isDark ? GOLD_DARK : GOLD} />
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={styles.panelContent}
          >
            <img src="/logo.png" alt="Rent-a-Ride Albay" style={styles.logoImg} />
            <h2 className="display-heading" style={styles.panelTitle}>Rent-a-Ride Albay</h2>
            <p style={styles.panelSubtitle}>Sign in to manage your bookings and explore our fleet.</p>
          </motion.div>
        </div>

        <div style={styles.formSide}>
          <h1 style={styles.title}>Log In</h1>
          <p style={styles.subtitle}>Enter your details to access your account</p>

          {error && <div style={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="login-email">Email</label>
              <input
                id="login-email"
                style={styles.input}
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="login-password">Password</label>
              <PasswordInput
                id="login-password"
                style={styles.input}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                isDark={isDark}
              />
              <p style={{ textAlign: 'right', marginTop: '6px' }}>
                <Link to="/forgot-password" style={{ ...styles.footerLink, fontSize: '12px' }}>Forgot password?</Link>
              </p>
            </div>
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
              {!loading && <ArrowIcon />}
            </button>
          </form>

          <p style={styles.footer}>
            Don't have an account?{' '}
            <Link to="/register" style={styles.footerLink}>Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
