// Brand accent (gold, pulled from the Rent-A-Ride Philippines logo ring).
// Used for primary buttons, links, active nav/tab states, and selected toggles.
// Red stays reserved for destructive/error actions (delete, decline, cancel) —
// unchanged from before, so it never collides with the new accent.
export const GOLD = '#b8790a';
export const GOLD_DARK = '#e8a100';
export const GOLD_TINT = '#faedc7';
export const GOLD_TINT_DARK = 'rgba(232,161,0,0.15)';
export const GOLD_TINT_BORDER = '#edd693';
export const GOLD_TINT_BORDER_DARK = '#5a4415';
export const ON_GOLD = '#17130e';

// Gold as TEXT, which is a different colour from gold as a fill.
//
// #b8790a is a fine button or border, but as small text on a white card it
// measures about 3.5:1 — under the 4.5:1 small text needs to stay legible.
// It looked merely soft on a big screen and turned to haze on a phone in
// daylight. The darker ink reads at about 7:1 and still looks like the same
// gold. Dark mode never had the problem: #e8a100 on #242526 is already 7:1.
//
// Use this for any gold lettering or line icon. Keep GOLD for what it is
// good at — filled buttons, borders, backgrounds — where 3:1 is the bar and
// the brighter tone is the point.
export const GOLD_INK = '#7c4a03';
export const GOLD_INK_DARK = GOLD_DARK;

export const accent = (isDark) => (isDark ? GOLD_DARK : GOLD);
export const goldInk = (isDark) => (isDark ? GOLD_INK_DARK : GOLD_INK);
