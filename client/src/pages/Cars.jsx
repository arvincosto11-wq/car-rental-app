import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';
import FavoriteButton from '../components/FavoriteButton';
import usePageTitle from '../hooks/usePageTitle';
import useFavorites from '../hooks/useFavorites';
import { GOLD, GOLD_DARK } from '../theme';

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
      return 0;
    });

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
    filters: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '14px',
      alignItems: 'flex-end',
      marginBottom: '24px',
    },
    filterGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    filterLabel: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    // No `flex` shorthand here — this now lives inside a column-direction
    // wrapper (filterGroup, with the label above it) rather than being a
    // direct child of the horizontal .filters row, so a flex-basis here
    // would size its HEIGHT, not its width (that's what blew this input
    // up into a tall box — the growing/shrinking behavior belongs on the
    // wrapper div, which already gets it inline where it's rendered).
    searchInput: {
      width: '100%',
      padding: '10px 14px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#242526' : '#fff',
      color: isDark ? '#e4e6eb' : '#111827',
      boxSizing: 'border-box',
    },
    select: {
      padding: '10px 14px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#242526' : '#fff',
      color: isDark ? '#e4e6eb' : '#111827',
    },
    priceInput: {
      width: '90px',
      padding: '10px 12px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#242526' : '#fff',
      color: isDark ? '#e4e6eb' : '#111827',
    },
    priceRangeGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
    priceRangeSep: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280' },
    availableToggle: {
      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
      color: isDark ? '#e4e6eb' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    resultsCount: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? GOLD_DARK : GOLD, marginBottom: '14px',
    },
    skeletonCard: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px',
      overflow: 'hidden',
    },
    skeletonBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    grid: {
      gap: '20px',
    },
    card: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '14px',
      overflow: 'hidden',
      cursor: 'pointer',
    },
    imgWrap: {
      position: 'relative',
      height: '190px',
      background: isDark ? '#3a3b3c' : '#f3f4f6',
    },
    img: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    noImg: {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: isDark ? '#8a8d91' : '#9ca3af',
      fontSize: '13px',
    },
    availBadge: {
      position: 'absolute',
      top: '10px',
      left: '10px',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '4px 11px',
      borderRadius: '20px',
    },
    priceBadge: {
      position: 'absolute',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.72)',
      fontSize: '15px',
      fontWeight: '800',
      color: isDark ? GOLD_DARK : GOLD,
      padding: '5px 12px',
      borderRadius: '8px',
    },
    priceBadgeUnit: { fontSize: '11px', fontWeight: '500', color: '#d1d5db' },
    cardBody: { padding: '16px' },
    nameRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '2px' },
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
      marginBottom: '14px',
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
    carMeta: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px 14px',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#4b5563',
      marginBottom: '14px',
    },
    metaItem: { display: 'flex', alignItems: 'center', gap: '7px' },
    bookingTypeRow: {
      display: 'flex',
      gap: '8px',
      marginBottom: '10px',
    },
    bookingTypeTag: {
      flex: 1,
      textAlign: 'center',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#4b5563',
      background: isDark ? '#18191a' : '#f3f4f6',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      padding: '8px 9px',
      borderRadius: '8px',
    },
    viewDetailsBtn: {
      display: 'block', width: '100%', textAlign: 'center',
      padding: '11px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      borderRadius: '8px', cursor: 'pointer',
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

      <div style={styles.filters}>
        <div style={{ ...styles.filterGroup, flex: '1 1 200px' }}>
          <label style={styles.filterLabel} htmlFor="cars-search">Search</label>
          <input
            id="cars-search"
            style={styles.searchInput}
            type="text"
            placeholder="Search by brand or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="cars-category">Category</label>
          <select
            id="cars-category"
            style={styles.select}
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
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel} htmlFor="cars-transmission">Transmission</label>
          <select
            id="cars-transmission"
            style={styles.select}
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
          >
            <option value="">All Transmissions</option>
            <option value="Automatic">Automatic</option>
            <option value="Manual">Manual</option>
            <option value="Semi-Automatic">Semi-Automatic</option>
          </select>
        </div>
        <div style={styles.filterGroup}>
          <span style={styles.filterLabel}>Price Range</span>
          <div style={styles.priceRangeGroup} role="group" aria-label="Price range">
            <input
              style={styles.priceInput}
              type="number"
              placeholder="Min ₱"
              aria-label="Minimum price"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              min="0"
            />
            <span style={styles.priceRangeSep}>–</span>
            <input
              style={styles.priceInput}
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
          <select
            id="cars-sort"
            style={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating-desc">Highest Rated</option>
            <option value="name-asc">Name: A to Z</option>
          </select>
        </div>
        <label style={styles.availableToggle}>
          <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
          Bookable only
        </label>
      </div>

      {loading ? (
        <div className="responsive-grid-3" style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={styles.skeletonCard}>
              <Skeleton height="160px" radius="0" isDark={isDark} />
              <div style={styles.skeletonBody}>
                <Skeleton height="18px" width="70%" isDark={isDark} />
                <Skeleton height="13px" width="45%" isDark={isDark} />
                <Skeleton height="13px" width="90%" isDark={isDark} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280' }}>No cars found.</p>
      ) : (
        <>
        <p style={styles.resultsCount}>{filtered.length} vehicle{filtered.length === 1 ? '' : 's'} found</p>
        <div className="responsive-grid-3" style={styles.grid}>
          {filtered.map((car) => (
            <div
              key={car._id}
              className="car-card-hover"
              style={styles.card}
              onClick={() => navigate(carDetailUrl(car._id))}
              role="link"
              tabIndex={0}
              aria-label={`View ${car.brand} ${car.model} details`}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(carDetailUrl(car._id)); }}
            >
              <div style={styles.imgWrap}>
                {car.image ? (
                  <img src={car.image} alt={car.model} style={styles.img} />
                ) : (
                  <div style={styles.noImg}>No Image</div>
                )}
                <span style={{
                  ...styles.availBadge,
                  background: 'rgba(0,0,0,0.65)',
                  color: car.isAvailable === false ? '#fca5a5' : '#86efac',
                  border: `1px solid ${car.isAvailable === false ? 'rgba(248,113,113,0.4)' : 'rgba(134,239,172,0.4)'}`,
                }}>
                  {car.isAvailable === false ? 'Not Listed' : 'Bookable'}
                </span>
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
                  <h3 style={styles.carName}>{car.brand} {car.model}</h3>
                  {car.ratingCount > 0 ? (
                    <div style={styles.ratingRow}>
                      <StarRating value={car.avgRating} size={13} readOnly />
                      <span style={styles.ratingText}>{car.avgRating.toFixed(1)}</span>
                      <span style={styles.ratingCountText}>({car.ratingCount})</span>
                    </div>
                  ) : (
                    <span style={styles.ratingCountText}>No reviews yet</span>
                  )}
                </div>
                <p style={styles.carSub}>{car.category} · {car.year}</p>
                <div style={styles.carMeta}>
                  <span style={styles.metaItem}><SeatsIcon color={isDark ? GOLD_DARK : GOLD} /> {car.seats} Seats</span>
                  <span style={styles.metaItem}><FuelIcon color={isDark ? GOLD_DARK : GOLD} /> {car.fuelType}</span>
                  <span style={styles.metaItem}><TransmissionIcon color={isDark ? GOLD_DARK : GOLD} /> {car.transmission}</span>
                </div>
                <div style={styles.bookingTypeRow}>
                  {(car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver']).map((t) => (
                    <span key={t} style={styles.bookingTypeTag}>
                      {t === 'self-drive' ? 'Self Drive' : 'With Driver'}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
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
