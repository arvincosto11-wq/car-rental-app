import { useEffect } from 'react';

// Fades and lifts an element the first time it scrolls into view.
//
// The rule that matters here is the resting state: everything renders
// fully visible, and only this hook — once it is running and knows it can
// finish the job — hides anything. Nothing is ever `opacity: 0` in the
// markup or in a stylesheet. The failure mode of the usual approach is a
// page where the script does not run and the words are simply gone, which
// is a far worse page than one that does not animate.
//
// It also only hides what is still below the fold at mount. Something
// already on screen has nothing to reveal, and hiding it would make the
// first paint flicker.
//
// Marked up with data attributes rather than refs, so a section can add a
// revealing element without threading anything through props:
//
//   <div data-reveal>                       reveals on sight
//   <div data-reveal data-reveal-delay="70">  ...70ms after it is seen
//
// Delays are per element and relative to that element entering the view,
// which is what makes a row of cards arrive as a row rather than as a
// queue timed from when the section began.
const DURATION = 350;
const LIFT = 14;

export default function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    // Somebody who has asked for less motion gets none: nothing is hidden,
    // so nothing has to be revealed.
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return undefined;

    const viewport = window.innerHeight;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const delay = Number(el.getAttribute('data-reveal-delay')) || 0;
        el.style.transition = `opacity ${DURATION}ms ease-out ${delay}ms, `
          + `transform ${DURATION}ms cubic-bezier(.2,.7,.2,1) ${delay}ms`;
        el.style.opacity = '1';
        el.style.transform = 'none';
        // Once seen, it stays seen. Re-animating on the way back up reads
        // as the page forgetting what it had already shown somebody.
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    const hidden = [];
    root.querySelectorAll('[data-reveal]').forEach((el) => {
      if (el.getBoundingClientRect().top < viewport * 0.92) return;
      el.style.opacity = '0';
      el.style.transform = `translateY(${LIFT}px)`;
      hidden.push(el);
      observer.observe(el);
    });

    return () => {
      observer.disconnect();
      // Leaving an element mid-hide on unmount would strand it invisible
      // if the same node is reused.
      hidden.forEach((el) => {
        el.style.opacity = '';
        el.style.transform = '';
        el.style.transition = '';
      });
    };
  }, [rootRef]);
}
