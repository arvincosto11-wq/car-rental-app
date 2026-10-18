import { GOLD, GOLD_DARK } from '../theme';

// Stars somebody actually taps, as opposed to StarRating, which draws a
// score already given. The difference is not cosmetic: picking a rating
// on a phone needs real buttons at a real tap size, and a text ★ in a
// span is neither. StarRating stays as it is for the read-only case,
// where it is a glyph beside a number and nothing is clickable.
const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';

const STAR_LABELS = ['Tap a star', 'Poor', 'Not great', 'Okay', 'Good', 'Great'];

const StarPicker = ({ value = 0, onChange, isDark, label, id }) => {
  const gold = isDark ? GOLD_DARK : GOLD;
  const idle = isDark ? '#4a4b4d' : '#cfcbc2';

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }} role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="icon-toggle-btn"
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-pressed={n === value}
          onClick={() => onChange(n)}
          style={{
            width: '44px', height: '44px', border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, color: n <= value ? gold : idle,
          }}
        >
          <svg
            width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"
            fill={n <= value ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
          >
            <path d={STAR} />
          </svg>
        </button>
      ))}
      <span
        id={id}
        aria-live="polite"
        style={{
          marginLeft: '6px', fontSize: '13px',
          color: isDark ? '#b0b3b8' : '#5f5c55',
        }}
      >
        {STAR_LABELS[value] || STAR_LABELS[0]}
      </span>
    </span>
  );
};

export default StarPicker;
