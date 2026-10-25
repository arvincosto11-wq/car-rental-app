import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import ConsignmentIncome from '../../components/ConsignmentIncome';
import ConsignmentDrawer from '../../components/ConsignmentDrawer';
import Skeleton from '../../components/Skeleton';
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

const peso = (n) => `₱${Math.round(n || 0).toLocaleString()}`;
const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

const ManageConsignments = () => {
  usePageTitle('Manage Consignments');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();

  const [applications, setApplications] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [ownerPercent, setOwnerPercent] = useState(DEFAULT_OWNER_PERCENT);

  const fetchData = async () => {
    try {
      // The register shows each vehicle's takings for THIS month, whatever
      // period the income panel above is set to — the panel answers "how are
      // we doing", a vehicle card answers "is this one working".
      const [apps, money] = await Promise.all([
        api.get('/consignments/all'),
        api.get('/consignments/income', { params: { from: startOfMonth() } }),
      ]);
      setApplications(apps.data || []);
      setIncome(money.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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

  const vehicles = income.flatMap((row) => row.vehicles.map((v) => ({ ...v, consignor: row.consignor })));
  const listedCount = vehicles.filter((v) => v.onPlatform).length;
  const offCount = vehicles.length - listedCount;

  const shown = filter === 'declined'
    ? []
    : vehicles.filter((v) => (filter === 'all' ? true : filter === 'listed' ? v.onPlatform : !v.onPlatform));

  // Grouped by owner, because that is who you ring about a vehicle.
  const owners = [];
  for (const v of shown) {
    let group = owners.find((g) => g.id === v.consignor.id);
    if (!group) {
      group = { ...v.consignor, vehicles: [] };
      owners.push(group);
    }
    group.vehicles.push(v);
  }

  const onDecided = async (message) => {
    setOpenId(null);
    await fetchData();
    refetchPendingCounts();
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
    pills: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
    pill: (on) => ({
      minHeight: '36px', padding: '0 14px', borderRadius: '999px',
      fontFamily: 'inherit', fontSize: '13px', fontWeight: on ? '700' : '500',
      cursor: 'pointer', border: `1px solid ${on ? gold : line}`,
      background: on ? gold : card, color: on ? ON_GOLD : text,
    }),
    pillCount: { opacity: 0.7, marginLeft: '2px' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', alignItems: 'start' },
    ownerCard: { borderRadius: '14px', background: card, border: `1px solid ${line}`, overflow: 'hidden' },
    ownerHead: {
      display: 'flex', gap: '12px', alignItems: 'center',
      padding: '14px 16px', borderBottom: `1px solid ${line}`,
    },
    ownerAvatar: {
      width: '36px', height: '36px', borderRadius: '999px',
      background: inset, border: `1px solid ${line}`,
      display: 'grid', placeItems: 'center', fontWeight: '750', color: ink,
    },
    ownerName: { fontWeight: '700', color: text },
    ownerMeta: { fontSize: '12px', color: text3 },

    vehicleRow: {
      display: 'flex', flexDirection: 'column', gap: '8px',
      padding: '14px 16px', borderTop: `1px solid ${line}`,
    },
    vehicleTop: { display: 'flex', gap: '12px', alignItems: 'center' },
    vehicleTile: {
      flex: 'none', width: '40px', height: '40px', borderRadius: '10px',
      background: inset, display: 'grid', placeItems: 'center', color: text2,
    },
    vehicleName: { fontWeight: '650', color: text },
    vehicleMeta: { fontSize: '12px', color: text3 },
    month: (earned) => ({
      display: 'flex', gap: '8px', alignItems: 'center',
      padding: '8px 10px', borderRadius: '8px', background: inset,
      fontSize: '13px', fontWeight: earned ? '650' : '500',
      color: earned ? text : text3,
    }),
    monthLabel: { color: text3, whiteSpace: 'nowrap' },

    empty: {
      padding: '28px', borderRadius: '14px', border: `1px dashed ${line}`,
      textAlign: 'center', color: text2, fontSize: '13.5px',
    },
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

  const filters = [
    ['all', 'All', vehicles.length],
    ['listed', 'Listed', listedCount],
    ['off', 'Off platform', offCount],
    ['declined', 'Declined', declined.length],
  ];

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

      <ConsignmentIncome />

      <div style={s.sectionHead}>
        <h2 style={s.sectionTitle}>Consigned vehicles</h2>
        <div style={s.pills}>
          {filters.map(([key, label, n]) => (
            <button key={key} type="button" style={s.pill(filter === key)} onClick={() => setFilter(key)}>
              {label} <span style={s.pillCount}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={s.grid}>
          {[0, 1].map((i) => (
            <div key={i} style={s.ownerCard}>
              <div style={{ padding: '16px' }}>
                <Skeleton height="36px" isDark={isDark} style={{ marginBottom: '12px' }} />
                <Skeleton height="64px" isDark={isDark} />
              </div>
            </div>
          ))}
        </div>
      ) : filter === 'declined' ? (
        declined.length === 0 ? (
          <div style={s.empty}>No declined applications. Anything you decline shows here with the reason you gave.</div>
        ) : (
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
        )
      ) : owners.length === 0 ? (
        <div style={s.empty}>
          {vehicles.length === 0
            ? 'No vehicles are consigned yet. They appear here once an application is approved.'
            : filter === 'listed'
              ? 'No consigned vehicle is on the platform right now.'
              : 'Every consigned vehicle is on the platform.'}
        </div>
      ) : (
        <div style={s.grid}>
          {owners.map((g) => (
            <div key={g.id} style={s.ownerCard}>
              <div style={s.ownerHead}>
                <span style={s.ownerAvatar}>{(g.name || '?').trim().charAt(0).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.ownerName}>{g.name}</div>
                  <div style={s.ownerMeta}>
                    {g.phone ? `${g.phone} · ` : ''}
                    {g.vehicles.length} vehicle{g.vehicles.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              {g.vehicles.map((v) => (
                <div key={v.id} style={s.vehicleRow}>
                  <div style={s.vehicleTop}>
                    <span style={s.vehicleTile}><VehicleIcon category={v.category} size={20} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.vehicleName}>{v.name}</div>
                      <div style={s.vehicleMeta}>
                        {v.plateNumber || 'No plate'} · {v.category || 'Vehicle'} · {peso(v.pricePerDay)} a day
                      </div>
                    </div>
                    {/* Off the platform is a state the owner asked for and we
                        agreed to, so it is neutral. Red is kept for things
                        that are wrong. */}
                    <span style={chip(v.onPlatform ? 'green' : 'neutral')}>
                      {v.onPlatform ? 'Listed' : 'Off platform'}
                    </span>
                  </div>
                  <div style={s.month(v.trips > 0)}>
                    <span style={s.monthLabel}>This month</span>
                    <span style={{ flex: 1 }} />
                    {v.trips > 0
                      ? `${v.trips} trip${v.trips === 1 ? '' : 's'} · ${peso(v.rental)} taken · ${peso(v.ownerEarned)} theirs`
                      : 'No trips'}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
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
