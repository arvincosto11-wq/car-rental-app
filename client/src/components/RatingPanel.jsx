import { RatingFormFields } from './RatingForm';
import { useRatingForm } from '../utils/ratingForm';

// Rating a trip from inside the trip, rather than over the top of it.
//
// A real component at module scope, not a function called during My
// Bookings' render: the form holds what somebody is halfway through
// typing, and a component declared inside a render is a new type on every
// keystroke, which unmounts the inputs and takes the focus with them.
const RatingPanel = ({ booking, isDark, mb, onClose, onSubmitted }) => {
  const r = useRatingForm(booking);
  const car = [booking.car?.brand, booking.car?.model].filter(Boolean).join(' ') || 'this vehicle';

  return (
    <div style={mb.panel}>
      <div style={mb.panelHead}>
        <span style={mb.panelTitle}>Rate this trip</span>
        <button type="button" style={mb.panelClose} aria-label="Close" onClick={onClose}>×</button>
      </div>

      <RatingFormFields r={r} booking={booking} isDark={isDark} surface={mb.c.card} />

      {r.error && <div style={mb.panelError}>{r.error}</div>}

      <button
        type="button"
        style={mb.panelSubmit(r.ready && !r.submitting)}
        disabled={!r.ready || r.submitting}
        onClick={() => r.submit((carRating, driverRating) => {
          // The server works out the one score from the three, so the
          // confirmation quotes back the number the trip now carries
          // rather than whichever of the three we happened to pick.
          const stars = carRating?.rating;
          onSubmitted(
            carRating,
            driverRating,
            stars
              ? `Thanks — you gave the ${car} ${stars} star${stars === 1 ? '' : 's'}.`
              : `Thanks — your rating for the ${car} is in.`,
          );
        })}
      >
        {r.submitting ? 'Sending…' : 'Send rating'}
      </button>
    </div>
  );
};

export default RatingPanel;
