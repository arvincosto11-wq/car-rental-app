import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';

const Cars = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [transmission, setTransmission] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState('');
  const { isDark } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
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
    fetchCars();
  }, []);

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
      fontSize: '28px',
      fontWeight: '700',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginBottom: '24px',
    },
    filters: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      marginBottom: '24px',
    },
    searchInput: {
      flex: '1 1 200px',
      padding: '10px 14px',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#1e293b' : '#fff',
      color: isDark ? '#f1f5f9' : '#111827',
    },
    select: {
      padding: '10px 14px',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#1e293b' : '#fff',
      color: isDark ? '#f1f5f9' : '#111827',
    },
    priceInput: {
      width: '90px',
      padding: '10px 12px',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px',
      fontSize: '14px',
      outline: 'none',
      background: isDark ? '#1e293b' : '#fff',
      color: isDark ? '#f1f5f9' : '#111827',
    },
    priceRangeGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
    priceRangeSep: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' },
    availableToggle: {
      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
      color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    resultsCount: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px' },
    skeletonCard: {
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px',
      overflow: 'hidden',
    },
    skeletonBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    grid: {
      gap: '20px',
    },
    card: {
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
    },
    imgWrap: {
      position: 'relative',
      height: '160px',
      background: isDark ? '#334155' : '#f3f4f6',
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
      color: isDark ? '#64748b' : '#9ca3af',
      fontSize: '13px',
    },
    availBadge: {
      position: 'absolute',
      top: '10px',
      left: '10px',
      background: '#16a34a',
      color: '#fff',
      fontSize: '11px',
      padding: '3px 10px',
      borderRadius: '20px',
    },
    priceBadge: {
      position: 'absolute',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.6)',
      color: '#fff',
      fontSize: '12px',
      padding: '3px 10px',
      borderRadius: '6px',
    },
    cardBody: { padding: '14px 16px' },
    carName: {
      fontSize: '16px',
      fontWeight: '600',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginBottom: '4px',
    },
    carSub: {
      fontSize: '13px',
      color: isDark ? '#94a3b8' : '#6b7280',
      marginBottom: '10px',
    },
    ratingRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '8px',
    },
    ratingText: {
      fontSize: '12px',
      color: isDark ? '#94a3b8' : '#6b7280',
      fontWeight: '500',
    },
    carMeta: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4px',
      fontSize: '12px',
      color: isDark ? '#94a3b8' : '#6b7280',
    },
    bookingTypeRow: {
      display: 'flex',
      gap: '6px',
      marginTop: '10px',
      flexWrap: 'wrap',
    },
    bookingTypeTag: {
      fontSize: '11px',
      color: isDark ? '#f1f5f9' : '#374151',
      background: isDark ? '#334155' : '#f3f4f6',
      padding: '3px 9px',
      borderRadius: '20px',
    },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>All Cars</h1>

      <div style={styles.filters}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Search by brand or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
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
        <select
          style={styles.select}
          value={transmission}
          onChange={(e) => setTransmission(e.target.value)}
        >
          <option value="">All Transmissions</option>
          <option value="Automatic">Automatic</option>
          <option value="Manual">Manual</option>
          <option value="Semi-Automatic">Semi-Automatic</option>
        </select>
        <div style={styles.priceRangeGroup}>
          <input
            style={styles.priceInput}
            type="number"
            placeholder="Min ₱"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            min="0"
          />
          <span style={styles.priceRangeSep}>–</span>
          <input
            style={styles.priceInput}
            type="number"
            placeholder="Max ₱"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            min="0"
          />
        </div>
        <select
          style={styles.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="">Sort By</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="rating-desc">Highest Rated</option>
          <option value="name-asc">Name: A to Z</option>
        </select>
        <label style={styles.availableToggle}>
          <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
          Available only
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
        <p style={{ textAlign: 'center', color: isDark ? '#94a3b8' : '#6b7280' }}>No cars found.</p>
      ) : (
        <>
        <p style={styles.resultsCount}>{filtered.length} vehicle{filtered.length === 1 ? '' : 's'} found</p>
        <div className="responsive-grid-3" style={styles.grid}>
          {filtered.map((car) => (
            <div
              key={car._id}
              className="car-card-hover"
              style={styles.card}
              onClick={() => navigate(`/cars/${car._id}`)}
            >
              <div style={styles.imgWrap}>
                {car.image ? (
                  <img src={car.image} alt={car.model} style={styles.img} />
                ) : (
                  <div style={styles.noImg}>No Image</div>
                )}
                <span style={{ ...styles.availBadge, background: car.isAvailable === false ? '#dc2626' : '#16a34a' }}>
                  {car.isAvailable === false ? 'Not Available' : 'Available Now'}
                </span>
                <span style={styles.priceBadge}>₱{car.pricePerDay} / day</span>
              </div>
              <div style={styles.cardBody}>
                <h3 style={styles.carName}>{car.brand} {car.model}</h3>
                <p style={styles.carSub}>{car.category} · {car.year}</p>
                {car.ratingCount > 0 ? (
                  <div style={styles.ratingRow}>
                    <StarRating value={car.avgRating} size={13} readOnly />
                    <span style={styles.ratingText}>{car.avgRating.toFixed(1)} ({car.ratingCount})</span>
                  </div>
                ) : (
                  <div style={styles.ratingRow}>
                    <span style={styles.ratingText}>No reviews yet</span>
                  </div>
                )}
                <div style={styles.carMeta}>
                  <span>{car.seats} Seats</span>
                  <span>{car.fuelType}</span>
                  <span>{car.transmission}</span>
                </div>
                <div style={styles.bookingTypeRow}>
                  {(car.availableBookingTypes?.length ? car.availableBookingTypes : ['self-drive', 'with-driver']).map((t) => (
                    <span key={t} style={styles.bookingTypeTag}>
                      {t === 'self-drive' ? '🧍 Self Drive' : '🚘 With Driver'}
                    </span>
                  ))}
                </div>
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
