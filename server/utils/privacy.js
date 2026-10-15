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

// The office's running score for a client — the average of every rating
// admin has given them, and how many there are. Same reasoning as the
// rating itself: it is written about the person, for the office. Their
// own profile arrives as a whole record, so without this the number sat
// in the response their own browser received.
export const withoutOfficeScore = (user) => {
  const plain = typeof user?.toObject === 'function' ? user.toObject() : { ...user };
  delete plain.avgRating;
  delete plain.ratingCount;
  return plain;
};
