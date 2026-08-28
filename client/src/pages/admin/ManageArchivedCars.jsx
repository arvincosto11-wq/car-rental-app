import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';
import { SkeletonListCard } from '../../components/Skeleton';
import { useTheme } from '../../context/ThemeContext';
import { useUIFeedback } from '../../context/UIFeedbackContext';
import usePageTitle from '../../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD } from '../../theme';
import api from '../../api';

const ManageArchivedCars = () => {
  usePageTitle('Archived Cars');
  const { isDark } = useTheme();
  const { toast, confirm } = useUIFeedback();
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);

  useEffect(() => { fetchCars(); }, []);

  const fetchCars = async () => {
    try {
      const res = await api.get('/cars/archived');
      setCars(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    setWorkingId(id);
    try {
      await api.put(`/cars/${id}/restore`);
      setCars(cars.filter((c) => c._id !== id));
      toast.success('Car restored.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore this car.');
    } finally {
      setWorkingId(null);
    }
  };

  const handlePermanentDelete = async (car) => {
    const ok = await confirm(
      `Permanently delete ${car.brand} ${car.model}? This cannot be undone.`,
      { confirmLabel: 'Delete Permanently', danger: true }
    );
    if (!ok) return;
    setWorkingId(car._id);
    try {
      await api.delete(`/cars/${car._id}`);
      setCars(cars.filter((c) => c._id !== car._id));
      toast.success('Car permanently deleted.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete this car.');
    } finally {
      setWorkingId(null);
    }
  };

  const s = {
    backLink: { fontSize: '13px', color: isDark ? GOLD_DARK : GOLD, textDecoration: 'none', fontWeight: '500', marginBottom: '10px', display: 'inline-block' },
    title: { fontSize: '22px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '4px' },
    subtitle: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '24px' },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    card: { display: 'flex', gap: '14px', alignItems: 'center', background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' },
    thumb: { width: '70px', height: '52px', borderRadius: '8px', overflow: 'hidden', background: isDark ? '#334155' : '#f3f4f6', flexShrink: 0 },
    info: { flex: 1, minWidth: 0 },
    carName: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    carSub: { fontSize: '12px', color: isDark ? '#94a3b8' : '#9ca3af', marginTop: '2px' },
    archivedDate: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    actions: { display: 'flex', gap: '8px', flexShrink: 0 },
    restoreBtn: { padding: '6px 14px', fontSize: '12px', fontWeight: '600', border: 'none', borderRadius: '6px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, cursor: 'pointer' },
    deleteBtn: { padding: '6px 14px', fontSize: '12px', fontWeight: '600', border: `1px solid ${isDark ? '#7f1d1d' : '#fca5a5'}`, borderRadius: '6px', background: isDark ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: isDark ? '#fca5a5' : '#dc2626', cursor: 'pointer' },
  };

  return (
    <AdminLayout activePage="Manage Cars">
      <Link to="/admin/manage-cars" style={s.backLink}>← Back to Manage Cars</Link>
      <h1 style={s.title}>Archived Cars</h1>
      <p style={s.subtitle}>Removed from listings but not deleted. Restore anytime, or delete permanently if it has no booking history.</p>

      {loading ? (
        <SkeletonListCard isDark={isDark} count={3} />
      ) : cars.length === 0 ? (
        <div style={s.empty}>No archived cars.</div>
      ) : (
        cars.map((car) => (
          <div key={car._id} style={s.card}>
            <div style={s.thumb}>
              {car.image && <img src={car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={s.info}>
              <div style={s.carName}>{car.brand} {car.model}</div>
              <div style={s.carSub}>{car.year} · {car.category}</div>
              {car.archivedAt && <div style={s.archivedDate}>Archived {new Date(car.archivedAt).toLocaleDateString()}</div>}
            </div>
            <div style={s.actions}>
              <button style={s.restoreBtn} disabled={workingId === car._id} onClick={() => handleRestore(car._id)}>
                Restore
              </button>
              <button style={s.deleteBtn} disabled={workingId === car._id} onClick={() => handlePermanentDelete(car)}>
                Delete Permanently
              </button>
            </div>
          </div>
        ))
      )}
    </AdminLayout>
  );
};

export default ManageArchivedCars;
