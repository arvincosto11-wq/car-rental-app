import { suite, group, check } from './harness.mjs';
import {
  driverProblem, tidyPhone, tidyName, isWorking, publicDriver, MAX_NAME,
  driverFreeFor, driverChoiceProblem, spansOverlap, DRIVER_GAP_HOURS, ratingLabel,
} from '../utils/drivers.js';

export default function run() {
  suite('Drivers');

  group('a driver worth writing down');
  const driver = (over = {}) => ({ name: 'Juan Dela Cruz', phone: '09171234567', ...over });
  check('an ordinary one', driverProblem(driver()), null);
  check('the +63 spelling', driverProblem(driver({ phone: '+639171234567' })), null);
  // How people actually type a number. Rejecting this would be rejecting
  // the number, not the typing.
  check('spaces in the number', driverProblem(driver({ phone: '0917 123 4567' })), null);
  check('dashes in the number', driverProblem(driver({ phone: '0917-123-4567' })), null);

  group('what it refuses');
  check('no name', !!driverProblem(driver({ name: '' })), true);
  check('one letter', !!driverProblem(driver({ name: 'J' })), true);
  // A name with no letters is a typo, not a person.
  check('punctuation for a name', !!driverProblem(driver({ name: '...' })), true);
  check('a very long name', !!driverProblem(driver({ name: 'x'.repeat(MAX_NAME + 1) })), true);
  check('the longest allowed', driverProblem(driver({ name: 'a'.repeat(MAX_NAME) })), null);
  // The point of the record is being able to ring somebody on the morning
  // they are meant to be driving, so this is required rather than optional.
  check('no phone', !!driverProblem(driver({ phone: '' })), true);
  check('a landline', !!driverProblem(driver({ phone: '0521234567' })), true);
  check('too few digits', !!driverProblem(driver({ phone: '091712345' })), true);
  check('too many digits', !!driverProblem(driver({ phone: '091712345678' })), true);
  check('letters in the number', !!driverProblem(driver({ phone: '0917abcdefg' })), true);
  check('nothing at all', !!driverProblem(), true);

  group('tidying up before it is stored');
  // Stored without spacing so the same person cannot be entered twice in
  // two spellings and slip past the unique index on the number.
  check('spaces come out', tidyPhone('0917 123 4567'), '09171234567');
  check('dashes come out', tidyPhone('0917-123-4567'), '09171234567');
  check('both spellings land on the same string', tidyPhone('0917 123-4567'), tidyPhone('09171234567'));
  check('a missing number is empty, not a crash', tidyPhone(undefined), '');
  check('a name loses its edges', tidyName('  Juan  '), 'Juan');
  check('and its double spaces', tidyName('Juan   Dela   Cruz'), 'Juan Dela Cruz');

  group('who can be offered at all');
  check('a working driver', isWorking({ active: true }), true);
  // Default for a record written before the field existed.
  check('one with nothing set', isWorking({}), true);
  check('one switched off', isWorking({ active: false }), false);
  check('nobody', isWorking(null), false);

  group('what a customer is allowed to see');
  // A driver list appears on a booking page. Their mobile numbers have no
  // business being on it.
  const shown = publicDriver({ _id: 'abc', name: 'Juan', phone: '09171234567', note: 'owes petrol money', image: 'https://x/j.jpg' });
  check('the name is shown', shown.name, 'Juan');
  // A face is shown on purpose: somebody waiting outside their house needs
  // to know who has just pulled up.
  check('and the photo', shown.image, 'https://x/j.jpg');
  check('the number is not', shown.phone, undefined);
  check('nor is the office note', shown.note, undefined);
  // The rating goes out too: a list of strangers to choose between tells
  // somebody nothing without it.
  check('and the rating', publicDriver({ _id: 'a', name: 'J', avgRating: 4.8, ratingCount: 9 }).avgRating, 4.8);
  check('with how many trips it is from', publicDriver({ _id: 'a', name: 'J', avgRating: 4.8, ratingCount: 9 }).ratingCount, 9);
  check('and nothing else came along', Object.keys(shown).sort().join(','), '_id,avgRating,image,name,ratingCount');
  // Named outward rather than deleted inward, so a field added to the
  // record later cannot leak by being forgotten about here.
  const future = publicDriver({ _id: 'abc', name: 'Juan', somethingAddedLater: 'secret' });
  check('a field added later does not leak', future.somethingAddedLater, undefined);
  check('no photo is an empty string, not undefined', publicDriver({ _id: 'a', name: 'J' }).image, '');

  group('one driver, one trip at a time');
  // Monday the 12th, 9 AM to Wednesday the 14th, 9 AM in Legazpi. UTC here
  // because these are compared as instants, which is how they are stored.
  const at = (day, hour) => new Date(Date.UTC(2026, 9, day, hour - 8));
  const trip = { start: at(12, 9), end: at(14, 9) };

  check('nobody booked, anybody is free', driverFreeFor(trip, []), true);
  check('the same days are not free', driverFreeFor(trip, [{ start: at(12, 9), end: at(14, 9) }]), false);
  check('a day inside it is not either', driverFreeFor(trip, [{ start: at(13, 9), end: at(13, 17) }]), false);
  check('one that swallows it whole', driverFreeFor(trip, [{ start: at(10, 9), end: at(20, 9) }]), false);
  // Overlapping at one end is still overlapping.
  check('a trip that runs into it', driverFreeFor(trip, [{ start: at(11, 9), end: at(13, 9) }]), false);
  check('and one that starts inside it', driverFreeFor(trip, [{ start: at(13, 9), end: at(16, 9) }]), false);
  // Somebody else's trip, far away, is nothing to do with this one.
  check('the week before is fine', driverFreeFor(trip, [{ start: at(5, 9), end: at(7, 9) }]), true);
  check('the week after too', driverFreeFor(trip, [{ start: at(20, 9), end: at(22, 9) }]), true);
  check('several trips, none of them clashing', driverFreeFor(trip, [
    { start: at(5, 9), end: at(7, 9) }, { start: at(20, 9), end: at(22, 9) },
  ]), true);
  check('several, one of them clashing', driverFreeFor(trip, [
    { start: at(5, 9), end: at(7, 9) }, { start: at(13, 9), end: at(16, 9) },
  ]), false);

  group('the gap between trips');
  // Somebody dropping off in Tabaco at nine cannot start another trip in
  // Camalig at nine. Two hours either side, same as the vehicles.
  check('back to back is not free', driverFreeFor(trip, [{ start: at(9, 9), end: at(12, 9) }]), false);
  check('an hour before the start is too soon', driverFreeFor(trip, [{ start: at(9, 9), end: at(12, 8) }]), false);
  check('a clear gap is free', driverFreeFor(trip, [{ start: at(9, 9), end: at(12, 9 - DRIVER_GAP_HOURS - 1) }]), true);
  check('and the same after it', driverFreeFor(trip, [{ start: at(14, 9 + DRIVER_GAP_HOURS + 1), end: at(16, 9) }]), true);
  check('exactly the gap is still too tight', driverFreeFor(trip, [{ start: at(14, 9), end: at(16, 9) }]), false);

  group('what the booking form and the server both refuse');
  const free = { name: 'Juan', active: true };
  const taken = [{ start: at(13, 9), end: at(13, 17) }];
  check('a free, working driver passes', driverChoiceProblem(free, trip, []), null);
  check('one who is out that week does not', !!driverChoiceProblem(free, trip, taken), true);
  check('nor does one who is not working', !!driverChoiceProblem({ name: 'Juan', active: false }, trip, []), true);
  // No driver is a legitimate answer: the customer left it to the office,
  // or nobody was free when they booked.
  check('nobody chosen is allowed', driverChoiceProblem(null, trip, taken), null);

  group('spans');
  check('overlapping', spansOverlap({ start: at(12, 9), end: at(14, 9) }, { start: at(13, 9), end: at(15, 9) }), true);
  // Touching at the edge is not overlapping; the gap above is what keeps
  // back-to-back trips apart, not this.
  check('touching is not overlapping', spansOverlap({ start: at(12, 9), end: at(14, 9) }, { start: at(14, 9), end: at(15, 9) }), false);
  check('apart', spansOverlap({ start: at(12, 9), end: at(13, 9) }, { start: at(15, 9), end: at(16, 9) }), false);
  // A booking with no dates cannot be checked, so nobody is free for it.
  check('no dates means nobody is free', driverFreeFor(null, []), false);

  group('how a rating reads');
  // A driver in their first week has not been judged badly, and an empty
  // row of stars says they have.
  check('nobody has rated them yet', ratingLabel({ ratingCount: 0 }), 'New driver');
  check('nor a driver with no fields at all', ratingLabel({}), 'New driver');
  check('nor nobody', ratingLabel(null), 'New driver');
  check('one trip is singular', ratingLabel({ avgRating: 5, ratingCount: 1 }), '5.0 · 1 trip');
  check('several are not', ratingLabel({ avgRating: 4.8, ratingCount: 12 }), '4.8 · 12 trips');
  // Always one decimal, so a column of them lines up.
  check('a whole number still shows its decimal', ratingLabel({ avgRating: 4, ratingCount: 3 }), '4.0 · 3 trips');

  group('days off count as busy too');
  // A block is handed to the same rule as a trip, because every caller is
  // asking one question: can this person do these dates. A rota that only
  // looked at trips would cheerfully book somebody who is in hospital.
  const dayOff = { start: at(13, 0), end: at(14, 0) };
  check('a day off inside the trip', driverFreeFor(trip, [dayOff]), false);
  check('a day off well clear of it', driverFreeFor(trip, [{ start: at(1, 0), end: at(2, 0) }]), true);
  check('a trip and a day off together', driverFreeFor(trip, [{ start: at(1, 0), end: at(2, 0) }, dayOff]), false);
  // "Off the 12th to the 14th" is stored as midnight on the 12th to
  // midnight on the 15th, so the 14th really is covered.
  const offTwelfthToFourteenth = { start: at(12, 0), end: at(15, 0) };
  check('the last day off is included', driverFreeFor({ start: at(14, 9), end: at(14, 17) }, [offTwelfthToFourteenth]), false);
  check('and the day after is not', driverFreeFor({ start: at(15, 9), end: at(15, 17) }, [offTwelfthToFourteenth]), true);
  // The gap applies to days off as well: back from leave at midnight does
  // not mean driving at midnight.
  check('a trip right after leave ends', driverFreeFor({ start: at(15, 1), end: at(15, 9) }, [offTwelfthToFourteenth]), false);
}
