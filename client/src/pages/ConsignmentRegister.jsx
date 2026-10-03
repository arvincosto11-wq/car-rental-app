import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../data/vehicleBrands';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD, goldInk} from '../theme';
import LocationAddressFields from '../components/LocationAddressFields';
import PasswordInput from '../components/PasswordInput';
import BookingSteps from '../components/BookingSteps';
import AuthBrandPanel from '../components/AuthBrandPanel';
import usePageTitle from '../hooks/usePageTitle';
import useEmailAvailable from '../hooks/useEmailAvailable';
import useResendCooldown from '../hooks/useResendCooldown';
import OtpInput from '../components/OtpInput';

const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;
const PHONE_ERROR = 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';
const OTHER = '__other__';
const MIN_AGE_YEARS = 18;
const CONSIGN_STEPS = ['Your Information', 'Verify Email'];
const TAKEN_MESSAGE = 'That email already has an account. Log in instead, or use a different address.';

// Whole-years-old as of today — used both to validate on submit and to cap
// the date picker so a too-recent birthdate can't even be selected.
const ageInYears = (birthDate) => {
  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
};
const maxBirthDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  return d.toISOString().split('T')[0];
};

// Shown on the branding panel, swapped per step via AuthBrandPanel's own
// crossfade — keyed by step number so it matches CONSIGN_STEPS above.
const CONSIGN_TAGLINES = {
  1: 'Make an account, then book a time to bring your vehicle in.',
  2: 'Just confirm your email and your account is ready.',
};

