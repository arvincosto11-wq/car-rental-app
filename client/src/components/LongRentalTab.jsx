import { useEffect, useState } from 'react';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { invalidateLongRentalRules } from '../hooks/useLongRentalRules';
import { findInversions, validateLongRentalRule } from '../utils/longRental';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

// The "Long-Rental" tab of the Discounts panel: "book N days or more, get
// P% off" rules. One rule can cover every vehicle (including ones added
// later) or a ticked list. The panel itself (frame, tabs, close) lives in
// DiscountsPanel.jsx.

const EMPTY_FORM = { minDays: '', percent: '', appliesTo: 'all', cars: [] };
// Fixed example so the preview reads as money rather than a percentage.
const EXAMPLE_RATE = 1500;

const LongRentalTab = ({ cars, isDark, onRulesChanged }) => {
  const { toast, confirm } = useUIFeedback();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/long-rental-discounts/all');
      setRules(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the discounts.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // Anything that changes a rule must also drop the cached copy vehicle
  // pages use, or they'd keep showing the old offer until a full reload.
  const changed = async () => {
    invalidateLongRentalRules();
    await load();
    onRulesChanged?.();
  };

  const draft = { ...form, minDays: Number(form.minDays), percent: Number(form.percent), active: true };
  const formValid = !validateLongRentalRule(draft);
  // What the rule set would look like with this form saved, for the warning.
  const wouldBe = formValid
    ? [...rules.filter((r) => r._id !== editingId), draft]
    : rules;
  const inversions = findInversions(wouldBe);

  const startEdit = (rule) => {
    setEditingId(rule._id);
    setForm({
      minDays: String(rule.minDays),
      percent: String(rule.percent),
      appliesTo: rule.appliesTo,
      cars: (rule.cars || []).map(String),
    });
  };
  const resetForm = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const toggleCar = (id) => setForm((f) => ({
    ...f,
    cars: f.cars.includes(id) ? f.cars.filter((c) => c !== id) : [...f.cars, id],
  }));

  const save = async () => {
    const problem = validateLongRentalRule(draft);
    if (problem) { toast.error(problem); return; }
    // A warning, not a block: some businesses deliberately make the longer
    // trip cheaper ("rent 7, pay for 6"). Admin decides with the numbers
    // in front of them.
    if (inversions.length) {
      const ok = await confirm(
        'With this rule, a longer trip would cost less than a shorter one '
        + `(see the warning in the panel). Save it anyway?`,
        { confirmLabel: 'Save anyway' }
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const body = { minDays: draft.minDays, percent: draft.percent, appliesTo: form.appliesTo, cars: form.cars };
      if (editingId) {
        const existing = rules.find((r) => r._id === editingId);
        await api.put(`/long-rental-discounts/${editingId}`, { ...body, active: existing?.active !== false });
      } else {
        await api.post('/long-rental-discounts', body);
      }
      toast.success(editingId ? 'Discount updated.' : 'Discount added. Customers see it straight away.');
      resetForm();
      await changed();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this discount.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule) => {
    try {
      await api.put(`/long-rental-discounts/${rule._id}`, {
        minDays: rule.minDays, percent: rule.percent, appliesTo: rule.appliesTo,
        cars: rule.cars, active: rule.active === false,
      });
      await changed();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update this discount.');
    }
  };

  const remove = async (rule) => {
    const ok = await confirm(
      `Delete "${rule.minDays}+ days, ${rule.percent}% off"? Bookings already made with it keep their price.`,
      { confirmLabel: 'Delete', danger: true }
    );
    if (!ok) return;
    try {
      await api.delete(`/long-rental-discounts/${rule._id}`);
      if (editingId === rule._id) resetForm();
      await changed();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete this discount.');
    }
  };

  const carName = (id) => {
    const c = cars.find((x) => String(x._id) === String(id));
    return c ? `${c.brand} ${c.model}` : 'Removed vehicle';
  };
  const scopeText = (rule) => (rule.appliesTo === 'all'
    ? 'All vehicles'
    : `${rule.cars.length} vehicle${rule.cars.length === 1 ? '' : 's'}: ${rule.cars.slice(0, 3).map(carName).join(', ')}${rule.cars.length > 3 ? '…' : ''}`);

  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    // Top margin dropped from the old standalone panel's 6px: the tab strip
    // above already provides the spacing.
    sub: { fontSize: '12px', lineHeight: 1.55, color: isDark ? '#b0b3b8' : '#6b7280', margin: '0 0 18px' },
    label: {
      fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase',
      color: isDark ? '#8a8d91' : '#9ca3af', marginBottom: '8px',
    },
    list: { display: 'flex', flexDirection: 'column', gap: '8px' },
    rule: (active) => ({
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      padding: '11px 13px', borderRadius: '12px', opacity: active ? 1 : 0.55,
      background: isDark ? '#18191a' : '#f9fafb', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    }),
    ruleMain: { fontSize: '14px', fontWeight: '800', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    ruleOff: { color: gold },
    ruleScope: { display: 'block', fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    pausedTag: {
      fontSize: '10px', fontWeight: '700', padding: '1px 8px', borderRadius: '20px', marginLeft: '6px',
      background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)', color: isDark ? '#b0b3b8' : '#6b7280',
    },
    ruleBtns: { display: 'flex', gap: '10px', flexShrink: 0 },
    linkBtn: (danger) => ({
      background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '12px', fontWeight: '700',
      color: danger ? (isDark ? '#f87171' : '#dc2626') : gold,
    }),
    empty: { fontSize: '12px', color: isDark ? '#8a8d91' : '#9ca3af' },
    divider: { height: '1px', background: isDark ? '#3a3b3c' : '#eef0f2', margin: '20px 0' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    fieldLabel: { display: 'block', fontSize: '12px', fontWeight: '600', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '5px' },
    input: {
      width: '100%', padding: '9px 11px', boxSizing: 'border-box', borderRadius: '8px', fontSize: '13px',
      fontFamily: 'inherit', outline: 'none', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    scopeRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' },
    scopeBtn: (active) => ({
      padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
      border: active ? `2px solid ${gold}` : `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_TINT_DARK : GOLD_TINT) : (isDark ? '#18191a' : '#fff'),
      color: active ? gold : (isDark ? '#b0b3b8' : '#374151'),
    }),
    carList: {
      marginTop: '10px', maxHeight: '200px', overflowY: 'auto', padding: '6px',
      borderRadius: '10px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`,
    },
    carOption: {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', borderRadius: '8px',
      fontSize: '13px', cursor: 'pointer', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
    draftTag: { fontSize: '10px', fontWeight: '700', color: isDark ? '#8a8d91' : '#9ca3af', marginLeft: 'auto' },
    hint: { fontSize: '11px', lineHeight: 1.5, color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '6px' },
    preview: {
      marginTop: '14px', padding: '11px 13px', borderRadius: '10px', fontSize: '12px',
      background: isDark ? '#18191a' : '#f9fafb', border: `1px dashed ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      color: isDark ? '#b0b3b8' : '#4b5563',
    },
    warn: {
      marginTop: '12px', padding: '11px 13px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.5,
      background: isDark ? 'rgba(248,113,113,0.12)' : '#fef2f2',
      border: `1px solid ${isDark ? 'rgba(248,113,113,0.35)' : '#fecaca'}`, color: isDark ? '#fca5a5' : '#991b1b',
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

  const days = Number(form.minDays);
  const pct = Number(form.percent);
  const before = days * EXAMPLE_RATE;
  const after = before - Math.round(before * (pct / 100));

  return (
    <>
        <p style={s.sub}>
          Customers get these automatically once their trip is long enough — nothing to choose.
          If a trip also qualifies for a date promo, they get whichever takes more off; discounts
          never stack. Consignors are still paid the full price, and you cover the discount.
        </p>

        <div style={s.label}>Current discounts</div>
        {loading ? (
          <p style={s.empty}>Loading…</p>
        ) : rules.length === 0 ? (
          <p style={s.empty}>None yet. Add one below.</p>
        ) : (
          <div style={s.list}>
            {rules.map((rule) => (
              <div key={rule._id} style={s.rule(rule.active !== false)}>
                <span>
                  <span style={s.ruleMain}>
                    {rule.minDays}+ days · <span style={s.ruleOff}>{rule.percent}% off</span>
                  </span>
                  {rule.active === false && <span style={s.pausedTag}>Paused</span>}
                  <span style={s.ruleScope}>{scopeText(rule)}</span>
                </span>
                <span style={s.ruleBtns}>
                  <button type="button" className="text-link-btn" style={s.linkBtn(false)} onClick={() => toggleActive(rule)}>
                    {rule.active === false ? 'Resume' : 'Pause'}
                  </button>
                  <button type="button" className="text-link-btn" style={s.linkBtn(false)} onClick={() => startEdit(rule)}>Edit</button>
                  <button type="button" className="text-link-btn" style={s.linkBtn(true)} onClick={() => remove(rule)}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={s.divider} />

        <div style={s.label}>{editingId ? 'Edit discount' : 'Add a discount'}</div>
        <div style={s.row}>
          <div>
            <label style={s.fieldLabel} htmlFor="lr-days">Minimum days</label>
            <input id="lr-days" style={s.input} type="text" inputMode="numeric" placeholder="e.g. 7"
              value={form.minDays} onChange={(e) => setForm({ ...form, minDays: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} />
          </div>
          <div>
            <label style={s.fieldLabel} htmlFor="lr-pct">Discount (%)</label>
            <input id="lr-pct" style={s.input} type="text" inputMode="numeric" placeholder="e.g. 10"
              value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })} />
          </div>
        </div>
        <div style={s.hint}>From 2 to 365 days, and 1% to 50%.</div>

        <div style={s.scopeRow}>
          <button type="button" style={s.scopeBtn(form.appliesTo === 'all')}
            onClick={() => setForm({ ...form, appliesTo: 'all' })}>All vehicles</button>
          <button type="button" style={s.scopeBtn(form.appliesTo === 'selected')}
            onClick={() => setForm({ ...form, appliesTo: 'selected' })}>Selected vehicles</button>
        </div>
        <div style={s.hint}>
          {form.appliesTo === 'all'
            ? 'Includes vehicles you add later.'
            : 'Only the vehicles you tick — new vehicles aren\'t added automatically.'}
        </div>
        {form.appliesTo === 'selected' && (
          <div style={s.carList}>
            {cars.map((car) => {
              const id = String(car._id);
              return (
                <label key={id} style={s.carOption}>
                  <input type="checkbox" className="gold-check" checked={form.cars.includes(id)} onChange={() => toggleCar(id)} />
                  {car.brand} {car.model}
                  {car.status === 'draft' && <span style={s.draftTag}>DRAFT</span>}
                </label>
              );
            })}
          </div>
        )}

        {formValid && (
          <div style={s.preview}>
            Example on a ₱{EXAMPLE_RATE.toLocaleString()}/day vehicle: {days} days drops from
            ₱{before.toLocaleString()} to <strong style={{ color: gold }}>₱{after.toLocaleString()}</strong>.
          </div>
        )}

        {inversions.length > 0 && (
          <div style={s.warn}>
            <strong>A longer trip would cost less than a shorter one:</strong>
            {inversions.map((inv) => (
              <div key={inv.days}>
                {inv.days} days at {inv.percent}% off costs less than {inv.days - 1} days
                {inv.previousPercent ? ` at ${inv.previousPercent}% off` : ' at full price'}.
              </div>
            ))}
            <div style={{ marginTop: '6px' }}>Lower the percentage to avoid this, or save anyway if it&apos;s deliberate.</div>
          </div>
        )}

        <div style={s.actions}>
          <button type="button" style={s.primaryBtn} disabled={saving} onClick={save}>
            {saving ? 'Saving...' : editingId ? 'Update Discount' : 'Add Discount'}
          </button>
          {editingId && (
            <button type="button" style={s.secondaryBtn} disabled={saving} onClick={resetForm}>Cancel edit</button>
          )}
        </div>
    </>
  );
};

export default LongRentalTab;
