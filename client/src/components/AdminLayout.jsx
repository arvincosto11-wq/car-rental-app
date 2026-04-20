import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AdminLayout = ({ children, activePage }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  const s = {
    page: { minHeight: '100vh', background: isDark ? '#0f172a' : '#f9fafb' },
    topbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 32px', background: isDark ? '#1e293b' : '#fff', borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}` },
    topRight: { display: 'flex', alignItems: 'center', gap: '12px' },
    welcome: { fontSize: '13px', color: isDark ? '#94a3b8' : '#6b7280' },
    toggleBtn: { padding: '6px 12px', borderRadius: '8px', border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`, background: isDark ? '#1e293b' : '#f9fafb', color: isDark ? '#f1f5f9' : '#1a1a1a', fontSize: '16px', cursor: 'pointer' },
    logoutBtn: { padding: '7px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
    layout: { display: 'grid', gridTemplateColumns: '180px 1fr' },
    sidebar: { background: isDark ? '#1e293b' : '#fff', borderRight: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, padding: '24px 0', minHeight: 'calc(100vh - 45px)' },
    avatar: { width: '48px', height: '48px', borderRadius: '50%', background: isDark ? '#1d4ed8' : '#dbeafe', color: isDark ? '#fff' : '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600', margin: '0 auto 8px' },
    adminName: { textAlign: 'center', fontSize: '13px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a', marginBottom: '24px' },
    sideItem: { display: 'block', padding: '10px 20px', fontSize: '13px', color: isDark ? '#94a3b8' : '#4b5563', textDecoration: 'none' },
    sideItemActive: { background: isDark ? '#1e40af' : '#eff6ff', color: isDark ? '#fff' : '#1d4ed8', borderLeft: '3px solid #2563eb' },
  };

  const sideLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/add-car', label: 'Add car' },
    { to: '/admin/manage-cars', label: 'Manage Cars' },
    { to: '/admin/manage-bookings', label: 'Manage Bookings' },
  ];

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <span style={{ fontSize: '16px', fontWeight: '600', color: isDark ? '#f1f5f9' : '#1a1a1a' }}>
          🚗 CarRental Admin
        </span>
        <div style={s.topRight}>
          <span style={s.welcome}>Welcome, {user?.name}</span>
          <button style={s.toggleBtn} onClick={toggleTheme}>{isDark ? '☀️' : '🌙'}</button>
          <button style={s.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </div>
      <div style={s.layout}>
        <div style={s.sidebar}>
          <div style={s.avatar}>{user?.name?.charAt(0).toUpperCase()}</div>
          <div style={s.adminName}>{user?.name}</div>
          <nav>
            {sideLinks.map((link) => (
              <Link key={link.to} to={link.to} style={activePage === link.label ? { ...s.sideItem, ...s.sideItemActive } : s.sideItem}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div style={{ padding: '28px 32px' }}>{children}</div>
      </div>
    </div>
  );
};

export default AdminLayout;