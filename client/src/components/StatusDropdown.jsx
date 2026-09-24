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
// Roughly what one row and the menu's own padding come to. Only used to
// decide which way to open before the menu exists to be measured; being a
// few pixels out just means flipping up slightly earlier than needed.
const ROW_HEIGHT = 32;
const MENU_PADDING = 8;

const StatusDropdown = ({ value, options, onChange, isDark }) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [at, setAt] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // A menu anchored inside the table was cut off at the table's edge: the
  // table rounds its corners with overflow hidden, and .table-scroll scrolls
  // sideways, which clips vertically too. On the Pending tab with a single
  // booking there was nothing below to spill over, so the list appeared as a
  // sliver. Measuring the trigger and drawing the menu in viewport
  // coordinates takes it out of both containers.
  useEffect(() => {
    // Cleared on close so a reopen never flashes at where the row used to
    // be before the effect below corrects it.
    if (!open) { setAt(null); return undefined; }
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const needed = options.length * ROW_HEIGHT + MENU_PADDING;
      const below = window.innerHeight - r.bottom;
      setAt({
        left: r.left,
        // Opens upward when the row sits near the bottom of the window,
        // which is exactly where a short list of results leaves it.
        top: below < needed + 12 && r.top > needed ? r.top - needed - 4 : r.bottom + 4,
      });
    };
    place();
    // Scrolling would leave the menu behind, since it is no longer attached
    // to the row. Closing is honest and costs one click.
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, options.length]);

  const current = options.find((o) => o.value === value);

  const s = {
    wrap: { position: 'relative', display: 'inline-block' },
    trigger: {
      display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a', cursor: 'pointer',
    },
    menu: {
      position: 'fixed', top: at?.top ?? 0, left: at?.left ?? 0, minWidth: '150px', zIndex: 1200,
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
        {open && at && (
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
