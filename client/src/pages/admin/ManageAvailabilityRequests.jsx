import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Skeleton from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import api from '../../api';
import { VehicleIcon, OkIcon, CalIcon, PowerIcon } from '../../components/adminConsignIcons';

// What consignors are asking for.
//
// Two different requests used to live here as two separate tables, one
// under the other, each with its own header row and its own empty state —
// so on an ordinary day the page was two empty tables stacked up. They are
// the same job to whoever is working through them: somebody has asked for
// something about their own vehicle, and it needs a yes or a no. So they
// are one list now, newest first, with a chip saying which kind it is.
//
// And on a day with nothing waiting — which is most days — the page says so
// plainly and then shows where every consigned vehicle currently stands,
// because that is the only other thing this screen can usefully tell you.

const DATE = { month: 'short', day: 'numeric' };
const asked = (d) => new Date(d).toLocaleDateString(undefined, DATE);

const ManageAvailabilityRequests = () => {
  usePageTitle('Availability Requests');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();

  const [platform, setPlatform] = useState([]);
  const [dates, setDates] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decliningId, setDecliningId] = useState(null);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState({});

  const fetchData = async () => {
    try {
      const [p, d, income] = await Promise.all([
        api.get('/cars/availability-requests'),
        api.get('/cars/blocked-date-requests'),
        api.get('/consignments/income'),
      ]);
      setPlatform(p.data || []);
      setDates(d.data || []);
      setVehicles((income.data || []).flatMap((row) => row.vehicles.map((v) => ({ ...v, owner: row.consignor.name }))));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // One list, both kinds, newest first.
  const requests = [
    ...platform.map((car) => ({
      key: `p:${car._id}`,
      kind: 'platform',
      typeLabel: 'On / off platform',
      title: car.availabilityRequest?.type === 'available'
        ? `Bring the ${car.brand} ${car.model} back on the platform`
        : `Take the ${car.brand} ${car.model} off the platform`,
      owner: car.owner?.name || 'Unknown',
      at: car.availabilityRequest?.requestedAt,
      reason: car.availabilityRequest?.reason || '',
      send: (decision, adminNotes) => api.put(`/cars/${car._id}/availability-request`, { decision, adminNotes }),
    })),
    ...dates.map((r) => ({
      key: `d:${r._id}`,
      kind: 'dates',
      typeLabel: 'Blocked dates',
      title: `Block ${asked(r.startDate)} – ${asked(r.endDate)} on the ${r.brand} ${r.model}`,
      owner: r.owner?.name || 'Unknown',
      at: r.requestedAt,
      reason: [r.reason, r.note].filter(Boolean).join(' · '),
      send: (decision, adminNotes) => api.put(`/cars/${r.carId}/blocked-dates/${r._id}/decision`, { decision, adminNotes }),
    })),
  ].sort((x, y) => new Date(y.at || 0) - new Date(x.at || 0));

  const waiting = requests.filter((r) => !done[r.key]);

  const act = async (req, decision, note) => {
    setWorking(true);
    try {
      await req.send(decision, note || '');
      // The chip stands in for the row until the next load takes it away —
      // so the action is seen to land, without the page turning into a log
      // of everything ever decided.
      setDone((d) => ({ ...d, [req.key]: decision }));
      setDecliningId(null);
      setReason('');
      refetchPendingCounts();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send that decision.');
    } finally {
      setWorking(false);
    }
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';
  const red = isDark ? '#f28b82' : '#b91c1c';
  const redSoft = isDark ? 'rgba(242,139,130,0.13)' : '#fdecec';
  const blue = isDark ? '#8ab4f8' : '#1d4ed8';
  const blueSoft = isDark ? 'rgba(138,180,248,0.13)' : '#eaf0fd';

  const chip = (bg, fg, border) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
    padding: '3px 10px', borderRadius: '999px',
    fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
    background: bg, color: fg, border: border ? `1px solid ${border}` : 'none',
  });

  const sm = {
    minHeight: '40px', padding: '0 16px', borderRadius: '9px',
    fontFamily: 'inherit', fontSize: '14px', fontWeight: '650', cursor: 'pointer',
  };

  const s = {
    title: { margin: 0, fontSize: '24px', fontWeight: '800', color: text },
    subtitle: { color: text2, marginTop: '4px', marginBottom: '20px', fontSize: '14px', textWrap: 'pretty' },

    calm: {
      padding: '40px 32px', borderRadius: '16px', background: card, border: `1px solid ${line}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center',
    },
    calmMark: {
      width: '64px', height: '64px', borderRadius: '999px',
      background: greenSoft, color: green, display: 'grid', placeItems: 'center',
    },
    calmTitle: { fontSize: '20px', fontWeight: '800', color: text },
    calmLead: { maxWidth: '520px', color: text2, textWrap: 'pretty', margin: 0 },
    standing: {
      width: '100%', maxWidth: '720px', marginTop: '16px', paddingTop: '20px',
      borderTop: `1px solid ${line}`, display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left',
    },
    eyebrow: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: text3 },
    standingGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' },
    standingRow: {
      display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px',
      borderRadius: '10px', background: inset, border: `1px solid ${line}`,
    },
    standingName: { fontWeight: '650', fontSize: '13px', color: text },
    standingOwner: { fontSize: '12px', color: text3 },

    waitingEyebrow: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: ink, marginBottom: '12px' },
    list: { display: 'flex', flexDirection: 'column', gap: '12px' },
    req: {
      padding: '18px 20px', borderRadius: '14px', background: card, border: `1px solid ${line}`,
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    reqTop: { display: 'flex', gap: '16px', alignItems: 'flex-start' },
    reqTile: {
      flex: 'none', width: '44px', height: '44px', borderRadius: '12px',
      background: blueSoft, color: blue, display: 'grid', placeItems: 'center',
    },
    reqMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
    reqTitle: { fontSize: '16px', fontWeight: '750', color: text, textWrap: 'pretty' },
    reqMeta: { fontSize: '13px', color: text3 },
    reqReason: {
      marginTop: '6px', padding: '10px 12px', borderRadius: '10px',
      background: inset, fontSize: '14px', color: text, textWrap: 'pretty',
    },
    actions: { display: 'flex', gap: '8px' },
    btnGold: { ...sm, border: `1px solid ${gold}`, background: gold, color: ON_GOLD },
    btnLine: { ...sm, border: `1px solid ${line}`, background: card, color: text },
    btnRed: { ...sm, border: `1px solid ${red}`, background: red, color: isDark ? '#1a1a1a' : '#fff' },

    declineBox: { display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '60px' },
    label: { fontSize: '13px', fontWeight: '650', color: text },
    textarea: {
      width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px',
      border: `1px solid ${line}`, background: card, color: text,
      fontFamily: 'inherit', fontSize: '14px', resize: 'vertical',
    },
  };

  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'They';

  return (
    <AdminLayout activePage="Availability Requests">
      <h1 style={s.title}>Availability Requests</h1>
      <p style={s.subtitle}>
        Consignors ask here to take a vehicle off the platform, bring it back, or block dates on their
        own vehicle.
      </p>

      {loading ? (
        <div style={s.list}>
          {[0, 1].map((i) => <Skeleton key={i} height="110px" isDark={isDark} style={{ borderRadius: '14px' }} />)}
        </div>
      ) : waiting.length === 0 ? (
        <div style={s.calm}>
          <span style={s.calmMark}><OkIcon size={32} /></span>
          <div style={s.calmTitle}>Nothing waiting for you</div>
          <p style={s.calmLead}>
            New requests show up here to approve or decline. If you decline one, the owner sees the
            reason you give.
          </p>

          {vehicles.length > 0 && (
            <div style={s.standing}>
              <div style={s.eyebrow}>CONSIGNED VEHICLES RIGHT NOW</div>
              <div style={s.standingGrid}>
                {vehicles.map((v) => (
                  <div key={v.id} style={s.standingRow}>
                    <span style={{ color: text2, display: 'grid', placeItems: 'center' }}>
                      <VehicleIcon category={v.category} size={18} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.standingName}>{v.name}</div>
                      <div style={s.standingOwner}>{v.owner}</div>
                    </div>
                    <span style={v.onPlatform
                      ? chip(greenSoft, green)
                      : chip(inset, text3, line)}
                    >
                      {v.onPlatform ? 'On platform' : 'Off platform'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={s.waitingEyebrow}>
            {waiting.length} WAITING FOR YOU
          </div>
          <div style={s.list}>
            {requests.map((r) => {
              const decided = done[r.key];
              return (
                <article key={r.key} style={s.req}>
                  <div style={s.reqTop}>
                    <span style={s.reqTile}>
                      {r.kind === 'dates' ? <CalIcon size={22} /> : <PowerIcon size={22} />}
                    </span>
                    <div style={s.reqMain}>
                      <span style={chip(blueSoft, blue)}>{r.typeLabel}</span>
                      <div style={s.reqTitle}>{r.title}</div>
                      <div style={s.reqMeta}>{r.owner}{r.at ? ` · asked ${asked(r.at)}` : ''}</div>
                      {r.reason && <div style={s.reqReason}>“{r.reason}”</div>}
                    </div>

                    {decided ? (
                      <span style={decided === 'approved' ? chip(greenSoft, green) : chip(redSoft, red)}>
                        {decided === 'approved' ? 'Approved' : 'Declined · reason sent'}
                      </span>
                    ) : decliningId === r.key ? null : (
                      <div style={s.actions}>
                        <button type="button" style={s.btnGold} disabled={working} onClick={() => act(r, 'approved')}>
                          Approve
                        </button>
                        <button type="button" style={s.btnLine} disabled={working} onClick={() => { setDecliningId(r.key); setReason(''); }}>
                          Decline
                        </button>
                      </div>
                    )}
                  </div>

                  {decliningId === r.key && !decided && (
                    <div style={s.declineBox}>
                      <label style={s.label} htmlFor={`reason-${r.key}`}>
                        Reason for declining · {firstName(r.owner)} will see this
                      </label>
                      <textarea
                        id={`reason-${r.key}`}
                        rows={2}
                        style={s.textarea}
                        value={reason}
                        disabled={working}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <div style={s.actions}>
                        <button
                          type="button"
                          style={s.btnRed}
                          disabled={working || !reason.trim()}
                          onClick={() => act(r, 'declined', reason.trim())}
                        >
                          Send decline
                        </button>
                        <button type="button" style={s.btnLine} disabled={working} onClick={() => setDecliningId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default ManageAvailabilityRequests;
