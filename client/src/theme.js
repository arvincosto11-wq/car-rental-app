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

export const accent = (isDark) => (isDark ? GOLD_DARK : GOLD);
