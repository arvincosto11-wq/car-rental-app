import { suite, group, check } from './harness.mjs';
import {
  penaltyState, waiveBlocker, waiveSummary, isWaiveReason, penaltyNoun,
  waiveReasonLabel, PENALTY_KINDS,
} from '../utils/penalties.js';

const late = (over = {}) => ({ lateFee: { amount: 3248, days: 3, collectedAt: null, ...over } });
const fuel = (over = {}) => ({ fuel: { charge: 800, collectedAt: null, ...over } });
const damage = (over = {}) => ({ condition: { damageCharge: 5000, damageCollectedAt: null, ...over } });

export default function run() {
  suite('Penalties');

  group('all three charges answer the same questions');
  check('late fee', penaltyState(late(), 'late_fee').gross, 3248);
  check('refuelling', penaltyState(fuel(), 'fuel').gross, 800);
  // Damage keeps its collected flag under a different name, which is
  // exactly the sort of difference that produces three slightly different
  // screens if each one reads the fields itself.
  check('damage', penaltyState(damage(), 'damage').gross, 5000);
  check('damage settles through its own field', penaltyState(damage({ damageCollectedAt: new Date() }), 'damage').settled, true);
  check('every kind is covered', PENALTY_KINDS.length, 3);
  check('an unknown kind is nothing', penaltyState(late(), 'parking'), null);

  group('what is actually owed');
  check('nothing waived, all of it', penaltyState(late(), 'late_fee').payable, 3248);
  check('waived in full', penaltyState(late({ waivedAmount: 3248 }), 'late_fee').payable, 0);
  check('and it says so', penaltyState(late({ waivedAmount: 3248 }), 'late_fee').waivedFully, true);
  // Half is a real answer: "I'll let you off the weekend but not the three
  // days" is a conversation that happens.
  const half = penaltyState(late({ waivedAmount: 1248 }), 'late_fee');
  check('partly waived still owes the rest', half.payable, 2000);
  check('and is not a full waiver', half.waivedFully, false);
  check('it is a partial one', half.waivedPartly, true);

  group('the original figure is never lost');
  // The whole point of recording a waiver instead of zeroing the charge:
  // the booking can still say what was owed in the first place.
  const forgiven = penaltyState(late({ waivedAmount: 3248, waivedReason: 'goodwill' }), 'late_fee');
  check('gross survives', forgiven.gross, 3248);
  check('alongside what was let off', forgiven.waived, 3248);
  check('and why', forgiven.waivedReason, 'goodwill');

  group('a waiver bigger than the charge');
  // Nothing should ever read as the business owing the client money.
  const over = penaltyState(late({ waivedAmount: 99999 }), 'late_fee');
  check('clamped to the charge', over.waived, 3248);
  check('never negative', over.payable, 0);

  group('what is still outstanding');
  check('an unwaived, uncollected charge', penaltyState(late(), 'late_fee').outstanding, true);
  check('collected is not outstanding', penaltyState(late({ collectedAt: new Date() }), 'late_fee').outstanding, false);
  check('waived in full is not outstanding', penaltyState(late({ waivedAmount: 3248 }), 'late_fee').outstanding, false);
  check('but partly waived still is', penaltyState(late({ waivedAmount: 1000 }), 'late_fee').outstanding, true);
  // A charge of zero is not a charge, so nothing should draw a row for it.
  check('no charge at all', penaltyState(late({ amount: 0 }), 'late_fee').exists, false);
  check('and nothing is owed on it', penaltyState(late({ amount: 0 }), 'late_fee').outstanding, false);

  group('what cannot be waived');
  check('a charge that does not exist', !!waiveBlocker(late({ amount: 0 }), 'late_fee', 100), true);
  // Money that has already changed hands is a refund, and refunds go back
  // the way they came.
  check('one already collected', waiveBlocker(late({ collectedAt: new Date() }), 'late_fee', 3248).includes('Refund it'), true);
  check('one already waived', !!waiveBlocker(late({ waivedAmount: 500 }), 'late_fee', 100), true);
  check('more than the charge itself', !!waiveBlocker(late(), 'late_fee', 9999), true);
  check('nothing at all', !!waiveBlocker(late(), 'late_fee', 0), true);
  check('a negative amount', !!waiveBlocker(late(), 'late_fee', -500), true);
  check('an unknown kind', !!waiveBlocker(late(), 'parking', 100), true);
  check('a fair waiver passes', waiveBlocker(late(), 'late_fee', 3248), null);
  check('so does a partial one', waiveBlocker(late(), 'late_fee', 1000), null);

  group('the reason is not free text');
  // Counted at the end of a year, "goodwill" written forty ways is forty
  // different reasons.
  check('a known reason', isWaiveReason('goodwill'), true);
  check('made up', isWaiveReason('because i felt like it'), false);
  check('empty', isWaiveReason(''), false);
  check('it has a label', waiveReasonLabel('our_fault'), 'Our fault');

  group('what the screen prints');
  check('nothing when nothing is waived', waiveSummary(penaltyState(late(), 'late_fee')), '');
  check('a full waiver', waiveSummary(penaltyState(late({ waivedAmount: 3248, waivedReason: 'goodwill' }), 'late_fee')), 'waived — goodwill');
  check('a partial one names the amount',
    waiveSummary(penaltyState(late({ waivedAmount: 1248, waivedReason: 'our_fault' }), 'late_fee')),
    '₱1,248 off — our fault');
  check('each charge is named', penaltyNoun('fuel'), 'refuelling charge');

  group('a booking from before any of this');
  // Every waiver field absent, which is every booking already in the
  // database on the day this ships.
  const old = { lateFee: { amount: 1500, days: 1 } };
  check('still reads as owed', penaltyState(old, 'late_fee').payable, 1500);
  check('nothing waived', penaltyState(old, 'late_fee').waived, 0);
  check('and is outstanding', penaltyState(old, 'late_fee').outstanding, true);
  check('an empty booking does not crash', penaltyState({}, 'late_fee').exists, false);
  check('nor a missing one', penaltyState(null, 'late_fee').exists, false);
}
