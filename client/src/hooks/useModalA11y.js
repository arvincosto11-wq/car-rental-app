import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// How many modals are open right now, across the whole app.
//
// A count rather than a flag, because modals stack here: "Before You
// Confirm" opens over the booking dialog, and Terms over both. With a flag,
// closing the inner one would hand scrolling back to the page while the
// outer one was still covering it — the bug this exists to stop, wearing a
// different hat.
let openModals = 0;
let restoreTo = null;

const lockPage = () => {
  openModals += 1;
  if (openModals > 1) return;

  const { body, documentElement: html } = document;
  // Taking the scrollbar away makes the page a few pixels wider, so
  // everything on it slides right the moment a dialog opens. Padding by
  // exactly the width that disappeared keeps it still.
  const scrollbar = window.innerWidth - html.clientWidth;
  restoreTo = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  body.style.overflow = 'hidden';
  if (scrollbar > 0) {
    const current = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbar}px`;
  }
};

const unlockPage = () => {
  openModals = Math.max(0, openModals - 1);
  if (openModals > 0) return;
  // Deferred by a microtask because one modal replacing another unmounts
  // the first before mounting the second: restoring immediately would let
  // the scrollbar flash back for a frame between the two. By the time this
  // runs, the replacement has already counted itself in.
  queueMicrotask(() => {
    if (openModals > 0 || !restoreTo) return;
    document.body.style.overflow = restoreTo.overflow;
    document.body.style.paddingRight = restoreTo.paddingRight;
    restoreTo = null;
  });
};

// Standard keyboard behavior for a modal: Escape closes it, focus moves
// into it on open, and Tab is trapped inside while it's open. The page
// behind is also held still — a fixed backdrop covers the page but does
// nothing to stop it scrolling under the pointer. Attach the returned ref
// to the modal's outer content element. Pass `isOpen` when the modal is
// conditionally rendered inside an always-mounted parent (rather than
// mounted/unmounted as its own component) so the effect re-attaches each
// time it opens.
const useModalA11y = (onClose, isOpen = true) => {
  const containerRef = useRef(null);
  // Latest onClose is read via ref rather than a dependency, so the effect
  // below only re-runs when the modal actually opens/closes — not on every
  // re-render of the parent (which would otherwise steal focus back to the
  // first field each time while the modal is open).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Its own effect, so the page is held even on a dialog whose ref never
  // gets attached — the focus effect below gives up early in that case,
  // and the lock has nothing to do with focus anyway.
  useEffect(() => {
    if (!isOpen) return undefined;
    lockPage();
    return unlockPage;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const focusable = container.querySelectorAll(FOCUSABLE);
    (focusable[0] || container).focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = container.querySelectorAll(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return containerRef;
};

export default useModalA11y;
