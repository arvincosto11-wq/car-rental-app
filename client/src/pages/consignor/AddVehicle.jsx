import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api';

const AddVehicle = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    brand: '', model: '', year: '', plateNumber: '', color: '', mileage: '',
    category: '', transmission: '', fuelType: '', seats: '', location: '',
    suggestedPricePerDay: '', description: '',
  });

  const [orImage, setOrImage] = useState(null);
  const [orPreview, setOrPreview] = useState('');
  const [crImage, setCrImage] = useState(null);
  const [crPreview, setCrPreview] = useState('');
  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [vehiclePreviews, setVehiclePreviews] = useState([]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const uploadToImageKit = async (file) => {
    const authRes = await api.get('/imagekit/user-auth');
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

    if (!orImage || !crImage) {
      setError('Please upload photos of both the OR (Official Receipt) and CR (Certificate of Registration).');
      return;
    }
    if (vehiclePhotos.length === 0) {
      setError('Please upload at least one photo of the vehicle.');
      return;
    }

    setLoading(true);
    try {
      const uploadedOr = await uploadToImageKit(orImage);
      const uploadedCr = await uploadToImageKit(crImage);
      const uploadedPhotos = [];
      for (const file of vehiclePhotos) {
        const uploaded = await uploadToImageKit(file);
        uploadedPhotos.push(uploaded);
      }

      await api.post('/consignments', {
        ...form,
        orImage: uploadedOr.url,
        orImageFileId: uploadedOr.fileId,
        crImage: uploadedCr.url,
        crImageFileId: uploadedCr.fileId,
        vehiclePhotos: uploadedPhotos,
      });

      navigate('/consignor');
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '640px', margin: '0 auto', padding: '32px 16px' },
    title: { fontSize: '24px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    backLink: { fontSize: '13px', color: '#2563eb', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' },
    form: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '24px' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
    field: { marginBottom: '16px' },
    fieldHint: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#111827' },
    textarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#111827' },
    upload: { position: 'relative', width: '100%', height: '130px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
    uploadPlaceholder: { textAlign: 'center', padding: '16px' },
    uploadHint: { fontSize: '12px', color: isDark ? '#64748b' : '#6b7280', marginTop: '6px' },
    uploadPreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px', marginTop: '10px' },
    photoThumbWrap: { position: 'relative', width: '100%', height: '70px', borderRadius: '8px', overflow: 'hidden' },
    photoThumb: { width: '100%', height: '100%', objectFit: 'cover' },
    removePhotoBtn: { position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '13px', lineHeight: '20px', cursor: 'pointer', padding: 0 },
    btn: { width: '100%', padding: '11px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '8px' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/consignor" style={s.backLink}>&larr; Back to My Vehicles</Link>
        <h1 style={s.title}>Add Another Vehicle</h1>
        <p style={s.subtitle}>Submit another vehicle for consignment review.</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Brand</label>
              <input style={s.input} type="text" placeholder="e.g. Toyota" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Model</label>
              <input style={s.input} type="text" placeholder="e.g. Vios" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            </div>
          </div>

          <div style={s.row3}>
            <div style={s.field}>
              <label style={s.label}>Year</label>
              <input style={s.input} type="number" placeholder="e.g. 2022" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Color</label>
              <input style={s.input} type="text" placeholder="e.g. White" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Mileage (km)</label>
              <input style={s.input} type="number" placeholder="e.g. 35000" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Plate Number</label>
            <input style={s.input} type="text" placeholder="e.g. ABC 1234" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
          </div>

          <div style={s.row3}>
            <div style={s.field}>
              <label style={s.label}>Category</label>
              <select style={s.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select category</option>
                <option>Sedan</option><option>SUV</option><option>Hatchback</option>
                <option>Van</option><option>Truck</option><option>Coupe</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Transmission</label>
              <select style={s.input} value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} required>
                <option value="">Select transmission</option>
                <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Fuel Type</label>
              <select style={s.input} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} required>
                <option value="">Select fuel type</option>
                <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
              </select>
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Seating Capacity</label>
              <input style={s.input} type="number" placeholder="e.g. 5" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Location</label>
              <select style={s.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
                <option value="">Select location</option>
                <option>New York</option><option>Los Angeles</option><option>Chicago</option><option>Houston</option>
              </select>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Suggested Daily Price ($)</label>
            <input style={s.input} type="number" placeholder="e.g. 120" value={form.suggestedPricePerDay} onChange={(e) => setForm({ ...form, suggestedPricePerDay: e.target.value })} required />
            <p style={s.fieldHint}>This is a starting suggestion — our admin may adjust it before listing.</p>
          </div>

          <div style={s.field}>
            <label style={s.label}>Description (optional)</label>
            <textarea style={s.textarea} placeholder="Anything else buyers should know about the vehicle" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>OR (Official Receipt)</label>
              <div style={s.upload}>
                {orPreview ? (
                  <img src={orPreview} alt="OR preview" style={s.uploadPreview} />
                ) : (
                  <div style={s.uploadPlaceholder}>
                    <span style={{ fontSize: '26px' }}>🧾</span>
                    <p style={s.uploadHint}>Click to upload OR photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" style={s.fileInput} onChange={(e) => { const f = e.target.files[0]; if (f) { setOrImage(f); setOrPreview(URL.createObjectURL(f)); } }} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>CR (Certificate of Registration)</label>
              <div style={s.upload}>
                {crPreview ? (
                  <img src={crPreview} alt="CR preview" style={s.uploadPreview} />
                ) : (
                  <div style={s.uploadPlaceholder}>
                    <span style={{ fontSize: '26px' }}>📄</span>
                    <p style={s.uploadHint}>Click to upload CR photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" style={s.fileInput} onChange={(e) => { const f = e.target.files[0]; if (f) { setCrImage(f); setCrPreview(URL.createObjectURL(f)); } }} />
              </div>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Vehicle Photos (multiple angles recommended)</label>
            <div style={s.upload}>
              <div style={s.uploadPlaceholder}>
                <span style={{ fontSize: '26px' }}>📷</span>
                <p style={s.uploadHint}>Click to add photos — you can select more than one</p>
              </div>
              <input type="file" accept="image/*" multiple style={s.fileInput} onChange={handleVehiclePhotosChange} />
            </div>
            {vehiclePreviews.length > 0 && (
              <div style={s.photoGrid}>
                {vehiclePreviews.map((src, i) => (
                  <div key={i} style={s.photoThumbWrap}>
                    <img src={src} alt={`Vehicle ${i + 1}`} style={s.photoThumb} />
                    <button type="button" style={s.removePhotoBtn} onClick={() => removeVehiclePhoto(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Vehicle'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddVehicle;
