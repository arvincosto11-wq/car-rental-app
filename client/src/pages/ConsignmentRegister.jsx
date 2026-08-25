import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const PHONE_REGEX = /^(09\d{9}|\+639\d{9})$/;

const ConsignmentRegister = () => {
  const [form, setForm] = useState({
    // Owner info
    name: '', email: '', password: '', phone: '', address: '',
    // Vehicle info
    brand: '', model: '', year: '', plateNumber: '', color: '', mileage: '',
    category: '', transmission: '', fuelType: '', seats: '', location: '',
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

  const handleCategoryChange = (value) => {
    setForm({ ...form, category: value });
    setBookingTypes(
      value === 'Motorcycle'
        ? { 'self-drive': true, 'with-driver': false }
        : { 'self-drive': true, 'with-driver': true }
    );
  };

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input style={styles.input} type="email" placeholder="Enter your email"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" placeholder="Create a password"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Phone Number</label>
              <input style={styles.input} type="tel" placeholder="09171234567"
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Address</label>
              <input style={styles.input} type="text" placeholder="House/Unit No., Street, Barangay, City"
                value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
          </div>

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

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Brand</label>
              <input style={styles.input} type="text" placeholder="e.g. Toyota"
                value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Model</label>
              <input style={styles.input} type="text" placeholder="e.g. Vios"
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
            </div>
          </div>

          <div style={styles.row3}>
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

          <div style={styles.row3}>
            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <select style={styles.input} value={form.category} onChange={(e) => handleCategoryChange(e.target.value)} required>
                <option value="">Select category</option>
                <option>Sedan</option><option>SUV</option><option>Hatchback</option>
                <option>Van</option><option>Truck</option><option>Coupe</option><option>Motorcycle</option>
              </select>
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

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Seating Capacity</label>
              <input style={styles.input} type="number" placeholder="e.g. 5"
                value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Location</label>
              <select style={styles.input} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
                <option value="">Select location</option>
                <option>New York</option><option>Los Angeles</option><option>Chicago</option><option>Houston</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Suggested Daily Price ($)</label>
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

          <div style={styles.row}>
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

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    padding: '40px 16px',
  },
  card: {
    background: '#fff',
    padding: '40px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    width: '100%',
    maxWidth: '640px',
  },
  title: { fontSize: '24px', fontWeight: '600', color: '#1a1a1a', marginBottom: '4px' },
  subtitle: { fontSize: '14px', color: '#6b7280', marginBottom: '16px' },
  notice: {
    background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
    padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
  },
  noticeLink: { color: '#1d4ed8', fontWeight: '600', textDecoration: 'underline' },
  error: {
    background: '#fef2f2', color: '#dc2626', padding: '10px 14px',
    borderRadius: '8px', fontSize: '13px', marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '15px', fontWeight: '700', color: '#1a1a1a',
    marginTop: '24px', marginBottom: '12px', paddingBottom: '8px',
    borderBottom: '1px solid #e5e7eb',
  },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  field: { marginBottom: '16px' },
  fieldHint: { fontSize: '11px', color: '#9ca3af', marginTop: '4px' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' },
  label: { display: 'block', fontSize: '13px', color: '#374151', marginBottom: '6px', fontWeight: '500' },
  input: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: '#111827', background: '#fff',
  },
  textarea: {
    width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', color: '#111827',
  },
  upload: {
    position: 'relative', width: '100%', height: '130px', border: '2px dashed #d1d5db',
    borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff',
  },
  uploadPlaceholder: { textAlign: 'center', padding: '16px' },
  uploadHint: { fontSize: '12px', color: '#6b7280', marginTop: '6px' },
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
    width: '100%', padding: '11px', background: '#2563eb', color: '#fff', border: 'none',
    borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '8px',
  },
  footer: { textAlign: 'center', fontSize: '13px', color: '#6b7280', marginTop: '20px' },
  footerLink: { color: '#2563eb', textDecoration: 'none', fontWeight: '500' },
};

export default ConsignmentRegister;
