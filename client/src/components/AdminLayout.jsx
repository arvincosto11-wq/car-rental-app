import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';
import NotificationBell from './NotificationBell';
import useAdminPendingCounts from '../hooks/useAdminPendingCounts';

const AdminLayout = ({ children, activePage }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { counts } = useAdminPendingCounts();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#18191a' : '#f9fafb' },
    topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 32px', background: isDark ? '#242526' : '#fff', borderBottom: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}` },
    topRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    welcome: { fontSize: '13px', color: isDark ? '#b0b3b8' : '#6b7280' },
    toggleBtn: { padding: '6px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, background: isDark ? '#242526' : '#f9fafb', color: isDark ? '#e4e6eb' : '#1a1a1a', fontSize: '16px', cursor: 'pointer' },
    logoutBtn: { padding: '7px 16px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    layout: { display: 'grid', gridTemplateColumns: '180px 1fr' },
    sidebar: { background: isDark ? '#242526' : '#fff', borderRight: `1px solid ${isDark ? '#3a3b3c' : '#e5e7eb'}`, padding: '24px 0', minHeight: 'calc(100vh - 45px)' },
    avatar: { width: '48px', height: '48px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', margin: '0 auto 8px' },
    adminName: { textAlign: 'center', fontSize: '13px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a', marginBottom: '24px' },
    sideItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', fontSize: '13px', color: isDark ? '#b0b3b8' : '#4b5563', textDecoration: 'none' },
    sideItemActive: { background: isDark ? GOLD_TINT_DARK : GOLD_TINT, color: isDark ? GOLD_DARK : GOLD, borderLeft: `3px solid ${isDark ? GOLD_DARK : GOLD}` },
    sideDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 },
  };

    const sideLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/analytics', label: 'Analytics' },
    { to: '/admin/add-car', label: 'Add Vehicle' },
    { to: '/admin/manage-cars', label: 'Manage Cars' },
    { to: '/admin/manage-bookings', label: 'Manage Bookings' },
    { to: '/admin/manage-clients', label: 'Manage Clients' },
    { to: '/admin/manage-consignments', label: 'Manage Consignments' },
    { to: '/admin/availability-requests', label: 'Availability Requests' },
    { to: '/admin/manage-reviews', label: 'Manage Reviews' },
  ];

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="admin-mobile-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle menu"
            style={{ alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${isDark ? '#3a3b3c' : '#d1d5db'}`, background: isDark ? '#18191a' : '#f9fafb', color: isDark ? '#e4e6eb' : '#1a1a1a', fontSize: '15px', cursor: 'pointer' }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '600', color: isDark ? '#e4e6eb' : '#1a1a1a' }}>
            <img src="/logo.png" alt="Rent-a-Ride" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
            Rent-a-Ride Admin
          </span>
        </div>
        <div style={s.topRight}>
          <span className="admin-welcome-text" style={s.welcome}>Welcome, {user?.name}</span>
          <NotificationBell
            isDark={isDark}
            iconColor={isDark ? '#e4e6eb' : '#1a1a1a'}
            btnBg={isDark ? '#18191a' : '#f9fafb'}
            btnBorder={isDark ? '#3a3b3c' : '#d1d5db'}
          />
          <button style={s.toggleBtn} onClick={toggleTheme} aria-label="Toggle theme">{isDark ? '☀️' : '🌙'}</button>
          <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div className="admin-layout" style={s.layout}>
        <div className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={s.sidebar}>
          <div style={s.avatar}>{user?.name?.charAt(0).toUpperCase()}</div>
          <div style={s.adminName}>{user?.name}</div>
          <nav>
            {sideLinks.map((link) => {
              const count = counts[link.to] || 0;
              return (
                <Link key={link.to} to={link.to} onClick={() => setSidebarOpen(false)} style={activePage === link.label ? { ...s.sideItem, ...s.sideItemActive } : s.sideItem}>
                  {link.label}
                  {count > 0 && <span className="pending-dot" style={s.sideDot} title={`${count} needs attention`} />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ padding: '28px 32px', minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;