import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const ChevronIcon = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Animated replacement for a native <select> — a pill button showing the
// current choice, opening into a floating list of options on click. Used
// for Manage Bookings' status changer, in place of the plain browser
// dropdown. `options` is [{ value, label, disabled, color }] — color tints
// just that option's label (in both the trigger and the menu row), so e.g.
// Confirmed/Cancelled read at a glance the same way the table's own status
// badges already do, without repainting the whole pill. Closes on an
// outside click, same pattern as NotificationBell's own dropdown.
const StatusDropdown = ({ value, options, onChange, isDark }) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = options.find((o) => o.value === value);

  const s = {
    wrap: { position: 'relative', display: 'inline-block' },
    trigger: {
      display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a', cursor: 'pointer',
    },
    menu: {
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '150px', zIndex: 50,
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.16)', overflow: 'hidden', padding: '4px',
    },
    item: (disabled, highlighted, color) => ({
      display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderRadius: '6px',
      background: highlighted ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : 'transparent',
      color: disabled ? (isDark ? '#4e4f50' : '#9ca3af') : (color || (isDark ? '#e4e6eb' : '#1a1a1a')),
      fontWeight: color ? '600' : '400',
      fontSize: '12px', cursor: disabled ? 'not-allowed' : 'pointer',
    }),
  };

  return (
    <div ref={ref} style={s.wrap}>
      <button type="button" className="dropdown-item-btn" style={s.trigger} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span style={{ color: current?.color || 'inherit', fontWeight: current?.color ? '600' : '400' }}>{current?.label || value}</span>
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            style={s.menu}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="dropdown-item-btn"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                style={s.item(opt.disabled, opt.value === value || hovered === opt.value, opt.color)}
                onMouseEnter={() => setHovered(opt.value)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { if (!opt.disabled) { onChange(opt.value); setOpen(false); } }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StatusDropdown;
