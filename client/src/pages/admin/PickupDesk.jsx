import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import usePageTitle from '../../hooks/usePageTitle';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { formatMoment } from '../../utils/phTime';
import { FUEL_STEPS, fuelLabel } from '../../utils/fuel';
import ConditionPhotos from '../../components/ConditionPhotos';
import { GOLD, GOLD_DARK, ON_GOLD, GOLD_TINT, GOLD_TINT_DARK } from '../../theme';
import api from '../../api';

// The counter, as its own job.
//
// Handing over a vehicle was buried in a button on Manage Bookings: find the
// booking, leave the page for Manage Clients to look at the client's ID,
// come back, press Picked Up, and tick a list from memory. The check our own
// terms promise was spread over two screens and a dialog.
//
// Here it is one card per handover, with what they should be carrying next
// to what we already hold, so the check is a comparison instead of a memory
// test — and an expired licence is visible before they arrive rather than
// after they have driven off.

// How early a handover can be recorded. Mirrors the server.
const EARLY_COLLECT_HOURS = 2;
// How long after the pickup time a booking still belongs on this screen.
const NO_SHOW_WINDOW_HOURS = 24;

const hoursFromNow = (date) => (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60);
const isExpired = (date) => !!date && new Date(date) < new Date();
const peso = (n) => `₱${(n || 0).toLocaleString()}`;

