import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { methodLabel, voidProblem } from '../utils/payouts';
import { CloseIcon } from './adminConsignIcons';
import api from '../api';

// Every payment recorded, including the ones that turned out to be wrong.
//
// A voided payment stays on the list, struck through, with the reason
// beside it. The owner saw the original figure; a row that simply
// disappeared would be indistinguishable from one being hidden.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const when = (value) => new Date(value).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});

const PayoutHistory = ({ payouts, onChanged }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [voiding, setVoiding] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const divider = isDark ? '#303132' : '#f3f4f6';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';

  const s = {
    wrap: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px',
      overflow: 'hidden', marginBottom: '20px',
    },
    head: { padding: '17px 20px 14px' },
    heading: { margin: 0, fontSize: '15px', fontWeight: '700', color: text },
    sub: { margin: '3px 0 0', fontSize: '12px', color: text3 },

    row: (dead) => ({
      display: 'grid',
      gridTemplateColumns: '116px minmax(130px, 1fr) 108px minmax(170px, 1.1fr) minmax(140px, 1fr) auto',
      gap: '14px', alignItems: 'center', padding: '13px 20px',
      borderTop: `1px solid ${divider}`, fontSize: '13px', color: text,
      opacity: dead ? 0.62 : 1,
    }),
    cellSub: { display: 'block', fontSize: '11.5px', color: text3, marginTop: '1px' },
    amount: (dead) => ({
      fontSize: '14px', fontWeight: '750', color: text,
      fontVariantNumeric: 'tabular-nums',
      textDecoration: dead ? 'line-through' : 'none',
    }),
    pill: (tone) => ({
      display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: '999px',
      fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
      background: tone === 'green' ? greenSoft : inset,
      color: tone === 'green' ? green : text3,
      border: tone === 'green' ? 'none' : `1px solid ${line}`,
    }),
    voidBtn: {
      background: 'none', border: 0, padding: 0, color: text3,
      fontFamily: 'inherit', fontSize: '12.5px', textDecoration: 'underline', cursor: 'pointer',
    },
    empty: { padding: '22px 20px', fontSize: '13px', color: text3 },

    backdrop: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '48px 16px', overflowY: 'auto',
    },
    modal: {
      width: '100%', maxWidth: '480px', background: card,
      border: `1px solid ${line}`, borderRadius: '14px',
      boxShadow: '0 18px 50px rgba(0,0,0,0.3)',
    },
    mHead: { padding: '18px 22px 14px', borderBottom: `1px solid ${line}`, display: 'flex', gap: '12px' },
    mTitle: { margin: 0, fontSize: '17px', fontWeight: '750', color: text },
    mSub: { margin: '4px 0 0', fontSize: '13px', color: text2 },
    close: {
      marginLeft: 'auto', flex: 'none', width: '34px', height: '34px', borderRadius: '8px',
      border: `1px solid ${line}`, background: 'transparent', color: text3,
      display: 'grid', placeItems: 'center', cursor: 'pointer',
    },
    mBody: { padding: '18px 22px', display: 'grid', gap: '14px' },
    fine: { margin: 0, fontSize: '12.5px', color: text3, textWrap: 'pretty' },
    label: { display: 'block', fontSize: '12px', fontWeight: '700', color: text2, marginBottom: '7px' },
    area: {
      width: '100%', padding: '9px 12px', borderRadius: '8px', resize: 'vertical',
      border: `1px solid ${line}`, background: isDark ? '#18191a' : '#fff',
      color: text, fontFamily: 'inherit', fontSize: '13.5px',
    },
    mFoot: {
      padding: '15px 22px', borderTop: `1px solid ${line}`,
      display: 'flex', justifyContent: 'flex-end', gap: '9px', flexWrap: 'wrap',
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
    goldInk: { color: ink },
  };

  const doVoid = async () => {
    const problem = voidProblem(reason);
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      await api.put(`/payouts/${voiding._id}/void`, { reason });
      setVoiding(null);
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
        <p style={s.sub}>Every payment recorded, including the ones voided. Nothing here is ever deleted.</p>
      </div>

      {payouts.length === 0 ? (
        <p style={s.empty}>
          No payment has been recorded yet. One appears here the moment you settle a consignor.
        </p>
      ) : payouts.map((p) => {
        const dead = p.status === 'void';
        const trips = (p.bookings || []).length;
        return (
          <div key={p._id} style={s.row(dead)}>
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
            <span style={{ fontSize: '12.5px', color: text3, textWrap: 'pretty' }}>
              {dead
                ? `Voided — ${p.voidReason}`
                : `${trips} trip${trips === 1 ? '' : 's'} settled${p.note ? ` · ${p.note}` : ''}`}
            </span>
            <span style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-end' }}>
              {dead
                ? <span style={s.pill('neutral')}>Voided</span>
                : p.confirmedAt
                  ? <span style={s.pill('green')}>Owner confirmed</span>
                  : <span style={s.pill('neutral')}>Awaiting owner</span>}
              {!dead && (
                <button type="button" style={s.voidBtn} onClick={() => { setVoiding(p); setReason(''); }}>
                  Void
                </button>
              )}
            </span>
          </div>
        );
      })}

      {voiding && (
        <div
          style={s.backdrop}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setVoiding(null); }}
        >
          <div style={s.modal} role="dialog" aria-modal="true" aria-labelledby="void-title">
            <div style={s.mHead}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 id="void-title" style={s.mTitle}>Void this payment?</h2>
                <p style={s.mSub}>
                  {peso(voiding.amount)} to {voiding.consignor?.name || 'this owner'},
                  recorded {when(voiding.createdAt)}.
                </p>
              </div>
              <button type="button" style={s.close} onClick={() => setVoiding(null)} aria-label="Close">
                <CloseIcon size={16} />
              </button>
            </div>
            <div style={s.mBody}>
              <p style={s.fine}>
                It stays in the history, struck through, with your reason beside it. The trips it
                covered go back to owed, and {voiding.consignor?.name || 'the owner'} is told.
              </p>
              <div>
                <label style={s.label} htmlFor="void-reason">Why</label>
                <textarea
                  id="void-reason"
                  style={s.area}
                  rows={3}
                  value={reason}
                  placeholder="Sent twice by mistake — paid in cash instead."
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <div style={s.mFoot}>
              <button type="button" style={s.ghost} disabled={saving} onClick={() => setVoiding(null)}>
                Keep it
              </button>
              <button type="button" style={s.primary} disabled={saving} onClick={doVoid}>
                {saving ? 'Voiding…' : 'Void the payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default PayoutHistory;
