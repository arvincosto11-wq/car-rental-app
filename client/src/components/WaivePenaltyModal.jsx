import { useState } from 'react';
import { motion } from 'motion/react';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import { LAYERS } from '../layers';
import { penaltyState, WAIVE_REASONS } from '../utils/penalties';
import useModalA11y from '../hooks/useModalA11y';
import api from '../api';

// Letting a client off a charge. Deliberately asks for a reason before it
// will let the decision through: a waived debt with no explanation is the
// one thing nobody can account for afterwards, and "I think Maria did it"
// is not an answer a business can give.
//
// Opens on the full amount, because all of it is the usual answer. The
// field is there for the times it is not.
const WaivePenaltyModal = ({ booking, kind, isDark, onClose, onDone }) => {
  const p = penaltyState(booking, kind);
  const [amount, setAmount] = useState(p?.gross ?? 0);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useModalA11y(onClose);

  if (!p) return null;
  const gold = isDark ? GOLD_DARK : GOLD;
  const asked = Number(amount) || 0;
  const full = asked >= p.gross;

  const submit = async () => {
    if (!reason) { setError('Please choose a reason.'); return; }
    if (asked <= 0) { setError('Say how much to let off.'); return; }
    if (asked > p.gross) { setError(`That is more than the ${p.noun} itself.`); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.put(`/bookings/${booking._id}/penalties/${kind}/waive`, { amount: asked, reason, note });
      onDone(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that.');
      setSaving(false);
    }
  };

  const s = {
    overlay: {
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: LAYERS.modal,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    },
    box: {
      width: '100%', maxWidth: '420px', borderRadius: '14px', padding: '20px',
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    title: { fontSize: '16px', fontWeight: '700', margin: '0 0 4px' },
    sub: { fontSize: '12.5px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 16px', lineHeight: 1.5 },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px' },
    field: { marginBottom: '14px' },
    input: {
      width: '100%', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '4px', lineHeight: 1.5 },
    reasons: { display: 'grid', gap: '6px' },
    reason: (active) => ({
      textAlign: 'left', padding: '8px 11px', borderRadius: '8px', cursor: 'pointer', fontSize: '12.5px',
      border: `1px solid ${active ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : 'transparent',
      color: active ? goldInk(isDark) : (isDark ? '#e4e6eb' : '#1a1a1a'),
      fontWeight: active ? '700' : '500',
    }),
    error: { fontSize: '12px', color: isDark ? '#f87171' : '#dc2626', marginBottom: '10px' },
    actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' },
    cancel: {
      padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, background: 'transparent',
      color: isDark ? '#b0b3b8' : '#6b7280',
    },
    confirm: {
      padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: saving ? 'default' : 'pointer',
      fontSize: '13px', fontWeight: '700', background: gold, color: ON_GOLD, opacity: saving ? 0.6 : 1,
    },
  };

  return (
    <motion.div style={s.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        style={s.box}
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="waive-title"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <h2 id="waive-title" style={s.title}>Waive the {p.noun}</h2>
        <p style={s.sub}>
          ₱{p.gross.toLocaleString()} is owed on {booking.user?.name || 'this booking'}. What you waive stays on the
          record as waived — the original figure is not erased.
        </p>

        <div style={s.field}>
          <label style={s.label} htmlFor="waive-amount">How much to let off</label>
          <input
            id="waive-amount"
            type="number"
            min="1"
            max={p.gross}
            style={s.input}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p style={s.hint}>
            {full
              ? 'The whole charge. Nothing left to collect.'
              : `₱${Math.max(0, p.gross - asked).toLocaleString()} would still be due.`}
          </p>
        </div>

        <div style={s.field}>
          <span style={s.label}>Why</span>
          <div style={s.reasons} role="group" aria-label="Reason for waiving">
            {WAIVE_REASONS.map((r) => (
              <button
                type="button"
                key={r.value}
                style={s.reason(reason === r.value)}
                aria-pressed={reason === r.value}
                onClick={() => setReason(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label} htmlFor="waive-note">Note (optional)</label>
          <input
            id="waive-note"
            type="text"
            style={s.input}
            maxLength={300}
            placeholder="Anything the next person should know"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

        <div style={s.actions}>
          <button type="button" style={s.cancel} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" style={s.confirm} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : full ? 'Waive it all' : `Waive ₱${asked.toLocaleString()}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default WaivePenaltyModal;
