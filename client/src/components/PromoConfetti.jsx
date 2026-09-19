import { useEffect, useState } from 'react';
import { GOLD, GOLD_DARK } from '../theme';

// Two origins, because the two places this fires have different shapes.
//
// 'fan'   — price breakdown: pieces go up and out from the top edge, where
//           there's open space above.
// 'burst' — vehicle card: a full circle from the middle of the photo. The
//           card clips its own corners, so a short radius from the centre
//           keeps every piece inside the frame instead of being cut off
//           mid-flight.
const PIECE_COUNT = 18;

const build = (mode) =>
  Array.from({ length: PIECE_COUNT }, (_, i) => {
    const full = mode === 'burst';
    // Laid out on an even spread rather than at random, so the burst looks
    // the same every time instead of occasionally clumping to one side.
    const deg = full
      ? (i / PIECE_COUNT) * 360
      : (i / (PIECE_COUNT - 1)) * 140 - 70;
    const rad = (deg * Math.PI) / 180;
    const distance = full ? 52 + (i % 4) * 11 : 70 + (i % 4) * 16;
    return {
      dx: `${Math.sin(rad) * distance}px`,
      // Gravity pulls the tail of the arc back down.
      dy: `${-Math.cos(rad) * distance + (full ? 22 : 54)}px`,
      rot: `${(i % 2 ? 1 : -1) * (180 + (i % 5) * 60)}deg`,
      stagger: (i % 6) * 22,
      shade: i % 3,
    };
  });

const PIECES = { fan: build('fan'), burst: build('burst') };

const PromoConfetti = ({ fireKey, isDark, mode = 'fan', delayMs = 0 }) => {
  const [burst, setBurst] = useState(null);

  useEffect(() => {
    if (!fireKey) return undefined;
    setBurst(fireKey);
    // 1.1s animation + the longest stagger + this card's own delay. Pieces
    // are removed rather than left sitting invisible over the content.
    const t = setTimeout(() => setBurst(null), 1500 + delayMs);
    return () => clearTimeout(t);
  }, [fireKey, delayMs]);

  if (!burst) return null;

  const colors = [isDark ? GOLD_DARK : GOLD, '#ffd479', isDark ? '#e4e6eb' : '#ffffff'];
  const originTop = mode === 'burst' ? '50%' : '0';

  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
      {PIECES[mode].map((p, i) => (
        <span
          key={`${burst}-${i}`}
          className="promo-confetti-piece"
          style={{
            top: originTop,
            background: colors[p.shade],
            animationDelay: `${delayMs + p.stagger}ms`,
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
