// Ported from a Tailwind/shadcn "FlowButton" component to a plain CSS class
// (see .flow-btn rules in index.css) — same hover animation (arrows slide
// in from the sides, a circle expands from the center, text nudges over),
// skinned in the site's gold accent instead of the original black/white,
// and using a hand-drawn arrow instead of pulling in lucide-react for one icon.
const ArrowIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const FlowButton = ({ text = 'Continue', onClick, type = 'button', disabled, style, className }) => (
  <button
    type={type}
    className={`flow-btn${className ? ` ${className}` : ''}`}
    style={style}
    onClick={onClick}
    disabled={disabled}
  >
    <ArrowIcon className="flow-btn-arrow flow-btn-arrow-left" />
    <span className="flow-btn-text">{text}</span>
    <span className="flow-btn-circle" />
    <ArrowIcon className="flow-btn-arrow flow-btn-arrow-right" />
  </button>
);

export default FlowButton;
