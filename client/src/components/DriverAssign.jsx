import { useState, useEffect } from 'react';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import api from '../api';
import DriverAvatar from './DriverAvatar';

// Naming the driver on a booking, or changing one.
//
// Its own component rather than part of the details dialog, because it
// needs to ask the server who is free and the dialog has no state of its
// own. It is also the only place "whoever you send" is actually honoured:
// a customer who left it to us leaves this empty, and somebody here fills
// it in before pickup day.
//
// Phone numbers appear here and nowhere a customer can reach. See
// utils/drivers.js.
const DriverAssign = ({ booking, isDark, onAssigned }) => {
  const [free, setFree] = useState(null);
  const [choice, setChoice] = useState(booking.driver?._id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const span = `${booking.startDate}|${booking.endDate}`;

  // Who could take these dates. The one already on the booking is left out
  // of the clash check by the server, so they stay choosable.
  useEffect(() => {
    let cancelled = false;
    const [start, end] = span.split('|');
    api.get('/drivers/available', { params: { start, end } })
      .then(({ data }) => { if (!cancelled) setFree(data || []); })
      .catch(() => { if (!cancelled) setFree([]); });
    return () => { cancelled = true; };
  }, [span]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.put(`/bookings/${booking._id}/driver`, { driver: choice || null });
      onAssigned?.(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  const s = {
    wrap: { marginBottom: '18px' },
    title: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px',
    },
    current: { fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '8px' },
    sub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '8px', lineHeight: 1.5 },
    row: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
    select: {
      flex: 1, minWidth: '160px', padding: '8px 10px', fontSize: '13px', borderRadius: '8px', outline: 'none',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    btn: {
      padding: '8px 14px', fontSize: '13px', fontWeight: '700', border: 'none', borderRadius: '8px',
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: saving ? 'default' : 'pointer',
      opacity: saving ? 0.6 : 1,
    },
    error: { fontSize: '12px', color: isDark ? '#fca5a5' : '#dc2626', marginTop: '8px' },
  };

  // The one on the booking has to stay in the list even though the server
  // counts them as busy — they are busy with THIS trip.
  const options = [
    ...(booking.driver && !(free || []).some((d) => d._id === booking.driver._id) ? [booking.driver] : []),
    ...(free || []),
  ];

  return (
    <div style={s.wrap}>
      <div style={s.title}>Driver</div>
      <div style={s.current}>
        {booking.driver
          ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DriverAvatar driver={booking.driver} isDark={isDark} size={34} />
              <span>{booking.driver.name}{booking.driver.phone ? ` · ${booking.driver.phone}` : ''}</span>
            </span>
          )
          : 'Nobody named yet — the customer left it to you.'}
      </div>
      {free === null ? (
        <p style={s.sub}>Checking who is free…</p>
      ) : (
        <>
          <div style={s.row}>
            <select
              style={s.select}
              value={choice}
              aria-label="Driver"
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Nobody yet</option>
              {options.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
            <button type="button" style={s.btn} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <p style={{ ...s.sub, marginTop: '8px', marginBottom: 0 }}>
            {options.length === 0
              ? 'Nobody is free for these dates. Add a driver, or free one up by changing another booking.'
              : 'Only drivers free for these dates are listed. The customer is told once the booking is accepted.'}
          </p>
        </>
      )}
      {error && <p style={s.error}>{error}</p>}
    </div>
  );
};

export default DriverAssign;
