import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Cars = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
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

  const filtered = cars.filter((car) => {
    const matchSearch =
      car.brand.toLowerCase().includes(search.toLowerCase()) ||
      car.model.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category ? car.category === category : true;
    return matchSearch && matchCategory;
  });

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
        </select>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#6b7280' }}>No cars found.</p>
      ) : (
        <div style={styles.grid}>
          {filtered.map((car) => (
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
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '24px',
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
  },
  select: {
    padding: '10px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
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
  cardBody: { padding: '14px 16px' },
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
};

export default Cars;