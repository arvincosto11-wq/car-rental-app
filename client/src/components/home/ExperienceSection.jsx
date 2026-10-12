import { useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { GOLD, GOLD_DARK, goldInk } from '../../theme';
import HomeIcon from './HomeIcons';
import useReveal from '../../hooks/useReveal';

// Who we are, under the hero.
//
// Two of the lines this section used to carry are gone, and neither was a
// style decision: it claimed "digital-first booking and ID verification"
// when no identity document is collected anywhere any more, and "live GPS
// tracking on select vehicles" when one vehicle in fourteen has a tracker
// fitted. What replaces them is three things that are true of every
// booking.
const FEATURES = [
  { icon: 'car', title: 'Well-Maintained Vehicles', text: 'Clean, air-conditioned and looked after between every trip.' },
  { icon: 'tag', title: 'Affordable Rates', text: 'Clear daily rates, and 10% off when you rent for 7 days or more.' },
  { icon: 'cal', title: 'Flexible Bookings', text: 'Self-drive or with a driver. Collect it in Camalig or have it delivered.' },
  { icon: 'headset', title: 'Excellent Customer Service', text: 'On time, and a real person on the phone at 0950-651-0479.' },
];

const CHECKS = [
  'Self-drive or with a driver',
  'Delivered to your address, up to 45km',
  '20% downpayment to book',
];

const ExperienceSection = () => {
  const { isDark } = useTheme();
  const root = useRef(null);
  useReveal(root);

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    section: { padding: 'clamp(56px, 8vw, 96px) clamp(16px, 4vw, 40px)' },
    inner: {
      maxWidth: '1200px', margin: '0 auto',
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
      gap: 'clamp(28px, 4vw, 56px)', alignItems: 'center',
    },
    photoWrap: { position: 'relative', minWidth: 0 },
    photo: {
      width: '100%', aspectRatio: '4 / 5', maxHeight: '600px', objectFit: 'cover',
      borderRadius: '22px', display: 'block',
    },
    badge: {
      position: 'absolute', left: '20px', bottom: '20px',
      background: gold, color: '#17130e', borderRadius: '16px', padding: '12px 18px',
    },
    badgeNum: { fontSize: '30px', fontWeight: '800', lineHeight: 1 },
    badgeLabel: { fontSize: '12px', fontWeight: '700', marginTop: '2px' },
    label: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: goldInk(isDark), marginBottom: '10px',
    },
    h2: {
      fontSize: 'clamp(30px, 4.4vw, 46px)', fontWeight: '800', lineHeight: 1.06,
      letterSpacing: '-0.02em', textWrap: 'balance', margin: '0 0 14px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    story: { fontSize: '16px', lineHeight: 1.6, color: isDark ? '#b0b3b8' : '#4b5563', margin: '0 0 26px' },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
      gap: '14px', marginBottom: '26px', listStyle: 'none', padding: 0,
    },
    card: {
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, borderRadius: '16px', padding: '18px',
      background: isDark ? '#242526' : '#fff', minWidth: 0,
    },
    cardHead: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' },
    well: {
      width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6', color: goldInk(isDark),
    },
    cardTitle: { fontSize: '14.5px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    cardText: { fontSize: '13.5px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#4b5563', margin: 0 },
    checks: { listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '12px' },
    check: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    checkCircle: {
      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: gold, color: '#17130e',
    },
  };

  return (
    <section ref={root} style={s.section} aria-labelledby="home-about-title">
      <div style={s.inner}>
        <div style={s.photoWrap} data-reveal>
          <img
            src="/handling-keys.jpg"
            alt="Keys being handed over to a renter"
            loading="lazy"
            style={s.photo}
          />
          <div style={s.badge}>
            <div style={s.badgeNum}>2018</div>
            <div style={s.badgeLabel}>Renting in Albay since</div>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div data-reveal>
            <div style={s.label}>About us</div>
            <h2 id="home-about-title" style={s.h2}>The complete Albay rental experience</h2>
            <p style={s.story}>
              We&apos;ve been renting cars from Salugan, Camalig since 2018 — to locals and visitors
              across the greater Albay area — with a team that treats every trip like it&apos;s our own.
            </p>
          </div>

          <ul style={s.grid}>
            {FEATURES.map((f, i) => (
              <li key={f.title} style={s.card} data-reveal data-reveal-delay={i * 70}>
                <div style={s.cardHead}>
                  <span style={s.well}><HomeIcon name={f.icon} size={21} /></span>
                  <span style={s.cardTitle}>{f.title}</span>
                </div>
                <p style={s.cardText}>{f.text}</p>
              </li>
            ))}
          </ul>

          <ul style={s.checks} data-reveal>
            {CHECKS.map((c) => (
              <li key={c} style={s.check}>
                <span style={s.checkCircle}><HomeIcon name="check" size={13} width={2.6} /></span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default ExperienceSection;
