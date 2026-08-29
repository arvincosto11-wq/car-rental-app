import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

const DROPDOWN_LIMIT = 8;

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

// Bell icon + unread badge + dropdown, used in both the client/consignor
// Navbar and the admin top bar. Polls periodically so a badge appears
// without the user needing to refresh.
const NotificationBell = ({ isDark, iconColor, btnBg, btnBorder }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowAll(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = async (n) => {
    setOpen(false);
    if (!n.read) {
      setNotifications(notifications.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      try {
        await api.put(`/notifications/${n._id}/read`);
      } catch (err) {
        console.error(err);
      }
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAllRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
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

  const handleViewAll = () => setShowAll(true);

  const s = {
    wrap: { position: 'relative' },
    btn: {
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px', borderRadius: '8px', border: `1px solid ${btnBorder}`, background: btnBg,
      color: iconColor, cursor: 'pointer',
    },
    badge: {
      position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px',
      borderRadius: '20px', background: '#dc2626', color: '#fff', fontSize: '10px', fontWeight: '700',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
    },
    panel: {
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '320px', maxHeight: '400px',
      overflowY: 'auto', background: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.16)', zIndex: 300,
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px',
      borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`,
    },
    headerTitle: { fontSize: '13px', fontWeight: '700', color: isDark ? '#f1f5f9' : '#1a1a1a' },
    markAllBtn: { background: 'none', border: 'none', color: isDark ? GOLD_DARK : GOLD, fontSize: '11px', cursor: 'pointer', fontWeight: '600' },
    item: (read) => ({
      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
      borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`, cursor: 'pointer',
      background: read ? 'transparent' : (isDark ? 'rgba(232,161,0,0.08)' : 'rgba(184,121,10,0.06)'),
    }),
    itemTitleRow: { display: 'flex', alignItems: 'center', gap: '6px' },
    dot: { width: '6px', height: '6px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, flexShrink: 0 },
    itemTitle: { fontSize: '12px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', flex: 1 },
    itemMsg: { fontSize: '11px', color: isDark ? '#94a3b8' : '#6b7280', marginTop: '2px' },
    itemTime: { fontSize: '10px', color: isDark ? '#64748b' : '#9ca3af', marginTop: '4px' },
    deleteBtn: {
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
      color: isDark ? '#64748b' : '#9ca3af', fontSize: '14px', lineHeight: 1,
    },
    empty: { padding: '24px 14px', textAlign: 'center', fontSize: '12px', color: isDark ? '#94a3b8' : '#6b7280' },
    viewAllBtn: {
      display: 'block', width: '100%', textAlign: 'center', padding: '10px', border: 'none', background: 'none',
      color: isDark ? GOLD_DARK : GOLD, fontSize: '12px', fontWeight: '700', cursor: 'pointer',
    },
  };

  return (
    <div ref={ref} style={s.wrap}>
      <button style={s.btn} onClick={() => { setOpen((v) => !v); setShowAll(false); }} aria-label="Notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span style={s.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div style={s.panel}>
          <div style={s.header}>
            <span style={s.headerTitle}>Notifications</span>
            {unreadCount > 0 && <button style={s.markAllBtn} onClick={handleMarkAllRead}>Mark all read</button>}
          </div>
          {notifications.length === 0 ? (
            <div style={s.empty}>No notifications yet.</div>
          ) : (
            <>
              {(showAll ? notifications : notifications.slice(0, DROPDOWN_LIMIT)).map((n) => (
                <div
                  key={n._id}
                  style={s.item(n.read)}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(n)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) handleItemClick(n); }}
                >
                  <div style={s.itemTitleRow}>
                    {!n.read && <span style={s.dot} />}
                    <span style={s.itemTitle}>{n.title}</span>
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
                  {n.message && <div style={s.itemMsg}>{n.message}</div>}
                  <div style={s.itemTime}>{timeAgo(n.createdAt)}</div>
                </div>
              ))}
              {!showAll && notifications.length > DROPDOWN_LIMIT && (
                <button style={s.viewAllBtn} onClick={handleViewAll}>View All</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
