// The × that closes a dialog.
//
// One component because there were seven of these, each a slightly
// different circle — 30px here, 32px there, one with a border, one with no
// background at all that read as a stray character sitting in the corner.
// A control people reach for without looking should be in the same place,
// at the same size, on every screen.
//
// Visible on purpose: a filled circle with a ring and a shadow, rather than
// a bare glyph. It sits over content it has to be legible against, and a
// close button nobody can find is a dialog people escape by clicking the
// backdrop and hoping.
//
//   floating  pinned to the top-right of the dialog. The parent needs
//             position: relative, and must not be the element that
//             scrolls — otherwise this scrolls away with the content,
//             which is exactly what it must never do.
// extraStyle is for the odd dialog that is neither pinned nor sitting in a
// header row — a drawer, where it has to be pushed to the right edge of a
// column. Everything else should need only `floating`.
const ModalClose = ({ onClose, isDark, floating = true, label = 'Close', extraStyle }) => {
  const style = {
    ...(floating ? { position: 'absolute', top: '14px', right: '14px', zIndex: 2 } : {}),
    width: '34px',
    height: '34px',
    flexShrink: 0,
    borderRadius: '50%',
    cursor: 'pointer',
    padding: 0,
    border: `1px solid ${isDark ? '#4a4b4c' : '#d1d5db'}`,
    background: isDark ? '#3a3b3c' : '#e5e7eb',
    color: isDark ? '#e4e6eb' : '#1a1a1a',
    fontSize: '15px',
    fontWeight: '700',
    lineHeight: 1,
    boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.45)' : '0 2px 8px rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...extraStyle,
  };

  return (
    <button
      type="button"
      // Opts out of the page-wide hover lift: on a 34px circle pinned to a
      // corner, a 2px jump reads as the dialog wobbling. It answers by
      // picking up the accent instead.
      className="modal-close-btn"
      style={style}
      onClick={onClose}
      aria-label={label}
    >
      ✕
    </button>
  );
};

export default ModalClose;
