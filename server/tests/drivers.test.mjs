import { suite, group, check } from './harness.mjs';
import {
  driverProblem, tidyPhone, tidyName, isWorking, publicDriver, MAX_NAME,
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
  const shown = publicDriver({ _id: 'abc', name: 'Juan', phone: '09171234567', note: 'owes petrol money' });
  check('the name is shown', shown.name, 'Juan');
  check('the number is not', shown.phone, undefined);
  check('nor is the office note', shown.note, undefined);
  check('and nothing else came along', Object.keys(shown).sort().join(','), '_id,name');
}
