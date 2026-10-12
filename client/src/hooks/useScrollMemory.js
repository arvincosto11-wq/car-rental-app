import { useEffect, useRef } from 'react';
import { isReturningVisit, initialLoadHandled } from '../utils/navigationType';

// Puts somebody back where they were when they refresh.
//
// Browsers already try to do this, and on a page whose height never
// changes they do it well. This page is not one of those: the reviews
// arrive after the first paint and add about 900px, so the browser
// restores a position the page cannot reach yet, clamps it to whatever
// the bottom is at that instant, and then the reviews land underneath.
// Somebody refreshing at the foot of the page was dropped 900px short of
// where they had been, in the middle of a section they had already read.
//
// So the browser is told not to restore, and this does it afterwards —
// once the content that changes the height is actually in.
//
//   key    where to remember this page's position
//   ready  false while anything that changes the page's height is still
//          loading. The restore waits for it.
//
// Only on a reload or a back/forward, and only on the first one — see
// utils/navigationType.js. Arriving by clicking a link is somebody going
// there fresh, and dropping them halfway down a page they have just
// opened would be worse than any of this.

export default function useScrollMemory(key, ready) {
  const restored = useRef(false);
  const storageKey = `scroll:${key}`;

  // Remember the position as they move. Written on a frame rather than on
  // every scroll event, which fires far more often than it is worth
  // touching storage for.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    let frame = 0;
    const remember = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        try {
          sessionStorage.setItem(storageKey, String(Math.round(window.scrollY)));
        } catch {
          // A private window with storage blocked. Losing the position is
          // not worth an error on somebody's homepage.
        }
      });
    };

    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      window.removeEventListener('scroll', remember);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [storageKey]);

  // And put them back, once there is a page tall enough to hold them.
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const returning = isReturningVisit();
    // Spent whether or not it was used, so the rest of the session treats
    // every navigation as the ordinary kind.
    initialLoadHandled();
    if (!returning) return;

    let saved = 0;
    try {
      saved = Number(sessionStorage.getItem(storageKey)) || 0;
    } catch {
      return;
    }
    if (saved <= 0) return;

    // After paint, so the measurement is of the page as it now is.
    requestAnimationFrame(() => {
      window.scrollTo({ top: saved, behavior: 'instant' });
    });
  }, [ready, storageKey]);
}
