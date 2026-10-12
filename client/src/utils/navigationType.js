// Whether this page was arrived at by reloading or stepping back, rather
// than by somebody clicking a link to it.
//
// The browser only answers this about the DOCUMENT — how the tab got here
// — and that answer never changes while the tab is open. Asking it in the
// middle of a single-page app is a trap: after one reload, every later
// click of "Home" still looks like a reload, so a page that scrolls to the
// top on arrival quietly stops doing it for the rest of the session. That
// is exactly the bug this file exists to avoid.
//
// So it is read once, and spent once. The first load of the document may
// use it; after that it is nobody's business and every navigation is what
// it appears to be.
const [entry] = typeof performance !== 'undefined'
  ? (performance.getEntriesByType?.('navigation') || [])
  : [];

const arrivedByReturning = !!entry && (entry.type === 'reload' || entry.type === 'back_forward');

let spent = false;

// True only while the very first render after a reload or a back step is
// still being dealt with.
export const isReturningVisit = () => arrivedByReturning && !spent;

// Called by whoever acted on it, once the page has settled.
export const initialLoadHandled = () => { spent = true; };
