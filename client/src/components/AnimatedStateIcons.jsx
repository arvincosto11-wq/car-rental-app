import { motion } from 'motion/react';

// 4 icons that morph between two states, driven directly by real app
// state via the `active` prop (e.g. active={isFavorite}). Ported from a
// shadcn/Tailwind/TypeScript set (21st.dev) to plain JSX using the
// `motion` package already in this project — no Tailwind/shadcn, no new
// dependencies. This set originally had 12 icons with an internal demo
// timer so an /icon-preview page could show them free-running; the other
// 8 were never wired into the app, so they and that page were removed,
// along with the now-unused timer machinery.

/* ─── MENU → CLOSE ─── hamburger morphs to X */
export function MenuCloseIcon({ size = 40, color = 'currentColor', className, active }) {
  const open = active;
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} style={{ width: size, height: size }}>
      <motion.line x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={open
          ? { y1: 20, y2: 20, rotate: 45 }
          : { y1: 12, y2: 12, rotate: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: '20px 20px' }}
      />
      <motion.line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: '20px 20px' }}
      />
      <motion.line x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={open
          ? { y1: 20, y2: 20, rotate: -45 }
          : { y1: 28, y2: 28, rotate: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: '20px 20px' }}
      />
    </svg>
  );
}

/* ─── BELL → NOTIFICATION ─── bell rings then dot appears. `showDot` can
   be turned off when the caller already renders its own count badge. */
export function AnimatedNotificationIcon({ size = 40, color = 'currentColor', className, active, showDot = true }) {
  const notif = active;
  return (
    <motion.svg viewBox="0 0 40 40" fill="none" className={className}
      animate={notif ? { rotate: [0, 8, -8, 6, -6, 3, 0] } : { rotate: 0 }}
      transition={{ duration: 0.6 }}
      style={{ width: size, height: size, transformOrigin: '20px 6px' }}>
      <path d="M28 16a8 8 0 00-16 0c0 8-4 10-4 10h24s-4-2-4-10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 30a3 3 0 005 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {showDot && (
        <motion.circle cx="28" cy="10" r="4" fill="#EF4444"
          animate={notif
            ? { scale: [0, 1.3, 1], opacity: 1 }
            : { scale: 0, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        />
      )}
    </motion.svg>
  );
}

/* ─── HEART → FILLED ─── heart fills with bounce */
export function AnimatedHeartIcon({ size = 40, color = 'currentColor', className, active }) {
  const filled = active;
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} style={{ width: size, height: size }}>
      <motion.path
        d="M20 34s-12-7.5-12-16a7.5 7.5 0 0112-6 7.5 7.5 0 0112 6c0 8.5-12 16-12 16z"
        stroke={filled ? '#EF4444' : color}
        strokeWidth={2}
        fill={filled ? '#EF4444' : 'none'}
        animate={filled ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: '20px 22px' }}
      />
    </svg>
  );
}

/* ─── EYE → HIDDEN ─── eye opens/closes with slash */
export function EyeToggleIcon({ size = 40, color = 'currentColor', className, active }) {
  const hidden = active;
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} style={{ width: size, height: size }}>
      <motion.path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        animate={hidden ? { opacity: 0.3 } : { opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.circle cx="20" cy="20" r="5" stroke={color} strokeWidth={2}
        animate={hidden ? { scale: 0.6, opacity: 0.2 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.line x1="6" y1="34" x2="34" y2="6" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={hidden ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.25 }}
      />
    </svg>
  );
}
