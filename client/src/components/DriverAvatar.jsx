import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK } from '../theme';

// A driver's face, wherever one is named.
//
// One component rather than the same circle written five times, so the
// photo, the fallback and the size agree on every screen a driver appears
// on — the booking form, the confirmation, My Bookings, the pickup desk
// and the office list.
//
// The fallback is their initials rather than a stock silhouette: a grey
// outline of a person reads as "we have no driver", which is a different
// and alarming thing from "we have not got round to taking his photograph".
const DriverAvatar = ({ driver, isDark, size = 34 }) => {
  const name = driver?.name || '';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const base = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    flexShrink: 0,
    objectFit: 'cover',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${Math.max(10, Math.round(size * 0.36))}px`,
    fontWeight: '700',
    letterSpacing: '0.02em',
    border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    background: isDark ? GOLD_TINT_DARK : GOLD_TINT,
    color: isDark ? GOLD_DARK : GOLD,
    overflow: 'hidden',
  };

  if (driver?.image) {
    return <img src={driver.image} alt={name ? `${name}, driver` : 'Driver'} style={base} />;
  }
  return <span style={base} aria-hidden="true">{initials || '—'}</span>;
};

export default DriverAvatar;
