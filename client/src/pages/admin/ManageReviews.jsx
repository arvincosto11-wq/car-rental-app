import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import { SkeletonListCard } from '../../components/Skeleton';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../api';

const ManageReviews = () => {
  usePageTitle('Manage Reviews');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [workingId, setWorkingId] = useState(null);

  useEffect(() => { fetchReviews(); }, []);

  const fetchReviews = async () => {
    try {
      const res = await api.get('/cars/reviews/all');
      setReviews(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHidden = async (review) => {
    const nextHidden = !review.hidden;
    if (nextHidden) {
      const ok = await confirm(
        `Hide this review from ${review.reviewerName}? It will disappear from the public car page and no longer count toward the vehicle's average rating.`,
        { confirmLabel: 'Hide Review', danger: true }
      );
      if (!ok) return;
    }
    setWorkingId(review._id);
    try {
      await api.put(`/bookings/${review._id}/rate-car/moderate`, { hidden: nextHidden });
      setReviews((prev) => prev.map((r) => (r._id === review._id ? { ...r, hidden: nextHidden } : r)));
      toast.success(nextHidden ? 'Review hidden.' : 'Review restored.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong updating this review.');
    } finally {
      setWorkingId(null);
    }
  };

  const filtered = reviews.filter((r) => {
    const matchVisibility = visibilityFilter === 'all' ? true : visibilityFilter === 'hidden' ? r.hidden : !r.hidden;
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || r.reviewerName?.toLowerCase().includes(q)
      || r.reviewerEmail?.toLowerCase().includes(q)
      || `${r.car?.brand} ${r.car?.model}`.toLowerCase().includes(q);
    return matchVisibility && matchSearch;
  });

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' },
    searchInput: {
      flex: '1 1 220px', padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', outline: 'none', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#111827',
    },
    select: {
      padding: '9px 12px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', background: isDark ? '#1e293b' : '#fff', color: isDark ? '#f1f5f9' : '#111827', cursor: 'pointer',
    },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    card: (hidden) => ({
      display: 'flex', gap: '14px', background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${hidden ? (isDark ? '#7f1d1d' : '#fca5a5') : (isDark ? '#334155' : '#e5e7eb')}`,
      borderRadius: '12px', padding: '16px', marginBottom: '12px',
      opacity: hidden ? 0.75 : 1,
    }),
    thumb: { width: '64px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    info: { flex: 1, minWidth: 0 },
    topRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
    carName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    reviewerName: { fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    hiddenBadge: { fontSize: '10px', fontWeight: '700', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '20px' },
    date: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginLeft: 'auto' },
    comment: { fontSize: '13px', color: isDark ? '#cbd5e1' : '#374151', lineHeight: '1.5', marginTop: '6px' },
    photoGrid: { display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' },
    photo: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' },
    actionsRow: { marginTop: '10px' },
    hideBtn: (hidden) => ({
      padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
      border: 'none', background: hidden ? '#16a34a' : '#dc2626', color: '#fff',
    }),
  };

  return (
    <AdminLayout activePage="Manage Reviews">
      <h1 style={s.title}>Manage Reviews</h1>
      <p style={s.subtitle}>Hide any review that's abusive, spam, or otherwise inappropriate. Hidden reviews stay recorded but drop out of the public car page and the vehicle's average rating.</p>

      <div style={s.filterRow}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search by reviewer, email, or car..."
          aria-label="Search reviews"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={s.select} value={visibilityFilter} aria-label="Filter by visibility" onChange={(e) => setVisibilityFilter(e.target.value)}>
          <option value="all">All Reviews</option>
          <option value="visible">Visible Only</option>
          <option value="hidden">Hidden Only</option>
        </select>
      </div>

      {loading ? (
        <SkeletonListCard isDark={isDark} />
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No reviews match.</div>
      ) : (
        filtered.map((r) => (
          <div key={r._id} style={s.card(r.hidden)}>
            <div style={s.thumb}>
              {r.car?.image && <img src={r.car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={s.info}>
              <div style={s.topRow}>
                <span style={s.carName}>{r.car ? `${r.car.brand} ${r.car.model}` : 'Deleted vehicle'}</span>
                <span style={s.reviewerName}>by {r.reviewerName} ({r.reviewerEmail})</span>
                {r.hidden && <span style={s.hiddenBadge}>Hidden</span>}
                <span style={s.date}>{new Date(r.ratedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StarRating value={r.overall} size={13} readOnly />
                <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' }}>{r.overall.toFixed(1)}</span>
              </div>
              {r.comment && <p style={s.comment}>{r.comment}</p>}
              {r.photos?.length > 0 && (
                <div style={s.photoGrid}>
                  {r.photos.map((p, i) => (
                    <img key={i} src={p.url} alt={`Review photo ${i + 1}`} style={s.photo} />
                  ))}
                </div>
              )}
              <div style={s.actionsRow}>
                <button
                  style={s.hideBtn(r.hidden)}
                  disabled={workingId === r._id}
                  onClick={() => handleToggleHidden(r)}
                >
                  {workingId === r._id ? 'Working...' : r.hidden ? 'Unhide Review' : 'Hide Review'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </AdminLayout>
  );
};

export default ManageReviews;
