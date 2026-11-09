import { useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { PAYOUT_METHODS, methodLabel, referenceRequired, payoutProblem } from '../utils/payouts';
import { TickIcon } from './adminConsignIcons';
import api from '../api';

// Paying an owner, laid out in the order the job actually happens.
//
// This was a dialog: tick some trips, choose a method, type a reference,
// save. The trouble with that shape is that it let somebody record a
// payment they had not sent — every field was available from the first
// moment, and the one step that matters happens outside the system, in
// the admin's own GCash app.
//
// So the three steps sit side by side and unlock in sequence. Picking
// trips wakes the send panel; pressing "I've sent it" wakes the writing
// down. Nothing is hidden — a locked column is dimmed and still readable,
// so the whole job is visible before it is begun — but the order is the
// real one, and the amount you are about to send is the biggest thing on
// the screen because that is the moment money goes to the wrong person.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const dayMonth = (value) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Within one month only the second day is repeated: "Aug 24–26". Putting
// the bare first day in front of a formatted second one read as
// "24–Aug 26", which is not a date range in any language.
const tripSpan = (trip) => {
  const from = new Date(trip.startDate);
  const to = new Date(trip.endedAt || trip.endDate);
  if (from.toDateString() === to.toDateString()) return dayMonth(from);
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${dayMonth(from)}–${to.getDate()}`;
  }
  return `${dayMonth(from)} – ${dayMonth(to)}`;
};

const uploadReceipt = async (file) => {
  const { data: auth } = await api.get('/imagekit/user-auth');
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name);
  form.append('token', auth.token);
  form.append('expire', auth.expire);
  form.append('signature', auth.signature);
  form.append('publicKey', auth.publicKey);
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!data.url) throw new Error(data.message || 'Upload failed');
  return { url: data.url, fileId: data.fileId || '' };
};

const PayoutConsole = ({ rows, onPaid }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const fileRef = useRef(null);

  const owed = rows.filter((r) => r.owed > 0);
  const [ownerId, setOwnerId] = useState('');
  const [unticked, setUnticked] = useState(() => new Set());
  const [method, setMethod] = useState('gcash');
  const [sent, setSent] = useState(false);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);

  const [gcashDraft, setGcashDraft] = useState({ number: '', name: '' });
  const [editingGcash, setEditingGcash] = useState(false);
  const [savingGcash, setSavingGcash] = useState(false);

  // Whoever is owed the most, unless somebody has been picked. The page is
  // sorted that way already, so the first row is the obvious one to open on.
  const row = rows.find((r) => r.consignor.id === ownerId) || owed[0] || rows[0] || null;
  const payable = row?.payable || [];
  const picked = payable.filter((t) => !unticked.has(t.id));
  const total = picked.reduce((sum, t) => sum + t.amount, 0);
  const allOn = picked.length === payable.length && payable.length > 0;

  const gcash = row?.gcash || { number: '', name: '' };
  const needsGcash = method === 'gcash' && !gcash.number;
  const problem = payoutProblem({ method, reference, bookingIds: picked.map((t) => t.id) });

  const reset = () => {
    setUnticked(new Set());
    setMethod('gcash');
    setSent(false);
    setReference('');
    setNote('');
    setReceipt(null);
    setDone(null);
  };

  const choose = (id) => {
    setOwnerId(id);
    reset();
  };

  const toggle = (id) => {
    setDone(null);
    setUnticked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setDone(null);
    setUnticked(allOn ? new Set(payable.map((t) => t.id)) : new Set());
  };

  const saveGcash = async () => {
    setSavingGcash(true);
    try {
      await api.put(`/payouts/details/${row.consignor.id}`, gcashDraft);
      setEditingGcash(false);
      // The number lives on the income rows, so the page has to refetch
      // for the send panel to show it.
      onPaid('GCash details saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save those details.');
    } finally {
      setSavingGcash(false);
    }
  };

  const pickReceipt = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      setReceipt(await uploadReceipt(file));
    } catch {
      toast.error('That screenshot did not upload. The payment can still be recorded without it.');
    } finally {
      setUploading(false);
    }
  };

  const record = async () => {
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      await api.post('/payouts', {
        consignor: row.consignor.id,
        bookings: picked.map((t) => t.id),
        method,
        reference,
        note,
        receipt: receipt || undefined,
      });
      setDone({
        amount: total,
        trips: picked.length,
        method,
        reference: method === 'cash' ? '' : reference.trim(),
        name: row.consignor.name,
      });
      setSent(false);
      setReference('');
      setNote('');
      setReceipt(null);
      setUnticked(new Set());
      onPaid(`${peso(total)} recorded for ${row.consignor.name}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record that payment.');
    } finally {
      setSaving(false);
    }
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldSoft = isDark ? 'rgba(232,161,0,0.12)' : '#fbf3e2';
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';
  const blue = isDark ? '#8ab4f8' : '#1d4ed8';
  const blueSoft = isDark ? 'rgba(138,180,248,0.13)' : '#eaf0fd';

  // A step that is not its turn yet. Dimmed rather than hidden, so the
  // whole job can be read before any of it is done, and unclickable so it
  // cannot be done out of order.
  const LOCK = { opacity: 0.4, pointerEvents: 'none' };

  const s = {
    banner: {
      display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap',
      padding: '15px 20px', borderRadius: '14px',
      background: greenSoft, color: green, marginBottom: '16px',
    },
    bannerBtn: {
      minHeight: '40px', padding: '0 14px', borderRadius: '10px',
      border: `1px solid ${line}`, background: card, color: text,
      fontFamily: 'inherit', fontWeight: '650', fontSize: '13px', cursor: 'pointer',
    },

    shell: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr)',
      borderRadius: '14px', background: card, border: `1.5px solid ${gold}`,
      overflow: 'hidden', marginBottom: '20px',
    },
    col: (locked, lit) => ({
      display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px', minWidth: 0,
      background: lit ? goldSoft : 'transparent',
      ...(locked ? LOCK : null),
    }),
    colEdge: { borderLeft: `1px solid ${line}` },
    stepHead: { display: 'flex', gap: '10px', alignItems: 'center' },
    stepNum: {
      width: '26px', height: '26px', borderRadius: '999px', flex: 'none',
      background: gold, color: ON_GOLD, display: 'grid', placeItems: 'center',
      fontSize: '12px', fontWeight: '800',
    },
    stepName: { fontSize: '16px', fontWeight: '700', color: text },

    chips: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
    chip: (on) => ({
      flex: '1 1 0', minWidth: 0, textAlign: 'left', padding: '9px 12px', borderRadius: '10px',
      border: `1.5px solid ${on ? gold : line}`, background: on ? goldSoft : card,
      color: text, fontFamily: 'inherit', cursor: 'pointer',
    }),
    chipName: { display: 'block', fontWeight: '700', fontSize: '13.5px' },
    chipSub: { fontSize: '12px', color: text2 },

    tickBar: { display: 'flex', alignItems: 'center', paddingBottom: '4px' },
    tickCount: { flex: 1, fontSize: '13px', color: text3 },
    tickAll: {
      border: 0, background: 'transparent', color: ink, fontFamily: 'inherit',
      fontSize: '13px', fontWeight: '650', cursor: 'pointer', padding: '6px',
    },
    tripBtn: {
      width: '100%', display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 0',
      border: 0, borderTop: `1px solid ${line}`, background: 'transparent',
      fontFamily: 'inherit', fontSize: '13.5px', color: text, cursor: 'pointer', textAlign: 'left',
    },
    box: (on) => ({
      flex: 'none', width: '20px', height: '20px', borderRadius: '6px',
      display: 'grid', placeItems: 'center',
      background: on ? gold : card,
      border: `1.5px solid ${on ? gold : line}`,
      color: on ? ON_GOLD : 'transparent',
    }),
    tripWhen: { flex: 1, minWidth: 0 },
    tripVeh: { display: 'block', fontSize: '11.5px', color: text3 },
    tripAmt: { fontWeight: '700', fontVariantNumeric: 'tabular-nums' },

    seg: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    segBtn: (on) => ({
      minHeight: '38px', padding: '0 14px', borderRadius: '9px', fontFamily: 'inherit',
      fontSize: '13px', cursor: 'pointer',
      border: `1.5px solid ${on ? gold : line}`,
      background: on ? goldSoft : card,
      color: on ? ink : text, fontWeight: on ? '700' : '600',
    }),

    sendBox: {
      padding: '18px', borderRadius: '12px', background: inset, border: `1px solid ${line}`,
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    sendVerb: { fontSize: '12px', color: text2 },
    sendAmount: {
      fontSize: '40px', fontWeight: '800', color: ink,
      letterSpacing: '-0.02em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
    },
    sendTo: { borderTop: `1px solid ${line}`, paddingTop: '12px' },
    sendDest: { fontSize: '22px', fontWeight: '800', color: text, overflowWrap: 'anywhere' },
    sendCheck: { fontSize: '12px', color: text2, textWrap: 'pretty' },

    primary: {
      minHeight: '44px', padding: '0 20px', borderRadius: '10px', border: 0,
      background: gold, color: ON_GOLD, fontFamily: 'inherit',
      fontSize: '14px', fontWeight: '700', cursor: 'pointer',
    },
    primaryOff: {
      minHeight: '44px', padding: '0 20px', borderRadius: '10px', border: 0,
      background: gold, color: ON_GOLD, fontFamily: 'inherit',
      fontSize: '14px', fontWeight: '700', opacity: 0.45, cursor: 'not-allowed',
    },
    ghost: {
      minHeight: '40px', padding: '0 14px', borderRadius: '9px',
      border: `1px solid ${line}`, background: card, color: text2,
      fontFamily: 'inherit', fontSize: '13px', fontWeight: '650', cursor: 'pointer',
    },
    sentLine: { display: 'flex', gap: '8px', alignItems: 'center', color: green, fontWeight: '650', fontSize: '13.5px' },
    undo: {
      border: 0, background: 'transparent', color: ink, fontFamily: 'inherit',
      fontSize: '13px', fontWeight: '650', cursor: 'pointer', padding: '6px',
    },

    label: { fontSize: '13px', fontWeight: '700', color: text },
    input: {
      height: '46px', padding: '0 12px', borderRadius: '10px', width: '100%',
      border: `1px solid ${line}`, background: card, color: text,
      fontFamily: 'inherit', fontSize: '15px',
    },
    area: {
      width: '100%', padding: '10px 12px', borderRadius: '10px', resize: 'vertical',
      border: `1px solid ${line}`, background: card, color: text, fontFamily: 'inherit', fontSize: '13.5px',
    },
    cashNote: { padding: '12px 14px', borderRadius: '10px', background: blueSoft, fontSize: '13px', color: text },
    cashStrong: { color: blue, fontWeight: '700' },
    attach: {
      padding: '12px', borderRadius: '10px', border: `1.5px dashed ${line}`,
      background: card, color: text3, fontFamily: 'inherit', fontSize: '13px',
      cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '9px', alignItems: 'center',
    },
    recordWrap: { marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' },
    hint: { fontSize: '12px', color: text3, textWrap: 'pretty' },

    empty: { padding: '14px', borderRadius: '12px', background: inset, color: text2, fontSize: '13px', textWrap: 'pretty' },
    gcashRow: { display: 'grid', gap: '8px' },
  };

  if (!rows.length) return null;

  const sendDest = method === 'gcash'
    ? (gcash.number || 'No GCash number on file')
    : row?.consignor.name;
  const sendVerb = method === 'gcash'
    ? 'Open your GCash app and send exactly'
    : method === 'cash' ? 'Hand over exactly, in person' : 'Transfer exactly';
  // An em dash rather than a full stop: plenty of account names are
  // written "Arvin C." and a sentence after one read "Arvin C.. Check".
  const sendCheck = method === 'gcash'
    ? (gcash.name ? `Registered to ${gcash.name} — check the name before you send.` : 'No account name on file. Check it with them before you send.')
    : method === 'cash' ? 'Ask them to count it in front of you.'
      : 'Use the bank details they gave you — we do not keep them on file.';

  const hint = !picked.length
    ? 'Tick at least one trip.'
    : !sent ? 'Send the money first, then mark it as sent.'
      : problem ? `Add the ${methodLabel(method)} reference to record it.`
        : `${row.consignor.name} sees this on their dashboard straight away.`;

  return (
    <>
      {done && (
        <div style={s.banner} role="status">
          <TickIcon size={22} stroke={2.2} />
          <div style={{ flex: 1, minWidth: '200px' }}>
            <b>{peso(done.amount)} recorded</b>
            {' · '}
            {done.trips} trip{done.trips === 1 ? '' : 's'} settled by {methodLabel(done.method)}
            {done.reference ? ` · Ref ${done.reference}` : ''}. {done.name} sees it now.
          </div>
          <button type="button" style={s.bannerBtn} onClick={reset}>Start a new payout</button>
        </div>
      )}

      <div style={s.shell}>
        {/* 1 — pick trips */}
        <div style={s.col(false, false)}>
          <div style={s.stepHead}>
            <span style={s.stepNum} aria-hidden="true">1</span>
            <span style={s.stepName}>Pick trips</span>
          </div>

          <div style={s.chips}>
            {rows.map((r) => (
              <button
                key={r.consignor.id}
                type="button"
                style={s.chip(r.consignor.id === row.consignor.id)}
                onClick={() => choose(r.consignor.id)}
              >
                <span style={s.chipName}>{r.consignor.name}</span>
                <span style={s.chipSub}>
                  {r.owed > 0
                    ? `${r.payable.length} trip${r.payable.length === 1 ? '' : 's'} · ${peso(r.owed)}`
                    : 'nothing owed'}
                </span>
              </button>
            ))}
          </div>

          {payable.length === 0 ? (
            <div style={s.empty}>
              {row.consignor.name} is paid for every finished trip.
              {row.coming > 0
                ? ` ${peso(row.coming)} is booked but not travelled — each trip becomes payable when it ends.`
                : ' Nothing is booked ahead.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={s.tickBar}>
                <span style={s.tickCount}>{picked.length} of {payable.length} trips</span>
                <button type="button" className="text-link-btn" style={s.tickAll} onClick={toggleAll}>
                  {allOn ? 'Untick all' : 'Tick all'}
                </button>
              </div>
              {payable.map((trip) => {
                const on = !unticked.has(trip.id);
                return (
                  <button
                    key={trip.id}
                    type="button"
                    className="card-row-btn"
                    style={s.tripBtn}
                    onClick={() => toggle(trip.id)}
                    aria-pressed={on}
                  >
                    <span style={s.box(on)}><TickIcon size={12} stroke={3} /></span>
                    <span style={s.tripWhen}>
                      {tripSpan(trip)}
                      <span style={s.tripVeh}>{trip.vehicle}{trip.plateNumber ? ` · ${trip.plateNumber}` : ''}</span>
                    </span>
                    <span style={s.tripAmt}>{peso(trip.amount)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2 — send it */}
        <div style={{ ...s.col(picked.length === 0, false), ...s.colEdge }}>
          <div style={s.stepHead}>
            <span style={s.stepNum} aria-hidden="true">2</span>
            <span style={s.stepName}>Send the money</span>
          </div>

          <div style={s.seg} role="group" aria-label="How the money is sent">
            {PAYOUT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                style={s.segBtn(method === m)}
                aria-pressed={method === m}
                onClick={() => { setMethod(m); setSent(false); setDone(null); }}
              >
                {methodLabel(m)}
              </button>
            ))}
          </div>

          <div style={s.sendBox}>
            <div>
              <div style={s.sendVerb}>{sendVerb}</div>
              <div style={s.sendAmount}>{peso(total)}</div>
            </div>
            <div style={s.sendTo}>
              <div style={s.sendVerb}>{method === 'cash' ? 'To' : 'Send to'}</div>
              <div style={s.sendDest}>{sendDest}</div>
              <div style={s.sendCheck}>{sendCheck}</div>
            </div>
          </div>

          {editingGcash ? (
            <div style={s.gcashRow}>
              <input
                style={s.input}
                value={gcashDraft.number}
                placeholder="GCash number"
                aria-label="GCash number"
                onChange={(e) => setGcashDraft({ ...gcashDraft, number: e.target.value })}
              />
              <input
                style={s.input}
                value={gcashDraft.name}
                placeholder="Name the account is registered to"
                aria-label="GCash account name"
                onChange={(e) => setGcashDraft({ ...gcashDraft, name: e.target.value })}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" style={s.primary} disabled={savingGcash} onClick={saveGcash}>
                  {savingGcash ? 'Saving…' : 'Save details'}
                </button>
                <button type="button" style={s.ghost} onClick={() => setEditingGcash(false)}>Cancel</button>
              </div>
              <span style={s.hint}>
                Take these from the owner, not from a message — this is the field that decides
                where their money goes.
              </span>
            </div>
          ) : needsGcash ? (
            <button
              type="button"
              style={s.primary}
              onClick={() => { setGcashDraft(gcash); setEditingGcash(true); }}
            >
              Add their GCash details
            </button>
          ) : sent ? (
            <div style={s.sentLine}>
              <TickIcon size={16} stroke={2.2} />
              <span style={{ flex: 1 }}>Marked as sent</span>
              <button type="button" className="text-link-btn" style={s.undo} onClick={() => setSent(false)}>Undo</button>
            </div>
          ) : (
            <>
              <button type="button" style={s.primary} onClick={() => { setSent(true); setDone(null); }}>
                I&rsquo;ve sent it
              </button>
              {method === 'gcash' && (
                <button
                  type="button"
                  style={s.ghost}
                  onClick={() => { setGcashDraft(gcash); setEditingGcash(true); }}
                >
                  Change their GCash details
                </button>
              )}
            </>
          )}
        </div>

        {/* 3 — write it down */}
        <div style={{ ...s.col(!sent || picked.length === 0, sent && picked.length > 0), ...s.colEdge }}>
          <div style={s.stepHead}>
            <span style={s.stepNum} aria-hidden="true">3</span>
            <span style={s.stepName}>Write it down</span>
          </div>

          {method === 'cash' ? (
            <div style={s.cashNote}>
              <span style={s.cashStrong}>Cash, in person.</span> No reference needed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={s.label} htmlFor="payout-ref">
                {methodLabel(method)} reference number
                {referenceRequired(method) ? '' : ' (optional)'}
              </label>
              <input
                id="payout-ref"
                style={s.input}
                value={reference}
                placeholder="e.g. 0031 7720 1194"
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickReceipt} />
          <button type="button" style={s.attach} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {receipt
              ? <><TickIcon size={15} />Receipt attached</>
              : uploading ? 'Uploading…' : 'Attach receipt (optional)'}
          </button>

          <textarea
            rows={2}
            style={s.area}
            value={note}
            placeholder="Note (optional)"
            aria-label="Note"
            onChange={(e) => setNote(e.target.value)}
          />

          <div style={s.recordWrap}>
            <button
              type="button"
              style={{ ...(problem || saving ? s.primaryOff : s.primary), width: '100%', minHeight: '50px' }}
              disabled={!!problem || saving}
              onClick={record}
            >
              {saving ? 'Recording…' : `Record ${peso(total)}`}
            </button>
            <span style={s.hint}>{hint}</span>
          </div>
        </div>
      </div>
    </>
  );
};

export default PayoutConsole;
