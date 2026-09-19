import { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import AvailabilityCalendar from './AvailabilityCalendar';
import { hasPromo, isPromoVisible, promoOffer, promoDateRange } from '../utils/promo';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

// The "Date Promos" tab of the Discounts panel: every running or upcoming
// promo in one list, and one form that can put the same promo on several
// vehicles at once. It replaced a per-row Set Promo button, which could only
// ever handle one car and left no single place to see what's on promo.
//
// Underneath nothing changed: a promo is still stored per car (Car.promo),
// one per car, via PUT /cars/:id/promo. Applying to three cars is three of
// those calls, so every per-car rule still holds — the existing-bookings
// warning, a peso amount staying under that car's daily rate, and the
// notification to people who favourited that car.

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day in timezones ahead of UTC, like PH).
const toDateValue = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const EMPTY_FORM = { label: '', type: 'percent', value: '', startDate: '', endDate: '', carIds: [] };

const PromoTab = ({ cars, isDark, onCarUpdated }) => {
  const { toast, confirm } = useUIFeedback();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingCarId, setEditingCarId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bookedRanges, setBookedRanges] = useState([]);
  // Booked dates per car, kept so ticking a car back on doesn't refetch.
  const rangeCache = useRef({});

  const byId = (id) => cars.find((c) => String(c._id) === String(id));
  const onPromo = cars.filter((c) => isPromoVisible(c.promo));
  const ticked = form.carIds.map(byId).filter(Boolean);

  // With several cars ticked, the calendar shows every date booked on ANY of
  // them — those are the dates the overlap warning will ask about.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const lists = await Promise.all(form.carIds.map(async (id) => {
        if (!rangeCache.current[id]) {
          try {
            const res = await api.get(`/cars/${id}/booked-dates`, { params: { includePending: true } });
            rangeCache.current[id] = res.data;
          } catch {
            rangeCache.current[id] = [];
          }
        }
        return rangeCache.current[id];
      }));
      if (alive) setBookedRanges(lists.flat());
    };
    load();
    return () => { alive = false; };
  }, [form.carIds.join(',')]);

  const toggleCar = (id) => setForm((f) => ({
    ...f,
    carIds: f.carIds.includes(id) ? f.carIds.filter((c) => c !== id) : [...f.carIds, id],
  }));

  const handleSelectDay = (date) => {
    const clicked = toDateValue(date);
    if (!form.startDate || (form.startDate && form.endDate)) {
      setForm({ ...form, startDate: clicked, endDate: '' });
      return;
    }
    if (clicked === form.startDate) {
      setForm({ ...form, startDate: '', endDate: '' });
      return;
    }
    if (new Date(clicked) < new Date(form.startDate)) {
      setForm({ ...form, startDate: clicked });
      return;
    }
    setForm({ ...form, endDate: clicked });
  };

  const startEdit = (car) => {
    setEditingCarId(String(car._id));
    setForm({
      label: car.promo.label,
      type: car.promo.type,
      value: String(car.promo.value),
      startDate: car.promo.startDate.slice(0, 10),
      endDate: car.promo.endDate.slice(0, 10),
      carIds: [String(car._id)],
    });
  };
  const resetForm = () => { setEditingCarId(null); setForm(EMPTY_FORM); };

  const remove = async (car) => {
    const ok = await confirm(
      `Remove the promo on the ${car.brand} ${car.model}? Bookings already made with it keep their price.`,
      { confirmLabel: 'Remove promo', danger: true }
    );
    if (!ok) return;
    try {
      const res = await api.delete(`/cars/${car._id}/promo`);
      onCarUpdated(res.data);
      if (editingCarId === String(car._id)) resetForm();
      toast.success('Promo removed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove this promo.');
    }
  };

  // Cheapest ticked car decides the ceiling for a peso discount, since the
  // server refuses any car where the amount reaches its daily rate.
  const cheapest = ticked.reduce((m, c) => (m === null || c.pricePerDay < m ? c.pricePerDay : m), null);

  const save = async () => {
    const amount = Number(form.value);
    if (!form.label.trim()) { toast.error('Give the promo a name customers will see.'); return; }
    if (!form.carIds.length) { toast.error('Tick at least one vehicle.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a discount greater than zero.'); return; }
    if (!form.startDate || !form.endDate) { toast.error('Pick the promo dates on the calendar.'); return; }

    // Each car holds one promo, so saving onto a car that already has a
    // different one replaces it. Say so before it happens.
    const replacing = ticked.filter((c) => String(c._id) !== editingCarId && isPromoVisible(c.promo));
    if (replacing.length) {
      const ok = await confirm(
        `${replacing.map((c) => `${c.brand} ${c.model} ("${c.promo.label}")`).join(', ')} already `
        + `${replacing.length === 1 ? 'has a promo' : 'have promos'}. Each vehicle can only run one, `
        + 'so this will replace it. Continue?',
        { confirmLabel: 'Replace' }
      );
      if (!ok) return;
    }

    setSaving(true);
    const body = { label: form.label, type: form.type, value: form.value, startDate: form.startDate, endDate: form.endDate };
    const saved = [];
    const failed = [];
    let needsOk = [];

    const attempt = async (car, confirmOverlap) => {
      try {
        const res = await api.put(`/cars/${car._id}/promo`, { ...body, confirmOverlap });
        onCarUpdated(res.data);
        saved.push(car);
      } catch (err) {
        const data = err.response?.data;
        if (data?.needsConfirmation && !confirmOverlap) needsOk.push({ car, clashes: data.clashes });
        else failed.push({ car, message: data?.message || 'Could not save.' });
      }
    };

    try {
      for (const car of ticked) await attempt(car, false);

      // One question for all the cars with bookings in the window, rather
      // than a separate popup per car.
      if (needsOk.length) {
        const lines = needsOk.map(({ car, clashes }) => (
          `${car.brand} ${car.model}: ${clashes.map((c) => `${new Date(c.startDate).toLocaleDateString()} to ${new Date(c.endDate).toLocaleDateString()}`).join(', ')}`
        ));
        const ok = await confirm(
          `Some of these dates are already booked. Those bookings keep the price they were made at.\n\n${lines.join('\n')}\n\nSet the promo anyway?`,
          { confirmLabel: 'Set promo' }
        );
        const pending = needsOk;
        needsOk = [];
        if (ok) for (const { car } of pending) await attempt(car, true);
      }

      if (saved.length) {
        toast.success(
          `Promo saved on ${saved.length} vehicle${saved.length === 1 ? '' : 's'}. `
          + 'Anyone who favourited them has been notified.'
        );
      }
      failed.forEach(({ car, message }) => toast.error(`${car.brand} ${car.model}: ${message}`));
      if (saved.length && !failed.length) resetForm();
    } finally {
      setSaving(false);
    }
  };

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    sub: { fontSize: '12px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 18px' },
    label: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px',
    },
    list: { display: 'flex', flexDirection: 'column', gap: '8px' },
    item: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '11px 13px', borderRadius: '12px',
      background: isDark ? '#18191a' : '#f9fafb', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    itemMain: { fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    itemSub: { display: 'block', fontSize: '11px', marginTop: '2px', color: gold, fontWeight: '700' },
    btns: { display: 'flex', gap: '10px', flexShrink: 0 },
    linkBtn: (danger) => ({
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', fontWeight: '700',
      color: danger ? (isDark ? '#f87171' : '#dc2626') : gold,
    }),
    empty: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af' },
    divider: { height: '1px', background: isDark ? '#3a3b3c' : '#eef0f2', margin: '20px 0' },
    fieldLabel: { display: 'block', fontSize: '12px', fontWeight: '600', color: isDark ? '#b0b3b8' : '#374151', margin: '12px 0 5px' },
    input: {
      width: '100%', padding: '9px 11px', boxSizing: 'border-box', borderRadius: '8px', fontSize: '13px',
      fontFamily: 'inherit', outline: 'none', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    typeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
    typeBtn: (active) => ({
      padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
      border: active ? `2px solid ${gold}` : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#fff'),
      color: active ? gold : (isDark ? '#b0b3b8' : '#374151'),
    }),
    hint: { fontSize: '11px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '6px' },
    carList: {
      maxHeight: '180px', overflowY: 'auto', padding: '6px',
      borderRadius: '10px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    carOption: {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', borderRadius: '8px',
      fontSize: '13px', cursor: 'pointer', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    carMeta: { fontSize: '10px', fontWeight: '700', color: isDark ? '#8a8d91' : '#9ca3af', marginLeft: 'auto', whiteSpace: 'nowrap' },
    rangeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', margin: '12px 0 8px' },
    rangeValue: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    preview: {
      marginTop: '14px', padding: '11px 13px', borderRadius: '10px', fontSize: '12px',
      background: isDark ? '#18191a' : '#f9fafb', border: `1px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    actions: { display: 'flex', gap: '8px', marginTop: '18px' },
    primaryBtn: {
      flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      fontSize: '13px', fontWeight: '700', background: gold, color: ON_GOLD,
    },
    secondaryBtn: {
      padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151',
    },
  };

  const previewPromo = { ...form, value: Number(form.value) };

  return (
    <>
      <p style={s.sub}>
        A discount for specific dates, like &quot;10% off Sept 20–25&quot;. It applies when a customer&apos;s
        whole trip falls inside those dates. People who favourited a vehicle are notified when its
        promo starts.
      </p>

      <div style={s.label}>Running and upcoming</div>
      {onPromo.length === 0 ? (
        <p style={s.empty}>No vehicles are on promo.</p>
      ) : (
        <div style={s.list}>
          {onPromo.map((car) => (
            <div key={car._id} style={s.item}>
              <span>
                <span style={s.itemMain}>{car.brand} {car.model}</span>
                <span style={s.itemSub}>
                  {car.promo.label} · {promoOffer(car.promo)} · {promoDateRange(car.promo)}
                </span>
              </span>
              <span style={s.btns}>
                <button type="button" className="text-link-btn" style={s.linkBtn(false)} onClick={() => startEdit(car)}>Edit</button>
                <button type="button" className="text-link-btn" style={s.linkBtn(true)} onClick={() => remove(car)}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={s.divider} />

      <div style={s.label}>{editingCarId ? 'Edit promo' : 'Add a promo'}</div>

      <label style={{ ...s.fieldLabel, marginTop: 0 }} htmlFor="pt-label">Promo name</label>
      <input id="pt-label" style={s.input} type="text" placeholder="e.g. Holiday Promo" maxLength={40}
        value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
      <div style={s.hint}>Customers see this on the card and on their receipt.</div>

      <span style={s.fieldLabel}>Discount type</span>
      <div style={s.typeRow}>
        <button type="button" style={s.typeBtn(form.type === 'percent')}
          onClick={() => setForm({ ...form, type: 'percent', value: '' })}>Percentage</button>
        <button type="button" style={s.typeBtn(form.type === 'amount')}
          onClick={() => setForm({ ...form, type: 'amount', value: '' })}>Fixed amount</button>
      </div>

      <label style={s.fieldLabel} htmlFor="pt-value">{form.type === 'percent' ? 'Percentage off' : 'Pesos off'}</label>
      <input id="pt-value" style={s.input} type="text" inputMode="decimal"
        placeholder={form.type === 'percent' ? 'e.g. 10' : 'e.g. 500'}
        value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^0-9.]/g, '').slice(0, 6) })} />
      <div style={s.hint}>
        {form.type === 'percent'
          ? 'Up to 50%.'
          : cheapest !== null
            ? `Must be under ₱${cheapest.toLocaleString()}, the daily price of the cheapest ticked vehicle, so no booking can reach zero.`
            : 'Must be under each ticked vehicle\'s daily price, so no booking can reach zero.'}
      </div>

      <span style={s.fieldLabel}>Vehicles</span>
      <div style={s.carList}>
        {cars.map((car) => {
          const id = String(car._id);
          return (
            <label key={id} style={s.carOption}>
              <input type="checkbox" className="gold-check" checked={form.carIds.includes(id)} onChange={() => toggleCar(id)} />
              {car.brand} {car.model}
              <span style={s.carMeta}>
                {car.status === 'draft' ? 'DRAFT · ' : ''}
                {isPromoVisible(car.promo) && String(car._id) !== editingCarId ? 'ON PROMO · ' : ''}
                ₱{car.pricePerDay.toLocaleString()}/day
              </span>
            </label>
          );
        })}
      </div>

      <div style={s.rangeRow}>
        <span style={s.rangeValue}>
          {form.startDate && form.endDate
            ? promoDateRange({ ...form, value: 1 })
            : form.startDate
              ? 'Now pick the last day'
              : 'Pick the first day on the calendar'}
        </span>
        {form.startDate && (
          <button type="button" className="text-link-btn" style={s.linkBtn(false)}
            onClick={() => setForm({ ...form, startDate: '', endDate: '' })}>Clear</button>
        )}
      </div>
      <AvailabilityCalendar
        bookedRanges={bookedRanges}
        selectedStart={form.startDate}
        selectedEnd={form.endDate}
        onSelectDay={handleSelectDay}
        isDark={isDark}
        selectableWhenBooked
      />
      <div style={s.hint}>
        Red days are already booked on at least one ticked vehicle. You can still promo across
        them — those bookings keep the price they were made at.
      </div>

      {form.value && form.startDate && form.endDate && hasPromo(previewPromo) && (
        <div style={s.preview}>
          Customers will see <strong style={{ color: gold }}>
            {form.label || 'Promo'} · {promoOffer(previewPromo)} · {promoDateRange(previewPromo)}
          </strong>
          {ticked.length > 1 && ` on ${ticked.length} vehicles`}
        </div>
      )}

      <div style={s.actions}>
        <button type="button" style={s.primaryBtn} disabled={saving} onClick={save}>
          {saving ? 'Saving...' : editingCarId ? 'Update Promo' : 'Start Promo'}
        </button>
        {editingCarId && (
          <button type="button" style={s.secondaryBtn} disabled={saving} onClick={resetForm}>Cancel edit</button>
        )}
      </div>
    </>
  );
};

export default PromoTab;
