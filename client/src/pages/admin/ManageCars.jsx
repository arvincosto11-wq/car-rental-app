import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { SkeletonListCard } from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import api from '../../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../../data/vehicleBrands';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../../theme';
import usePageTitle from '../../hooks/usePageTitle';
import useModalA11y from '../../hooks/useModalA11y';
import ColorPicker from '../../components/ColorPicker';
import AvailabilityCalendar from '../../components/AvailabilityCalendar';
import BlockDatesPanel, { upcomingBlockCount } from '../../components/BlockDatesPanel';
import Pagination from '../../components/Pagination';
import { paginate } from '../../utils/paginate';
import { formatPlateNumber, sanitizeDigits, sanitizeDecimal } from '../../utils/inputMasks';
import { hasPromo, isPromoVisible, promoOffer, promoDateRange } from '../../utils/promo';

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day in timezones ahead of UTC, like PH).
const toDateValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const OTHER = '__other__';

const PAGE_SIZE = 10;

// Spec-row and header icons — hand-drawn inline SVG like the rest of the
// site, so they read as one family rather than an imported pack.
const LineIcon = ({ children, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
    {children}
  </svg>
);
const SeatsIcon = () => <LineIcon><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" /><path d="M16 11.2a3 3 0 1 0 0-6" /><path d="M20.5 20v-1.2a4 4 0 0 0-3-3.9" /></LineIcon>;
const GearIcon = () => <LineIcon><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></LineIcon>;
const CarIcon = () => <LineIcon><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></LineIcon>;
const MotoIcon = () => <LineIcon><circle cx="5.5" cy="16.5" r="3" /><circle cx="18.5" cy="16.5" r="3" /><path d="M5.5 16.5h5l3-6h3" /><path d="M14 7h3l1.5 9.5" /></LineIcon>;
const PlateIcon = () => <LineIcon><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6.5 10h3M6.5 14h6M15 10.5h3v3h-3z" /></LineIcon>;
const SearchIcon = () => <LineIcon size={15}><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></LineIcon>;
const ArchiveIcon = () => <LineIcon size={15}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><line x1="10" y1="13" x2="14" y2="13" /></LineIcon>;



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
  const [blockPanelCarId, setBlockPanelCarId] = useState(null);
  const [page, setPage] = useState(1);
  const [promoCar, setPromoCar] = useState(null);
  const [promoForm, setPromoForm] = useState({ label: '', type: 'percent', value: '', startDate: '', endDate: '' });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoBookedRanges, setPromoBookedRanges] = useState([]);

  const editingCarData = cars.find((c) => c._id === editingCar) || null;
  const closeEditModal = () => setEditingCar(null);
  const editModalRef = useModalA11y(closeEditModal, !!editingCarData);

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

  const handlePublish = async (car) => {
    try {
      const res = await api.put(`/cars/${car._id}`, { status: 'published' });
      setCars(cars.map((c) => c._id === car._id ? res.data : c));
      toast.success('Listing published — now visible to customers.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to publish this car.');
    }
  };

  const openPromo = async (car) => {
    setPromoCar(car);
    setPromoBookedRanges([]);
    // includePending because those are exactly the bookings the overlap
    // warning counts — the calendar has to show what the warning reacts to.
    try {
      const res = await api.get(`/cars/${car._id}/booked-dates`, { params: { includePending: true } });
      setPromoBookedRanges(res.data);
    } catch {
      setPromoBookedRanges([]);
    }
    setPromoForm(hasPromo(car.promo)
      ? {
          label: car.promo.label,
          type: car.promo.type,
          value: String(car.promo.value),
          startDate: car.promo.startDate.slice(0, 10),
          endDate: car.promo.endDate.slice(0, 10),
        }
      : { label: '', type: 'percent', value: '', startDate: '', endDate: '' });
  };

  const handleSelectPromoDay = (date) => {
    const clicked = toDateValue(date);

    if (!promoForm.startDate || (promoForm.startDate && promoForm.endDate)) {
      setPromoForm({ ...promoForm, startDate: clicked, endDate: '' });
      return;
    }
    if (clicked === promoForm.startDate) {
      setPromoForm({ ...promoForm, startDate: '', endDate: '' });
      return;
    }
    if (new Date(clicked) < new Date(promoForm.startDate)) {
      setPromoForm({ ...promoForm, startDate: clicked });
      return;
    }
    setPromoForm({ ...promoForm, endDate: clicked });
  };

  // The first save deliberately goes out without confirmOverlap so the server
  // gets a chance to report clashing bookings (409). Admin sees exactly which
  // dates are affected, then the same payload goes back confirmed.
  const savePromo = async (confirmOverlap = false) => {
    setPromoSaving(true);
    try {
      const res = await api.put(`/cars/${promoCar._id}/promo`, { ...promoForm, confirmOverlap });
      setCars((prev) => prev.map((c) => (c._id === res.data._id ? res.data : c)));
      setPromoCar(null);
      toast.success('Promo saved. Anyone who favourited this vehicle has been notified.');
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsConfirmation) {
        const dates = data.clashes
          .map((c) => `${new Date(c.startDate).toLocaleDateString()} to ${new Date(c.endDate).toLocaleDateString()}`)
          .join(', ');
        const ok = await confirm(
          `${data.message}

Already booked: ${dates}

Set the promo anyway?`,
          { confirmLabel: 'Set promo' }
        );
        if (ok) return savePromo(true);
      } else {
        toast.error(data?.message || 'Failed to save this promo.');
      }
    } finally {
      setPromoSaving(false);
    }
  };

  const clearPromo = async () => {
    const ok = await confirm(
      'Remove this promo? Bookings already made with it keep their price.',
      { confirmLabel: 'Remove promo', danger: true }
    );
    if (!ok) return;
    setPromoSaving(true);
    try {
      const res = await api.delete(`/cars/${promoCar._id}/promo`);
      setCars((prev) => prev.map((c) => (c._id === res.data._id ? res.data : c)));
      setPromoCar(null);
      toast.success('Promo removed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove this promo.');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleFeature = async (car) => {
    try {
      const res = await api.put(`/cars/${car._id}/feature`);
      setCars(cars.map((c) => c._id === car._id ? res.data : c));
      toast.success(res.data.featured ? 'Added to the homepage carousel.' : 'Removed from the homepage carousel.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to update this car.');
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
      registrationExpiry: car.registrationExpiry ? car.registrationExpiry.split('T')[0] : '',
      gpsDeviceId: car.gpsDeviceId || '',
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

  const styles = {
    // isolation keeps the glow orb's negative z-index inside this page, so
    // it sits behind the cards without slipping behind the layout itself.
    main: { position: 'relative', isolation: 'isolate' },
    glowOrb: {
      position: 'absolute', top: '-140px', right: 0, width: '460px', height: '460px',
      borderRadius: '50%', pointerEvents: 'none', zIndex: -1, filter: 'blur(70px)',
      background: `radial-gradient(circle, ${isDark ? 'rgba(232,161,0,0.16)' : 'rgba(184,121,10,0.07)'} 0%, transparent 70%)`,
    },
    title: { fontSize: '26px', fontWeight: '800', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280' },
    cardList: { display: 'flex', flexDirection: 'column', gap: '16px' },
    // Photo | details | price-and-actions. The side column is capped so a
    // long action strip wraps under itself instead of squeezing the details.
    carCard: {
      display: 'grid', gridTemplateColumns: '224px minmax(0, 1fr) auto', gap: '28px',
      alignItems: 'stretch', padding: '24px', borderRadius: '24px',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    carThumbWrap: {
      width: '224px', height: '144px', borderRadius: '16px', overflow: 'hidden', alignSelf: 'center',
      background: isDark ? '#3a3b3c' : '#f3f4f6',
    },
    carThumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
    carThumbEmpty: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '6px',
      alignItems: 'center', justifyContent: 'center', fontSize: '11px',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    carInfo: { minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', justifyContent: 'center' },
    carNameRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
    carName: { fontSize: '18px', fontWeight: '800', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    // Two columns of labelled specs replace the old single dot-separated
    // line, which was hard to scan once it held four values.
    specGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: '8px 28px' },
    spec: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#b0b3b8' : '#4b5563' },
    specMissing: { fontStyle: 'italic', color: isDark ? '#8a8d91' : '#9ca3af' },
    ratingRow: { display: 'flex', alignItems: 'center', gap: '6px' },
    carRatingText: { fontSize: '12px', fontWeight: '600', color: isDark ? '#b0b3b8' : '#6b7280' },
    carSide: {
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: '18px', maxWidth: '560px',
    },
    carPriceWrap: { textAlign: 'right' },
    carPrice: { fontSize: '26px', fontWeight: '800', letterSpacing: '-0.01em', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    carPriceUnit: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    available: {
      display: 'inline-block', fontSize: '10px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: '20px',
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', color: isDark ? '#86efac' : '#065f46',
      border: `1px solid ${isDark ? 'rgba(22,163,74,0.4)' : '#86efac'}`,
    },
    unavailable: {
      display: 'inline-block', fontSize: '10px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: '20px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      border: `1px solid ${isDark ? 'rgba(220,38,38,0.4)' : '#fca5a5'}`,
    },
    staleFlag: { background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', marginLeft: '4px', fontWeight: '600', cursor: 'help' },
    draftFlag: {
      display: 'inline-block', fontSize: '10px', fontWeight: '700', letterSpacing: '0.03em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: '20px',
      background: isDark ? 'rgba(148,163,184,0.15)' : '#e2e8f0', color: isDark ? '#cbd5e1' : '#475569',
      border: `1px solid ${isDark ? 'rgba(148,163,184,0.4)' : '#cbd5e1'}`,
    },
    publishBtn: { padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', background: isDark ? GOLD_DARK : GOLD, border: 'none', color: ON_GOLD },
    actions: { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' },
    editBtn: { padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', background: isDark ? GOLD_DARK : GOLD, border: 'none', color: ON_GOLD },
    toggleBtn: { padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', background: isDark ? '#18191a' : '#f3f4f6', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb'}`, color: isDark ? '#b0b3b8' : '#374151' },
    archiveBtn: { padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', background: isDark ? '#18191a' : '#f3f4f6', border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb'}`, color: isDark ? '#b0b3b8' : '#374151' },
    featureBtn: (active) => ({
      padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${active ? (isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)') : (isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb')}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#f3f4f6'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#b0b3b8' : '#374151'),
    }),
    editForm: { maxWidth: '960px' },
    editModalOverlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto',
    },
    editModalCard: {
      position: 'relative', width: '100%', maxWidth: '960px',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '24px', outline: 'none',
    },
    editModalCloseBtn: {
      position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px',
      borderRadius: '50%', border: 'none', background: isDark ? '#18191a' : '#f3f4f6',
      color: isDark ? '#e4e6eb' : '#374151', fontSize: '16px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    editTitle: { fontSize: '16px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '16px' },
    imageUpload: { position: 'relative', width: '200px', height: '140px', border: `2px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#18191a' : '#fff' },
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
    label: { display: 'block', fontSize: '12px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '4px', fontWeight: '500' },
    input: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff' },
    textarea: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical', color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff' },
    saveBtn: { padding: '8px 20px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    cancelBtn: { padding: '8px 20px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#374151', cursor: 'pointer' },
    typeToggleRow: { display: 'flex', gap: '10px', marginBottom: '16px' },
    typeToggleBtn: (active) => ({
      flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#fff'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#b0b3b8' : '#374151'),
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }),
    categoryFixed: { padding: '8px 10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#b0b3b8' : '#6b7280' },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px' },
    promoBtn: (live) => ({
      padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
      border: `1px solid ${live ? (isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)') : (isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb')}`,
      background: live ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#f3f4f6'),
      color: live ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#b0b3b8' : '#374151'),
    }),
    // Neutral when there's nothing blocked; picks up an edge when there is,
    // so the count reads as information rather than a warning.
    blockDatesBtn: (hasBlocks) => ({
      padding: '9px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
      background: isDark ? '#18191a' : '#f3f4f6',
      border: `1px solid ${hasBlocks ? (isDark ? '#6b7280' : '#9ca3af') : (isDark ? 'rgba(255,255,255,0.09)' : '#e5e7eb')}`,
      color: hasBlocks ? (isDark ? '#e4e6eb' : '#1a1a1a') : (isDark ? '#b0b3b8' : '#374151'),
    }),
    promoRowTag: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap', alignSelf: 'flex-start',
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.35)' : 'rgba(184,121,10,0.35)'}`,
      color: isDark ? GOLD_DARK : GOLD,
    },
    promoCard: {
      position: 'relative', width: '100%', maxWidth: '460px',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '16px', padding: '24px', outline: 'none',
    },
    promoSub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '16px' },
    promoDatesRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '10px', marginBottom: '8px',
    },
    promoDatesValue: {
      fontSize: '13px', fontWeight: '600',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    promoClearDates: {
      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      fontSize: '12px', fontWeight: '700', flexShrink: 0,
      color: isDark ? GOLD_DARK : GOLD,
    },
    promoTypeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
    promoTypeBtn: (active) => ({
      padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
      border: active ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#fff'),
      color: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#b0b3b8' : '#374151'),
    }),
    promoPreview: {
      marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px dashed ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280',
    },
    searchWrap: { position: 'relative', maxWidth: '420px', marginBottom: '22px' },
    searchIcon: {
      position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
      display: 'flex', pointerEvents: 'none', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    searchInput: {
      width: '100%', height: '44px', padding: '0 14px 0 40px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '12px',
      fontSize: '13px', fontFamily: 'inherit', outline: 'none',
      background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    emptyText: { color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '13px' },
    listFooter: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    listCount: { fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280' },
    listCountStrong: { color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '700' },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' },
    archivedLinkBtn: {
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
      background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#374151',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
    },
  };

  const filteredCars = cars.filter((car) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${car.brand} ${car.model}`.toLowerCase().includes(q);
  });

  // Each card is several times taller than the old row now that it carries
  // a real photo, so a long fleet paginates instead of scrolling forever.
  const totalPages = Math.max(1, Math.ceil(filteredCars.length / PAGE_SIZE));
  // Archiving the last car on the last page would otherwise strand you on
  // an empty page; clamping here rather than in each handler covers every
  // way the list can shrink.
  const currentPage = Math.min(page, totalPages);
  const pageCars = paginate(filteredCars, currentPage, PAGE_SIZE);
  const firstShown = filteredCars.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(currentPage * PAGE_SIZE, filteredCars.length);

  return (
    <AdminLayout activePage="Manage Cars">
      <div style={styles.main}>
        {/* A single soft pool of brand gold behind the page, so the dark
            background reads as lit rather than flat. Gold only — the brand
            doesn't use a second accent. */}
        <div aria-hidden="true" style={styles.glowOrb} />

        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>Manage Cars</h1>
            <p style={styles.subtitle}>View all listed cars, update or remove them.</p>
          </div>
          <button style={styles.archivedLinkBtn} onClick={() => navigate('/admin/archived-cars')}>
            <ArchiveIcon /> Archived Cars
          </button>
        </div>

        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}><SearchIcon /></span>
          <input
            style={styles.searchInput}
            type="text"
            placeholder="Search by brand or model..."
            aria-label="Search cars"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {loading ? <SkeletonListCard isDark={isDark} count={4} /> : filteredCars.length === 0 ? (
          <p style={styles.emptyText}>No cars match.</p>
        ) : (
          <>
            <div style={styles.cardList}>
              {pageCars.map((car) => (
                <div key={car._id} className="mc-card" style={styles.carCard}>
                  <div className="mc-thumb" style={styles.carThumbWrap}>
                    {car.image ? (
                      <img src={car.image} alt={`${car.brand} ${car.model}`} style={styles.carThumbImg} />
                    ) : (
                      <div style={styles.carThumbEmpty}>
                        {car.category === 'Motorcycle' ? <MotoIcon /> : <CarIcon />}
                        <span>No photo</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.carInfo}>
                    <div style={styles.carNameRow}>
                      <span style={styles.carName}>{car.brand} {car.model}</span>
                      {car.status === 'draft' ? (
                        <span style={styles.draftFlag}>Draft</span>
                      ) : (
                        <span style={car.isAvailable ? styles.available : styles.unavailable}>
                          {car.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      )}
                      {!car.isAvailable && !car.availabilityRequest?.requestedAt && (
                        <span
                          style={styles.staleFlag}
                          title="Hidden without a consignor unavailability request on file — worth double-checking this isn't left over from a past bug rather than a deliberate hide."
                        >
                          ⚠ Check
                        </span>
                      )}
                    </div>
                    {isPromoVisible(car.promo) && (
                      <span style={styles.promoRowTag}>
                        {car.promo.label} · {promoOffer(car.promo)} · {promoDateRange(car.promo)}
                      </span>
                    )}

                    <div style={styles.specGrid}>
                      <span style={styles.spec}><SeatsIcon />{car.seats} Seats</span>
                      <span style={styles.spec}><GearIcon />{car.transmission}</span>
                      <span style={styles.spec}>{car.category === 'Motorcycle' ? <MotoIcon /> : <CarIcon />}{car.category}</span>
                      <span style={car.plateNumber ? styles.spec : { ...styles.spec, ...styles.specMissing }}>
                        <PlateIcon />{car.plateNumber || 'No plate on file'}
                      </span>
                    </div>

                    {car.ratingCount > 0 ? (
                      <div style={styles.ratingRow}>
                        <StarRating value={car.avgRating} size={13} readOnly />
                        <span style={styles.carRatingText}>{car.avgRating.toFixed(1)} ({car.ratingCount})</span>
                      </div>
                    ) : (
                      <div style={{ ...styles.ratingRow, ...styles.carRatingText }}>No reviews yet</div>
                    )}
                  </div>

                  <div className="mc-side" style={styles.carSide}>
                    <div style={styles.carPriceWrap}>
                      <div style={styles.carPrice}>₱{car.pricePerDay.toLocaleString()}</div>
                      <div style={styles.carPriceUnit}>/ day</div>
                    </div>
                    <div style={styles.actions}>
                      <button className="mc-btn-primary" style={styles.editBtn} onClick={() => handleEdit(car)}>Edit</button>
                      {car.status === 'draft' ? (
                        <button className="mc-btn-primary" style={styles.publishBtn} onClick={() => handlePublish(car)}>Publish</button>
                      ) : (
                        <button className="mc-btn" style={styles.toggleBtn} onClick={() => handleToggle(car)}>
                          {car.isAvailable ? 'Hide' : 'Show'}
                        </button>
                      )}
                      <button
                        className="mc-btn"
                        style={styles.featureBtn(car.featured)}
                        onClick={() => handleFeature(car)}
                        title={car.featured ? 'Shown in the homepage carousel' : 'Add to the homepage carousel'}
                      >
                        {car.featured ? '★ Featured' : '☆ Feature'}
                      </button>
                      <button
                        className="mc-btn"
                        style={styles.promoBtn(isPromoVisible(car.promo))}
                        onClick={() => openPromo(car)}
                        title={hasPromo(car.promo) ? 'Edit the promo on this vehicle' : 'Put this vehicle on promo'}
                      >
                        {isPromoVisible(car.promo) ? promoOffer(car.promo) : 'Set Promo'}
                      </button>
                      <button
                        className="mc-btn"
                        style={styles.blockDatesBtn(upcomingBlockCount(car.blockedDates) > 0)}
                        onClick={() => setBlockPanelCarId(car._id)}
                        title="Take this vehicle off the road for a range of dates"
                      >
                        {upcomingBlockCount(car.blockedDates) > 0
                          ? `Block Dates · ${upcomingBlockCount(car.blockedDates)}`
                          : 'Block Dates'}
                      </button>
                      <button className="mc-btn" style={styles.archiveBtn} onClick={() => handleArchive(car._id)}>Archive</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.listFooter}>
              <span style={styles.listCount}>
                Showing <strong style={styles.listCountStrong}>{firstShown}–{lastShown}</strong> of{' '}
                <strong style={styles.listCountStrong}>{filteredCars.length}</strong> vehicle{filteredCars.length === 1 ? '' : 's'}
              </span>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                isDark={isDark}
                style={{ marginTop: 0, justifyContent: 'flex-end' }}
              />
            </div>
          </>
        )}
      </div>

      {editingCarData && (() => {
        const car = editingCarData;
        return (
          <div style={styles.editModalOverlay} onClick={closeEditModal}>
            <div
              style={styles.editModalCard}
              ref={editModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-car-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" style={styles.editModalCloseBtn} aria-label="Close" onClick={closeEditModal}>✕</button>
              <div style={styles.editForm}>
                <h3 id="edit-car-modal-title" style={styles.editTitle}>Edit Car</h3>

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
                      <p style={{ fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '6px' }}>
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
                    <label style={styles.label} htmlFor="mc-edit-reg-expiry">OR/CR Registration Expiry</label>
                    <input id="mc-edit-reg-expiry" style={styles.input} type="date" value={editForm.registrationExpiry}
                      onChange={(e) => setEditForm({...editForm, registrationExpiry: e.target.value})} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-gps-device">GPS Tracker Device ID</label>
                    <input id="mc-edit-gps-device" style={styles.input} type="text" placeholder="e.g. 9176761220 (leave blank if none installed)" value={editForm.gpsDeviceId}
                      onChange={(e) => setEditForm({...editForm, gpsDeviceId: e.target.value.trim()})} />
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
                  <label style={styles.label} htmlFor="mc-edit-description">Description</label>
                  <textarea id="mc-edit-description" style={styles.textarea} placeholder="e.g. A luxurious SUV..." value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button style={styles.saveBtn} onClick={() => handleUpdate(car._id)} disabled={updating}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button style={styles.cancelBtn} onClick={closeEditModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {blockPanelCarId && (() => {
        // Read from the live list rather than a snapshot, so the panel shows
        // the new range the moment it's saved.
        const car = cars.find((c) => c._id === blockPanelCarId);
        return car ? (
          <BlockDatesPanel
            car={car}
            role="admin"
            isDark={isDark}
            onClose={() => setBlockPanelCarId(null)}
            onCarUpdated={(updated) => setCars((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))}
          />
        ) : null;
      })()}

      {promoCar && (
        <div style={styles.editModalOverlay} onClick={() => !promoSaving && setPromoCar(null)}>
          <div style={styles.promoCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="promo-title">
            <button style={styles.editModalCloseBtn} onClick={() => setPromoCar(null)} aria-label="Close">×</button>
            <div id="promo-title" style={styles.editTitle}>Promo · {promoCar.brand} {promoCar.model}</div>
            <p style={styles.promoSub}>
              The discount comes off the booking total, and only when the whole rental
              falls inside these dates.
            </p>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="promo-label">Promo name</label>
              <input id="promo-label" style={styles.input} type="text" placeholder="e.g. Holiday Promo" maxLength={40}
                value={promoForm.label} onChange={(e) => setPromoForm({ ...promoForm, label: e.target.value })} />
              <div style={styles.hint}>Customers see this on the card and on their receipt.</div>
            </div>

            <div style={styles.field}>
              <span style={styles.label}>Discount type</span>
              <div style={styles.promoTypeRow}>
                <button style={styles.promoTypeBtn(promoForm.type === 'percent')}
                  onClick={() => setPromoForm({ ...promoForm, type: 'percent', value: '' })}>Percentage</button>
                <button style={styles.promoTypeBtn(promoForm.type === 'amount')}
                  onClick={() => setPromoForm({ ...promoForm, type: 'amount', value: '' })}>Fixed amount</button>
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label} htmlFor="promo-value">
                {promoForm.type === 'percent' ? 'Percentage off' : 'Pesos off'}
              </label>
              <input id="promo-value" style={styles.input} type="text" inputMode="decimal"
                placeholder={promoForm.type === 'percent' ? 'e.g. 10' : 'e.g. 500'}
                value={promoForm.value}
                onChange={(e) => setPromoForm({ ...promoForm, value: sanitizeDecimal(e.target.value, 6) })} />
              <div style={styles.hint}>
                {promoForm.type === 'percent'
                  ? 'Up to 50%.'
                  : `Must be under one day's rate (₱${promoCar.pricePerDay.toLocaleString()}), so no booking can reach zero.`}
              </div>
            </div>

            <div style={styles.field}>
              <span style={styles.label}>Promo dates</span>
              <div style={styles.promoDatesRow}>
                <span style={styles.promoDatesValue}>
                  {promoForm.startDate && promoForm.endDate
                    ? promoDateRange({ ...promoForm, value: 1 })
                    : promoForm.startDate
                      ? 'Now pick the last day'
                      : 'Pick the first day on the calendar'}
                </span>
                {promoForm.startDate && (
                  <button type="button" style={styles.promoClearDates}
                    onClick={() => setPromoForm({ ...promoForm, startDate: '', endDate: '' })}>
                    Clear
                  </button>
                )}
              </div>
              <AvailabilityCalendar
                bookedRanges={promoBookedRanges}
                selectedStart={promoForm.startDate}
                selectedEnd={promoForm.endDate}
                onSelectDay={handleSelectPromoDay}
                isDark={isDark}
                selectableWhenBooked
              />
              <div style={styles.hint}>
                Red days already have a booking. You can still promo across them — those
                bookings keep the price they were made at.
              </div>
            </div>

            {promoForm.value && promoForm.startDate && promoForm.endDate && (
              <div style={styles.promoPreview}>
                Customers will see <strong style={{ color: isDark ? GOLD_DARK : GOLD }}>
                  {promoForm.label || 'Promo'} · {promoOffer({ ...promoForm, value: Number(promoForm.value) })} · {promoDateRange({ ...promoForm, value: Number(promoForm.value) })}
                </strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button style={styles.saveBtn} onClick={() => savePromo(false)} disabled={promoSaving}>
                {promoSaving ? 'Saving...' : hasPromo(promoCar.promo) ? 'Update Promo' : 'Start Promo'}
              </button>
              {hasPromo(promoCar.promo) && (
                <button style={styles.cancelBtn} onClick={clearPromo} disabled={promoSaving}>Remove</button>
              )}
              <button style={styles.cancelBtn} onClick={() => setPromoCar(null)} disabled={promoSaving}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageCars;