import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../theme';
import api from '../api';
import { useUIFeedback } from '../context/UIFeedbackContext';
import { DEFAULT_OWNER_PERCENT, clampPercent } from '../utils/revenueShare';
import { daysWaiting, WAITING_WARN_DAYS } from '../utils/payouts';
import { VehicleIcon, ChevronIcon, ClockIcon } from './adminConsignIcons';
import PayoutDialog from './PayoutDialog';

// What each consignor's vehicles have brought in, how it divides, and what
// we still owe them.
//
// This used to report earnings alone, and said so in its own subtitle:
// "not a record of what has been paid out". There was no such record to
// keep. Now there is, and the figure the page is actually opened for is
// what is OWED — so that is the one on its own band, in gold, with the
// button beside it.
//
// Earned and owed are different questions and both are answered. A booking
// is earned when it is confirmed; it is payable only once the vehicle is
// back, because a confirmed booking can still be cancelled and refunded.
// What sits between the two is reported as "coming".
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

const cutoffFor = (range) => {
  const now = new Date();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
};

const dayMonth = (value) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const tripSpan = (trip) => {
  const from = new Date(trip.startDate);
  const to = new Date(trip.endedAt || trip.endDate);
  if (from.toDateString() === to.toDateString()) return dayMonth(from);
  if (from.getMonth() === to.getMonth()) return `${from.getDate()}–${dayMonth(to)}`;
  return `${dayMonth(from)} – ${dayMonth(to)}`;
};

