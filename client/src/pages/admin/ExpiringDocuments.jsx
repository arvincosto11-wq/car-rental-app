import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonTableRows } from '../../components/Skeleton';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';

const DAY_MS = 24 * 60 * 60 * 1000;

// Days until (positive) or since (negative) the given expiry date, floored
// to whole days so "expires today" reads as 0, not a fraction.
const daysUntil = (dateStr) => Math.floor((new Date(dateStr) - new Date()) / DAY_MS);

const ExpiringDocuments = () => {
  usePageTitle('Expiring Documents');
  const { isDark } = useTheme();
  const [data, setData] = useState({ validIds: [], licenses: [], registrations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/admin/expiring-documents');
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '24px' },
    sectionTitle: { fontSize: '16px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginTop: '28px', marginBottom: '4px' },
    sectionSubtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '12px' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#242526' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`, verticalAlign: 'middle' },
    name: { fontWeight: '600' },
    meta: { fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280' },
    empty: { fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af', padding: '24px 0', textAlign: 'center' },
    pillExpired: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', whiteSpace: 'nowrap', border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    pillSoon: {
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e',
      fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600', whiteSpace: 'nowrap', border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    summaryRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' },
    summaryCard: { flex: '1 1 160px', padding: '14px 16px', borderRadius: '12px', background: isDark ? '#242526' : '#fff', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    summaryCount: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    summaryLabel: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', marginTop: '2px' },
  };

  const StatusPill = ({ expiry }) => {
    const d = daysUntil(expiry);
    return d < 0
      ? <span style={s.pillExpired}>Expired {Math.abs(d)}d ago</span>
      : <span style={s.pillSoon}>{d === 0 ? 'Expires today' : `Expires in ${d}d`}</span>;
  };

  const totalCount = data.validIds.length + data.licenses.length + data.registrations.length;

  return (
    <AdminLayout activePage="Expiring Documents">
      <h1 style={s.title}>Expiring Documents</h1>
      <p style={s.subtitle}>Valid IDs, driver's licenses, and vehicle registrations that are expired or expiring within 30 days.</p>

      {!loading && (
        <div style={s.summaryRow}>
          <div style={s.summaryCard}>
            <div style={s.summaryCount}>{data.validIds.length}</div>
            <div style={s.summaryLabel}>Valid IDs</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryCount}>{data.licenses.length}</div>
            <div style={s.summaryLabel}>Driver's Licenses</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryCount}>{data.registrations.length}</div>
            <div style={s.summaryLabel}>Vehicle Registrations</div>
          </div>
        </div>
      )}

      <h2 style={s.sectionTitle}>Valid IDs</h2>
      <p style={s.sectionSubtitle}>Users whose on-file valid ID is expired or expiring soon.</p>
      {loading ? (
        <div className="table-scroll">
          <table style={s.table}>
            <thead><tr><th style={s.th}>User</th><th style={s.th}>Role</th><th style={s.th}>Expiry</th><th style={s.th}>Status</th></tr></thead>
            <tbody><SkeletonTableRows isDark={isDark} columns={4} /></tbody>
          </table>
        </div>
      ) : data.validIds.length === 0 ? (
        <div style={s.table}><p style={s.empty}>Nothing expiring here.</p></div>
      ) : (
        <div className="table-scroll">
          <table style={s.table}>
            <thead><tr><th style={s.th}>User</th><th style={s.th}>Role</th><th style={s.th}>Expiry</th><th style={s.th}>Status</th></tr></thead>
            <tbody>
              {data.validIds.map((u) => (
                <tr key={u.userId}>
                  <td style={s.td}>
                    <div style={s.name}>{u.name}</div>
                    <div style={s.meta}>{u.email}</div>
                  </td>
                  <td style={s.td}>{u.role === 'consignor' ? 'Consignor' : 'Client'}</td>
                  <td style={s.td}>{new Date(u.expiry).toLocaleDateString()}</td>
                  <td style={s.td}><StatusPill expiry={u.expiry} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={s.sectionTitle}>Driver's Licenses</h2>
      <p style={s.sectionSubtitle}>Clients whose on-file driver's license is expired or expiring soon.</p>
      {loading ? (
        <div className="table-scroll">
          <table style={s.table}>
            <thead><tr><th style={s.th}>User</th><th style={s.th}>Expiry</th><th style={s.th}>Status</th></tr></thead>
            <tbody><SkeletonTableRows isDark={isDark} columns={3} /></tbody>
          </table>
        </div>
      ) : data.licenses.length === 0 ? (
        <div style={s.table}><p style={s.empty}>Nothing expiring here.</p></div>
      ) : (
        <div className="table-scroll">
          <table style={s.table}>
            <thead><tr><th style={s.th}>User</th><th style={s.th}>Expiry</th><th style={s.th}>Status</th></tr></thead>
            <tbody>
              {data.licenses.map((u) => (
                <tr key={u.userId}>
                  <td style={s.td}>
                    <div style={s.name}>{u.name}</div>
                    <div style={s.meta}>{u.email}</div>
                  </td>
                  <td style={s.td}>{new Date(u.expiry).toLocaleDateString()}</td>
                  <td style={s.td}><StatusPill expiry={u.expiry} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={s.sectionTitle}>Vehicle Registrations</h2>
      <p style={s.sectionSubtitle}>Vehicles whose OR/CR registration is expired or expiring soon.</p>
      {loading ? (
        <div className="table-scroll">
          <table style={s.table}>
            <thead><tr><th style={s.th}>Vehicle</th><th style={s.th}>Owner</th><th style={s.th}>Expiry</th><th style={s.th}>Status</th></tr></thead>
            <tbody><SkeletonTableRows isDark={isDark} columns={4} /></tbody>
          </table>
        </div>
      ) : data.registrations.length === 0 ? (
        <div style={s.table}><p style={s.empty}>Nothing expiring here.</p></div>
      ) : (
        <div className="table-scroll">
          <table style={s.table}>
            <thead><tr><th style={s.th}>Vehicle</th><th style={s.th}>Owner</th><th style={s.th}>Expiry</th><th style={s.th}>Status</th></tr></thead>
            <tbody>
              {data.registrations.map((c) => (
                <tr key={c.carId}>
                  <td style={s.td}>
                    <div style={s.name}>{c.brand} {c.model}</div>
                    <div style={s.meta}>{c.plateNumber || 'No plate on file'}</div>
                  </td>
                  <td style={s.td}>{c.ownerName || '—'}</td>
                  <td style={s.td}>{new Date(c.expiry).toLocaleDateString()}</td>
                  <td style={s.td}><StatusPill expiry={c.expiry} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalCount === 0 && (
        <p style={{ ...s.sectionSubtitle, marginTop: '20px' }}>Nothing is expired or expiring in the next 30 days. 🎉</p>
      )}
    </AdminLayout>
  );
};

export default ExpiringDocuments;
