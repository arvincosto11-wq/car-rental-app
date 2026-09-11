import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';
import NotificationBell from './NotificationBell';
import { MenuCloseIcon } from './AnimatedStateIcons';
import useAdminPendingCounts from '../hooks/useAdminPendingCounts';

// Small line icons for the sidebar nav — hand-drawn inline SVGs (same
// approach as FlowButton's arrow) rather than pulling in an icon library
// for a handful of simple glyphs.
const NavIcon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {children}
  </svg>
);
const DashboardIcon = () => <NavIcon><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></NavIcon>;
const AnalyticsIcon = () => <NavIcon><line x1="4" y1="20" x2="4" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="20" y1="20" x2="20" y2="14" /></NavIcon>;
const AddVehicleIcon = () => <NavIcon><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></NavIcon>;
const CarIcon = () => <NavIcon><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6" rx="2" /><circle cx="7.5" cy="17" r="1.3" /><circle cx="16.5" cy="17" r="1.3" /></NavIcon>;
const GpsIcon = () => <NavIcon><path d="M12 21s7-6.4 7-12a7 7 0 0 0-14 0c0 5.6 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></NavIcon>;
const BookingsIcon = () => <NavIcon><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /></NavIcon>;
const ClientsIcon = () => <NavIcon><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9" r="2.3" /><path d="M15.5 14.3c2.3.5 3.8 2.6 3.8 5.7" /></NavIcon>;
const ConsignmentsIcon = () => <NavIcon><path d="M3 12l3-7h12l3 7" /><path d="M3 12v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6" /><path d="M3 12h5l1 3h6l1-3h5" /></NavIcon>;
const AvailabilityIcon = () => <NavIcon><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></NavIcon>;
const ReviewsIcon = () => <NavIcon><polygon points="12 2 15 9 22 9.5 16.5 14.3 18.3 21 12 17.2 5.7 21 7.5 14.3 2 9.5 9 9" /></NavIcon>;

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
    sideNav: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 12px' },
    sideItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderRadius: '10px', fontSize: '13px', color: isDark ? '#b0b3b8' : '#4b5563', textDecoration: 'none' },
    sideItemActive: { background: isDark ? GOLD_TINT_DARK : GOLD_TINT, color: isDark ? GOLD_DARK : GOLD, fontWeight: '600' },
    sideItemLabel: { flex: 1 },
    sideDot: { width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 },
  };

    const sideLinks = [
    { to: '/admin', label: 'Dashboard', Icon: DashboardIcon },
    { to: '/admin/analytics', label: 'Analytics', Icon: AnalyticsIcon },
    { to: '/admin/add-car', label: 'Add Vehicle', Icon: AddVehicleIcon },
    { to: '/admin/manage-cars', label: 'Manage Cars', Icon: CarIcon },
    { to: '/admin/gps-tracking', label: 'GPS Tracking', Icon: GpsIcon },
    { to: '/admin/manage-bookings', label: 'Manage Bookings', Icon: BookingsIcon },
    { to: '/admin/manage-clients', label: 'Manage Clients', Icon: ClientsIcon },
    { to: '/admin/manage-consignments', label: 'Manage Consignments', Icon: ConsignmentsIcon },
    { to: '/admin/availability-requests', label: 'Availability Requests', Icon: AvailabilityIcon },
    { to: '/admin/manage-reviews', label: 'Manage Reviews', Icon: ReviewsIcon },
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
            <MenuCloseIcon active={sidebarOpen} size={16} />
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
          <nav style={s.sideNav}>
            {sideLinks.map((link) => {
              const count = counts[link.to] || 0;
              const Icon = link.Icon;
              return (
                <Link key={link.to} to={link.to} onClick={() => setSidebarOpen(false)} style={activePage === link.label ? { ...s.sideItem, ...s.sideItemActive } : s.sideItem}>
                  <Icon />
                  <span style={s.sideItemLabel}>{link.label}</span>
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