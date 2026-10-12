import { useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { goldInk } from '../../theme';
import StarRating from '../StarRating';
import useReveal from '../../hooks/useReveal';

// What people who have actually rented say.
//
// The cards lead with the vehicle rather than the reviewer: a name masked
// to an initial tells somebody nothing, while "Toyota Corolla" is the
// thing they are deciding about. Same data as before, from the same
// endpoint — nothing here is written by us.
const ReviewsSection = ({ testimonials }) => {
  const { isDark } = useTheme();
  const root = useRef(null);
  useReveal(root);

  const s = {
    band: {
      padding: 'clamp(56px, 8vw, 96px) clamp(16px, 4vw, 40px)',
      background: isDark ? '#242526' : '#fff',
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    inner: { maxWidth: '1200px', margin: '0 auto' },
    label: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: goldInk(isDark), marginBottom: '10px',
    },
    h2: {
      fontSize: 'clamp(30px, 4.4vw, 46px)', fontWeight: '800', lineHeight: 1.06,
      letterSpacing: '-0.02em', textWrap: 'balance', margin: '0 0 32px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
      gap: '16px',
    },
    card: {
      background: isDark ? '#1e1f20' : '#f7f8fa', borderRadius: '16px', padding: '22px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, margin: 0, minWidth: 0,
    },
    head: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
    thumbWrap: {
      width: '60px', height: '44px', borderRadius: '10px', flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark
        ? 'linear-gradient(160deg, #2c2d30, #141517)'
        : 'linear-gradient(160deg, #ffffff, #e6e8ec)',
    },
    thumb: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
    vehicle: { fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a', lineHeight: 1.2 },
    who: { fontSize: '12px', color: isDark ? '#8a8d91' : '#6b7280', marginTop: '3px' },
    quote: {
      fontSize: '15px', lineHeight: 1.6, margin: '12px 0 0',
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
  };

  if (!testimonials?.length) return null;

  return (
    <section ref={root} style={s.band} aria-labelledby="home-reviews-title">
      <div style={s.inner}>
        <div data-reveal>
          <div style={s.label}>Reviews</div>
          <h2 id="home-reviews-title" style={s.h2}>What Renters Are Saying</h2>
        </div>

        <div style={s.grid}>
          {testimonials.map((t, i) => (
            <figure key={t._id} style={s.card} data-reveal data-reveal-delay={i * 70}>
              <div style={s.head}>
                <span style={s.thumbWrap}>
                  {t.car?.image
                    ? <img src={t.car.image} alt="" loading="lazy" style={s.thumb} />
                    : null}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={s.vehicle}>{t.car ? `${t.car.brand} ${t.car.model}` : 'Rent-A-Ride Albay'}</div>
                  <div style={s.who}>{t.reviewerName}</div>
                </div>
              </div>
              <StarRating value={t.overall} size={14} readOnly />
              {t.comment && <blockquote style={s.quote}>&ldquo;{t.comment}&rdquo;</blockquote>}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReviewsSection;
