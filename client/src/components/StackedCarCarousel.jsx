import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GOLD, GOLD_DARK } from '../theme';
import api from '../api';

const STACK_SIZE = 3;
const HOLD_MS = 4000;

// Slot 0 = center (front, largest, clickable). Slot 1 sits behind and to
// the right (next car up), slot 2 behind and to the left (arrived from the
// right on a previous tick, about to exit). `x` is a percentage of the
// card's own width, not the container's — so the offset scales naturally
// with the card at any viewport size instead of needing pixel math.
const slotStyle = (slot) => {
  if (slot === 0) return { opacity: 1, scale: 1, x: '0%', zIndex: 3 };
  if (slot === 1) return { opacity: 0.55, scale: 0.87, x: '46%', zIndex: 2 };
  return { opacity: 0.5, scale: 0.87, x: '-46%', zIndex: 1 };
};

const StackedCarCarousel = ({ isDark }) => {
  const navigate = useNavigate();
  const [cars, setCars] = useState([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    api.get('/cars/featured')
      .then((res) => setCars(res.data))
      .catch((err) => console.error(err));
  }, []);

  const advance = useCallback(() => {
    setIndex((i) => (i + 1) % cars.length);
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

  if (cars.length === 0) return null;

  const stackSize = Math.min(STACK_SIZE, cars.length);
  const visible = Array.from({ length: stackSize }, (_, offset) => cars[(index + offset) % cars.length]);

  const s = {
    outer: { overflow: 'hidden', padding: '10px 0' },
    wrap: {
      position: 'relative', width: 'min(960px, 96vw)', height: '460px',
      margin: '0 auto',
    },
    glow: {
      position: 'absolute', top: '-90px', left: '50%', transform: 'translateX(-50%)',
      width: '960px', height: '720px', borderRadius: '50%', pointerEvents: 'none',
      background: isDark
        ? 'radial-gradient(circle, rgba(232,161,0,0.28) 0%, rgba(232,161,0,0) 70%)'
        : 'radial-gradient(circle, rgba(184,121,10,0.22) 0%, rgba(184,121,10,0) 70%)',
      filter: 'blur(20px)',
    },
    // Sized as a percentage of `wrap` (23% + 54% + 23% = 100%, so the card
    // sits centered) rather than mixing px/vw clamps with a negative
    // margin — that combination inverted itself on wide viewports and
    // shoved every card hundreds of pixels off-frame.
    card: {
      position: 'absolute', top: 0, left: '23%', width: '54%',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '18px', overflow: 'hidden',
      boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.5)' : '0 16px 40px rgba(0,0,0,0.12)',
      cursor: 'pointer',
    },
    imgWrap: { width: '100%', height: '290px', background: isDark ? '#18191a' : '#f3f4f6', overflow: 'hidden' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    body: { padding: '22px 24px' },
    name: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '3px' },
    sub: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '10px' },
    price: { fontSize: '19px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD },
    priceUnit: { fontSize: '13px', fontWeight: '400', color: isDark ? '#b0b3b8' : '#6b7280' },
    dots: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '18px' },
    dot: (active) => ({
      width: active ? '18px' : '6px', height: '6px', borderRadius: '4px',
      background: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#d1d5db'),
      transition: 'width 0.3s, background 0.3s',
    }),
  };

  return (
    <div style={s.outer}>
      <div
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
                </div>
                <div style={s.body}>
                  <div style={s.name}>{car.brand} {car.model}</div>
                  <div style={s.sub}>{car.category} · {car.year}</div>
                  <div style={s.price}>
                    ₱{car.pricePerDay}<span style={s.priceUnit}> / day</span>
                  </div>
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
