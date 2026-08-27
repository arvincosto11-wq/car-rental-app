import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';

const ThemeIcon = ({ dark, size = 16 }) => (
  dark ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  const isHome = location.pathname === '/';
  const transparent = isHome && !scrolled;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    window.scrollTo(0, 0);
    setScrolled(false);
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileOpen(false);
    logout();
    navigate('/');
  };

  // When floating over the hero photo, everything reads light regardless of
  // the real light/dark theme preference — a photo background needs light
  // text either way. Once scrolled (or on any non-Home page) it falls back
  // to the normal theme-aware colors.
  const textColor = transparent ? '#ffffff' : (isDark ? '#f1f5f9' : '#1a1a1a');
  const mutedColor = transparent ? 'rgba(255,255,255,0.85)' : (isDark ? '#94a3b8' : '#4b5563');
  const btnBg = transparent ? 'rgba(255,255,255,0.15)' : (isDark ? '#1e293b' : '#f9fafb');
  const btnBorder = transparent ? 'rgba(255,255,255,0.4)' : (isDark ? '#334155' : '#d1d5db');
  const menuBg = isDark ? '#1e293b' : '#fff';
  const menuBorder = isDark ? '#334155' : '#e5e7eb';

  const navLinkStyle = {
    textDecoration: 'none',
    color: mutedColor,
    fontSize: '14px',
    paddingBottom: '2px',
    '--nav-hover-color': (transparent || isDark) ? GOLD_DARK : GOLD,
  };
  const mobileLinkStyle = {
    textDecoration: 'none',
    color: isDark ? '#94a3b8' : '#4b5563',
    fontSize: '14px',
    padding: '10px 0',
    borderBottom: `1px solid ${isDark ? '#334155' : '#f3f4f6'}`,
  };

  const navLinks = [
    ...(!user || user.role !== 'consignor' ? [{ to: '/', label: 'Home' }, { to: '/cars', label: 'Vehicles' }] : []),
    ...(user && user.role === 'user' ? [{ to: '/my-bookings', label: 'My Bookings' }, { to: '/dashboard', label: 'Dashboard' }] : []),
    ...(user && user.role === 'admin' ? [{ to: '/admin', label: 'Admin Dashboard' }] : []),
    ...(user && user.role === 'consignor' ? [{ to: '/consignor', label: 'My Vehicles' }] : []),
    ...(!user ? [{ to: '/consignment/register', label: 'List Your Car' }] : []),
  ];

  return (
    <nav style={{
      position: isHome ? 'fixed' : 'sticky',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottom: transparent ? 'none' : `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      background: transparent ? 'transparent' : (isDark ? '#0f172a' : '#ffffff'),
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 32px',
      }}>
        <Link to={user && user.role === 'consignor' ? '/consignor' : '/'} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '20px',
          fontWeight: '600',
          textDecoration: 'none',
          color: textColor,
        }}>
          <img src="/logo.png" alt="Rent-a-Ride" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          Rent-a-Ride
        </Link>

        <div className="navbar-nav-links" style={{ gap: '24px', alignItems: 'center' }}>
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} className="nav-link" style={navLinkStyle}>{link.label}</Link>
          ))}
        </div>

        <div className="navbar-auth-group" style={{ gap: '8px', alignItems: 'center' }}>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px',
            borderRadius: '8px',
            border: `1px solid ${btnBorder}`,
            background: btnBg,
            color: textColor,
            cursor: 'pointer',
          }}>
            <ThemeIcon dark={isDark} />
          </button>

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen((v) => !v)} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                background: btnBg,
                border: `1px solid ${btnBorder}`,
                color: textColor,
                fontSize: '13px',
                cursor: 'pointer',
              }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: isDark ? GOLD_DARK : GOLD, color: ON_GOLD, fontSize: '11px',
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
                  background: menuBg,
                  border: `1px solid ${menuBorder}`,
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
              <Link className="btn-like" to="/login" style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: `1px solid ${btnBorder}`,
                textDecoration: 'none',
                fontSize: '13px',
                color: textColor,
              }}>Login</Link>
              <Link className="btn-like" to="/register" style={{
                padding: '7px 16px',
                borderRadius: '8px',
                background: isDark ? GOLD_DARK : GOLD,
                color: ON_GOLD,
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
            border: `1px solid ${btnBorder}`,
            background: btnBg,
            color: textColor,
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
        background: menuBg,
        borderTop: `1px solid ${menuBorder}`,
      }}>
        {navLinks.map((link) => (
          <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>{link.label}</Link>
        ))}

        <button onClick={() => { toggleTheme(); }} style={{ ...mobileLinkStyle, display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
          <ThemeIcon dark={isDark} /> {isDark ? 'Light Mode' : 'Dark Mode'}
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
            <Link to="/register" onClick={() => setMobileOpen(false)} style={{ ...mobileLinkStyle, color: isDark ? GOLD_DARK : GOLD, fontWeight: '600' }}>Register</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
