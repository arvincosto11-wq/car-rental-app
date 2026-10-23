// What a booking costs, start to finish, as one answer.
//
// This file is copied verbatim between the server and the client (see
// client/src/utils/bookingQuote.js). The server recomputes the quote at
// booking time and its answer is the one that counts — the client's copy
// exists so the price someone agrees to is the price they are charged.
// Keeping the ladder in one file is the point: it used to be written out
// three times, once in the booking route, once in the booking form, and a
// third time would have arrived with the new wizard. Three copies of an
// arithmetic rule is three chances to charge the wrong amount.
//
// It owns the ORDER things are added up in, which is where the money is:
// the discount comes off the rental only, the delivery fee is added after,
// and the deposit is a share of the result. It does not re-derive the
// pieces — which discount wins is promo.js, what a drive out costs is
// delivery.js — so there is still one place to change each rule.

import { computeBookingPrice } from './promo.js';
import { deliveryQuote } from './delivery.js';
import { daysBetween } from './phTime.js';

// A fifth of the total, taken to book. Rounded UP so the balance left to
// settle is never a few centavos more than the stated remainder.
export const DEPOSIT_PCT = 20;

export const depositOn = (totalPrice) => Math.ceil(totalPrice * (DEPOSIT_PCT / 100));

// start and end are moments, not days: both are built from the one pickup
// hour the client chooses, so the span is a whole number of days and this
// agrees with counting the dates alone. If return hours ever become
// separately choosable, this is the line that decides whether 3 days and
// 3 hours is charged as three days or four.
export const daysFor = (start, end) => (start && end ? Math.max(0, daysBetween(start, end)) : 0);

// The whole receipt for a set of choices. Everything the form shows and
// everything the booking stores comes out of this one call.
//
// `settings` is the raw delivery settings document (or null, for the
// defaults). `pickupPoint` and `returnPoint` are coordinates or null —
// null meaning the office, which is free.
export const quoteBooking = ({
  car,
  start,
  end,
  days,
  pickupPoint = null,
  returnPoint = null,
  settings = null,
  longRentalRules = [],
  paymentType = 'downpayment',
} = {}) => {
  const totalDays = Number.isFinite(days) ? Math.max(0, days) : daysFor(start, end);
  const ratePerDay = car?.pricePerDay || 0;

  // The rental on its own, with whichever discount takes more off.
  //
  // Guarded on the car as well as the days because the booking form can
  // have dates before it has a vehicle — someone arriving on a link that
  // already carries the dates sees the form render while the vehicle is
  // still loading.
  const { subtotal, discountAmount, totalPrice: vehiclePrice, promoLabel, discountKind } = car && totalDays > 0
    ? computeBookingPrice(car, totalDays, start, end, longRentalRules)
    : { subtotal: 0, discountAmount: 0, totalPrice: 0, promoLabel: '', discountKind: '' };

  // The fee sits OUTSIDE the discount. A promo is the owner discounting
  // their own vehicle; it is not them paying for somebody's petrol to
  // Tabaco, and a percentage promo would quietly do exactly that.
  const delivery = deliveryQuote(pickupPoint, returnPoint, settings);
  const totalPrice = vehiclePrice + delivery.fee;

  const depositDue = depositOn(totalPrice);
  const payingInFull = paymentType === 'full';

  // The receipt, in the order it reads. The two drives are separate lines
  // because they are separate trips — delivering to Tabaco and collecting
  // from Legazpi is two drives, and one line would hide that.
  const lines = [];
  // On the subtotal, not the days: with the vehicle still loading the days
  // are known and the rate is not, and "3 days × ₱0" is not a receipt line.
  if (subtotal > 0) {
    lines.push({
      key: 'rental',
      label: `${totalDays} day${totalDays === 1 ? '' : 's'} × ₱${ratePerDay.toLocaleString()}`,
      amount: subtotal,
    });
  }
  if (discountAmount > 0) {
    lines.push({ key: 'discount', label: promoLabel || 'Discount', amount: -discountAmount });
  }
  if (delivery.ok && delivery.pickup.fee > 0) {
    lines.push({ key: 'delivery', label: `Delivery · ${delivery.pickup.km} km`, amount: delivery.pickup.fee });
  }
  if (delivery.ok && delivery.return.fee > 0) {
    lines.push({ key: 'collection', label: `Collection · ${delivery.return.km} km`, amount: delivery.return.fee });
  }

  return {
    totalDays,
    ratePerDay,
    subtotal,
    discountAmount,
    discountLabel: promoLabel || '',
    // 'promo', 'longRental', or '' when there is no discount.
    discountKind: discountKind || '',
    vehiclePrice,
    delivery,
    deliveryFee: delivery.fee,
    totalPrice,
    depositDue,
    // What is still owed at the counter. Nothing, when they paid in full.
    balanceDue: payingInFull ? 0 : totalPrice - depositDue,
    amountToPay: payingInFull ? totalPrice : depositDue,
    lines,
  };
};
