import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

const ManageClients = () => {
  const { isDark } = useTheme();
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [clientsRes, bookingsRes] = await Promise.all([
        api.get('/users'),
        api.get('/bookings/all'),
      ]);
      setClients(clientsRes.data);
      setBookings(bookingsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (id, currentStatus) => {
    try {
      await api.put(`/users/${id}/verify`, { verified: !currentStatus });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlock = async (id, currentStatus) => {
    try {
      await api.put(`/users/${id}/block`, { blocked: !currentStatus });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const bookingsForClient = (clientId) =>
    bookings.filter((b) => b.user?._id === clientId);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const selectedClient = clients.find((c) => c._id === selectedClientId);

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    searchInput: { width: '100%', maxWidth: '320px', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', marginBottom: '16px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, verticalAlign: 'middle' },
    nameCell: { fontWeight: '600' },
    subCell: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    verified: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    unverified: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    active: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    blocked: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    viewBtn: { padding: '5px 12px', fontSize: '12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', background: 'none', color: isDark ? '#f1f5f9' : '#1a1a1a', cursor: 'pointer' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '85vh', overflow: 'auto', position: 'relative' },
    closeX: { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: isDark ? '#94a3b8' : '#6b7280', padding: '4px' },
    modalTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    modalSub: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '18px' },
    badgeRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
    profileGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' },
    profileItem: { background: isDark ? '#0f172a' : '#f9fafb', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    profileLabel: { display: 'block', fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '3px' },
    profileValue: { fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', fontWeight: '500' },
    idImage: { width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, marginBottom: '18px', background: isDark ? '#0f172a' : '#f9fafb' },
    sectionTitle: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '10px', marginTop: '20px' },
    actionRow: { display: 'flex', gap: '10px', marginBottom: '18px' },
    verifyBtn: (verified) => ({ flex: 1, padding: '9px', background: verified ? (isDark ? '#334155' : '#f3f4f6') : '#16a34a', color: verified ? (isDark ? '#f1f5f9' : '#374151') : '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }),
    blockBtn: (blocked) => ({ flex: 1, padding: '9px', background: blocked ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }),
    historyTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
    historyTh: { textAlign: 'left', padding: '8px 10px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    historyTd: { padding: '8px 10px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` },
    closeBtn: { marginTop: '18px', padding: '10px 24px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
    empty: { fontSize: '13px', color: isDark ? '#64748b' : '#9ca3af', padding: '12px 0' },
  };

  return (
    <AdminLayout activePage="Manage Clients">
      <h1 style={s.title}>Manage Clients</h1>
      <p style={s.subtitle}>View client profiles, verify IDs, and manage booking history.</p>

      <input
        style={s.searchInput}
        type="text"
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
      ) : (
        <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Client</th>
              <th style={s.th}>Phone</th>
              <th style={s.th}>Joined</th>
              <th style={s.th}>Bookings</th>
              <th style={s.th}>ID Status</th>
              <th style={s.th}>Account</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client._id}>
                <td style={s.td}>
                  <div style={s.nameCell}>{client.name}</div>
                  <div style={s.subCell}>{client.email}</div>
                </td>
                <td style={s.td}>{client.phone || '—'}</td>
                <td style={s.td}>{new Date(client.createdAt).toLocaleDateString()}</td>
                <td style={s.td}>{bookingsForClient(client._id).length}</td>
                <td style={s.td}>
                  <span style={client.idVerified ? s.verified : s.unverified}>
                    {client.idVerified ? 'Verified' : 'Unverified'}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={client.isBlocked ? s.blocked : s.active}>
                    {client.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td style={s.td}>
                  <button style={s.viewBtn} onClick={() => setSelectedClientId(client._id)}>
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {selectedClient && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <button style={s.closeX} onClick={() => setSelectedClientId(null)}>×</button>
            <h2 style={s.modalTitle}>{selectedClient.name}</h2>
            <p style={s.modalSub}>{selectedClient.email}</p>

            <div style={s.badgeRow}>
              <span style={selectedClient.idVerified ? s.verified : s.unverified}>
                {selectedClient.idVerified ? 'ID Verified' : 'ID Unverified'}
              </span>
              <span style={selectedClient.isBlocked ? s.blocked : s.active}>
                {selectedClient.isBlocked ? 'Blocked' : 'Active'}
              </span>
            </div>

            <div style={s.profileGrid}>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Phone</span>
                <span style={s.profileValue}>{selectedClient.phone || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Address</span>
                <span style={s.profileValue}>{selectedClient.address || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Driver's License #</span>
                <span style={s.profileValue}>{selectedClient.licenseNumber || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>License Expiry</span>
                <span style={s.profileValue}>
                  {selectedClient.licenseExpiry ? new Date(selectedClient.licenseExpiry).toLocaleDateString() : '—'}
                </span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Emergency Contact</span>
                <span style={s.profileValue}>{selectedClient.emergencyContactName || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Emergency Contact #</span>
                <span style={s.profileValue}>{selectedClient.emergencyContactNumber || '—'}</span>
              </div>
            </div>

            {selectedClient.validIdImage ? (
              <img src={selectedClient.validIdImage} alt="Valid ID" style={s.idImage} />
            ) : (
              <p style={s.empty}>No ID photo on file.</p>
            )}

            <div style={s.actionRow}>
              <button
                style={s.verifyBtn(selectedClient.idVerified)}
                onClick={() => handleVerify(selectedClient._id, selectedClient.idVerified)}
              >
                {selectedClient.idVerified ? 'Unverify ID' : 'Mark ID as Verified'}
              </button>
              <button
                style={s.blockBtn(selectedClient.isBlocked)}
                onClick={() => handleBlock(selectedClient._id, selectedClient.isBlocked)}
              >
                {selectedClient.isBlocked ? 'Unblock Client' : 'Block Client'}
              </button>
            </div>

            <h3 style={s.sectionTitle}>Booking History</h3>
            {bookingsForClient(selectedClient._id).length === 0 ? (
              <p style={s.empty}>No bookings yet.</p>
            ) : (
              <div className="table-scroll">
              <table style={s.historyTable}>
                <thead>
                  <tr>
                    <th style={s.historyTh}>Car</th>
                    <th style={s.historyTh}>Dates</th>
                    <th style={s.historyTh}>Status</th>
                    <th style={s.historyTh}>Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingsForClient(selectedClient._id).map((b) => (
                    <tr key={b._id}>
                      <td style={s.historyTd}>{b.car?.brand} {b.car?.model}</td>
                      <td style={s.historyTd}>
                        {new Date(b.startDate).toLocaleDateString()} - {new Date(b.endDate).toLocaleDateString()}
                      </td>
                      <td style={s.historyTd}>{b.status}</td>
                      <td style={s.historyTd}>{b.refundStatus === 'none' ? '—' : b.refundStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}

            <button style={s.closeBtn} onClick={() => setSelectedClientId(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageClients;