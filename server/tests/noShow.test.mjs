import { suite, group, check } from './harness.mjs';
import { isAbandoned, wasCollected, NO_SHOW_REASON } from '../utils/noShow.js';
import { phInstant } from '../utils/appointments.js';

export default function run() {
  suite('No-shows');

  // The sweep runs on the morning of 15 October in Legazpi.
  const dayStart = phInstant('2026-10-15', 0);
  const booking = (over = {}) => ({
    status: 'confirmed',
    startDate: phInstant('2026-10-12', 9),
    endDate: phInstant('2026-10-14', 9),
    ...over,
  });

  group('what proves a vehicle went out');
  check('the counter recorded the handover', wasCollected(booking({ collectedAt: phInstant('2026-10-12', 9) })), true);
  // They could hardly ask to keep it longer without having it.
  check('or they asked to keep it longer', wasCollected(booking({ extensions: [{ previousEndDate: new Date() }] })), true);
  check('neither, so nothing says it went out', wasCollected(booking()), false);
  check('an empty extension list proves nothing', wasCollected(booking({ extensions: [] })), false);
  check('nothing at all does not crash', wasCollected(null), false);

  group('which bookings were abandoned');
  check('dates gone by, never collected', isAbandoned(booking(), dayStart), true);
  check('collected, so it was a real trip', isAbandoned(booking({ collectedAt: phInstant('2026-10-12', 9) }), dayStart), false);
  check('extended, so it was a real trip', isAbandoned(booking({ extensions: [{}] }), dayStart), false);

  group('and which are none of its business');
  // Still running. The counter can still record a late handover from the
  // overlooked list, and cancelling a trip somebody is on would be worse
  // than waiting.
  const stillRunning = booking({ endDate: phInstant('2026-10-16', 9) });
  check('dates not finished yet', isAbandoned(stillRunning, dayStart), false);
  // Due back this very morning. Not abandoned at one minute past midnight.
  check('due back today', isAbandoned(booking({ endDate: phInstant('2026-10-15', 9) }), dayStart), false);
  check('a pending request', isAbandoned(booking({ status: 'pending' }), dayStart), false);
  check('one already cancelled', isAbandoned(booking({ status: 'cancelled' }), dayStart), false);
  check('one already completed', isAbandoned(booking({ status: 'completed' }), dayStart), false);
  check('one with no dates at all', isAbandoned(booking({ endDate: null }), dayStart), false);
  check('nothing at all', isAbandoned(null, dayStart), false);

  group('the words it uses');
  // The same sentence the counter's own no-show writes, because it is the
  // same thing — and a client comparing two emails should not find two
  // different explanations for why their money is gone.
  check('says the money is forfeited', NO_SHOW_REASON.includes('forfeited'), true);
  check('and why', NO_SHOW_REASON.includes('did not show up'), true);
  check('and that the terms say so', NO_SHOW_REASON.includes('booking terms'), true);
}
