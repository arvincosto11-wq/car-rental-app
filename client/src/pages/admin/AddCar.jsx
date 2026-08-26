import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';
import { VEHICLE_DATA, ALL_CATEGORIES } from '../../data/vehicleBrands';

const OTHER = '__other__';
const BRAND_OPTIONS = Object.keys(VEHICLE_DATA).sort();

const AddCar = () => {
  const { isDark } = useTheme();
  const [form, setForm] = useState({
    brand: '', model: '', year: '', pricePerDay: '',
    category: '', transmission: '', fuelType: '',
    seats: '', description: '',
  });
  const [brandChoice, setBrandChoice] = useState('');
  const [modelChoice, setModelChoice] = useState('');
  const [bookingTypes, setBookingTypes] = useState({ 'self-drive': true, 'with-driver': true });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const modelOptions = brandChoice && brandChoice !== OTHER ? (VEHICLE_DATA[brandChoice] || []) : [];

  const handleBrandChoiceChange = (value) => {
    setBrandChoice(value);
    setModelChoice('');
    setForm({ ...form, brand: value === OTHER ? '' : value, model: '', category: '' });
    setBookingTypes({ 'self-drive': true, 'with-driver': true });
  };

  const handleModelChoiceChange = (value) => {
    setModelChoice(value);
    if (value === OTHER) {
      setForm({ ...form, model: '' });
      return;
    }
    const match = modelOptions.find((m) => m.model === value);
    const autoCategory = match?.category || '';
    setForm({ ...form, model: value, category: autoCategory });
    // Motorcycles default to self-drive only; everything else defaults to both
    setBookingTypes(
      autoCategory === 'Motorcycle'
        ? { 'self-drive': true, 'with-driver': false }
        : { 'self-drive': true, 'with-driver': true }
    );
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImage(file); setImagePreview(URL.createObjectURL(file)); }
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

    setLoading(true);
    try {
      let imageUrl = '';
      let imageFileId = '';
      if (image) {
        const uploaded = await uploadToImageKit(image);
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      }
      await api.post('/cars', { ...form, image: imageUrl, imageFileId, availableBookingTypes: selectedBookingTypes });
      setSuccess('Vehicle added successfully!');
      setForm({ brand: '', model: '', year: '', pricePerDay: '', category: '', transmission: '', fuelType: '', seats: '', description: '' });
      setBrandChoice('');
      setModelChoice('');
      setBookingTypes({ 'self-drive': true, 'with-driver': true });
      setImage(null);
      setImagePreview('');
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
    disabledInput: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#1e293b' : '#f3f4f6', color: isDark ? '#64748b' : '#9ca3af' },
    textarea: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#111827' },
    imageUpload: { position: 'relative', width: '200px', height: '140px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
    imagePlaceholder: { textAlign: 'center', padding: '16px' },
    imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    btn: { padding: '10px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
    checkboxRow: { display: 'flex', gap: '20px', alignItems: 'center' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer' },
    hint: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
  };

  return (
    <AdminLayout activePage="Add Vehicle">
      <h1 style={s.title}>Add New Vehicle</h1>
      <p style={s.subtitle}>Fill in details to list a new vehicle for booking.</p>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}
      <form onSubmit={handleSubmit} style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Vehicle Image</label>
          <div style={s.imageUpload}>
            {imagePreview ? (
              <img src={imagePreview} alt="preview" style={s.imagePreview} />
            ) : (
              <div style={s.imagePlaceholder}>
                <span style={{ fontSize: '32px' }}>{form.category === 'Motorcycle' ? '🏍️' : '🚗'}</span>
                <p style={{ fontSize: '13px', color: isDark ? '#64748b' : '#6b7280', marginTop: '8px' }}>Click to upload</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} style={s.fileInput} />
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Brand</label>
            <select style={s.input} value={brandChoice} onChange={(e) => handleBrandChoiceChange(e.target.value)} required>
              <option value="">Select brand</option>
              {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              <option value={OTHER}>Other (type manually)</option>
            </select>
            {brandChoice === OTHER && (
              <input style={{ ...s.input, marginTop: '8px' }} type="text" placeholder="Enter brand name"
                value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            )}
          </div>
          <div style={s.field}>
            <label style={s.label}>Model</label>
            {brandChoice && brandChoice !== OTHER ? (
              <>
                <select style={s.input} value={modelChoice} onChange={(e) => handleModelChoiceChange(e.target.value)} required>
                  <option value="">Select model</option>
                  {modelOptions.map((m) => <option key={m.model} value={m.model}>{m.model}</option>)}
                  <option value={OTHER}>Other (type manually)</option>
                </select>
                {modelChoice === OTHER && (
                  <input style={{ ...s.input, marginTop: '8px' }} type="text" placeholder="Enter model name"
                    value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
                )}
              </>
            ) : (
              <input style={s.input} type="text" placeholder={brandChoice === OTHER ? 'Enter model name' : 'Select a brand first'}
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                disabled={!brandChoice} required />
            )}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Category</label>
          <select style={s.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
            <option value="">Select category</option>
            {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <p style={s.hint}>
            {modelChoice && modelChoice !== OTHER
              ? 'Auto-filled based on the model you picked — change it if it\'s not right.'
              : 'Pick a listed model to auto-fill this, or choose manually.'}
          </p>
        </div>

        <div style={s.row}>
          <div style={s.field}><label style={s.label}>Year</label><input style={s.input} type="number" placeholder="e.g. 2022" value={form.year} onChange={(e) => setForm({...form, year: e.target.value})} required /></div>
          <div style={s.field}><label style={s.label}>Daily Price (₱)</label><input style={s.input} type="number" placeholder="e.g. 150" value={form.pricePerDay} onChange={(e) => setForm({...form, pricePerDay: e.target.value})} required /></div>
          <div style={s.field}><label style={s.label}>Seating Capacity</label><input style={s.input} type="number" placeholder={form.category === 'Motorcycle' ? 'e.g. 2' : 'e.g. 5'} value={form.seats} onChange={(e) => setForm({...form, seats: e.target.value})} required /></div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Transmission</label>
            <select style={s.input} value={form.transmission} onChange={(e) => setForm({...form, transmission: e.target.value})} required>
              <option value="">Select transmission</option>
              <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Fuel Type</label>
            <select style={s.input} value={form.fuelType} onChange={(e) => setForm({...form, fuelType: e.target.value})} required>
              <option value="">Select fuel type</option>
              <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
            </select>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>Available Booking Types</label>
          <div style={s.checkboxRow}>
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
          <label style={s.label}>Description</label>
          <textarea style={s.textarea} placeholder="e.g. A luxurious SUV..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
        </div>
        <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Vehicle'}</button>
      </form>
    </AdminLayout>
  );
};

export default AddCar;
