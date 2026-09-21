// Why a vehicle is off the road for a range of dates.
//
// Two separate things, deliberately: the CODE decides what the customer is
// told, and the note is private. Before this, admin typed one free-text
// reason that was passed straight through to any client whose booking got
// cancelled — so an internal remark like "bumper wrecked by last renter"
// would show up on a customer's booking page.
//
// This file has no imports so the client keeps an identical copy (see
// client/src/utils/blockReasons.js) — the admin preview of what a client
// will read is built by the very same function that writes it.
export const BLOCK_REASONS = {
  maintenance: { label: 'Maintenance or servicing', cause: 'scheduled maintenance' },
  repair: { label: 'Repairs', cause: 'necessary repairs' },
  // Neither of these tells the customer whose car it is or whose fault it
  // was — they only need to know they're being refunded.
  owner_use: { label: 'Owner is using the vehicle', cause: 'unforeseen circumstances' },
  other: { label: 'Other', cause: 'unforeseen circumstances' },
};

export const BLOCK_REASON_CODES = Object.keys(BLOCK_REASONS);

// The phrase that follows "unavailable due to". Never the private note.
export const causeFor = (code) => BLOCK_REASONS[code]?.cause || 'unforeseen circumstances';

// What admin and the owner see in the blocked-dates list. Falls back to the
// old free-text field for ranges saved before codes existed.
export const blockLabelFor = (block) =>
  BLOCK_REASONS[block?.reasonCode]?.label || block?.reason || '';

// Always read in Legazpi time. A booking collected at 7:00 AM is stored as
// 11:00 PM the previous day in UTC, so formatting these in UTC would name
// the wrong day back to the client in a cancellation message. Bookings from
// before pickup times existed sit at UTC midnight, which is still the same
// day in Legazpi, so they read correctly either way.
const fmt = (d) => new Date(d).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
});

export const formatTripDates = (startDate, endDate) => `${fmt(startDate)} to ${fmt(endDate)}`;

// The full message a client receives when the business pulls a vehicle
// they've booked. Names the car and the dates so it can't be mistaken for a
// different booking, and states the refund as a figure rather than "your
// money" so there's nothing to chase.
export const vehicleUnavailableMessage = ({ carName, startDate, endDate, cause, amount }) => {
  const trip = carName ? `the ${carName} you booked` : 'the vehicle you booked';
  const when = startDate && endDate ? ` for ${formatTripDates(startDate, endDate)}` : '';
  const refund = amount > 0
    ? ` Your booking has been cancelled, and the full amount paid of ₱${Number(amount).toLocaleString()} will be refunded.`
    : ' Your booking has been cancelled.';
  return `We regret to inform you that ${trip}${when} is unavailable due to ${cause}.${refund}` +
    ' We sincerely apologize for the inconvenience.';
};
