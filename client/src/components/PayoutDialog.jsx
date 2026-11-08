import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { PAYOUT_METHODS, methodLabel, referenceRequired, payoutProblem } from '../utils/payouts';
import { CloseIcon, TickIcon } from './adminConsignIcons';
import api from '../api';

// Recording a payment that has already been handed over.
//
// The order on screen is the order the job happens in: here is the number
// to send to, here is what you are settling, here is the total, now tell
// me how you sent it. The money leaves in the admin's own GCash app
// between the second step and the fourth — see utils/payouts.js for why
// the system cannot send it.
//
// The amount is never posted. The server adds it up from the trips, so a
// figure typed here could not be wrong even if somebody tried.

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

const PayoutDialog = ({ row, onClose, onRecorded }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const fileRef = useRef(null);

  const [chosen, setChosen] = useState(() => new Set(row.payable.map((t) => t.id)));
  const [method, setMethod] = useState('gcash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [gcash, setGcash] = useState(row.gcash || { number: '', name: '' });
  const [editingGcash, setEditingGcash] = useState(!row.gcash?.number);
  const [gcashDraft, setGcashDraft] = useState(row.gcash || { number: '', name: '' });
  const [savingGcash, setSavingGcash] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const toggle = (id) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const total = row.payable
    .filter((t) => chosen.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0);

  const saveGcash = async () => {
    setSavingGcash(true);
    try {
      const res = await api.put(`/payouts/details/${row.consignor.id}`, gcashDraft);
      setGcash(res.data.gcash);
      setEditingGcash(false);
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
    const bookingIds = [...chosen];
    // The same check the server makes, so the refusal arrives before the
    // round trip rather than after it.
    const problem = payoutProblem({ method, reference, bookingIds });
    if (problem) return toast.error(problem);

    setSaving(true);
    try {
      await api.post('/payouts', {
        consignor: row.consignor.id,
        bookings: bookingIds,
        method,
        reference,
        note,
        receipt: receipt || undefined,
      });
      onRecorded(`${peso(total)} recorded for ${row.consignor.name}. They can see it now.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record that payment.');
      setSaving(false);
    }
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const divider = isDark ? '#303132' : '#f3f4f6';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldSoft = isDark ? 'rgba(232,161,0,0.14)' : '#fbf3e2';
  const goldLine = isDark ? '#5a4415' : '#edd693';

  const s = {
    backdrop: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '36px 16px', overflowY: 'auto',
    },
    modal: {
      width: '100%', maxWidth: '620px', background: card,
      border: `1px solid ${line}`, borderRadius: '14px',
      boxShadow: '0 18px 50px rgba(0,0,0,0.3)',
    },
    head: {
      padding: '18px 22px 14px', borderBottom: `1px solid ${line}`,
      display: 'flex', gap: '14px', alignItems: 'flex-start',
    },
    title: { margin: 0, fontSize: '18px', fontWeight: '750', color: text },
    sub: { margin: '4px 0 0', fontSize: '13px', color: text2, textWrap: 'pretty' },
    close: {
      marginLeft: 'auto', flex: 'none', width: '34px', height: '34px', borderRadius: '8px',
      border: `1px solid ${line}`, background: 'transparent', color: text3,
      display: 'grid', placeItems: 'center', cursor: 'pointer',
    },
    body: { padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '18px' },
    label: { display: 'block', fontSize: '12px', fontWeight: '700', color: text2, marginBottom: '7px' },

    gcashBox: {
      background: inset, border: `1px solid ${line}`, borderRadius: '10px',
      padding: '12px 14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
    },
    gcashNum: { fontSize: '16px', fontWeight: '750', color: text, fontVariantNumeric: 'tabular-nums' },
    gcashName: { display: 'block', fontSize: '12.5px', color: text3 },

    tripRow: {
      display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 0',
      borderTop: `1px solid ${divider}`, fontSize: '13px', color: text, cursor: 'pointer',
    },
    tripFirst: { borderTop: 'none' },
    box: { width: '16px', height: '16px', accentColor: gold, cursor: 'pointer', flex: 'none' },
    tripWhen: { minWidth: '104px', color: text2, fontVariantNumeric: 'tabular-nums' },
    tripCar: { flex: 1, minWidth: 0, color: text3, fontSize: '12.5px' },
    tripRental: { color: text3, fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' },
    tripAmt: { fontWeight: '750', color: text, fontVariantNumeric: 'tabular-nums' },

    totalLine: {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px',
      background: goldSoft, border: `1px solid ${goldLine}`, borderRadius: '10px',
      padding: '12px 15px', color: ink,
    },
    totalNum: { fontSize: '22px', fontWeight: '800', fontVariantNumeric: 'tabular-nums' },

    seg: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    segBtn: (on) => ({
      padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: on ? '750' : '600',
      border: `1px solid ${on ? goldLine : line}`, background: on ? goldSoft : 'transparent',
      color: on ? ink : text2, cursor: 'pointer', fontFamily: 'inherit',
    }),

    input: {
      width: '100%', minHeight: '40px', padding: '0 12px', borderRadius: '8px',
      border: `1px solid ${line}`, background: isDark ? '#18191a' : '#fff',
      color: text, fontFamily: 'inherit', fontSize: '13.5px',
    },
    area: {
      width: '100%', padding: '9px 12px', borderRadius: '8px', resize: 'vertical',
      border: `1px solid ${line}`, background: isDark ? '#18191a' : '#fff',
      color: text, fontFamily: 'inherit', fontSize: '13.5px',
    },
    fine: { fontSize: '12px', color: text3, margin: '7px 0 0', textWrap: 'pretty' },

    attach: {
      width: '100%', textAlign: 'left', padding: '11px 14px', borderRadius: '9px',
      border: `1px dashed ${line}`, background: 'transparent', color: text3,
      fontFamily: 'inherit', fontSize: '12.5px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: '9px',
    },

    foot: {
      padding: '15px 22px', borderTop: `1px solid ${line}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '14px', flexWrap: 'wrap',
    },
    ghost: {
      minHeight: '40px', padding: '0 16px', borderRadius: '8px',
      border: `1px solid ${line}`, background: 'transparent', color: text2,
      fontFamily: 'inherit', fontSize: '13px', fontWeight: '650', cursor: 'pointer',
    },
    primary: {
      minHeight: '40px', padding: '0 18px', borderRadius: '8px', border: 0,
      background: gold, color: ON_GOLD, fontFamily: 'inherit',
      fontSize: '13px', fontWeight: '750', cursor: 'pointer',
    },
  };

  return (
    <div style={s.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div style={s.modal} role="dialog" aria-modal="true" aria-labelledby="payout-title">
        <div style={s.head}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="payout-title" style={s.title}>Record a payment to {row.consignor.name}</h2>
            <p style={s.sub}>
              Send the money in your own GCash app, then write down what you sent. This keeps the
              record; it does not move the money.
            </p>
          </div>
          <button type="button" style={s.close} onClick={onClose} aria-label="Close"><CloseIcon size={16} /></button>
        </div>

        <div style={s.body}>
          <div>
            <span style={s.label}>Send to</span>
            {editingGcash ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                <input
                  style={s.input}
                  value={gcashDraft.number}
                  placeholder="GCash number, e.g. 0912 345 6789"
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
                  {gcash.number && (
                    <button type="button" style={s.ghost} onClick={() => setEditingGcash(false)}>Cancel</button>
                  )}
                </div>
                <p style={s.fine}>
                  Take these from the owner, not from a message — this is the field that decides
                  where their money goes.
                </p>
              </div>
            ) : (
              <div style={s.gcashBox}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={s.gcashNum}>{gcash.number}</span>
                  <span style={s.gcashName}>
                    {gcash.name ? `registered to ${gcash.name} · ` : ''}check the name before you send
                  </span>
                </div>
                <button
                  type="button"
                  style={s.ghost}
                  onClick={() => { setGcashDraft(gcash); setEditingGcash(true); }}
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <div>
            <span style={s.label}>Trips this payment settles</span>
            {row.payable.map((trip, i) => (
              <label key={trip.id} style={{ ...s.tripRow, ...(i === 0 ? s.tripFirst : null) }}>
                <input
                  type="checkbox"
                  style={s.box}
                  checked={chosen.has(trip.id)}
                  onChange={() => toggle(trip.id)}
                />
                <span style={s.tripWhen}>{tripSpan(trip)}</span>
                <span style={s.tripCar}>
                  {trip.vehicle}{trip.plateNumber ? ` · ${trip.plateNumber}` : ''}
                </span>
                <span style={s.tripRental}>{peso(trip.rental)} taken</span>
                <span style={s.tripAmt}>{peso(trip.amount)}</span>
              </label>
            ))}
          </div>

          <div style={s.totalLine}>
            <span style={{ fontWeight: '750', fontSize: '13px' }}>Paying</span>
            <span style={s.totalNum}>{peso(total)}</span>
          </div>

          <div>
            <span style={s.label}>How you paid</span>
            <div style={s.seg} role="group" aria-label="Payment method">
              {PAYOUT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  style={s.segBtn(method === m)}
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                >
                  {methodLabel(m)}
                </button>
              ))}
            </div>
          </div>

          {method !== 'cash' && (
            <div>
              <label style={s.label} htmlFor="payout-ref">
                {methodLabel(method)} reference number{referenceRequired(method) ? '' : ' (optional)'}
              </label>
              <input
                id="payout-ref"
                style={s.input}
                value={reference}
                placeholder="0031 7720 1194"
                onChange={(e) => setReference(e.target.value)}
              />
              <p style={s.fine}>Every transfer produces one. It is what settles an argument later.</p>
            </div>
          )}

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={pickReceipt}
            />
            <button type="button" style={s.attach} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {receipt
                ? <><TickIcon size={15} />Receipt attached</>
                : uploading ? 'Uploading…' : 'Attach the receipt screenshot (optional)'}
            </button>
          </div>

          <div>
            <label style={s.label} htmlFor="payout-note">Note (optional)</label>
            <textarea
              id="payout-note"
              style={s.area}
              rows={2}
              value={note}
              placeholder="Anything worth remembering about this payment."
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div style={s.foot}>
          <span style={{ ...s.fine, margin: 0, flex: 1, minWidth: '180px' }}>
            {row.consignor.name} sees this on their own dashboard straight away.
          </span>
          <span style={{ display: 'flex', gap: '9px' }}>
            <button type="button" style={s.ghost} disabled={saving} onClick={onClose}>Cancel</button>
            <button type="button" style={s.primary} disabled={saving || editingGcash} onClick={record}>
              {saving ? 'Recording…' : 'Record payment'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

export default PayoutDialog;
