import { motion, AnimatePresence } from 'motion/react';

const s = {
  video: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 },
  // Fixed dark scrim + white text rather than theme-toggled colors — same
  // approach as the Home hero's photo overlay: text sitting over video
  // content needs to stay legible against the footage itself, independent
  // of the site's own light/dark mode.
  overlay: { position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(23,19,14,0.45), rgba(23,19,14,0.68))', zIndex: 1 },
  content: { position: 'relative', zIndex: 2, textAlign: 'center' },
  logo: { width: '72px', height: '72px', borderRadius: '50%', marginBottom: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.45)' },
  title: { fontSize: '26px', color: '#ffffff', marginBottom: '10px', textShadow: '0 2px 12px rgba(0,0,0,0.35)' },
  subtitle: { fontSize: '14px', color: 'rgba(255,255,255,0.85)', maxWidth: '250px', margin: '0 auto', lineHeight: '1.6' },
};

// Shared branding side for the split-panel auth pages (Login, Register) —
// looping video + logo + heading. `tagline` is swappable by the caller
// (Register changes it per wizard step) and crossfades via the keyed
// AnimatePresence below instead of jump-cutting; the logo/heading fade-in
// above it only plays once, on mount, since that motion.div doesn't remount
// when the tagline prop changes.
const AuthBrandPanel = ({ tagline }) => (
  <>
    <video style={s.video} src="/login-bg.mp4" autoPlay muted loop playsInline />
    <div style={s.overlay} />
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={s.content}
    >
      <img src="/logo.png" alt="Rent-a-Ride Albay" style={s.logo} />
      <h2 className="display-heading" style={s.title}>Rent-a-Ride Albay</h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={tagline}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={s.subtitle}
        >
          {tagline}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  </>
);

export default AuthBrandPanel;
