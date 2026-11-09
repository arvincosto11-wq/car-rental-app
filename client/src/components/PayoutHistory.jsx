import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { methodLabel, voidProblem } from '../utils/payouts';
import api from '../api';

// Every payment recorded, including the ones that turned out to be wrong.
//
// A voided payment stays on the list, struck through, with the reason
// beside it. The owner saw the original figure; a row that simply
// disappeared would be indistinguishable from one being hidden.
//
// Voiding opens inside its own row rather than over the page. A dialog
// would have covered the list the payment is being judged against — the
// other payments to the same owner on the same day are exactly what tells
// you whether this one is the duplicate.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const when = (value) => new Date(value).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});

const PayoutHistory = ({ payouts, onChanged }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [voiding, setVoiding] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const ink = isDark ? '#e8a100' : '#7c4a03';
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';
  const blue = isDark ? '#8ab4f8' : '#1d4ed8';
  const blueSoft = isDark ? 'rgba(138,180,248,0.13)' : '#eaf0fd';
  // Red only here, and only for the one thing on this page that undoes
  // something. Everywhere else gold carries the weight.
  const red = isDark ? '#f28b82' : '#b91c1c';
  const redSoft = isDark ? 'rgba(242,139,130,0.13)' : '#fdecec';

  const s = {
    wrap: {
      background: card, border: `1px solid ${line}`, borderRadius: '14px',
      overflow: 'hidden', marginBottom: '20px',
    },
    head: { padding: '18px 22px 15px' },
    heading: { margin: 0, fontSize: '16px', fontWeight: '700', color: text },
    sub: { margin: '3px 0 0', fontSize: '13px', color: text3 },

    row: (dead) => ({
      display: 'grid',
      gridTemplateColumns: '116px minmax(130px, 150px) 104px minmax(160px, 170px) minmax(0, 1fr) auto',
      gap: '16px', alignItems: 'center', padding: '14px 22px',
      fontSize: '13.5px', color: text, opacity: dead ? 0.6 : 1,
    }),
    group: { borderTop: `1px solid ${line}` },
    cellSub: { display: 'block', fontSize: '12px', color: text3, marginTop: '1px' },
    amount: (dead) => ({
      fontSize: '14px', fontWeight: '750', color: dead ? text3 : text,
      fontVariantNumeric: 'tabular-nums',
      textDecoration: dead ? 'line-through' : 'none',
    }),
    chip: (tone) => ({
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px',
      fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
      background: tone === 'green' ? greenSoft : tone === 'blue' ? blueSoft : inset,
      color: tone === 'green' ? green : tone === 'blue' ? blue : text3,
      border: tone === 'grey' ? `1px solid ${line}` : 'none',
    }),
    voidBtn: {
      border: 0, background: 'transparent', color: ink, fontFamily: 'inherit',
      fontSize: '13px', fontWeight: '650', cursor: 'pointer', padding: '6px',
    },

    confirm: {
      margin: '0 22px 16px', padding: '16px', borderRadius: '12px',
      border: `1.5px solid ${red}`, background: redSoft,
      display: 'flex', flexDirection: 'column', gap: '10px',
    },
    confirmText: { fontSize: '13px', color: text, textWrap: 'pretty' },
    area: {
      width: '100%', padding: '10px 12px', borderRadius: '10px', resize: 'vertical',
      border: `1px solid ${line}`, background: card, color: text,
      fontFamily: 'inherit', fontSize: '13.5px',
    },
    redBtn: (off) => ({
      minHeight: '44px', padding: '0 16px', borderRadius: '10px', border: 0,
      background: red, color: isDark ? '#17130e' : '#ffffff',
      fontFamily: 'inherit', fontSize: '13.5px', fontWeight: '700',
      cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.45 : 1,
    }),
    keepBtn: {
      minHeight: '44px', padding: '0 16px', borderRadius: '10px',
      border: `1px solid ${line}`, background: card, color: text,
      fontFamily: 'inherit', fontSize: '13.5px', fontWeight: '650', cursor: 'pointer',
    },
    empty: { padding: '22px', fontSize: '13px', color: text3, textWrap: 'pretty' },
  };

  const doVoid = async (payout) => {
    const problem = voidProblem(reason);
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      await api.put(`/payouts/${payout._id}/void`, { reason });
      setVoiding('');
      setReason('');
      onChanged('Voided. Those trips are owed again.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not void that payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section style={s.wrap} aria-label="Payment history">
      <div style={s.head}>
        <h2 style={s.heading}>Payment history</h2>
        <p style={s.sub}>Every payment, including voided ones. Nothing here is ever deleted.</p>
      </div>

      {payouts.length === 0 ? (
        <p style={s.empty}>
          No payment has been recorded yet. One appears here the moment you settle an owner.
        </p>
      ) : payouts.map((p) => {
        const dead = p.status === 'void';
        const trips = (p.bookings || []).length;
        const open = voiding === p._id;
        return (
          <div key={p._id} style={s.group}>
            <div style={s.row(dead)}>
              <span>
                {when(p.createdAt)}
                <span style={s.cellSub}>{p.recordedBy?.name ? `by ${p.recordedBy.name}` : 'by admin'}</span>
              </span>
              <span style={{ fontWeight: '650' }}>
                {p.consignor?.name || 'Unknown owner'}
                <span style={s.cellSub}>{p.consignor?.phone || ''}</span>
              </span>
              <span style={s.amount(dead)}>{peso(p.amount)}</span>
              <span>
                {methodLabel(p.method)}
                <span style={s.cellSub}>
                  {p.reference ? `Ref ${p.reference}` : p.method === 'cash' ? 'handed over in person' : 'no reference'}
                </span>
              </span>
              <span style={{ fontSize: '13px', color: text2, textWrap: 'pretty' }}>
                {dead
                  ? `Voided · ${p.voidReason}`
                  : `${trips} trip${trips === 1 ? '' : 's'} settled${p.note ? ` · ${p.note}` : ''}`}
              </span>
              <span style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
                {dead
                  ? <span style={s.chip('grey')}>Voided</span>
                  : p.confirmedAt
                    ? <span style={s.chip('green')}>Owner confirmed</span>
                    : <span style={s.chip('blue')}>Awaiting owner</span>}
                {!dead && !open && (
                  <button
                    type="button"
                    className="text-link-btn"
                    style={s.voidBtn}
                    onClick={() => { setVoiding(p._id); setReason(''); }}
                  >
                    Void
                  </button>
                )}
              </span>
            </div>

            {open && (
              <div style={s.confirm}>
                <div style={s.confirmText}>
                  <b>Void this {peso(p.amount)} payment?</b> It stays here, struck through, with your
                  reason. Its {trips} trip{trips === 1 ? '' : 's'} go back to owed
                  and {p.consignor?.name || 'the owner'} is told.
                </div>
                <textarea
                  rows={2}
                  style={s.area}
                  value={reason}
                  aria-label="Why this payment is being voided"
                  placeholder="Why? e.g. Sent twice by mistake"
                  onChange={(e) => setReason(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={s.redBtn(saving || !!voidProblem(reason))}
                    disabled={saving || !!voidProblem(reason)}
                    onClick={() => doVoid(p)}
                  >
                    {saving ? 'Voiding…' : 'Void the payment'}
                  </button>
                  <button
                    type="button"
                    style={s.keepBtn}
                    disabled={saving}
                    onClick={() => { setVoiding(''); setReason(''); }}
                  >
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default PayoutHistory;
