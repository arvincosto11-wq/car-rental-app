import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import Skeleton from './Skeleton';
import api from '../api';

const STACK_SIZE = 3;
const HOLD_MS = 4000;

// Slot 0 = center (front, largest, clickable). Slot 1 sits behind and to
// the right (next car up), slot 2 behind and to the left (arrived from the
// right on a previous tick, about to exit). `x` is a percentage of the
// card's own width, not the container's — so the offset scales naturally
// with the card at any viewport size instead of needing pixel math. `filter`
// is animated the same way as the rest (framer-motion handles CSS filter
// transitions fine) — a real blur on the side cards reads as depth-of-field
// rather than just a dimmed duplicate of the front card.
const slotStyle = (slot) => {
  if (slot === 0) return { opacity: 1, scale: 1, x: '0%', zIndex: 3, filter: 'blur(0px) grayscale(0)' };
  if (slot === 1) return { opacity: 0.55, scale: 0.87, x: '46%', zIndex: 2, filter: 'blur(4px) grayscale(0.3)' };
  return { opacity: 0.5, scale: 0.87, x: '-46%', zIndex: 1, filter: 'blur(4px) grayscale(0.3)' };
};

const StackedCarCarousel = ({ isDark }) => {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef(null);
  const wheelCooldownRef = useRef(false);

  useEffect(() => {
    api.get('/cars/featured')
      .then((res) => setCars(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % cars.length);
  }, [cars.length]);

  const retreat = useCallback(() => {
    setIndex((i) => (i - 1 + cars.length) % cars.length);
  }, [cars.length]);

  // Front card navigates to its detail page. A side card instead rotates
  // itself into the front position — found by its real index in `cars`,
  // not a relative step, so it works the same whether it was on the left
  // or the right.
  const handleCardClick = (car, slot) => {
    if (slot === 0) {
      navigate(`/cars/${car._id}`);
      return;
    }
    const targetIndex = cars.findIndex((c) => c._id === car._id);
    if (targetIndex !== -1) setIndex(targetIndex);
  };

  useEffect(() => {
    if (cars.length < 2 || paused) return;
    const timer = setInterval(advance, HOLD_MS);
    return () => clearInterval(timer);
  }, [cars.length, paused, advance]);

  // Scroll wheel while hovering rotates the carousel instead of scrolling
  // the page. Attached as a native (non-passive) listener via ref rather
  // than React's onWheel — React attaches wheel listeners passively by
  // default for scroll performance, which would make preventDefault a
  // silent no-op. Debounced with a cooldown so one scroll gesture (a
  // mouse wheel notch, or a trackpad flick that fires many small deltas)
  // only advances one step instead of spinning through several.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || cars.length < 2) return;
    const handleWheel = (e) => {
      e.preventDefault();
      if (wheelCooldownRef.current) return;
      wheelCooldownRef.current = true;
      if (e.deltaY > 0) advance();
      else if (e.deltaY < 0) retreat();
      setTimeout(() => { wheelCooldownRef.current = false; }, 500);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [cars.length, advance, retreat]);

  // Matches the real card's own position/size (left: 13%, width: 74% of
  // wrap) so the skeleton sits exactly where the front card will appear —
  // no layout shift once the real data (or a cold-started backend
  // response) finally arrives.
  if (loading) {
    return (
      <div style={{ overflow: 'hidden', padding: '10px 0' }}>
        <div style={{ position: 'relative', width: 'min(520px, 92vw)', height: '400px', margin: '0 auto' }}>
          <div style={{ position: 'absolute', top: 0, left: '13%', width: '74%' }}>
            <Skeleton height="180px" radius="16px 16px 0 0" isDark={isDark} />
            <div style={{ padding: '18px 20px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderTop: 'none', borderRadius: '0 0 16px 16px' }}>
              <Skeleton width="70%" height="18px" isDark={isDark} style={{ marginBottom: '10px' }} />
              <Skeleton width="45%" height="11px" isDark={isDark} style={{ marginBottom: '14px' }} />
              <Skeleton height="36px" radius="8px" isDark={isDark} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cars.length === 0) return null;

  const stackSize = Math.min(STACK_SIZE, cars.length);
  const visible = Array.from({ length: stackSize }, (_, offset) => cars[(index + offset) % cars.length]);

  const s = {
    outer: { overflow: 'hidden', padding: '10px 0' },
    // Sized for the hero's right-hand column now (its only usage — see
    // Home.jsx), not a full-width section, so this stays a compact ~440px
    // stage rather than the ~960px it needed as a standalone section. A
    // real length (not a `%`) is required here: this sits inside a flex
    // container (heroRight), and every card inside `wrap` is `position:
    // absolute` — which doesn't count toward a flex item's shrink-to-fit
    // sizing. A `width: 100%` here would resolve against that collapsed
    // (near-zero) size instead of the space actually available.
    wrap: {
      position: 'relative', width: 'min(520px, 92vw)', height: '400px',
      margin: '0 auto',
    },
    glow: {
      position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
      width: '520px', height: '400px', borderRadius: '50%', pointerEvents: 'none',
      background: isDark
        ? 'radial-gradient(circle, rgba(232,161,0,0.28) 0%, rgba(232,161,0,0) 70%)'
        : 'radial-gradient(circle, rgba(184,121,10,0.22) 0%, rgba(184,121,10,0) 70%)',
      filter: 'blur(20px)',
    },
    // Sized as a percentage of `wrap` (13% + 74% + 13% = 100%, so the card
    // sits centered) rather than mixing px/vw clamps with a negative
    // margin — that combination inverted itself on wide viewports and
    // shoved every card hundreds of pixels off-frame. Narrower side margins
    // than the old full-size version so the side cards only peek as thin
    // blurred slivers, matching a compact hero-embedded look.
    card: {
      position: 'absolute', top: 0, left: '13%', width: '74%',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '16px', overflow: 'hidden',
      boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 40px rgba(0,0,0,0.12)',
      cursor: 'pointer',
    },
    imgWrap: { position: 'relative', width: '100%', height: '180px', background: isDark ? '#18191a' : '#f3f4f6', overflow: 'hidden' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    categoryBadge: {
      position: 'absolute', top: '12px', right: '12px',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.02em',
      padding: '4px 10px', borderRadius: '20px',
    },
    body: { padding: '18px 20px' },
    headRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' },
    name: { fontSize: '17px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    sub: {
      fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.03em', textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '12px',
    },
    price: { fontSize: '16px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD, textAlign: 'right' },
    priceUnit: { fontSize: '10.5px', fontWeight: '500', color: isDark ? '#b0b3b8' : '#6b7280' },
    reserveBtn: {
      display: 'block', width: '100%', padding: '11px', marginTop: '2px',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
      border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    },
    dots: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' },
    dot: (active) => ({
      width: active ? '18px' : '6px', height: '6px', borderRadius: '4px',
      background: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#d1d5db'),
      transition: 'width 0.3s, background 0.3s',
    }),
  };

  return (
    <div style={s.outer}>
      <div
        ref={wrapRef}
        style={s.wrap}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div style={s.glow} />
        <AnimatePresence initial={false}>
          {visible.map((car, slot) => {
            const target = slotStyle(slot);
            return (
              <motion.div
                key={car._id}
                initial={{ opacity: 0, scale: 0.8, x: '-70%' }}
                animate={target}
                exit={{ opacity: 0, scale: 0.75, x: '0%', y: 30 }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
                style={{ ...s.card, zIndex: target.zIndex }}
                onClick={() => handleCardClick(car, slot)}
                role={slot === 0 ? 'link' : 'button'}
                tabIndex={0}
                aria-label={slot === 0 ? `View ${car.brand} ${car.model} details` : `Bring ${car.brand} ${car.model} to the front`}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(car, slot); }}
              >
                <div style={s.imgWrap}>
                  {car.image && <img src={car.image} alt="" style={s.img} />}
                  {car.category && <span style={s.categoryBadge}>{car.category}</span>}
                </div>
                <div style={s.body}>
                  <div style={s.headRow}>
                    <div style={s.name}>{car.brand} {car.model}</div>
                    <div style={s.price}>
                      ₱{car.pricePerDay}<br /><span style={s.priceUnit}>per day</span>
                    </div>
                  </div>
                  <div style={s.sub}>{car.category}{car.seats ? ` • ${car.seats} Seats` : ''}</div>
                  {slot === 0 && (
                    <button
                      type="button"
                      style={s.reserveBtn}
                      onClick={(e) => { e.stopPropagation(); navigate(`/cars/${car._id}`); }}
                    >
                      Book Now
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {cars.length > 1 && (
        <div style={s.dots}>
          {cars.map((car, i) => (
            <span key={car._id} style={s.dot(i === index)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default StackedCarCarousel;
