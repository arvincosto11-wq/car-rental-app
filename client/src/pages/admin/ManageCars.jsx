import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { SkeletonListCard } from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import api from '../../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../../data/vehicleBrands';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, GOLD_TINT_BORDER, GOLD_TINT_BORDER_DARK, ON_GOLD } from '../../theme';
import usePageTitle from '../../hooks/usePageTitle';
import ColorPicker from '../../components/ColorPicker';
import { formatPlateNumber, sanitizeDigits, sanitizeDecimal } from '../../utils/inputMasks';

const OTHER = '__other__';

const ManageCars = () => {
  usePageTitle('Manage Cars');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCar, setEditingCar] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editExistingPhotos, setEditExistingPhotos] = useState([]);
  const [editNewPhotos, setEditNewPhotos] = useState([]);
  const [editNewPhotoPreviews, setEditNewPhotoPreviews] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [editVehicleType, setEditVehicleType] = useState('car');
  const [editBrandChoice, setEditBrandChoice] = useState('');
  const [editModelChoice, setEditModelChoice] = useState('');
  const [search, setSearch] = useState('');
  const [blockForm, setBlockForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const editBrandOrder = editVehicleType === 'motorcycle' ? MOTO_BRAND_ORDER : CAR_BRAND_ORDER;
  const editModelOptions = editBrandChoice && editBrandChoice !== OTHER
    ? (VEHICLE_DATA[editBrandChoice] || []).filter((m) =>
        editVehicleType === 'motorcycle' ? m.category === 'Motorcycle' : m.category !== 'Motorcycle'
      )
    : [];

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

  const handleArchive = async (id) => {
    const ok = await confirm('Archive this car? It will be removed from listings but can be restored anytime from Archived Cars.', { confirmLabel: 'Archive' });
    if (!ok) return;
    try {
      await api.put(`/cars/${id}/archive`);
      setCars(cars.filter((c) => c._id !== id));
      toast.success('Car archived.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to archive this car.');
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
    setEditExistingPhotos(car.photos?.length ? car.photos : (car.image ? [{ url: car.image, fileId: car.imageFileId }] : []));
    setEditNewPhotos([]);
    setEditNewPhotoPreviews([]);
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
      plateNumber: car.plateNumber || '',
      color: car.color || '',
      mileage: car.mileage ?? '',
      image: car.image,
      imageFileId: car.imageFileId,
      availableBookingTypes: car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'],
    });

    // Try to match the car's existing brand/model against the curated lists so
    // the dropdowns preselect correctly instead of defaulting to "Other".
    const vehicleType = car.category === 'Motorcycle' ? 'motorcycle' : 'car';
    const brandOrder = vehicleType === 'motorcycle' ? MOTO_BRAND_ORDER : CAR_BRAND_ORDER;
    const brandMatches = brandOrder.includes(car.brand);
    let modelMatch = '';
    if (brandMatches) {
      const modelOptions = (VEHICLE_DATA[car.brand] || []).filter((m) =>
        vehicleType === 'motorcycle' ? m.category === 'Motorcycle' : m.category !== 'Motorcycle'
      );
      modelMatch = modelOptions.some((m) => m.model === car.model) ? car.model : OTHER;
    }
    setEditVehicleType(vehicleType);
    setEditBrandChoice(brandMatches ? car.brand : OTHER);
    setEditModelChoice(brandMatches ? modelMatch : '');
  };

  const handleEditVehicleTypeChange = (type) => {
    setEditVehicleType(type);
    setEditBrandChoice('');
    setEditModelChoice('');
    setEditForm({ ...editForm, brand: '', model: '', category: type === 'motorcycle' ? 'Motorcycle' : '' });
  };

  const handleEditBrandChoiceChange = (value) => {
    setEditBrandChoice(value);
    setEditModelChoice('');
    setEditForm({ ...editForm, brand: value === OTHER ? '' : value, model: '', category: editVehicleType === 'motorcycle' ? 'Motorcycle' : '' });
  };

  const handleEditModelChoiceChange = (value) => {
    setEditModelChoice(value);
    if (value === OTHER) {
      setEditForm({ ...editForm, model: '' });
      return;
    }
    const match = editModelOptions.find((m) => m.model === value);
    const autoCategory = match?.category || (editVehicleType === 'motorcycle' ? 'Motorcycle' : '');
    setEditForm({ ...editForm, model: value, category: autoCategory });
  };

  const toggleEditBookingType = (type) => {
    const current = editForm.availableBookingTypes || [];
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    setEditForm({ ...editForm, availableBookingTypes: updated });
  };

  const handleEditPhotosChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEditNewPhotos((prev) => [...prev, ...files]);
    setEditNewPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  };

  const removeExistingPhoto = (index) => {
    setEditExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index) => {
    setEditNewPhotos((prev) => prev.filter((_, i) => i !== index));
    setEditNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
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
      toast.error('Please select at least one booking type (Self Drive and/or With Driver).');
      return;
    }
    setUpdating(true);
    try {
      let updatedForm = { ...editForm };

      const uploadedNew = [];
      for (const file of editNewPhotos) {
        uploadedNew.push(await uploadToImageKit(file));
      }
      const finalPhotos = [...editExistingPhotos, ...uploadedNew];
      updatedForm.photos = finalPhotos;
      updatedForm.image = finalPhotos[0]?.url || '';
      updatedForm.imageFileId = finalPhotos[0]?.fileId || '';

      const res = await api.put(`/cars/${id}`, updatedForm);
      setCars(cars.map((c) => c._id === id ? res.data : c));
      setEditingCar(null);
      setEditNewPhotos([]);
      setEditNewPhotoPreviews([]);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddBlockedDate = async (carId) => {
    if (!blockForm.startDate || !blockForm.endDate) {
      toast.error('Please pick both a start and end date.');
      return;
    }
    setBlockSubmitting(true);
    try {
      const res = await api.post(`/cars/${carId}/blocked-dates`, blockForm);
      setCars(cars.map((c) => c._id === carId ? res.data : c));
      setBlockForm({ startDate: '', endDate: '', reason: '' });
      toast.success('Dates blocked.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block those dates.');
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleRemoveBlockedDate = async (carId, blockId) => {
    try {
      const res = await api.delete(`/cars/${carId}/blocked-dates/${blockId}`);
      setCars(cars.map((c) => c._id === carId ? res.data : c));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove that blocked range.');
    }
  };

  const styles = {
    main: {},
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    carCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' },
    carRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px' },
    carThumbWrap: { width: '60px', height: '44px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    carThumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
    carThumb: { width: '100%', height: '100%', background: isDark ? '#334155' : '#f3f4f6' },
    carInfo: { flex: 1 },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    carSub: { fontSize: '12px', color: isDark ? '#94a3b8' : '#9ca3af', marginTop: '2px' },
    carRatingText: { fontSize: '11px', color: isDark ? '#94a3b8' : '#9ca3af', marginTop: '4px' },
    carPrice: { fontSize: '14px', fontWeight: '500', color: isDark ? '#f1f5f9' : '#1a1a1a', minWidth: '80px' },
    available: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    unavailable: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    staleFlag: { background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', marginLeft: '4px', fontWeight: '600', cursor: 'help' },
    actions: { display: 'flex', gap: '6px' },
    editBtn: { padding: '5px 12px', background: isDark ? GOLD_TINT_DARK : GOLD_TINT, border: `1px solid ${isDark ? GOLD_TINT_BORDER_DARK : GOLD_TINT_BORDER}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: isDark ? GOLD_DARK : GOLD },
    toggleBtn: { padding: '5px 12px', background: isDark ? '#0f172a' : '#f3f4f6', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    archiveBtn: { padding: '5px 12px', background: isDark ? '#0f172a' : '#f3f4f6', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    editForm: { padding: '20px' },
    editTitle: { fontSize: '16px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '16px' },
    imageUpload: { position: 'relative', width: '200px', height: '140px', border: `2px dashed ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#0f172a' : '#fff' },
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
    editGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' },
    field: { marginBottom: '8px' },
    label: { display: 'block', fontSize: '12px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '4px', fontWeight: '500' },
    input: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff' },
    textarea: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical', color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff' },
    saveBtn: { padding: '8px 20px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    cancelBtn: { padding: '8px 20px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer' },
    typeToggleRow: { display: 'flex', gap: '10px', marginBottom: '16px' },
    typeToggleBtn: (active) => ({
      flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#0f172a' : '#fff'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#94a3b8' : '#374151'),
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }),
    categoryFixed: { padding: '8px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', background: isDark ? '#0f172a' : '#f9fafb', color: isDark ? '#94a3b8' : '#6b7280' },
    hint: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    blockedList: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' },
    blockedItem: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fcd34d' : '#92400e',
    },
    blockedRemoveBtn: {
      background: 'none', border: 'none', color: isDark ? '#fca5a5' : '#dc2626',
      fontSize: '11px', fontWeight: '600', cursor: 'pointer', padding: 0, textDecoration: 'underline', flexShrink: 0,
    },
    blockAddBtn: {
      marginTop: '8px', padding: '8px 16px', background: isDark ? '#0f172a' : '#f3f4f6',
      color: isDark ? '#f1f5f9' : '#374151', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
    },
    searchInput: {
      width: '100%', maxWidth: '360px', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', outline: 'none', marginBottom: '18px',
      background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#111827',
    },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '18px' },
    archivedLinkBtn: {
      padding: '9px 16px', background: isDark ? '#1e293b' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', fontWeight: '600',
      cursor: 'pointer', whiteSpace: 'nowrap',
    },
  };

  const filteredCars = cars.filter((car) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${car.brand} ${car.model}`.toLowerCase().includes(q);
  });

  return (
    <AdminLayout activePage="Manage Cars">
      <div style={styles.main}>
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.title}>Manage Cars</h1>
              <p style={styles.subtitle}>View all listed cars, update or remove them.</p>
            </div>
            <button style={styles.archivedLinkBtn} onClick={() => navigate('/admin/archived-cars')}>
              🗄️ Archived Cars
            </button>
          </div>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search by brand or model..."
            aria-label="Search cars"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? <SkeletonListCard isDark={isDark} count={4} /> : filteredCars.length === 0 ? (
            <p style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: '13px' }}>No cars match.</p>
          ) : (
            <div>
              {filteredCars.map((car) => (
                <div key={car._id} style={styles.carCard}>
                  {editingCar === car._id ? (
                    <div style={styles.editForm}>
                      <h3 style={styles.editTitle}>Edit Car</h3>

                      <div style={styles.typeToggleRow}>
                        <button type="button" style={styles.typeToggleBtn(editVehicleType === 'car')} onClick={() => handleEditVehicleTypeChange('car')}>
                          🚗 Car
                        </button>
                        <button type="button" style={styles.typeToggleBtn(editVehicleType === 'motorcycle')} onClick={() => handleEditVehicleTypeChange('motorcycle')}>
                          🏍️ Motorcycle
                        </button>
                      </div>

                      {/* Photos */}
                      <div style={styles.field}>
                        <label style={styles.label} htmlFor="mc-edit-photos">Car Photos</label>
                        <div style={styles.imageUpload}>
                          <div style={styles.imagePlaceholder}>
                            <span style={{ fontSize: '28px' }}>🚗</span>
                            <p style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '6px' }}>
                              Click to add photos
                            </p>
                          </div>
                          <input
                            id="mc-edit-photos"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleEditPhotosChange}
                            style={styles.fileInput}
                          />
                        </div>
                        {(editExistingPhotos.length > 0 || editNewPhotoPreviews.length > 0) && (
                          <div style={styles.photoGrid}>
                            {editExistingPhotos.map((photo, i) => (
                              <div key={photo.fileId || photo.url || i} style={styles.photoThumbWrap}>
                                <img src={photo.url} alt={`Existing ${i + 1}`} style={styles.photoThumb} />
                                <button type="button" style={styles.removePhotoBtn} onClick={() => removeExistingPhoto(i)} aria-label={`Remove existing photo ${i + 1}`}>×</button>
                              </div>
                            ))}
                            {editNewPhotoPreviews.map((src, i) => (
                              <div key={src} style={styles.photoThumbWrap}>
                                <img src={src} alt={`New ${i + 1}`} style={styles.photoThumb} />
                                <button type="button" style={styles.removePhotoBtn} onClick={() => removeNewPhoto(i)} aria-label={`Remove new photo ${i + 1}`}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <p style={styles.hint}>The first photo shown here becomes the cover image everywhere else in the app.</p>
                      </div>

                      <div style={styles.editGrid}>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-brand">Brand</label>
                          <select id="mc-edit-brand" style={styles.input} value={editBrandChoice} onChange={(e) => handleEditBrandChoiceChange(e.target.value)}>
                            <option value="">Select brand</option>
                            {editBrandOrder.map((b) => <option key={b} value={b}>{b}</option>)}
                            <option value={OTHER}>Other (type manually)</option>
                          </select>
                          {editBrandChoice === OTHER && (
                            <input aria-label="Brand name" style={{ ...styles.input, marginTop: '8px' }} type="text" placeholder="Enter brand name"
                              value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} />
                          )}
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-model">Model</label>
                          {editBrandChoice && editBrandChoice !== OTHER ? (
                            <>
                              <select id="mc-edit-model" style={styles.input} value={editModelChoice} onChange={(e) => handleEditModelChoiceChange(e.target.value)}>
                                <option value="">Select model</option>
                                {editModelOptions.map((m) => <option key={m.model} value={m.model}>{m.model}</option>)}
                                <option value={OTHER}>Other (type manually)</option>
                              </select>
                              {editModelChoice === OTHER && (
                                <input aria-label="Model name" style={{ ...styles.input, marginTop: '8px' }} type="text" placeholder="Enter model name"
                                  value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} />
                              )}
                            </>
                          ) : (
                            <input id="mc-edit-model" style={styles.input} type="text" placeholder={editBrandChoice === OTHER ? 'Enter model name' : 'Select a brand first'}
                              value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                              disabled={!editBrandChoice} />
                          )}
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-year">Year</label>
                          <input id="mc-edit-year" style={styles.input} type="text" inputMode="numeric" placeholder="e.g. 2022" value={editForm.year}
                            onChange={(e) => setEditForm({...editForm, year: sanitizeDigits(e.target.value, 4)})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-price">Daily Price (₱)</label>
                          <input id="mc-edit-price" style={styles.input} type="text" inputMode="decimal" placeholder="e.g. 150" value={editForm.pricePerDay}
                            onChange={(e) => setEditForm({...editForm, pricePerDay: sanitizeDecimal(e.target.value, 8)})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-category">Category</label>
                          {editVehicleType === 'motorcycle' ? (
                            <div id="mc-edit-category" style={styles.categoryFixed}>Motorcycle</div>
                          ) : (
                            <>
                              <select id="mc-edit-category" style={styles.input} value={editForm.category}
                                onChange={(e) => setEditForm({...editForm, category: e.target.value})}>
                                <option value="">Select category</option>
                                {CAR_CATEGORIES_ORDERED.map((c) => <option key={c}>{c}</option>)}
                              </select>
                              <p style={styles.hint}>
                                {editModelChoice && editModelChoice !== OTHER
                                  ? "Auto-filled based on the model you picked — change it if it's not right."
                                  : 'Pick a listed model to auto-fill this, or choose manually.'}
                              </p>
                            </>
                          )}
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-transmission">Transmission</label>
                          <select id="mc-edit-transmission" style={styles.input} value={editForm.transmission}
                            onChange={(e) => setEditForm({...editForm, transmission: e.target.value})}>
                            <option>Automatic</option><option>Manual</option>
                            <option>Semi-Automatic</option>
                          </select>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-fuel">Fuel Type</label>
                          <select id="mc-edit-fuel" style={styles.input} value={editForm.fuelType}
                            onChange={(e) => setEditForm({...editForm, fuelType: e.target.value})}>
                            <option>Petrol</option><option>Diesel</option>
                            <option>Electric</option><option>Hybrid</option>
                          </select>
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-seats">Seats</label>
                          <input id="mc-edit-seats" style={styles.input} type="text" inputMode="numeric" placeholder="e.g. 5" value={editForm.seats}
                            onChange={(e) => setEditForm({...editForm, seats: sanitizeDigits(e.target.value, 2)})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-plate">Plate Number</label>
                          <input id="mc-edit-plate" style={styles.input} type="text" placeholder="e.g. ABC 1234" value={editForm.plateNumber}
                            onChange={(e) => setEditForm({...editForm, plateNumber: formatPlateNumber(e.target.value)})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-color">Color</label>
                          <ColorPicker id="mc-edit-color" isDark={isDark} value={editForm.color}
                            onChange={(color) => setEditForm({...editForm, color})} />
                        </div>
                        <div style={styles.field}>
                          <label style={styles.label} htmlFor="mc-edit-mileage">Mileage (km)</label>
                          <input id="mc-edit-mileage" style={styles.input} type="text" inputMode="numeric" placeholder="e.g. 35000" value={editForm.mileage}
                            onChange={(e) => setEditForm({...editForm, mileage: sanitizeDigits(e.target.value, 7)})} />
                        </div>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label} id="mc-edit-booking-types-label">Available Booking Types</label>
                        <div role="group" aria-labelledby="mc-edit-booking-types-label" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
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
                        <label style={styles.label}>Blocked Dates</label>
                        <p style={styles.hint}>Blocks this vehicle from being booked during these ranges (e.g. maintenance). Saved immediately — not part of Save Changes below.</p>
                        {car.blockedDates?.length > 0 && (
                          <div style={styles.blockedList}>
                            {car.blockedDates.map((b) => (
                              <div key={b._id} style={styles.blockedItem}>
                                <span>
                                  {new Date(b.startDate).toLocaleDateString()} → {new Date(b.endDate).toLocaleDateString()}
                                  {b.reason ? ` · ${b.reason}` : ''}
                                </span>
                                <button type="button" style={styles.blockedRemoveBtn} onClick={() => handleRemoveBlockedDate(car._id, b._id)}>Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="responsive-row-2" style={{ gap: '8px', marginTop: '8px' }}>
                          <input aria-label="Block start date" type="date" style={styles.input}
                            value={blockForm.startDate} onChange={(e) => setBlockForm({ ...blockForm, startDate: e.target.value })} />
                          <input aria-label="Block end date" type="date" style={styles.input}
                            value={blockForm.endDate} onChange={(e) => setBlockForm({ ...blockForm, endDate: e.target.value })} />
                        </div>
                        <input aria-label="Block reason" type="text" style={{ ...styles.input, marginTop: '8px' }} placeholder="Reason (optional, e.g. Maintenance)"
                          value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
                        <button type="button" style={styles.blockAddBtn} onClick={() => handleAddBlockedDate(car._id)} disabled={blockSubmitting}>
                          {blockSubmitting ? 'Blocking...' : 'Block These Dates'}
                        </button>
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label} htmlFor="mc-edit-description">Description</label>
                        <textarea id="mc-edit-description" style={styles.textarea} placeholder="e.g. A luxurious SUV..." value={editForm.description}
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
                    <div className="admin-row-stack" style={styles.carRow}>
                      <div style={styles.carThumbWrap}>
                        {car.image ? (
                          <img src={car.image} alt="" style={styles.carThumbImg} />
                        ) : (
                          <div style={styles.carThumb} />
                        )}
                      </div>
                      <div style={styles.carInfo}>
                        <div style={styles.carName}>{car.brand} {car.model}</div>
                        <div style={styles.carSub}>{car.seats} · {car.transmission} · {car.category} · {car.plateNumber || 'No plate on file'}</div>
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
                      {!car.isAvailable && !car.availabilityRequest?.requestedAt && (
                        <span
                          style={styles.staleFlag}
                          title="Hidden without a consignor unavailability request on file — worth double-checking this isn't left over from a past bug rather than a deliberate hide."
                        >
                          ⚠ Check
                        </span>
                      )}
                      <div className="admin-row-actions" style={styles.actions}>
                        <button style={styles.editBtn} onClick={() => handleEdit(car)}>Edit</button>
                        <button style={styles.toggleBtn} onClick={() => handleToggle(car)}>
                          {car.isAvailable ? 'Hide' : 'Show'}
                        </button>
                        <button style={styles.archiveBtn} onClick={() => handleArchive(car._id)}>Archive</button>
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

export default ManageCars;