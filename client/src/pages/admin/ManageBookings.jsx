import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import api from '../../api';

const ManageBookings = () => {
  const { isDark } = useTheme();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

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
  };

  return (
    <AdminLayout activePage="Manage Bookings">
      <h1 style={s.title}>Manage Bookings</h1>
      <p style={s.subtitle}>Track all customer bookings and manage booking statuses.</p>
      {loading ? <p style={{ color: isDark ? '#94a3b8' : '#6b7280' }}>Loading...</p> : (
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
                  <div style={s.clientName}>{booking.user?.name || 'Unknown'}</div>
                  <div style={s.clientMeta}>{booking.user?.email}</div>
                  <div style={s.clientMeta}>ID: {booking.user?._id?.slice(-6) || '—'}</div>
                </td>
                <td style={s.td}>
                  <div style={s.carCell}>
                    <div style={s.carThumb}>
                      {booking.car?.image && <img src={booking.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <span>{booking.car?.brand} {booking.car?.model}</span>
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
                    <span style={s.completed}>completed</span>
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
      )}
    </AdminLayout>
  );
};

export default ManageBookings;