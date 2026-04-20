import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 32px',
      borderBottom: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
      background: isDark ? '#0f172a' : '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/" style={{
        fontSize: '20px',
        fontWeight: '600',
        textDecoration: 'none',
        color: isDark ? '#f1f5f9' : '#1a1a1a',
      }}>
        🚗 CarRental
      </Link>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', color: isDark ? '#94a3b8' : '#4b5563', fontSize: '14px' }}>Home</Link>
        <Link to="/cars" style={{ textDecoration: 'none', color: isDark ? '#94a3b8' : '#4b5563', fontSize: '14px' }}>Cars</Link>
        {user && user.role === 'user' && (
          <>
            <Link to="/my-bookings" style={{ textDecoration: 'none', color: isDark ? '#94a3b8' : '#4b5563', fontSize: '14px' }}>My Bookings</Link>
            <Link to="/dashboard" style={{ textDecoration: 'none', color: isDark ? '#94a3b8' : '#4b5563', fontSize: '14px' }}>Dashboard</Link>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          <button onClick={handleLogout} style={{
            padding: '7px 16px',
            borderRadius: '8px',
            background: '#2563eb',
            color: '#fff',
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
          }}>
            Logout
          </button>
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
    </nav>
  );
};

export default Navbar;