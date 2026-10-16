// How late a return is said out loud. Hours below a day, whole days above
// it — the same days the late fee was charged on.

import { suite, group, check } from './harness.mjs';
import { hoursLate, latenessLabel, overdueLabel, lateChip } from '../utils/lateness.js';

export default function run() {
  suite('Returns · how late, in words');

  const due = '2026-10-10T23:00:00Z';

  group('measuring it');
  check('back on time', hoursLate(due, '2026-10-10T23:00:00Z'), 0);
  check('back early', hoursLate(due, '2026-10-10T20:00:00Z'), 0);
  check('five hours over', hoursLate(due, '2026-10-11T04:00:00Z'), 5);
  check('nothing to measure against', hoursLate(null, '2026-10-11T04:00:00Z'), 0);
  check('never came back', hoursLate(due, null), 0);

  group('saying it');
  check('on time says nothing at all', latenessLabel(0), '');
  check('minutes', latenessLabel(0.5), 'Returned under an hour late');
  check('an afternoon', latenessLabel(5, 1), 'Returned 5 h late');
  // Still a full day on the bill, but five hours is what happened.
  check('rounded to the nearest hour', latenessLabel(5.4, 1), 'Returned 5 h late');
  check('just under a day', latenessLabel(23.6, 1), 'Returned 24 h late');

  group('a day or more speaks in days');
  check('a day', latenessLabel(24, 1), 'Returned 1 day late');
  // Charged two days, so it says two: the page and the money agree.
  check('a day and a bit', latenessLabel(30, 2), 'Returned 2 days late');
  check('three days', latenessLabel(72, 3), 'Returned 3 days late');
  // Nothing charged on file: fall back to whole days elapsed.
  check('with no charge recorded', latenessLabel(50, 0), 'Returned 2 days late');

  group('a vehicle that is still out');
  // Three hours past its time is not a lost day, and saying so sends
  // somebody chasing a client who is probably on their way.
  check('a few hours over', overdueLabel(3, 1), '3 h overdue');
  check('a day over', overdueLabel(26, 2), '2 days overdue');
  check('barely over', overdueLabel(0.4), 'Under an hour overdue');
  check('not over at all', overdueLabel(0), '');

  group('the chip beside a row');
  check('hours', lateChip(7, 1), '7 h late');
  check('days', lateChip(49, 3), '3 days late');
  check('nothing to say', lateChip(0), '');
}
