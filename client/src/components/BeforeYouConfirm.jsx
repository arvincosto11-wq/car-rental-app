import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { noticeBand, FULL_REFUND_NOTICE_HOURS, HALF_REFUND_NOTICE_HOURS } from '../utils/refundPolicy';
import RefundNoticeLine from './RefundNoticeLine';
import ModalClose from './ModalClose';

// The last screen before the money leaves, as a timeline rather than a list
// of policies.
//
// The order is the order things happen in: you pay now, a person checks it
// afterwards, this is what you get back if you change your mind, here is
// what to bring on the day, and here is the rule when you hand it back. The
// old version was three paragraphs of policy with no sense of when any of
// it applied, and it never said what was about to be charged.
//
// The refund sentence is not written here. RefundNoticeLine owns all five
// of them and is also used in My Bookings, so there is one description of
// the rule rather than two that can drift.

const P = (d) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICON = {
  pay: 'M3 6h18v12H3zM3 10h18M7 15h3',
  person: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 11l2 2 4-4',
  back: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  warn: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
  id: 'M3 5h18v14H3zM7 15c.5-1.5 1.5-2 2.5-2s2 .5 2.5 2M9.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M14 9h4M14 13h3',
  fuel: 'M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8h3a2 2 0 0 1 2 2v7a1.5 1.5 0 0 0 3 0V9l-3-3',
};

// What the three refusals a client can actually do something about look
// like, and what the button should then say. Anything else arrives without
// a reason and gets the message it came with and a way back, which is the
// honest answer when there is nothing to press.
const FIXES = {
  taken: 'Pick other dates',
  licence: 'Update licence in Profile',
  range: 'Change pickup place',
};

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

// Where "now" sits on the Everything / Half / Nothing bar.
//
// The three segments are fixed at 50, 30 and 20 per cent, as drawn — they
// are not to scale with time, and should not be: "everything back" covers
// from three days out to forever, which no honest scale could show beside
// a single day.
//
// So the marker is placed inside whichever segment the booking is in,
// proportionally within it, rather than at one of four fixed stops. It
// slides as the pickup approaches and crosses each line exactly when the
// refund does.
const FAR_HOURS = 168;

// Each band keeps the marker inside itself, a little clear of both edges.
// Sitting it exactly where the arithmetic lands put every booking more
// than a week out at 2% — hard against the left edge, half the label
// hanging off the bar, and reading as though it belonged to nothing. The
// point of the marker is which band you are in, so it stays in that band's
// middle ground and moves within it.
const WITHIN = {
  everything: [8, 45],
  half: [53, 77],
  nothing: [83, 95],
};
const place = ([from, to], frac) => from + Math.min(1, Math.max(0, frac)) * (to - from);

const markerAt = (noticeHours) => {
  const h = Number.isFinite(noticeHours) ? noticeHours : 0;
  if (h >= FULL_REFUND_NOTICE_HOURS) {
    // A week or more out is as far left as it goes; three days out is at
    // the inner edge, about to cross into half.
    return place(WITHIN.everything, (FAR_HOURS - h) / (FAR_HOURS - FULL_REFUND_NOTICE_HOURS));
  }
  if (h >= HALF_REFUND_NOTICE_HOURS) {
    return place(WITHIN.half,
      (FULL_REFUND_NOTICE_HOURS - h) / (FULL_REFUND_NOTICE_HOURS - HALF_REFUND_NOTICE_HOURS));
  }
  return place(WITHIN.nothing, (HALF_REFUND_NOTICE_HOURS - Math.max(0, h)) / HALF_REFUND_NOTICE_HOURS);
};

