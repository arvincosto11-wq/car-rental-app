import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonTableRows } from '../../components/Skeleton';
import Pagination from '../../components/Pagination';
import { paginate } from '../../utils/paginate';
import useModalA11y from '../../hooks/useModalA11y';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import { GOLD, GOLD_DARK } from '../../theme';
import api from '../../api';

const PAGE_SIZE = 10;

const ManageClients = () => {
  usePageTitle('Manage Clients');
  const { isDark } = useTheme();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [page, setPage] = useState(1);
  const [rejectPendingIdTarget, setRejectPendingIdTarget] = useState(null);
  const [rejectPendingIdReason, setRejectPendingIdReason] = useState('');
  const [rejectingPendingId, setRejectingPendingId] = useState(false);

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
      refetchPendingCounts();
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

  const handleApprovePendingId = async (id) => {
    try {
      await api.put(`/users/${id}/pending-id/approve`);
      fetchData();
      refetchPendingCounts();
    } catch (err) {
      console.error(err);
    }
  };

  const openRejectPendingId = (id) => {
    setRejectPendingIdTarget(id);
    setRejectPendingIdReason('');
  };

  const confirmRejectPendingId = async () => {
    setRejectingPendingId(true);
    try {
      await api.put(`/users/${rejectPendingIdTarget}/pending-id/reject`, { reason: rejectPendingIdReason });
      fetchData();
      refetchPendingCounts();
      setRejectPendingIdTarget(null);
    } catch (err) {
      console.error(err);
    } finally {
      setRejectingPendingId(false);
    }
  };

  const bookingsForClient = (clientId) =>
    bookings.filter((b) => b.user?._id === clientId);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClients = paginate(filtered, page, PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const selectedClient = clients.find((c) => c._id === selectedClientId);
  const clientModalRef = useModalA11y(() => setSelectedClientId(null), !!selectedClient);
  const rejectPendingIdModalRef = useModalA11y(() => setRejectPendingIdTarget(null), !!rejectPendingIdTarget);

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
    searchInput: { width: '100%', maxWidth: '320px', padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', marginBottom: '16px', background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#242526' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`, verticalAlign: 'middle' },
    nameCell: { fontWeight: '600' },
    subCell: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    clientCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    clientAvatar: {
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: isDark ? '#3a3b3c' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD,
    },
    verified: {
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', color: isDark ? '#86efac' : '#065f46',
      fontSize: '11px', padding: '2px 10px', borderRadius: '20px', border: isDark ? '1px solid rgba(22,163,74,0.35)' : 'none',
    },
    unverified: {
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e',
      fontSize: '11px', padding: '2px 10px', borderRadius: '20px', border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    active: {
      background: isDark ? 'rgba(22,163,74,0.15)' : '#d1fae5', color: isDark ? '#86efac' : '#065f46',
      fontSize: '11px', padding: '2px 10px', borderRadius: '20px', border: isDark ? '1px solid rgba(22,163,74,0.35)' : 'none',
    },
    blocked: {
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      fontSize: '11px', padding: '2px 10px', borderRadius: '20px', border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    viewBtn: { padding: '5px 12px', fontSize: '12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '6px', background: 'none', color: isDark ? '#e4e6eb' : '#1a1a1a', cursor: 'pointer' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '85vh', overflow: 'auto', position: 'relative' },
    closeX: { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: isDark ? '#b0b3b8' : '#6b7280', padding: '4px' },
    modalTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    modalSub: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '18px' },
    badgeRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
    profileGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' },
    profileItem: { background: isDark ? '#18191a' : '#f9fafb', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    profileLabel: { display: 'block', fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '3px' },
    profileValue: { fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', fontWeight: '500' },
    idImage: { width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, marginBottom: '18px', background: isDark ? '#18191a' : '#f9fafb' },
    sectionTitle: { fontSize: '14px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '10px', marginTop: '20px' },
    actionRow: { display: 'flex', gap: '10px', marginBottom: '18px' },
    verifyBtn: (verified) => ({ flex: 1, padding: '9px', background: verified ? (isDark ? '#3a3b3c' : '#f3f4f6') : '#16a34a', color: verified ? (isDark ? '#e4e6eb' : '#374151') : '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }),
    blockBtn: (blocked) => ({ flex: 1, padding: '9px', background: blocked ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }),
    historyTable: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
    historyTh: { textAlign: 'left', padding: '8px 10px', color: isDark ? '#b0b3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    historyTd: { padding: '8px 10px', color: isDark ? '#e4e6eb' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}` },
    closeBtn: { marginTop: '18px', padding: '10px 24px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', width: '100%' },
    empty: { fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af', padding: '12px 0' },
    pendingTag: {
      background: isDark ? 'rgba(217,119,6,0.15)' : '#fef3c7', color: isDark ? '#fbbf24' : '#92400e',
      fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600', border: isDark ? '1px solid rgba(217,119,6,0.35)' : 'none',
    },
    pendingBox: { background: isDark ? 'rgba(217,119,6,0.12)' : '#fffbeb', border: `1px solid ${isDark ? 'rgba(217,119,6,0.35)' : '#fde68a'}`, borderRadius: '10px', padding: '14px', marginBottom: '18px' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginTop: '10px', marginBottom: '4px', color: isDark ? '#e4e6eb' : '#1a1a1a', background: isDark ? '#18191a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px', marginTop: '14px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  return (
    <AdminLayout activePage="Manage Clients">
      <h1 style={s.title}>Manage Clients</h1>
      <p style={s.subtitle}>View client profiles, verify IDs, and manage booking history.</p>

      <input
        style={s.searchInput}
        type="text"
        placeholder="Search by name or email..."
        aria-label="Search clients by name or email"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

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
            {loading ? <SkeletonTableRows isDark={isDark} columns={7} /> : pageClients.map((client) => (
              <tr key={client._id}>
                <td style={s.td}>
                  <div style={s.clientCell}>
                    <div style={s.clientAvatar}>
                      {client.image ? (
                        <img src={client.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        client.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div style={s.nameCell}>{client.name}</div>
                      <div style={s.subCell}>{client.email}</div>
                    </div>
                  </div>
                </td>
                <td style={s.td}>{client.phone || '—'}</td>
                <td style={s.td}>{new Date(client.createdAt).toLocaleDateString()}</td>
                <td style={s.td}>{bookingsForClient(client._id).length}</td>
                <td style={s.td}>
                  <span style={client.idVerified ? s.verified : s.unverified}>
                    {client.idVerified ? 'Verified' : 'Unverified'}
                  </span>
                  {client.pendingIdSubmittedAt && (
                    <div style={{ marginTop: '4px' }}><span style={s.pendingTag}>Update Pending</span></div>
                  )}
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isDark={isDark} />

      {selectedClient && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} ref={clientModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
            <button style={s.closeX} onClick={() => setSelectedClientId(null)} aria-label="Close">×</button>
            <h2 id="client-modal-title" style={s.modalTitle}>{selectedClient.name}</h2>
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
                <span style={s.profileLabel}>Birthdate</span>
                <span style={s.profileValue}>
                  {selectedClient.birthDate ? new Date(selectedClient.birthDate).toLocaleDateString() : '—'}
                </span>
              </div>
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

            {(selectedClient.licenseImage || selectedClient.licenseImageBack) && (
              <>
                <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>License Photo</h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedClient.licenseImage && <img src={selectedClient.licenseImage} alt="License front" style={s.idImage} />}
                  {selectedClient.licenseImageBack && <img src={selectedClient.licenseImageBack} alt="License back" style={s.idImage} />}
                </div>
              </>
            )}

            <h3 style={{ ...s.sectionTitle, marginTop: 0 }}>Valid ID</h3>
            {selectedClient.validIdImage ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <img src={selectedClient.validIdImage} alt="Valid ID front" style={s.idImage} />
                {selectedClient.validIdImageBack && (
                  <img src={selectedClient.validIdImageBack} alt="Valid ID back" style={s.idImage} />
                )}
              </div>
            ) : (
              <p style={s.empty}>No ID photo on file.</p>
            )}
            {selectedClient.validIdExpiry && (
              <p style={{ ...s.profileValue, marginTop: '8px' }}>
                ID expiry: {new Date(selectedClient.validIdExpiry).toLocaleDateString()}
                {new Date(selectedClient.validIdExpiry) < new Date() && <span style={{ ...s.unverified, marginLeft: '8px' }}>Expired</span>}
              </p>
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

            {selectedClient.pendingIdSubmittedAt && (
              <div style={s.pendingBox}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={s.pendingTag}>Update Pending Review</span>
                  <span style={s.subCell}>Submitted {new Date(selectedClient.pendingIdSubmittedAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {selectedClient.pendingValidIdImage && <img src={selectedClient.pendingValidIdImage} alt="Pending ID front" style={s.idImage} />}
                  {selectedClient.pendingValidIdImageBack && <img src={selectedClient.pendingValidIdImageBack} alt="Pending ID back" style={s.idImage} />}
                </div>
                {selectedClient.pendingValidIdExpiry && (
                  <p style={{ ...s.profileValue, marginBottom: '10px' }}>
                    New expiry: {new Date(selectedClient.pendingValidIdExpiry).toLocaleDateString()}
                  </p>
                )}
                <div style={s.actionRow}>
                  <button style={s.verifyBtn(false)} onClick={() => handleApprovePendingId(selectedClient._id)}>
                    Approve New ID
                  </button>
                  <button style={s.blockBtn(false)} onClick={() => openRejectPendingId(selectedClient._id)}>
                    Reject New ID
                  </button>
                </div>
              </div>
            )}

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

      {rejectPendingIdTarget && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} ref={rejectPendingIdModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="reject-pending-id-title">
            <h2 id="reject-pending-id-title" style={s.modalTitle}>Reject ID Update</h2>
            <p style={s.modalSub}>The client's current verified ID stays active either way — only the new submission is discarded.</p>
            <label style={s.profileLabel} htmlFor="reject-pending-id-reason">Reason (optional, shown to the client)</label>
            <textarea
              id="reject-pending-id-reason"
              style={s.modalTextarea}
              rows={3}
              value={rejectPendingIdReason}
              onChange={(e) => setRejectPendingIdReason(e.target.value)}
              placeholder="e.g. The photo is blurry, please re-upload."
            />
            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={() => setRejectPendingIdTarget(null)} disabled={rejectingPendingId}>Cancel</button>
              <button style={s.modalSubmitBtn} onClick={confirmRejectPendingId} disabled={rejectingPendingId}>
                {rejectingPendingId ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageClients;