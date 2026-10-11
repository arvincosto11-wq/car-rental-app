import { useEffect, useState } from 'react';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import useModalA11y from '../hooks/useModalA11y';
import AvailabilityCalendar from './AvailabilityCalendar';
import DriverAvatar from './DriverAvatar';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import { formatMoment } from '../utils/phTime';
import ModalClose from './ModalClose';

// One driver's diary: the trips they are on, and the days they are off.
//
// The same calendar the booking pages use, fed both kinds of busy, because
// whoever is looking at this wants one answer — when can I send this
// person — not two lists to cross-reference in their head.
//
// Days off are whole Philippine days and the last one is included: "off the
// 12th to the 14th" means back on the 15th, which is what somebody means
// when they say it out loud.

// Local YYYY-MM-DD. toISOString would shift to UTC and land on the wrong
// day here, where the clock is eight hours ahead of it.
const toDateValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// "28 – 29 October", or just the one day. Written from the YYYY-MM-DD the
// calendar hands back, which is already a Philippine calendar day, so it is
// read as one rather than parsed as an instant and shifted.
const readableRange = (startYmd, endYmd) => {
  const day = (ymd) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const opts = { month: 'long', day: 'numeric' };
  if (!endYmd || endYmd === startYmd) return day(startYmd).toLocaleDateString('en-PH', opts);
  const from = day(startYmd);
  const to = day(endYmd);
  // Same month reads better without repeating it.
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()} – ${to.toLocaleDateString('en-PH', opts)}`
    : `${from.toLocaleDateString('en-PH', opts)} – ${to.toLocaleDateString('en-PH', opts)}`;
};

const DriverCalendarPanel = ({ driver, isDark, onClose, onChanged }) => {
  const { toast, confirm } = useUIFeedback();
  const modalRef = useModalA11y(onClose);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get(`/drivers/${driver._id}/calendar`)
    .then(({ data: d }) => setData(d))
    .catch(() => toast.error('Could not load that calendar.'));

  useEffect(() => { load(); }, [driver._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clicking a day fills the form: first click sets the start, second the
  // end, a third starts again. Typing the dates still works for anybody
  // who would rather.
  const pickDay = (date) => {
    const value = toDateValue(date);
    setForm((f) => {
      if (!f.startDate || (f.startDate && f.endDate)) return { ...f, startDate: value, endDate: '' };
      if (value < f.startDate) return { ...f, startDate: value, endDate: '' };
      return { ...f, endDate: value };
    });
  };

  const blockDays = async () => {
    if (!form.startDate) {
      toast.error('Pick the first day they are off.');
      return;
    }
    setSaving(true);
    try {
      const { data: saved } = await api.post(`/drivers/${driver._id}/blocks`, {
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        reason: form.reason,
      });
      toast.success('Marked off. They will not be offered for those days.');
      // What it cost, said one line at a time rather than as a paragraph
      // nobody reads. These are things to go and fix, not errors.
      for (const warning of saved?.warnings || []) toast.info(warning);
      setForm({ startDate: '', endDate: '', reason: '' });
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (block) => {
    const ok = await confirm('Put these days back? They can be booked again straight away.', {
      confirmLabel: 'Put them back', cancelLabel: 'Leave it',
    });
    if (!ok) return;
    try {
      await api.delete(`/drivers/${driver._id}/blocks/${block._id}`);
      toast.success('Those days are free again.');
      load();
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not do that.');
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
    },
    // The card holds the close button, so it must not be the thing that
    // scrolls — otherwise the × scrolls off the top with the header, which
    // is exactly what it did.
    card: {
      background: isDark ? '#242526' : '#fff', borderRadius: '12px',
      maxWidth: '560px', width: '100%', maxHeight: '88vh', position: 'relative',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    body: { padding: '22px', overflowY: 'auto', flex: 1, minHeight: 0 },
    head: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
    title: { fontSize: '17px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    sub: { fontSize: '12.5px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
    sectionTitle: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', margin: '18px 0 8px',
    },
    row: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '10px 0', fontSize: '13px', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    rowSub: { fontSize: '11.5px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    empty: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', padding: '10px 0' },
    chosen: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 4px' },
    // The chosen days read as one object you can put down again, rather
    // than a sentence with a word underlined in it.
    chosenRow: {
      display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '4px',
      padding: '6px 6px 6px 12px', borderRadius: '999px',
      border: `1px solid ${gold}`,
      background: isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)',
    },
    chosenDates: { fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    clearBtn: {
      width: '20px', height: '20px', lineHeight: '18px', padding: 0, borderRadius: '50%',
      border: 'none', cursor: 'pointer', fontSize: '14px',
      background: isDark ? '#3a3b3c' : '#e5e7eb',
      color: isDark ? '#e4e6eb' : '#4b5563',
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '10px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: isDark ? '#e4e6eb' : '#374151' },
    input: {
      width: '100%', padding: '8px 10px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    btn: {
      marginTop: '12px', padding: '9px 16px', borderRadius: '8px', border: 'none', fontSize: '13px',
      fontWeight: '700', background: gold, color: ON_GOLD, cursor: saving ? 'default' : 'pointer',
      opacity: saving ? 0.6 : 1,
    },
    putBack: {
      flexShrink: 0, padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700',
      cursor: 'pointer', background: 'transparent',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      color: isDark ? '#b0b3b8' : '#6b7280',
    },
  };

  const trips = data?.trips || [];
  const blocks = data?.blocks || [];
  // Both kinds of busy, drawn the same way: the calendar is answering one
  // question and does not care which sort of busy a day is.
  const ranges = [
    ...trips.map((t) => ({ startDate: t.start, endDate: t.end, busyStart: t.start, busyEnd: t.end })),
    ...blocks.map((b) => ({ startDate: b.start, endDate: b.end, busyStart: b.start, busyEnd: b.end })),
  ];

  const upcoming = blocks
    .filter((b) => new Date(b.end) >= new Date())
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} ref={modalRef} role="dialog" aria-modal="true" aria-label={`${driver.name}'s calendar`} onClick={(e) => e.stopPropagation()}>
        <ModalClose onClose={onClose} isDark={isDark} />
        <div style={s.body}>
        <div style={s.head}>
          <DriverAvatar driver={driver} isDark={isDark} size={42} />
          <div>
            <div style={s.title}>{driver.name}</div>
            <div style={s.sub}>Trips and days off</div>
          </div>
        </div>

        {data === null ? (
          <p style={s.empty}>Loading…</p>
        ) : (
          <>
            <AvailabilityCalendar
              bookedRanges={ranges}
              selectedStart={form.startDate}
              selectedEnd={form.endDate}
              onSelectDay={pickDay}
              isDark={isDark}
              selectableWhenBooked={false}
            />

            <div style={s.sectionTitle}>Mark them off</div>
            {/* No date boxes. The days are picked on the calendar above —
                two fields saying the same thing as the outlined squares is
                one more place for the two to disagree. What is chosen is
                written out instead, so it is never a guess. */}
            {form.startDate ? (
              <div style={s.chosenRow}>
                <span style={s.chosenDates}>{readableRange(form.startDate, form.endDate)}</span>
                <button
                  type="button"
                  className="compact-btn"
                  style={s.clearBtn}
                  aria-label="Clear the chosen days"
                  onClick={() => setForm({ ...form, startDate: '', endDate: '' })}
                >
                  ×
                </button>
              </div>
            ) : (
              <p style={s.chosen}>Click a day on the calendar, then the last day if it is more than one.</p>
            )}
            <div style={s.grid}>
              <div>
                <label style={s.label} htmlFor="dc-why">Why (optional)</label>
                <input id="dc-why" style={s.input} maxLength={200} placeholder="e.g. sick, rest day"
                  value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>
            </div>
            <button
              type="button"
              style={{ ...s.btn, opacity: saving || !form.startDate ? 0.5 : 1, cursor: saving || !form.startDate ? 'default' : 'pointer' }}
              onClick={blockDays}
              disabled={saving || !form.startDate}
            >
              {saving ? 'Saving…' : 'Mark off these days'}
            </button>

            <div style={s.sectionTitle}>Days off</div>
            {upcoming.length === 0 ? (
              <p style={s.empty}>None coming up.</p>
            ) : upcoming.map((b) => (
              <div key={b._id} style={s.row}>
                <div>
                  <div>
                    {formatMoment(b.start, false, { month: 'short', day: 'numeric' })}
                    {' – '}
                    {/* The stored end is the following midnight, so the last
                        day off is the day before it. Shown the way it was
                        entered, not the way it is stored. */}
                    {formatMoment(new Date(new Date(b.end).getTime() - 1), false, { month: 'short', day: 'numeric' })}
                  </div>
                  {b.reason ? <div style={s.rowSub}>{b.reason}</div> : null}
                </div>
                <button type="button" className="compact-btn" style={s.putBack} onClick={() => removeBlock(b)}>
                  Put back
                </button>
              </div>
            ))}

            <div style={s.sectionTitle}>Trips</div>
            {trips.length === 0 ? (
              <p style={s.empty}>No trips yet.</p>
            ) : trips.map((t) => (
              <div key={t._id} style={s.row}>
                <div>
                  <div>{t.customer} · {t.car}</div>
                  <div style={s.rowSub}>
                    {formatMoment(t.start, true)} – {formatMoment(t.end, true)}
                    {t.status === 'completed' ? ' · finished' : ''}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default DriverCalendarPanel;
