// Two vehicles cannot carry the same plate. Written after the live system
// was found holding ABC 1237 twice.

import { suite, group, check } from './harness.mjs';
import { plateKey, plateClash, plateClashMessage } from '../utils/plates.js';

export default function run() {
  suite('Vehicles · plates');

  const fleetless = [
    { _id: 'a', brand: 'Toyota', model: 'Avanza', plateNumber: 'ABC 1237' },
    { _id: 'b', brand: 'Nissan', model: 'Almera', plateNumber: 'ABC 1337' },
    { _id: 'c', brand: 'Honda', model: 'Civic', plateNumber: '' },
    { _id: 'd', brand: 'Toyota', model: 'Wigo', plateNumber: 'XYZ 9999', archived: true },
  ];

  group('what counts as the same plate');
  check('spacing is not a difference', plateKey('ABC 1234'), plateKey('ABC1234'));
  check('neither is case', plateKey('abc 1234'), plateKey('ABC 1234'));
  check('nor punctuation', plateKey('abc-1234'), plateKey('ABC 1234'));
  check('nothing is nothing', plateKey(''), '');
  check('and so is missing', plateKey(undefined), '');

  group('taking a plate another vehicle holds');
  check('caught', plateClash('ABC 1237', fleetless)?.model, 'Avanza');
  check('however it is typed', plateClash('abc1237', fleetless)?.model, 'Avanza');
  check('a free plate is free', plateClash('ZZZ 1111', fleetless), null);

  group('what never clashes');
  // Vehicles added before the field existed have no plate. Two blanks are
  // not a duplicate, or neither could ever be saved again.
  check('a blank plate', plateClash('', fleetless), null);
  // Editing a vehicle must not trip over the vehicle being edited.
  check('a vehicle keeping its own plate', plateClash('ABC 1237', fleetless, 'a'), null);
  // A retired vehicle should not hold its plate hostage.
  check('a plate on an archived vehicle', plateClash('XYZ 9999', fleetless), null);

  group('what the office is told');
  const message = plateClashMessage(fleetless[0]);
  check('names the plate', message.includes('ABC 1237'), true);
  check('and the vehicle holding it', message.includes('Toyota Avanza'), true);
}
