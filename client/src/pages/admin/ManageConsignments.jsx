import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ConsignmentIncome from '../../components/ConsignmentIncome';
import ConsignmentDrawer from '../../components/ConsignmentDrawer';
import PayoutSummary from '../../components/PayoutSummary';
import PayoutConsole from '../../components/PayoutConsole';
import PayoutHistory from '../../components/PayoutHistory';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD, goldInk } from '../../theme';
import { DEFAULT_OWNER_PERCENT } from '../../utils/revenueShare';
import api from '../../api';
import { VehicleIcon, TickIcon, ArrowIcon } from '../../components/adminConsignIcons';

// The register of vehicles owners have placed with us.
//
// This was a table of applications waiting to be approved, which is no
// longer what the page is for. Applications are made at the counter now,
// after the owner brings the vehicle in to be looked at, so one waiting for
// a decision is the exception rather than the queue. What the page is
// actually asked, most days, is: whose vehicles are these, are they on the
// platform, and what have they earned.
//
// So the rare thing gets a band at the top that is impossible to miss, and
// the common thing gets the body of the page.
//
// The body is organised by PERSON, not by vehicle, because the job the
// page exists for is paying somebody. You pay a consignor, not a Honda
// City. It used to carry a register of vehicle cards grouped by owner as
// well as a list of owners above it, which meant two sections quoting
// different figures about the same month — so the register is gone and
// each owner's vehicles live inside their own row.
//
// The page owns the data rather than each panel fetching its own. Three
// sections read the same money from two routes — the summary, the payout
// console and the history — and a payment moves all of them at once. When
// each fetched for itself they could be refreshed one without the other,
// which showed an owner as owed and settled at the same moment.

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;

