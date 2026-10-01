// What THIS person gets back if they cancel.
//
// This panel used to list all three bands, so everybody read two rules that
// didn't apply to them to find the one that did. Worse, it read identically
// to somebody booking a month out (who gets everything back) and to somebody
// booking at noon for a five o'clock pickup (who gets nothing) — the second
// person is the one who needed telling, and the list only whispered it.
//
// Deliberately no countdown. "Pickup is in 50 minutes" is wrong the moment
// they take a phone call, and this is the last screen before payment, so it
// gets read slowly. Naming the moment stays true however long it sits open.
//
// The dates are rounded in the client's favour in both directions: a promise
// ("full refund up to...") names the last day that is certainly inside the
// band, and a warning ("from... there's no refund") names the first day that
// might be outside it. Either way nobody is told they have longer than they
// do.

import {
  noticeBand,
  FULL_REFUND_NOTICE_HOURS,
  HALF_REFUND_NOTICE_HOURS,
} from '../utils/refundPolicy';
import {
  addDays, addHours, phYmd, phHour, formatHour, formatPhDate,
} from '../utils/phTime';

const SHORT_DATE = { weekday: 'short', month: 'short', day: 'numeric' };

const peso = (n) => `₱${Math.round(n).toLocaleString()}`;

// "today" and "tomorrow" beat a date for anything this close, and the whole
// point of the near bands is that the client feels how close it is.
const dayLabel = (d, now) => {
  const ymd = phYmd(d);
  if (ymd === phYmd(now)) return 'today';
  if (ymd === phYmd(addDays(now, 1))) return 'tomorrow';
  return formatPhDate(d, SHORT_DATE);
};

const RefundNoticeLine = ({ pickupAt, amount, now = new Date() }) => {
  const { band } = noticeBand(pickupAt, now);
  const full = peso(amount);
  const half = peso(amount / 2);

  // No dates picked yet, or no workable hour: fall back to the rule itself
  // rather than inventing a deadline.
  if (band === 'unknown') {
    return (
      <p>
        <strong>Refund:</strong> What you get back depends on the notice you give — everything
        if you cancel 3 or more days before pickup, half from 1 to 3 days before, and nothing
        in the last 24 hours.
      </p>
    );
  }

  if (band === 'none') {
    return (
      <p>
        ⚠️ <strong>Refund:</strong> Pickup is less than two hours away, so once you pay, this
        booking can&apos;t be refunded for any reason. Please check your dates and vehicle
        before you continue.
      </p>
    );
  }

  const when = `${dayLabel(pickupAt, now)} at ${formatHour(phHour(pickupAt))}`;

  if (band === 'mistakeOnly') {
    const sameDay = phYmd(pickupAt) === phYmd(now);
    return (
      <p>
        ⚠️ <strong>Refund:</strong> Pickup is <strong>{when}</strong>, so there&apos;s no refund
        on this booking — the vehicle is held for you and can&apos;t go to anyone else
        {sameDay ? ' today' : ' that day'}. One exception: if you booked by mistake, cancel
        within the hour and you get the whole <strong>{full}</strong> back.
      </p>
    );
  }

  if (band === 'half') {
    // First day that may already be past the 24-hour line.
    const noRefundFrom = addHours(pickupAt, -HALF_REFUND_NOTICE_HOURS);
    return (
      <p>
        <strong>Refund:</strong> Pickup is <strong>{when}</strong>, so cancelling now gets you
        half your money back — <strong>{half}</strong>. Changed your mind right away? Cancel
        within the hour and you get the whole {full}. From{' '}
        <strong>{dayLabel(noRefundFrom, now)}</strong> there&apos;s no refund at all.
      </p>
    );
  }

  // Last day that is certainly still 3 days clear of pickup.
  const safeUntil = addDays(addHours(pickupAt, -FULL_REFUND_NOTICE_HOURS), -1);
  return (
    <p>
      <strong>Refund:</strong> Cancel any time up to{' '}
      <strong>{formatPhDate(safeUntil, SHORT_DATE)}</strong> and you get your full{' '}
      <strong>{full}</strong> back. Closer to pickup it drops to half, and in the last 24 hours
      there&apos;s no refund.
    </p>
  );
};

export default RefundNoticeLine;
