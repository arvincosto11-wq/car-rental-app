import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../../data/vehicleBrands';
import Autocomplete from '../../components/Autocomplete';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD, goldInk } from '../../theme';
import usePageTitle from '../../hooks/usePageTitle';
import ColorPicker, { CAR_COLORS } from '../../components/ColorPicker';
import { formatPlateNumber, sanitizeDigits, sanitizeDecimal } from '../../utils/inputMasks';
import { INSPECTION_CHECKS } from '../../utils/appointments';

// Adding a vehicle, either one of ours or one somebody has just brought in.
//
// The second case arrives here with ?appointment=<id> on the URL, from the
// Appointments page. That is not a different form: it is this form with the
// owner attached, the checklist on top, and the OR/CR expiry filled in from
// the papers on the counter. Saving it IS approving the vehicle — there is
// no approve button anywhere, because one existed and it could tell an owner
// their listing was being set up when no listing existed.
// Drawn, not emoji: the system emoji font picks its own colours, which is
// how 🚗 ended up as the one blue thing on a gold-and-charcoal page.
const Glyph = ({ children, size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const CarGlyph = (p) => <Glyph {...p}><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></Glyph>;
const MotoGlyph = (p) => <Glyph {...p}><circle cx="5.5" cy="16.5" r="3" /><circle cx="18.5" cy="16.5" r="3" /><path d="M5.5 16.5h5l3-6h3" /><path d="M14 7h3l1.5 9.5" /></Glyph>;
const CameraGlyph = (p) => <Glyph {...p}><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z" /><circle cx="12" cy="13" r="3.4" /></Glyph>;
const TickGlyph = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="5 13 10 18 19 7" />
  </svg>
);

const AddCar = () => {
  usePageTitle('Add Vehicle');
  const { isDark } = useTheme();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const appointmentId = params.get('appointment');
  const [appointment, setAppointment] = useState(null);
  const [checked, setChecked] = useState([]);
  const [vehicleType, setVehicleType] = useState('car'); // 'car' | 'motorcycle'
  const [form, setForm] = useState({
    brand: '', model: '', year: '', pricePerDay: '',
    category: '', transmission: '', fuelType: '',
    seats: '', description: '', plateNumber: '', color: '', mileage: '',
    registrationExpiry: '',
  });
  const [bookingTypes, setBookingTypes] = useState({ 'self-drive': true, 'with-driver': true });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // What they said they were bringing, carried over so nobody retypes it
  // with the owner stood there. Every one of these stays editable: the note
  // was typed from memory, the form is being filled in with the vehicle in
  // view, and the vehicle wins.
  useEffect(() => {
    if (!appointmentId) return;
    api.get(`/appointments/${appointmentId}`)
      .then(({ data }) => {
        setAppointment(data);
        if (data.vehicle?.brand) {
          setForm((f) => ({
            ...f,
            brand: data.vehicle.brand || '',
            model: data.vehicle.model || '',
            year: data.vehicle.year ? String(data.vehicle.year) : '',
          }));
        }
      })
      .catch(() => setError('Could not load that appointment. You can still add the vehicle from Manage Cars.'));
  }, [appointmentId]);

  const toggleCheck = (key) => setChecked(
    (prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]),
  );

  const brandOptions = vehicleType === 'motorcycle' ? MOTO_BRAND_ORDER : CAR_BRAND_ORDER;
  // Matched case-insensitively, so a brand typed in lower case still offers
  // its models rather than an empty list.
  const knownBrand = brandOptions.find((b) => b.toLowerCase() === String(form.brand || '').trim().toLowerCase());
  const modelRows = knownBrand
    ? (VEHICLE_DATA[knownBrand] || []).filter((m) => (
      vehicleType === 'motorcycle' ? m.category === 'Motorcycle' : m.category !== 'Motorcycle'
    ))
    : [];
  const modelOptions = modelRows.map((m) => m.model);

  const handleVehicleTypeChange = (type) => {
    setVehicleType(type);
    setForm({ ...form, brand: '', model: '', category: type === 'motorcycle' ? 'Motorcycle' : '' });
    setBookingTypes(
      type === 'motorcycle'
        ? { 'self-drive': true, 'with-driver': false }
        : { 'self-drive': true, 'with-driver': true }
    );
  };

  // A new brand drops the model: a Vios under Honda is somebody halfway
  // through changing their mind.
  const handleBrandChange = (value) => setForm({
    ...form, brand: value, model: '', category: vehicleType === 'motorcycle' ? 'Motorcycle' : '',
  });

  // Picking a model we know still fills the category in — that was worth
  // keeping, and it works on a typed value too as soon as it matches.
  const handleModelChange = (value) => {
    const match = modelRows.find((m) => m.model.toLowerCase() === value.trim().toLowerCase());
    setForm({
      ...form,
      model: value,
      category: match?.category || (vehicleType === 'motorcycle' ? 'Motorcycle' : form.category),
    });
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

  // `decideLater` only means anything for a consigned vehicle: the office
  // has seen it and is not ready to say yes, or at what price. The
  // application is filed and the decision is taken in Manage Consignments.
  const handleSubmit = async (e, status, decideLater = false) => {
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
    // Only for a vehicle somebody has brought in. A ticked box cannot make
    // anybody look at a chassis number — but reaching the end of this form
    // without having been asked is a gap worth closing.
    if (appointmentId) {
      if (checked.length < INSPECTION_CHECKS.length) {
        setError('Please go through the whole inspection checklist first.');
        return;
      }
      if (!form.registrationExpiry) {
        setError("Please enter the OR/CR expiry date from the vehicle's papers.");
        return;
      }
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
        status,
        // Present only for a consigned vehicle, and what tells the server to
        // close the appointment, file the consignment and tell the owner.
        ...(appointmentId ? { appointmentId, inspectionChecks: checked, decideLater } : {}),
      });
      // A consigned vehicle is now somebody else's property on our lot, so
      // the next thing to look at is the consignment, not another blank form.
      if (appointmentId) {
        setSuccess(decideLater
          ? 'Filed for a decision. The owner has been told you have everything you need. Opening Manage Consignments…'
          : 'Listed, and the owner has been told. Opening Manage Consignments…');
        setTimeout(() => navigate('/admin/manage-consignments'), 1400);
        return;
      }
      setSuccess(status === 'draft' ? 'Saved as draft — not visible to customers yet. Find it under Manage Cars → Drafts.' : 'Vehicle published successfully!');
      setForm({ brand: '', model: '', year: '', pricePerDay: '', category: vehicleType === 'motorcycle' ? 'Motorcycle' : '', transmission: '', fuelType: '', seats: '', description: '', plateNumber: '', color: '', mileage: '', registrationExpiry: '' });
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

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const divider = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';
  const chipBg = isDark ? '#303132' : '#f1f2f4';

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '24px' },
    error: { background: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2', color: isDark ? '#fca5a5' : '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    success: { background: isDark ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: isDark ? '#86efac' : '#16a34a', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    form: { display: 'flex', flexDirection: 'column', gap: '20px' },
    field: { marginBottom: '16px' },
    label: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    input: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827' },
    textarea: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical', background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827' },
    removePhotoBtn: {
      position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px',
      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
      fontSize: '13px', lineHeight: '20px', cursor: 'pointer', padding: 0,
    },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px' },
    checkRow: {
      display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', cursor: 'pointer',
      padding: '9px 0', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
      color: isDark ? '#e4e6eb' : '#374151', lineHeight: 1.45,
    },
    who: {
      fontSize: '13px', color: isDark ? '#b0b3b8' : '#4b5563', marginBottom: '14px', lineHeight: 1.5,
    },
    categoryFixed: { padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#b0b3b8' : '#6b7280' },
  
    // ── Form + live preview (design 2a) ───────────────────────────────
    layout: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start' },
    card: { background: card, border: `1px solid ${line}`, borderRadius: '16px', overflow: 'hidden' },
    // Number and title on the left, fields on the right: the page reads as
    // a list of things to do rather than a wall of inputs.
    sec: {
      display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: '24px',
      padding: '26px 28px', borderTop: `1px solid ${divider}`,
    },
    secBadge: (ok) => ({
      width: '26px', height: '26px', borderRadius: '50%', marginBottom: '8px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12.5px', fontWeight: '800',
      background: ok ? gold : goldTint,
      color: ok ? ON_GOLD : ink,
    }),
    secTitle: { fontSize: '15px', fontWeight: '800', color: text },
    secDesc: { fontSize: '12.5px', lineHeight: 1.5, color: text3, marginTop: '3px' },
    secBody: { minWidth: 0 },

    typeRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    typeOption: (on) => ({
      display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
      minHeight: '52px', padding: '0 22px', borderRadius: '11px',
      fontSize: '13.5px', fontWeight: on ? '800' : '600',
      border: on ? `1.5px solid ${goldLine}` : `1px solid ${line}`,
      background: on ? goldTint : 'transparent',
      color: on ? ink : text,
    }),

    grid6: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px 14px' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 14px' },
    colourHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' },
    colourPicked: { fontSize: '12px', color: text3 },

    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' },
    dropTile: {
      gridColumn: 'span 2', aspectRatio: '2 / 1.1', borderRadius: '12px', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
      border: `1px dashed ${goldLine}`, background: goldTint, color: ink, textAlign: 'center', padding: '8px',
    },
    dropTitle: { fontSize: '12.5px', fontWeight: '800' },
    dropHint: { fontSize: '11px', color: text3 },
    photoSlot: { aspectRatio: '4 / 3', borderRadius: '10px', background: inset, border: `1px solid ${line}` },
    photoCell: (cover) => ({
      position: 'relative', aspectRatio: '4 / 3', borderRadius: '10px', overflow: 'hidden',
      border: cover ? `2px solid ${gold}` : `1px solid ${line}`, background: inset,
    }),
    photoImg: { width: '100%', height: '100%', objectFit: 'cover' },
    coverTag: {
      position: 'absolute', left: '5px', bottom: '5px',
      fontSize: '9px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: '5px', background: gold, color: ON_GOLD,
    },

    tileRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    tile: (on) => ({
      display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
      minHeight: '42px', padding: '0 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
      border: on ? `1px solid ${goldLine}` : `1px solid ${line}`,
      background: on ? goldTint : 'transparent',
      color: on ? ink : text,
    }),

    rail: { display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '20px' },
    previewCard: { background: card, border: `1px solid ${line}`, borderRadius: '14px', overflow: 'hidden' },
    previewStage: {
      aspectRatio: '16 / 10', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark
        ? 'radial-gradient(circle at 50% 35%, #2c2d30, #1b1c1e)'
        : 'radial-gradient(circle at 50% 35%, #ffffff, #e9ebee)',
      color: text3,
    },
    previewImg: { width: '100%', height: '100%', objectFit: 'cover' },
    previewEmpty: { display: 'flex' },
    previewBody: { padding: '14px 16px 16px' },
    previewTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', marginTop: '8px' },
    previewName: { fontSize: '14.5px', fontWeight: '800', color: text, minWidth: 0 },
    previewYear: { fontWeight: '600', color: text3 },
    previewPrice: { fontSize: '14.5px', fontWeight: '800', color: text, whiteSpace: 'nowrap' },
    previewPer: { fontSize: '11px', fontWeight: '600', color: text3 },
    previewMeta: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: text2, marginTop: '5px' },
    previewDot: { width: '11px', height: '11px', borderRadius: '50%', flexShrink: 0 },

    railCard: { background: card, border: `1px solid ${line}`, borderRadius: '14px', padding: '16px' },
    railHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' },
    railLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase', color: text3,
    },
    railPct: { fontSize: '11.5px', fontWeight: '700', color: text2 },
    segRow: { display: 'flex', gap: '4px', margin: '10px 0 8px' },
    seg: (ok) => ({ flex: 1, height: '6px', borderRadius: '3px', background: ok ? gold : chipBg }),
    nextUp: { fontSize: '12px', lineHeight: 1.5, color: text2, margin: 0 },
    railDivider: { height: '1px', background: divider, margin: '14px 0' },
    reqList: { listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '7px' },
    reqItem: { display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', color: text },
    reqDot: (ok) => ({
      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: ok ? gold : 'transparent',
      border: ok ? 'none' : `1px solid ${line}`,
      color: ON_GOLD,
    }),
    railBtns: { display: 'flex', gap: '8px', marginTop: '16px' },
    draftBtn: {
      flex: 1, minHeight: '42px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${line}`, background: 'transparent', color: text,
      fontSize: '13px', fontWeight: '700',
    },
    publishBtn: {
      flex: 1, minHeight: '42px', borderRadius: '10px', cursor: 'pointer', border: 'none',
      background: gold, color: ON_GOLD, fontSize: '13px', fontWeight: '800',
    },
  };

  // What each section needs before its badge turns into a tick. The right
  // column reads the same answers, so the progress bar and the sections
  // can never disagree.
  const done = {
    type: true,
    basics: !!(form.brand.trim() && form.model.trim() && form.category && form.year),
    look: !!String(form.color || '').trim(),
    tech: !!(form.transmission && form.fuelType && form.seats && form.plateNumber.trim()),
    photos: photos.length > 0,
    pricing: Number(form.pricePerDay) > 0 && Object.values(bookingTypes).some(Boolean),
  };
  const sectionList = [
    { key: 'type', title: 'Vehicle type', desc: 'Motorcycles default to Self Drive only.', missing: '' },
    { key: 'basics', title: 'Basic information', desc: 'Brand, model, category and year.', missing: 'brand, model, category and year' },
    { key: 'look', title: 'Look', desc: 'Colour and a short description for the listing page.', missing: 'a colour' },
    { key: 'tech', title: 'Technical specifications', desc: 'Shown on the vehicle page. Plate and OR/CR stay internal.', missing: 'transmission, fuel, seats and plate' },
    { key: 'photos', title: 'Photos', desc: 'The first photo becomes the cover.', missing: 'at least one photo' },
    { key: 'pricing', title: 'Pricing & booking', desc: 'What it costs a day, and how it can be booked.', missing: 'a daily price and a booking type' },
  ];
  const doneCount = sectionList.filter((x) => done[x.key]).length;
  const pct = Math.round((doneCount / sectionList.length) * 100);
  const nextUp = sectionList.find((x) => !done[x.key]);

  // The real publish rules, not a tidier-looking list: these are exactly
  // what handleSubmit refuses without. Photos and a price are not among
  // them — a listing can go up without either, and often does.
  const required = [
    { label: 'Brand & model', ok: !!(form.brand.trim() && form.model.trim()) },
    { label: 'Category', ok: !!form.category },
    { label: 'Plate number', ok: !!form.plateNumber.trim() },
    { label: 'At least one booking type', ok: Object.values(bookingTypes).some(Boolean) },
    ...(appointmentId ? [
      { label: 'Inspection checklist', ok: checked.length >= INSPECTION_CHECKS.length },
      { label: 'OR/CR expiry', ok: !!form.registrationExpiry },
    ] : []),
  ];
  const requiredDone = required.filter((r) => r.ok).length;

  const coverPhoto = photoPreviews[0] || null;
  const colorHex = (CAR_COLORS.find((c) => c.name.toLowerCase() === String(form.color || '').trim().toLowerCase()) || {}).hex;

  // A numbered section: badge and title on the left, fields on the right.
  const section = (key, n, children) => {
    const meta = sectionList.find((x) => x.key === key);
    const ok = done[key];
    return (
      <div style={s.sec}>
        <div>
          <div style={s.secBadge(ok)} aria-label={ok ? 'Complete' : undefined}>
            {ok ? <TickGlyph /> : n}
          </div>
          <div style={s.secTitle}>{meta.title}</div>
          <div style={s.secDesc}>{meta.desc}</div>
        </div>
        <div style={s.secBody}>{children}</div>
      </div>
    );
  };

  return (
    <AdminLayout activePage="Add Vehicle">
      <h1 style={s.title}>{appointmentId ? 'Add Consigned Vehicle' : 'Add New Vehicle'}</h1>
      <p style={s.subtitle}>
        {appointmentId
          ? 'The vehicle somebody has just brought in. Saving this listing is what approves it.'
          : 'Fill in details to list a new vehicle for booking.'}
      </p>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.success}>{success}</div>}

      <div style={s.layout}>
        <form onSubmit={handleSubmit} style={s.card}>
          {/* Only when a vehicle has been brought in for a look. It is the
              one section that is about the visit rather than the listing,
              so it sits first and unnumbered. */}
          {appointmentId && (
            <div style={s.sec}>
              <div>
                <div style={s.secBadge(checked.length >= INSPECTION_CHECKS.length)}>
                  {checked.length >= INSPECTION_CHECKS.length ? <TickGlyph /> : '!'}
                </div>
                <div style={s.secTitle}>Inspection</div>
                <div style={s.secDesc}>Go through this with the vehicle in front of you.</div>
              </div>
              <div style={s.secBody}>
                <p style={s.who}>
                  {appointment ? (
                    <>
                      <strong>{appointment.owner?.name || 'Owner'}</strong>
                      {appointment.owner?.phone ? ` · ${appointment.owner.phone}` : ''}
                      {appointment.vehicle?.note ? <><br />{appointment.vehicle.note}</> : null}
                    </>
                  ) : error ? (
                    // It is not still loading — it failed, and the banner
                    // above already says so. Saying "loading" under it reads
                    // as a page that has not noticed its own error.
                    'No appointment details — the checklist still applies.'
                  ) : 'Loading the appointment…'}
                </p>
                {INSPECTION_CHECKS.map((c) => (
                  <label key={c.key} style={s.checkRow}>
                    <input type="checkbox" checked={checked.includes(c.key)} onChange={() => toggleCheck(c.key)} />
                    <span>{c.label}</span>
                  </label>
                ))}
                <div style={{ ...s.field, marginTop: '16px', marginBottom: 0, maxWidth: '240px' }}>
                  <label style={s.label} htmlFor="ac-reg-expiry">OR/CR expiry</label>
                  <input id="ac-reg-expiry" style={s.input} type="date" value={form.registrationExpiry}
                    onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })} />
                  <p style={s.hint}>Read it off the CR while it is in front of you — bookings are checked against it.</p>
                </div>
              </div>
            </div>
          )}

          {section('type', 1, (
            <div style={s.typeRow} role="radiogroup" aria-label="Vehicle type">
              <button type="button" role="radio" aria-checked={vehicleType === 'car'} style={s.typeOption(vehicleType === 'car')} onClick={() => handleVehicleTypeChange('car')}>
                <CarGlyph size={22} /> Car
              </button>
              <button type="button" role="radio" aria-checked={vehicleType === 'motorcycle'} style={s.typeOption(vehicleType === 'motorcycle')} onClick={() => handleVehicleTypeChange('motorcycle')}>
                <MotoGlyph size={22} /> Motorcycle
              </button>
            </div>
          ))}

          {section('basics', 2, (
            <div style={s.grid6}>
              <div style={{ ...s.field, gridColumn: 'span 2' }}>
                <label style={s.label} htmlFor="ac-brand">Brand</label>
                <Autocomplete id="ac-brand" isDark={isDark} value={form.brand} onChange={handleBrandChange}
                  options={brandOptions} placeholder="Start typing — e.g. Toyota" />
              </div>
              <div style={{ ...s.field, gridColumn: 'span 2' }}>
                <label style={s.label} htmlFor="ac-model">Model</label>
                <Autocomplete id="ac-model" isDark={isDark} value={form.model} onChange={handleModelChange}
                  options={modelOptions}
                  placeholder={form.brand ? 'Start typing — e.g. Vios' : 'Brand first'}
                  disabled={!String(form.brand || '').trim()}
                  emptyHint="Not on our list — it will still be saved exactly as typed." />
              </div>
              <div style={{ ...s.field, gridColumn: 'span 2' }}>
                <label style={s.label} htmlFor="ac-year">Year</label>
                <input id="ac-year" style={s.input} type="text" inputMode="numeric" placeholder="e.g. 2022" value={form.year}
                  onChange={(e) => setForm({...form, year: sanitizeDigits(e.target.value, 4)})} required />
              </div>
              <div style={{ ...s.field, gridColumn: 'span 6', marginBottom: 0 }}>
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
                      {modelOptions.some((m) => m.toLowerCase() === String(form.model || '').trim().toLowerCase())
                        ? 'Auto-filled from the model — change it if it is not right.'
                        : 'Type a listed model to auto-fill this, or choose manually.'}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}

          {section('look', 3, (
            <>
              <div style={s.field}>
                <div style={s.colourHead}>
                  <label style={s.label} htmlFor="ac-color">Colour</label>
                  <span style={s.colourPicked}>
                    Selected: <strong>{String(form.color || '').trim() || '—'}</strong>
                  </span>
                </div>
                <ColorPicker id="ac-color" isDark={isDark} value={form.color} onChange={(color) => setForm({...form, color})} />
              </div>
              <div style={{ ...s.field, marginBottom: 0 }}>
                <label style={s.label} htmlFor="ac-description">Description</label>
                <textarea id="ac-description" style={s.textarea} placeholder="e.g. A luxurious SUV..." value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>
            </>
          ))}

          {section('tech', 4, (
            <div style={s.grid3}>
              <div style={s.field}>
                <label style={s.label} htmlFor="ac-transmission">Transmission</label>
                <select id="ac-transmission" style={s.input} value={form.transmission} onChange={(e) => setForm({...form, transmission: e.target.value})} required>
                  <option value="">Select transmission</option>
                  <option>Automatic</option><option>Manual</option><option>Semi-Automatic</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="ac-fuel">Fuel type</label>
                <select id="ac-fuel" style={s.input} value={form.fuelType} onChange={(e) => setForm({...form, fuelType: e.target.value})} required>
                  <option value="">Select fuel type</option>
                  <option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="ac-seats">Seating capacity</label>
                <input id="ac-seats" style={s.input} type="text" inputMode="numeric" placeholder={vehicleType === 'motorcycle' ? 'e.g. 2' : 'e.g. 5'}
                  value={form.seats} onChange={(e) => setForm({...form, seats: sanitizeDigits(e.target.value, 2)})} required />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="ac-plate">Plate number</label>
                <input id="ac-plate" style={s.input} type="text" placeholder="e.g. ABC 1234" value={form.plateNumber}
                  onChange={(e) => setForm({...form, plateNumber: formatPlateNumber(e.target.value)})} required />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="ac-mileage">Mileage (km)</label>
                <input id="ac-mileage" style={s.input} type="text" inputMode="numeric" placeholder="e.g. 35000" value={form.mileage}
                  onChange={(e) => setForm({...form, mileage: sanitizeDigits(e.target.value, 7)})} />
              </div>
              {/* A consigned vehicle has this up in the Inspection section,
                  where the papers are. One of ours can have it entered here
                  or left for later, which is what Manage Cars has always
                  done. */}
              {!appointmentId && (
                <div style={s.field}>
                  <label style={s.label} htmlFor="ac-reg-expiry-own">OR/CR registration expiry</label>
                  <input id="ac-reg-expiry-own" style={s.input} type="date" value={form.registrationExpiry}
                    onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })} />
                </div>
              )}
            </div>
          ))}

          {section('photos', 5, (
            <>
              <div style={s.photoGrid}>
                <label htmlFor="ac-photos" style={s.dropTile}>
                  <CameraGlyph size={22} />
                  <span style={s.dropTitle}>Add photos</span>
                  <span style={s.dropHint}>Front, back, sides and interior</span>
                  <input id="ac-photos" type="file" accept="image/*" multiple onChange={handlePhotosChange} className="sr-only" />
                </label>
                {photoPreviews.map((src, i) => (
                  <div key={src} style={s.photoCell(i === 0)}>
                    <img src={src} alt={`Vehicle ${i + 1}`} style={s.photoImg} />
                    {i === 0 && <span style={s.coverTag}>Cover</span>}
                    <button type="button" className="icon-toggle-btn" style={s.removePhotoBtn} onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>×</button>
                  </div>
                ))}
                {photoPreviews.length < 3 && Array.from({ length: 3 - photoPreviews.length }).map((_, i) => (
                  <div key={`slot-${i}`} style={s.photoSlot} />
                ))}
              </div>
            </>
          ))}

          {section('pricing', 6, (
            <>
              <div style={s.field}>
                <label style={s.label} htmlFor="ac-price">Daily price (₱)</label>
                <input id="ac-price" style={{ ...s.input, maxWidth: '220px' }} type="text" inputMode="decimal" placeholder="e.g. 150"
                  value={form.pricePerDay} onChange={(e) => setForm({...form, pricePerDay: sanitizeDecimal(e.target.value, 8)})} required />
              </div>
              <div style={{ ...s.field, marginBottom: 0 }}>
                <label style={s.label} id="ac-booking-types-label">Available booking types</label>
                <div role="group" aria-labelledby="ac-booking-types-label" style={s.tileRow}>
                  <label style={s.tile(bookingTypes['self-drive'])}>
                    <input type="checkbox" checked={bookingTypes['self-drive']}
                      onChange={(e) => setBookingTypes({ ...bookingTypes, 'self-drive': e.target.checked })} />
                    Self Drive
                  </label>
                  <label style={s.tile(bookingTypes['with-driver'])}>
                    <input type="checkbox" checked={bookingTypes['with-driver']}
                      onChange={(e) => setBookingTypes({ ...bookingTypes, 'with-driver': e.target.checked })} />
                    With Driver
                  </label>
                </div>
                <p style={s.hint}>At least one must be selected. Motorcycles default to Self Drive only, but you can change this.</p>
              </div>
            </>
          ))}
        </form>

        <div className="addcar-rail" style={s.rail}>
          <div style={s.previewCard}>
            <div style={s.previewStage}>
              {coverPhoto
                ? <img src={coverPhoto} alt="" style={s.previewImg} />
                : <span style={s.previewEmpty}>{vehicleType === 'motorcycle' ? <MotoGlyph size={30} /> : <CarGlyph size={30} />}</span>}
            </div>
            <div style={s.previewBody}>
              <div style={s.railLabel}>Listing preview</div>
              <div style={s.previewTop}>
                <span style={s.previewName}>
                  {(form.brand || form.model) ? `${form.brand} ${form.model}`.trim() : 'New vehicle'}
                  {form.year ? <span style={s.previewYear}> {form.year}</span> : null}
                </span>
                <span style={s.previewPrice}>
                  {Number(form.pricePerDay) > 0 ? `₱${Number(form.pricePerDay).toLocaleString()}` : '₱—'}
                  <span style={s.previewPer}> /day</span>
                </span>
              </div>
              <div style={s.previewMeta}>
                {String(form.color || '').trim() && (
                  <>
                    <span style={{ ...s.previewDot, background: colorHex || 'transparent', border: colorHex ? undefined : `1px dashed ${line}` }} />
                    {form.color} ·{' '}
                  </>
                )}
                {vehicleType === 'motorcycle' ? 'Motorcycle' : (form.category || 'Car')}
              </div>
            </div>
          </div>

          <div style={s.railCard}>
            <div style={s.railHead}>
              <span style={s.railLabel}>Progress</span>
              <span style={s.railPct}>{pct}% · {doneCount} of {sectionList.length} sections</span>
            </div>
            <div style={s.segRow} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Listing progress">
              {sectionList.map((x) => <span key={x.key} style={s.seg(done[x.key])} />)}
            </div>
            <p style={s.nextUp}>
              {nextUp
                ? <>Next up: <strong>{nextUp.title} — {nextUp.missing}</strong></>
                : <>Everything is filled in.</>}
            </p>

            <div style={s.railDivider} />

            <div style={s.railHead}>
              <span style={s.railLabel}>Required to publish</span>
              <span style={s.railPct}>{requiredDone} of {required.length}</span>
            </div>
            <ul style={s.reqList}>
              {required.map((r) => (
                <li key={r.label} style={s.reqItem}>
                  <span style={s.reqDot(r.ok)}>{r.ok && <TickGlyph size={11} />}</span>
                  {r.label}
                </li>
              ))}
            </ul>

            <div style={s.railBtns}>
              {/* No draft for a consigned vehicle. Saving one would tell the
                  owner their vehicle is listed while nobody can book it,
                  which is the exact gap this whole flow exists to close. */}
              {!appointmentId && (
                <button style={s.draftBtn} type="button" disabled={loading} onClick={(e) => handleSubmit(e, 'draft')}>
                  {loading ? 'Saving...' : 'Save draft'}
                </button>
              )}
              {/* The vehicle was brought in and looked at, and the office
                  is not ready to commit to listing it or to a rate. Without
                  this the only ways out were to list it or to throw away the
                  record of the visit. */}
              {appointmentId && (
                <button style={s.draftBtn} type="button" disabled={loading} onClick={(e) => handleSubmit(e, 'published', true)}>
                  {loading ? 'Saving...' : 'Decide later'}
                </button>
              )}
              <button style={s.publishBtn} type="button" disabled={loading} onClick={(e) => handleSubmit(e, 'published')}>
                {loading ? 'Publishing...' : (appointmentId ? 'Approve & publish' : 'Publish listing')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AddCar;