// The period the earnings figures are read over. Owed and coming ignore
// it — see PayoutSummary — so only this one read is scoped.
const cutoffFor = (range) => {
  const now = new Date();
  if (range === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
  if (range === 'year') return { from: new Date(now.getFullYear(), 0, 1).toISOString() };
  return {};
};

const ManageConsignments = () => {
  usePageTitle('Manage Consignments');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();

  const [applications, setApplications] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moneyLoading, setMoneyLoading] = useState(true);
  const [moneyFailed, setMoneyFailed] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [ownerPercent, setOwnerPercent] = useState(DEFAULT_OWNER_PERCENT);
  const [range, setRange] = useState('month');
  // Bumped whenever money moves, so the income read below runs again
  // alongside the applications and payouts.
  const [moneyKey, setMoneyKey] = useState(0);

  const fetchData = async () => {
    try {
      const [apps, paid] = await Promise.all([
        api.get('/consignments/all'),
        api.get('/payouts'),
      ]);
      setApplications(apps.data || []);
      setPayouts(paid.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      setMoneyLoading(true);
      setMoneyFailed(false);
      try {
        const res = await api.get('/consignments/income', { params: cutoffFor(range) });
        if (live) setIncome(res.data || []);
      } catch {
        if (live) setMoneyFailed(true);
      } finally {
        if (live) setMoneyLoading(false);
      }
    };
    load();
    return () => { live = false; };
  }, [range, moneyKey]);

  useEffect(() => {
    let live = true;
    api.get('/settings')
      .then((res) => {
        if (live && Number.isFinite(res.data?.revenueShare?.ownerPercent)) {
          setOwnerPercent(res.data.revenueShare.ownerPercent);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const pending = applications.filter((a) => a.status === 'pending');
  const declined = applications.filter((a) => a.status === 'declined');
  const open = pending.find((a) => a._id === openId) || null;

  const onDecided = async (message) => {
    setOpenId(null);
    await fetchData();
    refetchPendingCounts();
    toast.success(message);
  };

  // A payment changes the history, the summary and every owed figure.
  const onMoneyMoved = async (message) => {
    await fetchData();
    setMoneyKey((n) => n + 1);
    toast.success(message);
  };

  const card = isDark ? '#242526' : '#ffffff';
  const inset = isDark ? '#1e1f20' : '#f8f9fa';
  const line = isDark ? '#3a3b3c' : '#e5e7eb';
  const text = isDark ? '#e4e6eb' : '#1a1a1a';
  const text2 = isDark ? '#b0b3b8' : '#4b5563';
  const text3 = isDark ? '#8a8d91' : '#6b7280';
  const gold = isDark ? GOLD_DARK : GOLD;
  const ink = goldInk(isDark);
  const goldSoft = isDark ? 'rgba(232,161,0,0.12)' : '#fbf3e2';
  const green = isDark ? '#6fcf8f' : '#15803d';
  const greenSoft = isDark ? 'rgba(111,207,143,0.12)' : '#eaf6ee';

  const chip = (tone) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '3px 10px', borderRadius: '999px',
    fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap',
    background: tone === 'green' ? greenSoft : inset,
    color: tone === 'green' ? green : text3,
    border: tone === 'green' ? 'none' : `1px solid ${line}`,
  });

  const s = {
    head: { display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '20px' },
    title: { margin: 0, fontSize: '24px', fontWeight: '800', color: text },
    subtitle: { color: text2, marginTop: '4px', fontSize: '14px' },

    band: {
      display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px',
      padding: '16px 18px', borderRadius: '14px',
      border: `1.5px solid ${gold}`, background: goldSoft,
    },
    bandTile: {
      flex: 'none', width: '52px', height: '52px', borderRadius: '12px',
      background: card, border: `1px solid ${line}`,
      display: 'grid', placeItems: 'center', color: ink,
    },
    bandEyebrow: { fontSize: '12px', fontWeight: '700', letterSpacing: '0.06em', color: ink },
    bandTitle: { fontSize: '16px', fontWeight: '750', color: text },
    bandMeta: { fontSize: '13px', color: text2 },
    bandBtn: {
      minHeight: '44px', padding: '0 20px', borderRadius: '10px',
      background: gold, color: ON_GOLD, fontWeight: '700',
      display: 'flex', alignItems: 'center', gap: '8px',
      border: 0, fontFamily: 'inherit', fontSize: '14px', cursor: 'pointer',
    },

    sectionHead: { display: 'flex', gap: '16px', alignItems: 'center', margin: '24px 0 16px' },
    sectionTitle: { margin: 0, flex: 1, fontSize: '18px', fontWeight: '750', color: text },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', alignItems: 'start' },
    declinedCard: {
      borderRadius: '14px', background: card, border: `1px solid ${line}`,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '6px',
    },
    declinedName: { fontWeight: '700', color: text },
    declinedMeta: { fontSize: '12px', color: text3 },
    declinedReason: {
      marginTop: '4px', padding: '10px 12px', borderRadius: '10px',
      background: inset, fontSize: '13.5px', color: text2, textWrap: 'pretty',
    },
  };

  return (
    <AdminLayout activePage="Manage Consignments">
      <div style={s.head}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={s.title}>Manage Consignments</h1>
          <p style={s.subtitle}>
            Vehicles owners have placed with us, what they earn, and any application waiting for a decision.
          </p>
        </div>
        {!loading && pending.length === 0 && (
          <span style={chip('green')}><TickIcon size={14} />Nothing waiting for a decision</span>
        )}
      </div>

      {/* An application is rare now, so when one exists it gets the top of
          the page rather than a row in a list somebody has to notice. */}
      {pending.map((a) => (
        <div key={a._id} style={s.band}>
          <span style={s.bandTile}><VehicleIcon category={a.category} size={26} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.bandEyebrow}>
              {pending.length === 1
                ? '1 APPLICATION WAITING FOR A DECISION'
                : `${pending.length} APPLICATIONS WAITING FOR A DECISION`}
            </div>
            <div style={s.bandTitle}>{a.brand} {a.model} · {a.year} from {a.owner?.name || 'Unknown'}</div>
            <div style={s.bandMeta}>
              {a.suggestedPricePerDay ? `Owner suggests ${peso(a.suggestedPricePerDay)} a day` : 'No rate suggested'}
              {' · applied '}
              {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <button type="button" style={s.bandBtn} onClick={() => setOpenId(a._id)}>
            Review and price<ArrowIcon size={16} />
          </button>
        </div>
      ))}

      <PayoutSummary rows={income} />

      <PayoutConsole rows={income} onPaid={onMoneyMoved} />

      <PayoutHistory payouts={payouts} onChanged={onMoneyMoved} />

      <ConsignmentIncome
        rows={income}
        range={range}
        onRange={setRange}
        loading={moneyLoading}
        failed={moneyFailed}
      />

      {/* Kept because a declined application is the one thing on this page
          with no other home: the vehicle was never listed, so it appears
          in no owner's row. */}
      {declined.length > 0 && (
        <>
          <div style={s.sectionHead}>
            <h2 style={s.sectionTitle}>Declined applications</h2>
          </div>
          <div style={s.grid}>
            {declined.map((a) => (
              <div key={a._id} style={s.declinedCard}>
                <div style={s.declinedName}>{a.brand} {a.model} · {a.year}</div>
                <div style={s.declinedMeta}>
                  {a.owner?.name || 'Unknown'} · applied{' '}
                  {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div style={s.declinedReason}>
                  {a.adminNotes ? `“${a.adminNotes}”` : 'No reason was recorded.'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {open && (
        <ConsignmentDrawer
          application={open}
          ownerPercent={ownerPercent}
          onClose={() => setOpenId(null)}
          onDecided={onDecided}
        />
      )}
    </AdminLayout>
  );
};

export default ManageConsignments;
