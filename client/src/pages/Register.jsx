import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import api from '../api';
import LocationAddressFields from '../components/LocationAddressFields';
import PasswordInput from '../components/PasswordInput';
import OtpInput from '../components/OtpInput';
import BookingSteps from '../components/BookingSteps';
import AuthBrandPanel from '../components/AuthBrandPanel';
import ValidIdUpload from '../components/ValidIdUpload';
import { idTypeNeedsBack } from '../data/validIdTypes';
import usePageTitle from '../hooks/usePageTitle';
import useResendCooldown from '../hooks/useResendCooldown';

const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ERROR = 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';

const validators = {
  email: (v) => (!v ? '' : EMAIL_REGEX.test(v) ? '' : 'Enter a valid email address.'),
  phone: (v) => (!v ? '' : PHONE_REGEX.test(v) ? '' : PHONE_ERROR),
  emergencyContactNumber: (v) => (!v ? '' : PHONE_REGEX.test(v) ? '' : PHONE_ERROR),
  password: (v) => (!v ? '' : v.length < 8 ? 'Password must be at least 8 characters.' : ''),
};

// Verification is the LAST step, after every other field is already filled
// out — so a code is only ever sent once someone is genuinely finishing
// registration, and the account is only ever created once it's confirmed,
// never from just an email on its own.
const REGISTER_STEPS = ['Account', 'Contact & ID', 'Emergency Contact', 'Verify Email'];

// Shown on the branding panel, swapped per step via AuthBrandPanel's own
// crossfade — keyed by step number so it matches REGISTER_STEPS above.
const REGISTER_TAGLINES = {
  1: 'Sign up to get started — it only takes a minute.',
  2: 'Add your contact details and ID for a smoother pickup.',
  3: 'One quick emergency contact and you’re almost done.',
  4: 'Just confirm your email and your account is ready.',
};

