import { useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import HomeIcon from './HomeIcons';
import useReveal from '../../hooks/useReveal';

// The three steps between wanting a car and having one.
//
// New to the page. Hesitation on a rental site is almost always "how does
// this work and when do I have to pay", and the answer was previously only
// discoverable by starting a booking.
const STEPS = [
  {
    icon: 'cal',
    title: 'Pick your dates',
    text: 'Choose a vehicle and the days you need it — self-drive or with a driver.',
  },
  {
    icon: 'wallet',
    title: 'Pay a 20% downpayment',
    text: 'That holds your booking. The balance is paid when you collect.',
  },
  {
    icon: 'key',
    title: 'Collect it, or have it delivered',
    text: 'Pick it up in Salugan, Camalig, or we bring it to you — priced by distance, up to 45km.',
  },
];

const HowItWorks = ({ onPickDates }) => {
  const { isDark } = useTheme();
  const root = useRef(null);
  useReveal(root);

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    band: {
      padding: 'clamp(56px, 8vw, 96px) clamp(16px, 4vw, 40px)',
      background: isDark ? '#242526' : '#fff',
      borderTop: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    inner: { maxWidth: '1200px', margin: '0 auto', textAlign: 'center' },
    label: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: goldInk(isDark), marginBottom: '10px',
    },
    h2: {
      fontSize: 'clamp(30px, 4.4vw, 46px)', fontWeight: '800', lineHeight: 1.06,
      letterSpacing: '-0.02em', textWrap: 'balance', margin: '0 0 36px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
      gap: '18px', listStyle: 'none', padding: 0, margin: '0 0 32px', textAlign: 'left',
    },
    card: {
      background: isDark ? '#1e1f20' : '#f7f8fa', borderRadius: '18px', padding: '26px 20px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, textAlign: 'center', minWidth: 0,
    },
    circle: {
      width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: gold, color: ON_GOLD,
    },
    step: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: goldInk(isDark), marginBottom: '6px',
    },
    title: { fontSize: '18px', fontWeight: '800', margin: '0 0 8px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    text: { fontSize: '14.5px', lineHeight: 1.6, color: isDark ? '#b0b3b8' : '#4b5563', margin: 0 },
    cta: {
      display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '44px',
      padding: '0 24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '14.5px', fontWeight: '700',
      background: gold, color: ON_GOLD,
    },
  };

  return (
    <section ref={root} style={s.band} aria-labelledby="home-how-title">
      <div style={s.inner}>
        <div data-reveal>
          <div style={s.label}>Daily rentals</div>
          <h2 id="home-how-title" style={s.h2}>How it works</h2>
        </div>

        <ol style={s.grid}>
          {STEPS.map((step, i) => (
            <li key={step.title} style={s.card} data-reveal data-reveal-delay={i * 70}>
              <span style={s.circle}><HomeIcon name={step.icon} size={26} /></span>
              <div style={s.step}>Step {i + 1}</div>
              <h3 style={s.title}>{step.title}</h3>
              <p style={s.text}>{step.text}</p>
            </li>
          ))}
        </ol>

        {/* Back to the hero's own date search rather than a second one:
            two search fields on one page is two places to start and one
            of them always falls behind. */}
        <button type="button" style={s.cta} onClick={onPickDates} data-reveal>
          Pick your dates
          <span aria-hidden="true">↑</span>
        </button>
      </div>
    </section>
  );
};

export default HowItWorks;
