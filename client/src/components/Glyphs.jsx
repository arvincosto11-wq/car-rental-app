// The small drawn icons that replaced the last emoji in the app.
//
// Emoji render in the system's own emoji font, which picks its own colours:
// on Windows the footer's 📞 📍 🕒 came out red and pink against our gold,
// and 🚗 was the one blue thing on a gold-and-charcoal page. These inherit
// `currentColor` like every other icon here, so they take the colour of the
// text they sit beside, in either theme.
//
// Same hand-drawn family as components/home/HomeIcons.jsx: thin stroke,
// round caps, 24-unit box.
const Glyph = ({ children, size = 15, strokeWidth = 1.9, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0, verticalAlign: '-2px', ...style }}
  >
    {children}
  </svg>
);

export const CarGlyph = (p) => (
  <Glyph {...p}>
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
    <rect x="3" y="11" width="18" height="6" rx="2" />
    <circle cx="7.5" cy="17" r="1.3" />
    <circle cx="16.5" cy="17" r="1.3" />
  </Glyph>
);

export const MotoGlyph = (p) => (
  <Glyph {...p}>
    <circle cx="5.5" cy="16.5" r="3" />
    <circle cx="18.5" cy="16.5" r="3" />
    <path d="M5.5 16.5h5l3-6h3" />
    <path d="M14 7h3l1.5 9.5" />
  </Glyph>
);

export const CalendarGlyph = (p) => (
  <Glyph {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="8" y1="2.5" x2="8" y2="6.5" />
    <line x1="16" y1="2.5" x2="16" y2="6.5" />
  </Glyph>
);

export const FuelGlyph = (p) => (
  <Glyph {...p}>
    <rect x="4" y="3.5" width="9" height="17" rx="2" />
    <line x1="4" y1="9" x2="13" y2="9" />
    <path d="M13 8h3.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0v-5l-2.5-3" />
  </Glyph>
);

export const CameraGlyph = (p) => (
  <Glyph {...p}>
    <path d="M4 8h3l1.6-2.2h6.8L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z" />
    <circle cx="12" cy="13" r="3.4" />
  </Glyph>
);

// "All caught up" — a tick in a circle, not a party popper.
export const DoneGlyph = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12.5 10.8 15.3 16 9.5" />
  </Glyph>
);

export const WarnGlyph = (p) => (
  <Glyph {...p}>
    <path d="M12 3.5 2.8 19.5h18.4z" />
    <line x1="12" y1="9.5" x2="12" y2="14" />
    <line x1="12" y1="16.6" x2="12" y2="16.7" />
  </Glyph>
);

export const RepeatGlyph = (p) => (
  <Glyph {...p}>
    <polyline points="17 1.5 21 5.5 17 9.5" />
    <path d="M3 11.5v-2a4 4 0 0 1 4-4h14" />
    <polyline points="7 22.5 3 18.5 7 14.5" />
    <path d="M21 12.5v2a4 4 0 0 1-4 4H3" />
  </Glyph>
);

export const SunGlyph = (p) => (
  <Glyph {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </Glyph>
);

export const MoonGlyph = (p) => (
  <Glyph {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Glyph>
);

export const StarGlyph = (p) => (
  <Glyph {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </Glyph>
);
