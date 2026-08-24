import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api';

const ConsignorDashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchConsignments();
  }, [user]);

  const fetchConsignments = async () => {
    try {
      const res = await api.get('/consignments/my');
      setConsignments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'approved') return s.badgeApproved;
    if (status === 'declined') return s.badgeDeclined;
    return s.badgePending;
  };

  const approvedCount = consignments.filter((c) => c.status === 'approved').length;
  const pendingCount = consignments.filter((c) => c.status === 'pending').length;

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280' },
    addBtn: { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    statLabel: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '26px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    empty: { textAlign: 'center', padding: '48px 16px', color: isDark ? '#94a3b8' : '#6b7280' },
    card: { display: 'flex', gap: '16px', background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '16px', marginBottom: '12px' },
    thumb: { width: '110px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
    info: { flex: 1 },
    carName: { fontSize: '15px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '2px' },
    carSub: { fontSize: '12px', color: isDark ? '#94a3b8' : '#9ca3af', marginBottom: '8px' },
    badgeRow: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' },
    badgePending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    badgeApproved: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    badgeDeclined: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    price: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' },
    notesBox: { marginTop: '8px', fontSize: '12px', color: isDark ? '#fca5a5' : '#991b1b', background: isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2', padding: '8px 10px', borderRadius: '6px' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.headerRow}>
          <div>
            <h1 style={s.title}>My Vehicles</h1>
            <p style={s.subtitle}>Track the status of your consignment applications.</p>
          </div>
          <Link to="/consignor/add-vehicle" style={s.addBtn}>+ Add Another Vehicle</Link>
        </div>

        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Listed & Approved</div>
            <div style={s.statNum}>{approvedCount}</div>
          </div>
          <div style={s.statCard}>
            <div style={s.statLabel}>Pending Review</div>
            <div style={s.statNum}>{pendingCount}</div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
        ) : consignments.length === 0 ? (
          <div style={s.empty}>
            <p>You haven't submitted any vehicles yet.</p>
            <Link to="/consignor/add-vehicle" style={s.addBtn}>Submit Your First Vehicle</Link>
          </div>
        ) : (
          consignments.map((c) => (
            <div key={c._id} style={s.card}>
              <div style={s.thumb}>
                {c.vehiclePhotos?.[0]?.url && <img src={c.vehiclePhotos[0].url} alt="" style={s.thumbImg} />}
              </div>
              <div style={s.info}>
                <div style={s.badgeRow}>
                  <span style={getStatusStyle(c.status)}>{c.status}</span>
                </div>
                <div style={s.carName}>{c.brand} {c.model} ({c.year})</div>
                <div style={s.carSub}>{c.plateNumber} · {c.category} · {c.transmission} · {c.location}</div>
                <div style={s.price}>Suggested price: ${c.suggestedPricePerDay}/day</div>
                {c.status === 'declined' && c.adminNotes && (
                  <div style={s.notesBox}>Reason: {c.adminNotes}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConsignorDashboard;
