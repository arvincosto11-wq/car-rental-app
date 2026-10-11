import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import AdminLayout from '../../components/AdminLayout';
import StarRating from '../../components/StarRating';
import DriverAvatar from '../../components/DriverAvatar';
import { SkeletonListCard } from '../../components/Skeleton';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, goldInk } from '../../theme';
import api from '../../api';

// Reviews of the vehicles and reviews of the people who drive them, on one
// screen behind a toggle.
//
// Together rather than apart because moderation is about catching something
// you did not know was there. A review of a driver sitting on that driver's
// own page would only be found by opening every driver in turn, which is
// not how anybody finds a review they were not looking for.
const ManageReviews = () => {
  usePageTitle('Manage Reviews');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const [reviews, setReviews] = useState([]);
  const [driverReviews, setDriverReviews] = useState([]);
  const [tab, setTab] = useState('vehicles');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // One filter at a time, grouped by what it asks about. Two dropdowns let
  // you combine them, which sounds better than it reads: on a shop this
  // size the question is almost always a single one — show me the one-star
  // ones, show me the hidden ones — and two controls to answer it made the
  // row look like a report builder.
  const [filter, setFilter] = useState('all');
  const [workingId, setWorkingId] = useState(null);

  useEffect(() => { fetchReviews(); }, []);

  // Both lists at once: the counts on the tabs have to be right before
  // anybody clicks one, or the toggle is just two buttons.
  const fetchReviews = async () => {
    try {
      const [cars, drivers] = await Promise.all([
        api.get('/cars/reviews/all'),
        api.get('/drivers/reviews'),
      ]);
      setReviews(cars.data);
      setDriverReviews(drivers.data);
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

  // A person, not a vehicle, so the warning says so: a driver reads their
  // own reviews, and one taken down is one they will ask about.
  const handleToggleDriverHidden = async (review) => {
    const nextHidden = !review.hidden;
    if (nextHidden) {
      const ok = await confirm(
        `Hide this review of ${review.driver?.name || 'this driver'} from ${review.reviewerName}? `
        + 'It stops counting toward their rating, and the client is told it was removed.',
        { confirmLabel: 'Hide Review', danger: true },
      );
      if (!ok) return;
    }
    setWorkingId(review._id);
    try {
      await api.put(`/bookings/${review._id}/rate-driver/moderate`, { hidden: nextHidden });
      setDriverReviews((prev) => prev.map((r) => (r._id === review._id ? { ...r, hidden: nextHidden } : r)));
      toast.success(nextHidden ? 'Review hidden.' : 'Review restored.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong updating this review.');
    } finally {
      setWorkingId(null);
    }
  };

  // Everything the dropdown can ask, in one place. A star filter rounds the
  // score, because an average of three categories lands on 4.7 and nobody
  // thinks of that as anything but five stars.
  const matchesFilter = (r, score, comment, photos) => {
    if (filter === 'visible') return !r.hidden;
    if (filter === 'hidden') return !!r.hidden;
    if (filter === 'comments') return !!comment?.trim();
    if (filter === 'photos') return (photos?.length || 0) > 0;
    if (filter.startsWith('star')) return Math.round(Number(score)) === Number(filter.slice(4));
    return true;
  };

  // What each option would find, shown beside it. Counted over the whole
  // tab rather than over what the search has already narrowed, so the
  // numbers do not move while somebody is typing.
  const countOf = (rows, pick) => rows.filter(pick).length;
  const tabRows = tab === 'drivers' ? driverReviews : reviews;
  const scoreOf = (r) => (tab === 'drivers' ? r.rating : r.overall);
  const counts = {
    hidden: countOf(tabRows, (r) => r.hidden),
    visible: countOf(tabRows, (r) => !r.hidden),
    comments: countOf(tabRows, (r) => !!r.comment?.trim()),
    photos: countOf(tabRows, (r) => (r.photos?.length || 0) > 0),
    stars: [5, 4, 3, 2, 1].map((n) => ({ n, count: countOf(tabRows, (r) => Math.round(Number(scoreOf(r))) === n) })),
  };

  const filteredDrivers = driverReviews.filter((r) => {
    const q = search.trim().toLowerCase();
    return matchesFilter(r, r.rating, r.comment) && (!q
      || r.driver?.name?.toLowerCase().includes(q)
      || r.reviewerName?.toLowerCase().includes(q)
      || r.reviewerEmail?.toLowerCase().includes(q)
      || r.car?.toLowerCase().includes(q));
  });

  const filtered = reviews.filter((r) => {
    const matchFilter = matchesFilter(r, r.overall, r.comment, r.photos);
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || r.reviewerName?.toLowerCase().includes(q)
      || r.reviewerEmail?.toLowerCase().includes(q)
      || `${r.car?.brand} ${r.car?.model}`.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const s = {
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280', marginBottom: '20px' },
    tabRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
    tab: (on) => ({
      fontSize: '12.5px', fontWeight: '700', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: 'inherit',
      border: `1px solid ${on ? (isDark ? GOLD_DARK : GOLD) : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      background: on ? (isDark ? 'rgba(232,161,0,0.12)' : 'rgba(184,121,10,0.08)') : 'transparent',
      color: on ? goldInk(isDark) : (isDark ? '#b0b3b8' : '#6b7280'),
    }),
    filterRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' },
    searchInput: {
      flex: '1 1 220px', padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', outline: 'none', background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#111827',
    },
    select: {
      padding: '9px 12px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, borderRadius: '8px',
      fontSize: '13px', background: isDark ? '#242526' : '#fff', color: isDark ? '#e4e6eb' : '#111827', cursor: 'pointer',
    },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#b0b3b8' : '#6b7280' },
    card: (hidden) => ({
      display: 'flex', gap: '14px', background: isDark ? '#242526' : '#fff',
      border: `1px solid ${hidden ? (isDark ? '#7f1d1d' : '#fca5a5') : (isDark ? '#3a3b3c' : '#e5e7eb')}`,
      borderRadius: '12px', padding: '16px', marginBottom: '12px',
      opacity: hidden ? 0.75 : 1,
    }),
    thumb: { width: '64px', height: '48px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#3a3b3c' : '#f3f4f6', flexShrink: 0 },
    info: { flex: 1, minWidth: 0 },
    topRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
    carName: { fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' },
    reviewerName: { fontSize: '12px', color: isDark ? '#b0b3b8' : '#6b7280' },
    hiddenBadge: {
      fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px',
      background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#991b1b',
      border: isDark ? '1px solid rgba(220,38,38,0.35)' : 'none',
    },
    date: { fontSize: '11px', color: isDark ? '#8a8d91' : '#9ca3af', marginLeft: 'auto' },
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
      <p style={s.subtitle}>
        {tab === 'vehicles'
          ? "Hide any review that's abusive, spam, or otherwise inappropriate. Hidden reviews stay recorded but drop out of the public car page and the vehicle's average rating."
          : 'Reviews of the people who drive. Hidden ones stay recorded but stop counting toward that driver\u2019s rating, and the client is told theirs was removed.'}
      </p>

      <div style={s.tabRow} role="group" aria-label="What to moderate">
        <button type="button" style={s.tab(tab === 'vehicles')} aria-pressed={tab === 'vehicles'} onClick={() => setTab('vehicles')}>
          Vehicles ({reviews.length})
        </button>
        <button
          type="button"
          style={s.tab(tab === 'drivers')}
          aria-pressed={tab === 'drivers'}
          onClick={() => { setTab('drivers'); if (filter === 'photos') setFilter('all'); }}
        >
          Drivers ({driverReviews.length})
        </button>
      </div>

      <div style={s.filterRow}>
        <input
          style={s.searchInput}
          type="text"
          placeholder={tab === 'vehicles' ? 'Search by reviewer, email, or car...' : 'Search by driver, reviewer, or vehicle...'}
          aria-label="Search reviews"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={s.select} value={filter} aria-label="Filter reviews" onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Reviews ({tabRows.length})</option>
          <optgroup label="Visibility">
            <option value="visible">Visible ({counts.visible})</option>
            <option value="hidden">Hidden ({counts.hidden})</option>
          </optgroup>
          <optgroup label="What's in it">
            <option value="comments">With Comments ({counts.comments})</option>
            {/* A driver review has no photographs to carry, so the option is
                not offered on that tab rather than offered and always
                empty. */}
            {tab === 'vehicles' && <option value="photos">With Photos ({counts.photos})</option>}
          </optgroup>
          <optgroup label="Rating">
            {counts.stars.map(({ n, count }) => (
              <option key={n} value={`star${n}`}>{n} Star{n === 1 ? '' : 's'} ({count})</option>
            ))}
          </optgroup>
        </select>
      </div>

      {loading ? (
        <SkeletonListCard isDark={isDark} />
      ) : tab === 'drivers' ? (
        filteredDrivers.length === 0 ? (
          <div style={s.empty}>
            {driverReviews.length === 0
              ? 'Nobody has rated a driver yet. Reviews appear here once a trip with a driver is finished and rated.'
              : 'No reviews match.'}
          </div>
        ) : filteredDrivers.map((r) => (
          <div key={r._id} style={s.card(r.hidden)}>
            <DriverAvatar driver={r.driver} isDark={isDark} size={48} />
            <div style={s.info}>
              <div style={s.topRow}>
                <span style={s.carName}>{r.driver?.name || 'Removed driver'}</span>
                <span style={s.reviewerName}>by {r.reviewerName} ({r.reviewerEmail})</span>
                {r.hidden && <span style={s.hiddenBadge}>Hidden</span>}
                <span style={s.date}>{new Date(r.ratedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StarRating value={r.rating} size={13} readOnly />
                <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' }}>
                  {Number(r.rating).toFixed(1)}
                </span>
                {r.car && <span style={s.reviewerName}>&middot; {r.car}</span>}
              </div>
              {r.comment && <p style={s.comment}>{r.comment}</p>}
              <div style={s.actionsRow}>
                <button
                  style={s.hideBtn(r.hidden)}
                  disabled={workingId === r._id}
                  onClick={() => handleToggleDriverHidden(r)}
                >
                  {workingId === r._id ? 'Working...' : r.hidden ? 'Unhide Review' : 'Hide Review'}
                </button>
              </div>
            </div>
          </div>
        ))
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
                <span style={{ fontSize: '12px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' }}>{r.overall.toFixed(1)}</span>
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
