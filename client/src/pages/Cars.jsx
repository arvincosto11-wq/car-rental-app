import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../api';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';
import FavoriteButton from '../components/FavoriteButton';
import PromoBadge from '../components/PromoBadge';
import PromoConfetti from '../components/PromoConfetti';
import usePageTitle from '../hooks/usePageTitle';
import useFavorites from '../hooks/useFavorites';
import { GOLD, GOLD_DARK } from '../theme';
import { isPromoVisible } from '../utils/promo';

// Small feature-row icons — same hand-drawn inline-SVG approach used
// elsewhere on the site.
const MetaIcon = ({ children, color }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color }}>
    {children}
  </svg>
);
const SeatsIcon = (props) => <MetaIcon {...props}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></MetaIcon>;
const FuelIcon = (props) => <MetaIcon {...props}><path d="M12 21a7 7 0 0 0 5-11.9L12 3 7 9.1A7 7 0 0 0 12 21z" /></MetaIcon>;
const TransmissionIcon = (props) => <MetaIcon {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></MetaIcon>;

// Filter-panel icons. Both sit inside their field rather than beside it, so
// they're positioned absolutely by the caller and never take pointer events.
const SearchIcon = ({ style }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);
const ChevronDownIcon = ({ style }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const Cars = () => {
  usePageTitle('Vehicles');
  const { canFavorite, isFavorite, toggleFavorite } = useFavorites();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [transmission, setTransmission] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const { isDark } = useTheme();
  const { notifications, markReadByLinkPrefix } = useNotifications();
  const navigate = useNavigate();

  // Carried over from the homepage search box (if used) so a picked car's
  // detail page can pre-fill its own date fields, and now also filters this
  // listing itself down to vehicles actually free for that range.
  const pickupDate = searchParams.get('pickup') || '';
  const returnDate = searchParams.get('return') || '';
  const carDetailUrl = (carId) => {
    if (!pickupDate && !returnDate) return `/cars/${carId}`;
    const params = new URLSearchParams();
    if (pickupDate) params.set('pickup', pickupDate);
    if (returnDate) params.set('return', returnDate);
    return `/cars/${carId}?${params.toString()}`;
  };

  const clearDates = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('pickup');
    params.delete('return');
    setSearchParams(params);
  };

  useEffect(() => {
    const fetchCars = async () => {
      setLoading(true);
      try {
        const params = {};
        if (pickupDate && returnDate) {
          params.startDate = pickupDate;
          params.endDate = returnDate;
        }
        const res = await api.get('/cars', { params });
        setCars(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, [pickupDate, returnDate]);

  // Promo notifications link to /cars/<id>, so they badge the Vehicles nav
  // item. Landing here is itself "seeing it" — same reasoning as My Bookings
  // — so the badge clears now instead of staying lit until the client opens
  // the bell and clicks each one.
  useEffect(() => {
    markReadByLinkPrefix('/cars');
  }, [notifications]);

  // Fires once per visit, when the list first lands — not on every filter
  // change. Cards are staggered below so six of them don't go off at once.
  const [cardBurst, setCardBurst] = useState(0);
  useEffect(() => {
    if (!loading) setCardBurst(Date.now());
  }, [loading]);

  const filtered = cars
    .filter((car) => {
      const matchSearch =
        car.brand.toLowerCase().includes(search.toLowerCase()) ||
        car.model.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category ? car.category === category : true;
      const matchTransmission = transmission ? car.transmission === transmission : true;
      const matchMin = minPrice ? car.pricePerDay >= Number(minPrice) : true;
      const matchMax = maxPrice ? car.pricePerDay <= Number(maxPrice) : true;
      const matchAvailable = availableOnly ? car.isAvailable !== false : true;
      return matchSearch && matchCategory && matchTransmission && matchMin && matchMax && matchAvailable;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.pricePerDay - b.pricePerDay;
      if (sortBy === 'price-desc') return b.pricePerDay - a.pricePerDay;
      if (sortBy === 'rating-desc') return (b.avgRating || 0) - (a.avgRating || 0);
      if (sortBy === 'name-asc') return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`);
      // Array.sort is stable, so vehicles within each group keep the order
      // they arrived in rather than being shuffled.
      if (sortBy === 'promo-first') return (isPromoVisible(b.promo) ? 1 : 0) - (isPromoVisible(a.promo) ? 1 : 0);
      return 0;
    });

  const promoOrder = filtered.filter((c) => isPromoVisible(c.promo)).map((c) => c._id);

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '32px',
    },
    title: {
      fontSize: 'clamp(24px, 3.2vw, 32px)', fontWeight: '900', letterSpacing: '-0.01em',
      textTransform: 'uppercase', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px',
    },
    subtitle: { fontSize: '14px', fontStyle: 'italic', color: isDark ? GOLD_DARK : GOLD, marginBottom: '24px' },
    // The filters used to float loose above the grid; collecting them into
    // one panel is what makes the row read as designed rather than assembled.
    toolbelt: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '20px',
      padding: '22px 24px 20px',
      marginBottom: '26px',
    },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 },
    filterLabel: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    // One shared shape for all seven controls, so nothing in the row is a
    // different height from its neighbour. Sizing lives on filterGroup (the
    // grid cell); a flex-basis here would size the input's HEIGHT, not width.
    control: {
      width: '100%',
      height: '44px',
      padding: '0 13px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '10px',
      fontFamily: 'inherit',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#18191a' : '#fff',
      color: isDark ? '#e4e6eb' : '#111827',
      boxSizing: 'border-box',
    },
    searchWrap: { position: 'relative' },
    searchIcon: {
      position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
      color: isDark ? '#8a8d91' : '#9ca3af', pointerEvents: 'none',
    },
    // A native select's arrow can't be styled, so it's hidden and redrawn.
    selectWrap: { position: 'relative' },
    selectArrow: {
      position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
      color: isDark ? '#8a8d91' : '#9ca3af', pointerEvents: 'none',
    },
    // Min and max share one bordered box instead of sitting in two of their
    // own, so the pair reads as a single range control and the two fields
    // get back the width the (now hidden) native spinners were eating.
    priceRangeGroup: {
      display: 'flex',
      alignItems: 'center',
      width: '196px',
      height: '44px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '10px',
      background: isDark ? '#18191a' : '#fff',
      overflow: 'hidden',
    },
    priceRangeInput: {
      width: '100%',
      minWidth: 0,
      height: '100%',
      padding: '0 12px',
      border: 'none',
      background: 'transparent',
      fontFamily: 'inherit',
      fontSize: '14px',
      outline: 'none',
      color: isDark ? '#e4e6eb' : '#111827',
    },
    priceRangeSep: { fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af', flexShrink: 0 },
    bookableRow: {
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    availableToggle: {
      display: 'inline-flex', alignItems: 'center', gap: '10px',
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#4b5563', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    resultsCount: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : GOLD, marginBottom: '14px',
    },
    skeletonCard: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '24px',
      overflow: 'hidden',
    },
    skeletonBody: { padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' },
    grid: {
      gap: '20px',
    },
    card: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '24px',
      overflow: 'hidden',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
    },
    // A lit stage rather than a flat grey box: a soft pool of light over a
    // gradient floor. Photos still cover it, so this mostly shows through
    // for the no-image case and anything with transparency — but it's also
    // what the hover zoom happens inside.
    imgWrap: {
      position: 'relative',
      aspectRatio: '16 / 11',
      overflow: 'hidden',
      display: 'grid',
      placeItems: 'center',
      background: isDark
        ? 'radial-gradient(68% 56% at 50% 60%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 72%), linear-gradient(180deg, #2a2b2f 0%, #101215 100%)'
        : 'radial-gradient(68% 56% at 50% 60%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 72%), linear-gradient(180deg, #f4f5f7 0%, #e3e6ea 100%)',
    },
    img: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    noImg: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: isDark ? '#8a8d91' : '#9ca3af',
      fontSize: '13px',
    },
    // Dark glass base rather than a pastel fill: these sit on top of a
    // photo, and only the text and border carry the status color.
    availBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '5px 11px',
      borderRadius: '999px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    },
    availDot: { width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', flexShrink: 0 },
    // Both badges stack from one anchor instead of carrying their own top
    // offsets — the status badge then sits correctly whether or not there's
    // a promo above it, with no magic numbers to keep in sync.
    badgeStack: {
      position: 'absolute',
      top: '12px',
      left: '12px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '8px',
      zIndex: 2,
    },
    priceBadge: {
      position: 'absolute',
      bottom: '12px',
      right: '12px',
      display: 'flex',
      alignItems: 'baseline',
      gap: '4px',
      background: 'rgba(0,0,0,0.55)',
      border: '1px solid rgba(255,255,255,0.14)',
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      fontSize: '17px',
      fontWeight: '800',
      letterSpacing: '-0.02em',
      // Always the brighter gold, in both themes — this pill sits on a dark
      // glass base, where the light-theme gold is too dark to read.
      color: GOLD_DARK,
      padding: '7px 14px',
      borderRadius: '12px',
    },
    priceBadgeUnit: { fontSize: '11px', fontWeight: '500', color: '#d1d5db' },
    cardBody: { flex: 1, padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' },
    nameRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' },
    carName: {
      fontSize: '17px',
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: '-0.005em',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    carSub: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.02em',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    ratingRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      flexShrink: 0,
    },
    ratingText: {
      fontSize: '13px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      fontWeight: '700',
    },
    ratingCountText: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', fontWeight: '500' },
    // Three across on a single row — seats, fuel and transmission are the
    // three specs every vehicle actually stores, so there's no fourth slot
    // to pad out.
    carMeta: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '10px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    metaItem: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
    // Truncates instead of wrapping, so one long value ("Semi-Automatic")
    // can't push this row to two lines on only some cards.
    metaText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    bookingTypeRow: {
      display: 'grid',
      gap: '8px',
    },
    bookingTypeTag: {
      textAlign: 'center',
      fontSize: '10.5px',
      fontWeight: '700',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#4b5563',
      background: isDark ? '#18191a' : '#f3f4f6',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      padding: '8px 6px',
      borderRadius: '8px',
    },
    // marginTop auto is the real fix here: a vehicle name that wraps to two
    // lines no longer pushes this card's button below its neighbours'.
    viewDetailsBtn: {
      marginTop: 'auto',
      display: 'block', width: '100%', textAlign: 'center',
      padding: '11px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase',
      fontFamily: 'inherit',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '10px', cursor: 'pointer',
      transition: 'background 0.22s ease, color 0.22s ease, border-color 0.22s ease',
    },
    emptyState: {
      border: `1px dashed ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '24px',
      padding: '56px 28px',
      textAlign: 'center',
      color: isDark ? '#8a8d91' : '#9ca3af',
      fontSize: '13px',
    },
    emptyTitle: {
      display: 'block',
      fontSize: '15px',
      fontWeight: '800',
      color: isDark ? '#b0b3b8' : '#4b5563',
      marginBottom: '6px',
    },
    dateNotice: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      fontSize: '13px',
      color: isDark ? '#b0b3b8' : '#6b7280',
      marginBottom: '16px',
      background: isDark ? '#242526' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '8px',
      padding: '10px 14px',
    },
    clearDatesBtn: {
      background: 'none',
      border: 'none',
      color: isDark ? GOLD_DARK : GOLD,
      fontSize: '12px',
      fontWeight: '700',
      cursor: 'pointer',
      flexShrink: 0,
    },
  };

  // Hides the native dropdown arrow so the drawn one can take its place,
  // and leaves room on the right for it.
  const selectStyle = {
    ...styles.control,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    paddingRight: '36px',
    cursor: 'pointer',
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>All Cars</h1>
      <p style={styles.subtitle}>Browse our full fleet of well-maintained, ready-to-book vehicles.</p>

      {(pickupDate || returnDate) && (
        <div className="row-stack-sm" style={styles.dateNotice}>
          <span>
            📅 Showing vehicles available {pickupDate || '—'} to {returnDate || '—'} — pick one and these dates carry over to its booking form.
          </span>
          <button type="button" style={styles.clearDatesBtn} onClick={clearDates}>Clear dates</button>
        </div>
      )}

      <div style={styles.toolbelt}>
        <div className="filter-grid">
          <div className="filter-search" style={styles.filterGroup}>
            <label style={styles.filterLabel} htmlFor="cars-search">Search</label>
            <div style={styles.searchWrap}>
              <SearchIcon style={styles.searchIcon} />
              <input
                id="cars-search"
                className="filter-control"
                style={{ ...styles.control, paddingLeft: '40px' }}
                type="text"
                placeholder="Search by brand or model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel} htmlFor="cars-category">Category</label>
            <div style={styles.selectWrap}>
              <select
                id="cars-category"
                className="filter-control"
                style={selectStyle}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Van">Van</option>
                <option value="Truck">Truck</option>
                <option value="Coupe">Coupe</option>
                <option value="Motorcycle">Motorcycle</option>
              </select>
              <ChevronDownIcon style={styles.selectArrow} />
            </div>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel} htmlFor="cars-transmission">Transmission</label>
            <div style={styles.selectWrap}>
              <select
                id="cars-transmission"
                className="filter-control"
                style={selectStyle}
                value={transmission}
                onChange={(e) => setTransmission(e.target.value)}
              >
                <option value="">All Transmissions</option>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
                <option value="Semi-Automatic">Semi-Automatic</option>
              </select>
              <ChevronDownIcon style={styles.selectArrow} />
            </div>
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel} id="cars-price-label">Price Range</span>
            <div className="filter-range" style={styles.priceRangeGroup} role="group" aria-labelledby="cars-price-label">
              <input
                className="no-spinner"
                style={styles.priceRangeInput}
                type="number"
                placeholder="Min ₱"
                aria-label="Minimum price"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
              />
              <span style={styles.priceRangeSep}>–</span>
              <input
                className="no-spinner"
                style={styles.priceRangeInput}
                type="number"
                placeholder="Max ₱"
                aria-label="Maximum price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
              />
            </div>
          </div>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel} htmlFor="cars-sort">Sort By</label>
            <div style={styles.selectWrap}>
              <select
                id="cars-sort"
                className="filter-control"
                style={selectStyle}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating-desc">Highest Rated</option>
                <option value="name-asc">Name: A to Z</option>
                <option value="promo-first">On Promo First</option>
              </select>
              <ChevronDownIcon style={styles.selectArrow} />
            </div>
          </div>
        </div>
        <div style={styles.bookableRow}>
          <label style={styles.availableToggle}>
            <input
              type="checkbox"
              className="gold-check"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            Bookable only
          </label>
        </div>
      </div>

      {loading ? (
        <div className="responsive-grid-3" style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={styles.skeletonCard}>
              <Skeleton height="190px" radius="0" isDark={isDark} />
              <div style={styles.skeletonBody}>
                <Skeleton height="18px" width="70%" isDark={isDark} />
                <Skeleton height="13px" width="45%" isDark={isDark} />
                <Skeleton height="13px" width="90%" isDark={isDark} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <strong style={styles.emptyTitle}>No cars found</strong>
          Widen the price range or clear a filter to see more of the fleet.
        </div>
      ) : (
        <>
        {/* Stagger is by position among PROMO cards, not among all cards —
            otherwise a single promo card sitting sixth would sit there doing
            nothing for most of a second. */}
        <p style={styles.resultsCount}>{filtered.length} vehicle{filtered.length === 1 ? '' : 's'} found</p>
        <div className="responsive-grid-3" style={styles.grid}>
          {filtered.map((car) => (
            <div
              key={car._id}
              className="car-card-hover"
              style={isPromoVisible(car.promo)
                ? { ...styles.card, border: `1px solid ${isDark ? 'rgba(232,161,0,0.55)' : 'rgba(184,121,10,0.55)'}`, boxShadow: `0 0 0 1px ${isDark ? 'rgba(232,161,0,0.18)' : 'rgba(184,121,10,0.14)'}` }
                : styles.card}
              onClick={() => navigate(carDetailUrl(car._id))}
              role="link"
              tabIndex={0}
              aria-label={`View ${car.brand} ${car.model} details`}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(carDetailUrl(car._id)); }}
            >
              <div style={styles.imgWrap}>
                {car.image ? (
                  <img src={car.image} alt={car.model} className="car-stage-img" style={styles.img} />
                ) : (
                  <div style={styles.noImg}>No Image</div>
                )}
                <PromoConfetti
                  fireKey={isPromoVisible(car.promo) ? cardBurst : 0}
                  isDark={isDark}
                  mode="burst"
                  delayMs={Math.max(0, promoOrder.indexOf(car._id)) * 160}
                />
                <div style={styles.badgeStack}>
                  {/* Promo leads the stack: the deal is what we want seen
                      first, the availability status is the supporting fact. */}
                  <PromoBadge promo={car.promo} isDark={isDark} />
                  <span style={{
                    ...styles.availBadge,
                    background: 'rgba(0,0,0,0.65)',
                    color: car.isAvailable === false ? '#fca5a5' : '#86efac',
                    border: `1px solid ${car.isAvailable === false ? 'rgba(248,113,113,0.4)' : 'rgba(134,239,172,0.4)'}`,
                  }}>
                    <span style={styles.availDot} />
                    {car.isAvailable === false ? 'Not Listed' : 'Bookable'}
                  </span>
                </div>
                <FavoriteButton
                  carId={car._id}
                  canFavorite={canFavorite}
                  isFavorite={isFavorite(car._id)}
                  onToggle={toggleFavorite}
                  style={{ position: 'absolute', top: '10px', right: '10px' }}
                />
                <span style={styles.priceBadge}>₱{car.pricePerDay}<span style={styles.priceBadgeUnit}> / day</span></span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.nameRow}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={styles.carName}>{car.brand} {car.model}</h3>
                    <p style={styles.carSub}>{car.category} · {car.year}</p>
                  </div>
                  {car.ratingCount > 0 ? (
                    <div style={styles.ratingRow}>
                      <StarRating value={car.avgRating} size={13} readOnly />
                      <span style={styles.ratingText}>{car.avgRating.toFixed(1)}</span>
                      <span style={styles.ratingCountText}>({car.ratingCount})</span>
                    </div>
                  ) : (
                    <span style={{ ...styles.ratingCountText, flexShrink: 0, whiteSpace: 'nowrap' }}>No reviews yet</span>
                  )}
                </div>
                <div style={styles.carMeta}>
                  <span style={styles.metaItem}>
                    <SeatsIcon color={isDark ? GOLD_DARK : GOLD} />
                    <span style={styles.metaText}>{car.seats} Seats</span>
                  </span>
                  <span style={styles.metaItem}>
                    <FuelIcon color={isDark ? GOLD_DARK : GOLD} />
                    <span style={styles.metaText}>{car.fuelType}</span>
                  </span>
                  <span style={styles.metaItem}>
                    <TransmissionIcon color={isDark ? GOLD_DARK : GOLD} />
                    <span style={styles.metaText}>{car.transmission}</span>
                  </span>
                </div>
                {(() => {
                  const modes = car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver'];
                  return (
                    <div style={{ ...styles.bookingTypeRow, gridTemplateColumns: `repeat(${modes.length}, minmax(0, 1fr))` }}>
                      {modes.map((t) => (
                        <span key={t} style={styles.bookingTypeTag}>
                          {t === 'self-drive' ? 'Self Drive' : 'With Driver'}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                <button
                  type="button"
                  className="car-view-details"
                  style={styles.viewDetailsBtn}
                  onClick={(e) => { e.stopPropagation(); navigate(carDetailUrl(car._id)); }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
};

export default Cars;