const ConsignmentIncome = ({ refreshKey = 0, onPaid }) => {
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
  const [paying, setPaying] = useState(null);

  // Bumped after a payment is recorded here. `refreshKey` is the same
  // signal arriving from outside — a payment voided in the history below
  // moves every owed figure above it. Both are effect dependencies rather
  // than a remount, so reloading does not throw away which period the
  // person was looking at.
  const [reload, setReload] = useState(0);

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
  }, [range, reload, refreshKey]);

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

  const onRecorded = (message) => {
    setPaying(null);
    setReload((n) => n + 1);
    onPaid?.(message);
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
  const goldSoft = isDark ? 'rgba(232,161,0,0.14)' : '#fbf3e2';
  const goldLine = isDark ? '#5a4415' : '#edd693';
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';

  const COLUMNS = '38px minmax(180px, 1.5fr) repeat(3, minmax(92px, 0.8fr)) minmax(136px, 0.9fr) auto';

  const s = {
    wrap: {
      background: card, border: `1px solid ${line}`, borderRadius: '12px',
      overflow: 'hidden', marginBottom: '20px',
    },
    head: {
      display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px 16px',
      padding: '17px 20px 15px',
    },
    heading: { fontSize: '15px', fontWeight: '700', color: text, margin: 0 },
    sub: { fontSize: '12px', color: text3, margin: '2px 0 0' },
    rangeRow: { marginLeft: 'auto', display: 'flex', gap: '6px' },
    rangeBtn: (active) => ({
      padding: '5px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '7px',
      border: `1px solid ${active ? goldLine : line}`,
      background: active ? goldSoft : 'transparent',
      color: active ? ink : text2, cursor: 'pointer', fontFamily: 'inherit',
    }),

    tiles: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
      borderTop: `1px solid ${line}`,
    },
    tile: { padding: '15px 20px 17px', borderRight: `1px solid ${line}` },
    tileLabel: { fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: text3 },
    tileValue: { fontSize: '24px', fontWeight: '800', color: text, marginTop: '5px', fontVariantNumeric: 'tabular-nums' },
    tileMine: { fontSize: '24px', fontWeight: '800', color: ink, marginTop: '5px', fontVariantNumeric: 'tabular-nums' },
    tileNote: { fontSize: '11.5px', color: text3, marginTop: '2px' },

    owedBand: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '18px', flexWrap: 'wrap',
      background: goldSoft, borderTop: `1px solid ${goldLine}`, padding: '14px 20px',
    },
    owedLeft: { display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' },
    owedValue: { fontSize: '27px', fontWeight: '800', color: ink, fontVariantNumeric: 'tabular-nums' },
    owedLabel: { fontSize: '13px', fontWeight: '700', color: ink },
    owedNote: { fontSize: '12.5px', color: ink, opacity: 0.85 },

    split: {
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px',
      padding: '14px 20px', borderTop: `1px solid ${line}`,
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
    foot: { fontSize: '11.5px', color: text3, padding: '0 20px 16px', textWrap: 'pretty' },

    colHead: {
      display: 'grid', gridTemplateColumns: COLUMNS, gap: '14px',
      padding: '9px 20px', background: inset,
      borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`,
      fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.07em',
      textTransform: 'uppercase', color: text3,
    },
    personRow: {
      display: 'grid', gridTemplateColumns: COLUMNS, gap: '14px', alignItems: 'center',
      width: '100%', padding: '14px 20px', background: 'none', border: 0,
      borderTop: `1px solid ${divider}`, textAlign: 'left', color: text,
      fontFamily: 'inherit', cursor: 'pointer',
    },
    avatar: {
      width: '38px', height: '38px', borderRadius: '999px',
      background: goldSoft, border: `1px solid ${goldLine}`, color: ink,
      display: 'grid', placeItems: 'center', fontWeight: '750', fontSize: '15px',
    },
    name: { fontSize: '14.5px', fontWeight: '700', color: text },
    meta: { display: 'block', fontSize: '12px', color: text3, marginTop: '1px' },
    figure: (tone) => ({
      fontSize: '14px', fontWeight: tone === 'owed' ? '800' : '650',
      color: tone === 'owed' ? ink : tone === 'zero' ? text3 : text,
      fontVariantNumeric: 'tabular-nums',
    }),
    figureSub: { display: 'block', fontSize: '11.5px', color: text3, marginTop: '1px', fontWeight: '500' },
    waiting: (warn) => ({
      display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px',
      color: warn ? ink : text3, fontWeight: warn ? '650' : '500',
    }),
    payBtn: {
      minHeight: '36px', padding: '0 14px', borderRadius: '8px', border: 0,
      background: gold, color: ON_GOLD, fontFamily: 'inherit',
      fontSize: '12.5px', fontWeight: '750', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    settled: {
      display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: '999px',
      background: greenSoft, color: green, fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
    },
    caret: (open) => ({
      display: 'inline-flex', color: text3,
      transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease',
    }),

    detail: { padding: '2px 20px 18px 72px', borderTop: `1px solid ${divider}` },
    vehicles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginTop: '14px' },
    vehicle: {
      background: inset, border: `1px solid ${line}`, borderRadius: '10px',
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

    empty: { fontSize: '13px', color: text3, padding: '18px 20px' },
  };

  const totals = rows.reduce((acc, r) => ({
    rental: acc.rental + r.rental,
    ownerEarned: acc.ownerEarned + r.ownerEarned,
    weKept: acc.weKept + r.weKept,
    trips: acc.trips + r.trips,
    owed: acc.owed + r.owed,
    coming: acc.coming + r.coming,
    paid: acc.paid + r.paidInPeriod,
  }), { rental: 0, ownerEarned: 0, weKept: 0, trips: 0, owed: 0, coming: 0, paid: 0 });

  const owing = rows.filter((r) => r.owed > 0).length;

  return (
    <>
      <section style={s.wrap} aria-label="Money from consigned vehicles">
        <div style={s.head}>
          <div>
            <h2 style={s.heading}>Money from consigned vehicles</h2>
            <p style={s.sub}>Rental only. Delivery, late, fuel and damage charges are not shared.</p>
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
          <p style={s.empty}>Could not load the figures just now. Nothing below is affected.</p>
        ) : loading ? (
          <p style={s.empty}>Adding it up…</p>
        ) : (
          <>
            <div style={s.tiles}>
              <div style={s.tile}>
                <div style={s.tileLabel}>Rental taken</div>
                <div style={s.tileValue}>{peso(totals.rental)}</div>
                <div style={s.tileNote}>
                  {totals.trips} trip{totals.trips === 1 ? '' : 's'} {PERIOD_WORD[range]}
                </div>
              </div>
              <div style={s.tile}>
                <div style={s.tileLabel}>Owners earned</div>
                <div style={s.tileValue}>{peso(totals.ownerEarned)}</div>
                <div style={s.tileNote}>across {rows.length} consignor{rows.length === 1 ? '' : 's'}</div>
              </div>
              <div style={s.tile}>
                <div style={s.tileLabel}>We kept</div>
                <div style={s.tileMine}>{peso(totals.weKept)}</div>
                <div style={s.tileNote}>for running the vehicles</div>
              </div>
              <div style={{ ...s.tile, borderRight: 0 }}>
                <div style={s.tileLabel}>Paid out</div>
                <div style={s.tileValue}>{peso(totals.paid)}</div>
                <div style={s.tileNote}>
                  {totals.paid === 0 ? `nothing settled ${PERIOD_WORD[range]}` : `handed over ${PERIOD_WORD[range]}`}
                </div>
              </div>
            </div>

            {/* Owed does not move when the period does, and that is not a
                bug in the tabs above it. What we owe is what we owe, and an
                unpaid trip from August is still owed in November. */}
            <div style={s.owedBand}>
              <div style={s.owedLeft}>
                <span style={s.owedValue}>{peso(totals.owed)}</span>
                <span style={s.owedLabel}>owed right now</span>
                <span style={s.owedNote}>
                  {totals.owed === 0
                    ? 'everyone is settled'
                    : `to ${owing} consignor${owing === 1 ? '' : 's'}, for finished trips`}
                </span>
              </div>
              <span style={s.owedNote}>
                {totals.coming > 0
                  ? `${peso(totals.coming)} coming — booked but not yet travelled, so not payable`
                  : 'no upcoming trips'}
              </span>
            </div>

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
              Owners are paid on the price before any promo discount, and each booking is divided on
              the split agreed when it was made.
            </p>
          </>
        )}
      </section>

      <section style={s.wrap} aria-label="Consignors">
        <div style={s.head}>
          <div>
            <h2 style={s.heading}>Consignors</h2>
            <p style={s.sub}>Who we owe, how long they have been waiting, and what each vehicle brought in.</p>
          </div>
        </div>

        {loading || failed ? (
          <p style={s.empty}>{failed ? 'Could not load the consignors just now.' : 'Loading…'}</p>
        ) : rows.length === 0 ? (
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
                      <span style={s.figure(r.ownerEarned ? '' : 'zero')}>{peso(r.ownerEarned)}</span>
                      <span style={s.figureSub}>{PERIOD_WORD[range]}</span>
                    </span>
                    <span>
                      <span style={s.figure(r.paidInPeriod ? '' : 'zero')}>{peso(r.paidInPeriod)}</span>
                      <span style={s.figureSub}>{PERIOD_WORD[range]}</span>
                    </span>
                    <span>
                      <span style={s.figure(r.owed ? 'owed' : 'zero')}>{peso(r.owed)}</span>
                      <span style={s.figureSub}>
                        {r.coming ? `${peso(r.coming)} coming` : 'nothing coming'}
                      </span>
                    </span>
                    <span>
                      {r.owed === 0 ? (
                        <span style={s.waiting(false)}>nothing waiting</span>
                      ) : (
                        <span style={s.waiting(waited >= WAITING_WARN_DAYS)}>
                          <ClockIcon size={14} />
                          {dayMonth(r.oldestUnpaidAt)} · {waited} day{waited === 1 ? '' : 's'}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {r.owed > 0 ? (
                        <span
                          role="button"
                          tabIndex={0}
                          style={s.payBtn}
                          onClick={(e) => { e.stopPropagation(); setPaying(r); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              setPaying(r);
                            }
                          }}
                        >
                          Pay {peso(r.owed)}
                        </span>
                      ) : (
                        <span style={s.settled}>Settled</span>
                      )}
                      <span style={s.caret(open)}><ChevronIcon size={16} /></span>
                    </span>
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
      </section>

      {paying && (
        <PayoutDialog
          row={paying}
          onClose={() => setPaying(null)}
          onRecorded={onRecorded}
        />
      )}
    </>
  );
};

export default ConsignmentIncome;
