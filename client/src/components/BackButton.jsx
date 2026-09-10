// Pilot for restyling the app's "← Back to..." links as a pill button
// that nudges right on hover (see .back-btn in index.css). Only wired
// into Car Detail for now — apply to the others once this feels right.
const BackButton = ({ text = 'Back', onClick }) => (
  <button type="button" className="back-btn" onClick={onClick}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
    {text}
  </button>
);

export default BackButton;
