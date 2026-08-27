import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

const AdminLayout = ({ children, activePage }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 32px', background: isDark ? '#1e293b' : '#fff', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    topRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    welcome: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' },
    toggleBtn: { padding: '6px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, background: isDark ? '#1e293b' : '#f9fafb', color: isDark ? '#f1f5f9' : '#1a1a1a', fontSize: '16px', cursor: 'pointer' },
    logoutBtn: { padding: '7px 16px', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    layout: { display: 'grid', gridTemplateColumns: '180px 1fr' },
    sidebar: { background: isDark ? '#1e293b' : '#fff', borderRight: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, padding: '24px 0', minHeight: 'calc(100vh - 45px)' },
    avatar: { width: '48px', height: '48px', borderRadius: '50%', background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', margin: '0 auto 8px' },
    adminName: { textAlign: 'center', fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '24px' },
    sideItem: { display: 'block', padding: '10px 20px', fontSize: '13px', color: isDark ? '#94a3b8' : '#4b5563', textDecoration: 'none' },
    sideItemActive: { background: isDark ? GOLD_TINT_DARK : GOLD_TINT, color: isDark ? GOLD_DARK : GOLD, borderLeft: `3px solid ${isDark ? GOLD_DARK : GOLD}` },
  };

    const sideLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/add-car', label: 'Add Vehicle' },
    { to: '/admin/manage-cars', label: 'Manage Cars' },
    { to: '/admin/manage-bookings', label: 'Manage Bookings' },
    { to: '/admin/manage-clients', label: 'Manage Clients' },
    { to: '/admin/manage-consignments', label: 'Manage Consignments' },
    { to: '/admin/availability-requests', label: 'Availability Requests' },
  ];

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="admin-mobile-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle menu"
            style={{ alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, background: isDark ? '#0f172a' : '#f9fafb', color: isDark ? '#f1f5f9' : '#1a1a1a', fontSize: '15px', cursor: 'pointer' }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <span style={{ fontSize: '16px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' }}>
            🚗 CarRental Admin
          </span>
        </div>
        <div style={s.topRight}>
          <span className="admin-welcome-text" style={s.welcome}>Welcome, {user?.name}</span>
          <button style={s.toggleBtn} onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</button>
          <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div className="admin-layout" style={s.layout}>
        <div className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={s.sidebar}>
          <div style={s.avatar}>{user?.name?.charAt(0).toUpperCase()}</div>
          <div style={s.adminName}>{user?.name}</div>
          <nav>
            {sideLinks.map((link) => (
              <Link key={link.to} to={link.to} onClick={() => setSidebarOpen(false)} style={activePage === link.label ? { ...s.sideItem, ...s.sideItemActive } : s.sideItem}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ padding: '28px 32px', minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;