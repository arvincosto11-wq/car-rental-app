import { useState, useEffect } from 'react';
import { goldInk } from '../theme';

// Whether a tick drawn on this swatch should be dark or white. The usual
// luminance sum — white, beige and silver need dark ink, navy and maroon
// need light.
const isLight = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
};

// Curated list of real vehicle colors, each with a swatch hex for the picker.
// Keeping this closed-ended is what makes the field "valid" — an admin can
// only pick a real color, never mistype something like "asdf".
export const CAR_COLORS = [
  { name: 'White', hex: '#f8fafc' },
  { name: 'Black', hex: '#111827' },
  { name: 'Silver', hex: '#c3c8cf' },
  { name: 'Gray', hex: '#6b7280' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Brown', hex: '#78350f' },
  { name: 'Beige', hex: '#e3d5b8' },
  { name: 'Gold', hex: '#d4af37' },
  { name: 'Maroon', hex: '#7f1d1d' },
  { name: 'Navy', hex: '#1e3a8a' },
];

// Only letters, spaces and hyphens survive in the "Other" box — enough to
// keep the field a plausible color name (e.g. "Pearl White") without
// blocking legitimate custom colors the preset list doesn't cover.
const sanitize = (raw) => raw.replace(/[^a-zA-Z\s-]/g, '').slice(0, 30);

// Classic edit-distance, used to catch typos like "bloack" -> "Black".
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Nearest preset color name for a typed string, within a typo-sized distance.
function suggestColor(typed) {
  const t = typed.trim().toLowerCase();
  if (t.length < 3) return null;
  let best = null;
  let bestDist = Infinity;
  for (const c of CAR_COLORS) {
    const name = c.name.toLowerCase();
    if (name === t) return null;
    const dist = levenshtein(t, name);
    if (dist < bestDist) { bestDist = dist; best = c.name; }
  }
  const threshold = t.length <= 4 ? 1 : 2;
  return bestDist <= threshold ? best : null;
}

const ColorPicker = ({ id, value, onChange, isDark }) => {
  const matchesPreset = CAR_COLORS.some((c) => c.name.toLowerCase() === (value || '').trim().toLowerCase());
  const [customMode, setCustomMode] = useState(!!value && !matchesPreset);
  const suggestion = customMode ? suggestColor(value || '') : null;

  useEffect(() => {
    if (value && !CAR_COLORS.some((c) => c.name.toLowerCase() === value.trim().toLowerCase())) {
      setCustomMode(true);
    }
  }, [value]);

  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';
  const goldLine = isDark ? 'rgba(232,161,0,0.45)' : '#e6c77a';

  const chipGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: '8px' };
  const chip = (on) => ({
    display: 'flex', alignItems: 'center', gap: '9px', minHeight: '40px', padding: '0 10px',
    borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontSize: '12.5px',
    border: on ? `1.5px solid ${goldLine}` : `1px solid ${line}`,
    background: on ? goldTint : 'transparent',
    color: on ? goldInk(isDark) : (isDark ? '#e4e6eb' : '#1a1a1a'),
  });
  const swatch = {
    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'}`,
  };
  return (
    <div>
      {/* Named chips rather than bare circles. A row of coloured dots asks
          somebody to tell silver from grey by eye, and a screen reader got
          nothing but a label nobody could see. */}
      <div style={chipGrid} role="radiogroup" aria-label="Colour">
        {CAR_COLORS.map((c) => {
          const selected = !customMode && (value || '').trim().toLowerCase() === c.name.toLowerCase();
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => { setCustomMode(false); onChange(c.name); }}
              style={chip(selected)}
            >
              <span style={{ ...swatch, background: c.hex }}>
                {selected && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={isLight(c.hex) ? '#17130e' : '#fff'} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="5 13 10 18 19 7" />
                  </svg>
                )}
              </span>
              <span style={{ fontWeight: selected ? 800 : 500 }}>{c.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={customMode}
          onClick={() => setCustomMode(true)}
          style={{ ...chip(customMode), borderStyle: 'dashed' }}
        >
          <span style={{
            ...swatch,
            background: 'conic-gradient(#dc2626, #eab308, #16a34a, #2563eb, #7c3aed, #dc2626)',
          }} />
          <span style={{ fontWeight: customMode ? 800 : 500 }}>Custom…</span>
        </button>
      </div>
      {customMode && (
        <>
          <input
            id={id}
            type="text"
            placeholder="Type a color name, e.g. Pearl White"
            value={value}
            onChange={(e) => onChange(sanitize(e.target.value))}
            style={{
              width: '100%', marginTop: '8px', padding: '8px 10px',
              border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
              borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              color: isDark ? '#e4e6eb' : '#111827', background: isDark ? '#18191a' : '#fff',
            }}
          />
          {suggestion && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: isDark ? '#fca5a5' : '#dc2626' }}>
              ⚠ Please enter a valid color.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ColorPicker;
