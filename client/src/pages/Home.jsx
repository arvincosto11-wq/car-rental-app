import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import StarRating from '../components/StarRating';
import StackedCarCarousel from '../components/StackedCarCarousel';
import Footer from '../components/Footer';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import usePageTitle from '../hooks/usePageTitle';
import api from '../api';

const CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Van', 'Truck', 'Coupe', 'Motorcycle'];

// Hand-drawn inline SVGs, matching the same approach used for the admin
// sidebar icons — a small icon library isn't worth pulling in for three
// glyphs.
// color is optional — when unset the icon inherits the label's own text
// color; passed explicitly wherever the icon should stand out on its own
// (e.g. the gold accent color) independent of the label text next to it.
const FieldIcon = ({ children, color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color }}>
    {children}
  </svg>
);
const CalendarIcon = ({ color }) => <FieldIcon color={color}><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></FieldIcon>;
const CarIcon = ({ color }) => <FieldIcon color={color}><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></FieldIcon>;
const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: 'none' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const Home = () => {
  const [testimonials, setTestimonials] = useState([]);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  usePageTitle();

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const res = await api.get('/cars/reviews/featured');
        setTestimonials(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTestimonials();
  }, []);

  const handleSearch = () => {
    const today = new Date().toISOString().split('T')[0];
    if (pickupDate && pickupDate < today) {
      toast.error('Pick-up date cannot be in the past.');
      return;
    }
    if (pickupDate && returnDate && returnDate < pickupDate) {
      toast.error('Return date must be on or after the pick-up date.');
      return;
    }
    const params = new URLSearchParams();
    if (pickupDate) params.set('pickup', pickupDate);
    if (returnDate) params.set('return', returnDate);
    if (searchCategory) params.set('category', searchCategory);
    navigate(`/cars?${params.toString()}`);
  };

  const styles = {
    // minHeight (not height): fills the first screen on any normal
    // viewport, but still grows taller rather than clipping content on a
    // short screen or a stacked mobile layout where the two columns add
    // up to more than one screen's height — "nothing cut off" wins over
    // "always exactly one screen" when the two are in tension.
    hero: {
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: isDark ? '#18191a' : '#f9fafb',
    },
    heroGrid: {
      position: 'relative',
      width: '100%',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '80px 32px',
      gap: '48px',
      alignItems: 'center',
    },
    // minWidth: 0 overrides a grid item's default "never shrink below my
    // content's natural size" behavior — without it, this column refuses
    // to shrink below the search box's/carousel's natural width, forcing
    // the whole row wider than the viewport at in-between sizes instead of
    // reflowing (the search fields wrapping, the carousel scaling down).
    heroLeft: { textAlign: 'left', minWidth: 0 },
    heroRight: { display: 'flex', justifyContent: 'center', marginTop: '40px', minWidth: 0 },
    heroTitle: {
      fontSize: 'clamp(40px, 6vw, 72px)',
      lineHeight: '1',
      fontWeight: '900',
      letterSpacing: '-0.02em',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      marginBottom: '18px',
    },
    // The last word rendered lighter/italic/muted instead of matching the
    // rest of the headline — a callout treatment, not a second sentence.
    // Reference spec called for literal white at 40% opacity, but that
    // only reads correctly against a dark background — this site's hero
    // is theme-aware and near-white in light mode, so a literal white/40
    // would be nearly invisible there (the same white-on-white bug the
    // navbar had once already). Using the normal theme-aware muted color
    // instead achieves the same "lighter, quieter" effect in both themes.
    heroTitleAccent: {
      fontStyle: 'italic',
      fontWeight: '400',
      color: isDark ? '#6b7280' : '#9ca3af',
    },
    heroSubtitle: {
      fontSize: '18px',
      fontWeight: '500',
      color: isDark ? '#b0b3b8' : '#6b7280',
      marginBottom: '32px',
      maxWidth: '46ch',
    },
    searchBox: {
      gap: '0',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.4)' : '0 12px 32px rgba(0,0,0,0.08)',
    },
    searchField: {
      flex: '1 1 130px',
      minWidth: '130px',
      padding: '12px 18px',
      borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    searchLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#6b7280',
      marginBottom: '4px',
    },
    searchInput: {
      width: '100%',
      border: 'none',
      outline: 'none',
      fontSize: '13px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      background: 'transparent',
    },
    // The native <select> arrow is dropped (appearance: none) in favor of
    // our own chevron icon, positioned over it — matches the rest of the
    // field icons instead of each browser's own inconsistent arrow glyph.
    selectWrap: { position: 'relative' },
    selectInput: { appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', paddingRight: '18px', cursor: 'pointer' },
    selectChevron: {
      position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
      color: isDark ? '#b0b3b8' : '#6b7280', display: 'flex',
    },
    searchBtn: {
      padding: '16px 32px',
      margin: '10px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      alignSelf: 'center',
    },
    // Real, already-true claims only — matched to existing copy elsewhere
    // on the site (the About checklist, the Contact section) rather than
    // inventing new ones for this row specifically.
    trustRow: {
      display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '18px',
    },
    trustItem: {
      fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af',
    },
    section: {
      padding: '48px 32px',
      maxWidth: '1400px',
      margin: '0 auto',
    },
    sectionTitle: {
      fontSize: '28px',
      fontWeight: '700',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      textAlign: 'center',
      marginBottom: '8px',
    },
    sectionSubtitle: {
      fontSize: '14px',
      color: isDark ? '#b0b3b8' : '#6b7280',
      textAlign: 'center',
      marginBottom: '32px',
    },
    grid: {
      gap: '20px',
    },
    card: {
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'transform 0.2s',
    },
    imgWrap: {
      position: 'relative',
      height: '160px',
      background: isDark ? '#3a3b3c' : '#f3f4f6',
    },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
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
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      marginBottom: '4px',
    },
    carSub: {
      fontSize: '13px',
      color: isDark ? '#b0b3b8' : '#6b7280',
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
      color: isDark ? '#b0b3b8' : '#6b7280',
      fontWeight: '500',
    },
    carMeta: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4px',
      fontSize: '12px',
      color: isDark ? '#b0b3b8' : '#6b7280',
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
    testimonialsSection: {
      background: isDark ? '#242526' : '#f9fafb',
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    testimonialGrid: { gap: '20px' },
    testimonialCard: {
      background: isDark ? '#18191a' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px',
      padding: '20px',
    },
    testimonialComment: {
      fontSize: '14px',
      color: isDark ? '#cbd5e1' : '#374151',
      lineHeight: '1.6',
      margin: '10px 0 14px',
    },
    testimonialFooter: { display: 'flex', alignItems: 'center', gap: '10px' },
    testimonialAvatar: {
      width: '34px', height: '34px', borderRadius: '50%',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      fontSize: '14px', fontWeight: '700', display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    testimonialName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    testimonialCar: { fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280' },
    aboutSection: {
      background: isDark ? '#242526' : '#f9fafb',
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    aboutInner: { gap: '48px', alignItems: 'center' },
    featureGrid: { gap: '16px' },
    featureCard: {
      textAlign: 'left',
      background: isDark ? '#18191a' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px',
      padding: '18px',
    },
    featureIcon: {
      width: '42px',
      height: '42px',
      borderRadius: '10px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '19px',
      marginBottom: '12px',
    },
    featureTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      marginBottom: '4px',
    },
    featureText: {
      fontSize: '12.5px',
      color: isDark ? '#b0b3b8' : '#6b7280',
      lineHeight: '1.5',
    },
    aboutTagline: {
      fontSize: '13px',
      fontWeight: '700',
      letterSpacing: '0.03em',
      color: isDark ? GOLD_DARK : GOLD,
      marginBottom: '6px',
    },
    aboutHeading: {
      fontSize: '26px',
      fontWeight: '700',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      marginBottom: '14px',
    },
    aboutText: {
      fontSize: '14px',
      lineHeight: '1.7',
      color: isDark ? '#cbd5e1' : '#4b5563',
      marginBottom: '20px',
    },
    checklist: { listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '12px' },
    checklistItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '500', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    checkBadge: {
      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700',
    },
    contactSection: {
      background: isDark ? '#18191a' : '#17130e',
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
      {/* Hero Section — plain theme-aware background (no photo), text and
          search on the left, the featured-cars carousel on the right. */}
      <div style={styles.hero}>
        <div className="responsive-row-2" style={styles.heroGrid}>
          <div style={styles.heroLeft}>
            <h1 className="display-heading" style={styles.heroTitle}>
              Experience the Drive You <span style={styles.heroTitleAccent}>Deserve</span>
            </h1>
            <p style={styles.heroSubtitle}>We provide reliable and affordable car rental services in Albay. Safe. Comfortable. Hassle-free.</p>

            <div className="hero-search-box" style={styles.searchBox}>
              <div className="hero-search-field" style={styles.searchField}>
                <label style={styles.searchLabel} htmlFor="home-pickup-date"><CalendarIcon color={isDark ? GOLD_DARK : GOLD} /> Pick-up Date</label>
                <input
                  id="home-pickup-date"
                  style={styles.searchInput}
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                />
              </div>
              <div className="hero-search-field" style={styles.searchField}>
                <label style={styles.searchLabel} htmlFor="home-return-date"><CalendarIcon color={isDark ? GOLD_DARK : GOLD} /> Return Date</label>
                <input
                  id="home-return-date"
                  style={styles.searchInput}
                  type="date"
                  min={pickupDate || new Date().toISOString().split('T')[0]}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                />
              </div>
              <div className="hero-search-field" style={{ ...styles.searchField, borderRight: 'none' }}>
                <label style={styles.searchLabel} htmlFor="home-search-category"><CarIcon color={isDark ? GOLD_DARK : GOLD} /> Vehicle Type</label>
                <div style={styles.selectWrap}>
                  <select
                    id="home-search-category"
                    style={{ ...styles.searchInput, ...styles.selectInput }}
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                  >
                    <option value="">Any</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={styles.selectChevron}><ChevronIcon /></span>
                </div>
              </div>
              <button className="hero-search-btn" style={styles.searchBtn} onClick={handleSearch}>
                Search
              </button>
            </div>

            <div style={styles.trustRow}>
              <span style={styles.trustItem}>ID-Verified Renters</span>
              <span style={styles.trustItem}>No Hidden Fees</span>
              <span style={styles.trustItem}>24/7 Support</span>
            </div>
          </div>

          <div style={styles.heroRight}>
            <StackedCarCarousel isDark={isDark} />
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{ ...styles.section, ...styles.aboutSection }}>
        <div className="responsive-row-2" style={styles.aboutInner}>
          <div className="responsive-row-2" style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🚗</div>
              <div style={styles.featureTitle}>Well-Maintained Vehicles</div>
              <div style={styles.featureText}>Quality and safety you can trust.</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>💰</div>
              <div style={styles.featureTitle}>Affordable Rates</div>
              <div style={styles.featureText}>Transparent pricing with no hidden fees.</div>
            </div>
            {/* "Flexible Bookings" here means any rental length (a day, a
                week, a month) at the same daily rate — that already works
                today. A cheaper per-day rate for longer rentals is a real,
                separate feature that doesn't exist yet (deliberately on
                hold — see project_weekly_monthly_discount_on_hold memory). */}
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>📅</div>
              <div style={styles.featureTitle}>Flexible Bookings</div>
              <div style={styles.featureText}>Daily, weekly, or monthly — it's up to you!</div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🎧</div>
              <div style={styles.featureTitle}>Excellent Customer Service</div>
              <div style={styles.featureText}>We're here to assist you every step of the way.</div>
            </div>
          </div>

          <div>
            <div style={styles.aboutTagline}>ABOUT US</div>
            <h2 style={styles.aboutHeading}>The complete Albay rental experience.</h2>
            <p style={styles.aboutText}>
              Serving Camalig and the greater Albay area since 2018, Rent-A-Ride Albay has helped
              travelers and locals alike explore the region in well-maintained, affordable vehicles —
              with a team that treats every trip like it's our own.
            </p>
            <ul style={styles.checklist}>
              <li style={styles.checklistItem}><span style={styles.checkBadge}>✓</span> Digital-first booking and ID verification</li>
              <li style={styles.checklistItem}><span style={styles.checkBadge}>✓</span> Live GPS tracking on select vehicles</li>
              <li style={styles.checklistItem}><span style={styles.checkBadge}>✓</span> Transparent, no-hidden-fee pricing</li>
            </ul>
            <button style={styles.viewAllBtn} onClick={() => navigate('/cars')}>
              Browse All Vehicles
            </button>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <div style={{ ...styles.section, ...styles.testimonialsSection }}>
          <h2 style={styles.sectionTitle}>What Renters Are Saying</h2>
          <p style={styles.sectionSubtitle}>Real feedback from real trips across Albay.</p>

          <div className="responsive-grid-3" style={styles.testimonialGrid}>
            {testimonials.map((t) => (
              <div key={t._id} style={styles.testimonialCard}>
                <StarRating value={t.overall} size={13} readOnly />
                <p style={styles.testimonialComment}>"{t.comment}"</p>
                <div style={styles.testimonialFooter}>
                  <span style={styles.testimonialAvatar}>{t.reviewerName.charAt(0)}</span>
                  <div>
                    <div style={styles.testimonialName}>{t.reviewerName}</div>
                    {t.car && <div style={styles.testimonialCar}>{t.car.brand} {t.car.model}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <li>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Salugan%2C+Camalig%2C+Albay"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...styles.contactRow, textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={styles.contactIcon}>📍</span>
                  <span>Salugan, Camalig, Albay</span>
                </a>
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

      <Footer />
    </div>
  );
};

export default Home;