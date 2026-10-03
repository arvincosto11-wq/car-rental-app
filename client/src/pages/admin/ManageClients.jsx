import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonTableRows } from '../../components/Skeleton';
import Pagination from '../../components/Pagination';
import { paginate } from '../../utils/paginate';
import useModalA11y from '../../hooks/useModalA11y';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, goldInk} from '../../theme';
import api from '../../api';
import { useUIFeedback } from '../../context/UIFeedbackContext';

const PAGE_SIZE = 10;

const ManageClients = () => {
  usePageTitle('Manage Clients');
  const { isDark } = useTheme();
  const { confirm } = useUIFeedback();
  const [clients, setClients] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [page, setPage] = useState(1);

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

  const handleBlock = async (id, currentStatus) => {
    const ok = await confirm(
      currentStatus
        ? 'Unblock this client? They will be able to make bookings again.'
        : 'Block this client? They will not be able to make any booking until you unblock them. '
          + 'Bookings they already have are not affected.',
      currentStatus
        ? { confirmLabel: 'Unblock', cancelLabel: 'Leave blocked' }
        : { confirmLabel: 'Block client', cancelLabel: 'Cancel', danger: true }
    );
    if (!ok) return;
    try {
      await api.put(`/users/${id}/block`, { blocked: !currentStatus });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // The dates are read off the photographs above and typed here, not taken
  // from anything the client sent. Blank is a real answer — a TIN ID does
  // not expire — so it is sent as an empty string rather than omitted.
  const [docDates, setDocDates] = useState({ licenseExpiry: '' });
  const [savingDates, setSavingDates] = useState(false);


  const saveDocumentDates = async (id) => {
    setSavingDates(true);
    try {
      await api.put(`/users/${id}/document-dates`, {
        licenseExpiry: docDates.licenseExpiry || '',
      });
      await fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingDates(false);
    }
  };



  const bookingsForClient = (clientId) =>
    bookings.filter((b) => b.user?._id === clientId);

  const finishedTripsFor = (clientId) =>
    bookingsForClient(clientId).filter((b) => b.status === 'completed' && b.collectedAt);
  const lateReturnsFor = (clientId) =>
    finishedTripsFor(clientId).filter((b) => b.lateFee?.days > 0);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClients = paginate(filtered, page, PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const selectedClient = clients.find((c) => c._id === selectedClientId);
  const finishedTrips = selectedClient ? finishedTripsFor(selectedClient._id).length : 0;
  const lateReturns = selectedClient ? lateReturnsFor(selectedClient._id).length : 0;
  const clientModalRef = useModalA11y(() => setSelectedClientId(null), !!selectedClient);

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
      fontSize: '13px', fontWeight: '700', color: goldInk(isDark),
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
    // The card and the scrolling area used to be the same element, so the
    // close button — positioned against the card — scrolled away with the
    // content. Splitting them keeps it against the card, which never moves.
    modalShell: { background: isDark ? '#242526' : '#fff', borderRadius: '12px', maxWidth: '600px', width: '100%', maxHeight: '85vh', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    modalBody: { padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 },
    closeX: {
      position: 'absolute', top: '14px', right: '14px', zIndex: 2,
      width: '34px', height: '34px', flexShrink: 0, borderRadius: '50%', cursor: 'pointer',
      border: `1px solid ${isDark ? '#4a4b4c' : '#d1d5db'}`,
      background: isDark ? '#3a3b3c' : '#e5e7eb',
      color: isDark ? '#e4e6eb' : '#1a1a1a',
      fontSize: '15px', fontWeight: '700', lineHeight: 1,
      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.45)' : '0 2px 8px rgba(0,0,0,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
    },
    modalTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    modalSub: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '18px' },
    badgeRow: { display: 'flex', gap: '8px', marginBottom: '18px' },
    profileGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' },
    profileItem: { background: isDark ? '#18191a' : '#f9fafb', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    dateRow: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' },
    dateField: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' },
    dateInput: {
      padding: '8px 10px', fontSize: '13px', borderRadius: '8px', outline: 'none',
      border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`,
      background: isDark ? '#18191a' : '#fff', color: isDark ? '#e4e6eb' : '#1a1a1a',
    },
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
      <p style={s.subtitle}>View client profiles, correct document dates, and manage booking history.</p>

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
                  <span style={client.isBlocked ? s.blocked : s.active}>
                    {client.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td style={s.td}>
                  <button
                    style={s.viewBtn}
                    onClick={() => {
                      // Seeded from what is on file, so admin edits a date
                      // rather than retyping one from scratch.
                      const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
                      setDocDates({ licenseExpiry: ymd(client.licenseExpiry) });
                      setSelectedClientId(client._id);
                    }}
                  >
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
          <div style={s.modalShell} ref={clientModalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
            <button type="button" className="icon-toggle-btn" style={s.closeX} onClick={() => setSelectedClientId(null)} aria-label="Close">✕</button>
            <div style={s.modalBody}>
            <h2 id="client-modal-title" style={s.modalTitle}>{selectedClient.name}</h2>
            <p style={s.modalSub}>{selectedClient.email}</p>

            <div style={s.badgeRow}>
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
              {/* We hold no copies of anything, so these dates are the
                  client's own account of their papers. They are editable
                  because whoever has actually seen the documents at the
                  counter is the only person who can put them right. */}
              <div style={{ ...s.profileItem, gridColumn: '1 / -1' }}>
                <span style={s.profileLabel}>Licence expiry (as given by the client)</span>
                <div style={s.dateRow}>
                  <label style={s.dateField}>
                    <span style={s.profileLabel}>Licence</span>
                    <input
                      type="date"
                      style={s.dateInput}
                      value={docDates.licenseExpiry}
                      onChange={(e) => setDocDates({ ...docDates, licenseExpiry: e.target.value })}
                    />
                  </label>
                  <button
                    style={s.verifyBtn(false)}
                    disabled={savingDates}
                    onClick={() => saveDocumentDates(selectedClient._id)}
                  >
                    {savingDates ? 'Saving...' : 'Save dates'}
                  </button>
                </div>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Emergency Contact</span>
                <span style={s.profileValue}>{selectedClient.emergencyContactName || '—'}</span>
              </div>
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Emergency Contact #</span>
                <span style={s.profileValue}>{selectedClient.emergencyContactNumber || '—'}</span>
              </div>
              {/* One late return is a bad day. Four is a pattern, and it is
                  the kind of thing you want to know before handing over the
                  keys again rather than after. */}
              <div style={s.profileItem}>
                <span style={s.profileLabel}>Late Returns</span>
                <span style={{ ...s.profileValue, color: lateReturns > 0 ? (isDark ? '#f87171' : '#dc2626') : undefined }}>
                  {lateReturns === 0
                    ? 'None'
                    : `${lateReturns} of ${finishedTrips} trip${finishedTrips === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>

            {/* The block button lived beside an ID-verification button that
                no longer exists. Blocking is unrelated to documents and is
                still how an admin stops somebody booking. */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px', marginBottom: '4px' }}>
              <button
                type="button"
                style={s.blockBtn(selectedClient.isBlocked)}
                onClick={() => handleBlock(selectedClient._id, selectedClient.isBlocked)}
              >
                {selectedClient.isBlocked ? 'Unblock client' : 'Block client'}
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

            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
};

export default ManageClients;