import { useState, useEffect } from 'react';
import { GOLD, GOLD_DARK } from '../theme';

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

  const accent = isDark ? GOLD_DARK : GOLD;
  const ring = (selected) => selected
    ? { border: `2px solid ${accent}`, boxShadow: `0 0 0 2px ${isDark ? '#0f172a' : '#fff'}, 0 0 0 4px ${accent}` }
    : { border: `2px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}` };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {CAR_COLORS.map((c) => {
          const selected = !customMode && (value || '').trim().toLowerCase() === c.name.toLowerCase();
          return (
            <button
              key={c.name}
              type="button"
              title={c.name}
              aria-label={c.name}
              aria-pressed={selected}
              onClick={() => { setCustomMode(false); onChange(c.name); }}
              style={{
                width: '26px', height: '26px', borderRadius: '50%', background: c.hex,
                cursor: 'pointer', padding: 0, flexShrink: 0, ...ring(selected),
              }}
            />
          );
        })}
        <button
          type="button"
          title="Other color"
          aria-label="Other color"
          aria-pressed={customMode}
          onClick={() => setCustomMode(true)}
          style={{
            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, padding: 0, cursor: 'pointer',
            background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
            ...ring(customMode),
          }}
        />
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
              border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
              borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              color: isDark ? '#f1f5f9' : '#111827', background: isDark ? '#0f172a' : '#fff',
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