const PickupDesk = () => {
  usePageTitle('Pickup Desk');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  // Ticked per booking, and deliberately not remembered anywhere: the check
  // is of the person standing in front of you, so it starts again each time.
  const [checked, setChecked] = useState({});
  const [working, setWorking] = useState('');
  // The gauge reading, per booking. Like the tick boxes, it is of the
  // vehicle in front of you, so it starts blank every time.
  const [fuel, setFuel] = useState({});
  // The walkaround, per booking. Optional — worth encouraging, but refusing
  // to release a vehicle over a photo would be a rule about paperwork.
  const [photos, setPhotos] = useState({});
  const [notes, setNotes] = useState({});

  const fetchAll = async () => {
    try {
      const [b, c] = await Promise.all([api.get('/bookings/all'), api.get('/users')]);
      setBookings(b.data);
      setClients(c.data);
    } catch (err) {
      console.error(err);
      toast.error('Could not load today’s pickups.');
    } finally {
      setLoading(false);
    }
  };

  // Declared after fetchAll, not before it. The other admin pages call it
  // above the definition and get away with it because the effect runs after
  // render — but it trips the hooks rule, and the same shape one line out of
  // place put Manage Bookings on a white screen.
  useEffect(() => { fetchAll(); }, []);

  const clientFor = (booking) => clients.find((c) => c._id === (booking.user?._id || booking.user)) || null;

  const waiting = bookings.filter((b) => b.status === 'confirmed' && b.payment === 'paid' && !b.collectedAt);

  // Due within the window we allow a handover in, or already late for it.
  const awaiting = waiting
    .filter((b) => hoursFromNow(b.startDate) <= EARLY_COLLECT_HOURS
      && hoursFromNow(b.startDate) >= -NO_SHOW_WINDOW_HOURS)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const laterToday = waiting
    .filter((b) => hoursFromNow(b.startDate) > EARLY_COLLECT_HOURS && hoursFromNow(b.startDate) <= 24)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  // Past the window the desk normally covers, and never recorded. These
  // exist because the desk is now the only place a handover can be written
  // down — without them, a pickup somebody forgot to record on the day
  // would have nowhere left to be recorded at all, and the booking could
  // never be marked returned either.
  const overlooked = waiting
    .filter((b) => hoursFromNow(b.startDate) < -NO_SHOW_WINDOW_HOURS)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const handedOverToday = bookings
    .filter((b) => b.collectedAt && new Date(b.collectedAt).toDateString() === new Date().toDateString())
    .sort((a, b) => new Date(b.collectedAt) - new Date(a.collectedAt));

  const docsFor = (booking) => {
    const list = [
      { key: 'ids', label: 'Two valid IDs, names matching the booking' },
      { key: 'billing', label: 'Proof of billing address in their name' },
    ];
    if (booking.bookingType === 'self-drive') {
      list.push({ key: 'licence', label: 'Driver’s licence, not expired' });
    }
    return list;
  };

  const balanceDue = (booking) => Math.max(0, (booking.totalPrice || 0) - (booking.amountPaid || 0));

  // Everything that has to be true before a vehicle leaves. The money is on
  // this list because the terms put it there — "the remaining balance must
  // be paid upon vehicle pickup" — and because the card said "before the
  // keys go over" while letting the keys go over anyway. A requirement the
  // screen states and does not hold to is worse than one it never mentions.
  const readyToRelease = (booking) =>
    docsFor(booking).every((d) => checked[`${booking._id}:${d.key}`])
    && balanceDue(booking) === 0
    // Without a reading now there is nothing for the return to be measured
    // against, and section 5 of the terms becomes unenforceable for this
    // booking. It costs one tap and cannot be recovered later.
    && fuel[booking._id] !== undefined;

  const tick = (booking, key) => setChecked((prev) => ({
    ...prev,
    [`${booking._id}:${key}`]: !prev[`${booking._id}:${key}`],
  }));

  const handOver = async (booking) => {
    setWorking(booking._id);
    try {
      await api.put(`/bookings/${booking._id}/collect`, {
        fuelLevel: fuel[booking._id],
        conditionPhotos: photos[booking._id] || [],
        conditionNote: notes[booking._id] || '',
      });
      await fetchAll();
      toast.success('Keys handed over.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong recording this pickup.');
    } finally {
      setWorking('');
    }
  };

  const markNoShow = async (booking) => {
    const ok = await confirm(
      `Mark this as a no-show? It cancels the booking and forfeits the ${peso(booking.amountPaid)} `
      + 'already paid, and cannot be undone.',
      { confirmLabel: 'Yes, they never came', cancelLabel: 'Go back' }
    );
    if (!ok) return;
    setWorking(booking._id);
    try {
      await api.put(`/bookings/${booking._id}/no-show`);
      await fetchAll();
      toast.success('Recorded as a no-show.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setWorking('');
    }
  };

  const collectBalance = async (booking, remaining) => {
    const ok = await confirm(
      `Confirm you have received the remaining ${peso(remaining)} from this client, in cash or by GCash.`,
      { confirmLabel: 'Received', cancelLabel: 'Not yet' }
    );
    if (!ok) return;
    setWorking(booking._id);
    try {
      await api.put(`/bookings/${booking._id}/collect-balance`);
      await fetchAll();
      toast.success('Balance recorded.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setWorking('');
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '22px' },
    sectionTitle: {
      fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase',
      color: isDark ? '#b0b3b8' : '#6b7280', margin: '26px 0 12px',
    },
    sectionNote: {
      fontSize: '12.5px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#6b7280',
      margin: '-4px 0 12px', maxWidth: '68ch',
    },
    empty: {
      padding: '28px', borderRadius: '14px', textAlign: 'center', fontSize: '14px',
      border: `1px dashed ${isDark ? '#3a3b3c' : '#e5e7eb'}`, color: isDark ? '#b0b3b8' : '#6b7280',
    },
    card: {
      background: isDark ? '#242526' : '#fff', borderRadius: '16px', marginBottom: '14px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, overflow: 'hidden',
    },
    cardHead: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px',
      padding: '16px 18px', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`, flexWrap: 'wrap',
    },
    who: { fontSize: '16px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#111827' },
    what: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
    when: { fontSize: '13px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD, textAlign: 'right' },
    whenNote: { fontSize: '11px', fontWeight: '500', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
    body: {
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: '18px', padding: '16px 18px',
    },
    paneTitle: {
      fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px',
    },
    field: { fontSize: '13px', color: isDark ? '#e4e6eb' : '#374151', marginBottom: '6px' },
    fieldLabel: { color: isDark ? '#8a8d91' : '#9ca3af' },
    idRow: { display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' },
    idImage: {
      width: '132px', height: '84px', objectFit: 'cover', borderRadius: '8px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, cursor: 'zoom-in',
    },
    noId: { fontSize: '12px', fontStyle: 'italic', color: isDark ? '#8a8d91' : '#9ca3af' },
    warn: {
      marginTop: '10px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px',
      fontWeight: '700', lineHeight: 1.5,
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#991b1b',
    },
    check: {
      display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '13px', lineHeight: 1.5,
      padding: '7px 0', cursor: 'pointer', color: isDark ? '#e4e6eb' : '#374151',
    },
    fuelBlock: { marginTop: '12px' },
    noteInput: {
      width: '100%', marginTop: '10px', padding: '8px 10px', fontSize: '12.5px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    fuelLabel: {
      fontSize: '11px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '6px',
    },
    fuelRow: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
    fuelChip: (on) => ({
      padding: '5px 9px', fontSize: '11px', fontWeight: on ? '800' : '500', borderRadius: '7px',
      cursor: 'pointer',
      border: `1px solid ${on ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: on ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: on ? ON_GOLD : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    balanceDue: {
      marginTop: '10px', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '9px',
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      color: isDark ? '#f87171' : '#991b1b',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`,
    },
    balance: {
      marginTop: '10px', padding: '10px 12px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5,
      background: isDark ? GOLD_TINT_DARK : GOLD_TINT, color: isDark ? '#e4e6eb' : '#7c4a03',
    },
    actions: {
      display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
      padding: '14px 18px', borderTop: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    primary: (on) => ({
      padding: '9px 18px', fontSize: '13px', fontWeight: '800', border: 'none', borderRadius: '9px',
      cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.45,
      background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD,
    }),
    ghost: {
      padding: '9px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '9px', cursor: 'pointer',
      border: `1px solid ${isDark ? '#f87171' : '#dc2626'}`, background: 'transparent',
      color: isDark ? '#f87171' : '#dc2626',
    },
    link: {
      padding: '9px 14px', fontSize: '12px', fontWeight: '700', borderRadius: '9px', cursor: 'pointer',
      border: `1px solid ${isDark ? GOLD_DARK : GOLD}`, background: 'transparent',
      color: isDark ? GOLD_DARK : GOLD,
    },
    hint: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af' },
    doneRow: {
      display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
      padding: '11px 16px', borderRadius: '12px', marginBottom: '8px', fontSize: '13px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, color: isDark ? '#b0b3b8' : '#6b7280',
    },
    doneWhen: { fontWeight: '700', color: isDark ? '#86efac' : '#065f46' },
  };

  const Card = ({ booking, late, stale }) => {
    const client = clientFor(booking);
    const remaining = (booking.totalPrice || 0) - (booking.amountPaid || 0);
    const selfDrive = booking.bookingType === 'self-drive';
    const licenceExpired = selfDrive && isExpired(client?.licenseExpiry);
    const idExpired = isExpired(client?.validIdExpiry);
    const busy = working === booking._id;

    return (
      <div style={s.card}>
        <div style={s.cardHead}>
          <div>
            <div style={s.who}>{booking.user?.name || 'Client'}</div>
            <div style={s.what}>
              {booking.car?.brand} {booking.car?.model}
              {booking.car?.plateNumber ? ` · ${booking.car.plateNumber}` : ''}
              {' · '}{selfDrive ? 'Self-drive' : 'With driver'}
            </div>
          </div>
          <div style={stale || late ? { ...s.when, color: isDark ? '#f87171' : '#dc2626' } : s.when}>
            {formatMoment(booking.startDate, booking.hasPickupTime)}
            <div style={s.whenNote}>
              {stale ? 'Pickup was never recorded' : late ? 'Pickup time has passed' : 'Due'}
              {' · back '}
              {formatMoment(booking.endDate, booking.hasPickupTime)}
            </div>
          </div>
        </div>

        <div className="responsive-row-2" style={s.body}>
          <div>
            <div style={s.paneTitle}>What we hold on file</div>
            <div style={s.field}>
              <span style={s.fieldLabel}>Valid ID: </span>
              {client?.validIdType || 'none on file'}
              {client?.validIdExpiry ? ` · expires ${new Date(client.validIdExpiry).toLocaleDateString()}` : ''}
            </div>
            {selfDrive && (
              <div style={s.field}>
                <span style={s.fieldLabel}>Licence: </span>
                {client?.licenseNumber || 'none on file'}
                {client?.licenseExpiry ? ` · expires ${new Date(client.licenseExpiry).toLocaleDateString()}` : ''}
              </div>
            )}
            <div style={s.idRow}>
              {client?.validIdImage ? (
                <>
                  <img
                    src={client.validIdImage}
                    alt="Valid ID front"
                    style={s.idImage}
                    onClick={() => window.open(client.validIdImage, '_blank', 'noopener')}
                  />
                  {client.validIdImageBack && (
                    <img
                      src={client.validIdImageBack}
                      alt="Valid ID back"
                      style={s.idImage}
                      onClick={() => window.open(client.validIdImageBack, '_blank', 'noopener')}
                    />
                  )}
                </>
              ) : (
                <span style={s.noId}>No ID uploaded to their account.</span>
              )}
            </div>
            {licenceExpired && (
              <div style={s.warn}>
                Their licence expired on {new Date(client.licenseExpiry).toLocaleDateString()}. Do not
                release a self-drive vehicle against it.
              </div>
            )}
            {idExpired && (
              <div style={s.warn}>
                The ID on their account expired on {new Date(client.validIdExpiry).toLocaleDateString()}.
              </div>
            )}
          </div>

          <div>
            <div style={s.paneTitle}>Check in person</div>
            {docsFor(booking).map((d) => (
              <label key={d.key} style={s.check}>
                <input
                  type="checkbox"
                  checked={!!checked[`${booking._id}:${d.key}`]}
                  onChange={() => tick(booking, d.key)}
                />
                <span>{d.label}</span>
              </label>
            ))}
            <div style={s.fuelBlock}>
              <div style={s.fuelLabel}>Fuel going out</div>
              <div style={s.fuelRow}>
                {Array.from({ length: FUEL_STEPS + 1 }, (_, i) => i).map((i) => (
                  <button
                    key={i}
                    type="button"
                    style={s.fuelChip(fuel[booking._id] === i)}
                    onClick={() => setFuel((prev) => ({ ...prev, [booking._id]: i }))}
                  >
                    {fuelLabel(i)}
                  </button>
                ))}
              </div>
            </div>
            <ConditionPhotos
              id={`cond-${booking._id}`}
              label="Condition going out"
              photos={photos[booking._id] || []}
              onChange={(next) => setPhotos((prev) => ({ ...prev, [booking._id]: next }))}
              isDark={isDark}
              disabled={busy}
            />
            <input
              style={s.noteInput}
              type="text"
              placeholder="Anything already marked or scratched (optional)"
              value={notes[booking._id] || ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [booking._id]: e.target.value }))}
            />
            {remaining > 0 ? (
              <div style={s.balanceDue}>
                <div><strong>{peso(remaining)}</strong> still to collect before the keys go over.</div>
                <button style={s.link} disabled={busy} onClick={() => collectBalance(booking, remaining)}>
                  Record {peso(remaining)} received
                </button>
              </div>
            ) : (
              <div style={s.balance}>Paid in full. Nothing to collect.</div>
            )}
          </div>
        </div>

        <div style={s.actions}>
          <button
            style={s.primary(readyToRelease(booking) && !busy)}
            disabled={!readyToRelease(booking) || busy}
            onClick={() => handOver(booking)}
          >
            {busy ? 'Working…' : 'Hand over the keys'}
          </button>
          {/* A no-show can only be recorded within a day of the pickup
              time, so offering it here would only produce a refusal. */}
          {late && !stale && (
            <button style={s.ghost} disabled={busy} onClick={() => markNoShow(booking)}>
              They never came
            </button>
          )}
          {!readyToRelease(booking) && (
            <span style={s.hint}>
              {remaining > 0
                ? `Take the ${peso(remaining)} and record it, then tick each document you have seen.`
                : fuel[booking._id] === undefined
                  ? 'Read the fuel gauge before the vehicle leaves — the return is measured against it.'
                  : 'Tick each document once you have seen it.'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout activePage="Pickup Desk">
      <h1 style={s.title}>Pickup Desk</h1>
      <p style={s.subtitle}>
        Today&apos;s handovers. Check what they brought against what we hold, take any balance,
        then release the vehicle.
      </p>

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : (
        <>
          <div style={s.sectionTitle}>Ready to collect</div>
          {awaiting.length === 0 ? (
            <div style={s.empty}>
              Nobody is due at the counter right now.
              {laterToday.length > 0 ? ' The next one is below.' : ''}
            </div>
          ) : (
            awaiting.map((b) => <Card key={b._id} booking={b} late={hoursFromNow(b.startDate) < 0} />)
          )}

          {laterToday.length > 0 && (
            <>
              <div style={s.sectionTitle}>Later today</div>
              {laterToday.map((b) => <Card key={b._id} booking={b} late={false} />)}
            </>
          )}

          {overlooked.length > 0 && (
            <>
              <div style={s.sectionTitle}>Not recorded</div>
              <p style={s.sectionNote}>
                The pickup window has passed on these and no handover was written down. Check the documents
                the same way, then record it — it will be stamped with today&apos;s date and time, since
                that is when it was recorded rather than when it happened.
              </p>
              {overlooked.map((b) => <Card key={b._id} booking={b} late stale />)}
            </>
          )}

          {handedOverToday.length > 0 && (
            <>
              <div style={s.sectionTitle}>Handed over today</div>
              {handedOverToday.map((b) => (
                <div key={b._id} style={s.doneRow}>
                  <span>
                    {b.user?.name || 'Client'} — {b.car?.brand} {b.car?.model}
                  </span>
                  <span style={s.doneWhen}>
                    {formatMoment(b.collectedAt, true, { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default PickupDesk;
