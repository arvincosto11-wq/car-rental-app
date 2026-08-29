import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Navbar from '../components/Navbar';
import AdminLayout from '../components/AdminLayout';
import Skeleton from '../components/Skeleton';
import usePageTitle from '../hooks/usePageTitle';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import api from '../api';

const timeAgo = (dateStr) => {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const Notifications = () => {
  usePageTitle('Notifications');
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return navigate('/login');
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = async (n) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      try {
        await api.put(`/notifications/${n._id}/read`);
      } catch (err) {
        console.error(err);
      }
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.put('/notifications/read-all');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    container: { maxWidth: '640px', margin: '0 auto', padding: '32px' },
    headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' },
    title: { fontSize: '26px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    subtitle: { fontSize: '14px', color: isDark ? '#94a3b8' : '#6b7280', marginBottom: '20px' },
    markAllBtn: {
      background: 'none', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, borderRadius: '8px',
      color: isDark ? GOLD_DARK : GOLD, fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: '7px 14px',
    },
    empty: { textAlign: 'center', padding: '48px', color: isDark ? '#94a3b8' : '#6b7280' },
    list: { display: 'flex', flexDirection: 'column', gap: '10px' },
    item: (read) => ({
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px 16px', borderRadius: '10px',
      cursor: 'pointer', background: read ? (isDark ? '#1e293b' : '#fff') : (isDark ? 'rgba(232,161,0,0.1)' : 'rgba(184,121,10,0.07)'),
      border: `1px solid ${read ? (isDark ? '#334155' : '#e5e7eb') : (isDark ? GOLD_DARK : GOLD)}`,
    }),
    dot: { width: '7px', height: '7px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, flexShrink: 0, marginTop: '6px' },
    itemBody: { flex: 1, minWidth: 0 },
    itemTitle: { fontSize: '14px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    itemMsg: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '3px' },
    itemTime: { fontSize: '11px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '6px' },
    deleteBtn: {
      background: 'none', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0,
      color: isDark ? '#64748b' : '#9ca3af', fontSize: '18px', lineHeight: 1,
    },
  };

  const content = (
    <div style={s.container}>
      <div style={s.headerRow}>
        <h1 style={s.title}>Notifications</h1>
        {unreadCount > 0 && <button style={s.markAllBtn} onClick={handleMarkAllRead}>Mark all read</button>}
      </div>
      <p style={s.subtitle}>Everything we've sent you, most recent first.</p>

      {loading ? (
        <div style={s.list}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="64px" radius="10px" isDark={isDark} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div style={s.empty}>No notifications yet.</div>
      ) : (
        <div style={s.list}>
          {notifications.map((n) => (
            <div
              key={n._id}
              style={s.item(n.read)}
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(n)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) handleItemClick(n); }}
            >
              {!n.read && <span style={s.dot} />}
              <div style={s.itemBody}>
                <div style={s.itemTitle}>{n.title}</div>
                {n.message && <div style={s.itemMsg}>{n.message}</div>}
                <div style={s.itemTime}>{timeAgo(n.createdAt)}</div>
              </div>
              <button
                type="button"
                className="icon-toggle-btn"
                style={s.deleteBtn}
                onClick={(e) => handleDelete(e, n._id)}
                aria-label="Delete notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (user?.role === 'admin') {
    return <AdminLayout activePage="">{content}</AdminLayout>;
  }

  return (
    <div style={s.page}>
      <Navbar />
      {content}
    </div>
  );
};

export default Notifications;
