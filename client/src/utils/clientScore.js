// How the office's score for a client reads, in one place, so Manage
// Bookings and Manage Clients never word it differently.
//
// The count is always said out loud. A single harsh rating shows as 1.0,
// and a bare 1.0 reads like a verdict on the person rather than on one
// rental — "1.0 from 1 rental" is the same number with its weight
// attached. Nobody is rated below 1, so a stored 0 means never rated.
export const hasClientScore = (user) => (user?.ratingCount || 0) > 0;

export const clientScoreLabel = (user) => {
  const count = user?.ratingCount || 0;
  if (!count) return 'Not rated yet';
  return `${(user.avgRating || 0).toFixed(1)} from ${count} rental${count === 1 ? '' : 's'}`;
};
