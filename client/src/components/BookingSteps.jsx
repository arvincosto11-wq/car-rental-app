import { GOLD, GOLD_DARK, GOLD_TINT, GOLD_TINT_DARK, ON_GOLD } from '../theme';

// Step list for the Car Detail booking flow, shown in the modal's sidebar
// (it collapses to a horizontal row on narrow screens via index.css).
// Completed steps are clickable to jump back; upcoming ones aren't, since
// their content depends on validating the step before them.
//
// `steps` takes either plain labels or { label, desc } — the description
// sits under the step name and is dropped in the collapsed row layout.
const BookingSteps = ({ steps, currentStep, onStepClick, isDark }) => {
  const gold = isDark ? GOLD_DARK : GOLD;
  const s = {
    list: { display: 'flex', flexDirection: 'column' },
    itemWrap: { display: 'flex', flexDirection: 'column' },
    row: { display: 'flex', alignItems: 'flex-start', gap: '12px' },
    circle: (state) => ({
      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: '800',
      background: state === 'upcoming' ? 'transparent' : gold,
      color: state === 'upcoming' ? (isDark ? '#8a8d91' : '#9ca3af') : ON_GOLD,
      border: state === 'upcoming' ? `2px solid ${isDark ? '#3a3b3c' : '#d1d5db'}` : 'none',
      // A soft ring marks where you are now, without a second colour.
      boxShadow: state === 'active' ? `0 0 0 4px ${isDark ? GOLD_TINT_DARK : GOLD_TINT}` : 'none',
    }),
    num: (state) => ({
      display: 'block', fontSize: '10px', fontWeight: '800', letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: state === 'active' ? gold : (isDark ? '#6b7280' : '#9ca3af'),
    }),
    label: (state) => ({
      display: 'block',
      fontSize: '13.5px', fontWeight: state === 'active' ? '700' : '600',
      color: state === 'upcoming' ? (isDark ? '#8a8d91' : '#9ca3af') : (isDark ? '#e4e6eb' : '#1a1a1a'),
    }),
    desc: { fontSize: '11.5px', lineHeight: 1.45, color: isDark ? '#8a8d91' : '#9ca3af', marginTop: '2px' },
    connector: (done) => ({
      width: '2px', height: '26px', margin: '4px 0 4px 14px', borderRadius: '2px',
      background: done ? gold : (isDark ? '#3a3b3c' : '#d1d5db'),
    }),
  };

  return (
    <div className="booking-steps-list" style={s.list}>
      {steps.map((rawStep, i) => {
        const step = typeof rawStep === 'string' ? { label: rawStep } : rawStep;
        const n = i + 1;
        const state = n < currentStep ? 'done' : n === currentStep ? 'active' : 'upcoming';
        const clickable = n < currentStep;
        return (
          <div key={step.label} className="booking-step-item-wrap" style={s.itemWrap}>
            <div
              className="booking-step-row"
              style={{ ...s.row, cursor: clickable ? 'pointer' : 'default' }}
              onClick={clickable ? () => onStepClick(n) : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStepClick(n); } } : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? `Back to step ${n}: ${step.label}` : undefined}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span style={s.circle(state)} aria-hidden="true">{state === 'done' ? '✓' : n}</span>
              <span className="booking-step-label" style={{ minWidth: 0 }}>
                <span style={s.num(state)}>Step {n}</span>
                <span style={s.label(state)}>{step.label}</span>
                {step.desc && <span className="booking-step-desc" style={s.desc}>{step.desc}</span>}
              </span>
            </div>
            {n < steps.length && (
              <div className="booking-step-connector" style={s.connector(n < currentStep)} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BookingSteps;
