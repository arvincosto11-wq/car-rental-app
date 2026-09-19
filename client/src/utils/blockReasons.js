// Why a vehicle is off the road for a range of dates.
//
// Two separate things, deliberately: the CODE decides what the customer is
// told, and the note is private. Before this, admin typed one free-text
// reason that was passed straight through to any client whose booking got
// cancelled — so an internal remark like "bumper wrecked by last renter"
// would show up on a customer's booking page.
export const BLOCK_REASONS = {
  maintenance: {
    label: 'Maintenance or servicing',
    client: 'the vehicle is undergoing scheduled maintenance',
  },
  repair: {
    label: 'Repairs',
    client: 'the vehicle is undergoing repairs',
  },
  owner_use: {
    label: 'Owner is using the vehicle',
    client: 'the vehicle is unavailable for these dates',
  },
  other: {
    label: 'Other',
    client: 'the vehicle is unavailable for these dates',
  },
};

export const BLOCK_REASON_CODES = Object.keys(BLOCK_REASONS);

// What a client is told. Never the private note, and never a raw code.
export const clientTextFor = (code) =>
  BLOCK_REASONS[code]?.client || 'the vehicle is unavailable for these dates';

// What admin and the owner see in the blocked-dates list. Falls back to the
// old free-text field for ranges saved before codes existed.
export const blockLabelFor = (block) =>
  BLOCK_REASONS[block?.reasonCode]?.label || block?.reason || '';
