import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GOLD, GOLD_DARK } from '../theme';
import api from '../api';

const STACK_SIZE = 3;
const HOLD_MS = 4000;

// Slot 0 = front (largest, clickable), higher slots sit progressively
// further back — smaller, dimmer, offset down. Rotating `index` reassigns
// which car occupies which slot, so cards already on screen animate to
// their new position instead of just swapping content.
const slotStyle = (slot) => {
  if (slot === 0) return { opacity: 1, scale: 1, y: 0, zIndex: 3 };
  if (slot === 1) return { opacity: 0.7, scale: 0.93, y: 20, zIndex: 2 };
  return { opacity: 0.4, scale: 0.86, y: 38, zIndex: 1 };
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

  useEffect(() => {
    if (cars.length < 2 || paused) return;
    const timer = setInterval(advance, HOLD_MS);
    return () => clearInterval(timer);
  }, [cars.length, paused, advance]);

  if (cars.length === 0) return null;

  const stackSize = Math.min(STACK_SIZE, cars.length);
  const visible = Array.from({ length: stackSize }, (_, offset) => cars[(index + offset) % cars.length]);

  const s = {
    wrap: {
      position: 'relative', maxWidth: '380px', margin: '0 auto',
      height: `${300 + (stackSize - 1) * 20}px`,
    },
    glow: {
      position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
      width: '520px', height: '420px', borderRadius: '50%', pointerEvents: 'none',
      background: isDark
        ? 'radial-gradient(circle, rgba(232,161,0,0.28) 0%, rgba(232,161,0,0) 70%)'
        : 'radial-gradient(circle, rgba(184,121,10,0.22) 0%, rgba(184,121,10,0) 70%)',
      filter: 'blur(20px)',
    },
    card: {
      position: 'absolute', top: 0, left: 0, right: 0,
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '16px', overflow: 'hidden',
      boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.5)' : '0 12px 32px rgba(0,0,0,0.12)',
      cursor: 'pointer',
    },
    imgWrap: { width: '100%', height: '190px', background: isDark ? '#18191a' : '#f3f4f6', overflow: 'hidden' },
    img: { width: '100%', height: '100%', objectFit: 'cover' },
    body: { padding: '16px 18px' },
    name: { fontSize: '16px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '2px' },
    sub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '10px' },
    price: { fontSize: '15px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD },
    priceUnit: { fontSize: '12px', fontWeight: '400', color: isDark ? '#b0b3b8' : '#6b7280' },
    dots: { display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '18px' },
    dot: (active) => ({
      width: active ? '18px' : '6px', height: '6px', borderRadius: '4px',
      background: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#d1d5db'),
      transition: 'width 0.3s, background 0.3s',
    }),
  };

  return (
    <div>
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
                layout
                initial={{ opacity: 0, scale: 0.8, y: 60 }}
                animate={target}
                exit={{ opacity: 0, scale: 0.8, y: -30 }}
                transition={{ duration: 0.7, ease: 'easeInOut' }}
                style={{ ...s.card, zIndex: target.zIndex }}
                onClick={() => slot === 0 && navigate(`/cars/${car._id}`)}
                role={slot === 0 ? 'link' : undefined}
                tabIndex={slot === 0 ? 0 : -1}
                aria-label={slot === 0 ? `View ${car.brand} ${car.model} details` : undefined}
                onKeyDown={(e) => { if (slot === 0 && e.key === 'Enter') navigate(`/cars/${car._id}`); }}
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
