import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import Skeleton from '../../components/Skeleton';
import usePageTitle from '../../hooks/usePageTitle';
import { VEHICLE_DATA, CAR_BRAND_ORDER, MOTO_BRAND_ORDER } from '../../data/vehicleBrands';
import { vehicleNoteProblem, OLDEST_VEHICLE_YEAR } from '../../utils/appointments';
import Autocomplete from '../../components/Autocomplete';
import api from '../../api';

const DAY_LABEL = { weekday: 'short', month: 'short', day: 'numeric' };

// Stage one of becoming a consignor: book a time to bring the vehicle in.
//
// Nothing about the vehicle is entered here beyond what it is. The details,
// the price, the photographs — all of that is typed at the office with the
// vehicle in front of whoever is typing, because that is the only way the
// plate on the papers can be checked against the plate on the car.
//
// This page is the whole of the consignor side until a vehicle passes. There
// is no dashboard to show: no vehicles, no bookings, no earnings. Showing
// the real dashboard empty would be showing somebody a room full of things
// that are not theirs yet.
const BookInspection = ({ stage, onBooked }) => {
  usePageTitle('Book an inspection');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const [days, setDays] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState(null);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [pickedDay, setPickedDay] = useState('');
  const [pickedTime, setPickedTime] = useState('');
  const [form, setForm] = useState({ brand: '', model: '', year: '', note: '' });
  // The brand and model boxes suggest as they are typed. Two people typing
  // "Toyota" and "toyota" is two brands in the data, and this is the first
  // place a vehicle is ever named — a suggestion somebody picks is spelled
  // the way the rest of the system spells it.
  const [vehicleType, setVehicleType] = useState('car');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const booked = stage?.booked;
  const last = stage?.last;

  // An appointment already booked needs no slot list, so nothing is
  // fetched and nothing is waited for — which is why "loading" is derived
  // below rather than set here.
  useEffect(() => {
    if (booked) return undefined;
    let live = true;
    api.get('/appointments/slots')
      .then((res) => { if (live) { setDays(res.data.days); setSettings(res.data.settings); } })
      .catch(() => { if (live) setError('Could not load the available times. Please try again.'); })
      .finally(() => { if (live) setSlotsLoaded(true); });
    return () => { live = false; };
  }, [booked]);

  // Every visit they have ever booked, whatever became of it. Somebody who
  // has forgotten when they are due needs to be able to look it up, and
  // somebody turned away needs to see what was said — neither of those is
  // served by a page that only knows about the appointment still open.
  useEffect(() => {
    let live = true;
    api.get('/appointments/mine')
      .then((res) => { if (live) setHistory(res.data); })
      .catch(() => { if (live) setHistory([]); });
    return () => { live = false; };
  }, [stage]);

  const loading = !booked && !slotsLoaded;

  const brandOptions = vehicleType === 'motorcycle' ? MOTO_BRAND_ORDER : CAR_BRAND_ORDER;

  // Models are offered only once the brand is one we recognise. Matched
  // case-insensitively, so somebody typing "toyota" still gets Toyota's
  // models rather than an empty list.
  const knownBrand = brandOptions.find((b) => b.toLowerCase() === String(form.brand || '').trim().toLowerCase());
  const modelOptions = knownBrand
    ? (VEHICLE_DATA[knownBrand] || [])
      .filter((m) => (vehicleType === 'motorcycle' ? m.category === 'Motorcycle' : m.category !== 'Motorcycle'))
      .map((m) => m.model)
    : [];

  const changeVehicleType = (value) => {
    setVehicleType(value);
    setForm({ ...form, brand: '', model: '' });
  };

  // Changing the brand drops the model: a Vios under Honda is somebody
  // halfway through changing their mind.
  const changeBrand = (value) => setForm({ ...form, brand: value, model: '' });

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb' },
    wrap: { maxWidth: '860px', margin: '0 auto', padding: '32px 16px 56px' },
    title: { fontSize: '24px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: '0 0 6px' },
    sub: { fontSize: '14px', color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 24px', lineHeight: 1.6 },
    card: {
      background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
      borderRadius: '14px', padding: '22px', marginBottom: '18px',
    },
    h2: { fontSize: '15px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', margin: '0 0 10px' },
    steps: { margin: 0, paddingLeft: '20px', fontSize: '13.5px', lineHeight: 1.9, color: isDark ? '#b0b3b8' : '#4b5563' },
    bring: {
      margin: '0', padding: '14px 16px', borderRadius: '10px', fontSize: '13.5px', lineHeight: 1.9,
      background: isDark ? 'rgba(232,161,0,0.10)' : 'rgba(184,121,10,0.07)',
      border: `1px solid ${isDark ? '#5a4a1a' : '#f3d98b'}`, color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    label: { display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '5px', color: isDark ? '#e4e6eb' : '#374151' },
    input: {
      width: '100%', padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', outline: 'none',
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' },
    chips: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
    typeRow: { display: 'flex', gap: '8px', marginBottom: '14px' },
    typeBtn: (on) => ({
      flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
      border: `1px solid ${on ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: on ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : (isDark ? '#18191a' : '#fff'),
      color: on ? goldInk(isDark) : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    chip: (active) => ({
      padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: '600',
      border: `1px solid ${active ? gold : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : (isDark ? '#18191a' : '#fff'),
      color: active ? goldInk(isDark) : (isDark ? '#e4e6eb' : '#1a1a1a'),
    }),
    hint: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af', margin: '0 0 12px', lineHeight: 1.6 },
    book: {
      padding: '11px 22px', borderRadius: '10px', border: 'none', cursor: saving ? 'default' : 'pointer',
      background: gold, color: ON_GOLD, fontSize: '14px', fontWeight: '700', opacity: saving ? 0.6 : 1,
    },
    cancel: {
      padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
      border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, background: 'transparent',
      color: isDark ? '#b0b3b8' : '#6b7280',
    },
    error: { fontSize: '13px', color: isDark ? '#f87171' : '#dc2626', marginBottom: '12px' },
    when: { fontSize: '19px', fontWeight: '700', color: goldInk(isDark), margin: '0 0 4px' },
    outcome: {
      margin: '0 0 18px', padding: '14px 16px', borderRadius: '10px', fontSize: '13.5px', lineHeight: 1.7,
      background: isDark ? '#3a2f10' : '#fff7e6', border: `1px solid ${isDark ? '#5a4a1a' : '#f3d98b'}`,
      color: isDark ? '#e8c463' : '#8a6d1a',
    },
    approved: {
      margin: '0 0 18px', padding: '14px 16px', borderRadius: '10px', fontSize: '13.5px', lineHeight: 1.7,
      background: isDark ? 'rgba(22,163,74,0.14)' : '#dcfce7',
      border: `1px solid ${isDark ? 'rgba(22,163,74,0.4)' : '#86efac'}`,
      color: isDark ? '#86efac' : '#14532d',
    },
    empty: { padding: '20px', textAlign: 'center', color: isDark ? '#b0b3b8' : '#6b7280', fontSize: '13.5px' },
    visit: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap',
      padding: '11px 0', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`,
    },
    visitWhen: { fontSize: '13px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    visitWhat: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
    visitTag: (status) => {
      const map = {
        passed: ['#16a34a', '#dcfce7', '#15803d'],
        failed: ['#dc2626', '#fee2e2', '#991b1b'],
        booked: ['#2563eb', '#dbeafe', '#1e40af'],
      }[status] || ['#9ca3af', '#f3f4f6', '#6b7280'];
      return {
        fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
        background: isDark ? `${map[0]}22` : map[1], color: isDark ? map[0] : map[2],
      };
    },
  };

  const times = days.find((d) => d.day === pickedDay)?.times || [];

  const submit = async () => {
    const noteProblem = vehicleNoteProblem(form);
    if (noteProblem) { setError(noteProblem); return; }
    if (!pickedTime) { setError('Please choose a day and time.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/appointments', { at: pickedTime, ...form, year: form.year || undefined });
      toast.success('Booked. We will see you then.');
      onBooked();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not book that time.');
      setSaving(false);
    }
  };

  const cancelBooking = async () => {
    const ok = await confirm(
      'Cancel this appointment? You can book another time whenever you are ready.',
      { confirmLabel: 'Cancel it', cancelLabel: 'Keep it' },
    );
    if (!ok) return;
    try {
      await api.delete(`/appointments/${booked._id}`);
      toast.success('Appointment cancelled.');
      onBooked();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel that.');
    }
  };

  const STATUS_WORD = {
    booked: 'Booked',
    passed: 'Approved',
    failed: 'Not approved',
    missed: 'Missed',
    cancelled: 'Cancelled',
  };

  const pastVisits = (
    history.length > 1 || (history.length === 1 && history[0].status !== 'booked')
  ) ? (
    <div style={s.card}>
      <h2 style={s.h2}>Your visits</h2>
      <p style={s.hint}>Everything you have booked with us, and how each one went.</p>
      {history.map((h) => (
        <div key={h._id} style={s.visit}>
          <div>
            <div style={s.visitWhen}>
              {new Date(h.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {new Date(h.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}
            </div>
            <div style={s.visitWhat}>
              {h.vehicle?.brand} {h.vehicle?.model}
              {h.vehicle?.year ? ` · ${h.vehicle.year}` : ''}
              {h.outcomeNote ? ` — ${h.outcomeNote}` : ''}
            </div>
          </div>
          <span style={s.visitTag(h.status)}>{STATUS_WORD[h.status] || h.status}</span>
        </div>
      ))}
    </div>
  ) : null;

  const whatToBring = (
    <div style={s.card}>
      <h2 style={s.h2}>What to bring</h2>
      <p style={s.bring}>
        <strong>The vehicle itself</strong> — we check it over and photograph it for the listing.<br />
        <strong>The OR and CR</strong> — the originals, not copies. We check the plate and chassis number against
        the vehicle and hand them straight back.<br />
        <strong>One valid ID</strong> — so we know the papers and the person match. We keep no copy of it.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div style={s.page}><div style={s.wrap}><Skeleton height="420px" radius="14px" isDark={isDark} /></div></div>
    );
  }

  // Already booked: the page becomes the reminder rather than the form.
  if (booked) {
    const at = new Date(booked.at);
    return (
      <div style={s.page}>
        <div style={s.wrap}>
          <h1 style={s.title}>Your appointment</h1>
          <p style={s.sub}>Bring the vehicle and its papers, and we will do the rest here.</p>
          <div style={s.card}>
            <p style={s.when}>
              {at.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' at '}
              {at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}
            </p>
            <p style={s.hint}>
              {booked.vehicle?.brand} {booked.vehicle?.model}
              {booked.vehicle?.year ? ` · ${booked.vehicle.year}` : ''}
            </p>
            <button type="button" style={s.cancel} onClick={cancelBooking}>Cancel this appointment</button>
          </div>
          {whatToBring}
          {pastVisits}
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <h1 style={s.title}>List your vehicle</h1>
        <p style={s.sub}>
          We look at every vehicle in person before it goes on the site. Book a time, bring it over with its
          papers, and if all is well we will have it listed the same day.
        </p>

        {/* Said before anything else, because somebody whose vehicle was
            turned away needs to know they can simply come back. */}
        {last && last.status === 'failed' && (
          <p style={s.outcome}>
            Your last visit didn&apos;t go through
            {last.outcomeNote ? `: ${last.outcomeNote}` : '.'} Book again once it is sorted.
          </p>
        )}
        {last && last.status === 'missed' && (
          <p style={s.outcome}>You missed your last appointment. Book another whenever you are ready.</p>
        )}
        {/* The gap this fills: a vehicle that passed its check leaves no
            booked appointment behind, so this page fell straight back to
            the booking form and said nothing. Somebody who had just been
            approved was shown no sign of it. */}
        {last && last.status === 'passed' && (
          <p style={s.approved}>
            <strong>
              Your {last.vehicle?.brand} {last.vehicle?.model} passed its check.
            </strong>
            <br />
            We&apos;re setting its listing up now — it will appear here as soon as it is live. Nothing more
            for you to do. Bringing another vehicle? Book a time for it below.
          </p>
        )}

        <div style={s.card}>
          <h2 style={s.h2}>How it works</h2>
          <ol style={s.steps}>
            <li>Book a time below and tell us roughly what you are bringing.</li>
            <li>Come to our place in Salugan, Camalig with the vehicle and its papers.</li>
            <li>We check it over, agree a daily rate with you, and photograph it.</li>
            <li>If all is well we create the listing and your dashboard opens up.</li>
          </ol>
        </div>

        {whatToBring}
        {pastVisits}

        <div style={s.card}>
          <h2 style={s.h2}>What are you bringing?</h2>
          <div style={s.typeRow} role="group" aria-label="Vehicle type">
            <button type="button" style={s.typeBtn(vehicleType === 'car')} aria-pressed={vehicleType === 'car'}
              onClick={() => changeVehicleType('car')}>
              🚗 Car
            </button>
            <button type="button" style={s.typeBtn(vehicleType === 'motorcycle')} aria-pressed={vehicleType === 'motorcycle'}
              onClick={() => changeVehicleType('motorcycle')}>
              🏍️ Motorcycle
            </button>
          </div>

          <div style={s.row}>
            {/* One box each, suggesting as it is typed. Neither refuses a
                value: the lists cover what is on the road here, not
                everything ever built. See components/Autocomplete.jsx. */}
            <div>
              <label style={s.label} htmlFor="ap-brand">Brand</label>
              <Autocomplete
                id="ap-brand"
                isDark={isDark}
                value={form.brand}
                onChange={changeBrand}
                options={brandOptions}
                placeholder="Start typing — e.g. Toyota"
              />
            </div>
            <div>
              <label style={s.label} htmlFor="ap-model">Model</label>
              <Autocomplete
                id="ap-model"
                isDark={isDark}
                value={form.model}
                onChange={(v) => setForm({ ...form, model: v })}
                options={modelOptions}
                placeholder={form.brand ? 'Start typing — e.g. Vios' : 'Brand first'}
                disabled={!String(form.brand || '').trim()}
                emptyHint={knownBrand
                  ? "Not on our list for that brand — that's fine, we'll check it when you come in."
                  : "We don't know that brand, so we can't suggest models. Type it and we'll check it when you come in."}
              />
            </div>
            <div>
              <label style={s.label} htmlFor="ap-year">Year</label>
              <input id="ap-year" style={s.input} type="number" placeholder="2019"
                min={OLDEST_VEHICLE_YEAR} max={new Date().getFullYear() + 1} value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
          </div>
          <label style={s.label} htmlFor="ap-note">Anything we should know (optional)</label>
          <input id="ap-note" style={s.input} maxLength={300} value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>

        <div style={s.card}>
          <h2 style={s.h2}>Pick a time</h2>
          {!settings?.enabled || days.length === 0 ? (
            <p style={s.empty}>
              We aren&apos;t taking appointments at the moment. Please call us on 0950-651-0479 to arrange a visit.
            </p>
          ) : (
            <>
              <p style={s.hint}>
                One vehicle per slot, so each booking has our full attention.
                {settings.leadHours >= 24 && ' The earliest is tomorrow.'}
              </p>
              <div style={s.chips} role="group" aria-label="Choose a day">
                {days.slice(0, 14).map((d) => (
                  <button
                    type="button"
                    key={d.day}
                    style={s.chip(pickedDay === d.day)}
                    aria-pressed={pickedDay === d.day}
                    onClick={() => { setPickedDay(d.day); setPickedTime(''); }}
                  >
                    {new Date(`${d.day}T12:00:00+08:00`).toLocaleDateString('en-US', DAY_LABEL)}
                  </button>
                ))}
              </div>
              {pickedDay && (
                <div style={s.chips} role="group" aria-label="Choose a time">
                  {times.map((t) => (
                    <button
                      type="button"
                      key={t.at}
                      style={s.chip(pickedTime === t.at)}
                      aria-pressed={pickedTime === t.at}
                      onClick={() => setPickedTime(t.at)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {error && <p style={s.error}>{error}</p>}
              <button type="button" style={s.book} onClick={submit} disabled={saving}>
                {saving ? 'Booking…' : 'Book this time'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookInspection;
