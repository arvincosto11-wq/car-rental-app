import { useEffect, useState } from 'react';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import useModalA11y from '../hooks/useModalA11y';
import AvailabilityCalendar from './AvailabilityCalendar';
import { splitBlockedDates } from '../utils/blockedDates';
import { BLOCK_REASONS, blockLabelFor, causeFor, vehicleUnavailableMessage } from '../utils/blockReasons';
import { isPromoVisible } from '../utils/promo';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import { offerMessage, offerDeadline } from '../utils/offerWindow';
import { formatHour, formatMoment } from '../utils/phTime';

// Everything to do with taking one vehicle off the road, in its own panel.
// It used to live inside Edit Vehicle, which mixed two kinds of saving in one
// window (blocked dates saved instantly, everything else waited for Save
// Changes) and buried the one action you need in a hurry when a car breaks
// down. Shared by admin and consignors; the differences are in what the
// server lets each of them do, not in how the panel works.
//
//   admin      blocks apply immediately. If the dates have bookings, the
//              panel switches to a confirmation step listing who is
//              cancelled and refunded before anything happens.
//   consignor  blocks are requests for admin approval, and the server
//              refuses any that overlap a booking — a consignor can never
//              cause a refund.

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day in timezones ahead of UTC, like PH).
const toDateValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// startHour/endHour are only sent when the admin ticks "part of the day" —
// blank means whole days, which is what a block has always meant and what a
// workshop visit usually is.
const EMPTY_FORM = { startDate: '', endDate: '', startHour: '', endHour: '', reasonCode: '', note: '' };
const CLOCK_HOURS = Array.from({ length: 24 }, (_, h) => h);

const ChevronIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// How many ranges are still ahead of today and not declined — what the
// button on the row shows, so it says something even when nobody opens it.
export const upcomingBlockCount = (blockedDates) =>
  splitBlockedDates(blockedDates).current.filter((b) => b.status !== 'declined').length;