const Register = () => {
  usePageTitle('Register');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    phone: '', address: '',
    licenseNumber: '', licenseExpiry: '',
    emergencyContactName: '', emergencyContactNumber: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [validIdType, setValidIdType] = useState('');
  const [validIdImage, setValidIdImage] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState('');
  const [validIdBackImage, setValidIdBackImage] = useState(null);
  const [validIdBackPreview, setValidIdBackPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCooldown, startResendCooldown] = useResendCooldown();
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleBlur = (field, value) => {
    const validator = validators[field];
    if (validator) {
      setFieldErrors((prev) => ({ ...prev, [field]: validator(value) }));
    }
    if (field === 'confirmPassword' || field === 'password') {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: confirmPassword && form.password && confirmPassword !== form.password
          ? 'Passwords do not match.' : '',
      }));
    }
  };

  const goToStep = (n) => setStep(n);

  // Every check below sets a message on the specific field it's about
  // (fieldErrors.X, rendered directly under that input) instead of a
  // page-level banner — so the feedback shows up right where the problem
  // actually is, not somewhere the user has to go hunting for.
  const validateStep1 = () => {
    const nameError = !form.name.trim() ? 'Full name is required.' : '';
    const emailError = !form.email.trim() ? 'Email is required.' : validators.email(form.email);
    const passwordError = !form.password ? 'Password is required.' : validators.password(form.password);
    const confirmPasswordError = !confirmPassword
      ? 'Please confirm your password.'
      : (form.password !== confirmPassword ? 'Passwords do not match.' : '');

    setFieldErrors((prev) => ({ ...prev, name: nameError, email: emailError, password: passwordError, confirmPassword: confirmPasswordError }));
    return !(nameError || emailError || passwordError || confirmPasswordError);
  };

  const validateStep2 = () => {
    const phoneError = !form.phone.trim() ? 'Phone number is required.' : validators.phone(form.phone);
    const addressError = !form.address.trim() ? 'Please complete your address.' : '';
    const validIdError = !validIdType
      ? "Please select which valid ID you'll be using."
      : !validIdImage
        ? 'Please upload a photo of your ID.'
        : (idTypeNeedsBack(validIdType) && !validIdBackImage ? 'Please also upload a photo of the back of your ID.' : '');

    setFieldErrors((prev) => ({ ...prev, phone: phoneError, address: addressError, validId: validIdError }));
    return !(phoneError || addressError || validIdError);
  };

  const validateStep3 = () => {
    const nameError = !form.emergencyContactName.trim() ? 'Emergency contact name is required.' : '';
    const numberError = !form.emergencyContactNumber.trim() ? 'Phone number is required.' : validators.emergencyContactNumber(form.emergencyContactNumber);

    setFieldErrors((prev) => ({ ...prev, emergencyContactName: nameError, emergencyContactNumber: numberError }));
    return !(nameError || numberError);
  };

  const goToStep2Next = () => { if (validateStep1()) setStep(2); };
  const goToStep3Next = () => { if (validateStep2()) setStep(3); };

  // Sends (or resends) the code, without moving steps itself — the caller
  // decides what to do once it knows whether sending actually succeeded.
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

  const goToStep4Next = async () => {
    if (!validateStep3()) return;
    const sent = await sendVerificationCode();
    if (sent) setStep(4);
  };

  const handleIdFrontChange = (file) => {
    setValidIdImage(file);
    setValidIdPreview(URL.createObjectURL(file));
  };

  const handleIdBackChange = (file) => {
    setValidIdBackImage(file);
    setValidIdBackPreview(URL.createObjectURL(file));
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

  // The final step's submit does double duty: confirm the code, and only
  // once that succeeds does the account actually get created.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!verificationCode.trim()) {
      setFieldErrors((prev) => ({ ...prev, verificationCode: 'Please enter the code we sent to your email.' }));
      return;
    }

    // Re-checks every step's fields at once here, since steps 1-3 are no
    // longer on screen at this point — there's no single visible field left
    // to attach these to, so this one stays a summary banner rather than an
    // inline message nobody would see.
    const nextFieldErrors = {
      verificationCode: '',
      email: validators.email(form.email),
      phone: validators.phone(form.phone),
      emergencyContactNumber: validators.emergencyContactNumber(form.emergencyContactNumber),
      password: validators.password(form.password),
      confirmPassword: form.password !== confirmPassword ? 'Passwords do not match.' : '',
    };
    setFieldErrors((prev) => ({ ...prev, ...nextFieldErrors }));
    if (Object.values(nextFieldErrors).some(Boolean)) {
      setError('Please fix the highlighted fields before continuing.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/verify-email-code', { email: form.email, code: verificationCode.trim() });

      let uploaded = { url: '', fileId: '' };
      if (validIdImage) {
        uploaded = await uploadToImageKit(validIdImage);
      }
      let uploadedBack = { url: '', fileId: '' };
      if (validIdBackImage) {
        uploadedBack = await uploadToImageKit(validIdBackImage);
      }

      const res = await api.post('/auth/register', {
        ...form,
        validIdType,
        validIdImage: uploaded.url,
        validIdImageFileId: uploaded.fileId,
        validIdImageBack: uploadedBack.url,
        validIdImageBackFileId: uploadedBack.fileId,
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
      background: isDark ? '#18191a' : '#f9fafb',
      padding: '40px 16px',
    },
    card: {
      display: 'flex',
      width: '100%',
      maxWidth: '1000px',
      borderRadius: '20px',
      overflow: 'hidden',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.08)',
    },
    panel: {
      position: 'relative',
      width: '38%',
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
    upload: {
      position: 'relative',
      width: '100%',
      height: '140px',
      border: `2px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDark ? '#18191a' : '#fff',
    },
    uploadPlaceholder: { textAlign: 'center', padding: '16px' },
    uploadHint: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '6px' },
    uploadPreview: { width: '100%', height: '100%', objectFit: 'cover' },
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
    stepActions: { display: 'flex', gap: '10px', marginTop: '8px' },
    backBtn: {
      flex: '0 0 auto',
      padding: '11px 20px',
      background: isDark ? '#18191a' : '#f3f4f6',
      color: isDark ? '#e4e6eb' : '#374151',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
    },
    nextBtn: {
      flex: 1,
      padding: '11px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
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
    fieldError: {
      fontSize: '11px',
      color: isDark ? '#fca5a5' : '#dc2626',
      marginTop: '4px',
    },
  };

  const inputStyle = (field) => (
    fieldErrors[field] ? { ...styles.input, border: `1px solid ${isDark ? '#f87171' : '#dc2626'}` } : styles.input
  );

  return (
    <div style={styles.container}>
      <div className="login-card" style={styles.card}>
        <div className="login-map-panel" style={styles.panel}>
          <AuthBrandPanel tagline={REGISTER_TAGLINES[step]} />
        </div>

        <div style={styles.formSide}>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.subtitle}>Sign up to get started</p>

        <div style={styles.consignmentNotice}>
          🚗 Have a car to rent out? <Link to="/consignment/register" style={styles.consignmentLink}>Apply for consignment</Link> instead.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="wizard-steps-shell">
            <BookingSteps steps={REGISTER_STEPS} currentStep={step} onStepClick={goToStep} isDark={isDark} />

            <div>
              {error && <div style={styles.error}>{error}</div>}
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="reg-name">Full Name</label>
                      <input
                        id="reg-name"
                        style={inputStyle('name')}
                        type="text"
                        placeholder="Enter your name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? 'reg-name-error' : undefined}
                        required
                      />
                      {fieldErrors.name && <p id="reg-name-error" style={styles.fieldError}>{fieldErrors.name}</p>}
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="reg-email">Email</label>
                      <input
                        id="reg-email"
                        style={inputStyle('email')}
                        type="email"
                        placeholder="Enter your email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        onBlur={(e) => handleBlur('email', e.target.value)}
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
                        required
                      />
                      {fieldErrors.email && <p id="reg-email-error" style={styles.fieldError}>{fieldErrors.email}</p>}
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="reg-password">Password</label>
                      <PasswordInput
                        id="reg-password"
                        style={inputStyle('password')}
                        placeholder="Create a password (min. 8 characters)"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        onBlur={(e) => handleBlur('password', e.target.value)}
                        aria-invalid={!!fieldErrors.password}
                        aria-describedby={fieldErrors.password ? 'reg-password-error' : undefined}
                        required
                        minLength={8}
                        isDark={isDark}
                      />
                      {fieldErrors.password && <p id="reg-password-error" style={styles.fieldError}>{fieldErrors.password}</p>}
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="reg-confirm-password">Confirm Password</label>
                      <PasswordInput
                        id="reg-confirm-password"
                        style={inputStyle('confirmPassword')}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onBlur={(e) => handleBlur('confirmPassword', e.target.value)}
                        aria-invalid={!!fieldErrors.confirmPassword}
                        aria-describedby={fieldErrors.confirmPassword ? 'reg-confirm-password-error' : undefined}
                        required
                        minLength={8}
                        isDark={isDark}
                      />
                      {fieldErrors.confirmPassword && <p id="reg-confirm-password-error" style={styles.fieldError}>{fieldErrors.confirmPassword}</p>}
                    </div>

                    <div style={styles.stepActions}>
                      <button type="button" style={styles.nextBtn} onClick={goToStep2Next}>
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="reg-phone">Phone Number</label>
                      <input
                        id="reg-phone"
                        style={inputStyle('phone')}
                        type="tel"
                        placeholder="09171234567"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        onBlur={(e) => handleBlur('phone', e.target.value)}
                        aria-invalid={!!fieldErrors.phone}
                        aria-describedby={fieldErrors.phone ? 'reg-phone-error' : undefined}
                        required
                      />
                      {fieldErrors.phone && <p id="reg-phone-error" style={styles.fieldError}>{fieldErrors.phone}</p>}
                    </div>

                    <LocationAddressFields
                      styles={styles}
                      onChange={(address) => setForm((f) => ({ ...f, address }))}
                    />
                    {fieldErrors.address && <p style={{ ...styles.fieldError, marginTop: '-10px', marginBottom: '16px' }}>{fieldErrors.address}</p>}

                    <ValidIdUpload
                      styles={styles}
                      idPrefix="reg-valid-id"
                      required
                      idType={validIdType}
                      onIdTypeChange={setValidIdType}
                      frontPreview={validIdPreview}
                      onFrontChange={handleIdFrontChange}
                      backPreview={validIdBackPreview}
                      onBackChange={handleIdBackChange}
                    />
                    {fieldErrors.validId && <p style={styles.fieldError}>{fieldErrors.validId}</p>}

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

                    <div style={styles.stepActions}>
                      <button type="button" style={styles.backBtn} onClick={() => goToStep(1)}>
                        Back
                      </button>
                      <button type="button" style={styles.nextBtn} onClick={goToStep3Next}>
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div className="responsive-row-2" style={styles.row}>
                      <div style={styles.field}>
                        <label style={styles.label} htmlFor="reg-emergency-name">Emergency Contact Name</label>
                        <input
                          id="reg-emergency-name"
                          style={inputStyle('emergencyContactName')}
                          type="text"
                          placeholder="Full name"
                          value={form.emergencyContactName}
                          onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                          aria-invalid={!!fieldErrors.emergencyContactName}
                          aria-describedby={fieldErrors.emergencyContactName ? 'reg-emergency-name-error' : undefined}
                          required
                        />
                        {fieldErrors.emergencyContactName && <p id="reg-emergency-name-error" style={styles.fieldError}>{fieldErrors.emergencyContactName}</p>}
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label} htmlFor="reg-emergency-number">Emergency Contact Number</label>
                        <input
                          id="reg-emergency-number"
                          style={inputStyle('emergencyContactNumber')}
                          type="tel"
                          placeholder="09171234567"
                          value={form.emergencyContactNumber}
                          onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })}
                          onBlur={(e) => handleBlur('emergencyContactNumber', e.target.value)}
                          aria-invalid={!!fieldErrors.emergencyContactNumber}
                          aria-describedby={fieldErrors.emergencyContactNumber ? 'reg-emergency-number-error' : undefined}
                          required
                        />
                        {fieldErrors.emergencyContactNumber && <p id="reg-emergency-number-error" style={styles.fieldError}>{fieldErrors.emergencyContactNumber}</p>}
                      </div>
                    </div>

                    <div style={styles.stepActions}>
                      <button type="button" style={styles.backBtn} onClick={() => goToStep(2)}>
                        Back
                      </button>
                      <button type="button" style={styles.nextBtn} onClick={goToStep4Next} disabled={sendingCode}>
                        {sendingCode ? 'Sending code...' : 'Continue'}
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <p style={{ ...styles.subtitle, marginBottom: '16px' }}>
                      We sent a 6-digit code to <strong>{form.email}</strong>. Enter it below to finish creating your account.
                    </p>
                    <div style={styles.field}>
                      <label style={styles.label} htmlFor="reg-verify-code">Verification Code</label>
                      <OtpInput value={verificationCode} onChange={setVerificationCode} isDark={isDark} />
                      {fieldErrors.verificationCode && <p style={styles.fieldError}>{fieldErrors.verificationCode}</p>}
                    </div>
                    <button type="button" className="text-link-btn" style={{ ...styles.footerLink, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: resendCooldown > 0 ? 'default' : 'pointer' }}
                      onClick={sendVerificationCode} disabled={sendingCode || resendCooldown > 0}>
                      {sendingCode ? 'Resending...' : resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get it? Resend code"}
                    </button>

                    <div style={styles.stepActions}>
                      <button type="button" style={styles.backBtn} onClick={() => goToStep(3)}>
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
          Already have an account?{' '}
          <Link to="/login" style={styles.footerLink}>Login</Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
