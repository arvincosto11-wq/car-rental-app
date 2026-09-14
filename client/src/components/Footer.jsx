import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

// Site-wide closing chrome — currently only added to Home, since that's the
// only page this was designed against. Kept as its own component so it can
// be dropped into other pages later without duplicating the markup.
const Footer = () => {
  const { isDark } = useTheme();
  const year = new Date().getFullYear();

  const s = {
    footer: {
      background: isDark ? '#0f0d0a' : '#100d09',
      color: '#a79e8d',
      padding: '48px 32px 0',
    },
    inner: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
    // grid-template-columns lives in the .footer-grid CSS class (not here)
    // so its @media overrides in index.css can actually take effect — an
    // inline gridTemplateColumns here would otherwise out-specificity them.
    grid: {
      display: 'grid',
      gap: '32px',
      paddingBottom: '36px',
    },
    brandRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    logo: { width: '30px', height: '30px', borderRadius: '50%' },
    brandName: { fontSize: '17px', fontWeight: '700', color: '#f2eee6' },
    brandText: { fontSize: '13px', lineHeight: '1.6', color: '#a79e8d', maxWidth: '32ch', marginBottom: '16px' },
    socialRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    socialLink: {
      fontSize: '12px', fontWeight: '600', color: '#f2eee6',
      background: 'rgba(255,255,255,0.08)', padding: '6px 14px',
      borderRadius: '20px', textDecoration: 'none',
    },
    colTitle: { fontSize: '13px', fontWeight: '700', color: '#f2eee6', marginBottom: '14px' },
    linkList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
    link: { fontSize: '13px', color: '#a79e8d', textDecoration: 'none' },
    bottomBar: {
      borderTop: '1px solid rgba(255,255,255,0.08)',
      padding: '18px 0',
      textAlign: 'center',
      fontSize: '12px',
      color: '#7a7364',
    },
  };

  return (
    <footer style={s.footer}>
      <div style={s.inner}>
        <div className="footer-grid" style={s.grid}>
          <div>
            <div style={s.brandRow}>
              <img src="/logo.png" alt="Rent-a-Ride" style={s.logo} />
              <span style={s.brandName}>Rent-a-Ride</span>
            </div>
            <p style={s.brandText}>
              Well-maintained rides across Albay, with a team that treats every trip like it's our own.
            </p>
            <div style={s.socialRow}>
              <a
                href="https://www.facebook.com/rentaridealbaybranch"
                target="_blank"
                rel="noopener noreferrer"
                style={s.socialLink}
              >
                Facebook
              </a>
            </div>
          </div>

          <div>
            <div style={s.colTitle}>Navigation</div>
            <ul style={s.linkList}>
              <li><Link to="/" className="footer-link" style={s.link}>Home</Link></li>
              <li><Link to="/cars" className="footer-link" style={s.link}>Our Fleet</Link></li>
              <li><Link to="/help" className="footer-link" style={s.link}>Help</Link></li>
            </ul>
          </div>

          <div>
            <div style={s.colTitle}>Account</div>
            <ul style={s.linkList}>
              <li><Link to="/login" className="footer-link" style={s.link}>Log In</Link></li>
              <li><Link to="/register" className="footer-link" style={s.link}>Sign Up</Link></li>
              <li><Link to="/consignment/register" className="footer-link" style={s.link}>List Your Vehicle</Link></li>
            </ul>
          </div>
        </div>

        <div style={s.bottomBar}>
          © {year} Rent-A-Ride Albay. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
