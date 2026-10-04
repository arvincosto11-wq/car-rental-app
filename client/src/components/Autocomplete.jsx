import { useState, useRef, useEffect } from 'react';
import { GOLD, GOLD_DARK, goldInk } from '../theme';

// A text box that suggests as you type, rather than a dropdown you scroll.
//
// A list of thirty brands is worse to scroll than to type three letters of,
// and a dropdown with an "Other" escape hatch needs two controls under one
// label to say one thing. This is one control: type, pick a suggestion if
// one fits, or keep what you typed if none does.
//
// It never refuses a value. The lists cover what is on the road in Albay,
// not everything ever built, so an unmatched entry has to go through — the
// empty "no matches" line is the hint, not a gate. What it does do is make
// the recognised answer the easy one, which is most of what a validation
// rule was ever going to achieve here.
//
// Keyboard and pointer both work: arrows move, Enter picks, Escape closes,
// a tap picks. Options commit on mousedown rather than click, because blur
// fires first on a click and would close the list out from under the finger.
const MAX_SUGGESTIONS = 8;

// Things that start with what was typed come before things that merely
// contain it: typing "ma" should offer Mazda before Yamaha.
const rank = (options, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, MAX_SUGGESTIONS);
  const starts = options.filter((o) => o.toLowerCase().startsWith(q));
  const contains = options.filter((o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
};

const Autocomplete = ({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
  isDark,
  // Shown under the box when nothing matches. Deliberately phrased as
  // information, not a complaint.
  emptyHint = "Not on our list — that's fine, we'll check it when you come in.",
}) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);

  const suggestions = open ? rank(options, value || '') : [];
  const exactMatch = options.some((o) => o.toLowerCase() === String(value || '').trim().toLowerCase());
  const showEmptyHint = open && !!String(value || '').trim() && suggestions.length === 0;

  // A click anywhere else closes it. Pointerdown rather than click so it
  // beats the next control taking focus.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const pick = (option) => {
    onChange(option);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setHighlight(-1); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (!suggestions.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((h) => (h + step + suggestions.length) % suggestions.length);
      return;
    }
    // Enter only commits a suggestion somebody has actually moved onto.
    // Otherwise it belongs to the form, so typing a brand we don't know and
    // pressing Enter does not silently become the nearest one we do.
    if (e.key === 'Enter' && open && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      pick(suggestions[highlight]);
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    wrap: { position: 'relative' },
    input: {
      width: '100%', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: disabled ? (isDark ? '#242526' : '#f3f4f6') : (isDark ? '#18191a' : '#fff'),
      color: isDark ? '#e4e6eb' : '#111827',
    },
    list: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 1200,
      margin: 0, padding: '4px', listStyle: 'none', maxHeight: '240px', overflowY: 'auto',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '8px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
    },
    option: (on) => ({
      // Comfortably tappable: a 13px line of text is not a touch target.
      padding: '10px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
      background: on ? (isDark ? 'rgba(232,161,0,0.14)' : 'rgba(184,121,10,0.10)') : 'transparent',
      color: on ? goldInk(isDark) : (isDark ? '#e4e6eb' : '#1a1a1a'),
      fontWeight: on ? '700' : '500',
    }),
    hint: { fontSize: '11.5px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '5px', lineHeight: 1.5 },
    tick: { color: isDark ? '#4ade80' : '#15803d', fontWeight: '700' },
  };

  const listId = `${id}-suggestions`;

  return (
    <div style={s.wrap} ref={wrapRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={highlight >= 0 && suggestions[highlight] ? `${listId}-${highlight}` : undefined}
        autoComplete="off"
        style={{ ...s.input, borderColor: open ? gold : s.input.borderColor }}
        placeholder={placeholder}
        disabled={disabled}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && suggestions.length > 0 && (
        <ul style={s.list} id={listId} role="listbox">
          {suggestions.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              style={s.option(i === highlight)}
              onMouseEnter={() => setHighlight(i)}
              // mousedown, not click: blur fires first on a click and would
              // close the list before the pick landed.
              onMouseDown={(e) => { e.preventDefault(); pick(option); }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}

      {showEmptyHint && <p style={s.hint}>{emptyHint}</p>}
      {!open && exactMatch && <p style={s.hint}><span style={s.tick}>✓</span> On our list</p>}
    </div>
  );
};

export default Autocomplete;
