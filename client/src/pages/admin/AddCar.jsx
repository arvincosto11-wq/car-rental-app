import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

const AddCar = () => {
  const { isDark } = useTheme();
  const [form, setForm] = useState({
    brand: '', model: '', year: '', pricePerDay: '',
    category: '', transmission: '', fuelType: '',
    seats: '', location: '', description: '',
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    setLoading(true);
    setError('');
    try {
      let imageUrl = '';
      let imageFileId = '';
      if (image) {
        const uploaded = await uploadToImageKit(image);
        imageUrl = uploaded.url;
        imageFileId = uploaded.fileId;
      }
      await api.post('/cars', { ...form, image: imageUrl, imageFileId });
      setSuccess('Car added successfully!');
      setForm({ brand: '', model: '', year: '', pricePerDay: '', category: '', transmission: '', fuelType: '', seats: '', location: '', description: '' });
      setImage(null);
      setImagePreview('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add car');
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
    imageUpload: { position: 'relative', width: '200px', height: '140px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
    imagePlaceholder: { textAlign: 'center', padding: '16px' },
    imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    btn: { padding: '10px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  };

  return (
    <AdminLayout activePage="Add car">
      <h1 style={s.title}>Add New Car</h1>
      <p style={s.subtitle}>Fill in details to list a new car for booking.</p>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}
      <form onSubmit={handleSubmit} style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Car Image</label>
          <div style={s.imageUpload}>
            {imagePreview ? (
              <img src={imagePreview} alt="preview" style={s.imagePreview} />
            ) : (
              <div style={s.imagePlaceholder}>
                <span style={{ fontSize: '32px' }}>🚗</span>
                <p style={{ fontSize: '13px', color: isDark ? '#64748b' : '#6b7280', marginTop: '8px' }}>Click to upload</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleImageChange} style={s.fileInput} />
          </div>
        </div>
        <div style={s.row}>
          <div style={s.field}><label style={s.label}>Brand</label><input style={s.input} placeholder="e.g. Toyota" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})} required /></div>
          <div style={s.field}><label style={s.label}>Model</label><input style={s.input} placeholder="e.g. Corolla" value={form.model} onChange={(e) => setForm({...form, model: e.target.value})} required /></div>
        </div>
        <div style={s.row}>
          <div style={s.field}><label style={s.label}>Year</label><input style={s.input} type="number" placeholder="e.g. 2022" value={form.year} onChange={(e) => setForm({...form, year: e.target.value})} required /></div>
          <div style={s.field}><label style={s.label}>Daily Price ($)</label><input style={s.input} type="number" placeholder="e.g. 150" value={form.pricePerDay} onChange={(e) => setForm({...form, pricePerDay: e.target.value})} required /></div>
          <div style={s.field}>
            <label style={s.label}>Category</label>
            <select style={s.input} value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} required>
              <option value="">Select category</option>
              <option>Sedan</option><option>SUV</option><option>Hatchback</option><option>Van</option><option>Truck</option><option>Coupe</option>
            </select>
          </div>
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
          <div style={s.field}><label style={s.label}>Seating Capacity</label><input style={s.input} type="number" placeholder="e.g. 5" value={form.seats} onChange={(e) => setForm({...form, seats: e.target.value})} required /></div>
        </div>
        <div style={s.field}>
          <label style={s.label}>Location</label>
          <select style={s.input} value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} required>
            <option value="">Select location</option>
            <option>New York</option><option>Los Angeles</option><option>Chicago</option><option>Houston</option>
          </select>
        </div>
        <div style={s.field}>
          <label style={s.label}>Description</label>
          <textarea style={s.textarea} placeholder="e.g. A luxurious SUV..." value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
        </div>
        <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Car'}</button>
      </form>
    </AdminLayout>
  );
};

export default AddCar;