import { Link } from 'react-router-dom';
import HomeIcon from './home/HomeIcons';

// One footer, at the bottom of every page that shows one.
//
// It used to be two things stacked: a "Get In Touch" section with emoji
// icons — 📞 📍 🕒, which render in the system emoji font and came out red
// and pink against our gold — and then a separate dark bar with the
// navigation columns. Two bands saying hello twice, in two different
// visual languages.
//
// Always dark, in both themes, as it already was. It is the end of the
// page rather than part of its surface, so it does not follow the theme.
const PHONE = '0950-651-0479';
const TEL = 'tel:09506510479';
const FACEBOOK = 'https://www.facebook.com/rentaridealbaybranch';

const GOLD = '#e8a100';
const INK = '#e4e6eb';
const SOFT = '#b0b3b8';
const MUTED = '#8a8d91';

const Footer = () => {
  const year = new Date().getFullYear();

  const s = {
    footer: { background: '#16120d', color: SOFT },
    inner: {
      maxWidth: '1520px', margin: '0 auto',
      padding: 'clamp(40px, 4.5vw, 64px) clamp(16px, 4.5vw, 72px) 0',
    },
    row: {
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
      // The column gap is narrower than the design's 5vw: at a 1280px
      // window its five columns summed past the wrapper and Account wrapped
      // onto a second row on its own, under the brand, which read as a
      // mistake rather than a layout. They all sit on one line now and the
      // gap still opens up on a wide screen.
      gap: '36px clamp(24px, 3vw, 72px)', paddingBottom: 'clamp(36px, 4vw, 52px)',
    },
    brandCol: { flex: '1.6 1 320px', minWidth: 0 },
    brandRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' },
    logo: { width: '30px', height: '30px', borderRadius: '50%' },
    brandName: { fontSize: '16px', fontWeight: '800', color: INK },
    tagline: {
      fontSize: '12px', fontWeight: '800', letterSpacing: '0.06em', color: GOLD, marginBottom: '10px',
    },
    h2: {
      fontFamily: "'Oswald', system-ui, sans-serif", fontWeight: '700', textTransform: 'uppercase',
      fontSize: 'clamp(26px, 2.4vw, 34px)', lineHeight: 1.1, margin: '0 0 12px', color: INK,
    },
    blurb: { fontSize: '14px', lineHeight: 1.6, color: SOFT, margin: 0, maxWidth: '380px' },
    col: { flex: '1 1 220px', minWidth: 0 },
    colNarrow: { flex: '0.7 1 120px', minWidth: 0 },
    colWide: { flex: '1 1 200px', minWidth: 0 },
    colHead: { fontSize: '13px', fontWeight: '800', color: INK, marginBottom: '12px' },
    contactRow: {
      display: 'flex', alignItems: 'center', gap: '10px', minHeight: '34px', fontSize: '14px', color: SOFT,
    },
    contactLink: {
      display: 'flex', alignItems: 'center', gap: '10px', minHeight: '34px',
      fontSize: '14px', color: INK, textDecoration: 'none',
    },
    iconGold: { color: GOLD, display: 'flex', flexShrink: 0 },
    list: { listStyle: 'none', padding: 0, margin: 0 },
    link: {
      display: 'flex', alignItems: 'center', minHeight: '34px',
      fontSize: '14px', color: SOFT, textDecoration: 'none',
    },
    bottom: {
      borderTop: '1px solid #2b241c', padding: '18px 0 22px',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
      gap: '10px 24px', fontSize: '12.5px', color: MUTED,
    },
    commitment: { fontWeight: '800', color: GOLD },
  };

  return (
    <footer style={s.footer} aria-labelledby="footer-title">
      <div style={s.inner}>
        <div style={s.row}>
          <div style={s.brandCol}>
            <div style={s.brandRow}>
              <img src="/logo.png" alt="" style={s.logo} />
              <span style={s.brandName}>Rent-a-Ride</span>
            </div>
            <div style={s.tagline}>#DRIVEBEYONDLIMITS</div>
            <h2 id="footer-title" style={s.h2}>Get In Touch</h2>
            <p style={s.blurb}>
              Have a question about a booking or want to reserve over the phone?
              Reach out — we&apos;re here to help.
            </p>
          </div>

          <div style={s.col}>
            <div style={s.colHead}>Contact</div>
            <a href={TEL} className="footer-link" style={s.contactLink}>
              <span style={s.iconGold}><HomeIcon name="phone" size={15} /></span>
              {PHONE}
            </a>
            <div style={s.contactRow}>
              <span style={s.iconGold}><HomeIcon name="pin" size={15} /></span>
              Salugan, Camalig, Albay
            </div>
            <div style={s.contactRow}>
              <span style={s.iconGold}><HomeIcon name="clock" size={15} /></span>
              24/7 Customer Support
            </div>
          </div>

          <div style={s.colWide}>
            <div style={s.colHead}>Follow us</div>
            <a
              href={FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              style={s.link}
            >
              Facebook: Rent-A-Ride Albay
            </a>
            <a
              href={FACEBOOK}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
              style={s.link}
            >
              @rentaridealbay
            </a>
          </div>

          <nav style={s.colNarrow} aria-label="Footer navigation">
            <div style={s.colHead}>Navigation</div>
            <ul style={s.list}>
              <li><Link to="/" className="footer-link" style={s.link}>Home</Link></li>
              <li><Link to="/cars" className="footer-link" style={s.link}>Our Vehicles</Link></li>
              <li><Link to="/help" className="footer-link" style={s.link}>Help</Link></li>
            </ul>
          </nav>

          <nav style={s.colNarrow} aria-label="Account links">
            <div style={s.colHead}>Account</div>
            <ul style={s.list}>
              <li><Link to="/login" className="footer-link" style={s.link}>Log In</Link></li>
              <li><Link to="/register" className="footer-link" style={s.link}>Sign Up</Link></li>
              <li><Link to="/consignment/register" className="footer-link" style={s.link}>List Your Vehicle</Link></li>
            </ul>
          </nav>
        </div>

        <div style={s.bottom}>
          <span>© {year} Rent-A-Ride Albay. All rights reserved.</span>
          <span>Well-maintained rides across Albay, with a team that treats every trip like it&apos;s our own.</span>
          <span style={s.commitment}>Your Journey. Our Commitment.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