const BeforeYouConfirm = ({
  isDark, modalRef, vehicle, pickupAt, pickupLabel, returnBy, driving, handover,
  amountNow, balance, payingInFull, busy, error, errorReason,
  onCancel, onConfirm, now = new Date(),
}) => {
  const gold = isDark ? GOLD_DARK : GOLD;
  const border = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#6b7280';
  const card = isDark ? '#242526' : '#fff';
  const sunk = isDark ? '#1e1f20' : '#f6f7f8';
  const danger = isDark ? '#f28b82' : '#b91c1c';
  const dangerSoft = isDark ? 'rgba(242,139,130,0.12)' : '#fdecec';

  const { band, noticeHours } = noticeBand(pickupAt, now);
  const warn = band === 'none' || band === 'mistakeOnly';
  const failed = !!error;
  const fix = errorReason ? FIXES[errorReason] : null;

  const TAG = {
    unknown: 'Depends on notice',
    none: 'Not refundable',
    mistakeOnly: 'No refund · 1-hour exception',
    half: 'Half back if you cancel now',
    full: 'Full refund',
  }[band];

  const s = {
    sheet: {
      width: '100%', maxWidth: '560px', maxHeight: '92vh', background: card,
      borderRadius: '16px', overflow: 'hidden', outline: 'none',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
    },
    head: {
      flex: 'none', padding: '18px 20px 16px', borderBottom: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    headTop: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
    // Gold and a shade larger than I first had it: this is the only line
    // that names the screen, and at 10px grey it read as a caption on the
    // title rather than a heading of its own.
    eyebrow: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: goldInk(isDark) },
    title: { margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: text, textWrap: 'pretty' },
    grid: {
      // Two columns, which is what it was drawn with. A 150px basis fitted
      // three into the 560 and every value wrapped: "Tue, Oct 27 at 7:00 AM"
      // over two lines, "With a driver we assign" over two. A 210px basis
      // gives two here and one on a phone, with no breakpoint to keep.
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: '8px 16px', fontSize: '13px',
    },
    cell: { minWidth: 0, display: 'flex', flexDirection: 'column' },
    // Quiet, and the same size as the answer beside it. These were 10px
    // uppercase with wide letter-spacing — a heading style, used six times
    // in a row against six answers, so the labels fought the values and
    // nothing came out on top.
    k: { color: text2 },
    v: { fontWeight: '650', color: text, overflowWrap: 'anywhere' },
    // The one figure on this screen anybody is about to act on, and it was
    // set exactly like the handover address.
    money: { fontWeight: '800', color: goldInk(isDark), overflowWrap: 'anywhere' },
    body: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px' },
    row: { display: 'flex', gap: '12px', alignItems: 'stretch' },
    gutter: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' },
    dot: (state) => ({
      width: '28px', height: '28px', borderRadius: '999px', display: 'grid', placeItems: 'center',
      flex: 'none',
      background: state === 'warn' ? danger : state === 'now' ? gold : sunk,
      color: state === 'warn' ? (isDark ? '#1a1a1a' : '#fff') : state === 'now' ? ON_GOLD : text2,
      border: state === 'later' ? `1px solid ${border}` : 'none',
    }),
    rail: (last) => ({ flex: 1, width: '2px', background: last ? 'transparent' : border, margin: '4px 0' }),
    item: { paddingBottom: '18px', minWidth: 0, flex: 1 },
    when: { fontSize: '10px', fontWeight: '800', letterSpacing: '0.12em', textTransform: 'uppercase', color: text2 },
    itemTitle: (isWarn) => ({ fontWeight: '750', fontSize: '15px', color: isWarn ? danger : text, marginTop: '1px' }),
    itemText: { margin: '4px 0 0', fontSize: '13.5px', lineHeight: 1.55, color: text2, textWrap: 'pretty' },
    refundBox: {
      marginTop: '8px', padding: warn ? '10px 12px' : 0, borderRadius: '10px',
      background: warn ? dangerSoft : 'transparent',
      color: text, fontSize: '13.5px', lineHeight: 1.55,
    },
    tag: {
      marginLeft: 'auto', padding: '3px 10px', borderRadius: '999px', flex: 'none',
      fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap',
      background: warn ? danger : band === 'unknown' ? card : gold,
      color: warn ? (isDark ? '#1a1a1a' : '#fff') : band === 'unknown' ? text2 : ON_GOLD,
      border: band === 'unknown' ? `1px solid ${border}` : 'none',
    },
    barWrap: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
    // Labelled bands rather than a thin rule with captions under it: the
    // word sits in the stretch it names, so there is nothing to match up.
    bar: {
      display: 'grid', gridTemplateColumns: '5fr 3fr 2fr', height: '30px',
      borderRadius: '8px', overflow: 'hidden', fontSize: '12px', fontWeight: '650',
    },
    seg: (bg, fg) => ({ display: 'grid', placeItems: 'center', background: bg, color: fg }),
    markerRow: { position: 'relative', height: '18px', fontSize: '12px', color: text2 },
    marker: (left) => ({
      position: 'absolute', top: 0, left: `${left}%`, transform: 'translateX(-50%)',
      fontWeight: '800', whiteSpace: 'nowrap',
      color: warn ? danger : goldInk(isDark),
    }),
    chips: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' },
    chip: {
      padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '650',
      background: sunk, border: `1px solid ${border}`, color: text,
    },
    errBox: {
      flex: 'none', margin: '0 22px 14px', padding: '12px 14px', borderRadius: '10px',
      background: dangerSoft, border: `1px solid ${danger}`, color: text, fontSize: '13.5px',
    },
    errTitle: { fontWeight: '750', color: danger },
    foot: {
      flex: 'none', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      padding: '14px 20px', borderTop: `1px solid ${border}`, background: card,
    },
    hint: { flex: 1, minWidth: '120px', fontSize: '12.5px', color: text2 },
    btn: {
      minHeight: '48px', padding: '0 18px', borderRadius: '10px', font: 'inherit',
      fontSize: '15px', fontWeight: '700', display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', gap: '8px',
    },
  };

  const pay = {
    ...s.btn, border: `1px solid ${gold}`, background: gold, color: ON_GOLD,
    cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.75 : 1,
  };
  const back = {
    ...s.btn, border: `1px solid ${border}`, background: card, color: text,
    cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
  };

  const steps = [
    {
      key: 'now', when: 'Now', state: 'now', icon: ICON.pay,
      title: `Pay ${peso(amountNow)} by GCash`,
      text: payingInFull
        ? `You pay the whole ${peso(amountNow)} now. Nothing is due at pickup.`
        : `That reserves it. The other ${peso(balance)} is paid at pickup.`,
    },
    {
      key: 'check', when: 'After you pay', state: 'later', icon: ICON.person,
      title: 'Every booking is checked by a person.',
      text: `Our office confirms it after you pay — follow it in My Bookings. If the vehicle turns out `
        + `to be unavailable, we cancel it and refund the full ${peso(amountNow)}, however close to pickup.`,
    },
    { key: 'refund', when: 'If you cancel', state: warn ? 'warn' : 'later', icon: warn ? ICON.warn : ICON.back, refund: true },
    {
      key: 'pickup', when: pickupAt ? 'On your pickup day' : 'At pickup', state: 'later', icon: ICON.id,
      title: 'Bring these, or we cannot release it',
      chips: ['2 valid IDs', 'Proof of billing address'].concat(driving === 'self-drive' ? ["Driver's licence"] : []),
      text: 'The names on them have to match the name on the booking. A cancellation on your pickup date is not refunded.',
    },
    {
      key: 'return', when: 'When you bring it back', state: 'later', icon: ICON.fuel, last: true,
      title: 'Same fuel level as you got it',
      text: 'Return the vehicle with the same fuel level it had at pickup, or the difference will be charged to you.',
    },
  ];

  return (
    <div style={s.sheet} ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div style={s.head}>
        <div style={s.headTop}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.eyebrow}>Before you confirm</div>
            <h2 id="confirm-title" style={s.title}>
              Pay {peso(amountNow)} for the {vehicle}
            </h2>
          </div>
          {/* Dimmed rather than removed while redirecting: a control that
              vanishes mid-action reads as the page breaking, and the person
              is watching this exact corner for a way out. */}
          <span style={{ opacity: busy ? 0.4 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
            <ModalClose onClose={onCancel} isDark={isDark} floating={false} />
          </span>
        </div>

        <div style={s.grid}>
          {[
            ['Vehicle', vehicle],
            ['Pickup', pickupLabel || '—'],
            ['Return by', returnBy || '—'],
            ['Driving', driving === 'self-drive' ? 'Self-drive' : driving],
            ['Handover', handover],
            [
              'Charged now',
              payingInFull ? `${peso(amountNow)} · paid in full` : `${peso(amountNow)} · ${peso(balance)} at pickup`,
              true,
            ],
          ].map(([k, val, isMoney]) => (
            <div key={k} style={s.cell}>
              <span style={s.k}>{k}</span>
              <span style={isMoney ? s.money : s.v}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.body}>
        {steps.map((step) => (
          <div key={step.key} style={s.row}>
            <div style={s.gutter}>
              <span style={s.dot(step.state)}>{P(step.icon)}</span>
              <span style={s.rail(step.last)} />
            </div>
            <div style={s.item}>
              <div style={s.when}>{step.when}</div>
              {step.refund ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={s.itemTitle(warn)}>Refund if you cancel</span>
                    <span style={s.tag}>{TAG}</span>
                  </div>
                  <div style={s.refundBox}>
                    <RefundNoticeLine pickupAt={pickupAt} amount={amountNow} now={now} />
                  </div>
                  {/* Hidden with no dates, where there is no "now" to mark. */}
                  {band !== 'unknown' && (
                    <div style={s.barWrap}>
                      <div style={s.bar}>
                        <span style={s.seg(`color-mix(in srgb, ${gold} 34%, ${card})`, text)}>Everything</span>
                        <span style={s.seg(`color-mix(in srgb, ${gold} 16%, ${card})`, text)}>Half</span>
                        <span style={s.seg(dangerSoft, danger)}>Nothing</span>
                      </div>
                      <div style={s.markerRow}>
                        <span style={s.marker(markerAt(noticeHours))}>▲ Now</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={s.itemTitle(false)}>{step.title}</div>
                  {step.chips && (
                    <div style={s.chips}>
                      {step.chips.map((c) => <span key={c} style={s.chip}>{c}</span>)}
                    </div>
                  )}
                  <p style={s.itemText}>{step.text}</p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {failed && (
        <div style={s.errBox} role="alert">
          <span style={s.errTitle}>{error}</span>{' '}
          <span>You haven&apos;t been charged.</span>
        </div>
      )}

      <div style={s.foot}>
        <span style={s.hint}>
          {failed
            ? 'Nothing has been taken from your account.'
            : busy
              ? 'Opening PayMongo. Keep this page open.'
              : payingInFull
                ? `You're paying ${peso(amountNow)} now.`
                : `You're paying ${peso(amountNow)} now, ${peso(balance)} at pickup.`}
        </span>
        <button type="button" style={back} onClick={onCancel} disabled={busy}>
          {failed ? 'Back to booking' : 'Back'}
        </button>
        <button type="button" style={pay} onClick={onConfirm} disabled={busy}>
          {busy
            ? 'Redirecting to GCash…'
            : failed
              ? (fix || 'Try again')
              : `Continue to GCash — Pay ${peso(amountNow)}`}
        </button>
      </div>
    </div>
  );
};

export default BeforeYouConfirm;
