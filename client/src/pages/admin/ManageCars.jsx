import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import api from '../../api';

const ManageCars = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCar, setEditingCar] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editImage, setEditImage] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCars();
  }, []);

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
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (car) => {
    try {
      const res = await api.put(`/cars/${car._id}`, { isAvailable: !car.isAvailable });
      setCars(cars.map((c) => c._id === car._id ? res.data : c));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (car) => {
    setEditingCar(car._id);
    setEditImagePreview(car.image || '');
    setEditImage(null);
    setEditForm({
      brand: car.brand,
      model: car.model,
      year: car.year,
      pricePerDay: car.pricePerDay,
      category: car.category,
      transmission: car.transmission,
      fuelType: car.fuelType,
      seats: car.seats,
      description: car.description,
      image: car.image,
      imageFileId: car.imageFileId,
      availableBookingTypes: car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'],
    });
  };

  const toggleEditBookingType = (type) => {
    const current = editForm.availableBookingTypes || [];
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setEditForm({ ...editForm, availableBookingTypes: updated });
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditImage(file);
      setEditImagePreview(URL.createObjectURL(file));
    }
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

    const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await uploadRes.json();
    return { url: data.url, fileId: data.fileId };
  };

  const handleUpdate = async (id) => {
    if (!editForm.availableBookingTypes || editForm.availableBookingTypes.length === 0) {
      alert('Please select at least one booking type (Self Drive and/or With Driver).');
      return;
    }
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
      setEditingCar(null);
      setEditImage(null);
      setEditImagePreview('');
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <AdminLayout activePage="Manage Cars">
      <div style={styles.main}>
          <h1 style={styles.title}>Manage Cars</h1>
          <p style={styles.subtitle}>View all listed cars, update or remove them.</p>
          {loading ? <p>Loading...</p> : (
            <div>
              {cars.map((car) => (
                <div key={car._id} style={styles.carCard}>
                  {editingCar === car._id ? (
                    <div style={styles.editForm}>
                      <h3 style={styles.editTitle}>Edit Car</h3>

                      {/* Image Upload */}
                      <div style={styles.field}>
                        <label style={styles.label}>Car Image</label>
                        <div style={styles.imageUpload}>
                          {editImagePreview ? (
                            <img src={editImagePreview} alt="preview" style={styles.imagePreview} />
                          ) : (
                            <div style={styles.imagePlaceholder}>
                              <span style={{ fontSize: '28px' }}>🚗</span>
                              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                                Click to upload new image
                              </p>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditImageChange}
                            style={styles.fileInput}
                          />
                        </div>
                        {editImagePreview && (
                          <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                            Click image to change it
                          </p>
                        )}
                      </div>

                      <div style={styles.editGrid}>
                        <div style={styles.field}>
                          <label style={styles.label}>Brand</label>
                          <input style={styles.input} value={editForm.brand}
                            onChange={(e) => setEditForm({...editForm, brand: e.target.value})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Model</label>
                          <input style={styles.input} value={editForm.model}
                            onChange={(e) => setEditForm({...editForm, model: e.target.value})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Year</label>
                          <input style={styles.input} type="number" value={editForm.year}
                            onChange={(e) => setEditForm({...editForm, year: e.target.value})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Daily Price (₱)</label>
                          <input style={styles.input} type="number" value={editForm.pricePerDay}
                            onChange={(e) => setEditForm({...editForm, pricePerDay: e.target.value})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Category</label>
                          <select style={styles.input} value={editForm.category}
                            onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                            <option>Sedan</option><option>SUV</option>
                            <option>Hatchback</option><option>Van</option>
                            <option>Truck</option><option>Coupe</option>
                            <option>Motorcycle</option>
                          </select>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Transmission</label>
                          <select style={styles.input} value={editForm.transmission}
                            onChange={(e) => setEditForm({...editForm, transmission: e.target.value})}>
                            <option>Automatic</option><option>Manual</option>
                            <option>Semi-Automatic</option>
                          </select>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Fuel Type</label>
                          <select style={styles.input} value={editForm.fuelType}
                            onChange={(e) => setEditForm({...editForm, fuelType: e.target.value})}>
                            <option>Petrol</option><option>Diesel</option>
                            <option>Electric</option><option>Hybrid</option>
                          </select>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label}>Seats</label>
                          <input style={styles.input} type="number" value={editForm.seats}
                            onChange={(e) => setEditForm({...editForm, seats: e.target.value})} />
                        </div>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Available Booking Types</label>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                          <label style={styles.checkboxLabel}>
                            <input type="checkbox" checked={(editForm.availableBookingTypes || []).includes('self-drive')}
                              onChange={() => toggleEditBookingType('self-drive')} />
                            Self Drive
                          </label>
                          <label style={styles.checkboxLabel}>
                            <input type="checkbox" checked={(editForm.availableBookingTypes || []).includes('with-driver')}
                              onChange={() => toggleEditBookingType('with-driver')} />
                            With Driver
                          </label>
                        </div>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Description</label>
                        <textarea style={styles.textarea} value={editForm.description}
                          onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button style={styles.saveBtn} onClick={() => handleUpdate(car._id)} disabled={updating}>
                          {updating ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button style={styles.cancelBtn} onClick={() => setEditingCar(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.carRow}>
                      <div style={styles.carThumbWrap}>
                        {car.image ? (
                          <img src={car.image} alt="" style={styles.carThumbImg} />
                        ) : (
                          <div style={styles.carThumb} />
                        )}
                      </div>
                      <div style={styles.carInfo}>
                        <div style={styles.carName}>{car.brand} {car.model}</div>
                        <div style={styles.carSub}>{car.seats} · {car.transmission} · {car.category}</div>
                        {car.ratingCount > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                            <StarRating value={car.avgRating} size={12} readOnly />
                            <span style={styles.carRatingText}>{car.avgRating.toFixed(1)} ({car.ratingCount})</span>
                          </div>
                        ) : (
                          <div style={styles.carRatingText}>No reviews yet</div>
                        )}
                      </div>
                      <div style={styles.carPrice}>₱{car.pricePerDay}/day</div>
                      <span style={car.isAvailable ? styles.available : styles.unavailable}>
                        {car.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                      <div style={styles.actions}>
                        <button style={styles.editBtn} onClick={() => handleEdit(car)}>Edit</button>
                        <button style={styles.toggleBtn} onClick={() => handleToggle(car)}>
                          {car.isAvailable ? 'Hide' : 'Show'}
                        </button>
                        <button style={styles.deleteBtn} onClick={() => handleDelete(car._id)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </AdminLayout>
  );
};

const styles = {
  main: {},
  title: { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' },
  subtitle: { fontSize: '13px', color: '#6b7280', marginBottom: '24px' },
  carCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' },
  carRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px' },
  carThumbWrap: { width: '60px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: '#f3f4f6', flexShrink: 0 },
  carThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  carThumb: { width: '100%', height: '100%', background: '#f3f4f6' },
  carInfo: { flex: 1 },
  carName: { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  carSub: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
  carRatingText: { fontSize: '11px', color: '#9ca3af', marginTop: '4px' },
  carPrice: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a', minWidth: '80px' },
  available: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
  unavailable: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
  actions: { display: 'flex', gap: '6px' },
  editBtn: { padding: '5px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#1d4ed8' },
  toggleBtn: { padding: '5px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' },
  deleteBtn: { padding: '5px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#dc2626' },
  editForm: { padding: '20px' },
  editTitle: { fontSize: '16px', fontWeight: '600', color: '#1a1a1a', marginBottom: '16px' },
  imageUpload: { position: 'relative', width: '200px', height: '140px', border: '2px dashed #d1d5db', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholder: { textAlign: 'center', padding: '16px' },
  imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
  fileInput: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' },
  editGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' },
  field: { marginBottom: '8px' },
  label: { display: 'block', fontSize: '12px', color: '#374151', marginBottom: '4px', fontWeight: '500' },
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#111827', background: '#fff' },
  textarea: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical', color: '#111827' },
  saveBtn: { padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  cancelBtn: { padding: '8px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' },
};

export default ManageCars;