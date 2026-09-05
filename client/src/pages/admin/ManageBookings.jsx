import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import ClientRatingModal from '../../components/ClientRatingModal';
import { SkeletonTableRows } from '../../components/Skeleton';
import Pagination from '../../components/Pagination';
import { paginate } from '../../utils/paginate';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';

const LOW_RATING_THRESHOLD = 3;
const PAGE_SIZE = 10;

const formatPayment = (payment) => {
  if (payment === 'gcash_pending') return 'GCash pending';
  if (payment === 'paid') return 'Paid';
  return 'Unpaid';
};

const ManageBookings = () => {
  usePageTitle('Manage Bookings');
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { toast } = useUIFeedback();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalId, setRatingModalId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rescheduleOnly, setRescheduleOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/all');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (id, status) => {
    try {
      const res = await api.put(`/bookings/${id}`, { status });
      if (res.data.autoRefunded) {
        toast.info(res.data.message);
      }
      await fetchBookings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating this booking.');
    }
  };

  const handleRefundDecision = async (id, decision) => {
    try {
      await api.put(`/bookings/${id}/refund`, { decision });
      await fetchBookings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating this refund.');
    }
  };

  const handleRescheduleDecision = async (id, decision) => {
    try {
      const res = await api.put(`/bookings/${id}/reschedule`, { decision });
      if (res.data.rescheduleRequest?.adminNotes?.startsWith('Automatically declined')) {
        toast.info(res.data.rescheduleRequest.adminNotes);
      }
      await fetchBookings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating this reschedule request.');
    }
  };

  const openRatingModal = (booking) => setRatingModalId(booking._id);
  const closeRatingModal = () => setRatingModalId(null);
  const handleRatingSubmitted = async () => {
    await fetchBookings();
    closeRatingModal();
  };

  const ratingBooking = bookings.find((b) => b._id === ratingModalId);
  const unratedClientCount = bookings.filter((b) => b.status === 'completed' && !b.clientRating?.ratedAt).length;
  const pendingRescheduleCount = bookings.filter((b) => b.rescheduleRequest?.status === 'pending').length;

  const filteredBookings = bookings.filter((b) => {
    const matchStatus = statusFilter === 'all' ? true : b.status === statusFilter;
    const matchReschedule = !rescheduleOnly || b.rescheduleRequest?.status === 'pending';
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || b.user?.name?.toLowerCase().includes(q)
      || b.user?.email?.toLowerCase().includes(q)
      || `${b.car?.brand} ${b.car?.model}`.toLowerCase().includes(q);
    return matchStatus && matchReschedule && matchSearch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const pageBookings = paginate(filteredBookings, page, PAGE_SIZE);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const s = {
    headerRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    rateClientsBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '9px 16px', background: '#7c3aed', color: '#fff',
      border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    rateClientsBadge: {
      background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: '11px', fontWeight: '700',
      borderRadius: '20px', padding: '1px 8px', minWidth: '18px', textAlign: 'center',
    },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, verticalAlign: 'middle' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    clientName: { fontWeight: '600', fontSize: '13px' },
    clientMeta: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    carThumb: { width: '44px', height: '32px', background: isDark ? '#334155' : '#f3f4f6', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
    payBadge: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    paymentRef: { fontSize: '10px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '2px', fontFamily: 'monospace', wordBreak: 'break-all' },
    confirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    cancelled: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    completed: { background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    returnBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer', fontWeight: '500' },
    acceptBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    declineBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    refundApproved: { background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    refundDeclined: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    select: { padding: '5px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#1a1a1a', cursor: 'pointer' },
    editRatingBtn: { background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
    lowRatingBadge: { background: '#fee2e2', color: '#991b1b', fontSize: '10px', padding: '1px 8px', borderRadius: '20px', marginLeft: '6px', fontWeight: '600' },
    filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' },
    searchInput: {
      flex: '1 1 220px', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', outline: 'none', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#111827',
    },
    statusSelect: {
      padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#111827', cursor: 'pointer',
    },
    calendarBtn: {
      padding: '9px 16px', background: isDark ? '#1e293b' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', fontWeight: '600',
      cursor: 'pointer', whiteSpace: 'nowrap',
    },
    rescheduleFilterBtn: {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '9px 16px', background: isDark ? '#1e293b' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151',
      border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    rescheduleFilterBadge: {
      background: isDark ? '#334155' : '#e5e7eb', color: isDark ? '#f1f5f9' : '#374151',
      fontSize: '11px', fontWeight: '700', borderRadius: '20px', padding: '1px 8px', minWidth: '18px', textAlign: 'center',
    },
    // Same plain text-link style as the "← Back to Manage Bookings" links on
    // Bookings Calendar / Rate Clients, so returning from this filter reads
    // as a back action rather than another primary button.
    rescheduleBackLink: {
      display: 'inline-block', marginBottom: '12px',
      padding: 0, fontSize: '13px', color: isDark ? GOLD_DARK : GOLD, fontWeight: '500',
      background: 'none', border: 'none', textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    },
  };

  return (
    <AdminLayout activePage="Manage Bookings">
      {!loading && rescheduleOnly && (
        <button
          type="button"
          style={s.rescheduleBackLink}
          onClick={() => { setRescheduleOnly(false); setPage(1); }}
        >
          ← Back to All Bookings
        </button>
      )}
      <div style={s.headerRow}>
        <div>
          <h1 style={s.title}>Manage Bookings</h1>
          <p style={s.subtitle}>Track all customer bookings and manage booking statuses.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={s.calendarBtn} onClick={() => navigate('/admin/bookings-calendar')}>
            📅 Calendar View
          </button>
          {!loading && !rescheduleOnly && pendingRescheduleCount > 0 && (
            <button
              type="button"
              style={s.rescheduleFilterBtn}
              onClick={() => { setRescheduleOnly(true); setPage(1); }}
            >
              🔄 Pending Reschedules
              <span style={s.rescheduleFilterBadge}>{pendingRescheduleCount}</span>
            </button>
          )}
          {!loading && unratedClientCount > 0 && (
            <button style={s.rateClientsBtn} onClick={() => navigate('/admin/rate-clients')}>
              ⭐ Rate Clients
              <span style={s.rateClientsBadge}>{unratedClientCount}</span>
            </button>
          )}
        </div>
      </div>

      <div style={s.filterRow}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search by client, email, or car..."
          aria-label="Search bookings"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select style={s.statusSelect} value={statusFilter} aria-label="Filter by status" onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="table-scroll">
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Client</th>
              <th style={s.th}>Car</th>
              <th style={s.th}>Date Range</th>
              <th style={s.th}>Total</th>
              <th style={s.th}>Payment</th>
              <th style={s.th}>Refund</th>
              <th style={s.th}>Reschedule</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonTableRows isDark={isDark} columns={8} /> : filteredBookings.length === 0 ? (
              <tr><td colSpan={8} style={{ ...s.td, textAlign: 'center', color: isDark ? '#94a3b8' : '#6b7280' }}>No bookings match.</td></tr>
            ) : pageBookings.map((booking) => (
              <tr key={booking._id}>
                <td style={s.td}>
                  <div style={s.clientName}>
                    {booking.user?.name || 'Unknown'}
                    {booking.user?.ratingCount > 0 && booking.user.avgRating < LOW_RATING_THRESHOLD && (
                      <span style={s.lowRatingBadge} title={`Avg rating: ${booking.user.avgRating.toFixed(1)} from ${booking.user.ratingCount} booking(s)`}>
                        ⚠ Low Rating
                      </span>
                    )}
                  </div>
                  <div style={s.clientMeta}>{booking.user?.email}</div>
                  <div style={s.clientMeta}>ID: {booking.user?._id?.slice(-6) || '—'}</div>
                  {booking.user?.ratingCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <StarRating value={booking.user.avgRating} size={11} readOnly />
                      <span style={s.clientMeta}>{booking.user.avgRating.toFixed(1)} ({booking.user.ratingCount})</span>
                    </div>
                  )}
                </td>
                <td style={s.td}>
                  <div style={s.carCell}>
                    <div style={s.carThumb}>
                      {booking.car?.image && <img src={booking.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div>
                      <span>{booking.car?.brand} {booking.car?.model}</span>
                      {booking.carRating?.ratedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }} title={booking.carRating.comment || ''}>
                          <StarRating value={booking.carRating.overall} size={11} readOnly />
                          <span style={s.clientMeta}>{booking.carRating.overall.toFixed(1)} client review</span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={s.td}>{new Date(booking.startDate).toLocaleDateString()} to {new Date(booking.endDate).toLocaleDateString()}</td>
                <td style={s.td}>₱{booking.totalPrice}</td>
                <td style={s.td}>
                  <span style={s.payBadge}>{formatPayment(booking.payment)}</span>
                  {booking.paymongoPaymentId && (
                    <div style={s.paymentRef} title="PayMongo payment reference">{booking.paymongoPaymentId}</div>
                  )}
                </td>
                <td style={s.td}>
                  {booking.refundStatus === 'requested' ? (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '2px' }}>
                        ₱{booking.refundAmount?.toLocaleString() ?? 0}
                      </div>
                      <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px', maxWidth: '160px' }}>
                        {booking.refundReason}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.acceptBtn} onClick={() => handleRefundDecision(booking._id, 'approved')}>Accept</button>
                        <button style={s.declineBtn} onClick={() => handleRefundDecision(booking._id, 'declined')}>Decline</button>
                      </div>
                    </div>
                  ) : booking.refundStatus === 'approved' ? (
                    <span style={s.refundApproved}>Refund Approved</span>
                  ) : booking.refundStatus === 'declined' ? (
                    <span style={s.refundDeclined}>Refund Declined</span>
                  ) : (
                    <span style={{ color: isDark ? '#64748b' : '#9ca3af', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={s.td}>
                  {booking.rescheduleRequest?.status === 'pending' ? (
                    <div>
                      <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px', maxWidth: '160px' }}>
                        New: {new Date(booking.rescheduleRequest.newStartDate).toLocaleDateString()} to {new Date(booking.rescheduleRequest.newEndDate).toLocaleDateString()}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={s.acceptBtn} onClick={() => handleRescheduleDecision(booking._id, 'approved')}>Accept</button>
                        <button style={s.declineBtn} onClick={() => handleRescheduleDecision(booking._id, 'declined')}>Decline</button>
                      </div>
                    </div>
                  ) : booking.rescheduleRequest?.status === 'approved' ? (
                    <span style={s.refundApproved}>Rescheduled</span>
                  ) : booking.rescheduleRequest?.status === 'declined' ? (
                    <span style={s.refundDeclined}>Reschedule Declined</span>
                  ) : (
                    <span style={{ color: isDark ? '#64748b' : '#9ca3af', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={s.td}>
                  {booking.status === 'confirmed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={s.confirmed}>confirmed</span>
                      <button
                        style={s.returnBtn}
                        onClick={() => handleStatus(booking._id, 'completed')}
                        title="Only needed for an early return — this completes automatically the day after the return date."
                      >
                        Mark as Returned
                      </button>
                    </div>
                  ) : booking.status === 'cancelled' ? (
                    <span style={s.cancelled}>cancelled</span>
                  ) : booking.status === 'completed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={s.completed}>completed</span>
                      {booking.clientRating?.ratedAt && (
                        <>
                          <StarRating value={booking.clientRating.rating} size={12} readOnly />
                          <button style={s.editRatingBtn} onClick={() => openRatingModal(booking)}>Edit rating</button>
                        </>
                      )}
                    </div>
                  ) : (
                    <select style={s.select} value={booking.status} aria-label="Update booking status" onChange={(e) => handleStatus(booking._id, e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} isDark={isDark} />

      {ratingModalId && ratingBooking && (
        <ClientRatingModal
          booking={ratingBooking}
          isDark={isDark}
          onClose={closeRatingModal}
          onSubmitted={handleRatingSubmitted}
        />
      )}
    </AdminLayout>
  );
};

export default ManageBookings;