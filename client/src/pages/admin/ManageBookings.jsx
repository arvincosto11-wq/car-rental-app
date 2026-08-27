import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import api from '../../api';

const LOW_RATING_THRESHOLD = 3;

const ManageBookings = () => {
  const { isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalId, setRatingModalId] = useState(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

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
        alert(res.data.message);
      }
      await fetchBookings();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Something went wrong updating this booking.');
    }
  };

  const handleRefundDecision = async (id, decision) => {
    try {
      await api.put(`/bookings/${id}/refund`, { decision });
      await fetchBookings();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Something went wrong updating this refund.');
    }
  };

  const openRatingModal = (booking) => {
    setRatingModalId(booking._id);
    setRatingValue(booking.clientRating?.rating || 0);
    setRatingComment(booking.clientRating?.comment || '');
    setRatingError('');
  };

  const closeRatingModal = () => {
    setRatingModalId(null);
    setRatingError('');
  };

  const handleSubmitRating = async () => {
    if (!ratingValue) {
      setRatingError('Please select a rating.');
      return;
    }
    setRatingSubmitting(true);
    setRatingError('');
    try {
      await api.post(`/bookings/${ratingModalId}/rate-client`, { rating: ratingValue, comment: ratingComment });
      await fetchBookings();
      closeRatingModal();
    } catch (err) {
      setRatingError(err.response?.data?.message || 'Failed to submit rating');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const ratingBooking = bookings.find((b) => b._id === ratingModalId);

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, verticalAlign: 'middle' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    clientName: { fontWeight: '600', fontSize: '13px' },
    clientMeta: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    carThumb: { width: '44px', height: '32px', background: isDark ? '#334155' : '#f3f4f6', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
    payBadge: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    confirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    cancelled: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    completed: { background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    returnBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    acceptBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#16a34a', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    declineBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    refundApproved: { background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    refundDeclined: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    select: { padding: '5px 10px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', fontSize: '12px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#1a1a1a', cursor: 'pointer' },
    rateBtn: { padding: '4px 10px', fontSize: '11px', border: 'none', borderRadius: '6px', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: '500' },
    editRatingBtn: { background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
    lowRatingBadge: { background: '#fee2e2', color: '#991b1b', fontSize: '10px', padding: '1px 8px', borderRadius: '20px', marginLeft: '6px', fontWeight: '600' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '14px' },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#f1f5f9' : '#1a1a1a', background: isDark ? '#0f172a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    errorBox: { background: '#fef2f2', color: '#dc2626', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  return (
    <AdminLayout activePage="Manage Bookings">
      <h1 style={s.title}>Manage Bookings</h1>
      <p style={s.subtitle}>Track all customer bookings and manage booking statuses.</p>
      {loading ? <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p> : (
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
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
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
                <td style={s.td}><span style={s.payBadge}>{booking.payment}</span></td>
                <td style={s.td}>
                  {booking.refundStatus === 'requested' ? (
                    <div>
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
                  {booking.status === 'confirmed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={s.confirmed}>confirmed</span>
                      <button style={s.returnBtn} onClick={() => handleStatus(booking._id, 'completed')}>
                        Mark as Returned
                      </button>
                    </div>
                  ) : booking.status === 'cancelled' ? (
                    <span style={s.cancelled}>cancelled</span>
                  ) : booking.status === 'completed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={s.completed}>completed</span>
                      {booking.clientRating?.ratedAt ? (
                        <>
                          <StarRating value={booking.clientRating.rating} size={12} readOnly />
                          <button style={s.editRatingBtn} onClick={() => openRatingModal(booking)}>Edit rating</button>
                        </>
                      ) : (
                        <button style={s.rateBtn} onClick={() => openRatingModal(booking)}>Rate Client</button>
                      )}
                    </div>
                  ) : (
                    <select style={s.select} value={booking.status} onChange={(e) => handleStatus(booking._id, e.target.value)}>
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
      )}

      {ratingModalId && ratingBooking && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <h2 style={s.modalTitle}>Rate {ratingBooking.user?.name || 'Client'}</h2>

            {ratingError && <div style={s.errorBox}>{ratingError}</div>}

            <label style={s.modalLabel}>How did the client return the vehicle?</label>
            <div style={{ marginBottom: '18px' }}>
              <StarRating value={ratingValue} onChange={setRatingValue} size={24} />
            </div>

            <label style={s.modalLabel}>Comment (optional)</label>
            <textarea
              style={s.modalTextarea}
              rows={3}
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="e.g. Returned the car clean and on time."
            />

            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={closeRatingModal} disabled={ratingSubmitting}>
                Cancel
              </button>
              <button style={s.modalSubmitBtn} onClick={handleSubmitRating} disabled={ratingSubmitting}>
                {ratingSubmitting ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ManageBookings;