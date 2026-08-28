import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { GOLD, GOLD_DARK, ON_GOLD } from '../theme';
import usePageTitle from '../hooks/usePageTitle';

const NotFound = () => {
  usePageTitle('Page Not Found');
  const { isDark } = useTheme();

  const styles = {
    container: {
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 16px',
      background: isDark ? '#0f172a' : '#f9fafb',
    },
    code: {
      fontSize: '72px',
      fontWeight: '700',
      color: isDark ? GOLD_DARK : GOLD,
      lineHeight: 1,
      marginBottom: '8px',
    },
    title: {
      fontSize: '20px',
      fontWeight: '600',
      color: isDark ? '#f1f5f9' : '#1a1a1a',
      marginBottom: '8px',
    },
    subtitle: {
      fontSize: '14px',
      color: isDark ? '#94a3b8' : '#6b7280',
      marginBottom: '24px',
      maxWidth: '360px',
    },
    btn: {
      padding: '11px 24px',
      background: isDark ? GOLD_DARK : GOLD,
      color: ON_GOLD,
      border: 'none',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      textDecoration: 'none',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.code}>404</div>
      <h1 style={styles.title}>Page not found</h1>
      <p style={styles.subtitle}>The page you're looking for doesn't exist or may have moved.</p>
      <Link className="btn-like" to="/" style={styles.btn}>Back to Home</Link>
    </div>
  );
};

export default NotFound;
