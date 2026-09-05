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

const ColorPicker = ({ id, value, onChange, isDark }) => {
  const matchesPreset = CAR_COLORS.some((c) => c.name.toLowerCase() === (value || '').trim().toLowerCase());
  const [customMode, setCustomMode] = useState(!!value && !matchesPreset);

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
      )}
    </div>
  );
};

export default ColorPicker;
