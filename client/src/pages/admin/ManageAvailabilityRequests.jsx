import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import api from '../../api';

const ManageAvailabilityRequests = () => {
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [declineModalId, setDeclineModalId] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/cars/availability-requests');
      setCars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setWorking(true);
    try {
      await api.put(`/cars/${id}/availability-request`, { decision: 'approved' });
      await fetchData();
      toast.success('Request approved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong approving this request.');
    } finally {
      setWorking(false);
    }
  };

  const openDeclineModal = (id) => {
    setDeclineModalId(id);
    setDeclineReason('');
  };

  const closeDeclineModal = () => {
    setDeclineModalId(null);
    setDeclineReason('');
  };

  const handleDecline = async () => {
    setWorking(true);
    try {
      await api.put(`/cars/${declineModalId}/availability-request`, { decision: 'declined', adminNotes: declineReason });
      await fetchData();
      closeDeclineModal();
      toast.info('Request declined.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong declining this request.');
    } finally {
      setWorking(false);
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, verticalAlign: 'middle' },
    ownerName: { fontWeight: '600' },
    ownerMeta: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    carThumb: { width: '48px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    reason: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', maxWidth: '220px' },
    empty: { fontSize: '13px', color: isDark ? '#64748b' : '#9ca3af', padding: '24px 0', textAlign: 'center' },
    actions: { display: 'flex', gap: '6px' },
    approveBtn: { padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    declineBtn: { padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '100%' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '14px' },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#f1f5f9' : '#1a1a1a', background: isDark ? '#0f172a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  return (
    <AdminLayout activePage="Availability Requests">
      <h1 style={s.title}>Availability Requests</h1>
      <p style={s.subtitle}>Consignors need your approval before taking a vehicle off the platform.</p>

      {loading ? (
        <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p>
      ) : cars.length === 0 ? (
        <div style={s.table}><p style={s.empty}>No pending requests.</p></div>
      ) : (
        <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Owner</th>
              <th style={s.th}>Vehicle</th>
              <th style={s.th}>Reason</th>
              <th style={s.th}>Requested</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((car) => (
              <tr key={car._id}>
                <td style={s.td}>
                  <div style={s.ownerName}>{car.owner?.name || 'Unknown'}</div>
                  <div style={s.ownerMeta}>{car.owner?.email}</div>
                </td>
                <td style={s.td}>
                  <div style={s.carCell}>
                    <div style={s.carThumb}>
                      {car.image && <img src={car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <span>{car.brand} {car.model}</span>
                  </div>
                </td>
                <td style={s.td}>
                  <span style={s.reason}>{car.availabilityRequest?.reason || '—'}</span>
                </td>
                <td style={s.td}>
                  {car.availabilityRequest?.requestedAt ? new Date(car.availabilityRequest.requestedAt).toLocaleDateString() : '—'}
                </td>
                <td style={s.td}>
                  <div style={s.actions}>
                    <button style={s.approveBtn} onClick={() => handleApprove(car._id)} disabled={working}>Approve</button>
                    <button style={s.declineBtn} onClick={() => openDeclineModal(car._id)} disabled={working}>Decline</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {declineModalId && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <h2 style={s.modalTitle}>Decline Request</h2>
            <label style={s.modalLabel}>Reason (shown to the consignor)</label>
            <textarea
              style={s.modalTextarea}
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. This vehicle has upcoming confirmed bookings."
            />
            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={closeDeclineModal} disabled={working}>Cancel</button>
              <button style={s.modalSubmitBtn} onClick={handleDecline} disabled={working}>
                {working ? 'Working...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageAvailabilityRequests;
