import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../data/vehicleBrands';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';
import LocationAddressFields from '../components/LocationAddressFields';

const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;
const OTHER = '__other__';

const ConsignmentRegister = () => {
  const [form, setForm] = useState({
    // Owner info
    name: '', email: '', password: '', phone: '', address: '',
    // Vehicle info
    brand: '', model: '', year: '', plateNumber: '', color: '', mileage: '',
    category: '', transmission: '', fuelType: '', seats: '',
    suggestedPricePerDay: '', description: '',
  });

  const [validIdImage, setValidIdImage] = useState(null);
  const [validIdPreview, setValidIdPreview] = useState('');
  const [orImage, setOrImage] = useState(null);
  const [orPreview, setOrPreview] = useState('');
  const [crImage, setCrImage] = useState(null);
  const [crPreview, setCrPreview] = useState('');
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [vehiclePreviews, setVehiclePreviews] = useState([]);
  const [bookingTypes, setBookingTypes] = useState({ 'self-drive': true, 'with-driver': true });
  const [vehicleType, setVehicleType] = useState('car');
  const [brandChoice, setBrandChoice] = useState('');
  const [modelChoice, setModelChoice] = useState('');

  const brandOrder = vehicleType === 'motorcycle' ? MOTO_BRAND_ORDER : CAR_BRAND_ORDER;
  const modelOptions = brandChoice && brandChoice !== OTHER
    ? (VEHICLE_DATA[brandChoice] || []).filter((m) =>
        vehicleType === 'motorcycle' ? m.category === 'Motorcycle' : m.category !== 'Motorcycle'
      )
    : [];

  const handleVehicleTypeChange = (type) => {
    setVehicleType(type);
    setBrandChoice('');
    setModelChoice('');
    setForm({ ...form, brand: '', model: '', category: type === 'motorcycle' ? 'Motorcycle' : '' });
    setBookingTypes(
      type === 'motorcycle'
        ? { 'self-drive': true, 'with-driver': false }
        : { 'self-drive': true, 'with-driver': true }
    );
  };

  const handleBrandChoiceChange = (value) => {
    setBrandChoice(value);
    setModelChoice('');
    setForm({ ...form, brand: value === OTHER ? '' : value, model: '', category: vehicleType === 'motorcycle' ? 'Motorcycle' : '' });
  };

  const handleModelChoiceChange = (value) => {
    setModelChoice(value);
    if (value === OTHER) {
      setForm({ ...form, model: '' });
      return;
    }
    const match = modelOptions.find((m) => m.model === value);
    const autoCategory = match?.category || (vehicleType === 'motorcycle' ? 'Motorcycle' : '');
    setForm({ ...form, model: value, category: autoCategory });
  };

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

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

  const handleVehiclePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setVehiclePhotos((prev) => [...prev, ...files]);
    setVehiclePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeVehiclePhoto = (index) => {
    setVehiclePhotos((prev) => prev.filter((_, i) => i !== index));
    setVehiclePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!PHONE_REGEX.test(form.phone)) {
      setError('Please enter a valid Philippine phone number (e.g. 09171234567 or +639171234567)');
      return;
    }
    if (!validIdImage) {
      setError('Please upload a photo of your valid ID.');
      return;
    }
    if (!orImage || !crImage) {
      setError('Please upload photos of both the OR (Official Receipt) and CR (Certificate of Registration).');
      return;
    }
    if (vehiclePhotos.length === 0) {
      setError('Please upload at least one photo of the vehicle.');
      return;
    }
    const selectedBookingTypes = Object.entries(bookingTypes).filter(([, v]) => v).map(([k]) => k);
    if (selectedBookingTypes.length === 0) {
      setError('Please select at least one booking type (Self Drive and/or With Driver).');
      return;
    }

    setLoading(true);
    try {
      const uploadedId = await uploadToImageKit(validIdImage);
      const uploadedOr = await uploadToImageKit(orImage);
      const uploadedCr = await uploadToImageKit(crImage);
      const uploadedPhotos = [];
      for (const file of vehiclePhotos) {
        const uploaded = await uploadToImageKit(file);
        uploadedPhotos.push(uploaded);
      }

      const res = await api.post('/consignments/register', {
        ...form,
        validIdImage: uploadedId.url,
        validIdImageFileId: uploadedId.fileId,
        orImage: uploadedOr.url,
        orImageFileId: uploadedOr.fileId,
        crImage: uploadedCr.url,
        crImageFileId: uploadedCr.fileId,
        vehiclePhotos: uploadedPhotos,
        availableBookingTypes: selectedBookingTypes,
      });

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
      background: isDark ? '#0f172a' : '#f9fafb',
      padding: '40px 16px',
    },
    card: {
      background: isDark ? '#1e293b' : '#fff',
      padding: '40px',
      borderRadius: '12px',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      width: '100%',
      maxWidth: '640px',
    },
    title: { fontSize: '24px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '16px' },
    notice: {
      background: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', border: `1px solid ${isDark ? '#1e40af' : '#bfdbfe'}`, color: isDark ? '#93c5fd' : '#1e40af',
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
    },
    noticeLink: { color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '600', textDecoration: 'underline' },
    error: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px',
      borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
    },
    sectionTitle: {
      fontSize: '15px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginTop: '24px', marginBottom: '12px', paddingBottom: '8px',
      borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    },
    row: { gap: '12px' },
    row3: { gap: '12px' },
    field: { marginBottom: '16px' },
    fieldHint: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    typeToggleRow: { display: 'flex', gap: '10px', marginBottom: '16px' },
    typeToggleBtn: (active) => ({
      flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#0f172a' : '#fff'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#94a3b8' : '#374151'),
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }),
    categoryFixed: { padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', background: isDark ? '#0f172a' : '#f9fafb', color: isDark ? '#94a3b8' : '#6b7280' },
    input: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff',
    },
    textarea: {
      width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff',
    },
    upload: {
      position: 'relative', width: '100%', height: '130px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff',
    },
    uploadPlaceholder: { textAlign: 'center', padding: '16px' },
    uploadHint: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '6px' },
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
    footer: { textAlign: 'center', fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '20px' },
    footerLink: { color: isDark ? GOLD_DARK : GOLD, textDecoration: 'none', fontWeight: '500' },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Apply for Consignment</h1>
        <p style={styles.subtitle}>List your vehicle with us and start earning. Fill out your details and your vehicle's information below.</p>

        <div style={styles.notice}>
          Just want to rent a car instead? <Link to="/register" style={styles.noticeLink}>Register as a client</Link>.
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <h2 style={styles.sectionTitle}>Your Information</h2>

          <div style={styles.field}>
            <label style={styles.label}>Full Name</label>
            <input style={styles.input} type="text" placeholder="Enter your name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="responsive-row-2" style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="Enter your email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" placeholder="Create a password (min. 8 characters)"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Phone Number</label>
            <input style={styles.input} type="tel" placeholder="09171234567"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          </div>

          <LocationAddressFields
            styles={styles}
            onChange={(address) => setForm((f) => ({ ...f, address }))}
          />

          <div style={styles.field}>
            <label style={styles.label}>Your Valid ID (Driver's License, National ID, etc.)</label>
            <div style={styles.upload}>
              {validIdPreview ? (
                <img src={validIdPreview} alt="ID preview" style={styles.uploadPreview} />
              ) : (
                <div style={styles.uploadPlaceholder}>
                  <span style={{ fontSize: '26px' }}>🪪</span>
                  <p style={styles.uploadHint}>Click to upload a photo of your ID</p>
                </div>
              )}
              <input type="file" accept="image/*" style={styles.fileInput}
                onChange={(e) => { const f = e.target.files[0]; if (f) { setValidIdImage(f); setValidIdPreview(URL.createObjectURL(f)); } }} />
            </div>
          </div>

          <h2 style={styles.sectionTitle}>Vehicle Information</h2>

          <div style={styles.typeToggleRow}>
            <button type="button" style={styles.typeToggleBtn(vehicleType === 'car')} onClick={() => handleVehicleTypeChange('car')}>
              🚗 Car
            </button>
            <button type="button" style={styles.typeToggleBtn(vehicleType === 'motorcycle')} onClick={() => handleVehicleTypeChange('motorcycle')}>
              🏍️ Motorcycle
            </button>
          </div>

          <div className="responsive-row-2" style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Brand</label>
              <select style={styles.input} value={brandChoice} onChange={(e) => handleBrandChoiceChange(e.target.value)} required>
                <option value="">Select brand</option>
                {brandOrder.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value={OTHER}>Other (type manually)</option>
              </select>
              {brandChoice === OTHER && (
                <input style={{ ...styles.input, marginTop: '8px' }} type="text" placeholder="Enter brand name"
                  value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
              )}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Model</label>
              {brandChoice && brandChoice !== OTHER ? (
                <>
                  <select style={styles.input} value={modelChoice} onChange={(e) => handleModelChoiceChange(e.target.value)} required>
                    <option value="">Select model</option>
                    {modelOptions.map((m) => <option key={m.model} value={m.model}>{m.model}</option>)}
                    <option value={OTHER}>Other (type manually)</option>
                  </select>
                  {modelChoice === OTHER && (
                    <input style={{ ...styles.input, marginTop: '8px' }} type="text" placeholder="Enter model name"
                      value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
                  )}
                </>
              ) : (
                <input style={styles.input} type="text" placeholder={brandChoice === OTHER ? 'Enter model name' : 'Select a brand first'}
                  value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                  disabled={!brandChoice} required />
              )}
            </div>
          </div>

          <div className="responsive-row-3" style={styles.row3}>
            <div style={styles.field}>
              <label style={styles.label}>Year</label>
              <input style={styles.input} type="number" placeholder="e.g. 2022"
                value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Color</label>
              <input style={styles.input} type="text" placeholder="e.g. White"
                value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Mileage (km)</label>
              <input style={styles.input} type="number" placeholder="e.g. 35000"
                value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Plate Number</label>
            <input style={styles.input} type="text" placeholder="e.g. ABC 1234"
              value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
          </div>

          <div className="responsive-row-3" style={styles.row3}>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              {vehicleType === 'motorcycle' ? (
                <div style={styles.categoryFixed}>Motorcycle</div>
              ) : (
                <select style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                  <option value="">Select category</option>
                  {CAR_CATEGORIES_ORDERED.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Transmission</label>
              <select style={styles.input} value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} required>
                <option value="">Select transmission</option>
                <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Fuel Type</label>
              <select style={styles.input} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} required>
                <option value="">Select fuel type</option>
                <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Seating Capacity</label>
            <input style={styles.input} type="number" placeholder="e.g. 5"
              value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Suggested Daily Price (₱)</label>
            <input style={styles.input} type="number" placeholder="e.g. 120"
              value={form.suggestedPricePerDay} onChange={(e) => setForm({ ...form, suggestedPricePerDay: e.target.value })} required />
            <p style={styles.fieldHint}>This is a starting suggestion — our admin may adjust it before listing.</p>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Available Booking Types</label>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={bookingTypes['self-drive']}
                  onChange={(e) => setBookingTypes({ ...bookingTypes, 'self-drive': e.target.checked })} />
                Self Drive
              </label>
              <label style={styles.checkboxLabel}>
                <input type="checkbox" checked={bookingTypes['with-driver']}
                  onChange={(e) => setBookingTypes({ ...bookingTypes, 'with-driver': e.target.checked })} />
                With Driver
              </label>
            </div>
            <p style={styles.fieldHint}>At least one must be checked. Motorcycles default to Self Drive only.</p>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description (optional)</label>
            <textarea style={styles.textarea} placeholder="Anything else buyers should know about the vehicle"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <h2 style={styles.sectionTitle}>Vehicle Documents</h2>

          <div className="responsive-row-2" style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>OR (Official Receipt)</label>
              <div style={styles.upload}>
                {orPreview ? (
                  <img src={orPreview} alt="OR preview" style={styles.uploadPreview} />
                ) : (
                  <div style={styles.uploadPlaceholder}>
                    <span style={{ fontSize: '26px' }}>🧾</span>
                    <p style={styles.uploadHint}>Click to upload OR photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" style={styles.fileInput}
                  onChange={(e) => { const f = e.target.files[0]; if (f) { setOrImage(f); setOrPreview(URL.createObjectURL(f)); } }} />
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>CR (Certificate of Registration)</label>
              <div style={styles.upload}>
                {crPreview ? (
                  <img src={crPreview} alt="CR preview" style={styles.uploadPreview} />
                ) : (
                  <div style={styles.uploadPlaceholder}>
                    <span style={{ fontSize: '26px' }}>📄</span>
                    <p style={styles.uploadHint}>Click to upload CR photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" style={styles.fileInput}
                  onChange={(e) => { const f = e.target.files[0]; if (f) { setCrImage(f); setCrPreview(URL.createObjectURL(f)); } }} />
              </div>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Vehicle Photos (multiple angles recommended)</label>
            <div style={styles.upload}>
              <div style={styles.uploadPlaceholder}>
                <span style={{ fontSize: '26px' }}>📷</span>
                <p style={styles.uploadHint}>Click to add photos — you can select more than one</p>
              </div>
              <input type="file" accept="image/*" multiple style={styles.fileInput} onChange={handleVehiclePhotosChange} />
            </div>
            {vehiclePreviews.length > 0 && (
              <div style={styles.photoGrid}>
                {vehiclePreviews.map((src, i) => (
                  <div key={i} style={styles.photoThumbWrap}>
                    <img src={src} alt={`Vehicle ${i + 1}`} style={styles.photoThumb} />
                    <button type="button" style={styles.removePhotoBtn} onClick={() => removeVehiclePhoto(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Submitting application...' : 'Submit Application'}
          </button>
        </form>

        <p style={styles.footer}>
          Already applied? <Link to="/login" style={styles.footerLink}>Login</Link>
        </p>
      </div>
    </div>
  );
};

export default ConsignmentRegister;
