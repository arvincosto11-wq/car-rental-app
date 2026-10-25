import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { DEFAULT_OWNER_PERCENT, clampPercent } from '../utils/revenueShare';

// What each consignor's vehicles have brought in, and how it divides.
//
// Sits above the applications table because it answers the other question
// somebody opens this page with. The table is about letting a vehicle in;
// this is about what happened after it was let in, which until now the
// admin side could not see at all.
//
// Every figure comes from GET /consignments/income, which works the split
// out with the same shared rule the consignor's own dashboard uses. Doing
// the arithmetic here as well would be two descriptions of one agreement,
// and they would drift.
//
// It reports what has been EARNED, not what has been paid. There is no
// payout record in the system yet, so "owed" would be a guess dressed up as
// a figure. The wording says so rather than leaving somebody to assume.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const RANGES = [
  ['month', 'This month'],
  ['year', 'This year'],
  ['all', 'All time'],
];

const cutoffFor = (range) => {
  const now = new Date();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
};

const ConsignmentIncome = () => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [rows, setRows] = useState([]);
  // The split for agreements made from here on. Editable here because this
  // is where somebody is looking at what it produced; a separate settings
  // page for one number would be a nav entry nobody would find twice.
  const [ownerPercent, setOwnerPercent] = useState(DEFAULT_OWNER_PERCENT);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState('month');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      setLoading(true);
      setFailed(false);
      try {
        const cutoff = cutoffFor(range);
        const res = await api.get('/consignments/income', {
          params: cutoff ? { from: cutoff.toISOString() } : {},
        });
        if (live) setRows(res.data || []);
      } catch {
        if (live) setFailed(true);
      } finally {
        if (live) setLoading(false);
      }
    };
    load();
    return () => { live = false; };
  }, [range]);

  useEffect(() => {
    let live = true;
    api.get('/settings')
      .then((res) => {
        if (live && Number.isFinite(res.data?.revenueShare?.ownerPercent)) {
          setOwnerPercent(res.data.revenueShare.ownerPercent);
        }
      })
      // The default IS the system's behaviour until somebody changes it, so
      // showing it when the read fails is correct rather than a fallback.
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // Number('') is 0, and 0 is finite — so a cleared box would otherwise
  // read as "the owner keeps nothing" rather than as nothing typed.
  const asPercent = (value) => (String(value).trim() === '' ? NaN : clampPercent(value, NaN));

  const saveSplit = async () => {
    const asked = asPercent(draft);
    if (!Number.isFinite(asked)) {
      return toast.error("Enter the owner's share as a number between 0 and 100.");
    }
    setSaving(true);
    try {
      const res = await api.put('/settings', { revenueShare: { ownerPercent: asked } });
      const saved = res.data?.revenueShare?.ownerPercent ?? asked;
      setOwnerPercent(saved);
      setEditing(false);
      toast.success(`New bookings will be split ${saved}/${100 - saved}. Existing ones keep their own.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save that split.');
    } finally {
      setSaving(false);
    }
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const divider = isDark ? '#303132' : '#f3f4f6';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);

  const s = {
    wrap: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px',
      padding: '18px 20px', marginBottom: '20px',
    },
    head: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 16px', marginBottom: '14px' },
    heading: { fontSize: '15px', fontWeight: '700', color: text, margin: 0 },
    sub: { fontSize: '12px', color: text3, margin: '2px 0 0' },
    rangeRow: { marginLeft: 'auto', display: 'flex', gap: '6px' },
    rangeBtn: (active) => ({
      padding: '5px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '7px',
      border: `1px solid ${active ? gold : line}`,
      background: active ? (isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6') : 'transparent',
      color: active ? ink : text2, cursor: 'pointer',
    }),
    totals: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '1px', background: line, border: `1px solid ${line}`, borderRadius: '10px',
      overflow: 'hidden', marginBottom: '14px',
    },
    cell: { background: inset, padding: '12px 14px' },
    cellLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: text3 },
    cellValue: { fontSize: '20px', fontWeight: '800', color: text, marginTop: '3px', fontVariantNumeric: 'tabular-nums' },
    cellMine: { fontSize: '20px', fontWeight: '800', color: ink, marginTop: '3px', fontVariantNumeric: 'tabular-nums' },
    cellNote: { fontSize: '11px', color: text3, marginTop: '2px' },

    row: { borderTop: `1px solid ${divider}` },
    rowBtn: {
      width: '100%', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 14px',
      padding: '11px 2px', background: 'none', border: 'none', textAlign: 'left',
      cursor: 'pointer', fontFamily: 'inherit', color: text,
    },
    name: { fontSize: '13.5px', fontWeight: '650', minWidth: '140px' },
    meta: { fontSize: '11.5px', color: text3 },
    amounts: { marginLeft: 'auto', display: 'flex', gap: '18px', alignItems: 'baseline' },
    amount: { fontSize: '13px', fontWeight: '700', color: text2, fontVariantNumeric: 'tabular-nums' },
    amountMine: { fontSize: '13px', fontWeight: '800', color: ink, fontVariantNumeric: 'tabular-nums' },
    caret: (open) => ({
      fontSize: '11px', color: text3, transform: open ? 'rotate(90deg)' : 'none',
      transition: 'transform 120ms ease', display: 'inline-block',
    }),

    vehicles: { padding: '2px 0 12px 14px', display: 'grid', gap: '6px' },
    vehicleRow: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px 12px' },
    vehicleName: { fontSize: '12.5px', color: text2 },
    vehiclePlate: { fontSize: '11px', color: text3, fontVariantNumeric: 'tabular-nums' },
    vehicleAmount: { marginLeft: 'auto', fontSize: '12.5px', fontWeight: '700', color: text2, fontVariantNumeric: 'tabular-nums' },
    idle: { fontSize: '11.5px', color: text3 },

    foot: { fontSize: '11.5px', color: text3, marginTop: '12px', textWrap: 'pretty' },

    split: {
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px',
      marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${divider}`,
    },
    splitNow: { fontSize: '12.5px', color: text2 },
    splitStrong: { fontWeight: '750', color: text },
    splitBtn: {
      padding: '5px 12px', fontSize: '12px', fontWeight: '650', borderRadius: '7px',
      border: `1px solid ${line}`, background: 'transparent', color: ink,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    splitSave: {
      padding: '6px 14px', fontSize: '12px', fontWeight: '750', borderRadius: '7px',
      border: 'none', background: gold, color: ON_GOLD,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    splitInput: {
      width: '72px', minHeight: '32px', padding: '0 8px', borderRadius: '7px',
      border: `1px solid ${line}`, background: isDark ? '#18191a' : '#fff',
      color: text, fontFamily: 'inherit', fontSize: '13px',
      fontVariantNumeric: 'tabular-nums',
    },
    splitHint: { flexBasis: '100%', fontSize: '11.5px', color: text3, textWrap: 'pretty' },
    empty: { fontSize: '13px', color: text3, padding: '8px 0' },
  };

  const totals = rows.reduce((acc, r) => ({
    rental: acc.rental + r.rental,
    ownerEarned: acc.ownerEarned + r.ownerEarned,
    weKept: acc.weKept + r.weKept,
    trips: acc.trips + r.trips,
  }), { rental: 0, ownerEarned: 0, weKept: 0, trips: 0 });

  const earning = rows.filter((r) => r.rental > 0);

  return (
    <section style={s.wrap} aria-label="Consignment income">
      <div style={s.head}>
        <div>
          <h2 style={s.heading}>Income from consigned vehicles</h2>
          <p style={s.sub}>Rental earned and how it divides. Not a record of what has been paid out.</p>
        </div>
        <div style={s.rangeRow} role="tablist" aria-label="Period">
          {RANGES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={range === key}
              style={s.rangeBtn(range === key)}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <p style={s.empty}>Could not load income just now. The applications below are unaffected.</p>
      ) : loading ? (
        <p style={s.empty}>Adding it up…</p>
      ) : (
        <>
          <div style={s.totals}>
            <div style={s.cell}>
              <div style={s.cellLabel}>Rental taken</div>
              <div style={s.cellValue}>{peso(totals.rental)}</div>
              <div style={s.cellNote}>{totals.trips} trip{totals.trips === 1 ? '' : 's'}</div>
            </div>
            <div style={s.cell}>
              <div style={s.cellLabel}>Owners earned</div>
              <div style={s.cellValue}>{peso(totals.ownerEarned)}</div>
              <div style={s.cellNote}>across {rows.length} consignor{rows.length === 1 ? '' : 's'}</div>
            </div>
            <div style={s.cell}>
              <div style={s.cellLabel}>We kept</div>
              <div style={s.cellMine}>{peso(totals.weKept)}</div>
              <div style={s.cellNote}>for running the vehicles</div>
            </div>
          </div>

          {rows.length === 0 ? (
            <p style={s.empty}>No vehicles are consigned yet.</p>
          ) : earning.length === 0 ? (
            <p style={s.empty}>No consigned vehicle earned anything in this period.</p>
          ) : (
            earning.map((r) => {
              const open = openId === r.consignor.id;
              const earned = r.vehicles.filter((v) => v.rental > 0);
              const idle = r.vehicles.length - earned.length;
              return (
                <div key={r.consignor.id} style={s.row}>
                  <button
                    type="button"
                    style={s.rowBtn}
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : r.consignor.id)}
                  >
                    <span style={s.caret(open)}>▸</span>
                    <span style={s.name}>{r.consignor.name}</span>
                    <span style={s.meta}>
                      {r.trips} trip{r.trips === 1 ? '' : 's'} · {r.vehicles.length} vehicle
                      {r.vehicles.length === 1 ? '' : 's'}
                    </span>
                    <span style={s.amounts}>
                      <span style={s.amount}>{peso(r.rental)} taken</span>
                      <span style={s.amountMine}>{peso(r.ownerEarned)} theirs</span>
                    </span>
                  </button>

                  {open && (
                    <div style={s.vehicles}>
                      {earned.map((v) => (
                        <div key={v.id} style={s.vehicleRow}>
                          <span style={s.vehicleName}>{v.name}</span>
                          <span style={s.vehiclePlate}>{v.plateNumber || 'No plate'}</span>
                          <span style={s.meta}>{v.trips} trip{v.trips === 1 ? '' : 's'}</span>
                          <span style={s.vehicleAmount}>
                            {peso(v.rental)} taken · {peso(v.ownerEarned)} theirs
                          </span>
                        </div>
                      ))}
                      {idle > 0 && (
                        <p style={s.idle}>
                          {idle} more vehicle{idle === 1 ? '' : 's'} earned nothing in this period.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div style={s.split}>
            {editing ? (
              <>
                <label style={s.splitNow} htmlFor="owner-share">Owner keeps</label>
                <input
                  id="owner-share"
                  style={s.splitInput}
                  type="number"
                  min="0"
                  max="100"
                  value={draft}
                  disabled={saving}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <span style={s.splitNow}>
                  % · we keep {Number.isFinite(asPercent(draft)) ? 100 - asPercent(draft) : '—'}%
                </span>
                <button type="button" style={s.splitSave} disabled={saving} onClick={saveSplit}>
                  {saving ? 'Saving…' : 'Save split'}
                </button>
                <button type="button" style={s.splitBtn} disabled={saving} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span style={s.splitNow}>
                  New agreements split{' '}
                  <span style={s.splitStrong}>{ownerPercent}% owner / {100 - ownerPercent}% us</span>
                </span>
                <button
                  type="button"
                  style={s.splitBtn}
                  onClick={() => { setDraft(String(ownerPercent)); setEditing(true); }}
                >
                  Change
                </button>
              </>
            )}
            <span style={s.splitHint}>
              Applies to bookings made after you save it. Every booking already taken keeps the
              split it was agreed on, so nothing above moves.
            </span>
          </div>

          <p style={s.foot}>
            Worked out on the rental only — delivery, late, fuel and damage charges are not shared,
            and owners are paid on the price before any promo discount. Each booking is divided on
            the split agreed when it was made, so changing the split later never moves these figures.
          </p>
        </>
      )}
    </section>
  );
};

export default ConsignmentIncome;
