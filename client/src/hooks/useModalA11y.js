import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Standard keyboard behavior for a modal: Escape closes it, focus moves
// into it on open, and Tab is trapped inside while it's open. Attach the
// returned ref to the modal's outer content element. Pass `isOpen` when the
// modal is conditionally rendered inside an always-mounted parent (rather
// than mounted/unmounted as its own component) so the effect re-attaches
// each time it opens.
const useModalA11y = (onClose, isOpen = true) => {
  const containerRef = useRef(null);
  // Latest onClose is read via ref rather than a dependency, so the effect
  // below only re-runs when the modal actually opens/closes — not on every
  // re-render of the parent (which would otherwise steal focus back to the
  // first field each time while the modal is open).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

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
