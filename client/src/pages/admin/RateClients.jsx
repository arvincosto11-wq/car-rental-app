import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import BackButton from '../../components/BackButton';
import { SkeletonListCard } from '../../components/Skeleton';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { fuelLabel } from '../../utils/fuel';
import { formatMoment } from '../../utils/phTime';
import api from '../../api';
import { DoneGlyph } from '../../components/Glyphs';
import StarRating from '../../components/StarRating';
import StarPicker from '../../components/StarPicker';
import ClientRatingModal from '../../components/ClientRatingModal';
import { clientScoreLabel } from '../../utils/clientScore';

// What the stars mean, said in words beside them. A number out of five is
// not an opinion anybody holds; "fine" and "good" are.
// Index 0 is the nothing-picked case, which this screen shows as a blank
// line rather than a prompt — the question above it is the prompt.
const STAR_WORDS = ['', 'Poor', 'Below average', 'Fine', 'Good', 'Excellent'];

const RateClients = () => {
  usePageTitle('Client Ratings');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  // Skipped ones go to the back of the queue rather than out of it: the
  // point of skipping is "not now", not "never".
  const [skipped, setSkipped] = useState([]);
  // Two halves of the same job: the queue of rentals still to judge, and
  // everything already judged. The page used to be the queue alone, so it
  // emptied itself out of existence once the work was done.
  const [tab, setTab] = useState(null);
  const [openClient, setOpenClient] = useState(null);
  const [editing, setEditing] = useState(null);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/all');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const unrated = bookings.filter((b) => b.status === 'completed' && !b.clientRating?.ratedAt);
  const queue = [
    ...unrated.filter((b) => !skipped.includes(b._id)),
    ...unrated.filter((b) => skipped.includes(b._id)),
  ];
  const current = queue[0] || null;
  // Everyone still waiting, not the next four: this is the only place the
  // queue can be seen as a list rather than one card at a time.
  const upNext = queue.slice(1);
  const ratedBookings = bookings.filter((b) => b.status === 'completed' && b.clientRating?.ratedAt);
  const ratedCount = ratedBookings.length;
  const total = ratedCount + unrated.length;

  // One row per person, not per rental: the question this answers is
  // "how has this client been", and a client with eleven rentals is one
  // client. Their own rentals sit inside the row they belong to.
  const ratedClients = (() => {
    const byClient = new Map();
    for (const b of ratedBookings) {
      const id = b.user?._id || b.user?.email || 'unknown';
      if (!byClient.has(id)) {
        byClient.set(id, { id, user: b.user, rows: [] });
      }
      byClient.get(id).rows.push(b);
    }
    return [...byClient.values()]
      .map((c) => ({
        ...c,
        rows: [...c.rows].sort((a, b) => new Date(b.endDate) - new Date(a.endDate)),
        lastRated: c.rows.reduce((d, b) => {
          const at = b.clientRating?.updatedAt || b.clientRating?.ratedAt;
          return !d || new Date(at) > new Date(d) ? at : d;
        }, null),
      }))
      .sort((a, b) => b.rows.length - a.rows.length);
  })();

  // How a client's scores are spread, so one bad rental among forty good
  // ones is visible without reading every row.
  const spreadFor = (rows) => [5, 4, 3, 2, 1].map((n) => ({
    n,
    hits: rows.filter((b) => b.clientRating?.rating === n).length,
  }));

  const RENTALS_SHOWN = 8;

  // Until somebody picks a tab, the page opens on whichever half has
  // something in it — the queue while there is work, the list once the
  // work is done.
  const view = tab || (queue.length > 0 ? 'torate' : 'rated');

  const save = async () => {
    if (!current || !rating) return;
    setSaving(true);
    try {
      await api.post(`/bookings/${current._id}/rate-client`, { rating, comment: note });
      setRating(0);
      setNote('');
      await fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong saving this rating.');
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    if (!current) return;
    setSkipped((prev) => [...prev.filter((id) => id !== current._id), current._id]);
    setRating(0);
    setNote('');
  };

  // Everything on the left of the card is a record somebody wrote down at
  // the counter. A fact nobody recorded is left out rather than guessed at
  // — "no damage noted" and "nobody looked" are not the same sentence.
  const factsFor = (b) => {
    const facts = [];
    facts.push({
      label: 'Booking',
      value: `${b.car?.brand} ${b.car?.model} · ${formatMoment(b.startDate, false, { month: 'short', day: 'numeric' })} to ${formatMoment(b.endDate, false, { month: 'short', day: 'numeric' })}`,
    });
    if (b.returnedAt) {
      const late = b.lateFee?.days || 0;
      facts.push({
        label: 'Returned',
        value: late > 0 ? `${late} day${late === 1 ? '' : 's'} late` : 'On time',
        tone: late > 0 ? 'bad' : 'good',
      });
    }
    if (b.fuel?.atReturn !== null && b.fuel?.atReturn !== undefined) {
      const out = b.fuel?.atPickup;
      const short = out !== null && out !== undefined && b.fuel.atReturn < out;
      facts.push({
        label: 'Fuel at return',
        value: short
          ? `${fuelLabel(b.fuel.atReturn)} — went out ${fuelLabel(out).toLowerCase()}`
          : `${fuelLabel(b.fuel.atReturn)}, as it went out`,
        tone: short ? 'bad' : 'good',
      });
    }
    if (b.returnedAt) {
      const damage = (b.condition?.damageCharge || 0) > 0 || !!b.condition?.atReturn?.note;
      facts.push({
        label: 'Condition',
        value: damage ? (b.condition?.atReturn?.note || 'Damage noted') : 'No damage noted',
        tone: damage ? 'bad' : 'good',
      });
    }
    const owed = (!b.lateFee?.collectedAt ? (b.lateFee?.amount || 0) : 0)
      + (!b.fuel?.collectedAt ? (b.fuel?.charge || 0) : 0)
      + (!b.condition?.damageCollectedAt ? (b.condition?.damageCharge || 0) : 0);
    const charged = (b.lateFee?.amount || 0) + (b.fuel?.charge || 0) + (b.condition?.damageCharge || 0);
    if (charged > 0) {
      facts.push({
        label: 'Charges',
        value: owed > 0 ? `₱${owed.toLocaleString()} not settled` : 'All settled',
        tone: owed > 0 ? 'bad' : 'good',
      });
    }
    return facts;
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e3e5e8';
  const divider = isDark ? '#303132' : '#eef0f2';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldTint = isDark ? 'rgba(232,161,0,0.12)' : '#fbf1d6';

  const s = {
    headRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: { fontSize: '22px', fontWeight: '700', color: text, marginTop: '10px', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: text3, marginBottom: '18px' },
    countPill: {
      display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '10px',
      fontSize: '12.5px', color: text2,
    },
    countNum: {
      padding: '3px 10px', borderRadius: '20px', background: gold, color: ON_GOLD,
      fontSize: '12px', fontWeight: '800',
    },

    progressRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: text3 },
    bar: { height: '6px', borderRadius: '3px', background: isDark ? '#303132' : '#f1f2f4', margin: '7px 0 20px' },
    barFill: (pct) => ({ width: `${pct}%`, height: '100%', borderRadius: '3px', background: gold }),

    card: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0',
      background: card, border: `1px solid ${line}`, borderRadius: '18px', overflow: 'hidden',
    },
    left: { padding: '20px', borderRight: `1px solid ${divider}` },
    stage: {
      aspectRatio: '16 / 8', borderRadius: '12px', marginBottom: '16px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px',
      background: isDark
        ? 'radial-gradient(circle at 50% 35%, #2c2d30, #1b1c1e)'
        : 'radial-gradient(circle at 50% 35%, #ffffff, #e9ebee)',
    },
    stageImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
    stageEmpty: { fontSize: '12px', color: text3 },
    facts: { margin: 0 },
    factRow: {
      display: 'flex', justifyContent: 'space-between', gap: '14px',
      padding: '9px 0', borderTop: `1px solid ${divider}`, fontSize: '12.5px',
    },
    factLabel: { color: text3 },
    factValue: (tone) => ({
      fontWeight: '700', textAlign: 'right',
      color: tone === 'bad' ? (isDark ? '#f87171' : '#b91c1c')
        : tone === 'good' ? (isDark ? '#86efac' : '#065f46') : text,
    }),

    right: { padding: '20px' },
    who: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
    avatar: {
      width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: goldTint, color: ink, fontSize: '19px', fontWeight: '800',
    },
    // Both spans, so both need telling to be lines: without this the name
    // and the address ran together as "John Doejohn@gmail.com".
    whoName: { display: 'block', fontSize: '18px', fontWeight: '800', color: text },
    whoMail: { display: 'block', fontSize: '12.5px', color: text3, marginTop: '1px' },
    ask: { fontSize: '15px', fontWeight: '800', color: text, margin: '0 0 12px' },
    stars: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' },
    starWord: { fontSize: '15px', fontWeight: '800', color: ink, minHeight: '20px' },
    noteLabel: { display: 'block', fontSize: '12.5px', fontWeight: '700', color: text2, margin: '16px 0 6px' },
    note: {
      width: '100%', minHeight: '84px', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
      border: `1px solid ${line}`, background: inset, color: text,
      fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical',
    },
    noteHint: { fontSize: '11.5px', color: text3, marginTop: '6px' },
    actions: { display: 'flex', gap: '8px', marginTop: '16px' },
    skipBtn: {
      minHeight: '42px', padding: '0 16px', borderRadius: '10px', cursor: 'pointer',
      border: `1px solid ${line}`, background: 'transparent', color: text,
      fontSize: '13px', fontWeight: '700',
    },
    saveBtn: (ready) => ({
      flex: 1, minHeight: '42px', borderRadius: '10px', border: 'none',
      background: ready ? gold : (isDark ? '#303132' : '#e5e7eb'),
      color: ready ? ON_GOLD : text3,
      fontSize: '14px', fontWeight: '800', cursor: ready ? 'pointer' : 'not-allowed',
    }),

    upNextLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase',
      color: text3, margin: '24px 0 8px',
    },
    upNextRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' },
    upNextCard: {
      padding: '11px 13px', borderRadius: '11px', background: card, border: `1px solid ${line}`,
    },
    upNextName: { fontSize: '13px', fontWeight: '700', color: text },
    upNextMeta: {
      fontSize: '11.5px', color: text3, marginTop: '2px',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    empty: { textAlign: 'center', padding: '48px', color: text3 },

    tabs: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '0 0 18px' },
    tab: (on) => ({
      fontSize: '12.5px', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer',
      padding: '8px 15px', borderRadius: '999px',
      border: `1px solid ${on ? gold : line}`,
      background: on ? gold : 'transparent',
      color: on ? ON_GOLD : text2,
    }),
    tabCount: { opacity: 0.75, marginLeft: '5px' },

    ratedCard: { background: card, border: `1px solid ${line}`, borderRadius: '16px', padding: '10px 20px 18px' },
    ratedRow: {
      display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) auto auto', gap: '12px', alignItems: 'center',
      width: 'calc(100% + 20px)', margin: '0 -10px', padding: '11px 10px', borderRadius: '10px',
      background: 'transparent', border: 'none', borderTop: `1px solid ${divider}`,
      textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
    },
    ratedName: { display: 'block', fontSize: '13.5px', fontWeight: '700', color: text },
    ratedMail: {
      display: 'block', fontSize: '11.5px', color: text3,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    },
    ratedScore: {
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12.5px', color: text2, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
    },
    chev: { color: text3, fontSize: '12px', width: '14px', textAlign: 'center' },

    drawer: {
      margin: '2px -10px 10px', padding: '12px 14px', borderRadius: '10px',
      background: inset, border: `1px solid ${line}`,
    },
    drawerLabel: {
      fontSize: '10.5px', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase',
      color: text3, margin: '0 0 8px',
    },
    bar2: {
      display: 'grid', gridTemplateColumns: '46px 1fr 26px', gap: '8px', alignItems: 'center',
      fontSize: '11.5px', color: text3, fontVariantNumeric: 'tabular-nums', padding: '2px 0',
    },
    // Both are spans inside a grid row, so they need to be told to behave
    // as blocks — width on an inline element is ignored, which left every
    // bar an empty track.
    track: { display: 'block', height: '6px', borderRadius: '4px', background: divider, overflow: 'hidden' },
    fill: (pct) => ({ display: 'block', height: '100%', width: `${pct}%`, background: gold, borderRadius: '4px' }),
    rentalRow: {
      display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr) auto', gap: '10px', alignItems: 'center',
      width: '100%', padding: '7px 0', borderTop: `1px solid ${divider}`,
      background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '12.5px', color: text2,
    },
    rentalWhen: { fontSize: '11.5px', color: text3, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
    rentalWhat: { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    rentalScore: { fontSize: '12px', fontWeight: '800', color: gold, whiteSpace: 'nowrap' },
    drawerNote: { fontSize: '11.5px', color: text3, margin: '8px 0 0' },
    emptyLink: {
      border: 'none', background: 'transparent', font: 'inherit', fontWeight: '700',
      color: ink, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px',
    },
  };

  const done = total - queue.length;

  return (
    <AdminLayout activePage="Client Ratings">
      <BackButton text="Back to Manage Bookings" onClick={() => navigate('/admin/manage-bookings')} />
      <div style={s.headRow}>
        <div>
          <h1 style={s.title}>Client Ratings</h1>
          <p style={s.subtitle}>How each renter was to deal with. Only your side ever sees this.</p>
        </div>
        {queue.length > 0 && (
          <span style={s.countPill}>
            <span style={s.countNum}>{queue.length}</span> still to rate
          </span>
        )}
      </div>

      {!loading && (
        <div style={s.tabs} role="tablist" aria-label="Rating views">
          <button
            type="button" role="tab" aria-selected={view === 'torate'}
            style={s.tab(view === 'torate')} onClick={() => setTab('torate')}
          >
            To rate <span style={s.tabCount}>{queue.length}</span>
          </button>
          <button
            type="button" role="tab" aria-selected={view === 'rated'}
            style={s.tab(view === 'rated')} onClick={() => setTab('rated')}
          >
            Rated <span style={s.tabCount}>{ratedClients.length}</span>
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonListCard isDark={isDark} count={2} />
      ) : view === 'rated' ? (
        ratedClients.length === 0 ? (
          <div style={s.empty}>
            <p>Nobody has been rated yet.</p>
          </div>
        ) : (
          <div style={s.ratedCard}>
            {ratedClients.map((c) => {
              const isOpen = openClient === c.id;
              const shown = c.rows.slice(0, RENTALS_SHOWN);
              return (
                <Fragment key={c.id}>
                  <button
                    type="button"
                    className="list-row-btn"
                    style={s.ratedRow}
                    aria-expanded={isOpen}
                    onClick={() => setOpenClient(isOpen ? null : c.id)}
                  >
                    <span style={s.avatar}>{(c.user?.name || '?').charAt(0).toUpperCase()}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={s.ratedName}>{c.user?.name || 'Unknown'}</span>
                      <span style={s.ratedMail}>{c.user?.email}</span>
                    </span>
                    <span style={s.ratedScore}>
                      <StarRating value={c.user?.avgRating || 0} size={12} readOnly />
                      {clientScoreLabel(c.user)}
                    </span>
                    <span style={s.chev}>{isOpen ? '▾' : '▸'}</span>
                  </button>

                  {isOpen && (
                    <div style={s.drawer}>
                      <p style={s.drawerLabel}>How the scores are spread</p>
                      {spreadFor(c.rows).map(({ n, hits }) => (
                        <div key={n} style={s.bar2}>
                          <span>{n} star{n === 1 ? '' : 's'}</span>
                          <span style={s.track}>
                            <span style={s.fill(c.rows.length ? (hits / c.rows.length) * 100 : 0)} />
                          </span>
                          <span>{hits}</span>
                        </div>
                      ))}

                      <p style={{ ...s.drawerLabel, margin: '14px 0 2px' }}>Rentals</p>
                      {shown.map((b) => (
                        <button
                          key={b._id}
                          type="button"
                          className="list-row-btn"
                          style={s.rentalRow}
                          onClick={() => setEditing(b)}
                        >
                          <span style={s.rentalWhen}>
                            {formatMoment(b.endDate, false, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span style={s.rentalWhat}>
                            {b.car?.brand} {b.car?.model}
                            {b.clientRating?.comment ? ` · ${b.clientRating.comment}` : ''}
                          </span>
                          <span style={s.rentalScore}>{b.clientRating?.rating} ★</span>
                        </button>
                      ))}
                      <p style={s.drawerNote}>
                        {c.rows.length > RENTALS_SHOWN
                          ? `Showing the ${RENTALS_SHOWN} most recent of ${c.rows.length}. `
                          : ''}
                        Open a rental to change what you gave it.
                      </p>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )
      ) : !current ? (
        <div style={s.empty}>
          <p><DoneGlyph size={16} /> Everyone is rated.</p>
          <button type="button" className="text-link-btn" style={s.emptyLink} onClick={() => setTab('rated')}>
            See the {ratedClients.length} client{ratedClients.length === 1 ? '' : 's'} you have rated
          </button>
        </div>
      ) : (
        <>
          <div style={s.progressRow}>
            <span>Client {done + 1} of {total}</span>
            <span>Skipped ones stay in the list</span>
          </div>
          <div
            style={s.bar}
            role="progressbar"
            aria-valuenow={total ? Math.round((done / total) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={s.barFill(total ? (done / total) * 100 : 0)} />
          </div>

          <div style={s.card}>
            <div style={s.left}>
              <div style={s.stage}>
                {current.car?.image
                  ? <img src={current.car.image} alt="" style={s.stageImg} />
                  : <span style={s.stageEmpty}>No photo</span>}
              </div>
              <dl style={s.facts}>
                {factsFor(current).map((f) => (
                  <div key={f.label} style={s.factRow}>
                    <dt style={s.factLabel}>{f.label}</dt>
                    <dd style={s.factValue(f.tone)}>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div style={s.right}>
              <div style={s.who}>
                <span style={s.avatar}>{(current.user?.name || '?').charAt(0).toUpperCase()}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={s.whoName}>{current.user?.name || 'Unknown'}</span>
                  <span style={s.whoMail}>{current.user?.email}</span>
                </span>
              </div>

              <h2 style={s.ask}>How was {(current.user?.name || 'this client').split(' ')[0]} as a renter?</h2>

              <div style={s.stars}>
                <StarPicker
                  value={rating}
                  onChange={setRating}
                  isDark={isDark}
                  label="How was this client as a renter?"
                  labels={STAR_WORDS}
                  size={30}
                  hideLabel
                />
              </div>
              <div style={s.starWord}>{STAR_WORDS[rating] || ''}</div>

              <label style={s.noteLabel} htmlFor="rate-note">Private note (optional)</label>
              <textarea
                id="rate-note"
                style={s.note}
                placeholder="Anything worth knowing next time they book."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p style={s.noteHint}>Staff only — the client is never sent this.</p>

              <div style={s.actions}>
                <button type="button" style={s.skipBtn} onClick={skip} disabled={saving}>
                  Skip for now
                </button>
                <button type="button" style={s.saveBtn(!!rating)} onClick={save} disabled={!rating || saving}>
                  {saving ? 'Saving...' : 'Save and next'}
                </button>
              </div>
            </div>
          </div>

          {upNext.length > 0 && (
            <>
              <div style={s.upNextLabel}>Still waiting · {upNext.length}</div>
              <div style={s.upNextRow}>
                {upNext.map((b) => (
                  <div key={b._id} style={s.upNextCard}>
                    <div style={s.upNextName}>{b.user?.name || 'Unknown'}</div>
                    <div style={s.upNextMeta}>
                      {b.car?.brand} {b.car?.model} · {formatMoment(b.startDate, false, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {editing && (
        <ClientRatingModal
          booking={editing}
          isDark={isDark}
          onClose={() => setEditing(null)}
          onSubmitted={async () => { setEditing(null); await fetchBookings(); }}
        />
      )}
    </AdminLayout>
  );
};

export default RateClients;
