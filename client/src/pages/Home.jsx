import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Home = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const res = await api.get('/cars');
        setCars(res.data.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, []);

  const handleSearch = () => {
    navigate(`/cars?location=${location}&pickup=${pickupDate}&return=${returnDate}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>Luxury cars on Rent</h1>
        <p style={styles.heroSubtitle}>Find the perfect car for your next adventure</p>

        <div style={styles.searchBox}>
          <div style={styles.searchField}>
            <label style={styles.searchLabel}>Pickup Location</label>
            <select
              style={styles.searchInput}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">Please select location</option>
              <option value="New York">New York</option>
              <option value="Los Angeles">Los Angeles</option>
              <option value="Chicago">Chicago</option>
              <option value="Houston">Houston</option>
            </select>
          </div>
          <div style={styles.searchField}>
            <label style={styles.searchLabel}>Pick-up Date</label>
            <input
              style={styles.searchInput}
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
            />
          </div>
          <div style={styles.searchField}>
            <label style={styles.searchLabel}>Return Date</label>
            <input
              style={styles.searchInput}
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
          <button style={styles.searchBtn} onClick={handleSearch}>
            Search
          </button>
        </div>
      </div>

      {/* Featured Cars */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Featured Vehicles</h2>
        <p style={styles.sectionSubtitle}>
          Explore our selection of premium vehicles available for your next adventure.
        </p>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading cars...</p>
        ) : cars.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280' }}>No cars available yet.</p>
        ) : (
          <div style={styles.grid}>
            {cars.map((car) => (
              <div
                key={car._id}
                style={styles.card}
                onClick={() => navigate(`/cars/${car._id}`)}
              >
                <div style={styles.imgWrap}>
                  {car.image ? (
                    <img src={car.image} alt={car.model} style={styles.img} />
                  ) : (
                    <div style={styles.noImg}>No Image</div>
                  )}
                  <span style={styles.availBadge}>Available Now</span>
                  <span style={styles.priceBadge}>${car.pricePerDay} / day</span>
                </div>
                <div style={styles.cardBody}>
                  <h3 style={styles.carName}>{car.brand} {car.model}</h3>
                  <p style={styles.carSub}>{car.category} · {car.year}</p>
                  <div style={styles.carMeta}>
                    <span>{car.seats} Seats</span>
                    <span>{car.fuelType}</span>
                    <span>{car.transmission}</span>
                    <span>{car.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <button style={styles.viewAllBtn} onClick={() => navigate('/cars')}>
            View All Cars
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  hero: {
    padding: '60px 32px 40px',
    textAlign: 'center',
    background: 'transparent',
    borderBottom: '1px solid #e5e7eb',
  },
  heroTitle: {
    fontSize: '40px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px',
  },
  heroSubtitle: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '32px',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0',
    maxWidth: '700px',
    margin: '0 auto',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  searchField: {
    flex: 1,
    padding: '12px 16px',
    borderRight: '1px solid #e5e7eb',
  },
  searchLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#6b7280',
    marginBottom: '4px',
    fontWeight: '500',
  },
  searchInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: '13px',
    color: '#1a1a1a',
    background: 'transparent',
  },
  searchBtn: {
    padding: '0 28px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    height: '64px',
  },
  section: {
    padding: '48px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: '8px',
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '32px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  imgWrap: {
    position: 'relative',
    height: '160px',
    background: '#f3f4f6',
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
    color: '#9ca3af',
    fontSize: '13px',
  },
  availBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: '#2563eb',
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
  cardBody: {
    padding: '14px 16px',
  },
  carName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '4px',
  },
  carSub: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '10px',
  },
  carMeta: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
    fontSize: '12px',
    color: '#6b7280',
  },
  viewAllBtn: {
    padding: '12px 32px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
};

export default Home;