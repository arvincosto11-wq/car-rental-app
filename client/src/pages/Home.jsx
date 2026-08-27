import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import StarRating from '../components/StarRating';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import api from '../api';

const Home = () => {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const navigate = useNavigate();
  const { isDark } = useTheme();

  useEffect(() => {
    const fetchCars = async () => {
      try {
        const res = await api.get('/cars');
        const sorted = [...res.data].sort((a, b) => (b.isAvailable === false ? 0 : 1) - (a.isAvailable === false ? 0 : 1));
        setCars(sorted.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCars();
  }, []);

  const handleSearch = () => {
    navigate(`/cars?pickup=${pickupDate}&return=${returnDate}`);
  };

  const styles = {
    hero: {
      padding: '60px 32px 40px',
      textAlign: 'center',
      background: 'transparent',
      borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    },
    heroTitle: {
      fontSize: '46px',
      fontWeight: '700',
      color: isDark ? '#f0464a' : '#d81e22',
      marginBottom: '8px',
    },
    heroSubtitle: {
      fontSize: '16px',
      color: isDark ? '#94a3b8' : '#6b7280',
      marginBottom: '32px',
    },
    searchBox: {
      gap: '0',
      maxWidth: '700px',
      margin: '0 auto',
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px',
      overflow: 'hidden',
    },
    searchField: {
      flex: 1,
      padding: '12px 16px',
      borderRight: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    },
    searchLabel: {
      display: 'block',
      fontSize: '11px',
      color: isDark ? '#94a3b8' : '#6b7280',
      marginBottom: '4px',
      fontWeight: '500',
    },
    searchInput: {
      width: '100%',
      border: 'none',
      outline: 'none',
      fontSize: '13px',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      background: 'transparent',
    },
    searchBtn: {
      padding: '0 28px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
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
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      textAlign: 'center',
      marginBottom: '8px',
    },
    sectionSubtitle: {
      fontSize: '14px',
      color: isDark ? '#94a3b8' : '#6b7280',
      textAlign: 'center',
      marginBottom: '32px',
    },
    grid: {
      gap: '20px',
    },
    card: {
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'transform 0.2s',
    },
    imgWrap: {
      position: 'relative',
      height: '160px',
      background: isDark ? '#334155' : '#f3f4f6',
    },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
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
    viewAllBtn: {
      padding: '12px 32px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
    },
    aboutSection: {
      background: isDark ? '#1e293b' : '#f9fafb',
      borderTop: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
    },
    aboutText: {
      maxWidth: '700px',
      margin: '0 auto 36px',
      textAlign: 'center',
      fontSize: '15px',
      lineHeight: '1.7',
      color: isDark ? '#cbd5e1' : '#4b5563',
    },
    featureGrid: {
      gap: '24px',
    },
    featureCard: { textAlign: 'center' },
    featureIcon: {
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      margin: '0 auto 14px',
    },
    featureTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginBottom: '4px',
    },
    featureText: {
      fontSize: '12.5px',
      color: isDark ? '#94a3b8' : '#6b7280',
      lineHeight: '1.5',
    },
    contactSection: {
      background: isDark ? '#0f172a' : '#17130e',
      padding: '48px 32px',
      color: '#f2eee6',
    },
    contactInner: {
      maxWidth: '1000px',
      margin: '0 auto',
      gap: '40px',
      alignItems: 'start',
    },
    contactTagline: {
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.03em',
      color: isDark ? GOLD_DARK : '#e8a100',
      marginBottom: '6px',
    },
    contactTitle: {
      fontSize: '26px',
      fontWeight: '700',
      marginBottom: '10px',
      color: '#f2eee6',
    },
    contactSub: {
      fontSize: '14px',
      color: '#a79e8d',
      lineHeight: '1.6',
      maxWidth: '46ch',
    },
    contactList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' },
    contactRow: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' },
    contactIcon: {
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: 'rgba(232,161,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '16px',
      flexShrink: 0,
    },
    socialRow: { display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' },
    socialTag: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#f2eee6',
      background: 'rgba(255,255,255,0.08)',
      padding: '6px 14px',
      borderRadius: '20px',
    },
    socialLink: {
      fontSize: '12px',
      fontWeight: '600',
      color: '#f2eee6',
      background: 'rgba(255,255,255,0.08)',
      padding: '6px 14px',
      borderRadius: '20px',
      textDecoration: 'none',
      cursor: 'pointer',
    },
    hashtagBadge: {
      display: 'inline-block',
      marginTop: '24px',
      background: isDark ? GOLD_DARK : '#e8a100',
      color: '#17130e',
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '0.02em',
      padding: '6px 16px',
      borderRadius: '20px',
    },
  };

  return (
    <div>
      {/* Hero Section */}
      <div style={styles.hero}>
        <h1 className="display-heading" style={styles.heroTitle}>Explore Without Limits</h1>
        <p style={styles.heroSubtitle}>Well-maintained rides across Albay — book in minutes.</p>

        <div className="hero-search-box" style={styles.searchBox}>
          <div className="hero-search-field" style={styles.searchField}>
            <label style={styles.searchLabel}>Pick-up Date</label>
            <input
              style={styles.searchInput}
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
            />
          </div>
          <div className="hero-search-field" style={styles.searchField}>
            <label style={styles.searchLabel}>Return Date</label>
            <input
              style={styles.searchInput}
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>
          <button className="hero-search-btn" style={styles.searchBtn} onClick={handleSearch}>
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
          <p style={{ textAlign: 'center', color: isDark ? '#94a3b8' : '#6b7280' }}>Loading cars...</p>
        ) : cars.length === 0 ? (
          <p style={{ textAlign: 'center', color: isDark ? '#94a3b8' : '#6b7280' }}>No cars available yet.</p>
        ) : (
          <div className="responsive-grid-3" style={styles.grid}>
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

      {/* About */}
      <div style={{ ...styles.section, ...styles.aboutSection }}>
        <h2 style={styles.sectionTitle}>About Rent-A-Ride Albay</h2>
        <p style={styles.aboutText}>
          Serving Camalig and the greater Albay area since 2018, Rent-A-Ride Albay has helped
          travelers and locals alike explore the region in well-maintained, affordable vehicles —
          with a team that treats every trip like it's our own. Your journey. Our commitment.
        </p>

        <div className="responsive-grid-4" style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🚗</div>
            <div style={styles.featureTitle}>Well-Maintained Units</div>
            <div style={styles.featureText}>Clean, safe, and road-ready.</div>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>💰</div>
            <div style={styles.featureTitle}>Affordable Rates</div>
            <div style={styles.featureText}>Quality service that fits your budget.</div>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📍</div>
            <div style={styles.featureTitle}>Flexible Pick-up &amp; Return</div>
            <div style={styles.featureText}>Convenient locations, hassle-free.</div>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🎧</div>
            <div style={styles.featureTitle}>Friendly Customer Support</div>
            <div style={styles.featureText}>We're here to help, every step of the way.</div>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={styles.contactSection}>
        <div className="responsive-row-2" style={styles.contactInner}>
          <div>
            <div style={styles.contactTagline}>#DRIVEBEYONDLIMITS</div>
            <h2 className="display-heading" style={styles.contactTitle}>Get In Touch</h2>
            <p style={styles.contactSub}>
              Have a question about a booking or want to reserve over the phone?
              Reach out — we're here to help.
            </p>
            <div style={styles.hashtagBadge}>Your Journey. Our Commitment.</div>
          </div>
          <div>
            <ul style={styles.contactList}>
              <li style={styles.contactRow}>
                <span style={styles.contactIcon}>📞</span>
                <span>0950-651-0479</span>
              </li>
              <li style={styles.contactRow}>
                <span style={styles.contactIcon}>📍</span>
                <span>Salugan, Camalig, Albay</span>
              </li>
              <li style={styles.contactRow}>
                <span style={styles.contactIcon}>🕒</span>
                <span>24/7 Customer Support</span>
              </li>
            </ul>
            <div style={styles.socialRow}>
              <a
                href="https://www.facebook.com/rentaridealbaybranch"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.socialLink}
              >
                Facebook: Rent-A-Ride Albay
              </a>
              <span style={styles.socialTag}>@rentaridealbay</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;