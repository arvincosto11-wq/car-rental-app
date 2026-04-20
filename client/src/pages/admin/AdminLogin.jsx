import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

const ManageCars = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCar, setEditingCar] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editImage, setEditImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => { fetchCars(); }, []);

  const fetchCars = async () => {
    try {
      const res = await api.get('/cars');
      setCars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this car?')) return;
    try {
      await api.delete(`/cars/${id}`);
      setCars(cars.filter((c) => c._id !== id));
    } catch (err) { console.error(err); }
  };

  const handleToggle = async (car) => {
    try {
      const res = await api.put(`/cars/${car._id}`, { isAvailable: !car.isAvailable });
      setCars(cars.map((c) => c._id === car._id ? res.data : c));
    } catch (err) { console.error(err); }
  };

  const handleEdit = (car) => {
    setEditingCar(car._id);
    setEditImagePreview(car.image || '');
    setEditImage(null);
    setEditForm({ brand: car.brand, model: car.model, year: car.year, pricePerDay: car.pricePerDay, category: car.category, transmission: car.transmission, fuelType: car.fuelType, seats: car.seats, location: car.location, description: car.description, image: car.image, imageFileId: car.imageFileId });
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setEditImage(file); setEditImagePreview(URL.createObjectURL(file)); }
  };

  const uploadToImageKit = async (file) => {
    const authRes = await api.get('/imagekit/auth');
    const { token, expire, signature, publicKey } = authRes.data;
    const formData = new FormData();
    formData.append('file', file); formData.append('fileName', file.name);
    formData.append('token', token); formData.append('expire', expire);
    formData.append('signature', signature); formData.append('publicKey', publicKey);
    const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
    const data = await uploadRes.json();
    return { url: data.url, fileId: data.fileId };
  };

  const handleUpdate = async (id) => {
    setUpdating(true);
    try {
      let updatedForm = { ...editForm };
      if (editImage) {
        const uploaded = await uploadToImageKit(editImage);
        updatedForm.image = uploaded.url;
        updatedForm.imageFileId = uploaded.fileId;
      }
      const res = await api.put(`/cars/${id}`, updatedForm);
      setCars(cars.map((c) => c._id === id ? res.data : c));
      setEditingCar(null); setEditImage(null); setEditImagePreview('');
    } catch (err) { console.error(err); } finally { setUpdating(false); }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    carCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' },
    carRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px' },
    carThumbWrap: { width: '60px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    carThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
    carInfo: { flex: 1 },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    carSub: { fontSize: '12px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '2px' },
    carPrice: { fontSize: '14px', fontWeight: '500', color: isDark ? '#f1f5f9' : '#1a1a1a', minWidth: '80px' },
    available: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    unavailable: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    actions: { display: 'flex', gap: '6px' },
    editBtn: { padding: '5px 12px', background: isDark ? '#1e40af' : '#eff6ff', border: `1px solid ${isDark ? '#3b82f6' : '#bfdbfe'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: isDark ? '#93c5fd' : '#1d4ed8' },
    toggleBtn: { padding: '5px 12px', background: isDark ? '#334155' : '#f3f4f6', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    deleteBtn: { padding: '5px 12px', background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', border: `1px solid ${isDark ? 'rgba(220,38,38,0.3)' : '#fca5a5'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: isDark ? '#fca5a5' : '#dc2626' },
    editForm: { padding: '20px' },
    editTitle: { fontSize: '16px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '16px' },
    imageUpload: { position: 'relative', width: '200px', height: '140px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
    imagePlaceholder: { textAlign: 'center', padding: '16px' },
    imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
    fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
    editGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' },
    field: { marginBottom: '8px' },
    label: { display: 'block', fontSize: '12px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '4px', fontWeight: '500' },
    input: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff' },
    textarea: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical', color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff' },
    saveBtn: { padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    cancelBtn: { padding: '8px 20px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: `1px solid ${isDark ? '#475569' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  };

  return (
    <AdminLayout activePage="Manage Cars">
      <h1 style={s.title}>Manage Cars</h1>
      <p style={s.subtitle}>View all listed cars, update or remove them.</p>
      {loading ? <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p> : (
        <div>
          {cars.map((car) => (
            <div key={car._id} style={s.carCard}>
              {editingCar === car._id ? (
                <div style={s.editForm}>
                  <h3 style={s.editTitle}>Edit Car</h3>
                  <div style={s.field}>
                    <label style={s.label}>Car Image</label>
                    <div style={s.imageUpload}>
                      {editImagePreview ? (
                        <img src={editImagePreview} alt="preview" style={s.imagePreview} />
                      ) : (
                        <div style={s.imagePlaceholder}>
                          <span style={{ fontSize: '28px' }}>🚗</span>
                          <p style={{ fontSize: '12px', color: isDark ? '#64748b' : '#6b7280', marginTop: '6px' }}>Click to upload</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleEditImageChange} style={s.fileInput} />
                    </div>
                  </div>
                  <div style={s.editGrid}>
                    <div style={s.field}><label style={s.label}>Brand</label><input style={s.input} value={editForm.brand} onChange={(e) => setEditForm({...editForm, brand: e.target.value})} /></div>
                    <div style={s.field}><label style={s.label}>Model</label><input style={s.input} value={editForm.model} onChange={(e) => setEditForm({...editForm, model: e.target.value})} /></div>
                    <div style={s.field}><label style={s.label}>Year</label><input style={s.input} type="number" value={editForm.year} onChange={(e) => setEditForm({...editForm, year: e.target.value})} /></div>
                    <div style={s.field}><label style={s.label}>Daily Price ($)</label><input style={s.input} type="number" value={editForm.pricePerDay} onChange={(e) => setEditForm({...editForm, pricePerDay: e.target.value})} /></div>
                    <div style={s.field}>
                      <label style={s.label}>Category</label>
                      <select style={s.input} value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                        <option>Sedan</option><option>SUV</option><option>Hatchback</option><option>Van</option><option>Truck</option><option>Coupe</option>
                      </select>
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Transmission</label>
                      <select style={s.input} value={editForm.transmission} onChange={(e) => setEditForm({...editForm, transmission: e.target.value})}>
                        <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
                      </select>
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Fuel Type</label>
                      <select style={s.input} value={editForm.fuelType} onChange={(e) => setEditForm({...editForm, fuelType: e.target.value})}>
                        <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
                      </select>
                    </div>
                    <div style={s.field}><label style={s.label}>Seats</label><input style={s.input} type="number" value={editForm.seats} onChange={(e) => setEditForm({...editForm, seats: e.target.value})} /></div>
                    <div style={s.field}>
                      <label style={s.label}>Location</label>
                      <select style={s.input} value={editForm.location} onChange={(e) => setEditForm({...editForm, location: e.target.value})}>
                        <option>New York</option><option>Los Angeles</option><option>Chicago</option><option>Houston</option>
                      </select>
                    </div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Description</label>
                    <textarea style={s.textarea} value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button style={s.saveBtn} onClick={() => handleUpdate(car._id)} disabled={updating}>{updating ? 'Saving...' : 'Save Changes'}</button>
                    <button style={s.cancelBtn} onClick={() => setEditingCar(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={s.carRow}>
                  <div style={s.carThumbWrap}>
                    {car.image ? <img src={car.image} alt="" style={s.carThumbImg} /> : <div style={{ width: '100%', height: '100%', background: isDark ? '#334155' : '#f3f4f6' }} />}
                  </div>
                  <div style={s.carInfo}>
                    <div style={s.carName}>{car.brand} {car.model}</div>
                    <div style={s.carSub}>{car.seats} · {car.transmission} · {car.category}</div>
                  </div>
                  <div style={s.carPrice}>${car.pricePerDay}/day</div>
                  <span style={car.isAvailable ? s.available : s.unavailable}>{car.isAvailable ? 'Available' : 'Unavailable'}</span>
                  <div style={s.actions}>
                    <button style={s.editBtn} onClick={() => handleEdit(car)}>Edit</button>
                    <button style={s.toggleBtn} onClick={() => handleToggle(car)}>{car.isAvailable ? 'Hide' : 'Show'}</button>
                    <button style={s.deleteBtn} onClick={() => handleDelete(car._id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageCars;