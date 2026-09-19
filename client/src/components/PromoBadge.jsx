import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import { isPromoVisible, promoOffer, promoDateRange } from '../utils/promo';

// The deal marker, shared by the vehicles list, favorites, the homepage
// carousel and the car page — one definition rather than four near-identical
// copies drifting apart.
//
// Solid gold on dark text, not the dark glass the status badges use: those
// report a fact about the vehicle, this is trying to catch an eye. Two lines
// so the offer can be large while the dates stay legible underneath.
const SparkIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }} aria-hidden="true">
    <path d="M12 2l2.2 6.2L20.5 10l-6.3 1.8L12 18l-2.2-6.2L3.5 10l6.3-1.8z" />
    <path d="M18.5 14.5l1 2.6 2.7.9-2.7.9-1 2.6-1-2.6-2.7-.9 2.7-.9z" opacity="0.75" />
  </svg>
);

const PromoBadge = ({ promo, isDark, style, compact = false }) => {
  if (!isPromoVisible(promo)) return null;

  return (
    <span
      className="promo-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '6px' : '7px',
        padding: compact ? '5px 11px' : '7px 13px',
        borderRadius: compact ? '999px' : '12px',
        // A gradient rather than flat gold so the sheen has something to
        // travel across, and the whole thing reads as a physical tag.
        background: isDark
          ? `linear-gradient(135deg, ${GOLD_DARK} 0%, #c98700 100%)`
          : `linear-gradient(135deg, #e8a100 0%, ${GOLD} 100%)`,
        color: ON_GOLD,
        border: '1px solid rgba(255,255,255,0.28)',
        lineHeight: 1.15,
        ...style,
      }}
    >
      <SparkIcon size={compact ? 11 : 14} />
      {compact ? (
        <span style={{ fontSize: '10px', fontWeight: '900', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {promoOffer(promo)} · {promoDateRange(promo)}
        </span>
      ) : (
        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {promoOffer(promo)}
          </span>
          <span style={{ fontSize: '9.5px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', opacity: 0.78 }}>
            {promoDateRange(promo)}
          </span>
        </span>
      )}
    </span>
  );
};

export default PromoBadge;
