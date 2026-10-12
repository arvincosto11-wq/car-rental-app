import { useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import HomeIcon from './HomeIcons';
import useReveal from '../../hooks/useReveal';

// Weddings, airport runs, out-of-town trips and group outings.
//
// An advertisement, not a booking flow, and that is the whole design of
// it. These are quoted per event on the phone — a wedding is a few hours,
// a decorated car and a driver, not a day at a daily rate — and the site
// can only price whole days. So every action here is a phone call. A Book
// button would send somebody to a form that asks for a return date and
// charges by the day, which is not what they are buying.
const PHONE = '0950-651-0479';
const TEL = 'tel:09506510479';

const OCCASIONS = [
  {
    key: 'wedding',
    icon: 'wedding',
    title: 'Weddings',
    text: 'Hotel to church, church to reception — a decorated car and a driver for the day.',
    price: 'From ₱4,500',
    highlight: true,
    // A white sedan if we have one, which is what a wedding asks for.
    pick: (cars) => byName(cars, 'Mirage G4') || byColour(cars, 'Sedan', 'white') || byCategory(cars, 'Sedan'),
  },
  {
    key: 'airport',
    icon: 'airport',
    title: 'Airport transfers',
    text: 'To or from Legazpi airport, on time, on a fixed arrangement agreed when you call.',
    price: 'Quoted per trip',
    pick: (cars) => byName(cars, 'Civic') || byCategory(cars, 'Sedan'),
  },
  {
    key: 'trip',
    icon: 'trip',
    title: 'Out-of-town trips',
    text: 'Longer journeys with a driver, so everyone in the car can sit back.',
    price: 'Quoted per trip',
    pick: (cars) => byCategory(cars, 'SUV') || byCategory(cars, 'Sedan'),
  },
  {
    key: 'event',
    icon: 'event',
    title: 'Company & family events',
    text: '7-seaters for the whole group — reunions, outings, team days.',
    price: 'Quoted per event',
    // The design asked for a white Honda BR-V. There is no BR-V in the
    // fleet, so this takes the only seven-seater there is.
    pick: (cars) => mostSeats(cars) || byCategory(cars, 'Van'),
  },
];

const listed = (cars) => (cars || []).filter((c) => c.image && c.status !== 'draft');
const byName = (cars, model) => listed(cars).find((c) => `${c.brand} ${c.model}`.toLowerCase().includes(model.toLowerCase()));
const byCategory = (cars, category) => listed(cars).find((c) => c.category === category);
const byColour = (cars, category, colour) => listed(cars)
  .find((c) => c.category === category && String(c.color || '').toLowerCase() === colour);
const mostSeats = (cars) => listed(cars)
  .filter((c) => (c.seats || 0) >= 7)
  .sort((a, b) => (b.seats || 0) - (a.seats || 0))[0];

const OccasionsSection = ({ cars }) => {
  const { isDark } = useTheme();
  const root = useRef(null);
  useReveal(root);

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    section: { padding: 'clamp(56px, 8vw, 96px) clamp(16px, 4vw, 40px)' },
    inner: { maxWidth: '1200px', margin: '0 auto' },
    head: {
      display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end',
      justifyContent: 'space-between', marginBottom: '32px',
    },
    label: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.14em', textTransform: 'uppercase',
      color: goldInk(isDark), marginBottom: '10px',
    },
    h2: {
      fontSize: 'clamp(30px, 4.4vw, 46px)', fontWeight: '800', lineHeight: 1.06,
      letterSpacing: '-0.02em', textWrap: 'balance', margin: '0 0 10px',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    intro: { fontSize: '16px', lineHeight: 1.6, color: isDark ? '#b0b3b8' : '#4b5563', margin: 0, maxWidth: '520px' },
    call: {
      display: 'inline-flex', alignItems: 'center', gap: '9px', minHeight: '44px', flexShrink: 0,
      padding: '0 22px', borderRadius: '12px', textDecoration: 'none',
      fontSize: '14.5px', fontWeight: '700', background: gold, color: ON_GOLD,
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
      gap: '16px', listStyle: 'none', padding: 0, margin: 0,
    },
    card: (on) => ({
      border: `1px solid ${on ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      borderRadius: '18px', overflow: 'hidden', minWidth: 0,
      background: isDark ? '#242526' : '#fff',
      display: 'flex', flexDirection: 'column',
    }),
    stage: {
      // A definite height rather than an aspect-ratio. As a flex item the
      // ratio was being ignored and each stage took its height from the
      // shape of the photograph inside it, so a square-ish Mirage made one
      // card's picture half as tall again as its neighbours' and knocked
      // every title out of line.
      height: 'clamp(150px, 19vw, 190px)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '10px', boxSizing: 'border-box',
      background: isDark
        ? 'linear-gradient(160deg, #2c2d30, #141517)'
        : 'linear-gradient(160deg, #ffffff, #e6e8ec)',
    },
    photo: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
    body: { padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 },
    titleRow: { display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px', color: goldInk(isDark) },
    title: { fontSize: '16px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    text: { fontSize: '13.5px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#4b5563', margin: '0 0 14px' },
    foot: {
      marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '10px', flexWrap: 'wrap', paddingTop: '12px',
      borderTop: `1px solid ${isDark ? '#303132' : '#eef0f2'}`,
    },
    price: (on) => ({
      fontSize: '14px', fontWeight: '800',
      color: on ? goldInk(isDark) : (isDark ? '#8a8d91' : '#6b7280'),
    }),
    link: {
      // A shade smaller than the price beside it: the number is longer
      // than the word it replaced, and on a narrow card the two share one
      // line until they cannot.
      fontSize: '13px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap',
      color: goldInk(isDark), minHeight: '44px', display: 'inline-flex', alignItems: 'center',
    },
  };

  return (
    <section ref={root} style={s.section} aria-labelledby="home-occasions-title">
      <div style={s.inner}>
        <div style={s.head} data-reveal>
          <div style={{ minWidth: 0 }}>
            <div style={s.label}>Occasions · with a driver</div>
            <h2 id="home-occasions-title" style={s.h2}>Booked for the big days, too</h2>
            <p style={s.intro}>Quoted on the phone for your occasion.</p>
          </div>
          <a href={TEL} style={s.call}>
            <HomeIcon name="phone" size={18} />
            Call {PHONE}
          </a>
        </div>

        <ul style={s.grid}>
          {OCCASIONS.map((o, i) => {
            const car = o.pick(cars);
            return (
              <li key={o.key} style={s.card(o.highlight)} data-reveal data-reveal-delay={i * 70}>
                <div style={s.stage}>
                  {car?.image
                    ? <img src={car.image} alt={`${car.brand} ${car.model}`} loading="lazy" style={s.photo} />
                    : <HomeIcon name={o.icon} size={44} stroke={gold} />}
                </div>
                <div style={s.body}>
                  <div style={s.titleRow}>
                    <HomeIcon name={o.icon} size={19} />
                    <h3 style={s.title}>{o.title}</h3>
                  </div>
                  <p style={s.text}>{o.text}</p>
                  <div style={s.foot}>
                    <span style={s.price(o.highlight)}>{o.price}</span>
                    {/* The number itself, not the word "Call".
                        On a phone this still opens the dialler. On a
                        laptop a tel: link usually opens nothing — Windows
                        asks which application should handle it, which is
                        a dead end — so the number has to be readable
                        without clicking anything. Dialling is the
                        convenience on top, never the only way to get it. */}
                    <a href={TEL} style={s.link} aria-label={`Call to arrange ${o.title.toLowerCase()}: ${PHONE}`}>
                      {PHONE} <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default OccasionsSection;
