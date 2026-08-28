import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import api from '../api';
import LocationAddressFields from '../components/LocationAddressFields';
import PasswordInput from '../components/PasswordInput';

const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;

const Register = () => {
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    phone: '', address: '',
    licenseNumber: '', licenseExpiry: '',
    emergencyContactName: '', emergencyContactNumber: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validIdImage, setValidIdImage] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleIdImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setValidIdImage(file);
      setValidIdPreview(URL.createObjectURL(file));
    }
  };

  const uploadToImageKit = async (file) => {
    const authRes = await api.get('/imagekit/public-auth');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!PHONE_REGEX.test(form.phone)) {
      setError('Please enter a valid Philippine phone number (e.g. 09171234567 or +639171234567)');
      return;
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      let uploaded = { url: '', fileId: '' };
      if (validIdImage) {
        uploaded = await uploadToImageKit(validIdImage);
      }

      const res = await api.post('/auth/register', {
        ...form,
        validIdImage: uploaded.url,
        validIdImageFileId: uploaded.fileId,
      });
      login(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
      background: isDark ? '#0f172a' : '#f9fafb',
      padding: '40px 16px',
    },
    card: {
      background: isDark ? '#1e293b' : '#fff',
      padding: '40px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      width: '100%',
      maxWidth: '480px',
    },
    title: {
      fontSize: '24px',
      fontWeight: '600',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginBottom: '4px',
    },
    subtitle: {
      fontSize: '14px',
      color: isDark ? '#94a3b8' : '#6b7280',
      marginBottom: '24px',
    },
    consignmentNotice: {
      background: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
      border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`,
      color: isDark ? '#93c5fd' : '#1e40af',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px',
    },
    consignmentLink: {
      color: isDark ? '#93c5fd' : '#1d4ed8',
      fontWeight: '600',
      textDecoration: 'underline',
    },
    error: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2',
      color: isDark ? '#fca5a5' : '#dc2626',
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      marginBottom: '16px',
    },
    row: { gap: '12px' },
    field: { marginBottom: '16px' },
    label: {
      display: 'block',
      fontSize: '13px',
      color: isDark ? '#94a3b8' : '#374151',
      marginBottom: '6px',
      fontWeight: '500',
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f1f5f9' : '#111827',
    },
    idUpload: {
      position: 'relative',
      width: '100%',
      height: '140px',
      border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDark ? '#0f172a' : '#fff',
    },
    idPlaceholder: { textAlign: 'center', padding: '16px' },
    idPreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity: 0,
      cursor: 'pointer',
    },
    btn: {
      width: '100%',
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
      color: isDark ? '#94a3b8' : '#6b7280',
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
      <div style={styles.card}>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.subtitle}>Sign up to get started</p>

        <div style={styles.consignmentNotice}>
          🚗 Have a car to rent out? <Link to="/consignment/register" style={styles.consignmentLink}>Apply for consignment</Link> instead.
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              style={styles.input}
              type="text"
              placeholder="Enter your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              style={styles.input}
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="reg-password">Password</label>
            <PasswordInput
              id="reg-password"
              style={styles.input}
              placeholder="Create a password (min. 8 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              isDark={isDark}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="reg-confirm-password">Confirm Password</label>
            <PasswordInput
              id="reg-confirm-password"
              style={styles.input}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              isDark={isDark}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label} htmlFor="reg-phone">Phone Number</label>
            <input
              id="reg-phone"
              style={styles.input}
              type="tel"
              placeholder="09171234567"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <LocationAddressFields
            styles={styles}
            onChange={(address) => setForm((f) => ({ ...f, address }))}
          />

          <div style={styles.field}>
            <label style={styles.label} htmlFor="reg-valid-id">Valid ID (Driver's License, National ID, etc.) — optional for now</label>
            <div style={styles.idUpload}>
              {validIdPreview ? (
                <img src={validIdPreview} alt="ID preview" style={styles.idPreview} />
              ) : (
                <div style={styles.idPlaceholder}>
                  <span style={{ fontSize: '28px' }}>🪪</span>
                  <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '6px' }}>Click to upload a photo of your ID</p>
                </div>
              )}
              <input id="reg-valid-id" type="file" accept="image/*" onChange={handleIdImageChange} style={styles.fileInput} />
            </div>
          </div>

          <p style={{ ...styles.subtitle, marginBottom: '8px' }}>
            Driver's license (optional now — only needed if you later book a self-drive vehicle)
          </p>
          <div className="responsive-row-2" style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="reg-license-number">Driver's License Number</label>
              <input
                id="reg-license-number"
                style={styles.input}
                type="text"
                placeholder="e.g. N01-23-456789"
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="reg-license-expiry">License Expiry Date</label>
              <input
                id="reg-license-expiry"
                style={styles.input}
                type="date"
                value={form.licenseExpiry}
                onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
              />
            </div>
          </div>

          <div className="responsive-row-2" style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="reg-emergency-name">Emergency Contact Name</label>
              <input
                id="reg-emergency-name"
                style={styles.input}
                type="text"
                placeholder="Full name"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label} htmlFor="reg-emergency-number">Emergency Contact Number</label>
              <input
                id="reg-emergency-number"
                style={styles.input}
                type="tel"
                placeholder="09171234567"
                value={form.emergencyContactNumber}
                onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })}
                required
              />
            </div>
          </div>

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.footerLink}>Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
