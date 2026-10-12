import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import StarRating from '../components/StarRating';
import StackedCarCarousel from '../components/StackedCarCarousel';
import Footer from '../components/Footer';
import ExperienceSection from '../components/home/ExperienceSection';
import HowItWorks from '../components/home/HowItWorks';
import OccasionsSection from '../components/home/OccasionsSection';
import ReviewsSection from '../components/home/ReviewsSection';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk} from '../theme';
import usePageTitle from '../hooks/usePageTitle';
import useScrollMemory from '../hooks/useScrollMemory';
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
  // Whether the reviews have settled, either way. The page grows by about
  // 900px when they arrive, so nothing can be said about where somebody
  // was reading until this is true — see useScrollMemory.
  const [reviewsSettled, setReviewsSettled] = useState(false);
  const [fleetRating, setFleetRating] = useState(null);
  const [cars, setCars] = useState([]);
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  usePageTitle();
  useScrollMemory('home', reviewsSettled);

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const res = await api.get('/cars/reviews/featured');
        setTestimonials(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        // Settled, not succeeded: a failed fetch gives a shorter page, but
        // it is a page of a known height, which is all the restore needs.
        setReviewsSettled(true);
      }
    };
    fetchTestimonials();
  }, []);

  // Real social proof instead of borrowed logos: the fleet-wide rating is
  // computed from the same avgRating/ratingCount every vehicle already
  // carries. Weighted by review count, so a car with one 5-star review
  // can't outweigh one with twenty. Renders nothing until there are
  // reviews to report — an empty claim is worse than no claim.
  useEffect(() => {
    const fetchFleetRating = async () => {
      try {
        const res = await api.get('/cars');
        // Kept, not just measured: the occasions section picks a vehicle
        // photo per occasion out of the same list, so this one request
        // feeds both and nothing extra is fetched.
        setCars(res.data);
        const rated = res.data.filter((c) => c.ratingCount > 0);
        const count = rated.reduce((sum, c) => sum + c.ratingCount, 0);
        if (!count) return;
        const weighted = rated.reduce((sum, c) => sum + c.avgRating * c.ratingCount, 0);
        setFleetRating({ average: weighted / count, count });
      } catch (err) {
        console.error(err);
      }
    };
    fetchFleetRating();
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
    // Soft blurred pools of brand colour behind the hero, so the background
    // reads as lit rather than as a flat fill. They sit before heroGrid in
    // the DOM and heroGrid is positioned, so content always stacks above
    // them without needing z-index bookkeeping.
    //
    // Far weaker in light mode on purpose: the same alpha that looks
    // cinematic on #18191a looks like a printing fault on #f9fafb.
    glowOrb: (placement) => ({
      position: 'absolute',
      width: placement.size,
      height: placement.size,
      ...placement.at,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${isDark ? placement.dark : placement.light} 0%, transparent 70%)`,
      filter: 'blur(60px)',
      pointerEvents: 'none',
    }),
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
    // The only one of these that's a number rather than a claim, so it's
    // the only one that earns the brand colour.
    trustRating: {
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontWeight: '800', color: goldInk(isDark),
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
  };

  return (
    <div>
      {/* Hero Section — plain theme-aware background (no photo), text and
          search on the left, the featured-cars carousel on the right. */}
      {/* The id is the only change to the hero: "Pick your dates" further
          down scrolls back to this search rather than offering a second
          one, since two search fields on a page is two places to start
          and one of them always falls behind. */}
      <div id="home-hero" style={styles.hero}>
        <div aria-hidden="true" style={styles.glowOrb({
          size: '620px', at: { top: '-14%', left: '-8%' },
          dark: 'rgba(232,161,0,0.20)', light: 'rgba(184,121,10,0.09)',
        })} />
        <div aria-hidden="true" style={styles.glowOrb({
          size: '520px', at: { bottom: '-18%', right: '2%' },
          dark: 'rgba(232,161,0,0.13)', light: 'rgba(184,121,10,0.06)',
        })} />
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
              {fleetRating && (
                <span style={{ ...styles.trustItem, ...styles.trustRating }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.4l2.9 6.1 6.7.9-4.9 4.6 1.2 6.6L12 17.5 6.1 20.6l1.2-6.6L2.4 9.4l6.7-.9z" />
                  </svg>
                  {fleetRating.average.toFixed(1)} from {fleetRating.count} review{fleetRating.count === 1 ? '' : 's'}
                </span>
              )}
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

      <ExperienceSection />

      <HowItWorks
        onPickDates={() => {
          const hero = document.getElementById('home-hero');
          if (hero) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />

      <OccasionsSection cars={cars} />

      <ReviewsSection testimonials={testimonials} />

      <Footer />
    </div>
  );
};

export default Home;