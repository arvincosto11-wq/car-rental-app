// What a booking looks like to somebody who is not admin.
//
// The rating admin gives a client — the stars and the note beside them —
// is written about that person, for the office. Nothing on a client's
// screen has ever shown it, which made it feel private; but their own
// bookings arrive as whole records, so the note sat in the response their
// browser received and anyone curious enough to open the developer tools
// could read what was written about them.
//
// Stripped here rather than hidden there: a screen that chooses not to
// draw something is not the same as not sending it.
export const withoutClientRating = (booking) => {
  // Mongoose documents have to be turned into plain objects before a field
  // can be dropped, and these already are when .lean() or .toJSON() ran.
  const plain = typeof booking?.toObject === 'function' ? booking.toObject() : { ...booking };
  delete plain.clientRating;
  return plain;
};

export const hideClientRatings = (bookings) => bookings.map(withoutClientRating);
