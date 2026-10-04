import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { WEEKDAYS, outcomeTooEarly, isAppointmentOpen } from '../../utils/appointments';
import api from '../../api';

const WHEN = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' };
const TIME = { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' };

// Who is bringing a vehicle in, and when you are open to receive them.
//
// Both on one page because they are the same job seen from two sides: the
// hours decide what can be booked, and the list is what was. Splitting them
// would mean changing a setting on one screen to explain something on
// another.
const Appointments = () => {
  usePageTitle('Appointments');
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();
  const [rows, setRows] = useState([]);
  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');

  const load = () => Promise.all([
    api.get('/appointments/all'),
    api.get('/settings'),
  ]).then(([a, s]) => {
    setRows(a.data);
    setHours({ ...s.data.appointments });
  }).catch(() => toast.error('Could not load appointments.'))
    .finally(() => setLoading(false));

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveHours = async () => {
    setSaving(true);
    try {
      const res = await api.put('/settings', { appointments: hours });
      setHours({ ...res.data.appointments });
      toast.success('Saved. New bookings follow the new hours.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  // Somebody phoning to say they cannot make it, recorded by whoever took
  // the call. The slot goes back on offer.
  const callOff = async (row) => {
    const ok = await confirm(
      'Cancel this appointment? The slot goes back on offer and they can book another.',
      { confirmLabel: 'Cancel it', cancelLabel: 'Leave it' },
    );
    if (!ok) return;
    try {
      await api.delete(`/appointments/${row._id}`);
      toast.success('Cancelled. That time is free again.');
      load();
      refetchPendingCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel that.');
    }
  };

  // Confirming the time, and nothing else. Whether the vehicle is taken on
  // is a separate decision, made later with the vehicle in the car park.
  const accept = async (row) => {
    try {
      await api.put(`/appointments/${row._id}/accept`);
      toast.success('Confirmed. The owner has been told to come.');
      load();
      refetchPendingCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not accept that.');
    }
  };

  const close = async (row, outcome) => {
    if (outcome === 'rejected' && !note.trim()) {
      toast.error('Please say why, so they know what to fix.');
      return;
    }
    try {
      await api.put(`/appointments/${row._id}/outcome`, { outcome, note });
      setNoteFor(null);
      setNote('');
      toast.success('Recorded. The owner has been told.');
      load();
      // The sidebar counts open appointments, and this one just closed.
      refetchPendingCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record that.');
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    title: { fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
    card: {
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '12px', padding: '18px', marginBottom: '18px',
    },
    h2: { fontSize: '14px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: '0 0 2px' },
    sub: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 14px', lineHeight: 1.5 },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: isDark ? '#e4e6eb' : '#374151' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '14px' },
    input: {
      width: '100%', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    dayRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' },
    day: (on) => ({
      padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
      border: `1px solid ${on ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: on ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : 'transparent',
      color: on ? goldInk(isDark) : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    save: {
      padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: saving ? 'default' : 'pointer',
      background: gold, color: ON_GOLD, fontSize: '13px', fontWeight: '700', opacity: saving ? 0.6 : 1,
    },
    row: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap',
      padding: '14px 0', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    when: { fontSize: '13.5px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    who: { fontSize: '12.5px', color: isDark ? '#b0b3b8' : '#4b5563', marginTop: '3px' },
    meta: { fontSize: '11.5px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '3px' },
    actions: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' },
    btn: (tone) => ({
      fontSize: '12px', fontWeight: '700', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
      border: `1px solid ${tone === 'pass' ? '#16a34a' : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: tone === 'pass' ? '#16a34a' : 'transparent',
      color: tone === 'pass' ? '#fff' : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    tag: (status) => {
      const map = {
        completed: ['#16a34a', '#dcfce7', '#15803d'],
        rejected: ['#dc2626', '#fee2e2', '#991b1b'],
        missed: ['#9ca3af', '#f3f4f6', '#6b7280'],
        cancelled: ['#9ca3af', '#f3f4f6', '#6b7280'],
      }[status] || ['#2563eb', '#dbeafe', '#1e40af'];
      return {
        fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px',
        background: isDark ? `${map[0]}22` : map[1], color: isDark ? map[0] : map[2],
      };
    },
    noteBox: { display: 'flex', gap: '6px', marginTop: '8px', width: '100%' },
    empty: { padding: '28px', textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '13.5px' },
  };

  if (loading || !hours) {
    return <AdminLayout activePage="Appointments"><Skeleton height="420px" radius="12px" isDark={isDark} /></AdminLayout>;
  }

  const upcoming = rows.filter((r) => isAppointmentOpen(r.status));
  const past = rows.filter((r) => !isAppointmentOpen(r.status)).reverse();

  // What a closed one is called in words, rather than the word the database
  // happens to store.
  const outcomeWord = {
    completed: 'listed', rejected: 'not approved', missed: 'no-show', cancelled: 'cancelled',
  };

  const toggleDay = (value) => setHours((h) => ({
    ...h,
    days: h.days.includes(value) ? h.days.filter((d) => d !== value) : [...h.days, value].sort(),
  }));

  const line = (row) => (
    <div key={row._id} style={s.row}>
      <div style={{ minWidth: 0 }}>
        <div style={s.when}>
          {new Date(row.at).toLocaleDateString('en-US', WHEN)} · {new Date(row.at).toLocaleTimeString('en-US', TIME)}
        </div>
        <div style={s.who}>
          {row.owner?.name || 'Owner'} — {row.vehicle?.brand} {row.vehicle?.model}
          {row.vehicle?.year ? ` (${row.vehicle.year})` : ''}
        </div>
        <div style={s.meta}>
          {row.owner?.phone || 'no phone on file'}
          {row.vehicle?.note ? ` · ${row.vehicle.note}` : ''}
          {row.outcomeNote ? ` · ${row.outcomeNote}` : ''}
        </div>
      </div>
      {isAppointmentOpen(row.status) ? (
        <div style={s.actions}>
          {row.status === 'requested' ? (
            /* Only the time is being answered here. Nobody has seen the
               vehicle yet, so there is nothing to say about it. */
            <button type="button" style={s.btn('pass')} onClick={() => accept(row)}>Accept</button>
          ) : (
            <>
              {/* The vehicle decision, made with the vehicle in front of
                  you. Adding it IS approving it — there is no separate
                  approve button, because one existed and it could tell an
                  owner their listing was being set up when no listing
                  existed. Only the no-show waits for the slot to run out,
                  because ten minutes in they are late, not absent. */}
              <button
                type="button"
                style={s.btn('pass')}
                onClick={() => navigate(`/admin/add-car?appointment=${row._id}`)}
              >
                Add the vehicle
              </button>
              <button type="button" style={s.btn()} onClick={() => { setNoteFor(row._id); setNote(''); }}>Not approved</button>
              {!outcomeTooEarly(row.at, 'missed', hours.slotMinutes) && (
                <button type="button" style={s.btn()} onClick={() => close(row, 'missed')}>No-show</button>
              )}
            </>
          )}
          <button type="button" style={s.btn()} onClick={() => callOff(row)}>Cancel it</button>
        </div>
      ) : (
        <span style={s.tag(row.status)}>{outcomeWord[row.status] || row.status}</span>
      )}
      {noteFor === row._id && (
        <div style={s.noteBox}>
          <input
            style={s.input}
            autoFocus
            placeholder="Why — the owner sees this"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" style={s.btn()} onClick={() => close(row, 'rejected')}>Save</button>
          <button type="button" style={s.btn()} onClick={() => setNoteFor(null)}>Cancel</button>
        </div>
      )}
    </div>
  );

  return (
    <AdminLayout activePage="Appointments">
      <h1 style={s.title}>Appointments</h1>
      <p style={s.subtitle}>Vehicle owners bringing a car in to be checked, and when you are open to see them.</p>

      <div style={s.card}>
        <h2 style={s.h2}>Coming up</h2>
        <p style={s.sub}>
          Accept the time first, so they know to come. Once the vehicle is here, Add the vehicle opens the
          form with the checklist and the OR/CR expiry on it — saving it there is what approves the vehicle.
        </p>
        {upcoming.length === 0 ? <p style={s.empty}>Nobody booked in.</p> : upcoming.map(line)}
      </div>

      <div style={s.card}>
        <h2 style={s.h2}>When you are open</h2>
        <p style={s.sub}>One vehicle per slot. Changing these affects times not yet booked; anything already booked stands.</p>

        <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <input type="checkbox" checked={hours.enabled} onChange={(e) => setHours({ ...hours, enabled: e.target.checked })} />
          <span>Take appointments. Off means the booking page asks them to call instead.</span>
        </label>

        <span style={s.label}>Days</span>
        <div style={s.dayRow}>
          {WEEKDAYS.map((d) => (
            <button type="button" key={d.value} style={s.day(hours.days.includes(d.value))} onClick={() => toggleDay(d.value)}>
              {d.short}
            </button>
          ))}
        </div>

        <div style={s.grid}>
          <div>
            <label style={s.label} htmlFor="ap-start">Opens at</label>
            <input id="ap-start" style={s.input} type="number" min="0" max="23"
              value={hours.startHour} onChange={(e) => setHours({ ...hours, startHour: Number(e.target.value) })} />
          </div>
          <div>
            <label style={s.label} htmlFor="ap-end">Closes at</label>
            <input id="ap-end" style={s.input} type="number" min="1" max="24"
              value={hours.endHour} onChange={(e) => setHours({ ...hours, endHour: Number(e.target.value) })} />
          </div>
          <div>
            <label style={s.label} htmlFor="ap-slot">Minutes each</label>
            <input id="ap-slot" style={s.input} type="number" min="15" max="240" step="15"
              value={hours.slotMinutes} onChange={(e) => setHours({ ...hours, slotMinutes: Number(e.target.value) })} />
          </div>
          <div>
            <label style={s.label} htmlFor="ap-lead">Notice needed (hours)</label>
            <input id="ap-lead" style={s.input} type="number" min="0"
              value={hours.leadHours} onChange={(e) => setHours({ ...hours, leadHours: Number(e.target.value) })} />
          </div>
          <div>
            <label style={s.label} htmlFor="ap-horizon">Book up to (days)</label>
            <input id="ap-horizon" style={s.input} type="number" min="1" max="180"
              value={hours.horizonDays} onChange={(e) => setHours({ ...hours, horizonDays: Number(e.target.value) })} />
          </div>
        </div>

        <button type="button" style={s.save} onClick={saveHours} disabled={saving}>
          {saving ? 'Saving…' : 'Save hours'}
        </button>
      </div>

      <div style={s.card}>
        <h2 style={s.h2}>Already dealt with</h2>
        <p style={s.sub}>Kept rather than cleared — a missed visit and a vehicle turned away are both worth being able to look back at.</p>
        {past.length === 0 ? <p style={s.empty}>Nothing yet.</p> : past.map(line)}
      </div>
    </AdminLayout>
  );
};

export default Appointments;
