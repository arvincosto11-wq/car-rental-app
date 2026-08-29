import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonTableRows } from '../../components/Skeleton';
import Pagination from '../../components/Pagination';
import { paginate } from '../../utils/paginate';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import useModalA11y from '../../hooks/useModalA11y';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';

const PAGE_SIZE = 10;

const ManageConsignments = () => {
  usePageTitle('Manage Consignments');
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedId, setSelectedId] = useState(null);
  const [page, setPage] = useState(1);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineBox, setShowDeclineBox] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/consignments/all');
      setConsignments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selected = consignments.find((c) => c._id === selectedId);
  const filtered = consignments.filter((c) => filter === 'all' || c.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageConsignments = paginate(filtered, page, PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const closeModal = () => {
    setSelectedId(null);
    setShowDeclineBox(false);
    setDeclineReason('');
  };

  const detailModalRef = useModalA11y(closeModal, !!selected);

  const handleApprove = async (id) => {
    setWorking(true);
    try {
      await api.put(`/consignments/${id}`, { decision: 'approved' });
      await fetchData();
      closeModal();
      toast.success('Application approved and vehicle listed.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong approving this application.');
    } finally {
      setWorking(false);
    }
  };

  const handleDecline = async (id) => {
    if (!declineReason.trim()) return;
    setWorking(true);
    try {
      await api.put(`/consignments/${id}`, { decision: 'declined', adminNotes: declineReason });
      await fetchData();
      closeModal();
      toast.info('Application declined.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong declining this application.');
    } finally {
      setWorking(false);
    }
  };

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    filterRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
    filterBtn: (active) => ({ padding: '7px 16px', fontSize: '13px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, background: active ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#1e293b' : '#fff'), color: active ? ON_GOLD : (isDark ? '#f1f5f9' : '#374151'), cursor: 'pointer', fontWeight: '500' }),
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, verticalAlign: 'middle' },
    ownerName: { fontWeight: '600' },
    ownerMeta: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    carThumb: { width: '48px', height: '36px', borderRadius: '6px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    badgePending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    badgeApproved: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    badgeDeclined: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    viewBtn: { padding: '5px 12px', fontSize: '12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', background: 'none', color: isDark ? '#f1f5f9' : '#1a1a1a', cursor: 'pointer' },
    empty: { fontSize: '13px', color: isDark ? '#64748b' : '#9ca3af', padding: '24px 0', textAlign: 'center' },

    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '700px', width: '100%', maxHeight: '85vh', overflow: 'auto', position: 'relative' },
    closeX: { position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '22px', lineHeight: 1, cursor: 'pointer', color: isDark ? '#94a3b8' : '#6b7280', padding: '4px' },
    modalTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    modalSub: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '16px' },
    sectionTitle: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '10px', marginTop: '20px' },
    profileGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' },
    profileItem: { background: isDark ? '#0f172a' : '#f9fafb', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    profileLabel: { display: 'block', fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '3px' },
    profileValue: { fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', fontWeight: '500' },
    docGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' },
    docImage: { width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, background: isDark ? '#0f172a' : '#f9fafb' },
    docLabel: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px', marginBottom: '18px' },
    photoImg: { width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    actionRow: { display: 'flex', gap: '10px', marginTop: '20px' },
    approveBtn: { flex: 1, padding: '10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' },
    declineBtn: { flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' },
    declineBox: { marginTop: '14px', padding: '14px', background: isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2', borderRadius: '8px', border: `1px solid ${isDark ? '#7f1d1d' : '#fecaca'}` },
    declineTextarea: { width: '100%', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', minHeight: '70px', resize: 'vertical', marginBottom: '10px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#111827' },
    reviewedNote: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '18px', fontStyle: 'italic' },
    declinedReasonBox: { marginTop: '14px', fontSize: '13px', color: isDark ? '#fca5a5' : '#991b1b', background: isDark ? 'rgba(220,38,38,0.1)' : '#fef2f2', padding: '10px 12px', borderRadius: '8px' },
  };

  const badgeStyle = (status) =>
    status === 'approved' ? s.badgeApproved : status === 'declined' ? s.badgeDeclined : s.badgePending;

  return (
    <AdminLayout activePage="Manage Consignments">
      <h1 style={s.title}>Manage Consignments</h1>
      <p style={s.subtitle}>Review vehicle owner applications, verify documents, and approve or decline listings.</p>

      <div style={s.filterRow}>
        {['pending', 'approved', 'declined', 'all'].map((f) => (
          <button key={f} style={s.filterBtn(filter === f)} onClick={() => { setFilter(f); setPage(1); }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="table-scroll">
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Owner</th>
                <th style={s.th}>Vehicle</th>
                <th style={s.th}>Suggested Price</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Submitted</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonTableRows isDark={isDark} columns={6} />
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <div style={s.table}><p style={s.empty}>No applications here.</p></div>
      ) : (
        <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Owner</th>
              <th style={s.th}>Vehicle</th>
              <th style={s.th}>Suggested Price</th>
              <th style={s.th}>Status</th>
              <th style={s.th}>Submitted</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageConsignments.map((c) => (
              <tr key={c._id}>
                <td style={s.td}>
                  <div style={s.ownerName}>{c.owner?.name || 'Unknown'}</div>
                  <div style={s.ownerMeta}>{c.owner?.email}</div>
                </td>
                <td style={s.td}>
                  <div style={s.carCell}>
                    <div style={s.carThumb}>
                      {c.vehiclePhotos?.[0]?.url && <img src={c.vehiclePhotos[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <span>{c.brand} {c.model} ({c.year})</span>
                  </div>
                </td>
                <td style={s.td}>₱{c.suggestedPricePerDay}/day</td>
                <td style={s.td}><span style={badgeStyle(c.status)}>{c.status}</span></td>
                <td style={s.td}>{new Date(c.createdAt).toLocaleDateString()}</td>
                <td style={s.td}>
                  <button style={s.viewBtn} onClick={() => setSelectedId(c._id)}>View Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isDark={isDark} />}

      {selected && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent} ref={detailModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="consignment-modal-title">
            <button style={s.closeX} onClick={closeModal} aria-label="Close">×</button>
            <h2 id="consignment-modal-title" style={s.modalTitle}>{selected.brand} {selected.model} ({selected.year})</h2>
            <p style={s.modalSub}>
              Submitted by {selected.owner?.name} &middot; <span style={badgeStyle(selected.status)}>{selected.status}</span>
            </p>

            <h3 style={s.sectionTitle}>Owner Information</h3>
            <div style={s.profileGrid}>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Email</span>
                <span style={s.profileValue}>{selected.owner?.email || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Phone</span>
                <span style={s.profileValue}>{selected.owner?.phone || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Address</span>
                <span style={s.profileValue}>{selected.owner?.address || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>ID Verified</span>
                <span style={s.profileValue}>{selected.owner?.idVerified ? 'Yes' : 'Not yet'}</span>
              </div>
            </div>
            {selected.owner?.validIdImage && (
              <img src={selected.owner.validIdImage} alt="Owner ID" style={{ ...s.docImage, marginBottom: '18px' }} />
            )}

            <h3 style={s.sectionTitle}>Vehicle Details</h3>
            <div style={s.profileGrid}>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Plate Number</span>
                <span style={s.profileValue}>{selected.plateNumber}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Color</span>
                <span style={s.profileValue}>{selected.color || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Mileage</span>
                <span style={s.profileValue}>{selected.mileage ? `${selected.mileage} km` : '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Category</span>
                <span style={s.profileValue}>{selected.category}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Transmission</span>
                <span style={s.profileValue}>{selected.transmission}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Fuel Type</span>
                <span style={s.profileValue}>{selected.fuelType}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Seats</span>
                <span style={s.profileValue}>{selected.seats}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Suggested Price</span>
                <span style={s.profileValue}>₱{selected.suggestedPricePerDay}/day</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Booking Types Requested</span>
                <span style={s.profileValue}>
                  {(selected.availableBookingTypes?.length ? selected.availableBookingTypes : ['self-drive', 'with-driver'])
                    .map((t) => (t === 'self-drive' ? 'Self Drive' : 'With Driver'))
                    .join(' + ')}
                </span>
              </div>
            </div>
            {selected.description && (
              <div style={{ ...s.profileItem, marginBottom: '18px' }}>
                <span style={s.profileLabel}>Description</span>
                <span style={s.profileValue}>{selected.description}</span>
              </div>
            )}

            <h3 style={s.sectionTitle}>Vehicle Documents</h3>
            <div style={s.docGrid}>
              <div>
                <div style={s.docLabel}>OR (Official Receipt)</div>
                {selected.orImage ? <img src={selected.orImage} alt="OR" style={s.docImage} /> : <p style={s.empty}>Not provided</p>}
              </div>
              <div>
                <div style={s.docLabel}>CR (Certificate of Registration)</div>
                {selected.crImage ? <img src={selected.crImage} alt="CR" style={s.docImage} /> : <p style={s.empty}>Not provided</p>}
              </div>
            </div>

            <h3 style={s.sectionTitle}>Vehicle Photos</h3>
            {selected.vehiclePhotos?.length > 0 ? (
              <div style={s.photoGrid}>
                {selected.vehiclePhotos.map((p, i) => (
                  <img key={i} src={p.url} alt={`Vehicle ${i + 1}`} style={s.photoImg} />
                ))}
              </div>
            ) : (
              <p style={s.empty}>No vehicle photos provided.</p>
            )}

            {selected.status === 'pending' && (
              <>
                <div style={s.actionRow}>
                  <button style={s.approveBtn} onClick={() => handleApprove(selected._id)} disabled={working}>
                    {working ? 'Working...' : 'Approve & List Car'}
                  </button>
                  <button style={s.declineBtn} onClick={() => setShowDeclineBox(!showDeclineBox)} disabled={working}>
                    Decline
                  </button>
                </div>
                {showDeclineBox && (
                  <div style={s.declineBox}>
                    <textarea
                      style={s.declineTextarea}
                      placeholder="Reason for declining (shown to the applicant)..."
                      aria-label="Reason for declining"
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                    />
                    <button style={s.declineBtn} onClick={() => handleDecline(selected._id)} disabled={working || !declineReason.trim()}>
                      {working ? 'Working...' : 'Confirm Decline'}
                    </button>
                  </div>
                )}
              </>
            )}

            {selected.status === 'declined' && selected.adminNotes && (
              <div style={s.declinedReasonBox}>Decline reason: {selected.adminNotes}</div>
            )}

            {selected.status === 'approved' && (
              <p style={s.reviewedNote}>This vehicle is now live in Manage Cars.</p>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageConsignments;
