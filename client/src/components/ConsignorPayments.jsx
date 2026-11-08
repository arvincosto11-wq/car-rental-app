import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { splitFor } from '../utils/revenueShare';
import { owedSummary, methodLabel, daysWaiting } from '../utils/payouts';
import api from '../api';

// What the owner has been paid, and what is still coming to them.
//
// The other half of the admin ledger. Until this existed an owner could
// see what their vehicles had earned and had no way at all to check it
// against what had actually reached their GCash — which made the earnings
// figure something to take on trust rather than something to agree with.
//
// Confirming receipt is the point of the screen. Admin's record says the
// money was sent; this is where the person who was meant to get it says
// whether it arrived. The payments nobody confirms are the ones worth
// asking about, on both sides.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const when = (value) => new Date(value).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric',
});

const ConsignorPayments = ({ bookings }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await api.get('/payouts/mine');
        if (live) setPayouts(res.data || []);
      } catch {
        if (live) setFailed(true);
      } finally {
        if (live) setLoading(false);
      }
    };
    load();
    return () => { live = false; };
  }, [reload]);

  // Which of their trips a payment has already covered. Voided payments
  // release theirs, which is why status is checked rather than assumed.
  const paidIds = new Set();
  for (const p of payouts) {
    if (p.status === 'void') continue;
    for (const b of p.bookings || []) paidIds.add(String(b?._id || b));
  }

  const due = owedSummary({
    bookings,
    share: (b) => splitFor(b).owner,
    paidIds,
  });

  const received = payouts
    .filter((p) => p.status !== 'void')
    .reduce((sum, p) => sum + p.amount, 0);

  const waiting = due.oldestUnpaidAt ? daysWaiting(due.oldestUnpaidAt) : 0;

  const confirm = async (payout) => {
    setConfirming(payout._id);
    try {
      await api.put(`/payouts/${payout._id}/confirm`);
      setReload((n) => n + 1);
      toast.success('Thank you — that payment is marked as received.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm that just now.');
    } finally {
      setConfirming('');
    }
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const divider = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldSoft = isDark ? 'rgba(232,161,0,0.14)' : '#fbf3e2';
  const goldLine = isDark ? '#5a4415' : '#edd693';
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';

  const s = {
    tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' },
    tile: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px', padding: '15px 17px',
    },
    owedTile: {
      background: goldSoft, border: `1px solid ${goldLine}`, borderRadius: '12px', padding: '15px 17px',
    },
    label: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: text3 },
    labelGold: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: ink },
    value: { fontSize: '26px', fontWeight: '800', color: text, marginTop: '5px', fontVariantNumeric: 'tabular-nums' },
    valueGold: { fontSize: '26px', fontWeight: '800', color: ink, marginTop: '5px', fontVariantNumeric: 'tabular-nums' },
    note: { fontSize: '12px', color: text3, marginTop: '3px', textWrap: 'pretty' },
    noteGold: { fontSize: '12px', color: ink, opacity: 0.85, marginTop: '3px', textWrap: 'pretty' },

    explain: {
      marginTop: '16px', padding: '12px 15px', borderRadius: '10px', background: inset,
      border: `1px solid ${line}`, fontSize: '12.5px', color: text2, textWrap: 'pretty',
    },

    listHead: { margin: '24px 0 10px', fontSize: '15px', fontWeight: '750', color: text },
    list: { background: card, border: `1px solid ${line}`, borderRadius: '12px', overflow: 'hidden' },
    row: (dead) => ({
      display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      padding: '14px 17px', borderTop: `1px solid ${divider}`, opacity: dead ? 0.62 : 1,
    }),
    first: { borderTop: 'none' },
    amount: (dead) => ({
      fontSize: '18px', fontWeight: '800', color: text, minWidth: '104px',
      fontVariantNumeric: 'tabular-nums',
      textDecoration: dead ? 'line-through' : 'none',
    }),
    meta: { fontSize: '12.5px', color: text3 },
    strong: { fontSize: '13.5px', fontWeight: '650', color: text },
    pill: (tone) => ({
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px',
      fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap',
      background: tone === 'green' ? greenSoft : inset,
      color: tone === 'green' ? green : text3,
      border: tone === 'green' ? 'none' : `1px solid ${line}`,
    }),
    confirmBtn: {
      minHeight: '36px', padding: '0 14px', borderRadius: '8px', border: 0,
      background: gold, color: ON_GOLD, fontFamily: 'inherit',
      fontSize: '12.5px', fontWeight: '750', cursor: 'pointer',
    },
    empty: { padding: '22px 17px', fontSize: '13px', color: text3, textWrap: 'pretty' },
    voidNote: { flexBasis: '100%', fontSize: '12.5px', color: text3, textWrap: 'pretty' },
  };

  return (
    <>
      <div style={s.tiles}>
        <div style={s.owedTile}>
          <div style={s.labelGold}>Owed to you</div>
          <div style={s.valueGold}>{peso(due.owed)}</div>
          <div style={s.noteGold}>
            {due.owed === 0
              ? 'Everything finished has been paid.'
              : `${due.payable.length} finished trip${due.payable.length === 1 ? '' : 's'}`
                + `, oldest ${waiting} day${waiting === 1 ? '' : 's'} ago`}
          </div>
        </div>
        <div style={s.tile}>
          <div style={s.label}>Paid to you</div>
          <div style={s.value}>{peso(received)}</div>
          <div style={s.note}>across {payouts.filter((p) => p.status !== 'void').length} payment
            {payouts.filter((p) => p.status !== 'void').length === 1 ? '' : 's'}</div>
        </div>
        <div style={s.tile}>
          <div style={s.label}>Coming</div>
          <div style={s.value}>{peso(due.coming)}</div>
          <div style={s.note}>
            {due.coming === 0 ? 'No trips booked ahead.' : 'Booked but not yet travelled.'}
          </div>
        </div>
      </div>

      <p style={s.explain}>
        A trip is paid once it has finished and your vehicle is back — a booking that has not
        travelled yet can still be cancelled, so it is shown as coming rather than owed. Payments
        are sent to your GCash by hand and recorded here. If one is marked sent and never reached
        you, say so before confirming it.
      </p>

      <h2 style={s.listHead}>Your payments</h2>

      <div style={s.list}>
        {failed ? (
          <p style={s.empty}>Could not load your payments just now. Please try again in a moment.</p>
        ) : loading ? (
          <p style={s.empty}>Loading…</p>
        ) : payouts.length === 0 ? (
          <p style={s.empty}>
            No payment has been recorded yet. Each one appears here with the reference number, so
            you can check it against your own GCash.
          </p>
        ) : payouts.map((p, i) => {
          const dead = p.status === 'void';
          const trips = (p.bookings || []).length;
          return (
            <div key={p._id} style={{ ...s.row(dead), ...(i === 0 ? s.first : null) }}>
              <span style={s.amount(dead)}>{peso(p.amount)}</span>
              <span style={{ flex: 1, minWidth: '180px' }}>
                <span style={s.strong}>
                  {methodLabel(p.method)}
                  {p.reference ? ` · Ref ${p.reference}` : ''}
                </span>
                <span style={{ ...s.meta, display: 'block', marginTop: '2px' }}>
                  {when(p.createdAt)} · {trips} trip{trips === 1 ? '' : 's'} settled
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </span>
              {dead ? (
                <>
                  <span style={s.pill('neutral')}>Voided</span>
                  <span style={s.voidNote}>
                    This payment was cancelled — {p.voidReason} Those trips are owed to you again.
                  </span>
                </>
              ) : p.confirmedAt ? (
                <span style={s.pill('green')}>You confirmed this</span>
              ) : (
                <button
                  type="button"
                  style={s.confirmBtn}
                  disabled={confirming === p._id}
                  onClick={() => confirm(p)}
                >
                  {confirming === p._id ? 'Saving…' : 'I received this'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default ConsignorPayments;