const BlockDatesPanel = ({ car, role, isDark, onClose, onCarUpdated }) => {
  const { toast } = useUIFeedback();
  const isAdmin = role === 'admin';
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [bookedRanges, setBookedRanges] = useState([]);
  // Set when the server reports bookings in the way (admin only). The panel
  // swaps to a confirmation step rather than stacking a second popup on top
  // — two layered dialogs are easy to lose track of when money is involved.
  const [conflicts, setConflicts] = useState(null);

  const busy = submitting;
  const close = () => { if (!busy) onClose(); };
  const panelRef = useModalA11y(close);

  const loadRanges = async () => {
    try {
      // Admin also sees pending bookings, because those are exactly what
      // blocking would cancel. Consignors see confirmed ones, which is all
      // that can stop their request.
      const res = await api.get(`/cars/${car._id}/booked-dates`, { params: isAdmin ? { includePending: true } : {} });
      setBookedRanges(res.data);
    } catch {
      setBookedRanges([]);
    }
  };

  useEffect(() => { loadRanges(); }, [car._id]);

  // Pending consignor requests aren't returned by booked-dates (only
  // approved blocks affect availability), but they're still worth seeing
  // while picking dates, so they're merged in here.
  const calendarRanges = [
    ...bookedRanges,
    ...(car.blockedDates || []).filter((b) => b.status === 'pending'),
  ];

  const handleSelectDay = (date) => {
    const clicked = toDateValue(date);
    if (!form.startDate || (form.startDate && form.endDate)) {
      setForm({ ...form, startDate: clicked, endDate: '' });
      return;
    }
    // Tapping the same day again means that day and no other — which is
    // the commonest block there is, and used to be impossible to express:
    // it cleared the selection instead, so a one-day workshop visit had to
    // be entered as two days.
    if (clicked === form.startDate) {
      setForm({ ...form, endDate: clicked });
      return;
    }
    if (new Date(clicked) < new Date(form.startDate)) {
      setForm({ ...form, startDate: clicked });
      return;
    }
    setForm({ ...form, endDate: clicked });
  };

  // The first attempt goes out without confirmCancellations so the server
  // can report which bookings blocking would cancel. Admin sees exactly who
  // and how much before any money moves, then the same request goes back
  // confirmed.
  const submit = async (confirmCancellations = false) => {
    if (!form.startDate || !form.endDate) {
      toast.error('Pick the first and last day on the calendar.');
      return;
    }
    if (form.startHour !== '' && form.startDate === form.endDate && Number(form.endHour) <= Number(form.startHour)) {
      toast.error('The end time has to be later than the start time on a single day.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/cars/${car._id}/blocked-dates`, { ...form, confirmCancellations });
      onCarUpdated(res.data);
      setForm(EMPTY_FORM);
      setConflicts(null);
      loadRanges();
      toast.success(
        !isAdmin
          ? 'Request sent. It takes effect once admin approves it.'
          : confirmCancellations
            ? 'Dates blocked. Affected clients have been notified and asked to choose new dates or a refund.'
            : 'Dates blocked.'
      );
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsConfirmation) setConflicts(data);
      else toast.error(data?.message || 'Could not block those dates.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (blockId) => {
    try {
      const res = await api.delete(`/cars/${car._id}/blocked-dates/${blockId}`);
      onCarUpdated(res.data);
      loadRanges();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove that range.');
    }
  };

  const { current, past } = splitBlockedDates(car.blockedDates);
  const shown = showPast ? [...current, ...past] : current;
  const gold = isDark ? GOLD_DARK : GOLD;
  const carName = `${car.brand} ${car.model}`;

  const s = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto',
    },
    card: {
      position: 'relative', width: '100%', maxWidth: '480px', outline: 'none',
      background: isDark ? '#242526' : '#fff',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '16px', padding: '24px',
    },
    closeBtn: {
      position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px',
      borderRadius: '50%', border: 'none', background: isDark ? '#18191a' : '#f3f4f6',
      color: isDark ? '#e4e6eb' : '#374151', fontSize: '16px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: '16px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', paddingRight: '40px' },
    sub: { fontSize: '12px', lineHeight: 1.5, color: isDark ? '#b0b3b8' : '#6b7280', margin: '6px 0 18px' },
    sectionLabel: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px',
    },
    list: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' },
    item: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      padding: '9px 12px', borderRadius: '10px', fontSize: '12px',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    itemSub: { display: 'block', fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    tag: {
      fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '20px', marginLeft: '6px',
      background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
    },
    declinedNote: { fontSize: '11px', marginTop: '4px', color: isDark ? '#fca5a5' : '#991b1b' },
    removeBtn: {
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0,
      fontSize: '12px', fontWeight: '700', color: isDark ? '#f87171' : '#dc2626',
    },
    empty: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px' },
    pastToggle: {
      display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 12px',
      borderRadius: '999px', border: `1px dashed ${isDark ? '#4a4b4c' : '#d1d5db'}`,
      background: 'transparent', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em',
      textTransform: 'uppercase', cursor: 'pointer', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    divider: { height: '1px', background: isDark ? '#3a3b3c' : '#eef0f2', margin: '18px 0' },
    rangeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' },
    rangeValue: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    linkBtn: { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: gold },
    input: {
      width: '100%', padding: '9px 11px', marginTop: '8px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', fontFamily: 'inherit', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    hint: { fontSize: '11px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '6px' },
    partDayToggle: {
      display: 'flex', alignItems: 'flex-start', gap: '9px', cursor: 'pointer',
      margin: '12px 0 4px', fontSize: '12.5px', fontWeight: '600',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    partDayHint: {
      display: 'block', fontSize: '11px', fontWeight: '400', lineHeight: 1.45,
      color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px',
    },
    hourRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0 10px' },
    actions: { display: 'flex', gap: '8px', marginTop: '18px' },
    primaryBtn: {
      flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      fontSize: '13px', fontWeight: '700', background: gold, color: ON_GOLD,
    },
    dangerBtn: {
      flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      fontSize: '13px', fontWeight: '700', background: isDark ? '#f87171' : '#dc2626', color: '#fff',
    },
    secondaryBtn: {
      padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
    },
    conflictRefund: { fontWeight: '800', color: gold, whiteSpace: 'nowrap' },
    preview: {
      marginTop: '12px', padding: '11px 13px', borderRadius: '10px',
      fontSize: '12px', lineHeight: 1.5, fontStyle: 'italic',
      background: isDark ? '#18191a' : '#f9fafb',
      border: `1px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    previewLabel: {
      fontStyle: 'normal', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em',
      textTransform: 'uppercase', marginBottom: '5px', color: isDark ? '#8a8d91' : '#9ca3af',
    },
    warn: {
      marginTop: '12px', padding: '11px 13px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.5,
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
      color: isDark ? '#fca5a5' : '#991b1b',
    },
  };

  const fmt = (d) => new Date(d).toLocaleDateString();

  // Spelled out rather than left to inference. "Sep 22 to Sep 24" reads as
  // either two days or three depending on who is reading it, and the
  // difference is a vehicle being booked while it sits in the workshop.
  const offRoadText = (() => {
    if (!form.startDate || !form.endDate) return '';
    if (form.startHour !== '') {
      return ` · ${formatHour(Number(form.startHour))} to ${formatHour(Number(form.endHour))}`;
    }
    const days = Math.round(
      (new Date(`${form.endDate}T00:00:00Z`) - new Date(`${form.startDate}T00:00:00Z`)) / 86400000
    ) + 1;
    return ` · ${days} full day${days === 1 ? '' : 's'} off the road`;
  })();
  // Matches how the server writes the deadline into the real notification,
  // so the preview and the message a client gets read the same.
  const deadlineFmt = (d) => new Date(d).toLocaleString('en-US', {
    timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <div style={s.overlay} onClick={close}>
      <div
        ref={panelRef}
        tabIndex={-1}
        style={s.card}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-dates-title"
      >
        <button type="button" className="icon-toggle-btn" style={s.closeBtn} onClick={close} aria-label="Close">×</button>

        {conflicts ? (
          <>
            <div id="block-dates-title" style={s.title}>These dates are already booked</div>
            <p style={s.sub}>
              {!conflicts.cancellable?.length
                ? 'Nothing will be cancelled or refunded here — see below. The dates will just be blocked, '
                  + 'so nobody new can book them.'
                : conflicts.cancellable.every((b) => b.offerCount > 0)
                  ? 'Each client below keeps the choice: the nearest dates we can still do, or a full refund. '
                    + 'Anyone who doesn’t answer in time is refunded automatically.'
                  : conflicts.cancellable.some((b) => b.offerCount > 0)
                    ? 'Clients with other dates available are offered them, against a full refund. '
                      + 'The rest are cancelled and refunded in full, because the vehicle is being pulled by us.'
                    : 'Blocking them will cancel the bookings below and refund each client in full, '
                      + 'because the vehicle is being pulled by us rather than by them.'}
            </p>

            {conflicts.cancellable?.length > 0 && (
              <div style={s.list}>
                {conflicts.cancellable.map((b) => (
                  <div key={b.id} style={s.item}>
                    <span>
                      <strong>{b.client}</strong>
                      <span style={s.itemSub}>
                        {fmt(b.startDate)} → {fmt(b.endDate)} · {b.status} ·{' '}
                        {b.offerCount > 0
                          ? `offered ${b.offerCount} other date${b.offerCount === 1 ? '' : 's'}`
                          : 'cancelled and refunded'}
                      </span>
                    </span>
                    <span style={s.conflictRefund}>₱{b.refund.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {conflicts.cancellable?.length > 0 && (() => {
              // Built by the same function the server uses to write the real
              // notification, so this preview can't say something different.
              const sample = conflicts.cancellable[0];
              return (
                <div style={s.preview}>
                  <div style={s.previewLabel}>{sample.client} will be told:</div>
                  {sample.offerCount > 0
                    ? offerMessage({
                      reason: 'vehicle_unavailable',
                      cause: causeFor(form.reasonCode),
                      carName,
                      totalDays: sample.totalDays,
                      optionCount: sample.offerCount,
                      deadlineText: deadlineFmt(offerDeadline(sample.startDate)),
                    })
                    : vehicleUnavailableMessage({
                      carName,
                      startDate: sample.startDate,
                      endDate: sample.endDate,
                      cause: causeFor(form.reasonCode),
                      amount: sample.refund,
                    })}
                </div>
              );
            })()}

            {conflicts.underway?.length > 0 && (
              <div style={s.warn}>
                <strong>Not touched — already underway:</strong>
                {conflicts.underway.map((b) => (
                  <div key={b.id}>{b.client} · {fmt(b.startDate)} → {fmt(b.endDate)}</div>
                ))}
                <div style={{ marginTop: '6px' }}>
                  This client already has the vehicle, so nothing happens to their booking
                  automatically. Contact them yourself.
                </div>
              </div>
            )}

            <div style={s.actions}>
              <button type="button" style={s.dangerBtn} disabled={busy} onClick={() => submit(true)}>
                {busy
                  ? 'Working...'
                  : !conflicts.cancellable?.length
                    ? 'Block dates anyway'
                    : conflicts.cancellable.some((b) => b.offerCount > 0)
                      ? 'Block dates & notify clients'
                      : 'Block dates & refund'}
              </button>
              <button type="button" style={s.secondaryBtn} disabled={busy} onClick={() => setConflicts(null)}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <div id="block-dates-title" style={s.title}>Block dates · {carName}</div>
            <p style={s.sub}>
              {isAdmin
                ? 'Takes this vehicle off the road for the dates you choose. If anyone has already booked them, you\'ll see who and how much gets refunded before anything happens.'
                : 'Ask admin to take your vehicle off the road for these dates. Nothing changes until admin approves the request.'}
            </p>

            <div style={s.sectionLabel}>Blocked dates</div>
            {shown.length === 0 ? (
              <p style={s.empty}>No upcoming blocked dates.</p>
            ) : (
              <div style={s.list}>
                {shown.map((b) => {
                  const isPast = past.includes(b);
                  return (
                    <div key={b._id} style={isPast ? { ...s.item, opacity: 0.55 } : s.item}>
                      <span>
                        {formatMoment(b.startDate, b.hasTime, { month: 'numeric', day: 'numeric', year: 'numeric' })} → {formatMoment(b.endDate, b.hasTime, { month: 'numeric', day: 'numeric', year: 'numeric' })}
                        {isPast && <span style={s.tag}>Ended</span>}
                        {b.status === 'pending' && <span style={s.tag}>Pending Approval</span>}
                        {b.status === 'declined' && <span style={s.tag}>Declined</span>}
                        {(blockLabelFor(b) || b.note) && (
                          <span style={s.itemSub}>
                            {blockLabelFor(b)}
                            {b.note && <em>{blockLabelFor(b) ? ' · ' : ''}{b.note}</em>}
                          </span>
                        )}
                        {b.status === 'declined' && b.adminNotes && (
                          <span style={{ ...s.itemSub, ...s.declinedNote }}>Admin: {b.adminNotes}</span>
                        )}
                      </span>
                      <button type="button" className="text-link-btn" style={s.removeBtn} onClick={() => remove(b._id)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {past.length > 0 && (
              <button
                type="button"
                className="past-blocks-toggle"
                style={s.pastToggle}
                aria-expanded={showPast}
                onClick={() => setShowPast((v) => !v)}
              >
                <ChevronIcon />
                {showPast ? 'Hide past' : `${past.length} past range${past.length === 1 ? '' : 's'}`}
              </button>
            )}

            <div style={s.divider} />

            <div style={s.sectionLabel}>Add blocked dates</div>
            <div style={s.rangeRow}>
              <span style={s.rangeValue}>
                {form.startDate && form.endDate
                  ? `${fmt(form.startDate)} → ${fmt(form.endDate)}${offRoadText}`
                  : form.startDate
                    ? 'Tap the last day — or the same day again for that day only'
                    : 'Tap the first day off the road'}
              </span>
              {form.startDate && (
                <button type="button" className="text-link-btn" style={s.linkBtn}
                  onClick={() => setForm({ ...form, startDate: '', endDate: '' })}>
                  Clear
                </button>
              )}
            </div>
            <AvailabilityCalendar
              bookedRanges={calendarRanges}
              selectedStart={form.startDate}
              selectedEnd={form.endDate}
              onSelectDay={handleSelectDay}
              isDark={isDark}
              promo={isPromoVisible(car.promo) ? car.promo : null}
              // Admin can block over bookings (they're cancelled and refunded
              // after a confirmation step); a consignor can't, so booked days
              // stay unpickable for them.
              selectableWhenBooked={isAdmin}
            />

            <label style={s.partDayToggle}>
              <input
                type="checkbox"
                checked={form.startHour !== ''}
                onChange={(e) => setForm({
                  ...form,
                  startHour: e.target.checked ? 8 : '',
                  endHour: e.target.checked ? 12 : '',
                })}
              />
              <span>
                Only part of the day
                <span style={s.partDayHint}>
                  For a vehicle that goes in for a few hours and is back the same day.
                  Leave this off and the whole day is blocked.
                </span>
              </span>
            </label>

            {form.startHour !== '' && (
              <div style={s.hourRow}>
                <select
                  aria-label="Blocked from"
                  style={{ ...s.input, margin: 0 }}
                  value={form.startHour}
                  onChange={(e) => setForm({ ...form, startHour: Number(e.target.value) })}
                >
                  {CLOCK_HOURS.map((h) => <option key={h} value={h}>From {formatHour(h)}</option>)}
                </select>
                <select
                  aria-label="Blocked until"
                  style={{ ...s.input, margin: 0 }}
                  value={form.endHour}
                  onChange={(e) => setForm({ ...form, endHour: Number(e.target.value) })}
                >
                  {CLOCK_HOURS.map((h) => <option key={h} value={h}>Until {formatHour(h)}</option>)}
                </select>
              </div>
            )}

            <select
              aria-label="Reason for blocking"
              style={s.input}
              value={form.reasonCode}
              onChange={(e) => setForm({ ...form, reasonCode: e.target.value })}
            >
              <option value="">Reason for blocking…</option>
              {Object.entries(BLOCK_REASONS).map(([code, r]) => (
                <option key={code} value={code}>{r.label}</option>
              ))}
            </select>
            <input
              aria-label="Private note"
              type="text"
              style={s.input}
              placeholder="Private note (optional) — never shown to clients"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div style={s.hint}>
              {isAdmin
                ? 'Red days already have a booking or block. If your dates include booked days, you\'ll see the exact message each client receives before anything happens. The note stays with you.'
                : 'Red days are already booked or blocked and can\'t be requested. The note is only seen by you and admin.'}
            </div>

            <div style={s.actions}>
              <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => submit(false)}>
                {busy ? 'Working...' : isAdmin ? 'Block These Dates' : 'Send Request'}
              </button>
              <button type="button" style={s.secondaryBtn} disabled={busy} onClick={close}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BlockDatesPanel;
