import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { SkeletonListCard } from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import api from '../../api';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER, CAR_CATEGORIES_ORDERED } from '../../data/vehicleBrands';
import Autocomplete from '../../components/Autocomplete';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD, goldInk} from '../../theme';
import usePageTitle from '../../hooks/usePageTitle';
import useModalA11y from '../../hooks/useModalA11y';
import ColorPicker from '../../components/ColorPicker';
import BackButton from '../../components/BackButton';
import BlockDatesPanel, { upcomingBlockCount } from '../../components/BlockDatesPanel';
import DiscountsPanel from '../../components/DiscountsPanel';
import Pagination from '../../components/Pagination';
import { paginate } from '../../utils/paginate';
import { formatPlateNumber, sanitizeDigits, sanitizeDecimal } from '../../utils/inputMasks';
import { registrationLapsed } from '../../utils/registration';
import { unbookable } from '../../utils/vehicleAvailability';
import { isPromoVisible, promoOffer, promoDateRange } from '../../utils/promo';
import ModalClose from '../../components/ModalClose';

const DASH_CH = '—';


const PAGE_SIZE = 12;

// The jump strip at the top of the Edit drawer. Not steps — the form is
// one scroll and nothing depends on anything above it.
const EDIT_SECTIONS = [
  { id: 'photos', label: 'Photos' },
  { id: 'basics', label: 'Basics' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'registration', label: 'Registration' },
  { id: 'booking', label: 'Booking' },
];

// What each state is called on a card. Status is never colour alone.
const PILL_TEXT = {
  available: 'Available',
  hidden: 'Hidden',
  'off-road': 'Off the road',
  papers: 'Papers expired',
  draft: 'Draft',
};

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
const DraftIcon = () => <LineIcon size={15}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 15l5.5-5.5 1.5 1.5L10.5 16.5H9z" /></LineIcon>;
const DiscountIcon = () => <LineIcon size={15}><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></LineIcon>;
const ArchiveIcon = () => <LineIcon size={15}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><line x1="10" y1="13" x2="14" y2="13" /></LineIcon>;
const MoreIcon = () => <LineIcon size={16}><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></LineIcon>;
const EyeIcon = () => <LineIcon size={15}><path d="M1.8 12S5.5 5 12 5s10.2 7 10.2 7-3.7 7-10.2 7S1.8 12 1.8 12z" /><circle cx="12" cy="12" r="3" /></LineIcon>;
const EyeOffIcon = () => <LineIcon size={15}><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10.2 7 10.2 7a17 17 0 0 1-3.3 4.1M6.3 6.5A17 17 0 0 0 1.8 12S5.5 19 12 19a9.8 9.8 0 0 0 4-.8" /><line x1="3" y1="3" x2="21" y2="21" /></LineIcon>;
const StarIcon = () => <LineIcon size={15}><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></LineIcon>;
const WrenchIcon = ({ size = 15 }) => <LineIcon size={size}><path d="M20 6.5a5 5 0 0 1-6.6 6.2L6.8 19.3a2 2 0 1 1-2.8-2.8l6.6-6.6A5 5 0 0 1 17.5 4L15 6.5l1.2 2.3L18.5 10z" /></LineIcon>;



