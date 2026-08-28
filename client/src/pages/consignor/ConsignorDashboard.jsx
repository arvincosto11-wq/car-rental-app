import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import { SkeletonListCard, SkeletonTableRows } from '../../components/Skeleton';
import api from '../../api';

const ConsignorDashboard = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { toast } = useUIFeedback();
  const navigate = useNavigate();
  const [consignments, setConsignments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [requestModalCarId, setRequestModalCarId] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [earningsPeriod, setEarningsPeriod] = useState('month');

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchConsignments();
    fetchBookings();
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

  const fetchBookings = async () => {
    try {
      const res = await api.get('/bookings/owner');
      setBookings(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleToggleAvailability = async (car) => {
    if (car.isAvailable) {
      setRequestModalCarId(car._id);
      setRequestReason('');
      setRequestError('');
      return;
    }
    try {
      await api.put(`/cars/${car._id}/toggle`);
      fetchConsignments();
      toast.success('Vehicle marked available.');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Something went wrong updating availability.');
    }
  };

  const closeRequestModal = () => {
    setRequestModalCarId(null);
    setRequestError('');
  };

  const handleSubmitRequest = async () => {
    setRequestSubmitting(true);
    setRequestError('');
    try {
      await api.put(`/cars/${requestModalCarId}/toggle`, { reason: requestReason });
      await fetchConsignments();
      closeRequestModal();
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Something went wrong submitting this request.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'approved') return s.badgeApproved;
    if (status === 'declined') return s.badgeDeclined;
    return s.badgePending;
  };

  const getBookingBadge = (status) => {
    if (status === 'confirmed') return s.bookingConfirmed;
    if (status === 'cancelled') return s.bookingCancelled;
    if (status === 'completed') return s.bookingCompleted;
    return s.bookingPending;
  };

  const approvedCount = consignments.filter((c) => c.status === 'approved').length;
  const pendingCount = consignments.filter((c) => c.status === 'pending').length;

  const earnedBookings = bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sumEarningsSince = (cutoff) => earnedBookings
    .filter((b) => new Date(b.createdAt) >= cutoff)
    .reduce((sum, b) => sum + b.totalPrice, 0);
  const earnings = {
    week: sumEarningsSince(startOfWeek),
    month: sumEarningsSince(startOfMonth),
    all: earnedBookings.reduce((sum, b) => sum + b.totalPrice, 0),
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '900px', margin: '0 auto', padding: '32px' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
    title: { fontSize: '28px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280' },
    addBtn: { padding: '10px 20px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '28px' },
    statCard: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px' },
    statLabel: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '6px' },
    statNum: { fontSize: '26px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    earningsBox: { background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '18px', marginBottom: '28px' },
    earningsLabel: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '10px' },
    earningsNum: { fontSize: '28px', fontWeight: '700', color: isDark ? GOLD_DARK : GOLD, marginTop: '14px' },
    periodToggleRow: { display: 'flex', gap: '8px' },
    periodBtn: (active) => ({
      padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
      border: active ? 'none' : `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
      background: active ? (isDark ? GOLD_DARK : GOLD) : 'transparent',
      color: active ? ON_GOLD : (isDark ? '#94a3b8' : '#6b7280'),
      cursor: 'pointer',
    }),
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
    cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' },
    availableTag: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    unavailableTag: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', fontWeight: '600' },
    toggleBtn: { padding: '6px 14px', fontSize: '12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '6px', background: isDark ? '#0f172a' : '#fff', color: isDark ? '#f1f5f9' : '#374151', cursor: 'pointer', fontWeight: '500' },
    sectionTitle: { fontSize: '20px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginTop: '36px', marginBottom: '4px' },
    sectionSubtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '16px' },
    table: { width: '100%', borderCollapse: 'collapse', background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    th: { textAlign: 'left', padding: '12px 16px', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, fontWeight: '500' },
    td: { padding: '12px 16px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#1a1a1a', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, verticalAlign: 'middle' },
    bookingPending: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    bookingConfirmed: { background: '#d1fae5', color: '#065f46', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    bookingCancelled: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    bookingCompleted: { background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    carCell: { display: 'flex', alignItems: 'center', gap: '10px' },
    clientName: { fontWeight: '600', fontSize: '13px' },
    clientMeta: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280' },
    carThumb: { width: '44px', height: '32px', background: isDark ? '#334155' : '#f3f4f6', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 },
    payBadge: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    refundApproved: { background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    refundDeclined: { background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    refundRequested: { background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 10px', borderRadius: '20px' },
    muted: { color: isDark ? '#64748b' : '#9ca3af', fontSize: '12px' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
    modalContent: { background: isDark ? '#1e293b' : '#fff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '100%' },
    modalTitle: { fontSize: '18px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '6px' },
    modalSub: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '14px', lineHeight: '1.5' },
    errorBox: { background: '#fef2f2', color: '#dc2626', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px' },
    modalLabel: { display: 'block', fontSize: '13px', color: isDark ? '#94a3b8' : '#374151', marginBottom: '6px', fontWeight: '500' },
    modalTextarea: { width: '100%', padding: '10px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px', fontSize: '13px', marginBottom: '18px', color: isDark ? '#f1f5f9' : '#1a1a1a', background: isDark ? '#0f172a' : '#fff', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    modalActions: { display: 'flex', gap: '10px' },
    modalCancelBtn: { flex: 1, padding: '10px', background: isDark ? '#334155' : '#f3f4f6', color: isDark ? '#f1f5f9' : '#374151', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' },
    modalSubmitBtn: { flex: 1, padding: '10px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  };

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={s.headerRow}>
          <div>
            <h1 style={s.title}>My Vehicles</h1>
            <p style={s.subtitle}>Track the status of your consignment applications.</p>
          </div>
          <Link className="btn-like" to="/consignor/add-vehicle" style={s.addBtn}>+ Add Another Vehicle</Link>
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

        <div style={s.earningsBox}>
          <div style={s.earningsLabel}>Earnings from confirmed & completed bookings</div>
          <div style={s.periodToggleRow}>
            <button type="button" style={s.periodBtn(earningsPeriod === 'week')} onClick={() => setEarningsPeriod('week')}>This Week</button>
            <button type="button" style={s.periodBtn(earningsPeriod === 'month')} onClick={() => setEarningsPeriod('month')}>This Month</button>
            <button type="button" style={s.periodBtn(earningsPeriod === 'all')} onClick={() => setEarningsPeriod('all')}>All Time</button>
          </div>
          <div style={s.earningsNum}>₱{earnings[earningsPeriod].toLocaleString()}</div>
        </div>

        {loading ? (
          <SkeletonListCard isDark={isDark} />
        ) : consignments.length === 0 ? (
          <div style={s.empty}>
            <p>You haven't submitted any vehicles yet.</p>
            <Link className="btn-like" to="/consignor/add-vehicle" style={s.addBtn}>Submit Your First Vehicle</Link>
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
                <div style={s.carSub}>{c.plateNumber} · {c.category} · {c.transmission}</div>
                <div style={s.price}>Suggested price: ₱{c.suggestedPricePerDay}/day</div>
                {c.status === 'declined' && c.adminNotes && (
                  <div style={s.notesBox}>Reason: {c.adminNotes}</div>
                )}
                {c.status === 'approved' && c.linkedCar && (
                  <>
                    <div style={s.cardFooter}>
                      <span style={c.linkedCar.isAvailable ? s.availableTag : s.unavailableTag}>
                        {c.linkedCar.isAvailable ? 'Available for booking' : 'Hidden from listings'}
                      </span>
                      {c.linkedCar.availabilityRequest?.status === 'pending' ? (
                        <span style={s.badgePending}>Pending Admin Approval</span>
                      ) : (
                        <button style={s.toggleBtn} onClick={() => handleToggleAvailability(c.linkedCar)}>
                          {c.linkedCar.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                        </button>
                      )}
                    </div>
                    {c.linkedCar.availabilityRequest?.status === 'declined' && (
                      <div style={s.notesBox}>
                        Your request to mark this vehicle unavailable was declined
                        {c.linkedCar.availabilityRequest.adminNotes ? `: ${c.linkedCar.availabilityRequest.adminNotes}` : '.'}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}

        <h2 style={s.sectionTitle}>Booking History</h2>
        <p style={s.sectionSubtitle}>Track bookings for your listed vehicles. Approving or declining bookings is handled by our admin team.</p>

        {!bookingsLoading && bookings.length === 0 ? (
          <div style={s.empty}>
            <p>No bookings yet for your vehicles.</p>
          </div>
        ) : (
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
                <th style={s.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookingsLoading ? <SkeletonTableRows isDark={isDark} columns={7} /> : bookings.map((b) => (
                <tr key={b._id}>
                  <td style={s.td}>
                    <div style={s.clientName}>{b.user?.name || 'Unknown'}</div>
                  </td>
                  <td style={s.td}>
                    <div style={s.carCell}>
                      <div style={s.carThumb}>
                        {b.car?.image && <img src={b.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <span>{b.car?.brand} {b.car?.model}</span>
                    </div>
                  </td>
                  <td style={s.td}>{new Date(b.startDate).toLocaleDateString()} to {new Date(b.endDate).toLocaleDateString()}</td>
                  <td style={s.td}>₱{b.totalPrice}</td>
                  <td style={s.td}><span style={s.payBadge}>{b.payment}</span></td>
                  <td style={s.td}>
                    {b.refundStatus === 'requested' ? (
                      <span style={s.refundRequested}>Refund Requested</span>
                    ) : b.refundStatus === 'approved' ? (
                      <span style={s.refundApproved}>Refund Approved</span>
                    ) : b.refundStatus === 'declined' ? (
                      <span style={s.refundDeclined}>Refund Declined</span>
                    ) : (
                      <span style={s.muted}>—</span>
                    )}
                  </td>
                  <td style={s.td}><span style={getBookingBadge(b.status)}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {requestModalCarId && (
        <div style={s.modalOverlay}>
          <div style={s.modalContent}>
            <h2 style={s.modalTitle}>Request to Mark Unavailable</h2>
            <p style={s.modalSub}>
              This vehicle will stay bookable until an admin reviews and approves your request.
            </p>

            {requestError && <div style={s.errorBox}>{requestError}</div>}

            <label style={s.modalLabel}>Reason (optional)</label>
            <textarea
              style={s.modalTextarea}
              rows={3}
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="e.g. Vehicle needs maintenance, taking it off the platform, etc."
            />

            <div style={s.modalActions}>
              <button style={s.modalCancelBtn} onClick={closeRequestModal} disabled={requestSubmitting}>
                Cancel
              </button>
              <button style={s.modalSubmitBtn} onClick={handleSubmitRequest} disabled={requestSubmitting}>
                {requestSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsignorDashboard;
