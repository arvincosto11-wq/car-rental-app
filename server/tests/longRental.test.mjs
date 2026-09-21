import { suite, group, check, checkRefused } from './harness.mjs';
import {
  bestLongRentalRule, longRentalDiscountOn, longRentalLabel, rulesForCar,
  findInversions, findRuleConflicts, conflictMessage, validateLongRentalRule,
} from '../utils/longRental.js';

const rule = (id, minDays, percent, extra = {}) => ({
  _id: id, minDays, percent, appliesTo: 'all', cars: [], active: true, ...extra,
});

const nameOf = (id) => ({ bmw: 'BMW X5', vios: 'Toyota Vios' }[id] || 'A vehicle');

export default function run() {
  suite('Long-rental discount rules');

  group('the best qualifying rule wins, and only one applies');
  const tiers = [rule('a', 7, 10), rule('b', 30, 20)];
  check('a 7-day trip', bestLongRentalRule(tiers, 'bmw', 7).percent, 10);
  check('a 29-day trip', bestLongRentalRule(tiers, 'bmw', 29).percent, 10);
  // 30 days meets both. The client gets 20%, not 30%.
  check('a 30-day trip takes the bigger one', bestLongRentalRule(tiers, 'bmw', 30).percent, 20);
  check('a 6-day trip qualifies for nothing', bestLongRentalRule(tiers, 'bmw', 6), null);
  check('the label names the threshold', longRentalLabel(tiers[0]), 'Long-rental discount (7+ days)');
  check('10% of 14,000', longRentalDiscountOn(tiers[0], 14000), 1400);

  group('which vehicles a rule reaches');
  const selected = rule('s', 7, 10, { appliesTo: 'selected', cars: ['bmw'] });
  check('the chosen vehicle', rulesForCar([selected], 'bmw').length, 1);
  check('any other vehicle', rulesForCar([selected], 'vios').length, 0);
  check('a paused rule reaches nothing', rulesForCar([rule('p', 7, 10, { active: false })], 'bmw').length, 0);

  group('two rules that start at the same length clash');
  const existing = [rule('a', 7, 10)];
  const sameLength = findRuleConflicts(rule('new', 7, 15), existing, null);
  check('spotted', sameLength.length, 1);
  check('named for what it is', sameLength[0].kind, 'same-length');
  checkRefused('and explained', conflictMessage(sameLength, nameOf, rule('new', 7, 15)), 'already');

  group('a longer trip that saves no more would never apply');
  // The real case: a BMW already has 7+ days at 10%, and 8+ days at 10% is
  // added. Anyone booking 8 days already has the 10%, so the new rule
  // changes no price at all.
  const noGain = findRuleConflicts(rule('new', 8, 10), existing, null);
  check('spotted', noGain.length, 1);
  check('named for what it is', noGain[0].kind, 'no-gain');
  checkRefused('and says what would fix it', conflictMessage(noGain, nameOf, rule('new', 8, 10)), 'bigger discount');

  group('tiers that step up are fine');
  check('30+ days at 12% over 7+ days at 10%', findRuleConflicts(rule('new', 30, 12), existing, null).length, 0);
  check('editing a rule does not clash with itself', findRuleConflicts(rule('a', 7, 12), existing, 'a').length, 0);
  check('a paused rule is not in the way', findRuleConflicts(rule('new', 7, 15), [rule('a', 7, 10, { active: false })], null).length, 0);

  group('rules on different vehicles do not clash');
  const onBmw = rule('a', 7, 10, { appliesTo: 'selected', cars: ['bmw'] });
  const onVios = rule('new', 7, 15, { appliesTo: 'selected', cars: ['vios'] });
  check('separate vehicles', findRuleConflicts(onVios, [onBmw], null).length, 0);
  check('but an all-vehicles rule reaches both', findRuleConflicts(rule('new', 7, 15), [onBmw], null).length, 1);

  group('a longer trip must never cost less than a shorter one');
  // 20% off at 7 days means seven days costs the same as 5.6 — undercutting
  // six days at full price.
  const steep = findInversions([rule('a', 7, 20)]);
  check('spotted', steep.length, 1);
  check('at the day it starts', steep[0].days, 7);
  check('a gentler 10% is fine', findInversions([rule('a', 7, 10)]).length, 0);
  check('and so is a gentle second tier', findInversions([rule('a', 7, 10), rule('b', 30, 12)]).length, 0);
  // Not obvious, and worth having written down: stepping 10% to 15% at 30
  // days makes a 30-day trip cost 25.5 days' worth against 26.1 for 29, so
  // the longer trip is cheaper. The guard is right to flag it.
  const steepTier = findInversions([rule('a', 7, 10), rule('b', 30, 15)]);
  check('but too big a step still inverts', steepTier.length, 1);
  check('at the day the step happens', steepTier[0].days, 30);

  group('what admin is allowed to save');
  check('a sensible rule', validateLongRentalRule({ minDays: 7, percent: 10, appliesTo: 'all' }), null);
  checkRefused('a one-day "long" rental', validateLongRentalRule({ minDays: 1, percent: 10, appliesTo: 'all' }), 'whole number');
  checkRefused('over 50%', validateLongRentalRule({ minDays: 7, percent: 60, appliesTo: 'all' }), 'between 1% and 50%');
  checkRefused('selected vehicles with none ticked', validateLongRentalRule({ minDays: 7, percent: 10, appliesTo: 'selected', cars: [] }), 'tick at least one');
}
