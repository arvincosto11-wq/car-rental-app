import { suite, group, check } from './harness.mjs';
import {
  haversineKm, isPoint, legQuote, deliveryQuote, deliverySettings, deliveryRefusal, DEFAULTS,
} from '../utils/delivery.js';
import { repriceForSwap } from '../utils/moveVehicle.js';
import { instantFrom } from '../utils/phTime.js';

const BASE = DEFAULTS.base;
const LEGAZPI = { lat: 13.1391, lng: 123.7438 };
const TABACO = { lat: 13.3587, lng: 123.7330 };
const MANILA = { lat: 14.5995, lng: 120.9842 };

// Nothing saved yet: every quote must still work off the defaults, because
// this is what the system does on the day it launches.
const unset = null;

export default function run() {
  suite('Delivery');

  group('distance on the ground, not across the map');
  // Camalig to Legazpi is about 14 km by road. Straight-line puts it at
  // 10.5, which is the whole reason the road factor exists — quoting the
  // 10.5 would have us driving 14 and charging for 10.
  check('straight line understates it', Math.round(haversineKm(BASE, LEGAZPI) * 10) / 10, 10.5);
  check('with the road allowance', legQuote(LEGAZPI, unset).km, 13.6);
  check('the same both ways', Math.round(haversineKm(LEGAZPI, BASE) * 10) / 10, 10.5);
  check('a point against itself is zero', haversineKm(BASE, BASE), 0);

  group('what a leg costs');
  // 13.6 km, first 3 free, 10.6 chargeable at ₱25.
  check('Legazpi', legQuote(LEGAZPI, unset).fee, 265);
  check('and shows its working', legQuote(LEGAZPI, unset).chargeableKm, 10.6);
  check('Tabaco, further out', legQuote(TABACO, unset).fee, 638);

  // The default place is the base itself. This is the common booking and
  // it must never look like an error or carry a fee.
  check('no place chosen is the base', legQuote(null, unset).atBase, true);
  check('and costs nothing', legQuote(null, unset).fee, 0);
  check('and is always allowed', legQuote(null, unset).ok, true);

  group('the free allowance');
  const near = { lat: BASE.lat + 0.01, lng: BASE.lng };
  check('inside it, nothing to pay', legQuote(near, unset).fee, 0);
  check('but the distance is still reported', legQuote(near, unset).km > 0, true);
  // Exactly at the edge is inside it — charging a peso for the metre after
  // three kilometres is the kind of detail that makes a customer argue.
  const settings = { delivery: { freeKm: 13.6, ratePerKm: 25 } };
  check('the boundary is free', legQuote(LEGAZPI, settings).fee, 0);

  group('how far we go');
  check('Manila is not a delivery', legQuote(MANILA, unset).ok, false);
  check('and says why', legQuote(MANILA, unset).reason, 'too_far');
  check('with no fee attached to a refusal', legQuote(MANILA, unset).fee, 0);
  // This is the answer to "what if somebody books from outside Albay": they
  // are told before paying, not after.
  check('the refusal names the limit', deliveryRefusal('too_far', unset).includes('60 km'), true);

  group('handover at base only');
  const off = { delivery: { enabled: false } };
  check('a place is refused', legQuote(LEGAZPI, off).ok, false);
  check('but the base itself still works', legQuote(null, off).ok, true);

  group('two legs are two trips');
  // Delivered to Legazpi, collected from Tabaco: both drives happen, so
  // both are charged. Charging once would charge for the shorter one.
  const both = deliveryQuote(LEGAZPI, TABACO, unset);
  check('each leg priced separately', both.pickup.fee + both.return.fee, 903);
  check('and that is the total', both.fee, 903);
  check('same place both ways is still two trips', deliveryQuote(LEGAZPI, LEGAZPI, unset).fee, 530);
  check('base to base is free', deliveryQuote(null, null, unset).fee, 0);
  // One bad leg fails the whole booking rather than quietly charging for
  // the half we can do.
  check('one unreachable leg refuses both', deliveryQuote(LEGAZPI, MANILA, unset).ok, false);
  check('and carries no fee', deliveryQuote(LEGAZPI, MANILA, unset).fee, 0);

  group('a point that is not a point');
  check('nothing', isPoint(null), false);
  check('missing a side', isPoint({ lat: 13 }), false);
  check('strings', isPoint({ lat: '13', lng: '123' }), false);
  check('off the planet', isPoint({ lat: 913, lng: 123 }), false);
  check('NaN', isPoint({ lat: NaN, lng: 123 }), false);
  check('a real one', isPoint(LEGAZPI), true);
  // A tampered request lands here. It must refuse, not price it as free.
  check('refused, not free', legQuote({ lat: 'x', lng: 'y' }, unset).ok, false);

  group('settings that are half filled in');
  // One blank field in the admin form must not make every quote NaN.
  const partial = deliverySettings({ delivery: { ratePerKm: 40 } });
  check('keeps what was set', partial.ratePerKm, 40);
  check('fills in the rest', partial.freeKm, DEFAULTS.freeKm);
  check('and the base', partial.base.lat, DEFAULTS.base.lat);
  check('a negative rate is floored at zero', deliverySettings({ delivery: { ratePerKm: -5 } }).ratePerKm, 0);
  // Below 1 would mean the road is shorter than the straight line.
  check('the road factor cannot shrink the drive', deliverySettings({ delivery: { roadFactor: 0.2 } }).roadFactor, 1);
  check('nothing at all still works', deliverySettings(null).ratePerKm, DEFAULTS.ratePerKm);
  // The browser holds the flattened form the API serves and hands it
  // straight back to legQuote. If that round trip lost the settings, the
  // quote on screen and the fee charged would differ while each looked
  // right on its own.
  const stored = { base: DEFAULTS.base, delivery: { ratePerKm: 40, freeKm: 1 } };
  const flat = deliverySettings(stored);
  check('flattening twice changes nothing', deliverySettings(flat).ratePerKm, 40);
  check('nor the free distance', deliverySettings(flat).freeKm, 1);
  check('and a quote off the flat form agrees', legQuote(LEGAZPI, flat).fee, legQuote(LEGAZPI, stored).fee);
  check('and a quote off it is a number', Number.isFinite(legQuote(LEGAZPI, null).fee), true);

  group('moving the base moves the price');
  // Admin repins to Legazpi: the Legazpi delivery is now free, Camalig is
  // not. Future quotes only — a booking keeps the fee it was quoted.
  const moved = { base: { label: 'Legazpi City', lat: LEGAZPI.lat, lng: LEGAZPI.lng } };
  check('the new base is free', legQuote(LEGAZPI, moved).fee, 0);
  check('and the old one is not', legQuote(BASE, moved).fee, 265);

  group('the fee survives the vehicle changing');
  // 5 days at ₱2,000 plus ₱265 delivered to Legazpi. Swapping to a cheaper
  // vehicle on day three must reprice the DAYS and leave the delivery
  // alone: that drive happened once, and it did not happen again because a
  // different car finished the trip.
  const delivered = {
    totalDays: 5, totalPrice: 10265, deliveryFee: 265, hasPickupTime: true,
    startDate: instantFrom('2026-09-25', 7), endDate: instantFrom('2026-09-30', 7),
  };
  const day3 = new Date('2026-09-27T12:00:00+08:00');
  // 2 x 2,000 + 3 x 1,500 + 265.
  check('days repriced, delivery kept', repriceForSwap(delivered, 1500, day3).newTotal, 8765);
  // The fee is in both totals, so it cancels: the client is owed exactly
  // what the cheaper vehicle saves, not that plus their delivery back.
  check('and it does not leak into the difference', repriceForSwap(delivered, 1500, day3).difference, -1500);
  check('same rate still changes nothing', repriceForSwap(delivered, 2000, day3).difference, 0);

  // Without the carve-out the fee would be spread across the day rate and
  // partly charged again. Proving it against the same trip undelivered is
  // the clearest way to say what the carve-out is for.
  const undelivered = { ...delivered, totalPrice: 10000, deliveryFee: 0 };
  check('matches the same trip with no delivery, plus the fee',
    repriceForSwap(delivered, 1500, day3).newTotal,
    repriceForSwap(undelivered, 1500, day3).newTotal + 265);

  // A booking made before any of this existed has no deliveryFee at all.
  const legacy = { totalDays: 5, totalPrice: 10000, hasPickupTime: true,
    startDate: instantFrom('2026-09-25', 7), endDate: instantFrom('2026-09-30', 7) };
  check('an older booking is unaffected', repriceForSwap(legacy, 1500, day3).newTotal, 8500);
}