// view="drafts" renders the Draft Vehicles page (route /admin/draft-cars).
// It's this same component rather than a copy, so Edit, Publish and every
// modal behave identically on both pages; only the list, header and the
// buttons on each card differ.
const ManageCars = ({ view = 'active' }) => {
  const isDraftsView = view === 'drafts';
  usePageTitle(isDraftsView ? 'Draft Vehicles' : 'Manage Cars');
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
  const [search, setSearch] = useState('');
  // Which card's ⋯ menu is open, and which status chip is selected. Both
  // are about looking at the list, so neither survives a reload.
  const [menuCarId, setMenuCarId] = useState(null);
  // Openable from somewhere else — the dashboard's vehicle list links
  // straight to the group somebody just read a count for. Only the first
  // render reads it; after that the chips are in charge.
  const [params] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const asked = params.get('status');
    return ['available', 'hidden', 'off-road', 'papers', 'featured'].includes(asked) ? asked : 'all';
  });
  const [sortBy, setSortBy] = useState('newest');
  // Set by picking a suggestion: the list narrows to that one vehicle until
  // the search changes again.
  const [pickedCarId, setPickedCarId] = useState(null);
  // A stable handle on the editor opener. fetchCars runs once on mount and
  // reaches the opener through this, rather than closing over a function
  // React rebuilds on every render.
  const openEditor = useRef(() => {});
  // Where to go back to once this vehicle is dealt with. Only our own
  // admin pages: a path arrives in the address bar, and following
  // anything that turns up there is how an open redirect happens.
  const returnTo = (() => {
    const asked = params.get('return') || '';
    return /^\/admin\/[A-Za-z0-9/_-]*$/.test(asked) ? asked : null;
  })();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [blockPanelCarId, setBlockPanelCarId] = useState(null);
  const [offRoadTarget, setOffRoadTarget] = useState(null);
  const [offRoadNote, setOffRoadNote] = useState('');
  const [offRoadReason, setOffRoadReason] = useState('repairs');
  const [offRoadSubmitting, setOffRoadSubmitting] = useState(false);
  const [offRoadAffected, setOffRoadAffected] = useState(null);
  const [page, setPage] = useState(1);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  // Active long-rental rules, for the count on the Discounts button. Promo
  // counts come straight off the car list; rules live in their own collection.
  const [ruleCount, setRuleCount] = useState(0);
  const loadRuleCount = async () => {
    try {
      const res = await api.get('/long-rental-discounts');
      setRuleCount(res.data.length);
    } catch {
      setRuleCount(0);
    }
  };
  useEffect(() => { loadRuleCount(); }, []);

  // The suggestion list closes the same way the ⋯ menu does. Its own
  // pointer events are stopped on the search wrapper, so picking one still
  // lands before this fires.
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const close = () => setSuggestOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [suggestOpen]);

  // One open menu at a time, closed by a click anywhere else or by Esc.
  // Bound only while a menu is actually open, so the page carries no
  // listeners the rest of the time.
  useEffect(() => {
    if (!menuCarId) return undefined;
    const close = () => setMenuCarId(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    // Capture, so a click on another card's button closes this one first
    // and then opens that one.
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuCarId]);

  const editingCarData = cars.find((c) => c._id === editingCar) || null;

  // Focused once the drawer is actually on the screen, so the admin can
  // type the new date without hunting for the field.
  useEffect(() => {
    if (!editingCarData || params.get('focus') !== 'registrationExpiry') return;
    // After the drawer's own focus handling, which moves focus to the
    // dialog as it opens and would otherwise take it straight back.
    const t = setTimeout(() => {
      const field = document.getElementById('mc-edit-reg-expiry');
      if (!field) return;
      field.focus();
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(t);
  }, [editingCarData]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeEditModal = () => {
    setEditingCar(null);
    if (returnTo) navigate(returnTo);
  };
  const editModalRef = useModalA11y(closeEditModal, !!editingCarData);

  const editBrandOptions = editVehicleType === 'motorcycle' ? MOTO_BRAND_ORDER : CAR_BRAND_ORDER;
  // Matched case-insensitively, so an existing car saved as "toyota" still
  // offers Toyota's models rather than an empty list.
  const editKnownBrand = editBrandOptions.find(
    (b) => b.toLowerCase() === String(editForm.brand || '').trim().toLowerCase(),
  );
  const editModelRows = editKnownBrand
    ? (VEHICLE_DATA[editKnownBrand] || []).filter((m) => (
      editVehicleType === 'motorcycle' ? m.category === 'Motorcycle' : m.category !== 'Motorcycle'
    ))
    : [];
  const editModelOptions = editModelRows.map((m) => m.model);

  const fetchCars = async () => {
    try {
      const res = await api.get('/cars');
      setCars(res.data);
      // A link from Expiring Documents names one vehicle and one field.
      // Opened here, as the list arrives: the vehicle may be filtered out
      // of the visible rows or sitting on another page, so it is looked
      // up in the whole list rather than the ones on screen.
      // Read off the address bar rather than the hook: this runs once as
      // the page loads, and taking the hook's value here would drag the
      // whole fetch into React's dependency graph for no gain.
      const wanted = new URLSearchParams(window.location.search).get('edit');
      const asked = wanted && res.data.find((c) => c._id === wanted);
      if (asked) openEditor.current(asked);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const handleOffRoad = (car) => {
    setOffRoadTarget(car);
    setOffRoadNote('');
    setOffRoadReason('repairs');
    setOffRoadAffected(null);
  };

  // The first attempt goes without confirmCancellations, so the server can
  // answer with who it would hit rather than hitting them. Blocking a date
  // range has always worked this way; pulling a vehicle did not, and it is
  // the more dangerous of the two.
  const submitOffRoad = async (confirmCancellations = false) => {
    setOffRoadSubmitting(true);
    try {
      const res = await api.put(`/cars/${offRoadTarget._id}/off-road`, {
        note: offRoadNote,
        reason: offRoadReason,
        confirmCancellations,
      });
      setOffRoadTarget(null);
      await fetchCars();
      const { underway = [], offered = 0 } = res.data || {};
      if (underway.length) {
        // Named, because admin has to settle each one by hand and how much
        // comes back depends on why it broke.
        toast.info(`${underway.length} client${underway.length === 1 ? ' is' : 's are'} out in this vehicle right now `
          + `— settle ${underway.length === 1 ? 'that booking' : 'those bookings'} from Manage Bookings.`);
      } else {
        toast.success(offered
          ? `Marked off the road. ${offered} upcoming booking${offered === 1 ? '' : 's'} offered another vehicle or a refund.`
          : 'Marked off the road. No bookings were affected.');
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsConfirmation) {
        setOffRoadAffected(data);
      } else {
        console.error(err);
        toast.error(data?.message || 'Something went wrong.');
      }
    } finally {
      setOffRoadSubmitting(false);
    }
  };

  const handleBackOnRoad = async (car) => {
    const ok = await confirm(
      `Put ${car.brand} ${car.model} back on the road? It starts taking bookings again straight away. `
      + 'Clients already moved or refunded stay that way.',
      { confirmLabel: 'Yes, it is roadworthy', cancelLabel: 'Not yet' }
    );
    if (!ok) return;
    try {
      await api.delete(`/cars/${car._id}/off-road`);
      await fetchCars();
      toast.success('Back on the road.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong.');
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
    // Drafts are often saved before their photos are ready. Publishing one
    // without a photo puts a "No Image" card in front of customers, so it's
    // worth a second look rather than a hard block.
    if (!car.image) {
      const ok = await confirm(
        `${car.brand} ${car.model} has no photo yet. Customers will see a blank "No Image" card. Publish anyway?`,
        { confirmLabel: 'Publish anyway' }
      );
      if (!ok) return;
    }
    try {
      const res = await api.put(`/cars/${car._id}`, { status: 'published' });
      setCars(cars.map((c) => c._id === car._id ? res.data : c));
      toast.success('Listing published — now visible to customers.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to publish this car.');
    }
  };

  // Drafts are deleted outright rather than archived: a draft was never
  // public, so there's no booking or review history to preserve. The
  // server refuses anyway if a booking somehow exists.
  const handleDeleteDraft = async (car) => {
    const ok = await confirm(
      `Delete the ${car.brand} ${car.model} draft permanently? This can't be undone.`,
      { confirmLabel: 'Delete draft', danger: true }
    );
    if (!ok) return;
    try {
      await api.delete(`/cars/${car._id}`);
      setCars((prev) => prev.filter((c) => c._id !== car._id));
      toast.success('Draft deleted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete this draft.');
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
      // Blank means the standard two hours. Only filled in for vehicles that
      // genuinely need longer between customers, like a van.
      turnaroundHours: car.turnaroundHours ?? '',
    });

    // Nothing to preselect any more: the boxes hold whatever the car was
    // saved with, and suggest from there. Only which list to suggest from
    // still has to be worked out.
    setEditVehicleType(car.category === 'Motorcycle' ? 'motorcycle' : 'car');
  };

  // Kept pointed at the current opener. Done in an effect rather than
  // during the render itself, which is not a safe moment to write a ref.
  useEffect(() => { openEditor.current = handleEdit; });

  const handleEditVehicleTypeChange = (type) => {
    setEditVehicleType(type);
    setEditForm({ ...editForm, brand: '', model: '', category: type === 'motorcycle' ? 'Motorcycle' : '' });
  };

  const handleEditBrandChange = (value) => setEditForm({
    ...editForm, brand: value, model: '', category: editVehicleType === 'motorcycle' ? 'Motorcycle' : '',
  });

  // A model we recognise still fills the category in, typed or picked.
  const handleEditModelChange = (value) => {
    const match = editModelRows.find((m) => m.model.toLowerCase() === value.trim().toLowerCase());
    setEditForm({
      ...editForm,
      model: value,
      category: match?.category || (editVehicleType === 'motorcycle' ? 'Motorcycle' : editForm.category),
    });
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
      // An empty box has to go back as null, not as 0 — zero is a real
      // setting meaning "no gap needed", and '' would be stored as one.
      updatedForm.turnaroundHours = editForm.turnaroundHours === '' ? null : Number(editForm.turnaroundHours);

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
      if (returnTo) navigate(returnTo);
      setEditNewPhotos([]);
      setEditNewPhotoPreviews([]);
    } catch (err) {
      console.error(err);
      // A refusal used to land in the console and nowhere else, so the
      // drawer simply sat there as though the save had not been pressed.
      toast.error(err.response?.data?.message || 'Could not save this vehicle.');
    } finally {
      setUpdating(false);
    }
  };

  // The two the card styles below lean on most.
  const card = isDark ? '#242526' : '#ffffff';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';

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

    // ── Photo cards ────────────────────────────────────────────────────
    // Four columns on a 1440px screen, fewer as it narrows. Admin is a
    // desktop screen, so this never has to reach phone width.
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' },
    card: {
      background: card, border: `1px solid ${line}`, borderRadius: '16px',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    },
    // The photo sits on a lit stage rather than a flat panel, so a cut-out
    // car on a white background still reads as an object. A vehicle that
    // cannot go out is dimmed — the one place colour is allowed to carry
    // meaning, because the pill says it in words as well.
    stage: (state) => ({
      position: 'relative', aspectRatio: '16 / 9', borderRadius: '15px 15px 0 0',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px',
      boxSizing: 'border-box', overflow: 'hidden',
      background: isDark
        ? 'radial-gradient(circle at 50% 35%, #2c2d30, #1b1c1e)'
        : 'radial-gradient(circle at 50% 35%, #ffffff, #e9ebee)',
      opacity: state === 'available' ? 1 : 0.78,
    }),
    stageImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
    stageEmpty: {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
      fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    pill: (state) => ({
      position: 'absolute', top: '10px', left: '10px',
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: '20px',
      background: state === 'available'
        ? (isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5')
        : state === 'off-road' || state === 'papers'
          ? (isDark ? 'rgba(248,113,113,0.15)' : '#fef2f2')
          : (isDark ? '#303132' : '#f1f2f4'),
      color: state === 'available'
        ? (isDark ? '#86efac' : '#065f46')
        : state === 'off-road' || state === 'papers'
          ? (isDark ? '#f87171' : '#b91c1c')
          : (isDark ? '#b0b3b8' : '#4b5563'),
      border: `1px solid ${state === 'available'
        ? (isDark ? 'rgba(22,163,74,0.4)' : '#86efac')
        : state === 'off-road' || state === 'papers'
          ? (isDark ? 'rgba(248,113,113,0.35)' : '#fecaca')
          : 'transparent'}`,
    }),
    // Sits under the status pill, not beside it: it is a doubt about the
    // hide, not a state of the vehicle.
    checkPill: {
      position: 'absolute', top: '38px', left: '10px',
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: '20px', cursor: 'help',
      background: isDark ? 'rgba(234,179,8,0.15)' : '#fef9c3',
      color: isDark ? '#fde047' : '#854d0e',
    },
    featuredPill: {
      position: 'absolute', top: '10px', right: '10px',
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: '20px',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    },
    cardBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 },
    cardTopRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' },
    cardName: { fontSize: '16px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a', minWidth: 0 },
    cardPrice: {
      fontSize: '16px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    cardPriceUnit: { fontSize: '11px', fontWeight: '600', color: isDark ? '#8a8d91' : '#6b7280' },
    cardSpecs: { fontSize: '12.5px', color: isDark ? '#b0b3b8' : '#4b5563' },
    cardMetaRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
    cardRating: {
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      fontSize: '12.5px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    cardRatingCount: { fontSize: '12.5px', fontWeight: '500', color: isDark ? '#8a8d91' : '#6b7280' },
    cardPlate: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12px',
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    cardPlateMissing: { fontSize: '12px', fontStyle: 'italic', color: isDark ? '#8a8d91' : '#9ca3af' },
    blockedChip: {
      alignSelf: 'flex-start', fontSize: '11.5px', fontWeight: '700',
      padding: '3px 9px', borderRadius: '7px',
      background: isDark ? 'rgba(37,99,235,0.15)' : '#dbeafe',
      color: isDark ? '#93c5fd' : '#1e40af',
    },
    cardFoot: {
      borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
      padding: '12px 14px', display: 'flex', gap: '6px', alignItems: 'center',
    },
    footPrimary: {
      flex: 1, minHeight: '36px', borderRadius: '9px', border: 'none',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
    },
    footGhost: {
      flex: 1, minHeight: '36px', borderRadius: '9px',
      border: `1px solid ${line}`, background: 'transparent',
      color: isDark ? '#e4e6eb' : '#374151', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
    },
    footDanger: {
      flex: 1, minHeight: '36px', borderRadius: '9px',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`, background: 'transparent',
      color: isDark ? '#f87171' : '#b91c1c', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
    },
    menuWrap: { position: 'relative', flexShrink: 0 },
    footMore: {
      width: '36px', height: '36px', borderRadius: '9px', border: `1px solid ${line}`,
      background: 'transparent', color: isDark ? '#e4e6eb' : '#374151',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    // Opens upward: these cards sit in a grid and a menu dropping down
    // would fall outside the last row and off the page.
    menu: {
      position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 30,
      width: '232px', padding: '6px', borderRadius: '12px',
      background: card, border: `1px solid ${line}`,
      boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
      display: 'flex', flexDirection: 'column', gap: '2px',
    },
    menuItem: (tone) => ({
      display: 'flex', alignItems: 'flex-start', gap: '9px', width: '100%',
      minHeight: '38px', padding: '7px 9px', borderRadius: '8px', border: 'none',
      background: 'transparent', textAlign: 'left', cursor: 'pointer',
      color: tone === 'danger' ? (isDark ? '#f87171' : '#b91c1c') : (isDark ? '#e4e6eb' : '#1a1a1a'),
    }),
    menuIcon: { display: 'flex', flexShrink: 0, marginTop: '2px' },
    menuTitle: { display: 'block', fontSize: '12.5px', fontWeight: '700' },
    menuSub: { display: 'block', fontSize: '11px', color: isDark ? '#8a8d91' : '#6b7280', marginTop: '1px' },
    menuDivider: { height: '1px', background: isDark ? '#303132' : '#eef0f2', margin: '4px 2px' },

    // ── Edit drawer ────────────────────────────────────────────────────
    // A drawer rather than a centred box: the form is long, and a centred
    // modal either scrolls inside a short window or covers the page it was
    // opened from. This keeps the list visible beside it.
    drawerOverlay: {
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)',
      display: 'flex', justifyContent: 'flex-end',
    },
    drawer: {
      width: 'min(640px, 100%)', height: '100%', background: card,
      borderLeft: `1px solid ${line}`, display: 'flex', flexDirection: 'column',
      outline: 'none',
    },
    drawerHead: {
      display: 'flex', alignItems: 'center', gap: '12px', position: 'relative',
      padding: '18px 20px', borderBottom: `1px solid ${line}`,
    },
    drawerThumb: { width: '52px', height: '40px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 },
    drawerThumbEmpty: {
      width: '52px', height: '40px', borderRadius: '8px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? '#1e1f20' : '#f1f2f4', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    drawerTitle: { fontSize: '17px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: 0 },
    drawerSub: { fontSize: '12.5px', color: isDark ? '#8a8d91' : '#6b7280', margin: '2px 0 0' },
    strip: {
      display: 'flex', gap: '4px', padding: '10px 20px', overflowX: 'auto',
      borderBottom: `1px solid ${line}`,
    },
    stripBtn: {
      minHeight: '30px', padding: '0 11px', borderRadius: '8px', whiteSpace: 'nowrap',
      border: `1px solid ${line}`, background: 'transparent',
      color: isDark ? '#b0b3b8' : '#4b5563', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
    },
    drawerBody: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '26px' },
    section: { display: 'flex', flexDirection: 'column', gap: '12px', scrollMarginTop: '12px' },
    sectionHead: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#6b7280',
    },
    typeSeg: {
      display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '10px',
      background: isDark ? '#1e1f20' : '#f1f2f4', border: `1px solid ${line}`, alignSelf: 'flex-start',
    },
    typeSegBtn: (on) => ({
      minHeight: '32px', padding: '0 18px', borderRadius: '8px', border: 'none',
      fontSize: '12.5px', fontWeight: on ? '800' : '600', cursor: 'pointer',
      background: on ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: on ? ON_GOLD : (isDark ? '#b0b3b8' : '#4b5563'),
    }),
    photoGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' },
    photoCell: (cover) => ({
      position: 'relative', aspectRatio: '4 / 3', borderRadius: '10px', overflow: 'hidden',
      border: cover ? `2px solid ${isDark ? GOLD_DARK : GOLD}` : `1px solid ${line}`,
      background: isDark ? '#1e1f20' : '#f8f9fa',
    }),
    photoCellImg: { width: '100%', height: '100%', objectFit: 'cover' },
    coverTag: {
      position: 'absolute', left: '5px', bottom: '5px',
      fontSize: '9px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: '5px',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    },
    addTile: {
      aspectRatio: '4 / 3', borderRadius: '10px', cursor: 'pointer',
      border: `1px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px',
      fontSize: '11px', fontWeight: '700', color: isDark ? '#8a8d91' : '#6b7280',
    },
    tileRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    tile: (on) => ({
      display: 'inline-flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
      minHeight: '42px', padding: '0 16px', borderRadius: '10px',
      fontSize: '13px', fontWeight: '700',
      border: `1px solid ${on ? (isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a') : line}`,
      background: on ? (isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6') : 'transparent',
      color: on ? goldInk(isDark) : (isDark ? '#e4e6eb' : '#374151'),
    }),
    drawerFoot: {
      display: 'flex', gap: '10px', justifyContent: 'flex-end',
      padding: '14px 20px', borderTop: `1px solid ${line}`, background: card,
    },
    drawerCancel: {
      minHeight: '40px', padding: '0 18px', borderRadius: '10px', border: `1px solid ${line}`,
      background: 'transparent', color: isDark ? '#e4e6eb' : '#374151',
      fontSize: '13px', fontWeight: '700', cursor: 'pointer',
    },
    drawerSave: {
      minHeight: '40px', padding: '0 22px', borderRadius: '10px', border: 'none',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      fontSize: '13px', fontWeight: '800', cursor: 'pointer',
    },

    toolbar: {
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '22px',
    },
    filterStrip: {
      display: 'inline-flex', gap: '2px', padding: '3px', borderRadius: '10px',
      background: isDark ? '#1e1f20' : '#f1f2f4', border: `1px solid ${line}`,
    },
    filterChip: (on) => ({
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      minHeight: '32px', padding: '0 12px', borderRadius: '8px', border: 'none',
      fontSize: '12.5px', fontWeight: on ? '800' : '600', cursor: 'pointer',
      background: on ? card : 'transparent',
      color: on ? (isDark ? '#e4e6eb' : '#1a1a1a') : (isDark ? '#b0b3b8' : '#4b5563'),
      boxShadow: on ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
    }),
    filterCount: (on) => ({
      fontSize: '11px', fontWeight: '800', fontVariantNumeric: 'tabular-nums',
      color: on ? goldInk(isDark) : (isDark ? '#8a8d91' : '#9ca3af'),
    }),
    modalOverlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid',
      placeItems: 'center', padding: '16px', zIndex: 1000,
    },
    offRoadHead: { display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '10px' },
    offRoadIcon: {
      width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#b91c1c',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
    },
    offRoadFacts: {
      margin: '0 0 16px', padding: '11px 14px 11px 28px', borderRadius: '10px',
      background: isDark ? '#1e1f20' : '#f8f9fa',
      fontSize: '12.5px', lineHeight: 1.6, color: isDark ? '#b0b3b8' : '#4b5563',
      display: 'flex', flexDirection: 'column', gap: '4px',
    },
    // Cards rather than bare radios: the difference between the two is what
    // the client is told, so each one says what it means underneath.
    offRoadOption: (on) => ({
      display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
      padding: '11px 13px', borderRadius: '11px',
      border: on
        ? `1.5px solid ${isDark ? '#f87171' : '#dc2626'}`
        : `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      background: on ? (isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2') : 'transparent',
    }),
    offRoadOptionTitle: {
      display: 'block', fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    offRoadOptionSub: {
      display: 'block', fontSize: '11.5px', marginTop: '1px', color: isDark ? '#8a8d91' : '#6b7280',
    },
    offRoadCard: {
      width: '100%', maxWidth: '440px', background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '16px', padding: '24px',
    },
    offRoadAffected: {
      marginTop: '14px', padding: '12px 14px', borderRadius: '10px',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
    },
    offRoadAffectedTitle: {
      fontSize: '13px', fontWeight: '800', marginBottom: '8px',
      color: isDark ? '#f87171' : '#991b1b',
    },
    offRoadList: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '6px' },
    offRoadItem: { fontSize: '12.5px', lineHeight: 1.5, color: isDark ? '#e4e6eb' : '#374151' },
    offRoadUnderway: {
      fontSize: '12px', lineHeight: 1.5, marginTop: '10px',
      color: isDark ? '#b0b3b8' : '#6b7280',
    },
    offRoadTitle: { fontSize: '17px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#111827', marginBottom: '8px' },
    offRoadSub: { fontSize: '13px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 14px' },
    offRoadChoices: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' },
    offRoadInput: {
      width: '100%', padding: '9px 12px', fontSize: '13px', outline: 'none',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    offRoadConfirm: {
      flex: 1, padding: '10px', border: 'none', borderRadius: '9px', cursor: 'pointer',
      background: isDark ? '#f87171' : '#dc2626', color: '#fff', fontSize: '13px', fontWeight: '700',
    },
    offRoadBack: {
      padding: '10px 16px', borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, background: 'transparent',
      color: isDark ? '#e4e6eb' : '#374151',
    },
    removePhotoBtn: {
      position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px',
      borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff',
      fontSize: '13px', lineHeight: '20px', cursor: 'pointer', padding: 0,
    },
    editGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' },
    field: { marginBottom: '8px' },
    label: { display: 'block', fontSize: '12px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '4px', fontWeight: '500' },
    input: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff' },
    fieldHint: { display: 'block', fontSize: '11px', lineHeight: 1.45, color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px' },
    textarea: { width: '100%', padding: '8px 10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical', color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff' },
    categoryFixed: { padding: '8px 10px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#b0b3b8' : '#6b7280' },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px' },
    promoRowTag: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap', alignSelf: 'flex-start',
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
      border: `1px solid ${isDark ? 'rgba(232,161,0,0.35)' : 'rgba(184,121,10,0.35)'}`,
      color: goldInk(isDark),
    },
    // 40px and a 10px radius, the same as the filter chips beside it. It
    // used to be 44px with a 12px radius, which read as a taller, rounder
    // box bolted onto the row, and it carried its own bottom margin from
    // the days when it was alone there.
    searchWrap: { position: 'relative', flex: '0 1 380px', minWidth: '240px' },
    searchIcon: {
      position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
      display: 'flex', pointerEvents: 'none', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    searchInput: {
      width: '100%', height: '40px', padding: '0 34px 0 38px', boxSizing: 'border-box',
      border: `1px solid ${line}`, borderRadius: '10px',
      fontSize: '13px', fontFamily: 'inherit', outline: 'none',
      background: card, color: isDark ? '#e4e6eb' : '#111827',
    },
    searchClear: {
      position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
      width: '22px', height: '22px', borderRadius: '50%', border: 'none', cursor: 'pointer',
      background: 'transparent', color: isDark ? '#8a8d91' : '#9ca3af',
      fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    suggestList: {
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
      padding: '6px', borderRadius: '12px', background: card, border: `1px solid ${line}`,
      boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
      display: 'flex', flexDirection: 'column', gap: '2px',
    },
    suggestItem: {
      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
      padding: '7px 8px', borderRadius: '8px', border: 'none', background: 'transparent',
      textAlign: 'left', cursor: 'pointer', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    suggestThumb: { width: '40px', height: '30px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 },
    suggestThumbEmpty: {
      width: '40px', height: '30px', borderRadius: '6px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? '#1e1f20' : '#f1f2f4', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    suggestText: { minWidth: 0 },
    suggestName: { display: 'block', fontSize: '12.5px', fontWeight: '700' },
    suggestSub: { display: 'block', fontSize: '11px', color: isDark ? '#8a8d91' : '#6b7280' },
    sortWrap: { marginLeft: 'auto' },
    sortSelect: {
      height: '40px', padding: '0 12px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${line}`, background: card, color: isDark ? '#e4e6eb' : '#374151',
      fontSize: '12.5px', fontWeight: '700', fontFamily: 'inherit', outline: 'none',
    },
    emptyText: { color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '13px' },
    listFooter: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
      marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    listCount: { fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280' },
    listCountStrong: { color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '700' },
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' },
    headerBtns: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    // Picks up a gold edge while there are drafts waiting, so unfinished work
    // is visible from the main page without crowding it.
    draftsLinkBtn: (hasDrafts) => ({
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
      background: isDark ? '#242526' : '#fff',
      color: hasDrafts ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#e4e6eb' : '#374151'),
      border: `1px solid ${hasDrafts ? (isDark ? 'rgba(232,161,0,0.45)' : 'rgba(184,121,10,0.45)') : (isDark ? '#3a3b3c' : '#d1d5db')}`,
    }),
    draftsCount: {
      minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', fontWeight: '800', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    },
    archivedLinkBtn: {
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
      background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#374151',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
    },
  };

  // Drafts live on their own page, like archived cars, so the main list only
  // shows vehicles that are actually live.
  const draftCount = cars.filter((car) => car.status === 'draft').length;
  const activePromoCount = cars.filter((car) => isPromoVisible(car.promo)).length;
  // What state a vehicle is in, as one word. The order matters: a car in
  // the workshop with expired papers is reported as off the road, because
  // that is the one somebody has to act on first.
  const stateOf = (car) => {
    if (car.offRoad?.since) return 'off-road';
    if (registrationLapsed(car)) return 'papers';
    if (!car.isAvailable) return 'hidden';
    return 'available';
  };

  const listCars = cars.filter((car) => (isDraftsView ? car.status === 'draft' : car.status !== 'draft'));
  const countOf = (key) => (key === 'featured'
    ? listCars.filter((c) => c.featured).length
    : listCars.filter((c) => stateOf(c) === key).length);

  // Featured sits beside the states although it isn't one: it is the other
  // thing somebody opens this page to check.
  const statusFilters = [
    { key: 'all', label: 'All', count: listCars.length },
    { key: 'available', label: 'Available', count: countOf('available') },
    { key: 'hidden', label: 'Hidden', count: countOf('hidden') },
    { key: 'off-road', label: 'Off the road', count: countOf('off-road') },
    { key: 'papers', label: 'Papers expired', count: countOf('papers') },
    { key: 'featured', label: 'Featured', count: countOf('featured') },
  ];

  // Everything the box says it searches, in one haystack, so a suggestion
  // never offers something the search itself would not find. Category is in
  // here so "sedan" or "motor" gathers the fleet by kind — the shortened
  // word works because this is a substring match, not a whole-word one.
  const matchesQuery = (car, q) =>
    `${car.brand} ${car.model} ${car.plateNumber || ''} ${car.category || ''}`.toLowerCase().includes(q);

  const query = search.trim().toLowerCase();
  const suggestions = query
    ? listCars.filter((c) => matchesQuery(c, query)).slice(0, 6)
    : [];

  const filteredCars = cars.filter((car) => {
    if (isDraftsView ? car.status !== 'draft' : car.status === 'draft') return false;
    if (pickedCarId) return car._id === pickedCarId;
    if (statusFilter === 'featured' && !car.featured) return false;
    if (statusFilter !== 'all' && statusFilter !== 'featured' && stateOf(car) !== statusFilter) return false;
    if (!query) return true;
    // Plate and category as well as the name: the office has the plate in
    // front of them more often than the model, and "sedan" is how somebody
    // asks for the part of the fleet they mean.
    return matchesQuery(car, query);
  })
    // Newest first. This list had no order at all, so it came out however
    // MongoDB handed it over — oldest first — which put the vehicle you
    // just added at the bottom of the last page. The id is the fallback
    // because it begins with the second the row was made, so it still
    // orders correctly for anything stored before timestamps.
    .sort((a, b) => {
      // Anything that cannot go out — hidden, off the road, papers expired
      // — sits at the end, the same as on the public page, whichever sort
      // is chosen. The fleet that is working is the part somebody scrolls
      // this list to find.
      const stopped = (unbookable(a) ? 1 : 0) - (unbookable(b) ? 1 : 0);
      if (stopped) return stopped;
      // The id breaks every tie: it begins with the second the row was
      // made, so the order never depends on what the database sent.
      const made = (c) => (c.createdAt ? new Date(c.createdAt).getTime() : 0);
      const newest = () => made(b) - made(a) || String(b._id).localeCompare(String(a._id));
      if (sortBy === 'name-asc') return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`) || newest();
      if (sortBy === 'price-asc') return a.pricePerDay - b.pricePerDay || newest();
      if (sortBy === 'price-desc') return b.pricePerDay - a.pricePerDay || newest();
      if (sortBy === 'reviews-desc') return (b.ratingCount || 0) - (a.ratingCount || 0) || newest();
      return newest();
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

        {isDraftsView && (
          <BackButton text="Back to Manage Cars" onClick={() => navigate('/admin/manage-cars')} />
        )}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>{isDraftsView ? 'Draft Vehicles' : 'Manage Cars'}</h1>
            <p style={styles.subtitle}>
              {isDraftsView
                ? 'Not visible to customers. Add photos with Edit, then Publish when a listing is ready.'
                : 'View all listed cars, update or remove them.'}
            </p>
          </div>
          {!isDraftsView && (
            <div style={styles.headerBtns}>
              {/* Every discount in one place — date promos and long-rental
                  rules — so it lives up here rather than on each row. */}
              <button style={styles.archivedLinkBtn} onClick={() => setDiscountsOpen(true)}>
                <DiscountIcon /> Discounts
                {(activePromoCount + ruleCount) > 0 && (
                  <span style={styles.draftsCount}>{activePromoCount + ruleCount}</span>
                )}
              </button>
              {/* The count keeps unfinished drafts from being forgotten now
                  that they're off the main list. */}
              <button style={styles.draftsLinkBtn(draftCount > 0)} onClick={() => navigate('/admin/draft-cars')}>
                <DraftIcon /> Drafts
                {draftCount > 0 && <span style={styles.draftsCount}>{draftCount}</span>}
              </button>
              <button style={styles.archivedLinkBtn} onClick={() => navigate('/admin/archived-cars')}>
                <ArchiveIcon /> Archived Cars
              </button>
            </div>
          )}
        </div>

        <div style={styles.toolbar}>
          <div style={styles.searchWrap} onPointerDown={(e) => e.stopPropagation()}>
            <span style={styles.searchIcon}><SearchIcon /></span>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search by brand, model, plate or type..."
              aria-label="Search cars"
              autoComplete="off"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                // Typing again is leaving the one vehicle behind.
                setPickedCarId(null);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSuggestOpen(false); }}
            />
            {search && (
              <button
                type="button"
                className="icon-toggle-btn"
                style={styles.searchClear}
                aria-label="Clear search"
                onClick={() => { setSearch(''); setPickedCarId(null); setSuggestOpen(false); setPage(1); }}
              >
                ×
              </button>
            )}
            {suggestOpen && !pickedCarId && suggestions.length > 0 && (
              <div style={styles.suggestList}>
                {suggestions.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    className="list-row-btn"
                    style={styles.suggestItem}
                    onClick={() => {
                      setPickedCarId(c._id);
                      setSearch(`${c.brand} ${c.model}`);
                      setSuggestOpen(false);
                      setPage(1);
                    }}
                  >
                    {c.image
                      ? <img src={c.image} alt="" style={styles.suggestThumb} />
                      : <span style={styles.suggestThumbEmpty}>{c.category === 'Motorcycle' ? <MotoIcon /> : <CarIcon />}</span>}
                    <span style={styles.suggestText}>
                      <span style={styles.suggestName}>{c.brand} {c.model}</span>
                      <span style={styles.suggestSub}>
                        {c.plateNumber || 'No plate on file'} · {PILL_TEXT[stateOf(c)]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isDraftsView && (
            <div style={styles.filterStrip} role="tablist" aria-label="Filter by status">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  type="button"
                  className="mc-filter-chip"
                  aria-selected={statusFilter === f.key}
                  style={styles.filterChip(statusFilter === f.key)}
                  onClick={() => { setStatusFilter(f.key); setPage(1); }}
                >
                  {f.label}
                  <span style={styles.filterCount(statusFilter === f.key)}>{f.count}</span>
                </button>
              ))}
            </div>
          )}
          <label style={styles.sortWrap}>
            <span className="sr-only">Sort vehicles</span>
            <select
              style={styles.sortSelect}
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            >
              <option value="newest">Newest first</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="reviews-desc">Most reviewed</option>
            </select>
          </label>
        </div>

        {loading ? <SkeletonListCard isDark={isDark} count={4} /> : filteredCars.length === 0 ? (
          <p style={styles.emptyText}>
            {search.trim() || statusFilter !== 'all'
              ? 'No vehicles match.'
              : isDraftsView
                ? 'No drafts. Vehicles saved with Save Draft in Add Vehicle appear here.'
                : 'No published vehicles yet.'}
          </p>
        ) : (
          <>
            <div style={styles.grid}>
              {pageCars.map((car) => {
                const state = stateOf(car);
                const blocked = upcomingBlockCount(car.blockedDates);
                const menuOpen = menuCarId === car._id;
                return (
                  <div key={car._id} style={styles.card}>
                    <div style={styles.stage(state)}>
                      {car.image ? (
                        <img src={car.image} alt={`${car.brand} ${car.model}`} style={styles.stageImg} />
                      ) : (
                        <div style={styles.stageEmpty}>
                          {car.category === 'Motorcycle' ? <MotoIcon /> : <CarIcon />}
                          <span>No photo</span>
                        </div>
                      )}
                      {/* Never colour alone — the pill always says the word. */}
                      <span style={styles.pill(car.status === 'draft' ? 'draft' : state)}>
                        {car.status === 'draft' ? 'Draft' : PILL_TEXT[state]}
                      </span>
                      {!car.isAvailable && !car.availabilityRequest?.requestedAt && car.status !== 'draft' && (
                        <span
                          style={styles.checkPill}
                          title="Hidden without a consignor unavailability request on file — worth double-checking this isn't left over from a past bug rather than a deliberate hide."
                        >
                          Check
                        </span>
                      )}
                      {car.featured && (
                        <span style={styles.featuredPill}><StarIcon /> Featured</span>
                      )}
                    </div>

                    <div style={styles.cardBody}>
                      <div style={styles.cardTopRow}>
                        <span style={styles.cardName}>{car.brand} {car.model}</span>
                        <span style={styles.cardPrice}>
                          ₱{car.pricePerDay.toLocaleString()}<span style={styles.cardPriceUnit}> /day</span>
                        </span>
                      </div>

                      <div style={styles.cardSpecs}>
                        {car.category} · {car.seats} seats · {car.transmission}
                      </div>

                      <div style={styles.cardMetaRow}>
                        {car.ratingCount > 0 ? (
                          <span style={styles.cardRating}>
                            <StarRating value={car.avgRating} size={13} readOnly />
                            {car.avgRating.toFixed(1)} <span style={styles.cardRatingCount}>({car.ratingCount})</span>
                          </span>
                        ) : (
                          <span style={styles.cardRatingCount}>No reviews yet</span>
                        )}
                        <span style={car.plateNumber ? styles.cardPlate : styles.cardPlateMissing}>
                          {car.plateNumber || 'No plate on file'}
                        </span>
                      </div>

                      {isPromoVisible(car.promo) && (
                        <span style={styles.promoRowTag}>
                          {car.promo.label} · {promoOffer(car.promo)} · {promoDateRange(car.promo)}
                        </span>
                      )}

                      {blocked > 0 && (
                        <span style={styles.blockedChip}>
                          {blocked} blocked range{blocked === 1 ? '' : 's'} ahead
                        </span>
                      )}
                    </div>

                    {isDraftsView ? (
                      <div style={styles.cardFoot}>
                        <button className="mc-btn-primary" style={styles.footPrimary} onClick={() => handlePublish(car)}>Publish</button>
                        <button className="mc-btn" style={styles.footGhost} onClick={() => handleEdit(car)}>Edit</button>
                        <button className="mc-btn" style={styles.footDanger} onClick={() => handleDeleteDraft(car)}>Delete</button>
                      </div>
                    ) : (
                      <div style={styles.cardFoot}>
                        <button className="mc-btn-primary" style={styles.footPrimary} onClick={() => handleEdit(car)}>Edit</button>
                        <button
                          className="mc-btn"
                          style={styles.footGhost}
                          onClick={() => setBlockPanelCarId(car._id)}
                          title="Take this vehicle off the road for a range of dates"
                        >
                          Block dates
                        </button>
                        {/* The page-wide close listener runs on pointerdown,
                            which would tear the menu out from under a click
                            on one of its own items before the click landed. */}
                        <div style={styles.menuWrap} onPointerDown={(e) => e.stopPropagation()}>
                          <button
                            className="mc-btn"
                            style={styles.footMore}
                            aria-label={`More actions for ${car.brand} ${car.model}`}
                            aria-expanded={menuOpen}
                            aria-haspopup="menu"
                            onClick={() => setMenuCarId(menuOpen ? null : car._id)}
                          >
                            <MoreIcon />
                          </button>
                          {menuOpen && (
                            <div style={styles.menu} role="menu">
                              <button
                                style={styles.menuItem()}
                                role="menuitem"
                                onClick={() => { setMenuCarId(null); handleToggle(car); }}
                              >
                                <span style={styles.menuIcon}>{car.isAvailable ? <EyeOffIcon /> : <EyeIcon />}</span>
                                <span>
                                  <span style={styles.menuTitle}>{car.isAvailable ? 'Hide from site' : 'Show on site'}</span>
                                  <span style={styles.menuSub}>
                                    {car.isAvailable ? 'Clients stop seeing it; bookings stay' : 'Clients can find and book it again'}
                                  </span>
                                </span>
                              </button>
                              <button
                                style={styles.menuItem()}
                                role="menuitem"
                                onClick={() => { setMenuCarId(null); handleFeature(car); }}
                              >
                                <span style={styles.menuIcon}><StarIcon /></span>
                                <span>
                                  <span style={styles.menuTitle}>{car.featured ? 'Remove from featured' : 'Feature on homepage'}</span>
                                  <span style={styles.menuSub}>Shown in the hero carousel</span>
                                </span>
                              </button>
                              <div style={styles.menuDivider} />
                              <button
                                style={styles.menuItem('danger')}
                                role="menuitem"
                                onClick={() => { setMenuCarId(null); (car.offRoad?.since ? handleBackOnRoad(car) : handleOffRoad(car)); }}
                              >
                                <span style={styles.menuIcon}><WrenchIcon /></span>
                                <span>
                                  <span style={styles.menuTitle}>{car.offRoad?.since ? 'Back on the road' : 'Take off the road'}</span>
                                  <span style={styles.menuSub}>
                                    {car.offRoad?.since ? 'Starts taking bookings again' : 'Repairs, or no longer available'}
                                  </span>
                                </span>
                              </button>
                              <button
                                style={styles.menuItem()}
                                role="menuitem"
                                onClick={() => { setMenuCarId(null); handleArchive(car._id); }}
                              >
                                <span style={styles.menuIcon}><ArchiveIcon /></span>
                                <span>
                                  <span style={styles.menuTitle}>Archive</span>
                                  <span style={styles.menuSub}>Moves it to Archived Cars</span>
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={styles.listFooter}>
              <span style={styles.listCount}>
                Showing <strong style={styles.listCountStrong}>{firstShown}–{lastShown}</strong> of{' '}
                <strong style={styles.listCountStrong}>{filteredCars.length}</strong> {isDraftsView ? 'draft' : 'vehicle'}{filteredCars.length === 1 ? '' : 's'}
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
          <div style={styles.drawerOverlay} onClick={closeEditModal}>
            <div
              style={styles.drawer}
              ref={editModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-car-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={styles.drawerHead}>
                {car.image
                  ? <img src={car.image} alt="" style={styles.drawerThumb} />
                  : <div style={styles.drawerThumbEmpty}>{car.category === 'Motorcycle' ? <MotoIcon /> : <CarIcon />}</div>}
                <div style={{ minWidth: 0 }}>
                  <h3 id="edit-car-modal-title" style={styles.drawerTitle}>Edit {car.brand} {car.model}</h3>
                  <p style={styles.drawerSub}>Changes go live when you save.</p>
                </div>
                <ModalClose onClose={closeEditModal} isDark={isDark} />
              </div>

              {/* Jumps rather than steps: every section is on one scroll,
                  and nothing here has to be filled in before anything else. */}
              <div style={styles.strip}>
                {EDIT_SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    style={styles.stripBtn}
                    onClick={() => document.getElementById(`mc-sec-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div style={styles.drawerBody}>
                <div id="mc-sec-photos" style={styles.section}>
                  <div style={styles.sectionHead}>Vehicle type</div>
                  <div style={styles.typeSeg}>
                    <button type="button" style={styles.typeSegBtn(editVehicleType === 'car')} onClick={() => handleEditVehicleTypeChange('car')}>
                      Car
                    </button>
                    <button type="button" style={styles.typeSegBtn(editVehicleType === 'motorcycle')} onClick={() => handleEditVehicleTypeChange('motorcycle')}>
                      Motorcycle
                    </button>
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionHead}>Photos</div>
                  <div style={styles.photoGrid4}>
                    {editExistingPhotos.map((photo, i) => (
                      <div key={photo.fileId || photo.url || i} style={styles.photoCell(i === 0)}>
                        <img src={photo.url} alt={`Existing ${i + 1}`} style={styles.photoCellImg} />
                        {i === 0 && <span style={styles.coverTag}>Cover</span>}
                        <button type="button" className="icon-toggle-btn" style={styles.removePhotoBtn} onClick={() => removeExistingPhoto(i)} aria-label={`Remove existing photo ${i + 1}`}>×</button>
                      </div>
                    ))}
                    {editNewPhotoPreviews.map((src, i) => (
                      <div key={src} style={styles.photoCell(editExistingPhotos.length === 0 && i === 0)}>
                        <img src={src} alt={`New ${i + 1}`} style={styles.photoCellImg} />
                        {editExistingPhotos.length === 0 && i === 0 && <span style={styles.coverTag}>Cover</span>}
                        <button type="button" className="icon-toggle-btn" style={styles.removePhotoBtn} onClick={() => removeNewPhoto(i)} aria-label={`Remove new photo ${i + 1}`}>×</button>
                      </div>
                    ))}
                    <label htmlFor="mc-edit-photos" style={styles.addTile}>
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
                      Add photos
                      <input
                        id="mc-edit-photos"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditPhotosChange}
                        className="sr-only"
                      />
                    </label>
                  </div>
                  <p style={styles.hint}>The first photo is the cover everywhere in the app.</p>
                </div>

                <div id="mc-sec-basics" style={styles.section}>
                  <div style={styles.sectionHead}>Basics</div>
                  <div style={styles.editGrid}>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-brand">Brand</label>
                    <Autocomplete id="mc-edit-brand" isDark={isDark} value={editForm.brand}
                      onChange={handleEditBrandChange} options={editBrandOptions}
                      placeholder="Start typing — e.g. Toyota" />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-model">Model</label>
                    <Autocomplete id="mc-edit-model" isDark={isDark} value={editForm.model}
                      onChange={handleEditModelChange} options={editModelOptions}
                      placeholder={editForm.brand ? 'Start typing — e.g. Vios' : 'Brand first'}
                      disabled={!String(editForm.brand || '').trim()}
                      emptyHint="Not on our list — it will still be saved exactly as typed." />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-year">Year</label>
                    <input id="mc-edit-year" style={styles.input} type="text" inputMode="numeric" placeholder="e.g. 2022" value={editForm.year}
                      onChange={(e) => setEditForm({...editForm, year: sanitizeDigits(e.target.value, 4)})} />
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
                          {editModelOptions.some((m) => m.toLowerCase() === String(editForm.model || '').trim().toLowerCase())
                            ? "Auto-filled from the model — change it if it's not right."
                            : 'Type a listed model to auto-fill this, or choose manually.'}
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
                    <label style={styles.label} htmlFor="mc-edit-mileage">Mileage (km)</label>
                    <input id="mc-edit-mileage" style={styles.input} type="text" inputMode="numeric" placeholder="e.g. 35000" value={editForm.mileage}
                      onChange={(e) => setEditForm({...editForm, mileage: sanitizeDigits(e.target.value, 7)})} />
                  </div>
                  </div>
                </div>

                <div id="mc-sec-pricing" style={styles.section}>
                  <div style={styles.sectionHead}>Pricing &amp; turnaround</div>
                  <div style={styles.editGrid}>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-price">Daily price (₱)</label>
                    <input id="mc-edit-price" style={styles.input} type="text" inputMode="decimal" placeholder="e.g. 150" value={editForm.pricePerDay}
                      onChange={(e) => setEditForm({...editForm, pricePerDay: sanitizeDecimal(e.target.value, 8)})} />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-turnaround">Turnaround (hours)</label>
                    <input id="mc-edit-turnaround" style={styles.input} type="text" inputMode="numeric" placeholder="Standard is 2"
                      value={editForm.turnaroundHours}
                      onChange={(e) => setEditForm({ ...editForm, turnaroundHours: sanitizeDigits(e.target.value, 2) })} />
                    <span style={styles.fieldHint}>
                      How long this vehicle needs between one client returning it and the next collecting it.
                    </span>
                  </div>
                  </div>
                </div>

                <div id="mc-sec-registration" style={styles.section}>
                  <div style={styles.sectionHead}>Registration &amp; tracking</div>
                  <div style={styles.editGrid}>
                  <div style={styles.field}>
                    <label style={styles.label} htmlFor="mc-edit-plate">Plate number</label>
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
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionHead}>Colour</div>
                  <ColorPicker id="mc-edit-color" isDark={isDark} value={editForm.color}
                    onChange={(color) => setEditForm({...editForm, color})} />
                </div>

                <div id="mc-sec-booking" style={styles.section}>
                  <div style={styles.sectionHead}>Booking types</div>
                  <div role="group" aria-labelledby="mc-edit-booking-types-label" style={styles.tileRow}>
                    <span className="sr-only" id="mc-edit-booking-types-label">Available booking types</span>
                    <label style={styles.tile((editForm.availableBookingTypes || []).includes('self-drive'))}>
                      <input type="checkbox" checked={(editForm.availableBookingTypes || []).includes('self-drive')}
                        onChange={() => toggleEditBookingType('self-drive')} />
                      Self drive
                    </label>
                    <label style={styles.tile((editForm.availableBookingTypes || []).includes('with-driver'))}>
                      <input type="checkbox" checked={(editForm.availableBookingTypes || []).includes('with-driver')}
                        onChange={() => toggleEditBookingType('with-driver')} />
                      With driver
                    </label>
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionHead}>Description</div>
                  <textarea id="mc-edit-description" style={styles.textarea} placeholder="e.g. A luxurious SUV..." value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                </div>
              </div>

              {/* Stays on screen however far down the form somebody is. */}
              <div style={styles.drawerFoot}>
                <button style={styles.drawerCancel} onClick={closeEditModal}>Cancel</button>
                <button style={styles.drawerSave} onClick={() => handleUpdate(car._id)} disabled={updating}>
                  {updating ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {offRoadTarget && (
        <div style={styles.modalOverlay} onClick={() => !offRoadSubmitting && setOffRoadTarget(null)}>
          <div style={styles.offRoadCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="off-road-title">
            <div style={styles.offRoadHead}>
              <span style={styles.offRoadIcon}><WrenchIcon size={20} /></span>
              <div id="off-road-title" style={styles.offRoadTitle}>
                Take {offRoadTarget.brand} {offRoadTarget.model} off the road
              </div>
            </div>
            <p style={styles.offRoadSub}>
              It stops taking bookings from now until you say it is roadworthy again — no end date, because
              nobody knows yet how long it will take.
            </p>
            {/* The two consequences, set apart from the sentence above so
                neither gets skimmed past: one is about people waiting, the
                other about people already driving it. */}
            <ul style={styles.offRoadFacts}>
              <li>Anyone already booked is offered another vehicle on their own dates, or a full refund if nothing suitable is free.</li>
              <li>Clients already out in it are left alone.</li>
            </ul>
            {/* What the affected clients read. Neither says why, so nothing
                about a previous renter reaches anybody. */}
            <div style={styles.offRoadChoices}>
              <label style={styles.offRoadOption(offRoadReason === 'repairs')}>
                <input
                  type="radio"
                  name="off-road-reason"
                  checked={offRoadReason === 'repairs'}
                  onChange={() => setOffRoadReason('repairs')}
                />
                <span>
                  <span style={styles.offRoadOptionTitle}>For repairs</span>
                  <span style={styles.offRoadOptionSub}>Comes back later</span>
                </span>
              </label>
              <label style={styles.offRoadOption(offRoadReason === 'unavailable')}>
                <input
                  type="radio"
                  name="off-road-reason"
                  checked={offRoadReason === 'unavailable'}
                  onChange={() => setOffRoadReason('unavailable')}
                />
                <span>
                  <span style={styles.offRoadOptionTitle}>No longer available</span>
                  <span style={styles.offRoadOptionSub}>Not coming back</span>
                </span>
              </label>
            </div>

            <input
              style={styles.offRoadInput}
              type="text"
              placeholder="What happened? (optional, kept internal)"
              value={offRoadNote}
              onChange={(e) => setOffRoadNote(e.target.value)}
            />

            {/* Named, with the money beside each one. A count would tell you
                nothing you could act on, and this is irreversible for the
                clients in it — putting the car back does not un-refund
                anybody. */}
            {offRoadAffected && (
              <div style={styles.offRoadAffected}>
                <div style={styles.offRoadAffectedTitle}>
                  This affects {offRoadAffected.cancellable.length} booking
                  {offRoadAffected.cancellable.length === 1 ? '' : 's'}
                </div>
                <ul style={styles.offRoadList}>
                  {offRoadAffected.cancellable.map((b) => (
                    <li key={b.id} style={styles.offRoadItem}>
                      <strong>{b.client}</strong> {DASH_CH} {new Date(b.startDate).toLocaleDateString()} to{' '}
                      {new Date(b.endDate).toLocaleDateString()} {DASH_CH}{' '}
                      {b.offerCount > 0
                        ? `offered ${b.offerCount} other vehicle${b.offerCount === 1 ? '' : 's'}, or ₱${b.refund.toLocaleString()} back`
                        : `cancelled and refunded ₱${b.refund.toLocaleString()}`}
                    </li>
                  ))}
                </ul>
                {offRoadAffected.underway?.length > 0 && (
                  <div style={styles.offRoadUnderway}>
                    {offRoadAffected.underway.length} client
                    {offRoadAffected.underway.length === 1 ? ' is' : 's are'} out in this vehicle right now and
                    will not be touched — settle those from Manage Bookings.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                style={styles.offRoadConfirm}
                onClick={() => submitOffRoad(!!offRoadAffected)}
                disabled={offRoadSubmitting}
              >
                {offRoadSubmitting ? 'Working...' : offRoadAffected ? 'Yes, do it anyway' : 'Take it off the road'}
              </button>
              <button style={styles.offRoadBack} onClick={() => setOffRoadTarget(null)} disabled={offRoadSubmitting}>
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

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

      {discountsOpen && (
        <DiscountsPanel
          cars={cars}
          isDark={isDark}
          onClose={() => setDiscountsOpen(false)}
          onCarUpdated={(updated) => setCars((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))}
          ruleCount={ruleCount}
          onRulesChanged={loadRuleCount}
        />
      )}

    </AdminLayout>
  );
};

export default ManageCars;