import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonTableRows } from '../../components/Skeleton';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import useModalA11y from '../../hooks/useModalA11y';
import usePageTitle from '../../hooks/usePageTitle';
import { useAdminPendingCounts } from '../../context/AdminPendingCountsContext';
import api from '../../api';

const ManageAvailabilityRequests = () => {
  usePageTitle('Availability Requests');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const { refetch: refetchPendingCounts } = useAdminPendingCounts();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [declineModalId, setDeclineModalId] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [working, setWorking] = useState(false);
  const declineModalRef = useModalA11y(() => setDeclineModalId(null), !!declineModalId);

  const [blockRequests, setBlockRequests] = useState([]);
  const [blockLoading, setBlockLoading] = useState(true);
  const [blockDeclineTarget, setBlockDeclineTarget] = useState(null);
  const [blockDeclineReason, setBlockDeclineReason] = useState('');
  const [blockWorking, setBlockWorking] = useState(false);
  const blockDeclineModalRef = useModalA11y(() => setBlockDeclineTarget(null), !!blockDeclineTarget);

  useEffect(() => { fetchData(); fetchBlockRequests(); }, []);

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

  const fetchBlockRequests = async () => {
    try {
      const res = await api.get('/cars/blocked-date-requests');
      setBlockRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setWorking(true);
    try {
      await api.put(`/cars/${id}/availability-request`, { decision: 'approved' });
      await fetchData();
      refetchPendingCounts();
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
      refetchPendingCounts();
      closeDeclineModal();
      toast.info('Request declined.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong declining this request.');
    } finally {
      setWorking(false);
    }
  };

  const handleApproveBlock = async (req) => {
    setBlockWorking(true);
    try {
      await api.put(`/cars/${req.carId}/blocked-dates/${req._id}/decision`, { decision: 'approved' });
      await fetchBlockRequests();
      refetchPendingCounts();
      toast.success('Blocked dates approved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong approving this request.');
    } finally {
      setBlockWorking(false);
    }
  };

  const openBlockDeclineModal = (req) => {
    setBlockDeclineTarget(req);
    setBlockDeclineReason('');
  };

  const closeBlockDeclineModal = () => {
    setBlockDeclineTarget(null);
    setBlockDeclineReason('');
  };

  const handleDeclineBlock = async () => {
    setBlockWorking(true);
    try {
      await api.put(`/cars/${blockDeclineTarget.carId}/blocked-dates/${blockDeclineTarget._id}/decision`, { decision: 'declined', adminNotes: blockDeclineReason });
      await fetchBlockRequests();
      refetchPendingCounts();
      closeBlockDeclineModal();
      toast.info('Request declined.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong declining this request.');
    } finally {
      setBlockWorking(false);
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '24px' },
    sectionTitle: { fontSize: '16px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginTop: '32px', marginBottom: '4px' },
    sectionSubtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '16px' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#242526' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#e4e6eb' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#f3f4f6'}`, verticalAlign: 'middle' },
    ownerName: { fontWeight: '600' },
    ownerMeta: { fontSize: '11px', color: isDark ? '#b0b3b8' : '#6b7280' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    carThumb: { width: '48px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: isDark ? '#3a3b3c' : '#f3f4f6', flexShrink: 0 },
    reason: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280', maxWidth: '220px' },
    empty: { fontSize: '13px', color: isDark ? '#8a8d91' : '#9ca3af', padding: '24px 0', textAlign: 'center' },
    typeAvailable: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    typeUnavailable: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    actions: { display: 'flex', gap: '6px' },
    approveBtn: { padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    declineBtn: { padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '100%' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '14px' },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#b0b3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#e4e6eb' : '#1a1a1a', background: isDark ? '#18191a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#3a3b3c' : '#f3f4f6', color: isDark ? '#e4e6eb' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  return (
    <AdminLayout activePage="Availability Requests">
      <h1 style={s.title}>Availability Requests</h1>
      <p style={s.subtitle}>Consignors need your approval before taking a vehicle off the platform, or bringing it back.</p>

      {loading ? (
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
              <SkeletonTableRows isDark={isDark} columns={6} />
            </tbody>
          </table>
        </div>
      ) : cars.length === 0 ? (
        <div style={s.table}><p style={s.empty}>No pending requests.</p></div>
      ) : (
        <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Owner</th>
              <th style={s.th}>Vehicle</th>
              <th style={s.th}>Request</th>
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
                  <span style={car.availabilityRequest?.type === 'available' ? s.typeAvailable : s.typeUnavailable}>
                    {car.availabilityRequest?.type === 'available' ? 'Mark Available' : 'Mark Unavailable'}
                  </span>
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

      <h2 style={s.sectionTitle}>Blocked Date Requests</h2>
      <p style={s.sectionSubtitle}>Consignors need your approval before blocking dates on their own vehicle.</p>

      {blockLoading ? (
        <div className="table-scroll">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Owner</th>
                <th style={s.th}>Vehicle</th>
                <th style={s.th}>Dates</th>
                <th style={s.th}>Reason</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRows isDark={isDark} columns={5} />
            </tbody>
          </table>
        </div>
      ) : blockRequests.length === 0 ? (
        <div style={s.table}><p style={s.empty}>No pending requests.</p></div>
      ) : (
        <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Owner</th>
              <th style={s.th}>Vehicle</th>
              <th style={s.th}>Dates</th>
              <th style={s.th}>Reason</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {blockRequests.map((req) => (
              <tr key={req._id}>
                <td style={s.td}>
                  <div style={s.ownerName}>{req.owner?.name || 'Unknown'}</div>
                  <div style={s.ownerMeta}>{req.owner?.email}</div>
                </td>
                <td style={s.td}>
                  <div style={s.carCell}>
                    <div style={s.carThumb}>
                      {req.image && <img src={req.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <span>{req.brand} {req.model}</span>
                  </div>
                </td>
                <td style={s.td}>
                  {new Date(req.startDate).toLocaleDateString()} → {new Date(req.endDate).toLocaleDateString()}
                </td>
                <td style={s.td}>
                  <span style={s.reason}>{req.reason || '—'}</span>
                </td>
                <td style={s.td}>
                  <div style={s.actions}>
                    <button style={s.approveBtn} onClick={() => handleApproveBlock(req)} disabled={blockWorking}>Approve</button>
                    <button style={s.declineBtn} onClick={() => openBlockDeclineModal(req)} disabled={blockWorking}>Decline</button>
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
          <div style={s.modalContent} ref={declineModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="decline-modal-title">
            <h2 id="decline-modal-title" style={s.modalTitle}>Decline Request</h2>
            <label style={s.modalLabel} htmlFor="avail-decline-reason">Reason (shown to the consignor)</label>
            <textarea
              id="avail-decline-reason"
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

      {blockDeclineTarget && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} ref={blockDeclineModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="block-decline-modal-title">
            <h2 id="block-decline-modal-title" style={s.modalTitle}>Decline Blocked Dates</h2>
            <label style={s.modalLabel} htmlFor="block-decline-reason">Reason (shown to the consignor)</label>
            <textarea
              id="block-decline-reason"
              style={s.modalTextarea}
              rows={3}
              value={blockDeclineReason}
              onChange={(e) => setBlockDeclineReason(e.target.value)}
              placeholder="e.g. Those dates already have interest from renters."
            />
            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={closeBlockDeclineModal} disabled={blockWorking}>Cancel</button>
              <button style={s.modalSubmitBtn} onClick={handleDeclineBlock} disabled={blockWorking}>
                {blockWorking ? 'Working...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageAvailabilityRequests;
