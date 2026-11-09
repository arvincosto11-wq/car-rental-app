import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { DEFAULT_OWNER_PERCENT, clampPercent } from '../utils/revenueShare';
import { daysWaiting, WAITING_WARN_DAYS } from '../utils/payouts';
import { VehicleIcon, ChevronIcon, ClockIcon } from './adminConsignIcons';

// What the consigned vehicles earned over a period, and who earned it.
//
// The period tabs govern everything in this card and nothing outside it.
// That is why the owner table lives in here rather than in a card of its
// own: its "earned" and "paid" columns are period figures, and a table
// sitting under a separate heading would have left the tabs looking like
// they applied to the whole page. The two columns that are NOT period
// figures — owed, and how long somebody has waited — say so on their own
// sub-lines.
//
// Every figure comes from GET /consignments/income, which works the split
// out with the same shared rule the consignor's own dashboard uses. Doing
// the arithmetic here as well would be two descriptions of one agreement,
// and they would drift.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

const RANGES = [
  ['month', 'This month'],
  ['year', 'This year'],
  ['all', 'All time'],
];

const PERIOD_WORD = { month: 'this month', year: 'this year', all: 'all time' };

const dayMonth = (value) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Within one month only the second day is repeated: "Aug 24–26". Putting
// the bare first day in front of a formatted second one read as
// "24–Aug 26", which is not a date range in any language.
const tripSpan = (trip) => {
  const from = new Date(trip.startDate);
  const to = new Date(trip.endedAt || trip.endDate);
  if (from.toDateString() === to.toDateString()) return dayMonth(from);
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${dayMonth(from)}–${to.getDate()}`;
  }
  return `${dayMonth(from)} – ${dayMonth(to)}`;
};

const ConsignmentIncome = ({ rows, range, onRange, loading, failed }) => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  // The split for agreements made from here on. Editable here because this
  // is where somebody is looking at what it produced; a separate settings
  // page for one number would be a nav entry nobody would find twice.
  const [ownerPercent, setOwnerPercent] = useState(DEFAULT_OWNER_PERCENT);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);

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
  const goldSoft = isDark ? 'rgba(232,161,0,0.12)' : '#fbf3e2';
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';

  const COLUMNS = '38px minmax(170px, 1.4fr) repeat(3, minmax(88px, 0.8fr)) minmax(130px, 0.9fr) 24px';

  const s = {
    wrap: {
      background: card, border: `1px solid ${line}`, borderRadius: '14px',
      overflow: 'hidden', marginBottom: '20px',
    },
    head: {
      display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px 16px',
      padding: '18px 22px 15px',
    },
    heading: { fontSize: '16px', fontWeight: '700', color: text, margin: 0 },
    sub: { fontSize: '13px', color: text3, margin: '3px 0 0' },
    rangeRow: { marginLeft: 'auto', display: 'flex', gap: '6px' },
    rangeBtn: (active) => ({
      minHeight: '36px', padding: '0 14px', fontSize: '13px', fontWeight: active ? '700' : '600',
      borderRadius: '9px', fontFamily: 'inherit', cursor: 'pointer',
      border: `1.5px solid ${active ? gold : line}`,
      background: active ? goldSoft : card,
      color: active ? ink : text,
    }),

    figures: {
      display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      borderTop: `1px solid ${line}`,
    },
    figure: { padding: '15px 22px 17px', borderRight: `1px solid ${line}` },
    figureLast: { padding: '15px 22px 17px' },
    figureLabel: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: text3 },
    figureValue: { fontSize: '22px', fontWeight: '800', color: text, marginTop: '2px', fontVariantNumeric: 'tabular-nums' },
    figureMine: { fontSize: '22px', fontWeight: '800', color: ink, marginTop: '2px', fontVariantNumeric: 'tabular-nums' },
    figureNote: { fontSize: '12px', color: text3 },

    colHead: {
      display: 'grid', gridTemplateColumns: COLUMNS, gap: '14px',
      padding: '9px 22px', background: inset,
      borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`,
      fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.07em',
      textTransform: 'uppercase', color: text3,
    },
    personRow: {
      display: 'grid', gridTemplateColumns: COLUMNS, gap: '14px', alignItems: 'center',
      width: '100%', padding: '13px 22px', background: 'none', border: 0,
      borderTop: `1px solid ${divider}`, textAlign: 'left', color: text,
      fontFamily: 'inherit', cursor: 'pointer',
    },
    avatar: {
      width: '38px', height: '38px', borderRadius: '999px',
      background: goldSoft, border: `1px solid ${isDark ? '#5a4415' : '#edd693'}`, color: ink,
      display: 'grid', placeItems: 'center', fontWeight: '750', fontSize: '15px',
    },
    name: { fontSize: '14.5px', fontWeight: '700', color: text },
    meta: { display: 'block', fontSize: '12px', color: text3, marginTop: '1px' },
    cell: (tone) => ({
      fontSize: '14px', fontWeight: tone === 'owed' ? '800' : '650',
      color: tone === 'owed' ? ink : tone === 'zero' ? text3 : text,
      fontVariantNumeric: 'tabular-nums',
    }),
    cellSub: { display: 'block', fontSize: '11.5px', color: text3, marginTop: '1px', fontWeight: '500' },
    waiting: (warn) => ({
      display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px',
      color: warn ? ink : text3, fontWeight: warn ? '650' : '500',
    }),
    settled: {
      display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px',
      background: greenSoft, color: green, fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap',
    },
    caret: (open) => ({
      display: 'inline-flex', color: text3, justifySelf: 'end',
      transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease',
    }),

    detail: { padding: '2px 22px 18px 74px', borderTop: `1px solid ${divider}` },
    vehicles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '12px', marginTop: '14px' },
    vehicle: {
      background: inset, border: `1px solid ${line}`, borderRadius: '12px',
      padding: '12px 14px', display: 'flex', gap: '11px', alignItems: 'flex-start',
    },
    vIcon: { flex: 'none', color: text3, marginTop: '1px' },
    vName: { fontSize: '13.5px', fontWeight: '700', color: text },
    vMeta: { fontSize: '11.5px', color: text3, marginTop: '1px' },
    vFig: { marginLeft: 'auto', textAlign: 'right', fontSize: '12.5px', fontWeight: '650', color: text, whiteSpace: 'nowrap' },
    vFigSub: { display: 'block', fontSize: '11.5px', color: text3, fontWeight: '500' },
    chip: (on) => ({
      display: 'inline-block', marginTop: '4px', padding: '1px 8px', borderRadius: '999px',
      fontSize: '10.5px', fontWeight: '700',
      background: on ? greenSoft : 'transparent',
      color: on ? green : text3,
      border: on ? 'none' : `1px solid ${line}`,
    }),

    dueLabel: {
      fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.07em',
      textTransform: 'uppercase', color: text3, margin: '16px 0 6px',
    },
    dueRow: {
      display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0',
      borderTop: `1px solid ${divider}`, fontSize: '12.5px',
    },
    dueWhen: { minWidth: '104px', color: text2, fontVariantNumeric: 'tabular-nums' },
    dueCar: { flex: 1, minWidth: 0, color: text3 },
    dueAmt: { fontWeight: '700', color: text, fontVariantNumeric: 'tabular-nums' },

    split: {
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px',
      padding: '15px 22px', borderTop: `1px solid ${line}`,
    },
    splitNow: { fontSize: '13px', color: text2 },
    splitStrong: { fontWeight: '750', color: text },
    splitBtn: {
      minHeight: '34px', padding: '0 12px', fontSize: '12.5px', fontWeight: '650', borderRadius: '8px',
      border: `1px solid ${line}`, background: card, color: ink,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    splitSave: {
      minHeight: '34px', padding: '0 14px', fontSize: '12.5px', fontWeight: '750', borderRadius: '8px',
      border: 'none', background: gold, color: ON_GOLD,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    splitInput: {
      width: '72px', minHeight: '34px', padding: '0 8px', borderRadius: '8px',
      border: `1px solid ${line}`, background: isDark ? '#18191a' : '#fff',
      color: text, fontFamily: 'inherit', fontSize: '13px',
      fontVariantNumeric: 'tabular-nums',
    },
    splitHint: { flexBasis: '100%', fontSize: '12px', color: text3, textWrap: 'pretty' },

    empty: { fontSize: '13px', color: text3, padding: '20px 22px' },
  };

  const totals = rows.reduce((acc, r) => ({
    rental: acc.rental + r.rental,
    ownerEarned: acc.ownerEarned + r.ownerEarned,
    weKept: acc.weKept + r.weKept,
    trips: acc.trips + r.trips,
  }), { rental: 0, ownerEarned: 0, weKept: 0, trips: 0 });

  return (
    <section style={s.wrap} aria-label="Earnings from consigned vehicles">
      <div style={s.head}>
        <div>
          <h2 style={s.heading}>Earnings and owners</h2>
          <p style={s.sub}>
            Rental only — delivery, late, fuel and damage charges are not shared, and owners are
            paid on the price before any promo discount.
          </p>
        </div>
        <div style={s.rangeRow} role="tablist" aria-label="Period">
          {RANGES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={range === key}
              style={s.rangeBtn(range === key)}
              onClick={() => onRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <p style={s.empty}>Could not load the figures just now. Nothing above is affected.</p>
      ) : loading ? (
        <p style={s.empty}>Adding it up…</p>
      ) : (
        <>
          <div style={s.figures}>
            <div style={s.figure}>
              <div style={s.figureLabel}>RENTAL TAKEN</div>
              <div style={s.figureValue}>{peso(totals.rental)}</div>
              <div style={s.figureNote}>
                {totals.trips} trip{totals.trips === 1 ? '' : 's'} {PERIOD_WORD[range]}
              </div>
            </div>
            <div style={s.figure}>
              <div style={s.figureLabel}>OWNERS EARNED</div>
              <div style={s.figureValue}>{peso(totals.ownerEarned)}</div>
              <div style={s.figureNote}>across {rows.length} consignor{rows.length === 1 ? '' : 's'}</div>
            </div>
            <div style={s.figureLast}>
              <div style={s.figureLabel}>WE KEPT</div>
              <div style={s.figureMine}>{peso(totals.weKept)}</div>
              <div style={s.figureNote}>for running the vehicles</div>
            </div>
          </div>

          {rows.length === 0 ? (
            <p style={s.empty}>
              No vehicles are consigned yet. An owner appears here once their application is approved.
            </p>
          ) : (
            <>
              <div style={s.colHead} aria-hidden="true">
                <span />
                <span>Owner</span>
                <span>Earned</span>
                <span>Paid</span>
                <span>Owed</span>
                <span>Waiting since</span>
                <span />
              </div>

              {rows.map((r) => {
                const open = openId === r.consignor.id;
                const waited = daysWaiting(r.oldestUnpaidAt);
                return (
                  <div key={r.consignor.id}>
                    <button
                      type="button"
                      style={s.personRow}
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : r.consignor.id)}
                    >
                      <span style={s.avatar} aria-hidden="true">
                        {(r.consignor.name || '?').trim().charAt(0).toUpperCase()}
                      </span>
                      <span>
                        <span style={s.name}>{r.consignor.name}</span>
                        <span style={s.meta}>
                          {r.consignor.phone ? `${r.consignor.phone} · ` : ''}
                          {r.vehicles.length} vehicle{r.vehicles.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span>
                        <span style={s.cell(r.ownerEarned ? '' : 'zero')}>{peso(r.ownerEarned)}</span>
                        <span style={s.cellSub}>{PERIOD_WORD[range]}</span>
                      </span>
                      <span>
                        <span style={s.cell(r.paidInPeriod ? '' : 'zero')}>{peso(r.paidInPeriod)}</span>
                        <span style={s.cellSub}>{PERIOD_WORD[range]}</span>
                      </span>
                      <span>
                        <span style={s.cell(r.owed ? 'owed' : 'zero')}>{peso(r.owed)}</span>
                        <span style={s.cellSub}>
                          {r.coming ? `${peso(r.coming)} coming` : 'nothing coming'}
                        </span>
                      </span>
                      <span>
                        {r.owed === 0 ? (
                          <span style={s.settled}>Settled</span>
                        ) : (
                          <span style={s.waiting(waited >= WAITING_WARN_DAYS)}>
                            <ClockIcon size={14} />
                            {dayMonth(r.oldestUnpaidAt)} · {waited} day{waited === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      <span style={s.caret(open)}><ChevronIcon size={16} /></span>
                    </button>

                    {open && (
                      <div style={s.detail}>
                        <div style={s.vehicles}>
                          {r.vehicles.map((v) => (
                            <div key={v.id} style={s.vehicle}>
                              <span style={s.vIcon}><VehicleIcon category={v.category} size={20} /></span>
                              <div style={{ minWidth: 0 }}>
                                <div style={s.vName}>{v.name}</div>
                                <div style={s.vMeta}>
                                  {v.plateNumber || 'No plate'} · {peso(v.pricePerDay)} a day
                                </div>
                                <span style={s.chip(v.onPlatform)}>
                                  {v.onPlatform ? 'Listed' : 'Off platform'}
                                </span>
                              </div>
                              <div style={s.vFig}>
                                {v.trips > 0 ? peso(v.rental) : 'No trips'}
                                <span style={s.vFigSub}>
                                  {v.trips > 0
                                    ? `${peso(v.ownerEarned)} theirs · ${v.trips} trip${v.trips === 1 ? '' : 's'}`
                                    : PERIOD_WORD[range]}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {r.payable.length > 0 && (
                          <>
                            <div style={s.dueLabel}>What is owed, trip by trip</div>
                            {r.payable.map((trip) => (
                              <div key={trip.id} style={s.dueRow}>
                                <span style={s.dueWhen}>{tripSpan(trip)}</span>
                                <span style={s.dueCar}>
                                  {trip.vehicle}{trip.plateNumber ? ` · ${trip.plateNumber}` : ''}
                                </span>
                                <span style={{ color: text3 }}>{peso(trip.rental)} taken</span>
                                <span style={s.dueAmt}>{peso(trip.amount)}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
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
        </>
      )}
    </section>
  );
};

export default ConsignmentIncome;
