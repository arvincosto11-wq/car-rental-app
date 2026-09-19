import { useEffect, useState } from 'react';
import { GOLD, GOLD_DARK } from '../theme';

// One-shot burst for the moment a customer's picked dates actually qualify
// for a promo. Deliberately not used on the listing badges: a burst that
// repeats, or fires on six cards at once, stops reading as a celebration.
//
// Pieces are laid out on a fan rather than at random, so the burst looks the
// same every time instead of occasionally clumping to one side.
const PIECE_COUNT = 18;

const PIECES = Array.from({ length: PIECE_COUNT }, (_, i) => {
  // -70deg to +70deg, measured from straight up.
  const spread = (i / (PIECE_COUNT - 1)) * 140 - 70;
  const rad = (spread * Math.PI) / 180;
  const distance = 70 + (i % 4) * 16;
  return {
    dx: `${Math.sin(rad) * distance}px`,
    // Up first, then gravity pulls the tail of the arc back down.
    dy: `${-Math.cos(rad) * distance + 54}px`,
    rot: `${(i % 2 ? 1 : -1) * (180 + (i % 5) * 60)}deg`,
    delay: `${(i % 6) * 22}ms`,
    shade: i % 3,
  };
});

const PromoConfetti = ({ fireKey, isDark }) => {
  const [burst, setBurst] = useState(null);

  useEffect(() => {
    if (!fireKey) return undefined;
    setBurst(fireKey);
    // Matches the 1.1s animation plus the longest stagger — the pieces are
    // removed rather than left sitting invisible over the price breakdown.
    const t = setTimeout(() => setBurst(null), 1400);
    return () => clearTimeout(t);
  }, [fireKey]);

  if (!burst) return null;

  const colors = [isDark ? GOLD_DARK : GOLD, '#ffd479', isDark ? '#e4e6eb' : '#ffffff'];

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 2 }}>
      {PIECES.map((p, i) => (
        <span
          key={`${burst}-${i}`}
          className="promo-confetti-piece"
          style={{
            background: colors[p.shade],
            animationDelay: p.delay,
            '--dx': p.dx,
            '--dy': p.dy,
            '--rot': p.rot,
          }}
        />
      ))}
    </div>
  );
};

export default PromoConfetti;
