import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StarRating from '../components/StarRating';
import Skeleton from '../components/Skeleton';
import FavoriteButton from '../components/FavoriteButton';
import usePageTitle from '../hooks/usePageTitle';
import useFavorites from '../hooks/useFavorites';
import api from '../api';

const MyFavorites = () => {
  usePageTitle('My Favorites');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { canFavorite, isFavorite, toggleFavorite } = useFavorites();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = async () => {
    try {
      const res = await api.get('/users/favorites');
      setCars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFavorites(); }, []);

  // Once useFavorites finishes its own fetch, isFavorite(car._id) may go
  // false for a car removed elsewhere (e.g. another tab) — drop it locally
  // rather than waiting for a full refetch.
  const visibleCars = cars.filter((car) => isFavorite(car._id));

  const styles = {
    container: { maxWidth: '1200px', margin: '0 auto', padding: '32px' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    browseBtn: {
      marginTop: '16px', padding: '10px 24px', background: isDark ? '#e8a100' : '#b8790a', color: '#17130e',
      border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
    },
    grid: { gap: '20px' },
    skeletonCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', overflow: 'hidden' },
    skeletonBody: { padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' },
    card: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' },
    imgWrap: { position: 'relative', height: '160px', background: isDark ? '#334155' : '#f3f4f6' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    noImg: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDark ? '#64748b' : '#9ca3af', fontSize: '13px' },
    availBadge: { position: 'absolute', top: '10px', left: '10px', background: '#16a34a', color: '#fff', fontSize: '11px', padding: '3px 10px', borderRadius: '20px' },
    priceBadge: { position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '12px', padding: '3px 10px', borderRadius: '6px' },
    cardBody: { padding: '14px 16px' },
    carName: { fontSize: '16px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    carSub: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '10px' },
    ratingRow: { display: 'flex', alignItems: 'center', gap: '6px' },
    ratingText: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', fontWeight: '500' },
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>My Favorites</h1>
      <p style={styles.subtitle}>Vehicles you've saved for later.</p>

      {loading ? (
        <div className="responsive-grid-3" style={styles.grid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={styles.skeletonCard}>
              <Skeleton height="160px" radius="0" isDark={isDark} />
              <div style={styles.skeletonBody}>
                <Skeleton height="18px" width="70%" isDark={isDark} />
                <Skeleton height="13px" width="45%" isDark={isDark} />
              </div>
            </div>
          ))}
        </div>
      ) : visibleCars.length === 0 ? (
        <div style={styles.empty}>
          <p>No favorites yet — tap the heart on any vehicle to save it here.</p>
          <button style={styles.browseBtn} onClick={() => navigate('/cars')}>Browse Vehicles</button>
        </div>
      ) : (
        <div className="responsive-grid-3" style={styles.grid}>
          {visibleCars.map((car) => (
            <div
              key={car._id}
              className="car-card-hover"
              style={styles.card}
              onClick={() => navigate(`/cars/${car._id}`)}
              role="link"
              tabIndex={0}
              aria-label={`View ${car.brand} ${car.model} details`}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/cars/${car._id}`); }}
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
                <FavoriteButton
                  carId={car._id}
                  canFavorite={canFavorite}
                  isFavorite={isFavorite(car._id)}
                  onToggle={toggleFavorite}
                  style={{ position: 'absolute', top: '10px', right: '10px' }}
                />
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyFavorites;
