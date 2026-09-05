import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../../data/vehicleBrands';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../../theme';
import BookingSteps from '../../components/BookingSteps';
import usePageTitle from '../../hooks/usePageTitle';

const OTHER = '__other__';
const ADD_VEHICLE_STEPS = ['Vehicle Details', 'Documents'];

const AddVehicle = () => {
  usePageTitle('Add Vehicle');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    brand: '', model: '', year: '', plateNumber: '', color: '', mileage: '',
    category: '', transmission: '', fuelType: '', seats: '',
    suggestedPricePerDay: '', description: '',
  });

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

  const goToStep = (n) => setStep(n);

  const validateStep1 = () => {
    if (!form.brand.trim() || !form.model.trim()) { setError('Please select or enter the vehicle brand and model.'); return false; }
    if (!form.year) { setError('Please enter the vehicle year.'); return false; }
    if (!form.plateNumber.trim()) { setError('Please enter the plate number.'); return false; }
    if (vehicleType !== 'motorcycle' && !form.category) { setError('Please select a category.'); return false; }
    if (!form.transmission) { setError('Please select a transmission.'); return false; }
    if (!form.fuelType) { setError('Please select a fuel type.'); return false; }
    if (!form.seats) { setError('Please enter the seating capacity.'); return false; }
    if (!form.suggestedPricePerDay) { setError('Please enter a suggested daily price.'); return false; }
    const selectedBookingTypes = Object.entries(bookingTypes).filter(([, v]) => v);
    if (selectedBookingTypes.length === 0) { setError('Please select at least one booking type (Self Drive and/or With Driver).'); return false; }
    setError('');
    return true;
  };

  const goToStep2Next = () => { if (validateStep1()) setStep(2); };

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
    const selectedBookingTypes = Object.entries(bookingTypes).filter(([, v]) => v).map(([k]) => k);
    if (selectedBookingTypes.length === 0) {
      setError('Please select at least one booking type (Self Drive and/or With Driver).');
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
        availableBookingTypes: selectedBookingTypes,
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
    container: { maxWidth: '720px', margin: '0 auto', padding: '32px 16px' },
    title: { fontSize: '24px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    backLink: { fontSize: '13px', color: isDark ? GOLD_DARK : GOLD, textDecoration: 'none', marginBottom: '16px', display: 'inline-block' },
    form: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '24px' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
    field: { marginBottom: '16px' },
    fieldHint: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer' },
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
    btn: { width: '100%', padding: '11px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', marginTop: '8px' },
    stepActions: { display: 'flex', gap: '10px', marginTop: '8px' },
    backBtn: { flex: '0 0 auto', padding: '11px 20px', background: isDark ? '#0f172a' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
    nextBtn: { flex: 1, padding: '11px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
    typeToggleRow: { display: 'flex', gap: '10px', marginBottom: '16px' },
    typeToggleBtn: (active) => ({
      flex: 1, padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#0f172a' : '#fff'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#94a3b8' : '#374151'),
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }),
    categoryFixed: { padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '14px', background: isDark ? '#0f172a' : '#f9fafb', color: isDark ? '#94a3b8' : '#6b7280' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link to="/consignor" style={s.backLink}>&larr; Back to My Vehicles</Link>
        <h1 style={s.title}>Add Another Vehicle</h1>
        <p style={s.subtitle}>Submit another vehicle for consignment review.</p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={s.form}>
          <div className="booking-steps-shell">
            <BookingSteps steps={ADD_VEHICLE_STEPS} currentStep={step} onStepClick={goToStep} isDark={isDark} />

            <div>
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={s.typeToggleRow}>
                      <button type="button" style={s.typeToggleBtn(vehicleType === 'car')} onClick={() => handleVehicleTypeChange('car')}>
                        🚗 Car
                      </button>
                      <button type="button" style={s.typeToggleBtn(vehicleType === 'motorcycle')} onClick={() => handleVehicleTypeChange('motorcycle')}>
                        🏍️ Motorcycle
                      </button>
                    </div>

                    <div style={s.row}>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-brand">Brand</label>
                        <select id="av-brand" style={s.input} value={brandChoice} onChange={(e) => handleBrandChoiceChange(e.target.value)} required>
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
                        <label style={s.label} htmlFor="av-model">Model</label>
                        {brandChoice && brandChoice !== OTHER ? (
                          <>
                            <select id="av-model" style={s.input} value={modelChoice} onChange={(e) => handleModelChoiceChange(e.target.value)} required>
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
                          <input id="av-model" style={s.input} type="text" placeholder={brandChoice === OTHER ? 'Enter model name' : 'Select a brand first'}
                            value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                            disabled={!brandChoice} required />
                        )}
                      </div>
                    </div>

                    <div style={s.row3}>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-year">Year</label>
                        <input id="av-year" style={s.input} type="number" placeholder="e.g. 2022" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} required />
                      </div>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-color">Color</label>
                        <input id="av-color" style={s.input} type="text" placeholder="e.g. White" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                      </div>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-mileage">Mileage (km)</label>
                        <input id="av-mileage" style={s.input} type="number" placeholder="e.g. 35000" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
                      </div>
                    </div>

                    <div style={s.field}>
                      <label style={s.label} htmlFor="av-plate">Plate Number</label>
                      <input id="av-plate" style={s.input} type="text" placeholder="e.g. ABC 1234" value={form.plateNumber} onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} required />
                    </div>

                    <div style={s.row3}>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-category">Category</label>
                        {vehicleType === 'motorcycle' ? (
                          <div id="av-category" style={s.categoryFixed}>Motorcycle</div>
                        ) : (
                          <select id="av-category" style={s.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                            <option value="">Select category</option>
                            {CAR_CATEGORIES_ORDERED.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        )}
                      </div>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-transmission">Transmission</label>
                        <select id="av-transmission" style={s.input} value={form.transmission} onChange={(e) => setForm({ ...form, transmission: e.target.value })} required>
                          <option value="">Select transmission</option>
                          <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
                        </select>
                      </div>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-fuel">Fuel Type</label>
                        <select id="av-fuel" style={s.input} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })} required>
                          <option value="">Select fuel type</option>
                          <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
                        </select>
                      </div>
                    </div>

                    <div style={s.field}>
                      <label style={s.label} htmlFor="av-seats">Seating Capacity</label>
                      <input id="av-seats" style={s.input} type="number" placeholder="e.g. 5" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} required />
                    </div>

                    <div style={s.field}>
                      <label style={s.label} htmlFor="av-price">Suggested Daily Price (₱)</label>
                      <input id="av-price" style={s.input} type="number" placeholder="e.g. 120" value={form.suggestedPricePerDay} onChange={(e) => setForm({ ...form, suggestedPricePerDay: e.target.value })} required />
                      <p style={s.fieldHint}>This is a starting suggestion — our admin may adjust it before listing.</p>
                    </div>

                    <div style={s.field}>
                      <label style={s.label} id="av-booking-types-label">Available Booking Types</label>
                      <div role="group" aria-labelledby="av-booking-types-label" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
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
                      <p style={s.fieldHint}>At least one must be checked. Motorcycles default to Self Drive only.</p>
                    </div>

                    <div style={s.field}>
                      <label style={s.label} htmlFor="av-description">Description (optional)</label>
                      <textarea id="av-description" style={s.textarea} placeholder="Anything else buyers should know about the vehicle" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>

                    <div style={s.stepActions}>
                      <button type="button" style={s.nextBtn} onClick={goToStep2Next}>
                        Continue
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <div style={s.row}>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-or">OR (Official Receipt)</label>
                        <div style={s.upload}>
                          {orPreview ? (
                            <img src={orPreview} alt="OR preview" style={s.uploadPreview} />
                          ) : (
                            <div style={s.uploadPlaceholder}>
                              <span style={{ fontSize: '26px' }}>🧾</span>
                              <p style={s.uploadHint}>Click to upload OR photo</p>
                            </div>
                          )}
                          <input id="av-or" type="file" accept="image/*" style={s.fileInput} onChange={(e) => { const f = e.target.files[0]; if (f) { setOrImage(f); setOrPreview(URL.createObjectURL(f)); } }} />
                        </div>
                      </div>
                      <div style={s.field}>
                        <label style={s.label} htmlFor="av-cr">CR (Certificate of Registration)</label>
                        <div style={s.upload}>
                          {crPreview ? (
                            <img src={crPreview} alt="CR preview" style={s.uploadPreview} />
                          ) : (
                            <div style={s.uploadPlaceholder}>
                              <span style={{ fontSize: '26px' }}>📄</span>
                              <p style={s.uploadHint}>Click to upload CR photo</p>
                            </div>
                          )}
                          <input id="av-cr" type="file" accept="image/*" style={s.fileInput} onChange={(e) => { const f = e.target.files[0]; if (f) { setCrImage(f); setCrPreview(URL.createObjectURL(f)); } }} />
                        </div>
                      </div>
                    </div>

                    <div style={s.field}>
                      <label style={s.label} htmlFor="av-vehicle-photos">Vehicle Photos (multiple angles recommended)</label>
                      <div style={s.upload}>
                        <div style={s.uploadPlaceholder}>
                          <span style={{ fontSize: '26px' }}>📷</span>
                          <p style={s.uploadHint}>Click to add photos — you can select more than one</p>
                        </div>
                        <input id="av-vehicle-photos" type="file" accept="image/*" multiple style={s.fileInput} onChange={handleVehiclePhotosChange} />
                      </div>
                      {vehiclePreviews.length > 0 && (
                        <div style={s.photoGrid}>
                          {vehiclePreviews.map((src, i) => (
                            <div key={i} style={s.photoThumbWrap}>
                              <img src={src} alt={`Vehicle ${i + 1}`} style={s.photoThumb} />
                              <button type="button" style={s.removePhotoBtn} onClick={() => removeVehiclePhoto(i)} aria-label={`Remove photo ${i + 1}`}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={s.stepActions}>
                      <button type="button" style={s.backBtn} onClick={() => goToStep(1)}>
                        Back
                      </button>
                      <button style={s.nextBtn} type="submit" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit Vehicle'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddVehicle;