const ConsignmentRegister = () => {
  usePageTitle('Apply for Consignment');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    // Owner info
    name: '', email: '', password: '', birthDate: '', phone: '', address: '',
    // Vehicle info
    brand: '', model: '', year: '', plateNumber: '', registrationExpiry: '', color: '', mileage: '',
    category: '', transmission: '', fuelType: '', seats: '',
    suggestedPricePerDay: '', description: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});





  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Checked while they type, so a taken address is caught before they
  // have filled in the rest of the form.
  const emailTaken = useEmailAvailable(form.email);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCooldown, startResendCooldown] = useResendCooldown();
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const goToStep = (n) => setStep(n);

  // Every check below sets a message on the specific field it's about
  // (fieldErrors.X, rendered directly under that field) instead of a
  // page-level banner, so the feedback shows up right where the problem is.
  const validateStep1 = () => {
    const nameError = !form.name.trim() ? 'Full name is required.' : '';
    const birthDateError = !form.birthDate
      ? 'Birthdate is required.'
      : (ageInYears(form.birthDate) < MIN_AGE_YEARS ? `You must be at least ${MIN_AGE_YEARS} years old to register.` : '');
    const emailError = !form.email.trim() ? 'Email is required.' : (emailTaken ? TAKEN_MESSAGE : '');
    const passwordError = !form.password ? 'Password is required.' : (form.password.length < 8 ? 'Password must be at least 8 characters.' : '');
    const confirmPasswordError = !confirmPassword ? 'Please confirm your password.' : (form.password !== confirmPassword ? 'Passwords do not match.' : '');
    const phoneError = !form.phone.trim() ? 'Phone number is required.' : (PHONE_REGEX.test(form.phone) ? '' : PHONE_ERROR);
    const addressError = !form.address.trim() ? 'Please complete your address.' : '';

    setFieldErrors((prev) => ({
      ...prev,
      name: nameError, birthDate: birthDateError, email: emailError, password: passwordError, confirmPassword: confirmPasswordError,
      phone: phoneError, address: addressError,
    }));
    return !(nameError || birthDateError || emailError || passwordError || confirmPasswordError || phoneError || addressError);
  };





  // Sends (or resends) the code without moving steps itself — the caller
  // decides what to do once it knows whether sending actually worked.
  const sendVerificationCode = async () => {
    setSendingCode(true);
    setError('');
    try {
      await api.post('/auth/send-verification-code', { email: form.email });
      startResendCooldown();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send the verification code. Please try again.');
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  const goToVerify = async () => {
    if (!validateStep1()) return;
    const sent = await sendVerificationCode();
    if (sent) setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!verificationCode.trim()) {
      setFieldErrors((prev) => ({ ...prev, verificationCode: 'Please enter the code we sent to your email.' }));
      return;
    }
    if (!validateStep1()) return;

    setLoading(true);
    try {
      // Confirms the code, then creates the account. The server checks the
      // address is verified either way, so a tampered request cannot skip it.
      await api.post('/auth/verify-email-code', { email: form.email, code: verificationCode.trim() });
      // The account only. Nothing about the vehicle is typed here any more:
      // it is seen at the office, with its papers, and entered there.
      const res = await api.post('/consignments/register', form);

      login(res.data.user, res.data.token);
      navigate('/consignor');
    } catch (err) {
      setError(err.response?.data?.message || 'Application failed. Please try again.');
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
      maxWidth: '1040px',
      borderRadius: '20px',
      overflow: 'hidden',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.08)',
    },
    panel: {
      position: 'relative',
      width: '36%',
      flexShrink: 0,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      background: isDark
        ? 'linear-gradient(160deg, #242526 0%, #18191a 100%)'
        : 'linear-gradient(160deg, #faedc7 0%, #fff 100%)',
      borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    formSide: {
      flex: 1,
      minWidth: 0,
      padding: '40px',
      background: isDark ? '#242526' : '#fff',
    },
    title: { fontSize: '24px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '16px' },
    notice: {
      background: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`, color: isDark ? '#93c5fd' : '#1e40af',
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
    },
    noticeLink: { color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '600', textDecoration: 'underline' },
    error: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px',
      borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
    },
    row: { gap: '12px' },
    row3: { gap: '12px' },
    field: { marginBottom: '16px' },
    fieldHint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#374151', cursor: 'pointer' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    typeToggleRow: { display: 'flex', gap: '10px', marginBottom: '16px' },
    typeToggleBtn: (active) => ({
      flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#4e4f50' : '#9ca3af'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#f9fafb'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#b0b3b8' : '#374151'),
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }),
    categoryFixed: { padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#b0b3b8' : '#6b7280' },
    input: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff',
    },
    textarea: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff',
    },
    upload: {
      position: 'relative', width: '100%', height: '130px', border: `2px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#18191a' : '#fff',
    },
    uploadPlaceholder: { textAlign: 'center', padding: '16px' },
    uploadHint: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '6px' },
    uploadPreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px', marginTop: '10px' },
    photoThumbWrap: { position: 'relative', width: '100%', height: '70px', borderRadius: '8px', overflow: 'hidden' },
    photoThumb: { width: '100%', height: '100%', objectFit: 'cover' },
    removePhotoBtn: {
      position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px',
      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
      fontSize: '13px', lineHeight: '20px', cursor: 'pointer', padding: 0,
    },
    btn: {
      width: '100%', padding: '11px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none',
      borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '8px',
    },
    stepActions: { display: 'flex', gap: '10px', marginTop: '8px' },
    backBtn: {
      flex: '0 0 auto', padding: '11px 20px', background: isDark ? '#18191a' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
    },
    nextBtn: {
      flex: 1, padding: '11px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none',
      borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
    },
    footer: { textAlign: 'center', fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '20px' },
    footerLink: { color: goldInk(isDark), textDecoration: 'none', fontWeight: '500' },
    fieldError: { fontSize: '11px', color: isDark ? '#fca5a5' : '#dc2626', marginTop: '4px' },
  };

  const inputStyle = (field) => (
    fieldErrors[field] ? { ...styles.input, border: `1px solid ${isDark ? '#f87171' : '#dc2626'}` } : styles.input
  );

  return (
    <div style={styles.container}>
      <div className="login-card" style={styles.card}>
        <div className="login-map-panel" style={styles.panel}>
          <AuthBrandPanel tagline={CONSIGN_TAGLINES[step]} />
        </div>

        <div style={styles.formSide}>
        <h1 style={styles.title}>Apply for Consignment</h1>
        <p style={styles.subtitle}>List your vehicle with us and start earning. Fill out your details and your vehicle's information below.</p>

        <div style={styles.notice}>
          Just want to rent a car instead? <Link to="/register" style={styles.noticeLink}>Register as a client</Link>.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="wizard-steps-shell">
            <BookingSteps steps={CONSIGN_STEPS} currentStep={step} onStepClick={goToStep} isDark={isDark} />

            <div>
              {error && <div style={styles.error}>{error}</div>}
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="cr-name">Full Name</label>
                      <input id="cr-name" style={inputStyle('name')} type="text" placeholder="Enter your name"
                        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                      {fieldErrors.name && <p style={styles.fieldError}>{fieldErrors.name}</p>}
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="cr-birthdate">Birthdate</label>
                      <input id="cr-birthdate" style={inputStyle('birthDate')} type="date" max={maxBirthDate()}
                        value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} required />
                      <p style={styles.uploadHint}>Must match your valid ID — you won't be able to change this later.</p>
                      {fieldErrors.birthDate && <p style={styles.fieldError}>{fieldErrors.birthDate}</p>}
                    </div>
                    <div className="responsive-row-2" style={styles.row}>
                      <div style={styles.field}>
                        <label style={styles.label} htmlFor="cr-email">Email</label>
                        <input id="cr-email" style={inputStyle('email')} type="email" placeholder="Enter your email"
                          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                        {(fieldErrors.email || emailTaken) && (
                          <p style={styles.fieldError}>{fieldErrors.email || TAKEN_MESSAGE}</p>
                        )}
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label} htmlFor="cr-password">Password</label>
                        <PasswordInput id="cr-password" style={inputStyle('password')} placeholder="Create a password (min. 8 characters)" isDark={isDark}
                          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
                        {fieldErrors.password && <p style={styles.fieldError}>{fieldErrors.password}</p>}
                      </div>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="cr-confirm-password">Confirm Password</label>
                      <PasswordInput id="cr-confirm-password" style={inputStyle('confirmPassword')} placeholder="Re-enter your password" isDark={isDark}
                        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
                      {fieldErrors.confirmPassword && <p style={styles.fieldError}>{fieldErrors.confirmPassword}</p>}
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="cr-phone">Phone Number</label>
                      <input id="cr-phone" style={inputStyle('phone')} type="tel" placeholder="09171234567"
                        value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        onBlur={(e) => setFieldErrors((prev) => ({ ...prev, phone: !e.target.value.trim() ? '' : (PHONE_REGEX.test(e.target.value) ? '' : PHONE_ERROR) }))}
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={fieldErrors.phone ? 'cr-phone-error' : undefined}
                        required />
                      {fieldErrors.phone && <p id="cr-phone-error" style={styles.fieldError}>{fieldErrors.phone}</p>}
                    </div>

                    <LocationAddressFields
                      styles={styles}
                      idPrefix="cr-loc"
                      onChange={(address) => setForm((f) => ({ ...f, address }))}
                    />
                    {fieldErrors.address && <p style={{ ...styles.fieldError, marginTop: '-10px', marginBottom: '16px' }}>{fieldErrors.address}</p>}


                    <div style={styles.stepActions}>
                      <button type="button" style={styles.nextBtn} onClick={goToVerify} disabled={sendingCode}>
                        {sendingCode ? 'Sending code...' : 'Continue'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <p style={{ ...styles.subtitle, marginBottom: '16px' }}>
                      We sent a 6-digit code to <strong>{form.email}</strong>. Enter it below to finish creating your account.
                    </p>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="cr-verify-code">Verification Code</label>
                      <OtpInput value={verificationCode} onChange={setVerificationCode} isDark={isDark} />
                      {fieldErrors.verificationCode && <p style={styles.fieldError}>{fieldErrors.verificationCode}</p>}
                    </div>
                    <button type="button" className="text-link-btn" style={{ ...styles.footerLink, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
                      onClick={sendVerificationCode} disabled={sendingCode || resendCooldown > 0}>
                      {sendingCode ? 'Resending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get it? Resend code"}
                    </button>

                    <div style={styles.stepActions}>
                      <button type="button" style={styles.backBtn} onClick={() => setStep(1)}>
                        Back
                      </button>
                      <button style={styles.nextBtn} type="submit" disabled={loading}>
                        {loading ? 'Verifying & creating account...' : 'Verify & Create Account'}
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </form>

        <p style={styles.footer}>
          Already applied? <Link to="/login" style={styles.footerLink}>Login</Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default ConsignmentRegister;
