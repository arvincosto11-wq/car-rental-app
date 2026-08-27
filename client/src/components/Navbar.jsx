import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileOpen(false);
    logout();
    navigate('/');
  };

  const navLinkStyle = { textDecoration: 'none', color: isDark ? '#94a3b8' : '#4b5563', fontSize: '14px' };
  const mobileLinkStyle = { ...navLinkStyle, padding: '10px 0', borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}` };

  const navLinks = [
    ...(!user || user.role !== 'consignor' ? [{ to: '/', label: 'Home' }, { to: '/cars', label: 'Vehicles' }] : []),
    ...(user && user.role === 'user' ? [{ to: '/my-bookings', label: 'My Bookings' }, { to: '/dashboard', label: 'Dashboard' }] : []),
    ...(user && user.role === 'admin' ? [{ to: '/admin', label: 'Admin Dashboard' }] : []),
    ...(user && user.role === 'consignor' ? [{ to: '/consignor', label: 'My Vehicles' }] : []),
    ...(!user ? [{ to: '/consignment/register', label: 'List Your Car' }] : []),
  ];

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      background: isDark ? '#0f172a' : '#ffffff',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 32px',
      }}>
        <Link to={user && user.role === 'consignor' ? '/consignor' : '/'} style={{
          fontSize: '20px',
          fontWeight: '600',
          textDecoration: 'none',
          color: isDark ? '#f1f5f9' : '#1a1a1a',
        }}>
          🚗 Rent-a-Ride
        </Link>

        <div className="navbar-nav-links" style={{ gap: '24px', alignItems: 'center' }}>
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} style={navLinkStyle}>{link.label}</Link>
          ))}
        </div>

        <div className="navbar-auth-group" style={{ gap: '8px', alignItems: 'center' }}>
          <button onClick={toggleTheme} style={{
            padding: '6px 12px',
            borderRadius: '8px',
            border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
            background: isDark ? '#1e293b' : '#f9fafb',
            color: isDark ? '#f1f5f9' : '#1a1a1a',
            fontSize: '16px',
            cursor: 'pointer',
          }}>
            {isDark ? '☀️' : '🌙'}
          </button>

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen((v) => !v)} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: isDark ? '#1e293b' : '#f9fafb',
                border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
                color: isDark ? '#f1f5f9' : '#1a1a1a',
                fontSize: '13px',
                cursor: 'pointer',
              }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: '#2563eb', color: '#fff', fontSize: '11px',
                  fontWeight: '700', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  {user.name?.charAt(0).toUpperCase()}
                </span>
                {user.name}
                <span style={{ fontSize: '10px', opacity: 0.7 }}>{menuOpen ? '▲' : '▼'}</span>
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: '160px',
                  background: isDark ? '#1e293b' : '#fff',
                  border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
                  borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  zIndex: 200,
                }}>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block',
                      padding: '10px 16px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      color: isDark ? '#f1f5f9' : '#1a1a1a',
                      borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`,
                    }}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      fontSize: '13px',
                      color: isDark ? '#fca5a5' : '#dc2626',
                      cursor: 'pointer',
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
                textDecoration: 'none',
                fontSize: '13px',
                color: isDark ? '#f1f5f9' : '#1a1a1a',
              }}>Login</Link>
              <Link to="/register" style={{
                padding: '7px 16px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#fff',
                textDecoration: 'none',
                fontSize: '13px',
                border: 'none',
              }}>Register</Link>
            </>
          )}
        </div>

        <button
          className="navbar-mobile-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: `1px solid ${isDark ? '#334155' : '#d1d5db'}`,
            background: isDark ? '#1e293b' : '#f9fafb',
            color: isDark ? '#f1f5f9' : '#1a1a1a',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className={`navbar-mobile-menu${mobileOpen ? ' open' : ''}`} style={{
        flexDirection: 'column',
        padding: '4px 20px 16px',
        borderTop: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      }}>
        {navLinks.map((link) => (
          <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>{link.label}</Link>
        ))}

        <button onClick={() => { toggleTheme(); }} style={{ ...mobileLinkStyle, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
          {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>

        {user ? (
          <>
            <Link to="/profile" onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>Profile</Link>
            <button onClick={handleLogout} style={{ ...mobileLinkStyle, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%', color: isDark ? '#fca5a5' : '#dc2626' }}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>Login</Link>
            <Link to="/register" onClick={() => setMobileOpen(false)} style={{ ...mobileLinkStyle, color: '#2563eb', fontWeight: '600' }}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;