import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../../data/vehicleBrands';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../../theme';
import usePageTitle from '../../hooks/usePageTitle';
import ColorPicker from '../../components/ColorPicker';
import { formatPlateNumber, sanitizeDigits, sanitizeDecimal } from '../../utils/inputMasks';

const OTHER = '__other__';

const AddCar = () => {
  usePageTitle('Add Vehicle');
  const { isDark } = useTheme();
  const [vehicleType, setVehicleType] = useState('car'); // 'car' | 'motorcycle'
  const [form, setForm] = useState({
    brand: '', model: '', year: '', pricePerDay: '',
    category: '', transmission: '', fuelType: '',
    seats: '', description: '', plateNumber: '', color: '', mileage: '',
  });
  const [brandChoice, setBrandChoice] = useState('');
  const [modelChoice, setModelChoice] = useState('');
  const [bookingTypes, setBookingTypes] = useState({ 'self-drive': true, 'with-driver': true });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handlePhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files]);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadToImageKit = async (file) => {
    const authRes = await api.get('/imagekit/auth');
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

    const selectedBookingTypes = Object.entries(bookingTypes).filter(([, v]) => v).map(([k]) => k);
    if (selectedBookingTypes.length === 0) {
      setError('Please select at least one booking type (Self Drive and/or With Driver).');
      return;
    }
    if (!form.brand.trim()) {
      setError('Please select or enter a brand.');
      return;
    }
    if (!form.model.trim()) {
      setError('Please select or enter a model.');
      return;
    }
    if (!form.category) {
      setError('Please select a category.');
      return;
    }
    if (!form.plateNumber.trim()) {
      setError('Please enter the plate number.');
      return;
    }

    setLoading(true);
    try {
      const uploadedPhotos = [];
      for (const file of photos) {
        uploadedPhotos.push(await uploadToImageKit(file));
      }
      await api.post('/cars', {
        ...form,
        image: uploadedPhotos[0]?.url || '',
        imageFileId: uploadedPhotos[0]?.fileId || '',
        photos: uploadedPhotos,
        availableBookingTypes: selectedBookingTypes,
      });
      setSuccess('Vehicle added successfully!');
      setForm({ brand: '', model: '', year: '', pricePerDay: '', category: vehicleType === 'motorcycle' ? 'Motorcycle' : '', transmission: '', fuelType: '', seats: '', description: '', plateNumber: '', color: '', mileage: '' });
      setBrandChoice('');
      setModelChoice('');
      setBookingTypes(
        vehicleType === 'motorcycle'
          ? { 'self-drive': true, 'with-driver': false }
          : { 'self-drive': true, 'with-driver': true }
      );
      setPhotos([]);
      setPhotoPreviews([]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    success: { background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#16a34a', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    form: { background: isDark ? '#1e293b' : '#fff', padding: '24px', borderRadius: '12px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' },
    field: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#111827' },
    textarea: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#111827' },
    imageUpload: { position: 'relative', width: '200px', maxWidth: '100%', height: '140px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
    imagePlaceholder: { textAlign: 'center', padding: '16px' },
    imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px', marginTop: '10px' },
    photoThumbWrap: { position: 'relative', width: '100%', height: '70px', borderRadius: '8px', overflow: 'hidden' },
    photoThumb: { width: '100%', height: '100%', objectFit: 'cover' },
    removePhotoBtn: {
      position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px',
      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
      fontSize: '13px', lineHeight: '20px', cursor: 'pointer', padding: 0,
    },
    btn: { padding: '10px 28px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
    checkboxRow: { display: 'flex', gap: '20px', alignItems: 'center' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer' },
    hint: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    typeToggleRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
    typeToggleBtn: (active) => ({
      flex: 1, padding: '14px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#475569' : '#9ca3af'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#0f172a' : '#f9fafb'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#94a3b8' : '#374151'),
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }),
    categoryFixed: { padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', background: isDark ? '#0f172a' : '#f9fafb', color: isDark ? '#94a3b8' : '#6b7280' },
  };

  return (
    <AdminLayout activePage="Add Vehicle">
      <h1 style={s.title}>Add New Vehicle</h1>
      <p style={s.subtitle}>Fill in details to list a new vehicle for booking.</p>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}
      <form onSubmit={handleSubmit} style={s.form}>
        <div style={s.typeToggleRow}>
          <button type="button" style={s.typeToggleBtn(vehicleType === 'car')} onClick={() => handleVehicleTypeChange('car')}>
            🚗 Car
          </button>
          <button type="button" style={s.typeToggleBtn(vehicleType === 'motorcycle')} onClick={() => handleVehicleTypeChange('motorcycle')}>
            🏍️ Motorcycle
          </button>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="ac-photos">Vehicle Photos (multiple angles recommended)</label>
          <div style={s.imageUpload}>
            <div style={s.imagePlaceholder}>
              <span style={{ fontSize: '32px' }}>{vehicleType === 'motorcycle' ? '🏍️' : '🚗'}</span>
              <p style={{ fontSize: '13px', color: isDark ? '#64748b' : '#6b7280', marginTop: '8px' }}>Click to add photos</p>
            </div>
            <input id="ac-photos" type="file" accept="image/*" multiple onChange={handlePhotosChange} style={s.fileInput} />
          </div>
          {photoPreviews.length > 0 && (
            <div style={s.photoGrid}>
              {photoPreviews.map((src, i) => (
                <div key={i} style={s.photoThumbWrap}>
                  <img src={src} alt={`Vehicle ${i + 1}`} style={s.photoThumb} />
                  <button type="button" style={s.removePhotoBtn} onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label} htmlFor="ac-brand">Brand</label>
            <select id="ac-brand" style={s.input} value={brandChoice} onChange={(e) => handleBrandChoiceChange(e.target.value)} required>
              <option value="">Select brand</option>
              {brandOrder.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value={OTHER}>Other (type manually)</option>
            </select>
            {brandChoice === OTHER && (
              <input aria-label="Brand name" style={{ ...s.input, marginTop: '8px' }} type="text" placeholder="Enter brand name"
                value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            )}
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="ac-model">Model</label>
            {brandChoice && brandChoice !== OTHER ? (
              <>
                <select id="ac-model" style={s.input} value={modelChoice} onChange={(e) => handleModelChoiceChange(e.target.value)} required>
                  <option value="">Select model</option>
                  {modelOptions.map((m) => <option key={m.model} value={m.model}>{m.model}</option>)}
                  <option value={OTHER}>Other (type manually)</option>
                </select>
                {modelChoice === OTHER && (
                  <input aria-label="Model name" style={{ ...s.input, marginTop: '8px' }} type="text" placeholder="Enter model name"
                    value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
                )}
              </>
            ) : (
              <input id="ac-model" style={s.input} type="text" placeholder={brandChoice === OTHER ? 'Enter model name' : 'Select a brand first'}
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                disabled={!brandChoice} required />
            )}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="ac-category">Category</label>
          {vehicleType === 'motorcycle' ? (
            <div id="ac-category" style={s.categoryFixed}>Motorcycle</div>
          ) : (
            <>
              <select id="ac-category" style={s.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select category</option>
                {CAR_CATEGORIES_ORDERED.map((c) => <option key={c}>{c}</option>)}
              </select>
              <p style={s.hint}>
                {modelChoice && modelChoice !== OTHER
                  ? 'Auto-filled based on the model you picked — change it if it\'s not right.'
                  : 'Pick a listed model to auto-fill this, or choose manually.'}
              </p>
            </>
          )}
        </div>

        <div style={s.row}>
          <div style={s.field}><label style={s.label} htmlFor="ac-year">Year</label><input id="ac-year" style={s.input} type="text" inputMode="numeric" placeholder="e.g. 2022" value={form.year} onChange={(e) => setForm({...form, year: sanitizeDigits(e.target.value, 4)})} required /></div>
          <div style={s.field}><label style={s.label} htmlFor="ac-price">Daily Price (₱)</label><input id="ac-price" style={s.input} type="text" inputMode="decimal" placeholder="e.g. 150" value={form.pricePerDay} onChange={(e) => setForm({...form, pricePerDay: sanitizeDecimal(e.target.value, 8)})} required /></div>
          <div style={s.field}><label style={s.label} htmlFor="ac-seats">Seating Capacity</label><input id="ac-seats" style={s.input} type="text" inputMode="numeric" placeholder={vehicleType === 'motorcycle' ? 'e.g. 2' : 'e.g. 5'} value={form.seats} onChange={(e) => setForm({...form, seats: sanitizeDigits(e.target.value, 2)})} required /></div>
        </div>

        <div style={s.row}>
          <div style={s.field}><label style={s.label} htmlFor="ac-plate">Plate Number</label><input id="ac-plate" style={s.input} type="text" placeholder="e.g. ABC 1234" value={form.plateNumber} onChange={(e) => setForm({...form, plateNumber: formatPlateNumber(e.target.value)})} required /></div>
          <div style={s.field}><label style={s.label} htmlFor="ac-color">Color</label><ColorPicker id="ac-color" isDark={isDark} value={form.color} onChange={(color) => setForm({...form, color})} /></div>
          <div style={s.field}><label style={s.label} htmlFor="ac-mileage">Mileage (km)</label><input id="ac-mileage" style={s.input} type="text" inputMode="numeric" placeholder="e.g. 35000" value={form.mileage} onChange={(e) => setForm({...form, mileage: sanitizeDigits(e.target.value, 7)})} /></div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label} htmlFor="ac-transmission">Transmission</label>
            <select id="ac-transmission" style={s.input} value={form.transmission} onChange={(e) => setForm({...form, transmission: e.target.value})} required>
              <option value="">Select transmission</option>
              <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label} htmlFor="ac-fuel">Fuel Type</label>
            <select id="ac-fuel" style={s.input} value={form.fuelType} onChange={(e) => setForm({...form, fuelType: e.target.value})} required>
              <option value="">Select fuel type</option>
              <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
            </select>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label} id="ac-booking-types-label">Available Booking Types</label>
          <div role="group" aria-labelledby="ac-booking-types-label" style={s.checkboxRow}>
            <label style={s.checkboxLabel}>
              <input type="checkbox" checked={bookingTypes['self-drive']}
                onChange={(e) => setBookingTypes({ ...bookingTypes, 'self-drive': e.target.checked })} />
              Self Drive
            </label>
            <label style={s.checkboxLabel}>
              <input type="checkbox" checked={bookingTypes['with-driver']}
                onChange={(e) => setBookingTypes({ ...bookingTypes, 'with-driver': e.target.checked })} />
              With Driver
            </label>
          </div>
          <p style={s.hint}>At least one must be selected. Motorcycles default to Self Drive only, but you can change this.</p>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="ac-description">Description</label>
          <textarea id="ac-description" style={s.textarea} placeholder="e.g. A luxurious SUV..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
        </div>
        <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Vehicle'}</button>
      </form>
    </AdminLayout>
  );
};

export default AddCar;
