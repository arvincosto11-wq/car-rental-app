import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const AdminLogin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      if (res.data.user.role !== 'admin') {
        setError('Access denied. Admin accounts only.');
        return;
      }
      login(res.data.user, res.data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>🚗</div>
          <h1 style={styles.logoText}>CarRental</h1>
        </div>
        <h2 style={styles.title}>Admin Portal</h2>
        <p style={styles.subtitle}>Sign in to access the admin dashboard</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              type="email"
              placeholder="Enter admin email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Enter password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.footer}>
          <a href="/" style={styles.footerLink}>← Back to main site</a>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
  },
  card: {
    background: '#1e293b',
    padding: '40px',
    borderRadius: '16px',
    border: '1px solid #334155',
    width: '100%',
    maxWidth: '400px',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  logoIcon: { fontSize: '28px' },
  logoText: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f1f5f9',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#f1f5f9',
    textAlign: 'center',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: '28px',
  },
  error: {
    background: 'rgba(220,38,38,0.15)',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '16px',
    border: '1px solid rgba(220,38,38,0.3)',
  },
  field: { marginBottom: '16px' },
  label: {
    display: 'block',
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '6px',
    fontWeight: '500',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    background: '#0f172a',
    color: '#f1f5f9',
  },
  btn: {
    width: '100%',
    padding: '11px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
  },
  footerLink: {
    fontSize: '13px',
    color: '#64748b',
    textDecoration: 'none',
  },
};

export default AdminLogin;